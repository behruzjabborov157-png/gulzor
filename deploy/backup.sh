#!/usr/bin/env bash
# Daily backup of the Gulzor database and uploaded images. Keeps the last 14 days.
# Cron (as the gulzor user):  15 3 * * * /opt/gulzor/deploy/backup.sh >> /var/log/gulzor-backup.log 2>&1
# Restore:  pg_restore --clean --if-exists -d "$DATABASE_URL" db-YYYYMMDD.dump
#           tar -xzf uploads-YYYYMMDD.tar.gz -C /var/lib/gulzor
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/gulzor}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/gulzor}"
KEEP_DAYS="${KEEP_DAYS:-14}"

# DATABASE_URL and UPLOAD_DIR from the app's env file.
set -a; source "$APP_DIR/.env.local"; set +a
: "${DATABASE_URL:?DATABASE_URL is not set}"
UPLOAD_DIR="${UPLOAD_DIR:-$APP_DIR/storage/uploads}"

stamp="$(date +%Y%m%d-%H%M)"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

pg_dump --format=custom --no-owner --file="$BACKUP_DIR/db-$stamp.dump" "$DATABASE_URL"
tar -czf "$BACKUP_DIR/uploads-$stamp.tar.gz" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"

find "$BACKUP_DIR" -type f -mtime +"$KEEP_DAYS" -delete
echo "$(date -Is) backup ok: db-$stamp.dump, uploads-$stamp.tar.gz"
# Copy $BACKUP_DIR to a second location too (another server or storage) — one disk is not a backup.
