// ExcelJS hands back numbers, strings, dates, or objects (rich text,
// formulas, hyperlinks) depending on how the cell was typed - this flattens
// any of them to the text a person sees in the cell.
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const cell = value as { text?: unknown; result?: unknown; richText?: { text: string }[] };
    if (Array.isArray(cell.richText)) return cell.richText.map((part) => part.text).join("").trim();
    if (cell.result !== undefined) return cellText(cell.result);
    if (cell.text !== undefined) return cellText(cell.text);
    return "";
  }
  return String(value).trim();
}
