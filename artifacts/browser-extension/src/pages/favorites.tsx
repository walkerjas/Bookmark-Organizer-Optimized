import { useState, useEffect, useCallback, useRef } from "react";
import { ExternalLink, Star, Loader2, GripVertical } from "lucide-react";
import { listBookmarks, togglePin, updateBookmark, type Bookmark } from "@/lib/api";
import { SiteIcon } from "@/components/site-icon";

interface Props {
  apiConfigured: boolean;
}

export default function Favorites({ apiConfigured }: Props) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!apiConfigured) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listBookmarks({ pinned: true });
      setBookmarks(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [apiConfigured]);

  useEffect(() => { load(); }, [load]);

  async function handleUnpin(id: number) {
    try {
      await togglePin(id);
      setBookmarks(prev => prev.filter(b => b.id !== id));
    } catch { /* noop */ }
  }

  // ── Drag-to-reorder ─────────────────────────────────────────────────────────
  const dragIndex = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  function onDragStart(index: number) {
    dragIndex.current = index;
  }

  function onDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOver(index);
  }

  function onDragLeave() {
    setDragOver(null);
  }

  async function onDrop(e: React.DragEvent, dropIdx: number) {
    e.preventDefault();
    setDragOver(null);
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from === null || from === dropIdx) return;

    const next = [...bookmarks];
    const [moved] = next.splice(from, 1);
    next.splice(dropIdx, 0, moved);
    setBookmarks(next);

    next.forEach((bm, idx) => {
      if (bm.sortOrder !== idx) {
        updateBookmark(bm.id, { sortOrder: idx }).catch(() => {/* noop */});
      }
    });
  }

  if (!apiConfigured) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 px-6 text-center">
        <div className="text-4xl">⭐</div>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Configure your API URL in Settings first.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[hsl(var(--border))]">
        <Star size={14} className="text-[hsl(var(--primary))]" fill="currentColor" />
        <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Favorites</span>
        {bookmarks.length > 0 && (
          <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">{bookmarks.length}</span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex justify-center items-center py-8">
            <Loader2 size={18} className="animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        )}
        {error && (
          <div className="px-4 py-3 text-xs text-[hsl(var(--destructive))]">{error}</div>
        )}
        {!loading && !error && bookmarks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-6">
            <Star size={28} className="text-[hsl(var(--border))]" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              No favorites yet. Pin a bookmark to add it here.
            </p>
          </div>
        )}
        {bookmarks.map((bm, idx) => {
          let host = "";
          try { host = new URL(bm.url).hostname.replace(/^www\./, ""); } catch { /* noop */ }
          return (
            <div
              key={bm.id}
              draggable
              onDragStart={() => onDragStart(idx)}
              onDragOver={(e) => onDragOver(e, idx)}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, idx)}
              className={`group relative flex items-center border-b border-[hsl(var(--border)/0.5)] last:border-0 transition-colors ${
                dragOver === idx
                  ? "bg-[hsl(var(--primary)/0.08)] border-t-2 border-t-[hsl(var(--primary))]"
                  : "hover:bg-[hsl(var(--accent))]"
              }`}
            >
              <div className="pl-2 pr-1 py-3 opacity-0 group-hover:opacity-40 transition-opacity cursor-grab active:cursor-grabbing shrink-0">
                <GripVertical size={13} className="text-[hsl(var(--muted-foreground))]" />
              </div>
              <SiteIcon url={bm.url} favicon={bm.favicon} size={28} />
              <div className="flex-1 min-w-0 py-2.5 px-2">
                <p className="text-sm font-medium truncate">{bm.title}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{host}</p>
              </div>
              <div className="flex items-center gap-1 pr-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={() => handleUnpin(bm.id)}
                  title="Remove from favorites"
                  className="p-1 rounded hover:bg-[hsl(var(--secondary))] text-[hsl(var(--primary))] transition-colors"
                >
                  <Star size={13} fill="currentColor" />
                </button>
                <a
                  href={bm.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded hover:bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                >
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
