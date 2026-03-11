import { useMemo, useState } from "react";
import { classifyRowsWithDelta } from "../lib/dedup";
import { importCSV } from "../lib/importers";
import { ExistingImportRow, ImportAuditRecord, ImportPreviewRow, NormalizedRow } from "../lib/importers/types";

export function useImportState(deps: {
  lookupImportRows: (args: { rows: NormalizedRow[]; exchange: string }) => Promise<{ existingRows: ExistingImportRow[] }>;
  commitImportedTransactions: (args: { exchange: string; rows: NormalizedRow[]; onConflict: "skip" | "replace" }) => Promise<void>;
  createImportedFile: (args: any) => Promise<void>;
  fetchImportHistory?: () => Promise<ImportAuditRecord[]>;
  rollbackImport?: (importId: string) => Promise<void>;
  clearImportedTransactions?: () => Promise<{ deleted: number }>;
  refresh: () => Promise<void>;
}) {
  const [stage, setStage] = useState<"upload"|"preview"|"committing"|"done"|"error">("upload");
  const [detectedExchange, setDetectedExchange] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [fileName, setFileName] = useState<string>("");
  const [rows, setRows] = useState<NormalizedRow[]>([]);
  const [preview, setPreview] = useState<ImportPreviewRow[]>([]);
  const [history, setHistory] = useState<ImportAuditRecord[]>([]);
  const [editMap, setEditMap] = useState<Record<string, Partial<NormalizedRow>>>({});
  const [lastAction, setLastAction] = useState<string>("");

  const stats = useMemo(() => {
    const parsed = preview.length;
    const accepted = preview.filter(p => p.status === "new" || p.status === "conflict").length;
    const duplicates = preview.filter(p => p.status === "duplicate").length;
    const conflicts = preview.filter(p => p.status === "conflict").length;
    const invalid = preview.filter(p => p.status === "invalid").length;
    return { parsed, accepted, duplicates, conflicts, invalid };
  }, [preview]);

  const withEdits = (p: ImportPreviewRow): NormalizedRow => ({ ...p.row, ...(editMap[p.row.externalId || p.row.fingerprint || `${p.row.rowIndex}`] || {}) });

  const refreshHistory = async () => {
    if (!deps.fetchImportHistory) return;
    const list = await deps.fetchImportHistory();
    setHistory(list || []);
  };

  const upload = async (file: File) => {
    setStage("upload");
    setFileName(file.name);
    const parsed = await importCSV(file);
    setDetectedExchange(parsed.exchange);
    setConfidence(parsed.confidence);
    setRows(parsed.rows);
    const lookup = await deps.lookupImportRows({ rows: parsed.rows, exchange: parsed.exchange });
    setPreview(classifyRowsWithDelta(parsed.rows, lookup.existingRows || []));
    setEditMap({});
    setStage("preview");
  };

  const updatePreviewRow = (key: string, patch: Partial<NormalizedRow>) => {
    setEditMap((m) => ({ ...m, [key]: { ...(m[key] || {}), ...patch } }));
  };

  const commit = async (onConflict: "skip" | "replace") => {
    setStage("committing");
    const selected = preview
      .filter(p => p.status === "new" || p.status === "conflict")
      .map(withEdits)
      .filter(r => !r.invalidReason);

    await deps.commitImportedTransactions({ exchange: detectedExchange || "unknown", rows: selected, onConflict });
    await deps.createImportedFile({
      fileName,
      exchange: detectedExchange,
      stats,
      rowCount: rows.length,
      perSymbolBreakdown: selected.reduce((acc, r) => { acc[r.symbol] = (acc[r.symbol] || 0) + 1; return acc; }, {} as Record<string, number>),
    });
    await deps.refresh();
    await refreshHistory();
    setLastAction(`Committed ${selected.length} rows`);
    setStage("done");
  };

  const rollback = async (importId: string) => {
    if (!deps.rollbackImport) return;
    await deps.rollbackImport(importId);
    await deps.refresh();
    await refreshHistory();
    setLastAction(`Rolled back import ${importId}`);
  };

  const clearAllImported = async () => {
    if (!deps.clearImportedTransactions) return;
    const res = await deps.clearImportedTransactions();
    await deps.refresh();
    await refreshHistory();
    setLastAction(`Cleared ${res?.deleted || 0} imported rows`);
  };

  return {
    stage,
    detectedExchange,
    confidence,
    rows,
    preview,
    history,
    stats,
    editMap,
    lastAction,
    upload,
    commit,
    rollback,
    clearAllImported,
    refreshHistory,
    updatePreviewRow,
  };
}
