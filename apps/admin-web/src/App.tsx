import { useCallback, useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Activity, AlertTriangle, BrainCircuit, ChartNoAxesCombined, Database, Gauge, HardDrive, LogOut, MessageCircle, RefreshCw, ShieldCheck, Users, Waves } from 'lucide-react';

const API = import.meta.env.VITE_API_URL === '/same-origin' ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:8000');
type AdminUser = { id: string; username: string; display_name: string; email: string; role: string; is_active: boolean; created_at: string; last_seen_at: string | null };
type Metrics = {
  users_total: number; users_active_24h: number; predictions_total: number; matches_total: number; posts_total: number; messages_total: number;
  prediction_classes: Record<string, number>;
  system: { cpu_percent: number; ram_percent: number; ram_used_gb: number; ram_total_gb: number; api_process_ram_mb: number; disk_used_gb: number; disk_total_gb: number; disk_path: string; project_data_models_mb: number };
  ai: { prediction_model: string; assistant_provider: string; reasoning_layer: string; training: { epochs_completed: number; epochs_requested: number; latest_loss: number | null; accuracy: number | null; macro_f1: number | null; trained_at: string | null; version: string | null; model_size_mb: number } };
  generated_at: string;
};

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('pitchside:admin-token') || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  const [view, setView] = useState<'overview' | 'users'>('overview');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [userBusyId, setUserBusyId] = useState('');

  const loadMetrics = useCallback(async (accessToken: string) => {
    setBusy(true); setError('');
    try {
      const response = await fetch(`${API}/api/v1/admin/metrics`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) signOut();
        throw new Error(result.detail || 'Could not load administrator metrics.');
      }
      setMetrics(result); setLastUpdated(new Date(result.generated_at).toLocaleString());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dashboard service is unavailable.');
      if (e instanceof Error && e.message.toLowerCase().includes('administrator')) signOut();
    } finally { setBusy(false); }
  }, []);

  useEffect(() => {
    if (!token || view !== 'overview') return;
    void loadMetrics(token);
    const timer = window.setInterval(() => void loadMetrics(token), 15000);
    return () => window.clearInterval(timer);
  }, [token, view, loadMetrics]);

  const loadUsers = useCallback(async (accessToken: string) => {
    setBusy(true); setError('');
    try {
      const response = await fetch(`${API}/api/v1/admin/users`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) signOut();
        throw new Error(result.detail || 'Could not load player accounts.');
      }
      setUsers(result);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load accounts.'); }
    finally { setBusy(false); }
  }, []);

  async function toggleUser(user: AdminUser) {
    setUserBusyId(user.id); setError('');
    try {
      const response = await fetch(`${API}/api/v1/admin/users/${user.id}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_active: !user.is_active }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'Account status update failed.');
      setUsers(current => current.map(item => item.id === user.id ? { ...item, is_active: result.is_active } : item));
    } catch (e) { setError(e instanceof Error ? e.message : 'Account update failed.'); }
    finally { setUserBusyId(''); }
  }

  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch(`${API}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'Sign-in failed.');
      if (result.user.role !== 'admin') throw new Error('This account is not an administrator.');
      localStorage.setItem('pitchside:admin-token', result.access_token); setToken(result.access_token);
    } catch (e) { setError(e instanceof Error ? e.message : 'Sign-in failed.'); }
    finally { setBusy(false); }
  }

  function signOut() { localStorage.removeItem('pitchside:admin-token'); setToken(''); setMetrics(null); setUsers([]); setView('overview'); }

  if (!token) return <main className="admin-login"><div className="login-brand"><span><Activity size={20}/></span> PITCHSIDE <small>CONTROL ROOM</small></div><div className="login-card"><div className="secure-icon"><ShieldCheck size={25}/></div><span className="eyebrow">RESTRICTED ACCESS</span><h1>Administrator sign in</h1><p>Only authorized administrator accounts can access platform operations and private user metrics.</p><form onSubmit={login}><label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@example.com"/></label><label>Password<input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your administrator password"/></label>{error && <div className="error-banner">{error}</div>}<button className="login-btn" disabled={busy}>{busy ? 'Checking access…' : 'Enter control room'} <span>↗</span></button></form><div className="security-note"><ShieldCheck size={14}/> Admin endpoints are protected by server-side role checks.</div></div><footer>PRIVATE SYSTEM · PITCHSIDE OPERATIONS</footer></main>;

  const totalOutcomes = Object.values(metrics?.prediction_classes || {}).reduce((a,b)=>a+b,0) || 1;
  const classes = [ {name:'Home wins',key:'home',color:'green'}, {name:'Draws',key:'draw',color:'amber'}, {name:'Away wins',key:'away',color:'blue'} ];
  return <div className="admin-app"><aside className="admin-sidebar"><div className="admin-brand"><span><Activity size={18}/></span><div>PITCHSIDE<small>CONTROL ROOM</small></div></div><div className="admin-side-label">OVERVIEW</div><button className={view==='overview'?'admin-side-link active':'admin-side-link'} onClick={()=>setView('overview')}><Gauge size={17}/> System overview</button><button className={view==='users'?'admin-side-link active':'admin-side-link'} onClick={()=>{setView('users'); if(users.length===0) void loadUsers(token);}}><Users size={17}/> User management</button><div className="admin-side-bottom"><div className="secure-chip"><ShieldCheck size={14}/> ADMIN SESSION</div><button onClick={signOut}><LogOut size={16}/> Sign out</button></div></aside>
  <main className="admin-main"><header className="admin-header"><div><span className="eyebrow">PLATFORM OPERATIONS / DASHBOARD</span><h1>{view==='overview'?'System overview':'User management'}</h1><p>{view==='overview'?'Monitor the PitchSide platform, prediction pipeline and local resources.':'Review registered player accounts and manage access status.'}</p></div><div className="header-controls"><span className="live-status"><i/> API connected</span><button className="refresh-btn" onClick={()=>void loadMetrics(token)} disabled={busy}><RefreshCw size={15} className={busy?'spin':''}/> Refresh</button><button className="logout-icon" onClick={signOut} title="Sign out"><LogOut size={17}/></button></div></header>
  {error && <div className="error-banner wide"><AlertTriangle size={17}/>{error}</div>}
  {view==='overview' && (!metrics ? <div className="loading-admin">{busy ? 'Loading private system metrics…' : 'No dashboard metrics available.'}</div> : <>
    <div className="metrics-grid"><Metric icon={<Users/>} label="Registered users" value={metrics.users_total.toLocaleString()} note="Total player accounts" tone="green"/><Metric icon={<Activity/>} label="Active in 24 hours" value={metrics.users_active_24h.toLocaleString()} note="Recently active accounts" tone="blue"/><Metric icon={<ChartNoAxesCombined/>} label="Predictions" value={metrics.predictions_total.toLocaleString()} note="Stored prediction requests" tone="purple"/><Metric icon={<Waves/>} label="Recorded matches" value={metrics.matches_total.toLocaleString()} note="Saved gameplay sessions" tone="amber"/><Metric icon={<MessageCircle/>} label="Community posts" value={metrics.posts_total.toLocaleString()} note="Published posts" tone="blue"/><Metric icon={<Activity/>} label="Direct messages" value={metrics.messages_total.toLocaleString()} note="Stored messages" tone="green"/></div>
    <div className="dashboard-grid"><section className="panel resource-panel"><div className="panel-head"><div><span className="eyebrow">LOCAL MACHINE</span><h2>Resource monitor</h2></div><HardDrive size={18}/></div><Resource label="CPU usage" used={`${metrics.system.cpu_percent}%`} total="Current snapshot" percent={metrics.system.cpu_percent}/><Resource label="Memory usage" used={`${metrics.system.ram_used_gb} GB`} total={`${metrics.system.ram_total_gb} GB`} percent={metrics.system.ram_percent}/><Resource label="API process memory" used={`${metrics.system.api_process_ram_mb} MB`} total="1,200 MB container cap" percent={Math.min(100,metrics.system.api_process_ram_mb/1200)}/><Resource label="Data volume usage" used={`${metrics.system.disk_used_gb} GB`} total={`${metrics.system.disk_total_gb} GB`} percent={metrics.system.disk_total_gb ? metrics.system.disk_used_gb/metrics.system.disk_total_gb*100 : 0}/><Resource label="Project datasets + model files" used={`${metrics.system.project_data_models_mb} MB`} total="Data and artifacts folders" percent={metrics.system.disk_total_gb ? metrics.system.project_data_models_mb/(metrics.system.disk_total_gb*1024)*100 : 0}/><p className="panel-caption">Resource values describe the machine/container or mounted data volume where the API is running. Data path: {metrics.system.disk_path}</p></section>
    <section className="panel model-panel"><div className="panel-head"><div><span className="eyebrow">AI PIPELINE</span><h2>Model & reasoning status</h2></div><BrainCircuit size={19}/></div><div className="model-status-row"><div className="model-symbol"><Activity size={18}/></div><div><b>Football outcome model</b><small>Small CPU neural network</small></div><span className={`state-pill ${metrics.ai.prediction_model==='trained'?'ready':'pending'}`}>{metrics.ai.prediction_model}</span></div><div className="model-status-row"><div className="model-symbol violet"><BrainCircuit size={18}/></div><div><b>Local chat assistant</b><small>{metrics.ai.assistant_provider}</small></div><span className="state-pill info">optional</span></div><div className="model-status-row"><div className="model-symbol amber"><Waves size={18}/></div><div><b>Symbolic reasoning</b><small>{metrics.ai.reasoning_layer}</small></div><span className="state-pill info">fallback</span></div><div className="training-details"><div><span>Epochs</span><b>{metrics.ai.training.epochs_completed}/{metrics.ai.training.epochs_requested || 10}</b></div><div><span>Last loss</span><b>{metrics.ai.training.latest_loss === null ? '—' : metrics.ai.training.latest_loss.toFixed(4)}</b></div><div><span>Test accuracy</span><b>{metrics.ai.training.accuracy === null ? '—' : `${(metrics.ai.training.accuracy * 100).toFixed(1)}%`}</b></div><div><span>Macro F1</span><b>{metrics.ai.training.macro_f1 === null ? '—' : metrics.ai.training.macro_f1.toFixed(3)}</b></div><div><span>Model artifact</span><b>{metrics.ai.training.model_size_mb.toFixed(2)} MB</b></div><div><span>Version</span><b>{metrics.ai.training.version || 'Not trained'}</b></div></div><div className="model-callout"><AlertTriangle size={15}/><span>The dashboard reports deployment status. It does not claim a model is learning unless an actual training run is being executed.</span></div></section>
    <section className="panel outcomes-panel"><div className="panel-head"><div><span className="eyebrow">PREDICTION ACTIVITY</span><h2>Stored outcome distribution</h2></div><ChartNoAxesCombined/></div>{classes.map(c=><div className="outcome-row" key={c.key}><div><b>{c.name}</b><span>{metrics.prediction_classes[c.key] || 0}</span></div><div className="outcome-track"><i className={c.color} style={{width:`${(metrics.prediction_classes[c.key]||0)/totalOutcomes*100}%`}}/></div></div>)}<p className="panel-caption">Distribution of model outputs saved in the database; this is not model accuracy.</p></section>
    <section className="panel ops-panel"><div className="panel-head"><div><span className="eyebrow">SERVICE HEALTH</span><h2>Platform components</h2></div><ShieldCheck size={18}/></div><div className="service-row"><span className="service-led ready"/><div><b>FastAPI backend</b><small>Authenticated API routes</small></div><span>Online</span></div><div className="service-row"><span className="service-led pending"/><div><b>PostgreSQL</b><small>Accounts, predictions and records</small></div><span>Health checked</span></div><div className="service-row"><span className="service-led pending"/><div><b>Neo4j graph</b><small>Social and match relationships</small></div><span>Optional module</span></div><div className="service-row"><span className="service-led info"/><div><b>Hyperon / MeTTa</b><small>Experimental symbolic reasoning</small></div><span>Optional module</span></div><div className="last-updated">Last updated · {lastUpdated}</div></section></div>
  </>)}
  {view==='users' && <section className="panel users-panel"><div className="panel-head"><div><span className="eyebrow">ACCOUNT DIRECTORY</span><h2>Player accounts</h2></div><button className="refresh-btn" onClick={()=>void loadUsers(token)} disabled={busy}><RefreshCw size={14}/> Refresh accounts</button></div><div className="users-toolbar"><span>{users.length} most recent accounts (maximum 200)</span><input value={userQuery} onChange={e=>setUserQuery(e.target.value)} placeholder="Search username, name or email" /></div>{users.length===0 ? <div className="loading-admin">{busy?'Loading accounts…':'No accounts found.'}</div> : <div className="users-table-wrap"><table className="users-table"><thead><tr><th>PLAYER</th><th>EMAIL</th><th>ROLE</th><th>STATUS</th><th>LAST SEEN</th><th>ACTION</th></tr></thead><tbody>{users.filter(user=>`${user.username} ${user.display_name} ${user.email}`.toLowerCase().includes(userQuery.toLowerCase())).map(user=><tr key={user.id}><td><b>{user.display_name}</b><small>@{user.username}</small></td><td>{user.email}</td><td><span className="role-pill">{user.role}</span></td><td><span className={user.is_active?'account-state active':'account-state inactive'}>{user.is_active?'Active':'Disabled'}</span></td><td>{user.last_seen_at?new Date(user.last_seen_at).toLocaleString():'—'}</td><td>{user.role==='admin'?<span className="protected-account">Protected</span>:<button className={user.is_active?'deactivate-btn':'activate-btn'} disabled={userBusyId===user.id} onClick={()=>void toggleUser(user)}>{userBusyId===user.id?'Saving…':user.is_active?'Disable':'Enable'}</button>}</td></tr>)}</tbody></table></div>}<p className="panel-caption">Only player accounts can be enabled or disabled here. Administrator accounts are protected from this control; account deletion and role changes are not exposed.</p></section>}
  <footer className="admin-footer">PITCHSIDE ADMINISTRATION · PRIVATE SYSTEM · {new Date().getFullYear()}</footer></main></div>;
}

function Metric({icon,label,value,note,tone}:{icon:ReactNode;label:string;value:string;note:string;tone:string}){return <section className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><span>{label}</span><strong>{value}</strong><small>{note}</small></section>}
function Resource({label,used,total,percent}:{label:string;used:string;total:string;percent:number}){const safe=Math.max(0,Math.min(100,percent));return <div className="resource-item"><div className="resource-label"><b>{label}</b><span>{used} <i>/ {total}</i></span></div><div className="resource-track"><i style={{width:`${safe}%`}}/></div><small>{safe.toFixed(1)}% used</small></div>}
