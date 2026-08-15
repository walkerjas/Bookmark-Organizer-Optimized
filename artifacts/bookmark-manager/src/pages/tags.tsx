import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  useListTags,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
  getListTagsQueryKey,
} from "@workspace/api-client-react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQueryClient } from "@tanstack/react-query";
import { GripVertical, Hash, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

type TagItem = { id: number; name: string; color?: string | null; sortOrder: number };

export default function Tags() {
  const { data: serverTags, isLoading } = useListTags();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [ordered, setOrdered] = useState<TagItem[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#8b5cf6");

  useEffect(() => {
    if (serverTags) setOrdered(serverTags as TagItem[]);
  }, [serverTags]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    if (ordered.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      toast({ title: "Tag already exists", variant: "destructive" });
      return;
    }
    createTag.mutate({ data: { name, color } }, {
      onSuccess: () => {
        setName("");
        toast({ title: "Tag created" });
        queryClient.invalidateQueries({ queryKey: getListTagsQueryKey() });
      },
    });
  };

  const handleDelete = (id: number) => {
    deleteTag.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Tag deleted" });
        queryClient.invalidateQueries({ queryKey: getListTagsQueryKey() });
      },
    });
  };

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ordered.findIndex((t) => t.id === active.id);
    const newIndex = ordered.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(ordered, oldIndex, newIndex);
    setOrdered(reordered);
    reordered.forEach((tag, idx) => {
      if (tag.sortOrder !== idx) {
        updateTag.mutate(
          { id: tag.id, data: { sortOrder: idx } },
          { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTagsQueryKey() }) }
        );
      }
    });
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-none px-5 py-4 border-b border-border bg-background">
        <h1 className="text-base font-semibold tracking-tight">Tags</h1>
        <p className="text-[12px] text-muted-foreground mt-0.5">Label bookmarks for quick filtering.</p>
      </div>

      {/* Create form */}
      <div className="flex-none px-5 py-3 border-b border-border">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tag name…"
              className="pl-8 h-7 text-[13px] bg-muted/50 border-border/60"
            />
          </div>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-7 h-7 rounded cursor-pointer border border-border bg-transparent p-0.5 shrink-0"
          />
          <Button type="submit" disabled={!name || createTag.isPending} size="sm" className="h-7 text-[13px] px-3 gap-1.5 shrink-0">
            <Plus className="w-3 h-3" />
            Add
          </Button>
        </form>
      </div>

      {/* Tags list */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {isLoading ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-20 rounded-full" />
            ))}
          </div>
        ) : ordered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[40vh] gap-2 text-center">
            <Hash className="h-8 w-8 text-muted-foreground/20" />
            <p className="text-sm font-medium text-muted-foreground">No tags yet</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={ordered.map((t) => t.id)} strategy={rectSortingStrategy}>
              <div className="flex flex-wrap gap-2">
                {ordered.map((tag) => (
                  <SortableTag key={tag.id} tag={tag} onDelete={handleDelete} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}

function SortableTag({
  tag,
  onDelete,
}: {
  tag: TagItem;
  onDelete: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: tag.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-card text-[12px] font-medium transition-colors hover:border-primary/40 hover:bg-muted/30"
    >
      <div
        className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3 w-3" />
      </div>
      <Link href={`/tags/${tag.id}`} className="flex items-center gap-1.5">
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: tag.color || "#8b5cf6" }}
        />
        <span className="text-foreground/80 cursor-pointer">{tag.name}</span>
      </Link>
      <button
        onClick={() => onDelete(tag.id)}
        className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/50 hover:text-destructive"
        title="Delete tag"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}
