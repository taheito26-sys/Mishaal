import { ExistingImportRow, ImportPreviewRow, NormalizedRow } from "./importers/types";
import { rowFingerprint } from "./importers/shared";

export function classifyRowsWithDelta(rows: NormalizedRow[], existingRows: ExistingImportRow[]): ImportPreviewRow[] {
  const existingByFp = new Map(existingRows.map(r => [r.fingerprint, r]));
  const existingBySymbolTs = new Map<string, ExistingImportRow[]>();
  for (const r of existingRows) {
    const k = `${r.symbol}:${r.timestampSec}`;
    const arr = existingBySymbolTs.get(k) || [];
    arr.push(r);
    existingBySymbolTs.set(k, arr);
  }

  return rows.map((row) => {
    if (row.invalidReason) return { row, status: "invalid", reason: row.invalidReason };
    const fp = row.fingerprint || rowFingerprint(row);
    const exact = existingByFp.get(fp);
    if (exact) return { row, status: "duplicate", reason: "alreadyImported", matchedTxId: exact.txId };

    const k = `${row.symbol}:${Math.floor(row.timestamp / 1000)}`;
    const sameSymbolTime = existingBySymbolTs.get(k) || [];
    if (sameSymbolTime.length > 0) {
      return {
        row,
        status: "conflict",
        reason: "Delta detected for same coin/time. Qty or price changed.",
        matchedTxId: sameSymbolTime[0].txId,
      };
    }

    return { row, status: "new" };
  });
}
