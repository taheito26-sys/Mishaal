import React, { useMemo, useState } from "react";
import { CoinAutocomplete } from "../components/CoinAutocomplete";
import { ExchangeConnect } from "../components/ExchangeConnect";
import { CSVImportPanel } from "../components/CSVImport";
import { useCryptoContext } from "../context/CryptoContext";
import { useLedgerMutations } from "../hooks/useLedgerMutations";
import { useImportState } from "../hooks/useImportState";

type Tab = "journal" | "add" | "import" | "connect";

type Draft = { type: string; asset: string; qty: string; price: string; fee: string; venue: string; note: string };
const defaultDraft: Draft = { type: "buy", asset: "", qty: "", price: "", fee: "", venue: "", note: "" };

const WriteStatusBanner: React.FC<{ status: string; onRetry: () => Promise<void> }> = ({ status, onRetry }) => {
  if (status === "ready") return null;
  return (
    <div>
      <b>Write status: {status}</b>
      <button type="button" onClick={() => void onRetry()} disabled={status === "checking"}>Retry</button>
    </div>
  );
};

const LedgerPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>("journal");
  const [draft, setDraft] = useState<Draft>(defaultDraft);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [assetFilter, setAssetFilter] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Partial<Draft>>({});

  const { transactions = [], hydrateFromBackend, resolveAssetSymbol } = useCryptoContext();
  const m = useLedgerMutations();

  const importState = useImportState({
    lookupImportRows: async ({ fingerprints, rows, exchange }) => {
      if (m.lookupImportRows) return m.lookupImportRows({ fingerprints, rows, exchange });
      return { exists: [], conflicts: [] };
    },
    commitImportedTransactions: async ({ exchange, rows, onConflict }) => {
      await m.commitImportedTransactions({ exchange, rows, onConflict });
    },
    createImportedFile: async (payload) => {
      if (m.createImportedFile) await m.createImportedFile(payload);
      else if (m.recordImportedFile) await m.recordImportedFile(payload);
    },
    refresh: hydrateFromBackend,
  });

  const stats = useMemo(() => {
    const buys = transactions.filter((t: any) => t.type === "buy");
    const sells = transactions.filter((t: any) => t.type === "sell");
    return {
      total: transactions.length,
      uniqueAssets: new Set(transactions.map((t: any) => String(t.asset || "").toUpperCase())).size,
      buys: buys.length,
      sells: sells.length,
      buyValue: buys.reduce((s: number, t: any) => s + (Number(t.qty) || 0) * (Number(t.price) || 0), 0),
      sellValue: sells.reduce((s: number, t: any) => s + (Number(t.qty) || 0) * (Number(t.price) || 0), 0),
    };
  }, [transactions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...transactions]
      .sort((a: any, b: any) => Number(b.timestamp || b.ts) - Number(a.timestamp || a.ts))
      .filter((t: any) => {
        if (typeFilter !== "all" && t.type !== typeFilter) return false;
        if (assetFilter !== "all" && String(t.asset || "").toUpperCase() !== assetFilter) return false;
        if (!q) return true;
        return [t.type, t.asset, t.note, t.venue].join(" ").toLowerCase().includes(q);
      });
  }, [transactions, search, typeFilter, assetFilter]);

  const assets = useMemo(() => [...new Set(transactions.map((t: any) => String(t.asset || "").toUpperCase()).filter(Boolean))].sort(), [transactions]);

  const assertReady = async () => {
    await m.ensureWriteReady();
  };

  const addManual = async () => {
    const asset = resolveAssetSymbol(draft.asset);
    const qty = Number(draft.qty);
    const price = Number(draft.price);
    const fee = draft.fee.trim() ? Number(draft.fee) : 0;
    if (!asset || !(qty > 0) || !(price >= 0) || fee < 0) return;
    await assertReady();
    await m.createTransaction({ type: draft.type, asset, qty, price, fee, venue: draft.venue || undefined, note: draft.note || undefined });
    await hydrateFromBackend();
    setDraft(defaultDraft);
    setTab("journal");
  };

  const saveInline = async (id: string) => {
    const asset = resolveAssetSymbol(edit.asset || "");
    const qty = Number(edit.qty);
    const price = Number(edit.price);
    const fee = String(edit.fee || "").trim() ? Number(edit.fee) : 0;
    if (!asset || !(qty > 0) || !(price >= 0) || fee < 0 || !edit.type) return;
    await assertReady();
    await m.updateTransaction(id, { type: edit.type, asset, qty, price, fee, venue: edit.venue || undefined, note: edit.note || undefined });
    await hydrateFromBackend();
    setEditingId(null);
    setEdit({});
  };

  const removeInline = async (id: string) => {
    await assertReady();
    await m.deleteTransaction(id);
    await hydrateFromBackend();
  };

  return (
    <section>
      <h1>Ledger</h1>
      <WriteStatusBanner status={m.writeStatus} onRetry={m.retryWriteReadiness} />

      <div>
        <span>Total txs: {stats.total}</span> · <span>Unique assets: {stats.uniqueAssets}</span> · <span>Buys: {stats.buys}</span> · <span>Sells: {stats.sells}</span> · <span>Total Buy Value: {stats.buyValue.toFixed(2)}</span> · <span>Total Sell Value: {stats.sellValue.toFixed(2)}</span>
      </div>

      <div>
        {(["journal", "add", "import", "connect"] as Tab[]).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === "journal" && (
        <div>
          <div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" />
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              {["all", "buy", "sell", "transfer_in", "transfer_out", "reward", "adjustment"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={assetFilter} onChange={(e) => setAssetFilter(e.target.value)}>
              <option value="all">all</option>
              {assets.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <table>
            <thead><tr><th>Date</th><th>Type</th><th>Asset</th><th>Qty</th><th>Price</th><th>Fee</th><th>Venue</th><th>Note</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map((tx: any) => {
                const e = editingId === tx.id;
                return (
                  <tr key={tx.id}>
                    <td>{new Date(Number(tx.timestamp || tx.ts)).toLocaleString()}</td>
                    <td>{e ? <input value={String(edit.type ?? tx.type)} onChange={(v) => setEdit((d) => ({ ...d, type: v.target.value }))} /> : tx.type}</td>
                    <td>{e ? <CoinAutocomplete value={String(edit.asset ?? tx.asset)} onChange={(v: string) => setEdit((d) => ({ ...d, asset: v }))} /> : tx.asset}</td>
                    <td>{e ? <input value={String(edit.qty ?? tx.qty)} onChange={(v) => setEdit((d) => ({ ...d, qty: v.target.value }))} /> : tx.qty}</td>
                    <td>{e ? <input value={String(edit.price ?? tx.price)} onChange={(v) => setEdit((d) => ({ ...d, price: v.target.value }))} /> : tx.price}</td>
                    <td>{e ? <input value={String(edit.fee ?? tx.fee ?? "")} onChange={(v) => setEdit((d) => ({ ...d, fee: v.target.value }))} /> : tx.fee}</td>
                    <td>{e ? <input value={String(edit.venue ?? tx.venue ?? "")} onChange={(v) => setEdit((d) => ({ ...d, venue: v.target.value }))} /> : tx.venue}</td>
                    <td>{e ? <input value={String(edit.note ?? tx.note ?? "")} onChange={(v) => setEdit((d) => ({ ...d, note: v.target.value }))} /> : tx.note}</td>
                    <td>
                      {e ? (<><button onClick={() => void saveInline(tx.id)}>Save</button><button onClick={() => { setEditingId(null); setEdit({}); }}>Cancel</button></>) : (<><button onClick={() => { setEditingId(tx.id); setEdit(tx); }}>Edit</button><button onClick={() => void removeInline(tx.id)}>Delete</button></>)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === "add" && (
        <div>
          <select value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}>{["buy", "sell", "transfer_in", "transfer_out", "reward", "adjustment"].map((t) => <option key={t}>{t}</option>)}</select>
          <CoinAutocomplete value={draft.asset} onChange={(v: string) => setDraft((d) => ({ ...d, asset: v }))} />
          <input placeholder="qty" value={draft.qty} onChange={(e) => setDraft((d) => ({ ...d, qty: e.target.value }))} />
          <input placeholder="price" value={draft.price} onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))} />
          <input placeholder="fee" value={draft.fee} onChange={(e) => setDraft((d) => ({ ...d, fee: e.target.value }))} />
          <input placeholder="venue" value={draft.venue} onChange={(e) => setDraft((d) => ({ ...d, venue: e.target.value }))} />
          <input placeholder="note" value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} />
          <button type="button" onClick={() => void addManual()}>Add Transaction</button>
        </div>
      )}

      {tab === "import" && (
        <CSVImportPanel
          state={importState}
          onUpload={(f) => void importState.upload(f)}
          onCommit={(mode) => void (assertReady().then(() => importState.commit(mode)))}
        />
      )}

      {tab === "connect" && <ExchangeConnect onConnected={() => void hydrateFromBackend()} />}
    </section>
  );
};

export default LedgerPage;
