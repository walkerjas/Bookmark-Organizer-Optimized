# Bookmark-Organizer — OPTIMIZED build (A/B test instance)

ChatGPT perf-pass build (from `Bookmark-Organizer-optimized.zip`).
Deployed SEPARATELY from the live instance so you can compare them.

## Ports (do NOT collide with live :3002/:8082)
- API:  `3005`  (postgres `bookmark_organizer`, same DB as live — shared data)
- Web:  `8085`  (static-server, proxies `/api` -> :3005)

## Run
    bash /home/mcqueen/bookmark-organizer-opt/start-bookmark-opt.sh

Pulls `DATABASE_URL` from Vaultwarden ("Coffee Talk API Keys" ->
"Bookmark DB URL"), builds `.env` (gitignored), deploys the prebuilt
frontend to `/tmp/bookmark-app-opt`, and starts API + web in background.

## Logs
- API:  /tmp/bookmark-api-opt.log
- Web:  /tmp/bookmark-web-opt.log

## Stop
    pkill -f "bookmark-organizer-opt/artifacts/api-server" ; pkill -f "static-server 8085"

## Test URL (over Tailscale, from your Mac/phone)
    http://100.122.128.43:8085/

## Verify health
    curl -s -m 10 "http://127.0.0.1:8085/api/bookmarks?limit=1"
    (200 = good; this build has no /api/health route, /api/bookmarks is the check)
