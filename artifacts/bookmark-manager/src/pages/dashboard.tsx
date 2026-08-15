import { useGetBookmarkStats, useGetRecentBookmarks } from "@workspace/api-client-react";
import { Bookmark, Folder, Hash, Pin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SiteIcon } from "@/components/site-icon";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetBookmarkStats();
  const { data: recent, isLoading: recentLoading } = useGetRecentBookmarks();

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Overview of your knowledge base.</p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard title="Total Links" value={stats?.total || 0} icon={Bookmark} />
            <StatCard title="Pinned" value={stats?.pinned || 0} icon={Pin} />
            <StatCard title="Collections" value={stats?.collections || 0} icon={Folder} />
            <StatCard title="Tags" value={stats?.tags || 0} icon={Hash} />
          </>
        )}
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle>Recently Added</CardTitle>
          </CardHeader>
          <CardContent>
            {recentLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : recent && recent.length > 0 ? (
              <div className="space-y-3">
                {recent.map((b) => (
                  <a
                    key={b.id}
                    href={b.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 hover:border-primary/40 transition-colors cursor-pointer"
                  >
                    <SiteIcon url={b.url} favicon={b.favicon} bookmarkId={b.id} size={24} className="rounded-sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{b.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{(() => { try { return new URL(b.url).hostname; } catch { return b.url; } })()}</div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground py-8 text-center border rounded-lg border-dashed">
                No recent bookmarks
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon }: { title: string, value: number, icon: any }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
