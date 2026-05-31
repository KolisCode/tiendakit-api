#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="droplet"
REMOTE_PATH="/var/www/tiendakit-api"
PM2_NAME="tiendakit-api"
PORT=3003
LOG_FILE="/var/log/tiendakit-api-deploy.log"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

CURRENT_BRANCH=$(git -C "$SCRIPT_DIR" rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "master" ]; then
  echo "ERROR: Debes estar en 'master' para deployar (actual: $CURRENT_BRANCH)"
  exit 1
fi

if ! git -C "$SCRIPT_DIR" diff --quiet || ! git -C "$SCRIPT_DIR" diff --cached --quiet; then
  echo "ERROR: Hay cambios sin commitear. Haz commit o stash antes de deployar."
  exit 1
fi

log "=== Deploy tiendakit-api iniciado ==="

log "[1/4] Push a origin/master..."
git -C "$SCRIPT_DIR" push origin master
log "      push OK"

log "[2/4] git pull + npm install + build en el droplet..."
PREV_HASH=$(ssh "$REMOTE_HOST" "cd $REMOTE_PATH && git rev-parse --short HEAD 2>/dev/null || echo unknown")
ssh "$REMOTE_HOST" "
  cd $REMOTE_PATH
  git pull origin master
  rm -f tsconfig.build.tsbuildinfo
  npm install
  npm run build
  npx prisma migrate deploy
"
log "      build y migraciones OK"

log "[3/4] pm2 restart $PM2_NAME..."
ssh "$REMOTE_HOST" "pm2 restart $PM2_NAME"

log "[4/4] Health check en puerto $PORT..."
for i in {1..6}; do
  sleep 5
  HTTP_CODE=$(ssh "$REMOTE_HOST" "curl -s -o /dev/null -w '%{http_code}' --connect-timeout 3 http://localhost:$PORT/ 2>/dev/null" || echo "000")
  if [ "$HTTP_CODE" != "000" ] && [ "$HTTP_CODE" != "" ]; then
    COMMIT=$(ssh "$REMOTE_HOST" "cd $REMOTE_PATH && git rev-parse --short HEAD 2>/dev/null || echo unknown")
    ssh "$REMOTE_HOST" "echo \"\$(date) Deploy OK — $COMMIT\" >> $LOG_FILE" 2>/dev/null || true
    log "      HTTP $HTTP_CODE — OK"
    log "=== Deploy completado ($COMMIT) ==="
    exit 0
  fi
  log "      Intento $i/6 — esperando..."
done

log "[ROLLBACK] Servicio no responde — volviendo a $PREV_HASH..."
ssh "$REMOTE_HOST" "cd $REMOTE_PATH && git checkout $PREV_HASH && npm run build && pm2 restart $PM2_NAME && echo \"\$(date) Deploy FALLIDO — rollback a $PREV_HASH\" >> $LOG_FILE" 2>/dev/null || true
echo "ERROR: Deploy fallido. Rollback ejecutado."
exit 1
