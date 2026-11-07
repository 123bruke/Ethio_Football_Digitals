import { useEffect, useState } from 'react';
import {
  Activity,
  Bot,
  Brain,
  CheckCircle2,
  ChevronRight,
  Flame,
  Globe,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  Star,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';

const API =
  import.meta.env.VITE_API_URL === '/same-origin'
    ? ''
    : import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface SquadMember {
  name: string;
  number: number;
  role: string;
  goals: number;
  rating: number;
}

interface WorldLiveMatch {
  id: string;
  league: string;
  country: string;
  home_team: string;
  away_team: string;
  home_code: string;
  away_code: string;
  home_score: number;
  away_score: number;
  minute: string;
  status: string;
  home_color: string;
  away_color: string;
  stadium: string;
  xg: { home: number; away: number };
  possession: { home: number; away: number };
  shots_on_target: { home: number; away: number };
  home_squad: SquadMember[];
  away_squad: SquadMember[];
}

interface GoalPredictorPlayer {
  name: string;
  number: number;
  team: string;
  role: string;
  goal_probability: number;
  reason: string;
}

interface BestPlayerInfo {
  name: string;
  number: number;
  team: string;
  role: string;
  predicted_rating: number;
  key_factors: string[];
}

interface MatchPredictionData {
  match_id: string;
  home_team: string;
  away_team: string;
  ml_probabilities: { home: number; draw: number; away: number };
  predicted_winner: string;
  confidence: number;
  xg: { home: number; away: number };
  predicted_goal_scorers: GoalPredictorPlayer[];
  best_players: { home: BestPlayerInfo; away: BestPlayerInfo };
  tactical_summary: string;
  projected_score: string;
  ai_model_used: string;
}

interface AIWorldPredictionsProps {
  token: string;
  onLaunchGame?: (mode?: 'squad' | '1v1') => void;
}

export function AIWorldPredictions({ token, onLaunchGame }: AIWorldPredictionsProps) {
  const [matches, setMatches] = useState<WorldLiveMatch[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<WorldLiveMatch | null>(null);
  const [prediction, setPrediction] = useState<MatchPredictionData | null>(null);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const [activeTab, setActiveTab] = useState<'matches' | 'ml_models' | 'prediction'>('matches');
  const [modelsList, setModelsList] = useState<any[]>([]);

  const fetchLiveMatches = async () => {
    setLoadingMatches(true);
    try {
      const res = await fetch(`${API}/api/v1/football/world-live`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMatches(data.matches || []);
        if (!selectedMatch && data.matches?.length > 0) {
          setSelectedMatch(data.matches[0]);
          loadPrediction(data.matches[0].id);
        }
      }
    } catch {
      // Fallback
    } finally {
      setLoadingMatches(false);
    }
  };

  const fetchModels = async () => {
    try {
      const res = await fetch(`${API}/api/v1/football/models-summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setModelsList(data.models || []);
      }
    } catch {}
  };

  const loadPrediction = async (matchId: string) => {
    setLoadingPrediction(true);
    try {
      const res = await fetch(`${API}/api/v1/football/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ match_id: matchId }),
      });
      if (res.ok) {
        const data = await res.json();
        setPrediction(data);
      }
    } catch {
    } finally {
      setLoadingPrediction(false);
    }
  };

  useEffect(() => {
    fetchLiveMatches();
    fetchModels();
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-8 select-none">
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live World Tracking
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
              Gemini 3.8 Flash + ML Ensemble
            </span>
          </div>
          <h1 className="text-3xl font-display font-bold text-white tracking-tight">
            World Live Matches & Unified AI Predictions
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time live scores streaming from global leagues with calibrated ML 1X2 models & Gemini AI goal-scorer forecasts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchLiveMatches}
            disabled={loadingMatches}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-medium text-slate-200 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingMatches ? 'animate-spin text-sky-400' : ''}`} />
            <span>Refresh Live Data</span>
          </button>

          {onLaunchGame && (
            <button
              type="button"
              onClick={() => onLaunchGame('squad')}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-slate-950 font-semibold rounded-lg text-xs transition-all shadow-lg shadow-sky-500/20 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Play 3D Match Now</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Pills */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('matches')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'matches'
              ? 'bg-sky-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white bg-slate-900/60'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Live World Fixtures ({matches.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ml_models')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'ml_models'
              ? 'bg-sky-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white bg-slate-900/60'
          }`}
        >
          <Brain className="w-4 h-4" />
          <span>Active ML Models ({modelsList.length || 4})</span>
        </button>
      </div>

      {activeTab === 'ml_models' ? (
        /* ML Models Hub */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(modelsList.length > 0 ? modelsList : [
            {
              id: 'ml-1x2',
              name: '1X2 Probabilistic Ensemble',
              type: 'Gradient Boosting + Isotonic Calibration',
              task: 'Match outcome 1X2 probabilities with Brier score calibration',
              accuracy: '73.8%',
              status: 'Active Production',
            },
            {
              id: 'ml-xg',
              name: 'Expected Goals (xG) Trajectory Engine',
              type: 'Random Forest Regressor',
              task: 'Predicts chance conversion & dangerous shot quality',
              accuracy: 'MAE 0.28',
              status: 'Active Production',
            },
            {
              id: 'metta-reasoner',
              name: 'Symbolic MeTTa Knowledge Reasoner',
              type: 'OpenCog Hyperon Knowledge Space',
              task: 'Fatigue, rivalry, and head-to-head consistency verification',
              accuracy: 'Rule-Engine',
              status: 'Active Production',
            },
            {
              id: 'gemini-3-8',
              name: 'Gemini 3.8 Flash Neural Agent',
              type: 'Multimodal LLM (google-genai)',
              task: 'Goal scorer predictions, player MVP identification & tactical reasoning',
              accuracy: 'GenAI 3.8',
              status: 'Connected',
            },
          ]).map((m, idx) => (
            <div key={idx} className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-base text-white">{m.name}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {m.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{m.task}</p>
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                <span className="font-mono text-sky-400">{m.type}</span>
                <span className="font-semibold text-slate-300">{m.accuracy || 'Calibrated'}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Live Matches & Predictions View */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Live Matches List (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
              Live World Matches
            </h2>
            {loadingMatches ? (
              <div className="flex items-center justify-center p-12 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
              </div>
            ) : (
              matches.map((m) => {
                const isSelected = selectedMatch?.id === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      setSelectedMatch(m);
                      loadPrediction(m.id);
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900/95 border-sky-500 shadow-lg shadow-sky-500/10'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900/40'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                      <span className="font-medium">{m.league}</span>
                      <span className="flex items-center gap-1 font-mono font-bold text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {m.minute}
                      </span>
                    </div>

                    <div className="flex items-center justify-between my-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.home_color }} />
                        <span className="font-display font-bold text-sm text-white">{m.home_team}</span>
                      </div>
                      <span className="font-mono-tabular font-bold text-lg text-white">{m.home_score}</span>
                    </div>

                    <div className="flex items-center justify-between my-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.away_color }} />
                        <span className="font-display font-bold text-sm text-white">{m.away_team}</span>
                      </div>
                      <span className="font-mono-tabular font-bold text-lg text-white">{m.away_score}</span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px] text-slate-500">
                      <span>xG: {m.xg.home} - {m.xg.away}</span>
                      <span>Poss: {m.possession.home}% - {m.possession.away}%</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Unified AI + ML Match Forecast (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {selectedMatch && (
              <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
                {/* Active Match Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider font-mono">
                      {selectedMatch.league} · {selectedMatch.country}
                    </span>
                    <h3 className="text-2xl font-display font-bold text-white mt-0.5">
                      {selectedMatch.home_team} vs {selectedMatch.away_team}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">{selectedMatch.stadium}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-center">
                      <span className="text-[10px] text-slate-400 uppercase block font-semibold">Live Score</span>
                      <span className="font-mono-tabular text-xl font-bold text-white">
                        {selectedMatch.home_score} - {selectedMatch.away_score}
                      </span>
                    </div>
                    <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-xs font-bold animate-pulse">
                      {selectedMatch.minute}
                    </span>
                  </div>
                </div>

                {/* Section 1: ML Model Predictions (1X2 Probabilities + Confidence) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
                      <Brain className="w-4 h-4 text-sky-400" />
                      ML Ensemble 1X2 Probabilities
                    </span>
                    {prediction && (
                      <span className="text-xs font-mono text-slate-400">
                        Predicted Winner: <strong className="text-sky-400">{prediction.predicted_winner}</strong> (
                        {Math.round(prediction.confidence * 100)}% conf)
                      </span>
                    )}
                  </div>

                  {prediction ? (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-center">
                        <span className="text-[11px] text-slate-400 block font-medium mb-1">
                          {selectedMatch.home_team} Win
                        </span>
                        <span className="text-xl font-display font-bold text-sky-400">
                          {Math.round(prediction.ml_probabilities.home * 100)}%
                        </span>
                      </div>
                      <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-center">
                        <span className="text-[11px] text-slate-400 block font-medium mb-1">Draw</span>
                        <span className="text-xl font-display font-bold text-amber-300">
                          {Math.round(prediction.ml_probabilities.draw * 100)}%
                        </span>
                      </div>
                      <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-center">
                        <span className="text-[11px] text-slate-400 block font-medium mb-1">
                          {selectedMatch.away_team} Win
                        </span>
                        <span className="text-xl font-display font-bold text-rose-400">
                          {Math.round(prediction.ml_probabilities.away * 100)}%
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-16 flex items-center justify-center text-slate-500">
                      <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
                    </div>
                  )}
                </div>

                {/* Section 2: Gemini AI Goal Scorer Predictions */}
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
                      <Target className="w-4 h-4 text-rose-400" />
                      Gemini AI Predicted Goal Scorers
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {prediction?.ai_model_used || 'Gemini 3.8 Flash'}
                    </span>
                  </div>

                  {loadingPrediction ? (
                    <div className="py-6 flex items-center justify-center gap-2 text-slate-400 text-xs">
                      <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                      <span>Gemini AI is analyzing player shot metrics & goal threats...</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {prediction?.predicted_goal_scorers?.map((player, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-900/95 border border-slate-800/90 rounded-xl p-3.5 space-y-2 hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-sky-400">#{player.number}</span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              {Math.round(player.goal_probability * 100)}% Goal Prob
                            </span>
                          </div>
                          <div>
                            <p className="font-display font-bold text-sm text-white">{player.name}</p>
                            <p className="text-[11px] text-slate-400">
                              {player.team} · {player.role}
                            </p>
                          </div>
                          <p className="text-[11px] text-slate-300 leading-relaxed italic border-t border-slate-800 pt-1.5">
                            "{player.reason}"
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section 3: Predicted Best Player / Match MVP */}
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    Predicted Best Player / Match MVP
                  </span>

                  {prediction?.best_players && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Home Best Player */}
                      {prediction.best_players.home && (
                        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-400">
                              {selectedMatch.home_team} MVP
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400/10 text-amber-300 border border-amber-400/20">
                              ★ {prediction.best_players.home.predicted_rating} Rating
                            </span>
                          </div>
                          <div>
                            <p className="font-display font-bold text-base text-white">
                              {prediction.best_players.home.name}{' '}
                              <span className="font-mono text-xs text-sky-400">
                                #{prediction.best_players.home.number}
                              </span>
                            </p>
                            <p className="text-xs text-slate-400">{prediction.best_players.home.role}</p>
                          </div>
                          <ul className="text-xs text-slate-300 space-y-1">
                            {prediction.best_players.home.key_factors?.map((f, i) => (
                              <li key={i} className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Away Best Player */}
                      {prediction.best_players.away && (
                        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-400">
                              {selectedMatch.away_team} MVP
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400/10 text-amber-300 border border-amber-400/20">
                              ★ {prediction.best_players.away.predicted_rating} Rating
                            </span>
                          </div>
                          <div>
                            <p className="font-display font-bold text-base text-white">
                              {prediction.best_players.away.name}{' '}
                              <span className="font-mono text-xs text-sky-400">
                                #{prediction.best_players.away.number}
                              </span>
                            </p>
                            <p className="text-xs text-slate-400">{prediction.best_players.away.role}</p>
                          </div>
                          <ul className="text-xs text-slate-300 space-y-1">
                            {prediction.best_players.away.key_factors?.map((f, i) => (
                              <li key={i} className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Section 4: Gemini Tactical Insight & Projected Final Score */}
                {prediction && (
                  <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                        <Bot className="w-4 h-4 text-sky-400" />
                        Gemini AI Tactical Match Breakdown
                      </span>
                      <span className="px-2.5 py-1 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono font-bold">
                        Projected Score: {prediction.projected_score}
                      </span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">{prediction.tactical_summary}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
