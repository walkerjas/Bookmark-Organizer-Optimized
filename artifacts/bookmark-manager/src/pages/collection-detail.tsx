import { useParams, Link } from "wouter";
import { useState, useEffect } from "react";
import {
  useListBookmarks,
  useListCollections,
  useCreateCollection,
  useUpdateBookmark,
  useDeleteBookmark,
  useToggleBookmarkPin,
  getListBookmarksQueryKey,
  getGetBookmarkStatsQueryKey,
  getListCollectionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, closestCenter, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ExternalLink, Folder, FolderOpen, FolderPlus,
  GripVertical, Star, Trash2, MoreVertical, PinOff, Edit2, Search, ChevronRight,
} from "lucide-react";
import { SiteIcon } from "@/components/site-icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type CollectionItem = {
  id: number; name: string; color?: string | null;
  parentId?: number | null; bookmarkCount?: number; description?: string | null;
};

type BookmarkItem = {
  id: number; url: string; title: string; description?: string | null;
  favicon?: string | null; collectionId?: number | null; pinned: boolean;
  sortOrder?: number; tags?: { id: number; name: string; color?: string | null }[];
};

function buildBreadcrumb(collectionId: number, all: CollectionItem[]): CollectionItem[] {
  const map = new Map(all.map((c) => [c.id, c]));
  const path: CollectionItem[] = [];
  let cur = map.get(collectionId);
  while (cur) { path.unshift(cur); cur = cur.parentId ? map.get(cur.parentId) : undefined; }
  return path;
}

export default function CollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const collectionId = id ? parseInt(id) : null;

  const { data: collections } = useListCollections();
  const { data: serverBookmarks, isLoading } = useListBookmarks(collectionId ? { collectionId } : {});

  const [ordered, setOrdered] = useState<BookmarkItem[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [newSubfolderOpen, setNewSubfolderOpen] = useState(false);
  const [newSubfolderName, setNewSubfolderName] = useState("");
  const [newSubfolderColor, setNewSubfolderColor] = useState("#6366f1");

  useEffect(() => { if (serverBookmarks) setOrdered(serverBookmarks as BookmarkItem[]); }, [serverBookmarks]);

  const allCollections = (collections ?? []) as CollectionItem[];
  const collection = allCollections.find((c) => c.id === collectionId);
  const subfolders = allCollections.filter((c) => c.parentId === collectionId).sort((a, b) => a.name.localeCompare(b.name));
  const breadcrumb = collectionId ? buildBreadcrumb(collectionId, allCollections) : [];

  const updateBookmark = useUpdateBookmark();
  const createCollection = useCreateCollection();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const activeBookmark = activeId ? ordered.find((b) => b.id === activeId) ?? null : null;

  function handleDragStart(event: DragStartEvent) { setActiveId(event.active.id as number); }

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
        updateBookmark.mutate({ id: bm.id, data: { sortOrder: idx } }, {
          onSuccess: () => queryClient.invalidateQueries({ queryKey: getListBookmarksQueryKey() }),
        });
      }
    });
  }

  const handleCreateSubfolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubfolderName || !collectionId) return;
    createCollection.mutate(
      { data: { name: newSubfolderName, color: newSubfolderColor, parentId: collectionId } as any },
      {
        onSuccess: () => {
          setNewSubfolderOpen(false);
          setNewSubfolderName("");
          toast({ title: "Subfolder created" });
          queryClient.invalidateQueries({ queryKey: getListCollectionsQueryKey() });
        },
      }
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-none px-5 py-4 border-b border-border bg-background">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 mb-2.5 text-[12px] text-muted-foreground/60 flex-wrap">
          <Link href="/collections">
            <button className="hover:text-muted-foreground transition-colors flex items-center gap-1">
              <Folder className="h-3 w-3" /> Folders
            </button>
          </Link>
          {breadcrumb.map((crumb, i) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <ChevronRight className="h-2.5 w-2.5 shrink-0" />
              {i < breadcrumb.length - 1 ? (
                <Link href={`/collections/${crumb.id}`}>
                  <button className="hover:text-muted-foreground transition-colors">{crumb.name}</button>
                </Link>
              ) : (
                <span className="text-foreground/80 font-medium">{crumb.name}</span>
              )}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${collection?.color || "#6366f1"}18`, color: collection?.color || "#6366f1" }}
          >
            <FolderOpen className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold tracking-tight truncate">{collection?.name ?? "Folder"}</h1>
            {collection?.description && (
              <p className="text-[12px] text-muted-foreground truncate">{collection.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" className="h-7 text-[12px] px-2.5 gap-1.5 text-muted-foreground hover:text-foreground" onClick={() => setNewSubfolderOpen(true)}>
              <FolderPlus className="h-3.5 w-3.5" /> Subfolder
            </Button>
            <span className="text-[12px] text-muted-foreground">{ordered.length} item{ordered.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      {/* Subfolders strip */}
      {subfolders.length > 0 && (
        <div className="flex-none px-5 py-2 border-b border-border bg-muted/10 flex items-center gap-2 flex-wrap">
          {subfolders.map((sf) => (
            <Link key={sf.id} href={`/collections/${sf.id}`}>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-card hover:border-border/80 hover:bg-muted/40 transition-colors cursor-pointer">
                <div
                  className="w-3.5 h-3.5 rounded-sm flex items-center justify-center shrink-0"
                  style={{ color: sf.color || "#6366f1" }}
                >
                  <Folder className="h-3 w-3" />
                </div>
                <span className="text-[12px] font-medium">{sf.name}</span>
                <span className="text-[10px] text-muted-foreground/60">{sf.bookmarkCount ?? 0}</span>
                <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/40" />
              </div>
            </Link>
          ))}
        </div>
      )}

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
            <p className="text-sm font-medium text-muted-foreground">No bookmarks in this folder</p>
            <p className="text-[12px] text-muted-foreground/60">Add bookmarks here from the Bookmarks page.</p>
            <Link href="/"><Button variant="outline" size="sm">Go to Bookmarks</Button></Link>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <SortableContext items={ordered.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <div className="divide-y divide-border">
                {ordered.map((b) => (
                  <BookmarkRow key={b.id} bookmark={b} collections={allCollections} />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeBookmark ? (
                <div className="bg-card border border-primary/40 shadow-2xl opacity-95">
                  <BookmarkRow bookmark={activeBookmark} collections={allCollections} isDragging />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* New subfolder dialog */}
      <Dialog open={newSubfolderOpen} onOpenChange={setNewSubfolderOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Subfolder in "{collection?.name}"</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateSubfolder} className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-[13px] font-medium">Name</label>
              <Input value={newSubfolderName} onChange={(e) => setNewSubfolderName(e.target.value)} placeholder="e.g. Tutorials" autoFocus className="text-[13px]" />
            </div>
            <div className="space-y-2">
              <label className="text-[13px] font-medium">Color</label>
              <div className="flex items-center gap-2">
                <Input type="color" value={newSubfolderColor} onChange={(e) => setNewSubfolderColor(e.target.value)} className="w-10 h-8 p-0.5 cursor-pointer" />
                <Input type="text" value={newSubfolderColor} onChange={(e) => setNewSubfolderColor(e.target.value)} className="flex-1 font-mono text-[12px]" />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setNewSubfolderOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={!newSubfolderName || createCollection.isPending}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BookmarkRow({
  bookmark, collections, isDragging = false,
}: {
  bookmark: BookmarkItem; collections: CollectionItem[]; isDragging?: boolean;
}) {
  const togglePin = useToggleBookmarkPin();
  const deleteBookmark = useDeleteBookmark();
  const updateBookmark = useUpdateBookmark();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(bookmark.title);
  const [editDescription, setEditDescription] = useState(bookmark.description || "");
  const [editCollectionId, setEditCollectionId] = useState<string>(
    bookmark.collectionId ? String(bookmark.collectionId) : "none"
  );

  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } =
    useSortable({ id: bookmark.id });

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isSortableDragging ? 0.25 : 1 };

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
      },
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle) return;
    updateBookmark.mutate(
      { id: bookmark.id, data: { title: editTitle, description: editDescription, collectionId: editCollectionId !== "none" ? parseInt(editCollectionId) : null } },
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

        {/* Site icon */}
        <SiteIcon url={bookmark.url} favicon={bookmark.favicon} bookmarkId={bookmark.id} size={36} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[13px] font-medium truncate">{bookmark.title}</span>
            {bookmark.pinned && <Star className="h-2.5 w-2.5 text-yellow-400 fill-yellow-400 shrink-0" />}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-muted-foreground/60 truncate">{domain}</span>
            {bookmark.tags && bookmark.tags.length > 0 && (
              <div className="flex gap-1">
                {bookmark.tags.slice(0, 3).map((t) => (
                  <span key={t.id} className="text-[10px] px-1 py-px rounded-sm bg-secondary text-muted-foreground font-medium">#{t.name}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
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
                  <SelectItem value="none">— No folder —</SelectItem>
                  {collections.sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
