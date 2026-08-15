import React, { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Bookmark, Hash, DownloadCloud, UploadCloud, Sun, Moon, Plus, Star,
  Folder, FolderOpen, ChevronRight, ChevronDown, Shield, RefreshCw,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useCreateBookmark,
  useListCollections,
  getGetBookmarkStatsQueryKey,
  getGetRecentBookmarksQueryKey,
  getListBookmarksQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type CollectionItem = {
  id: number;
  name: string;
  color?: string | null;
  parentId?: number | null;
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

function NavItem({
  href,
  label,
  icon: Icon,
  location,
  exact = false,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  location: string;
  exact?: boolean;
}) {
  const isActive = exact ? location === href : location === href || (href !== "/" && location.startsWith(href));
  return (
    <Link href={href}>
      <div
        className={cn(
          "flex items-center gap-2.5 px-3 py-1.5 rounded text-[13px] font-medium transition-colors cursor-pointer select-none",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
        )}
      >
        <Icon className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-primary" : "text-sidebar-foreground/40")} />
        {label}
      </div>
    </Link>
  );
}

function RefreshIconsButton() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  async function handleRefresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/bookmarks/refresh-favicons", { method: "POST" });
      if (!res.ok) throw new Error(`Refresh failed (${res.status})`);
      const data = await res.json();
      toast({ title: `Icons refreshed — updated ${data.updated} of ${data.total} bookmarks` });
      queryClient.invalidateQueries({ queryKey: getListBookmarksQueryKey() });
    } catch {
      toast({ title: "Failed to refresh icons", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={loading}
      className={cn(
        "flex items-center gap-2.5 px-3 py-1.5 w-full rounded text-[13px] font-medium transition-colors",
        "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 disabled:opacity-50"
      )}
    >
      <RefreshCw className={cn("w-3.5 h-3.5 shrink-0 text-sidebar-foreground/40", loading && "animate-spin")} />
      {loading ? "Refreshing…" : "Refresh Icons"}
    </button>
  );
}

function FolderTreeItem({
  node,
  depth,
  location,
}: {
  node: FolderNode;
  depth: number;
  location: string;
}) {
  const href = `/collections/${node.id}`;
  const isActive = location === href || location.startsWith(href + "/");
  const hasChildren = node.children.length > 0;
  const [expanded, setExpanded] = useState(isActive);

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1.5 rounded text-[13px] transition-colors cursor-pointer select-none group",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
        )}
        style={{ paddingLeft: `${12 + depth * 12}px`, paddingRight: 8, paddingTop: 5, paddingBottom: 5 }}
      >
        {hasChildren ? (
          <button
            className="shrink-0 text-sidebar-foreground/30 hover:text-sidebar-foreground/70 transition-colors"
            onClick={(e) => { e.preventDefault(); setExpanded((v) => !v); }}
          >
            {expanded
              ? <ChevronDown className="w-3 h-3" />
              : <ChevronRight className="w-3 h-3" />}
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}

        <Link href={href} className="flex items-center gap-2 flex-1 min-w-0 font-medium">
          {isActive || expanded
            ? <FolderOpen className="w-3.5 h-3.5 shrink-0 text-primary" />
            : <Folder className="w-3.5 h-3.5 shrink-0 text-sidebar-foreground/35" />}
          <span className="truncate">{node.name}</span>
        </Link>
      </div>

      {expanded && hasChildren && (
        <div className="mt-0.5 space-y-0.5">
          {node.children.map((child) => (
            <FolderTreeItem key={child.id} node={child} depth={depth + 1} location={location} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const [url, setUrl] = useState("");
  const createBookmark = useCreateBookmark();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: collections } = useListCollections();

  const tree = useMemo(
    () => buildTree((collections ?? []) as CollectionItem[]),
    [collections],
  );

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    let finalUrl = url.trim();
    if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
      finalUrl = "https://" + finalUrl;
    }
    try {
      finalUrl = new URL(finalUrl).href;
    } catch {
      toast({ title: "Enter a valid web address", variant: "destructive" });
      return;
    }
    const title = new URL(finalUrl).hostname.replace(/^www\./, "");
    createBookmark.mutate({ data: { url: finalUrl, title } }, {
      onSuccess: () => {
        setUrl("");
        toast({ title: "Bookmark saved" });
        queryClient.invalidateQueries({ queryKey: getGetBookmarkStatsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetRecentBookmarksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListBookmarksQueryKey() });
      },
      onError: () => toast({ title: "Failed to add bookmark", variant: "destructive" }),
    });
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 border-r border-sidebar-border bg-sidebar flex flex-col hidden md:flex shrink-0">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <img
              src="/site-page-icon.png"
              alt="Loot"
              className="w-7 h-7 rounded-md object-contain shrink-0"
              width={28}
              height={28}
            />
            <span className="font-semibold text-[15px] tracking-tight text-sidebar-foreground">Loot</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          <NavItem href="/" label="All Bookmarks" icon={Bookmark} location={location} exact />
          <NavItem href="/favorites" label="Favorites" icon={Star} location={location} />
          <NavItem href="/tags" label="Tags" icon={Hash} location={location} />

          {/* Folders section */}
          <div className="pt-4 pb-1 px-3 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-sidebar-foreground/30 uppercase tracking-widest">
              Folders
            </span>
            <Link href="/collections">
              <span className="text-[10px] text-sidebar-foreground/40 hover:text-sidebar-foreground/70 transition-colors cursor-pointer">
                Manage
              </span>
            </Link>
          </div>

          {tree.length === 0 ? (
            <Link href="/collections">
              <div className="flex items-center gap-2 px-3 py-1.5 text-[12px] text-sidebar-foreground/40 hover:text-sidebar-foreground/70 transition-colors cursor-pointer rounded hover:bg-sidebar-accent/60">
                <Plus className="w-3 h-3" />
                New folder
              </div>
            </Link>
          ) : (
            <div className="space-y-0.5">
              {tree.map((node) => (
                <FolderTreeItem key={node.id} node={node} depth={0} location={location} />
              ))}
            </div>
          )}

          {/* Tools */}
          <div className="pt-4 pb-1 px-3">
            <span className="text-[10px] font-semibold text-sidebar-foreground/30 uppercase tracking-widest">
              Tools
            </span>
          </div>
          <NavItem href="/import" label="Import" icon={DownloadCloud} location={location} />
          <NavItem href="/export" label="Export" icon={UploadCloud} location={location} />
          <RefreshIconsButton />
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 border-t border-sidebar-border">
          <button
            className="flex items-center gap-2.5 px-3 py-1.5 w-full rounded text-[13px] text-sidebar-foreground/50 hover:text-sidebar-foreground/80 hover:bg-sidebar-accent/60 transition-colors"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark"
              ? <Sun className="w-3.5 h-3.5 shrink-0" />
              : <Moon className="w-3.5 h-3.5 shrink-0" />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 bg-background">
        {/* Top bar */}
        <header className="h-12 border-b border-border flex items-center px-4 md:px-5 shrink-0 bg-background z-10 gap-3">
          <form onSubmit={handleQuickAdd} className="flex flex-1 gap-2 max-w-lg">
            <Input
              placeholder="Paste a URL to save…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={createBookmark.isPending}
              className="h-7 text-[13px] bg-muted/60 border-border/60 placeholder:text-muted-foreground/50"
            />
            <Button
              type="submit"
              size="sm"
              disabled={createBookmark.isPending || !url}
              className="h-7 text-[13px] gap-1.5 shrink-0 px-3"
            >
              <Plus className="w-3 h-3" />
              Add
            </Button>
          </form>
          <div className="flex-1" />
          <button
            className="md:hidden p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </header>
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
