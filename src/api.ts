import { runLocalKaldikSyncFallback, runLocalRpcFallback } from './localFallback';

export class ApiUnavailableError extends Error {
  status: number;
  url: string;
  constructor(url: string, status: number, message: string) {
    super(message);
    this.name = 'ApiUnavailableError';
    this.status = status;
    this.url = url;
  }
}

export async function hashPinClient(salt: string, teks: string): Promise<string> {
  const bytes = new TextEncoder().encode(salt + '|' + teks);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const arr = Array.from(new Uint8Array(digest));
  let bin = '';
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
}

export async function fetchJson<T = any>(url: string, init?: RequestInit, retries = 4): Promise<T> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      const rawText = await res.text();
      const trimmed = rawText.trim();

      if (res.url && res.url.includes('__cookie_check')) {
        throw new Error(
          'Sesi pratinjau browser kedaluwarsa. Silakan muat ulang (refresh) halaman untuk melanjutkan.'
        );
      }

      let parsed: any = null;
      let isJson = false;
      if (trimmed) {
        try {
          parsed = JSON.parse(trimmed);
          isJson = true;
        } catch {
          isJson = false;
        }
      }

      if (isJson && parsed && typeof parsed === 'object') {
        return parsed as T;
      }

      const isHtmlOrPageText =
        /^the page\b/i.test(trimmed) ||
        /^bad gateway/i.test(trimmed) ||
        /^service unavailable/i.test(trimmed) ||
        trimmed.startsWith('<');

      if (res.status === 404 && !isJson) {
        if (attempt === 0) {
          await new Promise(r => setTimeout(r, 350));
          continue;
        }
        if (url === '/api/kaldik/sync-jabar') {
          try {
            const body = init?.body ? JSON.parse(String(init.body)) : {};
            const data = await runLocalKaldikSyncFallback(body);
            return { ok: true, data } as unknown as T;
          } catch (fbErr: any) {
            return { ok: false, error: fbErr?.message || String(fbErr) } as unknown as T;
          }
        }
        throw new ApiUnavailableError(
          url,
          404,
          'Layanan endpoint ini memerlukan server backend aktif.'
        );
      }

      const transient =
        res.status === 502 ||
        res.status === 503 ||
        res.status === 504 ||
        (res.status >= 500 && !isJson) ||
        isHtmlOrPageText;

      if (transient && attempt < retries) {
        await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
        continue;
      }

      if (res.status === 413) {
        throw new Error('Ukuran data atau berkas melebihi batas maksimal server (25 MB).');
      }
      if (isHtmlOrPageText) {
        throw new Error(
          `Layanan server belum merespons JSON (${url} → HTTP ${res.status || 0}). Silakan muat ulang halaman dan coba lagi.`
        );
      }
      throw new Error(
        `Respons server tidak valid (${url} → HTTP ${res.status || 500}). Silakan coba lagi beberapa saat.`
      );
    } catch (e: any) {
      if (e instanceof ApiUnavailableError) throw e;
      lastErr = e instanceof Error ? e : new Error(String(e));
      const msg = lastErr.message || '';
      const isNetworkErr =
        e?.name === 'TypeError' ||
        /failed to fetch|networkerror|load failed/i.test(msg);
      if (isNetworkErr && attempt < retries) {
        await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
        continue;
      }
      throw lastErr;
    }
  }
  throw lastErr || new Error('Gagal menghubungi server.');
}

export async function callRaw<T = any>(fn: string, ...args: any[]): Promise<T> {
  try {
    const json = await fetchJson<{ ok: boolean; data?: T; error?: string }>('/api/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fn, args })
    });
    if (!json.ok) {
      throw new Error(json.error || 'Terjadi kesalahan pada server.');
    }
    return json.data as T;
  } catch (e: any) {
    if (e instanceof ApiUnavailableError && e.status === 404) {
      return (await runLocalRpcFallback(fn, args)) as T;
    }
    throw e;
  }
}

export const num = (v: any): number | null => {
  const n = parseFloat(String(v == null ? '' : v).replace(',', '.'));
  return isNaN(n) ? null : n;
};

export const fmt = (n: number | null | undefined): string =>
  n == null ? '-' : (Math.round(n * 10) / 10).toString().replace('.', ',');

export const pad = (n: number | string): string => String(n).padStart(2, '0');

export const ymd = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const uid = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const pesanErr = (e: any): string =>
  String((e && e.message) || e).replace(/^(Error|Exception):\s*/, '');

export const acak = <T>(a: T[]): T[] => {
  const copy = a.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const urlAman = (u: string): boolean => /^https?:\/\//i.test(String(u || '').trim());

export const waLink = (phone: string, text = ''): string => {
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  else if (digits.startsWith('8')) digits = '62' + digits;
  const q = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${digits}${q}`;
};

export const tglParse = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const tglTambah = (s: string, n: number): string => {
  const d = tglParse(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};

export const tglIndo = (s: string): string => {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  const bln = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][Number(m) - 1] || '';
  return `${Number(d)} ${bln} ${y}`;
};

export const menit = (t: string): number => {
  const m = /^(\d{2}):(\d{2})$/.exec(t || '');
  return m ? +m[1] * 60 + +m[2] : -1;
};

export const jamStr = (m: number): string => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

export const tumpang = (a: { Mulai: string; Selesai: string }, b: { Mulai: string; Selesai: string }): boolean =>
  menit(a.Mulai) < menit(b.Selesai) && menit(b.Mulai) < menit(a.Selesai);

export const pekanTemu = (a: { Pekan?: string }, b: { Pekan?: string }): boolean =>
  !a.Pekan || !b.Pekan || a.Pekan === b.Pekan;

export const adaPelajaran = (r: { Jenis?: string }): boolean => !r.Jenis || r.Jenis === 'Pelajaran';

export function slotJadwal(a: Record<string, string>) {
  const dur = +a.Durasi || 45;
  const n = +a.Jumlah || 0;
  const ist: Record<number, number> = {};
  String(a.Istirahat || '')
    .split(',')
    .forEach(x => {
      const [k, d] = x.split(':').map(Number);
      if (k > 0 && d > 0) ist[k] = d;
    });
  const nm = a.Sistem === 'blok' ? 'Blok ' : 'Jam ke-';
  let t = menit(a.Mulai);
  const out: { n: number; jenis: string; mulai: number; selesai: number; label: string }[] = [];
  if (t < 0) return out;
  for (let i = 1; i <= n; i++) {
    out.push({ n: i, jenis: 'Pelajaran', mulai: t, selesai: t + dur, label: nm + i });
    t += dur;
    if (ist[i] && i < n) {
      out.push({ n: i, jenis: 'Istirahat', mulai: t, selesai: t + ist[i], label: 'Istirahat' });
      t += ist[i];
    }
  }
  return out;
}

export function uraiCSV(t: string): string[][] {
  t = String(t || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (!t) return [];
  // Detect delimiter on first line while ignoring delimiters inside quotes
  let inQ = false;
  let tabs = 0;
  let semis = 0;
  let commas = 0;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch === '"') {
      inQ = !inQ;
    } else if (!inQ) {
      if (ch === '\n') break;
      if (ch === '\t') tabs++;
      else if (ch === ';') semis++;
      else if (ch === ',') commas++;
    }
  }
  const d = tabs > 0 && tabs >= semis && tabs >= commas ? '\t' : semis >= commas && semis > 0 ? ';' : commas > 0 ? ',' : ';';
  const out: string[][] = [];
  let row: string[] = [];
  let sel = '';
  let kutip = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (kutip) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          sel += '"';
          i++;
        } else {
          kutip = false;
        }
      } else {
        sel += c;
      }
    } else if (c === '"') {
      kutip = true;
    } else if (c === d) {
      row.push(sel.trim());
      sel = '';
    } else if (c === '\n') {
      row.push(sel.trim());
      out.push(row);
      row = [];
      sel = '';
    } else {
      sel += c;
    }
  }
  row.push(sel.trim());
  out.push(row);
  return out.filter(r => r.some(x => String(x).trim() !== ''));
}

export function petaKolom(kepala: string[]): Record<string, number> {
  const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const p: Record<string, number> = {};
  kepala.forEach((h, i) => {
    const n = norm(h);
    if (!n) return;
    if (n === 'no' || n === 'nomor' || n === 'urut') p.no = i;
    else if (n === 'nis' || n === 'nisn' || n === 'nisnisn') p.nis = i;
    else if (n === 'nosiswa' || n === 'nowasiswa' || n === 'wasiswa' || n === 'hpsiswa' || n === 'telpsiswa' || n === 'teleponsiswa') p.noSiswa = i;
    else if (n === 'noortu' || n === 'nowaortu' || n === 'nowaorangtua' || n === 'waortu' || n === 'waorangtua' || n === 'kontakortu' || n === 'kontakorangtua' || n === 'hportu' || n === 'nohportu') p.noOrtu = i;
    else if (n === 'nama' || n === 'namalengkap' || n === 'namasiswa' || n === 'siswanama') p.nama = i;
    else if (n.includes('alamat')) p.alamat = i;
    else if (n.includes('kesehatan') || n.includes('sehat') || n.includes('riwayat')) p.kesehatan = i;
    else if (n.includes('sikap') || n.includes('kehadiran')) p.Sikap = i;
    else if (n.includes('tugas') || n.includes('harian')) p.Tugas = i;
    else if (n.includes('proyek') || n.includes('praktik')) p.Proyek = i;
    else if (n === 'uts' || n.startsWith('uts') || n.includes('tengahsemester')) p.UTS = i;
    else if (n === 'uas' || n.startsWith('uas') || n.includes('akhirsemester')) p.UAS = i;
    else if (n === 'kode' || n === 'kodetp') p.kode = i;
    else if (n.includes('tujuan') || n.includes('rumusan')) p.tujuan = i;
    else if (n.includes('materi')) p.materi = i;
    else if (n === 'status' || n === 'statustp') p.status = i;
    else if (n === 'hari') p.hari = i;
    else if (n === 'mulai' || n === 'jammulai') p.mulai = i;
    else if (n === 'selesai' || n === 'jamselesai') p.selesai = i;
    else if (n.includes('mapel') || n.includes('matapelajaran') || n.includes('kegiatan')) p.mapel = i;
    else if (n.includes('guru') || n.includes('pengampu')) p.guru = i;
    else if (n === 'jenis' || n === 'jeniskegiatan') p.jenis = i;
  });
  return p;
}

const LOCAL_AJAR_FILES_KEY = 'mk_ajar_files_v1';

function readLocalAjarFiles(): Record<string, { namaFile: string; mimeType: string; base64Data: string }> {
  try {
    const raw = localStorage.getItem(LOCAL_AJAR_FILES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function uploadAjarFile(
  token: string,
  namaFile: string,
  mimeType: string,
  base64Data: string
): Promise<{ fileId: string; namaFile: string }> {
  try {
    const res = await fetchJson<{ ok: boolean; data?: { fileId: string; namaFile: string }; error?: string }>(
      '/api/ajar/upload',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, namaFile, mimeType, base64Data })
      }
    );
    if (!res.ok || !res.data) {
      throw new Error(res.error || 'Gagal mengunggah berkas perangkat ajar.');
    }
    return res.data;
  } catch (e: any) {
    if (e instanceof ApiUnavailableError && e.status === 404) {
      const fileId = 'local_ajr_' + uid();
      const map = readLocalAjarFiles();
      map[fileId] = { namaFile, mimeType: mimeType || 'application/octet-stream', base64Data };
      try {
        localStorage.setItem(LOCAL_AJAR_FILES_KEY, JSON.stringify(map));
      } catch {
        throw new Error('Penyimpanan lokal browser penuh. Gunakan file berukuran lebih kecil.');
      }
      return { fileId, namaFile };
    }
    throw e;
  }
}

export function downloadAjarFile(fileId: string, namaFile?: string): void {
  if (!fileId) return;
  if (fileId.startsWith('local_ajr_')) {
    const rec = readLocalAjarFiles()[fileId];
    if (!rec) return;
    const bin = atob(rec.base64Data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: rec.mimeType || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = namaFile || rec.namaFile || 'lampiran';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const a = document.createElement('a');
  a.href = `/api/ajar/file/${encodeURIComponent(fileId)}`;
  a.download = namaFile || '';
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function getAjarFilePreviewUrl(fileId: string): string {
  if (!fileId) return '';
  if (fileId.startsWith('local_ajr_')) {
    const rec = readLocalAjarFiles()[fileId];
    if (!rec) return '';
    return `data:${rec.mimeType || 'application/octet-stream'};base64,${rec.base64Data}`;
  }
  return `/api/ajar/file/${encodeURIComponent(fileId)}?inline=1`;
}

export function downloadTextAsFile(filename: string, content: string): void {
  const safeName = String(filename || 'materi-pelajaran.txt').replace(/[\\/:*?"<>|]+/g, '_');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}


