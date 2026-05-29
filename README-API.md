# Stochastic volume calculation — API

FastAPI backend + MMRA engine. Deployed for the portfolio app at `/tools/stochastic-volume/`.

## Deploy API (free — Render)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/thangdh73/stochastic-vol-api)

1. Click **Deploy to Render** (sign up / log in — free, no card required for free tier).
2. Connect GitHub if prompted and **Apply** the blueprint (`render.yaml`).
3. Wait for deploy (~5–10 min first build). Health: `https://stochastic-vol-api.onrender.com/health`

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
