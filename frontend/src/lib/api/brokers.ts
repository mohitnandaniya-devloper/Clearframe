import brokersData from "@/data/brokers.json";
import {
  buildPortfolioSummary,
  normalizePortfolioHolding,
  type PortfolioApiHolding,
} from "@/lib/portfolio";

export interface Broker {
  id: string;
  name: string;
  tagline: string;
  logoSrc: string;
  enabled: boolean;
}

export interface ConnectBrokerCredentials {
  clientCode: string;
  password: string;
  totp: string;
}

export interface BrokerApiResponse {
  success: boolean;
  provider: string | null;
  connection_state: string;
  reason_code: string;
  message: string;
  reconnect_required: boolean;
  retry_allowed: boolean;
  next_action: "retry" | "relogin" | "wait" | "none" | "contact_support";
  request_id?: string | null;
  data?: Record<string, unknown> | null;
}

interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

interface PortfolioResponse {
  holdings: PortfolioApiHolding[];
}

export interface MarketTickMessage {
  symbol: string;
  token: string;
  exchange: string;
  ltp: number;
  volume?: number | null;
  bid?: number | null;
  ask?: number | null;
  timestamp: string;
}

export interface MarketQuoteSnapshot extends MarketTickMessage {
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
}

const brokers = brokersData as Broker[];

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://127.0.0.1:8000/api/v1";
const FRONTEND_DEMO_EMAIL =
  (import.meta.env.VITE_BACKEND_DEMO_EMAIL as string | undefined)?.trim() ?? "";
const FRONTEND_DEMO_PASSWORD =
  (import.meta.env.VITE_BACKEND_DEMO_PASSWORD as string | undefined)?.trim() ?? "";
const ACCESS_TOKEN_STORAGE_KEY = "clearframe.backend.access_token";
const REFRESH_TOKEN_STORAGE_KEY = "clearframe.backend.refresh_token";
const CONNECTED_BROKER_STORAGE_KEY = "clearframe.backend.connected_broker";
const CONNECTED_BROKER_VIEW_STORAGE_KEY = "clearframe.backend.connected_broker_view";

export async function fetchBrokers(): Promise<Broker[]> {
  return brokers;
}

export async function connectBroker(
  brokerId: string,
  credentials: ConnectBrokerCredentials,
): Promise<BrokerApiResponse> {
  if (!credentials.clientCode || !credentials.password || !credentials.totp) {
    return buildErrorResponse(brokerId, "Please fill in all credentials to continue.");
  }

  if (brokerId !== "angel_one") {
    return buildUnsupportedBrokerResponse(brokerId);
  }

  const response = await fetchWithAuth<BrokerApiResponse>(`${API_BASE_URL}/broker/connect`, {
    method: "POST",
    body: JSON.stringify({
      client_code: credentials.clientCode,
      password: credentials.password,
      totp: credentials.totp,
    }),
  });

  if (response.connection_state === "connected") {
    setConnectedBroker(brokerId);
    const connectedView = await fetchConnectedBrokerView(brokerId);
    if (connectedView) {
      setStoredConnectedBrokerView(connectedView);
    }
  }

  return response;
}

export async function disconnectBroker(brokerId: string): Promise<BrokerApiResponse> {
  const response = await fetchWithAuth<BrokerApiResponse>(`${API_BASE_URL}/broker/disconnect`, {
    method: "POST",
  });

  if (getConnectedBroker() === brokerId) {
    clearConnectedBroker();
  }
  clearStoredConnectedBrokerView();
  return response;
}

export async function fetchConnectedBrokerView(
  brokerId: string,
): Promise<BrokerApiResponse | null> {
  if (brokerId !== "angel_one") {
    return null;
  }

  const status = await fetchWithAuth<BrokerApiResponse>(`${API_BASE_URL}/broker/status`);

  if (status.connection_state !== "connected") {
    clearConnectedBroker();
    clearStoredConnectedBrokerView();
    return null;
  }

  const profileFromStorage = getStoredConnectedBrokerView()?.data?.profile;

  let portfolioData: PortfolioResponse | null = null;
  let portfolioError: string | null = null;
  try {
    portfolioData = await fetchWithAuth<PortfolioResponse>(`${API_BASE_URL}/portfolio`);
  } catch (error) {
    portfolioError =
      error instanceof Error ? error.message : "Unable to fetch portfolio details.";
    
    if (portfolioError.includes("Broker connection expired")) {
      clearConnectedBroker();
      clearStoredConnectedBrokerView();
      return null;
    }
  }

  const holdings = (portfolioData?.holdings ?? []).map((holding) => normalizePortfolioHolding(holding));

  const portfolioSummary = buildPortfolioSummary(holdings);
  const connectedView: BrokerApiResponse = {
    ...status,
    success: status.connection_state === "connected",
    data: {
      profile: resolveProfile(profileFromStorage, status.data),
      holdings,
      portfolio_summary: portfolioSummary,
      portfolio_fetch_state: portfolioError ? "failed" : "success",
      portfolio_error: portfolioError,
      profile_error: null,
    },
  };

  setConnectedBroker(brokerId);
  setStoredConnectedBrokerView(connectedView);
  return connectedView;
}

export async function subscribeToMarketSymbols(symbols: string[]): Promise<void> {
  if (symbols.length === 0) {
    return;
  }

  await fetchWithAuth(`${API_BASE_URL}/market/subscribe`, {
    method: "POST",
    body: JSON.stringify({
      symbols,
      mode: "LTP",
    }),
  });
}

export async function unsubscribeFromMarketSymbols(symbols: string[]): Promise<void> {
  if (symbols.length === 0) {
    return;
  }

  await fetchWithAuth(`${API_BASE_URL}/market/unsubscribe`, {
    method: "POST",
    body: JSON.stringify({
      symbols,
      mode: "LTP",
    }),
  });
}

export async function getMarketSocketUrl(): Promise<string> {
  const accessToken = await ensureAccessToken();
  const url = new URL(API_BASE_URL.replace(/\/api\/v1$/, "") + "/ws/market");
  url.searchParams.set("token", accessToken);
  return url.toString();
}

export async function fetchMarketQuotes(symbols: string[]): Promise<MarketQuoteSnapshot[]> {
  if (symbols.length === 0) {
    return [];
  }

  const url = new URL(`${API_BASE_URL}/market/ltp`);
  for (const symbol of symbols) {
    url.searchParams.append("symbols", symbol);
  }

  return fetchWithAuth<MarketQuoteSnapshot[]>(url.toString());
}

async function ensureAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh) {
    const stored = getStoredAccessToken();
    if (stored) {
      return stored;
    }
  }

  const tokenPair = await authenticateDemoUser();
  storeTokenPair(tokenPair);
  return tokenPair.access_token;
}

async function authenticateDemoUser(): Promise<TokenPair> {
  if (!FRONTEND_DEMO_EMAIL || !FRONTEND_DEMO_PASSWORD) {
    throw new Error(
      "Missing VITE_BACKEND_DEMO_EMAIL or VITE_BACKEND_DEMO_PASSWORD in the frontend environment.",
    );
  }

  const registerResponse = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({
      email: FRONTEND_DEMO_EMAIL,
      password: FRONTEND_DEMO_PASSWORD,
    }),
  });

  if (registerResponse.ok) {
    return (await registerResponse.json()) as TokenPair;
  }

  if (registerResponse.status !== 409) {
    throw await buildFetchError(registerResponse);
  }

  return fetchJSON<TokenPair>(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({
      email: FRONTEND_DEMO_EMAIL,
      password: FRONTEND_DEMO_PASSWORD,
    }),
  });
}

async function fetchWithAuth<T>(url: string, init?: RequestInit): Promise<T> {
  let accessToken = await ensureAccessToken();
  let response = await fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      ...withAuthHeaders(accessToken),
    },
  });

  if (response.status === 401) {
    clearTokenPair();
    accessToken = await ensureAccessToken(true);
    response = await fetch(url, {
      ...init,
      headers: {
        ...init?.headers,
        ...withAuthHeaders(accessToken),
      },
    });
  }

  if (!response.ok) {
    throw await buildFetchError(response);
  }
  return (await response.json()) as T;
}

async function fetchJSON<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw await buildFetchError(response);
  }
  return (await response.json()) as T;
}

async function buildFetchError(response: Response): Promise<Error> {
  try {
    const payload = (await response.json()) as { detail?: string };
    return new Error(payload.detail ?? `Request failed with status ${response.status}`);
  } catch {
    return new Error(`Request failed with status ${response.status}`);
  }
}

function resolveProfile(
  storedProfile: unknown,
  statusData: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  // Prefer stored profile, fall back to profile inside statusData
  const raw =
    storedProfile && typeof storedProfile === "object" && !Array.isArray(storedProfile)
      ? (storedProfile as Record<string, unknown>)
      : statusData?.profile && typeof statusData.profile === "object" && !Array.isArray(statusData.profile)
        ? (statusData.profile as Record<string, unknown>)
        : null;

  if (raw) {
    // Normalize Angel One's field names to our standard shape
    const displayName =
      String(raw.display_name ?? raw.name ?? raw.clientname ?? raw.NAME ?? "").trim() || null;
    const clientCode =
      String(raw.client_code ?? raw.clientcode ?? raw.CLIENTCODE ?? statusData?.client_code ?? "").trim() || null;
    return {
      ...raw,
      display_name: displayName ?? "Broker User",
      client_code: clientCode ?? "-",
    };
  }

  return {
    display_name: "Broker User",
    client_code: String(statusData?.client_code ?? "-"),
  };
}

function buildErrorResponse(brokerId: string, message: string): BrokerApiResponse {
  return {
    success: false,
    provider: brokerId,
    connection_state: "error",
    reason_code: "invalid_credentials",
    message,
    reconnect_required: false,
    retry_allowed: true,
    next_action: "retry",
    request_id: `error-${brokerId}`,
    data: null,
  };
}

function buildUnsupportedBrokerResponse(brokerId: string): BrokerApiResponse {
  return {
    success: false,
    provider: brokerId,
    connection_state: "error",
    reason_code: "provider_not_supported",
    message: `${brokerId} is not wired to the backend yet. Use Angel One for live backend integration.`,
    reconnect_required: false,
    retry_allowed: false,
    next_action: "contact_support",
    request_id: `unsupported-${brokerId}`,
    data: null,
  };
}

function jsonHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
  };
}

function withAuthHeaders(accessToken: string): HeadersInit {
  return {
    ...jsonHeaders(),
    Authorization: `Bearer ${accessToken}`,
  };
}

function getConnectedBroker(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(CONNECTED_BROKER_STORAGE_KEY);
}

function setConnectedBroker(brokerId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(CONNECTED_BROKER_STORAGE_KEY, brokerId);
}

function clearConnectedBroker(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(CONNECTED_BROKER_STORAGE_KEY);
}

function storeTokenPair(tokenPair: TokenPair): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, tokenPair.access_token);
  window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, tokenPair.refresh_token);
}

function clearTokenPair(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
}

function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

function setStoredConnectedBrokerView(response: BrokerApiResponse): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(CONNECTED_BROKER_VIEW_STORAGE_KEY, JSON.stringify(response));
}

function getStoredConnectedBrokerView(): BrokerApiResponse | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(CONNECTED_BROKER_VIEW_STORAGE_KEY);
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as BrokerApiResponse;
  } catch {
    return null;
  }
}

function clearStoredConnectedBrokerView(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(CONNECTED_BROKER_VIEW_STORAGE_KEY);
}
