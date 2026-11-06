# Project directory map

```text
Predictive-Football_game/
├── src/                         # Player web frontend and preserved game engine
│   ├── App.tsx                  # Player social/app shell and auth gate
│   ├── components/
│   │   ├── GameExperience.tsx   # Original standalone match experience, retained
│   │   ├── SocialPanels.tsx     # Feed, people discovery, mutual-friend messaging
│   │   ├── GameControls.tsx     # Existing mobile/keyboard game controls
│   │   ├── MainMenu.tsx         # Existing match setup and settings
│   │   ├── MatchResult.tsx      # Existing full-time result screen
│   │   ├── PauseMenu.tsx        # Existing pause/settings screen
│   │   └── Scoreboard.tsx       # Existing in-match HUD
│   ├── game/                    # Existing simulation and rule-based game opponent
│   ├── hooks/                   # React/game lifecycle integration
│   ├── rendering/               # Existing Three.js and 2D canvas rendering
│   └── types/                   # Game simulation types
│
├── apps/
│   └── admin-web/               # Separate Vite administrator frontend (port 3001)
│       ├── src/App.tsx          # Admin login and metrics dashboard
│       ├── src/styles.css
│       ├── Dockerfile
│       └── package.json
│
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app and API router registration
│   │   ├── core/config.py       # Environment-backed configuration
│   │   ├── api/deps.py          # JWT and admin-role dependencies
│   │   ├── api/routes/          # Auth, social, assistant, prediction, matches, admin, health
│   │   ├── db/models.py         # PostgreSQL SQLAlchemy models
│   │   ├── db/session.py        # PostgreSQL engine and session
│   │   ├── services/security.py # Argon2 password hashing and JWTs
│   │   ├── services/graph.py    # Neo4j follow/friend graph adapter
│   │   ├── services/metta_reasoner.py # Optional Hyperon/MeTTa explanations
│   │   └── scripts/create_admin.py   # First administrator bootstrap
│   ├── alembic/                 # Database schema migrations
│   ├── Dockerfile
│   ├── requirements.txt
│   └── requirements-dev.txt
│
├── ai/
│   ├── features.py              # Feature schema and CSV validation
│   ├── train.py                 # Ten-epoch CPU neural-network training CLI
│   ├── predict.py               # Model loading and inference
│   └── metta/prediction_rules.metta # Experimental symbolic explanation rules
│
├── data/
│   ├── raw/README.md             # Source/license and raw data guidance
│   └── processed/README.md       # Prepared CSV schema location
├── notebooks/
│   └── football_prediction_lab.ipynb # pandas/NumPy/SymPy/Matplotlib/seaborn lab
├── artifacts/                    # Local trained models (not tracked in Git)
├── infra/nginx.conf              # SPA routing and API reverse proxy
├── docs/                         # Architecture, setup, AI, API, security, deployment
├── docker-compose.yml            # Local multi-service deployment
├── Dockerfile                    # Player frontend container
├── .env.example                  # Environment variable template
└── README.md
```

## Run commands

- Player frontend: `npm run dev` → port `3000`.
- Admin frontend: `npm run dev:admin` → port `3001`.
- Backend: from `backend`, `uvicorn app.main:app --reload --port 8000` (set `PYTHONPATH=..`).
- Full local stack: `docker compose up --build -d`.
- Neural network: `python -m ai.train --data data/processed/matches.csv --epochs 10` from project root.
- Notebook: `jupyter lab notebooks/football_prediction_lab.ipynb`.
