# Deploy on [thang-doan.vercel.app](https://thang-doan.vercel.app)

Target URL for the full Monte Carlo app:

**https://thang-doan.vercel.app/tools/stochastic-volume/**

Your existing **Data Analysis Lab** (`/tools/data-lab?mode=volume`) stays a lightweight deterministic STOIIP calculator. The full **Stochastic volume calculation** app (multi-tank, Monte Carlo, tornado, save/export) lives at the path above and can be linked or embedded from the Volume tab.

---

## Architecture on Vercel

| Part | Where |
|------|--------|
| Static UI (React) | Vercel — files under `public/tools/stochastic-volume/` |
| API (FastAPI) | **Railway** or **Render** (Vercel cannot run this Python engine) |
| Same-origin API | Vercel **rewrites** proxy `/tools/stochastic-volume/api/*` → Railway |

---

## Step 1 — Build the UI

From this repo (Windows):

```powershell
cd "d:\1-Projects\8-Python code\MMRA_New_UI"
.\deploy\build-personal-site.ps1
```

Default path is already `/tools/stochastic-volume/`.

Output: `frontend\dist\`

---

## Step 2 — Add files to your personal website repo

In your **thang-doan.vercel.app** Git repo:

```text
public/
  tools/
    stochastic-volume/     ← copy ALL files from frontend/dist/
      index.html
      assets/
      favicon.svg
    data-lab/              ← existing Data Lab (unchanged)
```

---

## Step 3 — Deploy API on Railway

1. Push this `MMRA_New_UI` repo to GitHub.
2. [Railway](https://railway.app) → New project → Deploy from repo.
3. Set **Root directory** / Dockerfile: use `deploy/Dockerfile` (build context = repo root).
4. Generate a public URL, e.g. `https://stochastic-vol-production.up.railway.app`
5. Env: `MMRA_DATABASE_URL=sqlite:////data/mmra.db` + attach a volume at `/data` (optional, for saved projects).

Test: `https://YOUR-API.up.railway.app/health` → `{"status":"ok",...}`

---

## Step 4 — Vercel rewrites (same-origin API)

Merge into your site’s **`vercel.json`** (see [`deploy/vercel.json.example`](../deploy/vercel.json.example)):

```json
{
  "rewrites": [
    {
      "source": "/tools/stochastic-volume/api/:path*",
      "destination": "https://YOUR-API.up.railway.app/api/:path*"
    },
    {
      "source": "/tools/stochastic-volume/health",
      "destination": "https://YOUR-API.up.railway.app/health"
    },
    {
      "source": "/tools/stochastic-volume/:path((?!assets/).*)",
      "destination": "/tools/stochastic-volume/index.html"
    }
  ]
}
```

Replace `YOUR-API.up.railway.app` with your Railway host.

Redeploy Vercel. Then check:

- https://thang-doan.vercel.app/tools/stochastic-volume/
- https://thang-doan.vercel.app/tools/stochastic-volume/health

---

## Step 5 — Link from Data Lab (Volume mode)

On `/tools/data-lab`, add a callout on the **Volume** tab pointing to the full app.

Example HTML (place near the STOIIP calculator):

```html
<div class="lab-promo" style="margin:1rem 0;padding:1rem 1.25rem;border:1px solid #2e6b9e;border-radius:8px;background:#f0f7fc;">
  <strong>Monte Carlo version</strong> — multi-tank stochastic volumetrics, tornado, expectation curves, project save/export.
  <a href="/tools/stochastic-volume/" style="margin-left:0.5rem;font-weight:600;">Open Stochastic volume calculation →</a>
</div>
```

Or open in a new tab from your Volume mode JS:

```javascript
const MC_APP_URL = '/tools/stochastic-volume/';
// e.g. when mode === 'volume', show a button:
// <button type="button" onclick="window.open('/tools/stochastic-volume/','_blank')">Full Monte Carlo app</button>
```

Optional full-page embed on a dedicated page:

```html
<iframe
  src="/tools/stochastic-volume/"
  title="Stochastic volume calculation"
  style="width:100%;min-height:90vh;border:0;"
  loading="lazy"
></iframe>
```

---

## Alternative: API on a subdomain (no Vercel rewrites)

Build with explicit API origin:

```powershell
$env:PUBLIC_PATH = "/tools/stochastic-volume/"
$env:VITE_API_BASE = ""
$env:VITE_API_ORIGIN = "https://YOUR-API.up.railway.app"
.\deploy\build-personal-site.ps1
```

Ensure Railway CORS allows `https://thang-doan.vercel.app` (this repo’s API already allows `*`).

---

## Checklist

- [ ] `.\deploy\build-personal-site.ps1`
- [ ] Copy `frontend/dist/` → `public/tools/stochastic-volume/` in website repo
- [ ] Railway API running + `/health` OK
- [ ] `vercel.json` rewrites for `/api` and `/health`
- [ ] SPA fallback rewrite for client routes (`/setup/overview`, etc.)
- [ ] Link or embed from Data Lab Volume tab
- [ ] Push → Vercel redeploy

---

## URLs summary

| Page | URL |
|------|-----|
| Data Lab (CSV / simple volume) | https://thang-doan.vercel.app/tools/data-lab?mode=volume |
| Full stochastic app | https://thang-doan.vercel.app/tools/stochastic-volume/ |
| Technical corner | https://thang-doan.vercel.app/ (link from `#technical`) |
