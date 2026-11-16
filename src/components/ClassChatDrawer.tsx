import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  MessageCircle,
  Users,
  UserCheck,
  Sparkles,
  HelpCircle,
  Clock,
  Radio,
  RefreshCw,
  Search
} from 'lucide-react';
import { fetchJson } from '../api';
import { isEffectiveOffline, subscribeOfflineState } from '../offlineSync';

export interface ChatUser {
  id: string;
  nama: string;
  peran: 'admin' | 'guru' | 'wali' | 'siswa';
  mapel?: string;
  nis?: string;
}

export interface ChatMessage {
  ID: string;
  Kelas: string;
  PengirimID: string;
  PengirimNama: string;
  PengirimPeran: string;
  PenerimaID: string;
  PenerimaNama: string;
  Pesan: string;
  Waktu: string;
  Tipe: string;
  Lampiran?: string;
}

interface ClassChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  kelasId: string;
  kelasNama: string;
  currentUser: ChatUser;
  teacherList?: ChatUser[];
  studentList?: ChatUser[];
  showToast?: (msg: string, ms?: number) => void;
}

function formatChatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    if (isToday) return `${hh}:${mm}`;

    const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
    return `${dateStr} ${hh}:${mm}`;
  } catch {
    return '';
  }
}

export const ClassChatDrawer: React.FC<ClassChatDrawerProps> = ({
  isOpen,
  onClose,
  kelasId,
  kelasNama,
  currentUser,
  teacherList = [],
  studentList = [],
  showToast
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeTab, setActiveTab] = useState<'group' | 'direct'>('group');
  const [selectedPeerId, setSelectedPeerId] = useState<string>('ALL');
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  const isTeacherOrAdmin =
    currentUser.peran === 'guru' ||
    currentUser.peran === 'wali' ||
    currentUser.peran === 'admin';

  // Load message history from HTTP API
  const loadHistory = async () => {
    if (!kelasId) return;
    setLoading(true);
    try {
      const res = await fetchJson(
        `/api/chat/messages?kelas=${encodeURIComponent(kelasId)}&userId=${encodeURIComponent(
          currentUser.id
        )}&peran=${encodeURIComponent(currentUser.peran)}`
      );
      if (res.ok && Array.isArray(res.data)) {
        setMessages(res.data);
      }
    } catch (e) {
      console.error('Gagal memuat riwayat pesan:', e);
    } finally {
      setLoading(false);
    }
  };

  // Setup WebSocket connection
  useEffect(() => {
    if (!isOpen || !kelasId) return;

    let isUnmounted = false;

    const connectWebSocket = () => {
      if (isUnmounted || isEffectiveOffline()) {
        setWsConnected(false);
        return;
      }
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/chat`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isUnmounted) return;
          setWsConnected(true);
          ws.send(
            JSON.stringify({
              type: 'join',
              kelas: kelasId,
              userId: currentUser.id,
              peran: currentUser.peran,
              nama: currentUser.nama
            })
          );
        };

        ws.onmessage = event => {
          if (isUnmounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'message' && data.message) {
              const newMsg = data.message as ChatMessage;
              setMessages(prev => {
                if (prev.some(m => m.ID === newMsg.ID)) return prev;
                return [...prev, newMsg];
              });
            }
          } catch (err) {
            console.error('Error parsing WS message:', err);
          }
        };

        ws.onclose = () => {
          if (isUnmounted) return;
          setWsConnected(false);
          if (!isEffectiveOffline()) {
            reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
          }
        };

        ws.onerror = () => {
          if (isUnmounted) return;
          setWsConnected(false);
        };
      } catch {
        setWsConnected(false);
      }
    };

    connectWebSocket();
    loadHistory();

    const unsubOffline = subscribeOfflineState(() => {
      if (isEffectiveOffline()) {
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
        setWsConnected(false);
      } else if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        connectWebSocket();
        void loadHistory();
      }
    });

    return () => {
      isUnmounted = true;
      unsubOffline();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isOpen, kelasId, currentUser.id, currentUser.peran]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab, selectedPeerId]);

  // Handle direct peer default selection
  useEffect(() => {
    if (activeTab === 'direct') {
      if (isTeacherOrAdmin) {
        // Teacher defaults to first student who sent a question or first student
        if (selectedPeerId === 'ALL' && studentList.length > 0) {
          setSelectedPeerId(studentList[0].id);
        }
      } else {
        // Student defaults to first teacher
        if (selectedPeerId === 'ALL' && teacherList.length > 0) {
          setSelectedPeerId(teacherList[0].id);
        }
      }
    } else {
      setSelectedPeerId('ALL');
    }
  }, [activeTab, isTeacherOrAdmin, studentList, teacherList]);

  // Filter messages based on active room
  const visibleMessages = messages.filter(m => {
    if (activeTab === 'group') {
      return !m.PenerimaID || m.PenerimaID === 'ALL';
    } else {
      // Direct 1-on-1 consultation
      if (selectedPeerId === 'ALL') return false;
      const isSenderOrReceiver =
        (m.PengirimID === currentUser.id && m.PenerimaID === selectedPeerId) ||
        (m.PengirimID === selectedPeerId && m.PenerimaID === currentUser.id);
      return isSenderOrReceiver;
    }
  });

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || sending) return;

    let targetPeerName = 'Semua Siswa (Kelas)';
    let targetPeerId = 'ALL';

    if (activeTab === 'direct' && selectedPeerId !== 'ALL') {
      targetPeerId = selectedPeerId;
      if (isTeacherOrAdmin) {
        const targetStudent = studentList.find(s => s.id === selectedPeerId);
        targetPeerName = targetStudent?.nama || 'Siswa';
      } else {
        const targetTeacher = teacherList.find(t => t.id === selectedPeerId);
        targetPeerName = targetTeacher?.nama || 'Bapak/Ibu Guru';
      }
    }

    const payload = {
      kelas: kelasId,
      pengirimId: currentUser.id,
      pengirimNama: currentUser.nama,
      pengirimPeran: currentUser.peran,
      penerimaId: targetPeerId,
      penerimaNama: targetPeerName,
      pesan: text,
      tipe: 'teks',
      lampiran: ''
    };

    setSending(true);
    setInputText('');

    // If WebSocket is open, send via WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'chat', ...payload }));
        setSending(false);
        return;
      } catch (err) {
        console.warn('WebSocket send failed, falling back to HTTP POST', err);
      }
    }

    // Fallback to HTTP POST
    try {
      const res = await fetchJson('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok && res.data) {
        setMessages(prev => [...prev, res.data]);
      } else if (!res.ok) {
        showToast?.(res.error || 'Gagal mengirim pesan.', 3500);
      }
    } catch (e: any) {
      showToast?.('Gagal mengirim pesan chat: ' + (e.message || String(e)), 3500);
    } finally {
      setSending(false);
    }
  };

  const quickPrompts = isTeacherOrAdmin
    ? [
        'Ada yang ingin ditanyakan terkait materi hari ini?',
        'Pengingat: Tugas akan ditutup malam ini pukul 23:59 WIB.',
        'Silakan cek slide pemantik dan materi baru di portal.'
      ]
    : [
        'Bapak/Ibu, ada yang belum saya pahami di materi modul ini.',
        'Kapan batas waktu pengumpulan tugasnya?',
        'Terima kasih banyak atas penjelasannya!'
      ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col justify-between border-l border-slate-200 animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-4 bg-gradient-to-r from-indigo-700 via-indigo-800 to-purple-800 text-white flex items-center justify-between gap-3 shadow-sm">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-indigo-300 shrink-0" />
              <h2 className="text-base font-bold tracking-tight truncate">
                Ruang Diskusi & Tanya Guru
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-indigo-200 mt-0.5">
              <span className="font-medium text-white">{kelasNama || 'Kelas'}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <span
                  className={`w-2 h-2 rounded-full ${
                    wsConnected ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span>{wsConnected ? 'Langsung Terhubung' : 'Mode Sinkron'}</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={loadHistory}
              title="Segarkan pesan"
              className="p-1.5 rounded-lg text-indigo-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-indigo-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Room Tab Selector */}
        <div className="px-4 pt-3 pb-2 bg-slate-50 border-b border-slate-200 space-y-2">
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('group')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'group'
                  ? 'bg-white text-indigo-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span>Diskusi Kelas (Grup)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('direct')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'direct'
                  ? 'bg-white text-indigo-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-purple-600" />
              <span>{isTeacherOrAdmin ? 'Tanya Siswa (Privat)' : 'Tanya Guru (Privat)'}</span>
            </button>
          </div>

          {/* 1-on-1 Peer Selection Dropdown / Pills */}
          {activeTab === 'direct' && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                {isTeacherOrAdmin ? 'Pilih Siswa:' : 'Pilih Guru:'}
              </span>
              <select
                value={selectedPeerId}
                onChange={e => setSelectedPeerId(e.target.value)}
                className="w-full px-2.5 py-1 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-800"
              >
                {isTeacherOrAdmin ? (
                  studentList.length === 0 ? (
                    <option value="ALL">Tidak ada data siswa</option>
                  ) : (
                    studentList.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.nama} {s.nis ? `(NIS: ${s.nis})` : ''}
                      </option>
                    ))
                  )
                ) : teacherList.length === 0 ? (
                  <option value="ALL">Wali Kelas / Guru Pengampu</option>
                ) : (
                  teacherList.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.nama} {t.mapel ? `· ${t.mapel}` : ''}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
          {loading && messages.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2 text-indigo-500" />
              Memuat percakapan kelas…
            </div>
          ) : visibleMessages.length === 0 ? (
            <div className="py-12 px-6 text-center space-y-2">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <MessageCircle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                {activeTab === 'group'
                  ? 'Belum ada pesan di Ruang Diskusi Kelas'
                  : 'Belum ada konsultasi pesan privat'}
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                {activeTab === 'group'
                  ? 'Gunakan ruang ini untuk bertanya materi ajar, berdiskusi tugas, atau memberi pengumuman kelas.'
                  : 'Kirimkan pertanyaan atau konsultasi langsung kepada guru pengampu secara privat.'}
              </p>
            </div>
          ) : (
            visibleMessages.map(msg => {
              const isMe = msg.PengirimID === currentUser.id;
              const isTeacher =
                msg.PengirimPeran === 'guru' ||
                msg.PengirimPeran === 'wali' ||
                msg.PengirimPeran === 'admin';
              const isAnnouncement = msg.Tipe === 'pengumuman';

              if (isAnnouncement) {
                return (
                  <div
                    key={msg.ID}
                    className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1 my-2"
                  >
                    <div className="flex items-center justify-between font-bold text-[11px] text-amber-800">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" /> Pengumuman · {msg.PengirimNama}
                      </span>
                      <span className="font-mono font-normal text-[10px] text-amber-600">
                        {formatChatTime(msg.Waktu)}
                      </span>
                    </div>
                    <p className="whitespace-pre-line leading-relaxed">{msg.Pesan}</p>
                  </div>
                );
              }

              return (
                <div
                  key={msg.ID}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}
                >
                  <div className="flex items-center gap-1.5 px-1 text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-700">
                      {isMe ? 'Saya' : msg.PengirimNama}
                    </span>
                    {isTeacher && (
                      <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded text-[10px] font-bold">
                        {msg.PengirimPeran === 'wali' ? 'Wali Kelas' : 'Guru'}
                      </span>
                    )}
                    <span>·</span>
                    <span className="font-mono tabular-nums text-[10px]">
                      {formatChatTime(msg.Waktu)}
                    </span>
                  </div>

                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs shadow-2xs leading-relaxed whitespace-pre-line ${
                      isMe
                        ? 'bg-indigo-600 text-white rounded-tr-xs'
                        : isTeacher
                        ? 'bg-white border border-indigo-200 text-slate-900 rounded-tl-xs'
                        : 'bg-white border border-slate-200 text-slate-900 rounded-tl-xs'
                    }`}
                  >
                    {msg.Pesan}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts Bar */}
        <div className="px-4 py-2 bg-slate-100/70 border-t border-slate-200 flex items-center gap-1.5 overflow-x-auto text-xs">
          <span className="text-[10px] font-bold uppercase text-slate-400 shrink-0">Cepat:</span>
          {quickPrompts.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(prompt)}
              className="px-2.5 py-1 text-[11px] font-medium bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-200 rounded-lg whitespace-nowrap cursor-pointer transition-colors shrink-0"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder={
              activeTab === 'group'
                ? `Tulis pesan di kelas ${kelasNama}…`
                : 'Tulis pesan konsultasi privat…'
            }
            className="flex-1 px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-indigo-500 focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Kirim</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ClassChatDrawer;
