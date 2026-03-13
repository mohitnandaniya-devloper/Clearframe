import { useEffect, useMemo, useState } from "react";

import {
  fetchMarketQuotes,
  type MarketQuoteSnapshot,
  type MarketTickMessage,
} from "@/lib/api/brokers";
import { useMarketStream } from "@/hooks/use-market-stream";

interface UseMarketQuotesOptions {
  enabled?: boolean;
  refreshMs?: number;
  streamEnabled?: boolean;
}

interface UseMarketQuotesResult {
  quotes: Map<string, MarketQuoteSnapshot>;
  isLoading: boolean;
  error: string | null;
  streamStatus: "idle" | "connecting" | "live" | "error";
  streamError: string | null;
  lastTickAt: number | null;
}

function normalizeSymbols(symbols: string[]): string[] {
  return Array.from(new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))).sort();
}

export function useMarketQuotes(
  symbols: string[],
  options: UseMarketQuotesOptions = {},
): UseMarketQuotesResult {
  const { enabled = true, refreshMs = 30000, streamEnabled = false } = options;
  const normalizedSymbols = useMemo(() => normalizeSymbols(symbols), [symbols]);
  const symbolsKey = normalizedSymbols.join("|");
  const [quotes, setQuotes] = useState<Map<string, MarketQuoteSnapshot>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [streamError, setStreamError] = useState<string | null>(null);
  const [lastTickAt, setLastTickAt] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled || normalizedSymbols.length === 0 || !streamEnabled) {
      setStreamStatus("idle");
      setStreamError(null);
      setLastTickAt(null);
      return;
    }

    setStreamStatus("connecting");
    setStreamError(null);
    setLastTickAt(null);
  }, [enabled, streamEnabled, symbolsKey, normalizedSymbols.length]);

  useMarketStream({
    enabled: enabled && streamEnabled && normalizedSymbols.length > 0,
    symbols: normalizedSymbols,
    onTick: (tick: MarketTickMessage) => {
      const normalizedSymbol = tick.symbol.trim().toUpperCase();
      setQuotes((current) => {
        const next = new Map(current);
        const previous = next.get(normalizedSymbol);
        next.set(normalizedSymbol, {
          symbol: normalizedSymbol,
          token: tick.token,
          exchange: tick.exchange,
          ltp: tick.ltp,
          volume: tick.volume ?? previous?.volume ?? null,
          bid: tick.bid ?? previous?.bid ?? null,
          ask: tick.ask ?? previous?.ask ?? null,
          timestamp: tick.timestamp,
          open: previous?.open ?? null,
          high: previous?.high ?? null,
          low: previous?.low ?? null,
          close: previous?.close ?? null,
        });
        return next;
      });
      setStreamStatus("live");
      setStreamError(null);
      setLastTickAt(Date.now());
    },
    onError: (streamLoadError) => {
      setStreamStatus("error");
      setStreamError(
        streamLoadError instanceof Error
          ? streamLoadError.message
          : "Unable to open the live market stream.",
      );
    },
  });

  useEffect(() => {
    if (!enabled || normalizedSymbols.length === 0) {
      setQuotes(new Map());
      setError(null);
      setIsLoading(false);
      return;
    }

    const requestSymbols = symbolsKey ? symbolsKey.split("|").filter(Boolean) : [];
    let isCancelled = false;

    const loadQuotes = async () => {
      setIsLoading(true);
      try {
        const nextQuotes = await fetchMarketQuotes(requestSymbols);
        if (isCancelled) {
          return;
        }

        setQuotes(
          new Map(
            nextQuotes.map((quote) => [
              quote.symbol.toUpperCase(),
              {
                ...quote,
                symbol: quote.symbol.toUpperCase(),
              },
            ] as const),
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
  }, [enabled, refreshMs, symbolsKey, normalizedSymbols.length]);

  return { quotes, isLoading, error, streamStatus, streamError, lastTickAt };
}
