import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import NotFound from "@/pages/not-found";
import Layout from "@/components/layout";
import Bookmarks from "@/pages/bookmarks";
import Collections from "@/pages/collections";
import Tags from "@/pages/tags";
import TagDetail from "@/pages/tag-detail";
import ImportPage from "@/pages/import";
import ExportPage from "@/pages/export";
import Favorites from "@/pages/favorites";
import CollectionDetail from "@/pages/collection-detail";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: { retry: 0 },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Bookmarks} />
        <Route path="/collections" component={Collections} />
        <Route path="/collections/:id" component={CollectionDetail} />
        <Route path="/tags" component={Tags} />
        <Route path="/tags/:id" component={TagDetail} />
        <Route path="/favorites" component={Favorites} />
        <Route path="/import" component={ImportPage} />
        <Route path="/export" component={ExportPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
