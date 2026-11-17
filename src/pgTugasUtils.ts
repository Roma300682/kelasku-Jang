export type PgOpsiType = 'ABCD' | 'ABCDE';

export interface PgDetailItem {
  no: number;
  kunci: string;
  jawaban: string;
  status: 'benar' | 'salah' | 'kosong';
}

export interface PgKoreksiResult {
  total: number;
  jumlahKunci: number;
  benar: number;
  salah: number;
  kosong: number;
  nilai: number;
  adaKunci: boolean;
  adaJawaban: boolean;
  detail: PgDetailItem[];
}

export function normalizeOpsiPG(opsiPG?: string): PgOpsiType {
  return String(opsiPG || '').toUpperCase().trim() === 'ABCD' ? 'ABCD' : 'ABCDE';
}

export function getOpsiList(opsiPG?: string): string[] {
  return normalizeOpsiPG(opsiPG) === 'ABCD'
    ? ['A', 'B', 'C', 'D']
    : ['A', 'B', 'C', 'D', 'E'];
}

/**
 * Parses flexible Multiple-Choice answer strings or maps into `{ [questionNo]: 'A'|'B'|... }`.
 * Supported formats:
 * - Object `{ 1: 'A', 2: 'B' }` or JSON string `'{"1":"A","2":"B"}'`
 * - Numbered: `"1.A 2.B 3:C 4=D 5)E"` or multiline `"1. A\n2. B"`
 * - Delimited or compact letters: `"ABCDEABCDE"`, `"A B C D E"`, `"A,B,C,D,E"`, `"AB-DE"` (`-`/`_` = blank)
 */
export function parsePgAnswers(
  raw: any,
  maxSoal?: number,
  opsiPG?: string
): Record<number, string> {
  const allowed = new Set(getOpsiList(opsiPG));
  const limit = Number(maxSoal) > 0 ? Math.min(200, Math.floor(Number(maxSoal))) : 200;
  const out: Record<number, string> = {};

  const put = (no: number, ans: string) => {
    const ch = String(ans || '').trim().toUpperCase();
    if (!Number.isInteger(no) || no < 1 || no > limit) return;
    if (allowed.has(ch)) {
      out[no] = ch;
    }
  };

  if (raw == null || raw === '') return out;

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      const no = Number(String(k).replace(/[^\d]/g, ''));
      if (no >= 1) put(no, String(v || ''));
    }
    return out;
  }

  if (Array.isArray(raw)) {
    raw.forEach((v, idx) => put(idx + 1, String(v || '')));
    return out;
  }

  const str = String(raw).trim();
  if (!str) return out;

  if (str.startsWith('{') || str.startsWith('[')) {
    try {
      const parsed = JSON.parse(str);
      return parsePgAnswers(parsed, maxSoal, opsiPG);
    } catch {
      // fall through to text parsing
    }
  }

  // 1. Check numbered pairs like "1.A", "1: B", "12) C", "1=D", "No 1: A", "1 A"
  const numberedRegex = /(?:^|[\s,;|/])(?:no\.?\s*)?(\d{1,3})\s*(?:[.:=)\-\]]|\s)\s*([A-Ea-e\-_?])(?=$|[\s,;|/])/g;
  const numberedMatches: Array<{ no: number; ans: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = numberedRegex.exec(str)) !== null) {
    numberedMatches.push({ no: Number(m[1]), ans: m[2] });
  }
  if (numberedMatches.length > 0) {
    for (const item of numberedMatches) {
      put(item.no, item.ans);
    }
    return out;
  }

  // 2. If separated by delimiters (commas, semicolons, pipes, newlines, whitespace) where tokens are single letters
  const tokens = str.split(/[\s,;|/]+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every(t => /^[A-Ea-e\-_?]$/.test(t))) {
    tokens.forEach((t, idx) => put(idx + 1, t));
    return out;
  }

  // 3. Compact letter sequence (e.g., "ABCDEABCDE" or "AB-DE")
  const compact = str.replace(/[^A-Za-z\-_?]/g, '');
  for (let i = 0; i < compact.length; i++) {
    put(i + 1, compact[i]);
  }
  return out;
}

export function serializePgAnswers(
  map: Record<number, string>,
  maxSoal?: number,
  opsiPG?: string
): string {
  const normalized = parsePgAnswers(map, maxSoal, opsiPG);
  const keys = Object.keys(normalized)
    .map(Number)
    .filter(n => n >= 1)
    .sort((a, b) => a - b);
  if (keys.length === 0) return '';
  const ordered: Record<string, string> = {};
  for (const k of keys) {
    ordered[String(k)] = normalized[k];
  }
  return JSON.stringify(ordered);
}

export function formatPgCompactString(
  map: Record<number, string>,
  totalSoal?: number
): string {
  const keys = Object.keys(map).map(Number).filter(n => n >= 1);
  const maxKey = keys.length > 0 ? Math.max(...keys) : 0;
  const count = Number(totalSoal) > 0 ? Number(totalSoal) : maxKey;
  if (count <= 0) return '';
  let res = '';
  for (let i = 1; i <= count; i++) {
    res += map[i] || '-';
  }
  return res;
}

export function formatPgNumberedSummary(
  map: Record<number, string>,
  totalSoal?: number
): string {
  const keys = Object.keys(map)
    .map(Number)
    .filter(n => n >= 1)
    .sort((a, b) => a - b);
  const limit = Number(totalSoal) > 0 ? Number(totalSoal) : keys[keys.length - 1] || 0;
  if (limit <= 0) return '';
  const parts: string[] = [];
  for (let i = 1; i <= limit; i++) {
    if (map[i]) parts.push(`${i}:${map[i]}`);
  }
  return parts.join(' ');
}

export function inferTotalSoal(
  kunciRaw: any,
  explicitTotal?: any,
  jawabanRaw?: any,
  opsiPG?: string
): number {
  const exp = Number(explicitTotal);
  if (Number.isFinite(exp) && exp > 0) return Math.min(200, Math.floor(exp));
  const kunciMap = parsePgAnswers(kunciRaw, 200, opsiPG);
  const jawabanMap = parsePgAnswers(jawabanRaw, 200, opsiPG);
  const allKeys = [
    ...Object.keys(kunciMap).map(Number),
    ...Object.keys(jawabanMap).map(Number)
  ];
  return allKeys.length > 0 ? Math.max(...allKeys) : 10;
}

export function koreksiPgSiswa(
  kunciRaw: any,
  jawabanRaw: any,
  totalSoalInput?: any,
  opsiPG?: string
): PgKoreksiResult {
  const opsi = normalizeOpsiPG(opsiPG);
  const kunciMapAll = parsePgAnswers(kunciRaw, 200, opsi);
  const jawabanMapAll = parsePgAnswers(jawabanRaw, 200, opsi);

  const explicit = Number(totalSoalInput);
  const kunciKeys = Object.keys(kunciMapAll).map(Number);
  const jawabanKeys = Object.keys(jawabanMapAll).map(Number);
  const maxKunci = kunciKeys.length > 0 ? Math.max(...kunciKeys) : 0;
  const maxJawaban = jawabanKeys.length > 0 ? Math.max(...jawabanKeys) : 0;

  const total =
    Number.isFinite(explicit) && explicit > 0
      ? Math.min(200, Math.floor(explicit))
      : Math.max(maxKunci, maxJawaban);

  const detail: PgDetailItem[] = [];
  let benar = 0;
  let salah = 0;
  let kosong = 0;
  let jumlahKunci = 0;

  for (let no = 1; no <= total; no++) {
    const kunci = kunciMapAll[no] || '';
    const jawaban = jawabanMapAll[no] || '';
    if (kunci) jumlahKunci++;

    let status: 'benar' | 'salah' | 'kosong' = 'kosong';
    if (!jawaban) {
      status = 'kosong';
      kosong++;
    } else if (kunci && jawaban === kunci) {
      status = 'benar';
      benar++;
    } else if (kunci) {
      status = 'salah';
      salah++;
    } else {
      // No key defined for this item; treat answered item neutrally as wrong/unkeyed without crashing
      status = 'salah';
      salah++;
    }

    detail.push({ no, kunci, jawaban, status });
  }

  const adaKunci = jumlahKunci > 0;
  const adaJawaban = jawabanKeys.some(k => k >= 1 && k <= total);
  const nilai = adaKunci ? Math.round((benar / jumlahKunci) * 100) : 0;

  return {
    total,
    jumlahKunci,
    benar,
    salah,
    kosong,
    nilai,
    adaKunci,
    adaJawaban,
    detail
  };
}

export function parseDetailKoreksi(raw: any): Partial<PgKoreksiResult> | null {
  if (!raw) return null;
  if (typeof raw === 'object') return raw as Partial<PgKoreksiResult>;
  try {
    const parsed = JSON.parse(String(raw));
    if (parsed && typeof parsed === 'object') return parsed as Partial<PgKoreksiResult>;
  } catch {
    return null;
  }
  return null;
}
