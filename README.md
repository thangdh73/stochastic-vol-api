# Stochastic volume calculation

This folder is the **active development** project.

The original ProspectScope baseline is parked separately. Do not make changes there.

Probabilistic subsurface resource and risk evaluation. Calculation engine: `engine/mmra_engine/`.

## Docs

See `docs/` for approved specifications.

## Setup

```bash
cd engine
pip install -r requirements.txt
python -m unittest discover -s tests -v
```

## Regression

```bash
python examples/run_pm3xd_validation.py
```

## API (FastAPI)

```bash
cd backend
pip install -r requirements.txt
pip install -r ../engine/requirements.txt
uvicorn app.main:app --reload --port 8002
```

Docs: http://127.0.0.1:8002/docs — see [`backend/README.md`](backend/README.md).

**Note:** This project uses API port **8002** to avoid clashing with the parked baseline or other apps.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5174/** (proxies API to port 8002).

**Windows quick start:** double-click [`start-dev.bat`](start-dev.bat) to open API + UI in two terminals.

See [`frontend/README.md`](frontend/README.md).

## Deploy on your personal website

Embed under a subpath on your portfolio site:

| Site | Doc |
|------|-----|
| **thang-doan.vercel.app** | [`docs/DEPLOY_VERCEL_THANG_DOAN.md`](docs/DEPLOY_VERCEL_THANG_DOAN.md) → `/tools/stochastic-volume/` |
| nginx / VPS | [`docs/DEPLOY_PERSONAL_SITE.md`](docs/DEPLOY_PERSONAL_SITE.md) |

Quick build: `.\deploy\build-personal-site.ps1` (default path `/tools/stochastic-volume/`)

See `PROJECT_STATUS.md` for milestone progress.

## License

Copyright © 2026 Thang Doan Hong. See [LICENSE](LICENSE).

Official demo only: https://thang-doan.vercel.app/tools/stochastic-volume/  
Do not redeploy or use commercially without permission.
