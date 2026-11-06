"""CLI: python -m pipeline.run [ingest|silver|gold|evaluate|all]"""
import sys
from pipeline.ingest import ingest
from pipeline.silver import build_silver
from pipeline.gold import build_gold
from pipeline.evaluate import run_evaluation

STAGES = {"ingest": ingest, "silver": build_silver, "gold": build_gold, "evaluate": run_evaluation}

if __name__ == "__main__":
    stage = sys.argv[1] if len(sys.argv) > 1 else "all"
    for name in (STAGES if stage == "all" else [stage]):
        print(f"== {name}"); STAGES[name]()
