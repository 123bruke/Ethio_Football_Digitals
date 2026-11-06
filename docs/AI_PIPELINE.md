# AI, prediction, and reasoning pipeline

## Three separate AI responsibilities

| Component | Purpose | Implementation |
|---|---|---|
| Game opponent | Select movement, tackles, passes and shots during live simulation | Existing TypeScript rule-based tactical `OpponentAI` |
| Match prediction | Estimate home/draw/away outcome from pre-match structured statistics | Scikit-learn MLP neural network; CPU-only, 32/16 hidden units, ten starter epochs |
| Conversational assistant | Explain football concepts and model output in natural language | Optional local Ollama chat model; fallback response if unavailable |
| Symbolic explanation | Apply simple transparent probability-confidence rules | Optional Hyperon/MeTTa rule file plus Python fallback |

An MLP match-outcome model is not a good real-time movement controller. A future learned game opponent needs an action/state/reward definition and training through many simulation episodes, e.g. a separate Gymnasium environment and reinforcement-learning policy. The current game AI remains in the frame loop and is available to play against immediately.

## Why this model fits an 8 GB target

- The result classifier is a small tabular MLP, not a large transformer.
- Inference runs on CPU using scikit-learn and joblib.
- The notebook and training command use a fixed 12-feature table, not raw video or image models.
- Ollama is optional; the suggested 1.5B quantized model is intentionally small. Keep one model loaded, constrain context and generation, and do not run multiple large LLMs at once.
- Docker Compose constrains PostgreSQL, Neo4j, backend, and frontend services. Ollama is behind an optional profile with a 2.5 GB cap.

These are design constraints, not a promise that every workload will fit under every 8 GB operating-system configuration. Runtime memory depends on data size, model build, context, database cache, browser tabs, and Docker Desktop/WSL allocation.

## Training target and inputs

The task is three-class classification:

- `home`: home team wins.
- `draw`: match is drawn.
- `away`: away team wins.

The twelve features are:

1. home and away recent points per match;
2. home and away average goals for;
3. home and away average goals against;
4. home and away historical win rate;
5. home and away rest days;
6. normalized home and away league-strength/position feature (1 means stronger/better position; use the same convention for both teams).

Each feature must be calculated before kickoff, from a fixed historical window that excludes the current fixture. The target is the actual match outcome and is used only as a training label. See `data/raw/README.md` for the CSV schema.

## Training flow

1. Read CSV using pandas and check required fields.
2. Convert feature values to numeric and remove rows without a label or usable features.
3. Sort by `kickoff_date` where present.
4. Split chronologically: first 80% train, last 20% test.
5. Fit median imputation and standardization on training data only.
6. Train `MLPClassifier(hidden_layer_sizes=(32, 16))` for the configured number of passes; default is **10 epochs**.
7. Evaluate on the later holdout using accuracy, macro F1, log loss, per-class precision/recall and confusion matrix.
8. Save the model bundle and metadata in `artifacts/`.

Ten epochs is the requested starter run. It is not proof of convergence. Use time-based validation to tune features and hyperparameters, keep a final untouched test period, and compare against simple baselines before using a model in a public product.

## Avoid data leakage

Do not include full-time score, shots from the target match, post-match xG, red cards from the target match, or statistics computed with future games. Rolling team averages must be shifted by at least one match. Fit imputers/scalers only on training data. Keep a later time period as test data. If a data provider's license prevents redistribution or model commercialization, respect those terms.

## Notebook tools

`notebooks/football_prediction_lab.ipynb` includes:

- **pandas** — read, validate, sort and prepare match rows.
- **NumPy** — feature matrices and probability arrays.
- **scikit-learn** — imputation, scaling, MLP training, evaluation.
- **Matplotlib and seaborn** — outcome counts, feature correlation, ten-epoch training loss, confusion matrix.
- **SymPy** — demonstrate the Poisson probability mass formula used in a simple goal-scoring baseline.

The SymPy example is mathematical illustration, not a second trained neural network. The notebook does not fabricate sample data; it stops with a helpful error if the CSV has not been provided.

## Assistant and local inference

The assistant calls the local Ollama HTTP API only when configured. It receives a restrictive system instruction: explain, do not claim certainty, do not request secrets, do not execute account changes, and do not give betting instructions. If Ollama is offline, the API returns a clearly named safe fallback response. The model is not a system controller and has no permission to alter user accounts.

## Hyperon / MeTTa

Hyperon is the reference MeTTa implementation. Its package documentation describes the project as experimental/pre-alpha, so this project treats it as an optional reasoning/explanation layer. The rule file currently represents confidence categories and explanatory guidance. Python provides the same fallback if Hyperon is absent or errors. Do not use experimental symbolic inference as an authentication or authorization mechanism.

The current implementation loads the MeTTa file and initializes the interpreter when explaining a prediction, but the returned interpreter output is not yet the source of the displayed explanation; Python fallback text is returned. A later version should add integration tests for the exact rule-query semantics before relying on the MeTTa output.
