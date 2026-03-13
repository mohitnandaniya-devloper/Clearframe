export interface PortfolioApiHolding {
  symbol: string;
  quantity: number;
  average_price: number;
  ltp: number;
  pnl: number;
}

export interface PortfolioHolding extends Record<string, unknown> {
  symbol: string;
  quantity: number;
  average_price: number;
  last_traded_price: number;
  invested_value: number;
  current_value: number;
  pnl: number;
  _ltpHistory?: number[];
}

export interface PortfolioSummary {
  current_value: number;
  invested_value: number;
  total_pnl: number;
  holdings_count: number;
}

export function normalizePortfolioHolding(holding: PortfolioApiHolding): PortfolioHolding {
  const investedValue = holding.quantity * holding.average_price;
  const currentValue = holding.quantity * holding.ltp;

  return {
    symbol: holding.symbol,
    quantity: holding.quantity,
    average_price: holding.average_price,
    last_traded_price: holding.ltp,
    invested_value: investedValue,
    current_value: currentValue,
    pnl: holding.pnl,
  };
}

export function asPortfolioHoldings(value: unknown): PortfolioHolding[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is PortfolioHolding => !!item && typeof item === "object",
  );
}

export function holdingInvestedValue(holding: Record<string, unknown>): number {
  const quantity = toNumber(holding.quantity);
  const averagePrice = toNumber(holding.average_price);
  return numericOrFallback(holding.invested_value, quantity * averagePrice);
}

export function holdingCurrentValue(holding: Record<string, unknown>): number {
  const quantity = toNumber(holding.quantity);
  const lastTradedPrice = toNumber(holding.last_traded_price);
  return numericOrFallback(holding.current_value, quantity * lastTradedPrice);
}

export function holdingPnlValue(holding: Record<string, unknown>): number {
  const investedValue = holdingInvestedValue(holding);
  const currentValue = holdingCurrentValue(holding);
  return numericOrFallback(holding.pnl, currentValue - investedValue);
}

export function holdingHasPosition(holding: Record<string, unknown>): boolean {
  return (
    toNumber(holding.quantity) > 0 ||
    holdingInvestedValue(holding) > 0 ||
    holdingCurrentValue(holding) > 0
  );
}

export function buildPortfolioSummary(holdings: Array<Record<string, unknown>>): PortfolioSummary {
  return holdings.reduce<PortfolioSummary>(
    (summary, holding) => {
      summary.current_value += holdingCurrentValue(holding);
      summary.invested_value += holdingInvestedValue(holding);
      summary.total_pnl += holdingPnlValue(holding);
      return summary;
    },
    {
      current_value: 0,
      invested_value: 0,
      total_pnl: 0,
      holdings_count: holdings.length,
    },
  );
}

export function applyMarketTickToHolding(
  holding: PortfolioHolding,
  ltp: number,
): PortfolioHolding {
  const quantity = toNumber(holding.quantity);
  const averagePrice = toNumber(holding.average_price);
  const currentValue = quantity * ltp;
  const investedValue = quantity * averagePrice;
  const history = Array.isArray(holding._ltpHistory) ? holding._ltpHistory : [];

  return {
    ...holding,
    last_traded_price: ltp,
    current_value: currentValue,
    invested_value: investedValue,
    pnl: currentValue - investedValue,
    _ltpHistory: [...history, ltp].slice(-60),
  };
}

export function mergePortfolioHoldingsWithLiveState(
  incomingHoldings: PortfolioHolding[],
  currentHoldings: PortfolioHolding[],
): PortfolioHolding[] {
  const currentHoldingsBySymbol = new Map(
    currentHoldings.map((holding) => [normalizeSymbolForMatch(holding.symbol), holding]),
  );

  return incomingHoldings.map((holding) => {
    const currentHolding = currentHoldingsBySymbol.get(normalizeSymbolForMatch(holding.symbol));
    if (!currentHolding) {
      return holding;
    }

    const liveLastTradedPrice = toNumber(currentHolding.last_traded_price);
    const history = Array.isArray(currentHolding._ltpHistory)
      ? currentHolding._ltpHistory
      : undefined;
    const hasLiveStreamState = Boolean(history?.length) && liveLastTradedPrice > 0;

    if (!hasLiveStreamState) {
      return history ? { ...holding, _ltpHistory: history } : holding;
    }

    const quantity = toNumber(holding.quantity);
    const averagePrice = toNumber(holding.average_price);
    const investedValue = quantity * averagePrice;
    const currentValue = quantity * liveLastTradedPrice;

    return {
      ...holding,
      last_traded_price: liveLastTradedPrice,
      current_value: currentValue,
      invested_value: investedValue,
      pnl: currentValue - investedValue,
      ...(history ? { _ltpHistory: history } : {}),
    };
  });
}

export function normalizeSymbolForMatch(value: unknown): string {
  const symbol = stringValue(value).toUpperCase();
  return symbol
    .replace(/^[A-Z]+:/, "")
    .replace(/[-_](EQ|BE|BZ|BL|SM|ST|IV|GB)$/i, "")
    .trim();
}

function stringValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function toNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isNaN(numeric) ? 0 : numeric;
}

function numericOrFallback(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const numeric = Number(value);
  return Number.isNaN(numeric) ? fallback : numeric;
}
