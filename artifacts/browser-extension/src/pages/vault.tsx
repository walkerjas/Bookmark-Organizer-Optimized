import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Plus, Star, Trash2, X, Loader2, GripVertical } from "lucide-react";
import {
  listBookmarks,
  createBookmark,
  togglePin,
  deleteBookmark,
  reorderBookmarks,
  listCollections,
  type Bookmark,
  type Collection,
} from "@/lib/api";
import { SiteIcon } from "@/components/site-icon";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

interface Props {
  apiConfigured: boolean;
}

export default function Vault({ apiConfigured }: Props) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSave, setShowSave] = useState(false);

  const load = useCallback(
    async (q: string) => {
      if (!apiConfigured) return;
      setLoading(true);
      setError(null);
      try {
        const data = await listBookmarks(q ? { search: q } : undefined);
        setBookmarks(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    },
    [apiConfigured],
  );

  useEffect(() => {
    load(debouncedSearch);
  }, [debouncedSearch, load]);

  async function handlePin(id: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const updated = await togglePin(id);
      setBookmarks((prev) => prev.map((b) => (b.id === id ? updated : b)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not update favorite");
    }
  }

  async function handleDelete(id: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await deleteBookmark(id);
      setBookmarks((prev) => prev.filter((b) => b.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not delete bookmark");
    }
  }

  // ── Drag-to-reorder ────────────────────────────────────────────────────────
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

    // Reorder optimistically
    const next = [...bookmarks];
    const [moved] = next.splice(from, 1);
    next.splice(dropIdx, 0, moved);
    setBookmarks(next);

    try {
      await reorderBookmarks(next.map((bookmark) => bookmark.id));
    } catch (e: unknown) {
      setBookmarks(bookmarks);
      setError(e instanceof Error ? e.message : "Could not save bookmark order");
    }
  }

  if (!apiConfigured) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 px-6 text-center">
        <div className="text-4xl">🔗</div>
        <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
          Configure your Markbase API URL in Settings to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Search bar */}
      <div className="px-3 py-2 border-b border-[hsl(var(--border))]">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[hsl(var(--input))] border border-[hsl(var(--border))]">
          <Search
            size={14}
            className="text-[hsl(var(--muted-foreground))] shrink-0"
          />
          <input
            id="bookmark-search"
            name="bookmark_search"
            autoComplete="off"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bookmarks…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))] text-[hsl(var(--foreground))]"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex justify-center items-center py-8">
            <Loader2
              size={18}
              className="animate-spin text-[hsl(var(--muted-foreground))]"
            />
          </div>
        )}
        {error && (
          <div className="px-4 py-3 text-xs text-[hsl(var(--destructive))]">
            {error}
          </div>
        )}
        {!loading && !error && bookmarks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-6">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {search ? "No results found" : "No bookmarks yet"}
            </p>
          </div>
        )}

        {bookmarks.map((bm, idx) => (
          <BookmarkRow
            key={bm.id}
            bookmark={bm}
            isDragTarget={dragOver === idx}
            onDragStart={() => onDragStart(idx)}
            onDragOver={(e) => onDragOver(e, idx)}
            onDragLeave={onDragLeave}
            onDrop={(e) => onDrop(e, idx)}
            onPin={(e) => handlePin(bm.id, e)}
            onDelete={(e) => handleDelete(bm.id, e)}
          />
        ))}
      </div>

      {/* Save button */}
      <div className="px-3 py-2 border-t border-[hsl(var(--border))]">
        <button
          onClick={() => setShowSave(true)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={15} />
          Save Bookmark
        </button>
      </div>

      {showSave && (
        <SaveModal
          onClose={() => setShowSave(false)}
          onSaved={(bm) => {
            setBookmarks((prev) => [bm, ...prev]);
            setShowSave(false);
          }}
        />
      )}
    </div>
  );
}

// ── Bookmark row ──────────────────────────────────────────────────────────────

interface RowProps {
  bookmark: Bookmark;
  isDragTarget: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onPin: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

function BookmarkRow({
  bookmark,
  isDragTarget,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onPin,
  onDelete,
}: RowProps) {
  let host = "";
  try {
    host = new URL(bookmark.url).hostname.replace(/^www\./, "");
  } catch {
    /* noop */
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`group relative flex items-center border-b border-[hsl(var(--border)/0.5)] last:border-0 transition-colors ${
        isDragTarget
          ? "bg-[hsl(var(--primary)/0.08)] border-t-2 border-t-[hsl(var(--primary))]"
          : "hover:bg-[hsl(var(--accent))]"
      }`}
    >
      {/* Drag handle */}
      <div className="pl-2 pr-1 py-3 opacity-0 group-hover:opacity-40 transition-opacity cursor-grab active:cursor-grabbing shrink-0">
        <GripVertical size={13} className="text-[hsl(var(--muted-foreground))]" />
      </div>

      {/* Clickable area — opens URL */}
      <a
        href={bookmark.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2.5 flex-1 min-w-0 py-2.5 pr-2"
      >
        <SiteIcon url={bookmark.url} favicon={bookmark.favicon} size={28} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate leading-tight">
            {bookmark.title}
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
            {host}
          </p>
        </div>
      </a>

      {/* Actions — stop propagation so they don't navigate */}
      <div className="flex items-center gap-0.5 pr-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={onPin}
          title={bookmark.pinned ? "Unpin" : "Pin"}
          className={`p-1.5 rounded hover:bg-[hsl(var(--secondary))] transition-colors ${
            bookmark.pinned
              ? "text-[hsl(var(--primary))]"
              : "text-[hsl(var(--muted-foreground))]"
          }`}
        >
          <Star
            size={12}
            fill={bookmark.pinned ? "currentColor" : "none"}
          />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded hover:bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] transition-colors"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Save modal ────────────────────────────────────────────────────────────────

function SaveModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (bm: Bookmark) => void;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [collectionId, setCollectionId] = useState<number | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCollections()
      .then(setCollections)
      .catch(() => {});

    // Prefill from the current browser tab (manifest has activeTab permission)
    if (typeof chrome !== "undefined" && chrome.tabs?.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const t = tabs[0];
        if (!t?.url) return;
        // Skip internal/private browser pages — can't be bookmarked
        if (/^(chrome|chrome-extension|about|moz-extension|edge|file):/i.test(t.url))
          return;
        setUrl(t.url);
        if (t.title) setTitle(t.title);
      });
    }
  }, []);

  async function handleSave() {
    if (!url.trim()) {
      setError("URL is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const bm = await createBookmark({
        url: url.trim(),
        title: title.trim() || url.trim(),
        collectionId,
      });
      onSaved(bm);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="absolute inset-0 bg-[hsl(var(--background)/0.85)] backdrop-blur-sm flex items-end z-50">
      <div className="w-full bg-[hsl(var(--card))] border-t border-[hsl(var(--border))] rounded-t-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Save Bookmark</span>
          <button
            onClick={onClose}
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <ModalInput
            label="URL"
            placeholder="https://example.com"
            value={url}
            onChange={setUrl}
          />
          <ModalInput
            label="Title"
            placeholder="Page title"
            value={title}
            onChange={setTitle}
          />
          {collections.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[hsl(var(--muted-foreground))]">
                Collection
              </label>
              <select
                value={collectionId ?? ""}
                onChange={(e) =>
                  setCollectionId(
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
                className="w-full px-3 py-1.5 rounded-md bg-[hsl(var(--input))] border border-[hsl(var(--border))] text-sm text-[hsl(var(--foreground))] outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
              >
                <option value="">No collection</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        {error && (
          <p className="text-xs text-[hsl(var(--destructive))]">{error}</p>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2 rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function ModalInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const fieldId = `modal-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className="text-xs text-[hsl(var(--muted-foreground))]">
        {label}
      </label>
      <input
        id={fieldId}
        name={fieldId}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-1.5 rounded-md bg-[hsl(var(--input))] border border-[hsl(var(--border))] text-sm text-[hsl(var(--foreground))] outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] placeholder:text-[hsl(var(--muted-foreground))]"
      />
    </div>
  );
}
