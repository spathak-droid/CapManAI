"use client";

import { useState, useEffect, useRef } from "react";
import { auth } from "@/lib/firebase";

interface AuthImageProps {
  src: string;
  alt: string;
  className?: string;
  onClick?: (blobUrl: string) => void;
}

export default function AuthImage({ src, alt, className, onClick }: AuthImageProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchImage() {
      try {
        const headers: Record<string, string> = {};
        const currentUser = auth.currentUser;
        if (currentUser) {
          const token = await currentUser.getIdToken();
          headers["Authorization"] = `Bearer ${token}`;
        }

        const res = await fetch(src, { headers });
        if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);

        const blob = await res.blob();
        if (cancelled) return;

        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobUrl(url);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchImage();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [src]);

  if (loading) {
    return (
      <div className={`mt-2 flex items-center justify-center rounded-lg bg-zinc-700/50 max-h-64 h-32 w-48 ${className ?? ""}`}>
        <span className="text-xs text-zinc-400 animate-pulse">Loading image...</span>
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div className={`mt-2 flex items-center justify-center rounded-lg bg-zinc-700/50 max-h-64 h-32 w-48 ${className ?? ""}`}>
        <span className="text-xs text-zinc-400">Failed to load image</span>
      </div>
    );
  }

  return (
    <img
      src={blobUrl}
      alt={alt}
      className={className}
      onClick={onClick ? () => onClick(blobUrl) : undefined}
    />
  );
}
