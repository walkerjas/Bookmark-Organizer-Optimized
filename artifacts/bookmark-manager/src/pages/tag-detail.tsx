import { useParams, Link } from "wouter";
import { useState, useEffect } from "react";
import {
  useListBookmarks,
  useListTags,
  useUpdateBookmark,
  useDeleteBookmark,
  useToggleBookmarkPin,
  getListBookmarksQueryKey,
  getGetBookmarkStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ExternalLink, GripVertical, Hash, Star, Trash2, MoreVertical, PinOff, ChevronRight, Search,
} from "lucide-react";
import { SiteIcon } from "@/components/site-icon";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type BookmarkItem = {
  id: number; url: string; title: string; description?: string | null;
  favicon?: string | null; collectionId?: number | null; pinned: boolean;
  sortOrder?: number;
  tags?: { id: number; name: string; color?: string | null }[];
};

export default function TagDetail() {
  const { id } = useParams<{ id: string }>();
  const tagId = id ? parseInt(id) : null;

  const { data: tags } = useListTags();
  const { data: serverBookmarks, isLoading } = useListBookmarks(tagId ? { tagId } : {});
  const tag = tags?.find((t) => t.id === tagId);

  const [ordered, setOrdered] = useState<BookmarkItem[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const updateBookmark = useUpdateBookmark();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (serverBookmarks) setOrdered(serverBookmarks as BookmarkItem[]);
  }, [serverBookmarks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const activeBookmark = activeId ? ordered.find((b) => b.id === activeId) ?? null : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as number);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const oldIndex = ordered.findIndex((b) => b.id === active.id);
    const newIndex = ordered.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(ordered, oldIndex, newIndex);
    setOrdered(reordered);
    reordered.forEach((bm, idx) => {
      if (bm.sortOrder !== idx) {
        updateBookmark.mutate(
          { id: bm.id, data: { sortOrder: idx } },
          { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListBookmarksQueryKey() }) }
        );
      }
    });
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-none px-5 py-4 border-b border-border bg-background">
        <div className="flex items-center gap-1 mb-2.5 text-[12px] text-muted-foreground/60 flex-wrap">
          <Link href="/tags">
            <button className="hover:text-muted-foreground transition-colors flex items-center gap-1">
              <Hash className="h-3 w-3" /> Tags
            </button>
          </Link>
          <ChevronRight className="h-2.5 w-2.5 shrink-0" />
          <span className="text-foreground/80 font-medium">{tag?.name ?? "…"}</span>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${tag?.color || "#8b5cf6"}18`, color: tag?.color || "#8b5cf6" }}
          >
            <Hash className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold tracking-tight truncate">#{tag?.name ?? "Tag"}</h1>
          </div>
          <span className="text-[12px] text-muted-foreground shrink-0">
            {ordered.length} bookmark{ordered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Bookmark list */}
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
        ) : !ordered.length ? (
          <div className="flex flex-col items-center justify-center h-[40vh] gap-3 text-center px-4">
            <Search className="h-8 w-8 text-muted-foreground/20" />
            <p className="text-sm font-medium text-muted-foreground">No bookmarks with this tag</p>
            <Link href="/"><Button variant="outline" size="sm">Go to Bookmarks</Button></Link>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <SortableContext items={ordered.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <div className="divide-y divide-border">
                {ordered.map((b) => (
                  <BookmarkRow key={b.id} bookmark={b} />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeBookmark ? (
                <div className="bg-card border border-primary/40 shadow-2xl opacity-95">
                  <BookmarkRow bookmark={activeBookmark} isDragging />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}

function BookmarkRow({ bookmark, isDragging = false }: { bookmark: BookmarkItem; isDragging?: boolean }) {
  const togglePin = useToggleBookmarkPin();
  const deleteBookmark = useDeleteBookmark();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } =
    useSortable({ id: bookmark.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.25 : 1,
  };

  const handleTogglePin = () => {
    togglePin.mutate({ id: bookmark.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBookmarksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBookmarkStatsQueryKey() });
      },
    });
  };

  const handleDelete = () => {
    deleteBookmark.mutate({ id: bookmark.id }, {
      onSuccess: () => {
        toast({ title: "Deleted" });
        queryClient.invalidateQueries({ queryKey: getListBookmarksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBookmarkStatsQueryKey() });
      },
    });
  };

  const domain = (() => { try { return new URL(bookmark.url).hostname.replace("www.", ""); } catch { return bookmark.url; } })();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-3 px-5 py-3 transition-colors",
        !isDragging && "hover:bg-muted/30 cursor-pointer",
        isDragging && "bg-muted/40"
      )}
      onClick={() => !isDragging && window.open(bookmark.url, "_blank", "noopener,noreferrer")}
    >
      {/* Drag handle */}
      <div
        className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/20 hover:text-muted-foreground/50 transition-colors"
        onClick={(e) => e.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      <SiteIcon url={bookmark.url} favicon={bookmark.favicon} bookmarkId={bookmark.id} size={36} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[13px] font-medium truncate">{bookmark.title}</span>
          {bookmark.pinned && <Star className="h-2.5 w-2.5 text-yellow-400 fill-yellow-400 shrink-0" />}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-muted-foreground/60 truncate">{domain}</span>
          {bookmark.tags && bookmark.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {bookmark.tags.slice(0, 3).map((t) => (
                <Link key={t.id} href={`/tags/${t.id}`}>
                  <span
                    onClick={(e) => e.stopPropagation()}
                    className="text-[10px] px-1 py-px rounded-sm bg-secondary text-muted-foreground font-medium hover:bg-secondary/80 transition-colors cursor-pointer"
                  >
                    #{t.name}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
          <button className="p-1.5 rounded text-muted-foreground/40 hover:text-muted-foreground transition-colors">
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </a>
        <button
          className={cn("p-1.5 rounded transition-colors", bookmark.pinned ? "text-yellow-400" : "text-muted-foreground/40 hover:text-yellow-400")}
          onClick={handleTogglePin}
        >
          <Star className={cn("h-3.5 w-3.5", bookmark.pinned && "fill-current")} />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 rounded text-muted-foreground/40 hover:text-muted-foreground transition-colors">
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 text-[13px]">
            <DropdownMenuItem onClick={handleTogglePin}>
              {bookmark.pinned ? <><PinOff className="w-3.5 h-3.5 mr-2" /> Unfavorite</> : <><Star className="w-3.5 h-3.5 mr-2" /> Favorite</>}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:bg-destructive focus:text-destructive-foreground">
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
