"use client";

import { useMemo, useState } from "react";
import { buildDrawing, drawingToSvg } from "@/core/export/drawing";
import {
  inventory,
  inventoryCsv,
  inventoryTotal,
  type InventoryRow,
} from "@/core/export/inventory";
import { planPdf } from "@/core/export/pdf";
import { fileNameFor } from "@/core/export/projectFile";
import { formatLength } from "@/core/measure/units";
import { updateItems } from "@/core/model/actions";
import { roomAt } from "@/core/collision/collision";
import { floorsToPlanCode } from "@/core/plancode/plancode";
import { useI18n } from "@/i18n/I18nProvider";
import { Button } from "@/ui/components/Button";
import { Modal } from "@/ui/components/Modal";
import { Tabs } from "@/ui/components/Tabs";
import { useToast } from "@/ui/components/Toast";
import { downloadBlob, downloadText } from "@/ui/download";
import { ROOM_TINTS } from "@/ui/editor/roomColors";
import { resetChanges } from "@/ui/projects/backupReminder";
import { exportProject } from "@/ui/projects/projectIO";
import { useWorkspace } from "./context";

/** Render SVG markup to a PNG of the given width. */
export async function svgToPng(svg: string, width: number): Promise<Blob | null> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("SVG could not be rendered"));
      img.src = url;
    });
    const ratio = img.naturalHeight / Math.max(1, img.naturalWidth) || 0.75;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = Math.round(width * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const ws = useWorkspace();
  const { project, version, floor, walls, pieces, apply } = ws;
  const unit = project.settings.unit;
  const [tab, setTab] = useState("project");
  const [scale, setScale] = useState(100);
  const [withList, setWithList] = useState(true);
  const [resolution, setResolution] = useState(3000);
  const roomName = (r: { name: string; type: string }) => r.name || t(`room.${r.type}` as never);
  const money = new Intl.NumberFormat(locale === "nl" ? "nl-NL" : "en-GB", {
    style: "currency",
    currency: "EUR",
  });

  const rows = useMemo(
    () => inventory(version.items, version.rooms, t("export.noRoom")),
    [version.items, version.rooms, t],
  );
  const total = inventoryTotal(rows);

  const drawing = (px: number, dims: boolean) =>
    buildDrawing(version, walls, pieces, {
      unit,
      px,
      dimensions: dims,
      tints: ROOM_TINTS,
      custom: project.customItems,
      hideLife: !project.settings.showLife,
      roomName,
    });

  const base = fileNameFor(`${project.name} ${floor.name}`, "");

  async function png2d() {
    const b = drawing(1, false).bounds;
    const d = drawing(Math.max(1, Math.max(b.w, b.d) / 900), true);
    const blob = await svgToPng(
      drawingToSvg(d, { background: "#FFFFFF", padding: 30 }),
      resolution,
    );
    if (blob) downloadBlob(blob, `${base}png`);
    else toast(t("export.failed"), "warning");
  }

  async function png3d() {
    const capture = ws.capture("3d");
    if (!capture) {
      toast(t("export.open3d"), "warning");
      return;
    }
    const blob = await capture(resolution / 1000);
    if (blob) downloadBlob(blob, `${base}3d.png`);
  }

  function pdf() {
    // Line widths and text: 1 pt at 1:scale on paper is scale*0.0353 cm in the world.
    const px = scale * 0.0353;
    const d = drawing(px, true);
    const result = planPdf(d, {
      title: project.name,
      subtitle: `${floor.name} · ${version.kind === "current" ? t("versions.current") : version.name}`,
      scale,
      date: new Date().toLocaleDateString(locale === "nl" ? "nl-NL" : "en-GB"),
      labels: {
        scale: t("export.scale"),
        inventory: t("export.list"),
        room: t("export.room"),
        item: t("export.item"),
        count: t("export.count"),
        size: t("export.size"),
        price: t("export.price"),
        total: t("export.total"),
        notToScale: t("export.notToScale"),
      },
      ...(withList
        ? {
            inventory: rows.map((r) => ({
              room: r.room,
              name: r.name,
              count: r.count,
              size: `${formatLength(r.w, unit)} x ${formatLength(r.d, unit)} x ${formatLength(r.h, unit)}`,
              ...(r.price !== undefined ? { price: money.format(r.price) } : {}),
              ...(r.total !== undefined ? { total: money.format(r.total) } : {}),
            })),
            ...(total > 0 ? { grandTotal: `${t("export.total")}: ${money.format(total)}` } : {}),
          }
        : {}),
    });
    downloadBlob(new Blob([result.bytes as BlobPart], { type: "application/pdf" }), `${base}pdf`);
    if (!result.toScale) toast(t("export.pdfShrunk", { scale }), "warning");
  }

  function setRowPrice(row: InventoryRow, price: number | undefined) {
    const ids = version.items
      .filter(
        (i) =>
          i.catalogId === row.catalogId &&
          i.name === row.name &&
          Math.round(i.w) === row.w &&
          Math.round(i.d) === row.d &&
          Math.round(i.h) === row.h &&
          (version.rooms.find((r) => r.id === roomAt(version.rooms, i))?.name ??
            t("export.noRoom")) === row.room,
      )
      .map((i) => i.id);
    apply((p) => updateItems(p, ids, { price }));
  }

  const planCode = useMemo(() => floorsToPlanCode(project.floors), [project.floors]);

  return (
    <Modal open onClose={onClose} title={t("workspace.export")}>
      <Tabs
        label={t("workspace.export")}
        value={tab}
        onChange={setTab}
        items={[
          {
            id: "project",
            label: t("export.tab.project"),
            content: (
              <div className="stack">
                <p>{t("export.projectHint")}</p>
                <Button
                  variant="primary"
                  icon="download"
                  onClick={async () => {
                    downloadText(
                      await exportProject(project),
                      fileNameFor(project.name, "maison.json"),
                    );
                    resetChanges(project.id);
                  }}
                >
                  {t("export.projectButton")}
                </Button>
              </div>
            ),
          },
          {
            id: "image",
            label: t("export.tab.image"),
            content: (
              <div className="stack">
                <label className="field">
                  <span className="field-label">{t("export.resolution")}</span>
                  <select
                    className="input"
                    value={resolution}
                    onChange={(e) => setResolution(Number(e.target.value))}
                  >
                    {[1500, 3000, 6000].map((w) => (
                      <option key={w} value={w}>
                        {w} px
                      </option>
                    ))}
                  </select>
                </label>
                <div className="row">
                  <Button icon="image" onClick={() => void png2d()}>
                    {t("export.png2d")}
                  </Button>
                  <Button icon="cube" onClick={() => void png3d()}>
                    {t("export.png3d")}
                  </Button>
                </div>
              </div>
            ),
          },
          {
            id: "pdf",
            label: "PDF",
            content: (
              <div className="stack">
                <label className="field">
                  <span className="field-label">{t("export.scale")}</span>
                  <select
                    className="input"
                    value={scale}
                    onChange={(e) => setScale(Number(e.target.value))}
                  >
                    <option value={50}>1:50</option>
                    <option value={100}>1:100</option>
                  </select>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={withList}
                    onChange={(e) => setWithList(e.target.checked)}
                  />
                  {t("export.withList")}
                </label>
                <Button variant="primary" icon="download" onClick={pdf}>
                  {t("export.pdfButton")}
                </Button>
              </div>
            ),
          },
          {
            id: "list",
            label: t("export.list"),
            content: (
              <div className="stack">
                <div className="table-wrap">
                  <table className="inventory">
                    <thead>
                      <tr>
                        <th scope="col">{t("export.room")}</th>
                        <th scope="col">{t("export.item")}</th>
                        <th scope="col">{t("export.count")}</th>
                        <th scope="col">{t("export.size")}</th>
                        <th scope="col">{t("export.price")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={`${r.room}|${r.catalogId}|${r.name}|${r.w}|${r.d}|${r.h}`}>
                          <td>{r.room}</td>
                          <td>{r.name}</td>
                          <td>{r.count}</td>
                          <td>
                            {formatLength(r.w, unit)} x {formatLength(r.d, unit)} x{" "}
                            {formatLength(r.h, unit)}
                          </td>
                          <td>
                            <label className="sr-only" htmlFor={`price-${r.room}-${r.name}-${r.w}`}>
                              {t("export.priceFor", { name: r.name })}
                            </label>
                            <input
                              id={`price-${r.room}-${r.name}-${r.w}`}
                              className="input input-price"
                              inputMode="decimal"
                              defaultValue={r.price ?? ""}
                              onBlur={(e) => {
                                const v = e.target.value.trim().replace(",", ".");
                                setRowPrice(
                                  r,
                                  v === "" ? undefined : Math.max(0, Number(v)) || undefined,
                                );
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {total > 0 && (
                  <p>
                    <strong>
                      {t("export.total")}: {money.format(total)}
                    </strong>
                  </p>
                )}
                <Button
                  icon="download"
                  onClick={() =>
                    downloadText(
                      inventoryCsv(rows, unit, {
                        room: t("export.room"),
                        name: t("export.item"),
                        count: t("export.count"),
                        size: t("export.size"),
                        price: t("export.price"),
                        total: t("export.total"),
                      }),
                      `${base}csv`,
                      "text/csv",
                    )
                  }
                >
                  {t("export.csv")}
                </Button>
              </div>
            ),
          },
          {
            id: "code",
            label: t("export.tab.code"),
            content: (
              <div className="stack">
                <p className="muted">{t("export.codeHint")}</p>
                <label className="sr-only" htmlFor="plan-code-out">
                  {t("export.tab.code")}
                </label>
                <textarea
                  id="plan-code-out"
                  className="input code-area"
                  readOnly
                  value={planCode}
                  rows={12}
                />
                <div className="row">
                  <Button
                    icon="copy"
                    onClick={async () => {
                      await navigator.clipboard?.writeText(planCode);
                      toast(t("common.copied"), "success");
                    }}
                  >
                    {t("common.copy")}
                  </Button>
                  <Button
                    icon="download"
                    onClick={() => downloadText(planCode, fileNameFor(project.name, "plan.json"))}
                  >
                    {t("common.download")}
                  </Button>
                </div>
              </div>
            ),
          },
        ]}
      />
    </Modal>
  );
}
