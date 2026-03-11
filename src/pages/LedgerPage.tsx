import React, { useCallback, useMemo, useState } from "react";
import { ExchangeConnect } from "../components/ExchangeConnect";
import { CoinAutocomplete } from "../components/CoinAutocomplete";
import { useCryptoContext } from "../context/CryptoContext";
import { useLedgerMutations } from "../hooks/useLedgerMutations";
import { importCSV } from "../utils/importCSV";

type LedgerTab = "journal" | "add" | "import" | "connect";
type WriteStatus = "unconfigured" | "unavailable" | "checking" | "ready";

type ImportPreviewStatus = "new" | "alreadyImported" | "warning" | "invalid";

type DraftTx = {
  type: string;
  asset: string;
  qty: string;
  price: string;
  fee: string;
  venue: string;
  note: string;
};

type ParsedImportRow = {
  rowId: string;
  timestamp: number;
  type: string;
  asset: string;
  qty: number;
  price: number;
  fee?: number;
  venue?: string;
  note?: string;
  fingerprint?: string;
  warning?: string;
  invalidReason?: string;
};

type ImportPreviewRow = {
  row: ParsedImportRow;
  status: ImportPreviewStatus;
  reason?: string;
};

const defaultDraft: DraftTx = {
  type: "buy",
  asset: "",
  qty: "",
  price: "",
  fee: "",
  venue: "",
  note: "",
};

function parsePositiveNumber(v: string): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parseNonNegativeNumber(v: string): number | null {
  if (v.trim() === "") return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function statusClass(status: ImportPreviewStatus): string {
  if (status === "new") return "badge badge--good";
  if (status === "alreadyImported") return "badge badge--muted";
  if (status === "warning") return "badge badge--warn";
  return "badge badge--bad";
}

const WriteStatusBanner: React.FC<{
  status: WriteStatus;
  onRetry: () => Promise<void>;
}> = ({ status, onRetry }) => {
  if (status === "ready") return null;

  const copy = {
    unconfigured: "Backend writes are not configured. Configure backend credentials to enable writes.",
    unavailable: "Write backend is currently unavailable.",
    checking: "Checking backend write readiness…",
  } as const;

  return (
    <div className="ledger-status-banner">
      <strong>Write Status: {status}</strong>
      <div>{copy[status as keyof typeof copy]}</div>
      {status !== "checking" ? (
        <button type="button" onClick={onRetry}>
          Retry readiness check
        </button>
      ) : null}
    </div>
  );
};

const LedgerPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<LedgerTab>("journal");
  const [draft, setDraft] = useState<DraftTx>(defaultDraft);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [assetFilter, setAssetFilter] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<DraftTx>>({});
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importExchange, setImportExchange] = useState<string>("unknown");
  const [importRows, setImportRows] = useState<ParsedImportRow[]>([]);
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [importError, setImportError] = useState<string | null>(null);

  const {
    transactions,
    hydrateFromBackend,
    resolveAssetSymbol,
    isHydrating,
  } = useCryptoContext();

  const {
    writeStatus,
    ensureWriteReady,
    retryWriteReadiness,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    lookupImportRows,
    commitImportedTransactions,
    recordImportedFile,
    isMutating,
  } = useLedgerMutations();

  const refreshCanonical = useCallback(async () => {
    await hydrateFromBackend();
  }, [hydrateFromBackend]);

  const txs = transactions ?? [];

  const stats = useMemo(() => {
    const buys = txs.filter((t) => t.type === "buy");
    const sells = txs.filter((t) => t.type === "sell");
    const uniqueAssets = new Set(txs.map((t) => String(t.asset || "").toUpperCase()).filter(Boolean));
    const totalBuyValue = buys.reduce((sum, t) => sum + (Number(t.qty) || 0) * (Number(t.price) || 0), 0);
    const totalSellValue = sells.reduce((sum, t) => sum + (Number(t.qty) || 0) * (Number(t.price) || 0), 0);
    return {
      totalTxs: txs.length,
      uniqueAssets: uniqueAssets.size,
      buys: buys.length,
      sells: sells.length,
      totalBuyValue,
      totalSellValue,
    };
  }, [txs]);

  const filteredJournal = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...txs]
      .sort((a, b) => (Number(b.timestamp || b.ts) || 0) - (Number(a.timestamp || a.ts) || 0))
      .filter((t) => {
        if (typeFilter !== "all" && t.type !== typeFilter) return false;
        if (assetFilter !== "all" && String(t.asset || "").toUpperCase() !== assetFilter) return false;
        if (!query) return true;
        const hay = [
          t.type,
          t.asset,
          t.venue,
          t.note,
          new Date(Number(t.timestamp || t.ts) || 0).toISOString(),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(query);
      });
  }, [assetFilter, search, txs, typeFilter]);

  const assetOptions = useMemo(
    () => [...new Set(txs.map((t) => String(t.asset || "").toUpperCase()).filter(Boolean))].sort(),
    [txs],
  );

  const handleAdd = useCallback(async () => {
    const assetResolved = resolveAssetSymbol(draft.asset);
    const qty = parsePositiveNumber(draft.qty);
    const price = parsePositiveNumber(draft.price);
    const fee = parseNonNegativeNumber(draft.fee);

    if (!assetResolved || !qty || !price || fee === null) {
      setImportError("Manual form invalid: asset, qty, and price must be valid; fee must be non-negative.");
      return;
    }

    setImportError(null);
    await ensureWriteReady();
    await createTransaction({
      type: draft.type,
      asset: assetResolved,
      qty,
      price,
      fee,
      venue: draft.venue.trim() || undefined,
      note: draft.note.trim() || undefined,
    });
    await refreshCanonical();
    setDraft(defaultDraft);
    setActiveTab("journal");
  }, [createTransaction, draft, ensureWriteReady, refreshCanonical, resolveAssetSymbol]);

  const startEdit = useCallback((tx: any) => {
    setEditingId(tx.id);
    setEditDraft({
      type: tx.type,
      asset: tx.asset,
      qty: String(tx.qty ?? ""),
      price: String(tx.price ?? ""),
      fee: String(tx.fee ?? ""),
      venue: tx.venue ?? "",
      note: tx.note ?? "",
    });
  }, []);

  const commitEdit = useCallback(
    async (txId: string) => {
      const resolved = resolveAssetSymbol(editDraft.asset || "");
      const qty = parsePositiveNumber(String(editDraft.qty ?? ""));
      const price = parsePositiveNumber(String(editDraft.price ?? ""));
      const fee = parseNonNegativeNumber(String(editDraft.fee ?? ""));
      if (!resolved || !qty || !price || fee === null || !editDraft.type) {
        setImportError("Inline edit invalid. Please verify type/asset/qty/price/fee.");
        return;
      }

      setImportError(null);
      await ensureWriteReady();
      await updateTransaction(txId, {
        type: editDraft.type,
        asset: resolved,
        qty,
        price,
        fee,
        venue: String(editDraft.venue ?? "").trim() || undefined,
        note: String(editDraft.note ?? "").trim() || undefined,
      });
      await refreshCanonical();
      setEditingId(null);
      setEditDraft({});
    },
    [editDraft, ensureWriteReady, refreshCanonical, resolveAssetSymbol, updateTransaction],
  );

  const handleDelete = useCallback(
    async (txId: string) => {
      await ensureWriteReady();
      await deleteTransaction(txId);
      await refreshCanonical();
    },
    [deleteTransaction, ensureWriteReady, refreshCanonical],
  );

  const runImportPipeline = useCallback(
    async (file: File) => {
      setImportError(null);
      setImportFile(file);

      const parsed = await importCSV(file);
      const rows = (parsed?.rows ?? []) as ParsedImportRow[];
      const exchange = parsed?.exchange ?? "unknown";
      setImportExchange(exchange);
      setImportRows(rows);

      const lookup = await lookupImportRows({
        exchange,
        rows,
      });

      const nextPreview: ImportPreviewRow[] = rows.map((row) => {
        if (row.invalidReason) {
          return { row, status: "invalid", reason: row.invalidReason };
        }

        const dedup = lookup.byFingerprint?.[row.fingerprint || ""];
        if (dedup?.alreadyImported) {
          return { row, status: "alreadyImported", reason: "Duplicate fingerprint found in backend." };
        }

        if (row.warning) {
          return { row, status: "warning", reason: row.warning };
        }

        return { row, status: "new" };
      });

      setPreviewRows(nextPreview);
    },
    [lookupImportRows],
  );

  const commitImport = useCallback(async () => {
    const committable = previewRows.filter((r) => r.status === "new" || r.status === "warning").map((r) => r.row);
    if (committable.length === 0) {
      setImportError("No committable rows. Only rows marked new/warning can be committed.");
      return;
    }

    await ensureWriteReady();
    await commitImportedTransactions({
      exchange: importExchange,
      rows: committable,
    });

    if (importFile) {
      await recordImportedFile({
        fileName: importFile.name,
        exchange: importExchange,
        rowsTotal: importRows.length,
        rowsCommitted: committable.length,
      });
    }

    await refreshCanonical();
  }, [
    commitImportedTransactions,
    ensureWriteReady,
    importExchange,
    importFile,
    importRows.length,
    previewRows,
    recordImportedFile,
    refreshCanonical,
  ]);

  return (
    <section className="ledger-page">
      <h1>Ledger</h1>
      <WriteStatusBanner status={writeStatus as WriteStatus} onRetry={retryWriteReadiness} />

      <div className="ledger-stats">
        <div>Total txs: {stats.totalTxs}</div>
        <div>Unique assets: {stats.uniqueAssets}</div>
        <div>Buys: {stats.buys}</div>
        <div>Sells: {stats.sells}</div>
        <div>Total Buy Value: {stats.totalBuyValue.toFixed(2)}</div>
        <div>Total Sell Value: {stats.totalSellValue.toFixed(2)}</div>
      </div>

      <div className="ledger-tabs">
        {(["journal", "add", "import", "connect"] as LedgerTab[]).map((tab) => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)} disabled={isMutating || isHydrating}>
            {tab}
          </button>
        ))}
      </div>

      {importError ? <div className="ledger-error">{importError}</div> : null}

      {activeTab === "journal" ? (
        <div>
          <div className="journal-filters">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search txs" />
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              {[
                "all",
                "buy",
                "sell",
                "transfer_in",
                "transfer_out",
                "reward",
                "adjustment",
              ].map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <select value={assetFilter} onChange={(e) => setAssetFilter(e.target.value)}>
              <option value="all">all</option>
              {assetOptions.map((asset) => (
                <option key={asset} value={asset}>
                  {asset}
                </option>
              ))}
            </select>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Asset</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Fee</th>
                <th>Venue</th>
                <th>Note</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredJournal.map((tx: any) => {
                const isEditing = editingId === tx.id;
                return (
                  <tr key={tx.id}>
                    <td>{new Date(Number(tx.timestamp || tx.ts) || 0).toLocaleString()}</td>
                    <td>
                      {isEditing ? (
                        <select
                          value={editDraft.type ?? "buy"}
                          onChange={(e) => setEditDraft((d) => ({ ...d, type: e.target.value }))}
                        >
                          {["buy", "sell", "transfer_in", "transfer_out", "reward", "adjustment"].map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      ) : (
                        tx.type
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <CoinAutocomplete
                          value={String(editDraft.asset ?? "")}
                          onChange={(v: string) => setEditDraft((d) => ({ ...d, asset: v }))}
                        />
                      ) : (
                        tx.asset
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          value={String(editDraft.qty ?? "")}
                          onChange={(e) => setEditDraft((d) => ({ ...d, qty: e.target.value }))}
                        />
                      ) : (
                        tx.qty
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          value={String(editDraft.price ?? "")}
                          onChange={(e) => setEditDraft((d) => ({ ...d, price: e.target.value }))}
                        />
                      ) : (
                        tx.price
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          value={String(editDraft.fee ?? "")}
                          onChange={(e) => setEditDraft((d) => ({ ...d, fee: e.target.value }))}
                        />
                      ) : (
                        tx.fee ?? 0
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          value={String(editDraft.venue ?? "")}
                          onChange={(e) => setEditDraft((d) => ({ ...d, venue: e.target.value }))}
                        />
                      ) : (
                        tx.venue ?? ""
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          value={String(editDraft.note ?? "")}
                          onChange={(e) => setEditDraft((d) => ({ ...d, note: e.target.value }))}
                        />
                      ) : (
                        tx.note ?? ""
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <>
                          <button type="button" onClick={() => void commitEdit(tx.id)} disabled={isMutating}>
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setEditDraft({});
                            }}
                            disabled={isMutating}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => startEdit(tx)} disabled={isMutating}>
                            Edit
                          </button>
                          <button type="button" onClick={() => void handleDelete(tx.id)} disabled={isMutating}>
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {activeTab === "add" ? (
        <div className="ledger-add-form">
          <label>
            Type
            <select value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}>
              {["buy", "sell", "transfer_in", "transfer_out", "reward", "adjustment"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Asset
            <CoinAutocomplete
              value={draft.asset}
              onChange={(asset: string) => setDraft((d) => ({ ...d, asset }))}
            />
          </label>
          <label>
            Qty
            <input value={draft.qty} onChange={(e) => setDraft((d) => ({ ...d, qty: e.target.value }))} />
          </label>
          <label>
            Price
            <input value={draft.price} onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))} />
          </label>
          <label>
            Fee
            <input value={draft.fee} onChange={(e) => setDraft((d) => ({ ...d, fee: e.target.value }))} />
          </label>
          <label>
            Venue
            <input value={draft.venue} onChange={(e) => setDraft((d) => ({ ...d, venue: e.target.value }))} />
          </label>
          <label>
            Note
            <input value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} />
          </label>
          <button type="button" onClick={() => void handleAdd()} disabled={isMutating || writeStatus !== "ready"}>
            Add transaction
          </button>
        </div>
      ) : null}

      {activeTab === "import" ? (
        <div className="ledger-import">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void runImportPipeline(file);
            }}
          />

          <div>Detected exchange: {importExchange}</div>

          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Timestamp</th>
                <th>Type</th>
                <th>Asset</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((p) => (
                <tr key={p.row.rowId}>
                  <td>
                    <span className={statusClass(p.status)}>{p.status}</span>
                  </td>
                  <td>{new Date(p.row.timestamp).toLocaleString()}</td>
                  <td>{p.row.type}</td>
                  <td>{p.row.asset}</td>
                  <td>{p.row.qty}</td>
                  <td>{p.row.price}</td>
                  <td>{p.reason ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            type="button"
            onClick={() => void commitImport()}
            disabled={isMutating || writeStatus !== "ready" || previewRows.length === 0}
          >
            Commit import
          </button>
        </div>
      ) : null}

      {activeTab === "connect" ? (
        <div>
          <ExchangeConnect onConnected={() => void refreshCanonical()} />
        </div>
      ) : null}
    </section>
  );
};

export default LedgerPage;
