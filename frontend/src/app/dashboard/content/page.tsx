"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useRAGDocuments } from "@/lib/hooks";
import { ingestDocument, deleteRAGDocument } from "@/lib/api";

export default function ContentManagementPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { data: documents, error, isLoading, mutate } = useRAGDocuments();

  const [sourceFile, setSourceFile] = useState("");
  const [content, setContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Redirect non-educators
  useEffect(() => {
    if (!authLoading && user?.role !== "educator") {
      router.replace("/");
    }
  }, [authLoading, user?.role, router]);

  if (!authLoading && user?.role !== "educator") {
    return null;
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    setContent(text);
    if (!sourceFile) {
      setSourceFile(file.name);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sourceFile.trim() || !content.trim()) return;

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const result = await ingestDocument(sourceFile.trim(), content.trim());
      setUploadSuccess(
        `Ingested "${sourceFile}" - ${result.chunks_created} chunks created.`,
      );
      setSourceFile("");
      setContent("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await mutate();
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Failed to ingest document",
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(file: string) {
    if (!confirm(`Delete all chunks for "${file}"?`)) return;

    setDeletingFile(file);
    try {
      await deleteRAGDocument(file);
      await mutate();
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to delete document",
      );
    } finally {
      setDeletingFile(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-10">
        <h1 className="mb-2 text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
          Content Management
        </h1>
        <p className="text-zinc-500 text-base">
          Upload and manage training documents for the RAG pipeline. These
          documents provide context for scenario generation and grading.
        </p>
      </div>

      {/* Upload Form */}
      <div className="card-glow mb-10 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">
          Upload New Document
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="source-file"
              className="mb-1 block text-sm font-medium text-zinc-300"
            >
              Document Name
            </label>
            <input
              id="source-file"
              type="text"
              value={sourceFile}
              onChange={(e) => setSourceFile(e.target.value)}
              placeholder="e.g. options-pricing-guide.txt"
              className="w-full rounded-lg border border-white/[0.08] bg-zinc-800/50 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
            />
          </div>

          <div>
            <label
              htmlFor="file-upload"
              className="mb-1 block text-sm font-medium text-zinc-300"
            >
              Upload .txt File
            </label>
            <input
              id="file-upload"
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.text"
              onChange={handleFileUpload}
              className="w-full text-sm text-zinc-400 file:mr-4 file:rounded-lg file:border-0 file:bg-violet-500/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-violet-400 file:transition-colors hover:file:bg-violet-500/20"
            />
          </div>

          <div>
            <label
              htmlFor="content"
              className="mb-1 block text-sm font-medium text-zinc-300"
            >
              Or Paste Content
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              placeholder="Paste your document content here..."
              className="w-full rounded-lg border border-white/[0.08] bg-zinc-800/50 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
            />
          </div>

          {uploadError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              {uploadError}
            </div>
          )}

          {uploadSuccess && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-400">
              {uploadSuccess}
            </div>
          )}

          <button
            type="submit"
            disabled={uploading || !sourceFile.trim() || !content.trim()}
            className="rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload Document"}
          </button>
        </form>
      </div>

      {/* Documents Table */}
      <h2 className="mb-4 text-xl font-semibold text-white">
        Existing Documents
      </h2>

      {isLoading && (
        <div className="card-glow p-10 text-center text-zinc-500">
          Loading documents...
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400 text-sm">
          {error instanceof Error ? error.message : "Failed to load documents"}
        </div>
      )}

      {documents && documents.length === 0 && (
        <div className="card-glow p-10 text-center text-zinc-500">
          No documents ingested yet. Upload your first document above.
        </div>
      )}

      {documents && documents.length > 0 && (
        <div className="card-glow overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-800/50">
              <tr>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Document
                </th>
                <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Chunks
                </th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Ingested
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr
                  key={doc.source_file}
                  className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]"
                >
                  <td className="px-5 py-3.5 font-medium text-zinc-200">
                    <div className="flex items-center gap-2">
                      <svg
                        className="h-4 w-4 text-violet-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                        />
                      </svg>
                      {doc.source_file}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="inline-flex min-w-[2rem] items-center justify-center rounded-md bg-violet-500/10 px-2 py-0.5 text-xs font-semibold text-violet-400 ring-1 ring-violet-500/20">
                      {doc.chunk_count}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-zinc-400">
                    {doc.created_at
                      ? new Date(doc.created_at).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => handleDelete(doc.source_file)}
                      disabled={deletingFile === doc.source_file}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {deletingFile === doc.source_file
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
