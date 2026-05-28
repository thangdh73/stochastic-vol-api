# MMRA Web API (FastAPI)

## Setup

```bash
cd backend
pip install -r requirements.txt
pip install -r ../engine/requirements.txt
```

## Run

From the `backend/` directory:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

Open http://127.0.0.1:8001/docs for interactive API documentation.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health |
| GET | `/api/health` | Same (under API prefix) |
| GET | `/api/validation-cases/pm3xd` | PM3X-D validation case input (schema v1) |
| POST | `/api/validate` | QA/QC validation only |
| POST | `/api/simulate` | Validate + Monte Carlo simulation |
| POST | `/api/export/csv` | ZIP of CSV tables |
| POST | `/api/export/excel` | Excel workbook download |

## Persistence (SQLite)

Database file: `backend/data/mmra.db` (created on first request).

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/prospects` | Create prospect |
| GET | `/api/prospects` | List prospects |
| GET | `/api/prospects/{id}` | Prospect detail + counts |
| PATCH | `/api/prospects/{id}` | Update name/metadata |
| DELETE | `/api/prospects/{id}` | Delete prospect (cascade) |
| POST | `/api/prospects/{id}/input-sets` | Save input JSON (deduped by hash) |
| GET | `/api/prospects/{id}/input-sets` | List input versions |
| GET | `/api/prospects/{id}/input-sets/{input_set_id}` | Get one input set |
| POST | `/api/prospects/{id}/simulation-runs` | Validate, simulate, persist run |
| GET | `/api/prospects/{id}/simulation-runs` | List run summaries |
| GET | `/api/prospects/{id}/simulation-runs/{run_id}` | Full stored result |

### Example workflow

```bash
# Create prospect
curl -X POST http://127.0.0.1:8001/api/prospects -H "Content-Type: application/json" -d "{\"name\":\"PM3X-D\"}"

# Load PM3X-D case and run persisted simulation (replace {id})
curl http://127.0.0.1:8001/api/validation-cases/pm3xd > pm3xd.json
curl -X POST http://127.0.0.1:8001/api/prospects/1/simulation-runs -H "Content-Type: application/json" -d "{\"input\": $(cat pm3xd.json)}"
```

Override database URL: `MMRA_DATABASE_URL=sqlite:///path/to/custom.db`

## Tests

```bash
cd backend
python -m unittest discover -s tests -v
```

13 tests (8 stateless API + 5 persistence).
