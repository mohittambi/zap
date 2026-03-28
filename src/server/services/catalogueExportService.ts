// @ts-nocheck
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as XLSX from "xlsx";
import * as cataloguesService from "@/server/services/cataloguesService";
import catalogueThemes from "@/data/catalogue-themes.json";

/** Raw theme rows (legacy API shape + nested `theme_pages`). */
export const CATALOGUE_THEMES = catalogueThemes;

/** Normalized options for GET `/api/catalogue-templates` and catalogue builder. */
export const CATALOGUE_TEMPLATES = catalogueThemes.map((t) => ({
  id: String(t.id),
  name: t.theme_name,
  description: t.theme_description,
  keywords: t.theme_keywords,
  theme_pages: t.theme_pages,
}));

export const DEFAULT_CATALOGUE_TEMPLATE_ID = String(
  catalogueThemes[0]?.id ?? "6021"
);

/**
 * Standard 14 PDF fonts only support WinAnsi; Unicode (e.g. ₹ U+20B9) throws.
 * @see https://github.com/Hopding/pdf-lib/issues/62
 */
function sanitizePdfText(text) {
  return String(text ?? "")
    .replace(/\u20b9/g, "Rs.") // rupee sign
    .replace(/\u00a3/g, "GBP") // pound
    .replace(/\u20ac/g, "EUR") // euro
    .replace(/\u2014|\u2013/g, "-") // em/en dash
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\x00-\xff]/g, "?"); // remaining non-Latin-1 → placeholder
}

export async function buildCataloguePdf(catalogueId, templateId) {
  const items = await cataloguesService.listCatalogueItems(catalogueId);
  const cat = await cataloguesService.getCatalogue(catalogueId);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([595, 842]);
  const { width, height } = page.getSize();
  const margin = 48;
  let y = height - margin;
  page.drawText(sanitizePdfText("eCraft Zap — Catalogue"), {
    x: margin,
    y,
    size: 18,
    font: fontBold,
    color: rgb(0.25, 0.2, 0.55),
  });
  y -= 28;
  page.drawText(sanitizePdfText(cat?.name ?? `Catalogue #${catalogueId}`), {
    x: margin,
    y,
    size: 14,
    font,
  });
  y -= 22;
  if (cat?.description) {
    page.drawText(sanitizePdfText(String(cat.description).slice(0, 200)), {
      x: margin,
      y,
      size: 10,
      font,
      maxWidth: width - 2 * margin,
    });
    y -= 36;
  }
  page.drawText(sanitizePdfText(`Template: ${templateId}`), {
    x: margin,
    y,
    size: 9,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 28;

  for (const row of items) {
    const line = sanitizePdfText(
      `${row.sku_id} | Avail: ${row.available_quantity ?? 0} | MOQ: ${row.moq ?? "-"} | Rs.${row.display_price ?? 0}`
    );
    if (y < margin + 40) {
      page = pdf.addPage([595, 842]);
      y = height - margin;
    }
    page.drawText(line.slice(0, 120), { x: margin, y, size: 9, font });
    y -= 14;
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

export async function buildCatalogueXlsx(catalogueId) {
  const items = await cataloguesService.listCatalogueItems(catalogueId);
  const rows = items.map((r) => ({
    sku_id: r.sku_id,
    description: r.description,
    available_quantity: r.available_quantity,
    moq: r.moq,
    price_inr: r.display_price,
    image_url: r.img_hd,
  }));
  const sheet = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Items");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
