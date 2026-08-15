import { useState } from "react";
import {
  useListCollections,
  useCreateCollection,
  useUpdateCollection,
  useDeleteCollection,
  getListCollectionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Folder, FolderOpen, Plus, MoreVertical, Edit2, Trash2, ChevronRight, FolderPlus,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type CollectionItem = {
  id: number;
  name: string;
  description?: string | null;
  color?: string | null;
  parentId?: number | null;
  bookmarkCount?: number;
};

type FolderNode = CollectionItem & { children: FolderNode[] };

function buildTree(collections: CollectionItem[]): FolderNode[] {
  const map = new Map<number, FolderNode>(
    collections.map((c) => [c.id, { ...c, children: [] }])
  );
  const roots: FolderNode[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sort = (nodes: FolderNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

function countDescendants(node: FolderNode): number {
  return node.children.reduce((acc, c) => acc + 1 + countDescendants(c), 0);
}

export default function Collections() {
  const { data: collections, isLoading } = useListCollections();
  const createCol = useCreateCollection();
  const updateCol = useUpdateCollection();
  const deleteCol = useDeleteCollection();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [parentId, setParentId] = useState<string>("none");

  const allCollections = (collections ?? []) as CollectionItem[];
  const tree = buildTree(allCollections);

  const openNew = (presetParentId?: number) => {
    setEditingId(null);
    setName("");
    setDescription("");
    setColor("#6366f1");
    setParentId(presetParentId ? String(presetParentId) : "none");
    setIsOpen(true);
  };

  const openEdit = (col: CollectionItem) => {
    setEditingId(col.id);
    setName(col.name);
    setDescription(col.description || "");
    setColor(col.color || "#6366f1");
    setParentId(col.parentId ? String(col.parentId) : "none");
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    const pid = parentId !== "none" ? parseInt(parentId) : null;
    if (editingId) {
      updateCol.mutate(
        { id: editingId, data: { name, description, color, parentId: pid } as any },
        {
          onSuccess: () => {
            setIsOpen(false);
            toast({ title: "Folder updated" });
            queryClient.invalidateQueries({ queryKey: getListCollectionsQueryKey() });
          },
        }
      );
    } else {
      createCol.mutate(
        { data: { name, description, color, parentId: pid } as any },
        {
          onSuccess: () => {
            setIsOpen(false);
            toast({ title: "Folder created" });
            queryClient.invalidateQueries({ queryKey: getListCollectionsQueryKey() });
          },
        }
      );
    }
  };

  const handleDelete = (id: number) => {
    const col = allCollections.find((c) => c.id === id);
    const hasChildren = allCollections.some((c) => c.parentId === id);
    const msg = hasChildren
      ? `"${col?.name}" has subfolders. Deleting it will move them to the top level. Continue?`
      : `Delete "${col?.name}"?`;
    if (confirm(msg)) {
      deleteCol.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Folder deleted" });
          queryClient.invalidateQueries({ queryKey: getListCollectionsQueryKey() });
        },
      });
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-none px-5 py-4 border-b border-border flex items-center justify-between bg-background">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Folders</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {allCollections.length} folder{allCollections.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" className="h-7 text-[13px] px-3 gap-1.5" onClick={() => openNew()}>
          <FolderPlus className="w-3.5 h-3.5" />
          New Folder
        </Button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-5 py-3">
                <Skeleton className="h-4 w-48 mb-1" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </div>
        ) : tree.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[50vh] gap-3 text-center px-4">
            <Folder className="h-8 w-8 text-muted-foreground/20" />
            <p className="text-sm font-medium text-muted-foreground">No folders yet</p>
            <p className="text-[12px] text-muted-foreground/60">Create folders to organize your bookmarks.</p>
            <Button variant="outline" size="sm" className="mt-1" onClick={() => openNew()}>
              <FolderPlus className="w-3.5 h-3.5 mr-2" />
              Create folder
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {tree.map((node) => (
              <FolderRow
                key={node.id}
                node={node}
                depth={0}
                allCollections={allCollections}
                onEdit={openEdit}
                onDelete={handleDelete}
                onNewChild={(id) => openNew(id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Folder" : "New Folder"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-[13px] font-medium">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Design Inspiration" autoFocus className="text-[13px]" />
            </div>
            <div className="space-y-2">
              <label className="text-[13px] font-medium">Description</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" className="text-[13px]" />
            </div>
            <div className="space-y-2">
              <label className="text-[13px] font-medium">Parent Folder</label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger className="text-[13px]"><SelectValue placeholder="None (top-level)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (top-level)</SelectItem>
                  {allCollections.filter((c) => c.id !== editingId).sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-[13px] font-medium">Color</label>
              <div className="flex items-center gap-2">
                <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-8 p-0.5 cursor-pointer" />
                <Input type="text" value={color} onChange={(e) => setColor(e.target.value)} className="flex-1 font-mono text-[12px]" />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={!name || createCol.isPending || updateCol.isPending}>
                {editingId ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FolderRow({
  node,
  depth,
  allCollections,
  onEdit,
  onDelete,
  onNewChild,
}: {
  node: FolderNode;
  depth: number;
  allCollections: CollectionItem[];
  onEdit: (col: CollectionItem) => void;
  onDelete: (id: number) => void;
  onNewChild: (parentId: number) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const subCount = countDescendants(node);

  return (
    <>
      <div
        className="group flex items-center gap-3 px-5 py-2.5 hover:bg-muted/30 transition-colors"
        style={{ paddingLeft: `${20 + depth * 16}px` }}
      >
        {/* Expand */}
        {hasChildren ? (
          <button
            className="shrink-0 text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors"
            onClick={() => setExpanded((v) => !v)}
          >
            <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", expanded && "rotate-90")} />
          </button>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}

        {/* Icon */}
        <div
          className="w-6 h-6 rounded flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${node.color || "#6366f1"}18`, color: node.color || "#6366f1" }}
        >
          {expanded && hasChildren
            ? <FolderOpen className="h-3.5 w-3.5" />
            : <Folder className="h-3.5 w-3.5" />}
        </div>

        {/* Info */}
        <Link href={`/collections/${node.id}`} className="flex-1 min-w-0 cursor-pointer">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium truncate">{node.name}</span>
            {subCount > 0 && (
              <span className="text-[10px] px-1.5 py-px rounded-sm bg-secondary text-muted-foreground font-medium shrink-0">
                {subCount} sub
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5 truncate">
            {node.bookmarkCount ?? 0} bookmark{(node.bookmarkCount ?? 0) !== 1 ? "s" : ""}
            {node.description ? ` · ${node.description}` : ""}
          </p>
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Link href={`/collections/${node.id}`}>
            <button className="p-1.5 rounded text-muted-foreground/40 hover:text-muted-foreground transition-colors">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-1.5 rounded text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                onClick={(e) => e.preventDefault()}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 text-[13px]">
              <DropdownMenuItem onClick={() => onNewChild(node.id)}>
                <FolderPlus className="w-3.5 h-3.5 mr-2" /> New subfolder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(node)}>
                <Edit2 className="w-3.5 h-3.5 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(node.id)}
                className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {expanded && hasChildren && node.children.map((child) => (
        <FolderRow
          key={child.id}
          node={child}
          depth={depth + 1}
          allCollections={allCollections}
          onEdit={onEdit}
          onDelete={onDelete}
          onNewChild={onNewChild}
        />
      ))}
    </>
  );
}
