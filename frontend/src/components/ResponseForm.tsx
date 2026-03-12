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
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={maxLength}
        rows={6}
        placeholder={placeholder}
        disabled={loading}
        className="w-full resize-y rounded-lg border border-gray-300 bg-white p-4 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 dark:focus:border-blue-400"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {text.length}/{maxLength} characters
        </span>
        <button
          type="submit"
          disabled={text.trim().length === 0 || loading}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {loading && (
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          )}
          {loading ? "Submitting..." : buttonText}
        </button>
      </div>
    </form>
  );
}
