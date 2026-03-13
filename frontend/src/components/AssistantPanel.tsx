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
  sendAssistantMessage,
} from "@/lib/api";
import AssistantMessageContent from "@/components/AssistantMessageContent";
import { Skeleton } from "@/components/ui/Skeleton";

const PANEL_WIDTH = 420;

export type AssistantPanelVariant = "sidebar" | "floating";

interface AssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  variant?: AssistantPanelVariant;
}

export default function AssistantPanel({ isOpen, onClose, variant = "sidebar" }: AssistantPanelProps) {
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

  const adjustInputHeight = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    adjustInputHeight();
  }, [input, adjustInputHeight]);

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

    setSending(true);
    try {
      const res = await sendAssistantMessage(currentId, messagesToSend);
      if (currentId === null) {
        setCurrentId(res.conversation_id);
        setConversations((prev) => [
          { id: res.conversation_id, title: text.slice(0, 50), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          ...prev,
        ]);
      } else {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === res.conversation_id
              ? { ...c, updated_at: new Date().toISOString() }
              : c,
          ),
        );
      }
      const now = new Date().toISOString();
      const userMsgOut: AssistantMessageOut = {
        id: 0,
        role: "user",
        content: text,
        created_at: now,
      };
      const assistantMsgOut: AssistantMessageOut = {
        id: 0,
        role: "assistant",
        content: res.message.content,
        created_at: now,
      };
      setCurrentConversation((prev) => {
        const base = prev ?? { id: res.conversation_id, title: "", created_at: "", updated_at: "", messages: [] };
        return {
          ...base,
          id: res.conversation_id,
          title: base.title || text.slice(0, 50),
          messages: [...base.messages, userMsgOut, assistantMsgOut],
        };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send message");
      setInput(text);
    } finally {
      setSending(false);
    }
  }, [input, sending, currentId, currentConversation]);

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
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        aria-hidden
        onClick={onClose}
      />
      <div
        className={`z-50 flex flex-col border border-white/[0.08] bg-zinc-900/95 shadow-2xl backdrop-blur-xl transition-transform duration-200 ease-out ${
          isFloating
            ? "fixed inset-4 mx-auto max-h-[calc(100vh-2rem)] w-full max-w-3xl rounded-2xl sm:inset-6"
            : "fixed right-0 top-0 h-full border-l"
        }`}
        style={isFloating ? undefined : { width: PANEL_WIDTH, maxWidth: "min(100vw - 3rem, 420px)" }}
        role="dialog"
        aria-label="AI Assistant"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Assistant</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setHistoryOpen((prev) => !prev)}
              className={`rounded-lg p-1.5 transition-colors ${
                historyOpen
                  ? "bg-violet-500/20 text-violet-300"
                  : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
              }`}
              aria-label={historyOpen ? "Close history" : "Open history"}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={startNewConversation}
              className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white"
              aria-label="New chat"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-500/20 hover:text-red-300"
              aria-label="Close assistant"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Conversation list (opens when history icon clicked) */}
          {historyOpen && (
            <div className="flex w-36 flex-shrink-0 flex-col border-r border-white/[0.06] bg-black/20">
            {loadingList ? (
              <ul className="mt-2 flex-1 space-y-0.5 px-2 pb-2">
                {[1, 2, 3, 4].map((i) => (
                  <li key={i} className="rounded-lg px-2 py-1.5">
                    <Skeleton className="h-4 w-full max-w-[7rem]" />
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
                {conversations.map((c) => (
                  <li key={c.id} className="group flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => loadConversation(c.id)}
                      className={`flex-1 truncate rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                        currentId === c.id
                          ? "bg-violet-500/20 text-violet-200"
                          : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
                      }`}
                      title={c.title}
                    >
                      {c.title || "New chat"}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(c.id);
                      }}
                      className="rounded p-1 text-zinc-500 opacity-0 transition-opacity hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100"
                      aria-label="Delete conversation"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4m0 0H8m4 0V4M5 7h14" />
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
              <div className="mx-2 mt-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {error}
              </div>
            )}
            {loadingThread ? (
              <div className="flex flex-1 flex-col justify-end overflow-y-auto px-4 py-3">
                <ul className="space-y-3">
                  <li className="flex justify-start">
                    <div className="max-w-[85%] rounded-xl bg-white/[0.06] px-3 py-2">
                      <Skeleton className="h-3 w-48" />
                      <Skeleton className="mt-1.5 h-3 w-40" />
                      <Skeleton className="mt-1.5 h-3 w-36" />
                    </div>
                  </li>
                  <li className="flex justify-end">
                    <div className="max-w-[85%] rounded-xl bg-violet-500/20 px-3 py-2">
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </li>
                  <li className="flex justify-start">
                    <div className="max-w-[85%] rounded-xl bg-white/[0.06] px-3 py-2">
                      <Skeleton className="h-3 w-44" />
                      <Skeleton className="mt-1.5 h-3 w-28" />
                    </div>
                  </li>
                </ul>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-4 py-3">
                  {!currentConversation?.messages?.length ? (
                    <p className="text-sm text-zinc-500">
                      Start a new conversation. Ask about trading, scenarios, or the app.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {currentConversation?.messages.map((m, i) => (
                        <li
                          key={m.id ? m.id : `msg-${i}`}
                          className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                              m.role === "user"
                                ? "bg-violet-500/20 text-violet-100"
                                : "bg-white/[0.06] text-zinc-200"
                            }`}
                          >
                            {m.role === "assistant" ? (
                              <AssistantMessageContent content={m.content} />
                            ) : (
                              m.content
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="border-t border-white/[0.06] p-3">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSend();
                    }}
                    className="flex w-full gap-2"
                  >
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
                      placeholder="Type a message…"
                      rows={1}
                      className="min-h-[44px] max-h-40 min-w-0 flex-1 resize-none overflow-y-auto rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                      disabled={sending}
                    />
                    <button
                      type="submit"
                      disabled={sending || !input.trim()}
                      className="shrink-0 rounded-lg bg-gradient-to-r from-blue-500 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-violet-500/20 transition-opacity hover:brightness-110 disabled:opacity-50"
                    >
                      {sending ? "…" : "Send"}
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
