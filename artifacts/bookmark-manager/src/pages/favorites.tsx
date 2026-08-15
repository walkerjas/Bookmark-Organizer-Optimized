import { useState, useEffect, useRef } from "react";
import {
  useListBookmarks,
  useDeleteBookmark,
  useToggleBookmarkPin,
  useUpdateBookmark,
  getListBookmarksQueryKey,
  getGetBookmarkStatsQueryKey,
  type Bookmark,
} from "@workspace/api-client-react";
import { ExternalLink, GripVertical, Star, Trash2 } from "lucide-react";
import { SiteIcon } from "@/components/site-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Favorites() {
  const { data: fetchedBookmarks = [], isLoading } = useListBookmarks({ pinned: true });
  const togglePin = useToggleBookmarkPin();
  const deleteBookmark = useDeleteBookmark();
  const updateBookmark = useUpdateBookmark();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Local ordered list — syncs from server, updated optimistically on drag
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  useEffect(() => { setBookmarks(fetchedBookmarks); }, [fetchedBookmarks]);

  function handleUnpin(id: number) {
    togglePin.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBookmarksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBookmarkStatsQueryKey() });
      },
    });
  }

  function handleDelete(id: number) {
    deleteBookmark.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Deleted" });
        queryClient.invalidateQueries({ queryKey: getListBookmarksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBookmarkStatsQueryKey() });
      },
    });
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

  function onDragEnd() {
    setDragOver(null);
    dragIndex.current = null;
  }

  function onDrop(e: React.DragEvent, dropIdx: number) {
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
        updateBookmark.mutate({ id: bm.id, data: { sortOrder: idx } });
      }
    });
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-none px-5 py-4 border-b border-border bg-background">
        <h1 className="text-base font-semibold tracking-tight">Favorites</h1>
        <p className="text-[12px] text-muted-foreground mt-0.5">
          {bookmarks.length} item{bookmarks.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-3">
                <Skeleton className="h-4 w-56 mb-1.5" />
                <Skeleton className="h-3 w-36" />
              </div>
            ))}
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[50vh] gap-3 text-center px-4">
            <Star className="h-8 w-8 text-muted-foreground/20" />
            <p className="text-sm font-medium text-muted-foreground">No favorites yet</p>
            <p className="text-[12px] text-muted-foreground/60">
              Star any bookmark to pin it here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {bookmarks.map((bm, idx) => {
              const domain = (() => { try { return new URL(bm.url).hostname.replace("www.", ""); } catch { return bm.url; } })();
              return (
                <div
                  key={bm.id}
                  draggable
                  onDragStart={() => onDragStart(idx)}
                  onDragOver={(e) => onDragOver(e, idx)}
                  onDragEnd={onDragEnd}
                  onDrop={(e) => onDrop(e, idx)}
                  className={`group flex items-center gap-3 px-5 py-3 transition-colors cursor-pointer ${
                    dragOver === idx
                      ? "bg-primary/5 border-t-2 border-primary"
                      : "hover:bg-muted/30"
                  }`}
                  onClick={() => window.open(bm.url, "_blank", "noopener,noreferrer")}
                >
                  {/* Drag handle */}
                  <div
                    className="shrink-0 opacity-0 group-hover:opacity-30 transition-opacity cursor-grab active:cursor-grabbing"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                  </div>

                  <SiteIcon url={bm.url} favicon={bm.favicon} bookmarkId={bm.id} size={36} />

                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate">{bm.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground/60 truncate">{domain}</span>
                      {bm.tags && bm.tags.length > 0 && (
                        <div className="flex gap-1">
                          {bm.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag.id}
                              className="text-[10px] px-1 py-px rounded-sm bg-secondary text-muted-foreground font-medium"
                            >
                              #{tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <a href={bm.url} target="_blank" rel="noopener noreferrer">
                      <button className="p-1.5 rounded text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </a>
                    <button
                      className="p-1.5 rounded text-yellow-400 hover:text-yellow-500 transition-colors"
                      onClick={() => handleUnpin(bm.id)}
                      title="Remove from favorites"
                    >
                      <Star className="h-3.5 w-3.5 fill-current" />
                    </button>
                    <button
                      className="p-1.5 rounded text-muted-foreground/40 hover:text-destructive transition-colors"
                      onClick={() => handleDelete(bm.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
