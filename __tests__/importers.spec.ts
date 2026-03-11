import { adapters } from "../src/lib/importers/adapters";

const binance = `Date(UTC),Pair,Side,Price,Executed,Amount,Fee,Fee Coin\n2024-01-01 00:00:00,BTCUSDT,BUY,42000,0.1,4200,1,USDT`;
const bybit = `Symbol,TradeTime,Side,TradePrice,ExecQty,ExecFee,FeeAsset\nETHUSDT,2024-01-01T00:00:00Z,Sell,2500,1.5,0.5,USDT`;

describe("exchange adapters", () => {
  it("parses binance", () => {
    const out = adapters.binance(binance);
    expect(out.rows[0].symbol).toBe("BTC");
    expect(out.rows[0].side).toBe("buy");
  });

  it("parses bybit", () => {
    const out = adapters.bybit(bybit);
    expect(out.rows[0].symbol).toBe("ETH");
    expect(out.rows[0].side).toBe("sell");
  });
});
