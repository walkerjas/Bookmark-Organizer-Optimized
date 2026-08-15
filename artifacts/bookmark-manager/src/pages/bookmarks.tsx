import { useState, useEffect } from "react";
import {
  useListBookmarks,
  useListCollections,
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
import { Link } from "wouter";
import {
  Search,
  PinOff,
  Edit2,
  Trash2,
  MoreVertical,
  Star,
  GripVertical,
  CheckSquare,
  Square,
  X,
  FolderOpen,
  ExternalLink,
} from "lucide-react";
import { SiteIcon } from "@/components/site-icon";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type BookmarkItem = {
  id: number;
  url: string;
  title: string;
  description?: string | null;
  favicon?: string | null;
  previewImage?: string | null;
  collectionId?: number | null;
  pinned: boolean;
  sortOrder?: number;
  createdAt: string;
  updatedAt?: string;
  tags?: { id: number; name: string; color?: string | null }[];
};

export default function Bookmarks() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkMoveCollectionId, setBulkMoveCollectionId] = useState<string>("none");
  const [isBulkWorking, setIsBulkWorking] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data: serverBookmarks, isLoading } = useListBookmarks({ search: debouncedSearch || undefined });
  const { data: collections } = useListCollections();
  const [ordered, setOrdered] = useState<BookmarkItem[]>([]);

  useEffect(() => {
    if (serverBookmarks) setOrdered(serverBookmarks as BookmarkItem[]);
  }, [serverBookmarks]);

  useEffect(() => { setSelectedIds(new Set()); }, [debouncedSearch]);

  const updateBookmark = useUpdateBookmark();
  const deleteBookmark = useDeleteBookmark();
  const togglePin = useToggleBookmarkPin();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const activeBookmark = activeId ? ordered.find((b) => b.id === activeId) ?? null : null;
  const selectionActive = selectedIds.size > 0;
  const allSelected = ordered.length > 0 && ordered.every((b) => selectedIds.has(b.id));

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleDragStart(event: DragStartEvent) {
    if (selectionActive) return;
    setActiveId(event.active.id as number);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const oldIndex = ordered.findIndex((b) => b.id === active.id);
    const newIndex = ordered.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(ordered, oldIndex, newIndex);
    setOrdered(reordered);
    try {
      const response = await fetch("/api/bookmarks/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: reordered.map((bookmark) => bookmark.id) }),
      });
      if (!response.ok) throw new Error(`Reorder failed (${response.status})`);
      queryClient.setQueryData(getListBookmarksQueryKey({ search: debouncedSearch || undefined }), reordered);
    } catch {
      setOrdered((serverBookmarks as BookmarkItem[] | undefined) ?? []);
      toast({ title: "Could not save the new order", variant: "destructive" });
    }
  }

  async function bulkFavorite(pin: boolean) {
    setIsBulkWorking(true);
    const ids = Array.from(selectedIds);
    const targets = ordered.filter((b) => ids.includes(b.id) && b.pinned !== pin);
    try {
      const results = await Promise.allSettled(targets.map((b) => togglePin.mutateAsync({ id: b.id })));
      const failed = results.filter((result) => result.status === "rejected").length;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListBookmarksQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetBookmarkStatsQueryKey() }),
      ]);
      if (failed) toast({ title: `${failed} bookmark${failed === 1 ? "" : "s"} could not be updated`, variant: "destructive" });
      else toast({ title: pin ? `Favorited ${targets.length} bookmarks` : `Unfavorited ${targets.length} bookmarks` });
      setSelectedIds(new Set());
    } finally { setIsBulkWorking(false); }
  }

  async function bulkDelete() {
    setIsBulkWorking(true);
    const ids = Array.from(selectedIds);
    try {
      const results = await Promise.allSettled(ids.map((id) => deleteBookmark.mutateAsync({ id })));
      const deleted = results.filter((result) => result.status === "fulfilled").length;
      const failed = ids.length - deleted;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListBookmarksQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetBookmarkStatsQueryKey() }),
      ]);
      toast(failed
        ? { title: `Deleted ${deleted}; ${failed} failed`, variant: "destructive" }
        : { title: `Deleted ${deleted} bookmark${deleted !== 1 ? "s" : ""}` });
      setSelectedIds(new Set());
    } finally { setIsBulkWorking(false); }
  }

  async function bulkMove() {
    setIsBulkWorking(true);
    const ids = Array.from(selectedIds);
    const collId = bulkMoveCollectionId !== "none" ? parseInt(bulkMoveCollectionId) : null;
    try {
      const results = await Promise.allSettled(ids.map((id) => updateBookmark.mutateAsync({ id, data: { collectionId: collId } })));
      const moved = results.filter((result) => result.status === "fulfilled").length;
      const failed = ids.length - moved;
      await queryClient.invalidateQueries({ queryKey: getListBookmarksQueryKey() });
      const collName = collections?.find((c) => c.id === collId)?.name ?? "Uncategorized";
      toast(failed
        ? { title: `Moved ${moved}; ${failed} failed`, variant: "destructive" }
        : { title: `Moved ${moved} item${moved !== 1 ? "s" : ""} to ${collName}` });
      setSelectedIds(new Set());
      setBulkMoveOpen(false);
      setBulkMoveCollectionId("none");
    } finally { setIsBulkWorking(false); }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-none px-5 py-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-background">
        <div>
          <h1 className="text-base font-semibold tracking-tight">All Bookmarks</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">{ordered.length} item{ordered.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
          <Input
            type="search"
            placeholder="Search…"
            className="pl-8 h-7 text-[13px] bg-muted/50 border-border/60 placeholder:text-muted-foreground/40"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Bulk action bar */}
      {selectionActive && (
        <div className="flex-none flex items-center gap-2 px-5 py-1.5 bg-primary/8 border-b border-primary/15 flex-wrap">
          <button
            className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => allSelected ? setSelectedIds(new Set()) : setSelectedIds(new Set(ordered.map((b) => b.id)))}
          >
            {allSelected ? <CheckSquare className="h-3.5 w-3.5 text-primary" /> : <Square className="h-3.5 w-3.5" />}
            {allSelected ? "Deselect all" : "Select all"}
          </button>
          <span className="text-[12px] text-muted-foreground">{selectedIds.size} selected</span>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 text-[12px] gap-1.5 px-2.5" onClick={() => setBulkMoveOpen(true)} disabled={isBulkWorking}>
              <FolderOpen className="h-3.5 w-3.5" /> Move
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-[12px] gap-1.5 px-2.5" onClick={() => bulkFavorite(true)} disabled={isBulkWorking}>
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" /> Favorite
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-[12px] gap-1.5 px-2.5 text-destructive hover:text-destructive" onClick={bulkDelete} disabled={isBulkWorking}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
            <button className="p-1 text-muted-foreground hover:text-foreground transition-colors" onClick={() => setSelectedIds(new Set())}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="px-5 py-3">
                <Skeleton className="h-4 w-64 mb-1.5" />
                <Skeleton className="h-3 w-40" />
              </div>
            ))}
          </div>
        ) : ordered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[50vh] gap-3 text-center px-4">
            <Search className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">
              {search ? "No results for that search" : "No bookmarks yet — paste a URL above"}
            </p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <SortableContext items={ordered.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <div className="divide-y divide-border">
                {ordered.map((b) => (
                  <BookmarkRow
                    key={b.id}
                    bookmark={b}
                    selected={selectedIds.has(b.id)}
                    selectionActive={selectionActive}
                    onToggleSelect={() => toggleSelect(b.id)}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeBookmark ? (
                <div className="bg-card border border-primary/40 shadow-2xl opacity-95">
                  <BookmarkRow bookmark={activeBookmark} selected={false} selectionActive={false} onToggleSelect={() => {}} isDragging />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Bulk Move Dialog */}
      <Dialog open={bulkMoveOpen} onOpenChange={setBulkMoveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Move {selectedIds.size} item{selectedIds.size !== 1 ? "s" : ""} to…</DialogTitle></DialogHeader>
          <div className="py-4">
            <Select value={bulkMoveCollectionId} onValueChange={setBulkMoveCollectionId}>
              <SelectTrigger><SelectValue placeholder="Select a folder" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Uncategorized —</SelectItem>
                {collections?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkMoveOpen(false)}>Cancel</Button>
            <Button onClick={bulkMove} disabled={isBulkWorking}>Move</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BookmarkRow({
  bookmark,
  isDragging = false,
  selected,
  selectionActive,
  onToggleSelect,
}: {
  bookmark: BookmarkItem;
  isDragging?: boolean;
  selected: boolean;
  selectionActive: boolean;
  onToggleSelect: () => void;
}) {
  const togglePin = useToggleBookmarkPin();
  const deleteBookmark = useDeleteBookmark();
  const updateBookmark = useUpdateBookmark();
  const { data: collections } = useListCollections();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(bookmark.title);
  const [editDescription, setEditDescription] = useState(bookmark.description || "");
  const [editCollectionId, setEditCollectionId] = useState<string>(
    bookmark.collectionId ? String(bookmark.collectionId) : "none"
  );
  const [editTagIds, setEditTagIds] = useState<number[]>(bookmark.tags?.map((t) => t.id) ?? []);
  const { data: allTags = [] } = useListTags();

  function toggleTag(id: number) {
    setEditTagIds((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  }

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

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle) return;
    updateBookmark.mutate(
      {
        id: bookmark.id,
        data: {
          title: editTitle,
          description: editDescription,
          collectionId: editCollectionId !== "none" ? parseInt(editCollectionId) : null,
          tagIds: editTagIds,
        },
      },
      {
        onSuccess: () => {
          setIsEditOpen(false);
          toast({ title: "Saved" });
          queryClient.invalidateQueries({ queryKey: getListBookmarksQueryKey() });
        },
      }
    );
  };

  const domain = (() => { try { return new URL(bookmark.url).hostname.replace("www.", ""); } catch { return bookmark.url; } })();

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "group flex items-center gap-3 px-5 py-3 transition-colors",
          !isDragging && !selectionActive && "hover:bg-muted/30 cursor-pointer",
          !isDragging && selectionActive && "cursor-default",
          selected && "bg-primary/6",
          isDragging && "bg-muted/40"
        )}
        onClick={() => {
          if (selectionActive) { onToggleSelect(); return; }
          if (!isDragging) window.open(bookmark.url, "_blank", "noopener,noreferrer");
        }}
      >
        {/* Checkbox */}
        <div
          className={cn(
            "shrink-0 transition-opacity",
            selectionActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
          onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
        >
          {selected
            ? <CheckSquare className="h-3.5 w-3.5 text-primary" />
            : <Square className="h-3.5 w-3.5 text-muted-foreground/40" />}
        </div>

        {/* Drag handle */}
        {!selectionActive && (
          <div
            className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/20 hover:text-muted-foreground/50 transition-colors"
            onClick={(e) => e.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </div>
        )}

        {/* Site icon */}
        <SiteIcon url={bookmark.url} favicon={bookmark.favicon} bookmarkId={bookmark.id} size={36} />

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[13px] font-medium truncate leading-tight">{bookmark.title}</span>
            {bookmark.pinned && <Star className="h-2.5 w-2.5 text-yellow-400 fill-yellow-400 shrink-0" />}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-muted-foreground/60 truncate">{domain}</span>
            {bookmark.tags && bookmark.tags.length > 0 && (
              <div className="flex gap-1">
                {bookmark.tags.slice(0, 3).map((t) => (
                  <Link key={t.id} href={`/tags/${t.id}`}>
                    <span
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] px-1 py-px rounded-sm bg-secondary text-muted-foreground font-medium hover:bg-secondary/60 transition-colors cursor-pointer"
                    >
                      #{t.name}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions — only visible on hover */}
        <div
          className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <a href={bookmark.url} target="_blank" rel="noopener noreferrer" title="Open link">
            <button className="p-1.5 rounded text-muted-foreground/40 hover:text-muted-foreground transition-colors">
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </a>
          <button
            className={cn(
              "p-1.5 rounded transition-colors",
              bookmark.pinned ? "text-yellow-400" : "text-muted-foreground/40 hover:text-yellow-400"
            )}
            onClick={handleTogglePin}
            title={bookmark.pinned ? "Remove from favorites" : "Favorite"}
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
              <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
                <Edit2 className="w-3.5 h-3.5 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:bg-destructive focus:text-destructive-foreground">
                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Bookmark</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-[13px] font-medium">Title</label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="text-[13px]" />
            </div>
            <div className="space-y-2">
              <label className="text-[13px] font-medium">Description</label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} className="text-[13px]" />
            </div>
            <div className="space-y-2">
              <label className="text-[13px] font-medium">Folder</label>
              <Select value={editCollectionId} onValueChange={setEditCollectionId}>
                <SelectTrigger className="text-[13px]"><SelectValue placeholder="Select a folder" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Uncategorized —</SelectItem>
                  {collections?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {allTags.length > 0 && (
              <div className="space-y-2">
                <label className="text-[13px] font-medium">Tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {allTags.map((tag) => {
                    const active = editTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors",
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                        )}
                        style={active && tag.color ? { backgroundColor: tag.color, borderColor: tag.color } : undefined}
                      >
                        #{tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={!editTitle || updateBookmark.isPending}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
