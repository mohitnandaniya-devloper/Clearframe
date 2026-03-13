import { useEffect, useMemo, useState } from "react";

import { fetchMarketQuotes, type MarketQuoteSnapshot } from "@/lib/api/brokers";

interface UseMarketQuotesOptions {
  enabled?: boolean;
  refreshMs?: number;
}

interface UseMarketQuotesResult {
  quotes: Map<string, MarketQuoteSnapshot>;
  isLoading: boolean;
  error: string | null;
}

function normalizeSymbols(symbols: string[]): string[] {
  return Array.from(new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))).sort();
}

export function useMarketQuotes(
  symbols: string[],
  options: UseMarketQuotesOptions = {},
): UseMarketQuotesResult {
  const { enabled = true, refreshMs = 30000 } = options;
  const normalizedSymbols = useMemo(() => normalizeSymbols(symbols), [symbols]);
  const symbolsKey = normalizedSymbols.join("|");
  const [quotes, setQuotes] = useState<Map<string, MarketQuoteSnapshot>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || normalizedSymbols.length === 0) {
      setQuotes(new Map());
      setError(null);
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    const loadQuotes = async () => {
      setIsLoading(true);
      try {
        const nextQuotes = await fetchMarketQuotes(normalizedSymbols);
        if (isCancelled) {
          return;
        }

        setQuotes(
          new Map(
            nextQuotes.map((quote) => [quote.symbol.toUpperCase(), quote] as const),
          ),
        );
        setError(null);
      } catch (loadError) {
        if (isCancelled) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Unable to load live market quotes.");
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadQuotes();
    const intervalId = window.setInterval(() => {
      void loadQuotes();
    }, refreshMs);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [enabled, refreshMs, symbolsKey, normalizedSymbols]);

  return { quotes, isLoading, error };
}
