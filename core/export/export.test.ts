import { describe, expect, it } from "vitest";
import { getActiveVersion, updateItems } from "../model/actions";
import { createProject } from "../model/defaults";
import { cutWalls } from "../openings/openings";
import { sampleApartment } from "../samples/apartment";
import { SAMPLES } from "../samples/houses";
import { generateWalls } from "../walls/generate";
import { buildDrawing, drawingToSvg } from "./drawing";
import { inventory, inventoryCsv, inventoryTotal, roomSummary } from "./inventory";
import { pdfString, planPdf, textWidth, writePdf, PdfPage } from "./pdf";
import { buildProjectFile, fileNameFor, readProjectFile } from "./projectFile";

function drawing(px = 1, dims = false) {
  const p = sampleApartment();
  const v = getActiveVersion(p);
  const walls = generateWalls(v.rooms);
  return buildDrawing(v, walls, cutWalls(walls, v.openings), { unit: "cm", px, dimensions: dims });
}

const latin1 = (b: Uint8Array) => Array.from(b, (c) => String.fromCharCode(c)).join("");

describe("project file", () => {
  it("roundtrips with photos", () => {
    const p = sampleApartment();
    const text = buildProjectFile(p, { ph: "data:image/webp;base64,AAA", bad: "http://x" });
    const r = readProjectFile(text);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.project).toEqual(p);
      expect(r.photos).toEqual({ ph: "data:image/webp;base64,AAA" });
    }
  });

  it("accepts a bare project and migrates old ones", () => {
    const { schemaVersion: _s, ...legacy } = createProject("Oud");
    const r = readProjectFile(JSON.stringify(legacy));
    expect(r.ok).toBe(true);
  });

  it("explains broken files", () => {
    const r = readProjectFile("{nope");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0]!.message).toMatch(/Not valid JSON/);
    expect(readProjectFile('{"format":"maison-project","project":{"name":1}}').ok).toBe(false);
  });

  it("makes safe file names", () => {
    expect(fileNameFor("Dino's appartement / 2026", "json")).toBe("dinos-appartement-2026.json");
    expect(fileNameFor("???", "pdf")).toBe("project.pdf");
  });
});

describe("inventory", () => {
  const p = sampleApartment();
  const v = getActiveVersion(p);

  it("groups identical items per room", () => {
    const rows = inventory(v.items, v.rooms);
    const night = rows.find((r) => r.name === "Nachtkastje")!;
    expect(night).toMatchObject({ room: "Slaapkamer", count: 2, w: 45 });
    expect(rows[0]!.room).toBe("Woonkamer");
    expect(rows.every((r) => r.total === undefined)).toBe(true);
  });

  it("adds prices and totals", () => {
    const priced = getActiveVersion(
      updateItems(p, ["nightstand-l", "nightstand-r"], { price: 49.5 }),
    );
    const rows = inventory(priced.items, priced.rooms);
    expect(rows.find((r) => r.name === "Nachtkastje")).toMatchObject({ price: 49.5, total: 99 });
    expect(inventoryTotal(rows)).toBe(99);
    const csv = inventoryCsv(rows, "cm", {
      room: "Kamer",
      name: "Naam",
      count: "Aantal",
      size: "Maat",
      price: "Prijs",
      total: "Totaal",
    });
    expect(csv.startsWith("﻿Kamer;Naam;Aantal;Maat;Prijs;Totaal\r\n")).toBe(true);
    expect(csv).toContain("Slaapkamer;Nachtkastje;2;45 cm x 40 cm x 50 cm;49,5;99");
    expect(csv.trimEnd().endsWith(";Totaal;;;;99")).toBe(true);
  });

  it("quotes cells with separators", () => {
    const rows = inventory([{ ...v.items[0]!, name: 'Bank "groot"; 3' }], v.rooms);
    const csv = inventoryCsv(rows, "cm", {
      room: "r",
      name: "n",
      count: "c",
      size: "s",
      price: "p",
      total: "t",
    });
    expect(csv).toContain('"Bank ""groot""; 3"');
  });

  it("summarises room areas", () => {
    expect(roomSummary(v.rooms).find((r) => r.name === "Woonkamer")!.area).toBeCloseTo(21.8);
  });
});

describe("drawing and svg", () => {
  it("contains rooms, walls, items and labels", () => {
    const d = drawing();
    expect(
      d.shapes.filter((s) => s.kind === "text").map((s) => (s.kind === "text" ? s.text : "")),
    ).toContain("Woonkamer");
    expect(d.shapes.length).toBeGreaterThan(100);
    const svg = drawingToSvg(d, { width: 400, background: "#fff" });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('width="400"');
    expect(svg).toContain("21.8 m²");
  });

  it("adds overall dimensions", () => {
    const d = drawing(1, true);
    const texts = d.shapes.flatMap((s) => (s.kind === "text" ? [s.text] : []));
    expect(texts).toContain("860 cm");
  });

  it("escapes text", () => {
    const p = sampleApartment();
    const v = getActiveVersion(p);
    v.rooms[0]!.name = "A & <B>";
    const walls = generateWalls(v.rooms);
    expect(drawingToSvg(buildDrawing(v, walls, [], { unit: "cm", px: 1 }))).toContain(
      "A &amp; &lt;B&gt;",
    );
  });

  it("draws every sample", () => {
    for (const s of SAMPLES) {
      for (const f of s.create().floors) {
        const walls = generateWalls(f.current.rooms);
        expect(
          buildDrawing(f.current, walls, cutWalls(walls, f.current.openings), {
            unit: "m" as never,
            px: 1,
          }).shapes.length,
        ).toBeGreaterThan(10);
      }
    }
  });
});

describe("pdf", () => {
  it("escapes strings in WinAnsi", () => {
    expect(pdfString("a(b)\\c")).toBe("(a\\(b\\)\\\\c)");
    expect(pdfString("12 m² €5 é")).toBe("(12 m\\262 \\2005 \\351)");
    expect(pdfString("中")).toBe("(?)");
    expect(textWidth("MMM", 10)).toBeGreaterThan(textWidth("iii", 10));
  });

  it("writes a structurally valid file", () => {
    const page = new PdfPage(210, 297);
    page.rect(10, 10, 50, 20, "#E3EAE2", "#2A2620");
    page.text(10, 50, "Hallo", 4, { bold: true });
    page.line(
      [
        [0, 0],
        [100, 100],
      ],
      "#000000",
      0.3,
      [2, 1],
    );
    const text = latin1(writePdf([page], "Test"));
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    const xref = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(xref, xref + 4)).toBe("xref");
    // Every object offset in the xref table points at "n 0 obj".
    const offsets = [...text.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) =>
      Number(m[1]),
    );
    offsets.forEach((o, i) =>
      expect(text.slice(o, o + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`),
    );
  });

  it("prints the sample at 1:50 on A3 and 1:100 on A4", () => {
    const labels = {
      scale: "Schaal",
      inventory: "Meubellijst",
      room: "Kamer",
      item: "Item",
      count: "Aantal",
      size: "Maat",
      price: "Prijs",
      total: "Totaal",
      notToScale: "Niet op schaal",
    };
    const d = drawing(100 / 20, true);
    const at100 = planPdf(d, {
      title: "Appartement",
      subtitle: "Begane grond",
      scale: 100,
      date: "1-1-2026",
      labels,
    });
    expect(at100).toMatchObject({ toScale: true, paper: { name: "A4" } });
    const at50 = planPdf(d, {
      title: "Appartement",
      subtitle: "Begane grond",
      scale: 50,
      date: "1-1-2026",
      labels,
      inventory: [
        {
          room: "Woonkamer",
          name: "Bank",
          count: 1,
          size: "220 x 95",
          price: "€ 500",
          total: "€ 500",
        },
      ],
      grandTotal: "€ 500",
    });
    expect(at50.paper.name).toBe("A3");
    expect(latin1(at50.bytes)).toContain("/Count 2");
    const tiny = planPdf(d, { title: "x", subtitle: "", scale: 10, date: "", labels });
    expect(tiny.toScale).toBe(false);
    expect(latin1(tiny.bytes)).toContain("(Niet op schaal)");
  });
});
