import { NormalizedRow } from "./importers/types";
import { externalId, rowFingerprint } from "./importers/shared";

export type PreviewStatus = "new" | "duplicate" | "conflict" | "invalid";

export function classifyRows(rows: NormalizedRow[], existsByFp: Record<string, boolean>, conflictIds: Set<string>) {
  return rows.map((r) => {
    if (r.invalidReason) return { row: r, status: "invalid" as PreviewStatus, reason: r.invalidReason };
    const fp = r.fingerprint || rowFingerprint(r);
    const xid = externalId(r);
    if (existsByFp[fp]) return { row: r, status: "duplicate" as PreviewStatus, reason: "alreadyImported" };
    if (conflictIds.has(xid)) return { row: r, status: "conflict" as PreviewStatus, reason: "qty/price changed" };
    return { row: r, status: "new" as PreviewStatus };
  });
}
