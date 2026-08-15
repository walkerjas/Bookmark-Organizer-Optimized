import { useState } from "react";
import { useListBookmarks, useListCollections } from "@workspace/api-client-react";
import { UploadCloud, FileDown, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type ExportFormat = "all" | "collection" | "pinned";

function buildNetscapeHtml(
  bookmarks: Array<{
    url: string;
    title: string;
    description?: string | null;
    createdAt: string;
    tags?: Array<{ name: string }>;
  }>
): string {
  const items = bookmarks
    .map((bm) => {
      const addDate = Math.floor(new Date(bm.createdAt).getTime() / 1000);
      const tags = bm.tags?.map((t) => t.name).join(",") ?? "";
      const tagsAttr = tags ? ` TAGS="${tags}"` : "";
      const line = `    <DT><A HREF="${bm.url}" ADD_DATE="${addDate}"${tagsAttr}>${bm.title}</A>`;
      const desc = bm.description
        ? `\n    <DD>${bm.description}`
        : "";
      return line + desc;
    })
    .join("\n");

  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
${items}
</DL><p>`;
}

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/html;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportPage() {
  const [format, setFormat] = useState<ExportFormat>("all");
  const [collectionId, setCollectionId] = useState<string>("");
  const [exported, setExported] = useState(false);

  const { data: collections = [] } = useListCollections();
  const { data: allBookmarks = [], isLoading } = useListBookmarks(
    format === "pinned"
      ? { pinned: true }
      : format === "collection" && collectionId
      ? { collectionId: Number(collectionId) }
      : {}
  );

  function handleExport() {
    const html = buildNetscapeHtml(allBookmarks);
    const filename =
      format === "collection" && collectionId
        ? `markbase-${collections.find((c) => String(c.id) === collectionId)?.name ?? "collection"}.html`
        : format === "pinned"
        ? "markbase-pinned.html"
        : "markbase-all-bookmarks.html";

    downloadFile(html, filename);
    setExported(true);
    setTimeout(() => setExported(false), 3000);
  }

  const isReady =
    format === "all" ||
    format === "pinned" ||
    (format === "collection" && !!collectionId);

  return (
    <div className="max-w-2xl mx-auto p-6 md:p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Export Bookmarks</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Download your bookmarks as a Netscape HTML file — compatible with Firefox and Chrome.
        </p>
      </div>

      {/* Format selector */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          What to export
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(
            [
              { value: "all", label: "All Bookmarks", count: null },
              { value: "pinned", label: "Pinned Only", count: null },
              { value: "collection", label: "By Collection", count: null },
            ] as { value: ExportFormat; label: string; count: null }[]
          ).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFormat(opt.value)}
              className={cn(
                "rounded-md border px-4 py-3 text-sm font-medium text-left transition-colors",
                format === opt.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-foreground hover:border-primary/50"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {format === "collection" && (
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">
              Select collection
            </label>
            <Select value={collectionId} onValueChange={setCollectionId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a collection..." />
              </SelectTrigger>
              <SelectContent>
                {collections.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                    <span className="ml-2 text-muted-foreground text-xs">
                      ({c.bookmarkCount ?? 0})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Preview count */}
        {!isLoading && isReady && (
          <p className="text-xs text-muted-foreground">
            {allBookmarks.length} bookmark{allBookmarks.length !== 1 ? "s" : ""} will be exported.
          </p>
        )}
      </div>

      {/* How to import instructions */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          How to import into your browser
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground">Firefox</p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Open the Bookmarks menu</li>
              <li>Click <span className="font-medium text-foreground">Manage Bookmarks</span></li>
              <li>Click <span className="font-medium text-foreground">Import and Backup</span></li>
              <li>Select <span className="font-medium text-foreground">Import Bookmarks from HTML</span></li>
              <li>Choose the downloaded file</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground">Chrome / Edge</p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Open <span className="font-medium text-foreground">chrome://bookmarks</span></li>
              <li>Click the menu icon (top right)</li>
              <li>Select <span className="font-medium text-foreground">Import bookmarks</span></li>
              <li>Choose the downloaded file</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Download button */}
      <div className="flex items-center gap-3">
        <Button
          size="lg"
          onClick={handleExport}
          disabled={!isReady || isLoading || allBookmarks.length === 0}
          className="gap-2"
        >
          {exported ? (
            <>
              <CheckCircle className="w-4 h-4" />
              Downloaded
            </>
          ) : (
            <>
              <FileDown className="w-4 h-4" />
              Download HTML
            </>
          )}
        </Button>
        {allBookmarks.length === 0 && isReady && !isLoading && (
          <p className="text-xs text-muted-foreground">No bookmarks match your selection.</p>
        )}
      </div>
    </div>
  );
}
