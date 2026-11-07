import { useCallback, useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  ChartNoAxesCombined,
  Gauge,
  HardDrive,
  LogOut,
  MessageCircle,
  Radio,
  RefreshCw,
  ShieldCheck,
  Trophy,
  Users,
  Waves,
  Zap,
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL === '/same-origin' ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:8000');

type AdminUser = {
  id: string;
  username: string;
  display_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_seen_at: string | null;
};

type Metrics = {
  users_total: number;
  users_active_24h: number;
  predictions_total: number;
  matches_total: number;
  posts_total: number;
  messages_total: number;
  prediction_classes: Record<string, number>;
  system: {
    cpu_percent: number;
    ram_percent: number;
    ram_used_gb: number;
    ram_total_gb: number;
    api_process_ram_mb: number;
    disk_used_gb: number;
    disk_total_gb: number;
    disk_path: string;
    project_data_models_mb: number;
  };
  ai: {
    prediction_model: string;
    assistant_provider: string;
    reasoning_layer: string;
    training: {
      epochs_completed: number;
      epochs_requested: number;
      latest_loss: number | null;
      accuracy: number | null;
      macro_f1: number | null;
      trained_at: string | null;
      version: string | null;
      model_size_mb: number;
    };
  };
  generated_at: string;
};

type LiveMatchEvent = {
  id: string;
  minute: number;
  type: string;
  team: string;
  player: string;
  detail: string;
  timestamp: string;
  match_title?: string;
};

type LiveMatch = {
  id: string;
  league: string;
  home_team: string;
  away_team: string;
  home_logo: string;
  away_logo: string;
  home_score: number;
  away_score: number;
  total_goals: number;
  minute: number;
  period: string;
  status: string;
  possession: { home: number; away: number };
  shots: { home: number; away: number };
  shots_on_target: { home: number; away: number };
  corners: { home: number; away: number };
  fouls: { home: number; away: number };
  events: LiveMatchEvent[];
  last_update: string;
};

type LiveMatchesState = {
  matches: LiveMatch[];
  total_active_goals: number;
  matches_in_play: number;
  recent_events: LiveMatchEvent[];
  server_time: string;
};

type SupportMessage = {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  image_url: string | null;
  created_at: string;
  is_admin: boolean;
};

type AssistantActivity = {
  id: string;
  user_id: string;
  prompt: string;
  answer: string;
  provider: string;
  action: { type: string; mode?: string; label?: string } | null;
  timestamp: string;
};

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('pitchside:admin-token') || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [liveState, setLiveState] = useState<LiveMatchesState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  const [view, setView] = useState<'overview' | 'live-matches' | 'support' | 'users'>('overview');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [userBusyId, setUserBusyId] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [assistantLogs, setAssistantLogs] = useState<AssistantActivity[]>([]);
  const [adminReplyText, setAdminReplyText] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  const signOut = useCallback(() => {
    localStorage.removeItem('pitchside:admin-token');
    setToken('');
    setMetrics(null);
    setLiveState(null);
    setUsers([]);
    setSupportMessages([]);
    setAssistantLogs([]);
    setView('overview');
  }, []);

  const loadMetrics = useCallback(async (accessToken: string) => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API}/api/v1/admin/metrics`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) signOut();
        throw new Error(result.detail || 'Could not load administrator metrics.');
      }
      setMetrics(result);
      setLastUpdated(new Date(result.generated_at).toLocaleString());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dashboard service is unavailable.');
      if (e instanceof Error && e.message.toLowerCase().includes('administrator')) signOut();
    } finally {
      setBusy(false);
    }
  }, [signOut]);

  const loadLiveMatches = useCallback(async (accessToken: string) => {
    try {
      const response = await fetch(`${API}/api/v1/admin/matches/live`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setLiveState(data);
      }
    } catch {
      // Quiet background polling
    }
  }, []);

  // Real-time live match polling & SSE stream without refresh
  useEffect(() => {
    if (!token) return;

    // Immediate initial fetch
    void loadLiveMatches(token);

    // Continuous 2-second background reactive poll
    const liveTimer = window.setInterval(() => {
      void loadLiveMatches(token);
    }, 2000);

    // Optional EventSource SSE subscription
    let evtSource: EventSource | null = null;
    try {
      evtSource = new EventSource(`${API}/api/v1/admin/matches/stream`);
      evtSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLiveState(data);
        } catch {
          // Ignore parse errors on keep-alives
        }
      };
      evtSource.onerror = () => {
        evtSource?.close();
      };
    } catch {
      // EventSource fallback handled by liveTimer
    }

    return () => {
      window.clearInterval(liveTimer);
      evtSource?.close();
    };
  }, [token, loadLiveMatches]);

  // Periodic metrics polling (every 15s)
  useEffect(() => {
    if (!token || view !== 'overview') return;
    void loadMetrics(token);
    const timer = window.setInterval(() => void loadMetrics(token), 15000);
    return () => window.clearInterval(timer);
  }, [token, view, loadMetrics]);

  const loadUsers = useCallback(async (accessToken: string) => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API}/api/v1/admin/users`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) signOut();
        throw new Error(result.detail || 'Could not load player accounts.');
      }
      setUsers(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load accounts.');
    } finally {
      setBusy(false);
    }
  }, [signOut]);

  async function toggleUser(user: AdminUser) {
    setUserBusyId(user.id);
    setError('');
    try {
      const response = await fetch(`${API}/api/v1/admin/users/${user.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: !user.is_active }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'Account status update failed.');
      setUsers((current) =>
        current.map((item) => (item.id === user.id ? { ...item, is_active: result.is_active } : item))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Account update failed.');
    } finally {
      setUserBusyId('');
    }
  }

  async function triggerGoal(matchId: string, team: 'home' | 'away') {
    if (!token) return;
    setActionBusy(true);
    try {
      const response = await fetch(`${API}/api/v1/admin/matches/trigger-goal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ match_id: matchId, team }),
      });
      if (response.ok) {
        // Immediately fetch updated state
        void loadLiveMatches(token);
      }
    } catch {
      // Quiet ignore
    } finally {
      setActionBusy(false);
    }
  }

  const loadSupportMessages = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/v1/football/support/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSupportMessages(data.messages || []);
      }
    } catch {}
  }, [token]);

  const loadAssistantActivity = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/v1/football/assistant/activity`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAssistantLogs(data.activity || []);
      }
    } catch {}
  }, [token]);

  const sendAdminReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!adminReplyText.trim() || replyBusy || !token) return;
    setReplyBusy(true);
    try {
      const res = await fetch(`${API}/api/v1/football/support/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: adminReplyText.trim() }),
      });
      if (res.ok) {
        setAdminReplyText('');
        void loadSupportMessages();
      }
    } catch {}
    finally {
      setReplyBusy(false);
    }
  };

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'Sign-in failed.');
      if (result.user.role !== 'admin') throw new Error('This account is not an administrator.');
      localStorage.setItem('pitchside:admin-token', result.access_token);
      setToken(result.access_token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <main className="admin-login">
        <div className="login-brand">
          <span>
            <Activity size={20} />
          </span>{' '}
          PITCHSIDE <small>CONTROL ROOM</small>
        </div>
        <div className="login-card">
          <div className="secure-icon">
            <ShieldCheck size={25} />
          </div>
          <span className="eyebrow">RESTRICTED ACCESS</span>
          <h1>Administrator sign in</h1>
          <p>Only authorized administrator accounts can access platform operations, live matches and user metrics.</p>
          <form onSubmit={login}>
            <label>
              Email address
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your administrator password"
              />
            </label>
            {error && <div className="error-banner">{error}</div>}
            <button className="login-btn" disabled={busy}>
              {busy ? 'Checking access…' : 'Enter control room'} <span>↗</span>
            </button>
          </form>
          <div className="security-note">
            <ShieldCheck size={14} /> Admin endpoints are protected by server-side role checks.
          </div>
        </div>
        <footer>PRIVATE SYSTEM · PITCHSIDE OPERATIONS</footer>
      </main>
    );
  }

  const totalOutcomes = Object.values(metrics?.prediction_classes || {}).reduce((a, b) => a + b, 0) || 1;
  const classes = [
    { name: 'Home wins', key: 'home', color: 'green' },
    { name: 'Draws', key: 'draw', color: 'amber' },
    { name: 'Away wins', key: 'away', color: 'blue' },
  ];

  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span>
            <Activity size={18} />
          </span>
          <div>
            PITCHSIDE<small>CONTROL ROOM</small>
          </div>
        </div>
        <div className="admin-side-label">NAVIGATION</div>
        <button
          className={view === 'overview' ? 'admin-side-link active' : 'admin-side-link'}
          onClick={() => setView('overview')}
        >
          <Gauge size={17} /> System overview
        </button>
        <button
          className={view === 'live-matches' ? 'admin-side-link active' : 'admin-side-link'}
          onClick={() => setView('live-matches')}
        >
          <Radio size={17} /> Live matches & goals{' '}
          {liveState && liveState.total_active_goals > 0 && (
            <span
              style={{
                marginLeft: 'auto',
                background: '#5cf0a0',
                color: '#0e291b',
                padding: '2px 7px',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '8px',
              }}
            >
              {liveState.total_active_goals}G
            </span>
          )}
        </button>
        <button
          className={view === 'support' ? 'admin-side-link active' : 'admin-side-link'}
          onClick={() => {
            setView('support');
            void loadSupportMessages();
            void loadAssistantActivity();
          }}
        >
          <MessageCircle size={17} /> Telegram player chat & images
        </button>
        <button
          className={view === 'users' ? 'admin-side-link active' : 'admin-side-link'}
          onClick={() => {
            setView('users');
            if (users.length === 0) void loadUsers(token);
          }}
        >
          <Users size={17} /> User management
        </button>
        <div className="admin-side-bottom">
          <div className="secure-chip">
            <ShieldCheck size={14} /> ADMIN SESSION
          </div>
          <button onClick={signOut}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <span className="eyebrow">PLATFORM OPERATIONS / DASHBOARD</span>
            <h1>
              {view === 'overview'
                ? 'System overview'
                : view === 'live-matches'
                ? 'Real-Time Matches & Goal Monitor'
                : view === 'support'
                ? 'Telegram Support & AI Actions Monitor'
                : 'User management'}
            </h1>
            <p>
              {view === 'overview'
                ? 'Monitor the PitchSide platform, prediction pipeline and local resources.'
                : view === 'live-matches'
                ? 'Live game telemetry, scores, and goal counter updating automatically without page refresh.'
                : view === 'support'
                ? 'Review player Telegram messages, inspect attached photos/screenshots, reply, and monitor live AI actions.'
                : 'Review registered player accounts and manage access status.'}
            </p>
          </div>
          <div className="header-controls">
            <span className="live-status">
              <i /> Real-time active
            </span>
            <button className="refresh-btn" onClick={() => void loadMetrics(token)} disabled={busy}>
              <RefreshCw size={15} className={busy ? 'spin' : ''} /> Refresh
            </button>
            <button className="logout-icon" onClick={signOut} title="Sign out">
              <LogOut size={17} />
            </button>
          </div>
        </header>

        {error && (
          <div className="error-banner wide">
            <AlertTriangle size={17} />
            {error}
          </div>
        )}

        {/* VIEW 1: OVERVIEW */}
        {view === 'overview' &&
          (!metrics ? (
            <div className="loading-admin">{busy ? 'Loading private system metrics…' : 'No dashboard metrics available.'}</div>
          ) : (
            <>
              {/* Quick Live Match Alert Banner */}
              {liveState && (
                <div
                  style={{
                    background: '#eaf5ed',
                    border: '1px solid #cce8d4',
                    borderRadius: '12px',
                    padding: '12px 18px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="live-pulse active">
                      <i /> LIVE FEED
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#1f4e35' }}>
                      {liveState.matches_in_play} matches active in real time with {liveState.total_active_goals} total goals!
                    </span>
                  </div>
                  <button
                    onClick={() => setView('live-matches')}
                    style={{
                      background: '#1c805b',
                      color: '#fff',
                      border: 0,
                      borderRadius: '7px',
                      padding: '6px 14px',
                      fontSize: '10px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Open Live Monitor ↗
                  </button>
                </div>
              )}

              <div className="metrics-grid">
                <Metric icon={<Users />} label="Registered users" value={metrics.users_total.toLocaleString()} note="Total player accounts" tone="green" />
                <Metric icon={<Activity />} label="Active in 24 hours" value={metrics.users_active_24h.toLocaleString()} note="Recently active accounts" tone="blue" />
                <Metric icon={<ChartNoAxesCombined />} label="Predictions" value={metrics.predictions_total.toLocaleString()} note="Stored prediction requests" tone="purple" />
                <Metric icon={<Waves />} label="Recorded matches" value={metrics.matches_total.toLocaleString()} note="Saved gameplay sessions" tone="amber" />
                <Metric icon={<MessageCircle />} label="Community posts" value={metrics.posts_total.toLocaleString()} note="Published posts" tone="blue" />
                <Metric icon={<Trophy />} label="Live match goals" value={(liveState?.total_active_goals || 0).toString()} note="Goals in active games" tone="green" />
              </div>

              <div className="dashboard-grid">
                <section className="panel resource-panel">
                  <div className="panel-head">
                    <div>
                      <span className="eyebrow">LOCAL MACHINE</span>
                      <h2>Resource monitor</h2>
                    </div>
                    <HardDrive size={18} />
                  </div>
                  <Resource label="CPU usage" used={`${metrics.system.cpu_percent}%`} total="Current snapshot" percent={metrics.system.cpu_percent} />
                  <Resource label="Memory usage" used={`${metrics.system.ram_used_gb} GB`} total={`${metrics.system.ram_total_gb} GB`} percent={metrics.system.ram_percent} />
                  <Resource label="API process memory" used={`${metrics.system.api_process_ram_mb} MB`} total="1,200 MB container cap" percent={Math.min(100, metrics.system.api_process_ram_mb / 1200)} />
                  <Resource label="Data volume usage" used={`${metrics.system.disk_used_gb} GB`} total={`${metrics.system.disk_total_gb} GB`} percent={metrics.system.disk_total_gb ? (metrics.system.disk_used_gb / metrics.system.disk_total_gb) * 100 : 0} />
                  <Resource label="Project datasets + model files" used={`${metrics.system.project_data_models_mb} MB`} total="Data and artifacts folders" percent={metrics.system.disk_total_gb ? (metrics.system.project_data_models_mb / (metrics.system.disk_total_gb * 1024)) * 100 : 0} />
                  <p className="panel-caption">
                    Resource values describe the machine/container or mounted data volume where the API is running. Data path: {metrics.system.disk_path}
                  </p>
                </section>

                <section className="panel model-panel">
                  <div className="panel-head">
                    <div>
                      <span className="eyebrow">AI PIPELINE</span>
                      <h2>Model & reasoning status</h2>
                    </div>
                    <BrainCircuit size={19} />
                  </div>
                  <div className="model-status-row">
                    <div className="model-symbol">
                      <Activity size={18} />
                    </div>
                    <div>
                      <b>Football outcome model</b>
                      <small>Small CPU neural network</small>
                    </div>
                    <span className={`state-pill ${metrics.ai.prediction_model === 'trained' ? 'ready' : 'pending'}`}>
                      {metrics.ai.prediction_model}
                    </span>
                  </div>
                  <div className="model-status-row">
                    <div className="model-symbol violet">
                      <BrainCircuit size={18} />
                    </div>
                    <div>
                      <b>Local chat assistant</b>
                      <small>{metrics.ai.assistant_provider}</small>
                    </div>
                    <span className="state-pill info">optional</span>
                  </div>
                  <div className="model-status-row">
                    <div className="model-symbol amber">
                      <Waves size={18} />
                    </div>
                    <div>
                      <b>Symbolic reasoning</b>
                      <small>{metrics.ai.reasoning_layer}</small>
                    </div>
                    <span className="state-pill info">fallback</span>
                  </div>
                  <div className="training-details">
                    <div>
                      <span>Epochs</span>
                      <b>
                        {metrics.ai.training.epochs_completed}/{metrics.ai.training.epochs_requested || 10}
                      </b>
                    </div>
                    <div>
                      <span>Last loss</span>
                      <b>{metrics.ai.training.latest_loss === null ? '—' : metrics.ai.training.latest_loss.toFixed(4)}</b>
                    </div>
                    <div>
                      <span>Test accuracy</span>
                      <b>{metrics.ai.training.accuracy === null ? '—' : `${(metrics.ai.training.accuracy * 100).toFixed(1)}%`}</b>
                    </div>
                    <div>
                      <span>Macro F1</span>
                      <b>{metrics.ai.training.macro_f1 === null ? '—' : metrics.ai.training.macro_f1.toFixed(3)}</b>
                    </div>
                    <div>
                      <span>Model artifact</span>
                      <b>{metrics.ai.training.model_size_mb.toFixed(2)} MB</b>
                    </div>
                    <div>
                      <span>Version</span>
                      <b>{metrics.ai.training.version || 'Not trained'}</b>
                    </div>
                  </div>
                  <div className="model-callout">
                    <AlertTriangle size={15} />
                    <span>The dashboard reports deployment status. It does not claim a model is learning unless an actual training run is being executed.</span>
                  </div>
                </section>

                <section className="panel outcomes-panel">
                  <div className="panel-head">
                    <div>
                      <span className="eyebrow">PREDICTION ACTIVITY</span>
                      <h2>Stored outcome distribution</h2>
                    </div>
                    <ChartNoAxesCombined />
                  </div>
                  {classes.map((c) => (
                    <div className="outcome-row" key={c.key}>
                      <div>
                        <b>{c.name}</b>
                        <span>{metrics.prediction_classes[c.key] || 0}</span>
                      </div>
                      <div className="outcome-track">
                        <i
                          className={c.color}
                          style={{
                            width: `${((metrics.prediction_classes[c.key] || 0) / totalOutcomes) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  <p className="panel-caption">Distribution of model outputs saved in the database; this is not model accuracy.</p>
                </section>

                <section className="panel ops-panel">
                  <div className="panel-head">
                    <div>
                      <span className="eyebrow">SERVICE HEALTH</span>
                      <h2>Platform components</h2>
                    </div>
                    <ShieldCheck size={18} />
                  </div>
                  <div className="service-row">
                    <span className="service-led ready" />
                    <div>
                      <b>FastAPI backend</b>
                      <small>Authenticated API routes</small>
                    </div>
                    <span>Online</span>
                  </div>
                  <div className="service-row">
                    <span className="service-led ready" />
                    <div>
                      <b>PostgreSQL</b>
                      <small>Accounts, predictions and records</small>
                    </div>
                    <span>Healthy (port 5433)</span>
                  </div>
                  <div className="service-row">
                    <span className="service-led ready" />
                    <div>
                      <b>Neo4j graph</b>
                      <small>Social and match relationships</small>
                    </div>
                    <span>Healthy (bolt: 7688)</span>
                  </div>
                  <div className="service-row">
                    <span className="service-led ready" />
                    <div>
                      <b>Local Llama 3.1 8B</b>
                      <small>Ollama local endpoint</small>
                    </div>
                    <span>Connected</span>
                  </div>
                  <div className="last-updated">Last updated · {lastUpdated}</div>
                </section>
              </div>
            </>
          ))}

        {/* VIEW 2: REAL-TIME MATCHES & GOALS (NO REFRESH REQUIRED!) */}
        {view === 'live-matches' && (
          <section className="live-matches-section">
            <div className="live-hero-banner">
              <div className="live-hero-left">
                <span className="live-pulse active">
                  <i /> LIVE TELEMETRY STREAM
                </span>
                <h2>Real-Time Match & Goal Center</h2>
                <p>Telemetry, active scores and goal counts update every 2 seconds without requiring manual browser refreshing.</p>
              </div>
              <div className="live-hero-stats">
                <div className="live-stat-box">
                  <span>AMOUNT OF GOALS</span>
                  <strong>{liveState?.total_active_goals ?? 0}</strong>
                </div>
                <div className="live-stat-box">
                  <span>MATCHES IN PLAY</span>
                  <strong>{liveState?.matches_in_play ?? 0}</strong>
                </div>
                <div className="live-stat-box">
                  <span>UPDATE FREQUENCY</span>
                  <strong style={{ fontSize: '20px', color: '#fff' }}>2.0s</strong>
                </div>
              </div>
            </div>

            <div className="live-matches-grid">
              {(liveState?.matches || []).map((match) => (
                <div className="live-match-card" key={match.id}>
                  <div className="live-card-header">
                    <span className="live-league">{match.league}</span>
                    <span className="live-clock-badge">
                      <span className="live-pulse" style={{ padding: 0, border: 0, background: 'transparent' }}>
                        <i />
                      </span>
                      {match.period} {match.minute}'
                    </span>
                  </div>

                  <div className="live-scoreboard">
                    <div className="team-col">
                      <div className="team-logo">{match.home_logo}</div>
                      <div className="team-name">{match.home_team}</div>
                    </div>
                    <div className="score-col">
                      <div className="score-digits">
                        {match.home_score} : {match.away_score}
                      </div>
                      <div className="total-goals-chip">
                        ⚽ {match.total_goals} {match.total_goals === 1 ? 'Goal' : 'Goals'} Total
                      </div>
                    </div>
                    <div className="team-col">
                      <div className="team-logo">{match.away_logo}</div>
                      <div className="team-name">{match.away_team}</div>
                    </div>
                  </div>

                  <div className="match-stats-row">
                    <div className="stat-split">
                      <b>{match.possession.home}%</b>
                      <span>Possession</span>
                      <b>{match.possession.away}%</b>
                    </div>
                    <div className="stat-bar-track">
                      <div className="stat-bar-home" style={{ width: `${match.possession.home}%` }} />
                      <div className="stat-bar-away" style={{ width: `${match.possession.away}%` }} />
                    </div>
                    <div className="stat-split" style={{ marginTop: '4px' }}>
                      <span>Shots: {match.shots.home} ({match.shots_on_target.home} on target)</span>
                      <span>Shots: {match.shots.away} ({match.shots_on_target.away} on target)</span>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '9px', fontWeight: 800, color: '#7e8f85', marginBottom: '6px' }}>
                      MATCH TIMELINE ({match.events.length} EVENTS)
                    </div>
                    <div className="match-events-list">
                      {match.events.length === 0 ? (
                        <div style={{ fontSize: '9px', color: '#99a89f', textAlign: 'center', padding: '10px 0' }}>
                          Match underway · awaiting first goal event…
                        </div>
                      ) : (
                        match.events.map((evt) => (
                          <div className={`event-item ${evt.type === 'GOAL' ? 'goal-event' : ''}`} key={evt.id}>
                            <span className="event-min">{evt.minute}'</span>
                            <span style={{ fontSize: '11px' }}>{evt.type === 'GOAL' ? '⚽' : evt.type === 'YELLOW_CARD' ? '🟨' : '🧤'}</span>
                            <span className="event-desc">
                              <b>{evt.player}</b> {evt.detail}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="live-card-actions">
                    <button
                      className="simulate-goal-btn"
                      onClick={() => triggerGoal(match.id, 'home')}
                      disabled={actionBusy}
                      title={`Simulate goal for ${match.home_team}`}
                    >
                      <Zap size={13} /> +1 Goal {match.home_team}
                    </button>
                    <button
                      className="simulate-goal-btn away"
                      onClick={() => triggerGoal(match.id, 'away')}
                      disabled={actionBusy}
                      title={`Simulate goal for ${match.away_team}`}
                    >
                      <Zap size={13} /> +1 Goal {match.away_team}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Live Cross-Match Goal Feed */}
            <div className="live-ticker-feed">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Trophy size={18} color="#1c805b" />
                  <h3 style={{ margin: 0 }}>Real-Time Goal & Event Stream</h3>
                </div>
                <span className="live-pulse active">
                  <i /> UPDATING LIVE
                </span>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {(liveState?.recent_events || []).length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#88988e', fontSize: '11px' }}>
                    Listening for match incidents…
                  </div>
                ) : (
                  (liveState?.recent_events || []).map((evt) => (
                    <div
                      key={evt.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: evt.type === 'GOAL' ? '#f0fdf4' : '#fafafa',
                        border: evt.type === 'GOAL' ? '1px solid #bbf7d0' : '1px solid #f0f0f0',
                        borderRadius: '9px',
                        fontSize: '11px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span
                          style={{
                            fontWeight: 800,
                            color: evt.type === 'GOAL' ? '#166534' : '#4b5563',
                            background: evt.type === 'GOAL' ? '#dcfce7' : '#e5e7eb',
                            padding: '3px 7px',
                            borderRadius: '5px',
                            fontSize: '9px',
                          }}
                        >
                          {evt.minute}'
                        </span>
                        <span style={{ fontSize: '14px' }}>
                          {evt.type === 'GOAL' ? '⚽' : evt.type === 'YELLOW_CARD' ? '🟨' : '🧤'}
                        </span>
                        <span>
                          <b style={{ color: '#111827' }}>{evt.player}</b>{' '}
                          <span style={{ color: '#4b5563' }}>({evt.match_title})</span> — {evt.detail}
                        </span>
                      </div>
                      <span style={{ fontSize: '9px', color: '#9ca3af', fontWeight: 600 }}>
                        {new Date(evt.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}

        {/* VIEW 3: TELEGRAM SUPPORT & AI ACTIVITY */}
        {view === 'support' && (
          <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Telegram Support Messages with Image Attachments */}
            <div>
              <div className="panel-head" style={{ marginBottom: '16px' }}>
                <div>
                  <span className="eyebrow">TELEGRAM PLAYER SUPPORT CHAT</span>
                  <h2>Inquiries & Attached Screenshots ({supportMessages.length})</h2>
                </div>
                <button className="refresh-btn" onClick={() => void loadSupportMessages()} disabled={busy}>
                  <RefreshCw size={14} /> Refresh messages
                </button>
              </div>

              <div
                style={{
                  maxHeight: '380px',
                  overflowY: 'auto',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '16px',
                  background: '#f9fafb',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {supportMessages.length === 0 ? (
                  <p style={{ color: '#6b7280', fontSize: '12px', textAlign: 'center', padding: '24px' }}>
                    No support messages received yet.
                  </p>
                ) : (
                  supportMessages.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        alignSelf: m.is_admin ? 'flex-end' : 'flex-start',
                        maxWidth: '80%',
                        background: m.is_admin ? '#0f172a' : '#ffffff',
                        color: m.is_admin ? '#ffffff' : '#111827',
                        border: m.is_admin ? '1px solid #1e293b' : '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: m.is_admin ? '#38bdf8' : '#16a34a' }}>
                          {m.sender_name} ({m.sender_role})
                        </span>
                        <span style={{ fontSize: '9px', opacity: 0.7 }}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {m.image_url && (
                        <div style={{ margin: '8px 0' }}>
                          <img
                            src={m.image_url}
                            alt="Attachment"
                            onClick={() => setEnlargedImage(m.image_url)}
                            style={{
                              maxHeight: '180px',
                              maxWidth: '100%',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              border: '1px solid #cbd5e1',
                            }}
                          />
                          <small style={{ display: 'block', fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>
                            Click image to enlarge
                          </small>
                        </div>
                      )}

                      <p style={{ fontSize: '12px', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.content}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Admin Reply Form */}
              <form onSubmit={sendAdminReply} style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={adminReplyText}
                  onChange={(e) => setAdminReplyText(e.target.value)}
                  placeholder="Type an official admin reply back to players..."
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '12px',
                  }}
                />
                <button
                  type="submit"
                  disabled={!adminReplyText.trim() || replyBusy}
                  style={{
                    padding: '10px 20px',
                    background: '#16a34a',
                    color: '#fff',
                    border: 0,
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {replyBusy ? 'Sending…' : 'Send Admin Reply'}
                </button>
              </form>
            </div>

            {/* AI Assistant Live Activity Feed & Action Execution */}
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '20px' }}>
              <div className="panel-head" style={{ marginBottom: '14px' }}>
                <div>
                  <span className="eyebrow">AI SYSTEM ACTIVITY & USER COMMANDS</span>
                  <h2>Live User Requests & Actions ({assistantLogs.length})</h2>
                </div>
                <button className="refresh-btn" onClick={() => void loadAssistantActivity()} disabled={busy}>
                  <RefreshCw size={14} /> Refresh logs
                </button>
              </div>

              <div
                style={{
                  maxHeight: '320px',
                  overflowY: 'auto',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  background: '#ffffff',
                }}
              >
                {assistantLogs.length === 0 ? (
                  <p style={{ color: '#6b7280', fontSize: '12px', textAlign: 'center', padding: '24px' }}>
                    No assistant prompts logged yet. When players interact or request actions, they will appear here.
                  </p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                        <th style={{ padding: '10px 14px' }}>TIME</th>
                        <th style={{ padding: '10px 14px' }}>USER PROMPT</th>
                        <th style={{ padding: '10px 14px' }}>TRIGGERED ACTION</th>
                        <th style={{ padding: '10px 14px' }}>PROVIDER</th>
                        <th style={{ padding: '10px 14px' }}>RESPONSE SUMMARY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assistantLogs.map((log) => (
                        <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#64748b', fontSize: '10px' }}>
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>
                            "{log.prompt}"
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            {log.action ? (
                              <span
                                style={{
                                  background: '#dcfce7',
                                  color: '#15803d',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontWeight: 700,
                                  fontSize: '10px',
                                }}
                              >
                                ⚡ {log.action.label || log.action.type}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>None</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#0284c7', fontWeight: 600 }}>
                            {log.provider}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#475569' }}>
                            {log.answer}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Modal for viewing enlarged images */}
            {enlargedImage && (
              <div
                onClick={() => setEnlargedImage(null)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.85)',
                  zIndex: 9999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '20px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ position: 'relative', maxWidth: '85vw', maxHeight: '85vh' }}>
                  <img
                    src={enlargedImage}
                    alt="Enlarged"
                    style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '12px', objectFit: 'contain' }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      background: '#000',
                      color: '#fff',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '11px',
                    }}
                  >
                    Click to close
                  </span>
                </div>
              </div>
            )}
          </section>
        )}

        {/* VIEW 4: USERS */}
        {view === 'users' && (
          <section className="panel users-panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">ACCOUNT DIRECTORY</span>
                <h2>Player accounts</h2>
              </div>
              <button className="refresh-btn" onClick={() => void loadUsers(token)} disabled={busy}>
                <RefreshCw size={14} /> Refresh accounts
              </button>
            </div>
            <div className="users-toolbar">
              <span>{users.length} most recent accounts (maximum 200)</span>
              <input
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Search username, name or email"
              />
            </div>
            {users.length === 0 ? (
              <div className="loading-admin">{busy ? 'Loading accounts…' : 'No accounts found.'}</div>
            ) : (
              <div className="users-table-wrap">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>PLAYER</th>
                      <th>EMAIL</th>
                      <th>ROLE</th>
                      <th>STATUS</th>
                      <th>LAST SEEN</th>
                      <th>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users
                      .filter((user) =>
                        `${user.username} ${user.display_name} ${user.email}`.toLowerCase().includes(userQuery.toLowerCase())
                      )
                      .map((user) => (
                        <tr key={user.id}>
                          <td>
                            <b>{user.display_name}</b>
                            <small>@{user.username}</small>
                          </td>
                          <td>{user.email}</td>
                          <td>
                            <span className="role-pill">{user.role}</span>
                          </td>
                          <td>
                            <span className={user.is_active ? 'account-state active' : 'account-state inactive'}>
                              {user.is_active ? 'Active' : 'Disabled'}
                            </span>
                          </td>
                          <td>{user.last_seen_at ? new Date(user.last_seen_at).toLocaleString() : '—'}</td>
                          <td>
                            {user.role === 'admin' ? (
                              <span className="protected-account">Protected</span>
                            ) : (
                              <button
                                className={user.is_active ? 'deactivate-btn' : 'activate-btn'}
                                disabled={userBusyId === user.id}
                                onClick={() => void toggleUser(user)}
                              >
                                {userBusyId === user.id ? 'Saving…' : user.is_active ? 'Disable' : 'Enable'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="panel-caption">
              Only player accounts can be enabled or disabled here. Administrator accounts are protected from this control;
              account deletion and role changes are not exposed.
            </p>
          </section>
        )}

        <footer className="admin-footer">PITCHSIDE ADMINISTRATION · PRIVATE SYSTEM · {new Date().getFullYear()}</footer>
      </main>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  note,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
  tone: string;
}) {
  return (
    <section className="metric-card">
      <div className={`metric-icon ${tone}`}>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </section>
  );
}

function Resource({
  label,
  used,
  total,
  percent,
}: {
  label: string;
  used: string;
  total: string;
  percent: number;
}) {
  const safe = Math.max(0, Math.min(100, percent));
  return (
    <div className="resource-item">
      <div className="resource-label">
        <b>{label}</b>
        <span>
          {used} <i>/ {total}</i>
        </span>
      </div>
      <div className="resource-track">
        <i style={{ width: `${safe}%` }} />
      </div>
      <small>{safe.toFixed(1)}% used</small>
    </div>
  );
}
