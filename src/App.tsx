/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  KODE,
  KODE_DESKRIPSI,
  TABS,
  TANGGA,
  KALENDER,
  CHECKLIST,
  KOMUNIKASI,
  ATURAN,
  LEVEL,
  TAHAP,
  HARI,
  TUGAS_PIKET,
  STRUKTUR_STD,
  LVL_STR,
  JENIS_AK,
  STATUS_TP,
  MAPEL_UMUM,
  PERAN_NAMA,
  TAB_PERAN,
  TAB_WALI,
  KOLOM_NILAI,
  ATUR_STD,
  MODUL_AWAL,
  TAB_THEME,
  DAY_THEME,
  avatarColorFor,
  ekstrakTingkatanKelas,
  cocokCakupanKelasAjar,
  formatLabelCakupanKelas
} from './constants';
import {
  callRaw,
  fetchJson,
  num,
  fmt,
  pad,
  ymd,
  uid,
  pesanErr,
  acak,
  urlAman,
  tglTambah,
  tglIndo,
  menit,
  jamStr,
  tumpang,
  pekanTemu,
  adaPelajaran,
  slotJadwal,
  waLink,
  waTarget,
  downloadAjarFile,
  downloadTextAsFile,
  getAjarFilePreviewUrl
} from './api';
import {
  LOGIN_BG_PRESETS,
  DEFAULT_LOGIN_BG,
  resolveLoginBgUrl,
  getLoginBgLabel,
  prosesBackgroundGambar
} from './loginBackgrounds';
import StudentPortal from './components/StudentPortal';
import CloudAiHub from './components/CloudAiHub';
import CbtManager from './components/CbtManager';
import WaBlastModal from './components/WaBlastModal';
import KalenderPendidikan from './components/KalenderPendidikan';
import ResetDatabasePanel from './components/ResetDatabasePanel';
import ImportTableModal, { ImportTableMode } from './components/ImportTableModal';
import { ClassChatDrawer } from './components/ClassChatDrawer';
import {
  PWAInstallButton,
  OfflineModeTogglePill,
  OfflineIndicator,
  useOfflineStatus
} from './components/PwaOfflineControls';
import { syncOfflineQueueNow } from './offlineSync';
import { SiswaEditorModalBody } from './components/SiswaEditorModalBody';
import {
  AturMapelKelasModal,
  EditableKelasRow,
  EditableJurusanRow,
  EditableMapelRow
} from './components/SettingListEditors';
import {
  TpModalForm,
  ModulModalForm,
  PemantikModalForm,
  MateriModalForm,
  SumberLinkItem,
  parseSumberLinks,
  extractUrlsFromText
} from './components/PerangkatAjarModals';
import {
  TugasFormModalBody,
  KunciPgQuickModalBody,
  KoreksiPgSiswaModalBody
} from './components/TugasPgModals';
import {
  KunciUraianQuickModalBody,
  KunciAkuntansiQuickModalBody,
  KoreksiUraianSiswaModalBody,
  KoreksiAkuntansiSiswaModalBody
} from './components/TugasUraianAkuntansiModals';
import {
  parsePgAnswers,
  formatPgNumberedSummary,
  koreksiPgSiswa,
  parseDetailKoreksi,
  inferTotalSoal,
  normalizeOpsiPG
} from './pgTugasUtils';
import {
  TugasTipeSoal,
  formatRupiah,
  koreksiAkuntansiSiswa,
  koreksiUraianSiswa,
  parseAkuntansiKunci,
  parseAkuntansiSiswa,
  parseUraianKunci,
  parseUraianSiswa
} from './uraianAkuntansiUtils';
import {
  BookOpen,
  LayoutDashboard,
  CloudUpload,
  CheckSquare,
  Users,
  Grid,
  Sparkles,
  Network,
  CalendarClock,
  ClipboardList,
  ClipboardCheck,
  BarChart3,
  Award,
  CalendarDays,
  Compass,
  UserCheck,
  Settings,
  RotateCcw,
  Database,
  LogOut,
  RefreshCw,
  Printer,
  Plus,
  Trash2,
  Edit3,
  Save,
  Download,
  Upload,
  Copy,
  KeyRound,
  Play,
  ChevronLeft,
  ChevronRight,
  X,
  Menu,
  CheckCircle2,
  AlertTriangle,
  MessageCircle,
  Image as ImageIcon,
  GraduationCap,
  ArrowLeft,
  FileCheck2,
  Mail,
  Paperclip,
  Eye,
  EyeOff,
  ExternalLink,
  Link2,
  User,
  MapPin,
  Phone,
  HeartPulse,
  Calendar,
  Calculator,
  FileText,
  FileUp,
  Star,
  ArrowRightLeft,
  History
} from 'lucide-react';
import { PoinNilaiModalBody, ModalTargetMode } from './components/PoinNilaiModal';
import {
  POIN_TARGET_OPTIONS,
  PoinTargetKomponen,
  computeStudentPoinStats,
  getPoinTargetLabel,
  normalizePoinTarget
} from './poinLoginUtils';

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  LayoutDashboard,
  CloudUpload,
  CheckSquare,
  Users,
  Grid,
  Sparkles,
  Network,
  CalendarClock,
  BookOpen,
  FileCheck2,
  ClipboardList,
  BarChart3,
  Award,
  CalendarDays,
  Compass,
  UserCheck,
  Settings,
  RotateCcw,
  Database
};

function parseJurusanLogos(raw: any): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (k && typeof v === 'string' && v.startsWith('data:image/')) out[k] = v;
    }
    return out;
  }
  try {
    const parsed = JSON.parse(String(raw));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (k && typeof v === 'string' && v.startsWith('data:image/')) out[k] = v;
      }
      return out;
    }
  } catch (_) {}
  return {};
}

interface PasswordFieldProps {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  maxLength?: number;
}

function PasswordField({
  name,
  value,
  defaultValue,
  onChange,
  placeholder,
  className = '',
  inputMode,
  maxLength
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        name={name}
        type={visible ? 'text' : 'password'}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        className={`${className} pr-10`}
      />
      <button
        type="button"
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          setVisible(v => !v);
        }}
        title={visible ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
        aria-label={visible ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function App() {
  // Session & Auth State
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');
  const [role, setRole] = useState('');
  const [peran, setPeran] = useState('admin');
  const [adminAda, setAdminAda] = useState(true);
  const [loginMode, setLoginMode] = useState<'admin' | 'siswa'>('admin');
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginPass2, setLoginPass2] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [publicInfo, setPublicInfo] = useState<{
    sekolah: string;
    logo: string;
    loginBg?: string;
    jurusan: string;
    jurusanLogos?: string;
    waInfo: string;
    emailHint?: string;
  }>({
    sekolah: 'Sistem Manajemen Kelas',
    logo: '',
    loginBg: DEFAULT_LOGIN_BG,
    jurusan: 'MIPA, IPS, Bahasa',
    jurusanLogos: '{}',
    waInfo: '',
    emailHint: ''
  });
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotUser, setForgotUser] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtpSent, setForgotOtpSent] = useState(false);
  const [forgotOtpPreview, setForgotOtpPreview] = useState('');
  const [forgotVerif, setForgotVerif] = useState('');
  const [forgotPass, setForgotPass] = useState('');
  const [forgotPass2, setForgotPass2] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotOk, setForgotOk] = useState(false);
  const [forgotSiswaNis, setForgotSiswaNis] = useState('');
  const [forgotSiswaNama, setForgotSiswaNama] = useState('');
  const [waBlastState, setWaBlastState] = useState<{
    open: boolean;
    studentId?: string;
    targetType?: 'siswa' | 'ortu';
  }>({ open: false });
  const [importModalMode, setImportModalMode] = useState<ImportTableMode | null>(null);
  const [loginBrandEdit, setLoginBrandEdit] = useState(false);
  const [brandLogoDraft, setBrandLogoDraft] = useState('');
  const [brandBgDraft, setBrandBgDraft] = useState(DEFAULT_LOGIN_BG);
  const [loginBgError, setLoginBgError] = useState(false);
  const [brandSekolahDraft, setBrandSekolahDraft] = useState('');
  const [brandJurusanItems, setBrandJurusanItems] = useState<Array<{ name: string; logo: string }>>([]);
  const [brandNewJurusan, setBrandNewJurusan] = useState('');
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandMsg, setBrandMsg] = useState('');

  // Main Database & Portal State
  const [db, setDb] = useState<Record<string, any>>({
    Pengaturan: {},
    Kelas: [],
    Siswa: [],
    Absensi: [],
    Tugas: [],
    Pengumpulan: [],
    Nilai: [],
    Perilaku: [],
    Checklist: [],
    DenahAtur: [],
    Denah: [],
    Piket: [],
    Struktur: [],
    Jadwal: [],
    JadwalAtur: [],
    Akademik: [],
    TP: [],
    Modul: [],
    Pemantik: [],
    Materi: [],
    Mapel: [],
    CBT: [],
    HasilCBT: [],
    Pengguna: [],
    GuruList: [],
    punyaPIN: [],
    PoinSiswa: []
  });
  const [portal, setPortal] = useState<any>(null);

  // Active Navigation & Class State
  const [K, setK] = useState('');
  const [tab, setTab] = useState('dash');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Toast & Modal
  const [toastMsg, setToastMsg] = useState('');
  const [modalContent, setModalContent] = useState<{
    title: string;
    wide?: boolean;
    render: () => React.ReactNode;
  } | null>(null);
  const [confirmState, setConfirmState] = useState<{
    msg: string;
    resolve: (v: boolean) => void;
  } | null>(null);

  // Sub-views & Feature States
  const [absDate, setAbsDate] = useState(ymd(new Date()));
  const [absMode, setAbsMode] = useState<'input' | 'rekap'>('input');
  const [rekapBulan, setRekapBulan] = useState(ymd(new Date()).slice(0, 7));
  const [absDraft, setAbsDraft] = useState<Record<string, string>>({});
  const [absNote, setAbsNote] = useState<Record<string, string>>({});

  const [tugSel, setTugSel] = useState('');
  const [tugMapelFilter, setTugMapelFilter] = useState('ALL');
  const [denSel, setDenSel] = useState('');
  const [denPick, setDenPick] = useState('');
  const [denDirty, setDenDirty] = useState(false);
  const [akBulan, setAkBulan] = useState(ymd(new Date()).slice(0, 7));
  const [ajarSub, setAjarSub] = useState<'tp' | 'mod' | 'pem' | 'mat'>('mat');
  const [ajarMapelFilter, setAjarMapelFilter] = useState<string>('ALL');
  const [tpFilterModul, setTpFilterModul] = useState<string>('all');
  const [modView, setModView] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [poinNilaiModalOpen, setPoinNilaiModalOpen] = useState(false);
  const [presState, setPresState] = useState<{
    slides: {
      badge?: string;
      title: string;
      body: string;
      links?: SumberLinkItem[];
      fileId?: string;
      fileName?: string;
    }[];
    i: number;
  } | null>(null);
  const kaldikAutoCheckedRef = React.useRef(false);
  const offlineStatus = useOfflineStatus();
  const autoSyncInFlightRef = React.useRef(false);

  // Toast helper
  const showToast = useCallback((msg: string, ms = 2500) => {
    setToastMsg(msg);
    const timer = setTimeout(() => {
      setToastMsg(prev => (prev === msg ? '' : prev));
    }, ms);
    return () => clearTimeout(timer);
  }, []);

  const askConfirm = (msg: string): Promise<boolean> => {
    return new Promise(resolve => {
      setConfirmState({ msg, resolve });
    });
  };

  const simpanTokenStorage = (t: string, r: string) => {
    try {
      if (t) {
        sessionStorage.setItem('mk_token', t);
        sessionStorage.setItem('mk_role', r || '');
        localStorage.setItem('mk_token', t);
        localStorage.setItem('mk_role', r || '');
      } else {
        sessionStorage.removeItem('mk_token');
        sessionStorage.removeItem('mk_role');
        localStorage.removeItem('mk_token');
        localStorage.removeItem('mk_role');
      }
    } catch (_) {}
  };

  const sesiHabis = useCallback((pesan?: string) => {
    setToken('');
    setRole('');
    setPeran('admin');
    setPortal(null);
    simpanTokenStorage('', '');
    setLoginErr(pesan || 'Sesi berakhir, silakan masuk kembali.');
  }, []);

  const apiCall = useCallback(
    async (fn: string, ...args: any[]) => {
      try {
        return await callRaw(fn, token, ...args);
      } catch (e: any) {
        if (pesanErr(e).includes('SESI_HABIS')) {
          sesiHabis();
        }
        throw e;
      }
    },
    [token, sesiHabis]
  );

  const masukSesi = useCallback(async (t: string, r: string) => {
    setToken(t);
    setRole(r);
    simpanTokenStorage(t, r);
    setLoading(true);
    try {
      if (r !== 'siswa') {
        const data = await callRaw('api_load', t);
        setDb(data);
        setPeran(data.peran || 'admin');
        const firstKelas = data.Kelas?.[0]?.ID || '';
        setK(firstKelas);
        setTab('dash');
      } else {
        const pData = await callRaw('api_loadSiswa', t);
        setPortal(pData);
      }
      setLoginErr('');
    } catch (e: any) {
      sesiHabis(pesanErr(e));
    } finally {
      setLoading(false);
    }
  }, [sesiHabis]);

  // Initial session check
  useEffect(() => {
    (async () => {
      try {
        let savedTok = '';
        let savedRole = '';
        try {
          savedTok = sessionStorage.getItem('mk_token') || localStorage.getItem('mk_token') || '';
          savedRole = sessionStorage.getItem('mk_role') || localStorage.getItem('mk_role') || '';
        } catch (_) {}
        if (savedTok && savedRole) {
          await masukSesi(savedTok, savedRole);
          return;
        }
        const st = await callRaw('api_status');
        setAdminAda(!!st.adminAda);
        const info = {
          sekolah: st.sekolah || 'Sistem Manajemen Kelas',
          logo: st.logo || '',
          loginBg: st.loginBg || DEFAULT_LOGIN_BG,
          jurusan: st.jurusan || '',
          jurusanLogos: st.jurusanLogos || '{}',
          waInfo: st.waInfo || '',
          emailHint: st.emailHint || ''
        };
        setPublicInfo(info);
        setLoginBgError(false);
        try {
          localStorage.setItem('mk_public_info', JSON.stringify(info));
        } catch (_) {}
      } catch (e: any) {
        setLoginErr(pesanErr(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [masukSesi]);

  // Load attendance draft whenever class K or absDate changes
  useEffect(() => {
    if (!K || !db.Absensi) return;
    const draft: Record<string, string> = {};
    const note: Record<string, string> = {};
    db.Absensi.filter((a: any) => a.Kelas === K && a.Tanggal === absDate).forEach((a: any) => {
      draft[a.SiswaID] = a.Kode;
      note[a.SiswaID] = a.Keterangan || '';
    });
    setAbsDraft(draft);
    setAbsNote(note);
  }, [K, absDate, db.Absensi]);

  // Silent cross-tab & window-focus sync so Student Portal profile changes appear in Admin immediately
  const lastSilentSyncRef = React.useRef(0);
  const silentSyncNow = useCallback(async () => {
    if (!token) return;
    const now = Date.now();
    if (now - lastSilentSyncRef.current < 1500) return;
    lastSilentSyncRef.current = now;
    try {
      if (role === 'siswa') {
        const pData = await callRaw('api_loadSiswa', token);
        setPortal(pData);
      } else {
        const baru = await callRaw('api_load', token, true);
        setDb(baru);
        setPeran(baru.peran || 'admin');
      }
    } catch (_) {}
  }, [token, role]);

  useEffect(() => {
    if (!token) return;
    let bc: BroadcastChannel | null = null;
    const trigger = () => {
      void silentSyncNow();
    };
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('kelasku_sync');
        bc.onmessage = trigger;
      }
    } catch (_) {}
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'mk_sync_ping') trigger();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') trigger();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', trigger);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      try {
        bc?.close();
      } catch (_) {}
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', trigger);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [token, silentSyncNow]);

  useEffect(() => {
    if (token && role !== 'siswa' && tab === 'sis') {
      void silentSyncNow();
    }
  }, [tab, token, role, silentSyncNow]);

  // Automatic background synchronization when network comes back online and user is not in manual offline mode
  useEffect(() => {
    if (
      !token ||
      !offlineStatus.isNetworkOnline ||
      offlineStatus.isManualOffline ||
      offlineStatus.pendingCount === 0 ||
      autoSyncInFlightRef.current
    ) {
      return;
    }
    autoSyncInFlightRef.current = true;
    (async () => {
      try {
        const res = await syncOfflineQueueNow(token);
        if (res.syncedCount > 0) {
          showToast(`✓ ${res.syncedCount} perubahan offline disinkronkan ke server`, 3500);
          void silentSyncNow();
        }
      } finally {
        autoSyncInFlightRef.current = false;
      }
    })();
  }, [
    token,
    offlineStatus.isNetworkOnline,
    offlineStatus.isManualOffline,
    offlineStatus.pendingCount,
    silentSyncNow,
    showToast
  ]);

  // Keyboard navigation for slide presentation
  useEffect(() => {
    if (!presState) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        setPresState(p => (p ? { ...p, i: Math.min(p.slides.length - 1, p.i + 1) } : null));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setPresState(p => (p ? { ...p, i: Math.max(0, p.i - 1) } : null));
      } else if (e.key === 'Escape') {
        setPresState(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [presState]);

  async function handleLoginSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const u = loginUser.trim();
    const p = loginPass;
    if (!u || !p) {
      setLoginErr('Lengkapi nama pengguna dan kata sandi / PIN.');
      return;
    }
    setLoginErr('Memeriksa kredensial…');
    try {
      let r;
      if (!adminAda) {
        if (p !== loginPass2) {
          setLoginErr('Kata sandi konfirmasi tidak sama.');
          return;
        }
        r = await callRaw('api_setupAdmin', u, p);
        setAdminAda(true);
      } else {
        r = await callRaw('api_login', loginMode, u, p);
      }
      await masukSesi(r.token, r.role);
      if (r?.role === 'siswa' && r?.loginReward?.awarded > 0) {
        showToast(
          `★ +1 Bintang & +${r.loginReward.awarded} Poin Login diterima! Saldo: ${r.loginReward.saldoPoin} Poin`,
          5000
        );
      }
    } catch (err: any) {
      setLoginErr(pesanErr(err));
    }
  }

  async function handleSendEmailOtp() {
    setForgotOk(false);
    const u = forgotUser.trim();
    const em = forgotEmail.trim();
    if (!u || !em) {
      setForgotMsg('Masukkan Nama Pengguna dan Email Pemulihan Admin terlebih dahulu.');
      return;
    }
    setForgotMsg('Memverifikasi email & mengirim kode pemulihan…');
    try {
      const r = await callRaw('api_kirimKodePemulihan', u, em);
      setForgotOtpSent(true);
      setForgotOtpPreview(r.kodePreview || '');
      setForgotOk(true);
      setForgotMsg(r.pesan || 'Kode pemulihan berhasil diterbitkan.');
    } catch (err: any) {
      setForgotOtpSent(false);
      setForgotOtpPreview('');
      setForgotOk(false);
      setForgotMsg(pesanErr(err));
    }
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    setForgotOk(false);
    const u = forgotUser.trim();
    const v = forgotVerif.trim();
    const p1 = forgotPass;
    const p2 = forgotPass2;
    if (!u || !v || !p1) {
      setForgotMsg('Lengkapi nama pengguna, kode OTP / pemulihan, dan kata sandi baru.');
      return;
    }
    if (p1 !== p2) {
      setForgotMsg('Konfirmasi kata sandi baru tidak sama.');
      return;
    }
    setForgotMsg('Memproses pengaturan ulang…');
    try {
      const r = await callRaw('api_lupaSandi', loginMode, u, v, p1);
      setForgotOk(true);
      setForgotMsg(r.pesan || 'Kata sandi berhasil diatur ulang.');
      setLoginUser(u);
      setLoginPass('');
      setForgotPass('');
      setForgotPass2('');
      setForgotVerif('');
      setForgotOtpSent(false);
      setForgotOtpPreview('');
    } catch (err: any) {
      setForgotOk(false);
      setForgotMsg(pesanErr(err));
    }
  }

  async function handleLogout() {
    try {
      if (token) await callRaw('api_logout', token);
    } catch (_) {}
    setToken('');
    setRole('');
    setPortal(null);
    simpanTokenStorage('', '');
    setLoginPass('');
    try {
      const st = await callRaw('api_status');
      setPublicInfo({
        sekolah: st.sekolah || 'Sistem Manajemen Kelas',
        logo: st.logo || '',
        loginBg: st.loginBg || DEFAULT_LOGIN_BG,
        jurusan: st.jurusan || '',
        jurusanLogos: st.jurusanLogos || '{}',
        waInfo: st.waInfo || '',
        emailHint: st.emailHint || ''
      });
      setLoginBgError(false);
    } catch (_) {}
  }

  async function prosesLogoGambar(file: File, maxDim = 240): Promise<string> {
    if (!file.type.startsWith('image/')) {
      throw new Error('Pilih berkas gambar (PNG, JPG, WebP, atau SVG)');
    }
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Gagal membaca berkas gambar'));
      reader.onload = () => {
        const raw = String(reader.result || '');
        if (file.type === 'image/svg+xml' || raw.length < 60000) {
          resolve(raw);
          return;
        }
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(raw);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(raw);
        img.src = raw;
      };
      reader.readAsDataURL(file);
    });
  }

  function bukaEditorBrandingLogin() {
    setBrandLogoDraft(publicInfo.logo || '');
    setBrandBgDraft(publicInfo.loginBg || DEFAULT_LOGIN_BG);
    setLoginBgError(false);
    setBrandSekolahDraft(publicInfo.sekolah || 'Sistem Manajemen Kelas');
    const list = String(publicInfo.jurusan || 'MIPA, IPS, Bahasa')
      .split(',')
      .map(x => x.trim())
      .filter(Boolean);
    const logos = parseJurusanLogos(publicInfo.jurusanLogos);
    const items = (list.length ? list : ['MIPA', 'IPS', 'Bahasa']).map(name => ({
      name,
      logo: logos[name] || ''
    }));
    setBrandJurusanItems(items);
    setBrandNewJurusan('');
    setBrandMsg('');
    setLoginBrandEdit(true);
  }

  async function simpanBrandingLogin(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const pending = brandNewJurusan.trim();
    const combined = pending
      ? [...brandJurusanItems, { name: pending, logo: '' }]
      : [...brandJurusanItems];
    const seen = new Set<string>();
    const cleanedNames: string[] = [];
    const logoMap: Record<string, string> = {};
    combined.forEach(item => {
      const nm = item.name.trim();
      if (!nm) return;
      if (!seen.has(nm)) {
        seen.add(nm);
        cleanedNames.push(nm);
      }
      if (item.logo && !logoMap[nm]) {
        logoMap[nm] = item.logo;
      }
    });
    if (!cleanedNames.length) {
      setBrandMsg('Minimal masukkan 1 nama jurusan.');
      return;
    }
    setBrandSaving(true);
    setBrandMsg('');
    try {
      const res = await callRaw(
        'api_updateLoginBranding',
        brandLogoDraft,
        cleanedNames.join(', '),
        brandSekolahDraft.trim(),
        JSON.stringify(logoMap),
        brandBgDraft
      );
      const nextInfo = {
        ...publicInfo,
        sekolah: res.sekolah || publicInfo.sekolah,
        logo: res.logo || '',
        loginBg: res.loginBg || DEFAULT_LOGIN_BG,
        jurusan: res.jurusan || '',
        jurusanLogos: res.jurusanLogos || '{}'
      };
      setPublicInfo(nextInfo);
      setLoginBgError(false);
      try {
        localStorage.setItem('mk_public_info', JSON.stringify(nextInfo));
      } catch (_) {}
      setLoginBrandEdit(false);
      setBrandNewJurusan('');
      showToast('Logo, gambar latar & daftar jurusan berhasil diperbarui');
    } catch (err: any) {
      setBrandMsg(pesanErr(err));
    } finally {
      setBrandSaving(false);
    }
  }

  async function muatUlang() {
    if (role === 'siswa') {
      try {
        const pData = await apiCall('api_loadSiswa');
        setPortal(pData);
        showToast('Data berhasil dimuat ulang');
      } catch (e: any) {
        showToast(pesanErr(e), 4000);
      }
      return;
    }
    try {
      showToast('Memuat ulang data…', 8000);
      const baru = await apiCall('api_load', true);
      setDb(baru);
      setPeran(baru.peran || 'admin');
      if (!baru.Kelas.some((x: any) => x.ID === K)) {
        setK(baru.Kelas[0]?.ID || '');
      }
      showToast('Data berhasil dimuat ulang');
    } catch (e: any) {
      showToast('Gagal: ' + pesanErr(e), 4000);
    }
  }

  async function persistSheets(
    nextDb: Record<string, any>,
    ...sheetNames: string[]
  ): Promise<boolean> {
    try {
      setDb(prev => {
        const merged = { ...prev };
        sheetNames.forEach(n => {
          merged[n] = nextDb[n];
        });
        return merged;
      });
      showToast('Menyimpan perubahan…', 6000);
      for (const n of sheetNames) {
        await apiCall('api_saveSheet', n, nextDb[n]);
      }
      if (sheetNames.includes('Siswa') || sheetNames.includes('Kelas')) {
        try {
          if (typeof BroadcastChannel !== 'undefined') {
            const bc = new BroadcastChannel('kelasku_sync');
            bc.postMessage({ type: 'siswa', ts: Date.now() });
            bc.close();
          }
          localStorage.setItem('mk_sync_ping', JSON.stringify({ type: 'siswa', ts: Date.now() }));
        } catch (_) {}
      }
      showToast('Perubahan tersimpan');
      return true;
    } catch (e: any) {
      showToast('Gagal menyimpan: ' + pesanErr(e), 5000);
      return false;
    }
  }

  const syncKaldikJabar = useCallback(
    async (opts: { tahunAjaran: string; autoSync: boolean; useAi?: boolean; silent?: boolean }) => {
      if (!token || role === 'siswa') return;
      try {
        const json = await fetchJson('/api/kaldik/sync-jabar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            tahunAjaran: opts.tahunAjaran,
            useAi: !!opts.useAi
          })
        });
        if (!json.ok) throw new Error(json.error || 'Gagal menyinkronkan Kaldik Jawa Barat.');
        const { akademik, pengaturan, addedCount, sourceNote } = json.data;
        setDb(prev => ({
          ...prev,
          Akademik: akademik,
          Pengaturan: pengaturan
        }));
        if (!opts.silent) {
          showToast(
            `Kalender Pendidikan Jabar diperbarui (${addedCount} agenda · ${sourceNote})`,
            4500
          );
        }
      } catch (err: any) {
        if (!opts.silent) {
          showToast('Gagal update Kaldik Jabar: ' + pesanErr(err), 4500);
        }
      }
    },
    [token, role, showToast]
  );

  // Auto-update Kalender Pendidikan Jawa Barat saat sesi dimulai jika aktif & perlu pembaruan
  useEffect(() => {
    if (!token || role === 'siswa' || !db.Pengaturan) return;
    if (kaldikAutoCheckedRef.current) return;
    kaldikAutoCheckedRef.current = true;

    const autoOn = db.Pengaturan.kaldikAutoSync !== '0';
    if (!autoOn) return;
    const ta = db.Pengaturan.kaldikTahunAjaran || '2026/2027';
    const hasJabar = (db.Akademik || []).some(
      (a: any) => String(a.ID).startsWith('jabar_') || String(a.Sumber || '').includes('Jabar')
    );
    const lastSyncStr = String(db.Pengaturan.kaldikLastSync || '');
    const lastMs = lastSyncStr ? new Date(lastSyncStr.replace(' ', 'T')).getTime() : 0;
    const stale = !lastMs || Number.isNaN(lastMs) || Date.now() - lastMs > 7 * 86400000;
    if (!hasJabar || stale) {
      syncKaldikJabar({ tahunAjaran: ta, autoSync: true, silent: true });
    }
  }, [token, role, db.Pengaturan, db.Akademik, syncKaldikJabar]);

  async function toggleKaldikAutoSync(enabled: boolean, tahunAjaran: string) {
    const baru = {
      ...S,
      kaldikAutoSync: enabled ? '1' : '0',
      kaldikTahunAjaran: tahunAjaran,
      kaldikWilayah: 'Provinsi Jawa Barat'
    };
    await apiCall('api_savePengaturan', baru);
    setDb(prev => ({ ...prev, Pengaturan: baru }));
    showToast(
      enabled
        ? 'Update otomatis Kalender Pendidikan Jabar diaktifkan'
        : 'Update otomatis Kalender Pendidikan Jabar dinonaktifkan'
    );
  }

  async function handleResetAllData(opts: {
    resetKelas: boolean;
    resetMapel: boolean;
    resetPengguna: boolean;
    resetPengaturan: boolean;
  }) {
    showToast('Mereset seluruh data aplikasi…', 8000);
    try {
      await apiCall('api_resetAllData', opts);
      const fresh = await apiCall('api_load', true);
      setDb(fresh);
      setK(fresh.Kelas?.[0]?.ID || '');
      if (opts.resetPengaturan) {
        const st = await callRaw('api_status');
        setPublicInfo({
          sekolah: st.sekolah || 'Sistem Manajemen Kelas',
          logo: st.logo || '',
          loginBg: st.loginBg || DEFAULT_LOGIN_BG,
          jurusan: st.jurusan || '',
          jurusanLogos: st.jurusanLogos || '{}',
          waInfo: st.waInfo || '',
          emailHint: st.emailHint || ''
        });
        setLoginBgError(false);
      }
      showToast('Seluruh data berhasil direset ke kondisi kosong');
    } catch (err: any) {
      showToast('Gagal mereset data: ' + pesanErr(err), 4500);
    }
  }

  async function handleResetPartial(category: string, label: string) {
    showToast(`Mengosongkan kategori ${label}…`, 6000);
    try {
      await apiCall('api_resetPartial', category);
      const fresh = await apiCall('api_load', true);
      setDb(fresh);
      showToast(`Kategori "${label}" berhasil dikosongkan`);
    } catch (err: any) {
      showToast('Gagal reset parsial: ' + pesanErr(err), 4500);
    }
  }

  async function handleResetDemoData() {
    showToast('Mengembalikan data pratinjau awal…', 8000);
    try {
      await apiCall('api_resetDemo');
      const fresh = await apiCall('api_load', true);
      setDb(fresh);
      setK(fresh.Kelas?.[0]?.ID || '');
      const st = await callRaw('api_status');
      setPublicInfo({
        sekolah: st.sekolah || 'Sistem Manajemen Kelas',
        logo: st.logo || '',
        loginBg: st.loginBg || DEFAULT_LOGIN_BG,
        jurusan: st.jurusan || '',
        jurusanLogos: st.jurusanLogos || '{}',
        waInfo: st.waInfo || '',
        emailHint: st.emailHint || ''
      });
      setLoginBgError(false);
      showToast('Basis data berhasil dikembalikan ke kondisi awal');
    } catch (err: any) {
      showToast('Gagal mengembalikan data demo: ' + pesanErr(err), 4500);
    }
  }

  async function refreshAllAfterRestore() {
    const fresh = await apiCall('api_load', true);
    setDb(fresh);
    setK(fresh.Kelas?.[0]?.ID || '');
    const st = await callRaw('api_status');
    setPublicInfo({
      sekolah: st.sekolah || 'Sistem Manajemen Kelas',
      logo: st.logo || '',
      loginBg: st.loginBg || DEFAULT_LOGIN_BG,
      jurusan: st.jurusan || '',
      jurusanLogos: st.jurusanLogos || '{}',
      waInfo: st.waInfo || '',
      emailHint: st.emailHint || ''
    });
    setLoginBgError(false);
  }

  async function handleExportBackup(includeFiles: boolean) {
    return apiCall('api_exportBackup', { includeFiles });
  }

  async function handleRestoreBackup(backupData: any, opts: { keepCurrentAdmin: boolean }) {
    showToast('Memulihkan basis data dari berkas backup…', 8000);
    try {
      const res = await apiCall('api_restoreBackup', backupData, opts);
      await refreshAllAfterRestore();
      const filesCount = res?.filesRestored || 0;
      showToast(
        filesCount > 0
          ? `Basis data dipulihkan (${res?.siswaCount ?? 0} siswa, ${filesCount} berkas lampiran)`
          : `Basis data berhasil dipulihkan (${res?.siswaCount ?? 0} siswa)`
      );
    } catch (err: any) {
      showToast('Gagal memulihkan backup: ' + pesanErr(err), 4500);
    }
  }

  async function handleListSnapshots() {
    return apiCall('api_listBackups');
  }

  async function handleCreateSnapshot(label: string) {
    return apiCall('api_createBackupSnapshot', label);
  }

  async function handleDownloadSnapshot(snapshotId: string) {
    return apiCall('api_getBackupSnapshot', snapshotId);
  }

  async function handleRestoreSnapshot(snapshotId: string) {
    showToast('Memulihkan snapshot basis data…', 8000);
    try {
      await apiCall('api_restoreBackupSnapshot', snapshotId);
      await refreshAllAfterRestore();
      showToast('Basis data berhasil dipulihkan dari snapshot');
    } catch (err: any) {
      showToast('Gagal memulihkan snapshot: ' + pesanErr(err), 4500);
    }
  }

  async function handleDeleteSnapshot(snapshotId: string) {
    const res = await apiCall('api_deleteBackupSnapshot', snapshotId);
    showToast('Snapshot backup dihapus');
    return res;
  }

  // Derived Helpers
  const S = db.Pengaturan || {};
  const kelasObj = (db.Kelas || []).find((k: any) => k.ID === K) || {};
  const activeJurusanLogos = parseJurusanLogos(S.jurusanLogos);
  const activeJurusanLogo = kelasObj.Jurusan ? activeJurusanLogos[kelasObj.Jurusan] || '' : '';

  function getClassMapelList(classId: string): string[] {
    const kRow = (db.Kelas || []).find((k: any) => k.ID === classId) || {};
    const mapelById = new Map<string, string>(
      (db.Mapel || []).map((m: any) => [String(m.ID || ''), String(m.Nama || '').trim()])
    );
    const subjectSet = new Map<string, string>();
    const reg = (rawName: string) => {
      const clean = String(rawName || '').trim();
      if (!clean || /^istirahat$/i.test(clean)) return;
      const key = clean.toLowerCase();
      if (!subjectSet.has(key)) subjectSet.set(key, clean);
    };

    const explicitRaw = String(kRow.Mapel || '').trim();
    if (explicitRaw === '__NONE__') {
      return [];
    }
    if (explicitRaw) {
      explicitRaw
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .forEach(tok => reg(mapelById.get(tok) || tok));
      return Array.from(subjectSet.values()).sort((a, b) => a.localeCompare(b, 'id'));
    }

    (db.Jadwal || [])
      .filter((j: any) => j.Kelas === classId && (!j.Jenis || j.Jenis === 'Pelajaran'))
      .forEach((j: any) => reg(j.Mapel));

    (db.Pengguna || []).forEach((u: any) => {
      const kelasTaught = new Set(
        [
          ...String(u.Kelas || '').split(','),
          ...String(u.KelasWali || '').split(','),
          ...String(u.KelasMengajar || '').split(',')
        ]
          .map(s => s.trim())
          .filter(Boolean)
      );
      if (!kelasTaught.has(classId)) return;
      String(u.Mapel || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .forEach(tok => reg(mapelById.get(tok) || tok));
    });

    (db.Tugas || []).filter((t: any) => t.Kelas === classId).forEach((t: any) => reg(t.Mapel));
    (db.CBT || []).filter((c: any) => c.Kelas === classId).forEach((c: any) => reg(c.Mapel));

    if (subjectSet.size === 0) {
      (db.Mapel || []).forEach((m: any) => reg(m.Nama));
    }

    return Array.from(subjectSet.values()).sort((a, b) => a.localeCompare(b, 'id'));
  }

  function isModulForClass(m: any, classId: string, classSubjects: string[]): boolean {
    const cls = (db.Kelas || []).find((k: any) => k.ID === classId) || { ID: classId, Nama: '' };
    return cocokCakupanKelasAjar(m?.Kelas, cls, classSubjects, m?.Mapel);
  }

  const siswaK = (db.Siswa || [])
    .filter((s: any) => s.Kelas === K)
    .sort((a: any, b: any) => a.Nama.localeCompare(b.Nama));
  const namaSiswa = (id: string) =>
    (db.Siswa || []).find((s: any) => s.ID === id)?.Nama || '(dihapus)';
  const absK = (db.Absensi || []).filter((a: any) => a.Kelas === K);
  const tanggalK: string[] = Array.from(new Set<string>(absK.map((a: any) => String(a.Tanggal)))).sort();
  const tugasK = (db.Tugas || [])
    .filter((t: any) => t.Kelas === K)
    .sort((a: any, b: any) => (a.Tenggat || '').localeCompare(b.Tenggat || ''));
  const bobot = ['b_sikap', 'b_tugas', 'b_proyek', 'b_uts', 'b_uas'].map(
    k => num(S[k]) || 0
  );
  const kkmVal = num(S.kkm) || 70;

  function absStat(sid: string) {
    const c: Record<string, number> = { H: 0, S: 0, I: 0, A: 0, T: 0, D: 0 };
    absK
      .filter((a: any) => a.SiswaID === sid)
      .forEach((r: any) => {
        if (c[r.Kode] != null) c[r.Kode]++;
      });
    const total = tanggalK.length;
    const hadir = c.H + c.T + c.D;
    return {
      H: c.H,
      S: c.S,
      I: c.I,
      A: c.A,
      T: c.T,
      D: c.D,
      total,
      hadir,
      pct: total ? (hadir / total) * 100 : null
    };
  }

  function getNilaiRow(sid: string) {
    return (db.Nilai || []).find((n: any) => n.Kelas === K && n.SiswaID === sid);
  }

  function hitungAkhir(r: any): number | null {
    if (!r) return null;
    let tot = 0;
    let ada = false;
    ['Sikap', 'Tugas', 'Proyek', 'UTS', 'UAS'].forEach((k, i) => {
      const v = num(r[k]);
      if (v != null) {
        ada = true;
        tot += (v * bobot[i]) / 100;
      }
    });
    const bonus = num(r.BonusPoin);
    if (bonus != null && bonus > 0) {
      ada = true;
      tot = Math.min(100, tot + bonus);
    }
    return ada ? tot : null;
  }

  function addValueToNilaiRow(
    nextNilai: any[],
    sid: string,
    target: PoinTargetKomponen,
    addAmount: number
  ) {
    const idx = nextNilai.findIndex(n => n.Kelas === K && n.SiswaID === sid);
    const base =
      idx >= 0
        ? { ...nextNilai[idx] }
        : {
            Kelas: K,
            SiswaID: sid,
            Sikap: '',
            Tugas: '',
            Proyek: '',
            UTS: '',
            UAS: '',
            BonusPoin: ''
          };
    const curVal = num(base[target]) || 0;
    const updated = Math.min(100, Math.round((curVal + addAmount) * 10) / 10);
    base[target] = String(updated);
    if (idx >= 0) nextNilai[idx] = base;
    else nextNilai.push(base);
  }

  async function applyReadyPoinForStudents(
    targetSiswaIds: string[],
    targetMode: ModalTargetMode = 'SESUAI_SISWA'
  ) {
    const nextNilai = [...(db.Nilai || [])];
    const nextPoin = [...(db.PoinSiswa || [])];
    let appliedCount = 0;
    let totalPointsAdded = 0;

    targetSiswaIds.forEach(sid => {
      for (let i = 0; i < nextPoin.length; i++) {
        const pr = nextPoin[i];
        if (pr.SiswaID !== sid || pr.Jenis !== 'konversi' || pr.Status === 'Ditambahkan') continue;
        const addVal = Number(pr.NilaiKonversi || 0) || 0;
        if (addVal <= 0) continue;
        const resolvedTarget: PoinTargetKomponen =
          targetMode === 'SESUAI_SISWA'
            ? normalizePoinTarget(pr.KomponenTarget || S.poinTargetDefault)
            : normalizePoinTarget(targetMode);
        addValueToNilaiRow(nextNilai, sid, resolvedTarget, addVal);
        nextPoin[i] = {
          ...pr,
          KomponenTarget: resolvedTarget,
          Status: 'Ditambahkan',
          Keterangan: `${pr.Keterangan || 'Konversi poin'} · Ditambahkan ke ${getPoinTargetLabel(resolvedTarget)}`
        };
        appliedCount++;
        totalPointsAdded += addVal;
      }
    });

    if (appliedCount === 0) {
      showToast('Tidak ada poin terkonversi yang siap ditambahkan');
      return;
    }
    await persistSheets({ ...db, Nilai: nextNilai, PoinSiswa: nextPoin }, 'Nilai', 'PoinSiswa');
    showToast(`+${totalPointsAdded} nilai hasil konversi poin berhasil ditambahkan ke nilai siswa!`);
  }

  async function convertAndApplyStudents(
    targetSiswaIds: string[],
    targetMode: ModalTargetMode = 'SESUAI_SISWA'
  ) {
    const todayStr = ymd(new Date());
    const poinPerNilaiCfg = Math.max(1, Math.round(Number(S.poinPerNilai || 5) || 5));
    const nextNilai = [...(db.Nilai || [])];
    const nextPoin = [...(db.PoinSiswa || [])];
    let totalAdded = 0;
    const nowIso = new Date().toISOString();

    targetSiswaIds.forEach(sid => {
      const sObj = siswaK.find((x: any) => x.ID === sid);
      if (!sObj) return;
      const resolvedTarget: PoinTargetKomponen =
        targetMode === 'SESUAI_SISWA'
          ? normalizePoinTarget(S.poinTargetDefault)
          : normalizePoinTarget(targetMode);

      for (let i = 0; i < nextPoin.length; i++) {
        const pr = nextPoin[i];
        if (pr.SiswaID !== sid || pr.Jenis !== 'konversi' || pr.Status === 'Ditambahkan') continue;
        const addVal = Number(pr.NilaiKonversi || 0) || 0;
        if (addVal <= 0) continue;
        const rowTarget =
          targetMode === 'SESUAI_SISWA'
            ? normalizePoinTarget(pr.KomponenTarget || S.poinTargetDefault)
            : resolvedTarget;
        addValueToNilaiRow(nextNilai, sid, rowTarget, addVal);
        nextPoin[i] = {
          ...pr,
          KomponenTarget: rowTarget,
          Status: 'Ditambahkan',
          Keterangan: `${pr.Keterangan || 'Konversi poin'} · Ditambahkan ke ${getPoinTargetLabel(rowTarget)}`
        };
        totalAdded += addVal;
      }

      const stats = computeStudentPoinStats(nextPoin, sid, S, todayStr);
      const units = Math.floor(stats.saldoPoin / poinPerNilaiCfg);
      if (units >= 1) {
        const usedPoin = units * poinPerNilaiCfg;
        addValueToNilaiRow(nextNilai, sid, resolvedTarget, units);
        nextPoin.push({
          ID: 'poin_' + uid(),
          Kelas: K,
          SiswaID: sid,
          Tanggal: todayStr,
          Jenis: 'konversi',
          JumlahPoin: String(-usedPoin),
          NilaiKonversi: String(units),
          KomponenTarget: resolvedTarget,
          Status: 'Ditambahkan',
          Keterangan: `Konversi ${usedPoin} poin → +${units} nilai (${getPoinTargetLabel(resolvedTarget)})`,
          Waktu: nowIso
        });
        totalAdded += units;
      }
    });

    if (totalAdded === 0) {
      showToast('Belum ada poin siswa yang memenuhi batas konversi');
      return;
    }
    await persistSheets({ ...db, Nilai: nextNilai, PoinSiswa: nextPoin }, 'Nilai', 'PoinSiswa');
    showToast(`Berhasil mengonversi & menambahkan total +${totalAdded} nilai ke siswa!`);
  }

  async function giftPointsToStudent(siswaObj: any, amount: number) {
    const todayStr = ymd(new Date());
    const nextPoin = [
      ...(db.PoinSiswa || []),
      {
        ID: 'poin_' + uid(),
        Kelas: K,
        SiswaID: siswaObj.ID,
        Tanggal: todayStr,
        Jenis: 'bonus',
        JumlahPoin: String(amount),
        NilaiKonversi: '0',
        KomponenTarget: '',
        Status: 'Aktif',
        Keterangan: `Tambahan poin dari guru (${todayStr})`,
        Waktu: new Date().toISOString()
      }
    ];
    await persistSheets({ ...db, PoinSiswa: nextPoin }, 'PoinSiswa');
    showToast(`+${amount} Poin diberikan kepada ${siswaObj.Nama}`);
  }

  function getPredikat(n: number | null): [string, string, string] {
    if (n == null) return ['-', '', 'bg-slate-100 text-slate-600'];
    if (n >= 90) return ['A', 'Sangat Baik', 'bg-emerald-100 text-emerald-800'];
    if (n >= 80) return ['B', 'Baik', 'bg-blue-100 text-blue-800'];
    if (n >= kkmVal) return ['C', 'Cukup', 'bg-amber-100 text-amber-800'];
    return ['D', 'Perlu Bimbingan', 'bg-rose-100 text-rose-800'];
  }

  function getTindakLanjut(n: number | null): string {
    if (n == null) return '-';
    if (n < kkmVal) return 'Remedial';
    if (n >= 90) return 'Pengayaan';
    return 'Penguatan';
  }

  function tanggaLevel(a: number): number {
    return a >= 10 ? 4 : a >= 5 ? 3 : a >= 3 ? 2 : a >= 1 ? 1 : 0;
  }

  function mingguKe(): number | null {
    const m = S.mulai;
    if (!m) return null;
    const d = Math.floor((new Date(ymd(new Date())).getTime() - new Date(m).getTime()) / 86400000);
    return d < 0 ? 0 : Math.floor(d / 7) + 1;
  }

  function waliKelasNama(kelasId: string): string {
    const src = peran === 'admin' ? db.Pengguna || [] : db.GuruList || [];
    const n = src
      .filter((u: any) => String(u.KelasWali || '').split(',').includes(kelasId))
      .map((u: any) => u.Nama);
    return n.length ? n.join(', ') : S.wali || '';
  }

  const peranLabel = (p: string) =>
    String(p || '')
      .split(',')
      .filter(Boolean)
      .map(r => PERAN_NAMA[r] || r)
      .join(' + ');

  const tabOk = (id: string) =>
    peran === 'admin'
      ? id !== 'usr'
      : String(peran)
          .split(',')
          .some(r => (TAB_PERAN[r] || []).includes(id));

  const waliDi = (kId: string) => peran === 'admin' || (db.kelasWali || []).includes(kId);

  const hariIni = () => HARI[(new Date().getDay() + 6) % 7] || '';
  const pekanIni = () => {
    const m = mingguKe();
    return m ? (m % 2 ? 'A' : 'B') : '';
  };
  const tampilHariIni = (x: any) => !x.Pekan || !pekanIni() || x.Pekan === pekanIni();

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-900">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
        <div className="font-bold text-sm">Memuat Sistem Manajemen Kelas…</div>
        <div className="text-xs text-slate-500 mt-1">Menyiapkan basis data kelas otomatis</div>
      </div>
    );
  }

  // Login Screen
  if (!token) {
    const isAdm = loginMode === 'admin';
    const waInfoUrl = publicInfo.waInfo
      ? waLink(
          publicInfo.waInfo,
          `Halo Admin / Informasi ${publicInfo.sekolah}, saya memerlukan informasi terkait akses Sistem Manajemen Kelas.`
        )
      : '';
    const activeBgValue = loginBrandEdit
      ? brandBgDraft
      : publicInfo.loginBg || DEFAULT_LOGIN_BG;
    const activeBgUrl = resolveLoginBgUrl(activeBgValue);

    return (
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-sky-900 flex items-center justify-center p-4 sm:p-6">
        {activeBgUrl && !loginBgError && (
          <img
            src={activeBgUrl}
            alt={`Latar Pembelajaran ${publicInfo.sekolah}`}
            referrerPolicy="no-referrer"
            onError={() => setLoginBgError(true)}
            className="absolute inset-0 w-full h-full object-cover select-none"
          />
        )}
        <div
          aria-hidden="true"
          className={`absolute inset-0 ${
            activeBgUrl && !loginBgError
              ? 'bg-gradient-to-br from-slate-950/65 via-indigo-950/45 to-slate-900/70 backdrop-blur-[1.5px]'
              : 'bg-gradient-to-br from-indigo-600/80 via-violet-600/80 to-sky-500/80'
          }`}
        />



        <div className="relative z-10 w-full max-w-md bg-white/95 backdrop-blur-md rounded-3xl border border-white/60 overflow-hidden shadow-2xl">
          <div className="h-2 rainbow-strip" />
          <div className="p-6 sm:p-8 space-y-5">
            <div>
              <div className="flex items-start justify-between gap-2.5 text-indigo-700 font-bold text-sm mb-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  {publicInfo.logo ? (
                    <img
                      src={publicInfo.logo}
                      alt={publicInfo.sekolah}
                      className="w-12 h-12 rounded-2xl object-contain bg-indigo-50 border border-indigo-100 p-1 shadow-sm shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-fuchsia-600 text-white flex items-center justify-center shadow-sm shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">{publicInfo.sekolah}</div>
                    <div className="text-[11px] font-medium text-indigo-600 truncate">
                      {publicInfo.jurusan
                        ? `Jurusan: ${publicInfo.jurusan}`
                        : 'Sistem Manajemen Kelas Terpadu'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                  <OfflineModeTogglePill variant="light" showToast={showToast} />
                  <PWAInstallButton variant="light" />

                </div>
              </div>
              {publicInfo.jurusan && !loginBrandEdit && (() => {
                const jLogos = parseJurusanLogos(publicInfo.jurusanLogos);
                return (
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {publicInfo.jurusan
                      .split(',')
                      .map(j => j.trim())
                      .filter(Boolean)
                      .map((j, idx) => (
                        <span
                          key={j + idx}
                          className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 border border-indigo-100 inline-flex items-center gap-1.5"
                        >
                          {jLogos[j] && (
                            <img
                              src={jLogos[j]}
                              alt={`Logo ${j}`}
                              className="w-4 h-4 rounded object-contain bg-white border border-indigo-100 shrink-0"
                            />
                          )}
                          <span>{j}</span>
                        </span>
                      ))}
                  </div>
                );
              })()}
              <h1 className="text-2xl font-bold text-slate-900">
                {loginBrandEdit
                  ? 'Sesuaikan Tampilan Login'
                  : forgotMode
                  ? isAdm
                    ? 'Lupa Kata Sandi'
                    : 'Lupa PIN Siswa'
                  : 'KelasKU'}
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                {loginBrandEdit
                  ? 'Atur logo sekolah, gambar latar bertema pembelajaran, nama sekolah, dan daftar jurusan.'
                  : forgotMode
                  ? isAdm
                    ? 'Verifikasi kepemilikan akun untuk mengatur ulang kata sandi Admin atau Guru/Wali Kelas.'
                    : 'Verifikasi NIS dan data siswa untuk mengatur ulang PIN Portal Siswa.'
                  : !adminAda
                  ? 'Buat akun Admin pertama untuk mengelola absensi, nilai, jadwal, denah duduk, perangkat ajar, dan portal siswa.'
                  : 'Kelola absensi, nilai, jadwal, denah duduk, perangkat ajar, dan portal siswa dalam satu ruang kerja.'}
              </p>
            </div>

            {loginBrandEdit ? (
              <form onSubmit={simpanBrandingLogin} className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50 via-violet-50/70 to-sky-50 border border-indigo-100 flex items-center gap-3.5">
                  {brandLogoDraft ? (
                    <img
                      src={brandLogoDraft}
                      alt="Pratinjau Logo"
                      className="w-16 h-16 rounded-2xl object-contain bg-white border border-indigo-200 p-1.5 shadow-xs shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-fuchsia-600 text-white flex items-center justify-center shadow-sm shrink-0">
                      <ImageIcon className="w-7 h-7" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="text-xs font-bold text-slate-800">Logo Sekolah</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-xs">
                        <Upload className="w-3.5 h-3.5" /> Pilih / Ganti Logo
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async e => {
                            const f = e.target.files?.[0];
                            e.target.value = '';
                            if (!f) return;
                            try {
                              const dataUrl = await prosesLogoGambar(f);
                              setBrandLogoDraft(dataUrl);
                              setBrandMsg('');
                            } catch (err: any) {
                              setBrandMsg(pesanErr(err));
                            }
                          }}
                        />
                      </label>
                      {brandLogoDraft && (
                        <button
                          type="button"
                          onClick={() => setBrandLogoDraft('')}
                          className="px-2.5 py-1.5 text-xs font-semibold bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-xl cursor-pointer"
                        >
                          Hapus Logo
                        </button>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500">Format PNG, JPG, WebP, atau SVG.</div>
                  </div>
                </div>

                {/* Background Laman Login Picker */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-slate-800">Gambar Latar Laman Login</div>
                      <div className="text-[10px] text-slate-500">
                        Aktif: <span className="font-semibold text-indigo-700">{getLoginBgLabel(brandBgDraft)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label className="px-2.5 py-1.5 text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl inline-flex items-center gap-1 cursor-pointer shadow-xs whitespace-nowrap">
                        <Upload className="w-3 h-3" /> Unggah Foto
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async e => {
                            const f = e.target.files?.[0];
                            e.target.value = '';
                            if (!f) return;
                            try {
                              const dataUrl = await prosesBackgroundGambar(f);
                              setBrandBgDraft(dataUrl);
                              setLoginBgError(false);
                              setBrandMsg('');
                            } catch (err: any) {
                              setBrandMsg(pesanErr(err));
                            }
                          }}
                        />
                      </label>
                      {brandBgDraft !== DEFAULT_LOGIN_BG && (
                        <button
                          type="button"
                          onClick={() => {
                            setBrandBgDraft(DEFAULT_LOGIN_BG);
                            setLoginBgError(false);
                          }}
                          title="Kembalikan ke latar bawaan"
                          className="p-1.5 text-slate-600 hover:text-indigo-700 bg-white border border-slate-200 rounded-xl cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {LOGIN_BG_PRESETS.map(preset => {
                      const active = (brandBgDraft || DEFAULT_LOGIN_BG) === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setBrandBgDraft(preset.id);
                            setLoginBgError(false);
                          }}
                          title={preset.label}
                          className={`group relative rounded-xl overflow-hidden border-2 transition-all cursor-pointer text-left ${
                            active
                              ? 'border-indigo-600 ring-2 ring-indigo-500/30'
                              : 'border-slate-200 hover:border-indigo-300'
                          }`}
                        >
                          <img
                            src={preset.src}
                            alt={preset.label}
                            referrerPolicy="no-referrer"
                            className="w-full h-11 object-cover"
                          />
                          <div className="px-1 py-0.5 bg-white text-[9px] font-semibold text-slate-700 truncate">
                            {preset.label.split('&')[0].trim()}
                          </div>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        setBrandBgDraft('none');
                        setLoginBgError(false);
                      }}
                      title="Latar Gradien Tanpa Foto"
                      className={`rounded-xl overflow-hidden border-2 transition-all cursor-pointer text-left ${
                        brandBgDraft === 'none'
                          ? 'border-indigo-600 ring-2 ring-indigo-500/30'
                          : 'border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      <div className="w-full h-11 bg-gradient-to-br from-indigo-600 via-violet-600 to-sky-500" />
                      <div className="px-1 py-0.5 bg-white text-[9px] font-semibold text-slate-700 truncate">
                        Gradien
                      </div>
                    </button>
                  </div>
                </div>

                <label className="block text-xs font-semibold text-slate-700">
                  Nama Sekolah
                  <input
                    type="text"
                    value={brandSekolahDraft}
                    onChange={e => setBrandSekolahDraft(e.target.value)}
                    placeholder="Contoh: SMA Negeri 1 Nusantara"
                    className="mt-1 w-full px-3.5 py-2 border border-indigo-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </label>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">
                      Daftar Jurusan & Logo Jurusan
                    </span>
                    <span className="text-[11px] font-medium text-indigo-600">
                      {brandJurusanItems.length} jurusan
                    </span>
                  </div>
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {brandJurusanItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-1.5 rounded-xl border border-indigo-100 bg-indigo-50/30"
                      >
                        <label
                          title="Unggah / Ganti Logo Jurusan"
                          className="w-8 h-8 rounded-lg border border-indigo-200 bg-white flex items-center justify-center shrink-0 cursor-pointer hover:border-indigo-400 overflow-hidden"
                        >
                          {item.logo ? (
                            <img
                              src={item.logo}
                              alt={item.name || 'Logo Jurusan'}
                              className="w-full h-full object-contain p-0.5"
                            />
                          ) : (
                            <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async e => {
                              const f = e.target.files?.[0];
                              e.target.value = '';
                              if (!f) return;
                              try {
                                const dataUrl = await prosesLogoGambar(f, 160);
                                setBrandJurusanItems(prev =>
                                  prev.map((x, i) => (i === idx ? { ...x, logo: dataUrl } : x))
                                );
                                setBrandMsg('');
                              } catch (err: any) {
                                setBrandMsg(pesanErr(err));
                              }
                            }}
                          />
                        </label>
                        <input
                          type="text"
                          value={item.name}
                          onChange={e => {
                            const val = e.target.value;
                            setBrandJurusanItems(prev =>
                              prev.map((x, i) => (i === idx ? { ...x, name: val } : x))
                            );
                          }}
                          placeholder={`Nama Jurusan ${idx + 1}`}
                          className="flex-1 min-w-0 px-2.5 py-1.5 border border-indigo-200 bg-white rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        {item.logo && (
                          <button
                            type="button"
                            onClick={() =>
                              setBrandJurusanItems(prev =>
                                prev.map((x, i) => (i === idx ? { ...x, logo: '' } : x))
                              )
                            }
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                            title="Hapus logo jurusan"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {brandJurusanItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setBrandJurusanItems(prev => prev.filter((_, i) => i !== idx))
                            }
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Hapus jurusan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={brandNewJurusan}
                      onChange={e => setBrandNewJurusan(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = brandNewJurusan.trim();
                          if (val && !brandJurusanItems.some(x => x.name.trim() === val)) {
                            setBrandJurusanItems(prev => [...prev, { name: val, logo: '' }]);
                            setBrandNewJurusan('');
                          }
                        }
                      }}
                      placeholder="Tambah jurusan baru (mis. TKJ, RPL)…"
                      className="flex-1 px-3 py-1.5 border border-emerald-200 bg-emerald-50/30 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = brandNewJurusan.trim();
                        if (!val) return;
                        if (!brandJurusanItems.some(x => x.name.trim() === val)) {
                          setBrandJurusanItems(prev => [...prev, { name: val, logo: '' }]);
                        }
                        setBrandNewJurusan('');
                      }}
                      className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl inline-flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" /> Tambah
                    </button>
                  </div>
                </div>

                {brandMsg && (
                  <div className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                    {brandMsg}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={brandSaving}
                    className="flex-1 py-2.5 px-4 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 hover:brightness-110 disabled:opacity-60 text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-500/25"
                  >
                    <Save className="w-4 h-4" />
                    {brandSaving ? 'Menyimpan…' : 'Simpan Logo & Jurusan'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginBrandEdit(false)}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </form>
            ) : (
              <>


            {forgotMode && adminAda ? (
              isAdm ? (
                <form onSubmit={handleForgotSubmit} className="space-y-3.5">
                  <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-indigo-600" /> Pemulihan Kata Sandi Admin via Email
                    </div>
                    <p className="text-[11px] text-indigo-700">
                      Masukkan username dan Email Pemulihan Admin{publicInfo.emailHint ? ` (${publicInfo.emailHint})` : ''} untuk mendapatkan kode verifikasi 6 digit, atau gunakan Kode Pemulihan Sekolah.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block text-xs font-semibold text-slate-700">
                      Nama Pengguna (Username)
                      <input
                        type="text"
                        value={forgotUser}
                        onChange={e => setForgotUser(e.target.value)}
                        placeholder="contoh: admin atau ratna"
                        className="mt-1 w-full px-3 py-2 border border-indigo-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </label>

                    <label className="block text-xs font-semibold text-slate-700">
                      Email Pemulihan Admin
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={e => setForgotEmail(e.target.value)}
                        placeholder="email-pemulihan@domain.com"
                        className="mt-1 w-full px-3 py-2 border border-indigo-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={handleSendEmailOtp}
                    className="w-full py-2 px-3 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Mail className="w-3.5 h-3.5" /> Kirim Kode Verifikasi ke Email Pemulihan
                  </button>

                  {forgotOtpSent && forgotOtpPreview && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1">
                      <div className="font-bold">Kode Verifikasi Email Diterbitkan:</div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-lg font-extrabold tracking-widest text-emerald-700">
                          {forgotOtpPreview}
                        </span>
                        <button
                          type="button"
                          onClick={() => setForgotVerif(forgotOtpPreview)}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 text-white rounded-lg cursor-pointer"
                        >
                          Isi Otomatis
                        </button>
                      </div>
                    </div>
                  )}

                  <label className="block text-xs font-semibold text-slate-700">
                    Kode OTP Email (6 Digit) atau Kode Pemulihan Sekolah
                    <input
                      type="text"
                      value={forgotVerif}
                      onChange={e => setForgotVerif(e.target.value)}
                      placeholder="Masukkan 6 digit kode OTP email"
                      className="mt-1 w-full px-3.5 py-2 border border-indigo-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block text-xs font-semibold text-slate-700">
                      Kata Sandi Baru (min. 8)
                      <PasswordField
                        value={forgotPass}
                        onChange={e => setForgotPass(e.target.value)}
                        placeholder="••••••••"
                        className="mt-1 w-full px-3.5 py-2 border border-indigo-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-slate-700">
                      Ulangi Sandi Baru
                      <PasswordField
                        value={forgotPass2}
                        onChange={e => setForgotPass2(e.target.value)}
                        placeholder="••••••••"
                        className="mt-1 w-full px-3.5 py-2 border border-indigo-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </label>
                  </div>

                  {forgotMsg && (
                    <div
                      className={`text-xs font-medium rounded-xl px-3 py-2 border ${
                        forgotOk
                          ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                          : 'text-rose-600 bg-rose-50 border-rose-200'
                      }`}
                    >
                      {forgotMsg}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 hover:brightness-110 text-white font-semibold text-sm rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-500/25"
                  >
                    Simpan Kata Sandi Baru
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setForgotMode(false);
                      setForgotMsg('');
                      setForgotOk(false);
                    }}
                    className="w-full py-2 px-3 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Halaman Masuk
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-950 space-y-1.5">
                    <div className="font-bold text-sm text-sky-900">Lupa PIN Portal Siswa?</div>
                    <p className="text-sky-800 leading-relaxed">
                      Demi keamanan akun, reset PIN siswa dilakukan oleh <strong>Admin</strong> atau <strong>Wali Kelas</strong>. Isi NIS dan Nama Lengkap Anda di bawah, lalu hubungi Admin melalui WhatsApp untuk mendapatkan PIN baru.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block text-xs font-semibold text-slate-700">
                      NIS / NISN Siswa
                      <input
                        type="text"
                        value={forgotSiswaNis}
                        onChange={e => setForgotSiswaNis(e.target.value)}
                        placeholder="Contoh: 102601"
                        className="mt-1 w-full px-3 py-2 border border-sky-200 rounded-xl text-xs font-mono"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-slate-700">
                      Nama Lengkap Siswa
                      <input
                        type="text"
                        value={forgotSiswaNama}
                        onChange={e => setForgotSiswaNama(e.target.value)}
                        placeholder="Contoh: Adinda Putri"
                        className="mt-1 w-full px-3 py-2 border border-sky-200 rounded-xl text-xs"
                      />
                    </label>
                  </div>

                  {publicInfo.waInfo ? (
                    <a
                      href={waLink(
                        publicInfo.waInfo,
                        `Halo Admin ${publicInfo.sekolah}, saya siswa atas nama ${forgotSiswaNama || '[Nama Siswa]'} (NIS: ${forgotSiswaNis || '[NIS]'}) lupa PIN login Portal Siswa. Mohon bantuan reset PIN akun saya. Terima kasih.`
                      )}
                      target={waTarget()}
                      rel={waTarget() ? 'noopener noreferrer' : undefined}
                      className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-md"
                    >
                      <MessageCircle className="w-4 h-4" /> Hubungi Admin via WhatsApp
                    </a>
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                      Silakan hubungi langsung Admin atau Wali Kelas di sekolah untuk mereset PIN Anda.
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setForgotMode(false);
                      setForgotMsg('');
                      setForgotOk(false);
                    }}
                    className="w-full py-2 px-3 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Halaman Masuk
                  </button>
                </div>
              )
            ) : (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <label className="block text-xs font-semibold text-slate-700">
                  {adminAda ? (isAdm ? 'Nama Pengguna' : 'NIS / NISN Siswa') : 'Nama Pengguna Admin'}
                  <input
                    type="text"
                    value={loginUser}
                    onChange={e => setLoginUser(e.target.value)}
                    placeholder={isAdm ? 'contoh: admin atau ratna' : 'contoh: 102601'}
                    className="mt-1.5 w-full px-3.5 py-2.5 border border-indigo-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </label>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">
                      {adminAda
                        ? isAdm
                          ? 'Kata Sandi'
                          : 'PIN Siswa (4–8 angka)'
                        : 'Kata Sandi (minimal 8 karakter)'}
                    </label>
                    {adminAda && (
                      <button
                        type="button"
                        onClick={() => {
                          setForgotMode(true);
                          setForgotUser(loginUser);
                          setForgotMsg('');
                          setForgotOk(false);
                        }}
                        className="text-xs font-semibold text-indigo-600 hover:text-fuchsia-600 hover:underline cursor-pointer"
                      >
                        {isAdm ? 'Lupa Kata Sandi?' : 'Lupa PIN?'}
                      </button>
                    )}
                  </div>
                  <div className="mt-1.5">
                    <PasswordField
                      value={loginPass}
                      onChange={e => setLoginPass(e.target.value)}
                      placeholder={isAdm ? '••••••••' : '123456'}
                      className="w-full px-3.5 py-2.5 border border-indigo-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {!adminAda && (
                  <label className="block text-xs font-semibold text-slate-700">
                    Ulangi Kata Sandi
                    <div className="mt-1.5">
                      <PasswordField
                        value={loginPass2}
                        onChange={e => setLoginPass2(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-indigo-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </label>
                )}

                {loginErr && (
                  <div className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                    {loginErr}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 hover:brightness-110 text-white font-semibold text-sm rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-500/25"
                >
                  {adminAda ? 'Masuk Sekarang' : 'Buat Akun Admin'}
                </button>
              </form>
            )}

            {waInfoUrl && (
              <a
                href={waInfoUrl}
                target={waTarget()}
                rel={waTarget() ? 'noopener noreferrer' : undefined}
                className="w-full py-2 px-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-105 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                Hubungi WhatsApp Informasi Sekolah
              </a>
            )}
              </>
            )}
          </div>
        </div>
        <OfflineIndicator token="" showToast={showToast} />
        {toastMsg && (
          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg">
            {toastMsg}
          </div>
        )}
      </div>
    );
  }

  // Student Portal Mode
  if (role === 'siswa' && portal) {
    return (
      <>
        <StudentPortal
          token={token}
          portal={portal}
          apiCall={apiCall}
          onRefresh={muatUlang}
          onLogout={handleLogout}
          showToast={showToast}
        />
        <OfflineIndicator
          token={token}
          onSyncDone={() => void silentSyncNow()}
          showToast={showToast}
        />
        {toastMsg && (
          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg">
            {toastMsg}
          </div>
        )}
      </>
    );
  }

  // Print Header Component
  const PrintHeader = () => (
    <div className="hidden print:flex items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-300">
      <div className="flex items-center gap-4">
        {S.logo && (
          <img src={S.logo} alt={S.sekolah} className="w-12 h-12 object-contain shrink-0" />
        )}
        <div>
          <h2 className="text-xl font-bold">{S.sekolah}</h2>
          <div className="text-xs text-slate-600 mt-1">
            Kelas: {kelasObj.Nama} · Jurusan: {kelasObj.Jurusan || '-'} · Semester {S.semester}
          </div>
          <div className="text-xs text-slate-600">
            Guru: {S.guru} · Wali Kelas: {waliKelasNama(K)}
            {S.waInfo ? ` · WA Info: ${S.waInfo}` : ''}
          </div>
        </div>
      </div>
      {activeJurusanLogo && (
        <img
          src={activeJurusanLogo}
          alt={`Logo ${kelasObj.Jurusan}`}
          className="w-12 h-12 object-contain shrink-0"
        />
      )}
    </div>
  );

  // ================= VIEW SECTIONS =================

  // 1. DASBOR
  function renderDash() {
    const pcts = siswaK.map((s: any) => absStat(s.ID).pct).filter((x: any) => x != null) as number[];
    const rataAbs = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null;
    const tIds = tugasK.map((t: any) => t.ID);
    const tepat = (db.Pengumpulan || []).filter(
      (p: any) => tIds.includes(p.TugasID) && p.Status === 'Tepat Waktu'
    ).length;
    const tepatPct =
      tIds.length && siswaK.length ? (tepat / (tIds.length * siswaK.length)) * 100 : null;
    const naList = siswaK
      .map((s: any) => hitungAkhir(getNilaiRow(s.ID)))
      .filter((x: any) => x != null) as number[];
    const naRata = naList.length ? naList.reduce((a, b) => a + b, 0) / naList.length : null;
    const mg = mingguKe();
    const fase = mg ? KALENDER.find(f => mg >= f[0] && mg <= f[1]) : null;
    const peringatan = siswaK
      .map((s: any) => ({ s, a: absStat(s.ID).A }))
      .filter((x: any) => x.a > 0)
      .sort((a: any, b: any) => b.a - a.a);
    const hr = hariIni();
    const jdHari = (db.Jadwal || [])
      .filter((x: any) => x.Kelas === K && x.Hari === hr && tampilHariIni(x))
      .sort((a: any, b: any) => (a.Mulai || '').localeCompare(b.Mulai || ''));
    const pkHari = (db.Piket || []).filter((x: any) => x.Kelas === K && x.Hari === hr);

    return (
      <div className="space-y-6">
        {/* Colorful Hero Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 p-6 text-white shadow-lg shadow-indigo-500/20 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {activeJurusanLogo && (
              <img
                src={activeJurusanLogo}
                alt={`Logo ${kelasObj.Jurusan}`}
                className="w-14 h-14 rounded-2xl object-contain bg-white/95 p-1 shadow-sm shrink-0"
              />
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight truncate">
                {kelasObj.Nama ? `Dasbor Kelas ${kelasObj.Nama}` : 'Dasbor Manajemen Kelas'}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-sky-100 mt-1">
                <span>
                  {kelasObj.Jurusan
                    ? `Jurusan ${kelasObj.Jurusan}`
                    : kelasObj.Mapel || 'Atur daftar kelas dan mata pelajaran di Pengaturan'}
                </span>
                {mg !== null && (
                  <>
                    <span>·</span>
                    <span className="font-semibold text-white">
                      {mg === 0 ? 'Semester belum dimulai' : `Minggu ke-${mg}`}
                    </span>
                  </>
                )}
                {fase && (
                  <>
                    <span>·</span>
                    <span className="text-amber-200 font-semibold">{fase[2]}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setChatOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-slate-900 rounded-xl shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5" /> Chat Kelas &amp; Tanya Siswa
            </button>
            <button
              onClick={() => setWaBlastState({ open: true })}
              className="px-3.5 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5" /> Kirim WA Massal / Siswa
            </button>
            <button
              onClick={() => setTab('cld')}
              className="px-3.5 py-2 text-xs font-semibold bg-white text-indigo-700 hover:bg-indigo-50 rounded-xl shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <CloudUpload className="w-3.5 h-3.5" /> Cloud & Analisis AI
            </button>
            <button
              onClick={() => setTab('abs')}
              className="px-3.5 py-2 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <CheckSquare className="w-3.5 h-3.5" /> Catat Absensi
            </button>
          </div>
        </div>

        {(db.Kelas || []).length === 0 ? (
          <div className="bg-white border border-indigo-200 rounded-2xl p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1 max-w-2xl">
              <h2 className="text-base font-bold text-slate-900">Mulai Siapkan Data Sekolah</h2>
              <p className="text-xs text-slate-600">
                Belum ada kelas terdaftar. Tambahkan daftar kelas, jurusan, dan mata pelajaran di menu Pengaturan, atau muat paket data contoh lengkap agar seluruh modul siap digunakan.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setTab('set')}
                className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-xs cursor-pointer"
              >
                Atur Kelas &amp; Mapel
              </button>
              {role === 'admin' && (
                <button
                  type="button"
                  onClick={handleResetDemoData}
                  className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl cursor-pointer"
                >
                  Isi Data Contoh Lengkap
                </button>
              )}
            </div>
          </div>
        ) : siswaK.length === 0 ? (
          <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-slate-900">Kelas {kelasObj.Nama} Belum Memiliki Siswa</h2>
              <p className="text-xs text-slate-600">
                Tambahkan data siswa atau impor daftar siswa untuk mulai mencatat absensi, tugas, denah duduk, dan nilai.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setTab('sis')}
                className="px-3.5 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-white rounded-xl shadow-xs cursor-pointer"
              >
                Kelola Data Siswa →
              </button>
            </div>
          </div>
        ) : null}

        {/* 4 Colorful Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-sky-50 to-white border border-sky-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-sky-800">Total Siswa Aktif</div>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-xs">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 tabular-nums mt-2">
              {siswaK.length}
            </div>
            <div className="text-xs text-slate-600 mt-2">
              Wali Kelas: <span className="text-sky-900 font-semibold">{waliKelasNama(K) || '-'}</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-emerald-800">Rata-rata Kehadiran</div>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-xs">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 tabular-nums mt-2">
              {rataAbs == null ? '-' : `${fmt(rataAbs)}%`}
            </div>
            <div className="text-xs mt-2">
              {rataAbs != null ? (
                <span className={rataAbs >= 90 ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                  {rataAbs >= 90 ? 'Target ≥ 90% tercapai' : 'Di bawah target 90%'}
                </span>
              ) : (
                <span className="text-slate-400">Belum ada data pertemuan</span>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-amber-800">Ketepatan Tugas</div>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-xs">
                <ClipboardList className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 tabular-nums mt-2">
              {tepatPct == null ? '-' : `${fmt(tepatPct)}%`}
            </div>
            <div className="text-xs mt-2">
              {tepatPct != null ? (
                <span className={tepatPct >= 90 ? 'text-emerald-700 font-semibold' : 'text-orange-700 font-semibold'}>
                  {tepatPct >= 90 ? 'Target ≥ 90% tercapai' : 'Perlu tindak lanjut tugas'}
                </span>
              ) : (
                <span className="text-slate-400">Belum ada tugas</span>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-violet-50 to-white border border-violet-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-violet-800">Rata-rata Nilai Akhir</div>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white flex items-center justify-center shadow-xs">
                <BarChart3 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 tabular-nums mt-2">
              {fmt(naRata)}
            </div>
            <div className="text-xs text-violet-700 font-medium mt-2 tabular-nums">
              Batas Ketuntasan (KKM): {kkmVal}
            </div>
          </div>
        </div>

        {/* 8-Stage Cycle & Absence Warnings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-indigo-100 rounded-2xl p-6 space-y-4 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-slate-900">Siklus Manajemen 8 Tahap</h2>
              <p className="text-xs text-slate-500">Klik tahap untuk langsung membuka modul terkait</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {TAHAP.map(t => (
                <button
                  key={t.n}
                  onClick={() => setTab(t.tab)}
                  style={{ backgroundColor: `${t.c}10`, borderColor: `${t.c}40` }}
                  className="flex items-center gap-3 p-3 rounded-xl border hover:brightness-95 text-left transition-all cursor-pointer"
                >
                  <span
                    style={{ backgroundColor: t.c }}
                    className="w-8 h-8 rounded-xl text-white font-bold text-xs flex items-center justify-center shrink-0 tabular-nums shadow-xs"
                  >
                    0{t.n}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">{t.t}</div>
                    <div className="text-[11px] text-slate-600 truncate">{t.w}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-rose-100 rounded-2xl p-6 space-y-4 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Tindak Lanjut Ketidakhadiran (Alpa)
              </h2>
              <p className="text-xs text-slate-500">
                Deteksi dini siswa dengan akumulasi ketidakhadiran tanpa keterangan
              </p>
            </div>
            {peringatan.length ? (
              <div className="space-y-2.5">
                {peringatan.map((x: any) => {
                  const l = tanggaLevel(x.a);
                  return (
                    <div
                      key={x.s.ID}
                      className="p-3.5 rounded-xl bg-gradient-to-r from-amber-50 to-rose-50/70 border border-amber-200 flex items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          style={{ backgroundColor: LEVEL[l][2] }}
                          className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold text-white shrink-0 shadow-xs"
                        >
                          Tahap {l}
                        </span>
                        <div className="text-xs">
                          <div className="font-bold text-slate-900">
                            {x.s.Nama} · <span className="tabular-nums text-rose-600">{x.a} hari alpa</span>
                          </div>
                          <div className="text-slate-600 mt-0.5">{TANGGA[l]}</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {(x.s.NoSiswa || x.s.KontakOrtu) && (
                          <a
                            href={waLink(
                              x.s.NoSiswa || x.s.KontakOrtu,
                              `Halo ${x.s.Nama} (Kelas ${kelasObj.Nama}). Kami menginformasikan bahwa kamu tercatat ${x.a} hari tidak hadir tanpa keterangan (Alpa). Harap segera konfirmasi kepada Wali Kelas. Terima kasih.`
                            )}
                            target={waTarget()}
                            rel={waTarget() ? 'noopener noreferrer' : undefined}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-lg flex items-center gap-1 shadow-2xs"
                          >
                            <MessageCircle className="w-3 h-3" /> WA Siswa
                          </a>
                        )}
                        {x.s.NoOrtu && (
                          <a
                            href={waLink(
                              x.s.NoOrtu,
                              `Assalamu'alaikum Bapak/Ibu Wali Murid dari ${x.s.Nama} (Kelas ${kelasObj.Nama}). Kami menginformasikan bahwa ananda tercatat ${x.a} hari tidak hadir tanpa keterangan (Alpa). Mohon konfirmasi kepada Wali Kelas. Terima kasih.`
                            )}
                            target={waTarget()}
                            rel={waTarget() ? 'noopener noreferrer' : undefined}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1 shadow-2xs"
                          >
                            <MessageCircle className="w-3 h-3" /> WA Ortu
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center bg-gradient-to-br from-emerald-50 to-teal-50/60 rounded-xl border border-emerald-200 text-xs font-medium text-emerald-800">
                Seluruh siswa tertib hadir tanpa catatan alpa.
              </div>
            )}
          </div>
        </div>

        {/* Today's Schedule & Duty Roster */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-orange-100 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                Jadwal Pelajaran Hari Ini {hr ? `(${hr})` : ''}
              </h2>
              <button
                onClick={() => setTab('jad')}
                className="text-xs font-semibold text-orange-600 hover:text-orange-500"
              >
                Kelola Jadwal →
              </button>
            </div>
            {jdHari.length ? (
              <div className="space-y-2">
                {jdHari.map((x: any) => (
                  <div
                    key={x.ID}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-4 ${
                      x.Jenis === 'Istirahat'
                        ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200'
                        : 'bg-gradient-to-r from-sky-50/70 to-indigo-50/50 border-sky-200'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">{x.Mapel}</div>
                      {x.Guru && <div className="text-[11px] text-slate-600">{x.Guru}</div>}
                    </div>
                    <span className="font-mono tabular-nums text-xs font-bold text-indigo-700">
                      {x.Mulai}–{x.Selesai}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                {hr ? 'Belum ada jadwal tercatat untuk hari ini.' : 'Hari Minggu / libur.'}
              </p>
            )}
          </div>

          <div className="bg-white border border-teal-100 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                Petugas Piket Hari Ini {hr ? `(${hr})` : ''}
              </h2>
              <button
                onClick={() => setTab('pik')}
                className="text-xs font-semibold text-teal-600 hover:text-teal-500"
              >
                Atur Piket →
              </button>
            </div>
            {pkHari.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {pkHari.map((p: any) => {
                  const nama = namaSiswa(p.SiswaID);
                  const sObj = (db.Siswa || []).find((x: any) => x.ID === p.SiswaID);
                  return (
                    <div
                      key={p.ID}
                      className="p-3 rounded-xl bg-gradient-to-br from-emerald-50/70 to-teal-50/50 border border-emerald-200 flex items-center gap-2.5"
                    >
                      {sObj?.Foto ? (
                        <img
                          src={sObj.Foto}
                          alt={nama}
                          className="w-7 h-7 rounded-lg object-cover border border-emerald-200 shrink-0"
                        />
                      ) : (
                        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${avatarColorFor(nama)} text-white text-xs font-bold flex items-center justify-center shrink-0`}>
                          {nama.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">{nama}</div>
                        <div className="text-[11px] text-teal-700 truncate">{p.Tugas || '-'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                {hr ? 'Belum ada petugas piket hari ini.' : 'Hari ini libur.'}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. ABSENSI
  async function simpanAbsensiHarian() {
    const recs = siswaK
      .filter((s: any) => absDraft[s.ID])
      .map((s: any) => ({
        SiswaID: s.ID,
        Kode: absDraft[s.ID],
        Keterangan: absNote[s.ID] || ''
      }));
    try {
      showToast('Menyimpan absensi…', 6000);
      await apiCall('api_saveAbsensi', K, absDate, recs);
      const nextAbs = (db.Absensi || []).filter(
        (a: any) => !(a.Kelas === K && a.Tanggal === absDate)
      );
      recs.forEach((r: any) =>
        nextAbs.push({
          Kelas: K,
          Tanggal: absDate,
          SiswaID: r.SiswaID,
          Kode: r.Kode,
          Keterangan: r.Keterangan,
          Sumber: ''
        })
      );
      setDb({ ...db, Absensi: nextAbs });
      showToast('Absensi harian tersimpan');
    } catch (e: any) {
      showToast('Gagal: ' + pesanErr(e), 4500);
    }
  }

  function renderAbs() {
    const adaSekretaris = absK.some(
      (a: any) => a.Tanggal === absDate && a.Sumber === 'sekretaris'
    );
    const terisiCount = siswaK.filter((s: any) => absDraft[s.ID]).length;

    if (absMode === 'rekap') {
      const [y, m] = rekapBulan.split('-').map(Number);
      const tglBulan = tanggalK.filter(t => t.slice(0, 7) === rekapBulan);
      const peta: Record<string, string> = {};
      absK.forEach((a: any) => {
        peta[`${a.SiswaID}|${a.Tanggal}`] = a.Kode;
      });
      const nmBulan = [
        'Januari',
        'Februari',
        'Maret',
        'April',
        'Mei',
        'Juni',
        'Juli',
        'Agustus',
        'September',
        'Oktober',
        'November',
        'Desember'
      ][m - 1];

      return (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-md noprint">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Rekap Absensi Bulanan</h1>
              <p className="text-xs text-emerald-50 mt-1">
                Persentase kehadiran = jumlah hadir (H, T, D) dibagi total pertemuan ({tanggalK.length} pertemuan)
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex p-1 bg-white/20 backdrop-blur-sm rounded-xl">
                <button
                  onClick={() => setAbsMode('input')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white/90 hover:text-white whitespace-nowrap cursor-pointer"
                >
                  Input Harian
                </button>
                <button
                  onClick={() => setAbsMode('rekap')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-teal-800 shadow-sm whitespace-nowrap cursor-pointer"
                >
                  Rekap Bulanan
                </button>
              </div>
              <input
                type="month"
                value={rekapBulan}
                onChange={e => setRekapBulan(e.target.value)}
                className="px-3 py-1.5 text-xs font-medium text-slate-800 border border-white/40 rounded-xl bg-white"
              />
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 text-xs font-semibold bg-white text-teal-800 hover:bg-emerald-50 rounded-xl flex items-center gap-1.5 shadow-sm whitespace-nowrap cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Cetak
              </button>
            </div>
          </div>

          <PrintHeader />

          <div className="bg-white border border-emerald-100 rounded-2xl p-6 space-y-4 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">
              Bulan {nmBulan} {y}
            </h2>
            {tglBulan.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="border-b border-slate-200 text-slate-500 bg-slate-50">
                    <tr>
                      <th className="py-2.5 px-3">Nama Siswa</th>
                      {tglBulan.map(t => (
                        <th key={t} className="py-2.5 px-2 text-center tabular-nums">
                          {Number(t.slice(8))}
                        </th>
                      ))}
                      <th className="py-2.5 px-2 text-center">H</th>
                      <th className="py-2.5 px-2 text-center">S</th>
                      <th className="py-2.5 px-2 text-center">I</th>
                      <th className="py-2.5 px-2 text-center">A</th>
                      <th className="py-2.5 px-2 text-center">T</th>
                      <th className="py-2.5 px-2 text-center">D</th>
                      <th className="py-2.5 px-3 text-right">% Semester</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {siswaK.map((s: any) => {
                      const st = absStat(s.ID);
                      return (
                        <tr key={s.ID} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-medium text-slate-900 whitespace-nowrap">
                            {s.Nama}
                          </td>
                          {tglBulan.map(t => {
                            const kd = peta[`${s.ID}|${t}`] || '';
                            return (
                              <td key={t} className="py-2 px-1.5 text-center">
                                {kd ? (
                                  <span
                                    style={{ backgroundColor: KODE[kd]?.[1] || '#e2e8f0' }}
                                    className="inline-block w-6 py-0.5 rounded text-[11px] font-bold text-white"
                                  >
                                    {kd}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">·</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="py-2 px-2 text-center tabular-nums">{st.H}</td>
                          <td className="py-2 px-2 text-center tabular-nums">{st.S}</td>
                          <td className="py-2 px-2 text-center tabular-nums">{st.I}</td>
                          <td className="py-2 px-2 text-center tabular-nums font-semibold text-rose-600">
                            {st.A}
                          </td>
                          <td className="py-2 px-2 text-center tabular-nums">{st.T}</td>
                          <td className="py-2 px-2 text-center tabular-nums">{st.D}</td>
                          <td className="py-2 px-3 text-right tabular-nums font-bold text-slate-900">
                            {fmt(st.pct)}
                            {st.pct == null ? '' : '%'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Belum ada catatan absensi pada bulan ini.</p>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-md">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Absensi Harian</h1>
            <p className="text-xs text-emerald-50 mt-1">
              Catat dalam 5 menit pertama. Terlambat (T) dan Dispensasi (D) dihitung hadir.
            </p>
          </div>
          <div className="flex p-1 bg-white/20 backdrop-blur-sm rounded-xl">
            <button
              onClick={() => setAbsMode('input')}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-teal-800 shadow-sm whitespace-nowrap cursor-pointer"
            >
              Input Harian
            </button>
            <button
              onClick={() => setAbsMode('rekap')}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white/90 hover:text-white whitespace-nowrap cursor-pointer"
            >
              Rekap Bulanan
            </button>
          </div>
        </div>

        <div className="bg-white border border-emerald-100 rounded-2xl p-6 space-y-4 shadow-sm">
          {adaSekretaris && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <strong>Diisi Sekretaris Kelas:</strong> Absensi tanggal ini diinput oleh sekretaris dan belum dikonfirmasi. Periksa lalu klik <strong>Simpan Absensi</strong> untuk mengonfirmasi.
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                Tanggal:
                <input
                  type="date"
                  value={absDate}
                  onChange={e => setAbsDate(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs tabular-nums"
                />
              </label>
              <button
                onClick={() => {
                  const next: Record<string, string> = {};
                  siswaK.forEach((s: any) => (next[s.ID] = 'H'));
                  setAbsDraft(next);
                }}
                className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
              >
                Semua Hadir (H)
              </button>
              <button
                onClick={() => setAbsDraft({})}
                className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
              >
                Kosongkan
              </button>
              <span className="text-xs text-slate-500 tabular-nums ml-2">
                {terisiCount} / {siswaK.length} siswa terisi
              </span>
            </div>

            <button
              onClick={simpanAbsensiHarian}
              className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Simpan Absensi
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
            {Object.keys(KODE).map(k => (
              <span key={k} className="flex items-center gap-1.5">
                <span
                  style={{ backgroundColor: KODE[k][1] }}
                  className="w-5 h-5 rounded text-white font-bold text-[11px] flex items-center justify-center"
                >
                  {k}
                </span>
                <span>{KODE[k][0]}</span>
              </span>
            ))}
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2.5 px-3 w-10">#</th>
                  <th className="py-2.5 px-3">Nama Siswa</th>
                  <th className="py-2.5 px-3">Status Kehadiran</th>
                  <th className="py-2.5 px-3">Keterangan (Jam datang / Alasan / Bukti)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {siswaK.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 px-4 text-center text-xs text-slate-500">
                      Belum ada siswa di kelas ini. Tambahkan siswa di menu{' '}
                      <button
                        type="button"
                        onClick={() => setTab('sis')}
                        className="text-indigo-600 font-semibold hover:underline cursor-pointer"
                      >
                        Data Siswa
                      </button>
                      .
                    </td>
                  </tr>
                ) : (
                  siswaK.map((s: any, i: number) => (
                    <tr key={s.ID} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 tabular-nums text-slate-400">{i + 1}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{s.Nama}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          {Object.keys(KODE).map(k => {
                            const on = absDraft[s.ID] === k;
                            return (
                              <button
                                key={k}
                                onClick={() =>
                                  setAbsDraft(prev => ({
                                    ...prev,
                                    [s.ID]: prev[s.ID] === k ? '' : k
                                  }))
                                }
                                title={KODE[k][0]}
                                style={
                                  on
                                    ? {
                                        backgroundColor: KODE[k][1],
                                        borderColor: KODE[k][1],
                                        color: '#fff'
                                      }
                                    : {}
                                }
                                className={`w-8 h-8 rounded-lg font-bold text-xs border transition-colors cursor-pointer ${
                                  on
                                    ? ''
                                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100'
                                }`}
                              >
                                {k}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={absNote[s.ID] || ''}
                          onChange={e =>
                            setAbsNote(prev => ({ ...prev, [s.ID]: e.target.value }))
                          }
                          placeholder="Catatan tambahan..."
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 3. SISWA
  function openModalProfilSiswa(s: any) {
    const klsNama = (db.Kelas || []).find((x: any) => x.ID === s.Kelas)?.Nama || kelasObj.Nama || '-';
    const klsJur = (db.Kelas || []).find((x: any) => x.ID === s.Kelas)?.Jurusan || kelasObj.Jurusan || '';
    const hasPin = (db.punyaPIN || []).includes(s.ID);
    const noSw = s.NoSiswa || s.KontakOrtu || '';
    const noOrtu = s.NoOrtu || '';
    const ttlStr = [s.TempatLahir || '', s.TanggalLahir ? tglIndo(s.TanggalLahir) : '']
      .filter(Boolean)
      .join(', ');
    const pStats = computeStudentPoinStats(db.PoinSiswa || [], s.ID, S, ymd(new Date()));
    const visibleStars = Math.min(5, Math.max(pStats.loggedInToday ? 1 : 0, pStats.totalBintang));
    const allStudentPoinRows = (db.PoinSiswa || [])
      .filter((r: any) => r && r.SiswaID === s.ID)
      .slice()
      .sort((a: any, b: any) =>
        String(b.Waktu || b.Tanggal || '').localeCompare(String(a.Waktu || a.Tanggal || ''))
      );

    setModalContent({
      title: `Profil Biodata Siswa — ${s.Nama || ''}`,
      wide: true,
      render: () => (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-indigo-50 border border-amber-200/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              {s.Foto ? (
                <img
                  src={s.Foto}
                  alt={s.Nama || 'Foto Siswa'}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-sm shrink-0 bg-white"
                />
              ) : (
                <div
                  className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${avatarColorFor(s.Nama || 'S')} text-white text-xl font-bold flex items-center justify-center shrink-0 shadow-sm`}
                >
                  {String(s.Nama || 'S').slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <h4 className="text-base font-bold text-slate-900 truncate">{s.Nama || '-'}</h4>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mt-0.5">
                  <span className="font-mono font-semibold text-indigo-700">NIS: {s.NIS || '-'}</span>
                  <span>·</span>
                  <span>
                    Kelas {klsNama}
                    {klsJur ? ` (${klsJur})` : ''}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border bg-amber-100/80 text-amber-900 border-amber-300 tabular-nums">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                {pStats.totalBintang} Bintang · {pStats.saldoPoin} Poin
              </span>
              <span
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border ${
                  hasPin
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {hasPin ? 'PIN Portal Aktif' : 'Belum Ada PIN'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-[11px] font-semibold text-slate-500">NIS / NISN</div>
              <div className="font-mono font-bold text-indigo-700 mt-0.5">{s.NIS || '-'}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-[11px] font-semibold text-slate-500">Nama Lengkap</div>
              <div className="font-bold text-slate-900 mt-0.5">{s.Nama || '-'}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-indigo-500" /> Tempat &amp; Tanggal Lahir
              </div>
              <div className="font-semibold text-slate-800 mt-0.5">{ttlStr || '-'}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <User className="w-3 h-3 text-amber-600" /> Jenis Kelamin
              </div>
              <div className="font-semibold text-slate-800 mt-0.5">{s.JenisKelamin || '-'}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 sm:col-span-2">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-rose-500" /> Alamat Tempat Tinggal
              </div>
              <div className="font-medium text-slate-800 mt-0.5">{s.Alamat || '-'}</div>
            </div>
            <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-200/80 flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold text-sky-700 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> No. HP Siswa
                </div>
                <div className="font-mono font-bold text-slate-900 mt-0.5">{noSw || '-'}</div>
              </div>
              {noSw && (
                <button
                  type="button"
                  onClick={() => {
                    setModalContent(null);
                    setWaBlastState({ open: true, studentId: s.ID, targetType: 'siswa' });
                  }}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-lg inline-flex items-center gap-1 cursor-pointer"
                >
                  <MessageCircle className="w-3 h-3" /> WA
                </button>
              )}
            </div>
            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> No. HP Orang Tua
                </div>
                <div className="font-mono font-bold text-slate-900 mt-0.5">{noOrtu || '-'}</div>
              </div>
              {noOrtu && (
                <button
                  type="button"
                  onClick={() => {
                    setModalContent(null);
                    setWaBlastState({ open: true, studentId: s.ID, targetType: 'ortu' });
                  }}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg inline-flex items-center gap-1 cursor-pointer"
                >
                  <MessageCircle className="w-3 h-3" /> WA
                </button>
              )}
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 sm:col-span-2">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <HeartPulse className="w-3 h-3 text-rose-500" /> Catatan Kesehatan
              </div>
              <div className="font-medium text-slate-800 mt-0.5">{s.Kesehatan || 'Normal'}</div>
            </div>
          </div>

          {/* Panel Ringkasan Kontribusi Harian: Bintang Login & Poin Siswa */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/90 via-white to-orange-50/50 border border-amber-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-950">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                  Ringkasan Bintang Login &amp; Poin Siswa
                </span>
                {pStats.loggedInToday && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10px] font-bold">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    Login Hari Ini
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <Star
                    key={idx}
                    className={`w-4 h-4 ${
                      idx < visibleStars
                        ? 'fill-amber-400 text-amber-500'
                        : 'text-slate-200 fill-slate-100'
                    }`}
                  />
                ))}
                {pStats.totalBintang > 5 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded tabular-nums">
                    +{pStats.totalBintang - 5}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-white border border-amber-200/80">
                <div className="text-[10px] font-semibold text-amber-700">Total Bintang Login</div>
                <div className="text-base font-bold text-slate-900 tabular-nums mt-0.5">
                  ★ {pStats.totalBintang}
                </div>
                <div className="text-[10px] text-slate-500">
                  {pStats.loggedInToday ? 'Aktif login hari ini' : 'Belum login hari ini'}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-sky-200/80">
                <div className="text-[10px] font-semibold text-sky-700">Saldo Poin Tersedia</div>
                <div className="text-base font-bold text-sky-700 tabular-nums mt-0.5">
                  {pStats.saldoPoin} Poin
                </div>
                <div className="text-[10px] text-slate-500 tabular-nums">
                  Total didapat: {pStats.totalDidapat} poin
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-indigo-200/80">
                <div className="text-[10px] font-semibold text-indigo-700">Siap Ditambahkan</div>
                <div className="text-base font-bold text-indigo-700 tabular-nums mt-0.5">
                  +{pStats.nilaiSiapDitambahkan} Nilai
                </div>
                <div className="text-[10px] text-slate-500">Menunggu konfirmasi nilai</div>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-emerald-200/80">
                <div className="text-[10px] font-semibold text-emerald-700">Sudah Masuk ke Nilai</div>
                <div className="text-base font-bold text-emerald-700 tabular-nums mt-0.5">
                  +{pStats.nilaiSudahDitambahkan} Nilai
                </div>
                <div className="text-[10px] text-slate-500 tabular-nums">
                  Ditukar: {pStats.totalDikonversi} poin
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                  <History className="w-3.5 h-3.5 text-amber-600" />
                  Riwayat Perolehan Bintang Login &amp; Poin ({allStudentPoinRows.length})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setModalContent(null);
                    setTab('nil');
                    setPoinNilaiModalOpen(true);
                  }}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <ArrowRightLeft className="w-3 h-3" /> Kelola &amp; Tambah ke Nilai
                </button>
              </div>

              {allStudentPoinRows.length === 0 ? (
                <div className="p-3.5 rounded-xl bg-white border border-dashed border-amber-200 text-center text-[11px] text-slate-500">
                  Belum ada riwayat login atau perolehan poin untuk siswa ini. Siswa otomatis mendapat ★ 1 Bintang &amp; poin saat masuk ke Portal Siswa.
                </div>
              ) : (
                <div className="overflow-x-auto border border-amber-200/80 bg-white rounded-xl max-h-52">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead className="bg-amber-50/90 border-b border-amber-100 text-amber-950 sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Tanggal</th>
                        <th className="py-2 px-3">Aktivitas Harian / Konversi</th>
                        <th className="py-2 px-3 text-right">Bintang / Poin</th>
                        <th className="py-2 px-3 text-right">Nilai</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allStudentPoinRows.map((rw: any) => {
                        const jp = Number(rw.JumlahPoin || 0);
                        const nk = Number(rw.NilaiKonversi || 0);
                        let jamStr = '';
                        if (rw.Waktu) {
                          const dObj = new Date(rw.Waktu);
                          if (!Number.isNaN(dObj.getTime())) {
                            jamStr = `${pad(dObj.getHours())}:${pad(dObj.getMinutes())}`;
                          }
                        }
                        return (
                          <tr key={rw.ID} className="hover:bg-amber-50/30">
                            <td className="py-2 px-3 tabular-nums text-slate-600 whitespace-nowrap">
                              <div>{rw.Tanggal ? tglIndo(rw.Tanggal) : '-'}</div>
                              {jamStr && <div className="text-[10px] text-slate-400">{jamStr}</div>}
                            </td>
                            <td className="py-2 px-3 font-medium text-slate-800">
                              <span className="inline-flex items-center gap-1.5">
                                {rw.Jenis === 'login' ? (
                                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500 shrink-0" />
                                ) : rw.Jenis === 'konversi' ? (
                                  <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                ) : (
                                  <Plus className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                )}
                                <span>{rw.Keterangan || rw.Jenis}</span>
                              </span>
                            </td>
                            <td
                              className={`py-2 px-3 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                                jp >= 0 ? 'text-emerald-700' : 'text-amber-700'
                              }`}
                            >
                              {rw.Jenis === 'login' ? `★ +1 · +${jp}` : jp >= 0 ? `+${jp}` : jp}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold tabular-nums text-indigo-700 whitespace-nowrap">
                              {nk > 0 ? `+${nk} (${getPoinTargetLabel(rw.KomponenTarget)})` : '-'}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                  rw.Status === 'Ditambahkan'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : rw.Status === 'Siap Ditambahkan'
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                                }`}
                              >
                                {rw.Status || 'Aktif'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalContent(null)}
              className="px-4 py-2 text-xs font-semibold bg-slate-100 text-slate-700 rounded-xl cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={() => openModalSiswa(s.ID)}
              className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" /> Edit Biodata Siswa
            </button>
          </div>
        </div>
      )
    });
  }

  function openModalSiswa(id?: string) {
    const s = (db.Siswa || []).find((x: any) => x.ID === id) || {};

    setModalContent({
      title: id ? 'Edit Data & Profil Siswa' : 'Tambah Siswa Baru',
      wide: true,
      render: () => (
        <SiswaEditorModalBody
          initial={s}
          showToast={showToast}
          onCancel={() => setModalContent(null)}
          onSubmit={async payload => {
            const nisClean = payload.NIS;
            const nextSiswa = [...(db.Siswa || [])];
            const existingByIdIdx = id ? nextSiswa.findIndex(x => x.ID === id) : -1;
            const existingByNisIdx = nisClean
              ? nextSiswa.findIndex(
                  (x: any) =>
                    x.ID !== id &&
                    String(x.NIS || '').trim().toLowerCase() === nisClean.toLowerCase()
                )
              : -1;

            if (existingByIdIdx >= 0 && existingByNisIdx >= 0) {
              showToast('NIS sudah dipakai siswa lain');
              return;
            }

            if (existingByIdIdx >= 0) {
              nextSiswa[existingByIdIdx] = {
                ...nextSiswa[existingByIdIdx],
                Nama: payload.Nama,
                NIS: nisClean,
                TempatLahir: payload.TempatLahir,
                TanggalLahir: payload.TanggalLahir,
                JenisKelamin: payload.JenisKelamin,
                NoSiswa: payload.NoSiswa,
                NoOrtu: payload.NoOrtu,
                Alamat: payload.Alamat,
                Kesehatan: payload.Kesehatan,
                Foto: payload.Foto
              };
            } else if (existingByNisIdx >= 0) {
              const prev = nextSiswa[existingByNisIdx];
              nextSiswa[existingByNisIdx] = {
                ...prev,
                Kelas: K,
                Nama: payload.Nama || prev.Nama || '',
                NIS: nisClean,
                TempatLahir: payload.TempatLahir || prev.TempatLahir || '',
                TanggalLahir: payload.TanggalLahir || prev.TanggalLahir || '',
                JenisKelamin: payload.JenisKelamin || prev.JenisKelamin || '',
                NoSiswa: payload.NoSiswa || prev.NoSiswa || '',
                NoOrtu: payload.NoOrtu || prev.NoOrtu || '',
                Alamat: payload.Alamat || prev.Alamat || '',
                Kesehatan: payload.Kesehatan || prev.Kesehatan || '',
                Foto: payload.Foto || prev.Foto || ''
              };
              showToast(`UPSERT: Data NIS ${nisClean} diperbarui & dimasukkan ke kelas ${kelasObj.Nama || ''}`);
            } else {
              nextSiswa.push({
                ID: uid(),
                Kelas: K,
                Nama: payload.Nama,
                NIS: nisClean,
                TempatLahir: payload.TempatLahir,
                TanggalLahir: payload.TanggalLahir,
                JenisKelamin: payload.JenisKelamin,
                NoSiswa: payload.NoSiswa,
                NoOrtu: payload.NoOrtu,
                Alamat: payload.Alamat,
                Kesehatan: payload.Kesehatan,
                Foto: payload.Foto
              });
            }
            setModalContent(null);
            await persistSheets({ ...db, Siswa: nextSiswa }, 'Siswa');
          }}
        />
      )
    });
  }

  async function handleAturPin(sid: string, pinManual?: string) {
    try {
      const pin = await apiCall('api_setPIN', sid, pinManual || '');
      const punya = Array.from(new Set([...(db.punyaPIN || []), sid]));
      let nextHashes = db.pinHashes || {};
      try {
        nextHashes = await apiCall('api_getPinHashes');
      } catch (_) {}
      const nextDb: Record<string, any> = { ...db, punyaPIN: punya, pinHashes: nextHashes };
      setDb(nextDb);
      setModalContent({
        title: `PIN Login untuk ${namaSiswa(sid)}`,
        render: () => (
          <div className="space-y-4 text-center">
            <div className="py-4 bg-slate-100 rounded-xl font-mono text-3xl font-bold tracking-widest text-slate-900">
              {pin}
            </div>
            <p className="text-xs text-slate-500">
              Catat dan berikan PIN ini kepada siswa. Siswa masuk menggunakan NIS dan PIN ini.
            </p>
            <button
              onClick={() => setModalContent(null)}
              className="w-full py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg"
            >
              Selesai
            </button>
          </div>
        )
      });
    } catch (e: any) {
      showToast(pesanErr(e), 4000);
    }
  }

  async function handleBuatPinSemua(timpa: boolean, seragam = '', targetKelas = K) {
    try {
      const r = await apiCall('api_buatPINSemua', targetKelas, timpa, seragam);
      const punya = new Set(db.punyaPIN || []);
      (r.daftar || []).forEach((x: any) => punya.add(x.id));
      const nextHashes = r.pinHashes || db.pinHashes || {};
      const nextDb: Record<string, any> = { ...db, punyaPIN: Array.from(punya), pinHashes: nextHashes };
      setDb(nextDb);
      const teks = (r.daftar || [])
        .map((x: any) => `${x.nama}\t${x.nis}\t${x.pin}`)
        .join('\n');
      setModalContent({
        title: `PIN Siswa (${(r.daftar || []).length} siswa)`,
        render: () => (
          <div className="space-y-3">
            {seragam && r.daftar?.length > 0 && (
              <div className="px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-200 text-xs text-indigo-900 flex items-center justify-between gap-2">
                <span>
                  PIN seragam diterapkan untuk <strong>{r.daftar.length}</strong> siswa:
                </span>
                <span className="font-mono font-bold text-sm tracking-widest">{seragam}</span>
              </div>
            )}
            {r.dilewati > 0 && (
              <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                {r.dilewati} siswa dilewati karena belum memiliki NIS.
              </div>
            )}
            {r.daftar?.length ? (
              <>
                <p className="text-xs text-slate-500">
                  Salin daftar di bawah (Nama, NIS, PIN) untuk dibagikan kepada siswa:
                </p>
                <textarea
                  readOnly
                  rows={6}
                  value={teks}
                  className="w-full p-3 border border-slate-300 rounded-lg text-xs font-mono bg-slate-50"
                />
              </>
            ) : (
              <p className="text-xs text-slate-600">
                {timpa
                  ? 'Tidak ada siswa dengan NIS valid pada target yang dipilih.'
                  : 'Seluruh siswa pada target yang dipilih sudah memiliki PIN aktif.'}
              </p>
            )}
            <div className="flex justify-end gap-2">
              {r.daftar?.length > 0 && (
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(teks);
                    showToast('Tersalin ke papan klip');
                  }}
                  className="px-3 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg"
                >
                  Salin Semua
                </button>
              )}
              <button
                onClick={() => setModalContent(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg"
              >
                Tutup
              </button>
            </div>
          </div>
        )
      });
    } catch (e: any) {
      showToast(pesanErr(e), 4000);
    }
  }

  function openModalPinSeragam() {
    const canAllClasses = peran === 'admin' || (db.kelasWali || []).length > 1;
    const PinSeragamForm = () => {
      const [pinVal, setPinVal] = useState('123456');
      const [timpaMode, setTimpaMode] = useState<'baru' | 'semua'>('semua');
      const [scopeKelas, setScopeKelas] = useState<'kelas' | 'semua_kelas'>('kelas');
      const [errPin, setErrPin] = useState('');
      const [busy, setBusy] = useState(false);

      const cleanPin = pinVal.trim();
      const targetList = (db.Siswa || []).filter((s: any) =>
        scopeKelas === 'semua_kelas'
          ? peran === 'admin' || (db.kelasWali || []).includes(s.Kelas)
          : s.Kelas === K
      );
      const affectedCount = targetList.filter((s: any) => {
        if (!String(s.NIS || '').trim()) return false;
        if (timpaMode === 'semua') return true;
        return !(db.punyaPIN || []).includes(s.ID);
      }).length;

      return (
        <form
          onSubmit={async e => {
            e.preventDefault();
            if (!/^\d{4,8}$/.test(cleanPin)) {
              setErrPin('PIN seragam harus berupa 4–8 digit angka.');
              return;
            }
            setErrPin('');
            setBusy(true);
            try {
              await handleBuatPinSemua(
                timpaMode === 'semua',
                cleanPin,
                scopeKelas === 'semua_kelas' ? '__ALL__' : K
              );
            } finally {
              setBusy(false);
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              PIN Seragam Baru (4–8 angka)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                value={pinVal}
                onChange={e => {
                  setPinVal(e.target.value.replace(/\D/g, '').slice(0, 8));
                  setErrPin('');
                }}
                placeholder="Contoh: 123456"
                className="flex-1 px-3 py-2 border border-indigo-200 rounded-xl font-mono text-base font-bold tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => {
                  setPinVal(String(100000 + Math.floor(Math.random() * 900000)));
                  setErrPin('');
                }}
                className="px-3 py-2 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl cursor-pointer whitespace-nowrap"
              >
                Acak 6 Digit
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[11px] text-slate-500">Cepat:</span>
              {['123456', '202627', '000000'].map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setPinVal(preset);
                    setErrPin('');
                  }}
                  className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-700">Target Siswa</div>
            <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <input
                type="radio"
                name="timpaMode"
                checked={timpaMode === 'semua'}
                onChange={() => setTimpaMode('semua')}
                className="mt-0.5"
              />
              <div className="text-xs">
                <div className="font-semibold text-slate-900">
                  Semua siswa (timpa PIN lama jika sudah ada)
                </div>
                <div className="text-[11px] text-slate-500">
                  Seluruh siswa pada target kelas akan memakai PIN seragam yang sama ini.
                </div>
              </div>
            </label>
            <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <input
                type="radio"
                name="timpaMode"
                checked={timpaMode === 'baru'}
                onChange={() => setTimpaMode('baru')}
                className="mt-0.5"
              />
              <div className="text-xs">
                <div className="font-semibold text-slate-900">
                  Hanya siswa yang belum punya PIN
                </div>
                <div className="text-[11px] text-slate-500">
                  Siswa yang sudah memiliki PIN aktif tidak diubah.
                </div>
              </div>
            </label>
          </div>

          {canAllClasses && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-slate-700">Cakupan Kelas</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScopeKelas('kelas')}
                  className={`px-3 py-2 text-xs font-semibold rounded-xl border cursor-pointer ${
                    scopeKelas === 'kelas'
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  Kelas {kelasObj.Nama || 'Aktif'} Saja
                </button>
                <button
                  type="button"
                  onClick={() => setScopeKelas('semua_kelas')}
                  className={`px-3 py-2 text-xs font-semibold rounded-xl border cursor-pointer ${
                    scopeKelas === 'semua_kelas'
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  Semua Kelas Wali/Sekolah
                </button>
              </div>
            </div>
          )}

          <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
            Akan menerapkan PIN seragam <strong className="font-mono">{cleanPin || '…'}</strong> untuk{' '}
            <strong>{affectedCount}</strong> siswa ber-NIS. Siswa dapat mengganti PIN masing-masing setelah masuk Portal Siswa.
          </div>

          {errPin && (
            <div className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              {errPin}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setModalContent(null)}
              className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              {busy ? 'Menerapkan…' : 'Terapkan PIN Seragam'}
            </button>
          </div>
        </form>
      );
    };

    setModalContent({
      title: 'Buat PIN Baru Seragam',
      render: () => <PinSeragamForm />
    });
  }

  function renderSis() {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 p-6 text-white shadow-md shadow-amber-500/15 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Data Siswa & Akses Portal</h1>
            <p className="text-xs text-amber-50 mt-1">
              Tahap 1: pastikan 100% data induk siswa, kontak orang tua, dan PIN portal siswa terverifikasi.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setWaBlastState({ open: true })}
              className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5" /> Kirim WA Massal
            </button>
            <button
              onClick={() => openModalSiswa()}
              className="px-3.5 py-2 text-xs font-semibold bg-white text-orange-700 hover:bg-orange-50 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah Siswa
            </button>
            <button
              onClick={() => setImportModalMode('siswa')}
              className="px-3 py-2 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" /> Impor Data
            </button>
            <button
              onClick={() => {
                const esc = (v: string) => {
                  const s = String(v ?? '');
                  return s.includes(';') || s.includes('"') || s.includes('\n')
                    ? `"${s.replace(/"/g, '""')}"`
                    : s;
                };
                const header = [
                  'No',
                  'NIS',
                  'Nama Lengkap',
                  'Tempat Lahir',
                  'Tanggal Lahir',
                  'Jenis Kelamin',
                  'Alamat',
                  'No. HP Siswa',
                  'No. HP Orang Tua',
                  'Kesehatan'
                ];
                const rows = siswaK.map((s: any, idx: number) => [
                  String(idx + 1),
                  String(s.NIS || ''),
                  String(s.Nama || ''),
                  String(s.TempatLahir || ''),
                  String(s.TanggalLahir || ''),
                  String(s.JenisKelamin || ''),
                  String(s.Alamat || ''),
                  String(s.NoSiswa || s.KontakOrtu || ''),
                  String(s.NoOrtu || ''),
                  String(s.Kesehatan || 'Normal')
                ]);
                const csv = '\uFEFF' + [header, ...rows].map(r => r.map(esc).join(';')).join('\r\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `Siswa_${kelasObj.Nama || 'Kelas'}.csv`;
                a.click();
                showToast('Data CSV siswa berhasil diunduh');
              }}
              className="px-3 py-2 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Ekspor CSV
            </button>
            <button
              onClick={() => handleBuatPinSemua(false)}
              className="px-3 py-2 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" /> Buat PIN Baru
            </button>
            <button
              onClick={openModalPinSeragam}
              className="px-3 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/40 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" /> Buat PIN Baru Seragam
            </button>
            <button
              onClick={async () => {
                if (await askConfirm('Reset PIN seluruh siswa di kelas ini menjadi PIN acak baru?')) {
                  handleBuatPinSemua(true);
                }
              }}
              className="px-3 py-2 text-xs font-semibold bg-rose-900/30 hover:bg-rose-900/50 text-white border border-white/20 rounded-xl cursor-pointer"
            >
              Reset Semua PIN
            </button>
          </div>
        </div>

        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Biodata yang diisi atau diperbarui siswa di Portal Siswa otomatis tersinkron ke tabel Admin ini.
            </span>
          </div>
          <button
            type="button"
            onClick={muatUlang}
            className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg inline-flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" /> Segarkan Data
          </button>
        </div>

        <div className="bg-white border border-amber-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-gradient-to-r from-amber-50 to-orange-50/70 border-b border-amber-100 text-amber-950">
                <tr>
                  <th className="py-3 px-3.5 w-9">#</th>
                  <th className="py-3 px-3.5">NIS</th>
                  <th className="py-3 px-3.5">Nama Lengkap</th>
                  <th className="py-3 px-3.5">Tempat, Tgl Lahir</th>
                  <th className="py-3 px-3.5">JK</th>
                  <th className="py-3 px-3.5">Alamat</th>
                  <th className="py-3 px-3.5">No. HP Siswa</th>
                  <th className="py-3 px-3.5">No. HP Orang Tua</th>
                  <th className="py-3 px-3.5">Kesehatan</th>
                  <th className="py-3 px-3.5">Status PIN</th>
                  <th className="py-3 px-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {siswaK.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 px-4 text-center text-xs text-slate-500">
                      <div className="space-y-2">
                        <p>Belum ada siswa terdaftar di kelas {kelasObj.Nama || 'ini'}.</p>
                        <button
                          type="button"
                          onClick={() => openModalSiswa()}
                          className="px-3.5 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-white rounded-lg cursor-pointer"
                        >
                          + Tambah Siswa Pertama
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  siswaK.map((s: any, i: number) => {
                    const hasPin = (db.punyaPIN || []).includes(s.ID);
                    const noSw = s.NoSiswa || s.KontakOrtu || '';
                    const noOrtu = s.NoOrtu || '';
                    const ttlText = [
                      s.TempatLahir || '',
                      s.TanggalLahir ? tglIndo(s.TanggalLahir) : ''
                    ]
                      .filter(Boolean)
                      .join(', ');
                    const pStats = computeStudentPoinStats(db.PoinSiswa || [], s.ID, S, ymd(new Date()));
                    return (
                      <tr key={s.ID} className="hover:bg-amber-50/30">
                        <td className="py-2.5 px-3.5 tabular-nums text-slate-400">{i + 1}</td>
                        <td className="py-2.5 px-3.5 font-mono tabular-nums text-indigo-700 font-semibold whitespace-nowrap">
                          {s.NIS || '-'}
                        </td>
                        <td className="py-2.5 px-3.5">
                          <button
                            type="button"
                            onClick={() => openModalProfilSiswa(s)}
                            className="flex items-center gap-2.5 text-left group cursor-pointer"
                          >
                            {s.Foto ? (
                              <img
                                src={s.Foto}
                                alt={s.Nama}
                                className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0 bg-white"
                              />
                            ) : (
                              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${avatarColorFor(s.Nama)} text-white text-xs font-bold flex items-center justify-center shrink-0`}>
                                {s.Nama.slice(0, 1).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-semibold text-slate-900 group-hover:text-indigo-700 group-hover:underline">
                                  {s.Nama}
                                </span>
                                {(pStats.totalBintang > 0 || pStats.loggedInToday) && (
                                  <span
                                    title={`Bintang Login: ${pStats.totalBintang} · Saldo Poin: ${pStats.saldoPoin}`}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold tabular-nums"
                                  >
                                    <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                                    {pStats.totalBintang}
                                  </span>
                                )}
                                {pStats.loggedInToday && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-semibold">
                                    Login Hari Ini
                                  </span>
                                )}
                              </div>
                              {pStats.saldoPoin > 0 && (
                                <div className="text-[10px] text-amber-700 font-medium tabular-nums">
                                  {pStats.saldoPoin} Poin Login
                                </div>
                              )}
                            </div>
                          </button>
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-600 whitespace-nowrap">
                          {ttlText || '-'}
                        </td>
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          {s.JenisKelamin ? (
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                                s.JenisKelamin === 'Perempuan'
                                  ? 'bg-pink-50 text-pink-700 border border-pink-200'
                                  : 'bg-sky-50 text-sky-700 border border-sky-200'
                              }`}
                            >
                              {s.JenisKelamin === 'Laki-laki' ? 'L' : 'P'}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-600 max-w-[180px] truncate" title={s.Alamat || ''}>
                          {s.Alamat || '-'}
                        </td>
                        <td className="py-2.5 px-3.5 tabular-nums text-slate-600 whitespace-nowrap">
                          {noSw ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[11px]">{noSw}</span>
                              <button
                                type="button"
                                onClick={() => setWaBlastState({ open: true, studentId: s.ID, targetType: 'siswa' })}
                                title="Kirim WhatsApp ke Siswa"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-md whitespace-nowrap cursor-pointer"
                              >
                                <MessageCircle className="w-3 h-3" /> WA
                              </button>
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 tabular-nums text-slate-600 whitespace-nowrap">
                          {noOrtu ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[11px]">{noOrtu}</span>
                              <button
                                type="button"
                                onClick={() => setWaBlastState({ open: true, studentId: s.ID, targetType: 'ortu' })}
                                title="Kirim WhatsApp ke Orang Tua"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md whitespace-nowrap cursor-pointer"
                              >
                                <MessageCircle className="w-3 h-3" /> WA
                              </button>
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-600 whitespace-nowrap">{s.Kesehatan || 'Normal'}</td>
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          <span
                            className={`font-semibold ${
                              hasPin ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {hasPin ? 'Aktif' : 'Belum'}
                          </span>
                          <span className="mx-1 text-slate-300">·</span>
                          <button
                            onClick={() => handleAturPin(s.ID)}
                            className="text-indigo-600 hover:underline font-semibold cursor-pointer"
                          >
                            Reset
                          </button>
                        </td>
                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap space-x-2">
                          <button
                            type="button"
                            onClick={() => openModalProfilSiswa(s)}
                            className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                          >
                            Profil
                          </button>
                          <button
                            type="button"
                            onClick={() => openModalSiswa(s.ID)}
                            className="text-sky-600 hover:text-sky-800 font-semibold cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            onClick={async () => {
                              if (
                                await askConfirm(
                                  `Hapus siswa "${s.Nama}" beserta seluruh absensi dan nilainya?`
                                )
                              ) {
                                const nextDb = {
                                  ...db,
                                  Siswa: db.Siswa.filter((x: any) => x.ID !== s.ID),
                                  Absensi: db.Absensi.filter((x: any) => x.SiswaID !== s.ID),
                                  Nilai: db.Nilai.filter((x: any) => x.SiswaID !== s.ID),
                                  Pengumpulan: db.Pengumpulan.filter((x: any) => x.SiswaID !== s.ID),
                                  Perilaku: db.Perilaku.filter((x: any) => x.SiswaID !== s.ID),
                                  Denah: db.Denah.filter((x: any) => x.SiswaID !== s.ID),
                                  Piket: db.Piket.filter((x: any) => x.SiswaID !== s.ID),
                                  PoinSiswa: (db.PoinSiswa || []).filter((x: any) => x.SiswaID !== s.ID)
                                };
                                await persistSheets(
                                  nextDb,
                                  'Siswa',
                                  'Absensi',
                                  'Nilai',
                                  'Pengumpulan',
                                  'Perilaku',
                                  'Denah',
                                  'Piket',
                                  'PoinSiswa'
                                );
                              }
                            }}
                            className="text-rose-600 hover:text-rose-700 font-semibold"
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 4. DENAH TEMPAT DUDUK
  function renderDen() {
    const atur = (db.DenahAtur || []).find((x: any) => x.Kelas === K) || {
      Kelas: K,
      Baris: '4',
      Kolom: '4',
      Grup: '2'
    };
    const b = num(atur.Baris) || 4;
    const k = num(atur.Kolom) || 4;
    const g = num(atur.Grup) || 0;
    const denK = (db.Denah || []).filter((d: any) => d.Kelas === K);
    const kursiMap: Record<string, { Nama: string; SiswaID: string }> = {};
    denK.forEach((d: any) => {
      const s = (db.Siswa || []).find((x: any) => x.ID === d.SiswaID);
      if (s) kursiMap[`${d.Baris}-${d.Kolom}`] = { Nama: s.Nama, SiswaID: s.ID };
    });
    const dudukSet = new Set(denK.map((d: any) => d.SiswaID));
    const belumDuduk = siswaK.filter((s: any) => !dudukSet.has(s.ID));

    const handleKlikKursi = (r: number, col: number) => {
      const pos = `${r}-${col}`;
      const ada = denK.find(
        (d: any) => String(d.Baris) === String(r) && String(d.Kolom) === String(col)
      );
      let nextDenah = [...(db.Denah || [])];

      if (denPick) {
        nextDenah = nextDenah.filter(
          (d: any) =>
            !(
              d.Kelas === K &&
              (d.SiswaID === denPick ||
                (String(d.Baris) === String(r) && String(d.Kolom) === String(col)))
            )
        );
        nextDenah.push({ Kelas: K, Baris: String(r), Kolom: String(col), SiswaID: denPick });
        setDb({ ...db, Denah: nextDenah });
        setDenPick('');
        setDenDirty(true);
      } else if (denSel && denSel !== pos) {
        const [r0, c0] = denSel.split('-');
        const asal = nextDenah.find(
          (d: any) =>
            d.Kelas === K && String(d.Baris) === String(r0) && String(d.Kolom) === String(c0)
        );
        const tujuan = nextDenah.find(
          (d: any) =>
            d.Kelas === K && String(d.Baris) === String(r) && String(d.Kolom) === String(col)
        );
        if (asal && tujuan) {
          const tmp = asal.SiswaID;
          asal.SiswaID = tujuan.SiswaID;
          tujuan.SiswaID = tmp;
        } else if (asal) {
          asal.Baris = String(r);
          asal.Kolom = String(col);
        }
        setDb({ ...db, Denah: nextDenah });
        setDenSel('');
        setDenDirty(true);
      } else if (denSel === pos) {
        setDenSel('');
      } else if (ada) {
        setDenSel(pos);
      }
    };

    const susunOtomatis = (mode: 'abjad' | 'acak') => {
      if (siswaK.length > b * k) {
        return showToast(`Kursi kurang: ${siswaK.length} siswa untuk ${b * k} kursi`);
      }
      const list = mode === 'abjad' ? siswaK : acak(siswaK);
      const nextDenah = (db.Denah || []).filter((d: any) => d.Kelas !== K);
      list.forEach((s: any, idx: number) => {
        nextDenah.push({
          Kelas: K,
          Baris: String(Math.floor(idx / k) + 1),
          Kolom: String((idx % k) + 1),
          SiswaID: s.ID
        });
      });
      setDb({ ...db, Denah: nextDenah });
      setDenDirty(true);
      setDenSel('');
      setDenPick('');
    };

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-md noprint">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Denah Tempat Duduk</h1>
            <p className="text-xs text-sky-50 mt-1">
              Klik siswa di daftar bawah lalu klik kursi, atau klik dua kursi untuk menukar posisi duduk.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => susunOtomatis('abjad')}
              className="px-3 py-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl whitespace-nowrap cursor-pointer"
            >
              Susun Abjad
            </button>
            <button
              onClick={() => susunOtomatis('acak')}
              className="px-3 py-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl whitespace-nowrap cursor-pointer"
            >
              Susun Acak
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Cetak
            </button>
            <button
              onClick={async () => {
                if (await persistSheets(db, 'Denah', 'DenahAtur')) {
                  setDenDirty(false);
                }
              }}
              className="px-4 py-1.5 text-xs font-semibold bg-white text-sky-700 hover:bg-sky-50 rounded-xl flex items-center gap-1.5 shadow-sm whitespace-nowrap cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Simpan Denah {denDirty ? '*' : ''}
            </button>
          </div>
        </div>

        <PrintHeader />

        {/* Grid Size Controls */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-4 noprint">
          <label className="text-xs font-medium text-slate-600 flex items-center gap-2">
            Baris:
            <input
              type="number"
              min={1}
              max={10}
              value={b}
              onChange={e => {
                const val = String(Math.max(1, Math.min(10, Number(e.target.value) || 4)));
                const nextAtur = (db.DenahAtur || []).filter((x: any) => x.Kelas !== K);
                nextAtur.push({ ...atur, Kelas: K, Baris: val });
                setDb({ ...db, DenahAtur: nextAtur });
                setDenDirty(true);
              }}
              className="w-16 px-2.5 py-1 border border-slate-300 rounded-lg text-xs tabular-nums"
            />
          </label>
          <label className="text-xs font-medium text-slate-600 flex items-center gap-2">
            Kolom:
            <input
              type="number"
              min={1}
              max={10}
              value={k}
              onChange={e => {
                const val = String(Math.max(1, Math.min(10, Number(e.target.value) || 4)));
                const nextAtur = (db.DenahAtur || []).filter((x: any) => x.Kelas !== K);
                nextAtur.push({ ...atur, Kelas: K, Kolom: val });
                setDb({ ...db, DenahAtur: nextAtur });
                setDenDirty(true);
              }}
              className="w-16 px-2.5 py-1 border border-slate-300 rounded-lg text-xs tabular-nums"
            />
          </label>
          <label className="text-xs font-medium text-slate-600 flex items-center gap-2">
            Lorong:
            <select
              value={g}
              onChange={e => {
                const nextAtur = (db.DenahAtur || []).filter((x: any) => x.Kelas !== K);
                nextAtur.push({ ...atur, Kelas: K, Grup: e.target.value });
                setDb({ ...db, DenahAtur: nextAtur });
                setDenDirty(true);
              }}
              className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs"
            >
              <option value="0">Tanpa lorong</option>
              <option value="2">Tiap 2 kolom</option>
              <option value="3">Tiap 3 kolom</option>
              <option value="4">Tiap 4 kolom</option>
            </select>
          </label>
          {denSel && (
            <button
              onClick={() => {
                const [r0, c0] = denSel.split('-');
                const nextDenah = (db.Denah || []).filter(
                  (d: any) =>
                    !(
                      d.Kelas === K &&
                      String(d.Baris) === String(r0) &&
                      String(d.Kolom) === String(c0)
                    )
                );
                setDb({ ...db, Denah: nextDenah });
                setDenSel('');
                setDenDirty(true);
              }}
              className="px-3 py-1 text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 rounded-lg"
            >
              Kosongkan Kursi Terpilih
            </button>
          )}
        </div>

        {/* Seating Map */}
        <div className="bg-white border border-cyan-100 rounded-2xl p-6 overflow-x-auto shadow-sm">
          <div className="inline-block min-w-full">
            <div className="max-w-xl mx-auto bg-gradient-to-r from-emerald-800 to-teal-800 text-white text-center text-xs font-bold tracking-widest py-3 rounded-xl mb-6 shadow-md">
              PAPAN TULIS · MEJA GURU
            </div>
            <div className="space-y-2.5">
              {Array.from({ length: b }, (_, rIdx) => {
                const r = rIdx + 1;
                return (
                  <div key={r} className="flex items-center justify-center gap-2.5">
                    {Array.from({ length: k }, (_, cIdx) => {
                      const col = cIdx + 1;
                      const pos = `${r}-${col}`;
                      const o = kursiMap[pos];
                      const selected = denSel === pos;
                      return (
                        <React.Fragment key={col}>
                          {g > 0 && col > 1 && (col - 1) % g === 0 && (
                            <div className="w-6 shrink-0" />
                          )}
                          <button
                            type="button"
                            onClick={() => handleKlikKursi(r, col)}
                            className={`w-28 h-16 p-2 rounded-xl border-2 text-xs font-semibold transition-all flex items-center justify-center text-center leading-tight cursor-pointer ${
                              selected
                                ? 'border-fuchsia-600 ring-2 ring-fuchsia-500/30 bg-gradient-to-br from-fuchsia-50 to-indigo-50 text-fuchsia-950 shadow-sm'
                                : o
                                ? 'border-sky-300 bg-gradient-to-br from-sky-50 to-indigo-50/70 text-slate-900 hover:border-indigo-500 shadow-xs'
                                : 'border-dashed border-slate-200 bg-slate-50/50 text-slate-400 hover:border-cyan-400'
                            }`}
                          >
                            {o ? o.Nama : '+'}
                          </button>
                        </React.Fragment>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Unseated Students */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 noprint">
          <h3 className="text-xs font-bold text-slate-700 mb-3">
            Siswa Belum Mendapat Kursi ({belumDuduk.length})
          </h3>
          {belumDuduk.length ? (
            <div className="flex flex-wrap gap-2">
              {belumDuduk.map((s: any) => (
                <button
                  key={s.ID}
                  onClick={() => setDenPick(denPick === s.ID ? '' : s.ID)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    denPick === s.ID
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {s.Nama}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Seluruh siswa di kelas ini sudah mendapat kursi.</p>
          )}
        </div>
      </div>
    );
  }

  // 5. JADWAL PIKET
  function renderPik() {
    const piketK = (db.Piket || []).filter((p: any) => p.Kelas === K);
    const today = hariIni();

    const bagiPiketOtomatis = async () => {
      if (!siswaK.length) return showToast('Belum ada siswa di kelas ini');
      const nextPiket = (db.Piket || []).filter((p: any) => p.Kelas !== K);
      const hari5 = HARI.slice(0, 5);
      const cnt: Record<string, number> = {};
      acak(siswaK).forEach((s: any, i: number) => {
        const h = hari5[i % 5];
        cnt[h] = cnt[h] || 0;
        nextPiket.push({
          ID: uid(),
          Kelas: K,
          Hari: h,
          SiswaID: s.ID,
          Tugas: TUGAS_PIKET[cnt[h]++ % TUGAS_PIKET.length]
        });
      });
      await persistSheets({ ...db, Piket: nextPiket }, 'Piket');
    };

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-lime-500 via-emerald-500 to-teal-600 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-md noprint">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Jadwal Piket Kebersihan</h1>
            <p className="text-xs text-emerald-50 mt-1">
              Pembagian tanggung jawab harian kelas Senin sampai Jumat.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={bagiPiketOtomatis}
              className="px-3.5 py-2 text-xs font-semibold bg-white text-emerald-700 hover:bg-emerald-50 rounded-xl shadow-sm whitespace-nowrap cursor-pointer"
            >
              Bagi Otomatis (Senin–Jumat)
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-2 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Cetak
            </button>
          </div>
        </div>

        <PrintHeader />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {HARI.slice(0, 5).map(h => {
            const ls = piketK.filter((p: any) => p.Hari === h);
            const dt = DAY_THEME[h] || DAY_THEME.Senin;
            return (
              <div
                key={h}
                className={`bg-white rounded-2xl border overflow-hidden shadow-sm ${
                  h === today ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200'
                }`}
              >
                <div className={`px-5 py-3.5 bg-gradient-to-r ${dt.header} text-white flex items-center justify-between`}>
                  <h3 className="text-sm font-bold">
                    {h} {h === today && <span className="text-xs text-white/90 font-normal">· Hari ini</span>}
                  </h3>
                  <span className="text-xs text-white/90 tabular-nums">{ls.length} petugas</span>
                </div>
                <div className="p-4 space-y-2">
                  {ls.map((p: any) => (
                    <div
                      key={p.ID}
                      className={`p-2.5 rounded-xl border space-y-1.5 ${dt.card}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {namaSiswa(p.SiswaID)}
                        </span>
                        <button
                          onClick={async () => {
                            const next = db.Piket.filter((x: any) => x.ID !== p.ID);
                            await persistSheets({ ...db, Piket: next }, 'Piket');
                          }}
                          className="text-slate-400 hover:text-rose-600 text-xs noprint cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                      <input
                        type="text"
                        defaultValue={p.Tugas}
                        placeholder="Tugas piket..."
                        onBlur={async e => {
                          if (e.target.value.trim() === p.Tugas) return;
                          const next = db.Piket.map((x: any) =>
                            x.ID === p.ID ? { ...x, Tugas: e.target.value.trim() } : x
                          );
                          await persistSheets({ ...db, Piket: next }, 'Piket');
                        }}
                        className="w-full px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg"
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 6. STRUKTUR ORGANISASI
  function openModalStruktur(id?: string) {
    const x = (db.Struktur || []).find((s: any) => s.ID === id) || {};
    let jab = x.Jabatan || '';
    let sid = x.SiswaID || '';
    let lvl = x.Tingkat || '3';

    setModalContent({
      title: id ? 'Edit Jabatan Kelas' : 'Tambah Jabatan Kelas',
      render: () => (
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-700">
            Nama Jabatan
            <input
              defaultValue={jab}
              onChange={e => (jab = e.target.value)}
              placeholder="mis. Ketua Kelas / Sekretaris"
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Siswa Terpilih
            <select
              defaultValue={sid}
              onChange={e => (sid = e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="">(Belum diisi)</option>
              {siswaK.map((s: any) => (
                <option key={s.ID} value={s.ID}>
                  {s.Nama}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Tingkat pada Bagan
            <select
              defaultValue={lvl}
              onChange={e => (lvl = e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              {[1, 2, 3].map(t => (
                <option key={t} value={String(t)}>
                  {LVL_STR[t][0]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-between pt-3">
            {id ? (
              <button
                onClick={async () => {
                  setModalContent(null);
                  const next = db.Struktur.filter((s: any) => s.ID !== id);
                  await persistSheets({ ...db, Struktur: next }, 'Struktur');
                }}
                className="px-3 py-2 text-xs font-semibold text-rose-600 bg-rose-50 rounded-lg"
              >
                Hapus Jabatan
              </button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setModalContent(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 text-slate-700 rounded-lg"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  if (!jab.trim()) return showToast('Nama jabatan wajib diisi');
                  const next = [...(db.Struktur || [])];
                  const idx = next.findIndex(s => s.ID === id);
                  if (idx >= 0) {
                    next[idx] = { ...next[idx], Jabatan: jab.trim(), SiswaID: sid, Tingkat: lvl };
                  } else {
                    next.push({
                      ID: uid(),
                      Kelas: K,
                      Jabatan: jab.trim(),
                      SiswaID: sid,
                      Tingkat: lvl
                    });
                  }
                  setModalContent(null);
                  await persistSheets({ ...db, Struktur: next }, 'Struktur');
                }}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )
    });
  }

  function renderStr() {
    const list = (db.Struktur || []).filter((s: any) => s.Kelas === K);
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-md noprint">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Struktur Organisasi Kelas</h1>
            <p className="text-xs text-purple-100 mt-1">
              Klik kotak jabatan untuk menetapkan pengurus. Siswa yang menjabat <strong>Sekretaris</strong> otomatis mendapat akses input absensi kelas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openModalStruktur()}
              className="px-3.5 py-2 text-xs font-semibold bg-white text-purple-700 hover:bg-purple-50 rounded-xl shadow-sm whitespace-nowrap cursor-pointer"
            >
              + Tambah Jabatan
            </button>
            <button
              onClick={async () => {
                const ada = new Set(list.map((s: any) => s.Jabatan.toLowerCase()));
                const baru = STRUKTUR_STD.filter(j => !ada.has(j[0].toLowerCase()));
                if (!baru.length) return showToast('Jabatan standar sudah lengkap');
                const next = [...(db.Struktur || [])];
                baru.forEach(j =>
                  next.push({
                    ID: uid(),
                    Kelas: K,
                    Jabatan: j[0],
                    SiswaID: '',
                    Tingkat: String(j[1])
                  })
                );
                await persistSheets({ ...db, Struktur: next }, 'Struktur');
              }}
              className="px-3 py-2 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl whitespace-nowrap cursor-pointer"
            >
              Isi Jabatan Standar
            </button>
          </div>
        </div>

        <div className="bg-white border border-purple-100 rounded-2xl p-8 text-center space-y-6 shadow-sm">
          <div>
            <div className="inline-block px-7 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-md shadow-indigo-500/20">
              <div className="text-[10px] uppercase tracking-wider text-indigo-100">Wali Kelas</div>
              <div className="text-sm font-bold mt-0.5">{waliKelasNama(K) || '—'}</div>
            </div>
          </div>

          {[1, 2, 3].map(lvl => {
            const items = list.filter((x: any) => String(x.Tingkat) === String(lvl));
            if (!items.length) return null;
            return (
              <div key={lvl} className="space-y-2">
                <div className="text-[11px] font-bold text-slate-500">{LVL_STR[lvl][0]}</div>
                <div className="flex flex-wrap justify-center gap-3">
                  {items.map((x: any) => (
                    <button
                      key={x.ID}
                      onClick={() => openModalStruktur(x.ID)}
                      style={{ borderColor: LVL_STR[lvl][1], backgroundColor: `${LVL_STR[lvl][1]}0D` }}
                      className="px-5 py-3 rounded-xl border-2 hover:brightness-95 text-center min-w-[165px] transition-all cursor-pointer shadow-2xs"
                    >
                      <div className="text-[11px] font-semibold" style={{ color: LVL_STR[lvl][1] }}>{x.Jabatan}</div>
                      <div className="text-sm font-bold text-slate-900 mt-0.5">
                        {x.SiswaID ? namaSiswa(x.SiswaID) : '—'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 7. JADWAL PELAJARAN
  function openModalJadwal(id?: string, defaultHari = 'Senin') {
    const x = (db.Jadwal || []).find((j: any) => j.ID === id) || {};
    let hari = x.Hari || defaultHari;
    let mulai = x.Mulai || '07:00';
    let selesai = x.Selesai || '08:30';
    let mapel = x.Mapel || '';
    let guru = x.Guru || '';
    let jenis = x.Jenis || 'Pelajaran';
    let pekan = x.Pekan || '';

    setModalContent({
      title: id ? 'Edit Jadwal Pelajaran' : 'Tambah Jadwal Pelajaran',
      render: () => (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-slate-700">
              Hari
              <select
                defaultValue={hari}
                onChange={e => (hari = e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                {HARI.map(h => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Jenis Kegiatan
              <select
                defaultValue={jenis}
                onChange={e => (jenis = e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option>Pelajaran</option>
                <option>Istirahat</option>
                <option>Kegiatan lain</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-slate-700">
              Jam Mulai
              <input
                type="time"
                defaultValue={mulai}
                onChange={e => (mulai = e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm tabular-nums"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Jam Selesai
              <input
                type="time"
                defaultValue={selesai}
                onChange={e => (selesai = e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm tabular-nums"
              />
            </label>
          </div>
          <label className="block text-xs font-semibold text-slate-700">
            Mata Pelajaran / Kegiatan
            <input
              defaultValue={mapel}
              onChange={e => (mapel = e.target.value)}
              list="dl_mapel_modal"
              placeholder="Pilih atau ketik mata pelajaran"
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <datalist id="dl_mapel_modal">
              {(db.Mapel || []).map((m: any) => (
                <option key={m.ID} value={m.Nama} />
              ))}
            </datalist>
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Nama Guru Pengampu
            <input
              defaultValue={guru}
              onChange={e => (guru = e.target.value)}
              placeholder="Nama guru..."
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </label>
          <div className="flex justify-between pt-3">
            {id ? (
              <button
                onClick={async () => {
                  setModalContent(null);
                  const next = db.Jadwal.filter((j: any) => j.ID !== id);
                  await persistSheets({ ...db, Jadwal: next }, 'Jadwal');
                }}
                className="px-3 py-2 text-xs font-semibold text-rose-600 bg-rose-50 rounded-lg"
              >
                Hapus
              </button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setModalContent(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 text-slate-700 rounded-lg"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  if (!mapel.trim()) return showToast('Mata pelajaran wajib diisi');
                  const next = [...(db.Jadwal || [])];
                  const row = {
                    ID: id || uid(),
                    Kelas: K,
                    Hari: hari,
                    Mulai: mulai,
                    Selesai: selesai,
                    Mapel: mapel.trim(),
                    Guru: guru.trim(),
                    Jenis: jenis,
                    Pekan: pekan
                  };
                  const idx = next.findIndex(j => j.ID === id);
                  if (idx >= 0) next[idx] = row;
                  else next.push(row);
                  const prevJadwal = db.Jadwal;
                  setModalContent(null);
                  const ok = await persistSheets({ ...db, Jadwal: next }, 'Jadwal');
                  if (!ok) setDb(d => ({ ...d, Jadwal: prevJadwal }));
                }}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )
    });
  }

  function renderJad() {
    const klsJadwal = (db.Jadwal || []).filter((x: any) => x.Kelas === K);
    const today = hariIni();

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-rose-500 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-md noprint">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Jadwal Pelajaran</h1>
            <p className="text-xs text-orange-50 mt-1">
              Validasi anti-bentrok otomatis: mencegah tumpang tindih jam di kelas yang sama maupun guru yang sama lintas kelas.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => openModalJadwal()}
              className="px-3.5 py-2 text-xs font-semibold bg-white text-orange-700 hover:bg-orange-50 rounded-xl shadow-sm whitespace-nowrap cursor-pointer"
            >
              + Tambah Jadwal
            </button>
            <button
              onClick={() => setImportModalMode('jadwal')}
              className="px-3 py-2 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" /> Impor Jadwal
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-2 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Cetak
            </button>
          </div>
        </div>

        <PrintHeader />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {HARI.slice(0, 5).map(h => {
            const ls = klsJadwal
              .filter((x: any) => x.Hari === h)
              .sort((a: any, b: any) => (a.Mulai || '').localeCompare(b.Mulai || ''));
            const dt = DAY_THEME[h] || DAY_THEME.Senin;
            return (
              <div
                key={h}
                className={`rounded-2xl border overflow-hidden shadow-xs ${dt.card} ${
                  h === today ? 'ring-2 ring-indigo-500' : ''
                }`}
              >
                <div className={`px-5 py-3 bg-gradient-to-r ${dt.header} text-white flex items-center justify-between`}>
                  <h3 className="text-sm font-bold">
                    {h} {h === today && <span className="text-xs text-amber-200">· Hari ini</span>}
                  </h3>
                  <button
                    onClick={() => openModalJadwal('', h)}
                    className="text-xs font-semibold text-white hover:underline noprint"
                  >
                    + Tambah
                  </button>
                </div>
                <div className="p-4 space-y-2">
                  {ls.length ? (
                    ls.map((x: any) => (
                      <div
                        key={x.ID}
                        onClick={() => openModalJadwal(x.ID)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          x.Jenis === 'Istirahat'
                            ? 'bg-amber-50 border-amber-200 hover:border-amber-400'
                            : 'bg-white border-slate-200/80 hover:border-indigo-400 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900">{x.Mapel}</span>
                          <span className={`font-mono tabular-nums text-[11px] font-bold ${dt.accent}`}>
                            {x.Mulai}–{x.Selesai}
                          </span>
                        </div>
                        {x.Guru && <div className="text-[11px] text-slate-500 mt-0.5">{x.Guru}</div>}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400">Belum ada jadwal</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 8. PERANGKAT AJAR (TP, Modul Ajar, Slide Pemantik)
  function renderAjar() {
    const classMapelList = getClassMapelList(K);
    const modListAllForClass = (db.Modul || []).filter((m: any) =>
      isModulForClass(m, K, classMapelList)
    );
    const activeAjarMapel =
      ajarMapelFilter !== 'ALL' &&
      classMapelList.some(s => s.toLowerCase() === ajarMapelFilter.toLowerCase())
        ? classMapelList.find(s => s.toLowerCase() === ajarMapelFilter.toLowerCase()) || 'ALL'
        : 'ALL';
    const modList =
      activeAjarMapel === 'ALL'
        ? modListAllForClass
        : modListAllForClass.filter(
            (m: any) => String(m.Mapel || '').trim().toLowerCase() === activeAjarMapel.toLowerCase()
          );

    const modIdSetAll = new Set(modListAllForClass.map((m: any) => m.ID));
    const modIdSetFiltered = new Set(modList.map((m: any) => m.ID));

    const tpToLegacyMod = new Map<string, string>();
    modListAllForClass.forEach((m: any) => {
      String(m.TPIDs || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .forEach(id => {
          if (!tpToLegacyMod.has(id)) tpToLegacyMod.set(id, m.ID);
        });
    });
    const tpList = (db.TP || [])
      .map((t: any) => ({
        ...t,
        ModulID: t.ModulID || tpToLegacyMod.get(t.ID) || ''
      }))
      .filter((t: any) => {
        if (activeAjarMapel !== 'ALL') {
          return t.ModulID && modIdSetFiltered.has(t.ModulID);
        }
        if (t.ModulID && modIdSetAll.has(t.ModulID)) return true;
        return isModulForClass(t, K, classMapelList);
      })
      .sort((a: any, b: any) => a.Kode.localeCompare(b.Kode, undefined, { numeric: true }));

    const pemList = (db.Pemantik || []).filter((p: any) => {
      if (activeAjarMapel !== 'ALL' && String(p.Mapel || '').trim().toLowerCase() !== activeAjarMapel.toLowerCase()) {
        return false;
      }
      if (p.ModulID && modIdSetAll.has(p.ModulID)) return true;
      return isModulForClass(p, K, classMapelList);
    });

    const matListAllForClass = (db.Materi || []).filter((m: any) =>
      isModulForClass(m, K, classMapelList)
    );
    const matList =
      activeAjarMapel === 'ALL'
        ? matListAllForClass
        : matListAllForClass.filter(
            (m: any) => String(m.Mapel || '').trim().toLowerCase() === activeAjarMapel.toLowerCase()
          );

    const levelKelasIni = ekstrakTingkatanKelas(kelasObj.Nama || '');
    const defaultTingkatScope = levelKelasIni ? `__TINGKAT__:${levelKelasIni}` : '__ALL__';

    const getModuleTps = (m: any) => tpList.filter((t: any) => t.ModulID === m.ID);
    const modMap = new Map<string, any>(modList.map((m: any) => [m.ID, m]));

    const syncModuleTpIds = (allTp: any[], allMod: any[]) =>
      allMod.map((m: any) => {
        const linkedIds = allTp
          .filter((t: any) => t.ModulID === m.ID)
          .map((t: any) => t.ID);
        return { ...m, TPIDs: linkedIds.join(',') };
      });

    const openModalTP = (editRow?: any, defaultModulId = '') => {
      const targetModId = editRow ? editRow.ModulID || '' : defaultModulId;
      const countInScope = targetModId
        ? tpList.filter((t: any) => t.ModulID === targetModId).length
        : tpList.length;
      const defaultKode = `TP ${countInScope + 1}`;
      setModalContent({
        title: editRow ? 'Edit Tujuan Pembelajaran & Lampiran' : 'Tambah Tujuan Pembelajaran',
        render: () => (
          <TpModalForm
            token={token}
            initial={editRow}
            defaultKode={defaultKode}
            defaultModulId={defaultModulId}
            modList={modList}
            kelasList={db.Kelas || []}
            currentKelasId={K}
            onClose={() => setModalContent(null)}
            showToast={showToast}
            onSave={async payload => {
              const newId = editRow ? editRow.ID : uid();
              const tpScope = payload.Kelas || editRow?.Kelas || defaultTingkatScope;
              const nextTp = editRow
                ? (db.TP || []).map((x: any) =>
                    x.ID === editRow.ID ? { ...x, ...payload, Kelas: tpScope } : x
                  )
                : [
                    ...(db.TP || []),
                    {
                      ID: newId,
                      ...payload,
                      Kelas: tpScope
                    }
                  ];
              const nextMod = syncModuleTpIds(nextTp, db.Modul || []);
              setModalContent(null);
              await persistSheets({ ...db, TP: nextTp, Modul: nextMod }, 'TP', 'Modul');
            }}
          />
        )
      });
    };

    const openModalModul = (editRow?: any) => {
      const prioritizedMapel = [
        ...classMapelList.map((name, i) => ({ ID: `cls_m_${i}`, Nama: name })),
        ...(db.Mapel || []).filter(
          (m: any) => !classMapelList.some(cn => cn.toLowerCase() === String(m.Nama || '').toLowerCase())
        )
      ];
      setModalContent({
        title: editRow ? 'Edit Modul Ajar & Pemisahan TP' : 'Tambah / Upload Modul Ajar & Pisahkan TP',
        wide: true,
        render: () => (
          <ModulModalForm
            token={token}
            initial={editRow}
            mapelList={prioritizedMapel}
            tpList={tpList}
            kelasList={db.Kelas || []}
            currentKelasId={K}
            onClose={() => setModalContent(null)}
            showToast={showToast}
            onSave={async payload => {
              const modulId = editRow?.ID || uid();
              const { moduleTps, Kelas: savedKelas, ...modulFields } = payload;
              const targetKelasScope = savedKelas || editRow?.Kelas || defaultTingkatScope;

              const keptExistingIds = new Set(
                moduleTps.map(mt => mt.existingId).filter(Boolean) as string[]
              );

              // Update existing TPs and clear ModulID if detached from this module
              const updatedTpList = (db.TP || []).map((t: any) => {
                const matched = moduleTps.find(mt => mt.existingId === t.ID);
                if (matched) {
                  return {
                    ...t,
                    Kelas: targetKelasScope,
                    ModulID: modulId,
                    Kode: matched.Kode,
                    Tujuan: matched.Tujuan,
                    Materi: matched.Materi,
                    Status: matched.Status
                  };
                }
                if (t.ModulID === modulId && !keptExistingIds.has(t.ID)) {
                  return { ...t, ModulID: '' };
                }
                return t;
              });

              // Create newly added/extracted TPs linked strictly to this module
              const newlyCreatedTps = moduleTps
                .filter(mt => !mt.existingId)
                .map(mt => ({
                  ID: uid(),
                  Kelas: targetKelasScope,
                  ModulID: modulId,
                  Kode: mt.Kode,
                  Tujuan: mt.Tujuan,
                  Materi: mt.Materi,
                  Status: mt.Status || 'Belum',
                  FileID: '',
                  NamaFile: ''
                }));

              const nextTp = [...updatedTpList, ...newlyCreatedTps];
              const linkedTpIds = [
                ...moduleTps.map(mt => mt.existingId).filter(Boolean),
                ...newlyCreatedTps.map(t => t.ID)
              ] as string[];

              const nextModRaw = editRow
                ? (db.Modul || []).map((x: any) =>
                    x.ID === modulId
                      ? { ...x, Kelas: targetKelasScope, ...modulFields, TPIDs: linkedTpIds.join(',') }
                      : x
                  )
                : [
                    ...(db.Modul || []),
                    {
                      ID: modulId,
                      Kelas: targetKelasScope,
                      ...modulFields,
                      TPIDs: linkedTpIds.join(',')
                    }
                  ];

              const nextMod = syncModuleTpIds(nextTp, nextModRaw);
              setModalContent(null);
              await persistSheets({ ...db, Modul: nextMod, TP: nextTp }, 'Modul', 'TP');
            }}
          />
        )
      });
    };

    const getModulResourceLinks = (m: any): SumberLinkItem[] => {
      if (!m) return [];
      const primary = parseSumberLinks(m.LinkSumber);
      const fromText = extractUrlsFromText(`${m.Media || ''} ${m.Pembuka || ''} ${m.Catatan || ''}`);
      const seen = new Set(primary.map(x => x.url.toLowerCase()));
      const merged = [...primary];
      fromText.forEach(item => {
        if (!seen.has(item.url.toLowerCase())) {
          seen.add(item.url.toLowerCase());
          merged.push(item);
        }
      });
      return merged;
    };

    const mergeResourceLinks = (...lists: SumberLinkItem[][]): SumberLinkItem[] => {
      const seen = new Set<string>();
      const out: SumberLinkItem[] = [];
      lists.forEach(list => {
        (list || []).forEach(it => {
          const k = String(it.url || '').trim().toLowerCase();
          if (!k || seen.has(k)) return;
          seen.add(k);
          out.push(it);
        });
      });
      return out;
    };

    const openModalPemantik = (editRow?: any, defaultModulId = '') => {
      setModalContent({
        title: editRow ? 'Edit Slide Pemantik & Link Sumber' : 'Buat Slide Pemantik Baru',
        wide: true,
        render: () => (
          <PemantikModalForm
            initial={editRow}
            defaultModulId={defaultModulId}
            modList={modList}
            mapelList={db.Mapel || []}
            tpList={tpList}
            kelasList={db.Kelas || []}
            currentKelasId={K}
            onClose={() => setModalContent(null)}
            showToast={showToast}
            onSave={async payload => {
              const pemId = editRow?.ID || uid();
              const { Kelas: savedKelas, ...restPayload } = payload;
              const targetKelasScope = savedKelas || editRow?.Kelas || defaultTingkatScope;
              const nextPem = editRow
                ? (db.Pemantik || []).map((x: any) =>
                    x.ID === pemId ? { ...x, Kelas: targetKelasScope, ...restPayload } : x
                  )
                : [
                    ...(db.Pemantik || []),
                    {
                      ID: pemId,
                      Kelas: targetKelasScope,
                      ...restPayload
                    }
                  ];
              setModalContent(null);
              await persistSheets({ ...db, Pemantik: nextPem }, 'Pemantik');
              showToast('Slide Pemantik & Link Sumber berhasil disimpan');
            }}
          />
        )
      });
    };

    const openModalMateri = (editRow?: any) => {
      const prioritizedMapel = [
        ...classMapelList.map((name, i) => ({ ID: `cls_m_${i}`, Nama: name })),
        ...(db.Mapel || []).filter(
          (m: any) => !classMapelList.some(cn => cn.toLowerCase() === String(m.Nama || '').toLowerCase())
        )
      ];
      setModalContent({
        title: editRow ? 'Edit Materi Pelajaran' : 'Tambah / Upload Materi Pelajaran',
        wide: true,
        render: () => (
          <MateriModalForm
            token={token}
            initial={editRow}
            mapelList={prioritizedMapel}
            kelasList={db.Kelas || []}
            currentKelasId={K}
            defaultPengunggah={peran === 'admin' ? S.guru || 'Admin / Guru' : db.namaPengguna || S.guru || 'Guru Mata Pelajaran'}
            onClose={() => setModalContent(null)}
            showToast={showToast}
            onSave={async payload => {
              const matId = editRow?.ID || uid();
              const nextMat = editRow
                ? (db.Materi || []).map((x: any) =>
                    x.ID === matId ? { ...x, ...payload } : x
                  )
                : [
                    ...(db.Materi || []),
                    {
                      ID: matId,
                      ...payload
                    }
                  ];
              setModalContent(null);
              await persistSheets({ ...db, Materi: nextMat }, 'Materi');
              showToast('Materi pelajaran berhasil disimpan & tersedia di Portal Siswa');
            }}
          />
        )
      });
    };

    const openPreviewMateri = (m: any) => {
      const matLinks = parseSumberLinks(m.LinkSumber);
      const previewUrl = m.FileID ? getAjarFilePreviewUrl(m.FileID) : '';
      const lowerName = String(m.NamaFile || '').toLowerCase();
      const isImg = /\.(png|jpe?g|webp|gif|svg)$/i.test(lowerName);
      const isPdf = /\.pdf$/i.test(lowerName);
      const handleDownload = () => {
        if (m.FileID) {
          downloadAjarFile(m.FileID, m.NamaFile);
        } else {
          const textBody = [
            `MATERI PELAJARAN: ${m.Judul}`,
            `Mata Pelajaran: ${m.Mapel || 'Umum'}`,
            m.Bab ? `Bab/Topik: ${m.Bab}` : '',
            m.Pengunggah ? `Guru: ${m.Pengunggah}` : '',
            '',
            m.Ringkasan ? `RINGKASAN:\n${m.Ringkasan}\n` : '',
            m.IsiMateri ? `ISI MATERI:\n${m.IsiMateri}\n` : '',
            matLinks.length > 0
              ? `SUMBER BELAJAR:\n${matLinks.map(l => `- ${l.label}: ${l.url}`).join('\n')}`
              : ''
          ]
            .filter(Boolean)
            .join('\n');
          downloadTextAsFile(`${m.Judul || 'materi-pelajaran'}.txt`, textBody);
        }
      };

      setModalContent({
        title: `${m.Mapel || 'Umum'} · ${m.Judul}`,
        wide: true,
        render: () => (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                {m.Bab && (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-semibold">
                    {m.Bab}
                  </span>
                )}
                {m.Pengunggah && <span>Oleh {m.Pengunggah}</span>}
                {m.TanggalUpload && <span>· {tglIndo(m.TanggalUpload) || m.TanggalUpload}</span>}
              </div>
              <button
                type="button"
                onClick={handleDownload}
                className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{m.FileID ? `Unduh ${m.NamaFile || 'Berkas'}` : 'Unduh Teks (.txt)'}</span>
              </button>
            </div>

            {m.Ringkasan && (
              <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100 text-xs text-slate-700">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 mb-1">Ringkasan</div>
                <p className="whitespace-pre-line leading-relaxed">{m.Ringkasan}</p>
              </div>
            )}

            {m.IsiMateri && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 max-h-72 overflow-y-auto">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Penjelasan Materi</div>
                <p className="whitespace-pre-line leading-relaxed">{m.IsiMateri}</p>
              </div>
            )}

            {previewUrl && (isImg || isPdf) && (
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 text-[11px] font-semibold text-slate-700 flex items-center justify-between">
                  <span className="truncate">Pratinjau Lampiran: {m.NamaFile}</span>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-700 hover:underline inline-flex items-center gap-1 shrink-0"
                  >
                    <ExternalLink className="w-3 h-3" /> Buka Tab Baru
                  </a>
                </div>
                {isImg ? (
                  <img src={previewUrl} alt={m.NamaFile} className="max-h-96 mx-auto object-contain p-2" />
                ) : (
                  <iframe src={previewUrl} title={m.NamaFile} className="w-full h-96 border-0 bg-white" />
                )}
              </div>
            )}

            {matLinks.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Link Sumber Belajar ({matLinks.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {matLinks.map((lk, i) => (
                    <a
                      key={i}
                      href={lk.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{lk.label}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      });
    };

    if (modView) {
      const m = modList.find((x: any) => x.ID === modView);
      if (m) {
        const tps = getModuleTps(m);
        const modLinks = getModulResourceLinks(m);
        return (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2 noprint">
              <button
                onClick={() => setModView('')}
                className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg cursor-pointer"
              >
                ← Kembali
              </button>
              <button
                onClick={() => openModalModul(m)}
                className="px-3 py-1.5 text-xs font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit Modul & TP
              </button>
              {m.FileID && (
                <button
                  onClick={() => downloadAjarFile(m.FileID, m.NamaFile)}
                  className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Unduh Berkas ({m.NamaFile || 'Modul'})
                </button>
              )}
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Cetak Modul Ajar
              </button>
            </div>
            <PrintHeader />
            <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Modul Ajar: {m.Judul}</h1>
                <p className="text-xs text-slate-500 mt-1">
                  {m.Mapel} · Alokasi Waktu: {m.Alokasi || '-'} · Kelas {kelasObj.Nama}
                </p>
              </div>
              {m.FileID && (
                <div className="p-3.5 rounded-xl bg-fuchsia-50 border border-fuchsia-200 flex flex-wrap items-center justify-between gap-3 noprint">
                  <div className="flex items-center gap-2 text-xs text-fuchsia-950 font-semibold min-w-0">
                    <Paperclip className="w-4 h-4 text-fuchsia-600 shrink-0" />
                    <span className="truncate">Lampiran Berkas Modul: {m.NamaFile || 'Dokumen Modul Ajar'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadAjarFile(m.FileID, m.NamaFile)}
                    className="px-3 py-1.5 text-xs font-semibold bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-lg inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" /> Unduh File
                  </button>
                </div>
              )}
              {m.PertanyaanPemantik && (
                <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                    Pertanyaan Pemantik
                  </h3>
                  <p className="text-xs text-slate-800 whitespace-pre-line leading-relaxed">
                    {m.PertanyaanPemantik}
                  </p>
                </div>
              )}
              {modLinks.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Link Sumber Pelajaran ({modLinks.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {modLinks.map((lk, idx) => (
                      <a
                        key={idx}
                        href={lk.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg"
                      >
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        <span>{lk.label}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {tps.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Tujuan Pembelajaran Khusus Modul Ini ({tps.length})
                  </h3>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-slate-800">
                    {tps.map((t: any) => (
                      <li key={t.ID}>
                        <strong>{t.Kode}:</strong> {t.Tujuan}
                        {t.Materi ? <span className="text-slate-500"> ({t.Materi})</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {[
                ['Kegiatan Pembuka', m.Pembuka],
                ['Kegiatan Inti', m.Inti],
                ['Kegiatan Penutup', m.Penutup],
                ['Asesmen', m.Asesmen],
                ['Media & Sumber Belajar', m.Media],
                ['Catatan & Refleksi Guru', m.Catatan]
              ].map(([label, val]) =>
                val ? (
                  <div key={label}>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                      {label}
                    </h3>
                    <p className="text-xs text-slate-800 whitespace-pre-line leading-relaxed">
                      {val}
                    </p>
                  </div>
                ) : null
              )}
            </div>
          </div>
        );
      }
    }

    const renderTpTableRows = (rows: any[], showAssignHint = false) =>
      rows.map((t: any) => (
        <tr key={t.ID}>
          <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">{t.Kode}</td>
          <td className="py-2.5 px-3 text-slate-800">
            <div>{t.Tujuan}</div>
            {showAssignHint && modList.length > 0 && (
              <div className="mt-1">
                <select
                  value={t.ModulID || ''}
                  onChange={async e => {
                    const nextModId = e.target.value;
                    const nextTp = (db.TP || []).map((x: any) =>
                      x.ID === t.ID ? { ...x, ModulID: nextModId } : x
                    );
                    const nextMod = syncModuleTpIds(nextTp, db.Modul || []);
                    await persistSheets({ ...db, TP: nextTp, Modul: nextMod }, 'TP', 'Modul');
                  }}
                  className="px-2 py-0.5 border border-fuchsia-200 bg-fuchsia-50/50 text-fuchsia-800 rounded text-[11px] font-medium cursor-pointer"
                >
                  <option value="">Pindahkan ke Modul Ajar…</option>
                  {modList.map((m: any) => (
                    <option key={m.ID} value={m.ID}>
                      Masukkan ke: {m.Judul}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </td>
          <td className="py-2.5 px-3 text-slate-600">{t.Materi || '-'}</td>
          <td className="py-2.5 px-3">
            {t.FileID ? (
              <button
                type="button"
                onClick={() => downloadAjarFile(t.FileID, t.NamaFile)}
                title={`Unduh ${t.NamaFile || 'lampiran TP'}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg max-w-[190px] cursor-pointer"
              >
                <Download className="w-3 h-3 shrink-0" />
                <span className="truncate">{t.NamaFile || 'Unduh File'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openModalTP(t)}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-pink-700 bg-pink-50 hover:bg-pink-100 border border-pink-200 rounded-lg cursor-pointer"
              >
                <Upload className="w-3 h-3" /> Unggah File
              </button>
            )}
          </td>
          <td className="py-2.5 px-3">
            <select
              value={t.Status}
              onChange={async e => {
                const next = db.TP.map((x: any) =>
                  x.ID === t.ID ? { ...x, Status: e.target.value } : x
                );
                await persistSheets({ ...db, TP: next }, 'TP');
              }}
              className="px-2.5 py-1 border border-slate-200 rounded-lg text-xs font-medium bg-slate-50"
            >
              {Object.keys(STATUS_TP).map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </td>
          <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-2">
            <button
              onClick={() => openModalTP(t)}
              className="text-indigo-600 hover:underline font-medium cursor-pointer"
            >
              Edit
            </button>
            <button
              onClick={async () => {
                const nextTp = (db.TP || []).filter((x: any) => x.ID !== t.ID);
                const nextMod = syncModuleTpIds(nextTp, db.Modul || []);
                await persistSheets({ ...db, TP: nextTp, Modul: nextMod }, 'TP', 'Modul');
              }}
              className="text-rose-600 hover:underline font-medium cursor-pointer"
            >
              Hapus
            </button>
          </td>
        </tr>
      ));

    const unassignedTps = tpList.filter((t: any) => !t.ModulID || !modMap.has(t.ModulID));
    const modulesToDisplay =
      tpFilterModul === 'all'
        ? modList
        : tpFilterModul === '__unassigned__'
          ? []
          : modList.filter((m: any) => m.ID === tpFilterModul);
    const showUnassignedGroup =
      (tpFilterModul === 'all' || tpFilterModul === '__unassigned__') && unassignedTps.length > 0;

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-600 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-md">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Perangkat Ajar</h1>
            <p className="text-xs text-pink-50 mt-1">
              Otomatis tersesuaikan untuk <strong>{classMapelList.length} mata pelajaran</strong> di kelas{' '}
              <strong>{kelasObj.Nama || ''}</strong> — 1x upload modul langsung tersedia di seluruh kelas mapel terkait.
            </p>
          </div>
          <div className="flex flex-wrap p-1 bg-white/20 backdrop-blur-sm rounded-xl gap-0.5">
            {[
              ['mat', 'Materi Pelajaran'],
              ['tp', 'Tujuan Pembelajaran'],
              ['mod', 'Modul Ajar / RPP'],
              ['pem', 'Slide Pemantik']
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setAjarSub(id as any)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  ajarSub === id
                    ? 'bg-white text-fuchsia-700 shadow-sm'
                    : 'text-white/90 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Class Subject Filter Strip for Perangkat Ajar */}
        {classMapelList.length > 0 && (
          <div className="bg-white border border-fuchsia-100 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 mr-1">Filter Mapel Kelas:</span>
              <button
                type="button"
                onClick={() => setAjarMapelFilter('ALL')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border cursor-pointer transition-colors ${
                  activeAjarMapel === 'ALL'
                    ? 'bg-fuchsia-600 text-white border-fuchsia-600'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-fuchsia-50'
                }`}
              >
                Semua ({ajarSub === 'mat' ? matListAllForClass.length : modListAllForClass.length})
              </button>
              {classMapelList.map(subj => {
                const targetArr = ajarSub === 'mat' ? matListAllForClass : modListAllForClass;
                const count = targetArr.filter(
                  (m: any) => String(m.Mapel || '').trim().toLowerCase() === subj.toLowerCase()
                ).length;
                const active = activeAjarMapel.toLowerCase() === subj.toLowerCase();
                return (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => setAjarMapelFilter(active ? 'ALL' : subj)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg border cursor-pointer transition-colors ${
                      active
                        ? 'bg-fuchsia-600 text-white border-fuchsia-600'
                        : 'bg-white text-slate-700 border-fuchsia-200 hover:bg-fuchsia-50'
                    }`}
                  >
                    {subj} <span className="opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {ajarSub === 'mat' && (
          <div className="space-y-4">
            <div className="bg-white border border-emerald-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
              <div className="text-xs text-slate-600">
                <strong className="text-slate-900">{matList.length}</strong> Materi Pelajaran tersedia untuk kelas{' '}
                <strong>{kelasObj.Nama || '-'}</strong> · Materi di sini tampil untuk <strong>dilihat dan diunduh siswa di Portal Siswa</strong> (terpisah dari RPP/Modul guru).
              </div>
              <button
                type="button"
                onClick={() => openModalMateri()}
                className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" /> + Tambah / Upload Materi Pelajaran
              </button>
            </div>

            {matList.length === 0 ? (
              <div className="bg-white border border-dashed border-emerald-200 rounded-2xl p-10 text-center space-y-3">
                <p className="text-sm font-semibold text-slate-700">Belum ada Materi Pelajaran di kelas ini</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Unggah file materi (PDF, PPT, Word, Gambar) atau tulis ringkasan materi pelajaran agar siswa dapat langsung membaca dan mengunduhnya dari Portal Siswa.
                </p>
                <button
                  type="button"
                  onClick={() => openModalMateri()}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Materi Pelajaran
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {matList.map((m: any) => {
                  const matLinks = parseSumberLinks(m.LinkSumber);
                  const isShared = !m.Kelas || m.Kelas === '__ALL__' || m.Kelas === 'all' || String(m.Kelas).includes(',');
                  return (
                    <div
                      key={m.ID}
                      className="bg-white border border-emerald-200/80 rounded-xl p-5 flex flex-col justify-between gap-4 shadow-2xs"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded">
                                {m.Mapel || 'Umum'}
                              </span>
                              {m.Bab && <span className="text-[11px] font-medium text-slate-500">{m.Bab}</span>}
                            </div>
                            <h3 className="text-base font-bold text-slate-900 mt-1">{m.Judul}</h3>
                          </div>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded border shrink-0 ${
                              isShared || String(m.Kelas || '').startsWith('__TINGKAT__:')
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                          >
                            {formatLabelCakupanKelas(m.Kelas)}
                          </span>
                        </div>

                        {m.Ringkasan && (
                          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{m.Ringkasan}</p>
                        )}
                        {!m.Ringkasan && m.IsiMateri && (
                          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{m.IsiMateri}</p>
                        )}

                        {m.FileID && (
                          <div>
                            <button
                              type="button"
                              onClick={() => downloadAjarFile(m.FileID, m.NamaFile)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg max-w-full cursor-pointer"
                            >
                              <Paperclip className="w-3 h-3 shrink-0" />
                              <span className="truncate">{m.NamaFile || 'Berkas Materi'}</span>
                              {m.UkuranFile && <span className="opacity-70 shrink-0">({m.UkuranFile})</span>}
                            </button>
                          </div>
                        )}

                        {matLinks.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {matLinks.map((lk, idx) => (
                              <a
                                key={idx}
                                href={lk.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded"
                              >
                                <ExternalLink className="w-3 h-3 shrink-0" />
                                <span className="truncate max-w-[160px]">{lk.label}</span>
                              </a>
                            ))}
                          </div>
                        )}

                        <div className="text-[11px] text-slate-400">
                          {m.Pengunggah ? `Oleh ${m.Pengunggah}` : ''}
                          {m.TanggalUpload ? `${m.Pengunggah ? ' · ' : ''}${tglIndo(m.TanggalUpload) || m.TanggalUpload}` : ''}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => openPreviewMateri(m)}
                          className="px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> Lihat
                        </button>
                        {m.FileID && (
                          <button
                            type="button"
                            onClick={() => downloadAjarFile(m.FileID, m.NamaFile)}
                            className="px-3 py-1.5 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" /> Unduh
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openModalMateri(m)}
                          className="px-3 py-1.5 text-xs font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await askConfirm(`Hapus materi pelajaran "${m.Judul}"?`);
                            if (!ok) return;
                            const nextMat = (db.Materi || []).filter((x: any) => x.ID !== m.ID);
                            await persistSheets({ ...db, Materi: nextMat }, 'Materi');
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg ml-auto cursor-pointer"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {ajarSub === 'tp' && (
          <div className="space-y-4">
            <div className="bg-white border border-pink-100 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-slate-600 tabular-nums">
                  <strong className="text-slate-900">
                    {tpList.filter((t: any) => t.Status === 'Tercapai').length}
                  </strong>{' '}
                  dari <strong className="text-slate-900">{tpList.length}</strong> TP Tercapai · Dipisah ke{' '}
                  <strong className="text-fuchsia-700">{modList.length}</strong> Modul
                </span>
                <select
                  value={tpFilterModul}
                  onChange={e => setTpFilterModul(e.target.value)}
                  className="px-3 py-1.5 border border-fuchsia-200 bg-fuchsia-50/40 rounded-lg text-xs font-semibold text-fuchsia-950"
                >
                  <option value="all">Semua Modul Ajar ({tpList.length} TP)</option>
                  {modList.map((m: any) => (
                    <option key={m.ID} value={m.ID}>
                      Modul: {m.Judul} ({getModuleTps(m).length} TP)
                    </option>
                  ))}
                  {unassignedTps.length > 0 && (
                    <option value="__unassigned__">TP Umum / Tanpa Modul ({unassignedTps.length})</option>
                  )}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setImportModalMode('tp')}
                  className="px-3 py-1.5 text-xs font-semibold bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" /> Impor CSV TP
                </button>
                <button
                  onClick={() =>
                    openModalTP(
                      undefined,
                      tpFilterModul !== 'all' && tpFilterModul !== '__unassigned__' ? tpFilterModul : ''
                    )
                  }
                  className="px-3.5 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah TP / Upload File
                </button>
              </div>
            </div>

            {tpList.length === 0 && modList.length === 0 ? (
              <div className="bg-white border border-pink-100 rounded-2xl p-10 text-center text-xs text-slate-400 shadow-sm">
                Belum ada Tujuan Pembelajaran ataupun Modul Ajar. Unggah Modul Ajar di tab <strong>Modul Ajar / RPP</strong> atau klik <strong>Tambah TP / Upload File</strong> untuk memulai.
              </div>
            ) : (
              <div className="space-y-4">
                {modulesToDisplay.map((m: any) => {
                  const modTps = getModuleTps(m);
                  const tercapaiCount = modTps.filter((t: any) => t.Status === 'Tercapai').length;
                  return (
                    <div
                      key={m.ID}
                      className="bg-white border border-fuchsia-200 rounded-2xl overflow-hidden shadow-sm"
                    >
                      <div className="px-5 py-3.5 bg-gradient-to-r from-fuchsia-50 via-pink-50/70 to-white border-b border-fuchsia-100 flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-fuchsia-600 text-white rounded-md">
                              Modul Ajar
                            </span>
                            <h3 className="text-sm font-bold text-slate-900 truncate">{m.Judul}</h3>
                            <span className="text-[11px] font-semibold text-fuchsia-700 tabular-nums">
                              ({tercapaiCount}/{modTps.length} TP Tercapai)
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                            <span>{m.Mapel || 'Umum'}</span>
                            {m.Alokasi && <span>· {m.Alokasi}</span>}
                            {m.FileID && (
                              <button
                                type="button"
                                onClick={() => downloadAjarFile(m.FileID, m.NamaFile)}
                                className="inline-flex items-center gap-1 text-sky-700 hover:underline font-semibold cursor-pointer"
                              >
                                · <Paperclip className="w-3 h-3" /> {m.NamaFile || 'File Modul'}
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openModalModul(m)}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200 rounded-lg cursor-pointer"
                          >
                            Edit Modul
                          </button>
                          <button
                            type="button"
                            onClick={() => openModalTP(undefined, m.ID)}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-lg inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" /> Tambah TP Modul Ini
                          </button>
                        </div>
                      </div>

                      {modTps.length === 0 ? (
                        <div className="p-5 text-center text-xs text-slate-400">
                          Belum ada TP terpisah untuk modul ini. Klik <strong>+ Tambah TP Modul Ini</strong> atau buka <strong>Edit Modul</strong> untuk memisahkan TP dari file modul.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead className="border-b border-slate-200 text-slate-500 bg-slate-50/60">
                              <tr>
                                <th className="py-2 px-3 w-24">Kode</th>
                                <th className="py-2 px-3">Tujuan Pembelajaran</th>
                                <th className="py-2 px-3">Materi Pokok</th>
                                <th className="py-2 px-3">Berkas Lampiran</th>
                                <th className="py-2 px-3 w-36">Status</th>
                                <th className="py-2 px-3 text-right">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {renderTpTableRows(modTps, false)}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}

                {showUnassignedGroup && (
                  <div className="bg-white border border-pink-100 rounded-2xl overflow-hidden shadow-sm">
                    <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">
                          Tujuan Pembelajaran Umum / Belum Masuk Modul ({unassignedTps.length})
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Anda dapat memindahkan TP ini ke salah satu Modul Ajar menggunakan pemilih di bawah setiap TP.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openModalTP(undefined, '')}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-slate-900 text-white rounded-lg inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> Tambah TP Umum
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="border-b border-slate-200 text-slate-500 bg-slate-50/40">
                          <tr>
                            <th className="py-2 px-3 w-24">Kode</th>
                            <th className="py-2 px-3">Tujuan Pembelajaran</th>
                            <th className="py-2 px-3">Materi Pokok</th>
                            <th className="py-2 px-3">Berkas Lampiran</th>
                            <th className="py-2 px-3 w-36">Status</th>
                            <th className="py-2 px-3 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {renderTpTableRows(unassignedTps, true)}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {modulesToDisplay.length === 0 && !showUnassignedGroup && (
                  <div className="bg-white border border-pink-100 rounded-2xl p-8 text-center text-xs text-slate-400">
                    Tidak ada Tujuan Pembelajaran pada filter modul yang dipilih.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {ajarSub === 'mod' && (
          <div className="space-y-4">
            <div className="bg-white border border-fuchsia-100 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
              <div className="text-xs text-slate-600">
                <strong className="text-slate-900">{modList.length}</strong> Modul Ajar / RPP tersimpan untuk kelas{' '}
                <strong>{kelasObj.Nama || '-'}</strong> · Setiap modul menyimpan daftar TP terpisah.
              </div>
              <button
                onClick={() => openModalModul()}
                className="px-3.5 py-2 text-xs font-semibold bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-xl inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" /> + Tambah / Upload Modul Ajar
              </button>
            </div>

            {modList.length === 0 ? (
              <div className="bg-white border border-dashed border-fuchsia-200 rounded-2xl p-10 text-center space-y-3">
                <p className="text-sm font-semibold text-slate-700">Belum ada Modul Ajar / RPP di kelas ini</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Anda dapat mengunggah file Modul Ajar (PDF, Word, PowerPoint, gambar) sekaligus memisahkan Tujuan Pembelajaran (TP) per modul di sini.
                </p>
                <button
                  onClick={() => openModalModul()}
                  className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Buat atau Upload Modul Ajar
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {modList.map((m: any) => {
                  const modTps = getModuleTps(m);
                  const isShared =
                    !m.Kelas ||
                    m.Kelas === '__ALL__' ||
                    m.Kelas === 'all' ||
                    String(m.Kelas).startsWith('__TINGKAT__:') ||
                    String(m.Kelas).includes(',');
                  return (
                    <div
                      key={m.ID}
                      className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4 shadow-2xs"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-base font-bold text-slate-900">{m.Judul}</h3>
                            <div className="text-xs text-slate-500">
                              {m.Mapel} · {m.Alokasi || '-'}
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded border shrink-0 ${
                              isShared
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                          >
                            {formatLabelCakupanKelas(m.Kelas)}
                          </span>
                        </div>
                        {m.FileID && (
                          <div>
                            <button
                              type="button"
                              onClick={() => downloadAjarFile(m.FileID, m.NamaFile)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold bg-fuchsia-50 hover:bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200 rounded-lg max-w-full cursor-pointer"
                            >
                              <Paperclip className="w-3 h-3 shrink-0" />
                              <span className="truncate">{m.NamaFile || 'Unduh Berkas Modul'}</span>
                            </button>
                          </div>
                        )}

                        {/* Separated TP Section Inside Each Uploaded Module Card */}
                        <div className="p-3 rounded-xl bg-pink-50/50 border border-pink-100 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-pink-950 uppercase tracking-wide">
                              TP Modul Ini ({modTps.length})
                            </span>
                            <button
                              type="button"
                              onClick={() => openModalTP(undefined, m.ID)}
                              className="px-2 py-0.5 text-[11px] font-semibold bg-white hover:bg-pink-100 text-pink-700 border border-pink-200 rounded-md inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" /> Tambah TP
                            </button>
                          </div>
                          {modTps.length === 0 ? (
                            <p className="text-[11px] text-slate-500">
                              Belum ada TP terpisah di modul ini. Klik <strong>+ Tambah TP</strong> atau edit modul untuk memisahkan TP.
                            </p>
                          ) : (
                            <ul className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                              {modTps.map((t: any) => (
                                <li
                                  key={t.ID}
                                  className="text-xs bg-white border border-pink-100 rounded-lg px-2.5 py-1.5 flex items-start justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <span className="font-bold text-pink-800 mr-1.5">{t.Kode}:</span>
                                    <span className="text-slate-700">{t.Tujuan}</span>
                                  </div>
                                  <span
                                    className={`shrink-0 px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                                      t.Status === 'Tercapai'
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {t.Status || 'Belum'}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {m.Inti && <p className="text-xs text-slate-600 line-clamp-2">{m.Inti}</p>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => setModView(m.ID)}
                          className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg cursor-pointer"
                        >
                          Lihat & Cetak
                        </button>
                        <button
                          onClick={() => openModalModul(m)}
                          className="px-3 py-1.5 text-xs font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" /> Edit & TP
                        </button>
                        <button
                          onClick={() => {
                            setTpFilterModul(m.ID);
                            setAjarSub('tp');
                          }}
                          className="px-2.5 py-1.5 text-xs font-semibold bg-pink-50 hover:bg-pink-100 text-pink-700 rounded-lg cursor-pointer"
                        >
                          Kelola TP ({modTps.length})
                        </button>
                        <button
                          onClick={async () => {
                            const nextMod = (db.Modul || []).filter((x: any) => x.ID !== m.ID);
                            const nextTp = (db.TP || []).map((t: any) =>
                              t.ModulID === m.ID ? { ...t, ModulID: '' } : t
                            );
                            await persistSheets({ ...db, Modul: nextMod, TP: nextTp }, 'Modul', 'TP');
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg ml-auto cursor-pointer"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {ajarSub === 'pem' && (
          <div className="space-y-5">
            {/* Top Action Bar */}
            <div className="bg-white border border-indigo-100 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
              <div className="text-xs text-slate-600">
                <strong className="text-slate-900">{pemList.length}</strong> Slide Pemantik tersimpan ·{' '}
                <strong className="text-indigo-700">{modList.length}</strong> Modul Perangkat Ajar tersedia sebagai sumber pertanyaan pemantik & tautan belajar.
              </div>
              <button
                type="button"
                onClick={() => openModalPemantik()}
                className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Buat Slide Pemantik & Link Sumber
              </button>
            </div>

            {/* Pertanyaan Pemantik & Link Sumber Pelajaran dari Perangkat Ajar */}
            <div className="bg-gradient-to-br from-indigo-50/70 via-white to-sky-50/60 border border-indigo-200 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-indigo-950 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    Pertanyaan Pemantik & Sumber Pelajaran dari Perangkat Ajar
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Menarik otomatis pertanyaan pemantik, materi inti, dan link sumber pelajaran dari Modul Ajar kelas {kelasObj.Nama || ''}.
                  </p>
                </div>
              </div>

              {modList.length === 0 ? (
                <div className="p-5 rounded-xl border border-dashed border-indigo-200 bg-white text-center text-xs text-slate-500">
                  Belum ada Modul Ajar di Perangkat Ajar kelas ini. Tambahkan modul pada tab <strong>Modul Ajar / RPP</strong> untuk menampilkan pertanyaan pemantik otomatis di sini.
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                  {modList.map((m: any) => {
                    const modLinks = getModulResourceLinks(m);
                    const modTps = getModuleTps(m);
                    const linkedPem = pemList.find((px: any) => px.ModulID === m.ID);
                    const effectiveQuestion =
                      String(m.PertanyaanPemantik || '').trim() ||
                      String(linkedPem?.Pertanyaan || '').trim();
                    const apersepsiLine = String(m.Pembuka || '')
                      .split('\n')
                      .find(l => /apersepsi|\?/i.test(l));

                    const openModulPresentation = () => {
                      const combinedLinks = mergeResourceLinks(
                        modLinks,
                        linkedPem ? parseSumberLinks(linkedPem.SumberPelajaran, linkedPem.Tautan) : []
                      );
                      const slidesList: {
                        badge?: string;
                        title: string;
                        body: string;
                        links?: SumberLinkItem[];
                        fileId?: string;
                        fileName?: string;
                      }[] = [
                        {
                          badge: `${m.Mapel || 'Umum'} · Perangkat Ajar`,
                          title: m.Judul,
                          body: [m.Alokasi ? `Alokasi: ${m.Alokasi}` : '', m.Media ? `Media: ${m.Media}` : '']
                            .filter(Boolean)
                            .join('\n'),
                          links: combinedLinks,
                          fileId: m.FileID || undefined,
                          fileName: m.NamaFile || undefined
                        }
                      ];
                      if (effectiveQuestion || apersepsiLine) {
                        slidesList.push({
                          badge: 'Pertanyaan Pemantik · Perangkat Ajar',
                          title: 'Pertanyaan Pemantik',
                          body: effectiveQuestion || apersepsiLine || '',
                          links: combinedLinks
                        });
                      }
                      if (modTps.length > 0) {
                        slidesList.push({
                          badge: 'Tujuan Pembelajaran',
                          title: 'Target Pembelajaran Hari Ini',
                          body: modTps.map((t: any) => `• ${t.Kode}: ${t.Tujuan}`).join('\n'),
                          links: combinedLinks
                        });
                      }
                      if (m.Inti) {
                        slidesList.push({
                          badge: 'Kegiatan Inti',
                          title: 'Eksplorasi & Aktivitas Belajar',
                          body: m.Inti,
                          links: combinedLinks,
                          fileId: m.FileID || undefined,
                          fileName: m.NamaFile || undefined
                        });
                      }
                      setPresState({ slides: slidesList, i: 0 });
                    };

                    return (
                      <div
                        key={m.ID}
                        className="bg-white border border-indigo-100 rounded-xl p-4 flex flex-col justify-between gap-3 shadow-2xs"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-800 rounded">
                                  {m.Mapel || 'Umum'}
                                </span>
                                {m.Alokasi && (
                                  <span className="text-[11px] text-slate-500">{m.Alokasi}</span>
                                )}
                              </div>
                              <h3 className="text-sm font-bold text-slate-900 mt-1">{m.Judul}</h3>
                            </div>
                          </div>

                          {/* Pertanyaan Pemantik from Perangkat Ajar */}
                          <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200/80 space-y-1">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                              Pertanyaan Pemantik
                            </div>
                            {effectiveQuestion ? (
                              <p className="text-xs text-slate-800 whitespace-pre-line leading-relaxed">
                                {effectiveQuestion}
                              </p>
                            ) : (
                              <p className="text-[11px] text-slate-500 italic">
                                {apersepsiLine
                                  ? `Apersepsi modul: ${apersepsiLine}`
                                  : 'Belum ada pertanyaan pemantik pada modul ini.'}
                              </p>
                            )}
                          </div>

                          {/* Link Sumber Pelajaran & Lampiran */}
                          <div className="space-y-1.5">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                              <Link2 className="w-3 h-3 text-sky-600" /> Link Sumber Pelajaran
                            </div>
                            {modLinks.length > 0 || m.FileID ? (
                              <div className="flex flex-wrap gap-1.5">
                                {modLinks.map((lk, idx) => (
                                  <a
                                    key={idx}
                                    href={lk.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg"
                                  >
                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                    <span className="truncate max-w-[200px]">{lk.label}</span>
                                  </a>
                                ))}
                                {m.FileID && (
                                  <button
                                    type="button"
                                    onClick={() => downloadAjarFile(m.FileID, m.NamaFile)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-fuchsia-50 hover:bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200 rounded-lg cursor-pointer"
                                  >
                                    <Paperclip className="w-3 h-3 shrink-0" />
                                    <span className="truncate max-w-[180px]">{m.NamaFile || 'File Modul'}</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <p className="text-[11px] text-slate-400">
                                Belum ada link sumber pelajaran.{' '}
                                <button
                                  type="button"
                                  onClick={() => openModalModul(m)}
                                  className="text-sky-700 font-semibold hover:underline cursor-pointer"
                                >
                                  + Tambah Link di Modul
                                </button>
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={openModulPresentation}
                            className="px-3 py-1.5 text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Play className="w-3 h-3" /> Tampilkan Slide
                          </button>
                          <button
                            type="button"
                            onClick={() => openModalPemantik(linkedPem, m.ID)}
                            className="px-2.5 py-1.5 text-[11px] font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" /> {linkedPem ? 'Kelola Slide Terkait' : 'Jadikan Slide Pemantik'}
                          </button>
                          <button
                            type="button"
                            onClick={() => openModalModul(m)}
                            className="px-2.5 py-1.5 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg ml-auto cursor-pointer"
                          >
                            Edit Modul
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Daftar Slide Pemantik Interaktif */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  Daftar Slide Pemantik Tersimpan ({pemList.length})
                </h2>
              </div>

              {pemList.length === 0 ? (
                <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center space-y-2.5">
                  <p className="text-xs text-slate-500">
                    Belum ada Slide Pemantik khusus di kelas ini. Klik <strong>Buat Slide Pemantik & Link Sumber</strong> atau gunakan tombol <strong>Jadikan Slide Pemantik</strong> dari Perangkat Ajar di atas.
                  </p>
                  <button
                    type="button"
                    onClick={() => openModalPemantik()}
                    className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Buat Slide Pemantik Pertama
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pemList.map((p: any) => {
                    const slides = String(p.Slide || '')
                      .split(/\n\s*-{3,}\s*\n?/)
                      .map(x => x.trim())
                      .filter(Boolean);
                    const linkedMod = p.ModulID ? modMap.get(p.ModulID) : null;
                    const modPemantikQuestion = String(linkedMod?.PertanyaanPemantik || '').trim();
                    const ownQuestion = String(p.Pertanyaan || '').trim();
                    const combinedLinks = mergeResourceLinks(
                      parseSumberLinks(p.SumberPelajaran, p.Tautan),
                      linkedMod ? getModulResourceLinks(linkedMod) : []
                    );
                    const displayMapel = p.Mapel || linkedMod?.Mapel || '';

                    return (
                      <div
                        key={p.ID}
                        className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4 shadow-2xs"
                      >
                        <div className="space-y-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5 mb-1">
                              {displayMapel && (
                                <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
                                  {displayMapel}
                                </span>
                              )}
                              {linkedMod && (
                                <span className="px-2 py-0.5 text-[10px] font-semibold bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200 rounded truncate max-w-[230px]">
                                  Modul: {linkedMod.Judul}
                                </span>
                              )}
                            </div>
                            <h3 className="text-base font-bold text-slate-900">{p.Judul}</h3>
                          </div>

                          {(ownQuestion || modPemantikQuestion) && (
                            <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200 space-y-1.5">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                                Pertanyaan Pemantik
                              </div>
                              {ownQuestion && (
                                <p className="text-xs text-slate-800 whitespace-pre-line leading-relaxed">
                                  {ownQuestion}
                                </p>
                              )}
                              {modPemantikQuestion && modPemantikQuestion !== ownQuestion && (
                                <div className="pt-1.5 border-t border-amber-200/70">
                                  <div className="text-[10px] font-semibold text-indigo-700">
                                    Dari Perangkat Ajar ({linkedMod?.Judul}):
                                  </div>
                                  <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed mt-0.5">
                                    {modPemantikQuestion}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Link Sumber Pelajaran Section */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                                <Link2 className="w-3 h-3 text-sky-600" /> Link Sumber Pelajaran ({combinedLinks.length})
                              </span>
                              <button
                                type="button"
                                onClick={() => openModalPemantik(p)}
                                className="text-[11px] font-semibold text-sky-700 hover:underline cursor-pointer"
                              >
                                + Tambah / Edit Link
                              </button>
                            </div>
                            {combinedLinks.length > 0 || linkedMod?.FileID ? (
                              <div className="flex flex-wrap gap-1.5">
                                {combinedLinks.map((lk, idx) => (
                                  <a
                                    key={idx}
                                    href={lk.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg"
                                  >
                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                    <span className="truncate max-w-[210px]">{lk.label}</span>
                                  </a>
                                ))}
                                {linkedMod?.FileID && (
                                  <button
                                    type="button"
                                    onClick={() => downloadAjarFile(linkedMod.FileID, linkedMod.NamaFile)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-fuchsia-50 hover:bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200 rounded-lg cursor-pointer"
                                  >
                                    <Paperclip className="w-3 h-3 shrink-0" />
                                    <span className="truncate max-w-[180px]">
                                      {linkedMod.NamaFile || 'Lampiran Modul'}
                                    </span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <p className="text-[11px] text-slate-400">
                                Belum ada link sumber pelajaran.
                              </p>
                            )}
                          </div>

                          <div className="text-xs text-slate-400">{slides.length} slide materi</div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => {
                              const allSlides: {
                                badge?: string;
                                title: string;
                                body: string;
                                links?: SumberLinkItem[];
                                fileId?: string;
                                fileName?: string;
                              }[] = [
                                {
                                  badge: displayMapel
                                    ? `${displayMapel}${linkedMod ? ` · ${linkedMod.Judul}` : ''}`
                                    : 'Slide Pemantik',
                                  title: p.Judul,
                                  body: '',
                                  links: combinedLinks,
                                  fileId: linkedMod?.FileID || undefined,
                                  fileName: linkedMod?.NamaFile || undefined
                                }
                              ];
                              const allQuestions = [
                                ownQuestion,
                                modPemantikQuestion && modPemantikQuestion !== ownQuestion
                                  ? `[Perangkat Ajar] ${modPemantikQuestion}`
                                  : ''
                              ]
                                .filter(Boolean)
                                .join('\n\n');
                              if (allQuestions) {
                                allSlides.push({
                                  badge: 'Pertanyaan Pemantik',
                                  title: 'Pertanyaan Pemantik',
                                  body: allQuestions,
                                  links: combinedLinks
                                });
                              }
                              slides.forEach((s, idx) => {
                                const lines = s.split('\n');
                                allSlides.push({
                                  badge: `Materi ${idx + 1}`,
                                  title: lines[0] || p.Judul,
                                  body: lines.slice(1).join('\n'),
                                  links: combinedLinks
                                });
                              });
                              setPresState({ slides: allSlides, i: 0 });
                            }}
                            className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5" /> Tampilkan Layar Penuh
                          </button>
                          <button
                            type="button"
                            onClick={() => openModalPemantik(p)}
                            className="px-3 py-1.5 text-xs font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const ok = await askConfirm(`Hapus slide pemantik "${p.Judul}"?`);
                              if (!ok) return;
                              const nextPem = (db.Pemantik || []).filter((x: any) => x.ID !== p.ID);
                              await persistSheets({ ...db, Pemantik: nextPem }, 'Pemantik');
                            }}
                            className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg ml-auto cursor-pointer"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 9. TUGAS & PENGUMPULAN
  function renderTug() {
    // Compute all subjects that belong to the active class K
    const mapelById = new Map<string, string>(
      (db.Mapel || []).map((m: any) => [String(m.ID || ''), String(m.Nama || '').trim()])
    );
    const subjectTeacherMap = new Map<string, Set<string>>();
    const classSubjectSet = new Map<string, string>(); // lower -> display name

    const registerSubject = (rawName: string, teacherName?: string) => {
      const clean = String(rawName || '').trim();
      if (!clean || /^istirahat$/i.test(clean)) return;
      const key = clean.toLowerCase();
      if (!classSubjectSet.has(key)) classSubjectSet.set(key, clean);
      const displayName = classSubjectSet.get(key)!;
      if (teacherName && teacherName.trim()) {
        if (!subjectTeacherMap.has(displayName)) subjectTeacherMap.set(displayName, new Set());
        subjectTeacherMap.get(displayName)!.add(teacherName.trim());
      }
    };

    const explicitMapelRaw = String(kelasObj.Mapel || '').trim();
    const hasExplicitClassMapel = explicitMapelRaw.length > 0;

    if (explicitMapelRaw === '__NONE__') {
      // Explicitly configured to 0 subjects
    } else if (hasExplicitClassMapel) {
      // 1. Explicitly listed on Kelas.Mapel
      explicitMapelRaw
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .forEach(tok => registerSubject(mapelById.get(tok) || tok));

      // Attach teacher names for explicitly configured subjects
      const attachTeacherIfMatch = (rawName: string, teacherName?: string) => {
        const clean = String(rawName || '').trim();
        if (!clean || !teacherName?.trim()) return;
        const matched = classSubjectSet.get(clean.toLowerCase());
        if (matched) {
          if (!subjectTeacherMap.has(matched)) subjectTeacherMap.set(matched, new Set());
          subjectTeacherMap.get(matched)!.add(teacherName.trim());
        }
      };
      (db.Jadwal || [])
        .filter((j: any) => j.Kelas === K && (!j.Jenis || j.Jenis === 'Pelajaran'))
        .forEach((j: any) => attachTeacherIfMatch(j.Mapel, j.Guru));
      (db.Pengguna || []).forEach((u: any) => {
        const kelasTaught = new Set([
          ...String(u.Kelas || '').split(','),
          ...String(u.KelasWali || '').split(','),
          ...String(u.KelasMengajar || '').split(',')
        ].map(s => s.trim()).filter(Boolean));
        if (!kelasTaught.has(K)) return;
        String(u.Mapel || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
          .forEach(tok => attachTeacherIfMatch(mapelById.get(tok) || tok, u.Nama));
      });
    } else {
      // 2. Subjects scheduled in db.Jadwal for class K
      (db.Jadwal || [])
        .filter((j: any) => j.Kelas === K && (!j.Jenis || j.Jenis === 'Pelajaran'))
        .forEach((j: any) => registerSubject(j.Mapel, j.Guru));

      // 3. Subjects taught by teachers assigned to class K
      (db.Pengguna || []).forEach((u: any) => {
        const kelasTaught = new Set([
          ...String(u.Kelas || '').split(','),
          ...String(u.KelasWali || '').split(','),
          ...String(u.KelasMengajar || '').split(',')
        ].map(s => s.trim()).filter(Boolean));
        if (!kelasTaught.has(K)) return;
        String(u.Mapel || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
          .forEach(tok => registerSubject(mapelById.get(tok) || tok, u.Nama));
      });

      // 4. Subjects already present in Tugas, Modul, or CBT of class K
      tugasK.forEach((t: any) => registerSubject(t.Mapel));
      (db.Modul || []).filter((m: any) => m.Kelas === K).forEach((m: any) => registerSubject(m.Mapel));
      (db.CBT || []).filter((c: any) => c.Kelas === K).forEach((c: any) => registerSubject(c.Mapel));

      // 5. Fallback to school-wide master subjects if the class has none configured yet
      if (classSubjectSet.size === 0) {
        (db.Mapel || []).forEach((m: any) => registerSubject(m.Nama));
      }
    }

    const classMapelList = Array.from(classSubjectSet.values()).sort((a, b) =>
      a.localeCompare(b, 'id')
    );

    const activeMapelFilter =
      tugMapelFilter !== 'ALL' &&
      classMapelList.some(m => m.toLowerCase() === tugMapelFilter.toLowerCase())
        ? classMapelList.find(m => m.toLowerCase() === tugMapelFilter.toLowerCase()) || 'ALL'
        : 'ALL';

    const filteredTugasK =
      activeMapelFilter === 'ALL'
        ? tugasK
        : tugasK.filter(
            (t: any) => String(t.Mapel || '').trim().toLowerCase() === activeMapelFilter.toLowerCase()
          );

    const activeId =
      tugSel && filteredTugasK.some((t: any) => t.ID === tugSel)
        ? tugSel
        : filteredTugasK[0]?.ID || '';
    const curTug = filteredTugasK.find((t: any) => t.ID === activeId);

    const getTugasTipe = (t: any): TugasTipeSoal => {
      const raw = String(t?.TipeSoal || '').toLowerCase();
      if (raw === 'pg') return 'pg';
      if (raw === 'uraian') return 'uraian';
      if (raw === 'akuntansi') return 'akuntansi';
      if (Boolean(String(t?.KunciJawaban || '').trim())) return 'pg';
      return 'umum';
    };

    const gradeSubmissionRow = (tugasRow: any, pRow: any) => {
      const tipe = getTugasTipe(tugasRow);
      if (!String(tugasRow?.KunciJawaban || '').trim()) return null;
      if (!String(pRow?.JawabanSiswa || '').trim()) return null;

      if (tipe === 'pg') {
        const res = koreksiPgSiswa(
          tugasRow.KunciJawaban,
          pRow.JawabanSiswa,
          tugasRow.JumlahSoal,
          tugasRow.OpsiPG
        );
        if (!res.adaKunci) return null;
        return {
          ...pRow,
          Nilai: String(res.nilai),
          DetailKoreksi: JSON.stringify({
            tipe: 'pg',
            total: res.total,
            jumlahKunci: res.jumlahKunci,
            benar: res.benar,
            salah: res.salah,
            kosong: res.kosong,
            nilai: res.nilai,
            detail: res.detail
          })
        };
      }

      if (tipe === 'uraian') {
        const kItems = parseUraianKunci(tugasRow.KunciJawaban, Number(tugasRow.JumlahSoal || 0));
        const sMap = parseUraianSiswa(pRow.JawabanSiswa);
        const res = koreksiUraianSiswa(kItems, sMap);
        if (!res.adaKunci) return null;
        return {
          ...pRow,
          Nilai: String(res.nilai),
          DetailKoreksi: JSON.stringify(res)
        };
      }

      if (tipe === 'akuntansi') {
        const kRows = parseAkuntansiKunci(tugasRow.KunciJawaban);
        const sRows = parseAkuntansiSiswa(pRow.JawabanSiswa);
        const res = koreksiAkuntansiSiswa(kRows, sRows);
        if (!res.adaKunci) return null;
        return {
          ...pRow,
          Nilai: String(res.nilai),
          DetailKoreksi: JSON.stringify(res)
        };
      }

      return null;
    };

    const confirmHapusTugas = (tugasRow: any) => {
      if (!tugasRow?.ID) return;
      const relatedCount = (db.Pengumpulan || []).filter(
        (p: any) => p.TugasID === tugasRow.ID && (p.Status !== 'Belum' || p.Nilai || p.FileID || p.JawabanSiswa)
      ).length;
      setModalContent({
        title: 'Konfirmasi Hapus Tugas',
        render: () => (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1">
              <div className="font-bold">Hapus tugas ini dari daftar?</div>
              <div>
                Judul: <strong>{tugasRow.Judul}</strong>
                {tugasRow.Mapel ? ` (${tugasRow.Mapel})` : ''}
              </div>
              {relatedCount > 0 && (
                <div className="text-[11px] text-rose-700 pt-1">
                  Perhatian: terdapat <strong>{relatedCount}</strong> data pengumpulan/nilai siswa pada tugas ini yang juga akan ikut terhapus.
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalContent(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  const nextTugas = (db.Tugas || []).filter((t: any) => t.ID !== tugasRow.ID);
                  const nextPengumpulan = (db.Pengumpulan || []).filter(
                    (p: any) => p.TugasID !== tugasRow.ID
                  );
                  const remainingFiltered = filteredTugasK.filter((t: any) => t.ID !== tugasRow.ID);
                  setTugSel(remainingFiltered[0]?.ID || '');
                  setModalContent(null);
                  await persistSheets(
                    { ...db, Tugas: nextTugas, Pengumpulan: nextPengumpulan },
                    'Tugas',
                    'Pengumpulan'
                  );
                  showToast(`Tugas "${tugasRow.Judul}" berhasil dihapus`);
                }}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Ya, Hapus Tugas
              </button>
            </div>
          </div>
        )
      });
    };

    const openTambahTugas = (editRow?: any, defaultMapel?: string) => {
      const defaultMapelVal =
        editRow?.Mapel ||
        defaultMapel ||
        (activeMapelFilter !== 'ALL' ? activeMapelFilter : '') ||
        classMapelList[0] ||
        db.Mapel?.[0]?.Nama ||
        'Umum';
      let fileId = editRow?.FileID || '';
      let namaFile = editRow?.NamaFile || '';

      const modalSubjectOptions = Array.from(
        new Set([...classMapelList, ...(db.Mapel || []).map((m: any) => String(m.Nama || '').trim()).filter(Boolean)])
      );

      setModalContent({
        title: editRow ? 'Edit Tugas & Kunci Jawaban' : 'Tambah Tugas / Asesmen Formatif',
        wide: true,
        render: () => (
          <TugasFormModalBody
            key={editRow?.ID || `new-${defaultMapelVal}`}
            editRow={editRow}
            token={token}
            kelasNama={kelasObj.Nama || ''}
            defaultMapel={defaultMapelVal}
            defaultTenggat={ymd(new Date())}
            subjectOptions={modalSubjectOptions}
            showToast={showToast}
            onCancel={() => setModalContent(null)}
            onDelete={editRow ? () => confirmHapusTugas(editRow) : undefined}
            onSave={async payload => {
              if (payload.pendingFile) {
                showToast('Mengunggah berkas tugas…', 5000);
                const upRes = await fetchJson('/api/tugas/upload-soal', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    token,
                    namaFile: payload.pendingFile.namaFile,
                    base64Data: payload.pendingFile.base64Data
                  })
                });
                if (!upRes.ok) {
                  showToast('Gagal unggah lampiran: ' + (upRes.error || 'Error'), 4000);
                  return;
                }
                fileId = upRes.data.fileId;
                namaFile = upRes.data.namaFile;
              }
              const idBaru = editRow?.ID || uid();
              const record = {
                ID: idBaru,
                Kelas: K,
                Judul: payload.judul,
                Mapel: payload.mapel,
                Deskripsi: payload.deskripsi,
                Jenis: payload.jenis,
                Tenggat: payload.tenggat,
                FileID: fileId,
                NamaFile: namaFile,
                TipeSoal: payload.tipeSoal,
                JumlahSoal: payload.tipeSoal === 'umum' ? '' : String(payload.jumlahSoal || ''),
                OpsiPG: payload.tipeSoal === 'pg' ? payload.opsiPG : '',
                KunciJawaban: payload.tipeSoal === 'umum' ? '' : payload.kunciJawaban
              };
              const nextTugas = editRow
                ? (db.Tugas || []).map((t: any) => (t.ID === editRow.ID ? record : t))
                : [...(db.Tugas || []), record];

              setTugSel(idBaru);
              if (record.Mapel) setTugMapelFilter(record.Mapel);
              setModalContent(null);

              // Auto-regrade existing submissions if task is graded (PG / Uraian / Akuntansi) and has a key
              if (record.TipeSoal !== 'umum' && record.KunciJawaban) {
                let regraded = 0;
                const nextPengumpulan = (db.Pengumpulan || []).map((p: any) => {
                  if (p.TugasID !== idBaru) return p;
                  const graded = gradeSubmissionRow(record, p);
                  if (!graded) return p;
                  regraded++;
                  return graded;
                });
                if (regraded > 0) {
                  await persistSheets(
                    { ...db, Tugas: nextTugas, Pengumpulan: nextPengumpulan },
                    'Tugas',
                    'Pengumpulan'
                  );
                  showToast(`Tugas disimpan & ${regraded} jawaban siswa dikoreksi ulang`);
                  return;
                }
              }

              await persistSheets({ ...db, Tugas: nextTugas }, 'Tugas');
            }}
          />
        )
      });
    };

    const runAutoKoreksiSemua = async (
      tugasRow: any,
      sourceTugasList?: any[],
      sourcePengumpulanList?: any[]
    ) => {
      const tipe = getTugasTipe(tugasRow);
      if (tipe === 'umum' || !String(tugasRow?.KunciJawaban || '').trim()) {
        showToast('Atur Kunci Jawaban terlebih dahulu sebelum koreksi otomatis');
        return;
      }
      const basePengumpulan = sourcePengumpulanList || db.Pengumpulan || [];
      let gradedCount = 0;
      const nextPengumpulan = basePengumpulan.map((p: any) => {
        if (p.TugasID !== tugasRow.ID) return p;
        const graded = gradeSubmissionRow(tugasRow, p);
        if (!graded) return p;
        gradedCount++;
        return graded;
      });
      if (gradedCount === 0) {
        if (sourceTugasList) {
          await persistSheets({ ...db, Tugas: sourceTugasList }, 'Tugas');
        }
        const fileCount = basePengumpulan.filter(
          (p: any) => p.TugasID === tugasRow.ID && p.FileID
        ).length;
        showToast(
          fileCount > 0
            ? `Belum ada jawaban teks terstruktur — klik "Koreksi Semua PDF (${fileCount})" untuk memeriksa berkas siswa`
            : 'Belum ada jawaban siswa yang masuk untuk dikoreksi otomatis'
        );
        return;
      }
      if (sourceTugasList) {
        await persistSheets(
          { ...db, Tugas: sourceTugasList, Pengumpulan: nextPengumpulan },
          'Tugas',
          'Pengumpulan'
        );
      } else {
        await persistSheets({ ...db, Pengumpulan: nextPengumpulan }, 'Pengumpulan');
      }
      showToast(`Koreksi otomatis selesai: ${gradedCount} siswa dinilai!`);
    };

    const runBatchKoreksiPdf = async (tugasRow: any) => {
      const tipe = getTugasTipe(tugasRow);
      if (tipe === 'umum' || !String(tugasRow?.KunciJawaban || '').trim()) {
        showToast('Atur Kunci Jawaban terlebih dahulu sebelum mengoreksi PDF siswa');
        return;
      }
      const targets = siswaK
        .map((s: any) => {
          const row = (db.Pengumpulan || []).find(
            (q: any) => q.TugasID === tugasRow.ID && q.SiswaID === s.ID
          );
          return row && row.FileID ? { siswa: s, row } : null;
        })
        .filter(Boolean) as { siswa: any; row: any }[];

      if (targets.length === 0) {
        showToast('Belum ada siswa yang mengunggah file PDF/jawaban untuk tugas ini');
        return;
      }

      let okCount = 0;
      let errLast = '';
      const updatedRows: any[] = [];
      for (let i = 0; i < targets.length; i++) {
        const { siswa, row } = targets[i];
        showToast(`Mengkoreksi PDF ${i + 1}/${targets.length}: ${siswa.Nama}…`, 12000);
        try {
          const res = await fetchJson('/api/tugas/koreksi-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token,
              tugasId: tugasRow.ID,
              siswaId: siswa.ID,
              fileId: row.FileID,
              saveResult: true
            })
          });
          if (res.ok && res.data?.pengumpulan) {
            okCount++;
            updatedRows.push(res.data.pengumpulan);
          } else {
            errLast = res.error || 'Gagal membaca file';
          }
        } catch (err: any) {
          errLast = err?.message || 'Koneksi gagal';
        }
      }

      if (updatedRows.length > 0) {
        setDb(prev => {
          const list = [...(prev.Pengumpulan || [])];
          updatedRows.forEach(up => {
            const idx = list.findIndex(
              (q: any) => q.TugasID === up.TugasID && q.SiswaID === up.SiswaID
            );
            if (idx >= 0) list[idx] = { ...list[idx], ...up };
            else list.push(up);
          });
          return { ...prev, Pengumpulan: list };
        });
      }

      if (okCount === targets.length) {
        showToast(`Koreksi PDF selesai: ${okCount}/${targets.length} berkas siswa dinilai!`);
      } else if (okCount > 0) {
        showToast(
          `Selesai ${okCount}/${targets.length} PDF. Sebagian gagal: ${errLast}`,
          5000
        );
      } else {
        showToast(`Gagal koreksi PDF: ${errLast || 'Periksa format file / konfigurasi AI'}`, 5000);
      }
    };

    const openKunciModal = (tugasRow: any, forceMode?: 'pg' | 'uraian' | 'akuntansi') => {
      const curMode = getTugasTipe(tugasRow);
      const targetMode: 'pg' | 'uraian' | 'akuntansi' =
        forceMode || (curMode !== 'umum' ? curMode : 'pg');

      if (targetMode === 'uraian') {
        setModalContent({
          title: 'Kunci Jawaban Uraian Teks',
          wide: true,
          render: () => (
            <KunciUraianQuickModalBody
              key={`kunci-uraian-${tugasRow.ID}`}
              tugas={tugasRow}
              token={token}
              showToast={showToast}
              onCancel={() => setModalContent(null)}
              onSave={async payload => {
                const updatedTugas = {
                  ...tugasRow,
                  TipeSoal: payload.tipeSoal,
                  JumlahSoal: String(payload.jumlahSoal),
                  OpsiPG: '',
                  KunciJawaban: payload.kunciJawaban
                };
                const nextTugas = (db.Tugas || []).map((t: any) =>
                  t.ID === tugasRow.ID ? updatedTugas : t
                );
                setModalContent(null);
                if (payload.autoGradeExisting) {
                  await runAutoKoreksiSemua(updatedTugas, nextTugas, db.Pengumpulan || []);
                } else {
                  await persistSheets({ ...db, Tugas: nextTugas }, 'Tugas');
                  showToast('Kunci jawaban uraian disimpan');
                }
              }}
            />
          )
        });
        return;
      }

      if (targetMode === 'akuntansi') {
        setModalContent({
          title: 'Kunci Jawaban Praktik Akuntansi',
          wide: true,
          render: () => (
            <KunciAkuntansiQuickModalBody
              key={`kunci-ak-${tugasRow.ID}`}
              tugas={tugasRow}
              token={token}
              showToast={showToast}
              onCancel={() => setModalContent(null)}
              onSave={async payload => {
                const updatedTugas = {
                  ...tugasRow,
                  TipeSoal: payload.tipeSoal,
                  JumlahSoal: String(payload.jumlahSoal),
                  OpsiPG: '',
                  KunciJawaban: payload.kunciJawaban
                };
                const nextTugas = (db.Tugas || []).map((t: any) =>
                  t.ID === tugasRow.ID ? updatedTugas : t
                );
                setModalContent(null);
                if (payload.autoGradeExisting) {
                  await runAutoKoreksiSemua(updatedTugas, nextTugas, db.Pengumpulan || []);
                } else {
                  await persistSheets({ ...db, Tugas: nextTugas }, 'Tugas');
                  showToast('Kunci jawaban praktik akuntansi disimpan');
                }
              }}
            />
          )
        });
        return;
      }

      setModalContent({
        title: 'Kunci Jawaban Pilihan Ganda',
        wide: true,
        render: () => (
          <KunciPgQuickModalBody
            key={`kunci-${tugasRow.ID}`}
            tugas={tugasRow}
            token={token}
            showToast={showToast}
            onCancel={() => setModalContent(null)}
            onSave={async payload => {
              const updatedTugas = {
                ...tugasRow,
                TipeSoal: payload.tipeSoal,
                JumlahSoal: String(payload.jumlahSoal),
                OpsiPG: payload.opsiPG,
                KunciJawaban: payload.kunciJawaban
              };
              const nextTugas = (db.Tugas || []).map((t: any) =>
                t.ID === tugasRow.ID ? updatedTugas : t
              );
              setModalContent(null);
              if (payload.autoGradeExisting) {
                await runAutoKoreksiSemua(updatedTugas, nextTugas, db.Pengumpulan || []);
              } else {
                await persistSheets({ ...db, Tugas: nextTugas }, 'Tugas');
                showToast('Kunci jawaban PG disimpan');
              }
            }}
          />
        )
      });
    };

    const openKoreksiSiswaModal = (
      tugasRow: any,
      studentIdx: number,
      workingPengumpulan?: any[]
    ) => {
      const s = siswaK[studentIdx];
      if (!s) return;
      const listNow = workingPengumpulan || db.Pengumpulan || [];
      const existing = listNow.find(
        (q: any) => q.TugasID === tugasRow.ID && q.SiswaID === s.ID
      ) || {
        TugasID: tugasRow.ID,
        SiswaID: s.ID,
        Status: 'Belum',
        Nilai: '',
        FileID: '',
        NamaFile: '',
        TanggalKumpul: '',
        CatatanSiswa: '',
        JawabanSiswa: '',
        DetailKoreksi: ''
      };

      const tipe = getTugasTipe(tugasRow);
      const handleApply = (
        payload: {
          jawabanSiswa: string;
          detailKoreksi: string;
          nilai: string;
          status: string;
        },
        goNext: boolean
      ) => {
        const nextPengumpulan = [...listNow];
        const idx = nextPengumpulan.findIndex(
          (q: any) => q.TugasID === tugasRow.ID && q.SiswaID === s.ID
        );
        const nextRow = {
          ...(idx >= 0 ? nextPengumpulan[idx] : existing),
          TugasID: tugasRow.ID,
          SiswaID: s.ID,
          Status: payload.status,
          Nilai: payload.nilai,
          JawabanSiswa: payload.jawabanSiswa,
          DetailKoreksi: payload.detailKoreksi
        };
        if (idx >= 0) nextPengumpulan[idx] = nextRow;
        else nextPengumpulan.push(nextRow);

        const nextDb = { ...db, Pengumpulan: nextPengumpulan };
        setDb(nextDb);

        if (goNext && studentIdx + 1 < siswaK.length) {
          openKoreksiSiswaModal(tugasRow, studentIdx + 1, nextPengumpulan);
          void persistSheets(nextDb, 'Pengumpulan');
        } else {
          setModalContent(null);
          void persistSheets(nextDb, 'Pengumpulan');
          showToast(`Nilai ${s.Nama} diterapkan (${payload.nilai})`);
        }
      };

      if (tipe === 'uraian') {
        setModalContent({
          title: `Koreksi Jawaban Uraian · ${s.Nama}`,
          wide: true,
          render: () => (
            <KoreksiUraianSiswaModalBody
              key={`${tugasRow.ID}:${s.ID}:uraian`}
              tugas={tugasRow}
              siswa={s}
              submission={existing}
              token={token}
              hasNextStudent={studentIdx + 1 < siswaK.length}
              showToast={showToast}
              onCancel={() => setModalContent(null)}
              onApply={handleApply}
            />
          )
        });
        return;
      }

      if (tipe === 'akuntansi') {
        setModalContent({
          title: `Koreksi Praktik Akuntansi · ${s.Nama}`,
          wide: true,
          render: () => (
            <KoreksiAkuntansiSiswaModalBody
              key={`${tugasRow.ID}:${s.ID}:akuntansi`}
              tugas={tugasRow}
              siswa={s}
              submission={existing}
              token={token}
              hasNextStudent={studentIdx + 1 < siswaK.length}
              showToast={showToast}
              onCancel={() => setModalContent(null)}
              onApply={handleApply}
            />
          )
        });
        return;
      }

      setModalContent({
        title: `Koreksi Jawaban PG · ${s.Nama}`,
        wide: true,
        render: () => (
          <KoreksiPgSiswaModalBody
            key={`${tugasRow.ID}:${s.ID}:pg`}
            tugas={tugasRow}
            siswa={s}
            submission={existing}
            token={token}
            hasNextStudent={studentIdx + 1 < siswaK.length}
            showToast={showToast}
            onCancel={() => setModalContent(null)}
            onApply={handleApply}
          />
        )
      });
    };

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-teal-500 via-cyan-600 to-sky-600 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-md">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tugas & Pengumpulan</h1>
            <p className="text-xs text-cyan-50 mt-1">
              Unggah berkas tugas per mata pelajaran kelas <strong>{kelasObj.Nama || ''}</strong>, pantau pengumpulan siswa, dan koreksi otomatis PG, Uraian, Praktik Akuntansi, maupun file PDF siswa.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {filteredTugasK.length > 0 && (
              <div className="flex items-center gap-1.5">
                <select
                  value={activeId}
                  onChange={e => setTugSel(e.target.value)}
                  className="px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-white/40 rounded-xl max-w-[260px]"
                >
                  {filteredTugasK.map((t: any) => (
                    <option key={t.ID} value={t.ID}>
                      {t.Judul}{t.Mapel ? ` · ${t.Mapel}` : ''} ({t.Jenis})
                    </option>
                  ))}
                </select>
                {curTug && (
                  <button
                    type="button"
                    onClick={() => confirmHapusTugas(curTug)}
                    title="Hapus Tugas Dipilih"
                    className="p-2 bg-rose-500/90 hover:bg-rose-600 text-white rounded-xl shadow-sm cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
            <button
              onClick={() => openTambahTugas()}
              className="px-3.5 py-2 text-xs font-semibold bg-white text-teal-700 hover:bg-teal-50 rounded-xl shadow-sm whitespace-nowrap cursor-pointer"
            >
              + Tambah Tugas
            </button>
          </div>
        </div>

        {/* All Subjects for Active Class */}
        <div className="bg-white border border-teal-100 rounded-2xl p-5 space-y-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-teal-600" />
                Mata Pelajaran Kelas {kelasObj.Nama || ''} ({classMapelList.length} Mapel)
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Klik mata pelajaran untuk melihat atau membuat tugas sesuai jadwal dan guru kelas ini.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTugMapelFilter('ALL')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
                activeMapelFilter === 'ALL'
                  ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                  : 'bg-slate-50 hover:bg-teal-50 text-slate-700 border-slate-200'
              }`}
            >
              Semua Mapel ({tugasK.length} Tugas)
            </button>
          </div>

          {classMapelList.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500 text-center">
              Belum ada mata pelajaran terdeteksi untuk kelas ini. Atur jadwal kelas atau daftar mata pelajaran di menu Pengaturan.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {classMapelList.map(m => {
                const tasksForMapel = tugasK.filter(
                  (t: any) => String(t.Mapel || '').trim().toLowerCase() === m.toLowerCase()
                );
                const isSelected = activeMapelFilter.toLowerCase() === m.toLowerCase();
                const teachers = Array.from(subjectTeacherMap.get(m) || []);
                return (
                  <div
                    key={m}
                    onClick={() => {
                      setTugMapelFilter(m);
                      if (tasksForMapel[0]?.ID) setTugSel(tasksForMapel[0].ID);
                      else setTugSel('');
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                      isSelected
                        ? 'bg-teal-50 border-teal-500 ring-1 ring-teal-400 shadow-xs'
                        : 'bg-slate-50/60 hover:bg-teal-50/50 border-slate-200 hover:border-teal-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate" title={m}>
                          {m}
                        </div>
                        {teachers.length > 0 && (
                          <div className="text-[11px] text-slate-500 truncate mt-0.5" title={teachers.join(', ')}>
                            {teachers.join(', ')}
                          </div>
                        )}
                      </div>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-md shrink-0 tabular-nums ${
                          tasksForMapel.length > 0
                            ? 'bg-teal-600 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {tasksForMapel.length} Tugas
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/70">
                      <span className="text-[11px] text-slate-500 truncate">
                        {tasksForMapel.length > 0
                          ? `Terdekat: ${tasksForMapel[0].Tenggat || '-'}`
                          : 'Belum ada tugas'}
                      </span>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setTugMapelFilter(m);
                          openTambahTugas(undefined, m);
                        }}
                        className="px-2 py-0.5 text-[11px] font-semibold bg-white hover:bg-teal-600 hover:text-white text-teal-700 border border-teal-200 rounded-md transition-colors shrink-0 cursor-pointer"
                      >
                        + Tugas
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {curTug ? (() => {
          const curTipe = getTugasTipe(curTug);
          const isPgTask = curTipe === 'pg';
          const isUraianTask = curTipe === 'uraian';
          const isAkuntansiTask = curTipe === 'akuntansi';
          const isGradedTask = curTipe !== 'umum';

          const curOpsiPG = normalizeOpsiPG(curTug.OpsiPG);
          const curTotalSoal = inferTotalSoal(curTug.KunciJawaban, curTug.JumlahSoal, undefined, curOpsiPG);
          const kunciMap = isPgTask ? parsePgAnswers(curTug.KunciJawaban, curTotalSoal, curOpsiPG) : {};
          const pgKunciCount = Object.keys(kunciMap).length;
          const kunciRingkas = isPgTask ? formatPgNumberedSummary(kunciMap, curTotalSoal) : '';

          const uraianKunci = isUraianTask
            ? parseUraianKunci(curTug.KunciJawaban, Number(curTug.JumlahSoal || 0))
            : [];
          const akuntansiKunci = isAkuntansiTask ? parseAkuntansiKunci(curTug.KunciJawaban) : [];
          const akKunciDebit = akuntansiKunci
            .filter(r => r.posisi === 'D')
            .reduce((s, r) => s + (Number(r.nominal) || 0), 0);
          const akKunciKredit = akuntansiKunci
            .filter(r => r.posisi === 'K')
            .reduce((s, r) => s + (Number(r.nominal) || 0), 0);

          const hasKunci = isPgTask
            ? pgKunciCount > 0
            : isUraianTask
            ? uraianKunci.length > 0
            : isAkuntansiTask
            ? akuntansiKunci.length > 0
            : false;

          const fileSubmissionCount = siswaK.filter((s: any) =>
            (db.Pengumpulan || []).some(
              (q: any) => q.TugasID === curTug.ID && q.SiswaID === s.ID && q.FileID
            )
          ).length;

          return (
          <div className="bg-white border border-teal-100 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">{curTug.Judul}</h2>
                  {curTug.Mapel && (
                    <span className="px-2 py-0.5 text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md">
                      {curTug.Mapel}
                    </span>
                  )}
                  {isPgTask && (
                    <span className="px-2 py-0.5 text-[11px] font-bold bg-violet-50 text-violet-700 border border-violet-200 rounded-md">
                      Pilihan Ganda · {curTotalSoal} Soal ({curOpsiPG === 'ABCD' ? 'A–D' : 'A–E'})
                    </span>
                  )}
                  {isUraianTask && (
                    <span className="px-2 py-0.5 text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 rounded-md inline-flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      Uraian Teks · {uraianKunci.length || curTug.JumlahSoal || 0} Soal
                    </span>
                  )}
                  {isAkuntansiTask && (
                    <span className="px-2 py-0.5 text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md inline-flex items-center gap-1">
                      <Calculator className="w-3 h-3" />
                      Praktik Akuntansi · {akuntansiKunci.length || curTug.JumlahSoal || 0} Baris
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  Jenis: {curTug.Jenis} · Tenggat: {curTug.Tenggat || '-'}
                </div>
                {curTug.Deskripsi && (
                  <p className="text-xs text-slate-600 max-w-2xl">{curTug.Deskripsi}</p>
                )}
                {curTug.FileID && (
                  <div className="pt-1 flex flex-wrap items-center gap-1.5">
                    <a
                      href={`/api/tugas/file/${curTug.FileID}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg"
                    >
                      <Download className="w-3.5 h-3.5" /> Lampiran Guru: {curTug.NamaFile}
                    </a>
                    {/\.(pdf|png|jpe?g|webp)$/i.test(curTug.NamaFile || '') && (
                      <a
                        href={`/api/tugas/file/${curTug.FileID}?inline=1`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-white hover:bg-sky-50 text-sky-700 border border-sky-200 rounded-lg"
                      >
                        <Eye className="w-3.5 h-3.5" /> Preview
                      </a>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {curTipe === 'umum' ? (
                  <>
                    <button
                      onClick={() => openKunciModal(curTug, 'pg')}
                      className="px-2.5 py-2 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl flex items-center gap-1 cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" /> Kunci PG
                    </button>
                    <button
                      onClick={() => openKunciModal(curTug, 'uraian')}
                      className="px-2.5 py-2 text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl flex items-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" /> Kunci Uraian
                    </button>
                    <button
                      onClick={() => openKunciModal(curTug, 'akuntansi')}
                      className="px-2.5 py-2 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl flex items-center gap-1 cursor-pointer"
                    >
                      <Calculator className="w-3.5 h-3.5" /> Kunci Akuntansi
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => openKunciModal(curTug)}
                    className={`px-3 py-2 text-xs font-semibold rounded-xl border flex items-center gap-1.5 cursor-pointer ${
                      isUraianTask
                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                        : isAkuntansiTask
                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                        : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                    }`}
                  >
                    <KeyRound className="w-3.5 h-3.5" />{' '}
                    {isUraianTask
                      ? 'Atur Kunci Uraian'
                      : isAkuntansiTask
                      ? 'Atur Kunci Akuntansi'
                      : 'Atur Kunci PG'}
                  </button>
                )}

                {isGradedTask && hasKunci && (
                  <button
                    onClick={() => runAutoKoreksiSemua(curTug)}
                    className="px-3 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Koreksi Otomatis Semua
                  </button>
                )}
                {isGradedTask && hasKunci && fileSubmissionCount > 0 && (
                  <button
                    onClick={() => runBatchKoreksiPdf(curTug)}
                    className="px-3 py-2 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <FileUp className="w-3.5 h-3.5" /> Koreksi Semua PDF ({fileSubmissionCount})
                  </button>
                )}
                <button
                  onClick={() => openTambahTugas(curTug)}
                  className="px-3 py-2 text-xs font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Tugas
                </button>
                <button
                  onClick={() => confirmHapusTugas(curTug)}
                  className="px-3 py-2 text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Hapus Tugas
                </button>
                <button
                  onClick={() => setWaBlastState({ open: true })}
                  className="px-3 py-2 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl flex items-center gap-1 cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> Ingatkan WA
                </button>
                <button
                  onClick={() => persistSheets(db, 'Pengumpulan')}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" /> Simpan Pengumpulan
                </button>
              </div>
            </div>

            {isPgTask && (
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    Kunci Jawaban PG ({pgKunciCount}/{curTotalSoal} nomor terisi)
                  </div>
                  <div className="text-[11px] font-mono text-indigo-800 break-words">
                    {kunciRingkas || 'Kunci jawaban belum diisi. Klik "Atur Kunci PG" atau impor dari file PDF kunci.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openKunciModal(curTug, 'pg')}
                  className="px-3 py-1.5 text-[11px] font-bold bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg shrink-0 cursor-pointer"
                >
                  {pgKunciCount > 0 ? 'Ubah Kunci' : 'Input Kunci PG'}
                </button>
              </div>
            )}

            {isUraianTask && (
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    Kunci Jawaban Uraian Teks ({uraianKunci.length} butir soal · Total Bobot{' '}
                    {uraianKunci.reduce((s, it) => s + (Number(it.bobot) || 0), 0)})
                  </div>
                  {uraianKunci.length > 0 ? (
                    <div className="text-[11px] text-amber-900 space-y-0.5">
                      {uraianKunci.slice(0, 3).map(it => (
                        <div key={it.no} className="truncate">
                          <strong>#{it.no}</strong>
                          {it.pertanyaan ? ` (${it.pertanyaan})` : ''}:{' '}
                          <span className="text-amber-800">{it.kunci || '-'}</span>
                        </div>
                      ))}
                      {uraianKunci.length > 3 && (
                        <div className="text-[10px] text-amber-700">
                          +{uraianKunci.length - 3} butir lainnya…
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] text-amber-800">
                      Belum ada kunci uraian. Klik "Atur Kunci Uraian" untuk mengetik poin kunci atau impor dari file PDF.
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => openKunciModal(curTug, 'uraian')}
                  className="px-3 py-1.5 text-[11px] font-bold bg-white hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg shrink-0 cursor-pointer"
                >
                  {uraianKunci.length > 0 ? 'Ubah / Impor PDF Kunci' : 'Input Kunci Uraian'}
                </button>
              </div>
            )}

            {isAkuntansiTask && (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    Kunci Praktik Akuntansi ({akuntansiKunci.length} baris · Total D: Rp{' '}
                    {formatRupiah(akKunciDebit)} · K: Rp {formatRupiah(akKunciKredit)})
                  </div>
                  {akuntansiKunci.length > 0 ? (
                    <div className="text-[11px] text-emerald-900 flex flex-wrap gap-x-3 gap-y-0.5">
                      {akuntansiKunci.slice(0, 4).map(r => (
                        <span key={r.no}>
                          <strong>#{r.no}</strong> {r.akun} ({r.posisi}) Rp {formatRupiah(r.nominal)}
                        </span>
                      ))}
                      {akuntansiKunci.length > 4 && (
                        <span className="text-emerald-700">
                          +{akuntansiKunci.length - 4} baris lainnya…
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] text-emerald-800">
                      Belum ada tabel kunci akuntansi. Klik "Atur Kunci Akuntansi" untuk menginput atau impor dari PDF.
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => openKunciModal(curTug, 'akuntansi')}
                  className="px-3 py-1.5 text-[11px] font-bold bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg shrink-0 cursor-pointer"
                >
                  {akuntansiKunci.length > 0 ? 'Ubah / Impor PDF Kunci' : 'Input Kunci Akuntansi'}
                </button>
              </div>
            )}

            <div className="overflow-x-auto border border-teal-100 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-teal-50/70 border-b border-teal-100 text-teal-800">
                  <tr>
                    <th className="py-2.5 px-3 w-10">#</th>
                    <th className="py-2.5 px-3">Nama Siswa</th>
                    <th className="py-2.5 px-3">Berkas Unggahan Siswa</th>
                    {isGradedTask && <th className="py-2.5 px-3">Jawaban & Koreksi</th>}
                    <th className="py-2.5 px-3">Status Pengumpulan</th>
                    <th className="py-2.5 px-3 text-right">Nilai (0–100)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {siswaK.map((s: any, i: number) => {
                    const r = (db.Pengumpulan || []).find(
                      (q: any) => q.TugasID === curTug.ID && q.SiswaID === s.ID
                    ) || { Status: 'Belum', Nilai: '', FileID: '', NamaFile: '', TanggalKumpul: '', CatatanSiswa: '', JawabanSiswa: '', DetailKoreksi: '' };

                    const parsedPg = isPgTask
                      ? parsePgAnswers(r.JawabanSiswa, curTotalSoal, curOpsiPG)
                      : {};
                    const jPgCount = Object.keys(parsedPg).length;
                    const parsedUraian = isUraianTask ? parseUraianSiswa(r.JawabanSiswa) : {};
                    const jUraianCount = Object.keys(parsedUraian).filter(k =>
                      Boolean(String(parsedUraian[Number(k)] || '').trim())
                    ).length;
                    const parsedAk = isAkuntansiTask ? parseAkuntansiSiswa(r.JawabanSiswa) : [];

                    const detailObj = isGradedTask ? parseDetailKoreksi(r.DetailKoreksi) : null;
                    const livePg =
                      isPgTask && jPgCount > 0 && hasKunci
                        ? koreksiPgSiswa(curTug.KunciJawaban, parsedPg, curTotalSoal, curOpsiPG)
                        : null;
                    const liveUraian =
                      isUraianTask && jUraianCount > 0 && hasKunci
                        ? koreksiUraianSiswa(uraianKunci, parsedUraian)
                        : null;
                    const liveAk =
                      isAkuntansiTask && parsedAk.length > 0 && hasKunci
                        ? koreksiAkuntansiSiswa(akuntansiKunci, parsedAk)
                        : null;
                    const isPreviewableFile = /\.(pdf|png|jpe?g|webp)$/i.test(r.NamaFile || '');

                    return (
                      <tr key={s.ID} className="hover:bg-slate-50/70">
                        <td className="py-2 px-3 tabular-nums text-slate-400">{i + 1}</td>
                        <td className="py-2 px-3 font-medium text-slate-900">
                          <div>{s.Nama}</div>
                          {r.CatatanSiswa && (
                            <div className="text-[11px] text-slate-500 italic mt-0.5">"{r.CatatanSiswa}"</div>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {r.FileID ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1">
                                <a
                                  href={`/api/tugas/file/${r.FileID}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg max-w-[180px] truncate"
                                  title={r.NamaFile}
                                >
                                  <Paperclip className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{r.NamaFile || 'Unduh Berkas'}</span>
                                </a>
                                {isPreviewableFile && (
                                  <a
                                    href={`/api/tugas/file/${r.FileID}?inline=1`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Lihat PDF / Gambar"
                                    className="inline-flex items-center justify-center p-1 text-emerald-700 bg-white hover:bg-emerald-50 border border-emerald-200 rounded-lg"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                              {r.TanggalKumpul && (
                                <div className="text-[10px] text-slate-400 tabular-nums">{r.TanggalKumpul}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">
                              {jPgCount > 0
                                ? 'Dikumpulkan via LJK PG'
                                : jUraianCount > 0
                                ? 'Dikumpulkan via Form Uraian'
                                : parsedAk.length > 0
                                ? 'Dikumpulkan via Tabel Akuntansi'
                                : 'Belum upload'}
                            </span>
                          )}
                        </td>
                        {isGradedTask && (
                          <td className="py-2 px-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {isPgTask && (
                                livePg ? (
                                  <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md tabular-nums">
                                    B:{livePg.benar} · S:{livePg.salah}
                                    {livePg.kosong > 0 ? ` · K:${livePg.kosong}` : ''}
                                  </span>
                                ) : detailObj && typeof detailObj.benar === 'number' ? (
                                  <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md tabular-nums">
                                    B:{detailObj.benar} · S:{detailObj.salah ?? 0}
                                  </span>
                                ) : jPgCount > 0 ? (
                                  <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md tabular-nums">
                                    Terisi {jPgCount}/{curTotalSoal}
                                  </span>
                                ) : r.FileID ? (
                                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-violet-50 text-violet-700 border border-violet-200 rounded-md">
                                    PDF siap dikoreksi
                                  </span>
                                ) : null
                              )}

                              {isUraianTask && (
                                liveUraian ? (
                                  <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 rounded-md tabular-nums">
                                    Sesuai:{liveUraian.sesuai} · Sebagian:{liveUraian.sebagian}
                                  </span>
                                ) : detailObj && typeof detailObj.sesuai === 'number' ? (
                                  <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 rounded-md tabular-nums">
                                    Sesuai:{detailObj.sesuai} · Sebagian:{detailObj.sebagian ?? 0}
                                  </span>
                                ) : jUraianCount > 0 ? (
                                  <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-md tabular-nums">
                                    Terisi {jUraianCount}/{uraianKunci.length || jUraianCount}
                                  </span>
                                ) : r.FileID ? (
                                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-violet-50 text-violet-700 border border-violet-200 rounded-md">
                                    PDF siap dikoreksi
                                  </span>
                                ) : null
                              )}

                              {isAkuntansiTask && (
                                liveAk ? (
                                  <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md tabular-nums">
                                    Benar:{liveAk.benar} · {liveAk.seimbangSiswa ? 'Balance' : 'Selisih D/K'}
                                  </span>
                                ) : detailObj && typeof detailObj.benar === 'number' ? (
                                  <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md tabular-nums">
                                    Benar:{detailObj.benar}/{detailObj.totalBaris ?? akuntansiKunci.length}
                                  </span>
                                ) : parsedAk.length > 0 ? (
                                  <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md tabular-nums">
                                    {parsedAk.length} baris diisi
                                  </span>
                                ) : r.FileID ? (
                                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-violet-50 text-violet-700 border border-violet-200 rounded-md">
                                    PDF siap dikoreksi
                                  </span>
                                ) : null
                              )}

                              <button
                                type="button"
                                onClick={() => openKoreksiSiswaModal(curTug, i)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg border cursor-pointer ${
                                  isUraianTask
                                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                                    : isAkuntansiTask
                                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                                }`}
                              >
                                <ClipboardCheck className="w-3 h-3" />
                                {r.FileID && !r.JawabanSiswa
                                  ? 'Koreksi PDF'
                                  : isUraianTask
                                  ? jUraianCount > 0
                                    ? 'Lihat / Koreksi'
                                    : 'Input & Koreksi Uraian'
                                  : isAkuntansiTask
                                  ? parsedAk.length > 0
                                    ? 'Lihat / Koreksi'
                                    : 'Input & Koreksi Jurnal'
                                  : jPgCount > 0
                                  ? 'Lihat / Koreksi'
                                  : 'Input & Koreksi PG'}
                              </button>
                            </div>
                          </td>
                        )}
                        <td className="py-2 px-3">
                          <select
                            value={r.Status}
                            onChange={e => {
                              const next = [...(db.Pengumpulan || [])];
                              const idx = next.findIndex(
                                q => q.TugasID === curTug.ID && q.SiswaID === s.ID
                              );
                              if (idx >= 0) next[idx] = { ...next[idx], Status: e.target.value };
                              else
                                next.push({
                                  TugasID: curTug.ID,
                                  SiswaID: s.ID,
                                  Status: e.target.value,
                                  Nilai: '',
                                  FileID: '',
                                  NamaFile: '',
                                  TanggalKumpul: '',
                                  CatatanSiswa: '',
                                  JawabanSiswa: '',
                                  DetailKoreksi: ''
                                });
                              setDb({ ...db, Pengumpulan: next });
                            }}
                            className="px-2.5 py-1 border border-slate-200 rounded-lg text-xs"
                          >
                            <option>Belum</option>
                            <option>Tepat Waktu</option>
                            <option>Terlambat</option>
                          </select>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="text"
                            value={r.Nilai}
                            onChange={e => {
                              const next = [...(db.Pengumpulan || [])];
                              const idx = next.findIndex(
                                q => q.TugasID === curTug.ID && q.SiswaID === s.ID
                              );
                              if (idx >= 0) next[idx] = { ...next[idx], Nilai: e.target.value };
                              else
                                next.push({
                                  TugasID: curTug.ID,
                                  SiswaID: s.ID,
                                  Status: 'Tepat Waktu',
                                  Nilai: e.target.value,
                                  FileID: '',
                                  NamaFile: '',
                                  TanggalKumpul: '',
                                  CatatanSiswa: '',
                                  JawabanSiswa: '',
                                  DetailKoreksi: ''
                                });
                              setDb({ ...db, Pengumpulan: next });
                            }}
                            className="w-20 px-2.5 py-1 text-right border border-slate-200 rounded-lg text-xs font-mono tabular-nums"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          );
        })() : (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
            <div className="text-xs text-slate-500">
              {activeMapelFilter !== 'ALL'
                ? `Belum ada tugas untuk mata pelajaran "${activeMapelFilter}" di kelas ${kelasObj.Nama || ''}.`
                : `Belum ada tugas di kelas ${kelasObj.Nama || ''}. Klik "+ Tambah Tugas" untuk memulai.`}
            </div>
            <button
              type="button"
              onClick={() =>
                openTambahTugas(undefined, activeMapelFilter !== 'ALL' ? activeMapelFilter : undefined)
              }
              className="px-4 py-2 text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
            >
              + Buat Tugas {activeMapelFilter !== 'ALL' ? activeMapelFilter : ''}
            </button>
          </div>
        )}
      </div>
    );
  }

  // 10. PENGOLAHAN NILAI
  function renderNil() {
    const totBobot = bobot.reduce((a, b) => a + b, 0);
    const todayStr = ymd(new Date());
    const poinRowsAll: any[] = db.PoinSiswa || [];

    const siswaPoinMap = new Map<string, ReturnType<typeof computeStudentPoinStats>>();
    siswaK.forEach((s: any) => {
      siswaPoinMap.set(s.ID, computeStudentPoinStats(poinRowsAll, s.ID, S, todayStr));
    });
    const totalReadyNilaiClass = siswaK.reduce(
      (sum: number, s: any) => sum + (siswaPoinMap.get(s.ID)?.nilaiSiapDitambahkan || 0),
      0
    );
    const totalReadyStudentsClass = siswaK.filter(
      (s: any) => (siswaPoinMap.get(s.ID)?.nilaiSiapDitambahkan || 0) > 0
    ).length;

    const openModalPoinNilai = () => setPoinNilaiModalOpen(true);

    const updateNilaiField = (sid: string, field: string, val: string) => {
      const next = [...(db.Nilai || [])];
      const idx = next.findIndex(n => n.Kelas === K && n.SiswaID === sid);
      if (idx >= 0) {
        next[idx] = { ...next[idx], [field]: val };
      } else {
        next.push({
          Kelas: K,
          SiswaID: sid,
          Sikap: '',
          Tugas: '',
          Proyek: '',
          UTS: '',
          UAS: '',
          BonusPoin: '',
          [field]: val
        });
      }
      setDb({ ...db, Nilai: next });
    };

    const isiSikapOtomatis = () => {
      const next = [...(db.Nilai || [])];
      siswaK.forEach((s: any) => {
        const st = absStat(s.ID);
        if (st.pct != null) {
          const v = String(Math.round(st.pct * 10) / 10);
          const idx = next.findIndex(n => n.Kelas === K && n.SiswaID === s.ID);
          if (idx >= 0) next[idx] = { ...next[idx], Sikap: v };
          else
            next.push({
              Kelas: K,
              SiswaID: s.ID,
              Sikap: v,
              Tugas: '',
              Proyek: '',
              UTS: '',
              UAS: '',
              BonusPoin: ''
            });
        }
      });
      setDb({ ...db, Nilai: next });
      showToast('Nilai Kehadiran & Sikap diisi otomatis dari persentase absensi');
    };

    const isiTugasOtomatis = () => {
      const ids = tugasK.map((t: any) => t.ID);
      const next = [...(db.Nilai || [])];
      siswaK.forEach((s: any) => {
        const vals = (db.Pengumpulan || [])
          .filter((p: any) => p.SiswaID === s.ID && ids.includes(p.TugasID) && num(p.Nilai) != null)
          .map((p: any) => num(p.Nilai) as number);
        if (vals.length) {
          const avg = String(
            Math.round((vals.reduce((a: number, b: number) => a + b, 0) / vals.length) * 10) / 10
          );
          const idx = next.findIndex(n => n.Kelas === K && n.SiswaID === s.ID);
          if (idx >= 0) next[idx] = { ...next[idx], Tugas: avg };
          else
            next.push({
              Kelas: K,
              SiswaID: s.ID,
              Sikap: '',
              Tugas: avg,
              Proyek: '',
              UTS: '',
              UAS: '',
              BonusPoin: ''
            });
        }
      });
      setDb({ ...db, Nilai: next });
      showToast('Nilai Tugas diisi otomatis dari rata-rata tugas terkumpul');
    };

    const eksporCSV = () => {
      const kepala = [
        'No',
        'NIS',
        'Nama',
        ...KOLOM_NILAI.map(k => k[1]),
        'Bonus Poin Login',
        'Nilai Akhir',
        'Predikat',
        'Tindak Lanjut'
      ];
      const rows = siswaK.map((s: any, i: number) => {
        const r = getNilaiRow(s.ID) || {};
        const a = hitungAkhir(r);
        return [
          i + 1,
          s.NIS,
          s.Nama,
          ...KOLOM_NILAI.map(k => String(r[k[0]] || '').replace('.', ',')),
          String(r.BonusPoin || '').replace('.', ','),
          a == null ? '' : fmt(a),
          a == null ? '' : getPredikat(a)[0],
          a == null ? '' : getTindakLanjut(a)
        ];
      });
      const csv = '\uFEFF' + [kepala, ...rows].map(r => r.join(';')).join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Nilai_${kelasObj.Nama || 'Kelas'}.csv`;
      a.click();
      showToast('Berkas CSV berhasil diunduh');
    };

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-md noprint">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pengolahan Nilai Induk</h1>
            <p className="text-xs text-blue-100 mt-1">
              Tahap 7 &amp; 8: kalkulasi otomatis nilai akhir berbobot, tambahan poin login, predikat, dan rekomendasi tindak lanjut.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={openModalPoinNilai}
              className="px-3 py-1.5 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-amber-950 rounded-xl flex items-center gap-1.5 shadow-sm whitespace-nowrap cursor-pointer"
            >
              <Star className="w-3.5 h-3.5 fill-amber-700 text-amber-800" />
              Poin Login → Nilai
              {totalReadyNilaiClass > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-rose-600 text-white tabular-nums">
                  +{totalReadyNilaiClass}
                </span>
              )}
            </button>
            <button
              onClick={isiSikapOtomatis}
              className="px-3 py-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl whitespace-nowrap cursor-pointer"
            >
              Isi Kehadiran dari Absensi
            </button>
            <button
              onClick={isiTugasOtomatis}
              className="px-3 py-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl whitespace-nowrap cursor-pointer"
            >
              Isi Tugas dari Rata-rata
            </button>
            <button
              onClick={() => setImportModalMode('nilai')}
              className="px-3 py-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" /> Impor CSV
            </button>
            <button
              onClick={eksporCSV}
              className="px-3 py-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Ekspor CSV
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Cetak
            </button>
            <button
              onClick={() => persistSheets(db, 'Nilai')}
              className="px-4 py-1.5 text-xs font-semibold bg-white text-indigo-700 hover:bg-indigo-50 rounded-xl flex items-center gap-1.5 shadow-sm whitespace-nowrap cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Simpan Nilai
            </button>
          </div>
        </div>

        {totalReadyNilaiClass > 0 && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-amber-950 noprint">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 fill-amber-400 text-amber-500 shrink-0" />
              <span>
                Terdapat <strong>{totalReadyStudentsClass} siswa</strong> yang sudah mengonversi poin login (total{' '}
                <strong>+{totalReadyNilaiClass} nilai</strong>) dan siap ditambahkan ke nilai siswa.
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openModalPoinNilai}
                className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg cursor-pointer"
              >
                Pilih Komponen / Kelola
              </button>
              <button
                type="button"
                onClick={() => applyReadyPoinForStudents(siswaK.map((x: any) => x.ID), 'SESUAI_SISWA')}
                className="px-3.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg inline-flex items-center gap-1 cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" /> Tambahkan Semua ke Nilai (+{totalReadyNilaiClass})
              </button>
            </div>
          </div>
        )}

        {totBobot !== 100 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
            Total bobot komponen saat ini <strong>{totBobot}%</strong> (seharusnya 100%). Sesuaikan di menu Pengaturan.
          </div>
        )}

        <PrintHeader />

        <div className="bg-white border border-indigo-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-indigo-50/80 border-b border-indigo-100 text-indigo-900">
                <tr>
                  <th className="py-3 px-3 w-10">#</th>
                  <th className="py-3 px-3">Nama Siswa</th>
                  <th className="py-3 px-2 text-center">Sikap ({bobot[0]}%)</th>
                  <th className="py-3 px-2 text-center">Tugas ({bobot[1]}%)</th>
                  <th className="py-3 px-2 text-center">Proyek ({bobot[2]}%)</th>
                  <th className="py-3 px-2 text-center">UTS ({bobot[3]}%)</th>
                  <th className="py-3 px-2 text-center">UAS ({bobot[4]}%)</th>
                  <th className="py-3 px-2 text-center">Bonus Poin</th>
                  <th className="py-3 px-3 text-right">Nilai Akhir</th>
                  <th className="py-3 px-3 text-center">Predikat</th>
                  <th className="py-3 px-3">Tindak Lanjut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {siswaK.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-10 px-4 text-center text-xs text-slate-500">
                      Belum ada siswa di kelas ini. Tambahkan siswa di menu{' '}
                      <button
                        type="button"
                        onClick={() => setTab('sis')}
                        className="text-indigo-600 font-semibold hover:underline cursor-pointer"
                      >
                        Data Siswa
                      </button>{' '}
                      untuk mulai menginput nilai.
                    </td>
                  </tr>
                ) : (
                  siswaK.map((s: any, i: number) => {
                    const r = getNilaiRow(s.ID) || {};
                    const a = hitungAkhir(r);
                    const pr = getPredikat(a);
                    const pStats = siswaPoinMap.get(s.ID);
                    return (
                      <tr key={s.ID} className="hover:bg-slate-50/70">
                        <td className="py-2 px-3 tabular-nums text-slate-400">{i + 1}</td>
                        <td className="py-2 px-3">
                          <div className="font-semibold text-slate-900 flex flex-wrap items-center gap-1.5">
                            <span>{s.Nama}</span>
                            {pStats && pStats.totalBintang > 0 && (
                              <span
                                title={`Bintang Login: ${pStats.totalBintang} · Saldo Poin: ${pStats.saldoPoin}`}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold tabular-nums"
                              >
                                <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-500" />
                                {pStats.totalBintang}
                              </span>
                            )}
                          </div>
                          {pStats && (pStats.saldoPoin > 0 || pStats.nilaiSiapDitambahkan > 0) && (
                            <div className="text-[10px] text-slate-500 tabular-nums mt-0.5">
                              Saldo: <strong className="text-amber-700">{pStats.saldoPoin} poin</strong>
                              {pStats.nilaiSiapDitambahkan > 0 && (
                                <span className="ml-1.5 text-emerald-700 font-bold">
                                  · Siap +{pStats.nilaiSiapDitambahkan} nilai
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        {['Sikap', 'Tugas', 'Proyek', 'UTS', 'UAS'].map(f => (
                          <td key={f} className="py-2 px-2 text-center">
                            <input
                              type="text"
                              value={r[f] || ''}
                              onChange={e => updateNilaiField(s.ID, f, e.target.value)}
                              className="w-16 px-2 py-1 text-center border border-slate-200 rounded-md font-mono tabular-nums text-xs"
                            />
                          </td>
                        ))}
                        <td className="py-2 px-2 text-center">
                          <div className="inline-flex items-center gap-1 justify-center">
                            <input
                              type="text"
                              value={r.BonusPoin || ''}
                              placeholder="0"
                              onChange={e => updateNilaiField(s.ID, 'BonusPoin', e.target.value)}
                              className="w-14 px-2 py-1 text-center border border-amber-200 bg-amber-50/40 rounded-md font-mono tabular-nums text-xs text-amber-900"
                            />
                            {pStats && pStats.nilaiSiapDitambahkan > 0 && (
                              <button
                                type="button"
                                title={`Tambahkan +${pStats.nilaiSiapDitambahkan} nilai hasil konversi poin`}
                                onClick={() => applyReadyPoinForStudents([s.ID], 'SESUAI_SISWA')}
                                className="px-1.5 py-1 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md cursor-pointer noprint"
                              >
                                +{pStats.nilaiSiapDitambahkan}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                          {fmt(a)}
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-indigo-600">{pr[0]}</td>
                        <td className="py-2 px-3 text-slate-600">{getTindakLanjut(a)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 11. JURNAL PERILAKU
  function renderPer() {
    const list = (db.Perilaku || [])
      .filter((p: any) => p.Kelas === K)
      .sort((a: any, b: any) => b.Tanggal.localeCompare(a.Tanggal));
    const pos = list.filter((p: any) => p.Jenis !== 'Pelanggaran').length;
    const neg = list.length - pos;

    const openCatatPerilaku = (initialCatatan?: string, initialJenis?: string) => {
      let tgl = ymd(new Date());
      let sasaran = 'massal';
      let sid = siswaK[0]?.ID || '';
      let jenis = initialJenis || 'Penguatan positif';
      let lvl = '1';
      let cat = initialCatatan || '';
      let tl = initialCatatan ? 'Apresiasi kesepakatan kelas' : '';

      setModalContent({
        title: 'Catat Jurnal Perilaku Siswa',
        wide: true,
        render: () => (
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-slate-700">
                Tanggal
                <input
                  type="date"
                  defaultValue={tgl}
                  onChange={e => (tgl = e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Sasaran Pencatatan
                <select
                  defaultValue={sasaran}
                  onChange={e => {
                    sasaran = e.target.value;
                  }}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 bg-slate-50"
                >
                  <option value="massal">👥 Seluruh Siswa Kelas (Massal)</option>
                  <option value="individu">👤 Per Siswa (Individu)</option>
                </select>
              </label>
            </div>

            {sasaran === 'individu' && (
              <label className="block text-xs font-semibold text-slate-700">
                Pilih Siswa
                <select
                  defaultValue={sid}
                  onChange={e => (sid = e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  {siswaK.map((s: any) => (
                    <option key={s.ID} value={s.ID}>
                      {s.Nama}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-slate-700">
                Kategori
                <select
                  defaultValue={jenis}
                  onChange={e => (jenis = e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option>Penguatan positif</option>
                  <option>Pelanggaran</option>
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Level (Jika Pelanggaran)
                <select
                  defaultValue={lvl}
                  onChange={e => (lvl = e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  {[1, 2, 3, 4].map(l => (
                    <option key={l} value={String(l)}>
                      Level {l} · {LEVEL[l][0]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-700">Pilih Cepat Poin Kesepakatan (01–05)</div>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-1.5">
                {ATURAN.map((a, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      cat = `Poin 0${idx + 1} (${a[0]}): ${a[1]}`;
                    }}
                    className="p-2 text-left bg-slate-50 hover:bg-rose-50 border border-slate-200 rounded-lg text-[11px] cursor-pointer"
                  >
                    <div className="font-bold text-rose-700">0{idx + 1}. {a[0]}</div>
                  </button>
                ))}
              </div>
            </div>

            <label className="block text-xs font-semibold text-slate-700">
              Catatan Perilaku & Dampaknya
              <input
                defaultValue={cat}
                onChange={e => (cat = e.target.value)}
                placeholder="Mis. Membantu membersihkan kelas dan menjaga ketertiban"
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Tindak Lanjut / Apresiasi
              <input
                defaultValue={tl}
                onChange={e => (tl = e.target.value)}
                placeholder="Mis. Diberikan pujian di depan kelas"
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setModalContent(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  if (!cat.trim()) return showToast('Masukkan catatan perilaku terlebih dahulu');
                  if (sasaran === 'individu' && !sid) return showToast('Pilih siswa terlebih dahulu');
                  if (sasaran === 'massal' && siswaK.length === 0) return showToast('Belum ada siswa di kelas ini');

                  const isPos = jenis !== 'Pelanggaran';
                  const baseEntry = {
                    Kelas: K,
                    Tanggal: tgl,
                    Jenis: jenis,
                    Level: isPos ? '' : lvl,
                    Catatan: cat.trim(),
                    TindakLanjut: tl.trim()
                  };

                  let newEntries: any[] = [];
                  if (sasaran === 'massal') {
                    newEntries = siswaK.map((s: any) => ({
                      ...baseEntry,
                      ID: uid(),
                      SiswaID: s.ID
                    }));
                  } else {
                    newEntries = [
                      {
                        ...baseEntry,
                        ID: uid(),
                        SiswaID: sid
                      }
                    ];
                  }

                  const next = [...(db.Perilaku || []), ...newEntries];
                  setModalContent(null);
                  await persistSheets({ ...db, Perilaku: next }, 'Perilaku');
                  showToast(
                    sasaran === 'massal'
                      ? `Jurnal perilaku berhasil dicatat secara massal untuk ${siswaK.length} siswa!`
                      : 'Jurnal perilaku siswa berhasil disimpan!'
                  );
                }}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg cursor-pointer"
              >
                Simpan Jurnal Perilaku
              </button>
            </div>
          </div>
        )
      });
    };

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-600 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-md">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Jurnal Perilaku & Kesepakatan Kelas</h1>
            <p className="text-xs text-rose-50 mt-1">
              Rasio ideal penguatan positif berbanding koreksi adalah 4 : 1 (Tercatat saat ini: <strong>{pos} positif : {neg} koreksi</strong>). Poin 1 s.d. 5 dapat dicatat secara massal maupun per individu.
            </p>
          </div>
          <button
            onClick={() => openCatatPerilaku()}
            className="px-4 py-2 text-xs font-semibold bg-white text-rose-700 hover:bg-rose-50 rounded-xl shadow-sm whitespace-nowrap cursor-pointer"
          >
            + Catat Jurnal Perilaku
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {ATURAN.map((a, i) => {
            const ruleColors = [
              'from-sky-50 to-blue-50 border-sky-200 text-sky-700',
              'from-emerald-50 to-teal-50 border-emerald-200 text-emerald-700',
              'from-amber-50 to-orange-50 border-amber-200 text-amber-700',
              'from-violet-50 to-purple-50 border-violet-200 text-violet-700',
              'from-rose-50 to-pink-50 border-rose-200 text-rose-700'
            ][i % 5];
            return (
              <div key={i} className={`bg-gradient-to-br ${ruleColors} border rounded-2xl p-4 shadow-2xs flex flex-col justify-between gap-2`}>
                <div>
                  <div className="text-xs font-mono font-bold">0{i + 1}</div>
                  <div className="text-sm font-bold text-slate-900 mt-1">{a[0]}</div>
                  <div className="text-xs text-slate-600 mt-0.5">{a[1]}</div>
                </div>
                <button
                  type="button"
                  onClick={() => openCatatPerilaku(`Poin 0${i + 1} (${a[0]}): ${a[1]}`, 'Penguatan positif')}
                  className="w-full py-1 text-[11px] font-bold bg-white hover:bg-rose-600 hover:text-white text-rose-700 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                >
                  + Apresiasi Poin 0{i + 1}
                </button>
              </div>
            );
          })}
        </div>

        <div className="bg-white border border-rose-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-rose-50/70 border-b border-rose-100 text-rose-900">
                <tr>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Nama Siswa</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4">Catatan Perilaku</th>
                  <th className="py-3 px-4">Tindak Lanjut</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 px-4 text-center text-xs text-slate-500">
                      Belum ada catatan perilaku untuk kelas ini.
                    </td>
                  </tr>
                ) : (
                  list.map((p: any) => (
                    <tr key={p.ID}>
                      <td className="py-2.5 px-4 tabular-nums text-slate-600">{p.Tanggal}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">
                        {namaSiswa(p.SiswaID)}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`font-semibold ${
                            p.Jenis === 'Pelanggaran' ? 'text-rose-600' : 'text-emerald-700'
                          }`}
                        >
                          {p.Jenis === 'Pelanggaran' ? `Pelanggaran Level ${p.Level}` : 'Penguatan Positif'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-700">{p.Catatan}</td>
                      <td className="py-2.5 px-4 text-slate-600">{p.TindakLanjut}</td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={async () => {
                            const next = db.Perilaku.filter((x: any) => x.ID !== p.ID);
                            await persistSheets({ ...db, Perilaku: next }, 'Perilaku');
                          }}
                          className="text-rose-600 hover:underline font-medium"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 12. KALENDER PENDIDIKAN JAWA BARAT & CHECKLIST
  function renderKal() {
    const mg = mingguKe();
    const toggleChecklist = async (i: number) => {
      const next = [...(db.Checklist || [])];
      const idx = next.findIndex(c => c.Kelas === K && c.Item === String(i));
      if (idx >= 0) {
        next[idx] = { ...next[idx], Selesai: next[idx].Selesai === '1' ? '0' : '1' };
      } else {
        next.push({ Kelas: K, Item: String(i), Selesai: '1' });
      }
      await persistSheets({ ...db, Checklist: next }, 'Checklist');
    };

    return (
      <KalenderPendidikan
        kelasId={K}
        peran={peran}
        pengaturan={S}
        akademik={db.Akademik || []}
        checklist={db.Checklist || []}
        mingguKe={mg}
        akBulan={akBulan}
        onChangeAkBulan={setAkBulan}
        onSaveAkademik={nextAkademik => persistSheets({ ...db, Akademik: nextAkademik }, 'Akademik')}
        onToggleChecklist={toggleChecklist}
        onSyncJabar={syncKaldikJabar}
        onToggleAutoSync={toggleKaldikAutoSync}
        askConfirm={askConfirm}
        showToast={showToast}
      />
    );
  }

  // 13. PANDUAN 8 TAHAP
  function renderPan() {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 text-white rounded-2xl p-6 shadow-md">
          <h1 className="text-2xl font-bold tracking-tight">Panduan Operasional 8 Tahap</h1>
          <p className="text-xs text-amber-50 mt-1">
            Standar prosedur operasional manajemen kelas dari persiapan awal semester hingga pelaporan rapor.
          </p>
        </div>

        <div className="space-y-3">
          {TAHAP.map(t => (
            <div
              key={t.n}
              style={{ borderColor: `${t.c}35` }}
              className="bg-white border-2 rounded-2xl p-6 space-y-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    style={{ backgroundColor: t.c }}
                    className="w-9 h-9 rounded-xl text-white font-bold text-xs flex items-center justify-center tabular-nums shadow-sm"
                  >
                    0{t.n}
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{t.t}</h3>
                    <div className="text-xs text-slate-500">{t.w}</div>
                  </div>
                </div>
                <button
                  onClick={() => setTab(t.tab)}
                  style={{ backgroundColor: `${t.c}15`, color: t.c }}
                  className="px-3.5 py-1.5 text-xs font-bold hover:brightness-95 rounded-xl whitespace-nowrap cursor-pointer"
                >
                  Buka Fitur →
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100 text-xs">
                <div>
                  <div className="font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-1.5">
                    Kegiatan Utama
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-slate-700">
                    {t.k.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-1.5">
                    Dokumen & Instrumen
                  </div>
                  <div className="text-slate-700">{t.d.join(' · ')}</div>
                </div>
                <div>
                  <div className="font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-1.5">
                    Indikator Keberhasilan
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-slate-700">
                    {t.i.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 14. AKUN SAYA (GURU / WALI)
  function renderUsr() {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 text-white rounded-2xl p-6 shadow-md">
          <h1 className="text-2xl font-bold tracking-tight">Akun Saya</h1>
          <p className="text-xs text-sky-100 mt-1">
            Masuk sebagai {db.namaPengguna} ({peranLabel(peran)}).
          </p>
        </div>
        <div className="bg-white border border-sky-100 rounded-2xl p-6 max-w-lg space-y-4 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">Ganti Kata Sandi</h2>
          <form
            onSubmit={async e => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const l = String(fd.get('lama') || '');
              const b = String(fd.get('baru') || '');
              if (b.length < 8) return showToast('Kata sandi baru minimal 8 karakter');
              try {
                await apiCall('api_gantiSandiSaya', l, b);
                e.currentTarget.reset();
                showToast('Kata sandi berhasil diperbarui');
              } catch (err: any) {
                showToast(pesanErr(err), 4000);
              }
            }}
            className="space-y-3"
          >
            <label className="block text-xs font-semibold text-slate-700">
              Kata Sandi Lama
              <div className="mt-1">
                <PasswordField
                  name="lama"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Kata Sandi Baru (minimal 8 karakter)
              <div className="mt-1">
                <PasswordField
                  name="baru"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </label>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg"
            >
              Simpan Kata Sandi Baru
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 15. PENGATURAN (ADMIN)
  function openModalPengguna(id?: string) {
    const u = (db.Pengguna || []).find((x: any) => x.ID === id) || {};
    let nama = u.Nama || '';
    let username = u.Username || '';
    let sandi = '';
    const waliSet = new Set<string>(String(u.KelasWali || '').split(',').filter(Boolean));
    const mengSet = new Set<string>(String(u.KelasMengajar || '').split(',').filter(Boolean));
    const mapelSet = new Set<string>(String(u.Mapel || '').split(',').filter(Boolean));

    setModalContent({
      title: id ? 'Edit Akun Guru / Wali Kelas' : 'Tambah Akun Guru / Wali Kelas',
      wide: true,
      render: () => (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-slate-700">
              Nama Lengkap Guru
              <input
                defaultValue={nama}
                onChange={e => (nama = e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Nama Pengguna Login (minimal 3 karakter)
              <input
                defaultValue={username}
                onChange={e => (username = e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </label>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-700 mb-1">
              Penugasan Per Kelas (Wali Kelas vs Guru Mapel)
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2 px-3">Kelas</th>
                    <th className="py-2 px-3 text-center">Sebagai Wali Kelas</th>
                    <th className="py-2 px-3 text-center">Sebagai Guru Mengajar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(db.Kelas || []).map((kls: any) => (
                    <tr key={kls.ID}>
                      <td className="py-2 px-3 font-medium text-slate-900">{kls.Nama}</td>
                      <td className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          defaultChecked={waliSet.has(kls.ID)}
                          onChange={e => {
                            if (e.target.checked) waliSet.add(kls.ID);
                            else waliSet.delete(kls.ID);
                          }}
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          defaultChecked={mengSet.has(kls.ID)}
                          onChange={e => {
                            if (e.target.checked) mengSet.add(kls.ID);
                            else mengSet.delete(kls.ID);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-700 mb-1.5">
              Mata Pelajaran yang Diampu
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(db.Mapel || []).map((m: any) => (
                <label key={m.ID} className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    defaultChecked={mapelSet.has(m.ID)}
                    onChange={e => {
                      if (e.target.checked) mapelSet.add(m.ID);
                      else mapelSet.delete(m.ID);
                    }}
                  />
                  <span>{m.Nama}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="block text-xs font-semibold text-slate-700">
            {id
              ? 'Kata Sandi Baru (Kosongkan jika tidak diganti)'
              : 'Kata Sandi (Kosongkan untuk dibuatkan acak otomatis)'}
            <div className="mt-1">
              <PasswordField
                placeholder="Minimal 8 karakter"
                onChange={e => (sandi = e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setModalContent(null)}
              className="px-4 py-2 text-xs font-semibold bg-slate-100 rounded-lg"
            >
              Batal
            </button>
            <button
              onClick={async () => {
                try {
                  const r = await apiCall('api_simpanPengguna', {
                    ID: id || '',
                    Nama: nama,
                    Username: username,
                    Sandi: sandi,
                    KelasWali: Array.from(waliSet),
                    KelasMengajar: Array.from(mengSet),
                    Mapel: Array.from(mapelSet)
                  });
                  setDb({ ...db, Pengguna: r.daftar });
                  setModalContent(null);
                  if (r.sandi) {
                    setModalContent({
                      title: 'Akun Pengguna Siap Dipakai',
                      render: () => (
                        <div className="space-y-3 text-center">
                          <div className="text-xs text-slate-600">
                            Nama Pengguna: <strong>{r.username}</strong>
                          </div>
                          <div className="py-3 bg-slate-100 rounded-xl font-mono text-2xl font-bold text-slate-900">
                            {r.sandi}
                          </div>
                          <p className="text-xs text-slate-500">
                            Catat kata sandi ini dan berikan kepada guru terkait.
                          </p>
                          <button
                            onClick={() => setModalContent(null)}
                            className="w-full py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg"
                          >
                            Selesai
                          </button>
                        </div>
                      )
                    });
                  } else {
                    showToast('Data pengguna tersimpan');
                  }
                } catch (e: any) {
                  showToast(pesanErr(e), 4500);
                }
              }}
              className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg"
            >
              Simpan Pengguna
            </button>
          </div>
        </div>
      )
    });
  }

  function renderSet() {
    const namaMapelIds = (ids: string) =>
      String(ids || '')
        .split(',')
        .map(id => (db.Mapel || []).find((m: any) => m.ID === id)?.Nama)
        .filter(Boolean)
        .join(', ');

    const kelasPeran = (u: any) =>
      String(u.Kelas || '')
        .split(',')
        .filter(Boolean)
        .map(id => {
          const w = String(u.KelasWali || '').split(',').includes(id);
          const m = String(u.KelasMengajar || '').split(',').includes(id);
          const n = (db.Kelas || []).find((k: any) => k.ID === id)?.Nama;
          return n ? `${n} (${w && m ? 'wali+guru' : w ? 'wali' : 'guru'})` : '';
        })
        .filter(Boolean)
        .join(', ');

    const jurusanList = Array.from(
      new Set(
        String(S.jurusan || 'MIPA, IPS, Bahasa')
          .split(',')
          .map(x => x.trim())
          .filter(Boolean)
      )
    );

    const handleLogoUpload = async (file: File) => {
      if (!file.type.startsWith('image/')) {
        return showToast('Pilih berkas gambar (PNG, JPG, WebP, atau SVG)');
      }
      try {
        showToast('Memproses logo sekolah…', 4000);
        const dataUrl: string = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error('Gagal membaca berkas gambar'));
          reader.onload = () => {
            const raw = String(reader.result || '');
            if (file.type === 'image/svg+xml' || raw.length < 60000) {
              resolve(raw);
              return;
            }
            const img = new Image();
            img.onload = () => {
              const maxDim = 240;
              const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
              const w = Math.max(1, Math.round(img.width * scale));
              const h = Math.max(1, Math.round(img.height * scale));
              const canvas = document.createElement('canvas');
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              if (!ctx) return resolve(raw);
              ctx.drawImage(img, 0, 0, w, h);
              resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => resolve(raw);
            img.src = raw;
          };
          reader.readAsDataURL(file);
        });
        const baru = { ...S, logo: dataUrl };
        await apiCall('api_savePengaturan', baru);
        setDb(prev => ({ ...prev, Pengaturan: baru }));
        setPublicInfo(p => ({ ...p, logo: dataUrl }));
        showToast('Logo sekolah berhasil diperbarui');
      } catch (err: any) {
        showToast(pesanErr(err), 4000);
      }
    };

    const jurusanLogosMap = parseJurusanLogos(S.jurusanLogos);

    const simpanDaftarJurusan = async (nextList: string[], nextLogos?: Record<string, string>) => {
      const cleaned = Array.from(new Set(nextList.map(j => j.trim()).filter(Boolean)));
      const srcLogos = nextLogos || jurusanLogosMap;
      const filteredLogos: Record<string, string> = {};
      cleaned.forEach(name => {
        if (srcLogos[name]) filteredLogos[name] = srcLogos[name];
      });
      const logosJson = JSON.stringify(filteredLogos);
      const baru = { ...S, jurusan: cleaned.join(', '), jurusanLogos: logosJson };
      try {
        await apiCall('api_savePengaturan', baru);
        setDb(prev => ({ ...prev, Pengaturan: baru }));
        setPublicInfo(p => ({ ...p, jurusan: baru.jurusan, jurusanLogos: logosJson }));
        showToast('Daftar & logo jurusan diperbarui');
      } catch (err: any) {
        showToast('Gagal menyimpan jurusan: ' + pesanErr(err), 4000);
      }
    };

    const handleJurusanLogoUpload = async (jurusanName: string, file: File) => {
      try {
        showToast(`Memproses logo ${jurusanName}…`, 4000);
        const dataUrl = await prosesLogoGambar(file, 160);
        const nextLogos = { ...jurusanLogosMap, [jurusanName]: dataUrl };
        await simpanDaftarJurusan(jurusanList, nextLogos);
      } catch (err: any) {
        showToast(pesanErr(err), 4000);
      }
    };

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-slate-800 via-indigo-900 to-violet-900 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-md">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pengaturan Sekolah & Sistem</h1>
            <p className="text-xs text-indigo-100 mt-1">
              Konfigurasi logo sekolah, jurusan, WhatsApp informasi, bobot penilaian, daftar kelas, dan akun pengguna.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('rst')}
              className="px-3.5 py-2 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white rounded-xl shadow-sm whitespace-nowrap cursor-pointer flex items-center gap-1.5"
            >
              <Database className="w-3.5 h-3.5" /> Menu Backup & Database
            </button>
            <button
              type="button"
              onClick={async () => {
                if (
                  await askConfirm(
                    'Reset seluruh data aplikasi kembali ke data pratinjau awal (SMA Negeri 1 Nusantara)?'
                  )
                ) {
                  await handleResetDemoData();
                }
              }}
              className="px-3.5 py-2 text-xs font-semibold bg-rose-500 hover:bg-rose-400 text-white rounded-xl shadow-sm whitespace-nowrap cursor-pointer"
            >
              Reset Data Pratinjau Awal
            </button>
          </div>
        </div>

        {/* Logo Sekolah Card */}
        <div className="bg-white border border-indigo-100 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4">
            {S.logo ? (
              <img
                src={S.logo}
                alt={S.sekolah || 'Logo Sekolah'}
                className="w-16 h-16 rounded-2xl object-contain bg-indigo-50 border border-indigo-200 p-1.5 shadow-xs shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white flex items-center justify-center shadow-sm shrink-0">
                <ImageIcon className="w-7 h-7" />
              </div>
            )}
            <div>
              <h2 className="text-base font-bold text-slate-900">Logo Resmi Sekolah</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Ditampilkan di halaman masuk, sidebar, header portal siswa, serta laporan cetak (PNG, JPG, WebP, atau SVG).
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer">
              <Upload className="w-3.5 h-3.5" /> Ganti Logo Sekolah
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleLogoUpload(f);
                  e.target.value = '';
                }}
              />
            </label>
            {S.logo && (
              <button
                type="button"
                onClick={async () => {
                  const baru = { ...S, logo: '' };
                  await apiCall('api_savePengaturan', baru);
                  setDb(prev => ({ ...prev, Pengaturan: baru }));
                  setPublicInfo(p => ({ ...p, logo: '' }));
                  showToast('Logo dikembalikan ke ikon bawaan');
                }}
                className="px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer"
              >
                Reset Logo Bawaan
              </button>
            )}
          </div>
        </div>

        {/* Gambar Latar Laman Login Card */}
        <div className="bg-white border border-indigo-100 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              {resolveLoginBgUrl(S.loginBg || DEFAULT_LOGIN_BG) ? (
                <img
                  src={resolveLoginBgUrl(S.loginBg || DEFAULT_LOGIN_BG)}
                  alt="Pratinjau Latar Login"
                  referrerPolicy="no-referrer"
                  className="w-24 h-16 rounded-xl object-cover border border-indigo-200 shadow-xs shrink-0"
                />
              ) : (
                <div className="w-24 h-16 rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-sky-500 border border-indigo-200 shadow-xs shrink-0" />
              )}
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900">Gambar Latar Laman Login</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Aktif: <span className="font-semibold text-indigo-700">{getLoginBgLabel(S.loginBg || DEFAULT_LOGIN_BG)}</span> · Pilih tema pembelajaran bawaan atau unggah foto sekolah sendiri.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> Unggah Gambar Latar
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async e => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f) return;
                    try {
                      showToast('Memproses gambar latar…', 4000);
                      const dataUrl = await prosesBackgroundGambar(f);
                      const baru = { ...S, loginBg: dataUrl };
                      await apiCall('api_savePengaturan', baru);
                      setDb(prev => ({ ...prev, Pengaturan: baru }));
                      setPublicInfo(p => ({ ...p, loginBg: dataUrl }));
                      setLoginBgError(false);
                      showToast('Gambar latar laman login berhasil diperbarui');
                    } catch (err: any) {
                      showToast(pesanErr(err), 4000);
                    }
                  }}
                />
              </label>
              {(S.loginBg || DEFAULT_LOGIN_BG) !== DEFAULT_LOGIN_BG && (
                <button
                  type="button"
                  onClick={async () => {
                    const baru = { ...S, loginBg: DEFAULT_LOGIN_BG };
                    await apiCall('api_savePengaturan', baru);
                    setDb(prev => ({ ...prev, Pengaturan: baru }));
                    setPublicInfo(p => ({ ...p, loginBg: DEFAULT_LOGIN_BG }));
                    setLoginBgError(false);
                    showToast('Gambar latar dikembalikan ke bawaan pembelajaran');
                  }}
                  className="px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset Bawaan
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {LOGIN_BG_PRESETS.map(preset => {
              const currentVal = S.loginBg || DEFAULT_LOGIN_BG;
              const isSelected = currentVal === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={async () => {
                    try {
                      const baru = { ...S, loginBg: preset.id };
                      await apiCall('api_savePengaturan', baru);
                      setDb(prev => ({ ...prev, Pengaturan: baru }));
                      setPublicInfo(p => ({ ...p, loginBg: preset.id }));
                      setLoginBgError(false);
                      showToast(`Latar login diubah ke ${preset.label}`);
                    } catch (err: any) {
                      showToast(pesanErr(err), 4000);
                    }
                  }}
                  className={`rounded-xl overflow-hidden border-2 text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-indigo-600 ring-2 ring-indigo-500/25 shadow-sm'
                      : 'border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <img
                    src={preset.src}
                    alt={preset.label}
                    referrerPolicy="no-referrer"
                    className="w-full h-20 object-cover"
                  />
                  <div className="px-2.5 py-1.5 bg-white flex items-center justify-between gap-1">
                    <span className="text-[11px] font-semibold text-slate-800 truncate">{preset.label}</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                  </div>
                </button>
              );
            })}
            <button
              type="button"
              onClick={async () => {
                try {
                  const baru = { ...S, loginBg: 'none' };
                  await apiCall('api_savePengaturan', baru);
                  setDb(prev => ({ ...prev, Pengaturan: baru }));
                  setPublicInfo(p => ({ ...p, loginBg: 'none' }));
                  setLoginBgError(false);
                  showToast('Latar login diubah ke gradien polos');
                } catch (err: any) {
                  showToast(pesanErr(err), 4000);
                }
              }}
              className={`rounded-xl overflow-hidden border-2 text-left transition-all cursor-pointer ${
                S.loginBg === 'none'
                  ? 'border-indigo-600 ring-2 ring-indigo-500/25 shadow-sm'
                  : 'border-slate-200 hover:border-indigo-300'
              }`}
            >
              <div className="w-full h-20 bg-gradient-to-br from-indigo-600 via-violet-600 to-sky-500" />
              <div className="px-2.5 py-1.5 bg-white flex items-center justify-between gap-1">
                <span className="text-[11px] font-semibold text-slate-800 truncate">Gradien Polos</span>
                {S.loginBg === 'none' && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
              </div>
            </button>
          </div>
        </div>

        <form
          onSubmit={async e => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const keys = [
              'sekolah',
              'jurusan',
              'waInfo',
              'emailPemulihan',
              'kodeReset',
              'guru',
              'wali',
              'semester',
              'mulai',
              'kkm',
              'b_sikap',
              'b_tugas',
              'b_proyek',
              'b_uts',
              'b_uas',
              'poinLoginAktif',
              'poinModeLogin',
              'poinPerLogin',
              'poinPerNilai',
              'poinTargetDefault'
            ];
            const baru: Record<string, string> = { ...S };
            keys.forEach(k => (baru[k] = String(fd.get(k) || '').trim()));
            const tot = ['b_sikap', 'b_tugas', 'b_proyek', 'b_uts', 'b_uas'].reduce(
              (a, k) => a + (num(baru[k]) || 0),
              0
            );
            if (tot !== 100) {
              return showToast(`Total bobot harus 100% (saat ini ${tot}%)`, 4000);
            }
            try {
              showToast('Menyimpan pengaturan…', 6000);
              await apiCall('api_savePengaturan', baru);
              setDb(prev => ({ ...prev, Pengaturan: baru }));
              const em = baru.emailPemulihan || '';
              const emailHint = em.includes('@')
                ? `${em.slice(0, Math.min(2, em.indexOf('@')))}***@${em.split('@')[1]}`
                : '';
              setPublicInfo(p => ({
                ...p,
                sekolah: baru.sekolah || p.sekolah,
                jurusan: baru.jurusan || '',
                waInfo: baru.waInfo || '',
                emailHint
              }));
              showToast('Pengaturan berhasil disimpan');
            } catch (err: any) {
              showToast(pesanErr(err), 4000);
            }
          }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          <div className="bg-white border border-indigo-100 rounded-2xl p-6 space-y-3 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Identitas Sekolah, Jurusan & WA Informasi</h2>
            {[
              ['sekolah', 'Nama Sekolah / Lembaga', 'text'],
              ['jurusan', 'Daftar Jurusan / Program Keahlian (pisahkan dengan koma)', 'text'],
              ['waInfo', 'Nomor WhatsApp Informasi Sekolah (mis. 6281234567890)', 'text'],
              ['emailPemulihan', 'Email Pemulihan Lupa Kata Sandi Admin', 'email'],
              ['kodeReset', 'Kode Pemulihan Lupa Kata Sandi Sekolah', 'text'],
              ['guru', 'Nama Guru Pengampu', 'text'],
              ['wali', 'Nama Wali Kelas Default', 'text'],
              ['semester', 'Semester Berjalan', 'text'],
              ['mulai', 'Tanggal Mulai Semester (Senin Minggu ke-1)', 'date']
            ].map(([k, label, type]) => (
              <label key={k} className="block text-xs font-semibold text-slate-700">
                {label}
                <input
                  key={`${k}|${S[k] || ''}`}
                  name={k}
                  type={type}
                  defaultValue={S[k] || ''}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                />
              </label>
            ))}
          </div>

          <div className="bg-white border border-indigo-100 rounded-2xl p-6 space-y-4 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900">Batas Ketuntasan (KKM) & Bobot Nilai</h2>
              <label className="block text-xs font-semibold text-slate-700">
                Batas Ketuntasan Minimal (KKM)
                <input
                  key={`kkm|${S.kkm || '75'}`}
                  name="kkm"
                  type="number"
                  defaultValue={S.kkm || '75'}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm tabular-nums"
                />
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  ['b_sikap', 'Kehadiran & Sikap (%)'],
                  ['b_tugas', 'Tugas & Harian (%)'],
                  ['b_proyek', 'Proyek / Praktik (%)'],
                  ['b_uts', 'UTS (%)'],
                  ['b_uas', 'UAS (%)']
                ].map(([k, label]) => (
                  <label key={k} className="block text-xs font-semibold text-slate-700">
                    {label}
                    <input
                      key={`${k}|${S[k] || '20'}`}
                      name={k}
                      type="number"
                      defaultValue={S[k] || '20'}
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm tabular-nums"
                    />
                  </label>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-200 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                  <span>Bintang &amp; Poin Login Siswa → Konversi ke Nilai</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block text-xs font-semibold text-slate-700">
                    Status Poin &amp; Bintang Login
                    <select
                      key={`poinLoginAktif|${S.poinLoginAktif ?? '1'}`}
                      name="poinLoginAktif"
                      defaultValue={S.poinLoginAktif ?? '1'}
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                    >
                      <option value="1">Aktif (Siswa dapat ★ &amp; poin saat login)</option>
                      <option value="0">Nonaktif</option>
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-slate-700">
                    Frekuensi Pemberian Poin Login
                    <select
                      key={`poinModeLogin|${S.poinModeLogin || 'harian'}`}
                      name="poinModeLogin"
                      defaultValue={S.poinModeLogin || 'harian'}
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                    >
                      <option value="harian">1x Per Hari (Login Harian)</option>
                      <option value="setiap_login">Setiap Kali Siswa Login</option>
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-slate-700">
                    Poin yang Didapat per Login
                    <input
                      key={`poinPerLogin|${S.poinPerLogin || '5'}`}
                      name="poinPerLogin"
                      type="number"
                      min={1}
                      defaultValue={S.poinPerLogin || '5'}
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm tabular-nums"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-700">
                    Kurs Konversi (Poin untuk +1 Nilai)
                    <input
                      key={`poinPerNilai|${S.poinPerNilai || '5'}`}
                      name="poinPerNilai"
                      type="number"
                      min={1}
                      defaultValue={S.poinPerNilai || '5'}
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm tabular-nums"
                    />
                  </label>
                </div>
                <label className="block text-xs font-semibold text-slate-700">
                  Target Default Penambahan Nilai
                  <select
                    key={`poinTargetDefault|${S.poinTargetDefault || 'BonusPoin'}`}
                    name="poinTargetDefault"
                    defaultValue={S.poinTargetDefault || 'BonusPoin'}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                  >
                    {POIN_TARGET_OPTIONS.map(opt => (
                      <option key={opt.key} value={opt.key}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="pt-4">
              <button
                type="submit"
                className="w-full justify-center px-4 py-2.5 text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-105 text-white rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> Simpan Pengaturan Identitas, WA & Nilai
              </button>
            </div>
          </div>
        </form>

        {/* Manajemen Pengguna (Guru & Wali Kelas) */}
        <div className="bg-white border border-indigo-100 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Pengguna: Guru & Wali Kelas</h2>
              <p className="text-xs text-slate-500">
                Setiap akun hanya melihat dan mengelola kelas yang ditugaskan kepadanya.
              </p>
            </div>
            <button
              onClick={() => openModalPengguna()}
              className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl cursor-pointer"
            >
              + Tambah Pengguna
            </button>
          </div>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-indigo-50/70 border-b border-indigo-100 text-indigo-950">
                <tr>
                  <th className="py-2.5 px-3">Nama Guru</th>
                  <th className="py-2.5 px-3">Username</th>
                  <th className="py-2.5 px-3">Peran</th>
                  <th className="py-2.5 px-3">Penugasan Kelas</th>
                  <th className="py-2.5 px-3">Mata Pelajaran</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(db.Pengguna || []).map((u: any) => (
                  <tr key={u.ID}>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{u.Nama}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">{u.Username}</td>
                    <td className="py-2.5 px-3 text-slate-700">{peranLabel(u.Peran)}</td>
                    <td className="py-2.5 px-3 text-slate-600">{kelasPeran(u) || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-600">{namaMapelIds(u.Mapel) || '-'}</td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-2">
                      <button
                        onClick={() => openModalPengguna(u.ID)}
                        className="text-indigo-600 hover:underline font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={async () => {
                          if (await askConfirm(`Reset kata sandi acak baru untuk "${u.Nama}"?`)) {
                            const r = await apiCall('api_resetSandiPengguna', u.ID, '');
                            setModalContent({
                              title: 'Kata Sandi Baru Pengguna',
                              render: () => (
                                <div className="space-y-3 text-center">
                                  <div className="text-xs text-slate-600">
                                    Username: <strong>{r.username}</strong>
                                  </div>
                                  <div className="py-3 bg-indigo-50 border border-indigo-200 rounded-xl font-mono text-2xl font-bold text-indigo-900">
                                    {r.sandi}
                                  </div>
                                  <button
                                    onClick={() => setModalContent(null)}
                                    className="w-full py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg"
                                  >
                                    Selesai
                                  </button>
                                </div>
                              )
                            });
                          }
                        }}
                        className="text-amber-600 hover:underline font-medium"
                      >
                        Reset Sandi
                      </button>
                      <button
                        onClick={async () => {
                          if (await askConfirm(`Hapus akun pengguna "${u.Nama}"?`)) {
                            const listBaru = await apiCall('api_hapusPengguna', u.ID);
                            setDb({ ...db, Pengguna: listBaru });
                            showToast('Akun pengguna dihapus');
                          }
                        }}
                        className="text-rose-600 hover:underline font-medium"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Manajemen Kelas, Jurusan & Mata Pelajaran Per Kelas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-sky-100 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-sky-600" /> Daftar Kelas, Jurusan &amp; Mapel
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Atur nama kelas, jurusan, dan mata pelajaran yang dipelajari di setiap kelas (tekan Enter atau klik ikon centang untuk simpan).
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const defaultJur = jurusanList[0] || 'Umum';
                  const next = [
                    ...(db.Kelas || []),
                    { ID: uid(), Nama: `Kelas ${(db.Kelas || []).length + 1}`, Jurusan: defaultJur, Mapel: '' }
                  ];
                  await persistSheets({ ...db, Kelas: next }, 'Kelas');
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-xl whitespace-nowrap cursor-pointer"
              >
                + Tambah Kelas
              </button>
            </div>
            <div className="space-y-2.5">
              {(db.Kelas || []).map((kls: any) => {
                const pilihanJur = Array.from(
                  new Set([...jurusanList, ...(kls.Jurusan ? [kls.Jurusan] : [])])
                );
                const clsSubjects = getClassMapelList(kls.ID);

                const openModalAturMapelKelas = () => {
                  let latestMapelList = [...(db.Mapel || [])];
                  setModalContent({
                    title: `Sesuaikan Mata Pelajaran — ${kls.Nama}`,
                    wide: true,
                    render: () => (
                      <AturMapelKelasModal
                        kls={kls}
                        clsSubjects={clsSubjects}
                        allDbMapels={latestMapelList}
                        jadwalList={db.Jadwal || []}
                        showToast={showToast}
                        onClose={() => setModalContent(null)}
                        onAddGlobalMapel={async val => {
                          if (!latestMapelList.some((x: any) => String(x.Nama || '').toLowerCase() === val.toLowerCase())) {
                            latestMapelList = [...latestMapelList, { ID: uid(), Nama: val }];
                            await persistSheets({ ...db, Mapel: latestMapelList }, 'Mapel');
                          }
                        }}
                        onSave={async selectedSubjects => {
                          const mapelValue = selectedSubjects.length > 0 ? selectedSubjects.join(', ') : '__NONE__';
                          const nextKelas = (db.Kelas || []).map((x: any) =>
                            x.ID === kls.ID ? { ...x, Mapel: mapelValue } : x
                          );
                          setModalContent(null);
                          await persistSheets({ ...db, Kelas: nextKelas }, 'Kelas');
                        }}
                      />
                    )
                  });
                };

                return (
                  <EditableKelasRow
                    key={kls.ID}
                    kls={kls}
                    pilihanJur={pilihanJur}
                    clsSubjects={clsSubjects}
                    canDelete={(db.Kelas || []).length > 1}
                    onRename={async cleanName => {
                      const next = (db.Kelas || []).map((x: any) =>
                        x.ID === kls.ID ? { ...x, Nama: cleanName } : x
                      );
                      await persistSheets({ ...db, Kelas: next }, 'Kelas');
                    }}
                    onChangeJurusan={async newJur => {
                      const next = (db.Kelas || []).map((x: any) =>
                        x.ID === kls.ID ? { ...x, Jurusan: newJur } : x
                      );
                      await persistSheets({ ...db, Kelas: next }, 'Kelas');
                    }}
                    onOpenAturMapel={openModalAturMapelKelas}
                    onDelete={async () => {
                      if (
                        await askConfirm(
                          `Hapus kelas "${kls.Nama}"? Data siswa, absensi, dan nilai pada kelas ini ikut dibersihkan.`
                        )
                      ) {
                        const next = (db.Kelas || []).filter((x: any) => x.ID !== kls.ID);
                        const nextSiswa = (db.Siswa || []).filter((x: any) => x.Kelas !== kls.ID);
                        const nextAbs = (db.Absensi || []).filter((x: any) => x.Kelas !== kls.ID);
                        const nextNil = (db.Nilai || []).filter((x: any) => x.Kelas !== kls.ID);
                        const nextPoin = (db.PoinSiswa || []).filter((x: any) => x.Kelas !== kls.ID);
                        await persistSheets(
                          { ...db, Kelas: next, Siswa: nextSiswa, Absensi: nextAbs, Nilai: nextNil, PoinSiswa: nextPoin },
                          'Kelas',
                          'Siswa'
                        );
                        if (K === kls.ID) setK(next[0]?.ID || '');
                        showToast(`Kelas "${kls.Nama}" & data terkait berhasil dihapus`);
                      }
                    }}
                  />
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-violet-100 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">Daftar Jurusan &amp; Logo Jurusan</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tambahkan jurusan, ubah nama (otomatis memperbarui kelas terkait), dan unggah logo masing-masing.
                </p>
              </div>
              <button
                type="button"
                onClick={() => simpanDaftarJurusan([...jurusanList, `Jurusan ${jurusanList.length + 1}`])}
                className="px-3 py-1.5 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl whitespace-nowrap cursor-pointer"
              >
                + Tambah Jurusan
              </button>
            </div>
            <div className="space-y-2">
              {jurusanList.map((j, idx) => (
                <EditableJurusanRow
                  key={`${j}-${idx}`}
                  jurusanName={j}
                  jLogo={jurusanLogosMap[j] || ''}
                  canDelete={jurusanList.length > 1}
                  onRename={async val => {
                    const next = jurusanList.map((x, i) => (i === idx ? val : x));
                    const nextLogos = { ...jurusanLogosMap };
                    if (nextLogos[j]) {
                      nextLogos[val] = nextLogos[j];
                      delete nextLogos[j];
                    }
                    await simpanDaftarJurusan(next, nextLogos);
                    const hasKelasAffected = (db.Kelas || []).some((k: any) => k.Jurusan === j);
                    if (hasKelasAffected) {
                      const nextKelas = (db.Kelas || []).map((k: any) =>
                        k.Jurusan === j ? { ...k, Jurusan: val } : k
                      );
                      await persistSheets({ ...db, Kelas: nextKelas }, 'Kelas');
                    }
                  }}
                  onUploadLogo={f => handleJurusanLogoUpload(j, f)}
                  onDeleteLogo={async () => {
                    const nextLogos = { ...jurusanLogosMap };
                    delete nextLogos[j];
                    await simpanDaftarJurusan(jurusanList, nextLogos);
                  }}
                  onDelete={async () => {
                    if (!(await askConfirm(`Hapus jurusan "${j}"?`))) return;
                    const nextLogos = { ...jurusanLogosMap };
                    delete nextLogos[j];
                    const remaining = jurusanList.filter((_, i) => i !== idx);
                    await simpanDaftarJurusan(remaining, nextLogos);
                    const fallbackJur = remaining[0] || '';
                    const hasKelasAffected = (db.Kelas || []).some((k: any) => k.Jurusan === j);
                    if (hasKelasAffected) {
                      const nextKelas = (db.Kelas || []).map((k: any) =>
                        k.Jurusan === j ? { ...k, Jurusan: fallbackJur } : k
                      );
                      await persistSheets({ ...db, Kelas: nextKelas }, 'Kelas');
                    }
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Daftar Mata Pelajaran Sekolah */}
        <div className="bg-white border border-emerald-100 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-600" /> Daftar Mata Pelajaran Sekolah
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Tambahkan atau ubah nama mata pelajaran (otomatis memperbarui kelas, jadwal, tugas, materi &amp; perangkat ajar).
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                const namaBaru = `Mata Pelajaran ${(db.Mapel || []).length + 1}`;
                const next = [...(db.Mapel || []), { ID: uid(), Nama: namaBaru }];
                await persistSheets({ ...db, Mapel: next }, 'Mapel');
              }}
              className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl whitespace-nowrap cursor-pointer shadow-xs"
            >
              + Tambah Mata Pelajaran
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {(db.Mapel || []).map((m: any) => (
              <EditableMapelRow
                key={m.ID}
                mapel={m}
                canDelete={(db.Mapel || []).length > 1}
                onRename={async val => {
                  const oldName = String(m.Nama || '').trim();
                  const oldLower = oldName.toLowerCase();
                  const nextMapel = (db.Mapel || []).map((x: any) =>
                    x.ID === m.ID ? { ...x, Nama: val } : x
                  );
                  const replaceNameInCsv = (csv: string) =>
                    String(csv || '')
                      .split(',')
                      .map(s => {
                        const t = s.trim();
                        if (!t) return '';
                        if (t.toLowerCase() === oldLower || t === m.ID) return val;
                        return t;
                      })
                      .filter(Boolean)
                      .join(', ');

                  const nextKelas = (db.Kelas || []).map((k: any) => {
                    const raw = String(k.Mapel || '').trim();
                    if (!raw || raw === '__NONE__') return k;
                    return { ...k, Mapel: replaceNameInCsv(raw) };
                  });
                  const mapelSwap = (row: any) =>
                    String(row.Mapel || '').trim().toLowerCase() === oldLower
                      ? { ...row, Mapel: val }
                      : row;

                  await persistSheets(
                    {
                      ...db,
                      Mapel: nextMapel,
                      Kelas: nextKelas,
                      Jadwal: (db.Jadwal || []).map(mapelSwap),
                      Tugas: (db.Tugas || []).map(mapelSwap),
                      Modul: (db.Modul || []).map(mapelSwap),
                      Materi: (db.Materi || []).map(mapelSwap),
                      Pemantik: (db.Pemantik || []).map(mapelSwap),
                      CBT: (db.CBT || []).map(mapelSwap)
                    },
                    'Mapel',
                    'Kelas',
                    'Jadwal',
                    'Tugas',
                    'Modul',
                    'Materi',
                    'Pemantik',
                    'CBT'
                  );
                }}
                onDelete={async () => {
                  if (await askConfirm(`Hapus mata pelajaran "${m.Nama}"?`)) {
                    const oldLower = String(m.Nama || '').trim().toLowerCase();
                    const nextMapel = (db.Mapel || []).filter((x: any) => x.ID !== m.ID);
                    const nextKelas = (db.Kelas || []).map((k: any) => {
                      const raw = String(k.Mapel || '').trim();
                      if (!raw || raw === '__NONE__') return k;
                      const kept = raw
                        .split(',')
                        .map(s => s.trim())
                        .filter(s => s && s.toLowerCase() !== oldLower && s !== m.ID);
                      return { ...k, Mapel: kept.length > 0 ? kept.join(', ') : '__NONE__' };
                    });
                    await persistSheets({ ...db, Mapel: nextMapel, Kelas: nextKelas }, 'Mapel', 'Kelas');
                  }
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const activeView = () => {
    if (TAB_WALI.includes(tab) && !waliDi(K)) {
      return (
        <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-xl">
          <h2 className="text-lg font-bold text-slate-900">Akses Khusus Wali Kelas</h2>
          <p className="text-xs text-slate-600 mt-1">
            Menu ini hanya dapat dikelola oleh <strong>Wali Kelas</strong>. Di kelas{' '}
            <strong>{kelasObj.Nama}</strong> Anda bertugas sebagai guru mata pelajaran.
          </p>
        </div>
      );
    }
    switch (tab) {
      case 'dash':
        return renderDash();
      case 'cld':
        return (
          <CloudAiHub
            token={token}
            kelasId={K}
            kelasNama={kelasObj.Nama || ''}
            files={db.BerkasCloud || []}
            onFilesUpdated={nextFiles => {
              setDb(prev => ({ ...prev, BerkasCloud: nextFiles }));
            }}
            showToast={showToast}
          />
        );
      case 'abs':
        return renderAbs();
      case 'sis':
        return renderSis();
      case 'den':
        return renderDen();
      case 'pik':
        return renderPik();
      case 'str':
        return renderStr();
      case 'jad':
        return renderJad();
      case 'ajar':
        return renderAjar();
      case 'cbt':
        return (
          <CbtManager
            token={token}
            kelasId={K}
            kelasNama={kelasObj.Nama || ''}
            mapelList={db.Mapel || []}
            siswaList={db.Siswa || []}
            cbtList={db.CBT || []}
            hasilList={db.HasilCBT || []}
            onSaveCBT={nextCbt => persistSheets({ ...db, CBT: nextCbt }, 'CBT')}
            onSaveHasil={nextHasil => persistSheets({ ...db, HasilCBT: nextHasil }, 'HasilCBT')}
            showToast={showToast}
            askConfirm={askConfirm}
          />
        );
      case 'tug':
        return renderTug();
      case 'nil':
        return renderNil();
      case 'per':
        return renderPer();
      case 'kal':
        return renderKal();
      case 'pan':
        return renderPan();
      case 'usr':
        return renderUsr();
      case 'set':
        return renderSet();
      case 'rst':
        return (
          <ResetDatabasePanel
            db={db}
            onResetAll={handleResetAllData}
            onResetPartial={handleResetPartial}
            onResetDemo={handleResetDemoData}
            onExportBackup={handleExportBackup}
            onRestoreBackup={handleRestoreBackup}
            onListSnapshots={handleListSnapshots}
            onCreateSnapshot={handleCreateSnapshot}
            onDownloadSnapshot={handleDownloadSnapshot}
            onRestoreSnapshot={handleRestoreSnapshot}
            onDeleteSnapshot={handleDeleteSnapshot}
            askConfirm={askConfirm}
            showToast={showToast}
          />
        );
      default:
        return renderDash();
    }
  };

  return (
    <div className="min-h-screen text-slate-900 flex">
      {/* Colorful Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-gradient-to-b from-indigo-950 via-violet-950 to-slate-950 text-slate-200 flex flex-col border-r border-indigo-900/60 transition-transform lg:translate-x-0 lg:static noprint shadow-xl ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-1 rainbow-strip shrink-0" />
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-white font-bold text-sm tracking-tight min-w-0">
            {S.logo ? (
              <img
                src={S.logo}
                alt={S.sekolah || 'Logo Sekolah'}
                className="w-8 h-8 rounded-xl object-contain bg-white p-0.5 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 flex items-center justify-center shadow-sm shrink-0">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
            )}
            <span className="truncate">Manajemen Kelas</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {TABS.filter(t => tabOk(t[0])).map(([id, label, iconName]) => {
            const Icon = ICON_MAP[iconName] || LayoutDashboard;
            const on = tab === id;
            const theme = TAB_THEME[id] || TAB_THEME.dash;
            return (
              <button
                key={id}
                onClick={() => {
                  setTab(id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                  on
                    ? `${theme.active} font-semibold`
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${on ? 'bg-white/20 text-white' : theme.badge}`}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 bg-black/20 text-[11px] text-indigo-200 space-y-2">
          <div>
            <div className="font-bold text-white truncate">
              {peran === 'admin' ? 'Administrator' : db.namaPengguna}
            </div>
            <div className="truncate text-indigo-300">{peranLabel(peran)}</div>
          </div>
          {S.waInfo && (
            <a
              href={waLink(
                S.waInfo,
                `Halo Admin/Informasi ${S.sekolah || 'Sekolah'}, saya ${peran === 'admin' ? 'Admin' : db.namaPengguna} ingin berkoordinasi.`
              )}
              target={waTarget()}
              rel={waTarget() ? 'noopener noreferrer' : undefined}
              className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" /> WA Informasi Sekolah
            </a>
          )}
        </div>
      </aside>

      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-slate-950/50 z-30 lg:hidden noprint"
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-1 rainbow-strip sticky top-0 z-30 noprint" />
        {/* Top Bar Contract */}
        <header className="sticky top-1 z-20 bg-white/90 backdrop-blur-md border-b border-indigo-100 px-6 py-3 flex items-center justify-between gap-8 noprint shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg border border-indigo-200 text-indigo-700"
            >
              <Menu className="w-4 h-4" />
            </button>
            {S.logo && (
              <img
                src={S.logo}
                alt={S.sekolah}
                className="w-7 h-7 rounded-lg object-contain border border-indigo-100 bg-white p-0.5 shrink-0 hidden sm:block"
              />
            )}
            <div className="text-sm font-bold text-slate-900 truncate flex items-center gap-2">
              <span className="truncate">
                {S.sekolah} · <span className="text-indigo-600 font-semibold">Semester {S.semester}</span>
              </span>
              {activeJurusanLogo && (
                <img
                  src={activeJurusanLogo}
                  alt={`Logo ${kelasObj.Jurusan}`}
                  title={`Logo Jurusan ${kelasObj.Jurusan}`}
                  className="w-6 h-6 rounded-md object-contain border border-violet-200 bg-white p-0.5 shrink-0 hidden md:block"
                />
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <OfflineModeTogglePill
              variant="light"
              token={token}
              onSyncDone={() => void silentSyncNow()}
              showToast={showToast}
            />
            <PWAInstallButton variant="light" />
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              title="Buka Chat Diskusi Kelas & Tanya Siswa"
              className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center gap-1.5 whitespace-nowrap shadow-xs cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Chat Kelas</span>
            </button>
            {S.waInfo && (
              <a
                href={waLink(
                  S.waInfo,
                  `Halo Informasi ${S.sekolah || 'Sekolah'}, saya memerlukan informasi.`
                )}
                target={waTarget()}
                rel={waTarget() ? 'noopener noreferrer' : undefined}
                title="WhatsApp Informasi Sekolah"
                className="px-3 py-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl flex items-center gap-1.5 whitespace-nowrap shadow-xs"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">WA Info</span>
              </a>
            )}
            <select
              value={K}
              onChange={e => {
                setK(e.target.value);
                setDenSel('');
                setDenPick('');
              }}
              className="px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-indigo-50 to-sky-50 border border-indigo-200 rounded-xl text-indigo-950"
            >
              {(db.Kelas || []).length === 0 ? (
                <option value="">Belum ada kelas</option>
              ) : (
                (db.Kelas || []).map((k: any) => (
                  <option key={k.ID} value={k.ID}>
                    Kelas {k.Nama}{k.Jurusan ? ` · ${k.Jurusan}` : ''}
                  </option>
                ))
              )}
            </select>

            <button
              onClick={muatUlang}
              title="Muat ulang data"
              className="p-2 rounded-xl border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-700"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleLogout}
              className="px-3.5 py-1.5 text-xs font-semibold bg-gradient-to-r from-rose-500 to-pink-600 hover:brightness-110 text-white rounded-xl flex items-center gap-1.5 whitespace-nowrap shadow-xs cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Keluar
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto p-6">{activeView()}</main>
      </div>

      {/* Modal Dialog */}
      {modalContent && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div
            className={`bg-white rounded-2xl border border-slate-200 p-6 w-full ${
              modalContent.wide ? 'max-w-2xl' : 'max-w-md'
            } max-h-[90vh] overflow-y-auto space-y-4 shadow-xl`}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">{modalContent.title}</h3>
              <button
                onClick={() => setModalContent(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {modalContent.render()}
          </div>
        </div>
      )}

      {/* Live Poin & Bintang Login → Nilai Dialog */}
      {poinNilaiModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Kelola Bintang &amp; Poin Login → Nilai Siswa
              </h3>
              <button
                type="button"
                onClick={() => setPoinNilaiModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <PoinNilaiModalBody
              siswaK={siswaK}
              poinRows={db.PoinSiswa || []}
              nilaiRows={db.Nilai || []}
              pengaturan={S}
              kelasId={K}
              kelasNama={kelasObj.Nama || 'Kelas'}
              onApplyReadyForStudent={(sid, mode) => applyReadyPoinForStudents([sid], mode)}
              onConvertAndApplyStudent={(sid, mode) => convertAndApplyStudents([sid], mode)}
              onApplyAllReady={mode => applyReadyPoinForStudents(siswaK.map((x: any) => x.ID), mode)}
              onConvertAndApplyAll={mode => convertAndApplyStudents(siswaK.map((x: any) => x.ID), mode)}
              onGiftPoints={giftPointsToStudent}
              onClose={() => setPoinNilaiModalOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmState && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-sm space-y-4 shadow-xl">
            <p className="text-sm font-medium text-slate-800">{confirmState.msg}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  confirmState.resolve(false);
                  setConfirmState(null);
                }}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 text-slate-700 rounded-lg"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  confirmState.resolve(true);
                  setConfirmState(null);
                }}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 text-white rounded-lg"
              >
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Slide Presentation */}
      {presState && (
        <div className="fixed inset-0 z-50 bg-gradient-to-br from-indigo-950 via-violet-900 to-fuchsia-950 text-white flex flex-col justify-between p-6 md:p-10">
          <div className="flex-1 flex flex-col items-center justify-center text-center max-w-4xl mx-auto">
            {(() => {
              const cur = presState.slides[presState.i];
              return (
                <>
                  {cur.badge && (
                    <span className="px-3.5 py-1 mb-4 rounded-full bg-white/15 border border-white/20 text-xs font-bold uppercase tracking-wider text-amber-200">
                      {cur.badge}
                    </span>
                  )}
                  <h1 className="text-3xl md:text-5xl font-bold mb-6 text-amber-300 leading-tight">
                    {cur.title}
                  </h1>
                  {cur.body && (
                    <div className="text-lg md:text-2xl text-indigo-100 whitespace-pre-line leading-relaxed max-w-3xl">
                      {cur.body}
                    </div>
                  )}
                  {((cur.links && cur.links.length > 0) || cur.fileId) && (
                    <div className="mt-8 pt-6 border-t border-white/15 w-full max-w-2xl">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-200 mb-3">
                        Link Sumber Pelajaran & Lampiran
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2.5">
                        {(cur.links || []).map((lk, idx) => (
                          <a
                            key={idx}
                            href={lk.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-xs md:text-sm font-semibold text-white transition-colors"
                          >
                            <ExternalLink className="w-4 h-4 shrink-0 text-amber-300" />
                            <span>{lk.label}</span>
                          </a>
                        ))}
                        {cur.fileId && (
                          <button
                            type="button"
                            onClick={() => downloadAjarFile(cur.fileId!, cur.fileName || 'Modul')}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/40 text-xs md:text-sm font-semibold text-amber-100 cursor-pointer"
                          >
                            <Download className="w-4 h-4 shrink-0" />
                            <span>{cur.fileName || 'Unduh Modul'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          <div className="flex items-center justify-center gap-4 pt-6">
            <button
              onClick={() => setPresState(p => (p ? { ...p, i: Math.max(0, p.i - 1) } : null))}
              className="px-4 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-semibold cursor-pointer"
            >
              ◀ Sebelumnya
            </button>
            <span className="text-xs font-mono tabular-nums text-amber-300">
              {presState.i + 1} / {presState.slides.length}
            </span>
            <button
              onClick={() =>
                setPresState(p =>
                  p ? { ...p, i: Math.min(p.slides.length - 1, p.i + 1) } : null
                )
              }
              className="px-4 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Berikutnya ▶
            </button>
            <button
              onClick={() => setPresState(null)}
              className="px-4 py-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:brightness-110 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Tutup (Esc)
            </button>
          </div>
        </div>
      )}

      <WaBlastModal
        open={waBlastState.open}
        onClose={() => setWaBlastState({ open: false })}
        kelasNama={kelasObj.Nama || ''}
        sekolahNama={S.sekolah || 'Sekolah'}
        siswaList={siswaK}
        initialStudentId={waBlastState.studentId}
        initialTargetType={waBlastState.targetType}
        showToast={showToast}
      />

      {importModalMode && (
        <ImportTableModal
          mode={importModalMode}
          kelasId={K}
          kelasNama={kelasObj.Nama || 'Kelas'}
          db={db}
          onClose={() => setImportModalMode(null)}
          showToast={showToast}
          onConfirm={async payload => {
            if (importModalMode === 'siswa') {
              await persistSheets({ ...db, Siswa: payload.nextSiswa }, 'Siswa');
              showToast(
                `Impor siswa selesai (${payload.added} ditambah, ${payload.updated} diperbarui)`
              );
            } else if (importModalMode === 'nilai') {
              await persistSheets({ ...db, Nilai: payload.nextNilai }, 'Nilai');
              showToast(`${payload.count} baris nilai siswa berhasil diimpor`);
            } else if (importModalMode === 'tp') {
              await persistSheets({ ...db, TP: payload.nextTp }, 'TP');
              showToast(`${payload.count} Tujuan Pembelajaran berhasil diimpor`);
            } else if (importModalMode === 'jadwal') {
              const prevJadwal = db.Jadwal;
              const ok = await persistSheets({ ...db, Jadwal: payload.nextJadwal }, 'Jadwal');
              if (!ok) {
                setDb(d => ({ ...d, Jadwal: prevJadwal }));
              } else {
                showToast(`${payload.count} entri jadwal berhasil diimpor`);
              }
            }
          }}
        />
      )}

      {/* Teacher-Student Class Chat Drawer */}
      <ClassChatDrawer
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        kelasId={K}
        kelasNama={kelasObj.Nama || 'Kelas'}
        currentUser={{
          id: db.userId || (peran === 'admin' ? 'admin' : db.namaPengguna || 'guru'),
          nama: peran === 'admin' ? S.guru || 'Admin / Guru' : db.namaPengguna || 'Guru',
          peran: peran === 'admin' ? 'admin' : waliDi(K) ? 'wali' : 'guru'
        }}
        studentList={siswaK.map((s: any) => ({
          id: s.ID,
          nama: s.Nama,
          peran: 'siswa' as const,
          nis: s.NIS
        }))}
        showToast={showToast}
      />

      <OfflineIndicator
        token={token}
        onSyncDone={() => void silentSyncNow()}
        showToast={showToast}
      />

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] bg-gradient-to-r from-indigo-700 to-violet-700 text-white text-xs font-semibold px-5 py-2.5 rounded-full shadow-lg border border-white/20">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
