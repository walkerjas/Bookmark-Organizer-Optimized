import { useState, useEffect, useCallback, useRef } from "react";
import { FolderOpen, Loader2, ChevronRight, GripVertical } from "lucide-react";
import { listCollections, listBookmarks, updateBookmark, type Collection, type Bookmark } from "@/lib/api";
import { SiteIcon } from "@/components/site-icon";

interface Props {
  apiConfigured: boolean;
}

export default function Collections({ apiConfigured }: Props) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [expandedBookmarks, setExpandedBookmarks] = useState<Bookmark[]>([]);
  const [expandLoading, setExpandLoading] = useState(false);

  const load = useCallback(async () => {
    if (!apiConfigured) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listCollections();
      setCollections(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [apiConfigured]);

  useEffect(() => { load(); }, [load]);

  async function handleExpand(col: Collection) {
    if (expanded === col.id) {
      setExpanded(null);
      setExpandedBookmarks([]);
      return;
    }
    setExpanded(col.id);
    setExpandLoading(true);
    try {
      const bms = await listBookmarks({ collectionId: col.id });
      setExpandedBookmarks(bms);
    } catch { setExpandedBookmarks([]); }
    finally { setExpandLoading(false); }
  }

  // ── Drag-to-reorder (within expanded folder) ────────────────────────────────
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

    const next = [...expandedBookmarks];
    const [moved] = next.splice(from, 1);
    next.splice(dropIdx, 0, moved);
    setExpandedBookmarks(next);

    next.forEach((bm, idx) => {
      if (bm.sortOrder !== idx) {
        updateBookmark(bm.id, { sortOrder: idx }).catch(() => {/* noop */});
      }
    });
  }

  if (!apiConfigured) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 px-6 text-center">
        <div className="text-4xl">📁</div>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Configure your API URL in Settings first.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[hsl(var(--border))]">
        <FolderOpen size={14} className="text-[hsl(var(--primary))]" />
        <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Collections</span>
        {collections.length > 0 && (
          <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">{collections.length}</span>
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
        {!loading && !error && collections.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-6">
            <FolderOpen size={28} className="text-[hsl(var(--border))]" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              No collections yet.
            </p>
          </div>
        )}
        {collections.map(col => (
          <div key={col.id}>
            <button
              onClick={() => handleExpand(col)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[hsl(var(--accent))] border-b border-[hsl(var(--border)/0.5)] transition-colors text-left"
            >
              <div
                className="w-7 h-7 rounded flex items-center justify-center text-sm shrink-0"
                style={{ background: col.color ? `${col.color}22` : "hsl(var(--muted))" }}
              >
                <FolderOpen
                  size={14}
                  style={{ color: col.color || "hsl(var(--muted-foreground))" }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{col.name}</p>
                {col.description && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{col.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">{col.bookmarkCount ?? 0}</span>
                <ChevronRight
                  size={14}
                  className={`text-[hsl(var(--muted-foreground))] transition-transform ${expanded === col.id ? "rotate-90" : ""}`}
                />
              </div>
            </button>
            {expanded === col.id && (
              <div className="bg-[hsl(var(--muted)/0.5)]">
                {expandLoading ? (
                  <div className="flex justify-center py-3">
                    <Loader2 size={14} className="animate-spin text-[hsl(var(--muted-foreground))]" />
                  </div>
                ) : expandedBookmarks.length === 0 ? (
                  <p className="text-xs text-[hsl(var(--muted-foreground))] px-12 py-2">No bookmarks</p>
                ) : (
                  expandedBookmarks.map((bm, idx) => {
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
                        className={`group relative flex items-center border-b border-[hsl(var(--border)/0.3)] last:border-0 transition-colors ${
                          dragOver === idx
                            ? "bg-[hsl(var(--primary)/0.08)] border-t-2 border-t-[hsl(var(--primary))]"
                            : "hover:bg-[hsl(var(--accent))]"
                        }`}
                      >
                        <div className="pl-8 pr-1 py-2 opacity-0 group-hover:opacity-40 transition-opacity cursor-grab active:cursor-grabbing shrink-0">
                          <GripVertical size={12} className="text-[hsl(var(--muted-foreground))]" />
                        </div>
                        <a
                          href={bm.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 flex-1 min-w-0 py-2 pr-3"
                        >
                          <SiteIcon url={bm.url} favicon={bm.favicon} size={20} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{bm.title}</p>
                            <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{host}</p>
                          </div>
                        </a>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
