import { useState } from "react";
import { BookMarked, Star, FolderOpen, Settings as SettingsIcon } from "lucide-react";
import Vault from "@/pages/vault";
import Favorites from "@/pages/favorites";
import Collections from "@/pages/collections";
import SettingsPage from "@/pages/settings";
import { useSettings } from "@/hooks/use-settings";

type Tab = "vault" | "favorites" | "collections" | "settings";

const TABS: { id: Tab; icon: React.ElementType; label: string }[] = [
  { id: "vault", icon: BookMarked, label: "Vault" },
  { id: "favorites", icon: Star, label: "Favorites" },
  { id: "collections", icon: FolderOpen, label: "Collections" },
  { id: "settings", icon: SettingsIcon, label: "Settings" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("vault");
  const { apiUrl, setApiUrl } = useSettings();
  const apiConfigured = apiUrl.trim().length > 0;

  return (
    <div className="flex flex-col w-full h-full bg-[hsl(var(--background))] overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-2.5 px-3.5 py-3 bg-[hsl(var(--header))] border-b border-[hsl(var(--border))] shrink-0">
        <div className="w-7 h-7 rounded-md bg-[hsl(var(--primary))] flex items-center justify-center shrink-0">
          <span className="text-sm">🔖</span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-[hsl(var(--foreground))] leading-none">Markbase</h1>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-none mt-0.5">
            {apiConfigured ? "Connected" : "Not configured"}
          </p>
        </div>
        <div
          className={`w-2 h-2 rounded-full shrink-0 ${apiConfigured ? "bg-[hsl(var(--success))]" : "bg-[hsl(var(--muted-foreground))]"}`}
        />
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
        {tab === "vault" && <Vault apiConfigured={apiConfigured} />}
        {tab === "favorites" && <Favorites apiConfigured={apiConfigured} />}
        {tab === "collections" && <Collections apiConfigured={apiConfigured} />}
        {tab === "settings" && <SettingsPage apiUrl={apiUrl} onSave={setApiUrl} />}
      </main>

      {/* Bottom tab bar */}
      <nav className="flex items-stretch bg-[hsl(var(--header))] border-t border-[hsl(var(--border))] shrink-0">
        {TABS.map(({ id, icon: Icon, label }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 relative flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors ${
                active
                  ? "text-[hsl(var(--primary))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              <Icon size={17} strokeWidth={active ? 2.5 : 1.8} />
              <span className={`text-[10px] font-medium ${active ? "opacity-100" : "opacity-75"}`}>
                {label}
              </span>
              {active && (
                <div className="absolute bottom-0 w-8 h-0.5 bg-[hsl(var(--primary))] rounded-t" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
