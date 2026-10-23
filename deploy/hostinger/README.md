# Hostinger VPS — www.treviogobal.com

Production layout:

| Piece | Detail |
|--------|--------|
| VPS | `200.234.47.151` |
| App root | `/var/www/treviogobal` |
| Frontend | Next.js on `127.0.0.1:3100` |
| API | Express on `127.0.0.1:4000` |
| Public | Nginx → `https://www.treviogobal.com` (`/api` → Express) |
| Database | Supabase Postgres (not on the VPS) |

## 1. DNS (Hostinger hPanel)

For domain **treviogobal.com**:

| Type | Name | Value |
|------|------|--------|
| A | `@` | `200.234.47.151` |
| A | `www` | `200.234.47.151` |

Confirm:

```bash
nslookup treviogobal.com 8.8.8.8
nslookup www.treviogobal.com 8.8.8.8
```

Both should return `200.234.47.151` before Certbot.

**Status check (2026-10-23):** `treviogobal.com` returns **NXDOMAIN** on public DNS (domain not registered or nameservers not set). The similar name `trevioglobal.com` exists and points at Cloudflare — that is a different domain. Until A records for **treviogobal.com** exist, Certbot and `https://www.treviogobal.com` cannot work. You can still deploy and test via `http://200.234.47.151` after Nginx is up.

## 2. First-time server setup

### SSH access (required)

From this workstation, key auth currently fails (`Permission denied`). Add this public key in Hostinger hPanel → VPS → SSH keys (or `~/.ssh/authorized_keys` on the server), **or** provide the root password so deploy can continue:

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPZCSQr8KMM5IYrmSoMhpYj4N9sf5+gEM5D7MJHlVOlZ trevio-hostinger-deploy
```

Then connect with:

```bash
ssh -i ~/.ssh/trevio_vps root@200.234.47.151
# or: ssh root@200.234.47.151
```

Clone is handled by setup (or clone manually first):

```bash
cd /tmp
# If repo is private, use a deploy token / SSH key
git clone https://github.com/trevioglobal/Trevioglobal.git /var/www/treviogobal
bash /var/www/treviogobal/deploy/hostinger/setup-server.sh
```

## 3. Environment files

```bash
cp /var/www/treviogobal/deploy/hostinger/env.backend.example /var/www/treviogobal/backend/.env
cp /var/www/treviogobal/deploy/hostinger/env.frontend.example /var/www/treviogobal/frontend/.env.production
nano /var/www/treviogobal/backend/.env   # DATABASE_URL, DIRECT_URL, JWT_SECRET
```

`JWT_SECRET` must be a long random value (32+ characters).

## 4. Deploy

```bash
bash /var/www/treviogobal/deploy/hostinger/deploy.sh
pm2 startup
pm2 save
```

## 5. SSL

After DNS resolves:

```bash
certbot --nginx -d treviogobal.com -d www.treviogobal.com
# Then optionally install full HTTPS redirect config:
cp /var/www/treviogobal/deploy/hostinger/nginx-treviogobal.conf /etc/nginx/sites-available/treviogobal
nginx -t && systemctl reload nginx
```

## 6. Verify

```bash
curl -fsS https://www.treviogobal.com/api/health
curl -fsSI https://www.treviogobal.com | head -n 5
```

Open the site, sign in, create a quotation.

## Updates

```bash
bash /var/www/treviogobal/deploy/hostinger/deploy.sh
```

## Troubleshooting

- **502 Bad Gateway** — `pm2 status`; `pm2 logs trevio-api` / `trevio-web`
- **API CORS errors** — check `CORS_ORIGIN` includes `https://www.treviogobal.com`
- **Blank API / wrong host** — rebuild frontend after changing `NEXT_PUBLIC_API_URL` (it is bake-time)
- **Certbot fails** — DNS not pointing at this VPS yet; ports 80/443 closed
