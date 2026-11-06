import { FormEvent, useCallback, useEffect, useState } from 'react';
import { MessageCircle, RefreshCw, Send, UserPlus, Users } from 'lucide-react';

const API = import.meta.env.VITE_API_URL === '/same-origin' ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:8000');

type Person = { id: string; username: string; display_name: string };
type PostItem = { id: string; body: string; created_at: string; user: Person };
type MessageItem = { id: string; sender_id: string; receiver_id: string; content: string; created_at: string };
type CurrentUser = { id: string; username: string; display_name: string };

function requestHeaders(token: string, json = false): HeadersInit {
  return { Authorization: `Bearer ${token}`, ...(json ? { 'Content-Type': 'application/json' } : {}) };
}

export function FeedPanel({ token, user }: { token: string; user: CurrentUser }) {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${API}/api/v1/social/feed`, { headers: requestHeaders(token) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'Unable to load the community feed.');
      setPosts(result);
    } catch (e) { setError(e instanceof Error ? e.message : 'Feed unavailable.'); }
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  async function publish(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`${API}/api/v1/social/posts`, { method: 'POST', headers: requestHeaders(token, true), body: JSON.stringify({ body: draft.trim() }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'Could not publish this post.');
      setPosts(current => [result, ...current]); setDraft('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Post could not be published.'); }
    finally { setBusy(false); }
  }

  return <div className="live-feed">
    <form className="create-post" onSubmit={publish}>
      <div className="create-post-top"><div className="avatar avatar-green">{(user.display_name || user.username).slice(0,1).toUpperCase()}</div><textarea maxLength={2000} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Share a football thought with the community…" /></div>
      <div className="create-post-bottom"><span>{draft.length}/2000 · Keep it respectful and on topic.</span><button className="primary-btn" disabled={busy || !draft.trim()}>{busy ? 'Publishing…' : 'Publish post'} <Send size={14}/></button></div>
      {error && <div className="social-error">{error}</div>}
    </form>
    {posts.length === 0 ? <div className="empty-feed"><div className="empty-icon"><MessageCircle size={22}/></div><b>No community posts yet.</b><span>Be the first to share a match thought or football question.</span></div> : posts.map(post => <article className="post-card live-post" key={post.id}><div className="post-head"><div className="avatar avatar-blue">{(post.user.display_name || post.user.username).slice(0,1).toUpperCase()}</div><div className="post-author"><b>{post.user.display_name}</b><span>@{post.user.username} · {new Date(post.created_at).toLocaleString()}</span></div></div><p className="post-copy">{post.body}</p><div className="post-actions"><span><MessageCircle size={15}/> Community post</span><span className="post-note">PitchSide community</span></div></article>)}
  </div>;
}

export function DiscoveryPeople({ token, onOpenMessages }: { token: string; onOpenMessages: () => void }) {
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const search = useCallback(async () => {
    setError('');
    try {
      const response = await fetch(`${API}/api/v1/social/people?q=${encodeURIComponent(query)}`, { headers: requestHeaders(token) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'People search unavailable.');
      setPeople(result);
    } catch (e) { setError(e instanceof Error ? e.message : 'People search unavailable.'); }
  }, [query, token]);
  useEffect(() => { void search(); }, [search]);

  async function follow(person: Person) {
    setBusyId(person.id); setError('');
    try {
      const response = await fetch(`${API}/api/v1/social/follow/${person.id}`, { method: 'POST', headers: requestHeaders(token) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'Unable to follow account.');
      setFollowing(current => current.includes(person.id) ? current : [...current, person.id]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Follow request failed.'); }
    finally { setBusyId(''); }
  }

  return <section className="people-panel"><div className="people-head"><div><span className="eyebrow">FIND YOUR COMMUNITY</span><h3>People to follow</h3></div><Users size={19}/></div><div className="people-search"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by username or display name"/><button onClick={()=>void search()} aria-label="Search people"><RefreshCw size={15}/></button></div>{error && <div className="social-error">{error}</div>}<div className="people-list">{people.length===0 ? <p className="people-empty">No accounts found. Create another account to build your football community.</p> : people.map(person=><div className="person-row" key={person.id}><div className="avatar avatar-green">{(person.display_name||person.username).slice(0,1).toUpperCase()}</div><div><b>{person.display_name}</b><small>@{person.username}</small></div><button className={following.includes(person.id)?'follow-btn following':'follow-btn'} disabled={busyId===person.id || following.includes(person.id)} onClick={()=>void follow(person)}>{following.includes(person.id)?'Following':busyId===person.id?'…':<><UserPlus size={13}/> Follow</>}</button></div>)}</div><div className="people-footer"><span>Direct chat is enabled after both accounts follow each other.</span><button onClick={onOpenMessages}>Open messages ↗</button></div></section>;
}

export function DirectMessages({ token, user }: { token: string; user: CurrentUser }) {
  const [friends, setFriends] = useState<Person[]>([]);
  const [peer, setPeer] = useState<Person | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadFriends = useCallback(async () => {
    try {
      const response = await fetch(`${API}/api/v1/social/friends`, { headers: requestHeaders(token) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'Could not load mutual connections.');
      setFriends(result);
    } catch (e) { setError(e instanceof Error ? e.message : 'Messages unavailable.'); }
  }, [token]);
  useEffect(() => { void loadFriends(); }, [loadFriends]);

  const loadMessages = useCallback(async (quiet = false) => {
    if (!peer) return;
    try {
      const response = await fetch(`${API}/api/v1/social/messages?peer_id=${encodeURIComponent(peer.id)}`, { headers: requestHeaders(token) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'Could not load conversation.');
      setMessages(result);
      if (!quiet) setError('');
    } catch (e) { if (!quiet) setError(e instanceof Error ? e.message : 'Conversation unavailable.'); }
  }, [peer, token]);
  useEffect(() => {
    if (!peer) return;
    void loadMessages();
    const id = window.setInterval(() => { void loadMessages(true); }, 5000);
    return () => window.clearInterval(id);
  }, [peer, loadMessages]);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!peer || !draft.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`${API}/api/v1/social/messages`, { method: 'POST', headers: requestHeaders(token, true), body: JSON.stringify({ receiver_id: peer.id, content: draft.trim() }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'Unable to send message.');
      setMessages(current => [...current, result]); setDraft('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Message failed.'); }
    finally { setBusy(false); }
  }

  return <section className="page-content message-page"><div className="message-inbox"><div className="section-heading"><div><span className="eyebrow">YOUR SPACE</span><h2>Conversations</h2></div><button className="icon-btn" onClick={()=>void loadFriends()}><RefreshCw size={17}/></button></div><div className="dm-layout"><aside className="dm-friends"><span className="eyebrow">MUTUAL CONNECTIONS</span>{friends.length===0 ? <p className="dm-empty">No mutual follows yet. Visit Discover and follow someone; they must follow you back before chat is available.</p> : friends.map(friend=><button key={friend.id} className={peer?.id===friend.id?'dm-friend active':'dm-friend'} onClick={()=>setPeer(friend)}><span className="avatar avatar-blue">{(friend.display_name||friend.username).slice(0,1).toUpperCase()}</span><span><b>{friend.display_name}</b><small>@{friend.username}</small></span></button>)}</aside><div className="dm-conversation">{peer ? <><div className="dm-conversation-head"><div className="avatar avatar-green">{peer.display_name.slice(0,1).toUpperCase()}</div><div><b>{peer.display_name}</b><small>@{peer.username} · Mutual connection</small></div></div><div className="dm-messages">{messages.length===0 ? <div className="dm-first-message">Say hello to {peer.display_name}.</div> : messages.map(message=><div key={message.id} className={message.sender_id===user.id?'dm-message mine':'dm-message'}><span>{message.content}</span><small>{new Date(message.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small></div>)}</div><form className="dm-compose" onSubmit={send}><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Write a message…" maxLength={4000}/><button className="send-btn" disabled={busy||!draft.trim()}><Send size={16}/></button></form></> : <div className="dm-no-peer"><MessageCircle size={25}/><b>Select a conversation</b><span>Choose one of your mutual connections to chat.</span></div>}{error && <div className="social-error dm-error">{error}</div>}</div></div><p className="dm-footnote">Messages are stored in PostgreSQL. The current MVP refreshes conversations every five seconds; WebSocket live delivery is a later deployment enhancement.</p></div></section>;
}
