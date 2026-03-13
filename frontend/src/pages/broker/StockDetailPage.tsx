import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Bookmark, Gauge, LineChart, TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useMarketQuotes } from "@/hooks/use-market-quotes";
import { useMarketStream } from "@/hooks/use-market-stream";
import { fetchMarketHistory, type MarketHistoryCandle, type MarketTickMessage } from "@/lib/api/brokers";
import {
  getMarketCatalogEntry,
  getStoredWatchlistSymbols,
  saveWatchlistSymbols,
  subscribeToWatchlistChanges,
  type MarketCatalogEntry,
} from "@/lib/market-data";

export interface StockDetailHolding {
  symbol: string;
  company_name?: string;
  exchange?: string;
  quantity: number;
  average_price: number;
  last_traded_price: number;
  invested_value: number;
  current_value: number;
  pnl: number;
  pnl_percentage?: number | null;
}

type Timeframe = "1D" | "1W" | "1M" | "1Y";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
}

function getHoldingPnlPercent(holding: StockDetailHolding | undefined): number {
  if (!holding || holding.invested_value <= 0) {
    return 0;
  }
  return holding.pnl_percentage ?? (holding.pnl / holding.invested_value) * 100;
}

function toggleWatchlist(symbol: string): string[] {
  const current = getStoredWatchlistSymbols();
  const isTracked = current.includes(symbol);
  const next = isTracked ? current.filter((item) => item !== symbol) : [...current, symbol];
  saveWatchlistSymbols(next);
  return next;
}

export default function StockDetailPage() {
  const { symbol } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = (location.state ?? {}) as { stock?: MarketCatalogEntry; holding?: StockDetailHolding };

  const fallbackStock = symbol ? getMarketCatalogEntry(symbol) : undefined;
  const stock = locationState.stock ?? fallbackStock;
  const holding = locationState.holding;
  const resolvedSymbol = stock?.symbol ?? symbol ?? "";

  const { quotes } = useMarketQuotes(resolvedSymbol ? [resolvedSymbol] : [], {
    enabled: Boolean(resolvedSymbol),
    refreshMs: 30000,
  });
  const initialQuote = quotes.get(resolvedSymbol);
  const initialPrice = initialQuote?.ltp ?? holding?.last_traded_price ?? 0;

  const [timeframe, setTimeframe] = useState<Timeframe>("1D");
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>(() => getStoredWatchlistSymbols());
  const [intradayPrices, setIntradayPrices] = useState<number[]>(() => (initialPrice > 0 ? [initialPrice] : []));
  const [historyCandles, setHistoryCandles] = useState<MarketHistoryCandle[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  useEffect(() => subscribeToWatchlistChanges(() => setWatchlistSymbols(getStoredWatchlistSymbols())), []);

  useEffect(() => {
    if (!resolvedSymbol) {
      setHistoryCandles([]);
      return;
    }

    let cancelled = false;
    const loadHistory = async () => {
      setIsHistoryLoading(true);
      try {
        const candles = await fetchMarketHistory(resolvedSymbol, timeframe);
        if (!cancelled) {
          setHistoryCandles(candles);
        }
      } catch {
        if (!cancelled) {
          setHistoryCandles([]);
        }
      } finally {
        if (!cancelled) {
          setIsHistoryLoading(false);
        }
      }
    };

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [resolvedSymbol, timeframe]);

  useMarketStream({
    enabled: Boolean(resolvedSymbol),
    symbols: resolvedSymbol ? [resolvedSymbol] : [],
    onTick: (tick: MarketTickMessage) => {
      if (tick.symbol.toUpperCase() !== resolvedSymbol.toUpperCase()) {
        return;
      }

      setIntradayPrices((current) => [...current, tick.ltp].slice(-30));
    },
  });

  if (!symbol || !stock) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="border border-[#2B4E44] bg-[#102825] text-[#F6F9F2] shadow-[0_20px_48px_rgba(0,0,0,0.16)] ring-0">
          <CardContent className="px-8 py-8 text-center">
            <p className="text-lg font-medium">Stock details are unavailable.</p>
            <Button
              type="button"
              variant="outline"
              className="mt-4 border-[#2B4E44] bg-[#102825] text-[#F6F9F2] hover:bg-[#14302c]"
              onClick={() => navigate(-1)}
            >
              Back to dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const quote = quotes.get(resolvedSymbol);
  const latestPrice = intradayPrices[intradayPrices.length - 1] ?? quote?.ltp ?? initialPrice;
  const referencePrice = quote?.close ?? intradayPrices[0] ?? latestPrice;
  const priceChange = latestPrice - referencePrice;
  const priceChangePercent = referencePrice > 0 ? (priceChange / referencePrice) * 100 : 0;
  const isPositive = priceChange >= 0;
  const isTracked = watchlistSymbols.includes(stock.symbol);
  const holdingPnlPercent = getHoldingPnlPercent(holding);
  const fallbackPrices = intradayPrices.length > 0 ? intradayPrices : initialPrice > 0 ? [initialPrice] : [];
  const chartData =
    historyCandles.length > 0
      ? historyCandles.map((candle, index) => ({
          label: formatHistoryLabel(candle.timestamp, index, timeframe),
          price: candle.close,
        }))
      : fallbackPrices.map((price, index) => ({
          label: `${index + 1}`,
          price,
        }));

  const dayLow = quote?.low;
  const dayHigh = quote?.high;
  const dayOpen = quote?.open;
  const dayClose = quote?.close;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <Button
            type="button"
            variant="ghost"
            className="-ml-3 w-fit text-[#FFFFFFB3] hover:bg-[#102825] hover:text-[#F6F9F2]"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-[#2B4E44] text-[#FFFFFFB3]">
              {stock.exchange}
            </Badge>
            <Badge variant="outline" className="border-[#2B4E44] text-[#FFFFFFB3]">
              {stock.sector}
            </Badge>
            <Badge variant="outline" className="border-[#416133] bg-[#C4E456]/10 text-[#C4E456]">
              Live quote
            </Badge>
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#F6F9F2]">{stock.companyName}</h1>
            <p className="mt-1 text-sm uppercase tracking-[0.24em] text-[#FFFFFF80]">{stock.symbol}</p>
          </div>
          <p className="max-w-3xl text-sm leading-7 text-[#FFFFFFB3]">
            This detail page now shows only real market quote fields and your connected portfolio context.
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-[#2B4E44] bg-[#102825] p-5 shadow-[0_20px_48px_rgba(0,0,0,0.16)] xl:min-w-[320px]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-[#FFFFFF80]">Current price</p>
              <p className="mt-2 text-3xl font-semibold text-[#F6F9F2]">{latestPrice > 0 ? formatCurrency(latestPrice) : "Live pending"}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="border-[#2B4E44] bg-[#102825] text-[#F6F9F2] hover:bg-[#14302c]"
              onClick={() => setWatchlistSymbols(toggleWatchlist(stock.symbol))}
            >
              <Bookmark className={`h-4 w-4 ${isTracked ? "fill-[#C4E456] text-[#C4E456]" : "text-[#FFFFFFB3]"}`} />
              {isTracked ? "Tracked" : "Add to watchlist"}
            </Button>
          </div>
          <div className={`inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${isPositive ? "bg-[#C4E456]/10 text-[#C4E456]" : "bg-[#EB316F]/10 text-[#EB316F]"}`}>
            {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {formatCurrency(priceChange)} · {formatPercent(priceChangePercent)}
          </div>
          <Separator className="bg-[#2B4E44]" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[#FFFFFF80]">Open</p>
              <p className="mt-1 text-base font-medium text-[#F6F9F2]">{dayOpen ? formatCurrency(dayOpen) : "-"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[#FFFFFF80]">Previous close</p>
              <p className="mt-1 text-base font-medium text-[#F6F9F2]">{dayClose ? formatCurrency(dayClose) : "-"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="overflow-hidden border border-[#2B4E44] bg-[#102825] text-[#F6F9F2] shadow-[0_20px_48px_rgba(0,0,0,0.16)] ring-0">
          <CardHeader className="gap-4 border-b border-[#2B4E44]/70">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <LineChart className="h-5 w-5 text-[#C4E456]" />
                Market history
              </CardTitle>
              <CardDescription className="mt-1 text-[#FFFFFF99]">
                Historical candles come from Angel One. Live ticks are still used for the current price.
              </CardDescription>
            </div>
            <Tabs value={timeframe} onValueChange={(value) => setTimeframe(value as Timeframe)}>
              <TabsList className="border border-[#2B4E44] bg-[#102825]">
                {(["1D", "1W", "1M", "1Y"] as Timeframe[]).map((value) => (
                  <TabsTrigger key={value} value={value} className="data-active:bg-[#C4E456] data-active:text-[#0B201F]">
                    {value}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="pb-6">
            <div className="h-[360px]">
              <ChartContainer
                config={{
                  price: {
                    label: "Price",
                    color: isPositive ? "#C4E456" : "#EB316F",
                  },
                }}
                className="h-full w-full"
              >
                <AreaChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="detail-price-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={isPositive ? "#C4E456" : "#EB316F"} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={isPositive ? "#C4E456" : "#EB316F"} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#FFFFFF80", fontSize: 11 }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#FFFFFF80", fontSize: 11 }}
                    tickFormatter={(value) => `₹${formatNumber(Number(value))}`}
                    width={84}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />}
                    cursor={{ stroke: isPositive ? "#C4E456" : "#EB316F", strokeDasharray: "4 4" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke={isPositive ? "#C4E456" : "#EB316F"}
                    fill="url(#detail-price-fill)"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </AreaChart>
              </ChartContainer>
            </div>
            <p className="mt-3 text-xs text-[#FFFFFF80]">
              {isHistoryLoading ? "Loading Angel One candle history..." : historyCandles.length > 0 ? "Chart uses broker candle history." : "History unavailable, showing live session trace fallback."}
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="overflow-hidden border border-[#2B4E44] bg-[#102825] text-[#F6F9F2] shadow-[0_20px_48px_rgba(0,0,0,0.16)] ring-0">
            <CardHeader className="border-b border-[#2B4E44]/70">
              <CardTitle className="flex items-center gap-2 text-base">
                <Gauge className="h-4 w-4 text-[#C4E456]" />
                Live market stats
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[#2B4E44] bg-[#0B201F]/75 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#FFFFFF80]">Day low</p>
                <p className="mt-2 text-base font-medium text-[#F6F9F2]">{dayLow ? formatCurrency(dayLow) : "-"}</p>
              </div>
              <div className="rounded-xl border border-[#2B4E44] bg-[#0B201F]/75 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#FFFFFF80]">Day high</p>
                <p className="mt-2 text-base font-medium text-[#F6F9F2]">{dayHigh ? formatCurrency(dayHigh) : "-"}</p>
              </div>
              <div className="rounded-xl border border-[#2B4E44] bg-[#0B201F]/75 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#FFFFFF80]">Previous close</p>
                <p className="mt-2 text-base font-medium text-[#F6F9F2]">{dayClose ? formatCurrency(dayClose) : "-"}</p>
              </div>
              <div className="rounded-xl border border-[#2B4E44] bg-[#0B201F]/75 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#FFFFFF80]">Exchange</p>
                <p className="mt-2 text-base font-medium text-[#F6F9F2]">{stock.exchange}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border border-[#2B4E44] bg-[#102825] text-[#F6F9F2] shadow-[0_20px_48px_rgba(0,0,0,0.16)] ring-0">
            <CardHeader className="border-b border-[#2B4E44]/70">
              <CardTitle className="text-base">Connected portfolio context</CardTitle>
              <CardDescription className="text-[#FFFFFF99]">
                Helpful when this stock is already in your broker-linked holdings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {holding ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-[#2B4E44] bg-[#0B201F]/75 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#FFFFFF80]">Quantity</p>
                    <p className="mt-2 text-lg font-medium text-[#F6F9F2]">{formatNumber(holding.quantity)}</p>
                  </div>
                  <div className="rounded-xl border border-[#2B4E44] bg-[#0B201F]/75 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#FFFFFF80]">Average price</p>
                    <p className="mt-2 text-lg font-medium text-[#F6F9F2]">{formatCurrency(holding.average_price)}</p>
                  </div>
                  <div className="rounded-xl border border-[#2B4E44] bg-[#0B201F]/75 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#FFFFFF80]">Unrealized P&L</p>
                    <p className={`mt-2 text-lg font-medium ${holding.pnl >= 0 ? "text-[#C4E456]" : "text-[#EB316F]"}`}>
                      {formatCurrency(holding.pnl)} · {formatPercent(holdingPnlPercent)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[#2B4E44] bg-[#0B201F]/75 px-6 py-8 text-sm text-[#FFFFFFB3]">
                  This stock is not currently present in the connected portfolio snapshot.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function formatHistoryLabel(timestamp: string, index: number, timeframe: Timeframe): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return `${index + 1}`;
  }

  if (timeframe === "1D") {
    return new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  if (timeframe === "1W") {
    return new Intl.DateTimeFormat("en-IN", {
      weekday: "short",
      hour: "numeric",
    }).format(date);
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(date);
}
