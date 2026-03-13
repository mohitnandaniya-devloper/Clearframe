import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookmarkPlus, Search, Trash2, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMarketQuotes } from "@/hooks/use-market-quotes";
import type { MarketQuoteSnapshot } from "@/lib/api/brokers";
import {
  DEFAULT_WATCHLIST_SYMBOLS,
  MARKET_CATALOG,
  getMarketCatalogEntry,
  getStoredWatchlistSymbols,
  saveWatchlistSymbols,
  subscribeToWatchlistChanges,
  type MarketCatalogEntry,
} from "@/lib/market-data";

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

function getQuoteChangePercent(quote: MarketQuoteSnapshot | undefined): number {
  if (!quote?.close || quote.close <= 0) {
    return 0;
  }
  return ((quote.ltp - quote.close) / quote.close) * 100;
}

function getQuoteChangeValue(quote: MarketQuoteSnapshot | undefined): number {
  if (!quote?.close) {
    return 0;
  }
  return quote.ltp - quote.close;
}

function formatStreamStatusLabel(
  streamStatus: "idle" | "connecting" | "live" | "error",
  lastTickAt: number | null,
): string {
  if (streamStatus === "live" && lastTickAt) {
    return `WebSocket live · last tick ${new Date(lastTickAt).toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    })}`;
  }

  if (streamStatus === "connecting") {
    return "Opening live watchlist stream";
  }

  if (streamStatus === "error") {
    return "Live stream unavailable";
  }

  return "Live stream idle";
}

export function WatchlistTab() {
  const [query, setQuery] = useState("");
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>(() => getStoredWatchlistSymbols());
  const navigate = useNavigate();

  useEffect(() => subscribeToWatchlistChanges(() => setWatchlistSymbols(getStoredWatchlistSymbols())), []);

  const { quotes, error, streamStatus, streamError, lastTickAt } = useMarketQuotes(watchlistSymbols, {
    enabled: watchlistSymbols.length > 0,
    refreshMs: 120000,
    streamEnabled: true,
  });

  const watchlistStocks = useMemo(
    () =>
      watchlistSymbols
        .map((symbol) => getMarketCatalogEntry(symbol))
        .filter((stock): stock is MarketCatalogEntry => Boolean(stock)),
    [watchlistSymbols],
  );

  const suggestions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return MARKET_CATALOG.filter((stock) => !watchlistSymbols.includes(stock.symbol)).slice(0, 5);
    }

    return MARKET_CATALOG.filter((stock) => {
      const haystack = `${stock.symbol} ${stock.companyName} ${stock.sector}`.toLowerCase();
      return haystack.includes(normalizedQuery) && !watchlistSymbols.includes(stock.symbol);
    }).slice(0, 6);
  }, [query, watchlistSymbols]);

  const addSymbol = (symbol: string) => {
    saveWatchlistSymbols([...watchlistSymbols, symbol]);
    setWatchlistSymbols(getStoredWatchlistSymbols());
    setQuery("");
  };

  const removeSymbol = (symbol: string) => {
    saveWatchlistSymbols(watchlistSymbols.filter((item) => item !== symbol));
    setWatchlistSymbols(getStoredWatchlistSymbols());
  };

  const resetWatchlist = () => {
    saveWatchlistSymbols(DEFAULT_WATCHLIST_SYMBOLS);
    setWatchlistSymbols(getStoredWatchlistSymbols());
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border border-[#2B4E44] bg-[#102825] text-[#F6F9F2] shadow-[0_20px_48px_rgba(0,0,0,0.18)] ring-0">
        <CardHeader className="gap-3 border-b border-[#2B4E44]/70">
          <Badge variant="outline" className="border-[#416133] bg-[#C4E456]/10 text-[#C4E456]">
            Watchlist
          </Badge>
          <CardTitle className="text-2xl font-semibold tracking-tight">Track live symbols you want to revisit.</CardTitle>
          <CardDescription className="max-w-2xl text-[#FFFFFFB3]">
            This view keeps the list simple: real quotes, day move, and session range for each tracked stock.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#FFFFFF80]" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Add a stock by symbol, company, or sector"
                className="h-11 border-[#2B4E44] bg-[#102825] pl-10 text-[#F6F9F2] placeholder:text-[#FFFFFF66]"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((stock) => (
                <Button
                  key={stock.symbol}
                  type="button"
                  variant="outline"
                  className="border-[#2B4E44] bg-[#0B201F]/75 text-[#F6F9F2] hover:bg-[#14302c]"
                  onClick={() => addSymbol(stock.symbol)}
                >
                  <BookmarkPlus className="h-4 w-4 text-[#C4E456]" />
                  {stock.symbol}
                </Button>
              ))}
              {suggestions.length === 0 && (
                <span className="text-sm text-[#FFFFFF80]">No matching symbols available to add.</span>
              )}
            </div>
          </div>

          <div className="flex gap-2 lg:flex-col">
            <Button
              type="button"
              variant="outline"
              className="border-[#2B4E44] bg-[#102825] text-[#F6F9F2] hover:bg-[#14302c]"
              onClick={resetWatchlist}
            >
              Reset defaults
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.7fr]">
        <Card className="overflow-hidden border border-[#2B4E44] bg-[#102825] text-[#F6F9F2] shadow-[0_20px_48px_rgba(0,0,0,0.16)] ring-0">
          <CardHeader className="gap-2 border-b border-[#2B4E44]/70">
            <CardTitle className="text-xl tracking-tight">Tracked Stocks</CardTitle>
            <CardDescription className="text-[#FFFFFF99]">
              Only live quote fields are shown here. No seeded AI score or fake narrative fields remain in the table.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow className="border-[#2B4E44] hover:bg-transparent">
                  <TableHead className="px-4 text-[#FFFFFF80]">Stock</TableHead>
                  <TableHead className="px-4 text-[#FFFFFF80]">Price</TableHead>
                  <TableHead className="px-4 text-[#FFFFFF80]">Day move</TableHead>
                  <TableHead className="px-4 text-[#FFFFFF80]">Range</TableHead>
                  <TableHead className="px-4 text-right text-[#FFFFFF80]">Remove</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {watchlistStocks.length > 0 ? (
                  watchlistStocks.map((stock) => {
                    const quote = quotes.get(stock.symbol);
                    const changePercent = getQuoteChangePercent(quote);
                    const isPositive = changePercent >= 0;

                    return (
                      <TableRow
                        key={stock.symbol}
                        className="border-[#2B4E44] hover:bg-[#0B201F]/50"
                      >
                        <TableCell
                          className="cursor-pointer px-4 py-4"
                          onClick={() => navigate(`/dashboard/stock/${stock.symbol}`, { state: { stock } })}
                        >
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-[#F6F9F2]">{stock.symbol}</span>
                            <span className="text-xs text-[#FFFFFF80]">{stock.companyName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-4 text-[#F6F9F2]">
                          {quote ? formatCurrency(quote.ltp) : "Live pending"}
                        </TableCell>
                        <TableCell className={`px-4 py-4 ${isPositive ? "text-[#C4E456]" : "text-[#EB316F]"}`}>
                          <span className="inline-flex items-center gap-1">
                            {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                            {quote ? `${formatCurrency(getQuoteChangeValue(quote))} · ${formatPercent(changePercent)}` : "-"}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-4 text-[#FFFFFFB3]">
                          {quote?.low !== undefined && quote?.low !== null && quote?.high !== undefined && quote?.high !== null
                            ? `${formatCurrency(quote.low)} - ${formatCurrency(quote.high)}`
                            : "-"}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            className="text-[#EB316F] hover:bg-[#EB316F]/10 hover:text-[#EB316F]"
                            onClick={() => removeSymbol(stock.symbol)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow className="border-[#2B4E44]">
                    <TableCell colSpan={5} className="px-4 py-10 text-center text-[#FFFFFF99]">
                      Your watchlist is empty. Add a few stocks above to start tracking live quotes.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="overflow-hidden border border-[#2B4E44] bg-[#102825] text-[#F6F9F2] shadow-[0_20px_48px_rgba(0,0,0,0.16)] ring-0">
            <CardHeader className="border-b border-[#2B4E44]/70">
              <CardTitle className="text-base">Watchlist Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[#FFFFFFB3]">
              <div className="rounded-xl border border-[#2B4E44] bg-[#0B201F]/75 p-4">
                {watchlistSymbols.length} symbols are currently tracked for live websocket quote updates.
              </div>
              <div className="rounded-xl border border-[#2B4E44] bg-[#0B201F]/75 p-4">
                {streamError
                  ? `WebSocket warning: ${streamError}`
                  : error
                    ? `Quote API warning: ${error}`
                    : formatStreamStatusLabel(streamStatus, lastTickAt)}
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border border-[#2B4E44] bg-[#102825] text-[#F6F9F2] shadow-[0_20px_48px_rgba(0,0,0,0.16)] ring-0">
            <CardHeader className="border-b border-[#2B4E44]/70">
              <CardTitle className="text-base">Current focus areas</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {Array.from(new Set(watchlistStocks.map((stock) => stock.sector))).map((sector) => (
                <Badge key={sector} variant="outline" className="border-[#2B4E44] text-[#FFFFFFB3]">
                  {sector}
                </Badge>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
