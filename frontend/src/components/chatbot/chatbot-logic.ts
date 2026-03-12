export interface DashboardChatbotHolding {
  symbol: string;
  quantity: number;
  pnl: number;
}

export type ChatRole = "assistant" | "user";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

export interface ChatReplyContext {
  accountName: string;
  holdings: DashboardChatbotHolding[];
  totalValue: number;
  investedValue: number;
  totalPnl: number;
  pnlPercentage: number;
  connectionLabel: string;
}

export interface QuickAction {
  prompt: string;
  title: string;
  subtitle: string;
  tone: "pink" | "lime" | "teal";
}

export function buildWelcomeMessage(context: ChatReplyContext): ChatMessage {
  const count = context.holdings.length;
  const strongest = getStrongestHolding(context.holdings);
  const weakest = getWeakestHolding(context.holdings);
  const topMentions = context.holdings
    .slice(0, 3)
    .map((holding) => `${holding.symbol} (${formatSignedCurrency(holding.pnl)})`)
    .join(", ");
  const recap = count
    ? `I can already see ${count} active holdings worth about ${formatCurrency(context.totalValue)}.`
    : "Your portfolio is still light, so I can focus on market ideas and setup questions.";
  const strongestNote = strongest
    ? ` ${strongest.symbol} is your strongest visible name right now at ${formatSignedCurrency(strongest.pnl)}.`
    : "";
  const weakestNote =
    weakest && weakest.symbol !== strongest?.symbol
      ? ` ${weakest.symbol} looks like the weakest visible spot at ${formatSignedCurrency(weakest.pnl)}.`
      : "";
  const returnNote =
    count && context.investedValue > 0
      ? ` Visible return is ${formatSignedCurrency(context.totalPnl)} (${formatSignedPercent(context.pnlPercentage)}).`
      : "";
  const connectionNote = context.connectionLabel
    ? ` Connection status on this page is ${context.connectionLabel}.`
    : "";
  const focusNote = topMentions ? ` Names standing out most right now: ${topMentions}.` : "";

  return {
    id: "welcome",
    role: "assistant",
    content:
      `${recap}${returnNote}${strongestNote}${weakestNote}${focusNote}${connectionNote}\n\n` +
      "Ask for a portfolio summary, a weak-link check, or what to watch next.",
  };
}

export function buildAssistantLandingMessage(context: ChatReplyContext): ChatMessage {
  const strongest = getStrongestHolding(context.holdings);
  const weakest = getWeakestHolding(context.holdings);
  const focusSymbol = strongest?.symbol ?? context.holdings[0]?.symbol ?? "your next setup";
  const holdingCount = context.holdings.length;

  const lines = [
    "1. Portfolio Snapshot",
    holdingCount
      ? `- You are currently tracking ${holdingCount} active holdings worth about ${formatCurrency(context.totalValue)}.`
      : "- You do not have active holdings yet, so I can focus on market research and setup planning.",
    `- Visible total return is ${formatSignedCurrency(context.totalPnl)}.`,
    strongest
      ? `- ${strongest.symbol} is leading the book right now at ${formatSignedCurrency(strongest.pnl)}.`
      : "- No clear leader is visible yet.",
    "",
    "2. Best Things To Ask Here",
    "- Summarize my portfolio and show what matters first.",
    `- What should I watch in ${focusSymbol}?`,
    weakest
      ? `- Why is ${weakest.symbol} lagging and how risky is that position?`
      : "- Where is my biggest portfolio risk right now?",
    "",
    "3. What I Can Do In This Tab",
    "- Turn holdings into a clear market watchlist.",
    "- Compare winners versus weak links.",
    "- Help frame the next question before you rebalance.",
    "",
    "If you want, I can also convert this view into a tighter watchlist brief or a risk-first recap.",
  ];

  return {
    id: "assistant-landing",
    role: "assistant",
    content: lines.join("\n"),
  };
}

export function buildQuickActions(
  holdings: DashboardChatbotHolding[],
  totalPnl: number,
): QuickAction[] {
  const topSymbols = holdings.slice(0, 2).map((holding) => holding.symbol);
  const weakest = getWeakestHolding(holdings);
  const actions: QuickAction[] = [
    {
      prompt: "Summarize my portfolio",
      title: "Portfolio pulse",
      subtitle: `Quick read on ${holdings.length || "current"} active names`,
      tone: "pink",
    },
    {
      prompt: topSymbols[0] ? `What should I watch in ${topSymbols[0]}?` : "What should I watch next?",
      title: topSymbols[0] ?? "Watch next",
      subtitle: "Check momentum, risk, and next trigger",
      tone: "teal",
    },
    {
      prompt: weakest ? `Why is ${weakest.symbol} lagging?` : "Where is my biggest risk?",
      title: weakest ? "Weak link" : "Risk scan",
      subtitle: weakest ? `${weakest.symbol} needs attention` : "Find the soft spot fast",
      tone: "lime",
    },
    {
      prompt: totalPnl >= 0 ? "Which winner should I protect?" : "How should I manage this drawdown?",
      title: totalPnl >= 0 ? "Protect gains" : "Damage control",
      subtitle: totalPnl >= 0 ? "Tighten the strongest idea" : "Trim pressure before it grows",
      tone: "pink",
    },
  ];

  return actions.filter(
    (action, index, current) =>
      current.findIndex((item) => item.prompt === action.prompt) === index,
  );
}

export function buildReplyMessage(prompt: string, context: ChatReplyContext): ChatMessage {
  const normalizedPrompt = prompt.toLowerCase();
  const matchedHolding = context.holdings.find((holding) =>
    normalizedPrompt.includes(holding.symbol.toLowerCase()),
  );
  const strongest = getStrongestHolding(context.holdings);
  const weakest = getWeakestHolding(context.holdings);
  const positivePnl = context.totalPnl >= 0;

  let content: string;

  if (matchedHolding) {
    content = `${matchedHolding.symbol} is one of your tracked holdings with ${matchedHolding.quantity} shares. Current visible P&L is ${formatSignedCurrency(matchedHolding.pnl)}. I would watch whether momentum keeps confirming above your average cost and whether volume expands on the next push.`;
  } else if (
    normalizedPrompt.includes("summary") ||
    normalizedPrompt.includes("portfolio") ||
    normalizedPrompt.includes("account")
  ) {
    const topMentions = context.holdings
      .slice(0, 3)
      .map((holding) => `${holding.symbol} (${formatSignedCurrency(holding.pnl)})`)
      .join(", ");
    content = `You currently have ${context.holdings.length} active holdings with a live value near ${formatCurrency(context.totalValue)} and total visible returns of ${formatSignedCurrency(context.totalPnl)}. ${topMentions ? `The names standing out most are ${topMentions}.` : "Once positions appear, I can break down concentration and momentum."}`;
  } else if (
    normalizedPrompt.includes("risk") ||
    normalizedPrompt.includes("weak") ||
    normalizedPrompt.includes("lag") ||
    normalizedPrompt.includes("loss")
  ) {
    content = weakest
      ? `${weakest.symbol} looks like the weakest visible spot at ${formatSignedCurrency(weakest.pnl)}. If you are reviewing risk, compare it against your thesis, recent support levels, and whether the weakness is isolated or part of a sector-wide fade.`
      : "I am not seeing a clear weak link yet, so I would check fresh market leadership and wait for cleaner portfolio signals.";
  } else if (
    normalizedPrompt.includes("best") ||
    normalizedPrompt.includes("upside") ||
    normalizedPrompt.includes("winner") ||
    normalizedPrompt.includes("strong")
  ) {
    content = strongest
      ? `${strongest.symbol} is your strongest visible name with ${formatSignedCurrency(strongest.pnl)}. If the goal is to press strength, I would watch for continued follow-through instead of a one-day spike before adding conviction.`
      : "There is not enough portfolio context yet to call a clear winner, but I can still help compare market setups if you name a stock.";
  } else {
    content = `I am ready to help with portfolio recap, stock-specific questions, and what to watch next. Right now your visible book is ${positivePnl ? "leaning positive" : "under pressure"} at ${formatSignedCurrency(context.totalPnl)}. Try asking about ${strongest?.symbol ?? weakest?.symbol ?? "your top holding"} for a sharper answer.`;
  }

  return {
    id: `assistant-${Date.now()}`,
    role: "assistant",
    content,
  };
}

export function getStrongestHolding(holdings: DashboardChatbotHolding[]) {
  return [...holdings].sort((left, right) => right.pnl - left.pnl)[0];
}

export function getWeakestHolding(holdings: DashboardChatbotHolding[]) {
  return [...holdings].sort((left, right) => left.pnl - right.pnl)[0];
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatSignedCurrency(value: number) {
  return `${value >= 0 ? "+" : ""}${formatCurrency(value)}`;
}

export function formatSignedCompactCurrency(value: number) {
  return `${value >= 0 ? "+" : ""}${formatCompactCurrency(value)}`;
}

export function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}
