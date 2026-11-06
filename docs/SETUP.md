# Local setup guide (Windows 11 / PowerShell and Docker Desktop)

## 1. Requirements

- Docker Desktop with the WSL 2 backend enabled.
- Node.js 22 or newer and npm 10 or newer for running the two frontends outside Docker.
- Python 3.11 for training the prediction model and using Jupyter.
- At least 8 GB system RAM is the target for the lightweight configuration. Close other memory-heavy applications while running Neo4j and a local chat model together.

## 2. Configure secrets

From the project root:

```powershell
Copy-Item .env.example .env
```

Open `.env` and replace the database password, Neo4j password, JWT secret, and administrator password. Generate a JWT secret with:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Use distinct random passwords for PostgreSQL, Neo4j and the administrator. URL-safe random values (for example, `python -c "import secrets; print(secrets.token_urlsafe(24))"`) avoid special-character problems in the local database URL. Never commit `.env` to Git. The example values are placeholders and must not be used on an internet-facing deployment.

## 3. Start the complete application with Docker

```powershell
docker compose up --build -d
```

Docker Compose starts PostgreSQL, Neo4j, the FastAPI backend, the player website, and the private admin website.

| Application | Address | Description |
|---|---|---|
| Player website | `http://localhost:3000` | Player signup/login, social feed, discover, messages, assistant, prediction UI and game |
| Admin website | `http://localhost:3001` | Private control room; port binds to localhost only |
| API | `http://localhost:8000` | Backend API |
| API docs | `http://localhost:8000/docs` | Interactive API reference |
| Neo4j Browser | `http://localhost:7474` | Local graph inspection; localhost only |

The admin frontend is not published on the server's public network interface. Its dashboard refreshes every 15 seconds and reports live API resource snapshots plus the latest saved model-training metadata when available. For a remote administrator, use a VPN/zero-trust access gateway or an SSH tunnel; do not expose the admin port directly to the public internet.

## 4. Create the first administrator

The administrator bootstrap command reads `ADMIN_EMAIL`, `ADMIN_USERNAME` and `ADMIN_PASSWORD` from `.env`:

```powershell
docker compose exec backend python -m app.scripts.create_admin
```

Then open `http://localhost:3001` and sign in with that administrator email/password. Normal registrations always receive the `player` role. The admin API checks the role on the server; hiding the admin link or page is not a security control by itself.

## 5. Run the player frontend and admin frontend in separate terminals

Use this when you want frontend hot reload while the backend and databases run in Docker or separately. First start only the database services (their ports bind to localhost):

```powershell
docker compose up -d postgres neo4j
```

The root `.env` file supplies the local database credentials to the API as well as to Docker Compose. The PostgreSQL host port `5432` and Neo4j Bolt port `7687` are bound to `127.0.0.1`.

**Terminal 1 — player website (port 3000):**

```powershell
npm install
npm run dev
```

**Terminal 2 — admin website (port 3001):**

```powershell
npm run dev:admin
```

**Terminal 3 — API (port 8000):**

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
$env:PYTHONPATH=".."
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

If PowerShell blocks local activation, use `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` or call `.venv\Scripts\python.exe` directly. Start PostgreSQL and Neo4j first, or keep the database services running in Docker. For local API execution, the settings loader reads the root `.env` file and assembles `DATABASE_URL` from `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD`. Override `DATABASE_URL` or `NEO4J_URI` in the root `.env` only when using a different database host or port.

## 6. Enable a local language assistant (optional)

The prediction system does not require a large language model. Ollama is optional and can run on the Windows host or through the Compose `local-llm` profile.

**Option A — Ollama installed on Windows:**

1. Install and start Ollama.
2. Open PowerShell and run:

```powershell
ollama pull qwen2.5:1.5b
```

3. Set `OLLAMA_BASE_URL=http://host.docker.internal:11434` in `.env` when the API runs in Docker. For an API process running directly on Windows, use `OLLAMA_BASE_URL=http://localhost:11434`.

The current default model is Qwen 2.5 1.5B. The model library lists the quantized download at about 986 MB. That file size is not the same as total RAM usage; inference also needs runtime memory and context space. The API limits context and output length and allows one configured model. See the model reference in `docs/REFERENCES.md`.

**Option B — Ollama as an optional container:**

```powershell
docker compose --profile local-llm up -d ollama
docker compose exec ollama ollama pull qwen2.5:1.5b
```

The optional Ollama service is capped at 2.5 GB. It is deliberately not started by the default Compose command so the user can keep the baseline memory footprint lower. If the model is unavailable, the assistant endpoint returns a transparent rule-based fallback response.

## 7. Train the match prediction model

The repository does not include an invented match dataset. Acquire data whose license permits your use, then prepare the CSV using the schema in `data/raw/README.md`.

```powershell
cd backend
$env:PYTHONPATH=".."
python -m ai.train --data ..\data\processed\matches.csv --epochs 10
```

Run the command from the repository root instead if your Python environment already has the backend package on its path:

```powershell
python -m ai.train --data data/processed/matches.csv --epochs 10
```

Training writes:

- `artifacts/football_result.joblib` — local model bundle.
- `artifacts/football_result_metadata.json` — model version, timestamp, feature list, epoch losses and test metrics.

Restart the backend after updating a model artifact if a worker has already loaded the previous version. The runtime does not download a dataset or pretend to have a trained model. Until the file exists, prediction requests return HTTP 503 with setup instructions.

## 8. Open the notebook

Install the development requirements in a Python 3.11 environment:

```powershell
cd backend
pip install -r requirements-dev.txt
cd ..
jupyter lab notebooks/football_prediction_lab.ipynb
```

The notebook loads `data/processed/matches.csv`, explores it with pandas and seaborn, uses NumPy/scikit-learn for processing/training/evaluation, uses SymPy for a small Poisson-probability derivation, plots the 10-epoch loss and confusion matrix with Matplotlib/seaborn, and can save the model artifact.

## 9. Useful commands

```powershell
docker compose ps
docker compose logs -f backend
docker compose logs -f postgres
docker compose logs -f neo4j
docker compose down
```

To remove containers but retain data volumes, use `docker compose down`. To delete the persisted database/graph/Ollama data as well, use `docker compose down -v` — this is destructive.
