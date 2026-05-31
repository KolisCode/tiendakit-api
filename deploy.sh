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

log "[1/5] Push a origin/master..."
git -C "$SCRIPT_DIR" push origin master
log "      push OK"

log "[2/5] Build local (nest build)..."
cd "$SCRIPT_DIR"
npm run build
log "      build OK"

log "[3/5] rsync al droplet..."
ssh "$REMOTE_HOST" "
  if [ -d $REMOTE_PATH/dist ]; then
    rm -rf $REMOTE_PATH/dist.bak
    cp -r $REMOTE_PATH/dist $REMOTE_PATH/dist.bak
  fi
"
rsync -az --delete "$SCRIPT_DIR/dist/"       "$REMOTE_HOST:$REMOTE_PATH/dist/"
rsync -az           "$SCRIPT_DIR/package.json" "$SCRIPT_DIR/package-lock.json" "$REMOTE_HOST:$REMOTE_PATH/"
rsync -az --delete --exclude='seed.ts' "$SCRIPT_DIR/prisma/" "$REMOTE_HOST:$REMOTE_PATH/prisma/"
log "      rsync OK"

log "[4/5] npm install + prisma migrate deploy..."
ssh "$REMOTE_HOST" "cd $REMOTE_PATH && npm install --omit=dev && npx prisma migrate deploy"
log "      dependencias y migraciones OK"

log "[5/5] pm2 restart $PM2_NAME..."
ssh "$REMOTE_HOST" "pm2 restart $PM2_NAME"

log "      Health check en puerto $PORT..."
for i in {1..6}; do
  sleep 5
  HTTP_CODE=$(ssh "$REMOTE_HOST" "curl -s -o /dev/null -w '%{http_code}' --connect-timeout 3 http://localhost:$PORT/ 2>/dev/null" || echo "000")
  if [ "$HTTP_CODE" != "000" ] && [ "$HTTP_CODE" != "" ]; then
    COMMIT=$(git -C "$SCRIPT_DIR" rev-parse --short HEAD)
    ssh "$REMOTE_HOST" "echo \"\$(date) Deploy OK — $COMMIT\" >> $LOG_FILE" 2>/dev/null || true
    log "      HTTP $HTTP_CODE — OK"
    log "=== Deploy completado ($COMMIT) ==="
    exit 0
  fi
  log "      Intento $i/6 — esperando..."
done

log "[ROLLBACK] Servicio no responde — restaurando dist.bak..."
ssh "$REMOTE_HOST" "
  if [ -d $REMOTE_PATH/dist.bak ]; then
    rm -rf $REMOTE_PATH/dist && mv $REMOTE_PATH/dist.bak $REMOTE_PATH/dist
    pm2 restart $PM2_NAME
    echo \"\$(date) Deploy FALLIDO — rollback automático\" >> $LOG_FILE
  fi
" 2>/dev/null || true
echo "ERROR: Deploy fallido. Rollback ejecutado."
exit 1
