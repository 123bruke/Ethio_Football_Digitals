"""Single source of truth for dataset scope, split boundaries and paths.

Split boundaries are fixed here BEFORE any model tuning (spec 12.6)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw" / "openfootball"
SILVER_DIR = ROOT / "data" / "silver"
GOLD_DIR = ROOT / "data" / "gold"
PROCESSED_CSV = ROOT / "data" / "processed" / "matches.csv"
LINEAGE_DIR = ROOT / "data" / "lineage"
REPORT_DIR = ROOT / "artifacts" / "reports"

SOURCE = "openfootball/football.json"
SOURCE_URL = "https://raw.githubusercontent.com/openfootball/football.json/master/{season}/{league}.json"
SOURCE_LICENSE = "Public domain (CC0), per openfootball/football.json README"

LEAGUES = {"en.1": "England Premier League", "de.1": "Germany Bundesliga",
           "es.1": "Spain La Liga", "it.1": "Italy Serie A", "fr.1": "France Ligue 1"}
SEASONS = [f"{y}-{str(y + 1)[2:]}" for y in range(2014, 2026)]  # 2014-15 .. 2025-26

# Feature windows / ratings (fixed a priori)
FORM_WINDOW = 5          # previous matches used for form features
MIN_HISTORY = FORM_WINDOW  # cold-start rule: need this many earlier matches
REST_CAP_DAYS = 30.0
ELO_START, ELO_K, ELO_HOME_ADV, ELO_SEASON_CARRY = 1500.0, 20.0, 60.0, 0.75

# Chronological split by season (train < validation < test)
TRAIN_SEASONS = SEASONS[:8]        # 2014-15 .. 2021-22
VALIDATION_SEASONS = SEASONS[8:10]  # 2022-23, 2023-24
TEST_SEASONS = SEASONS[10:]         # 2024-25, 2025-26 (completed matches only)
