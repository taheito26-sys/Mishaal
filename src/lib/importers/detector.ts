import { Exchange } from "./types";

const signatures: Record<Exclude<Exchange, "unknown">, string[][]> = {
  binance: [["Date(UTC)", "Pair", "Side"], ["Date(UTC)", "Market", "Type"]],
  bybit: [["Symbol", "TradeTime", "Side"], ["Symbol", "Trading Time", "Side"]],
  okx: [["Instrument ID", "Fill time", "Side"]],
  gate: [["pair", "Time", "Side"]],
  mexc: [["Date", "Pair", "Side"]],
  kucoin: [["tradeCreatedAt", "symbol", "side"]],
};

export function detectExchange(headers: string[]): { exchange: Exchange; confidence: number } {
  const lower = headers.map(h => h.toLowerCase());
  let best: { exchange: Exchange; confidence: number } = { exchange: "unknown", confidence: 0 };
  for (const [ex, groups] of Object.entries(signatures) as [Exclude<Exchange,"unknown">, string[][]][]) {
    for (const sig of groups) {
      const hit = sig.filter(k => lower.includes(k.toLowerCase())).length;
      const confidence = hit / sig.length;
      if (confidence > best.confidence) best = { exchange: ex, confidence };
    }
  }
  if (best.confidence < 0.5) return { exchange: "unknown", confidence: best.confidence };
  return best;
}
