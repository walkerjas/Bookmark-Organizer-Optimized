import { useState, useEffect } from "react";
import { ExternalLink, CheckCircle2, XCircle, Loader2, Save } from "lucide-react";
import { checkHealth } from "@/lib/api";

interface Props {
  apiUrl: string;
  onSave: (url: string) => void;
}

type Status = "idle" | "checking" | "ok" | "error";

export default function Settings({ apiUrl, onSave }: Props) {
  const [input, setInput] = useState(apiUrl);
  const [status, setStatus] = useState<Status>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => { setInput(apiUrl); }, [apiUrl]);

  async function handleTest() {
    const trimmed = input.trim().replace(/\/api\/?$/, "");
    if (!trimmed) return;
    setStatus("checking");
    setStatusMsg("");
    const old = localStorage.getItem("markbase_api_url") || "";
    localStorage.setItem("markbase_api_url", trimmed);
    const ok = await checkHealth();
    localStorage.setItem("markbase_api_url", old);
    if (ok) {
      setStatus("ok");
      setStatusMsg("Connected successfully");
    } else {
      setStatus("error");
      setStatusMsg("Could not reach the API. Check the URL and CORS settings.");
    }
  }

  function handleSave() {
    // Normalize: drop a trailing /api (it's appended automatically by api.ts)
    const normalized = input.trim().replace(/\/api\/?$/, "");
    onSave(normalized);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  const appUrl = input.trim()
    ? input.trim().replace(/\/api\/?$/, "")
    : null;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[hsl(var(--border))]">
        <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Settings</span>
      </div>

      <div className="flex flex-col gap-5 px-4 py-5">
        {/* API URL */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Markbase API URL</label>
          <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
            Enter the base URL of your deployed Markbase instance (no <code className="text-[hsl(var(--primary))] bg-[hsl(var(--muted))] px-1 rounded text-xs">/api</code> needed — it's added automatically).
          </p>
          <input
            id="markbase-api-url"
            name="markbase_api_url"
            autoComplete="url"
            type="url"
            value={input}
            onChange={e => { setInput(e.target.value); setStatus("idle"); setSaved(false); }}
            placeholder="https://your-host:8082"
            className="w-full px-3 py-2 rounded-md bg-[hsl(var(--input))] border border-[hsl(var(--border))] text-sm text-[hsl(var(--foreground))] outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] placeholder:text-[hsl(var(--muted-foreground))] font-mono"
          />

          {/* Status */}
          {status !== "idle" && (
            <div className={`flex items-center gap-2 text-xs ${status === "ok" ? "text-[hsl(var(--success))]" : status === "error" ? "text-[hsl(var(--destructive))]" : "text-[hsl(var(--muted-foreground))]"}`}>
              {status === "checking" && <Loader2 size={12} className="animate-spin" />}
              {status === "ok" && <CheckCircle2 size={12} />}
              {status === "error" && <XCircle size={12} />}
              {status === "checking" ? "Testing connection…" : statusMsg}
            </div>
          )}

          <div className="flex gap-2 mt-1">
            <button
              onClick={handleTest}
              disabled={!input.trim() || status === "checking"}
              className="flex-1 py-1.5 rounded-md border border-[hsl(var(--border))] text-sm hover:bg-[hsl(var(--accent))] disabled:opacity-50 transition-colors"
            >
              Test Connection
            </button>
            <button
              onClick={handleSave}
              disabled={!input.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saved ? (
                <>
                  <CheckCircle2 size={13} />
                  Saved!
                </>
              ) : (
                <>
                  <Save size={13} />
                  Save
                </>
              )}
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-[hsl(var(--border))]" />

        {/* Open app */}
        {appUrl && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Open Markbase</label>
            <a
              href={appUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-[hsl(var(--card))] border border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))] transition-colors group"
            >
              <div className="w-8 h-8 rounded-md bg-[hsl(var(--primary)/0.15)] flex items-center justify-center">
                <span className="text-base">🔖</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Markbase Web App</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{appUrl}</p>
              </div>
              <ExternalLink size={14} className="text-[hsl(var(--muted-foreground))] group-hover:text-[hsl(var(--foreground))] transition-colors shrink-0" />
            </a>
          </div>
        )}

        {/* About */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">About</label>
          <div className="rounded-md bg-[hsl(var(--card))] border border-[hsl(var(--border))] px-3 py-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔖</span>
              <div>
                <p className="text-sm font-semibold">Markbase</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Browser Extension · v1.0.0</p>
              </div>
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
              Save and access your bookmarks from any page. Connects to your self-hosted Markbase instance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
