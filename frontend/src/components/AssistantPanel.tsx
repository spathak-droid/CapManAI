"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AssistantConversationDetail,
  AssistantConversationListItem,
  AssistantMessageOut,
  AssistantMessagePayload,
} from "@/lib/types";
import {
  deleteAssistantConversation,
  getAssistantConversation,
  listAssistantConversations,
  streamAssistantMessage,
} from "@/lib/api";
import AssistantMessageContent from "@/components/AssistantMessageContent";
import { Skeleton } from "@/components/ui/Skeleton";
import { gsap } from "@/lib/gsap";

const PANEL_WIDTH = 420;

const SUGGESTION_CHIPS = [
  "Explain my last grade",
  "Trading strategy tips",
  "How do MTSS tiers work?",
];

const EDUCATOR_SUGGESTION_CHIPS = [
  "How is this student doing?",
  "What skills need improvement?",
  "Suggest interventions",
];

export type AssistantPanelVariant = "sidebar" | "floating";

interface AssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  variant?: AssistantPanelVariant;
  studentContextId?: number | null;
  studentName?: string | null;
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function relativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

/** Typing indicator with 3 bouncing dots */
function TypingIndicator() {
  const dotsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dotsRef.current) return;
    const dots = dotsRef.current.querySelectorAll(".typing-dot");
    const tl = gsap.timeline({ repeat: -1 });
    tl.to(dots, {
      y: -4,
      duration: 0.3,
      ease: "power2.out",
      stagger: 0.12,
    }).to(dots, {
      y: 0,
      duration: 0.3,
      ease: "power2.in",
      stagger: 0.12,
    });
    return () => { tl.kill(); };
  }, []);

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl rounded-bl-md border-l-2 border-transparent bg-white/[0.04] px-4 py-3"
        style={{ borderImage: "linear-gradient(to bottom, #3b82f6, #8b5cf6) 1" }}>
        <div ref={dotsRef} className="flex items-center gap-1.5 h-4">
          <div className="typing-dot h-2 w-2 rounded-full bg-violet-400/70" />
          <div className="typing-dot h-2 w-2 rounded-full bg-violet-400/60" />
          <div className="typing-dot h-2 w-2 rounded-full bg-violet-400/50" />
        </div>
      </div>
    </div>
  );
}

export default function AssistantPanel({ isOpen, onClose, variant = "sidebar", studentContextId, studentName }: AssistantPanelProps) {
  const [conversations, setConversations] = useState<
    AssistantConversationListItem[]
  >([]);
  const [currentConversation, setCurrentConversation] =
    useState<AssistantConversationDetail | null>(null);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMsgCountRef = useRef(0);

  const adjustInputHeight = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    adjustInputHeight();
  }, [input, adjustInputHeight]);

  // Panel entrance animation
  useEffect(() => {
    if (!isOpen) return;
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    if (panel) {
      gsap.from(panel, {
        scale: 0.95,
        opacity: 0,
        y: 20,
        duration: 0.3,
        ease: "back.out(1.2)",
        clearProps: "all",
      });
    }
    if (backdrop) {
      gsap.from(backdrop, {
        opacity: 0,
        duration: 0.25,
        ease: "power2.out",
      });
    }
  }, [isOpen]);

  // Animate new messages
  useEffect(() => {
    const msgCount = currentConversation?.messages?.length ?? 0;
    if (msgCount > lastMsgCountRef.current && msgCount > 0) {
      // Animate the latest messages
      const newCount = msgCount - lastMsgCountRef.current;
      const container = messagesEndRef.current?.parentElement;
      if (container) {
        const items = container.querySelectorAll(".chat-message");
        const newItems = Array.from(items).slice(-newCount);
        newItems.forEach((el) => {
          gsap.from(el, {
            opacity: 0,
            y: 10,
            duration: 0.3,
            ease: "power2.out",
          });
        });
      }
    }
    lastMsgCountRef.current = msgCount;
    // Scroll to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentConversation?.messages?.length, currentConversation?.messages]);

  const loadConversations = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const list = await listAssistantConversations();
      setConversations(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load conversations");
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen, loadConversations]);

  const loadConversation = useCallback(async (id: number) => {
    setCurrentId(id);
    setLoadingThread(true);
    setError(null);
    try {
      const conv = await getAssistantConversation(id);
      setCurrentConversation(conv);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load conversation");
    } finally {
      setLoadingThread(false);
    }
  }, []);

  const startNewConversation = useCallback(() => {
    setCurrentId(null);
    setCurrentConversation({
      id: 0,
      title: "New chat",
      created_at: "",
      updated_at: "",
      messages: [],
    });
    setError(null);
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setError(null);

    const userMessage: AssistantMessagePayload = { role: "user", content: text };
    const messagesSoFar: AssistantMessagePayload[] = currentConversation?.messages
      ? currentConversation.messages.map((m) => ({ role: m.role, content: m.content }))
      : [];
    const messagesToSend: AssistantMessagePayload[] = [...messagesSoFar, userMessage];

    // Immediately add user message so it renders (fixes missing typing indicator on first message)
    const now = new Date().toISOString();
    const userMsgOut: AssistantMessageOut = {
      id: 0,
      role: "user",
      content: text,
      created_at: now,
    };
    setCurrentConversation((prev) => {
      const base = prev ?? {
        id: 0,
        title: "New chat",
        created_at: now,
        updated_at: now,
        messages: [],
      };
      return {
        ...base,
        title: base.title || text.slice(0, 50),
        messages: [...base.messages, userMsgOut],
      };
    });

    setSending(true);

    let streamedContent = "";
    let resolvedConvId = currentId;
    let placeholderAdded = false;

    const assistantPlaceholder: AssistantMessageOut = {
      id: -1,
      role: "assistant",
      content: "",
      created_at: now,
    };

    try {
      await streamAssistantMessage(
        currentId,
        messagesToSend,
        (token: string) => {
          // Handle conversation_id from first event
          if (token.startsWith("\x00CONV_ID:")) {
            const id = parseInt(token.slice(9), 10);
            resolvedConvId = id;
            if (currentId === null) {
              setCurrentId(id);
              setConversations((prev) => [
                {
                  id,
                  title: text.slice(0, 50),
                  created_at: now,
                  updated_at: now,
                },
                ...prev,
              ]);
            }
            return;
          }

          // First real token — add placeholder and stop showing typing indicator
          if (!placeholderAdded) {
            placeholderAdded = true;
            setSending(false);
            setCurrentConversation((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                messages: [...prev.messages, { ...assistantPlaceholder, content: token }],
              };
            });
            streamedContent = token;
            return;
          }

          // Subsequent tokens — update the last message content
          streamedContent += token;
          setCurrentConversation((prev) => {
            if (!prev) return prev;
            const msgs = [...prev.messages];
            const lastIdx = msgs.length - 1;
            msgs[lastIdx] = { ...msgs[lastIdx], content: streamedContent };
            return { ...prev, messages: msgs };
          });
        },
        () => {
          // onDone
          if (resolvedConvId !== null && resolvedConvId !== currentId) {
            setConversations((prev) =>
              prev.map((c) =>
                c.id === resolvedConvId
                  ? { ...c, updated_at: new Date().toISOString() }
                  : c,
              ),
            );
          }
          setSending(false);
        },
        (err: Error) => {
          setError(err.message || "Failed to send message");
          setSending(false);
        },
        studentContextId,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send message");
      setInput(text);
      setSending(false);
    }
  }, [input, sending, currentId, currentConversation, studentContextId]);

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await deleteAssistantConversation(id);
        if (currentId === id) {
          startNewConversation();
        }
        setConversations((prev) => prev.filter((c) => c.id !== id));
      } catch {
        setError("Failed to delete conversation");
      }
    },
    [currentId, startNewConversation],
  );

  if (!isOpen) return null;

  const isFloating = variant === "floating";

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        aria-hidden
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`z-50 flex flex-col overflow-hidden border border-white/[0.08] bg-zinc-900/95 shadow-2xl shadow-violet-500/5 backdrop-blur-xl ${
          isFloating
            ? "fixed inset-4 mx-auto max-h-[calc(100vh-2rem)] w-full max-w-3xl rounded-2xl sm:inset-6"
            : "fixed right-0 top-0 h-full rounded-l-2xl border-l"
        }`}
        style={isFloating ? undefined : { width: PANEL_WIDTH, maxWidth: "min(100vw - 1rem, 420px)" }}
        role="dialog"
        aria-label="AI Assistant"
      >
        {/* Gradient accent line at top */}
        <div className="h-0.5 w-full bg-gradient-to-r from-blue-500 via-violet-500 to-fuchsia-500 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3 shrink-0">
          <div className="flex items-center gap-2.5">
            {/* AI sparkle icon */}
            <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20">
              <svg className="h-4.5 w-4.5 text-violet-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" />
              </svg>
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 blur-sm" aria-hidden />
            </div>
            <div>
              <h2 className="text-sm font-semibold bg-gradient-to-r from-blue-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                AI Assistant
              </h2>
              <p className="text-[10px] text-zinc-500 tracking-wide">
                {studentName ? `Analyzing: ${studentName}` : "Powered by AI"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setHistoryOpen((prev) => !prev)}
              className={`group relative rounded-xl p-2 transition-all ${
                historyOpen
                  ? "bg-violet-500/20 text-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.3)]"
                  : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
              }`}
              aria-label={historyOpen ? "Close history" : "Open history"}
            >
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none">
                History
              </span>
            </button>
            <button
              type="button"
              onClick={startNewConversation}
              className="group relative rounded-xl p-2 text-zinc-400 transition-all hover:bg-white/[0.06] hover:text-white"
              aria-label="New chat"
            >
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none">
                New chat
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="group relative rounded-xl p-2 text-zinc-400 transition-all hover:bg-white/[0.06] hover:text-zinc-200"
              aria-label="Close assistant"
            >
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none">
                Close
              </span>
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* History sidebar */}
          {historyOpen && (
            <div className="flex w-36 sm:w-44 flex-shrink-0 flex-col border-r border-white/[0.06] bg-black/20">
              <div className="px-3 pt-3 pb-2">
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Conversations</h3>
              </div>
              {loadingList ? (
                <ul className="flex-1 space-y-1 px-2 pb-2">
                  {[1, 2, 3, 4].map((i) => (
                    <li key={i} className="rounded-xl px-3 py-2.5">
                      <Skeleton className="h-3 w-full max-w-[7rem]" />
                      <Skeleton className="mt-1.5 h-2 w-12" />
                    </li>
                  ))}
                </ul>
              ) : conversations.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center px-3 pb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-800/80 mb-2">
                    <svg className="h-5 w-5 text-zinc-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                    </svg>
                  </div>
                  <p className="text-xs text-zinc-500 text-center">No conversations yet</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5 text-center">Start chatting to see history</p>
                </div>
              ) : (
                <ul className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
                  {conversations.map((c) => (
                    <li key={c.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => loadConversation(c.id)}
                        className={`w-full text-left rounded-xl px-3 py-2.5 transition-all ${
                          currentId === c.id
                            ? "bg-violet-500/15 border-l-2 border-violet-500 text-violet-200"
                            : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200 border-l-2 border-transparent"
                        }`}
                        title={c.title}
                      >
                        <p className="truncate text-xs font-medium">{c.title || "New chat"}</p>
                        <p className="text-[10px] text-zinc-600 mt-0.5">{relativeTime(c.updated_at || c.created_at)}</p>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(c.id);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-zinc-600 opacity-0 transition-all hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100"
                        aria-label="Delete conversation"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Chat area */}
          <div className="flex min-w-0 flex-1 flex-col">
            {error && (
              <div className="mx-3 mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400 flex items-center gap-2 shrink-0">
                <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                {error}
              </div>
            )}

            {loadingThread ? (
              /* Loading skeletons with chat bubble shapes */
              <div className="flex flex-1 flex-col justify-end overflow-y-auto px-4 py-4">
                <ul className="space-y-4">
                  <li className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl rounded-bl-md border-l-2 border-violet-500/30 bg-white/[0.04] px-4 py-3">
                      <Skeleton className="h-3 w-48 rounded-full" />
                      <Skeleton className="mt-2 h-3 w-40 rounded-full" />
                      <Skeleton className="mt-2 h-3 w-36 rounded-full" />
                    </div>
                  </li>
                  <li className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-violet-600/20 px-4 py-3">
                      <Skeleton className="h-3 w-32 rounded-full" />
                    </div>
                  </li>
                  <li className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl rounded-bl-md border-l-2 border-violet-500/30 bg-white/[0.04] px-4 py-3">
                      <Skeleton className="h-3 w-44 rounded-full" />
                      <Skeleton className="mt-2 h-3 w-28 rounded-full" />
                    </div>
                  </li>
                </ul>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  {!currentConversation?.messages?.length ? (
                    /* Empty state */
                    <div className="flex flex-col items-center justify-center h-full py-8">
                      {/* Gradient circle with sparkle */}
                      <div className="relative mb-5">
                        <div className="absolute inset-0 scale-150 rounded-full bg-gradient-to-br from-violet-500/20 via-fuchsia-500/10 to-transparent blur-2xl" aria-hidden />
                        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/25 to-fuchsia-500/25 ring-1 ring-white/[0.08]">
                          <svg className="h-8 w-8 text-violet-300" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" />
                          </svg>
                        </div>
                      </div>
                      <h3 className="text-lg font-bold text-white mb-1">How can I help?</h3>
                      <p className="text-xs text-zinc-500 mb-5">Ask me anything about trading and learning</p>
                      {/* Suggestion chips */}
                      <div className="flex flex-wrap justify-center gap-2 max-w-xs">
                        {(studentContextId ? EDUCATOR_SUGGESTION_CHIPS : SUGGESTION_CHIPS).map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => setInput(chip)}
                            className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-xs text-zinc-400 transition-all hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-300 hover:shadow-[0_0_12px_rgba(139,92,246,0.1)]"
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {currentConversation.messages.map((m, i) => (
                        <li
                          key={m.id && m.id > 0 ? m.id : `msg-${i}`}
                          className={`chat-message group flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          {m.role === "user" ? (
                            /* User message bubble */
                            <div className="relative max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-violet-600/30 to-fuchsia-600/20 px-4 py-2.5 text-sm text-violet-100 shadow-lg shadow-violet-500/5">
                              {m.content}
                              {/* Timestamp on hover */}
                              {m.created_at && (
                                <span className="absolute -bottom-5 right-1 text-[10px] text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100">
                                  {formatTime(m.created_at)}
                                </span>
                              )}
                            </div>
                          ) : (
                            /* Assistant message bubble */
                            <div className="relative max-w-[85%] rounded-2xl rounded-bl-md bg-white/[0.04] px-4 py-2.5 text-sm text-zinc-200"
                              style={{
                                borderLeft: "2px solid transparent",
                                borderImage: "linear-gradient(to bottom, #3b82f6, #8b5cf6) 1",
                              }}>
                              <AssistantMessageContent content={m.content} />
                              {/* Timestamp on hover */}
                              {m.created_at && (
                                <span className="absolute -bottom-5 left-1 text-[10px] text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100">
                                  {formatTime(m.created_at)}
                                </span>
                              )}
                            </div>
                          )}
                        </li>
                      ))}
                      {/* Typing indicator while sending */}
                      {sending && (
                        <li className="chat-message">
                          <TypingIndicator />
                        </li>
                      )}
                    </ul>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                <div className="border-t border-white/[0.06] p-3 shrink-0">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSend();
                    }}
                    className="relative flex w-full gap-2"
                  >
                    <div className="relative min-w-0 flex-1 group/input">
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                        placeholder="Ask me anything about trading..."
                        rows={1}
                        className="min-h-[44px] max-h-40 w-full resize-none overflow-y-auto rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder-zinc-500 transition-all focus:border-violet-500/40 focus:bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-violet-500/30 focus:shadow-[inset_0_0_12px_rgba(139,92,246,0.06)]"
                        disabled={sending}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={sending || !input.trim()}
                      className="shrink-0 flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 via-violet-500 to-fuchsia-500 p-2.5 text-white shadow-lg shadow-violet-500/20 transition-all hover:shadow-violet-500/30 hover:brightness-110 disabled:opacity-40 disabled:shadow-none disabled:hover:brightness-100"
                    >
                      {/* Paper plane / arrow icon */}
                      <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                      </svg>
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
