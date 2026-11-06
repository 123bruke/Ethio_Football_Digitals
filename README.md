<img width="1912" height="891" alt="jkl" src="https://github.com/user-attachments/assets/6dc4d6bc-95be-4e68-9ec8-86ebee22d78e" />
<img width="1912" height="891" alt="Screenshot 2026-11-06 224415" src="https://github.com/user-attachments/assets/a97508a5-dc94-4bc8-a162-e628d60748e7" />

<img width="1912" height="891" alt="Screenshot 2026-11-06 224415" src="https://github.com/user-attachments/assets/ba66bf9a-db0d-4279-a4f7-41677e5ee0c8" />
<img width="1912" height="891" alt="Screenshot 2026-11-06 224415" src="https://github.com/user-attachments/assets/8bf6171f-db0d-4150-afa3-3bd40a4ddc8d" />
<img width="1917" height="782" alt="Screenshot 2026-11-06 224236" src="https://github.com/user-attachments/assets/02144642-a053-4ab1-90ea-b156c51b5254" />
<img width="1897" height="787" alt="Screenshot 2026-11-06 223741" src="https://github.com/user-attachments/assets/9206cbd0-bf59-4a90-8597-a460a0c9f765" />



PitchSide evolves the original 3D 5v5 arcade football project into a two-frontend platform for players and administrators. The existing game is preserved, while the repository adds a social web app, authentication, a private admin dashboard, a local prediction pipeline, an optional assistant model, PostgreSQL, Neo4j, Docker deployment, and detailed documentation.

## Product surfaces

### 1. Player website — public

The player app runs on port `3000` and has:

- Signup and login.
- Home feed and community posts.
- Discover/search people and follow accounts.
- Direct messages between mutual-follow connections.
- AI assistant for football/statistics questions.
- Match prediction page (requires a trained model artifact).
- Original 5v5 game, profile, and account settings.

### 2. Admin website — private

The separate admin app runs on port `3001`. Docker binds it to localhost only. It requires a server-verified admin role and displays account counts, 24-hour activity, account directory with player enable/disable controls, posts/messages, saved predictions and matches, CPU/RAM/disk snapshots, and model-training metadata when available.

### 3. AI services

- **Game opponent:** the original frame-loop tactical controller in `src/game/OpponentAI.ts` remains the in-game opponent. It is rule-based and immediately playable.
- **Match predictor:** a small CPU-based scikit-learn MLP estimates home/draw/away from 12 pre-match numeric features. It trains for 10 epochs by default and saves a local model artifact.
- **Assistant:** optional Ollama local model integration. If Ollama is unavailable, the API returns a clear fallback response.
- **Symbolic rules:** optional Hyperon/MeTTa explanation rules. Python remains the fallback and security authority.

The match-outcome MLP is not the in-game player-control model. A learned real-time game policy needs a separate reinforcement-learning project and is not represented as completed here.

## Start with Docker Desktop

1. Copy the environment file and replace all placeholder secrets:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Start services:

   ```powershell
   docker compose up --build -d
   ```

3. Create the first administrator:

   ```powershell
   docker compose exec backend python -m app.scripts.create_admin
   ```

4. Open:

   - Player app: `http://localhost:3000`
   - Private admin app: `http://localhost:3001`
   - API docs: `http://localhost:8000/docs`
   - Neo4j Browser: `http://localhost:7474`

Use the setup guide for passwords, local model configuration, Python notebooks, database services, and deployment steps.

## Run both frontend projects in separate terminals

**Terminal 1 — player:**

```powershell
npm install
npm run dev
```

**Terminal 2 — administrator:**

```powershell
npm run dev:admin
```

Install dependencies once from the repository root with `npm install`; the root package includes the shared React/Vite toolchain for both frontends.

**Terminal 3 — backend:**

```powershell
cd backend
$env:PYTHONPATH=".."
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

PostgreSQL and Neo4j must be running and their environment variables must point to those services.

## Train the prediction neural network

No fabricated data or pre-trained model is included. Obtain a historical football dataset whose license allows your intended use, then prepare `data/processed/matches.csv` with the exact schema in `data/raw/README.md`.

From the repository root:

```powershell
python -m ai.train --data data/processed/matches.csv --epochs 10
```

The model file and training metadata are saved under `artifacts/`. Before that file exists, the prediction API intentionally returns `503 Model not trained`. Review the chronological holdout metrics before enabling predictions for users.

## Explore the notebook

```powershell
cd backend
pip install -r requirements-dev.txt
cd ..
jupyter lab notebooks/football_prediction_lab.ipynb
```

The notebook uses pandas, NumPy, Matplotlib, seaborn, scikit-learn and SymPy to inspect the data, show learning progress over ten epochs, and evaluate the holdout set.

## Documentation

| Document | What it covers |
|---|---|
| [Architecture](docs/ARCHITECTURE.md) | Component boundaries, data flow, and system diagram |
| [Project structure](docs/PROJECT_STRUCTURE.md) | Repository map and terminal commands |
| [Setup](docs/SETUP.md) | Windows/Docker setup, two frontends, training, notebook, Ollama |
| [AI pipeline](docs/AI_PIPELINE.md) | Model inputs, 10-epoch training, evaluation, assistant and MeTTa |
| [API reference](docs/API.md) | Auth, social, chat, prediction, admin and health routes |
| [Admin security](docs/ADMIN_SECURITY.md) | Role checks, private admin network, account safety |
| [Deployment](docs/DEPLOYMENT.md) | Internet deployment and hardening checklist |
| [Delivery status / roadmap](docs/ROADMAP.md) | What is implemented and what remains |
| [Framework references](docs/REFERENCES.md) | Upstream framework and model documentation |

## Technical stack

| Layer | Selection |
|---|---|
| Player frontend | React 19, TypeScript, Vite, Three.js, Lucide |
| Admin frontend | Separate React + TypeScript + Vite application |
| API | Python 3.11, FastAPI, Pydantic |
| Relational database | PostgreSQL 16 + SQLAlchemy + Alembic |
| Social graph | Neo4j 5 + Python driver |
| Prediction | pandas, NumPy, scikit-learn MLP, joblib |
| Math / visualization | SymPy, Matplotlib, seaborn, JupyterLab |
| Local assistant | Optional Ollama + Qwen 2.5 1.5B |
| Symbolic reasoning | Optional Hyperon / MeTTa with Python fallback |
| Deployment | Docker Compose + Nginx reverse proxy |

## Important limitations

This is a strong local MVP foundation, not a fully hardened production social network. The prediction model is not trained because no real match dataset was supplied. The game opponent remains rule-based. Message delivery currently polls every five seconds. Likes/comments, media uploads, realtime presence, moderation, email verification, password recovery, MFA and a learned in-game RL policy are future work. See [ROADMAP](docs/ROADMAP.md).

## Original game features retained

The original project includes a 3D stadium, 2D tactical game canvas, 5v5 squads, keyboard/touch controls, a radar minimap, match clock, passing, shooting, sprinting, tackles, restarts, goalkeeper logic, stadium lighting and match results. The game engine and renderers remain under `src/game/` and `src/rendering/`.
