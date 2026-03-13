"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const markdownClasses = `
  space-y-2
  [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-zinc-100 [&_h1]:mt-3 [&_h1]:mb-1 [&_h1]:first:mt-0
  [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-zinc-200 [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:first:mt-0
  [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-zinc-300 [&_h3]:mt-2 [&_h3]:mb-1
  [&_p]:text-sm [&_p]:text-zinc-300 [&_p]:leading-relaxed [&_p]:my-1.5
  [&_ul]:my-2 [&_ul]:pl-5 [&_ul]:list-disc [&_ul]:space-y-1
  [&_ol]:my-2 [&_ol]:pl-5 [&_ol]:list-decimal [&_ol]:space-y-1
  [&_li]:text-sm [&_li]:text-zinc-300 [&_li]:leading-relaxed
  [&_strong]:font-semibold [&_strong]:text-zinc-100
  [&_code]:rounded [&_code]:bg-white/[0.08] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_code]:font-mono [&_code]:text-zinc-200
  [&_pre]:my-2 [&_pre]:rounded-lg [&_pre]:bg-black/30 [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre]:text-xs
  [&_pre_code]:bg-transparent [&_pre_code]:p-0
  [&_blockquote]:border-l-2 [&_blockquote]:border-violet-500/50 [&_blockquote]:pl-3 [&_blockquote]:my-2 [&_blockquote]:text-zinc-400 [&_blockquote]:text-sm
  [&_table]:w-full [&_table]:text-sm [&_table]:my-2
  [&_th]:text-left [&_th]:font-semibold [&_th]:text-zinc-200 [&_th]:py-1.5 [&_th]:pr-2 [&_th]:border-b [&_th]:border-white/10
  [&_td]:py-1.5 [&_td]:pr-2 [&_td]:text-zinc-300 [&_td]:border-b [&_td]:border-white/5
`;

interface AssistantMessageContentProps {
  content: string;
  className?: string;
}

export default function AssistantMessageContent({ content, className = "" }: AssistantMessageContentProps) {
  return (
    <div className={`text-sm ${markdownClasses} ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
