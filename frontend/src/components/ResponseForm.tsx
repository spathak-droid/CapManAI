"use client";

import { useState } from "react";

interface ResponseFormProps {
  onSubmit: (text: string) => void;
  loading: boolean;
  placeholder?: string;
  label?: string;
  buttonText?: string;
}

export default function ResponseForm({
  onSubmit,
  loading,
  placeholder = "Write your analysis here...",
  label = "Your Analysis",
  buttonText = "Submit Response",
}: ResponseFormProps) {
  const [text, setText] = useState("");
  const maxLength = 2000;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim().length === 0 || loading) return;
    onSubmit(text.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block text-sm font-medium text-zinc-300">
        {label}
      </label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={maxLength}
        rows={6}
        placeholder={placeholder}
        disabled={loading}
        className="w-full resize-y rounded-xl border border-white/[0.08] bg-zinc-800/50 p-4 text-white placeholder-zinc-600 transition focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/20 disabled:opacity-50"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-600">
          {text.length}/{maxLength} characters
        </span>
        <button
          type="submit"
          disabled={text.trim().length === 0 || loading}
          className="btn-purple-solid inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          )}
          {loading ? "Submitting..." : buttonText}
        </button>
      </div>
    </form>
  );
}
