# Bookmark-Organizer — Tower Deploy Notes (racetrack)

Self-hosted bookmark manager (with browser extension). Deployed on the tower (Debian/Proxmox VM), reachable over LAN + Tailscale.

## Access URLs
| What | URL |
|---|---|
| Web UI (served) | http://100.122.128.43:8082  (LAN/Tailscale) |
| Web UI (localhost) | http://localhost:8082 |
| API | http://100.122.128.43:3002  (publishes 127.0.0.1:3002) |
| Favicon proxy (Rust) | http://100.122.128.43:3011 |
| Forgejo repo | http://100.122.128.43:3000/mcqueen/bookmark-organizer |

## Architecture
- **API**: Node/Express (`artifacts/api-server`), systemd user unit `bookmark-api.service` (`Restart=always`). Reads `DATABASE_URL` from gitignored `.env` (the `Bookmark DB URL` field from Vaultwarden item `Coffee Talk API Keys`). Unit `WorkingDirectory=/home/mcqueen/bookmark-organizer-host` and sources that `.env`.
- **Web**: Rust `static-server` binary on `:8082`, proxies `/api/*` → `:3002`, and routes `/api/favicon` → the standalone Rust favicon proxy on `:3011`. systemd unit `bookmark-web.service` (`After=bookmark-api.service favicon-proxy.service`, `Requires=...`).
- **Favicon proxy**: Rust binary `favicon-proxy-rs` on `:3011`, systemd `favicon-proxy.service`. Disk-cached; survives restarts.
- **DB**: Postgres in `tmp-db-1`, `coffee` role, database `bookmark_organizer`. Named volume — **survives reboots** (176 bookmarks intact after the 2026-07-23 reboot).
- Working dir: **`/home/mcqueen/bookmark-organizer-host`** (persistent).

## 🚨 CRITICAL: deploy paths are PERSISTENT — never /tmp
`/tmp` is wiped on every tower reboot. The 2026-07-23 reboot killed BOTH the Bookmark API (working dir `/tmp/bookmark-organizer-host` gone → unit CHDIR failed, auto-restart loop) AND the frontend (`/tmp/bookmark-app` empty → 404).
- Frontend static dir: **`/home/mcqueen/bookmark-app`** (served by `static-server`)
- Repo working dir: **`/home/mcqueen/bookmark-organizer-host`**
- After any fix, verify: `grep -rE '/tmp' ~/.config/systemd/user/*.service` → must be EMPTY.

## Rebuild after a reboot / /tmp wipe (full)
```bash
git clone /home/mcqueen/forgejo/data/git/repositories/mcqueen/bookmark-organizer.git /home/mcqueen/bookmark-organizer-host
# .env: pull Bookmark DB URL -> DATABASE_URL; add PORT=3002, NODE_ENV=production (chmod 600)
cd /home/mcqueen/bookmark-organizer-host
export PATH=/home/mcqueen/.local/bin:$PATH
pnpm install --prefer-offline
pnpm --filter @workspace/api-server run build
cd artifacts/bookmark-manager && PORT=5173 BASE_PATH=/ NODE_ENV=production pnpm run build
mkdir -p /home/mcqueen/bookmark-app && cp -r dist/public/. /home/mcqueen/bookmark-app/
systemctl --user daemon-reload && systemctl --user restart bookmark-api bookmark-web
```
Full recipe: Hermes spellbook `tower-selfhost-apps` → `references/rebuild-after-tmp-wipe.md`.

## Verify
```bash
curl -s -o /dev/null -w '%{http_code}' http://localhost:8082/        # expect 200
curl -s http://127.0.0.1:3002/api/bookmarks | python3 -c "import sys,json;print(len(json.load(sys.stdin)))"  # expect 176
```

## Notes
- This `DEPLOY.md` is a human-readable runbook. Authoritative recipe: Hermes spellbook `tower-selfhost-apps`.
- Secrets never committed (`.env` gitignored). The browser extension reads its API base from `localStorage` key `markbase_api_url` (default `http://racetrack:8082`).
- Built with pnpm; `minimumReleaseAge:1440` supply-chain guard respected.
