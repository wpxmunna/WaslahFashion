# Deployment runbook

Production runs on an Ubuntu VPS behind nginx, as a **systemd** service named
`waslah`, under the non-root user **`deploy`**, from **`/home/deploy/WaslahFashion`**.

Stack: Next.js 16 (`next build` + `next start`, port 3000) · Prisma 7 with the
MariaDB driver adapter · MySQL 8 · nginx reverse proxy · Certbot TLS.

---

## 1. Deploy an update (the common case)

Run as the `deploy` user, from the app directory. **All four steps matter** —
skipping the migration or the build is what has caused every production 500 so far.

```bash
sudo -u deploy -H bash -lc "cd /home/deploy/WaslahFashion \
  && git pull \
  && npm ci \
  && npx prisma generate \
  && npx prisma migrate deploy \
  && npm run build"
sudo systemctl restart waslah
```

Then verify:

```bash
systemctl status waslah --no-pager      # active (running)
curl -sI https://waslahbd.com | head -1 # HTTP/2 200
journalctl -u waslah -n 30 --no-pager   # no errors
```

### Why each step is non-negotiable
| Step | Skip it and… |
|---|---|
| `npx prisma generate` | client is stale; type/query mismatches |
| `npx prisma migrate deploy` | **schema changes don't apply → product/admin pages 500** (missing table/column) |
| `npm run build` | code **and `next.config.ts` / env changes don't take effect** (config is read at build/boot, never hot-reloaded) |
| `systemctl restart waslah` | the running process keeps serving the old build |

---

## 2. First-time server setup

A single non-interactive bootstrap script provisions everything (Node 22, MySQL,
nginx, Certbot, the systemd service, TLS). SSH in as root, edit the three
variables at the top, and run it. The full script lives in the deploy history /
ask the maintainer; the shape is:

1. System update, 2 GB swap (so `next build` doesn't OOM on a 1 GB droplet), UFW.
2. Install Node 22, `mysql-server`, `nginx`, `certbot`, `git`, build tools.
3. Create DB + app user:
   ```sql
   CREATE DATABASE waslah_fashion CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'waslah'@'localhost' IDENTIFIED WITH mysql_native_password BY '<DB_PASS>';
   GRANT ALL PRIVILEGES ON waslah_fashion.* TO 'waslah'@'localhost';
   ```
   (`mysql_native_password` is deliberate — the MariaDB driver connects cleanly with it.)
4. Create the `deploy` user, `git clone` the repo.
5. Write `.env` (see §4), `npm ci && npx prisma generate && npx prisma migrate deploy && npx prisma db seed && npm run build`.
6. Install the systemd unit (§3), `systemctl enable --now waslah`.
7. nginx reverse proxy (§5) + `certbot --nginx -d waslahbd.com -d www.waslahbd.com`.

---

## 3. systemd service — `/etc/systemd/system/waslah.service`

```ini
[Unit]
Description=Waslah Fashion (Next.js)
After=network.target mysql.service

[Service]
Type=simple
User=deploy
WorkingDirectory=/home/deploy/WaslahFashion
ExecStart=/usr/bin/npm run start
Environment=NODE_ENV=production
Environment=PORT=3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

`systemctl daemon-reload && systemctl enable --now waslah` after any change.

---

## 4. Environment — `/home/deploy/WaslahFashion/.env`

Never commit this file. Generate `AUTH_SECRET` with `openssl rand -base64 32`.

```env
DATABASE_URL="mysql://waslah:<DB_PASS>@localhost:3306/waslah_fashion"
AUTH_SECRET="<openssl rand -base64 32>"
NEXT_PUBLIC_SITE_URL="https://waslahbd.com"
NEXT_PUBLIC_SITE_NAME="Waslah"
NEXT_PUBLIC_BRAND_PROFILE="waslah"
```

Changing any of these requires **`npm run build` + restart** (they're read at build/boot).
Brand colours/fonts/logos are chosen by `NEXT_PUBLIC_BRAND_PROFILE`; profiles live
in `src/lib/brand.ts`.

---

## 5. nginx — `/etc/nginx/sites-available/waslah`

```nginx
server {
    listen 80;
    server_name waslahbd.com www.waslahbd.com;
    client_max_body_size 25M;   # REQUIRED: admin image uploads are large
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

`nginx -t && systemctl reload nginx` after edits. Certbot rewrites this for :443
on first run and auto-renews.

Upload size ceiling is aligned in three places — keep them in sync:
nginx `client_max_body_size 25M` · `next.config.ts` `serverActions.bodySizeLimit "25mb"` ·
`src/lib/admin/upload.ts` `MAX_BYTES` (20 MB, the friendly-error cap).

---

## 6. Troubleshooting

Always start with the logs:
```bash
journalctl -u waslah -n 80 --no-pager
sudo tail -n 50 /var/log/nginx/error.log
```

| Symptom | Cause | Fix |
|---|---|---|
| 500 on product/admin pages after deploy | migration not applied | `npx prisma migrate deploy` then restart |
| 500 on **create with image**, ~large POST | Server Action body limit | already set to 25mb in `next.config.ts` — ensure you **rebuilt** after pulling |
| **413** from nginx on upload | `client_max_body_size` missing/too low | set `25M`, `nginx -t && reload` |
| Config/env change had no effect | not rebuilt/restarted | `npm run build && systemctl restart waslah` |
| 502 Bad Gateway | app not running | `systemctl status waslah`; check the journal |
| `next build` killed | out of RAM | ensure the 2 GB swap from §2 exists |
| favicon/old assets cached | browser cache | hard refresh (Ctrl+Shift+R) |

---

## 7. Migrations — important

Schema changes ship as files under `prisma/migrations/`. Production applies them
with `npx prisma migrate deploy` (never `migrate dev` on the server — it's
interactive and can reset data). `migrate deploy` runs all pending migrations in
order and **does not prompt**, including destructive ones — review a new
migration's `.sql` before deploying if it drops columns.

## 8. Rollback

```bash
sudo -u deploy -H bash -lc "cd /home/deploy/WaslahFashion && git log --oneline -5"
sudo -u deploy -H bash -lc "cd /home/deploy/WaslahFashion && git checkout <good-sha> && npm ci && npx prisma generate && npm run build"
sudo systemctl restart waslah
```
Note: rolling **code** back does not roll **database migrations** back. If a bad
deploy included a migration, restoring the schema needs a manual down-migration
or a DB backup — take a `mysqldump` before risky migrations.
