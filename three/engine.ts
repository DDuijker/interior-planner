import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Floor, Id, Item, Project, Rect } from "@/core/model/types";
import {
  collide,
  daylight,
  floorBases,
  lerpView,
  pickLights,
  QUALITY,
  stairProgress,
  sunDirection,
  visibleFloors,
  type QualityLevel,
  type StackMode,
  type Vec3,
  type Viewpoint,
} from "@/core/scene/scene";
import { resolveEntry } from "@/catalog";
import {
  activeVersion,
  buildArchitecture,
  buildItem,
  holesFor,
  type LampInfo,
  type PickInfo,
} from "./build";
import { disposeOwned, SceneCache } from "./materials";

/** Plan point + height to a world vector. */
export const toWorld = (v: Vec3) => new THREE.Vector3(v.x, v.z, v.y);

export interface EngineOptions {
  mode: StackMode;
  hidden: ReadonlySet<string>;
  quality: QualityLevel;
  hour: number;
  evening: boolean;
  dollhouse: boolean;
  shadows: boolean;
}

export interface EngineCallbacks {
  onPick: (info: PickInfo | null, face: number | undefined, event: PointerEvent) => void;
  onDragItem: (id: Id, dx: number, dy: number, phase: "start" | "move" | "end") => void;
  onFrameTimes: (times: number[]) => void;
  onWalkFloor?: (floorId: Id) => void;
}

interface FloorEntry {
  key: string;
  floor: Floor;
  arch: THREE.Group;
  walls: THREE.Mesh[];
  obstacles: Rect[];
  items: Map<Id, { item: Item; group: THREE.Group; lamp?: LampInfo }>;
  root: THREE.Group;
}

const reduceMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 5, 30000);
  readonly controls: OrbitControls;
  readonly cache = new SceneCache();
  private hemi = new THREE.HemisphereLight("#FFFFFF", "#B9A98F", 1.1);
  private ambient = new THREE.AmbientLight("#FFFFFF", 0.25);
  private sun = new THREE.DirectionalLight("#FFF3DE", 1.6);
  private lampLights: THREE.PointLight[] = [];
  private floors = new Map<Id, FloorEntry>();
  private project: Project | null = null;
  private opts: EngineOptions;
  private frame = 0;
  private times: number[] = [];
  private last = performance.now();
  private anim: { from: Viewpoint; to: Viewpoint; start: number; ms: number } | null = null;
  private ghostMaterial = new THREE.MeshStandardMaterial({
    color: "#EDE8DE",
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
  });
  private originalMaterials = new WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>();
  private raycaster = new THREE.Raycaster();
  private drag: { id: Id; plane: THREE.Plane; last: THREE.Vector3 } | null = null;
  private resizeObserver: ResizeObserver;
  // Walking
  walking = false;
  private yaw = 0;
  private pitch = 0;
  private keys = new Set<string>();
  joystick = { x: 0, y: 0 };
  private walkPos = new THREE.Vector3();
  private eyeHeight = 160;
  private lookDrag: { x: number; y: number } | null = null;

  constructor(
    private container: HTMLElement,
    private callbacks: EngineCallbacks,
    opts: EngineOptions,
  ) {
    this.opts = opts;
    const q = QUALITY[opts.quality];
    this.renderer = new THREE.WebGLRenderer({
      antialias: q.antialias,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = q.shadows && opts.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
    this.renderer.domElement.className = "three-canvas";
    container.appendChild(this.renderer.domElement);
    this.cache.textureSize = q.textureSize;

    this.scene.background = new THREE.Color("#EFEAE0");
    this.scene.add(this.hemi, this.ambient, this.sun, this.sun.target);
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 8000;
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(20000, 48),
      new THREE.MeshStandardMaterial({ color: "#DCD5C6", roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2;
    ground.receiveShadow = true;
    ground.name = "ground";
    this.scene.add(ground);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !reduceMotion();
    this.controls.minDistance = 80;
    this.controls.maxDistance = 6000;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.screenSpacePanning = false;
    this.controls.addEventListener("change", () => this.updateDollhouse());

    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", this.onPointerDown);
    el.addEventListener("pointermove", this.onPointerMove);
    el.addEventListener("pointerup", this.onPointerUp);
    el.tabIndex = 0;
    el.addEventListener("keydown", this.onKeyDown);
    el.addEventListener("keyup", this.onKeyUp);
    el.addEventListener("blur", () => this.keys.clear());

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.loop();
  }

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    this.frame = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(100, now - this.last);
    this.last = now;
    this.times.push(dt);
    if (this.times.length >= 120) {
      this.callbacks.onFrameTimes(this.times);
      this.times = [];
    }
    if (this.anim) {
      const t = Math.min(1, (now - this.anim.start) / this.anim.ms);
      const v = lerpView(this.anim.from, this.anim.to, t);
      this.camera.position.copy(toWorld(v.position));
      this.controls.target.copy(toWorld(v.target));
      if (t >= 1) this.anim = null;
      this.updateDollhouse();
    }
    if (this.walking) this.stepWalk(dt / 1000);
    else this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  // ------------------------------------------------------------ building

  setOptions(opts: EngineOptions) {
    const qualityChanged = opts.quality !== this.opts.quality || opts.shadows !== this.opts.shadows;
    this.opts = opts;
    if (qualityChanged) {
      const q = QUALITY[opts.quality];
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
      this.renderer.shadowMap.enabled = q.shadows && opts.shadows;
      this.cache.textureSize = q.textureSize;
      this.cache.resetTextures();
      this.clearFloors();
    }
    if (this.project) this.setProject(this.project);
    this.updateLighting();
  }

  private clearFloors() {
    for (const f of this.floors.values()) {
      this.scene.remove(f.root);
      disposeOwned(f.root, this.cache);
    }
    this.floors.clear();
  }

  /** Rebuild what changed. Items are reused when their object is unchanged. */
  setProject(project: Project) {
    this.project = project;
    const q = QUALITY[this.opts.quality];
    const show = visibleFloors(project, this.opts.mode, this.opts.hidden);
    const bases = floorBases(project, this.opts.mode);
    const keep = new Set(show.map((f) => f.id));
    for (const [id, entry] of this.floors) {
      if (!keep.has(id)) {
        this.scene.remove(entry.root);
        disposeOwned(entry.root, this.cache);
        this.floors.delete(id);
      }
    }
    const topId = show[show.length - 1]?.id;
    for (const floor of show) {
      const version = activeVersion(floor);
      const holes = holesFor(project, floor);
      const ceilings = this.walking || (this.opts.mode !== "single" && floor.id !== topId);
      const archKey = JSON.stringify([
        version.rooms,
        version.extraWalls,
        version.openings,
        version.fixtures,
        version.style,
        version.wallOverrides,
        version.demolitions,
        floor.height,
        project.settings.wallThickness,
        holes,
        ceilings,
        q.shadows && this.opts.shadows,
      ]);
      let entry = this.floors.get(floor.id);
      if (!entry) {
        const root = new THREE.Group();
        this.scene.add(root);
        entry = {
          key: "",
          floor,
          arch: new THREE.Group(),
          walls: [],
          obstacles: [],
          items: new Map(),
          root,
        };
        this.floors.set(floor.id, entry);
      }
      entry.floor = floor;
      entry.root.position.y = bases.get(floor.id) ?? 0;
      if (entry.key !== archKey) {
        entry.root.remove(entry.arch);
        disposeOwned(entry.arch, this.cache);
        const built = buildArchitecture(floor, version, project, {
          cache: this.cache,
          custom: project.customItems,
          ceilings,
          decor: q.decor,
          showLife: project.settings.showLife,
          holes,
          shadows: q.shadows && this.opts.shadows,
        });
        entry.arch = built.group;
        entry.walls = built.walls;
        entry.obstacles = built.obstacles;
        entry.key = archKey;
        entry.root.add(entry.arch);
      }
      // Items: diff by object identity (the model is immutable).
      const seen = new Set<Id>();
      for (const item of version.items) {
        const e = resolveEntry(item, project.customItems);
        if (!project.settings.layers[item.layer].visible) continue;
        if (!project.settings.showLife && e?.life) continue;
        if (!q.decor && item.mount === "stack" && item.layer === "decor") continue;
        seen.add(item.id);
        const prev = entry.items.get(item.id);
        if (prev && prev.item === item) continue;
        if (prev) {
          entry.root.remove(prev.group);
        }
        const built = buildItem(item, floor, {
          cache: this.cache,
          custom: project.customItems,
          shadows: q.shadows && this.opts.shadows,
        });
        entry.root.add(built.group);
        entry.items.set(item.id, {
          item,
          group: built.group,
          ...(built.lamp ? { lamp: built.lamp } : {}),
        });
      }
      for (const [id, it] of entry.items) {
        if (!seen.has(id)) {
          entry.root.remove(it.group);
          entry.items.delete(id);
        }
      }
    }
    this.updateLighting();
    this.updateDollhouse();
  }

  /** Bounds of what is shown, in plan coordinates. */
  bounds(): Rect {
    const box = new THREE.Box3();
    for (const f of this.floors.values()) box.expandByObject(f.arch);
    if (box.isEmpty()) return { x: 0, y: 0, w: 800, d: 600 };
    return { x: box.min.x, y: box.min.z, w: box.max.x - box.min.x, d: box.max.z - box.min.z };
  }

  baseOf(floorId: Id): number {
    return this.floors.get(floorId)?.root.position.y ?? 0;
  }

  // ------------------------------------------------------------ lighting

  private updateLighting() {
    const project = this.project;
    const day = this.opts.evening ? 0 : daylight(this.opts.hour);
    const b = this.bounds();
    const centre = new THREE.Vector3(b.x + b.w / 2, 0, b.y + b.d / 2);
    const dir = sunDirection(this.opts.hour, project?.settings.northAngle ?? 0);
    const r = Math.max(b.w, b.d) + 600;
    this.sun.position
      .copy(centre)
      .add(new THREE.Vector3(dir.x * r, Math.max(0.1, dir.z) * r, dir.y * r));
    this.sun.target.position.copy(centre);
    this.sun.intensity = 2.2 * day;
    this.sun.castShadow = this.renderer.shadowMap.enabled && day > 0.05;
    const s = this.sun.shadow.camera;
    s.left = s.bottom = -r;
    s.right = s.top = r;
    s.updateProjectionMatrix();
    this.hemi.intensity = 0.25 + 0.9 * day;
    this.ambient.intensity = this.opts.evening ? 0.08 : 0.2;
    this.scene.background = new THREE.Color(
      this.opts.evening ? "#1E2430" : day > 0.2 ? "#EFEAE0" : "#C9C0B0",
    );
    this.renderer.toneMappingExposure = this.opts.evening ? 1.25 : 1.05;

    // Lamps: in the evening only, and only the ones that matter most.
    for (const l of this.lampLights) {
      this.scene.remove(l);
      l.dispose();
    }
    this.lampLights = [];
    if (!this.opts.evening) return;
    const lamps: (LampInfo & { world: THREE.Vector3 })[] = [];
    for (const f of this.floors.values()) {
      for (const it of f.items.values()) {
        if (it.lamp)
          lamps.push({
            ...it.lamp,
            world: it.lamp.position.clone().add(new THREE.Vector3(0, f.root.position.y, 0)),
          });
      }
    }
    const eye = this.camera.position;
    const chosen = pickLights(
      lamps.map((l) => ({ ...l, position: { x: l.world.x, y: l.world.z, z: l.world.y } })),
      { x: eye.x, y: eye.z, z: eye.y },
      QUALITY[this.opts.quality].maxLights,
    );
    for (const l of chosen) {
      const light = new THREE.PointLight(l.color, 18000 * l.intensity, 900, 2);
      light.position.set(l.position.x, l.position.z, l.position.y);
      this.scene.add(light);
      this.lampLights.push(light);
    }
  }

  // ------------------------------------------------------------ dollhouse

  private updateDollhouse() {
    const camXZ = new THREE.Vector2(this.camera.position.x, this.camera.position.z);
    const target = new THREE.Vector2(this.controls.target.x, this.controls.target.z);
    const look = camXZ.clone().sub(target);
    const looking = look.length() > 1;
    look.normalize();
    for (const f of this.floors.values()) {
      for (const mesh of f.walls) {
        const original = this.originalMaterials.get(mesh) ?? mesh.material;
        this.originalMaterials.set(mesh, original);
        let fade = false;
        if (this.opts.dollhouse && !this.walking && looking) {
          const c = new THREE.Vector2(mesh.position.x, mesh.position.z).sub(target);
          fade = c.dot(look) > Math.max(60, c.length() * 0.35) && mesh.scale.y > 120;
        }
        mesh.material = fade ? this.ghostMaterial : original;
      }
    }
  }

  // ------------------------------------------------------------ cameras

  goTo(v: Viewpoint, animate = true) {
    const from: Viewpoint = {
      position: { x: this.camera.position.x, y: this.camera.position.z, z: this.camera.position.y },
      target: { x: this.controls.target.x, y: this.controls.target.z, z: this.controls.target.y },
    };
    if (!animate || reduceMotion()) {
      this.camera.position.copy(toWorld(v.position));
      this.controls.target.copy(toWorld(v.target));
      this.controls.update();
      this.updateDollhouse();
      return;
    }
    this.anim = { from, to: v, start: performance.now(), ms: 700 };
  }

  // ------------------------------------------------------------ walking

  startWalk(at: { x: number; y: number }, eyeHeight: number) {
    this.walking = true;
    this.eyeHeight = eyeHeight;
    this.controls.enabled = false;
    this.walkPos.set(at.x, 0, at.y);
    this.yaw = 0;
    this.pitch = 0;
    this.renderer.domElement.focus();
    if (this.project) this.setProject(this.project);
  }

  stopWalk() {
    this.walking = false;
    this.controls.enabled = true;
    this.keys.clear();
    if (this.project) this.setProject(this.project);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.walking) return;
    const k = e.key.toLowerCase();
    if (
      ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "q", "e"].includes(k)
    ) {
      e.preventDefault();
      e.stopPropagation();
      this.keys.add(k);
    }
  };

  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());

  private stepWalk(dt: number) {
    const speed = 160; // cm per second
    let forward = 0,
      strafe = 0;
    if (this.keys.has("w") || this.keys.has("arrowup")) forward += 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) forward -= 1;
    if (this.keys.has("d")) strafe += 1;
    if (this.keys.has("a")) strafe -= 1;
    if (this.keys.has("arrowleft") || this.keys.has("q")) this.yaw += 1.6 * dt;
    if (this.keys.has("arrowright") || this.keys.has("e")) this.yaw -= 1.6 * dt;
    forward += -this.joystick.y;
    strafe += this.joystick.x;
    const dir = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-dir.z, 0, dir.x);
    const move = dir.multiplyScalar(forward).add(right.multiplyScalar(strafe));
    if (move.lengthSq() > 1) move.normalize();
    const next = {
      x: this.walkPos.x + move.x * speed * dt,
      y: this.walkPos.z + move.z * speed * dt,
    };
    // Find the floor we stand on: the highest base not above our feet.
    const entry = this.currentWalkFloor();
    const resolved = entry ? collide(next, 25, entry.obstacles) : next;
    this.walkPos.x = resolved.x;
    this.walkPos.z = resolved.y;
    let feet = entry ? entry.root.position.y : 0;
    if (entry) {
      const version = activeVersion(entry.floor);
      for (const f of version.fixtures) {
        if (f.type !== "stairs") continue;
        const p = stairProgress(f, resolved);
        if (p !== null) {
          feet += p * (entry.floor.height + 25);
          if (p > 0.97) {
            const above = [...this.floors.values()]
              .filter((x) => x.root.position.y > entry.root.position.y)
              .sort((a, b) => a.root.position.y - b.root.position.y)[0];
            if (above) this.callbacks.onWalkFloor?.(above.floor.id);
          }
        }
      }
    }
    this.walkPos.y += (feet - this.walkPos.y) * Math.min(1, dt * 10);
    this.camera.position.set(this.walkPos.x, this.walkPos.y + this.eyeHeight, this.walkPos.z);
    const look = new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    this.camera.lookAt(this.camera.position.clone().add(look));
  }

  private currentWalkFloor(): FloorEntry | undefined {
    const feet = this.walkPos.y + 30;
    return [...this.floors.values()]
      .filter((f) => f.root.position.y <= feet)
      .sort((a, b) => b.root.position.y - a.root.position.y)[0];
  }

  // ------------------------------------------------------------ picking

  private pointer(e: PointerEvent): THREE.Vector2 {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
  }

  private hit(e: PointerEvent): { info: PickInfo; face?: number; point: THREE.Vector3 } | null {
    this.raycaster.setFromCamera(this.pointer(e), this.camera);
    const roots = [...this.floors.values()].map((f) => f.root);
    for (const h of this.raycaster.intersectObjects(roots, true)) {
      const mesh = h.object as THREE.Mesh;
      if (mesh.material === this.ghostMaterial) continue;
      const info = mesh.userData.pick as PickInfo | undefined;
      if (info) return { info, ...(h.face ? { face: h.face.materialIndex } : {}), point: h.point };
    }
    return null;
  }

  private downAt: { x: number; y: number } | null = null;

  private onPointerDown = (e: PointerEvent) => {
    this.downAt = { x: e.clientX, y: e.clientY };
    if (this.walking) {
      this.lookDrag = { x: e.clientX, y: e.clientY };
      return;
    }
    if (e.button !== 0) return;
    const h = this.hit(e);
    if (h?.info.type === "item") {
      const entry = this.floors.get(h.info.floorId);
      const item = entry?.items.get(h.info.id)?.item;
      if (!item || item.locked) return;
      this.controls.enabled = false;
      const base = entry!.root.position.y;
      this.drag = {
        id: item.id,
        plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -(base + item.elevation)),
        last: h.point.clone(),
      };
      this.renderer.domElement.setPointerCapture(e.pointerId);
      this.callbacks.onPick(h.info, h.face, e);
      this.callbacks.onDragItem(item.id, 0, 0, "start");
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.walking && this.lookDrag) {
      this.yaw -= (e.clientX - this.lookDrag.x) * 0.005;
      this.pitch = Math.max(
        -1.2,
        Math.min(1.2, this.pitch - (e.clientY - this.lookDrag.y) * 0.005),
      );
      this.lookDrag = { x: e.clientX, y: e.clientY };
      return;
    }
    if (!this.drag) return;
    this.raycaster.setFromCamera(this.pointer(e), this.camera);
    const p = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.drag.plane, p)) return;
    const dx = p.x - this.drag.last.x,
      dz = p.z - this.drag.last.z;
    if (Math.abs(dx) < 0.5 && Math.abs(dz) < 0.5) return;
    this.drag.last = p;
    this.callbacks.onDragItem(this.drag.id, dx, dz, "move");
  };

  private onPointerUp = (e: PointerEvent) => {
    this.lookDrag = null;
    const moved = this.downAt
      ? Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) > 5
      : true;
    if (this.drag) {
      this.callbacks.onDragItem(this.drag.id, 0, 0, "end");
      this.drag = null;
      this.controls.enabled = !this.walking;
      return;
    }
    if (moved || this.walking) return;
    const h = this.hit(e);
    this.callbacks.onPick(h?.info ?? null, h?.face, e);
  };

  // ------------------------------------------------------------ capture

  async capture(scale = 2): Promise<Blob | null> {
    const prev = this.renderer.getPixelRatio();
    this.renderer.setPixelRatio(Math.min(4, scale));
    this.resize();
    this.renderer.render(this.scene, this.camera);
    const blob = await new Promise<Blob | null>((resolve) =>
      this.renderer.domElement.toBlob(resolve, "image/png"),
    );
    this.renderer.setPixelRatio(prev);
    this.resize();
    return blob;
  }

  /** Render the current view to a data URL right now. */
  snapshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL("image/png");
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.onPointerDown);
    el.removeEventListener("pointermove", this.onPointerMove);
    el.removeEventListener("pointerup", this.onPointerUp);
    el.removeEventListener("keydown", this.onKeyDown);
    el.removeEventListener("keyup", this.onKeyUp);
    this.clearFloors();
    for (const l of this.lampLights) l.dispose();
    this.ghostMaterial.dispose();
    this.controls.dispose();
    this.cache.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    this.renderer.dispose();
    el.remove();
  }
}
