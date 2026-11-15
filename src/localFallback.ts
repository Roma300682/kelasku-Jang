import { getKaldikJabarEvents, KALDIK_JABAR_REF } from './data/kaldikJabar';

const STORAGE_KEY = 'mk_local_db_v1';
const SESSION_KEY = 'mk_local_sessions_v1';

interface LocalDb {
  admin: { user: string; passHash: string } | null;
  sheets: Record<string, Record<string, string>[]>;
}

interface LocalSession {
  role: 'admin' | 'staf' | 'siswa';
  sid: string;
  nama: string;
  expires: number;
}

const PENGATURAN_AWAL: Record<string, string> = {
  sekolah: 'Sistem Manajemen Kelas',
  logo: '',
  loginBg: 'preset:classroom',
  jurusan: 'MIPA, IPS, Bahasa',
  jurusanLogos: '{}',
  waInfo: '',
  emailPemulihan: '',
  kodeReset: '',
  guru: '',
  wali: '',
  semester: 'Ganjil 2026/2027',
  mulai: '2026-07-15',
  kkm: '75',
  b_sikap: '10',
  b_tugas: '20',
  b_proyek: '20',
  b_uts: '20',
  b_uas: '30',
  kaldikAutoSync: '1',
  kaldikWilayah: KALDIK_JABAR_REF.wilayah,
  kaldikTahunAjaran: KALDIK_JABAR_REF.tahunAjaran,
  kaldikLastSync: ''
};

const PENGATURAN_DEMO: Record<string, string> = {
  ...PENGATURAN_AWAL,
  sekolah: 'SMA Negeri 1 Nusantara',
  waInfo: '6281234567890',
  emailPemulihan: 'robisaiful@gmail.com',
  kodeReset: 'NUSANTARA2026',
  guru: 'Dra. Ratna Sari, M.Pd.',
  wali: 'Dra. Ratna Sari, M.Pd.',
  kaldikLastSync: '2026-07-15'
};

async function sha256Base64(salt: string, teks: string): Promise<string> {
  const bytes = new TextEncoder().encode(salt + '|' + teks);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const arr = Array.from(new Uint8Array(digest));
  let bin = '';
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
}

function uidShort(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function fmtYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function createCleanLocalDb(): LocalDb {
  return {
    admin: null,
    sheets: {
      Pengaturan: Object.entries(PENGATURAN_AWAL).map(([Kunci, Nilai]) => ({ Kunci, Nilai })),
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
      BerkasCloud: [],
      CBT: [],
      HasilCBT: [],
      Pengguna: [],
      Akun: [],
      Pesan: []
    }
  };
}

async function createSeedLocalDb(): Promise<LocalDb> {
  const today = new Date();
  const d0 = fmtYmd(today);
  const d1 = fmtYmd(new Date(today.getTime() - 86400000));
  const d2 = fmtYmd(new Date(today.getTime() - 2 * 86400000));
  const d3 = fmtYmd(new Date(today.getTime() - 3 * 86400000));

  const mapelList = [
    { ID: 'mp1', Nama: 'Matematika' },
    { ID: 'mp2', Nama: 'Bahasa Indonesia' },
    { ID: 'mp3', Nama: 'Bahasa Inggris' },
    { ID: 'mp4', Nama: 'Fisika' },
    { ID: 'mp5', Nama: 'Kimia' },
    { ID: 'mp6', Nama: 'Biologi' },
    { ID: 'mp7', Nama: 'Sejarah Indonesia' },
    { ID: 'mp8', Nama: 'Informatika' },
    { ID: 'mp9', Nama: 'PJOK' },
    { ID: 'mp10', Nama: 'Pendidikan Pancasila' }
  ];

  const kelasList = [
    { ID: 'kls_10a', Nama: 'X MIPA 1', Jurusan: 'MIPA', Mapel: '' },
    { ID: 'kls_10b', Nama: 'X MIPA 2', Jurusan: 'MIPA', Mapel: '' },
    { ID: 'kls_11a', Nama: 'XI MIPA 1', Jurusan: 'MIPA', Mapel: '' }
  ];

  const penggunaList = [
    {
      ID: 'usr_wali1',
      Nama: 'Dra. Ratna Sari, M.Pd.',
      Username: 'ratna',
      Peran: 'wali,guru',
      Kelas: 'kls_10a,kls_10b',
      Hash: await sha256Base64('usr_wali1', 'guru12345'),
      Mapel: 'mp1',
      KelasWali: 'kls_10a',
      KelasMengajar: 'kls_10a,kls_10b'
    },
    {
      ID: 'usr_guru1',
      Nama: 'Budi Santoso, S.Kom.',
      Username: 'budi',
      Peran: 'wali,guru',
      Kelas: 'kls_11a,kls_10a',
      Hash: await sha256Base64('usr_guru1', 'guru12345'),
      Mapel: 'mp8,mp4',
      KelasWali: 'kls_11a',
      KelasMengajar: 'kls_10a,kls_11a'
    }
  ];

  const siswaList = [
    { ID: 'sis_01', Kelas: 'kls_10a', Nama: 'Adinda Putri Maharani', NIS: '102601', NoSiswa: '081234567801', NoOrtu: '081398765001', Alamat: 'Jl. Merdeka No. 12', Kesehatan: 'Normal' },
    { ID: 'sis_02', Kelas: 'kls_10a', Nama: 'Bagas Pratama Wijaya', NIS: '102602', NoSiswa: '081234567802', NoOrtu: '081398765002', Alamat: 'Jl. Sudirman No. 45', Kesehatan: 'Alergi debu' },
    { ID: 'sis_03', Kelas: 'kls_10a', Nama: 'Citra Kirana Lestari', NIS: '102603', NoSiswa: '081234567803', NoOrtu: '081398765003', Alamat: 'Jl. Diponegoro No. 8', Kesehatan: 'Normal' },
    { ID: 'sis_04', Kelas: 'kls_10a', Nama: 'Dimas Aditya Saputra', NIS: '102604', NoSiswa: '081234567804', NoOrtu: '081398765004', Alamat: 'Jl. Gatot Subroto No. 19', Kesehatan: 'Minus mata (-1.5)' },
    { ID: 'sis_05', Kelas: 'kls_10a', Nama: 'Eka Fitriani Rahmawati', NIS: '102605', NoSiswa: '081234567805', NoOrtu: '081398765005', Alamat: 'Jl. Ahmad Yani No. 33', Kesehatan: 'Normal' },
    { ID: 'sis_06', Kelas: 'kls_10a', Nama: 'Fajar Nugroho Hidayat', NIS: '102606', NoSiswa: '081234567806', NoOrtu: '081398765006', Alamat: 'Jl. Kartini No. 7', Kesehatan: 'Asma ringan' },
    { ID: 'sis_07', Kelas: 'kls_10a', Nama: 'Gita Nadia Permata', NIS: '102607', NoSiswa: '081234567807', NoOrtu: '081398765007', Alamat: 'Jl. Imam Bonjol No. 21', Kesehatan: 'Normal' },
    { ID: 'sis_08', Kelas: 'kls_10a', Nama: 'Hafiz Ramadhan Putra', NIS: '102608', NoSiswa: '081234567808', NoOrtu: '081398765008', Alamat: 'Jl. Pahlawan No. 54', Kesehatan: 'Normal' },
    { ID: 'sis_09', Kelas: 'kls_10a', Nama: 'Indah Kusuma Wardani', NIS: '102609', NoSiswa: '081234567809', NoOrtu: '081398765009', Alamat: 'Jl. Veteran No. 14', Kesehatan: 'Normal' },
    { ID: 'sis_10', Kelas: 'kls_10a', Nama: 'Joko Susilo Wibowo', NIS: '102610', NoSiswa: '081234567810', NoOrtu: '081398765010', Alamat: 'Jl. Pemuda No. 28', Kesehatan: 'Normal' },
    { ID: 'sis_11', Kelas: 'kls_10a', Nama: 'Kartika Sari Dewi', NIS: '102611', NoSiswa: '081234567811', NoOrtu: '081398765011', Alamat: 'Jl. Cendrawasih No. 9', Kesehatan: 'Normal' },
    { ID: 'sis_12', Kelas: 'kls_10a', Nama: 'Luthfi Hakim Maulana', NIS: '102612', NoSiswa: '081234567812', NoOrtu: '081398765012', Alamat: 'Jl. Melati No. 3', Kesehatan: 'Normal' },
    { ID: 'sis_13', Kelas: 'kls_10b', Nama: 'Muhammad Rizky Pratama', NIS: '102613', NoSiswa: '081234567813', NoOrtu: '081398765013', Alamat: 'Jl. Kenanga No. 11', Kesehatan: 'Normal' },
    { ID: 'sis_14', Kelas: 'kls_10b', Nama: 'Nabila Azzahra Putri', NIS: '102614', NoSiswa: '081234567814', NoOrtu: '081398765014', Alamat: 'Jl. Anggrek No. 20', Kesehatan: 'Normal' },
    { ID: 'sis_15', Kelas: 'kls_10b', Nama: 'Oka Mahendra Kusuma', NIS: '102615', NoSiswa: '081234567815', NoOrtu: '081398765015', Alamat: 'Jl. Dahlia No. 6', Kesehatan: 'Normal' },
    { ID: 'sis_16', Kelas: 'kls_10b', Nama: 'Putri Salsabila Ramadhani', NIS: '102616', NoSiswa: '081234567816', NoOrtu: '081398765016', Alamat: 'Jl. Flamboyan No. 18', Kesehatan: 'Normal' },
    { ID: 'sis_17', Kelas: 'kls_10b', Nama: 'Qori Firmansyah', NIS: '102617', NoSiswa: '081234567817', NoOrtu: '081398765017', Alamat: 'Jl. Teratai No. 4', Kesehatan: 'Normal' },
    { ID: 'sis_18', Kelas: 'kls_10b', Nama: 'Rania Safitri Handayani', NIS: '102618', NoSiswa: '081234567818', NoOrtu: '081398765018', Alamat: 'Jl. Kamboja No. 15', Kesehatan: 'Normal' },
    { ID: 'sis_19', Kelas: 'kls_11a', Nama: 'Raka Danuarta', NIS: '112601', NoSiswa: '081234567819', NoOrtu: '081398765019', Alamat: 'Jl. Mawar No. 5', Kesehatan: 'Normal' },
    { ID: 'sis_20', Kelas: 'kls_11a', Nama: 'Salsa Bila Khairunnisa', NIS: '112602', NoSiswa: '081234567820', NoOrtu: '081398765020', Alamat: 'Jl. Tulip No. 9', Kesehatan: 'Normal' },
    { ID: 'sis_21', Kelas: 'kls_11a', Nama: 'Taufik Hidayatulloh', NIS: '112603', NoSiswa: '081234567821', NoOrtu: '081398765021', Alamat: 'Jl. Kutilang No. 22', Kesehatan: 'Normal' },
    { ID: 'sis_22', Kelas: 'kls_11a', Nama: 'Ulfa Nurjanah', NIS: '112604', NoSiswa: '081234567822', NoOrtu: '081398765022', Alamat: 'Jl. Merpati No. 13', Kesehatan: 'Minus mata (-1.0)' },
    { ID: 'sis_23', Kelas: 'kls_11a', Nama: 'Vino Alfarizi', NIS: '112605', NoSiswa: '081234567823', NoOrtu: '081398765023', Alamat: 'Jl. Rajawali No. 7', Kesehatan: 'Normal' },
    { ID: 'sis_24', Kelas: 'kls_11a', Nama: 'Wulan Dari Puspita', NIS: '112606', NoSiswa: '081234567824', NoOrtu: '081398765024', Alamat: 'Jl. Elang No. 31', Kesehatan: 'Normal' }
  ];

  const akunList = await Promise.all(
    siswaList.map(async s => ({ SiswaID: s.ID, Hash: await sha256Base64(s.ID, '123456') }))
  );

  const kls10A = siswaList.filter(s => s.Kelas === 'kls_10a');
  const kls10B = siswaList.filter(s => s.Kelas === 'kls_10b');
  const kls11A = siswaList.filter(s => s.Kelas === 'kls_11a');
  const absensiList: Record<string, string>[] = [];
  [d3, d2, d1, d0].forEach((tgl, idx) => {
    kls10A.forEach((s, sIdx) => {
      let kode = 'H';
      let ket = '';
      if (idx === 1 && sIdx === 3) { kode = 'S'; ket = 'Demam (surat orang tua)'; }
      if (idx === 2 && sIdx === 5) { kode = 'I'; ket = 'Acara keluarga'; }
      if (idx === 2 && sIdx === 9) { kode = 'A'; ket = 'Tanpa keterangan'; }
      if (idx === 3 && sIdx === 1) { kode = 'T'; ket = 'Hadir 07:12 karena ban bocor'; }
      if (idx === 3 && sIdx === 9) { kode = 'A'; ket = 'Belum konfirmasi'; }
      absensiList.push({ Kelas: 'kls_10a', Tanggal: tgl, SiswaID: s.ID, Kode: kode, Keterangan: ket, Sumber: '' });
    });
  });
  [d1, d0].forEach((tgl, idx) => {
    kls10B.forEach((s, sIdx) => {
      absensiList.push({
        Kelas: 'kls_10b',
        Tanggal: tgl,
        SiswaID: s.ID,
        Kode: idx === 1 && sIdx === 4 ? 'I' : 'H',
        Keterangan: idx === 1 && sIdx === 4 ? 'Lomba olimpiade kabupaten' : '',
        Sumber: ''
      });
    });
    kls11A.forEach((s, sIdx) => {
      absensiList.push({
        Kelas: 'kls_11a',
        Tanggal: tgl,
        SiswaID: s.ID,
        Kode: idx === 1 && sIdx === 2 ? 'T' : 'H',
        Keterangan: idx === 1 && sIdx === 2 ? 'Hadir 07:10' : '',
        Sumber: ''
      });
    });
  });

  const tugasList = [
    { ID: 'tug_1', Kelas: 'kls_10a', Judul: 'Latihan Eksponen & Logaritma', Mapel: 'Matematika', Deskripsi: 'Kerjakan soal latihan nomor 1-10 lengkap dengan langkah penyelesaian.', Tenggat: d2, Jenis: 'Tugas', FileID: '', NamaFile: '' },
    { ID: 'tug_2', Kelas: 'kls_10a', Judul: 'Kuis Sistem Persamaan Linear', Mapel: 'Matematika', Deskripsi: 'Selesaikan persamaan linear 3 variabel dan unggah hasil kerja.', Tenggat: d1, Jenis: 'Kuis harian', FileID: '', NamaFile: '' },
    { ID: 'tug_3', Kelas: 'kls_10a', Judul: 'Proyek Pemodelan Fungsi Kuadrat', Mapel: 'Matematika', Deskripsi: 'Buat laporan pemodelan parabola dalam kehidupan sehari-hari (PDF atau foto grafik).', Tenggat: fmtYmd(new Date(today.getTime() + 5 * 86400000)), Jenis: 'Proyek', FileID: '', NamaFile: '' },
    { ID: 'tug_4', Kelas: 'kls_10a', Judul: 'Laporan Pengukuran Jangka Sorong & Mikrometer', Mapel: 'Fisika', Deskripsi: 'Catat hasil pengukuran benda di laboratorium beserta ketidakpastian pengukuran.', Tenggat: fmtYmd(new Date(today.getTime() + 3 * 86400000)), Jenis: 'Praktik', FileID: '', NamaFile: '' },
    { ID: 'tug_5', Kelas: 'kls_10a', Judul: 'Diagram Alir (Flowchart) Program Kasir Sederhana', Mapel: 'Informatika', Deskripsi: 'Buat flowchart perhitungan diskon belanja dan unggah dalam format PDF atau gambar.', Tenggat: fmtYmd(new Date(today.getTime() + 4 * 86400000)), Jenis: 'Proyek', FileID: '', NamaFile: '' },
    { ID: 'tug_6', Kelas: 'kls_10a', Judul: 'Analisis Struktur Teks Laporan Hasil Observasi', Mapel: 'Bahasa Indonesia', Deskripsi: 'Identifikasi pernyataan umum, deskripsi bagian, dan kaidah kebahasaan dari teks bacaan.', Tenggat: fmtYmd(new Date(today.getTime() + 6 * 86400000)), Jenis: 'Tugas', FileID: '', NamaFile: '' },
    { ID: 'tug_7', Kelas: 'kls_10b', Judul: 'Latihan Soal Fungsi Kuadrat & Diskriminan', Mapel: 'Matematika', Deskripsi: 'Kerjakan 8 soal penentuan titik puncak dan jenis akar fungsi kuadrat.', Tenggat: fmtYmd(new Date(today.getTime() + 3 * 86400000)), Jenis: 'Tugas', FileID: '', NamaFile: '' },
    { ID: 'tug_8', Kelas: 'kls_10b', Judul: 'Praktikum Klasifikasi Larutan Asam & Basa', Mapel: 'Kimia', Deskripsi: 'Susun tabel hasil uji indikator alami dan kertas lakmus.', Tenggat: fmtYmd(new Date(today.getTime() + 5 * 86400000)), Jenis: 'Praktik', FileID: '', NamaFile: '' },
    { ID: 'tug_9', Kelas: 'kls_11a', Judul: 'Pemodelan Matriks Transformasi Geometri', Mapel: 'Matematika', Deskripsi: 'Selesaikan latihan translasi, refleksi, dan rotasi menggunakan perkalian matriks.', Tenggat: fmtYmd(new Date(today.getTime() + 4 * 86400000)), Jenis: 'Tugas', FileID: '', NamaFile: '' },
    { ID: 'tug_10', Kelas: 'kls_11a', Judul: 'Mini Riset Keanekaragaman Sel & Jaringan', Mapel: 'Biologi', Deskripsi: 'Presentasikan perbedaan struktur sel hewan dan sel tumbuhan beserta fungsinya.', Tenggat: fmtYmd(new Date(today.getTime() + 6 * 86400000)), Jenis: 'Proyek', FileID: '', NamaFile: '' }
  ];

  const pengumpulanList: Record<string, string>[] = [];
  const nilaiList: Record<string, string>[] = [];
  kls10A.forEach((s, i) => {
    const n1 = String(82 + ((i * 3) % 16));
    const n2 = String(78 + ((i * 5) % 20));
    const nProyek = String(84 + ((i * 2) % 14));
    const nUTS = String(76 + ((i * 4) % 22));
    const nUAS = String(80 + ((i * 3) % 18));
    pengumpulanList.push(
      { TugasID: 'tug_1', SiswaID: s.ID, Status: i === 9 ? 'Terlambat' : 'Tepat Waktu', Nilai: n1, FileID: '', NamaFile: '', TanggalKumpul: d2, CatatanSiswa: '' },
      { TugasID: 'tug_2', SiswaID: s.ID, Status: i === 5 ? 'Terlambat' : 'Tepat Waktu', Nilai: n2, FileID: '', NamaFile: '', TanggalKumpul: d1, CatatanSiswa: '' },
      { TugasID: 'tug_3', SiswaID: s.ID, Status: i < 8 ? 'Tepat Waktu' : 'Belum', Nilai: i < 8 ? nProyek : '', FileID: '', NamaFile: '', TanggalKumpul: i < 8 ? d1 : '', CatatanSiswa: '' }
    );
    nilaiList.push({
      Kelas: 'kls_10a',
      SiswaID: s.ID,
      Sikap: i === 9 ? '80' : '95',
      Tugas: String(Math.round((Number(n1) + Number(n2)) / 2)),
      Proyek: nProyek,
      UTS: i === 9 ? '68' : nUTS,
      UAS: i === 9 ? '70' : nUAS
    });
  });
  kls10B.forEach((s, i) => {
    nilaiList.push({
      Kelas: 'kls_10b',
      SiswaID: s.ID,
      Sikap: '92',
      Tugas: String(82 + ((i * 3) % 14)),
      Proyek: String(85 + ((i * 2) % 12)),
      UTS: String(78 + ((i * 4) % 18)),
      UAS: String(81 + ((i * 3) % 16))
    });
    pengumpulanList.push({
      TugasID: 'tug_7',
      SiswaID: s.ID,
      Status: i < 4 ? 'Tepat Waktu' : 'Belum',
      Nilai: i < 4 ? String(84 + i * 2) : '',
      FileID: '',
      NamaFile: '',
      TanggalKumpul: i < 4 ? d1 : '',
      CatatanSiswa: ''
    });
  });
  kls11A.forEach((s, i) => {
    nilaiList.push({
      Kelas: 'kls_11a',
      SiswaID: s.ID,
      Sikap: '94',
      Tugas: String(84 + ((i * 2) % 12)),
      Proyek: String(86 + ((i * 3) % 11)),
      UTS: String(80 + ((i * 3) % 15)),
      UAS: String(83 + ((i * 2) % 14))
    });
    pengumpulanList.push({
      TugasID: 'tug_9',
      SiswaID: s.ID,
      Status: i < 5 ? 'Tepat Waktu' : 'Belum',
      Nilai: i < 5 ? String(85 + i * 2) : '',
      FileID: '',
      NamaFile: '',
      TanggalKumpul: i < 5 ? d1 : '',
      CatatanSiswa: ''
    });
  });

  const hariPiket = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
  const tugasPiket = ['Menyapu lantai', 'Mengepel', 'Menghapus papan tulis', 'Merapikan meja & kursi', 'Membuang sampah'];

  const sampleMateriCBT = `Ringkasan Materi Eksponen dan Logaritma:\n1. Sifat Eksponen: Untuk bilangan real a > 0, berlaku a^m × a^n = a^(m+n), a^m / a^n = a^(m-n), (a^m)^n = a^(m×n), dan a^0 = 1.\n2. Persamaan Eksponen: Jika a^f(x) = a^g(x) dengan a > 0 dan a ≠ 1, maka f(x) = g(x).\n3. Definisi Logaritma: ^a log b = c jika dan hanya jika a^c = b, dengan syarat basis a > 0, a ≠ 1, dan numerus b > 0.\n4. Sifat Logaritma: ^a log(x·y) = ^a log x + ^a log y; ^a log(x/y) = ^a log x - ^a log y; dan ^a log(x^n) = n · ^a log x.`;
  const sampleMateriInfCBT = `Ringkasan Materi Berpikir Komputasional & Flowchart:\n1. Empat pilar berpikir komputasional meliputi Dekomposisi, Pengenalan Pola, Abstraksi, dan Algoritma.\n2. Pada diagram alir (flowchart), simbol Oval (Terminator) menandai Mulai/Selesai, Persegi Panjang menandai Proses, Jajar Genjang menandai Input/Output, dan Belah Ketupat (Decision) menandai Percabangan Kondisi.`;

  return {
    admin: {
      user: 'admin',
      passHash: await sha256Base64('local-admin', 'admin12345')
    },
    sheets: {
      Pengaturan: Object.entries(PENGATURAN_DEMO).map(([Kunci, Nilai]) => ({ Kunci, Nilai })),
      Kelas: kelasList,
      Siswa: siswaList,
      Absensi: absensiList,
      Tugas: tugasList,
      Pengumpulan: pengumpulanList,
      Nilai: nilaiList,
      Perilaku: [
        { ID: 'per_1', Kelas: 'kls_10a', Tanggal: d2, SiswaID: 'sis_01', Jenis: 'Penguatan positif', Level: '', Catatan: 'Memimpin diskusi kelompok dan membantu teman memahami materi logaritma', TindakLanjut: 'Apresiasi di depan kelas' },
        { ID: 'per_2', Kelas: 'kls_10a', Tanggal: d1, SiswaID: 'sis_03', Jenis: 'Penguatan positif', Level: '', Catatan: 'Menyiapkan perangkat proyektor dan kebersihan kelas sebelum jam pertama', TindakLanjut: 'Pesan apresiasi ke orang tua' },
        { ID: 'per_3', Kelas: 'kls_10a', Tanggal: d1, SiswaID: 'sis_10', Jenis: 'Pelanggaran', Level: '1', Catatan: 'Kurang fokus saat penjelasan materi inti', TindakLanjut: 'Pengingat lisan' },
        { ID: 'per_4', Kelas: 'kls_10b', Tanggal: d1, SiswaID: 'sis_13', Jenis: 'Penguatan positif', Level: '', Catatan: 'Aktif membantu kelompok menyelesaikan praktikum pengukuran fisika', TindakLanjut: 'Apresiasi poin keaktifan' },
        { ID: 'per_5', Kelas: 'kls_11a', Tanggal: d1, SiswaID: 'sis_19', Jenis: 'Penguatan positif', Level: '', Catatan: 'Mengkoordinir persiapan presentasi proyek kelas dengan tertib', TindakLanjut: 'Apresiasi wali kelas' }
      ],
      Checklist: [0, 1, 2, 3, 4, 5].map(i => ({ Kelas: 'kls_10a', Item: String(i), Selesai: '1' })),
      DenahAtur: [
        { Kelas: 'kls_10a', Baris: '4', Kolom: '4', Grup: '2' },
        { Kelas: 'kls_10b', Baris: '3', Kolom: '4', Grup: '2' },
        { Kelas: 'kls_11a', Baris: '3', Kolom: '4', Grup: '2' }
      ],
      Denah: [
        ...kls10A.map((s, idx) => ({ Kelas: 'kls_10a', Baris: String(Math.floor(idx / 4) + 1), Kolom: String((idx % 4) + 1), SiswaID: s.ID })),
        ...kls10B.map((s, idx) => ({ Kelas: 'kls_10b', Baris: String(Math.floor(idx / 4) + 1), Kolom: String((idx % 4) + 1), SiswaID: s.ID })),
        ...kls11A.map((s, idx) => ({ Kelas: 'kls_11a', Baris: String(Math.floor(idx / 4) + 1), Kolom: String((idx % 4) + 1), SiswaID: s.ID }))
      ],
      Piket: [
        ...kls10A.map((s, i) => ({ ID: `pik_10a_${i + 1}`, Kelas: 'kls_10a', Hari: hariPiket[i % 5], SiswaID: s.ID, Tugas: tugasPiket[i % 5] })),
        ...kls10B.map((s, i) => ({ ID: `pik_10b_${i + 1}`, Kelas: 'kls_10b', Hari: hariPiket[i % 5], SiswaID: s.ID, Tugas: tugasPiket[i % 5] })),
        ...kls11A.map((s, i) => ({ ID: `pik_11a_${i + 1}`, Kelas: 'kls_11a', Hari: hariPiket[i % 5], SiswaID: s.ID, Tugas: tugasPiket[i % 5] }))
      ],
      Struktur: [
        { ID: 'str_1', Kelas: 'kls_10a', Jabatan: 'Ketua Kelas', SiswaID: 'sis_02', Tingkat: '1' },
        { ID: 'str_2', Kelas: 'kls_10a', Jabatan: 'Wakil Ketua', SiswaID: 'sis_04', Tingkat: '1' },
        { ID: 'str_3', Kelas: 'kls_10a', Jabatan: 'Sekretaris', SiswaID: 'sis_01', Tingkat: '2' },
        { ID: 'str_4', Kelas: 'kls_10a', Jabatan: 'Bendahara', SiswaID: 'sis_03', Tingkat: '2' },
        { ID: 'str_5', Kelas: 'kls_10a', Jabatan: 'Seksi Kebersihan', SiswaID: 'sis_05', Tingkat: '3' },
        { ID: 'str_6', Kelas: 'kls_10a', Jabatan: 'Seksi Keamanan', SiswaID: 'sis_06', Tingkat: '3' },
        { ID: 'str_9', Kelas: 'kls_10b', Jabatan: 'Ketua Kelas', SiswaID: 'sis_13', Tingkat: '1' },
        { ID: 'str_10', Kelas: 'kls_10b', Jabatan: 'Sekretaris', SiswaID: 'sis_14', Tingkat: '2' },
        { ID: 'str_12', Kelas: 'kls_11a', Jabatan: 'Ketua Kelas', SiswaID: 'sis_19', Tingkat: '1' },
        { ID: 'str_13', Kelas: 'kls_11a', Jabatan: 'Sekretaris', SiswaID: 'sis_20', Tingkat: '2' }
      ],
      Jadwal: [
        { ID: 'jd_1', Kelas: 'kls_10a', Hari: 'Senin', Mulai: '07:00', Selesai: '08:30', Mapel: 'Matematika', Guru: 'Dra. Ratna Sari, M.Pd.', Jenis: 'Pelajaran', Pekan: '' },
        { ID: 'jd_2', Kelas: 'kls_10a', Hari: 'Senin', Mulai: '08:30', Selesai: '09:15', Mapel: 'Bahasa Indonesia', Guru: 'Drs. Hendra Gunawan', Jenis: 'Pelajaran', Pekan: '' },
        { ID: 'jd_3', Kelas: 'kls_10a', Hari: 'Senin', Mulai: '09:15', Selesai: '09:30', Mapel: 'Istirahat', Guru: '', Jenis: 'Istirahat', Pekan: '' },
        { ID: 'jd_4', Kelas: 'kls_10a', Hari: 'Senin', Mulai: '09:30', Selesai: '11:00', Mapel: 'Fisika', Guru: 'Budi Santoso, S.Kom.', Jenis: 'Pelajaran', Pekan: '' },
        { ID: 'jd_5', Kelas: 'kls_10a', Hari: 'Selasa', Mulai: '07:00', Selesai: '08:30', Mapel: 'Informatika', Guru: 'Budi Santoso, S.Kom.', Jenis: 'Pelajaran', Pekan: '' },
        { ID: 'jd_6', Kelas: 'kls_10a', Hari: 'Selasa', Mulai: '08:30', Selesai: '09:15', Mapel: 'Kimia', Guru: 'Siti Aminah, S.Pd.', Jenis: 'Pelajaran', Pekan: '' },
        { ID: 'jd_7', Kelas: 'kls_10a', Hari: 'Rabu', Mulai: '07:00', Selesai: '08:30', Mapel: 'Matematika', Guru: 'Dra. Ratna Sari, M.Pd.', Jenis: 'Pelajaran', Pekan: '' },
        { ID: 'jd_8', Kelas: 'kls_10a', Hari: 'Rabu', Mulai: '08:30', Selesai: '10:00', Mapel: 'Biologi', Guru: 'Dewi Anggraini, M.Pd.', Jenis: 'Pelajaran', Pekan: '' },
        { ID: 'jd_9', Kelas: 'kls_10a', Hari: 'Kamis', Mulai: '07:00', Selesai: '08:30', Mapel: 'Bahasa Inggris', Guru: 'Rina Marlina, S.Pd.', Jenis: 'Pelajaran', Pekan: '' },
        { ID: 'jd_10', Kelas: 'kls_10a', Hari: 'Jumat', Mulai: '07:00', Selesai: '08:30', Mapel: 'PJOK', Guru: 'Agus Setiawan, S.Or.', Jenis: 'Pelajaran', Pekan: '' },
        { ID: 'jd_11', Kelas: 'kls_10b', Hari: 'Senin', Mulai: '07:00', Selesai: '08:30', Mapel: 'Fisika', Guru: 'Budi Santoso, S.Kom.', Jenis: 'Pelajaran', Pekan: '' },
        { ID: 'jd_12', Kelas: 'kls_10b', Hari: 'Senin', Mulai: '08:30', Selesai: '10:00', Mapel: 'Matematika', Guru: 'Dra. Ratna Sari, M.Pd.', Jenis: 'Pelajaran', Pekan: '' },
        { ID: 'jd_13', Kelas: 'kls_10b', Hari: 'Selasa', Mulai: '07:00', Selesai: '08:30', Mapel: 'Kimia', Guru: 'Siti Aminah, S.Pd.', Jenis: 'Pelajaran', Pekan: '' },
        { ID: 'jd_14', Kelas: 'kls_10b', Hari: 'Rabu', Mulai: '07:00', Selesai: '08:30', Mapel: 'Informatika', Guru: 'Budi Santoso, S.Kom.', Jenis: 'Pelajaran', Pekan: '' },
        { ID: 'jd_15', Kelas: 'kls_10b', Hari: 'Kamis', Mulai: '07:00', Selesai: '08:30', Mapel: 'Bahasa Indonesia', Guru: 'Drs. Hendra Gunawan', Jenis: 'Pelajaran', Pekan: '' },
        { ID: 'jd_16', Kelas: 'kls_10b', Hari: 'Jumat', Mulai: '07:00', Selesai: '08:30', Mapel: 'Bahasa Inggris', Guru: 'Rina Marlina, S.Pd.', Jenis: 'Pelajaran', Pekan: '' },
        { ID: 'jd_17', Kelas: 'kls_11a', Hari: 'Senin', Mulai: '07:00', Selesai: '08:30', Mapel: 'Matematika', Guru: 'Dra. Ratna Sari, M.Pd.', Jenis: 'Pelajaran', Pekan: '' },
        { ID: 'jd_18', Kelas: 'kls_11a', Hari: 'Selasa', Mulai: '07:00', Selesai: '08:30', Mapel: 'Biologi', Guru: 'Dewi Anggraini, M.Pd.', Jenis: 'Pelajaran', Pekan: '' },
        { ID: 'jd_19', Kelas: 'kls_11a', Hari: 'Rabu', Mulai: '07:00', Selesai: '08:30', Mapel: 'Fisika', Guru: 'Budi Santoso, S.Kom.', Jenis: 'Pelajaran', Pekan: '' },
        { ID: 'jd_20', Kelas: 'kls_11a', Hari: 'Kamis', Mulai: '07:00', Selesai: '08:30', Mapel: 'Informatika', Guru: 'Budi Santoso, S.Kom.', Jenis: 'Pelajaran', Pekan: '' },
        { ID: 'jd_21', Kelas: 'kls_11a', Hari: 'Jumat', Mulai: '07:00', Selesai: '08:30', Mapel: 'Bahasa Inggris', Guru: 'Rina Marlina, S.Pd.', Jenis: 'Pelajaran', Pekan: '' }
      ],
      JadwalAtur: [
        { Kelas: 'kls_10a', Sistem: 'reguler', Mulai: '07:00', Durasi: '45', Jumlah: '8', Istirahat: '3:15,6:30' },
        { Kelas: 'kls_10b', Sistem: 'reguler', Mulai: '07:00', Durasi: '45', Jumlah: '8', Istirahat: '3:15,6:30' },
        { Kelas: 'kls_11a', Sistem: 'reguler', Mulai: '07:00', Durasi: '45', Jumlah: '8', Istirahat: '3:15,6:30' }
      ],
      Akademik: getKaldikJabarEvents('2026/2027').map(e => ({
        ID: e.ID,
        Mulai: e.Mulai,
        Selesai: e.Selesai,
        Kegiatan: e.Kegiatan,
        Jenis: e.Jenis,
        Sumber: e.Sumber || ''
      })),
      TP: [
        { ID: 'tp_1', Kelas: 'kls_10a', ModulID: '', Kode: 'TP 1', Tujuan: 'Peserta didik mampu menggeneralisasi sifat-sifat eksponen dan logaritma serta menerapkannya dalam penyelesaian masalah kontekstual.', Materi: 'Eksponen & Logaritma', Status: 'Tercapai' },
        { ID: 'tp_2', Kelas: 'kls_10a', ModulID: '', Kode: 'TP 2', Tujuan: 'Peserta didik mampu memodelkan dan menyelesaikan sistem persamaan linear tiga variabel (SPLTV).', Materi: 'SPLTV', Status: 'Tercapai' },
        { ID: 'tp_3', Kelas: 'kls_10a', ModulID: 'mod_1', Kode: 'TP 3', Tujuan: 'Peserta didik mampu menganalisis karakteristik grafik fungsi kuadrat dan menentukan titik optimum.', Materi: 'Fungsi Kuadrat', Status: 'Berjalan' },
        { ID: 'tp_4', Kelas: 'kls_10a', ModulID: 'mod_2', Kode: 'TP 4', Tujuan: 'Peserta didik mampu merancang algoritma pemecahan masalah sederhana menggunakan pseudocode dan flowchart.', Materi: 'Algoritma & Flowchart', Status: 'Berjalan' },
        { ID: 'tp_5', Kelas: 'kls_10b', ModulID: 'mod_1', Kode: 'TP 1', Tujuan: 'Peserta didik mampu menentukan titik puncak dan diskriminan fungsi kuadrat dalam masalah nyata.', Materi: 'Fungsi Kuadrat', Status: 'Berjalan' },
        { ID: 'tp_6', Kelas: 'kls_11a', ModulID: 'mod_3', Kode: 'TP 1', Tujuan: 'Peserta didik mampu menerapkan konsep besaran, pengukuran presisi, dan angka penting dalam percobaan fisika.', Materi: 'Besaran & Pengukuran', Status: 'Tercapai' }
      ],
      Modul: [
        {
          ID: 'mod_1',
          Kelas: '__ALL__',
          Judul: 'Eksplorasi Fungsi Kuadrat & Lintasan Parabola',
          Mapel: 'Matematika',
          Alokasi: '2 × 45 menit',
          TPIDs: 'tp_3,tp_5',
          Pembuka: 'Salam, doa, dan apersepsi lintasan parabola.',
          Inti: 'Eksplorasi grafik f(x) = ax² + bx + c dalam kelompok.',
          Penutup: 'Rangkuman titik puncak dan refleksi.',
          Asesmen: 'Observasi diskusi & Exit Ticket.',
          Media: 'LKPD, GeoGebra',
          Catatan: '',
          PertanyaanPemantik: '1. Mengapa lintasan lemparan bola basket dan pancuran air mancur selalu membentuk lengkungan parabola?\n2. Bagaimana perubahan nilai koefisien a, b, dan c memengaruhi ketinggian puncak lintasan?',
          LinkSumber: JSON.stringify([
            { label: 'Simulasi Grafik GeoGebra', url: 'https://www.geogebra.org/graphing' },
            { label: 'Rumah Belajar Kemdikbud', url: 'https://belajar.kemdikbud.go.id' }
          ])
        },
        {
          ID: 'mod_2',
          Kelas: '__ALL__',
          Judul: 'Berpikir Komputasional: Dekomposisi & Algoritma Flowchart',
          Mapel: 'Informatika',
          Alokasi: '2 × 45 menit',
          TPIDs: 'tp_4',
          Pembuka: 'Apersepsi: Memecah proses pemesanan makanan online menjadi langkah logis.',
          Inti: 'Identifikasi 4 pilar berpikir komputasional dan praktik menyusun flowchart percabangan.',
          Penutup: 'Presentasi hasil flowchart antar kelompok dan refleksi logika algoritma.',
          Asesmen: 'Rubrik kelengkapan simbol flowchart & ketepatan logika.',
          Media: 'Kartu Alur Logika, Diagrams.net',
          Catatan: '',
          PertanyaanPemantik: 'Bagaimana aplikasi ojek online dapat menghitung tarif dan mencari rute tercepat dalam hitungan detik?',
          LinkSumber: JSON.stringify([{ label: 'Code.org CS Fundamentals', url: 'https://code.org' }])
        },
        {
          ID: 'mod_3',
          Kelas: '__ALL__',
          Judul: 'Pengukuran Presisi & Ketidakpastian Alat Ukur Fisika',
          Mapel: 'Fisika',
          Alokasi: '2 × 45 menit',
          TPIDs: 'tp_6',
          Pembuka: 'Apersepsi: Mengapa teknisi mesin tidak cukup memakai penggaris biasa?',
          Inti: 'Praktikum langsung membaca skala utama dan nonius pada jangka sorong serta mikrometer sekrup.',
          Penutup: 'Pembahasan aturan angka penting dan pelaporan hasil pengukuran berulang.',
          Asesmen: 'Praktik laboratorium & kuis pembacaan skala.',
          Media: 'Jangka Sorong, Mikrometer Sekrup, Simulasi PhET',
          Catatan: '',
          PertanyaanPemantik: 'Mengapa setiap hasil pengukuran ilmiah selalu memiliki nilai ketidakpastian?',
          LinkSumber: JSON.stringify([{ label: 'Simulasi PhET Colorado', url: 'https://phet.colorado.edu/in/' }])
        }
      ],
      Pemantik: [
        {
          ID: 'pem_1',
          Kelas: 'kls_10a',
          ModulID: 'mod_1',
          Mapel: 'Matematika',
          Judul: 'Mengapa Lintasan Air Mancur Berbentuk Parabola?',
          Tautan: 'https://www.geogebra.org/graphing',
          Pertanyaan: 'Pada sudut berapa air mencapai titik tertinggi?',
          Slide: 'Lintasan Parabola di Sekitar Kita\n---\nHubungan dengan Persamaan Kuadrat\n---\nTantangan Diskusi Kelompok',
          SumberPelajaran: JSON.stringify([
            { label: 'Simulasi Grafik GeoGebra', url: 'https://www.geogebra.org/graphing' },
            { label: 'Khan Academy: Quadratic Functions', url: 'https://www.khanacademy.org/math/algebra/x2f8bb11595b61c86:quadratic-functions-equations' }
          ])
        },
        {
          ID: 'pem_2',
          Kelas: '__ALL__',
          ModulID: 'mod_2',
          Mapel: 'Informatika',
          Judul: 'Bagaimana Komputer Berpikir Langkah Demi Langkah?',
          Tautan: 'https://code.org',
          Pertanyaan: 'Mengapa komputer membutuhkan instruksi yang sangat spesifik dan tidak boleh ambigu?',
          Slide: 'Algoritma di Kehidupan Sehari-hari\n---\n4 Pilar Berpikir Komputasional\n---\nStudi Kasus Mesin Kasir',
          SumberPelajaran: JSON.stringify([{ label: 'Code.org CS Fundamentals', url: 'https://code.org' }])
        }
      ],
      Materi: [
        {
          ID: 'mat_1',
          Kelas: '__ALL__',
          Mapel: 'Matematika',
          Judul: 'Fungsi Kuadrat, Grafik Parabola & Nilai Optimum',
          Bab: 'Bab 3 · Fungsi Kuadrat',
          Ringkasan: 'Panduan lengkap memahami bentuk umum fungsi kuadrat f(x) = ax² + bx + c, sumbu simetri, titik puncak, serta penerapannya dalam soal cerita.',
          IsiMateri: '1. Bentuk Umum Fungsi Kuadrat\nf(x) = ax² + bx + c dengan a, b, c ∈ R dan a ≠ 0.\n\n2. Sumbu Simetri & Titik Optimum\n- Sumbu simetri: x = -b / (2a)\n- Nilai optimum: y = -D / (4a), di mana D = b² - 4ac.',
          LinkSumber: JSON.stringify([{ label: 'Simulasi Grafik GeoGebra', url: 'https://www.geogebra.org/graphing' }]),
          FileID: '',
          NamaFile: '',
          UkuranFile: '',
          TanggalUpload: d1,
          Pengunggah: 'Dra. Ratna Sari, M.Pd.'
        },
        {
          ID: 'mat_2',
          Kelas: '__ALL__',
          Mapel: 'Matematika',
          Judul: 'Ringkasan Sifat Eksponen & Logaritma',
          Bab: 'Bab 1 · Eksponen & Logaritma',
          Ringkasan: 'Rangkuman sifat bilangan berpangkat, persamaan eksponen sederhana, dan aturan dasar logaritma.',
          IsiMateri: '1. Sifat Eksponen: a^m × a^n = a^(m+n), a^0 = 1.\n2. Definisi Logaritma: ^a log b = c ⇔ a^c = b (a > 0, a ≠ 1, b > 0).',
          LinkSumber: JSON.stringify([{ label: 'Rumah Belajar Kemdikbud', url: 'https://belajar.kemdikbud.go.id' }]),
          FileID: '',
          NamaFile: '',
          UkuranFile: '',
          TanggalUpload: d2,
          Pengunggah: 'Dra. Ratna Sari, M.Pd.'
        },
        {
          ID: 'mat_3',
          Kelas: '__ALL__',
          Mapel: 'Bahasa Indonesia',
          Judul: 'Struktur & Kaidah Kebahasaan Teks Laporan Hasil Observasi',
          Bab: 'Bab 1 · Teks LHO',
          Ringkasan: 'Materi pembelajaran mengenai pengertian, struktur (pernyataan umum, deskripsi bagian, deskripsi manfaat), serta contoh analisis teks LHO.',
          IsiMateri: '1. Pernyataan Umum\n2. Deskripsi Bagian\n3. Deskripsi Manfaat / Simpulan.',
          LinkSumber: JSON.stringify([{ label: 'KBBI Daring Kemdikbud', url: 'https://kbbi.kemdikbud.go.id' }]),
          FileID: '',
          NamaFile: '',
          UkuranFile: '',
          TanggalUpload: d1,
          Pengunggah: 'Drs. Hendra Gunawan'
        },
        {
          ID: 'mat_4',
          Kelas: '__ALL__',
          Mapel: 'Fisika',
          Judul: 'Besaran, Satuan SI, Pengukuran & Angka Penting',
          Bab: 'Bab 1 · Hakikat Fisika & Pengukuran',
          Ringkasan: 'Ringkasan besaran pokok dan turunan, cara membaca jangka sorong dan mikrometer sekrup, serta aturan angka penting.',
          IsiMateri: 'Jangka sorong ketelitian 0,01 cm; mikrometer sekrup ketelitian 0,001 cm.',
          LinkSumber: JSON.stringify([{ label: 'Simulasi PhET Fisika', url: 'https://phet.colorado.edu/in/' }]),
          FileID: '',
          NamaFile: '',
          UkuranFile: '',
          TanggalUpload: d1,
          Pengunggah: 'Budi Santoso, S.Kom.'
        },
        {
          ID: 'mat_5',
          Kelas: '__ALL__',
          Mapel: 'Informatika',
          Judul: 'Berpikir Komputasional, Flowchart & Struktur Algoritma',
          Bab: 'Bab 2 · Berpikir Komputasional',
          Ringkasan: 'Panduan menyusun algoritma pemecahan masalah dengan metode dekomposisi, pengenalan pola, abstraksi, serta simbol standar flowchart.',
          IsiMateri: '1. Dekomposisi, Pengenalan Pola, Abstraksi, Algoritma.\n2. Simbol Terminator, Proses, Input/Output, Decision.',
          LinkSumber: JSON.stringify([{ label: 'Code.org CS Fundamentals', url: 'https://code.org' }]),
          FileID: '',
          NamaFile: '',
          UkuranFile: '',
          TanggalUpload: d1,
          Pengunggah: 'Budi Santoso, S.Kom.'
        },
        {
          ID: 'mat_6',
          Kelas: '__ALL__',
          Mapel: 'Kimia',
          Judul: 'Struktur Atom, Konfigurasi Elektron & Sistem Periodik Unsur',
          Bab: 'Bab 2 · Struktur Atom',
          Ringkasan: 'Materi dasar partikel penyusun atom, nomor atom, nomor massa, dan konfigurasi kulit elektron Bohr.',
          IsiMateri: 'Jumlah elektron maksimal tiap kulit ke-n adalah 2n² (K=2, L=8, M=18).',
          LinkSumber: JSON.stringify([{ label: 'Tabel Periodik Ptable', url: 'https://ptable.com/?lang=id' }]),
          FileID: '',
          NamaFile: '',
          UkuranFile: '',
          TanggalUpload: d2,
          Pengunggah: 'Siti Aminah, S.Pd.'
        },
        {
          ID: 'mat_7',
          Kelas: '__ALL__',
          Mapel: 'Biologi',
          Judul: 'Keanekaragaman Hayati, Klasifikasi & Struktur Sel',
          Bab: 'Bab 1 · Keanekaragaman Hayati & Sel',
          Ringkasan: 'Memahami tingkat keanekaragaman hayati serta perbedaan organel utama sel hewan dan tumbuhan.',
          IsiMateri: 'Sel tumbuhan memiliki dinding sel & kloroplas; sel hewan memiliki sentriol & lisosom.',
          LinkSumber: JSON.stringify([{ label: 'Khan Academy Biology', url: 'https://www.khanacademy.org/science/biology' }]),
          FileID: '',
          NamaFile: '',
          UkuranFile: '',
          TanggalUpload: d2,
          Pengunggah: 'Dewi Anggraini, M.Pd.'
        },
        {
          ID: 'mat_8',
          Kelas: '__ALL__',
          Mapel: 'Bahasa Inggris',
          Judul: 'Descriptive Text & Recount Text: Structure & Language Features',
          Bab: 'Unit 1 · Descriptive & Recount',
          Ringkasan: 'Panduan tujuan komunikatif, generic structure, dan perbedaan Simple Present vs Simple Past Tense.',
          IsiMateri: 'Descriptive: Identification + Description (Simple Present).\nRecount: Orientation + Events + Re-orientation (Simple Past).',
          LinkSumber: JSON.stringify([{ label: 'British Council LearnEnglish', url: 'https://learnenglish.britishcouncil.org' }]),
          FileID: '',
          NamaFile: '',
          UkuranFile: '',
          TanggalUpload: d1,
          Pengunggah: 'Rina Marlina, S.Pd.'
        }
      ],
      Mapel: mapelList,
      BerkasCloud: [
        {
          ID: 'cld_sample1',
          Kelas: 'kls_10a',
          NamaFile: 'Rekap_Evaluasi_Matematika_Triwulan1.csv',
          TipeMime: 'text/csv',
          Ukuran: '18420',
          TanggalUnggah: d1,
          Pengunggah: 'Dra. Ratna Sari, M.Pd.',
          StatusCloud: 'Tersimpan Aman (AES-256 Cloud Vault)',
          PathSimpan: 'seed_rekap_evaluasi.csv',
          AnalisisJSON: JSON.stringify({
            ringkasanEksekutif: 'Rekapitulasi capaian nilai Matematika X MIPA 1 dengan rata-rata 84,2 dan ketuntasan 91,6%.',
            informasiKunci: ['Rata-rata Latihan Eksponen mencapai 86,4.', '1 siswa perlu klinik remedial sebelum UAS.'],
            identifikasiTren: ['Kenaikan skor rata-rata +4,8 poin menuju Proyek Fungsi Kuadrat.'],
            rekomendasiTindakLanjut: ['Berikan klinik remedial dan pengayaan proyek.'],
            kategoriDokumen: 'Spreadsheet Evaluasi Akademik'
          })
        }
      ],
      CBT: [
        {
          ID: 'cbt_demo1',
          Kelas: 'kls_10a',
          Judul: 'Evaluasi Formatif: Eksponen & Logaritma',
          Mapel: 'Matematika',
          Durasi: '30',
          Status: 'Aktif',
          Acak: '0',
          SumberMateri: sampleMateriCBT,
          NamaFileMateri: '',
          TanggalBuat: d1,
          SoalJSON: JSON.stringify({
            soalPG: [
              { id: 'pg_1', pertanyaan: 'Bentuk sederhana dari a^m × a^n adalah…', opsiA: 'a^(m-n)', opsiB: 'a^(m+n)', opsiC: 'a^(m×n)', opsiD: '(2a)^(m+n)', opsiE: 'a^(m/n)', kunci: 'B', pembahasan: 'a^m × a^n = a^(m+n).', kutipanMateri: 'a^m × a^n = a^(m+n)' },
              { id: 'pg_2', pertanyaan: 'Untuk a > 0, nilai dari a^0 adalah…', opsiA: '0', opsiB: 'a', opsiC: '1', opsiD: '-1', opsiE: 'Tak terdefinisi', kunci: 'C', pembahasan: 'Setiap bilangan > 0 berpangkat nol bernilai 1.', kutipanMateri: 'dan a^0 = 1' }
            ],
            soalUraian: [
              { id: 'ur_1', pertanyaan: 'Jelaskan hubungan definisi logaritma ^a log b = c dengan bentuk pangkatnya!', kunciRubrik: '^a log b = c ekuivalen dengan a^c = b dengan syarat a > 0, a ≠ 1, dan b > 0.', poinMaksimal: 100, kutipanMateri: '^a log b = c jika dan hanya jika a^c = b' }
            ]
          })
        },
        {
          ID: 'cbt_demo2',
          Kelas: 'kls_10b',
          Judul: 'Kuis Informatika: Berpikir Komputasional & Flowchart',
          Mapel: 'Informatika',
          Durasi: '25',
          Status: 'Aktif',
          Acak: '0',
          SumberMateri: sampleMateriInfCBT,
          NamaFileMateri: '',
          TanggalBuat: d1,
          SoalJSON: JSON.stringify({
            soalPG: [
              { id: 'inf_pg_1', pertanyaan: 'Proses memecah masalah kompleks menjadi bagian kecil disebut…', opsiA: 'Abstraksi', opsiB: 'Dekomposisi', opsiC: 'Iterasi', opsiD: 'Kompilasi', opsiE: 'Enkapsulasi', kunci: 'B', pembahasan: 'Dekomposisi memecah masalah besar menjadi bagian kecil.', kutipanMateri: 'Empat pilar berpikir komputasional meliputi Dekomposisi' }
            ],
            soalUraian: [
              { id: 'inf_ur_1', pertanyaan: 'Sebutkan empat pilar berpikir komputasional!', kunciRubrik: 'Dekomposisi, Pengenalan Pola, Abstraksi, dan Algoritma.', poinMaksimal: 100, kutipanMateri: 'Dekomposisi, Pengenalan Pola, Abstraksi, dan Algoritma' }
            ]
          })
        }
      ],
      HasilCBT: [],
      Pengguna: penggunaList,
      Akun: akunList,
      Pesan: [
        {
          ID: 'msg_seed_1',
          Kelas: 'kls_10a',
          PengirimID: 'usr_wali1',
          PengirimNama: 'Dra. Ratna Sari, M.Pd.',
          PengirimPeran: 'wali',
          PenerimaID: 'ALL',
          PenerimaNama: 'Semua Siswa (Kelas)',
          Pesan: 'Selamat datang di ruang diskusi kelas X MIPA 1! Silakan gunakan ruang ini untuk berdiskusi materi pelajaran atau berkonsultasi tanya guru.',
          Waktu: new Date(Date.now() - 3600000).toISOString(),
          Tipe: 'pengumuman',
          Lampiran: ''
        },
        {
          ID: 'msg_seed_2',
          Kelas: 'kls_10b',
          PengirimID: 'usr_wali1',
          PengirimNama: 'Dra. Ratna Sari, M.Pd.',
          PengirimPeran: 'guru',
          PenerimaID: 'ALL',
          PenerimaNama: 'Semua Siswa (Kelas)',
          Pesan: 'Halo siswa X MIPA 2! Jangan lupa pelajari Materi Fungsi Kuadrat dan kerjakan latihan soalnya.',
          Waktu: new Date(Date.now() - 3200000).toISOString(),
          Tipe: 'pengumuman',
          Lampiran: ''
        },
        {
          ID: 'msg_seed_3',
          Kelas: 'kls_11a',
          PengirimID: 'usr_guru1',
          PengirimNama: 'Budi Santoso, S.Kom.',
          PengirimPeran: 'wali',
          PenerimaID: 'ALL',
          PenerimaNama: 'Semua Siswa (Kelas)',
          Pesan: 'Selamat datang di ruang kelas XI MIPA 1! Silakan cek materi Biologi, Fisika, dan jadwal praktikum minggu ini.',
          Waktu: new Date(Date.now() - 2800000).toISOString(),
          Tipe: 'pengumuman',
          Lampiran: ''
        }
      ]
    }
  };
}

async function getDb(): Promise<LocalDb> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.sheets) return parsed as LocalDb;
    }
  } catch (_) {}
  const seeded = await createSeedLocalDb();
  saveDb(seeded);
  return seeded;
}

function saveDb(db: LocalDb) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (_) {}
}

function getSessions(): Record<string, LocalSession> {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveSessions(s: Record<string, LocalSession>) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch (_) {}
}

function buatSesi(role: 'admin' | 'staf' | 'siswa', sid: string, nama: string) {
  const token = 'local_' + uidShort() + uidShort();
  const map = getSessions();
  map[token] = { role, sid, nama, expires: Date.now() + 21600 * 1000 };
  saveSessions(map);
  return { token, role, nama };
}

function getSesi(token: string, expectedRole?: 'admin' | 'staf' | 'siswa'): LocalSession {
  const map = getSessions();
  const s = map[token];
  if (!s || Date.now() > s.expires) throw new Error('SESI_HABIS');
  if (expectedRole === 'admin' && s.role !== 'admin') throw new Error('Akses khusus admin.');
  if (expectedRole === 'siswa' && s.role !== 'siswa') throw new Error('SESI_HABIS');
  if (expectedRole === 'staf' && s.role !== 'admin' && s.role !== 'staf') throw new Error('SESI_HABIS');
  return s;
}

function getPengaturanObj(db: LocalDb): Record<string, string> {
  const out = { ...PENGATURAN_AWAL };
  (db.sheets.Pengaturan || []).forEach(r => {
    if (r.Kunci) out[r.Kunci] = r.Nilai ?? '';
  });
  return out;
}

export async function runLocalRpcFallback(fn: string, args: any[]): Promise<any> {
  const db = await getDb();

  if (fn === 'api_status') {
    const set = getPengaturanObj(db);
    const em = String(set.emailPemulihan || '').trim();
    const emailHint = em.includes('@')
      ? `${em.slice(0, Math.min(2, em.indexOf('@')))}***@${em.split('@')[1]}`
      : '';
    return {
      adminAda: !!db.admin,
      sekolah: set.sekolah || 'Sistem Manajemen Kelas',
      logo: set.logo || '',
      loginBg: set.loginBg || '',
      jurusan: set.jurusan || '',
      jurusanLogos: set.jurusanLogos || '{}',
      waInfo: set.waInfo || '',
      emailHint,
      storageEngine: 'local-json',
      storageLabel: 'Penyimpanan Browser Lokal',
      vercelConfigured: false
    };
  }

  if (fn === 'api_updateLoginBranding') {
    const [logo, jurusan, sekolah, jurusanLogos, loginBg] = args;
    const cur = getPengaturanObj(db);
    const cleanJurusanList = Array.from(
      new Set(String(jurusan || '').split(',').map(x => x.trim()).filter(Boolean))
    );
    let nextLoginBg = cur.loginBg || '';
    if (loginBg !== undefined) {
      const cleanBg = String(loginBg || '').trim();
      if (
        cleanBg === '' ||
        cleanBg === 'none' ||
        cleanBg.startsWith('preset:') ||
        cleanBg.startsWith('data:image/')
      ) {
        nextLoginBg = cleanBg;
      }
    }
    let nextLogosStr = cur.jurusanLogos || '{}';
    if (jurusanLogos !== undefined) {
      const parsed = typeof jurusanLogos === 'string' ? JSON.parse(jurusanLogos || '{}') : jurusanLogos || {};
      const filtered: Record<string, string> = {};
      cleanJurusanList.forEach(j => {
        if (typeof parsed[j] === 'string' && parsed[j].startsWith('data:image/')) filtered[j] = parsed[j];
      });
      nextLogosStr = JSON.stringify(filtered);
    }
    const baru: Record<string, string> = {
      ...cur,
      logo: String(logo || '').trim(),
      loginBg: nextLoginBg,
      jurusan: cleanJurusanList.join(', '),
      jurusanLogos: nextLogosStr,
      ...(String(sekolah || '').trim() ? { sekolah: String(sekolah).trim() } : {})
    };
    db.sheets.Pengaturan = Object.entries(baru).map(([Kunci, Nilai]) => ({ Kunci, Nilai }));
    saveDb(db);
    return {
      sekolah: baru.sekolah || 'Sistem Manajemen Kelas',
      logo: baru.logo || '',
      loginBg: baru.loginBg || '',
      jurusan: baru.jurusan || '',
      jurusanLogos: baru.jurusanLogos || '{}'
    };
  }

  if (fn === 'api_setupAdmin') {
    const [user, pass] = args;
    const u = String(user || '').trim().toLowerCase();
    const p = String(pass || '');
    if (u.length < 3) throw new Error('Nama pengguna minimal 3 karakter.');
    if (p.length < 8) throw new Error('Kata sandi minimal 8 karakter.');
    db.admin = { user: u, passHash: await sha256Base64('local-admin', p) };
    saveDb(db);
    return buatSesi('admin', '', u);
  }

  if (fn === 'api_login') {
    const [mode, user, pass] = args;
    const userRaw = String(user || '').trim().toLowerCase();
    const userNisNorm = userRaw.replace(/\s+/g, '');
    const passRaw = String(pass || '');
    const passTrim = passRaw.trim();
    if (!userRaw || !passTrim) throw new Error('Lengkapi data masuk.');

    if (mode === 'admin') {
      if (db.admin && db.admin.user === userRaw) {
        const h1 = await sha256Base64('local-admin', passRaw);
        const h2 = await sha256Base64('local-admin', passTrim);
        if (h1 === db.admin.passHash || h2 === db.admin.passHash) {
          return buatSesi('admin', '', userRaw);
        }
      }
      const stafList = db.sheets.Pengguna || [];
      for (const st of stafList) {
        if (String(st.Username || '').trim().toLowerCase() === userRaw) {
          const h1 = await sha256Base64(st.ID, passRaw);
          const h2 = await sha256Base64(st.ID, passTrim);
          if (st.Hash === h1 || st.Hash === h2) {
            return buatSesi('staf', st.ID, st.Nama);
          }
        }
      }
    }

    const akun = db.sheets.Akun || [];
    const siswaMatches = (db.sheets.Siswa || []).filter(
      s => String(s.NIS || '').replace(/\s+/g, '').toLowerCase() === userNisNorm
    );
    for (const s of siswaMatches) {
      const h = await sha256Base64(s.ID, passTrim);
      if (akun.some(a => a.SiswaID === s.ID && a.Hash === h)) {
        return buatSesi('siswa', s.ID, s.Nama);
      }
    }
    throw new Error('Nama pengguna / NIS atau kata sandi / PIN salah.');
  }

  if (fn === 'api_logout') {
    const [token] = args;
    const map = getSessions();
    delete map[token];
    saveSessions(map);
    return true;
  }

  if (fn === 'api_load') {
    const [token] = args;
    const s = getSesi(token, 'staf');
    const staf = s.role === 'staf' ? (db.sheets.Pengguna || []).find(u => u.ID === s.sid) : null;
    const out: Record<string, any> = {};
    Object.keys(db.sheets).forEach(k => {
      if (!['Pengaturan', 'Akun', 'Pengguna'].includes(k)) {
        out[k] = db.sheets[k] || [];
      }
    });
    out.Pengaturan = getPengaturanObj(db);
    const akunRows = db.sheets.Akun || [];
    out.punyaPIN = akunRows.map(a => a.SiswaID);
    const pinHashes: Record<string, string> = {};
    akunRows.forEach(a => {
      pinHashes[a.SiswaID] = a.Hash;
    });
    out.pinHashes = pinHashes;
    out.peran = s.role === 'admin' ? 'admin' : staf?.Peran || 'guru';
    out.userId = staf ? staf.ID : 'admin';
    out.kelasWali = staf ? String(staf.KelasWali || '').split(',').filter(Boolean) : null;
    out.namaPengguna = s.nama || '';
    out.GuruList = (db.sheets.Pengguna || []).map(u => ({
      Nama: u.Nama,
      Mapel: u.Mapel,
      KelasWali: u.KelasWali || '',
      KelasMengajar: u.KelasMengajar || ''
    }));
    out.mapelSaya = staf ? staf.Mapel || '' : '';
    out.adminUser = s.role === 'admin' ? db.admin?.user || '' : '';
    out.urlSheet = '';
    if (s.role === 'admin') {
      out.Pengguna = (db.sheets.Pengguna || []).map(({ Hash: _h, ...rest }) => rest);
    }
    return out;
  }

  if (fn === 'api_saveSheet') {
    const [token, nama, rows] = args;
    getSesi(token, 'staf');
    db.sheets[nama] = Array.isArray(rows) ? rows : [];
    saveDb(db);
    return true;
  }

  if (fn === 'api_savePengaturan') {
    const [token, obj] = args;
    getSesi(token, 'admin');
    db.sheets.Pengaturan = Object.entries(obj || {}).map(([Kunci, Nilai]) => ({
      Kunci,
      Nilai: Nilai == null ? '' : String(Nilai)
    }));
    saveDb(db);
    return true;
  }

  if (fn === 'api_saveAbsensi') {
    const [token, kelas, tanggal, recs] = args;
    getSesi(token, 'staf');
    const kept = (db.sheets.Absensi || []).filter(a => !(a.Kelas === kelas && a.Tanggal === tanggal));
    (recs || []).forEach((r: any) =>
      kept.push({
        Kelas: kelas,
        Tanggal: tanggal,
        SiswaID: r.SiswaID,
        Kode: r.Kode,
        Keterangan: r.Keterangan || '',
        Sumber: ''
      })
    );
    db.sheets.Absensi = kept;
    saveDb(db);
    return true;
  }

  if (fn === 'api_getPinHashes') {
    const [token] = args;
    getSesi(token, 'staf');
    const out: Record<string, string> = {};
    (db.sheets.Akun || []).forEach(a => {
      out[a.SiswaID] = a.Hash;
    });
    return out;
  }

  if (fn === 'api_setPIN') {
    const [token, sid, pinIn] = args;
    getSesi(token, 'staf');
    const pin = String(pinIn || '').trim() || String(Math.floor(100000 + Math.random() * 900000));
    if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN harus 4-8 angka.');
    const h = await sha256Base64(sid, pin);
    const akun = (db.sheets.Akun || []).filter(a => a.SiswaID !== sid);
    akun.push({ SiswaID: sid, Hash: h });
    db.sheets.Akun = akun;
    saveDb(db);
    return pin;
  }

  if (fn === 'api_buatPINSemua') {
    const [token, targetKelas, timpa, pinSeragam] = args;
    getSesi(token, 'staf');
    const seragam = String(pinSeragam || '').trim();
    if (seragam && !/^\d{4,8}$/.test(seragam)) throw new Error('PIN harus 4-8 angka.');
    const akunMap = new Map((db.sheets.Akun || []).map(a => [a.SiswaID, a.Hash]));
    const daftar: any[] = [];
    let dilewati = 0;
    for (const s of db.sheets.Siswa || []) {
      if (targetKelas !== '__ALL__' && s.Kelas !== targetKelas) continue;
      if (!timpa && akunMap.has(s.ID)) continue;
      if (!String(s.NIS || '').trim()) {
        dilewati++;
        continue;
      }
      const pin = seragam || String(Math.floor(100000 + Math.random() * 900000));
      akunMap.set(s.ID, await sha256Base64(s.ID, pin));
      daftar.push({ id: s.ID, nama: s.Nama, nis: s.NIS, pin });
    }
    db.sheets.Akun = Array.from(akunMap.entries()).map(([SiswaID, Hash]) => ({ SiswaID, Hash }));
    saveDb(db);
    return {
      daftar,
      dilewati,
      pinHashes: Object.fromEntries(akunMap.entries())
    };
  }

  if (fn === 'api_simpanPengguna') {
    const [token, d] = args;
    getSesi(token, 'admin');
    const list = db.sheets.Pengguna || [];
    const id = d.ID || uidShort();
    const kw = Array.isArray(d.KelasWali) ? d.KelasWali : [];
    const km = Array.isArray(d.KelasMengajar) ? d.KelasMengajar : [];
    const peran = (kw.length ? ['wali'] : []).concat(km.length ? ['guru'] : []);
    const semuaKelas = Array.from(new Set([...kw, ...km]));
    let sandi = String(d.Sandi || '').trim();
    const existing = list.find(u => u.ID === id);
    if (!existing && !sandi) sandi = String(Math.floor(10000000 + Math.random() * 89999999));
    const hash = sandi ? await sha256Base64(id, sandi) : existing?.Hash || '';
    const rec = {
      ID: id,
      Nama: String(d.Nama || '').trim(),
      Username: String(d.Username || '').trim().toLowerCase(),
      Peran: peran.join(','),
      Kelas: semuaKelas.join(','),
      Hash: hash,
      Mapel: Array.isArray(d.Mapel) ? d.Mapel.join(',') : '',
      KelasWali: kw.join(','),
      KelasMengajar: km.join(',')
    };
    const nextList = existing ? list.map(u => (u.ID === id ? rec : u)) : [...list, rec];
    db.sheets.Pengguna = nextList;
    saveDb(db);
    return {
      daftar: nextList.map(({ Hash: _h, ...rest }) => rest),
      sandi,
      username: rec.Username
    };
  }

  if (fn === 'api_hapusPengguna') {
    const [token, id] = args;
    getSesi(token, 'admin');
    db.sheets.Pengguna = (db.sheets.Pengguna || []).filter(u => u.ID !== id);
    saveDb(db);
    return db.sheets.Pengguna.map(({ Hash: _h, ...rest }) => rest);
  }

  if (fn === 'api_resetSandiPengguna') {
    const [token, id, sandiIn] = args;
    getSesi(token, 'admin');
    const sandi = String(sandiIn || '').trim() || String(Math.floor(10000000 + Math.random() * 89999999));
    const u = (db.sheets.Pengguna || []).find(x => x.ID === id);
    if (!u) throw new Error('Pengguna tidak ditemukan.');
    u.Hash = await sha256Base64(u.ID, sandi);
    saveDb(db);
    return { sandi, username: u.Username };
  }

  if (fn === 'api_gantiSandiSaya') {
    const [token, lama, baru] = args;
    const s = getSesi(token, 'staf');
    const u = (db.sheets.Pengguna || []).find(x => x.ID === s.sid);
    if (!u || u.Hash !== (await sha256Base64(u.ID, String(lama || '')))) throw new Error('Kata sandi lama salah.');
    u.Hash = await sha256Base64(u.ID, String(baru || ''));
    saveDb(db);
    return true;
  }

  if (fn === 'api_loadSiswa') {
    const [token] = args;
    const sesi = getSesi(token, 'siswa');
    const siswa = (db.sheets.Siswa || []).find(x => x.ID === sesi.sid);
    if (!siswa) throw new Error('SESI_HABIS');
    const kelas = (db.sheets.Kelas || []).find(k => k.ID === siswa.Kelas) || { ID: '', Nama: '', Jurusan: '', Mapel: '' };
    const set = getPengaturanObj(db);
    const absKelas = (db.sheets.Absensi || []).filter(a => a.Kelas === siswa.Kelas);
    const tglSet = new Set(absKelas.map(a => a.Tanggal));
    const nm: Record<string, string> = {};
    (db.sheets.Siswa || []).filter(s => s.Kelas === siswa.Kelas).forEach(s => (nm[s.ID] = s.Nama));
    const atur = (db.sheets.DenahAtur || []).find(a => a.Kelas === siswa.Kelas) || { Baris: '4', Kolom: '4', Grup: '2' };
    const pg = (db.sheets.Pengumpulan || []).filter(p => p.SiswaID === siswa.ID);

    const mapelById = new Map((db.sheets.Mapel || []).map(m => [m.ID, m.Nama]));
    const teachers = (db.sheets.Pengguna || [])
      .filter(u => {
        const kw = String(u.KelasWali || '').split(',').filter(Boolean);
        const km = String(u.KelasMengajar || '').split(',').filter(Boolean);
        return kw.includes(siswa.Kelas) || km.includes(siswa.Kelas);
      })
      .map(u => {
        const kw = String(u.KelasWali || '').split(',').filter(Boolean);
        return {
          id: u.ID,
          nama: u.Nama,
          peran: kw.includes(siswa.Kelas) ? 'wali' : 'guru',
          mapel: String(u.Mapel || '')
            .split(',')
            .map(id => mapelById.get(id.trim()) || id.trim())
            .filter(Boolean)
            .join(', ')
        };
      });
    if (teachers.length === 0) {
      teachers.push({
        id: 'admin',
        nama: set.wali || set.guru || 'Guru / Admin Sekolah',
        peran: 'wali',
        mapel: 'Wali Kelas'
      });
    }
    let jurusanLogo = '';
    try {
      const logoMap = JSON.parse(set.jurusanLogos || '{}');
      if (kelas.Jurusan && logoMap && typeof logoMap[kelas.Jurusan] === 'string') {
        jurusanLogo = logoMap[kelas.Jurusan];
      }
    } catch (_) {}
    return {
      siswa: { ID: siswa.ID, Nama: siswa.Nama, NIS: siswa.NIS },
      kelasId: siswa.Kelas || '',
      kelas: kelas.Nama || '',
      jurusan: kelas.Jurusan || '',
      jurusanLogo,
      mapel: kelas.Mapel || '',
      sekolah: set.sekolah,
      logo: set.logo || '',
      waInfo: set.waInfo || '',
      semester: set.semester,
      wali: set.wali,
      guru: set.guru,
      teachers,
      denah: {
        Baris: atur.Baris,
        Kolom: atur.Kolom,
        Grup: atur.Grup,
        kursi: (db.sheets.Denah || [])
          .filter(d => d.Kelas === siswa.Kelas && nm[d.SiswaID])
          .map(d => ({ Baris: d.Baris, Kolom: d.Kolom, Nama: nm[d.SiswaID], Saya: d.SiswaID === siswa.ID }))
      },
      piket: (db.sheets.Piket || [])
        .filter(p => p.Kelas === siswa.Kelas && nm[p.SiswaID])
        .map(p => ({ Hari: p.Hari, Tugas: p.Tugas, Nama: nm[p.SiswaID], Saya: p.SiswaID === siswa.ID })),
      struktur: (db.sheets.Struktur || [])
        .filter(s => s.Kelas === siswa.Kelas)
        .map(s => ({ Jabatan: s.Jabatan, Tingkat: s.Tingkat, Nama: nm[s.SiswaID] || '', Saya: s.SiswaID === siswa.ID })),
      jadwal: (db.sheets.Jadwal || []).filter(j => j.Kelas === siswa.Kelas),
      sekretaris: (db.sheets.Struktur || []).some(
        j => j.Kelas === siswa.Kelas && j.SiswaID === siswa.ID && /sekretaris/i.test(j.Jabatan)
      ),
      sistemJadwal: ((db.sheets.JadwalAtur || []).find(a => a.Kelas === siswa.Kelas) || {}).Sistem || 'reguler',
      mulaiSemester: set.mulai,
      akademik: db.sheets.Akademik || [],
      pengaturan: {
        kkm: set.kkm,
        b_sikap: set.b_sikap,
        b_tugas: set.b_tugas,
        b_proyek: set.b_proyek,
        b_uts: set.b_uts,
        b_uas: set.b_uas
      },
      totalPertemuan: tglSet.size,
      absensi: absKelas
        .filter(a => a.SiswaID === siswa.ID)
        .map(a => ({ Tanggal: a.Tanggal, Kode: a.Kode, Keterangan: a.Keterangan })),
      tugas: (db.sheets.Tugas || [])
        .filter(t => t.Kelas === siswa.Kelas)
        .map(t => {
          const p = pg.find(x => x.TugasID === t.ID);
          return {
            ID: t.ID,
            Judul: t.Judul,
            Mapel: t.Mapel || '',
            Deskripsi: t.Deskripsi || '',
            Jenis: t.Jenis,
            Tenggat: t.Tenggat,
            FileID: t.FileID || '',
            NamaFile: t.NamaFile || '',
            Status: p ? p.Status : 'Belum',
            Nilai: p ? p.Nilai : '',
            FileSiswaID: p ? p.FileID || '' : '',
            NamaFileSiswa: p ? p.NamaFile || '' : '',
            TanggalKumpul: p ? p.TanggalKumpul || '' : '',
            CatatanSiswa: p ? p.CatatanSiswa || '' : ''
          };
        }),
      nilai: (db.sheets.Nilai || []).find(n => n.Kelas === siswa.Kelas && n.SiswaID === siswa.ID) || null,
      cbtList: (db.sheets.CBT || [])
        .filter(c => c.Kelas === siswa.Kelas && (c.Status === 'Aktif' || c.Status === 'Selesai'))
        .map(c => {
          let soalObj: any = { soalPG: [], soalUraian: [] };
          try { soalObj = JSON.parse(c.SoalJSON || '{}'); } catch (_) {}
          const hasil = (db.sheets.HasilCBT || []).find(h => h.CBTID === c.ID && h.SiswaID === siswa.ID) || null;
          const sudahSelesai = !!hasil;
          return {
            ID: c.ID,
            Judul: c.Judul,
            Mapel: c.Mapel,
            Durasi: c.Durasi,
            Status: c.Status,
            Acak: c.Acak,
            TanggalBuat: c.TanggalBuat,
            soalPG: (soalObj.soalPG || []).map((q: any) =>
              sudahSelesai ? q : { id: q.id, pertanyaan: q.pertanyaan, opsiA: q.opsiA, opsiB: q.opsiB, opsiC: q.opsiC, opsiD: q.opsiD, opsiE: q.opsiE }
            ),
            soalUraian: (soalObj.soalUraian || []).map((q: any) =>
              sudahSelesai ? q : { id: q.id, pertanyaan: q.pertanyaan, poinMaksimal: q.poinMaksimal }
            ),
            hasil
          };
        }),
      materi: (() => {
        const classMapelSet = new Set<string>();
        const explicitRaw = String(kelas.Mapel || '').trim();
        if (explicitRaw === '__NONE__') {
          // Explicitly cleared all subjects for this class
        } else if (explicitRaw) {
          explicitRaw
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
            .forEach(tok => {
              const resolved = mapelById.get(tok) || tok;
              if (resolved) classMapelSet.add(resolved.toLowerCase());
            });
        } else {
          (db.sheets.Jadwal || []).filter(j => j.Kelas === siswa.Kelas).forEach((j: any) => {
            const clean = String(j.Mapel || '').trim().toLowerCase();
            if (clean && clean !== 'istirahat') classMapelSet.add(clean);
          });
          (db.sheets.Tugas || []).filter(t => t.Kelas === siswa.Kelas).forEach((t: any) => {
            const clean = String(t.Mapel || '').trim().toLowerCase();
            if (clean) classMapelSet.add(clean);
          });
        }

        const allMateri = db.sheets.Materi || [];
        const matchingMateri = allMateri.filter((m: any) => {
          const kRaw = String(m.Kelas || '').trim();
          const mMapel = String(m.Mapel || '').trim().toLowerCase();
          if (kRaw === '__ALL__' || kRaw === 'all' || !kRaw) {
            if (!mMapel || mMapel === 'umum' || classMapelSet.size === 0) return true;
            return classMapelSet.has(mMapel);
          }
          const ids = kRaw.split(',').map(s => s.trim()).filter(Boolean);
          return ids.includes(siswa.Kelas);
        });

        return matchingMateri.map((m: any) => ({
          ID: m.ID,
          Judul: m.Judul || '',
          Mapel: m.Mapel || 'Umum',
          Bab: m.Bab || '',
          Ringkasan: m.Ringkasan || '',
          IsiMateri: m.IsiMateri || '',
          LinkSumber: m.LinkSumber || '',
          FileID: m.FileID || '',
          NamaFile: m.NamaFile || '',
          UkuranFile: m.UkuranFile || '',
          TanggalUpload: m.TanggalUpload || '',
          Pengunggah: m.Pengunggah || ''
        }));
      })()
    };
  }

  if (fn === 'api_gantiPIN') {
    const [token, lama, baru] = args;
    const sesi = getSesi(token, 'siswa');
    const pinBaru = String(baru || '').trim();
    if (!/^\d{4,8}$/.test(pinBaru)) throw new Error('PIN baru harus 4-8 angka.');
    const a = (db.sheets.Akun || []).find(x => x.SiswaID === sesi.sid);
    if (!a || a.Hash !== (await sha256Base64(sesi.sid, String(lama || '').trim()))) {
      throw new Error('PIN lama salah.');
    }
    a.Hash = await sha256Base64(sesi.sid, pinBaru);
    saveDb(db);
    return true;
  }

  if (fn === 'api_resetDemo') {
    const [token] = args;
    getSesi(token, 'admin');
    const seeded = await createSeedLocalDb();
    saveDb(seeded);
    return true;
  }

  if (fn === 'api_resetAllData') {
    const [token, opts] = args;
    getSesi(token, 'admin');
    const o = opts || {};
    const operational = [
      'Siswa', 'Absensi', 'Tugas', 'Pengumpulan', 'Nilai', 'Perilaku',
      'Checklist', 'DenahAtur', 'Denah', 'Piket', 'Struktur', 'Jadwal',
      'JadwalAtur', 'Akademik', 'TP', 'Modul', 'Pemantik', 'Materi', 'BerkasCloud',
      'CBT', 'HasilCBT', 'Akun', 'Pesan'
    ];
    operational.forEach(s => { db.sheets[s] = []; });
    if (o.resetKelas) db.sheets.Kelas = [];
    if (o.resetMapel) db.sheets.Mapel = [];
    if (o.resetPengguna) db.sheets.Pengguna = [];
    if (o.resetPengaturan) {
      db.sheets.Pengaturan = Object.entries(PENGATURAN_AWAL).map(([Kunci, Nilai]) => ({ Kunci, Nilai }));
    }
    saveDb(db);
    return true;
  }

  if (fn === 'api_resetPartial') {
    const [token, category] = args;
    getSesi(token, 'admin');
    const map: Record<string, string[]> = {
      absensi: ['Absensi'],
      nilai_tugas: ['Tugas', 'Pengumpulan', 'Nilai'],
      cbt: ['CBT', 'HasilCBT'],
      operasional_kelas: ['DenahAtur', 'Denah', 'Piket', 'Struktur', 'Jadwal', 'JadwalAtur'],
      perangkat_ajar: ['TP', 'Modul', 'Pemantik', 'Materi'],
      kalender: ['Akademik', 'Checklist'],
      siswa: ['Siswa', 'Akun']
    };
    const targets = map[category] || [];
    targets.forEach(s => { db.sheets[s] = []; });
    saveDb(db);
    return targets;
  }

  if (fn === 'api_cekSesi') {
    const [token] = args;
    const s = getSesi(token);
    return { role: s.role, nama: s.nama };
  }

  if (fn === 'api_setMapelSaya') {
    const [token, ids] = args;
    const s = getSesi(token, 'staf');
    const u = (db.sheets.Pengguna || []).find(x => x.ID === s.sid);
    if (!u) throw new Error('SESI_HABIS');
    u.Mapel = Array.isArray(ids) ? ids.join(',') : '';
    saveDb(db);
    return u.Mapel;
  }

  if (fn === 'api_gantiAdmin') {
    const [token, userBaru, passLama, passBaru] = args;
    getSesi(token, 'admin');
    if (!db.admin || db.admin.passHash !== (await sha256Base64('local-admin', String(passLama || '')))) {
      throw new Error('Kata sandi lama salah.');
    }
    const u = String(userBaru || '').trim().toLowerCase() || db.admin.user;
    const p = String(passBaru || '') || String(passLama || '');
    if (u.length < 3) throw new Error('Nama pengguna minimal 3 karakter.');
    if (p.length < 8) throw new Error('Kata sandi baru minimal 8 karakter.');
    db.admin = { user: u, passHash: await sha256Base64('local-admin', p) };
    saveDb(db);
    return true;
  }

  if (fn === 'api_absensiKelas') {
    const [token, tanggal] = args;
    const sesi = getSesi(token, 'siswa');
    const siswa = (db.sheets.Siswa || []).find(x => x.ID === sesi.sid);
    if (!siswa) throw new Error('SESI_HABIS');
    const tgl = String(tanggal || fmtYmd(new Date())).slice(0, 10);
    const rec = (db.sheets.Absensi || []).filter(a => a.Kelas === siswa.Kelas && a.Tanggal === tgl);
    return {
      tanggal: tgl,
      siswa: (db.sheets.Siswa || [])
        .filter(x => x.Kelas === siswa.Kelas)
        .sort((a, b) => a.Nama.localeCompare(b.Nama))
        .map(x => ({ ID: x.ID, Nama: x.Nama })),
      catatan: rec.map(a => ({ SiswaID: a.SiswaID, Kode: a.Kode, Keterangan: a.Keterangan })),
      terkunci: rec.some(a => a.Sumber !== 'sekretaris')
    };
  }

  if (fn === 'api_simpanAbsensiSekretaris') {
    const [token, tanggal, recs] = args;
    const sesi = getSesi(token, 'siswa');
    const siswa = (db.sheets.Siswa || []).find(x => x.ID === sesi.sid);
    if (!siswa) throw new Error('SESI_HABIS');
    const tgl = String(tanggal || fmtYmd(new Date())).slice(0, 10);
    const semua = db.sheets.Absensi || [];
    const lama = semua.filter(a => a.Kelas === siswa.Kelas && a.Tanggal === tgl);
    if (lama.some(a => a.Sumber !== 'sekretaris')) {
      throw new Error('Absensi tanggal ini sudah diisi atau dikonfirmasi guru.');
    }
    const baru = (recs || []).map((r: any) => ({
      Kelas: siswa.Kelas,
      Tanggal: tgl,
      SiswaID: r.SiswaID,
      Kode: r.Kode,
      Keterangan: String(r.Keterangan || '').slice(0, 200),
      Sumber: 'sekretaris'
    }));
    db.sheets.Absensi = semua.filter(a => !(a.Kelas === siswa.Kelas && a.Tanggal === tgl)).concat(baru);
    saveDb(db);
    return baru.length;
  }

  if (fn === 'api_exportBackup') {
    const [token] = args;
    getSesi(token, 'admin');
    const setObj = getPengaturanObj(db);
    return {
      format: 'kelasku-backup',
      version: 1,
      createdAt: new Date().toISOString(),
      sekolah: setObj.sekolah || 'KelasKU',
      storageEngine: 'local-browser',
      storageLabel: 'Penyimpanan Lokal Browser',
      data: {
        admin: db.admin,
        sheets: db.sheets
      },
      files: []
    };
  }

  if (fn === 'api_restoreBackup') {
    const [token, backup, opts] = args;
    getSesi(token, 'admin');
    if (!backup || typeof backup !== 'object') throw new Error('Format berkas backup tidak valid.');
    const rawData =
      backup.format === 'kelasku-backup' && backup.data
        ? backup.data
        : backup.sheets
          ? backup
          : backup.data?.sheets
            ? backup.data
            : null;
    if (!rawData || typeof rawData.sheets !== 'object') {
      throw new Error('Berkas backup tidak memiliki struktur data KelasKU.');
    }
    const clean = createCleanLocalDb();
    Object.keys(clean.sheets).forEach(k => {
      if (Array.isArray(rawData.sheets[k])) clean.sheets[k] = rawData.sheets[k];
    });
    const keepAdmin = opts?.keepCurrentAdmin !== false;
    clean.admin = keepAdmin || !rawData.admin?.passHash ? db.admin : rawData.admin;
    saveDb(clean);
    return {
      restoredAt: new Date().toISOString(),
      filesRestored: 0,
      kelasCount: (clean.sheets.Kelas || []).length,
      siswaCount: (clean.sheets.Siswa || []).length
    };
  }

  const readLocalSnapshots = (): any[] => {
    try {
      const raw = localStorage.getItem('mk_local_backups_v1');
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  };
  const writeLocalSnapshots = (arr: any[]) => {
    localStorage.setItem('mk_local_backups_v1', JSON.stringify(arr));
  };

  if (fn === 'api_listBackups') {
    const [token] = args;
    getSesi(token, 'admin');
    return readLocalSnapshots().map(({ data: _d, ...meta }) => meta);
  }

  if (fn === 'api_createBackupSnapshot') {
    const [token, label] = args;
    getSesi(token, 'admin');
    const snap = {
      id: 'bak_' + uidShort(),
      createdAt: new Date().toISOString(),
      label: String(label || '').trim() || 'Snapshot Manual',
      storageLabel: 'Penyimpanan Lokal Browser',
      stats: {
        kelas: (db.sheets.Kelas || []).length,
        siswa: (db.sheets.Siswa || []).length,
        absensi: (db.sheets.Absensi || []).length,
        nilai: (db.sheets.Nilai || []).length,
        tp: (db.sheets.TP || []).length,
        modul: (db.sheets.Modul || []).length
      },
      data: {
        sheets: JSON.parse(JSON.stringify(db.sheets))
      }
    };
    const next = [snap, ...readLocalSnapshots()].slice(0, 5);
    writeLocalSnapshots(next);
    return next.map(({ data: _d, ...meta }) => meta);
  }

  if (fn === 'api_getBackupSnapshot') {
    const [token, snapshotId] = args;
    getSesi(token, 'admin');
    const snap = readLocalSnapshots().find(s => s.id === snapshotId);
    if (!snap) throw new Error('Snapshot backup tidak ditemukan.');
    return {
      format: 'kelasku-backup',
      version: 1,
      createdAt: snap.createdAt,
      label: snap.label,
      storageLabel: snap.storageLabel,
      data: { admin: null, sheets: snap.data?.sheets || {} },
      files: []
    };
  }

  if (fn === 'api_restoreBackupSnapshot') {
    const [token, snapshotId] = args;
    getSesi(token, 'admin');
    const snap = readLocalSnapshots().find(s => s.id === snapshotId);
    if (!snap || !snap.data?.sheets) throw new Error('Snapshot backup tidak ditemukan.');
    const clean = createCleanLocalDb();
    Object.keys(clean.sheets).forEach(k => {
      if (Array.isArray(snap.data.sheets[k])) clean.sheets[k] = snap.data.sheets[k];
    });
    clean.admin = db.admin;
    saveDb(clean);
    return true;
  }

  if (fn === 'api_deleteBackupSnapshot') {
    const [token, snapshotId] = args;
    getSesi(token, 'admin');
    const next = readLocalSnapshots().filter(s => s.id !== snapshotId);
    writeLocalSnapshots(next);
    return next.map(({ data: _d, ...meta }) => meta);
  }

  throw new Error('Operasi ini membutuhkan koneksi server backend aktif.');
}

export async function runLocalKaldikSyncFallback(body: any): Promise<any> {
  const db = await getDb();
  const ta = String(body?.tahunAjaran || KALDIK_JABAR_REF.tahunAjaran).trim();
  const events: Record<string, string>[] = getKaldikJabarEvents(ta).map(e => ({
    ID: e.ID,
    Mulai: e.Mulai,
    Selesai: e.Selesai,
    Kegiatan: e.Kegiatan,
    Jenis: e.Jenis,
    Sumber: e.Sumber || ''
  }));
  const existingNonJabar = (db.sheets.Akademik || []).filter(
    a => !String(a.ID).startsWith('jabar_') && !String(a.Sumber || '').includes('Jabar')
  );
  const nextAkademik = [...existingNonJabar, ...events];
  const now = new Date();
  const nowStr = `${fmtYmd(now)} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  const set = {
    ...getPengaturanObj(db),
    kaldikAutoSync: '1',
    kaldikWilayah: KALDIK_JABAR_REF.wilayah,
    kaldikTahunAjaran: ta,
    kaldikLastSync: nowStr
  };
  db.sheets.Akademik = nextAkademik;
  db.sheets.Pengaturan = Object.entries(set).map(([Kunci, Nilai]) => ({ Kunci, Nilai }));
  saveDb(db);
  return {
    akademik: nextAkademik,
    pengaturan: set,
    addedCount: events.length,
    sourceNote: `${KALDIK_JABAR_REF.dasarSurat} (${ta})`
  };
}
