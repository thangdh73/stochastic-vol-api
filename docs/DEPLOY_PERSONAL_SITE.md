# Deploy on your personal website (technical corner)

Host **Stochastic volume calculation** under a subpath on your existing site, for example:

`https://yourdomain.com/technical-corner/stochastic-volume/`

The app has two parts:

1. **Static UI** — built from `frontend/` (HTML/JS/CSS)
2. **API** — FastAPI on port **8002** (simulation, save projects, export)

Your personal site nginx (or similar) serves the static files and **proxies** `/api` and `/health` to the API.

---

## 1. Choose your public URL

Pick a path on your site, e.g.:

| Setting | Example |
|---------|---------|
| Public URL | `https://yourdomain.com/technical-corner/stochastic-volume/` |
| `VITE_BASE_PATH` | `/technical-corner/stochastic-volume/` |
| `VITE_API_BASE` | `/technical-corner/stochastic-volume` |

If your technical corner uses a different folder name, change these consistently everywhere.

---

## 2. Build the frontend

From the project root (Windows):

```powershell
.\deploy\build-personal-site.ps1
```

Custom path:

```powershell
$env:PUBLIC_PATH = "/tech/stochastic-volume/"
.\deploy\build-personal-site.ps1
```

Output: `frontend/dist/` — copy **all files** into your website tree, e.g.:

```text
/var/www/your-personal-site/technical-corner/stochastic-volume/
  index.html
  assets/
  favicon.svg
```

On your **technical corner** page, link to the app:

```html
<a href="/technical-corner/stochastic-volume/">Stochastic volume calculation</a>
```

Or embed full-screen:

```html
<iframe
  src="/technical-corner/stochastic-volume/"
  title="Stochastic volume calculation"
  style="width:100%;min-height:85vh;border:0;border-radius:8px;"
></iframe>
```

---

## 3. Run the API on the server

### Option A — Docker (recommended)

On the server, from `deploy/`:

```bash
docker compose up -d --build
```

API listens on `127.0.0.1:8002` only (not public). Data persists in Docker volume `stochastic_vol_data`.

### Option B — Manual (Linux VPS)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -r ../engine/requirements.txt
export MMRA_DATABASE_URL=sqlite:////var/lib/stochastic-vol/mmra.db
uvicorn app.main:app --host 127.0.0.1 --port 8002
```

Use **systemd** or **supervisor** to keep it running.

---

## 4. Configure nginx (reverse proxy)

Add the blocks from [`deploy/nginx-personal-site.example.conf`](../deploy/nginx-personal-site.example.conf) to your site config.

Important:

- **Static files** → `alias` to the folder where you copied `dist/`
- **`/technical-corner/stochastic-volume/health`** → proxy to API `/health`
- **`/technical-corner/stochastic-volume/api/`** → proxy to API `/api/`

Reload nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Test:

- `https://yourdomain.com/technical-corner/stochastic-volume/` — UI loads
- `https://yourdomain.com/technical-corner/stochastic-volume/health` — JSON `{"status":"ok",...}`

---

## 5. Link from your technical corner

Example card on your portfolio / technical page:

```html
<section class="technical-corner">
  <h2>Technical corner</h2>
  <article>
    <h3>Stochastic volume calculation</h3>
    <p>Monte Carlo volumetric assessment — multi-tank, tornado, expectation curves.</p>
    <a href="/technical-corner/stochastic-volume/">Open app →</a>
  </article>
</section>
```

---

## Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| `VITE_BASE_PATH` | Frontend build | Subpath for assets and router |
| `VITE_API_BASE` | Frontend build | Prefix for `/api` and `/health` |
| `VITE_API_ORIGIN` | Frontend build (optional) | Full API URL if API is on another host |
| `MMRA_DATABASE_URL` | Backend | SQLite path for saved projects |

---

## GitHub Pages / static-only hosts

GitHub Pages **cannot** run the Python API. Options:

- Host **UI only** on Pages and point `VITE_API_ORIGIN` to an API on a VPS, Railway, Render, etc.
- Or use a VPS with nginx + Docker (full stack on one machine).

---

## Local production preview

Build with subpath, then preview:

```powershell
cd frontend
$env:VITE_BASE_PATH="/technical-corner/stochastic-volume/"
$env:VITE_API_BASE="/technical-corner/stochastic-volume"
npm run build
npm run preview -- --port 4173
```

Start API separately on port 8002; use a local nginx or tunnel for full subpath testing.

---

## Checklist

- [ ] Built frontend with correct `PUBLIC_PATH`
- [ ] Copied `dist/` to website directory
- [ ] API running on server (Docker or systemd)
- [ ] nginx proxy for `/health` and `/api/`
- [ ] Link added on personal site technical corner page
- [ ] HTTPS enabled on your domain
