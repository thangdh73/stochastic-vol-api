# MMRA Web — Project Status

**Repo:** `D:\1-Projects\8-Python code\3-MMRA Web Project`  
**Last updated:** 2026-05-26

| Milestone | Status |
|-----------|--------|
| Phase 0–1 — Engine | Done |
| Milestone 2 — FastAPI | Done (port **8001**) |
| Milestone 3 — Persistence | Done |
| Milestone 4 — Frontend shell | Done |
| Milestone 5 — Input forms | Done |
| Milestone 6 — Charts | Done (histogram/exceedance/scatter + Spearman + workbook OAT tornado) |
| Milestone 7 — Export UI | Done (CSV zip + Excel via API) |
| Milestone 8 — Calibration doc | Not started |

## Run stack

```cmd
start-dev.bat
```

Or manually (reloads engine + backend):

```cmd
cd backend
uvicorn app.main:app --reload --reload-dir . --reload-dir "..\engine" --host 127.0.0.1 --port 8001

cd frontend
npm run dev
```

Open http://localhost:5173/

## Workflow

1. **Dashboard** → New prospect (or Open saved project)
2. Edit **Prospect Setup** → **Area** → **Net Pay** → **HC Yield** → **Chance**
3. **Run QA/QC** on any page (ValidateBar)
4. **Simulation** → Run simulation → **Results**

## Next step

- Net pay metres/feet conversion UI (FRS NPAY-002/003)
- Module completion indicators in sidebar/Dashboard (FRS NAV-003/DASH-002)
- Export from saved DB runs + portable `.mmra.json` import/export
- Workbook calibration report (Milestone 8)
