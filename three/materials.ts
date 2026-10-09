import * as THREE from "three";
import type { PartMaterial } from "@/core/model/types";
import type { Pattern } from "@/core/style/patterns";

/**
 * Shared geometries, materials and textures. Everything is cached by key so
 * a scene with 150 chairs uses one box geometry and a handful of materials.
 * Call dispose() when the view goes away.
 */
export class SceneCache {
  readonly box = new THREE.BoxGeometry(1, 1, 1);
  readonly cylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 20);
  readonly sphere = new THREE.SphereGeometry(0.5, 20, 14);
  readonly cone = new THREE.ConeGeometry(0.5, 1, 20);
  private materials = new Map<string, THREE.Material>();
  private textures = new Map<string, THREE.Texture>();
  textureSize = 256;

  material(key: string, make: () => THREE.Material): THREE.Material {
    let m = this.materials.get(key);
    if (!m) {
      m = make();
      this.materials.set(key, m);
    }
    return m;
  }

  /** Material for a catalog part. */
  partMaterial(kind: PartMaterial, color: string): THREE.Material {
    return this.material(`part:${kind}:${color}`, () => {
      switch (kind) {
        case "metal":
          return new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.35 });
        case "glass":
          return new THREE.MeshStandardMaterial({
            color,
            transparent: true,
            opacity: 0.35,
            roughness: 0.05,
            metalness: 0.1,
            depthWrite: false,
          });
        case "light":
          return new THREE.MeshStandardMaterial({
            color,
            emissive: new THREE.Color(color),
            emissiveIntensity: 0.9,
            roughness: 0.6,
          });
        case "leaf":
          return new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true });
        case "fabric":
        case "second":
          return new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
        default:
          return new THREE.MeshStandardMaterial({ color, roughness: kind === "wood" ? 0.7 : 0.8 });
      }
    });
  }

  plain(color: string, roughness = 0.9, doubleSide = false): THREE.Material {
    return this.material(
      `plain:${color}:${roughness}:${doubleSide}`,
      () =>
        new THREE.MeshStandardMaterial({
          color,
          roughness,
          side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
        }),
    );
  }

  /** Canvas texture painted from a pattern covering w x h cm. */
  patternTexture(key: string, pattern: Pattern, w: number, h: number): THREE.Texture {
    const full = `${key}:${Math.round(w / 5)}x${Math.round(h / 5)}:${this.textureSize}`;
    let tex = this.textures.get(full);
    if (tex) return tex;
    const scale = this.textureSize / Math.max(w, h);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(16, Math.round(w * scale));
    canvas.height = Math.max(16, Math.round(h * scale));
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);
    ctx.fillStyle = pattern.background;
    ctx.fillRect(0, 0, w, h);
    for (const s of pattern.shapes) {
      ctx.beginPath();
      if (s.kind === "rect") ctx.rect(s.x, s.y, s.w, s.h);
      else if (s.kind === "ellipse")
        ctx.ellipse(s.cx, s.cy, s.rx, s.ry, s.rotation, 0, Math.PI * 2);
      else s.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      if (s.kind === "poly") ctx.closePath();
      if (s.kind !== "line" && "fill" in s && s.fill) {
        ctx.fillStyle = s.fill;
        ctx.fill();
      }
      const stroke = s.kind === "line" ? s.stroke : "stroke" in s ? s.stroke : undefined;
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = s.kind === "ellipse" ? 0.5 : (s.lineWidth ?? 0.5);
        ctx.stroke();
      }
    }
    tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    this.textures.set(full, tex);
    return tex;
  }

  texturedMaterial(
    key: string,
    pattern: Pattern,
    w: number,
    h: number,
    doubleSide = false,
  ): THREE.Material {
    const tex = this.patternTexture(key, pattern, w, h);
    return this.material(
      `tex:${tex.uuid}:${doubleSide}`,
      () =>
        new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.92,
          side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
        }),
    );
  }

  /** Drop textures when the quality (texture size) changes. */
  resetTextures() {
    for (const [k, m] of this.materials) {
      if (k.startsWith("tex:")) {
        m.dispose();
        this.materials.delete(k);
      }
    }
    this.textures.forEach((t) => t.dispose());
    this.textures.clear();
  }

  dispose() {
    this.box.dispose();
    this.cylinder.dispose();
    this.sphere.dispose();
    this.cone.dispose();
    this.materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
    this.materials.clear();
    this.textures.clear();
  }
}

/** Dispose geometries that are not shared (built per scene). */
export function disposeOwned(object: THREE.Object3D, cache: SceneCache) {
  const shared = new Set<THREE.BufferGeometry>([
    cache.box,
    cache.cylinder,
    cache.sphere,
    cache.cone,
  ]);
  object.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry && !shared.has(mesh.geometry)) mesh.geometry.dispose();
  });
}
