import { useEffect, useRef } from "react";
import {
  getMarketSocketUrl,
  subscribeToMarketSymbols,
  type MarketTickMessage,
  unsubscribeFromMarketSymbols,
} from "@/lib/api/brokers";

interface UseMarketStreamOptions {
  enabled?: boolean;
  symbols: string[];
  onTick: (tick: MarketTickMessage) => void;
  onError?: (error: unknown) => void;
}

export function useMarketStream({
  enabled = true,
  symbols,
  onTick,
  onError,
}: UseMarketStreamOptions): void {
  const onTickRef = useRef(onTick);
  const onErrorRef = useRef(onError);
  const symbolsKey = symbols.map((symbol) => symbol.trim().toUpperCase()).sort().join("|");

  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    const normalizedSymbols = symbolsKey
      .split("|")
      .map((symbol) => symbol.trim())
      .filter(Boolean);

    if (!enabled || normalizedSymbols.length === 0) {
      return;
    }

    let socket: WebSocket | null = null;
    let closed = false;

    const connect = async () => {
      try {
        await subscribeToMarketSymbols(normalizedSymbols);
        const socketUrl = await getMarketSocketUrl();
        if (closed) {
          return;
        }

        socket = new WebSocket(socketUrl);
        socket.addEventListener("open", () => {
          socket?.send(
            JSON.stringify({ action: "subscribe", symbols: normalizedSymbols, mode: "LTP" }),
          );
        });

        socket.addEventListener("message", (event) => {
          try {
            const tick = JSON.parse(event.data) as MarketTickMessage;
            onTickRef.current(tick);
          } catch {
            // Ignore malformed market stream messages.
          }
        });
      } catch (error) {
        onErrorRef.current?.(error);
      }
    };

    void connect();

    return () => {
      closed = true;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({ action: "unsubscribe", symbols: normalizedSymbols, mode: "LTP" }),
        );
      }
      socket?.close();
      void unsubscribeFromMarketSymbols(normalizedSymbols);
    };
  }, [enabled, symbolsKey]);
}
