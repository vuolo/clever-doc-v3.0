import type { Company, OCR } from "@/types/tools/bsca";

export function isBank({ textStructuredData }: OCR): boolean {
  for (const element of textStructuredData.elements)
    if (element.Page > 0) break;
    else if (element.Text?.includes("Chase.com")) return true;
  return false;
}
