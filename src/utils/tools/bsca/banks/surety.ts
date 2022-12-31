import type { OCR } from "@/types/tools/bsca";

export function isBank({ textStructuredData }: OCR): boolean {
  for (const element of textStructuredData.elements)
    if (element.Page > 0) break;
    else if (element.Text?.includes("Surety Bank")) return true;
  return false;
}
