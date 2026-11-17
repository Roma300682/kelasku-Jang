export type TugasTipeSoal = 'umum' | 'pg' | 'uraian' | 'akuntansi';
export type AkuntansiPosisi = 'D' | 'K' | 'N';

export interface UraianKunciItem {
  no: number;
  pertanyaan: string;
  kunci: string;
  bobot: number;
}

export interface UraianDetailItem {
  no: number;
  pertanyaan: string;
  kunci: string;
  jawaban: string;
  bobot: number;
  skor: number;
  persen: number;
  poinCocok: string[];
  poinKurang: string[];
  status: 'sesuai' | 'sebagian' | 'belum' | 'kosong';
}

export interface UraianKoreksiResult {
  tipe: 'uraian';
  totalSoal: number;
  jumlahKunci: number;
  totalBobot: number;
  totalSkor: number;
  nilai: number;
  adaKunci: boolean;
  adaJawaban: boolean;
  sesuai: number;
  sebagian: number;
  belum: number;
  detail: UraianDetailItem[];
}

export interface AkuntansiKunciRow {
  no: number;
  keterangan: string;
  akun: string;
  posisi: AkuntansiPosisi;
  nominal: number;
  bobot: number;
}

export interface AkuntansiSiswaRow {
  no: number;
  keterangan: string;
  akun: string;
  posisi: AkuntansiPosisi;
  nominal: number;
}

export interface AkuntansiDetailItem {
  no: number;
  keterangan: string;
  akunKunci: string;
  posisiKunci: AkuntansiPosisi;
  nominalKunci: number;
  akunSiswa: string;
  posisiSiswa: AkuntansiPosisi | '';
  nominalSiswa: number;
  akunCocok: boolean;
  posisiCocok: boolean;
  nominalCocok: boolean;
  bobot: number;
  skor: number;
  status: 'benar' | 'sebagian' | 'salah' | 'kosong';
}

export interface AkuntansiKoreksiResult {
  tipe: 'akuntansi';
  totalBaris: number;
  jumlahKunci: number;
  totalBobot: number;
  totalSkor: number;
  nilai: number;
  adaKunci: boolean;
  adaJawaban: boolean;
  benar: number;
  sebagian: number;
  salah: number;
  totalDebitKunci: number;
  totalKreditKunci: number;
  totalDebitSiswa: number;
  totalKreditSiswa: number;
  seimbangSiswa: boolean;
  detail: AkuntansiDetailItem[];
}

const STOPWORDS_ID = new Set([
  'yang', 'dan', 'di', 'ke', 'dari', 'pada', 'untuk', 'dengan', 'atau', 'ini', 'itu',
  'adalah', 'ialah', 'merupakan', 'yaitu', 'yakni', 'adalah', 'sebagai', 'oleh',
  'agar', 'supaya', 'dalam', 'atas', 'bawah', 'karena', 'sehingga', 'maka', 'jika',
  'bila', 'apabila', 'suatu', 'sebuah', 'para', 'akan', 'dapat', 'bisa', 'harus',
  'telah', 'sudah', 'belum', 'tidak', 'bukan', 'juga', 'serta', 'maupun', 'secara',
  'tersebut', 'antara', 'saat', 'ketika', 'setiap', 'semua', 'lebih', 'kurang',
  'the', 'is', 'are', 'of', 'to', 'and', 'in', 'for', 'with', 'that', 'this'
]);

export function normalizeText(raw: any): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u201C\u201D]/g, "'")
    .replace(/[^a-z0-9\s%.,/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractNumberTokens(raw: any): string[] {
  const s = String(raw || '').toLowerCase();
  const matches = s.match(/(?:rp\.?\s*)?\d+(?:[.,]\d{3})*(?:[.,]\d+)?%?/g) || [];
  const out = new Set<string>();
  for (const m of matches) {
    const clean = m.replace(/rp\.?\s*/g, '').trim();
    if (!clean) continue;
    // If dot/comma used as thousand separator like 1.500.000
    if (/^\d{1,3}(?:\.\d{3})+$/.test(clean)) {
      out.add(clean.replace(/\./g, ''));
    } else if (/^\d{1,3}(?:,\d{3})+$/.test(clean)) {
      out.add(clean.replace(/,/g, ''));
    } else {
      out.add(clean.replace(/,/g, '.'));
    }
  }
  return Array.from(out);
}

function tokenizeContentWords(raw: any): string[] {
  const norm = normalizeText(raw).replace(/[.,/]/g, ' ');
  const words = norm.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const w of words) {
    if (w.length <= 1) continue;
    if (STOPWORDS_ID.has(w)) continue;
    out.push(w);
  }
  return out;
}

function tokenMatches(keyWord: string, ansTokens: string[], ansNormalized: string): boolean {
  if (!keyWord) return false;
  if (ansTokens.includes(keyWord)) return true;
  if (keyWord.length >= 4 && ansNormalized.includes(keyWord)) return true;
  // Simple Indonesian prefix/suffix stem match for >=5 char words
  if (keyWord.length >= 5) {
    const stem = keyWord.replace(/^(meng|meny|mem|men|me|peng|peny|pem|pen|pe|ber|ter|di|ke|se)/, '').replace(/(kan|an|i|nya)$/, '');
    if (stem.length >= 4) {
      return ansTokens.some(t => t.includes(stem) || stem.includes(t));
    }
  }
  return false;
}

/* ==================== URAIAN TEKS ==================== */

export function parseUraianKunci(raw: any, minCount = 0): UraianKunciItem[] {
  let list: UraianKunciItem[] = [];
  if (Array.isArray(raw)) {
    list = raw
      .map((item, idx) => ({
        no: Number(item?.no) > 0 ? Math.floor(Number(item.no)) : idx + 1,
        pertanyaan: String(item?.pertanyaan || '').trim(),
        kunci: String(item?.kunci || '').trim(),
        bobot: Number(item?.bobot) > 0 ? Number(item.bobot) : 10
      }))
      .sort((a, b) => a.no - b.no);
  } else if (typeof raw === 'string' && raw.trim()) {
    const s = raw.trim();
    if (s.startsWith('[') || s.startsWith('{')) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          return parseUraianKunci(parsed, minCount);
        }
        if (parsed && typeof parsed === 'object') {
          const entries = Object.entries(parsed).map(([k, v], idx) => ({
            no: Number(k) > 0 ? Math.floor(Number(k)) : idx + 1,
            pertanyaan: '',
            kunci: String(v || '').trim(),
            bobot: 10
          }));
          return parseUraianKunci(entries, minCount);
        }
      } catch {
        // fall through to text parser
      }
    }
    list = parseUraianKunciQuickText(s);
  }

  if (minCount > 0 && list.length < minCount) {
    const existingNos = new Set(list.map(i => i.no));
    const defaultBobot = Math.max(1, Math.round(100 / minCount));
    for (let i = 1; i <= minCount; i++) {
      if (!existingNos.has(i)) {
        list.push({ no: i, pertanyaan: '', kunci: '', bobot: defaultBobot });
      }
    }
    list.sort((a, b) => a.no - b.no);
  }
  return list;
}

/**
 * Parses quick text input for Uraian Answer Keys:
 * - "1. Pertanyaan | Kunci jawaban | 25" or "1. Kunci jawaban"
 * - Or line-by-line "Kunci soal 1\nKunci soal 2"
 */
export function parseUraianKunciQuickText(text: string): UraianKunciItem[] {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);
  const out: UraianKunciItem[] = [];
  lines.forEach((line, idx) => {
    const numbered = line.match(/^(?:no\.?\s*)?(\d{1,2})\s*[.:)\-]\s*(.+)$/i);
    const no = numbered ? Number(numbered[1]) : idx + 1;
    const body = numbered ? numbered[2].trim() : line;
    const parts = body.split(/\t|\|/).map(p => p.trim());
    if (parts.length >= 3) {
      const bobotNum = Number(parts[2]);
      out.push({
        no,
        pertanyaan: parts[0],
        kunci: parts[1],
        bobot: Number.isFinite(bobotNum) && bobotNum > 0 ? bobotNum : 10
      });
    } else if (parts.length === 2) {
      const secondIsNum = /^\d+(?:\.\d+)?$/.test(parts[1]);
      if (secondIsNum) {
        out.push({ no, pertanyaan: '', kunci: parts[0], bobot: Number(parts[1]) || 10 });
      } else {
        out.push({ no, pertanyaan: parts[0], kunci: parts[1], bobot: 10 });
      }
    } else {
      out.push({ no, pertanyaan: '', kunci: body, bobot: 10 });
    }
  });
  return out.sort((a, b) => a.no - b.no);
}

export function serializeUraianKunci(items: UraianKunciItem[]): string {
  const clean = items
    .filter(it => it.pertanyaan.trim() || it.kunci.trim())
    .map((it, idx) => ({
      no: Number(it.no) > 0 ? Math.floor(Number(it.no)) : idx + 1,
      pertanyaan: String(it.pertanyaan || '').trim(),
      kunci: String(it.kunci || '').trim(),
      bobot: Number(it.bobot) > 0 ? Number(it.bobot) : 10
    }));
  if (clean.length === 0) return '';
  return JSON.stringify(clean);
}

export function parseUraianSiswa(raw: any): Record<number, string> {
  const out: Record<number, string> = {};
  if (!raw) return out;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      const no = Number(String(k).replace(/[^\d]/g, ''));
      if (no >= 1 && String(v || '').trim()) {
        out[no] = String(v).trim();
      }
    }
    return out;
  }
  const str = String(raw).trim();
  if (!str) return out;
  if (str.startsWith('{') || str.startsWith('[')) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        parsed.forEach((v, idx) => {
          if (typeof v === 'string' && v.trim()) out[idx + 1] = v.trim();
          else if (v && typeof v === 'object') {
            const no = Number(v.no) || idx + 1;
            const ans = String(v.jawaban ?? v.teks ?? '').trim();
            if (ans) out[no] = ans;
          }
        });
        return out;
      }
      return parseUraianSiswa(parsed);
    } catch {
      // fall through
    }
  }
  // Parse numbered text blocks: "1. jawaban..." or fallback to #1
  const lines = str.split(/\r?\n/);
  let currentNo = 0;
  let buffer: string[] = [];
  const flush = () => {
    if (currentNo >= 1 && buffer.length > 0) {
      const joined = buffer.join('\n').trim();
      if (joined) out[currentNo] = joined;
    }
  };
  for (const line of lines) {
    const m = line.match(/^\s*(?:no\.?\s*)?(\d{1,2})\s*[.:)]\s*(.*)$/i);
    if (m) {
      flush();
      currentNo = Number(m[1]);
      buffer = [m[2]];
    } else {
      if (currentNo === 0) currentNo = 1;
      buffer.push(line);
    }
  }
  flush();
  return out;
}

export function serializeUraianSiswa(map: Record<number, string>): string {
  const keys = Object.keys(map)
    .map(Number)
    .filter(n => n >= 1 && String(map[n] || '').trim())
    .sort((a, b) => a - b);
  if (keys.length === 0) return '';
  const obj: Record<string, string> = {};
  for (const k of keys) {
    obj[String(k)] = String(map[k]).trim();
  }
  return JSON.stringify(obj);
}

export function koreksiUraianSiswa(kunciRaw: any, jawabanRaw: any): UraianKoreksiResult {
  const kunciItems = parseUraianKunci(kunciRaw).filter(k => k.kunci.trim() || k.pertanyaan.trim());
  const jawabanMap = parseUraianSiswa(jawabanRaw);

  let totalBobot = 0;
  let totalSkor = 0;
  let jumlahKunci = 0;
  let sesuai = 0;
  let sebagian = 0;
  let belum = 0;

  const detail: UraianDetailItem[] = kunciItems.map(item => {
    const kunciStr = item.kunci.trim();
    const ansStr = String(jawabanMap[item.no] || '').trim();
    const bobot = Number(item.bobot) > 0 ? Number(item.bobot) : 10;
    if (kunciStr) {
      jumlahKunci++;
      totalBobot += bobot;
    }

    if (!ansStr) {
      if (kunciStr) belum++;
      return {
        no: item.no,
        pertanyaan: item.pertanyaan,
        kunci: kunciStr,
        jawaban: '',
        bobot,
        skor: 0,
        persen: 0,
        poinCocok: [],
        poinKurang: kunciStr ? extractKeyPoints(kunciStr) : [],
        status: 'kosong'
      };
    }

    if (!kunciStr) {
      return {
        no: item.no,
        pertanyaan: item.pertanyaan,
        kunci: '',
        jawaban: ansStr,
        bobot,
        skor: 0,
        persen: 0,
        poinCocok: [],
        poinKurang: [],
        status: 'sebagian'
      };
    }

    const ansNorm = normalizeText(ansStr);
    const keyNorm = normalizeText(kunciStr);

    // Exact or near-exact string match shortcut
    if (ansNorm === keyNorm) {
      sesuai++;
      totalSkor += bobot;
      return {
        no: item.no,
        pertanyaan: item.pertanyaan,
        kunci: kunciStr,
        jawaban: ansStr,
        bobot,
        skor: bobot,
        persen: 100,
        poinCocok: extractKeyPoints(kunciStr),
        poinKurang: [],
        status: 'sesuai'
      };
    }

    // Check explicit multi-point keys separated by ';' or '/' or newline if present
    const keyPoints = extractKeyPoints(kunciStr);
    const ansTokens = tokenizeContentWords(ansStr);
    const ansNums = extractNumberTokens(ansStr);

    const poinCocok: string[] = [];
    const poinKurang: string[] = [];

    for (const kp of keyPoints) {
      const kpNums = extractNumberTokens(kp);
      const kpTokens = tokenizeContentWords(kp);
      const kpNorm = normalizeText(kp);

      let matched = false;
      if (kpNorm && ansNorm.includes(kpNorm)) {
        matched = true;
      } else if (kpNums.length > 0 && kpTokens.length === 0) {
        matched = kpNums.every(n => ansNums.includes(n));
      } else if (kpTokens.length > 0) {
        const hitWords = kpTokens.filter(w => tokenMatches(w, ansTokens, ansNorm));
        const hitNums = kpNums.filter(n => ansNums.includes(n));
        const wordRatio = hitWords.length / kpTokens.length;
        const numOk = kpNums.length === 0 || hitNums.length === kpNums.length;
        matched = wordRatio >= 0.6 && numOk;
      }

      if (matched) poinCocok.push(kp);
      else poinKurang.push(kp);
    }

    let ratio = keyPoints.length > 0 ? poinCocok.length / keyPoints.length : 0;
    // Give partial token credit when using single paragraph key so good partial answers still score smoothly
    if (keyPoints.length === 1) {
      const allKeyTokens = tokenizeContentWords(kunciStr);
      const allKeyNums = extractNumberTokens(kunciStr);
      const totalUnits = allKeyTokens.length + allKeyNums.length;
      if (totalUnits > 0) {
        const hitWords = allKeyTokens.filter(w => tokenMatches(w, ansTokens, ansNorm)).length;
        const hitNums = allKeyNums.filter(n => ansNums.includes(n)).length;
        ratio = Math.max(ratio, (hitWords + hitNums) / totalUnits);
      }
    }

    const persen = Math.min(100, Math.round(ratio * 100));
    const skor = Math.round((bobot * persen) / 100 * 10) / 10;
    totalSkor += skor;

    let status: 'sesuai' | 'sebagian' | 'belum' = 'belum';
    if (persen >= 75) {
      status = 'sesuai';
      sesuai++;
    } else if (persen >= 25) {
      status = 'sebagian';
      sebagian++;
    } else {
      status = 'belum';
      belum++;
    }

    return {
      no: item.no,
      pertanyaan: item.pertanyaan,
      kunci: kunciStr,
      jawaban: ansStr,
      bobot,
      skor,
      persen,
      poinCocok,
      poinKurang,
      status
    };
  });

  const adaKunci = jumlahKunci > 0;
  const adaJawaban = Object.keys(jawabanMap).length > 0;
  const nilai = adaKunci && totalBobot > 0 ? Math.min(100, Math.round((totalSkor / totalBobot) * 100)) : 0;

  return {
    tipe: 'uraian',
    totalSoal: kunciItems.length,
    jumlahKunci,
    totalBobot,
    totalSkor: Math.round(totalSkor * 10) / 10,
    nilai,
    adaKunci,
    adaJawaban,
    sesuai,
    sebagian,
    belum,
    detail
  };
}

function extractKeyPoints(kunciStr: string): string[] {
  const clean = String(kunciStr || '').trim();
  if (!clean) return [];
  // If teacher separated explicit key points with ';', '|', or newlines
  if (/[;\n|]/.test(clean)) {
    const parts = clean
      .split(/[;\n|]+/)
      .map(p => p.trim())
      .filter(Boolean);
    if (parts.length > 1) return parts;
  }
  // If comma-separated short phrases (each <= 4 words)
  if (clean.includes(',')) {
    const commaParts = clean.split(',').map(p => p.trim()).filter(Boolean);
    if (commaParts.length >= 2 && commaParts.every(p => p.split(/\s+/).length <= 5)) {
      return commaParts;
    }
  }
  return [clean];
}

/* ==================== PRAKTIK AKUNTANSI ==================== */

export function parseAkuntansiNominal(raw: any): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.round(raw) : 0;
  let s = String(raw || '').trim();
  if (!s) return 0;
  const isNeg = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/[()Rp\s-]/gi, '');
  if (!s) return 0;

  // Indonesian format: 1.500.000 or 1.500.000,50
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(s)) {
    const num = Number(s.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(num) ? Math.round(isNeg ? -num : num) : 0;
  }
  // US format: 1,500,000 or 1,500,000.50
  if (/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(s)) {
    const num = Number(s.replace(/,/g, ''));
    return Number.isFinite(num) ? Math.round(isNeg ? -num : num) : 0;
  }
  // Single comma decimal like 1500,50
  if (/^\d+,\d{1,2}$/.test(s)) {
    const num = Number(s.replace(',', '.'));
    return Number.isFinite(num) ? Math.round(isNeg ? -num : num) : 0;
  }
  const stripped = s.replace(/[^0-9.]/g, '');
  const parsed = Number(stripped);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(isNeg ? -parsed : parsed);
}

export function formatRupiah(val: any): string {
  const n = Number(val) || 0;
  if (n === 0) return '0';
  const sign = n < 0 ? '-' : '';
  return sign + Math.abs(Math.round(n)).toLocaleString('id-ID');
}

export function parseAkuntansiPosisi(raw: any): AkuntansiPosisi {
  const s = String(raw || '').trim().toUpperCase();
  if (s === 'D' || s.startsWith('DEB')) return 'D';
  if (s === 'K' || s.startsWith('KRE') || s === 'C' || s.startsWith('CRE')) return 'K';
  return 'N';
}

export function normalizeAkunName(raw: any): string {
  return String(raw || '')
    .toLowerCase()
    // strip optional leading account code e.g. "111 - Kas" or "1-101 Kas"
    .replace(/^\s*\d+(?:[.-]\d+)*\s*[-.:]?\s*/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseAkuntansiKunci(raw: any): AkuntansiKunciRow[] {
  if (Array.isArray(raw)) {
    return raw
      .map((r, idx) => ({
        no: Number(r?.no) > 0 ? Math.floor(Number(r.no)) : idx + 1,
        keterangan: String(r?.keterangan || '').trim(),
        akun: String(r?.akun || '').trim(),
        posisi: parseAkuntansiPosisi(r?.posisi),
        nominal: parseAkuntansiNominal(r?.nominal),
        bobot: Number(r?.bobot) > 0 ? Number(r.bobot) : 10
      }))
      .sort((a, b) => a.no - b.no);
  }
  if (typeof raw === 'string' && raw.trim()) {
    const s = raw.trim();
    if (s.startsWith('[') || s.startsWith('{')) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parseAkuntansiKunci(parsed);
      } catch {
        // fall through
      }
    }
    return parseAkuntansiQuickText(s);
  }
  return [];
}

/**
 * Supports Excel tab-separated, pipe '|', or semicolon ';' lines:
 * - 5 cols: Keterangan | Akun | D/K | Nominal | Bobot
 * - 4 cols: Keterangan | Akun | D/K | Nominal
 * - 3 cols: Akun | D/K | Nominal
 * - 2 cols: Akun | Nominal (posisi = 'N')
 */
export function parseAkuntansiQuickText(text: string): AkuntansiKunciRow[] {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);
  const out: AkuntansiKunciRow[] = [];

  lines.forEach((line, idx) => {
    const delim = line.includes('\t') ? '\t' : line.includes('|') ? '|' : ';';
    const cols = line.split(delim).map(c => c.trim());
    if (cols.length === 1 && !cols[0]) return;

    // Skip obvious header row
    const firstLower = cols[0].toLowerCase();
    if (
      idx === 0 &&
      (firstLower === 'tanggal' || firstLower === 'keterangan' || firstLower === 'akun' || firstLower === 'nama akun')
    ) {
      return;
    }

    if (cols.length >= 5) {
      out.push({
        no: out.length + 1,
        keterangan: cols[0],
        akun: cols[1],
        posisi: parseAkuntansiPosisi(cols[2]),
        nominal: parseAkuntansiNominal(cols[3]),
        bobot: Number(cols[4]) > 0 ? Number(cols[4]) : 10
      });
    } else if (cols.length === 4) {
      out.push({
        no: out.length + 1,
        keterangan: cols[0],
        akun: cols[1],
        posisi: parseAkuntansiPosisi(cols[2]),
        nominal: parseAkuntansiNominal(cols[3]),
        bobot: 10
      });
    } else if (cols.length === 3) {
      // Check if col[1] is D/K or Account name
      const col1Upper = cols[1].toUpperCase();
      const isPos = /^(D|DEBIT|DEBET|K|KREDIT|CREDIT|C|N|NILAI)$/.test(col1Upper);
      if (isPos) {
        out.push({
          no: out.length + 1,
          keterangan: '',
          akun: cols[0],
          posisi: parseAkuntansiPosisi(cols[1]),
          nominal: parseAkuntansiNominal(cols[2]),
          bobot: 10
        });
      } else {
        out.push({
          no: out.length + 1,
          keterangan: cols[0],
          akun: cols[1],
          posisi: 'N',
          nominal: parseAkuntansiNominal(cols[2]),
          bobot: 10
        });
      }
    } else if (cols.length === 2) {
      out.push({
        no: out.length + 1,
        keterangan: '',
        akun: cols[0],
        posisi: 'N',
        nominal: parseAkuntansiNominal(cols[1]),
        bobot: 10
      });
    }
  });
  return out;
}

export function serializeAkuntansiKunci(rows: AkuntansiKunciRow[]): string {
  const clean = rows
    .filter(r => r.akun.trim() || r.keterangan.trim() || Number(r.nominal) !== 0)
    .map((r, idx) => ({
      no: idx + 1,
      keterangan: String(r.keterangan || '').trim(),
      akun: String(r.akun || '').trim(),
      posisi: parseAkuntansiPosisi(r.posisi),
      nominal: parseAkuntansiNominal(r.nominal),
      bobot: Number(r.bobot) > 0 ? Number(r.bobot) : 10
    }));
  if (clean.length === 0) return '';
  return JSON.stringify(clean);
}

export function parseAkuntansiSiswa(raw: any): AkuntansiSiswaRow[] {
  if (Array.isArray(raw)) {
    return raw.map((r, idx) => ({
      no: Number(r?.no) > 0 ? Math.floor(Number(r.no)) : idx + 1,
      keterangan: String(r?.keterangan || '').trim(),
      akun: String(r?.akun || '').trim(),
      posisi: parseAkuntansiPosisi(r?.posisi),
      nominal: parseAkuntansiNominal(r?.nominal)
    }));
  }
  if (typeof raw === 'string' && raw.trim()) {
    const s = raw.trim();
    if (s.startsWith('[') || s.startsWith('{')) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parseAkuntansiSiswa(parsed);
      } catch {
        // fall through
      }
    }
    return parseAkuntansiQuickText(s).map(r => ({
      no: r.no,
      keterangan: r.keterangan,
      akun: r.akun,
      posisi: r.posisi,
      nominal: r.nominal
    }));
  }
  return [];
}

export function serializeAkuntansiSiswa(rows: AkuntansiSiswaRow[]): string {
  const clean = rows
    .filter(r => String(r.akun || '').trim() || parseAkuntansiNominal(r.nominal) !== 0)
    .map((r, idx) => ({
      no: idx + 1,
      keterangan: String(r.keterangan || '').trim(),
      akun: String(r.akun || '').trim(),
      posisi: parseAkuntansiPosisi(r.posisi),
      nominal: parseAkuntansiNominal(r.nominal)
    }));
  if (clean.length === 0) return '';
  return JSON.stringify(clean);
}

function akunStringsMatch(kunciAkun: string, siswaAkun: string): boolean {
  const k = normalizeAkunName(kunciAkun);
  const s = normalizeAkunName(siswaAkun);
  if (!k || !s) return false;
  if (k === s) return true;
  // Allow minor abbreviation or extra qualifier when length >= 4
  const kTokens = k.split(' ').filter(Boolean);
  const sTokens = s.split(' ').filter(Boolean);
  if (kTokens.length === 1 && sTokens.length === 1) {
    return k.includes(s) || s.includes(k);
  }
  const common = kTokens.filter(t => sTokens.includes(t));
  return common.length >= Math.min(kTokens.length, sTokens.length) && common.length >= 1 && (k.includes(s) || s.includes(k) || common.length / Math.max(kTokens.length, sTokens.length) >= 0.75);
}

export function koreksiAkuntansiSiswa(kunciRaw: any, jawabanRaw: any): AkuntansiKoreksiResult {
  const kunciRows = parseAkuntansiKunci(kunciRaw).filter(
    r => r.akun.trim() || r.nominal !== 0
  );
  const siswaRows = parseAkuntansiSiswa(jawabanRaw).filter(
    r => r.akun.trim() || r.nominal !== 0
  );

  let totalDebitKunci = 0;
  let totalKreditKunci = 0;
  for (const kr of kunciRows) {
    if (kr.posisi === 'D') totalDebitKunci += kr.nominal;
    else if (kr.posisi === 'K') totalKreditKunci += kr.nominal;
  }

  let totalDebitSiswa = 0;
  let totalKreditSiswa = 0;
  for (const sr of siswaRows) {
    if (sr.posisi === 'D') totalDebitSiswa += sr.nominal;
    else if (sr.posisi === 'K') totalKreditSiswa += sr.nominal;
  }

  const seimbangSiswa =
    (totalDebitSiswa > 0 || totalKreditSiswa > 0) &&
    Math.abs(totalDebitSiswa - totalKreditSiswa) <= 1;

  // Match each key row against the best unmatched student row (exact index boost + account/pos/nominal score)
  const usedSiswaIdx = new Set<number>();

  const scoreCandidate = (kr: AkuntansiKunciRow, kIdx: number, sr: AkuntansiSiswaRow, sIdx: number) => {
    const akunCocok = akunStringsMatch(kr.akun, sr.akun);
    const posisiCocok = kr.posisi === 'N' ? true : kr.posisi === sr.posisi;
    const nominalCocok = Math.abs(kr.nominal - sr.nominal) <= 1;
    const samePosBoost = kIdx === sIdx ? 0.05 : 0;
    const ketMatchBoost =
      kr.keterangan && sr.keterangan && normalizeText(kr.keterangan) === normalizeText(sr.keterangan)
        ? 0.05
        : 0;

    let ratio = 0;
    if (kr.posisi === 'N') {
      if (akunCocok) ratio += 0.5;
      if (nominalCocok) ratio += 0.5;
    } else {
      if (akunCocok) ratio += 0.4;
      if (posisiCocok) ratio += 0.2;
      if (nominalCocok) ratio += 0.4;
    }
    return {
      akunCocok,
      posisiCocok,
      nominalCocok,
      ratio,
      rankScore: ratio + samePosBoost + ketMatchBoost
    };
  };

  // First pass: lock exact 100% matches (preferring same index), second pass: best partial matches
  const matchedStudentForKunci: Array<{ idx: number; evalRes: ReturnType<typeof scoreCandidate> } | null> =
    new Array(kunciRows.length).fill(null);

  for (let pass = 0; pass < 2; pass++) {
    kunciRows.forEach((kr, kIdx) => {
      if (matchedStudentForKunci[kIdx]) return;
      let bestIdx = -1;
      let bestEval: ReturnType<typeof scoreCandidate> | null = null;
      siswaRows.forEach((sr, sIdx) => {
        if (usedSiswaIdx.has(sIdx)) return;
        const ev = scoreCandidate(kr, kIdx, sr, sIdx);
        if (pass === 0 && ev.ratio < 0.999) return;
        if (pass === 1 && ev.ratio <= 0.2 && !ev.akunCocok) return;
        if (!bestEval || ev.rankScore > bestEval.rankScore) {
          bestIdx = sIdx;
          bestEval = ev;
        }
      });
      if (bestIdx >= 0 && bestEval) {
        usedSiswaIdx.add(bestIdx);
        matchedStudentForKunci[kIdx] = { idx: bestIdx, evalRes: bestEval };
      }
    });
  }

  let totalBobot = 0;
  let totalSkor = 0;
  let benar = 0;
  let sebagian = 0;
  let salah = 0;

  const detail: AkuntansiDetailItem[] = kunciRows.map((kr, kIdx) => {
    const bobot = Number(kr.bobot) > 0 ? Number(kr.bobot) : 10;
    totalBobot += bobot;
    const matched = matchedStudentForKunci[kIdx];
    const sr = matched ? siswaRows[matched.idx] : null;

    if (!sr || !matched) {
      salah++;
      return {
        no: kr.no,
        keterangan: kr.keterangan,
        akunKunci: kr.akun,
        posisiKunci: kr.posisi,
        nominalKunci: kr.nominal,
        akunSiswa: '',
        posisiSiswa: '',
        nominalSiswa: 0,
        akunCocok: false,
        posisiCocok: false,
        nominalCocok: false,
        bobot,
        skor: 0,
        status: siswaRows.length === 0 ? 'kosong' : 'salah'
      };
    }

    const { akunCocok, posisiCocok, nominalCocok, ratio } = matched.evalRes;
    const skor = Math.round(bobot * ratio * 10) / 10;
    totalSkor += skor;

    let status: 'benar' | 'sebagian' | 'salah' = 'salah';
    if (ratio >= 0.999) {
      status = 'benar';
      benar++;
    } else if (ratio >= 0.35) {
      status = 'sebagian';
      sebagian++;
    } else {
      status = 'salah';
      salah++;
    }

    return {
      no: kr.no,
      keterangan: kr.keterangan || sr.keterangan,
      akunKunci: kr.akun,
      posisiKunci: kr.posisi,
      nominalKunci: kr.nominal,
      akunSiswa: sr.akun,
      posisiSiswa: sr.posisi,
      nominalSiswa: sr.nominal,
      akunCocok,
      posisiCocok,
      nominalCocok,
      bobot,
      skor,
      status
    };
  });

  const adaKunci = kunciRows.length > 0;
  const adaJawaban = siswaRows.length > 0;
  const nilai =
    adaKunci && totalBobot > 0
      ? Math.min(100, Math.round((totalSkor / totalBobot) * 100))
      : 0;

  return {
    tipe: 'akuntansi',
    totalBaris: kunciRows.length,
    jumlahKunci: kunciRows.length,
    totalBobot,
    totalSkor: Math.round(totalSkor * 10) / 10,
    nilai,
    adaKunci,
    adaJawaban,
    benar,
    sebagian,
    salah,
    totalDebitKunci,
    totalKreditKunci,
    totalDebitSiswa,
    totalKreditSiswa,
    seimbangSiswa,
    detail
  };
}

/**
 * Strips answers/keys before sending Tugas metadata to StudentPortal!
 */
export function buildStudentTugasSafeMeta(t: any): {
  SoalUraianMeta: Array<{ no: number; pertanyaan: string; bobot: number }>;
  AkuntansiMeta: Array<{ no: number; keterangan: string; bobot: number }>;
} {
  const tipe = String(t?.TipeSoal || 'umum').toLowerCase();
  if (tipe === 'uraian') {
    const items = parseUraianKunci(t?.KunciJawaban, Number(t?.JumlahSoal || 0));
    return {
      SoalUraianMeta: items.map(it => ({
        no: it.no,
        pertanyaan: it.pertanyaan,
        bobot: it.bobot
      })),
      AkuntansiMeta: []
    };
  }
  if (tipe === 'akuntansi') {
    const rows = parseAkuntansiKunci(t?.KunciJawaban);
    return {
      SoalUraianMeta: [],
      AkuntansiMeta: rows.map(r => ({
        no: r.no,
        keterangan: r.keterangan,
        bobot: r.bobot
      }))
    };
  }
  return { SoalUraianMeta: [], AkuntansiMeta: [] };
}
