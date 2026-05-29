# Stochastic volume calculation — API

FastAPI backend + MMRA engine. Official demo: [thang-doan.vercel.app/tools/stochastic-volume/](https://thang-doan.vercel.app/tools/stochastic-volume/)

**License:** See [LICENSE](LICENSE). Unauthorized public deployment or commercial use is not permitted.

## Owner deploy (Render free tier)

From a local clone (not the public one-click button):

1. Push this repo to your GitHub (private fork) or use this repo if you are the owner.
2. [Render](https://render.com) → **New** → **Blueprint** → connect repo → apply `render.yaml`.
3. Health: `https://YOUR-SERVICE.onrender.com/health`

Free tier spins down after ~15 min idle; first request after sleep is slow (~30–60 s).

## After API is live

From MMRA repo root:

```powershell
.\deploy\switch-to-render.ps1
```

Or with a Render API key:

```powershell
$env:RENDER_API_KEY = "rnd_..."
.\deploy\deploy-render-api.ps1
.\deploy\switch-to-render.ps1
```

## Local dev

See main [README.md](README.md).
