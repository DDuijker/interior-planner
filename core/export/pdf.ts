import type { Drawing, Shape } from "./drawing";

/**
 * Minimal vector PDF writer: lines, filled polygons and Helvetica text.
 * Enough for a floor plan at scale plus a furniture list, without a
 * dependency. Coordinates on a page are millimetres from the top-left.
 */

const MM = 72 / 25.4;

export interface PaperSize {
  name: "A4" | "A3";
  /** Millimetres, landscape. */
  w: number;
  h: number;
}

export const PAPERS: readonly PaperSize[] = [
  { name: "A4", w: 297, h: 210 },
  { name: "A3", w: 420, h: 297 },
];

type Op =
  | {
      t: "poly";
      points: [number, number][];
      fill?: string;
      stroke?: string;
      width?: number;
      dash?: number[];
      close: boolean;
    }
  | {
      t: "text";
      x: number;
      y: number;
      text: string;
      size: number;
      color: string;
      anchor: "start" | "middle" | "end";
      bold?: boolean;
    };

export class PdfPage {
  readonly ops: Op[] = [];
  constructor(
    readonly width: number,
    readonly height: number,
  ) {}

  line(points: [number, number][], stroke: string, width = 0.25, dash?: number[]) {
    this.ops.push({ t: "poly", points, stroke, width, close: false, ...(dash ? { dash } : {}) });
  }

  polygon(points: [number, number][], fill?: string, stroke?: string, width = 0.2) {
    this.ops.push({
      t: "poly",
      points,
      close: true,
      width,
      ...(fill ? { fill } : {}),
      ...(stroke ? { stroke } : {}),
    });
  }

  rect(x: number, y: number, w: number, h: number, fill?: string, stroke?: string, width = 0.2) {
    this.polygon(
      [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
      ],
      fill,
      stroke,
      width,
    );
  }

  text(
    x: number,
    y: number,
    text: string,
    size: number,
    opts: { color?: string; anchor?: "start" | "middle" | "end"; bold?: boolean } = {},
  ) {
    this.ops.push({
      t: "text",
      x,
      y,
      text,
      size,
      color: opts.color ?? "#2A2620",
      anchor: opts.anchor ?? "start",
      ...(opts.bold ? { bold: true } : {}),
    });
  }
}

function rgb(hex: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return "0 0 0";
  return [m[1], m[2], m[3]].map((h) => (parseInt(h!, 16) / 255).toFixed(3)).join(" ");
}

const n = (v: number) => (Math.round(v * 100) / 100).toString();

/** Text as a PDF string in WinAnsi encoding. */
export function pdfString(text: string): string {
  let out = "(";
  for (const ch of text) {
    let code = ch.codePointAt(0)!;
    if (ch === "€") code = 0x80;
    else if (ch === "–" || ch === "—") code = 0x96;
    else if (ch === "‘" || ch === "’") code = 0x27;
    else if (ch === "“" || ch === "”") code = 0x22;
    else if (code > 0xff) code = 0x3f;
    if (ch === "(" || ch === ")" || ch === "\\") out += "\\" + ch;
    else if (code < 32 || code > 126) out += "\\" + code.toString(8).padStart(3, "0");
    else out += String.fromCharCode(code);
  }
  return out + ")";
}

/** Rough Helvetica width, good enough for centring labels. */
export function textWidth(text: string, size: number, bold = false): number {
  let w = 0;
  for (const ch of text)
    w += /[il.,:;|'!]/.test(ch)
      ? 0.28
      : /[mwMW@]/.test(ch)
        ? 0.85
        : /[A-Z0-9]/.test(ch)
          ? 0.66
          : 0.52;
  return w * size * (bold ? 1.06 : 1);
}

function contentStream(page: PdfPage): string {
  const H = page.height;
  const out: string[] = [];
  for (const op of page.ops) {
    if (op.t === "poly") {
      if (op.points.length < 2) continue;
      out.push("q");
      if (op.fill) out.push(`${rgb(op.fill)} rg`);
      if (op.stroke) out.push(`${rgb(op.stroke)} RG ${n((op.width ?? 0.2) * MM)} w`);
      out.push(op.dash ? `[${op.dash.map((d) => n(d * MM)).join(" ")}] 0 d` : "[] 0 d");
      out.push("1 j 1 J");
      op.points.forEach(([x, y], i) =>
        out.push(`${n(x * MM)} ${n((H - y) * MM)} ${i ? "l" : "m"}`),
      );
      if (op.close) out.push("h");
      out.push(op.fill && op.stroke ? "B" : op.fill ? "f" : "S");
      out.push("Q");
    } else {
      const w = textWidth(op.text, op.size, op.bold);
      const x = op.anchor === "middle" ? op.x - w / 2 : op.anchor === "end" ? op.x - w : op.x;
      out.push(
        `BT /${op.bold ? "F2" : "F1"} ${n(op.size * MM)} Tf ${rgb(op.color)} rg ${n(x * MM)} ${n((H - op.y) * MM)} Td ${pdfString(op.text)} Tj ET`,
      );
    }
  }
  return out.join("\n");
}

/** Serialise pages to PDF bytes. */
export function writePdf(pages: readonly PdfPage[], title = "Maison"): Uint8Array {
  const objects: string[] = [];
  const add = (body: string) => {
    objects.push(body);
    return objects.length;
  };
  add("<< /Type /Catalog /Pages 2 0 R >>");
  add(""); // pages, filled in below
  const font = add(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );
  const bold = add(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  );
  const info = add(`<< /Title ${pdfString(title)} /Producer (Maison) >>`);
  const kids: number[] = [];
  for (const page of pages) {
    const stream = contentStream(page);
    const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    kids.push(
      add(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(page.width * MM)} ${n(page.height * MM)}] /Resources << /Font << /F1 ${font} 0 R /F2 ${bold} 0 R >> >> /Contents ${content} 0 R >>`,
      ),
    );
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;

  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) pdf += `${String(o).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return bytes;
}

export interface PlanPdfOptions {
  title: string;
  subtitle: string;
  /** 50 for 1:50, 100 for 1:100. */
  scale: number;
  date: string;
  labels: {
    scale: string;
    inventory: string;
    room: string;
    item: string;
    count: string;
    size: string;
    price: string;
    total: string;
    notToScale: string;
  };
  inventory?: {
    room: string;
    name: string;
    count: number;
    size: string;
    price?: string;
    total?: string;
  }[];
  grandTotal?: string;
}

export interface PlanPdfResult {
  bytes: Uint8Array;
  paper: PaperSize;
  /** False when the plan did not fit on A3 at this scale and was shrunk. */
  toScale: boolean;
}

/** Plan page at scale with title block and scale bar, plus a furniture list page. */
export function planPdf(drawing: Drawing, opts: PlanPdfOptions): PlanPdfResult {
  const margin = 12;
  const titleH = 18;
  const b = drawing.bounds;
  // World cm -> paper mm at 1:scale.
  let k = 10 / opts.scale;
  const need = { w: b.w * k, h: b.d * k };
  const fits = (p: PaperSize, portrait: boolean) => {
    const W = portrait ? p.h : p.w,
      H = portrait ? p.w : p.h;
    return need.w <= W - 2 * margin && need.h <= H - 2 * margin - titleH;
  };
  let paper: PaperSize = PAPERS[1]!;
  let portrait = need.h > need.w;
  let toScale = false;
  outer: for (const p of PAPERS) {
    for (const pr of [need.h > need.w, need.h <= need.w]) {
      if (fits(p, pr)) {
        paper = p;
        portrait = pr;
        toScale = true;
        break outer;
      }
    }
  }
  const W = portrait ? paper.h : paper.w;
  const H = portrait ? paper.w : paper.h;
  if (!toScale) k = Math.min((W - 2 * margin) / b.w, (H - 2 * margin - titleH) / b.d);

  const page = new PdfPage(W, H);
  const ox = (W - b.w * k) / 2 - b.x * k;
  const oy = margin + (H - 2 * margin - titleH - b.d * k) / 2 - b.y * k;
  const map = (p: { x: number; y: number }): [number, number] => [ox + p.x * k, oy + p.y * k];
  const drawShape = (s: Shape) => {
    if (s.kind === "poly") page.polygon(s.points.map(map), s.fill, s.stroke, (s.width ?? 0.5) * k);
    else if (s.kind === "line")
      page.line(
        s.points.map(map),
        s.stroke,
        s.width * k,
        s.dash?.map((d) => d * k),
      );
    else {
      const [x, y] = map(s);
      page.text(x, y, s.text, Math.max(1.6, s.size * k * 2.83), {
        color: s.color,
        anchor: s.anchor,
        ...(s.bold ? { bold: true } : {}),
      });
    }
  };
  drawing.shapes.forEach(drawShape);

  // Title block.
  const ty = H - margin - titleH + 4;
  page.line(
    [
      [margin, ty - 4],
      [W - margin, ty - 4],
    ],
    "#DDD6C6",
    0.3,
  );
  page.text(margin, ty + 4, opts.title, 4.2, { bold: true });
  page.text(margin, ty + 10, opts.subtitle, 3);
  const scaleText = toScale ? `${opts.labels.scale} 1:${opts.scale}` : opts.labels.notToScale;
  page.text(W - margin, ty + 4, scaleText, 3.4, { anchor: "end", bold: true });
  page.text(W - margin, ty + 10, opts.date, 3, { anchor: "end", color: "#6A6357" });
  if (toScale) {
    // Scale bar of 1 m (5 segments of 20 cm).
    const len = 100 * k;
    const sx = W / 2 - len / 2;
    for (let i = 0; i < 5; i++)
      page.rect(
        sx + (i * len) / 5,
        ty + 2,
        len / 5,
        2,
        i % 2 ? "#FFFFFF" : "#2A2620",
        "#2A2620",
        0.2,
      );
    page.text(sx, ty + 8, "0", 2.6, { anchor: "middle" });
    page.text(sx + len, ty + 8, "1 m", 2.6, { anchor: "middle" });
  }

  const pages = [page];
  if (opts.inventory && opts.inventory.length) {
    const L = opts.labels;
    let list = new PdfPage(210, 297);
    pages.push(list);
    let y = 20;
    list.text(15, y, `${L.inventory}: ${opts.title}`, 5, { bold: true });
    y += 10;
    const cols = [15, 55, 115, 130, 165, 195];
    const header = () => {
      [L.room, L.item, L.count, L.size, L.price, L.total].forEach((h, i) =>
        list.text(cols[i]!, y, h, 3, { bold: true, anchor: i >= 4 ? "end" : "start" }),
      );
      y += 2;
      list.line(
        [
          [15, y],
          [195, y],
        ],
        "#DDD6C6",
        0.3,
      );
      y += 5;
    };
    header();
    for (const row of opts.inventory) {
      if (y > 280) {
        list = new PdfPage(210, 297);
        pages.push(list);
        y = 20;
        header();
      }
      list.text(cols[0]!, y, row.room, 3);
      list.text(cols[1]!, y, row.name, 3);
      list.text(cols[2]!, y, String(row.count), 3);
      list.text(cols[3]!, y, row.size, 3);
      if (row.price) list.text(cols[4]!, y, row.price, 3, { anchor: "end" });
      if (row.total) list.text(cols[5]!, y, row.total, 3, { anchor: "end" });
      y += 5.5;
    }
    if (opts.grandTotal) {
      list.line(
        [
          [15, y - 2],
          [195, y - 2],
        ],
        "#DDD6C6",
        0.3,
      );
      list.text(cols[5]!, y + 3, opts.grandTotal, 3.4, { anchor: "end", bold: true });
    }
  }
  return { bytes: writePdf(pages, opts.title), paper, toScale };
}
