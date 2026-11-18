export type PoinTargetKomponen = 'BonusPoin' | 'Sikap' | 'Tugas' | 'Proyek' | 'UTS' | 'UAS';

export const POIN_TARGET_OPTIONS: {
  key: PoinTargetKomponen;
  label: string;
  shortLabel: string;
}[] = [
  {
    key: 'BonusPoin',
    label: 'Bonus Nilai Akhir (+langsung ke Nilai Akhir, maks 100)',
    shortLabel: 'Bonus Nilai Akhir'
  },
  { key: 'Tugas', label: 'Nilai Tugas & Harian', shortLabel: 'Tugas' },
  { key: 'Sikap', label: 'Nilai Kehadiran & Sikap', shortLabel: 'Sikap' },
  { key: 'Proyek', label: 'Nilai Proyek / Praktik', shortLabel: 'Proyek' },
  { key: 'UTS', label: 'Nilai UTS', shortLabel: 'UTS' },
  { key: 'UAS', label: 'Nilai UAS', shortLabel: 'UAS' }
];

export function normalizePoinTarget(raw?: string): PoinTargetKomponen {
  const clean = String(raw || '').trim();
  const found = POIN_TARGET_OPTIONS.find(o => o.key === clean);
  return found ? found.key : 'BonusPoin';
}

export function getPoinTargetLabel(raw?: string): string {
  const key = normalizePoinTarget(raw);
  return POIN_TARGET_OPTIONS.find(o => o.key === key)?.shortLabel || 'Bonus Nilai Akhir';
}

export interface StudentPoinStats {
  aktif: boolean;
  modeLogin: 'harian' | 'setiap_login';
  poinPerLogin: number;
  poinPerNilai: number;
  targetDefault: PoinTargetKomponen;
  saldoPoin: number;
  totalDidapat: number;
  totalDikonversi: number;
  nilaiSiapDitambahkan: number;
  nilaiSudahDitambahkan: number;
  earnedToday: number;
  totalBintang: number;
  loggedInToday: boolean;
  siapRows: any[];
  riwayat: any[];
}

export function computeStudentPoinStats(
  allPoinRows: any[],
  siswaId: string,
  pengaturan: Record<string, any> | undefined | null,
  todayYmd: string
): StudentPoinStats {
  const set = pengaturan || {};
  const aktif = String(set.poinLoginAktif ?? '1') !== '0';
  const modeLogin: 'harian' | 'setiap_login' =
    set.poinModeLogin === 'setiap_login' ? 'setiap_login' : 'harian';
  const poinPerLogin = Math.max(1, Math.round(Number(set.poinPerLogin || 5) || 5));
  const poinPerNilai = Math.max(1, Math.round(Number(set.poinPerNilai || 5) || 5));
  const targetDefault = normalizePoinTarget(set.poinTargetDefault);

  const mine = (allPoinRows || []).filter(r => r && r.SiswaID === siswaId);
  let saldoPoin = 0;
  let totalDidapat = 0;
  let totalDikonversi = 0;
  let nilaiSiapDitambahkan = 0;
  let nilaiSudahDitambahkan = 0;
  let earnedToday = 0;
  let totalBintang = 0;
  let loggedInToday = false;
  const siapRows: any[] = [];

  mine.forEach(r => {
    const jp = Number(r.JumlahPoin || 0) || 0;
    const nk = Number(r.NilaiKonversi || 0) || 0;
    saldoPoin += jp;
    if (jp > 0) totalDidapat += jp;
    if (r.Jenis === 'login') {
      totalBintang += 1;
      if (r.Tanggal === todayYmd) {
        loggedInToday = true;
        if (jp > 0) earnedToday += jp;
      }
    }
    if (r.Jenis === 'konversi') {
      totalDikonversi += Math.abs(jp);
      if (r.Status === 'Ditambahkan') {
        nilaiSudahDitambahkan += nk;
      } else {
        nilaiSiapDitambahkan += nk;
        siapRows.push(r);
      }
    }
  });

  const riwayat = mine
    .slice()
    .sort((a, b) => String(b.Waktu || b.Tanggal || '').localeCompare(String(a.Waktu || a.Tanggal || '')))
    .slice(0, 30);

  return {
    aktif,
    modeLogin,
    poinPerLogin,
    poinPerNilai,
    targetDefault,
    saldoPoin: Math.max(0, saldoPoin),
    totalDidapat,
    totalDikonversi,
    nilaiSiapDitambahkan,
    nilaiSudahDitambahkan,
    earnedToday,
    totalBintang,
    loggedInToday,
    siapRows,
    riwayat
  };
}
