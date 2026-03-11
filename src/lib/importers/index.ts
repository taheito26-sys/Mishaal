import { adapters } from "./adapters";
import { detectExchange } from "./detector";
import { parseCSV } from "./shared";
import { ParsedImportResult } from "./types";

export async function importCSV(file: File): Promise<ParsedImportResult> {
  const text = await file.text();
  const { headers } = parseCSV(text);
  const detected = detectExchange(headers);
  if (detected.exchange === "unknown") {
    return { exchange: "unknown", confidence: detected.confidence, rows: [], headers };
  }
  const parsed = adapters[detected.exchange](text);
  return { ...parsed, confidence: detected.confidence };
}
