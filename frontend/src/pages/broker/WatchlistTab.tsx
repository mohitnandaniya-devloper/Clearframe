import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookmarkPlus, BrainCircuit, Search, Trash2, TrendingDown, TrendingUp } from "lucide-react";

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
import {
  DEFAULT_WATCHLIST_SYMBOLS,
  MARKET_STOCKS,
  getMarketStock,
  getStoredWatchlistSymbols,
  saveWatchlistSymbols,
  subscribeToWatchlistChanges,
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

export function WatchlistTab() {
  const [query, setQuery] = useState("");
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>(() => getStoredWatchlistSymbols());
  const navigate = useNavigate();

  useEffect(() => subscribeToWatchlistChanges(() => setWatchlistSymbols(getStoredWatchlistSymbols())), []);

  const watchlistStocks = useMemo(
    () =>
      watchlistSymbols
        .map((symbol) => getMarketStock(symbol))
        .filter((stock): stock is NonNullable<typeof stock> => Boolean(stock)),
    [watchlistSymbols],
  );

  const suggestions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return MARKET_STOCKS.filter((stock) => !watchlistSymbols.includes(stock.symbol)).slice(0, 5);
    }

    return MARKET_STOCKS.filter((stock) => {
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
      <Card className="border border-[#2B4E44] bg-[#0B201F] text-[#F6F9F2] ring-0">
        <CardHeader className="gap-3">
          <Badge variant="outline" className="border-[#416133] bg-[#C4E456]/10 text-[#C4E456]">
            Watchlist
          </Badge>
          <CardTitle className="text-2xl font-semibold">Track ideas worth deeper AI analysis.</CardTitle>
          <CardDescription className="max-w-2xl text-[#FFFFFFB3]">
            Save interesting stocks, revisit them quickly, and compare their current setup without any trading actions.
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
                  className="border-[#2B4E44] bg-[#102825] text-[#F6F9F2] hover:bg-[#14302c]"
                  onClick={() => addSymbol(stock.symbol)}
                >
                  <BookmarkPlus className="h-4 w-4 text-[#C4E456]" />
                  {stock.symbol}
                </Button>
              ))}
              {suggestions.length === 0 && (
                <span className="text-sm text-[#FFFFFF80]">No matching ideas available to add.</span>
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
        <Card className="border border-[#2B4E44] bg-[#0B201F] text-[#F6F9F2] ring-0">
          <CardHeader className="gap-2">
            <CardTitle className="text-xl">Tracked Stocks</CardTitle>
            <CardDescription className="text-[#FFFFFF99]">
              Open any stock to review its AI analysis, catalyst stack, and market context.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-[#2B4E44] hover:bg-transparent">
                  <TableHead className="px-4 text-[#FFFFFF80]">Stock</TableHead>
                  <TableHead className="px-4 text-[#FFFFFF80]">Price</TableHead>
                  <TableHead className="px-4 text-[#FFFFFF80]">Change</TableHead>
                  <TableHead className="px-4 text-[#FFFFFF80]">AI score</TableHead>
                  <TableHead className="px-4 text-[#FFFFFF80]">Reason to watch</TableHead>
                  <TableHead className="px-4 text-right text-[#FFFFFF80]">Remove</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {watchlistStocks.length > 0 ? (
                  watchlistStocks.map((stock) => {
                    const isPositive = stock.changePercent >= 0;

                    return (
                      <TableRow
                        key={stock.symbol}
                        className="border-[#2B4E44] hover:bg-[#102825]"
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
                        <TableCell className="px-4 py-4 text-[#F6F9F2]">{formatCurrency(stock.price)}</TableCell>
                        <TableCell className={`px-4 py-4 ${isPositive ? "text-[#C4E456]" : "text-[#EB316F]"}`}>
                          <span className="inline-flex items-center gap-1">
                            {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                            {formatPercent(stock.changePercent)}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-4 text-[#F6F9F2]">{stock.aiScore}/100</TableCell>
                        <TableCell className="px-4 py-4 text-[#FFFFFFB3]">{stock.theme}</TableCell>
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
                    <TableCell colSpan={6} className="px-4 py-10 text-center text-[#FFFFFF99]">
                      Your watchlist is empty. Add a few stocks above to start building an AI research queue.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="border border-[#2B4E44] bg-[#0B201F] text-[#F6F9F2] ring-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BrainCircuit className="h-4 w-4 text-[#C4E456]" />
                Watchlist Guidance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[#FFFFFFB3]">
              <div className="rounded-xl border border-[#2B4E44] bg-[#102825] p-4">
                Keep a mix of leaders, mean-reversion candidates, and sector hedges so your AI comparisons stay useful.
              </div>
              <div className="rounded-xl border border-[#2B4E44] bg-[#102825] p-4">
                Use the stock detail page to compare support, resistance, catalysts, and portfolio overlap before deciding what deserves more research.
              </div>
            </CardContent>
          </Card>

          <Card className="border border-[#2B4E44] bg-[#0B201F] text-[#F6F9F2] ring-0">
            <CardHeader>
              <CardTitle className="text-base">Current focus areas</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {["Private Banks", "Large-cap Quality", "Auto Leadership", "Defensive Pharma"].map((theme) => (
                <Badge key={theme} variant="outline" className="border-[#2B4E44] text-[#FFFFFFB3]">
                  {theme}
                </Badge>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
