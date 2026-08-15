import { useState } from "react";
import { 
  useImportBookmarks,
  useListCollections,
  getListBookmarksQueryKey,
  getGetBookmarkStatsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { UploadCloud, FileCode2, Info, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState("file");
  const [htmlContent, setHtmlContent] = useState("");
  const [collectionId, setCollectionId] = useState<string>("none");
  const [importResult, setImportResult] = useState<any>(null);
  
  const { data: collections } = useListCollections();
  const importMutation = useImportBookmarks();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setHtmlContent(content);
        setActiveTab("paste"); // Switch to paste tab to show what was loaded
        toast({ title: "File loaded", description: `Loaded ${file.name}` });
      }
    };
    reader.readAsText(file);
  };
  
  const handleImport = () => {
    if (!htmlContent) return;
    
    const colId = collectionId !== "none" ? parseInt(collectionId) : null;
    
    importMutation.mutate({ data: { html: htmlContent, collectionId: colId } }, {
      onSuccess: (data) => {
        setImportResult(data);
        setHtmlContent("");
        toast({ title: "Import complete!" });
        queryClient.invalidateQueries({ queryKey: getListBookmarksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBookmarkStatsQueryKey() });
      },
      onError: () => {
        toast({ title: "Import failed", description: "Failed to parse or save bookmarks.", variant: "destructive" });
      }
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Import Bookmarks</h1>
        <p className="text-muted-foreground text-sm">Bring your existing bookmarks from your browser into Loot.</p>
      </div>
      
      {importResult && (
        <Alert className="bg-primary/10 border-primary/20 text-primary-foreground">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <AlertTitle className="text-primary font-bold">Import Successful</AlertTitle>
          <AlertDescription className="text-primary/90 mt-2">
            <ul className="list-disc pl-5 space-y-1">
              <li>{importResult.imported} bookmarks imported</li>
              <li>{importResult.skipped} duplicates skipped</li>
              {importResult.errors > 0 && (
                <li className="text-destructive font-medium">{importResult.errors} failed to import</li>
              )}
            </ul>
          </AlertDescription>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setImportResult(null)}>
            Dismiss
          </Button>
        </Alert>
      )}
      
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-lg">Instructions</CardTitle>
            <CardDescription>How to export from your browser</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="chrome" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="chrome">Chrome / Edge</TabsTrigger>
                <TabsTrigger value="firefox">Firefox</TabsTrigger>
              </TabsList>
              <TabsContent value="chrome" className="text-sm text-muted-foreground mt-4 space-y-2">
                <p>1. Open Chrome and press <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">Ctrl+Shift+O</kbd> (Windows) or <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">Cmd+Option+B</kbd> (Mac) to open Bookmark Manager.</p>
                <p>2. Click the three dots icon in the top right corner.</p>
                <p>3. Select <strong>Export bookmarks</strong>.</p>
                <p>4. Save the HTML file to your computer.</p>
              </TabsContent>
              <TabsContent value="firefox" className="text-sm text-muted-foreground mt-4 space-y-2">
                <p>1. Open Firefox and press <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">Ctrl+Shift+O</kbd> (Windows) or <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">Cmd+Shift+O</kbd> (Mac) to open Library.</p>
                <p>2. Click the <strong>Import and Backup</strong> button.</p>
                <p>3. Select <strong>Export Bookmarks to HTML...</strong></p>
                <p>4. Save the HTML file to your computer.</p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Upload Data</CardTitle>
            <CardDescription>Upload the HTML file or paste its contents</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Target Collection (Optional)</label>
              <Select value={collectionId} onValueChange={setCollectionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a collection" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Uncategorized --</SelectItem>
                  {collections?.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="file">Upload File</TabsTrigger>
                <TabsTrigger value="paste">Paste HTML</TabsTrigger>
              </TabsList>
              
              <TabsContent value="file" className="mt-4">
                <div className="border-2 border-dashed border-border rounded-xl p-10 text-center hover:bg-muted/30 transition-colors flex flex-col items-center justify-center relative">
                  <input 
                    type="file" 
                    accept=".html" 
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <UploadCloud className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-1">Click or drag file here</h3>
                  <p className="text-sm text-muted-foreground">Requires standard Netscape Bookmark HTML format</p>
                </div>
              </TabsContent>
              
              <TabsContent value="paste" className="mt-4">
                <Textarea 
                  placeholder="<!DOCTYPE NETSCAPE-Bookmark-file-1>..." 
                  className="min-h-[250px] font-mono text-xs"
                  value={htmlContent}
                  onChange={e => setHtmlContent(e.target.value)}
                />
              </TabsContent>
            </Tabs>
            
            <div className="pt-2 flex justify-end">
              <Button onClick={handleImport} disabled={!htmlContent || importMutation.isPending} size="lg">
                <FileCode2 className="w-4 h-4 mr-2" />
                {importMutation.isPending ? "Importing..." : "Process Import"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
