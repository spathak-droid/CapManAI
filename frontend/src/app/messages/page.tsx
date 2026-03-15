"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentInbox, useStudentThread, useUnreadCount, useEducatorsForStudent } from "@/lib/hooks";
import { sendStudentReply, markMessageRead } from "@/lib/api";
import { useRealtimeEvent } from "@/lib/useRealtimeEvent";

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

type EducatorEntry = { id: number; username: string; name: string | null };

function EducatorPicker({
  educators,
  existingThreadUserIds,
  onSelect,
  onClose,
}: {
  educators: EducatorEntry[];
  existingThreadUserIds: Set<number>;
  onSelect: (e: EducatorEntry) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const filtered = educators.filter(
    (e) =>
      (e.username.toLowerCase().includes(search.toLowerCase()) ||
        (e.name ?? "").toLowerCase().includes(search.toLowerCase())) &&
      !existingThreadUserIds.has(e.id),
  );

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full z-20 mt-2 w-72 rounded-xl border border-white/[0.08] bg-zinc-900 shadow-2xl shadow-black/50"
    >
      <div className="p-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search educators..."
          autoFocus
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
        />
      </div>
      <div className="max-h-64 overflow-y-auto p-1">
        {filtered.length === 0 && (
          <p className="px-3 py-4 text-center text-sm text-zinc-500">No educators found</p>
        )}
        {filtered.map((e) => (
          <button
            key={e.id}
            onClick={() => onSelect(e)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/[0.06]"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-xs font-bold text-white">
              {getInitials(e.name || e.username)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {e.name || e.username}
              </p>
              {e.name && (
                <p className="text-xs text-zinc-500 truncate">@{e.username}</p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function StudentMessagesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [selectedEducatorId, setSelectedEducatorId] = useState<number | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: threads, mutate: mutateThreads } = useStudentInbox();
  const { data: messages, mutate: mutateMessages } = useStudentThread(selectedEducatorId);
  const { data: educators } = useEducatorsForStudent();
  const { mutate: mutateUnread } = useUnreadCount();

  // Real-time: auto-refresh when new messages arrive
  useRealtimeEvent("new_message", () => {
    mutateThreads();
    mutateMessages();
    mutateUnread();
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark unread messages as read
  useEffect(() => {
    if (!messages || !user) return;
    const unread = messages.filter((m) => !m.is_read && m.sender_id !== user.id);
    unread.forEach((m) => {
      markMessageRead(m.id).catch(() => {});
    });
  }, [messages, user]);

  const handleSelectThread = useCallback((userId: number) => {
    setSelectedEducatorId(userId);
    setShowPicker(false);
  }, []);

  const handleNewConversation = useCallback((educator: EducatorEntry) => {
    setSelectedEducatorId(educator.id);
    setShowPicker(false);
  }, []);

  const handleSend = async () => {
    if (!messageText.trim() || !selectedEducatorId || sending) return;
    setSending(true);
    try {
      await sendStudentReply(selectedEducatorId, messageText.trim());
      setMessageText("");
      await mutateMessages();
      await mutateThreads();
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!authLoading && user?.role !== "student") {
    router.replace("/");
    return null;
  }

  const existingThreadUserIds = new Set(threads?.map((t) => t.user_id) ?? []);
  const selectedThread = threads?.find((t) => t.user_id === selectedEducatorId);
  const selectedEducator = educators?.find((e) => e.id === selectedEducatorId);
  const selectedName =
    selectedThread?.name || selectedThread?.username || selectedEducator?.name || selectedEducator?.username || "";

  return (
    <div className="mx-auto flex h-[calc(100vh-60px)] max-w-7xl animate-slide-up">
      {/* Left sidebar - Thread list */}
      <div className="flex w-full flex-col border-r border-white/[0.06] md:w-80 lg:w-96">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-4">
          <h1 className="text-lg font-semibold text-white">Messages</h1>
          <div className="relative">
            <button
              onClick={() => setShowPicker(!showPicker)}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-violet-500"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New
            </button>
            {showPicker && educators && (
              <EducatorPicker
                educators={educators}
                existingThreadUserIds={existingThreadUserIds}
                onSelect={handleNewConversation}
                onClose={() => setShowPicker(false)}
              />
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {!threads && (
            <div className="flex items-center justify-center py-12">
              <div className="text-sm text-zinc-500">Loading...</div>
            </div>
          )}
          {threads && threads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg className="mb-3 h-10 w-10 text-zinc-600" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
              <p className="text-sm text-zinc-500">No messages yet</p>
              <p className="mt-1 text-xs text-zinc-600">Start a conversation with your educator</p>
            </div>
          )}
          {threads?.map((t) => (
            <button
              key={t.user_id}
              onClick={() => handleSelectThread(t.user_id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all ${
                t.user_id === selectedEducatorId
                  ? "border-l-2 border-violet-500 bg-white/[0.06]"
                  : "hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-sm font-bold text-white">
                {getInitials(t.name || t.username)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-white truncate">
                    {t.name || t.username}
                  </p>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {formatTime(t.last_message_at)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-zinc-400 truncate">
                  {t.last_message}
                </p>
              </div>
              {t.unread_count > 0 && (
                <span className="flex min-w-5 items-center justify-center rounded-full bg-violet-500 px-1.5 h-5 text-xs font-semibold text-white">
                  {t.unread_count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Right panel - Chat */}
      <div className="hidden flex-1 flex-col md:flex">
        {selectedEducatorId ? (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-6 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-sm font-bold text-white">
                {selectedName ? getInitials(selectedName) : "?"}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{selectedName}</p>
                <p className="text-xs text-zinc-500">Educator</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {messages && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-zinc-500">No messages yet — say hello!</p>
                </div>
              )}
              {messages?.map((msg) => {
                const isMe = msg.sender_id === user?.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                        isMe
                          ? "bg-violet-600 text-white"
                          : "bg-zinc-800 text-zinc-200"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <p
                        className={`mt-1 text-xs ${
                          isMe ? "text-violet-200/60" : "text-zinc-500"
                        }`}
                      >
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-white/[0.06] px-6 py-4">
              <div className="flex items-end gap-3">
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  rows={1}
                  className="flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
                />
                <button
                  onClick={handleSend}
                  disabled={!messageText.trim() || sending}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white transition-colors hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <svg className="mb-4 h-16 w-16 text-zinc-700" fill="none" viewBox="0 0 24 24" strokeWidth={0.75} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            <p className="text-lg font-medium text-zinc-400">Select a conversation</p>
            <p className="mt-1 text-sm text-zinc-600">or start a new one</p>
          </div>
        )}
      </div>
    </div>
  );
}
