import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Activity, Bell, BrainCircuit, ChartNoAxesCombined, Check, ChevronDown,
  Compass, Home, LogOut, Menu, MessageCircle, Plus, Search, Send,
  Settings, Shield, Sparkles, Trophy, UserRound, Users, X,
} from 'lucide-react';
import { GameExperience } from './components/GameExperience';
import { DirectMessages, DiscoveryPeople, FeedPanel } from './components/SocialPanels';

type Tab = 'home' | 'discover' | 'messages' | 'ai' | 'game' | 'profile' | 'settings';
type AuthMode = 'login' | 'register';
type User = { id: string; username: string; display_name: string; email: string; role: string };
type AssistantMessage = { role: 'assistant' | 'user'; content: string };
type Prediction = { home: string; draw: string; away: string; predicted: string; confidence: number };

const API = import.meta.env.VITE_API_URL === '/same-origin' ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:8000');
const navigation: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'messages', label: 'Messages', icon: MessageCircle },
  { id: 'ai', label: 'AI assistant', icon: BrainCircuit },
  { id: 'game', label: 'Play game', icon: Trophy },
  { id: 'profile', label: 'Profile', icon: UserRound },
];

function AuthScreen({ onAuthenticated }: { onAuthenticated: (token: string, user: User) => void }) {
  const [mode, setMode] = useState<AuthMode>('register');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const path = mode === 'register' ? '/api/v1/auth/register' : '/api/v1/auth/login';
      const body = mode === 'register'
        ? { username, display_name: displayName || username, email, password }
        : { email, password };
      const response = await fetch(`${API}${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'Unable to authenticate. Check the API and your details.');
      onAuthenticated(result.access_token, result.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-art">
        <div className="brand brand-light"><span className="brand-mark"><Activity size={19} /></span> pitchside</div>
        <div className="auth-art-copy">
          <span className="eyebrow">FOOTBALL, WITH A SMARTER SIDE</span>
          <h1>See the game.<br /><em>Think ahead.</em></h1>
          <p>Play, predict, and connect with a football community powered by responsible AI.</p>
        </div>
        <div className="auth-art-stats"><span><b>01</b> PLAY TOGETHER</span><span><b>02</b> LEARN THE GAME</span><span><b>03</b> PREDICT WITH CONTEXT</span></div>
      </section>
      <section className="auth-panel">
        <div className="auth-topline"><span className="brand"><span className="brand-mark"><Activity size={18} /></span> pitchside</span><span className="muted">Your football community</span></div>
        <div className="auth-card">
          <span className="eyebrow">WELCOME TO PITCHSIDE</span>
          <h2>{mode === 'register' ? 'Create your account' : 'Welcome back'}</h2>
          <p className="muted">{mode === 'register' ? 'Join the community and make every match count.' : 'Sign in to continue to your football space.'}</p>
          <form onSubmit={submit} className="auth-form">
            {mode === 'register' && <>
              <label>Username<input required minLength={3} value={username} onChange={e => setUsername(e.target.value)} placeholder="your_username" autoComplete="username" /></label>
              <label>Display name<input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="How people see you" /></label>
            </>}
            <label>Email address<input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></label>
            <label>Password<input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} /></label>
            {error && <div className="form-error">{error}</div>}
            <button className="primary-btn full-btn" disabled={busy}>{busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'} <ChevronDown size={16} className="button-arrow" /></button>
          </form>
          <p className="auth-switch">{mode === 'register' ? 'Already have an account?' : 'New to PitchSide?'} <button onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}>{mode === 'register' ? 'Sign in' : 'Create account'}</button></p>
          <p className="auth-legal">By continuing, you agree to use predictions as informational estimates, not guarantees.</p>
        </div>
        <span className="auth-footer">© 2026 PitchSide · Built for the love of football</span>
      </section>
    </main>
  );
}

function AppShell({ user, token, onLogout }: { user: User; token: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('home');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chat, setChat] = useState<AssistantMessage[]>([{ role: 'assistant', content: 'Hi! I can explain football stats, describe how the prediction model works, or help you understand a match. What would you like to explore?' }]);
  const [chatBusy, setChatBusy] = useState(false);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [predictionError, setPredictionError] = useState('');
  const [matchForm, setMatchForm] = useState({ home: 'Home team', away: 'Away team', homeForm: 1.5, awayForm: 1.2, homeGoals: 1.6, awayGoals: 1.1, homeConceded: 0.9, awayConceded: 1.2, homeWinRate: 0.5, awayWinRate: 0.4, homeRestDays: 5, awayRestDays: 5, homeLeaguePositionNorm: 0.45, awayLeaguePositionNorm: 0.55 });

  useEffect(() => {
    const saved = localStorage.getItem('pitchside:last-tab') as Tab | null;
    if (saved && navigation.some(n => n.id === saved)) setTab(saved);
  }, []);
  useEffect(() => { localStorage.setItem('pitchside:last-tab', tab); }, [tab]);

  const pageTitle = useMemo(() => ({ home: 'Your football space', discover: 'Discover football', messages: 'Messages', ai: 'AI match companion', game: 'Play PitchSide', profile: 'Your profile', settings: 'Settings' }[tab]), [tab]);

  async function sendChat(event: FormEvent) {
    event.preventDefault();
    const prompt = chatInput.trim();
    if (!prompt || chatBusy) return;
    setChat(prev => [...prev, { role: 'user', content: prompt }]);
    setChatInput('');
    setChatBusy(true);
    try {
      const response = await fetch(`${API}/api/v1/assistant/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: prompt }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'Assistant is unavailable.');
      setChat(prev => [...prev, { role: 'assistant', content: result.answer }]);
    } catch (e) {
      setChat(prev => [...prev, { role: 'assistant', content: e instanceof Error ? e.message : 'The assistant could not respond.' }]);
    } finally { setChatBusy(false); }
  }

  async function runPrediction(event: FormEvent) {
    event.preventDefault();
    setPrediction(null); setPredictionError('');
    try {
      const response = await fetch(`${API}/api/v1/predictions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ home_team: matchForm.home, away_team: matchForm.away, features: {
          home_recent_points: matchForm.homeForm, away_recent_points: matchForm.awayForm,
          home_goals_for_avg: matchForm.homeGoals, away_goals_for_avg: matchForm.awayGoals,
          home_goals_against_avg: matchForm.homeConceded, away_goals_against_avg: matchForm.awayConceded,
          home_win_rate: matchForm.homeWinRate, away_win_rate: matchForm.awayWinRate,
          home_rest_days: matchForm.homeRestDays, away_rest_days: matchForm.awayRestDays,
          home_league_position_norm: matchForm.homeLeaguePositionNorm, away_league_position_norm: matchForm.awayLeaguePositionNorm,
        } }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'Prediction service is not ready.');
      setPrediction(result);
    } catch (e) { setPredictionError(e instanceof Error ? e.message : 'Prediction failed.'); }
  }

  const handleNav = (id: Tab) => { setTab(id); setMobileMenu(false); };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand"><span className="brand-mark"><Activity size={18} /></span><span>pitchside</span></div>
        <div className="sidebar-profile"><div className="avatar avatar-green">{(user.display_name || user.username).slice(0, 1).toUpperCase()}</div><div><b>{user.display_name || user.username}</b><span>@{user.username}</span></div><span className="online-dot" /></div>
        <nav className="side-nav">{navigation.map(item => { const Icon = item.icon; return <button key={item.id} className={tab === item.id ? 'nav-item active' : 'nav-item'} onClick={() => handleNav(item.id)}><Icon size={19} strokeWidth={tab === item.id ? 2.4 : 1.8} /><span>{item.label}</span>{item.id === 'ai' && <span className="nav-new">AI</span>}</button>; })}</nav>
        <div className="sidebar-bottom"><button className="nav-item" onClick={() => handleNav('settings')}><Settings size={19} /><span>Settings</span></button><button className="nav-item" onClick={onLogout}><LogOut size={19} /><span>Sign out</span></button><div className="sidebar-foot">PLAY FAIR · THINK CLEAR</div></div>
      </aside>

      <main className="main-column">
        <header className="topbar">
          <button className="mobile-menu-btn" onClick={() => setMobileMenu(v => !v)} aria-label="Open navigation">{mobileMenu ? <X size={21} /> : <Menu size={21} />}</button>
          <div><span className="topbar-kicker">PITCHSIDE / COMMUNITY</span><h1>{pageTitle}</h1></div>
          <div className="topbar-actions"><button className="icon-btn" aria-label="Search" onClick={() => handleNav('discover')}><Search size={19} /></button><button className="icon-btn notification-btn" aria-label="Notifications"><Bell size={19} /><i /></button><button className="topbar-avatar" onClick={() => handleNav('profile')}>{(user.display_name || user.username).slice(0, 1).toUpperCase()}</button></div>
        </header>

        {tab === 'home' && <section className="page-content home-layout">
          <div className="feed-column">
            <div className="welcome-banner"><div><span className="eyebrow">YOUR NEXT 90 MINUTES START HERE</span><h2>Football is better<br />when we <em>play together.</em></h2><p>Connect with fans, learn from match data, and take on the AI.</p><button className="banner-btn" onClick={() => handleNav('game')}>Play a match <Trophy size={16} /></button></div><div className="banner-ball">⚽</div><div className="banner-stamp">EST. FOR<br />THE GAME</div></div>
            <div className="section-heading"><div><span className="eyebrow">COMMUNITY</span><h2>Latest from the pitch</h2></div><button className="text-btn" onClick={() => handleNav('discover')}>Explore all <span>↗</span></button></div>
            <FeedPanel token={token} user={user} />
          </div>
          <aside className="right-rail"><div className="rail-card"><div className="rail-title"><span className="eyebrow">QUICK ACCESS</span><Sparkles size={17} /></div><button className="quick-link" onClick={() => handleNav('ai')}><span className="quick-icon ai-icon"><BrainCircuit size={18} /></span><span><b>Ask the AI assistant</b><small>Get a clear match explanation</small></span><span className="quick-arrow">↗</span></button><button className="quick-link" onClick={() => handleNav('game')}><span className="quick-icon game-icon"><Trophy size={18} /></span><span><b>Start a football match</b><small>Play against the game AI</small></span><span className="quick-arrow">↗</span></button><button className="quick-link" onClick={() => handleNav('discover')}><span className="quick-icon discover-icon"><Compass size={18} /></span><span><b>Discover the community</b><small>Find people and discussions</small></span><span className="quick-arrow">↗</span></button></div>
            <div className="rail-card prediction-mini"><span className="eyebrow">PREDICTION LAB</span><h3>Data over guesswork.</h3><p>Explore probabilities from the trained model when a verified dataset is available.</p><button className="outline-btn" onClick={() => handleNav('discover')}>Open prediction lab <ChartNoAxesCombined size={15} /></button><div className="rail-disclaimer">Predictions are estimates, never guarantees.</div></div>
            <div className="rail-footer">About · Community guidelines · Privacy<br />© 2026 PitchSide</div>
          </aside>
        </section>}

        {tab === 'discover' && <section className="page-content"><div className="intro-row"><div><span className="eyebrow">EXPLORE THE GAME</span><h2>Discover & predict</h2><p className="muted">A simple workspace to explore match information and the prediction service.</p></div><span className="status-chip"><i /> Model service connection</span></div><div className="prediction-workspace"><div className="workspace-copy"><span className="eyebrow">MATCH PREDICTION</span><h3>Make an informed match estimate.</h3><p>Enter pre-match statistics. The system will return a probability only after a real model has been trained with valid historical data.</p><div className="info-note"><Shield size={17} /><span>Predictions are informational. They are not guaranteed outcomes or betting advice.</span></div></div><form className="prediction-form" onSubmit={runPrediction}><div className="form-pair"><label>Home team<input value={matchForm.home} onChange={e => setMatchForm(v => ({ ...v, home: e.target.value }))} required /></label><label>Away team<input value={matchForm.away} onChange={e => setMatchForm(v => ({ ...v, away: e.target.value }))} required /></label></div><span className="form-section-label">RECENT TEAM AVERAGES</span><div className="form-grid">{[
              ['Home points / match','homeForm'],['Away points / match','awayForm'],['Home goals for','homeGoals'],['Away goals for','awayGoals'],['Home goals conceded','homeConceded'],['Away goals conceded','awayConceded'],['Home win rate (0–1)','homeWinRate'],['Away win rate (0–1)','awayWinRate'],['Home rest days','homeRestDays'],['Away rest days','awayRestDays'],['Home strength / position (0–1)','homeLeaguePositionNorm'],['Away strength / position (0–1)','awayLeaguePositionNorm'],
            ].map(([label,key]) => <label key={key}>{label}<input type="number" min={key.toLowerCase().includes('winrate') || key.toLowerCase().includes('positionnorm') ? 0 : 0} max={key.toLowerCase().includes('winrate') || key.toLowerCase().includes('positionnorm') ? 1 : key.toLowerCase().includes('restdays') ? 30 : 5} step={key.toLowerCase().includes('winrate') || key.toLowerCase().includes('positionnorm') ? 0.01 : key.toLowerCase().includes('restdays') ? 1 : 0.1} value={matchForm[key as keyof typeof matchForm]} onChange={e => setMatchForm(v => ({ ...v, [key]: Number(e.target.value) }))} /></label>)}</div><button className="primary-btn full-btn">Run prediction <ChartNoAxesCombined size={16} /></button>{predictionError && <div className="form-error">{predictionError}</div>}{prediction && <div className="prediction-result"><span className="eyebrow">MODEL OUTPUT · {prediction.predicted.toUpperCase()}</span><div className="probability-bars">{[['Home',prediction.home],['Draw',prediction.draw],['Away',prediction.away]].map(([name,val]) => <div key={name}><div><b>{name}</b><span>{(Number(val)*100).toFixed(1)}%</span></div><i style={{ width: `${Number(val)*100}%` }} /></div>)}</div><small>Model confidence: {(prediction.confidence*100).toFixed(1)}%</small></div>}</form></div><DiscoveryPeople token={token} onOpenMessages={() => handleNav('messages')} /><div className="discover-grid"><div className="small-feature"><div className="feature-icon"><Users size={20} /></div><h3>Find your people</h3><p>Connect with football fans, share your thoughts, and build a community around the game.</p></div><div className="small-feature"><div className="feature-icon"><BrainCircuit size={20} /></div><h3>Understand the AI</h3><p>See which features influence a prediction and learn why a model may be uncertain.</p></div><div className="small-feature"><div className="feature-icon"><Trophy size={20} /></div><h3>Play to improve</h3><p>Take on the existing 5v5 football engine and compare your decisions with the game AI.</p></div></div></section>}

        {tab === 'messages' && <DirectMessages token={token} user={user} />}

        {tab === 'ai' && <section className="page-content assistant-page"><div className="assistant-intro"><div className="assistant-orb"><BrainCircuit size={26} /></div><span className="eyebrow">PITCHSIDE INTELLIGENCE</span><h2>Your football thinking partner.</h2><p>Ask about match statistics, model probabilities, football concepts, or how the AI system reaches an explanation.</p><div className="assistant-pills"><span><Check size={13} /> Explains model output</span><span><Check size={13} /> Local model ready when configured</span><span><Check size={13} /> No autonomous account actions</span></div></div><div className="chat-panel"><div className="chat-heading"><div className="assistant-mini"><BrainCircuit size={17} /></div><div><b>PitchSide Assistant</b><small>Reasoning + model context</small></div><span className="chat-status"><i /> Available</span></div><div className="chat-messages">{chat.map((m,i) => <div key={i} className={`chat-row ${m.role}`}><div className="chat-avatar">{m.role === 'assistant' ? <BrainCircuit size={15} /> : (user.display_name || user.username).slice(0,1).toUpperCase()}</div><div className="chat-bubble">{m.content}</div></div>)}{chatBusy && <div className="chat-typing">Assistant is thinking…</div>}</div><form className="chat-compose" onSubmit={sendChat}><input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Ask a football or AI question…" /><button className="send-btn" disabled={chatBusy || !chatInput.trim()} aria-label="Send message"><Send size={17} /></button></form><p className="chat-footnote">The assistant explains information; it cannot place bets, change account security, or take actions without your approval.</p></div></section>}

        {tab === 'game' && <section className="game-page"><div className="game-page-bar"><div><span className="eyebrow">PITCHSIDE ARCADE</span><h2>5v5 · Play against the game AI</h2></div><span className="status-chip"><i /> Game engine ready</span></div><div className="game-frame"><GameExperience token={token} /></div></section>}

        {tab === 'profile' && <section className="page-content"><div className="profile-cover"><div className="profile-avatar">{(user.display_name || user.username).slice(0,1).toUpperCase()}</div></div><div className="profile-main"><div><h2>{user.display_name || user.username}</h2><p className="muted">@{user.username} · {user.email}</p><p className="profile-bio">A member of the PitchSide football community.</p></div><span className="profile-member">MEMBER</span></div><div className="profile-stats"><div><b>—</b><span>Posts</span></div><div><b>—</b><span>Following</span></div><div><b>—</b><span>Followers</span></div><div><b>—</b><span>Matches</span></div></div><div className="profile-note"><Shield size={18} /><span>Your account is managed through the secure API. Administrators have a separate, protected dashboard.</span></div></section>}

        {tab === 'settings' && <section className="page-content"><div className="settings-card"><span className="eyebrow">PREFERENCES</span><h2>Account settings</h2><p className="muted">Your account is registered as <b>{user.email}</b>.</p><div className="settings-row"><div><b>Account role</b><small>{user.role}</small></div><span className="settings-value">{user.role === 'admin' ? 'Administrator' : 'Player'}</span></div><div className="settings-row"><div><b>Privacy & safety</b><small>Use respectful community interactions.</small></div><Shield size={18} /></div><div className="settings-row"><div><b>AI permissions</b><small>AI may explain; account changes require your approval.</small></div><span className="settings-value">User-controlled</span></div><button className="outline-btn logout-btn" onClick={onLogout}><LogOut size={16} /> Sign out</button></div></section>}
        <nav className="mobile-bottom-nav" aria-label="Main navigation">
          {navigation.map(item => { const Icon = item.icon; return <button key={item.id} className={tab === item.id ? 'mobile-nav-item active' : 'mobile-nav-item'} onClick={() => handleNav(item.id)}><Icon size={18}/><span>{item.id === 'game' ? 'Game' : item.id === 'messages' ? 'Chat' : item.label === 'AI assistant' ? 'AI' : item.label}</span></button>; })}
        </nav>
      </main>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('pitchside:token'));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch(`${API}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async r => { if (!r.ok) throw new Error('Session expired'); return r.json(); })
      .then(setUser)
      .catch(() => { localStorage.removeItem('pitchside:token'); setToken(null); setUser(null); })
      .finally(() => setLoading(false));
  }, [token]);

  function authenticated(newToken: string, newUser: User) {
    localStorage.setItem('pitchside:token', newToken);
    setToken(newToken); setUser(newUser);
  }
  function logout() { localStorage.removeItem('pitchside:token'); setToken(null); setUser(null); }

  if (loading) return <div className="loading-screen"><span className="brand-mark"><Activity size={19} /></span><p>Loading your PitchSide space…</p></div>;
  if (!token || !user) return <AuthScreen onAuthenticated={authenticated} />;
  return <AppShell user={user} token={token} onLogout={logout} />;
}
