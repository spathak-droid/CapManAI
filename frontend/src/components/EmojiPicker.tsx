"use client";

import { useState, useRef, useEffect } from "react";

const EMOJI_CATEGORIES = [
  {
    name: "Smileys",
    emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "😊", "😇", "🥰", "😍", "🤩", "😘", "😋", "😛", "😜", "🤪", "😎", "🤗", "🤔", "🫡", "🤐", "😏", "😒", "🙄", "😬", "😮‍💨", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤢", "🤮", "🥴", "😵", "🤯", "🥳", "🥸", "😱", "😨", "😰", "😢", "😭", "😤", "🤬", "👿", "💀", "☠️", "💩", "🤡", "👹", "👻", "👽", "🤖"],
  },
  {
    name: "Gestures",
    emojis: ["👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "🫵", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "🫶", "👐", "🤲", "🤝", "🙏", "💪", "🦾"],
  },
  {
    name: "Hearts",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "♥️", "🫀"],
  },
  {
    name: "Objects",
    emojis: ["🔥", "⭐", "🌟", "✨", "💫", "🎉", "🎊", "🏆", "🥇", "🥈", "🥉", "🎯", "💡", "📈", "📉", "💰", "💵", "💎", "🚀", "⚡", "💪", "🎓", "📚", "✅", "❌", "⚠️", "💯", "🔔", "👀", "💬"],
  },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState(0);
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

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-2 w-80 rounded-xl border border-white/[0.08] bg-zinc-900 shadow-2xl shadow-black/50 z-30"
    >
      {/* Category tabs */}
      <div className="flex gap-1 border-b border-white/[0.06] px-2 pt-2 pb-1">
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button
            key={cat.name}
            onClick={() => setActiveCategory(i)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              i === activeCategory
                ? "bg-violet-600 text-white"
                : "text-zinc-400 hover:text-white hover:bg-white/[0.06]"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>
      {/* Emoji grid */}
      <div className="grid grid-cols-8 gap-0.5 p-2 max-h-48 overflow-y-auto">
        {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji) => (
          <button
            key={emoji}
            onClick={() => {
              onSelect(emoji);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-lg hover:bg-white/[0.08] transition-colors"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
