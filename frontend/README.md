# MMRA Web Frontend

React + TypeScript + Vite UI for probabilistic resource and risk evaluation.

## Prerequisites

Backend API running on port **8001** (8000 may be used by another app):

```bash
cd ../backend
uvicorn app.main:app --reload --port 8001
```

## Development

```bash
npm install
npm run dev
```

Open http://localhost:5173 — API requests proxy to `http://127.0.0.1:8001`.

## Workflow (Milestone 4)

1. Open **Simulation** → **Load PM3X-D case**
2. **Run QA/QC** → review **QA/QC** tab
3. **Run simulation** → view **Results**
4. Optional: **Charts**, **Export**, save via **Save prospect & run**

## Build

```bash
npm run build
```

## Stack

- React 19 + TypeScript
- React Router — navigation
- TanStack Query — API health / prospects
- Recharts — percentile preview chart

Input forms (Area, Net Pay, HC Yield, Chance) are placeholders until Milestone 5.
