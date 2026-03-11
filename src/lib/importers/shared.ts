import { NormalizedRow, NormalizedSide } from "./types";

export const SYMBOL_ALIASES: Record<string, string> = {
  XBT: "BTC", BCHABC: "BCH", BCHSV: "BSV", MIOTA: "IOTA", YOYO: "YOYOW", BKRW: "KRW",
  LUNA2: "LUNA", CGLD: "CELO", REPV2: "REP", RNDR: "RENDER", "1000PEPE": "PEPE", "1000SHIB": "SHIB",
};

export const QUOTE_CURRENCIES = ["USDT","USDC","BUSD","TUSD","FDUSD","DAI","UST","BTC","ETH","BNB","EUR","GBP","TRY","BRL","ARS"];

export function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const parseLine = (line: string) => {
    const out: string[] = []; let cur = ""; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (c === "," && !q) { out.push(cur.trim()); cur = ""; }
      else cur += c;
    }
    out.push(cur.trim());
    return out.map(v => v.replace(/^"|"$/g, ""));
  };
  const headers = parseLine(lines[0] || "");
  return { headers, rows: lines.slice(1).map(parseLine) };
}

export function toTs(input: string): number {
  const n = Number(input);
  if (Number.isFinite(n) && n > 1e12) return n;
  if (Number.isFinite(n) && n > 1e9) return n * 1000;
  return new Date(input).getTime();
}

export function normalizeSymbol(pair: string): string {
  const clean = String(pair || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const noLead = clean.replace(/^\d+/, "");
  for (const q of QUOTE_CURRENCIES) {
    if (noLead.endsWith(q) && noLead.length > q.length) {
      return SYMBOL_ALIASES[noLead.slice(0, -q.length)] || noLead.slice(0, -q.length);
    }
  }
  return SYMBOL_ALIASES[noLead] || noLead;
}

export function guessTxType(raw: string): "trade" | "deposit" | "withdrawal" | "reward" | "fee" {
  const s = String(raw || "").toLowerCase();
  if (/deposit|transfer\s*in/.test(s)) return "deposit";
  if (/withdraw|transfer\s*out/.test(s)) return "withdrawal";
  if (/reward|staking|airdrop/.test(s)) return "reward";
  if (/fee/.test(s) && !/trade/.test(s)) return "fee";
  return "trade";
}

export function sideFromTxTypeOrRaw(txType: "trade" | "deposit" | "withdrawal" | "reward" | "fee", rawSide: string): NormalizedSide {
  const s = String(rawSide || "").toLowerCase();
  if (txType === "deposit") return "transfer_in";
  if (txType === "withdrawal") return "transfer_out";
  if (txType === "reward") return "reward";
  if (s === "buy") return "buy";
  if (s === "sell") return "sell";
  return "buy";
}

export function stableHash(value: string): string {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function rowFingerprint(r: Pick<NormalizedRow, "exchange"|"timestamp"|"symbol"|"side"|"qty"|"unitPrice">): string {
  const payload = `${r.exchange}:${Math.floor(r.timestamp / 1000)}:${r.symbol}:${r.side}:${Math.abs(r.qty).toFixed(8)}:${Math.abs(r.unitPrice).toFixed(8)}`;
  return stableHash(payload);
}

export function externalId(r: Pick<NormalizedRow, "exchange"|"timestamp"|"symbol"|"side"|"qty"|"unitPrice">): string {
  return `${r.exchange}:${Math.floor(r.timestamp / 1000)}:${r.symbol}:${r.side}:${Math.abs(r.qty).toFixed(8)}:${Math.abs(r.unitPrice).toFixed(8)}`;
}

export function basicValidate(r: NormalizedRow): string | null {
  if (!Number.isFinite(r.timestamp) || r.timestamp < new Date("2009-01-01").getTime() || r.timestamp > Date.now() + 86400000) return "Invalid timestamp";
  if (!(r.qty > 0)) return "Quantity must be > 0";
  if (!(r.unitPrice >= 0)) return "Price must be >= 0";
  if (!r.symbol) return "Missing symbol";
  if (!["buy", "sell", "transfer_in", "transfer_out", "reward"].includes(r.side)) return "Invalid side";
  return null;
}
