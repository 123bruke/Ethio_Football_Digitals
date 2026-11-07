import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCheck,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';

const API =
  import.meta.env.VITE_API_URL === '/same-origin'
    ? ''
    : import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface TelegramMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  image_url: string | null;
  created_at: string;
  is_admin: boolean;
}

interface TelegramAdminChatProps {
  token: string;
}

export function TelegramAdminChat({ token }: TelegramAdminChatProps) {
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [content, setContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`${API}/api/v1/football/support/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3500);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size exceeds 5MB limit.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!content.trim() && !selectedImage) || sending) return;

    setSending(true);
    try {
      const res = await fetch(`${API}/api/v1/football/support/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: content.trim() || 'Attached match image / screenshot',
          image_url: selectedImage,
        }),
      });
      if (res.ok) {
        const newMsg = await res.json();
        setMessages((prev) => [...prev, newMsg]);
        setContent('');
        setSelectedImage(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch {
      alert('Failed to send message. Please verify network connection.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col h-[650px] bg-slate-950/95 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl select-none">
      {/* Telegram-style Top Header */}
      <div className="px-5 py-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
              PitchSide Official Support
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </h3>
            <p className="text-[11px] text-slate-400">Direct Admin Channel · Fast Responses & Image Uploads</p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchMessages}
          className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          title="Refresh Messages"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-radial from-slate-900/40 via-slate-950 to-slate-950">
        {loading ? (
          <div className="h-full flex items-center justify-center text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
            <span className="text-xs">Loading support thread...</span>
          </div>
        ) : (
          messages.map((m) => {
            const isAdmin = m.is_admin;
            const timeStr = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <div
                key={m.id}
                className={`flex flex-col ${isAdmin ? 'items-start' : 'items-end'}`}
              >
                <div className="flex items-end gap-2 max-w-[85%] sm:max-w-[70%]">
                  {isAdmin && (
                    <div className="w-7 h-7 rounded-full bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 mb-1">
                      <ShieldAlert className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div
                    className={`rounded-2xl px-4 py-2.5 shadow-md ${
                      isAdmin
                        ? 'bg-slate-900 border border-slate-800 text-slate-100 rounded-bl-xs'
                        : 'bg-sky-600 text-white rounded-br-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 mb-1">
                      <span className={`text-[10px] font-bold ${isAdmin ? 'text-emerald-400' : 'text-sky-200'}`}>
                        {m.sender_name}
                      </span>
                      <span className="text-[10px] opacity-70 font-mono">{timeStr}</span>
                    </div>

                    {/* Image Attachment (if present) */}
                    {m.image_url && (
                      <div className="my-2 rounded-lg overflow-hidden border border-black/20 bg-black/30">
                        <img
                          src={m.image_url}
                          alt="Attachment"
                          onClick={() => setLightboxImg(m.image_url)}
                          className="max-h-60 w-auto object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                        />
                      </div>
                    )}

                    <p className="text-xs whitespace-pre-wrap leading-relaxed">{m.content}</p>

                    <div className="flex justify-end mt-1">
                      <CheckCheck className="w-3 h-3 opacity-60" />
                    </div>
                  </div>

                  {!isAdmin && (
                    <div className="w-7 h-7 rounded-full bg-sky-600/30 border border-sky-500/40 flex items-center justify-center text-sky-300 shrink-0 mb-1">
                      <User className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Selected Image Preview Bar */}
      {selectedImage && (
        <div className="px-4 py-2 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={selectedImage} alt="Preview" className="w-12 h-12 object-cover rounded-lg border border-slate-700" />
            <span className="text-xs text-slate-300">Image attached (Ready to send)</span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedImage(null)}
            className="p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Telegram-style Input Dock */}
      <form onSubmit={handleSendMessage} className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
          id="telegram-file-input"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Attach image or match screenshot"
          className="p-2.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-sky-400 transition-colors cursor-pointer"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Message admin... (e.g. gameplay questions, report bugs, send screenshot)"
          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500"
        />

        <button
          type="submit"
          disabled={(!content.trim() && !selectedImage) || sending}
          className="p-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-bold transition-all shadow-md cursor-pointer"
        >
          {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </form>

      {/* Fullscreen Image Lightbox Modal */}
      {lightboxImg && (
        <div
          onClick={() => setLightboxImg(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img src={lightboxImg} alt="Enlarged" className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl" />
            <button
              type="button"
              onClick={() => setLightboxImg(null)}
              className="absolute top-2 right-2 p-2 bg-slate-900/80 rounded-full text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

