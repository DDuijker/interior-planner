import { roomAt } from "../collision/collision";
import { roomArea } from "../editor/rooms";
import type { Item, Room, Unit } from "../model/types";
import { formatLength } from "../measure/units";

export interface InventoryRow {
  room: string;
  name: string;
  catalogId: string;
  count: number;
  w: number;
  d: number;
  h: number;
  /** Price per piece, if every piece in this row has one. */
  price?: number;
  total?: number;
}

/**
 * Furniture list per room: identical items (same catalog entry, name and
 * size) are counted together. Rooms in plan order, items alphabetically.
 */
export function inventory(
  items: readonly Item[],
  rooms: readonly Room[],
  noRoom = "—",
): InventoryRow[] {
  const rows = new Map<string, InventoryRow & { prices: (number | undefined)[] }>();
  const order = new Map(rooms.map((r, i) => [r.id, i]));
  for (const item of items) {
    const roomId = roomAt(rooms, item);
    const room = rooms.find((r) => r.id === roomId);
    const key = [
      roomId ?? "",
      item.catalogId,
      item.name,
      Math.round(item.w),
      Math.round(item.d),
      Math.round(item.h),
    ].join("|");
    const row = rows.get(key);
    if (row) {
      row.count++;
      row.prices.push(item.price);
    } else {
      rows.set(key, {
        room: room?.name ?? noRoom,
        name: item.name,
        catalogId: item.catalogId,
        count: 1,
        w: Math.round(item.w),
        d: Math.round(item.d),
        h: Math.round(item.h),
        prices: [item.price],
      });
    }
  }
  const roomIndex = (name: string) => {
    const r = rooms.find((x) => x.name === name);
    return r ? (order.get(r.id) ?? 999) : 1000;
  };
  return [...rows.values()]
    .map(({ prices, ...row }) => {
      if (prices.every((p) => p !== undefined)) {
        const price = prices[0]!;
        const total = prices.reduce((s, p) => s + (p ?? 0), 0);
        return { ...row, ...(prices.every((p) => p === price) ? { price } : {}), total };
      }
      return row;
    })
    .sort((a, b) => roomIndex(a.room) - roomIndex(b.room) || a.name.localeCompare(b.name));
}

export function inventoryTotal(rows: readonly InventoryRow[]): number {
  return rows.reduce((s, r) => s + (r.total ?? 0), 0);
}

function csvCell(v: string | number | undefined): string {
  if (v === undefined) return "";
  const s = typeof v === "number" ? String(v).replace(".", ",") : v;
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export interface CsvLabels {
  room: string;
  name: string;
  count: string;
  size: string;
  price: string;
  total: string;
}

/** CSV with ";" separators and a BOM, so spreadsheet apps in NL open it right. */
export function inventoryCsv(rows: readonly InventoryRow[], unit: Unit, labels: CsvLabels): string {
  const lines = [
    [labels.room, labels.name, labels.count, labels.size, labels.price, labels.total]
      .map(csvCell)
      .join(";"),
  ];
  for (const r of rows) {
    const size = `${formatLength(r.w, unit)} x ${formatLength(r.d, unit)} x ${formatLength(r.h, unit)}`;
    lines.push([r.room, r.name, r.count, size, r.price, r.total].map(csvCell).join(";"));
  }
  const total = inventoryTotal(rows);
  if (total > 0) lines.push(["", labels.total, "", "", "", total].map(csvCell).join(";"));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/** Floor area per room in m², for the PDF legend. */
export function roomSummary(rooms: readonly Room[]): { name: string; area: number }[] {
  return rooms.map((r) => ({ name: r.name, area: Math.round(roomArea(r) / 1000) / 10 }));
}
