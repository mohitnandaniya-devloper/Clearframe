import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  AudioLines,
  Globe,
  Plus,
  RotateCcw,
  SendHorizontal,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";

import {
  buildReplyMessage,
  buildQuickActions,
  formatCurrency,
  formatSignedCurrency,
  formatSignedPercent,
  getStrongestHolding,
  getWeakestHolding,
  type ChatMessage,
  type DashboardChatbotHolding,
} from "@/components/chatbot/chatbot-logic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";

interface AssistantTabProps {
  accountName: string;
  holdings: DashboardChatbotHolding[];
  totalValue: number;
  investedValue: number;
  totalPnl: number;
  pnlPercentage: number;
  connectionLabel: string;
}

export function AssistantTab({
  accountName,
  holdings,
  totalValue,
  investedValue,
  totalPnl,
  pnlPercentage,
  connectionLabel,
}: AssistantTabProps) {
  const [draft, setDraft] = useState("");
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [isResponding, setIsResponding] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [feedbackByKey, setFeedbackByKey] = useState<Record<string, "like" | "dislike" | undefined>>({});
  const replyTimeoutRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const context = useMemo(
    () => ({
      accountName,
      holdings,
      totalValue,
      investedValue,
      totalPnl,
      pnlPercentage,
      connectionLabel,
    }),
    [accountName, connectionLabel, holdings, investedValue, pnlPercentage, totalPnl, totalValue],
  );
  const analysisSections = useMemo(() => buildAnalysisSections(context), [context]);
  const quickActions = useMemo(() => buildQuickActions(holdings, totalPnl), [holdings, totalPnl]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [conversation, isResponding]);

  useEffect(() => {
    if (!statusMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setStatusMessage(null);
    }, 2500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [statusMessage]);

  useEffect(() => {
    return () => {
      if (replyTimeoutRef.current !== null) {
        window.clearTimeout(replyTimeoutRef.current);
      }
    };
  }, []);

  const setFeedback = (key: string, value: "like" | "dislike") => {
    setFeedbackByKey((current) => ({
      ...current,
      [key]: current[key] === value ? undefined : value,
    }));
    setStatusMessage(value === "like" ? "Marked as helpful." : "Marked for improvement.");
  };

  const handleVoiceInput = () => {
    type SpeechRecognitionInstance = {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      start: () => void;
      onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
      onerror: (() => void) | null;
    };

    const speechWindow = window as Window & {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setStatusMessage("Voice input is not supported in this browser.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) {
        setDraft((current) => `${current}${current ? " " : ""}${transcript}`);
        setStatusMessage("Voice input added.");
      }
    };
    recognition.onerror = () => {
      setStatusMessage("Voice input could not be captured.");
    };
    recognition.start();
  };

  const submitPrompt = (rawPrompt: string) => {
    const prompt = rawPrompt.trim();
    if (!prompt || isResponding) {
      return;
    }

    if (replyTimeoutRef.current !== null) {
      window.clearTimeout(replyTimeoutRef.current);
      replyTimeoutRef.current = null;
    }

    setDraft("");
    setIsResponding(true);

    const userMessage: ChatMessage = {
      id: `assistant-user-${Date.now()}`,
      role: "user",
      content: prompt,
    };

    startTransition(() => {
      setConversation((current) => [...current, userMessage]);
    });

    replyTimeoutRef.current = window.setTimeout(() => {
      const assistantMessage = buildReplyMessage(prompt, context);
      startTransition(() => {
        setConversation((current) => [...current, assistantMessage]);
      });
      setIsResponding(false);
      replyTimeoutRef.current = null;
    }, 650);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitPrompt(draft);
  };

  const insertPrompt = (prompt: string) => {
    setDraft(prompt);
    setStatusMessage("Prompt inserted.");
  };

  const handleSearch = () => {
    const nextPrompt =
      draft.trim() || quickActions[0]?.prompt || "Summarize my portfolio and show what matters first.";
    submitPrompt(nextPrompt);
  };

  const regenerateReply = (prompt: string, messageId?: string) => {
    const refreshed = buildReplyMessage(prompt, context);

    if (messageId) {
      setConversation((current) =>
        current.map((message) =>
          message.id === messageId ? { ...refreshed, id: message.id } : message,
        ),
      );
      setStatusMessage("Reply regenerated.");
      return;
    }

    startTransition(() => {
      setConversation((current) => [...current, refreshed]);
    });
    setStatusMessage("Fresh analysis added.");
  };

  return (
    <section className="flex h-full min-h-full flex-col overflow-hidden bg-[#0B201F]">
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto bg-[#0B201F] px-4 pb-8 pt-6 sm:px-6 lg:px-8"
      >
        <div className="mx-auto w-full max-w-4xl">
          {statusMessage ? (
            <div className="mb-4">
              <Badge className="border-[#416133] bg-[#102825] px-2.5 py-1 text-sm text-[#C4E456]">
                {statusMessage}
              </Badge>
            </div>
          ) : null}

          <div className="text-[15px] leading-8 text-[#FFFFFFB3] sm:text-base">
            {analysisSections.map((section) => (
              <div key={section.title} className="mb-6">
                <p className="text-base font-medium text-[#F6F9F2] sm:text-lg">{section.title}</p>
                <ul className="mt-2 space-y-1.5 pl-6 text-[#FFFFFFB3]">
                  {section.points.map((point) => (
                    <li key={point} className="list-disc">
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <AssistantResponseFooter
              feedback={feedbackByKey.overview}
              onLike={() => setFeedback("overview", "like")}
              onDislike={() => setFeedback("overview", "dislike")}
              onRegenerate={() => regenerateReply("Summarize my portfolio and show what matters first.")}
            />
          </div>

          {conversation.length > 0 ? (
            <div className="mt-10 space-y-6">
              {conversation.map((message, index) => (
                <ConversationRow
                  key={message.id}
                  message={message}
                  feedback={feedbackByKey[message.id]}
                  previousUserPrompt={findPreviousUserPrompt(conversation, index)}
                  onLike={() => setFeedback(message.id, "like")}
                  onDislike={() => setFeedback(message.id, "dislike")}
                  onRegenerate={(prompt) => regenerateReply(prompt, message.id)}
                />
              ))}
              {isResponding ? (
                <div className="text-[15px] text-[#FFFFFF80] sm:text-base">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8CFCBA]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8CFCBA] [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8CFCBA] [animation-delay:240ms]" />
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="bg-[#0B201F] px-4 py-4 sm:px-6">
        <div className="mx-auto w-full max-w-4xl">
          <Card className="gap-0 rounded-2xl border border-[#2B4E44] bg-[#102825] px-3.5 py-3 text-[#F6F9F2] shadow-[0_8px_18px_rgba(0,0,0,0.18)]">
            <form onSubmit={handleSubmit}>
              <div className="min-h-11">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Search the web"
                  rows={1}
                  className="w-full resize-none border-0 bg-transparent px-1 py-1 text-base text-[#F6F9F2] placeholder:text-[#FFFFFF80] outline-none sm:text-lg"
                />
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-full text-[#FFFFFFB3] hover:bg-[#FFFFFF]/5 hover:text-white"
                        aria-label="Add"
                      >
                        <Plus className="h-[18px] w-[18px]" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-64 border border-[#2B4E44] bg-[#102825] text-[#F6F9F2]"
                    >
                      <DropdownMenuLabel className="text-[#FFFFFF80]">Starter prompts</DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-[#2B4E44]" />
                      {quickActions.map((action) => (
                        <DropdownMenuItem
                          key={action.prompt}
                          onSelect={() => insertPrompt(action.prompt)}
                          className="flex-col items-start gap-0.5 py-2 focus:bg-[#0B201F] focus:text-[#F6F9F2]"
                        >
                          <span className="text-sm font-medium text-[#F6F9F2]">{action.title}</span>
                          <span className="text-sm text-[#FFFFFF80]">{action.subtitle}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSearch}
                    className="h-9 rounded-full px-3 py-1 text-[15px] text-[#FFFFFFB3] hover:bg-[#FFFFFF]/5 hover:text-white sm:text-base"
                  >
                    <Globe className="h-4 w-4" />
                    <span>Search</span>
                  </Button>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleVoiceInput}
                    className="h-10 w-10 rounded-full border border-[#2B4E44] bg-[#102825] text-[#FFFFFFB3] hover:bg-[#FFFFFF]/5 hover:text-white"
                    aria-label="Voice"
                  >
                    <AudioLines className="h-5 w-5" />
                  </Button>
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!draft.trim() || isResponding}
                    className="h-10 w-10 rounded-full border border-[#416133] bg-[#C4E456] text-[#0B201F] hover:bg-[#D5EE79]"
                  >
                    <SendHorizontal className="h-[18px] w-[18px]" />
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </section>
  );
}

function ConversationRow({
  message,
  previousUserPrompt,
  feedback,
  onLike,
  onDislike,
  onRegenerate,
}: {
  message: ChatMessage;
  previousUserPrompt?: string;
  feedback?: "like" | "dislike";
  onLike: () => void;
  onDislike: () => void;
  onRegenerate: (prompt: string) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl border border-[#2B4E44] bg-[#102825] px-4 py-3 text-[15px] leading-8 text-[#F6F9F2] sm:text-base">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="text-[15px] leading-8 text-[#F6F9F2] sm:text-base">
      <div className="whitespace-pre-line">{message.content}</div>
      <AssistantResponseFooter
        feedback={feedback}
        onLike={onLike}
        onDislike={onDislike}
        onRegenerate={previousUserPrompt ? () => onRegenerate(previousUserPrompt) : undefined}
      />
    </div>
  );
}

function AssistantResponseFooter({
  feedback,
  onLike,
  onDislike,
  onRegenerate,
}: {
  feedback?: "like" | "dislike";
  onLike: () => void;
  onDislike: () => void;
  onRegenerate?: () => void;
}) {
  return (
    <>
      <Separator className="mt-8 bg-[#2B4E44]" />

      <div className="mt-6 flex items-start gap-2 text-[15px] leading-8 text-[#C4E456] sm:text-base">
        <span className="mt-[7px] h-2.5 w-2.5 shrink-0 rounded-full bg-[#8CFCBA]" />
        <p>
          If you want, I can also turn this into a tighter portfolio action plan based on your
          connected book and current market context.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 text-[#FFFFFF80]">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onLike}
          className={footerActionClassName(feedback === "like")}
        >
          <ThumbsUp className="h-4 w-4" />
          <span className="hidden sm:inline">Like</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDislike}
          className={footerActionClassName(feedback === "dislike")}
        >
          <ThumbsDown className="h-4 w-4" />
          <span className="hidden sm:inline">Dislike</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!onRegenerate}
          onClick={onRegenerate}
          className="rounded-full px-2.5 py-1.5 text-sm text-[#FFFFFF80] hover:bg-[#FFFFFF]/5 hover:text-white"
        >
          <RotateCcw className="h-4 w-4" />
          <span className="hidden sm:inline">Regenerate</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full px-2.5 py-1.5 text-sm text-[#FFFFFF80] hover:bg-[#FFFFFF]/5 hover:text-white"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#8CFCBA]" />
              <span>Sources</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-64 border border-[#2B4E44] bg-[#102825] text-[#F6F9F2]"
          >
            <DropdownMenuLabel className="text-[#FFFFFF80]">Grounding sources</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[#2B4E44]" />
            <DropdownMenuItem className="focus:bg-[#0B201F] focus:text-[#F6F9F2]">
              Connected broker portfolio snapshot
            </DropdownMenuItem>
            <DropdownMenuItem className="focus:bg-[#0B201F] focus:text-[#F6F9F2]">
              Live market stream when the broker session is active
            </DropdownMenuItem>
            <DropdownMenuItem className="focus:bg-[#0B201F] focus:text-[#F6F9F2]">
              Historical market candles when available
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}

function footerActionClassName(isActive: boolean) {
  return isActive
    ? "rounded-full border border-[#416133] bg-[#C4E456]/10 px-2.5 py-1.5 text-sm text-[#C4E456] hover:bg-[#C4E456]/15 hover:text-[#C4E456]"
    : "rounded-full px-2.5 py-1.5 text-sm text-[#FFFFFF80] hover:bg-[#FFFFFF]/5 hover:text-white";
}

function findPreviousUserPrompt(conversation: ChatMessage[], index: number) {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (conversation[cursor]?.role === "user") {
      return conversation[cursor]?.content;
    }
  }

  return undefined;
}

function buildAnalysisSections(context: AssistantTabProps) {
  const strongest = getStrongestHolding(context.holdings);
  const weakest = getWeakestHolding(context.holdings);

  return [
    {
      title: "1. Portfolio Snapshot",
      points: [
        context.holdings.length
          ? `Visible book is tracking ${context.holdings.length} active holdings worth about ${formatCurrency(context.totalValue)}.`
          : "No active holdings are visible yet in this connected account.",
        `Visible total return is ${formatSignedCurrency(context.totalPnl)} (${formatSignedPercent(context.pnlPercentage)}).`,
        context.connectionLabel
          ? `Connection state on this page is ${context.connectionLabel}.`
          : "Connection state is available from the connected broker session.",
      ],
    },
    {
      title: "2. Strongest / Weakest Positions",
      points: [
        strongest
          ? `${strongest.symbol} is currently the strongest visible position at ${formatSignedCurrency(strongest.pnl)}.`
          : "No clear outperformer is visible yet.",
        weakest && weakest.symbol !== strongest?.symbol
          ? `${weakest.symbol} is the weakest visible position at ${formatSignedCurrency(weakest.pnl)}.`
          : "No separate weak-link position is standing out yet.",
      ],
    },
    {
      title: "3. Best Next Questions",
      points: [
        "Summarize my portfolio and show what matters first.",
        `What should I watch in ${strongest?.symbol ?? context.holdings[0]?.symbol ?? "my next setup"}?`,
        weakest
          ? `Why is ${weakest.symbol} lagging and how risky is that position?`
          : "Where is my biggest portfolio risk right now?",
      ],
    },
  ];
}
