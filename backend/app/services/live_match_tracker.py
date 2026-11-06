import random
import time
from datetime import datetime, timezone
from typing import Any

# Default active live matches
DEFAULT_FIXTURES = [
    {
        "id": "match-live-01",
        "league": "Premier League",
        "home_team": "Arsenal",
        "away_team": "Chelsea",
        "home_logo": "🔴",
        "away_logo": "🔵",
        "home_players": ["Bukayo Saka", "Martin Ødegaard", "Gabriel Jesus", "Declan Rice", "Gabriel Martinelli"],
        "away_players": ["Cole Palmer", "Nicolas Jackson", "Enzo Fernández", "Moisés Caicedo", "Pedro Neto"],
    },
    {
        "id": "match-live-02",
        "league": "La Liga",
        "home_team": "Real Madrid",
        "away_team": "Barcelona",
        "home_logo": "⚪",
        "away_logo": "🔴🔵",
        "home_players": ["Vinícius Júnior", "Kylian Mbappé", "Jude Bellingham", "Rodrygo", "Federico Valverde"],
        "away_players": ["Lamine Yamal", "Robert Lewandowski", "Raphinha", "Pedri", "Dani Olmo"],
    },
    {
        "id": "match-live-03",
        "league": "Bundesliga",
        "home_team": "Bayern München",
        "away_team": "Borussia Dortmund",
        "home_logo": "🔴⚪",
        "away_logo": "🟡⚫",
        "home_players": ["Harry Kane", "Jamal Musiala", "Michael Olise", "Leroy Sané", "Joshua Kimmich"],
        "away_players": ["Serhou Guirassy", "Karim Adeyemi", "Julian Brandt", "Marcel Sabitzer", "Emre Can"],
    },
]


class LiveMatchTracker:
    def __init__(self):
        self._matches: dict[str, dict[str, Any]] = {}
        self._last_tick: float = time.time()
        self._initialize_matches()

    def _initialize_matches(self):
        now = datetime.now(timezone.utc)
        for fix in DEFAULT_FIXTURES:
            initial_minute = random.randint(15, 65)
            home_goals = random.randint(0, 2)
            away_goals = random.randint(0, 2)
            events = []

            # Populate initial goal events
            for g in range(home_goals):
                events.append({
                    "id": f"evt-{fix['id']}-h{g}",
                    "minute": random.randint(5, max(6, initial_minute - 5)),
                    "type": "GOAL",
                    "team": "home",
                    "player": random.choice(fix["home_players"]),
                    "detail": "clinical finish from inside the box",
                    "timestamp": now.isoformat(),
                })
            for g in range(away_goals):
                events.append({
                    "id": f"evt-{fix['id']}-a{g}",
                    "minute": random.randint(5, max(6, initial_minute - 5)),
                    "type": "GOAL",
                    "team": "away",
                    "player": random.choice(fix["away_players"]),
                    "detail": "powerful strike into the bottom corner",
                    "timestamp": now.isoformat(),
                })

            events.sort(key=lambda e: e["minute"])

            self._matches[fix["id"]] = {
                **fix,
                "home_score": home_goals,
                "away_score": away_goals,
                "total_goals": home_goals + away_goals,
                "minute": initial_minute,
                "period": "1H" if initial_minute <= 45 else "2H",
                "status": "LIVE",
                "possession": {"home": random.randint(45, 58), "away": 0},
                "shots": {"home": home_goals + random.randint(3, 8), "away": away_goals + random.randint(2, 7)},
                "shots_on_target": {"home": home_goals + random.randint(2, 4), "away": away_goals + random.randint(1, 3)},
                "corners": {"home": random.randint(2, 6), "away": random.randint(1, 5)},
                "fouls": {"home": random.randint(4, 9), "away": random.randint(5, 10)},
                "events": events,
                "last_update": now.isoformat(),
            }
            self._matches[fix["id"]]["possession"]["away"] = 100 - self._matches[fix["id"]]["possession"]["home"]

    def tick(self) -> None:
        """Advance time and generate real-time gameplay actions."""
        now_ts = time.time()
        elapsed = now_ts - self._last_tick
        if elapsed < 2.0:
            return
        self._last_tick = now_ts
        now_iso = datetime.now(timezone.utc).isoformat()

        for match_id, match in list(self._matches.items()):
            # Advance match minute (1 match minute every ~3 real seconds)
            match["minute"] += 1
            minute = match["minute"]

            if minute == 45:
                match["period"] = "HT"
                match["status"] = "HALF_TIME"
            elif minute == 46:
                match["period"] = "2H"
                match["status"] = "LIVE"
            elif minute >= 93:
                # Cycle finished match to new fixture
                match["period"] = "FT"
                match["status"] = "FULL_TIME"
                # Reset after brief full-time state
                match["minute"] = 1
                match["period"] = "1H"
                match["status"] = "LIVE"
                match["home_score"] = 0
                match["away_score"] = 0
                match["total_goals"] = 0
                match["events"] = []

            # Dynamic event generation (goals, shots, cards)
            if match["status"] == "LIVE":
                roll = random.random()
                # 8% chance of goal event on tick
                if roll < 0.08:
                    scoring_team = "home" if random.random() < 0.52 else "away"
                    if scoring_team == "home":
                        match["home_score"] += 1
                        player = random.choice(match["home_players"])
                        detail = random.choice([
                            "sensational curling effort into the top corner!",
                            "tap-in following a swift counter-attack!",
                            "bullet header from an inswinging corner!",
                            "composed penalty buried into the bottom left!",
                        ])
                    else:
                        match["away_score"] += 1
                        player = random.choice(match["away_players"])
                        detail = random.choice([
                            "drilled into the roof of the net on the rebound!",
                            "stunning long-range blast past the diving goalkeeper!",
                            "neatly placed past the onrushing keeper!",
                            "deflected shot trickles over the line!",
                        ])
                    match["total_goals"] = match["home_score"] + match["away_score"]
                    match["shots"][scoring_team] += 1
                    match["shots_on_target"][scoring_team] += 1

                    match["events"].insert(0, {
                        "id": f"evt-{match_id}-{int(now_ts * 1000)}",
                        "minute": minute,
                        "type": "GOAL",
                        "team": scoring_team,
                        "player": player,
                        "detail": detail,
                        "timestamp": now_iso,
                    })
                elif roll < 0.22:
                    # Non-goal event: shot on target or card
                    team = "home" if random.random() < 0.5 else "away"
                    evt_type = "SAVE" if random.random() < 0.65 else "YELLOW_CARD"
                    match["shots"][team] += 1
                    if evt_type == "SAVE":
                        match["shots_on_target"][team] += 1
                        detail = "spectacular fingertip save by the goalkeeper!"
                    else:
                        match["fouls"][team] += 1
                        detail = "tactical foul to halt a promising attack"
                    player = random.choice(match[f"{team}_players"])
                    match["events"].insert(0, {
                        "id": f"evt-{match_id}-{int(now_ts * 1000)}",
                        "minute": minute,
                        "type": evt_type,
                        "team": team,
                        "player": player,
                        "detail": detail,
                        "timestamp": now_iso,
                    })

            # Keep only last 25 events per match
            match["events"] = match["events"][:25]
            match["last_update"] = now_iso

    def trigger_goal(self, match_id: str, team: str = "home", player: str | None = None) -> dict[str, Any]:
        """Manually trigger a real-time goal for testing live updates."""
        match = self._matches.get(match_id)
        if not match:
            # Pick first available match
            match = next(iter(self._matches.values()))
            match_id = match["id"]

        now_iso = datetime.now(timezone.utc).isoformat()
        if team == "home":
            match["home_score"] += 1
            scorer = player or random.choice(match["home_players"])
        else:
            match["away_score"] += 1
            scorer = player or random.choice(match["away_players"])

        match["total_goals"] = match["home_score"] + match["away_score"]
        match["shots"][team] += 1
        match["shots_on_target"][team] += 1

        goal_event = {
            "id": f"evt-{match_id}-{int(time.time() * 1000)}",
            "minute": match["minute"],
            "type": "GOAL",
            "team": team,
            "player": scorer,
            "detail": "commanded goal from admin control room trigger",
            "timestamp": now_iso,
        }
        match["events"].insert(0, goal_event)
        match["last_update"] = now_iso
        return {"match": match, "event": goal_event}

    def get_state(self) -> dict[str, Any]:
        """Returns the real-time match state, scores, and aggregate goal counts."""
        self.tick()
        matches_list = list(self._matches.values())
        total_live_goals = sum(m["total_goals"] for m in matches_list)
        all_events = []
        for m in matches_list:
            for e in m["events"][:5]:
                all_events.append({**e, "match_title": f"{m['home_team']} vs {m['away_team']}"})
        all_events.sort(key=lambda e: e.get("timestamp", ""), reverse=True)

        return {
            "matches": matches_list,
            "total_active_goals": total_live_goals,
            "matches_in_play": sum(1 for m in matches_list if m["status"] == "LIVE"),
            "recent_events": all_events[:15],
            "server_time": datetime.now(timezone.utc).isoformat(),
        }


live_tracker = LiveMatchTracker()

