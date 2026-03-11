import { useMemo, useState } from "react";
import { classifyRows } from "../lib/dedup";
import { importCSV } from "../lib/importers";
import { NormalizedRow } from "../lib/importers/types";

export interface ImportAuditRecord {
  id: string;
  importedAt: number;
  fileName: string;
  exchange: string;
  stats: { parsed: number; accepted: number; rejected: number };
}

export function useImportState(deps: {
  lookupImportRows: (args: { fingerprints: string[]; rows: NormalizedRow[]; exchange: string }) => Promise<{ exists: string[]; conflicts?: string[] }>;
  commitImportedTransactions: (args: { exchange: string; rows: NormalizedRow[]; onConflict: "skip" | "replace" }) => Promise<void>;
  createImportedFile: (args: any) => Promise<void>;
  refresh: () => Promise<void>;
}) {
  const [stage, setStage] = useState<"upload"|"preview"|"committing"|"done"|"error">("upload");
  const [detectedExchange, setDetectedExchange] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [fileName, setFileName] = useState<string>("");
  const [rows, setRows] = useState<NormalizedRow[]>([]);
  const [preview, setPreview] = useState<any[]>([]);
  const [history, setHistory] = useState<ImportAuditRecord[]>([]);

  const stats = useMemo(() => {
    const parsed = preview.length;
    const accepted = preview.filter(p => p.status === "new" || p.status === "conflict").length;
    const rejected = preview.filter(p => p.status === "invalid").length;
    return { parsed, accepted, rejected };
  }, [preview]);

  const upload = async (file: File) => {
    setStage("upload");
    setFileName(file.name);
    const parsed = await importCSV(file);
    setDetectedExchange(parsed.exchange);
    setConfidence(parsed.confidence);
    setRows(parsed.rows);
    const lookup = await deps.lookupImportRows({
      fingerprints: parsed.rows.map(r => r.fingerprint || ""),
      rows: parsed.rows,
      exchange: parsed.exchange,
    });
    const exists = Object.fromEntries(lookup.exists.map(fp => [fp, true]));
    setPreview(classifyRows(parsed.rows, exists, new Set(lookup.conflicts || [])));
    setStage("preview");
  };

  const commit = async (onConflict: "skip" | "replace") => {
    setStage("committing");
    const committable = preview.filter(p => p.status === "new" || p.status === "conflict").map(p => p.row as NormalizedRow);
    await deps.commitImportedTransactions({ exchange: detectedExchange || "unknown", rows: committable, onConflict });
    await deps.createImportedFile({ fileName, exchange: detectedExchange, stats, rowCount: rows.length });
    await deps.refresh();
    const rec: ImportAuditRecord = { id: `${Date.now()}`, importedAt: Date.now(), fileName, exchange: detectedExchange || "unknown", stats };
    setHistory(h => [rec, ...h]);
    setStage("done");
  };

  return { stage, detectedExchange, confidence, rows, preview, history, stats, upload, commit };
}
