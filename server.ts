import http from 'http';
import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import zlib from 'zlib';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { getKaldikJabarEvents, KALDIK_JABAR_REF } from './src/data/kaldikJabar.ts';
import {
  clearAllRemoteFiles,
  deleteRemoteFile,
  deleteRemoteSession,
  detectStorageEngine,
  loadRemoteBackups,
  loadRemoteFile,
  loadRemoteSession,
  loadRemoteState,
  saveRemoteBackups,
  saveRemoteFile,
  saveRemoteSession,
  saveRemoteState
} from './vercelDb.ts';

const DB_PATH = path.resolve(process.cwd(), 'data', 'database.json');
const BACKUPS_PATH = path.resolve(process.cwd(), 'data', 'backups.json');
const CLOUD_DIR = path.resolve(process.cwd(), 'data', 'cloud_uploads');
const TUGAS_DIR = path.resolve(process.cwd(), 'data', 'tugas_uploads');
const AJAR_DIR = path.resolve(process.cwd(), 'data', 'ajar_uploads');

function getAiClient(): GoogleGenAI {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key || key === 'MY_GEMINI_API_KEY') {
    throw new Error('Kunci API AI belum dikonfigurasi pada environment server (GEMINI_API_KEY).');
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

function parseJsonSafe<T = any>(rawText: string | undefined, fallback: T = {} as T): T {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) return fallback;
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(unfenced) as T;
  } catch {
    const start = unfenced.indexOf('{');
    const end = unfenced.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(unfenced.slice(start, end + 1)) as T;
      } catch {}
    }
    return fallback;
  }
}

function extractOfficeXmlText(buf: Buffer): string {
  const chunks: string[] = [];
  let offset = 0;
  try {
    while (offset + 30 < buf.length) {
      const sig = buf.readUInt32LE(offset);
      if (sig !== 0x04034b50) {
        const next = buf.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), offset + 1);
        if (next === -1) break;
        offset = next;
        continue;
      }
      const compression = buf.readUInt16LE(offset + 8);
      const compSize = buf.readUInt32LE(offset + 18);
      const nameLen = buf.readUInt16LE(offset + 26);
      const extraLen = buf.readUInt16LE(offset + 28);
      const nameStart = offset + 30;
      const dataStart = nameStart + nameLen + extraLen;
      const entryName = buf.toString('utf8', nameStart, nameStart + nameLen);

      if (compSize > 0 && dataStart + compSize <= buf.length) {
        const isInteresting =
          entryName === 'word/document.xml' ||
          /^ppt\/slides\/slide\d+\.xml$/i.test(entryName) ||
          entryName === 'xl/sharedStrings.xml';
        if (isInteresting) {
          try {
            const rawSlice = buf.subarray(dataStart, dataStart + compSize);
            const xmlBuf = compression === 8 ? zlib.inflateRawSync(rawSlice) : rawSlice;
            const xmlStr = xmlBuf.toString('utf8');
            const text = xmlStr
              .replace(/<\/(w:p|a:p|p|tr|si)>/gi, '\n')
              .replace(/<[^>]+>/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/[ \t]+/g, ' ')
              .replace(/\n{3,}/g, '\n\n')
              .trim();
            if (text) chunks.push(text);
          } catch {}
        }
        offset = dataStart + compSize;
      } else {
        offset += 4;
      }
    }
  } catch {}
  return chunks.join('\n\n').trim();
}

const SKEMA: Record<string, string[]> = {
  Pengaturan: ['Kunci', 'Nilai'],
  Kelas: ['ID', 'Nama', 'Jurusan', 'Mapel'],
  Siswa: ['ID', 'Kelas', 'Nama', 'NIS', 'TempatLahir', 'TanggalLahir', 'JenisKelamin', 'NoSiswa', 'NoOrtu', 'Alamat', 'Kesehatan', 'Foto'],
  Absensi: ['Kelas', 'Tanggal', 'SiswaID', 'Kode', 'Keterangan', 'Sumber'],
  Tugas: ['ID', 'Kelas', 'Judul', 'Mapel', 'Deskripsi', 'Tenggat', 'Jenis', 'FileID', 'NamaFile'],
  Pengumpulan: ['TugasID', 'SiswaID', 'Status', 'Nilai', 'FileID', 'NamaFile', 'TanggalKumpul', 'CatatanSiswa'],
  Nilai: ['Kelas', 'SiswaID', 'Sikap', 'Tugas', 'Proyek', 'UTS', 'UAS'],
  Perilaku: ['ID', 'Kelas', 'Tanggal', 'SiswaID', 'Jenis', 'Level', 'Catatan', 'TindakLanjut'],
  Checklist: ['Kelas', 'Item', 'Selesai'],
  DenahAtur: ['Kelas', 'Baris', 'Kolom', 'Grup'],
  Denah: ['Kelas', 'Baris', 'Kolom', 'SiswaID'],
  Piket: ['ID', 'Kelas', 'Hari', 'SiswaID', 'Tugas'],
  Struktur: ['ID', 'Kelas', 'Jabatan', 'SiswaID', 'Tingkat'],
  Jadwal: ['ID', 'Kelas', 'Hari', 'Mulai', 'Selesai', 'Mapel', 'Guru', 'Jenis', 'Pekan'],
  JadwalAtur: ['Kelas', 'Sistem', 'Mulai', 'Durasi', 'Jumlah', 'Istirahat'],
  Akademik: ['ID', 'Mulai', 'Selesai', 'Kegiatan', 'Jenis', 'Sumber'],
  TP: ['ID', 'Kelas', 'ModulID', 'Kode', 'Tujuan', 'Materi', 'Status', 'FileID', 'NamaFile'],
  Modul: ['ID', 'Kelas', 'Judul', 'Mapel', 'Alokasi', 'TPIDs', 'Pembuka', 'Inti', 'Penutup', 'Asesmen', 'Media', 'Catatan', 'FileID', 'NamaFile', 'PertanyaanPemantik', 'LinkSumber'],
  Pemantik: ['ID', 'Kelas', 'ModulID', 'Mapel', 'Judul', 'Tautan', 'Pertanyaan', 'Slide', 'SumberPelajaran'],
  Materi: ['ID', 'Kelas', 'Mapel', 'Judul', 'Bab', 'Ringkasan', 'IsiMateri', 'LinkSumber', 'FileID', 'NamaFile', 'UkuranFile', 'TanggalUpload', 'Pengunggah'],
  Mapel: ['ID', 'Nama'],
  BerkasCloud: ['ID', 'Kelas', 'NamaFile', 'TipeMime', 'Ukuran', 'TanggalUnggah', 'Pengunggah', 'StatusCloud', 'PathSimpan', 'AnalisisJSON'],
  CBT: ['ID', 'Kelas', 'Judul', 'Mapel', 'Durasi', 'Status', 'Acak', 'SumberMateri', 'NamaFileMateri', 'SoalJSON', 'TanggalBuat'],
  HasilCBT: ['ID', 'CBTID', 'Kelas', 'SiswaID', 'Mulai', 'Selesai', 'JawabanJSON', 'SkorPG', 'SkorUraian', 'SkorAkhir', 'FeedbackAI', 'StatusNilai'],
  Pengguna: ['ID', 'Nama', 'Username', 'Peran', 'Kelas', 'Hash', 'Mapel', 'KelasWali', 'KelasMengajar'],
  Akun: ['SiswaID', 'Hash'],
  Pesan: ['ID', 'Kelas', 'PengirimID', 'PengirimNama', 'PengirimPeran', 'PenerimaID', 'PenerimaNama', 'Pesan', 'Waktu', 'Tipe', 'Lampiran']
};

const SHEET_TERKUNCI = ['Pengaturan', 'Akun', 'Pengguna'];
const IZIN_TULIS: Record<string, string[]> = {
  wali: ['Siswa', 'Absensi', 'Tugas', 'Pengumpulan', 'Nilai', 'Perilaku', 'Checklist', 'DenahAtur', 'Denah', 'Piket', 'Struktur', 'Jadwal', 'JadwalAtur', 'TP', 'Modul', 'Pemantik', 'Materi', 'BerkasCloud', 'CBT', 'HasilCBT', 'Pesan'],
  guru: ['Absensi', 'Tugas', 'Pengumpulan', 'Nilai', 'Perilaku', 'Checklist', 'Struktur', 'Jadwal', 'JadwalAtur', 'TP', 'Modul', 'Pemantik', 'Materi', 'BerkasCloud', 'CBT', 'HasilCBT', 'Pesan']
};
const TTL_SESI = 21600 * 1000; // 6 hours in ms

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

function hash_(salt: string, teks: string): string {
  return crypto.createHash('sha256').update(salt + '|' + teks, 'utf8').digest('base64');
}

function uuid(): string {
  return crypto.randomUUID();
}

function uidShort(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

interface DatabaseFile {
  admin: { user: string; salt: string; hash: string } | null;
  sheets: Record<string, Record<string, string>[]>;
}

let dbCache: DatabaseFile | null = null;
const sessions = new Map<string, { role: string; sid: string; nama: string; expires: number }>();
const loginFailures = new Map<string, { count: number; expires: number }>();
const recoveryCodes = new Map<string, { code: string; email: string; user: string; expires: number }>();

function createCleanDatabase(): DatabaseFile {
  const sheets: Record<string, Record<string, string>[]> = {};
  for (const k of Object.keys(SKEMA)) {
    sheets[k] = [];
  }
  sheets.Pengaturan = Object.entries(PENGATURAN_AWAL).map(([Kunci, Nilai]) => ({ Kunci, Nilai }));
  return {
    admin: null,
    sheets
  };
}

function createSeedDatabase(): DatabaseFile {
  const adminSalt = uuid();
  const adminUser = 'admin';
  const adminHash = hash_(adminSalt, 'admin12345');

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
      Hash: hash_('usr_wali1', 'guru12345'),
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
      Hash: hash_('usr_guru1', 'guru12345'),
      Mapel: 'mp8,mp4',
      KelasWali: 'kls_11a',
      KelasMengajar: 'kls_10a,kls_11a'
    }
  ];

  const siswa10A = [
    { ID: 'sis_01', Kelas: 'kls_10a', Nama: 'Adinda Putri Maharani', NIS: '102601', TempatLahir: 'Bandung', TanggalLahir: '2010-03-14', JenisKelamin: 'Perempuan', NoSiswa: '081234567801', NoOrtu: '081398765001', Alamat: 'Jl. Merdeka No. 12', Kesehatan: 'Normal' },
    { ID: 'sis_02', Kelas: 'kls_10a', Nama: 'Bagas Pratama Wijaya', NIS: '102602', TempatLahir: 'Bekasi', TanggalLahir: '2010-05-21', JenisKelamin: 'Laki-laki', NoSiswa: '081234567802', NoOrtu: '081398765002', Alamat: 'Jl. Sudirman No. 45', Kesehatan: 'Alergi debu' },
    { ID: 'sis_03', Kelas: 'kls_10a', Nama: 'Citra Kirana Lestari', NIS: '102603', TempatLahir: 'Bogor', TanggalLahir: '2010-01-09', JenisKelamin: 'Perempuan', NoSiswa: '081234567803', NoOrtu: '081398765003', Alamat: 'Jl. Diponegoro No. 8', Kesehatan: 'Normal' },
    { ID: 'sis_04', Kelas: 'kls_10a', Nama: 'Dimas Aditya Saputra', NIS: '102604', TempatLahir: 'Cimahi', TanggalLahir: '2010-07-18', JenisKelamin: 'Laki-laki', NoSiswa: '081234567804', NoOrtu: '081398765004', Alamat: 'Jl. Gatot Subroto No. 19', Kesehatan: 'Minus mata (-1.5)' },
    { ID: 'sis_05', Kelas: 'kls_10a', Nama: 'Eka Fitriani Rahmawati', NIS: '102605', TempatLahir: 'Depok', TanggalLahir: '2010-09-03', JenisKelamin: 'Perempuan', NoSiswa: '081234567805', NoOrtu: '081398765005', Alamat: 'Jl. Ahmad Yani No. 33', Kesehatan: 'Normal' },
    { ID: 'sis_06', Kelas: 'kls_10a', Nama: 'Fajar Nugroho Hidayat', NIS: '102606', TempatLahir: 'Garut', TanggalLahir: '2010-02-27', JenisKelamin: 'Laki-laki', NoSiswa: '081234567806', NoOrtu: '081398765006', Alamat: 'Jl. Kartini No. 7', Kesehatan: 'Asma ringan' },
    { ID: 'sis_07', Kelas: 'kls_10a', Nama: 'Gita Nadia Permata', NIS: '102607', TempatLahir: 'Bandung', TanggalLahir: '2010-08-11', JenisKelamin: 'Perempuan', NoSiswa: '081234567807', NoOrtu: '081398765007', Alamat: 'Jl. Imam Bonjol No. 21', Kesehatan: 'Normal' },
    { ID: 'sis_08', Kelas: 'kls_10a', Nama: 'Hafiz Ramadhan Putra', NIS: '102608', TempatLahir: 'Sukabumi', TanggalLahir: '2010-04-05', JenisKelamin: 'Laki-laki', NoSiswa: '081234567808', NoOrtu: '081398765008', Alamat: 'Jl. Pahlawan No. 54', Kesehatan: 'Normal' },
    { ID: 'sis_09', Kelas: 'kls_10a', Nama: 'Indah Kusuma Wardani', NIS: '102609', TempatLahir: 'Tasikmalaya', TanggalLahir: '2010-06-30', JenisKelamin: 'Perempuan', NoSiswa: '081234567809', NoOrtu: '081398765009', Alamat: 'Jl. Veteran No. 14', Kesehatan: 'Normal' },
    { ID: 'sis_10', Kelas: 'kls_10a', Nama: 'Joko Susilo Wibowo', NIS: '102610', TempatLahir: 'Cirebon', TanggalLahir: '2010-10-12', JenisKelamin: 'Laki-laki', NoSiswa: '081234567810', NoOrtu: '081398765010', Alamat: 'Jl. Pemuda No. 28', Kesehatan: 'Normal' },
    { ID: 'sis_11', Kelas: 'kls_10a', Nama: 'Kartika Sari Dewi', NIS: '102611', TempatLahir: 'Bandung', TanggalLahir: '2010-11-22', JenisKelamin: 'Perempuan', NoSiswa: '081234567811', NoOrtu: '081398765011', Alamat: 'Jl. Cendrawasih No. 9', Kesehatan: 'Normal' },
    { ID: 'sis_12', Kelas: 'kls_10a', Nama: 'Luthfi Hakim Maulana', NIS: '102612', TempatLahir: 'Sumedang', TanggalLahir: '2010-12-04', JenisKelamin: 'Laki-laki', NoSiswa: '081234567812', NoOrtu: '081398765012', Alamat: 'Jl. Melati No. 3', Kesehatan: 'Normal' },
    { ID: 'sis_13', Kelas: 'kls_10b', Nama: 'Muhammad Rizky Pratama', NIS: '102613', TempatLahir: 'Bandung', TanggalLahir: '2010-03-25', JenisKelamin: 'Laki-laki', NoSiswa: '081234567813', NoOrtu: '081398765013', Alamat: 'Jl. Kenanga No. 11', Kesehatan: 'Normal' },
    { ID: 'sis_14', Kelas: 'kls_10b', Nama: 'Nabila Azzahra Putri', NIS: '102614', TempatLahir: 'Bogor', TanggalLahir: '2010-05-16', JenisKelamin: 'Perempuan', NoSiswa: '081234567814', NoOrtu: '081398765014', Alamat: 'Jl. Anggrek No. 20', Kesehatan: 'Normal' },
    { ID: 'sis_15', Kelas: 'kls_10b', Nama: 'Oka Mahendra Kusuma', NIS: '102615', TempatLahir: 'Karawang', TanggalLahir: '2010-07-02', JenisKelamin: 'Laki-laki', NoSiswa: '081234567815', NoOrtu: '081398765015', Alamat: 'Jl. Dahlia No. 6', Kesehatan: 'Normal' },
    { ID: 'sis_16', Kelas: 'kls_10b', Nama: 'Putri Salsabila Ramadhani', NIS: '102616', TempatLahir: 'Purwakarta', TanggalLahir: '2010-08-19', JenisKelamin: 'Perempuan', NoSiswa: '081234567816', NoOrtu: '081398765016', Alamat: 'Jl. Flamboyan No. 18', Kesehatan: 'Normal' },
    { ID: 'sis_17', Kelas: 'kls_10b', Nama: 'Qori Firmansyah', NIS: '102617', TempatLahir: 'Subang', TanggalLahir: '2010-01-28', JenisKelamin: 'Laki-laki', NoSiswa: '081234567817', NoOrtu: '081398765017', Alamat: 'Jl. Teratai No. 4', Kesehatan: 'Normal' },
    { ID: 'sis_18', Kelas: 'kls_10b', Nama: 'Rania Safitri Handayani', NIS: '102618', TempatLahir: 'Bekasi', TanggalLahir: '2010-09-14', JenisKelamin: 'Perempuan', NoSiswa: '081234567818', NoOrtu: '081398765018', Alamat: 'Jl. Kamboja No. 15', Kesehatan: 'Normal' },
    { ID: 'sis_19', Kelas: 'kls_11a', Nama: 'Raka Danuarta', NIS: '112601', TempatLahir: 'Bandung', TanggalLahir: '2009-02-11', JenisKelamin: 'Laki-laki', NoSiswa: '081234567819', NoOrtu: '081398765019', Alamat: 'Jl. Mawar No. 5', Kesehatan: 'Normal' },
    { ID: 'sis_20', Kelas: 'kls_11a', Nama: 'Salsa Bila Khairunnisa', NIS: '112602', TempatLahir: 'Cimahi', TanggalLahir: '2009-04-23', JenisKelamin: 'Perempuan', NoSiswa: '081234567820', NoOrtu: '081398765020', Alamat: 'Jl. Tulip No. 9', Kesehatan: 'Normal' },
    { ID: 'sis_21', Kelas: 'kls_11a', Nama: 'Taufik Hidayatulloh', NIS: '112603', TempatLahir: 'Garut', TanggalLahir: '2009-06-08', JenisKelamin: 'Laki-laki', NoSiswa: '081234567821', NoOrtu: '081398765021', Alamat: 'Jl. Kutilang No. 22', Kesehatan: 'Normal' },
    { ID: 'sis_22', Kelas: 'kls_11a', Nama: 'Ulfa Nurjanah', NIS: '112604', TempatLahir: 'Depok', TanggalLahir: '2009-10-17', JenisKelamin: 'Perempuan', NoSiswa: '081234567822', NoOrtu: '081398765022', Alamat: 'Jl. Merpati No. 13', Kesehatan: 'Minus mata (-1.0)' },
    { ID: 'sis_23', Kelas: 'kls_11a', Nama: 'Vino Alfarizi', NIS: '112605', TempatLahir: 'Sukabumi', TanggalLahir: '2009-07-29', JenisKelamin: 'Laki-laki', NoSiswa: '081234567823', NoOrtu: '081398765023', Alamat: 'Jl. Rajawali No. 7', Kesehatan: 'Normal' },
    { ID: 'sis_24', Kelas: 'kls_11a', Nama: 'Wulan Dari Puspita', NIS: '112606', TempatLahir: 'Cianjur', TanggalLahir: '2009-11-05', JenisKelamin: 'Perempuan', NoSiswa: '081234567824', NoOrtu: '081398765024', Alamat: 'Jl. Elang No. 31', Kesehatan: 'Normal' }
  ];

  // Default PIN '123456' for all seeded students
  const akunList = siswa10A.map(s => ({
    SiswaID: s.ID,
    Hash: hash_(s.ID, '123456')
  }));

  const today = new Date();
  const fmtDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const d0 = fmtDate(today);
  const d1 = fmtDate(new Date(today.getTime() - 86400000));
  const d2 = fmtDate(new Date(today.getTime() - 2 * 86400000));
  const d3 = fmtDate(new Date(today.getTime() - 3 * 86400000));

  const absensiList: Record<string, string>[] = [];
  const kls10AStudents = siswa10A.filter(s => s.Kelas === 'kls_10a');
  [d3, d2, d1, d0].forEach((tgl, idx) => {
    kls10AStudents.forEach((s, sIdx) => {
      let kode = 'H';
      let ket = '';
      if (idx === 1 && sIdx === 3) { kode = 'S'; ket = 'Demam (surat orang tua)'; }
      if (idx === 2 && sIdx === 5) { kode = 'I'; ket = 'Acara keluarga'; }
      if (idx === 2 && sIdx === 9) { kode = 'A'; ket = 'Tanpa keterangan'; }
      if (idx === 3 && sIdx === 1) { kode = 'T'; ket = 'Hadir 07:12 karena ban bocor'; }
      if (idx === 3 && sIdx === 9) { kode = 'A'; ket = 'Belum konfirmasi'; }
      absensiList.push({
        Kelas: 'kls_10a',
        Tanggal: tgl,
        SiswaID: s.ID,
        Kode: kode,
        Keterangan: ket,
        Sumber: ''
      });
    });
  });

  const kls10BStudents = siswa10A.filter(s => s.Kelas === 'kls_10b');
  const kls11AStudents = siswa10A.filter(s => s.Kelas === 'kls_11a');

  [d1, d0].forEach((tgl, idx) => {
    kls10BStudents.forEach((s, sIdx) => {
      absensiList.push({
        Kelas: 'kls_10b',
        Tanggal: tgl,
        SiswaID: s.ID,
        Kode: idx === 1 && sIdx === 4 ? 'I' : 'H',
        Keterangan: idx === 1 && sIdx === 4 ? 'Lomba olimpiade kabupaten' : '',
        Sumber: ''
      });
    });
    kls11AStudents.forEach((s, sIdx) => {
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
    { ID: 'tug_3', Kelas: 'kls_10a', Judul: 'Proyek Pemodelan Fungsi Kuadrat', Mapel: 'Matematika', Deskripsi: 'Buat laporan pemodelan parabola dalam kehidupan sehari-hari (PDF atau foto grafik).', Tenggat: fmtDate(new Date(today.getTime() + 5 * 86400000)), Jenis: 'Proyek', FileID: '', NamaFile: '' },
    { ID: 'tug_4', Kelas: 'kls_10a', Judul: 'Laporan Pengukuran Jangka Sorong & Mikrometer', Mapel: 'Fisika', Deskripsi: 'Catat hasil pengukuran benda di laboratorium beserta ketidakpastian pengukuran.', Tenggat: fmtDate(new Date(today.getTime() + 3 * 86400000)), Jenis: 'Praktik', FileID: '', NamaFile: '' },
    { ID: 'tug_5', Kelas: 'kls_10a', Judul: 'Diagram Alir (Flowchart) Program Kasir Sederhana', Mapel: 'Informatika', Deskripsi: 'Buat flowchart perhitungan diskon belanja dan unggah dalam format PDF atau gambar.', Tenggat: fmtDate(new Date(today.getTime() + 4 * 86400000)), Jenis: 'Proyek', FileID: '', NamaFile: '' },
    { ID: 'tug_6', Kelas: 'kls_10a', Judul: 'Analisis Struktur Teks Laporan Hasil Observasi', Mapel: 'Bahasa Indonesia', Deskripsi: 'Identifikasi pernyataan umum, deskripsi bagian, dan kaidah kebahasaan dari teks bacaan.', Tenggat: fmtDate(new Date(today.getTime() + 6 * 86400000)), Jenis: 'Tugas', FileID: '', NamaFile: '' },
    { ID: 'tug_7', Kelas: 'kls_10b', Judul: 'Latihan Soal Fungsi Kuadrat & Diskriminan', Mapel: 'Matematika', Deskripsi: 'Kerjakan 8 soal penentuan titik puncak dan jenis akar fungsi kuadrat.', Tenggat: fmtDate(new Date(today.getTime() + 3 * 86400000)), Jenis: 'Tugas', FileID: '', NamaFile: '' },
    { ID: 'tug_8', Kelas: 'kls_10b', Judul: 'Praktikum Klasifikasi Larutan Asam & Basa', Mapel: 'Kimia', Deskripsi: 'Susun tabel hasil uji indikator alami dan kertas lakmus.', Tenggat: fmtDate(new Date(today.getTime() + 5 * 86400000)), Jenis: 'Praktik', FileID: '', NamaFile: '' },
    { ID: 'tug_9', Kelas: 'kls_11a', Judul: 'Pemodelan Matriks Transformasi Geometri', Mapel: 'Matematika', Deskripsi: 'Selesaikan latihan translasi, refleksi, dan rotasi menggunakan perkalian matriks.', Tenggat: fmtDate(new Date(today.getTime() + 4 * 86400000)), Jenis: 'Tugas', FileID: '', NamaFile: '' },
    { ID: 'tug_10', Kelas: 'kls_11a', Judul: 'Mini Riset Keanekaragaman Sel & Jaringan', Mapel: 'Biologi', Deskripsi: 'Presentasikan perbedaan struktur sel hewan dan sel tumbuhan beserta fungsinya.', Tenggat: fmtDate(new Date(today.getTime() + 6 * 86400000)), Jenis: 'Proyek', FileID: '', NamaFile: '' }
  ];

  const pengumpulanList: Record<string, string>[] = [];
  const nilaiList: Record<string, string>[] = [];

  kls10AStudents.forEach((s, i) => {
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

  kls10BStudents.forEach((s, i) => {
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

  kls11AStudents.forEach((s, i) => {
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

  const perilakuList = [
    { ID: 'per_1', Kelas: 'kls_10a', Tanggal: d2, SiswaID: 'sis_01', Jenis: 'Penguatan positif', Level: '', Catatan: 'Memimpin diskusi kelompok dan membantu teman memahami materi logaritma', TindakLanjut: 'Apresiasi di depan kelas dan poin bintang' },
    { ID: 'per_2', Kelas: 'kls_10a', Tanggal: d1, SiswaID: 'sis_03', Jenis: 'Penguatan positif', Level: '', Catatan: 'Menyiapkan perangkat proyektor dan kebersihan kelas sebelum jam pertama', TindakLanjut: 'Pesan apresiasi ke orang tua' },
    { ID: 'per_3', Kelas: 'kls_10a', Tanggal: d1, SiswaID: 'sis_10', Jenis: 'Pelanggaran', Level: '1', Catatan: 'Kurang fokus dan mengobrol saat penjelasan materi inti', TindakLanjut: 'Pengingat lisan dan pemindahan posisi diskusi' },
    { ID: 'per_4', Kelas: 'kls_10b', Tanggal: d1, SiswaID: 'sis_13', Jenis: 'Penguatan positif', Level: '', Catatan: 'Aktif membantu kelompok menyelesaikan praktikum pengukuran fisika', TindakLanjut: 'Apresiasi poin keaktifan' },
    { ID: 'per_5', Kelas: 'kls_11a', Tanggal: d1, SiswaID: 'sis_19', Jenis: 'Penguatan positif', Level: '', Catatan: 'Mengkoordinir persiapan presentasi proyek kelas dengan tertib', TindakLanjut: 'Apresiasi wali kelas' }
  ];

  const checklistList = [0, 1, 2, 3, 4, 5].map(i => ({
    Kelas: 'kls_10a',
    Item: String(i),
    Selesai: '1'
  }));

  const denahAturList = [
    { Kelas: 'kls_10a', Baris: '4', Kolom: '4', Grup: '2' },
    { Kelas: 'kls_10b', Baris: '3', Kolom: '4', Grup: '2' },
    { Kelas: 'kls_11a', Baris: '3', Kolom: '4', Grup: '2' }
  ];

  const denahList = [
    ...kls10AStudents.map((s, idx) => ({
      Kelas: 'kls_10a',
      Baris: String(Math.floor(idx / 4) + 1),
      Kolom: String((idx % 4) + 1),
      SiswaID: s.ID
    })),
    ...kls10BStudents.map((s, idx) => ({
      Kelas: 'kls_10b',
      Baris: String(Math.floor(idx / 4) + 1),
      Kolom: String((idx % 4) + 1),
      SiswaID: s.ID
    })),
    ...kls11AStudents.map((s, idx) => ({
      Kelas: 'kls_11a',
      Baris: String(Math.floor(idx / 4) + 1),
      Kolom: String((idx % 4) + 1),
      SiswaID: s.ID
    }))
  ];

  const hariPiket = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
  const tugasPiket = ['Menyapu lantai', 'Mengepel', 'Menghapus papan tulis', 'Merapikan meja & kursi', 'Membuang sampah'];
  const piketList = [
    ...kls10AStudents.map((s, i) => ({
      ID: `pik_10a_${i + 1}`,
      Kelas: 'kls_10a',
      Hari: hariPiket[i % 5],
      SiswaID: s.ID,
      Tugas: tugasPiket[i % 5]
    })),
    ...kls10BStudents.map((s, i) => ({
      ID: `pik_10b_${i + 1}`,
      Kelas: 'kls_10b',
      Hari: hariPiket[i % 5],
      SiswaID: s.ID,
      Tugas: tugasPiket[i % 5]
    })),
    ...kls11AStudents.map((s, i) => ({
      ID: `pik_11a_${i + 1}`,
      Kelas: 'kls_11a',
      Hari: hariPiket[i % 5],
      SiswaID: s.ID,
      Tugas: tugasPiket[i % 5]
    }))
  ];

  const strukturList = [
    { ID: 'str_1', Kelas: 'kls_10a', Jabatan: 'Ketua Kelas', SiswaID: 'sis_02', Tingkat: '1' },
    { ID: 'str_2', Kelas: 'kls_10a', Jabatan: 'Wakil Ketua', SiswaID: 'sis_04', Tingkat: '1' },
    { ID: 'str_3', Kelas: 'kls_10a', Jabatan: 'Sekretaris', SiswaID: 'sis_01', Tingkat: '2' },
    { ID: 'str_4', Kelas: 'kls_10a', Jabatan: 'Bendahara', SiswaID: 'sis_03', Tingkat: '2' },
    { ID: 'str_5', Kelas: 'kls_10a', Jabatan: 'Seksi Kebersihan', SiswaID: 'sis_05', Tingkat: '3' },
    { ID: 'str_6', Kelas: 'kls_10a', Jabatan: 'Seksi Keamanan', SiswaID: 'sis_06', Tingkat: '3' },
    { ID: 'str_7', Kelas: 'kls_10a', Jabatan: 'Seksi Kesehatan', SiswaID: 'sis_07', Tingkat: '3' },
    { ID: 'str_8', Kelas: 'kls_10a', Jabatan: 'Seksi Perlengkapan', SiswaID: 'sis_08', Tingkat: '3' },
    { ID: 'str_9', Kelas: 'kls_10b', Jabatan: 'Ketua Kelas', SiswaID: 'sis_13', Tingkat: '1' },
    { ID: 'str_10', Kelas: 'kls_10b', Jabatan: 'Sekretaris', SiswaID: 'sis_14', Tingkat: '2' },
    { ID: 'str_11', Kelas: 'kls_10b', Jabatan: 'Bendahara', SiswaID: 'sis_15', Tingkat: '2' },
    { ID: 'str_12', Kelas: 'kls_11a', Jabatan: 'Ketua Kelas', SiswaID: 'sis_19', Tingkat: '1' },
    { ID: 'str_13', Kelas: 'kls_11a', Jabatan: 'Sekretaris', SiswaID: 'sis_20', Tingkat: '2' },
    { ID: 'str_14', Kelas: 'kls_11a', Jabatan: 'Bendahara', SiswaID: 'sis_21', Tingkat: '2' }
  ];

  const jadwalAturList = [
    { Kelas: 'kls_10a', Sistem: 'reguler', Mulai: '07:00', Durasi: '45', Jumlah: '8', Istirahat: '3:15,6:30' },
    { Kelas: 'kls_10b', Sistem: 'reguler', Mulai: '07:00', Durasi: '45', Jumlah: '8', Istirahat: '3:15,6:30' },
    { Kelas: 'kls_11a', Sistem: 'reguler', Mulai: '07:00', Durasi: '45', Jumlah: '8', Istirahat: '3:15,6:30' }
  ];

  const jadwalList = [
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
  ];

  const akademikList = getKaldikJabarEvents('2026/2027');

  const tpList = [
    { ID: 'tp_1', Kelas: 'kls_10a', ModulID: '', Kode: 'TP 1', Tujuan: 'Peserta didik mampu menggeneralisasi sifat-sifat eksponen dan logaritma serta menerapkannya dalam penyelesaian masalah kontekstual.', Materi: 'Eksponen & Logaritma', Status: 'Tercapai' },
    { ID: 'tp_2', Kelas: 'kls_10a', ModulID: '', Kode: 'TP 2', Tujuan: 'Peserta didik mampu memodelkan dan menyelesaikan sistem persamaan linear tiga variabel (SPLTV).', Materi: 'SPLTV', Status: 'Tercapai' },
    { ID: 'tp_3', Kelas: 'kls_10a', ModulID: 'mod_1', Kode: 'TP 3', Tujuan: 'Peserta didik mampu menganalisis karakteristik grafik fungsi kuadrat dan menentukan titik optimum.', Materi: 'Fungsi Kuadrat', Status: 'Berjalan' },
    { ID: 'tp_4', Kelas: 'kls_10a', ModulID: 'mod_2', Kode: 'TP 4', Tujuan: 'Peserta didik mampu merancang algoritma pemecahan masalah sederhana menggunakan pseudocode dan flowchart.', Materi: 'Algoritma & Flowchart', Status: 'Berjalan' },
    { ID: 'tp_5', Kelas: 'kls_10b', ModulID: 'mod_1', Kode: 'TP 1', Tujuan: 'Peserta didik mampu menentukan titik puncak dan diskriminan fungsi kuadrat dalam masalah nyata.', Materi: 'Fungsi Kuadrat', Status: 'Berjalan' },
    { ID: 'tp_6', Kelas: 'kls_11a', ModulID: 'mod_3', Kode: 'TP 1', Tujuan: 'Peserta didik mampu menerapkan konsep besaran, pengukuran presisi, dan angka penting dalam percobaan fisika.', Materi: 'Besaran & Pengukuran', Status: 'Tercapai' }
  ];

  const modulList = [
    {
      ID: 'mod_1',
      Kelas: '__ALL__',
      Judul: 'Eksplorasi Fungsi Kuadrat & Lintasan Parabola',
      Mapel: 'Matematika',
      Alokasi: '2 × 45 menit',
      TPIDs: 'tp_3,tp_5',
      Pembuka: 'Salam, doa, dan cek kehadiran dalam 5 menit pertama.\nApersepsi: Mengaitkan lintasan bola basket dengan kurva parabola.\nMenyampaikan tujuan pembelajaran dan kriteria keberhasilan.',
      Inti: 'Kegiatan 1: Eksplorasi grafik f(x) = ax² + bx + c menggunakan lembar kerja kelompok.\nKegiatan 2: Diskusi kelompok heterogen menganalisis pengaruh koefisien a, b, dan diskriminan D.\nDiferensiasi: Kelompok mahir menganalisis optimasi luas maksimum.',
      Penutup: 'Rangkuman bersama tentang titik puncak dan sumbu simetri.\nRefleksi singkat (exit ticket 3 menit).\nInformasi tugas proyek pertemuan berikutnya.',
      Asesmen: 'Formatif: Observasi diskusi & Exit Ticket.\nSumatif: Proyek pemodelan jembatan parabola.',
      Media: 'LKPD Fungsi Kuadrat, GeoGebra Interaktif, Proyektor',
      Catatan: '85% siswa antusias saat simulasi visual kurva.',
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
      Pembuka: 'Apersepsi: Memecah proses pemesanan makanan online menjadi langkah-langkah logis.',
      Inti: 'Kegiatan 1: Identifikasi empat pilar berpikir komputasional (Dekomposisi, Pengenalan Pola, Abstraksi, Algoritma).\nKegiatan 2: Praktik menyusun flowchart percabangan dan perulangan sederhana.',
      Penutup: 'Presentasi hasil flowchart antar kelompok dan refleksi logika algoritma.',
      Asesmen: 'Formatif: Rubrik kelengkapan simbol flowchart & ketepatan logika.',
      Media: 'Kartu Alur Logika, Diagrams.net, Proyektor',
      Catatan: 'Siswa cepat memahami percabangan if-else dengan contoh kasir.',
      PertanyaanPemantik: 'Bagaimana aplikasi ojek online dapat menghitung tarif dan mencari rute tercepat hanya dalam hitungan detik?',
      LinkSumber: JSON.stringify([
        { label: 'Code.org CS Fundamentals', url: 'https://code.org' }
      ])
    },
    {
      ID: 'mod_3',
      Kelas: '__ALL__',
      Judul: 'Pengukuran Presisi & Ketidakpastian Alat Ukur Fisika',
      Mapel: 'Fisika',
      Alokasi: '2 × 45 menit',
      TPIDs: 'tp_6',
      Pembuka: 'Apersepsi: Mengapa teknisi mesin tidak cukup memakai penggaris biasa untuk mengukur diameter baut?',
      Inti: 'Praktikum langsung membaca skala utama dan skala nonius pada jangka sorong serta mikrometer sekrup.',
      Penutup: 'Pembahasan aturan angka penting dan pelaporan hasil pengukuran berulang.',
      Asesmen: 'Praktik laboratorium & kuis pembacaan skala.',
      Media: 'Jangka Sorong, Mikrometer Sekrup, Simulasi PhET',
      Catatan: '',
      PertanyaanPemantik: 'Mengapa setiap hasil pengukuran ilmiah selalu memiliki nilai ketidakpastian?',
      LinkSumber: JSON.stringify([
        { label: 'Simulasi PhET Colorado', url: 'https://phet.colorado.edu/in/' }
      ])
    }
  ];

  const pemantikList = [
    {
      ID: 'pem_1',
      Kelas: 'kls_10a',
      ModulID: 'mod_1',
      Mapel: 'Matematika',
      Judul: 'Mengapa Lintasan Air Mancur Berbentuk Parabola?',
      Tautan: 'https://www.geogebra.org/graphing',
      Pertanyaan: 'Jika kecepatan air mancur tetap, pada sudut kemiringan berapa air mencapai titik tertinggi dan jarak terjauh?',
      Slide: 'Lintasan Parabola di Sekitar Kita\nPerhatikan bentuk lengkungan jembatan gantung, lemparan bola basket, dan pancuran air taman.\n---\nHubungan dengan Persamaan Kuadrat\nSetiap titik ketinggian y pada jarak mendatar x mengikuti fungsi kuadrat f(x) = ax² + bx + c dengan nilai a negatif.\n---\nTantangan Diskusi Kelompok\n1. Apa yang terjadi jika nilai a diperbesar?\n2. Bagaimana cara menemukan titik puncak tertinggi tanpa menggambar seluruh tabel?',
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
      Pertanyaan: 'Mengapa komputer membutuhkan instruksi yang sangat spesifik dan tidak boleh ambigu seperti bahasa manusia sehari-hari?',
      Slide: 'Algoritma di Kehidupan Sehari-hari\nResep masakan, rute perjalanan, dan mesin ATM semuanya bekerja mengikuti urutan langkah yang terstruktur.\n---\n4 Pilar Berpikir Komputasional\nDekomposisi · Pengenalan Pola · Abstraksi · Algoritma.\n---\nStudi Kasus Kelas\nRancang alur logika mesin kasir otomatis yang memberi diskon 10% untuk total belanja di atas Rp100.000.',
      SumberPelajaran: JSON.stringify([
        { label: 'Code.org CS Fundamentals', url: 'https://code.org' }
      ])
    }
  ];

  const materiList = [
    {
      ID: 'mat_1',
      Kelas: '__ALL__',
      Mapel: 'Matematika',
      Judul: 'Fungsi Kuadrat, Grafik Parabola & Nilai Optimum',
      Bab: 'Bab 3 · Fungsi Kuadrat',
      Ringkasan: 'Panduan lengkap memahami bentuk umum fungsi kuadrat f(x) = ax² + bx + c, sumbu simetri, titik puncak, serta penerapannya dalam soal cerita.',
      IsiMateri: '1. Bentuk Umum Fungsi Kuadrat\nf(x) = ax² + bx + c dengan a, b, c ∈ R dan a ≠ 0.\n\n2. Pengaruh Koefisien a\n- Jika a > 0 maka parabola terbuka ke atas (memiliki nilai minimum).\n- Jika a < 0 maka parabola terbuka ke bawah (memiliki nilai maksimum).\n\n3. Sumbu Simetri & Titik Puncak (Optimum)\n- Sumbu simetri: x = -b / (2a)\n- Nilai optimum: y = -D / (4a), di mana D = b² - 4ac (Diskriminan).\n\n4. Analisis Diskriminan (D)\n- D > 0: memotong sumbu X di dua titik berbeda.\n- D = 0: menyinggung sumbu X di satu titik.\n- D < 0: tidak memotong sumbu X.',
      LinkSumber: JSON.stringify([
        { label: 'Simulasi Grafik GeoGebra', url: 'https://www.geogebra.org/graphing' },
        { label: 'Khan Academy: Fungsi Kuadrat', url: 'https://www.khanacademy.org/math/algebra/x2f8bb11595b61c86:quadratic-functions-equations' }
      ]),
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
      Ringkasan: 'Rangkuman sifat-sifat bilangan berpangkat, persamaan eksponen sederhana, dan aturan dasar logaritma beserta contoh penyelesaian.',
      IsiMateri: '1. Sifat-Sifat Eksponen (a > 0)\n- a^m × a^n = a^(m + n)\n- a^m / a^n = a^(m - n)\n- (a^m)^n = a^(m × n)\n- a^0 = 1 dan a^(-n) = 1 / a^n\n\n2. Definisi Logaritma\n^a log b = c ⇔ a^c = b, dengan syarat basis a > 0, a ≠ 1, dan numerus b > 0.\n\n3. Sifat Dasar Logaritma\n- ^a log(x · y) = ^a log x + ^a log y\n- ^a log(x / y) = ^a log x - ^a log y\n- ^a log(x^n) = n · ^a log x',
      LinkSumber: JSON.stringify([
        { label: 'Rumah Belajar Kemdikbud', url: 'https://belajar.kemdikbud.go.id' }
      ]),
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
      Ringkasan: 'Materi pembelajaran mengenai pengertian, ciri objektif, struktur (pernyataan umum, deskripsi bagian, deskripsi manfaat), serta contoh analisis teks LHO.',
      IsiMateri: '1. Pengertian Teks LHO\nTeks yang menyajikan informasi faktual hasil pengamatan suatu objek secara objektif, sistematis, dan dapat dipertanggungjawabkan.\n\n2. Struktur Teks LHO\n- Pernyataan Umum (Klasifikasi): pengantar tentang objek yang diamati secara garis besar.\n- Deskripsi Bagian: perincian bagian-bagian objek, ciri fisik, atau klasifikasi khusus.\n- Deskripsi Manfaat / Simpulan: kegunaan atau kesimpulan umum dari objek pengamatan.\n\n3. Kaidah Kebahasaan\nMenggunakan kata benda/nomina, verba relasional (adalah, merupakan, yaitu), istilah ilmiah bidang terkait, dan kalimat definisi/deskripsi.',
      LinkSumber: JSON.stringify([
        { label: 'KBBI Daring Kemdikbud', url: 'https://kbbi.kemdikbud.go.id' }
      ]),
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
      Ringkasan: 'Ringkasan besaran pokok dan turunan, cara membaca jangka sorong dan mikrometer sekrup, serta aturan pembulatan angka penting.',
      IsiMateri: '1. Besaran Pokok & Satuan SI\nPanjang (m), Massa (kg), Waktu (s), Suhu (K), Kuat Arus (A), Intensitas Cahaya (cd), Jumlah Zat (mol).\n\n2. Ketelitian Alat Ukur Panjang\n- Mistar: ketelitian 0,1 cm (1 mm)\n- Jangka Sorong: ketelitian 0,01 cm (0,1 mm)\n- Mikrometer Sekrup: ketelitian 0,001 cm (0,01 mm)\n\n3. Rumus Pembacaan Jangka Sorong\nHasil = Skala Utama + (Skala Nonius × 0,01 cm).',
      LinkSumber: JSON.stringify([
        { label: 'Simulasi PhET Fisika', url: 'https://phet.colorado.edu/in/' }
      ]),
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
      IsiMateri: '1. Empat Pilar Berpikir Komputasional\n- Dekomposisi: memecah masalah besar menjadi sub-masalah kecil.\n- Pengenalan Pola: mencari kesamaan karakteristik antar masalah.\n- Abstraksi: menyaring informasi penting dan mengabaikan detail tidak relevan.\n- Algoritma: menyusun langkah penyelesaian secara runtut.\n\n2. Simbol Dasar Flowchart\n- Terminator (Oval): Mulai / Selesai\n- Input/Output (Jajar Genjang): Membaca data / menampilkan hasil\n- Proses (Persegi Panjang): Perhitungan atau penugasan nilai\n- Decision (Belah Ketupat): Kondisi percabangan Ya/Tidak.',
      LinkSumber: JSON.stringify([
        { label: 'Code.org CS Fundamentals', url: 'https://code.org' }
      ]),
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
      Ringkasan: 'Materi dasar mengenai partikel penyusun atom (proton, neutron, elektron), nomor atom, nomor massa, isotop, dan golongan periode unsur.',
      IsiMateri: '1. Partikel Penyusun Atom\n- Proton (+1) dan Neutron (0) berada di inti atom.\n- Elektron (-1) bergerak mengelilingi inti pada kulit atom.\n\n2. Notasi Unsur (Z^A X)\n- Nomor Atom (Z) = jumlah proton = jumlah elektron (atom netral).\n- Nomor Massa (A) = jumlah proton + jumlah neutron.\n\n3. Aturan Kulit Elektron (Bohr)\nJumlah elektron maksimal tiap kulit ke-n adalah 2n² (Kulit K=2, L=8, M=18, N=32).',
      LinkSumber: JSON.stringify([
        { label: 'Tabel Periodik Interaktif Ptable', url: 'https://ptable.com/?lang=id' }
      ]),
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
      Ringkasan: 'Memahami tingkat keanekaragaman hayati (gen, jenis, ekosistem), tata nama binomial nomenklatur, serta organel utama sel.',
      IsiMateri: '1. Tiga Tingkat Keanekaragaman Hayati\n- Tingkat Gen: variasi dalam satu spesies (misalnya varietas mangga).\n- Tingkat Jenis: perbedaan antar spesies dalam satu famili.\n- Tingkat Ekosistem: perbedaan kondisi biotik dan abiotik.\n\n2. Perbedaan Sel Hewan & Sel Tumbuhan\nSel tumbuhan memiliki dinding sel, kloroplas, dan vakuola besar, sedangkan sel hewan memiliki sentriol dan lisosom.',
      LinkSumber: JSON.stringify([
        { label: 'Khan Academy Biology', url: 'https://www.khanacademy.org/science/biology' }
      ]),
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
      Ringkasan: 'Panduan lengkap memahami tujuan komunikatif, generic structure, penggunaan Simple Present vs Simple Past Tense, dan contoh paragraf.',
      IsiMateri: '1. Descriptive Text\n- Social Function: To describe a particular person, place, or thing.\n- Generic Structure: Identification + Description.\n- Language Features: Simple Present Tense, specific participant, adjectives.\n\n2. Recount Text\n- Social Function: To retell past events or experiences chronologically.\n- Generic Structure: Orientation + Events + Re-orientation.\n- Language Features: Simple Past Tense (V2), time connectives (first, then, finally).',
      LinkSumber: JSON.stringify([
        { label: 'British Council LearnEnglish', url: 'https://learnenglish.britishcouncil.org' }
      ]),
      FileID: '',
      NamaFile: '',
      UkuranFile: '',
      TanggalUpload: d1,
      Pengunggah: 'Rina Marlina, S.Pd.'
    }
  ];

  const berkasCloudList = [
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
        ringkasanEksekutif:
          'Dokumen berisi rekapitulasi capaian nilai formatif dan sumatif Matematika kelas X MIPA 1. Secara keseluruhan 91,6% siswa telah melampaui batas ketuntasan minimal (KKM 75) dengan rata-rata kelas 84,2.',
        informasiKunci: [
          'Rata-rata nilai Latihan Eksponen & Logaritma mencapai 86,4 dengan tingkat pengumpulan tepat waktu 91,6%.',
          'Terdapat korelasi positif kuat antara tingkat kehadiran (>95%) dengan capaian nilai Proyek Pemodelan Fungsi Kuadrat.',
          '1 siswa (Joko Susilo Wibowo) berada di bawah KKM pada komponen UTS (68) disertai catatan 2 hari alpa.'
        ],
        identifikasiTren: [
          'Tren peningkatan skor rata-rata sebesar +4,8 poin dari Kuis SPLTV ke Proyek Fungsi Kuadrat.',
          'Siswa yang aktif dalam diskusi kelompok heterogen menunjukkan stabilitas nilai di atas 85 pada seluruh komponen.'
        ],
        rekomendasiTindakLanjut: [
          'Jadwalkan sesi klinik remedial terfokus materi Eksponen & Fungsi Kuadrat bagi 1 siswa yang belum tuntas sebelum pelaksanaan UAS.',
          'Berikan tantangan proyek pengayaan optimasi kurva bagi 4 siswa dengan capaian predikat A (≥90).',
          'Lakukan komunikasi persuasif bersama orang tua terkait kedisiplinan kehadiran siswa dengan catatan alpa.'
        ],
        kategoriDokumen: 'Spreadsheet Evaluasi Akademik'
      })
    }
  ];

  const sampleMateriCBT = `Ringkasan Materi Eksponen dan Logaritma:
1. Sifat Eksponen: Untuk bilangan real a > 0, berlaku a^m × a^n = a^(m+n), a^m / a^n = a^(m-n), (a^m)^n = a^(m×n), dan a^0 = 1.
2. Persamaan Eksponen: Jika a^f(x) = a^g(x) dengan a > 0 dan a ≠ 1, maka f(x) = g(x).
3. Definisi Logaritma: ^a log b = c jika dan hanya jika a^c = b, dengan syarat basis a > 0, a ≠ 1, dan numerus b > 0.
4. Sifat Logaritma: ^a log(x·y) = ^a log x + ^a log y; ^a log(x/y) = ^a log x - ^a log y; dan ^a log(x^n) = n · ^a log x.`;

  const sampleMateriInfCBT = `Ringkasan Materi Berpikir Komputasional & Flowchart:
1. Empat pilar berpikir komputasional meliputi Dekomposisi, Pengenalan Pola, Abstraksi, dan Algoritma.
2. Pada diagram alir (flowchart), simbol Oval (Terminator) menandai Mulai/Selesai, Persegi Panjang menandai Proses, Jajar Genjang menandai Input/Output, dan Belah Ketupat (Decision) menandai Percabangan Kondisi.`;

  const cbtList = [
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
          {
            id: 'pg_1',
            pertanyaan: 'Berdasarkan sifat eksponen pada materi, bentuk sederhana dari a^m × a^n adalah…',
            opsiA: 'a^(m-n)',
            opsiB: 'a^(m+n)',
            opsiC: 'a^(m×n)',
            opsiD: '(2a)^(m+n)',
            opsiE: 'a^(m/n)',
            kunci: 'B',
            pembahasan: 'Perkalian bilangan berpangkat dengan basis sama menjumlahkan pangkatnya: a^m × a^n = a^(m+n).',
            kutipanMateri: 'a^m × a^n = a^(m+n)'
          },
          {
            id: 'pg_2',
            pertanyaan: 'Untuk setiap bilangan real a > 0, nilai dari a^0 sesuai sifat eksponen adalah…',
            opsiA: '0',
            opsiB: 'a',
            opsiC: '1',
            opsiD: '-1',
            opsiE: 'Tidak terdefinisi',
            kunci: 'C',
            pembahasan: 'Pada sifat eksponen poin 1 dijelaskan bahwa untuk a > 0 berlaku a^0 = 1.',
            kutipanMateri: 'dan a^0 = 1'
          },
          {
            id: 'pg_3',
            pertanyaan: 'Jika diketahui a^f(x) = a^g(x) dengan a > 0 dan a ≠ 1, maka kesimpulan yang benar adalah…',
            opsiA: 'f(x) + g(x) = 1',
            opsiB: 'f(x) × g(x) = 0',
            opsiC: 'f(x) = a · g(x)',
            opsiD: 'f(x) = g(x)',
            opsiE: 'f(x) > g(x)',
            kunci: 'D',
            pembahasan: 'Persamaan eksponen dengan basis sama a > 0, a ≠ 1 menghasilkan penyamaan pangkat f(x) = g(x).',
            kutipanMateri: 'Jika a^f(x) = a^g(x) dengan a > 0 dan a ≠ 1, maka f(x) = g(x).'
          },
          {
            id: 'pg_4',
            pertanyaan: 'Syarat yang harus dipenuhi oleh basis a dan numerus b pada definisi ^a log b = c adalah…',
            opsiA: 'a > 0, a ≠ 1, dan b > 0',
            opsiB: 'a ≥ 0 dan b < 0',
            opsiC: 'a = 1 dan b > 0',
            opsiD: 'a < 0 dan b ≠ 0',
            opsiE: 'a > 1 dan b = 0',
            kunci: 'A',
            pembahasan: 'Logaritma ^a log b mensyaratkan basis a > 0, a ≠ 1, dan numerus b > 0.',
            kutipanMateri: 'dengan syarat basis a > 0, a ≠ 1, dan numerus b > 0.'
          },
          {
            id: 'pg_5',
            pertanyaan: 'Sesuai sifat logaritma pada materi, bentuk ^a log(x · y) setara dengan…',
            opsiA: '^a log x × ^a log y',
            opsiB: '^a log x - ^a log y',
            opsiC: '^a log x + ^a log y',
            opsiD: 'x · ^a log y',
            opsiE: '(^a log x) / (^a log y)',
            kunci: 'C',
            pembahasan: 'Logaritma perkalian diuraikan menjadi penjumlahan logaritma: ^a log(x·y) = ^a log x + ^a log y.',
            kutipanMateri: '^a log(x·y) = ^a log x + ^a log y'
          }
        ],
        soalUraian: [
          {
            id: 'ur_1',
            pertanyaan: 'Jelaskan hubungan antara definisi logaritma ^a log b = c dengan bentuk pangkatnya beserta syarat nilai a dan b!',
            kunciRubrik: '^a log b = c ekuivalen dengan a^c = b, dengan syarat basis a > 0, a ≠ 1, dan numerus b > 0.',
            poinMaksimal: 50,
            kutipanMateri: '^a log b = c jika dan hanya jika a^c = b, dengan syarat basis a > 0, a ≠ 1, dan numerus b > 0.'
          },
          {
            id: 'ur_2',
            pertanyaan: 'Tuliskan tiga sifat utama logaritma (perkalian, pembagian, dan perpangkatan numerus) yang tercantum dalam ringkasan materi!',
            kunciRubrik: '1) ^a log(x·y) = ^a log x + ^a log y; 2) ^a log(x/y) = ^a log x - ^a log y; 3) ^a log(x^n) = n · ^a log x.',
            poinMaksimal: 50,
            kutipanMateri: '^a log(x·y) = ^a log x + ^a log y; ^a log(x/y) = ^a log x - ^a log y; dan ^a log(x^n) = n · ^a log x.'
          }
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
          {
            id: 'inf_pg_1',
            pertanyaan: 'Proses memecah masalah kompleks menjadi bagian-bagian kecil agar mudah diselesaikan disebut…',
            opsiA: 'Abstraksi',
            opsiB: 'Dekomposisi',
            opsiC: 'Iterasi',
            opsiD: 'Kompilasi',
            opsiE: 'Enkapsulasi',
            kunci: 'B',
            pembahasan: 'Dekomposisi memecah masalah besar menjadi sub-masalah yang lebih terkelola.',
            kutipanMateri: 'Empat pilar berpikir komputasional meliputi Dekomposisi'
          },
          {
            id: 'inf_pg_2',
            pertanyaan: 'Pada diagram alir (flowchart), simbol Belah Ketupat (Decision) digunakan untuk…',
            opsiA: 'Menandai awal dan akhir program',
            opsiB: 'Menampilkan hasil ke layar',
            opsiC: 'Mengambil keputusan percabangan kondisi Ya/Tidak',
            opsiD: 'Menghitung operasi aritmetika',
            opsiE: 'Menghubungkan halaman berbeda',
            kunci: 'C',
            pembahasan: 'Belah ketupat melambangkan percabangan logika berdasarkan syarat kondisi.',
            kutipanMateri: 'Belah Ketupat (Decision) menandai Percabangan Kondisi'
          }
        ],
        soalUraian: [
          {
            id: 'inf_ur_1',
            pertanyaan: 'Sebutkan empat pilar berpikir komputasional dan jelaskan fungsi simbol Persegi Panjang serta Jajar Genjang pada flowchart!',
            kunciRubrik: 'Pilar: Dekomposisi, Pengenalan Pola, Abstraksi, Algoritma. Persegi Panjang untuk Proses, Jajar Genjang untuk Input/Output.',
            poinMaksimal: 100,
            kutipanMateri: 'Empat pilar berpikir komputasional meliputi Dekomposisi, Pengenalan Pola, Abstraksi, dan Algoritma.'
          }
        ]
      })
    }
  ];

  const pengaturanRows = Object.entries(PENGATURAN_DEMO).map(([Kunci, Nilai]) => ({ Kunci, Nilai }));

  return {
    admin: { user: adminUser, salt: adminSalt, hash: adminHash },
    sheets: {
      Pengaturan: pengaturanRows,
      Kelas: kelasList,
      Siswa: siswa10A,
      Absensi: absensiList,
      Tugas: tugasList,
      Pengumpulan: pengumpulanList,
      Nilai: nilaiList,
      Perilaku: perilakuList,
      Checklist: checklistList,
      DenahAtur: denahAturList,
      Denah: denahList,
      Piket: piketList,
      Struktur: strukturList,
      Jadwal: jadwalList,
      JadwalAtur: jadwalAturList,
      Akademik: akademikList.map(a => ({
        ID: a.ID,
        Mulai: a.Mulai,
        Selesai: a.Selesai,
        Kegiatan: a.Kegiatan,
        Jenis: a.Jenis,
        Sumber: a.Sumber || ''
      })),
      TP: tpList,
      Modul: modulList,
      Pemantik: pemantikList,
      Materi: materiList,
      Mapel: mapelList,
      BerkasCloud: berkasCloudList,
      CBT: cbtList,
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
          Pesan: 'Halo siswa X MIPA 2! Jangan lupa pelajari Materi Fungsi Kuadrat dan kerjakan latihan soalnya sebelum pertemuan berikutnya.',
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

let remoteLoaded = false;
let remoteLoadPromise: Promise<void> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function queueWrite(task: () => Promise<void>) {
  writeQueue = writeQueue.then(task).catch(err => {
    console.error('Vercel DB write error:', err);
  });
}

async function flushWrites() {
  await writeQueue;
}

function normalizeLoadedDb(rawDb: DatabaseFile): DatabaseFile {
  if (!rawDb.sheets) rawDb.sheets = {};
  for (const k of Object.keys(SKEMA)) {
    if (!rawDb.sheets[k]) rawDb.sheets[k] = [];
  }
  rawDb.sheets.Kelas = (rawDb.sheets.Kelas || []).map((kls: any) => {
    if (kls.Jurusan) return kls;
    const nm = String(kls.Nama || '').toUpperCase();
    const inferred = nm.includes('IPS') ? 'IPS' : nm.includes('BHS') || nm.includes('BAHASA') ? 'Bahasa' : 'MIPA';
    return { ...kls, Jurusan: inferred };
  });
  rawDb.sheets.Siswa = (rawDb.sheets.Siswa || []).map((s: any) => ({
    ...s,
    TempatLahir: s.TempatLahir || '',
    TanggalLahir: s.TanggalLahir || '',
    JenisKelamin: s.JenisKelamin || '',
    NoSiswa: s.NoSiswa || s.KontakOrtu || '',
    NoOrtu: s.NoOrtu || '',
    Foto: s.Foto || ''
  }));
  const tpToModul = new Map<string, string>();
  (rawDb.sheets.Modul || []).forEach((m: any) => {
    String(m.TPIDs || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .forEach(tpId => {
        if (!tpToModul.has(tpId)) tpToModul.set(tpId, String(m.ID || ''));
      });
  });
  rawDb.sheets.TP = (rawDb.sheets.TP || []).map((t: any) => ({
    ...t,
    ModulID: t.ModulID || tpToModul.get(String(t.ID || '')) || ''
  }));
  return rawDb;
}

async function ensureDbLoaded(): Promise<void> {
  const { isVercelCloud } = detectStorageEngine();
  if (!isVercelCloud) {
    getDb();
    return;
  }
  if (remoteLoaded && dbCache && !process.env.VERCEL) return;
  if (remoteLoadPromise) return remoteLoadPromise;
  remoteLoadPromise = (async () => {
    await writeQueue;
    const remote = await loadRemoteState();
    if (remote && remote.sheets) {
      dbCache = normalizeLoadedDb(remote as DatabaseFile);
    } else {
      let initial: DatabaseFile | null = null;
      try {
        if (fs.existsSync(DB_PATH)) {
          initial = normalizeLoadedDb(JSON.parse(fs.readFileSync(DB_PATH, 'utf8')));
        }
      } catch (_) {}
      dbCache = initial || createSeedDatabase();
      await saveRemoteState(dbCache);
    }
    remoteLoaded = true;
  })().finally(() => {
    remoteLoadPromise = null;
  });
  return remoteLoadPromise;
}

function getDb(): DatabaseFile {
  if (dbCache) return dbCache;
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf8');
      dbCache = normalizeLoadedDb(JSON.parse(raw));
      return dbCache;
    }
  } catch (e) {
    console.error('Failed reading DB, resetting to seed state:', e);
  }
  dbCache = createSeedDatabase();
  saveDb();
  return dbCache;
}

function saveDb() {
  if (!dbCache) return;
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(dbCache, null, 2), 'utf8');
  } catch (_) {}
  const { isVercelCloud } = detectStorageEngine();
  if (isVercelCloud) {
    const snapshot = dbCache;
    queueWrite(() => saveRemoteState(snapshot));
  }
}

function baca_(nama: string): Record<string, string>[] {
  const db = getDb();
  const h = SKEMA[nama] || [];
  const rows = db.sheets[nama] || [];
  return rows.map(r => {
    const o: Record<string, string> = {};
    h.forEach(k => {
      o[k] = r[k] == null ? '' : String(r[k]);
    });
    return o;
  });
}

function tulis_(nama: string, rows: Record<string, any>[]) {
  const db = getDb();
  const h = SKEMA[nama] || [];
  db.sheets[nama] = (rows || []).map(r => {
    const o: Record<string, string> = {};
    h.forEach(k => {
      o[k] = r[k] == null ? '' : String(r[k]);
    });
    return o;
  });
  saveDb();
}

function pengaturan_(): Record<string, string> {
  const set = { ...PENGATURAN_AWAL };
  baca_('Pengaturan').forEach(r => {
    if (r.Kunci) set[r.Kunci] = r.Nilai;
  });
  return set;
}

function adminAda_(): boolean {
  const db = getDb();
  return !!(db.admin && db.admin.hash);
}

function setAdmin_(user: string, pass: string) {
  const db = getDb();
  const salt = uuid();
  db.admin = {
    user: String(user).trim().toLowerCase(),
    salt,
    hash: hash_(salt, pass)
  };
  saveDb();
}

function cekAdmin_(user: string, pass: string): boolean {
  const db = getDb();
  if (!db.admin || !db.admin.hash) return false;
  return user === db.admin.user && hash_(db.admin.salt, pass) === db.admin.hash;
}

function buatSesi_(role: string, sid: string, nama: string) {
  const token = uuid() + uuid();
  const rec = {
    role,
    sid: sid || '',
    nama: nama || '',
    expires: Date.now() + TTL_SESI
  };
  sessions.set(token, rec);
  if (detectStorageEngine().isVercelCloud) {
    queueWrite(() => saveRemoteSession(token, rec));
  }
  return { token, role, nama: nama || '' };
}

function sesi_(token: string, role?: string) {
  if (!token) throw new Error('SESI_HABIS');
  const s = sessions.get(token);
  if (!s || Date.now() > s.expires) {
    sessions.delete(token);
    throw new Error('SESI_HABIS');
  }
  if (role && s.role !== role) throw new Error('Akses ditolak.');
  return s;
}

function kunciGagal_(mode: string, user: string) {
  return `gagal_${mode}_${user}`;
}

function cekBlok_(k: string) {
  const rec = loginFailures.get(k);
  if (rec && Date.now() < rec.expires && rec.count >= 5) {
    throw new Error('Terlalu banyak percobaan gagal. Coba lagi dalam 10 menit.');
  }
}

function catatGagal_(k: string) {
  const rec = loginFailures.get(k);
  const count = rec && Date.now() < rec.expires ? rec.count + 1 : 1;
  loginFailures.set(k, { count, expires: Date.now() + 600 * 1000 });
}

function pinAcak_(): string {
  return String(100000 + Math.floor(Math.random() * 900000));
}

function simpanAkun_(daftar: { id: string; pin: string }[]) {
  const akun = baca_('Akun').filter(a => !daftar.some(d => d.id === a.SiswaID));
  daftar.forEach(d => akun.push({ SiswaID: d.id, Hash: hash_(d.id, d.pin) }));
  tulis_('Akun', akun);
}

function pisah_(t: any): string[] {
  return String(t || '').split(',').filter(Boolean);
}

function perluas_(u: Record<string, string>) {
  const roles = pisah_(u.Peran);
  const semua = pisah_(u.Kelas);
  const wali = roles.includes('wali') ? (pisah_(u.KelasWali).length ? pisah_(u.KelasWali) : semua) : [];
  const mengajar = roles.includes('guru') ? (pisah_(u.KelasMengajar).length ? pisah_(u.KelasMengajar) : semua) : [];
  return { roles, wali, mengajar };
}

function staf_(token: string) {
  const s = sesi_(token);
  if (s.role === 'admin') return { peran: 'admin', izin: null as string[] | null, wali: [] as string[], guru: [] as string[], nama: s.nama, user: null as Record<string, string> | null };
  if (s.role !== 'staf') throw new Error('Akses ditolak.');
  const u = baca_('Pengguna').find(x => x.ID === s.sid);
  if (!u) throw new Error('SESI_HABIS');
  const p = perluas_(u);
  const guru = p.mengajar.filter(k => !p.wali.includes(k));
  return { peran: p.roles.join(','), izin: p.wali.concat(guru), wali: p.wali, guru, nama: u.Nama, user: u };
}

function tulisKelas_(st: ReturnType<typeof staf_>, nama: string): string[] | null {
  if (!st.izin) return null;
  return (IZIN_TULIS.wali.includes(nama) ? st.wali : []).concat(IZIN_TULIS.guru.includes(nama) ? st.guru : []);
}

function bolehTulis_(st: ReturnType<typeof staf_>, nama: string): boolean {
  const k = tulisKelas_(st, nama);
  return !k || k.length > 0;
}

function tulisDi_(st: ReturnType<typeof staf_>, nama: string, kelas: string): boolean {
  const k = tulisKelas_(st, nama);
  return !k || k.includes(kelas);
}

function bolehPIN_(st: ReturnType<typeof staf_>, kelas: string): boolean {
  return !st.izin || st.wali.includes(kelas);
}

function tugasIzin_(izin: string[]) {
  const milik: Record<string, boolean> = {};
  const semua: Record<string, boolean> = {};
  baca_('Tugas').forEach(t => {
    semua[t.ID] = true;
    if (izin.includes(t.Kelas)) milik[t.ID] = true;
  });
  return { milik, semua };
}

function ekstrakTingkatanKelas_(namaKelas: string): string {
  const raw = String(namaKelas || '')
    .trim()
    .toUpperCase()
    .replace(/^(?:KELAS|KLS)\s+/i, '')
    .trim();
  if (!raw) return '';
  const highRoman = /^(XII|XI|X|IX|VIII|VII)(?=$|[\s.\-_/0-9A-Z])/.exec(raw);
  if (highRoman) return highRoman[1];
  const numMatch = /^(1[0-2]|[1-9])(?=$|[\s.\-_/A-Z])/.exec(raw);
  if (numMatch) {
    const n = numMatch[1];
    if (n === '10') return 'X';
    if (n === '11') return 'XI';
    if (n === '12') return 'XII';
    if (n === '7') return 'VII';
    if (n === '8') return 'VIII';
    if (n === '9') return 'IX';
    return n;
  }
  const sdRoman = /^(VI|IV|V|III|II|I)(?=$|[\s.\-_/0-9])/.exec(raw);
  if (sdRoman) {
    const map: Record<string, string> = { I: '1', II: '2', III: '3', IV: '4', V: '5', VI: '6' };
    return map[sdRoman[1]] || sdRoman[1];
  }
  return '';
}

function rowMatchesIzin(rowKelas: string, izin: string[]): boolean {
  const k = String(rowKelas || '').trim();
  if (!k || k === '__ALL__' || k === 'all') return true;
  if (k.startsWith('__TINGKAT__:')) {
    const reqLvl = k.slice('__TINGKAT__:'.length).trim().toUpperCase();
    if (!reqLvl) return true;
    return baca_('Kelas').some(c => izin.includes(c.ID) && ekstrakTingkatanKelas_(c.Nama) === reqLvl);
  }
  const parts = k.split(',').map(s => s.trim()).filter(Boolean);
  return parts.some(p => izin.includes(p));
}

function bacaIzin_(nama: string, izin: string[] | null) {
  const rows = baca_(nama);
  if (!izin) return rows;
  if (nama === 'Kelas') return rows.filter(r => izin.includes(r.ID));
  if (nama === 'Pengumpulan') {
    const t = tugasIzin_(izin);
    return rows.filter(r => t.milik[r.TugasID]);
  }
  if (nama === 'Modul' || nama === 'TP' || nama === 'Pemantik' || nama === 'Materi') {
    return rows.filter(r => rowMatchesIzin(r.Kelas, izin));
  }
  if (SKEMA[nama].includes('Kelas')) return rows.filter(r => izin.includes(r.Kelas));
  return rows;
}

function gabungIzin_(nama: string, rows: Record<string, any>[], izin: string[]) {
  const lama = baca_(nama);
  if (nama === 'Pengumpulan') {
    const t = tugasIzin_(izin);
    return lama.filter(r => t.semua[r.TugasID] && !t.milik[r.TugasID]).concat(rows.filter(r => t.milik[r.TugasID]));
  }
  if (!SKEMA[nama].includes('Kelas')) throw new Error('Akses ditolak.');
  if (nama === 'Modul' || nama === 'TP' || nama === 'Pemantik' || nama === 'Materi') {
    return lama.filter(r => !rowMatchesIzin(r.Kelas, izin)).concat(rows.filter(r => rowMatchesIzin(r.Kelas, izin)));
  }
  return lama.filter(r => !izin.includes(r.Kelas)).concat(rows.filter(r => izin.includes(r.Kelas)));
}

function daftarPengguna_() {
  return baca_('Pengguna').map(u => {
    const p = perluas_(u);
    const semua = p.wali.concat(p.mengajar.filter(k => !p.wali.includes(k)));
    return {
      ID: u.ID,
      Nama: u.Nama,
      Username: u.Username,
      Peran: p.roles.join(','),
      Kelas: semua.join(','),
      KelasWali: p.wali.join(','),
      KelasMengajar: p.mengajar.join(','),
      Mapel: u.Mapel
    };
  });
}

const HARI_VALID_ = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
function menit_(t: string): number {
  const m = /^(\d{2}):(\d{2})$/.exec(String(t || ''));
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : -1;
}
const tumpang_ = (a: Record<string, string>, b: Record<string, string>) =>
  menit_(a.Mulai) < menit_(b.Selesai) && menit_(b.Mulai) < menit_(a.Selesai);
const pekanTemu_ = (a: Record<string, string>, b: Record<string, string>) =>
  !a.Pekan || !b.Pekan || a.Pekan === b.Pekan;
const adalahPelajaran_ = (r: Record<string, string>) => !r.Jenis || r.Jenis === 'Pelajaran';

function validasiJadwal_(rows: Record<string, string>[], lama: Record<string, string>[]) {
  const lamaMap: Record<string, Record<string, string>> = {};
  lama.forEach(r => (lamaMap[r.ID] = r));
  const kunci = ['Kelas', 'Hari', 'Mulai', 'Selesai', 'Mapel', 'Guru', 'Jenis', 'Pekan'];
  const sama = (a: Record<string, string>, b: Record<string, string>) =>
    kunci.every(k => String(a[k] || '') === String(b[k] || ''));
  const kelas: Record<string, string> = {};
  baca_('Kelas').forEach(k => (kelas[k.ID] = k.Nama));
  rows.forEach(r => {
    if (lamaMap[r.ID] && sama(r, lamaMap[r.ID])) return;
    const nm = (kelas[r.Kelas] || 'kelas') + ' · ' + r.Mapel;
    if (!HARI_VALID_.includes(r.Hari)) throw new Error('Hari tidak valid pada ' + nm + '.');
    if (menit_(r.Mulai) < 0 || menit_(r.Selesai) <= menit_(r.Mulai))
      throw new Error('Jam tidak valid pada ' + nm + ': jam selesai harus setelah jam mulai.');
    if (!['', 'A', 'B'].includes(String(r.Pekan || ''))) throw new Error('Pekan harus kosong, A, atau B.');
    const guru = String(r.Guru || '').trim().toLowerCase();
    rows.forEach(o => {
      if (o === r || o.ID === r.ID || o.Hari !== r.Hari || !tumpang_(r, o) || !pekanTemu_(r, o)) return;
      if (o.Kelas === r.Kelas)
        throw new Error(
          'Jadwal bentrok di ' +
            (kelas[r.Kelas] || 'kelas ini') +
            ' hari ' +
            r.Hari +
            ': ' +
            r.Mapel +
            ' (' +
            r.Mulai +
            '–' +
            r.Selesai +
            ') dengan ' +
            o.Mapel +
            ' (' +
            o.Mulai +
            '–' +
            o.Selesai +
            ').'
        );
      if (guru && adalahPelajaran_(r) && adalahPelajaran_(o) && String(o.Guru || '').trim().toLowerCase() === guru)
        throw new Error(
          'Guru ' +
            r.Guru +
            ' sudah mengajar ' +
            o.Mapel +
            ' di kelas ' +
            (kelas[o.Kelas] || '?') +
            ' hari ' +
            r.Hari +
            ' ' +
            o.Mulai +
            '–' +
            o.Selesai +
            ', bentrok dengan ' +
            r.Mapel +
            ' di ' +
            (kelas[r.Kelas] || 'kelas ini') +
            '.'
        );
    });
  });
}

function waliKelas_(kelasId: string): string {
  return baca_('Pengguna')
    .filter(u => perluas_(u).wali.includes(kelasId))
    .map(u => u.Nama)
    .join(', ');
}

const KODE_ABSEN_ = ['H', 'S', 'I', 'A', 'T', 'D'];
function wajibSekretaris_(token: string) {
  const sesi = sesi_(token, 'siswa');
  const s = baca_('Siswa').find(x => x.ID === sesi.sid);
  if (!s) throw new Error('SESI_HABIS');
  const ok = baca_('Struktur').some(j => j.Kelas === s.Kelas && j.SiswaID === s.ID && /sekretaris/i.test(j.Jabatan));
  if (!ok) throw new Error('Hanya sekretaris kelas yang dapat mengisi absensi.');
  return s;
}

function tanggalSekretaris_(t: string): string {
  t = String(t || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) throw new Error('Tanggal tidak valid.');
  const fmt = (ms: number) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const sekarang = Date.now();
  if (t > fmt(sekarang + 86400000)) throw new Error('Tanggal tidak boleh di masa depan.');
  if (t < fmt(sekarang - 8 * 86400000)) throw new Error('Sekretaris hanya dapat mengisi absensi 7 hari terakhir.');
  return t;
}

function sandiAcak_(): string {
  return uuid().replace(/-/g, '').slice(0, 10);
}

function sanitizeJurusanLogos_(raw: any): Record<string, string> {
  let obj: Record<string, any> = {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw || '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) obj = parsed;
    } catch (_) {
      return {};
    }
  } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    obj = raw;
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = String(k || '').trim();
    const val = String(v || '').trim();
    if (!key || !val) continue;
    if (!val.startsWith('data:image/')) {
      throw new Error(`Format logo jurusan "${key}" harus berupa gambar valid (PNG, JPG, WebP, atau SVG).`);
    }
    if (val.length > 250000) {
      throw new Error(`Ukuran logo jurusan "${key}" terlalu besar (maks. 250 KB).`);
    }
    out[key] = val;
  }
  if (JSON.stringify(out).length > 550000) {
    throw new Error('Total ukuran semua logo jurusan terlalu besar.');
  }
  return out;
}

// RPC Methods matching Code.gs
const rpcMethods: Record<string, (...args: any[]) => any> = {
  api_status() {
    const set = pengaturan_();
    const em = String(set.emailPemulihan || '').trim();
    const emailHint = em.includes('@')
      ? `${em.slice(0, Math.min(2, em.indexOf('@')))}***@${em.split('@')[1]}`
      : '';
    const storage = detectStorageEngine();
    return {
      adminAda: adminAda_(),
      sekolah: set.sekolah || 'Sistem Manajemen Kelas',
      logo: set.logo || '',
      loginBg: set.loginBg || '',
      jurusan: set.jurusan || '',
      jurusanLogos: set.jurusanLogos || '{}',
      waInfo: set.waInfo || '',
      emailHint,
      storageEngine: storage.engine,
      storageLabel: storage.label,
      vercelConfigured: storage.isVercelCloud
    };
  },

  api_updateLoginBranding(logo: string, jurusan: string, sekolah?: string, jurusanLogos?: any, loginBg?: string) {
    const cleanLogo = String(logo || '').trim();
    if (cleanLogo && !cleanLogo.startsWith('data:image/')) {
      throw new Error('Format logo harus berupa gambar valid (PNG, JPG, WebP, atau SVG).');
    }
    if (cleanLogo.length > 600000) {
      throw new Error('Ukuran gambar logo terlalu besar.');
    }
    const cleanJurusanList = Array.from(
      new Set(
        String(jurusan || '')
          .split(',')
          .map(x => x.trim())
          .filter(Boolean)
      )
    );
    const cleanJurusan = cleanJurusanList.join(', ');
    if (!cleanJurusan) {
      throw new Error('Minimal isi 1 nama jurusan.');
    }
    const cur = pengaturan_();
    let nextLoginBg = cur.loginBg || '';
    if (loginBg !== undefined) {
      const cleanBg = String(loginBg || '').trim();
      if (
        cleanBg &&
        cleanBg !== 'none' &&
        !cleanBg.startsWith('preset:') &&
        !cleanBg.startsWith('data:image/')
      ) {
        throw new Error('Format gambar latar tidak valid.');
      }
      if (cleanBg.length > 1500000) {
        throw new Error('Ukuran gambar latar terlalu besar. Gunakan gambar di bawah 1 MB.');
      }
      nextLoginBg = cleanBg;
    }
    let nextLogosStr = cur.jurusanLogos || '{}';
    if (jurusanLogos !== undefined) {
      const sanitized = sanitizeJurusanLogos_(jurusanLogos);
      const filtered: Record<string, string> = {};
      cleanJurusanList.forEach(j => {
        if (sanitized[j]) filtered[j] = sanitized[j];
      });
      nextLogosStr = JSON.stringify(filtered);
    }
    const cleanSekolah = String(sekolah || '').trim();
    const baru: Record<string, string> = {
      ...cur,
      logo: cleanLogo,
      loginBg: nextLoginBg,
      jurusan: cleanJurusan,
      jurusanLogos: nextLogosStr,
      ...(cleanSekolah ? { sekolah: cleanSekolah } : {})
    };
    tulis_(
      'Pengaturan',
      Object.keys(baru).map(k => ({ Kunci: k, Nilai: baru[k] }))
    );
    return {
      sekolah: baru.sekolah || 'Sistem Manajemen Kelas',
      logo: baru.logo || '',
      loginBg: baru.loginBg || '',
      jurusan: baru.jurusan || '',
      jurusanLogos: baru.jurusanLogos || '{}'
    };
  },

  api_setupAdmin(user: string, pass: string) {
    user = String(user || '').trim();
    pass = String(pass || '');
    if (adminAda_()) throw new Error('Akun admin sudah dibuat.');
    if (user.length < 3) throw new Error('Nama pengguna minimal 3 karakter.');
    if (pass.length < 8) throw new Error('Kata sandi minimal 8 karakter.');
    setAdmin_(user, pass);
    return buatSesi_('admin', '', user);
  },

  api_login(mode: string, user: string, pass: string) {
    const userRaw = String(user || '').trim().toLowerCase();
    const userNisNorm = userRaw.replace(/\s+/g, '');
    const passRaw = String(pass || '');
    const passTrim = passRaw.trim();
    if (!userRaw || !passTrim) throw new Error('Lengkapi data masuk.');
    const kg = kunciGagal_(mode, userRaw);
    cekBlok_(kg);

    const tryStudentLogin = () => {
      const akun = baca_('Akun');
      const siswaMatches = baca_('Siswa').filter(
        s => String(s.NIS || '').replace(/\s+/g, '').toLowerCase() === userNisNorm
      );
      if (!siswaMatches.length) return { status: 'no_nis' as const };
      const withAkun = siswaMatches.filter(s => akun.some(a => a.SiswaID === s.ID));
      if (!withAkun.length) return { status: 'no_pin' as const };
      const matched = withAkun.find(s =>
        akun.some(a => a.SiswaID === s.ID && a.Hash === hash_(s.ID, passTrim))
      );
      if (matched) return { status: 'ok' as const, siswa: matched };
      return { status: 'wrong_pin' as const };
    };

    if (mode === 'admin') {
      if (!adminAda_()) throw new Error('Akun admin belum dibuat.');
      if (cekAdmin_(userRaw, passRaw) || cekAdmin_(userRaw, passTrim)) {
        loginFailures.delete(kg);
        return buatSesi_('admin', '', userRaw);
      }
      const staf = baca_('Pengguna').find(
        u =>
          String(u.Username || '').trim().toLowerCase() === userRaw &&
          (u.Hash === hash_(u.ID, passRaw) || u.Hash === hash_(u.ID, passTrim))
      );
      if (staf) {
        loginFailures.delete(kg);
        return buatSesi_('staf', staf.ID, staf.Nama);
      }
      // Fallback: if user entered a valid student NIS + PIN without switching to Portal Siswa tab
      const stCheck = tryStudentLogin();
      if (stCheck.status === 'ok') {
        loginFailures.delete(kg);
        loginFailures.delete(kunciGagal_('siswa', userRaw));
        return buatSesi_('siswa', stCheck.siswa.ID, stCheck.siswa.Nama);
      }
      if (stCheck.status === 'no_pin') {
        throw new Error('Akun siswa ini belum memiliki PIN aktif. Minta Admin/Wali Kelas membuat PIN terlebih dahulu.');
      }
      if (stCheck.status === 'wrong_pin') {
        catatGagal_(kg);
        throw new Error('PIN siswa salah. Pastikan mode masuk "Portal Siswa" dan PIN sesuai.');
      }
    } else {
      const stCheck = tryStudentLogin();
      if (stCheck.status === 'ok') {
        loginFailures.delete(kg);
        loginFailures.delete(kunciGagal_('admin', userRaw));
        return buatSesi_('siswa', stCheck.siswa.ID, stCheck.siswa.Nama);
      }
      if (stCheck.status === 'no_nis') {
        catatGagal_(kg);
        throw new Error('NIS tidak terdaftar pada data siswa.');
      }
      if (stCheck.status === 'no_pin') {
        throw new Error('Siswa dengan NIS tersebut belum memiliki PIN aktif. Minta Admin/Wali Kelas klik "Buat PIN Baru" atau "Buat PIN Baru Seragam".');
      }
      catatGagal_(kg);
      throw new Error('PIN siswa salah. Pastikan PIN 4–8 angka sesuai yang dibuat Admin/Wali Kelas.');
    }
    catatGagal_(kg);
    throw new Error('Nama pengguna / NIS atau kata sandi / PIN salah.');
  },

  api_kirimKodePemulihan(user: string, email: string) {
    const u = String(user || '').trim().toLowerCase();
    const em = String(email || '').trim().toLowerCase();
    if (!u || !em) throw new Error('Masukkan nama pengguna dan email pemulihan Admin.');

    const kg = kunciGagal_('email_otp', u);
    cekBlok_(kg);

    const db = getDb();
    const isMainAdmin = !!(db.admin && db.admin.user === u);
    const staf = baca_('Pengguna').find(x => String(x.Username || '').trim().toLowerCase() === u);
    if (!isMainAdmin && !staf) {
      catatGagal_(kg);
      throw new Error('Nama pengguna tidak ditemukan.');
    }

    const set = pengaturan_();
    const emailTerdaftar = String(set.emailPemulihan || '').trim().toLowerCase();
    if (!emailTerdaftar) {
      throw new Error('Email pemulihan Admin belum diatur pada menu Pengaturan.');
    }
    if (em !== emailTerdaftar) {
      catatGagal_(kg);
      throw new Error('Email yang dimasukkan tidak cocok dengan Email Pemulihan Admin yang terdaftar.');
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    recoveryCodes.set(u, {
      code,
      email: emailTerdaftar,
      user: u,
      expires: Date.now() + 15 * 60 * 1000
    });
    loginFailures.delete(kg);

    return {
      ok: true,
      kodePreview: code,
      pesan: `Kode verifikasi 6 digit telah diterbitkan untuk ${emailTerdaftar} (berlaku 15 menit).`
    };
  },

  api_lupaSandi(mode: string, user: string, verifikasi: string, sandiBaru: string) {
    const modeNorm = mode === 'siswa' ? 'siswa' : 'admin';
    const u = String(user || '').trim().toLowerCase();
    const verRaw = String(verifikasi || '').trim();
    const ver = verRaw.toLowerCase();
    const baru = String(sandiBaru || '').trim();

    if (modeNorm === 'siswa') {
      throw new Error('Siswa yang lupa PIN silakan hubungi Admin atau Wali Kelas melalui WhatsApp Informasi untuk reset PIN.');
    }

    if (!u || !ver || !baru) throw new Error('Lengkapi seluruh kolom pemulihan kata sandi.');

    const kg = kunciGagal_('reset_' + modeNorm, u);
    cekBlok_(kg);

    const set = pengaturan_();
    const kodeReset = String(set.kodeReset || '').trim().toLowerCase();
    const recOtp = recoveryCodes.get(u);
    const otpValid = !!(recOtp && Date.now() <= recOtp.expires && recOtp.code === verRaw);

    if (baru.length < 8) throw new Error('Kata sandi baru minimal 8 karakter.');
    const db = getDb();
    if (db.admin && db.admin.user === u) {
      const ok = otpValid || (kodeReset && ver === kodeReset);
      if (!ok) {
        catatGagal_(kg);
        throw new Error('Verifikasi gagal. Masukkan Kode OTP 6 digit dari Email Pemulihan Admin atau Kode Pemulihan Sekolah.');
      }
      setAdmin_(u, baru);
      recoveryCodes.delete(u);
      loginFailures.delete(kg);
      loginFailures.delete(kunciGagal_('admin', u));
      return { ok: true, pesan: 'Kata sandi Admin berhasil diatur ulang via pemulihan email. Silakan masuk dengan kata sandi baru.' };
    }

    const semua = baca_('Pengguna');
    const staf = semua.find(x => String(x.Username || '').trim().toLowerCase() === u);
    if (staf) {
      const namaStaf = String(staf.Nama || '').trim().toLowerCase();
      const ok = otpValid || (kodeReset && ver === kodeReset) || (namaStaf && ver === namaStaf);
      if (!ok) {
        catatGagal_(kg);
        throw new Error('Verifikasi gagal. Masukkan Kode OTP Email atau Nama Lengkap / Kode Pemulihan Sekolah.');
      }
      staf.Hash = hash_(staf.ID, baru);
      tulis_('Pengguna', semua);
      recoveryCodes.delete(u);
      loginFailures.delete(kg);
      loginFailures.delete(kunciGagal_('admin', u));
      return { ok: true, pesan: 'Kata sandi berhasil diatur ulang. Silakan masuk dengan kata sandi baru.' };
    }

    catatGagal_(kg);
    throw new Error('Nama pengguna tidak ditemukan.');
  },

  api_cekSesi(token: string) {
    const s = sesi_(token);
    return { role: s.role, nama: s.nama };
  },

  api_logout(token: string) {
    sessions.delete(token);
    if (detectStorageEngine().isVercelCloud && token) {
      queueWrite(() => deleteRemoteSession(token));
    }
    return true;
  },

  api_load(token: string, _segarkan?: boolean) {
    const st = staf_(token);
    const out: Record<string, any> = {};
    Object.keys(SKEMA).forEach(n => {
      if (!SHEET_TERKUNCI.includes(n)) out[n] = bacaIzin_(n, st.izin);
    });
    out.Pengaturan = pengaturan_();
    const akunRows = baca_('Akun');
    const pin = akunRows.map(a => a.SiswaID);
    const allowedIds = new Set(out.Siswa.map((s: any) => s.ID));
    out.punyaPIN = st.izin ? pin.filter(id => allowedIds.has(id)) : pin;
    const pinHashes: Record<string, string> = {};
    akunRows.forEach(a => {
      if (!st.izin || allowedIds.has(a.SiswaID)) pinHashes[a.SiswaID] = a.Hash;
    });
    out.pinHashes = pinHashes;
    out.peran = st.peran;
    out.userId = st.user ? st.user.ID : 'admin';
    out.kelasWali = st.izin ? st.wali : null;
    out.namaPengguna = st.nama || '';
    out.GuruList = baca_('Pengguna').map(u => {
      const p = perluas_(u);
      return {
        Nama: u.Nama,
        Mapel: u.Mapel,
        KelasWali: p.wali.join(','),
        KelasMengajar: p.mengajar.join(',')
      };
    });
    out.mapelSaya = st.user ? String(st.user.Mapel || '') : '';
    const admin = st.peran === 'admin';
    const db = getDb();
    out.adminUser = admin ? (db.admin?.user || '') : '';
    out.urlSheet = '';
    const storage = detectStorageEngine();
    out.storageEngine = storage.engine;
    out.storageLabel = storage.label;
    out.vercelConfigured = storage.isVercelCloud;
    if (admin) out.Pengguna = daftarPengguna_();
    return out;
  },

  api_saveSheet(token: string, nama: string, rows: Record<string, any>[]) {
    const st = staf_(token);
    if (!SKEMA[nama] || SHEET_TERKUNCI.includes(nama)) throw new Error('Sheet tidak dikenal: ' + nama);
    if (!bolehTulis_(st, nama)) throw new Error('Anda tidak punya izin mengubah data ini.');
    const tk = tulisKelas_(st, nama);
    rows = rows || [];
    if (st.izin && tk) rows = gabungIzin_(nama, rows, tk);
    if (nama === 'Jadwal') validasiJadwal_(rows as Record<string, string>[], baca_('Jadwal'));

    if (nama === 'Siswa') {
      // Enforce clean UPSERT by normalized NIS (keep latest entry if same NIS appears more than once)
      const byNisIdx = new Map<string, number>();
      const deduped: Record<string, any>[] = [];
      rows.forEach(s => {
        const nisKey = String(s.NIS || '').trim().toLowerCase();
        if (nisKey) {
          const prevIdx = byNisIdx.get(nisKey);
          if (prevIdx !== undefined) {
            deduped[prevIdx] = { ...deduped[prevIdx], ...s };
            return;
          }
          byNisIdx.set(nisKey, deduped.length);
        }
        deduped.push(s);
      });
      rows = deduped;
    }

    tulis_(nama, rows);

    if (nama === 'Siswa') {
      const ada: Record<string, boolean> = {};
      rows.forEach(s => (ada[s.ID] = true));
      tulis_('Akun', baca_('Akun').filter(a => ada[a.SiswaID]));
    } else if (nama === 'Kelas') {
      // Remove orphaned students & class-specific records when a class is deleted
      const validClassIds = new Set(rows.map(c => String(c.ID || '')));
      const sisaSiswa = baca_('Siswa').filter(s => validClassIds.has(String(s.Kelas || '')));
      tulis_('Siswa', sisaSiswa);
      const validSid = new Set(sisaSiswa.map(s => s.ID));
      tulis_('Akun', baca_('Akun').filter(a => validSid.has(a.SiswaID)));
      ['Absensi', 'Nilai', 'Perilaku', 'Checklist', 'DenahAtur', 'Denah', 'Piket', 'Struktur', 'Jadwal', 'JadwalAtur'].forEach(sheetName => {
        tulis_(sheetName, baca_(sheetName).filter(r => !r.Kelas || validClassIds.has(String(r.Kelas))));
      });
    }
    return true;
  },

  api_savePengaturan(token: string, obj: Record<string, string>) {
    sesi_(token, 'admin');
    tulis_(
      'Pengaturan',
      Object.keys(obj).map(k => ({ Kunci: k, Nilai: obj[k] }))
    );
    return true;
  },

  api_saveAbsensi(token: string, kelas: string, tanggal: string, recs: any[]) {
    const st = staf_(token);
    if (!tulisDi_(st, 'Absensi', kelas)) throw new Error('Anda tidak punya izin mengubah absensi kelas ini.');
    const semua = baca_('Absensi').filter(a => !(a.Kelas === kelas && a.Tanggal === tanggal));
    (recs || []).forEach(r =>
      semua.push({
        Kelas: kelas,
        Tanggal: tanggal,
        SiswaID: r.SiswaID,
        Kode: r.Kode,
        Keterangan: r.Keterangan || '',
        Sumber: ''
      })
    );
    tulis_('Absensi', semua);
    return true;
  },

  api_getPinHashes(token: string) {
    const st = staf_(token);
    const allowed = st.izin
      ? new Set(bacaIzin_('Siswa', st.izin).map(s => s.ID))
      : null;
    const out: Record<string, string> = {};
    baca_('Akun').forEach(a => {
      if (!allowed || allowed.has(a.SiswaID)) out[a.SiswaID] = a.Hash;
    });
    return out;
  },

  api_setPIN(token: string, sid: string, pin: string) {
    const st = staf_(token);
    const s = baca_('Siswa').find(x => x.ID === sid);
    if (!s) throw new Error('Siswa tidak ditemukan.');
    if (!bolehPIN_(st, s.Kelas))
      throw new Error('Anda tidak punya izin mengatur PIN siswa ini. Hanya wali kelas yang dapat melakukannya.');
    if (!String(s.NIS).trim()) throw new Error('Isi NIS siswa dulu (NIS dipakai sebagai nama pengguna).');
    pin = String(pin || '').trim();
    if (pin && !/^\d{4,8}$/.test(pin)) throw new Error('PIN harus 4-8 angka.');
    if (!pin) pin = pinAcak_();
    simpanAkun_([{ id: sid, pin }]);
    const nisKey = String(s.NIS || '').trim().toLowerCase();
    loginFailures.delete(kunciGagal_('siswa', nisKey));
    loginFailures.delete(kunciGagal_('admin', nisKey));
    return pin;
  },

  api_buatPINSemua(token: string, kelas: string, timpa: boolean, pinSeragam: string) {
    const st = staf_(token);
    if (kelas !== '__ALL__' && !bolehPIN_(st, kelas))
      throw new Error('Anda tidak punya izin mengatur PIN kelas ini. Hanya wali kelas yang dapat melakukannya.');
    if (kelas === '__ALL__' && st.izin && st.wali.length === 0)
      throw new Error('Anda tidak punya izin mengatur PIN kelas.');
    pinSeragam = String(pinSeragam || '').trim();
    if (pinSeragam && !/^\d{4,8}$/.test(pinSeragam)) throw new Error('PIN harus 4-8 angka.');
    const sudah: Record<string, boolean> = {};
    if (!timpa) baca_('Akun').forEach(a => (sudah[a.SiswaID] = true));
    const daftar: { id: string; pin: string }[] = [];
    const hasil: { id: string; nama: string; nis: string; pin: string }[] = [];
    let dilewati = 0;
    baca_('Siswa')
      .filter(s => {
        if (sudah[s.ID]) return false;
        if (kelas === '__ALL__') return bolehPIN_(st, s.Kelas);
        return s.Kelas === kelas;
      })
      .forEach(s => {
        if (!String(s.NIS).trim()) {
          dilewati++;
          return;
        }
        const pin = pinSeragam || pinAcak_();
        daftar.push({ id: s.ID, pin });
        hasil.push({ id: s.ID, nama: s.Nama, nis: s.NIS, pin });
        const nisKey = String(s.NIS || '').trim().toLowerCase();
        loginFailures.delete(kunciGagal_('siswa', nisKey));
        loginFailures.delete(kunciGagal_('admin', nisKey));
      });
    if (daftar.length) simpanAkun_(daftar);
    const pinHashes: Record<string, string> = {};
    baca_('Akun').forEach(a => {
      pinHashes[a.SiswaID] = a.Hash;
    });
    return { daftar: hasil, dilewati, pinHashes };
  },

  api_gantiAdmin(token: string, userBaru: string, passLama: string, passBaru: string) {
    sesi_(token, 'admin');
    const db = getDb();
    const curUser = db.admin?.user || '';
    if (!cekAdmin_(curUser, String(passLama || ''))) throw new Error('Kata sandi lama salah.');
    const user = String(userBaru || '').trim() || curUser;
    if (user.length < 3) throw new Error('Nama pengguna minimal 3 karakter.');
    passBaru = String(passBaru || '') || String(passLama);
    if (passBaru.length < 8) throw new Error('Kata sandi baru minimal 8 karakter.');
    setAdmin_(user, passBaru);
    return true;
  },

  api_simpanPengguna(token: string, d: any) {
    sesi_(token, 'admin');
    d = d || {};
    const nama = String(d.Nama || '').trim();
    const user = String(d.Username || '').trim().toLowerCase();
    let sandi = String(d.Sandi || '').trim();
    if (!nama) throw new Error('Nama wajib diisi.');
    if (user.length < 3) throw new Error('Nama pengguna minimal 3 karakter.');
    if (sandi && sandi.length < 8) throw new Error('Kata sandi minimal 8 karakter.');
    const db = getDb();
    if (user === db.admin?.user) throw new Error('Nama pengguna ini dipakai admin.');
    const ada = baca_('Kelas').map(k => k.ID);
    const valid = (ids: string[]) => (ids || []).filter((id, i, a) => ada.includes(id) && a.indexOf(id) === i);
    let kw = valid(d.KelasWali);
    let km = valid(d.KelasMengajar);
    if (d.KelasWali === undefined && d.KelasMengajar === undefined) {
      const k = valid(d.Kelas);
      if (d.Peran === 'wali') kw = k;
      else if (d.Peran === 'guru') km = k;
      else throw new Error('Peran tidak valid.');
    }
    if (!kw.length && !km.length) throw new Error('Pilih minimal satu kelas sebagai wali kelas atau guru mapel.');
    const peran = (kw.length ? ['wali'] : []).concat(km.length ? ['guru'] : []);
    const semuaKelas = kw.concat(km.filter(k => !kw.includes(k)));
    const adaMapel = baca_('Mapel').map(m => m.ID);
    const mapel = (d.Mapel || []).filter((id: string) => adaMapel.includes(id));

    const semua = baca_('Pengguna');
    if (semua.some(u => u.Username === user && u.ID !== d.ID)) throw new Error('Nama pengguna sudah dipakai.');
    let u = d.ID ? semua.find(x => x.ID === d.ID) : null;
    let tampil = '';
    if (!u) {
      u = { ID: uidShort(), Nama: '', Username: '', Peran: '', Kelas: '', Hash: '', Mapel: '', KelasWali: '', KelasMengajar: '' };
      semua.push(u);
      if (!sandi) sandi = sandiAcak_();
    }
    if (sandi) {
      u.Hash = hash_(u.ID, sandi);
      tampil = sandi;
    }
    Object.assign(u, {
      Nama: nama,
      Username: user,
      Peran: peran.join(','),
      Kelas: semuaKelas.join(','),
      KelasWali: kw.join(','),
      KelasMengajar: km.join(','),
      Mapel: mapel.join(',')
    });
    tulis_('Pengguna', semua);
    return { daftar: daftarPengguna_(), sandi: tampil, username: user };
  },

  api_hapusPengguna(token: string, id: string) {
    sesi_(token, 'admin');
    tulis_('Pengguna', baca_('Pengguna').filter(u => u.ID !== id));
    return daftarPengguna_();
  },

  api_resetSandiPengguna(token: string, id: string, sandi: string) {
    sesi_(token, 'admin');
    sandi = String(sandi || '').trim() || sandiAcak_();
    if (sandi.length < 8) throw new Error('Kata sandi minimal 8 karakter.');
    const semua = baca_('Pengguna');
    const u = semua.find(x => x.ID === id);
    if (!u) throw new Error('Pengguna tidak ditemukan.');
    u.Hash = hash_(u.ID, sandi);
    tulis_('Pengguna', semua);
    return { sandi, username: u.Username };
  },

  api_setMapelSaya(token: string, ids: string[]) {
    const s = sesi_(token, 'staf');
    const ada = baca_('Mapel').map(m => m.ID);
    const pilih = (ids || []).filter(id => ada.includes(id));
    const semua = baca_('Pengguna');
    const u = semua.find(x => x.ID === s.sid);
    if (!u) throw new Error('SESI_HABIS');
    u.Mapel = pilih.join(',');
    tulis_('Pengguna', semua);
    return pilih.join(',');
  },

  api_gantiSandiSaya(token: string, lama: string, baru: string) {
    const s = sesi_(token, 'staf');
    baru = String(baru || '');
    if (baru.length < 8) throw new Error('Kata sandi baru minimal 8 karakter.');
    const semua = baca_('Pengguna');
    const u = semua.find(x => x.ID === s.sid);
    if (!u || u.Hash !== hash_(u.ID, String(lama || ''))) throw new Error('Kata sandi lama salah.');
    u.Hash = hash_(u.ID, baru);
    tulis_('Pengguna', semua);
    return true;
  },

  api_loadSiswa(token: string) {
    const sesi = sesi_(token, 'siswa');
    const siswa = baca_('Siswa').find(x => x.ID === sesi.sid);
    if (!siswa) throw new Error('SESI_HABIS');
    const kelas = baca_('Kelas').find(k => k.ID === siswa.Kelas) || { ID: '', Nama: '', Jurusan: '', Mapel: '' };
    const absKelas = baca_('Absensi').filter(a => a.Kelas === siswa.Kelas);
    const tanggal: Record<string, boolean> = {};
    absKelas.forEach(a => (tanggal[a.Tanggal] = true));
    const tugas = baca_('Tugas').filter(t => t.Kelas === siswa.Kelas);
    const pg = baca_('Pengumpulan').filter(p => p.SiswaID === siswa.ID);
    const set = pengaturan_();
    const nm: Record<string, string> = {};
    baca_('Siswa')
      .filter(s => s.Kelas === siswa.Kelas)
      .forEach(s => (nm[s.ID] = s.Nama));
    const atur = baca_('DenahAtur').find(a => a.Kelas === siswa.Kelas) || { Baris: '4', Kolom: '4', Grup: '2' };
    const denah = {
      Baris: atur.Baris,
      Kolom: atur.Kolom,
      Grup: atur.Grup,
      kursi: baca_('Denah')
        .filter(d => d.Kelas === siswa.Kelas && nm[d.SiswaID])
        .map(d => ({
          Baris: d.Baris,
          Kolom: d.Kolom,
          Nama: nm[d.SiswaID],
          Saya: d.SiswaID === siswa.ID
        }))
    };
    const piket = baca_('Piket')
      .filter(p => p.Kelas === siswa.Kelas && nm[p.SiswaID])
      .map(p => ({
        Hari: p.Hari,
        Tugas: p.Tugas,
        Nama: nm[p.SiswaID],
        Saya: p.SiswaID === siswa.ID
      }));
    const struktur = baca_('Struktur')
      .filter(s => s.Kelas === siswa.Kelas)
      .map(s => ({
        Jabatan: s.Jabatan,
        Tingkat: s.Tingkat,
        Nama: nm[s.SiswaID] || '',
        Saya: s.SiswaID === siswa.ID
      }));
    const jadwal = baca_('Jadwal')
      .filter(j => j.Kelas === siswa.Kelas)
      .map(j => ({
        Hari: j.Hari,
        Mulai: j.Mulai,
        Selesai: j.Selesai,
        Mapel: j.Mapel,
        Guru: j.Guru,
        Jenis: j.Jenis,
        Pekan: j.Pekan
      }));
    let jurusanLogo = '';
    try {
      const logoMap = JSON.parse(set.jurusanLogos || '{}');
      if (kelas.Jurusan && logoMap && typeof logoMap[kelas.Jurusan] === 'string') {
        jurusanLogo = logoMap[kelas.Jurusan];
      }
    } catch (_) {}
    const mapelNamaById = new Map<string, string>(baca_('Mapel').map(m => [m.ID, m.Nama]));
    const teachers = baca_('Pengguna')
      .map(u => {
        const p = perluas_(u);
        const teachesClass = p.wali.includes(siswa.Kelas) || p.mengajar.includes(siswa.Kelas);
        if (!teachesClass) return null;
        const mNames = String(u.Mapel || '')
          .split(',')
          .map(id => mapelNamaById.get(id.trim()) || id.trim())
          .filter(Boolean)
          .join(', ');
        return {
          id: u.ID,
          nama: u.Nama,
          peran: p.wali.includes(siswa.Kelas) ? 'wali' : 'guru',
          mapel: mNames || (p.wali.includes(siswa.Kelas) ? 'Wali Kelas' : 'Guru')
        };
      })
      .filter(Boolean);
    if (teachers.length === 0) {
      teachers.push({
        id: 'admin',
        nama: waliKelas_(siswa.Kelas) || set.wali || set.guru || 'Guru / Admin Sekolah',
        peran: 'wali',
        mapel: 'Wali Kelas'
      });
    }
    return {
      siswa: {
        ID: siswa.ID,
        Nama: siswa.Nama,
        NIS: siswa.NIS,
        TempatLahir: siswa.TempatLahir || '',
        TanggalLahir: siswa.TanggalLahir || '',
        JenisKelamin: siswa.JenisKelamin || '',
        Alamat: siswa.Alamat || '',
        NoSiswa: siswa.NoSiswa || siswa.KontakOrtu || '',
        NoOrtu: siswa.NoOrtu || '',
        Kesehatan: siswa.Kesehatan || '',
        Foto: siswa.Foto || ''
      },
      kelasId: siswa.Kelas || '',
      kelas: kelas.Nama || '',
      jurusan: kelas.Jurusan || '',
      jurusanLogo,
      mapel: kelas.Mapel || '',
      sekolah: set.sekolah,
      logo: set.logo || '',
      waInfo: set.waInfo || '',
      semester: set.semester,
      wali: waliKelas_(siswa.Kelas) || set.wali,
      guru: set.guru,
      teachers,
      denah,
      piket,
      struktur,
      jadwal,
      sekretaris: baca_('Struktur').some(
        j => j.Kelas === siswa.Kelas && j.SiswaID === siswa.ID && /sekretaris/i.test(j.Jabatan)
      ),
      sistemJadwal: (baca_('JadwalAtur').find(a => a.Kelas === siswa.Kelas) || {}).Sistem || 'reguler',
      mulaiSemester: set.mulai,
      akademik: baca_('Akademik').map(a => ({
        Mulai: a.Mulai,
        Selesai: a.Selesai,
        Kegiatan: a.Kegiatan,
        Jenis: a.Jenis,
        Sumber: a.Sumber || ''
      })),
      pengaturan: {
        kkm: set.kkm,
        b_sikap: set.b_sikap,
        b_tugas: set.b_tugas,
        b_proyek: set.b_proyek,
        b_uts: set.b_uts,
        b_uas: set.b_uas
      },
      totalPertemuan: Object.keys(tanggal).length,
      absensi: absKelas
        .filter(a => a.SiswaID === siswa.ID)
        .map(a => ({ Tanggal: a.Tanggal, Kode: a.Kode, Keterangan: a.Keterangan })),
      tugas: tugas.map(t => {
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
      nilai: baca_('Nilai').find(n => n.Kelas === siswa.Kelas && n.SiswaID === siswa.ID) || null,
      cbtList: baca_('CBT')
        .filter(c => c.Kelas === siswa.Kelas && (c.Status === 'Aktif' || c.Status === 'Selesai'))
        .map(c => {
          let soalObj: any = { soalPG: [], soalUraian: [] };
          try { soalObj = JSON.parse(c.SoalJSON || '{}'); } catch (_) {}
          const hasil = baca_('HasilCBT').find(h => h.CBTID === c.ID && h.SiswaID === siswa.ID) || null;
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
              sudahSelesai
                ? q
                : {
                    id: q.id,
                    pertanyaan: q.pertanyaan,
                    opsiA: q.opsiA,
                    opsiB: q.opsiB,
                    opsiC: q.opsiC,
                    opsiD: q.opsiD,
                    opsiE: q.opsiE
                  }
            ),
            soalUraian: (soalObj.soalUraian || []).map((q: any) =>
              sudahSelesai
                ? q
                : {
                    id: q.id,
                    pertanyaan: q.pertanyaan,
                    poinMaksimal: q.poinMaksimal
                  }
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
              const resolved = mapelNamaById.get(tok) || tok;
              if (resolved) classMapelSet.add(resolved.toLowerCase());
            });
        } else {
          jadwal.forEach((j: any) => {
            const clean = String(j.Mapel || '').trim().toLowerCase();
            if (clean && clean !== 'istirahat') classMapelSet.add(clean);
          });
          tugas.forEach((t: any) => {
            const clean = String(t.Mapel || '').trim().toLowerCase();
            if (clean) classMapelSet.add(clean);
          });
          baca_('Pengguna').forEach(u => {
            const p = perluas_(u);
            if (!p.wali.includes(siswa.Kelas) && !p.mengajar.includes(siswa.Kelas)) return;
            String(u.Mapel || '')
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)
              .forEach(tok => {
                const resolved = mapelNamaById.get(tok) || tok;
                if (resolved) classMapelSet.add(resolved.toLowerCase());
              });
          });
        }

        const allMateri = baca_('Materi');
        const siswaTingkatan = ekstrakTingkatanKelas_(kelas.Nama || '');
        const matchingMateri = allMateri.filter((m: any) => {
          const kRaw = String(m.Kelas || '').trim();
          const mMapel = String(m.Mapel || '').trim().toLowerCase();
          if (kRaw.startsWith('__TINGKAT__:')) {
            const reqLvl = kRaw.slice('__TINGKAT__:'.length).trim().toUpperCase();
            if (!reqLvl || !siswaTingkatan || siswaTingkatan !== reqLvl) return false;
            if (explicitRaw === '__NONE__') return false;
            if (!mMapel || mMapel === 'umum') return true;
            if (explicitRaw) return classMapelSet.size === 0 || classMapelSet.has(mMapel);
            return true;
          }
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
  },

  api_absensiKelas(token: string, tanggal: string) {
    const s = wajibSekretaris_(token);
    tanggal = tanggalSekretaris_(tanggal);
    const rec = baca_('Absensi').filter(a => a.Kelas === s.Kelas && a.Tanggal === tanggal);
    return {
      tanggal,
      siswa: baca_('Siswa')
        .filter(x => x.Kelas === s.Kelas)
        .sort((a, b) => a.Nama.localeCompare(b.Nama))
        .map(x => ({ ID: x.ID, Nama: x.Nama })),
      catatan: rec.map(a => ({ SiswaID: a.SiswaID, Kode: a.Kode, Keterangan: a.Keterangan })),
      terkunci: rec.some(a => a.Sumber !== 'sekretaris')
    };
  },

  api_simpanAbsensiSekretaris(token: string, tanggal: string, recs: any[]) {
    const s = wajibSekretaris_(token);
    tanggal = tanggalSekretaris_(tanggal);
    const semua = baca_('Absensi');
    const lama = semua.filter(a => a.Kelas === s.Kelas && a.Tanggal === tanggal);
    if (lama.some(a => a.Sumber !== 'sekretaris'))
      throw new Error('Absensi tanggal ini sudah diisi atau dikonfirmasi guru, sehingga tidak bisa diubah dari akun siswa.');
    const anggota: Record<string, boolean> = {};
    baca_('Siswa').forEach(x => {
      if (x.Kelas === s.Kelas) anggota[x.ID] = true;
    });
    const dipakai: Record<string, boolean> = {};
    const baru: Record<string, string>[] = [];
    (recs || []).forEach(r => {
      if (!anggota[r.SiswaID] || dipakai[r.SiswaID] || !KODE_ABSEN_.includes(r.Kode)) return;
      dipakai[r.SiswaID] = true;
      baru.push({
        Kelas: s.Kelas,
        Tanggal: tanggal,
        SiswaID: r.SiswaID,
        Kode: r.Kode,
        Keterangan: String(r.Keterangan || '').slice(0, 200),
        Sumber: 'sekretaris'
      });
    });
    tulis_(
      'Absensi',
      semua.filter(a => !(a.Kelas === s.Kelas && a.Tanggal === tanggal)).concat(baru)
    );
    return baru.length;
  },

  api_gantiPIN(token: string, lama: string, baru: string) {
    const sesi = sesi_(token, 'siswa');
    const lamaTrim = String(lama || '').trim();
    baru = String(baru || '').trim();
    if (!/^\d{4,8}$/.test(baru)) throw new Error('PIN baru harus 4-8 angka.');
    const a = baca_('Akun').find(x => x.SiswaID === sesi.sid);
    if (!a || (a.Hash !== hash_(sesi.sid, String(lama || '')) && a.Hash !== hash_(sesi.sid, lamaTrim))) {
      throw new Error('PIN lama salah.');
    }
    simpanAkun_([{ id: sesi.sid, pin: baru }]);
    return true;
  },

  api_updateProfilSiswa(
    token: string,
    payload: {
      Nama?: string;
      TempatLahir?: string;
      TanggalLahir?: string;
      JenisKelamin?: string;
      Alamat?: string;
      NoSiswa?: string;
      NoOrtu?: string;
      Kesehatan?: string;
      Foto?: string;
    }
  ) {
    const sesi = sesi_(token, 'siswa');
    const semua = baca_('Siswa');
    const idx = semua.findIndex(x => x.ID === sesi.sid);
    if (idx < 0) throw new Error('Data siswa tidak ditemukan.');
    const cur = semua[idx];
    const namaClean = String(payload?.Nama ?? cur.Nama ?? '').trim().slice(0, 120);
    const jkRaw = String(payload?.JenisKelamin ?? cur.JenisKelamin ?? '').trim();
    const jkNorm =
      jkRaw === 'L' || jkRaw.toLowerCase() === 'laki-laki'
        ? 'Laki-laki'
        : jkRaw === 'P' || jkRaw.toLowerCase() === 'perempuan'
        ? 'Perempuan'
        : '';
    const fotoRaw = payload?.Foto !== undefined ? String(payload.Foto || '').trim() : String(cur.Foto || '').trim();
    const fotoSafe =
      /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(fotoRaw) && fotoRaw.length <= 450000
        ? fotoRaw
        : /^https?:\/\/\S+$/i.test(fotoRaw) && fotoRaw.length <= 600
        ? fotoRaw
        : '';
    semua[idx] = {
      ...cur,
      Nama: namaClean || cur.Nama,
      TempatLahir: String(payload?.TempatLahir ?? cur.TempatLahir ?? '').trim().slice(0, 80),
      TanggalLahir: String(payload?.TanggalLahir ?? cur.TanggalLahir ?? '').trim().slice(0, 20),
      JenisKelamin: jkNorm,
      Alamat: String(payload?.Alamat ?? cur.Alamat ?? '').trim().slice(0, 250),
      NoSiswa: String(payload?.NoSiswa ?? cur.NoSiswa ?? '').trim().slice(0, 30),
      NoOrtu: String(payload?.NoOrtu ?? cur.NoOrtu ?? '').trim().slice(0, 30),
      Kesehatan: String(payload?.Kesehatan ?? cur.Kesehatan ?? '').trim().slice(0, 120),
      Foto: fotoSafe
    };
    tulis_('Siswa', semua);
    if (namaClean && namaClean !== sesi.nama) {
      sesi.nama = namaClean;
      if (detectStorageEngine().isVercelCloud) {
        queueWrite(() => saveRemoteSession(token, sesi));
      }
    }
    const upd = semua[idx];
    return {
      ID: upd.ID,
      Nama: upd.Nama,
      NIS: upd.NIS,
      TempatLahir: upd.TempatLahir || '',
      TanggalLahir: upd.TanggalLahir || '',
      JenisKelamin: upd.JenisKelamin || '',
      Alamat: upd.Alamat || '',
      NoSiswa: upd.NoSiswa || '',
      NoOrtu: upd.NoOrtu || '',
      Kesehatan: upd.Kesehatan || '',
      Foto: upd.Foto || ''
    };
  },

  api_resetDemo(token: string) {
    sesi_(token, 'admin');
    dbCache = createSeedDatabase();
    saveDb();
    return true;
  },

  api_resetAllData(
    token: string,
    opts?: {
      resetKelas?: boolean;
      resetMapel?: boolean;
      resetPengguna?: boolean;
      resetPengaturan?: boolean;
    }
  ) {
    sesi_(token, 'admin');
    const db = getDb();
    const o = opts || {};
    const operationalSheets = [
      'Siswa',
      'Absensi',
      'Tugas',
      'Pengumpulan',
      'Nilai',
      'Perilaku',
      'Checklist',
      'DenahAtur',
      'Denah',
      'Piket',
      'Struktur',
      'Jadwal',
      'JadwalAtur',
      'Akademik',
      'TP',
      'Modul',
      'Pemantik',
      'Materi',
      'BerkasCloud',
      'CBT',
      'HasilCBT',
      'Akun',
      'Pesan'
    ];
    for (const s of operationalSheets) {
      db.sheets[s] = [];
    }
    if (o.resetKelas) db.sheets.Kelas = [];
    if (o.resetMapel) db.sheets.Mapel = [];
    if (o.resetPengguna) db.sheets.Pengguna = [];
    if (o.resetPengaturan) {
      db.sheets.Pengaturan = Object.entries(PENGATURAN_AWAL).map(([Kunci, Nilai]) => ({ Kunci, Nilai }));
    }
    // Clear uploaded files on disk & remote Vercel DB
    for (const dir of [CLOUD_DIR, TUGAS_DIR, AJAR_DIR]) {
      try {
        if (fs.existsSync(dir)) {
          for (const f of fs.readdirSync(dir)) {
            try { fs.unlinkSync(path.join(dir, f)); } catch (_) {}
          }
        }
      } catch (_) {}
    }
    if (detectStorageEngine().isVercelCloud) {
      queueWrite(() => clearAllRemoteFiles());
    }
    saveDb();
    return true;
  },

  api_resetPartial(token: string, category: string) {
    sesi_(token, 'admin');
    const db = getDb();
    const map: Record<string, string[]> = {
      absensi: ['Absensi'],
      nilai_tugas: ['Tugas', 'Pengumpulan', 'Nilai'],
      cbt: ['CBT', 'HasilCBT'],
      operasional_kelas: ['DenahAtur', 'Denah', 'Piket', 'Struktur', 'Jadwal', 'JadwalAtur'],
      perangkat_ajar: ['TP', 'Modul', 'Pemantik', 'Materi'],
      kalender: ['Akademik', 'Checklist'],
      siswa: ['Siswa', 'Akun']
    };
    const targets = map[category];
    if (!targets) throw new Error('Kategori reset tidak dikenal.');
    for (const s of targets) {
      db.sheets[s] = [];
    }
    saveDb();
    return targets;
  },

  async api_exportBackup(token: string, opts?: { includeFiles?: boolean }) {
    sesi_(token, 'admin');
    const db = getDb();
    const storage = detectStorageEngine();
    const set = pengaturan_();
    const includeFiles = opts?.includeFiles !== false;
    const files: {
      id: string;
      kind: string;
      filename: string;
      mime: string;
      contentBase64: string;
      textSidecar?: string;
    }[] = [];

    if (includeFiles) {
      const seen = new Set<string>();
      const tryAddDiskOrRemote = async (
        id: string,
        kind: 'cloud' | 'tugas' | 'ajar',
        fallbackName: string,
        fallbackMime = 'application/octet-stream',
        cloudPath?: string
      ) => {
        if (!id || seen.has(id)) return;
        seen.add(id);
        let contentBase64 = '';
        let filename = fallbackName || id;
        let mime = fallbackMime;
        let textSidecar = '';

        const dir = kind === 'cloud' ? CLOUD_DIR : kind === 'ajar' ? AJAR_DIR : TUGAS_DIR;
        if (kind === 'cloud' && cloudPath) {
          const full = path.join(CLOUD_DIR, cloudPath);
          if (fs.existsSync(full)) {
            contentBase64 = fs.readFileSync(full).toString('base64');
            if (fs.existsSync(full + '.txt')) {
              textSidecar = fs.readFileSync(full + '.txt', 'utf8');
            }
          }
        } else if (fs.existsSync(dir)) {
          const match = fs.readdirSync(dir).find(f => f.startsWith(id + '__'));
          if (match) {
            contentBase64 = fs.readFileSync(path.join(dir, match)).toString('base64');
            filename = match.slice((id + '__').length) || filename;
          }
        }

        if (!contentBase64 && storage.isVercelCloud) {
          try {
            const remote = await loadRemoteFile(id);
            if (remote) {
              contentBase64 = remote.contentBase64;
              filename = remote.filename || filename;
              mime = remote.mime || mime;
              textSidecar = remote.textSidecar || '';
            }
          } catch (_) {}
        }

        if (contentBase64) {
          files.push({ id, kind, filename, mime, contentBase64, textSidecar });
        }
      };

      for (const r of db.sheets.BerkasCloud || []) {
        await tryAddDiskOrRemote(r.ID, 'cloud', r.NamaFile, r.TipeMime || 'application/octet-stream', r.PathSimpan);
      }
      for (const r of db.sheets.Tugas || []) {
        await tryAddDiskOrRemote(r.FileID, 'tugas', r.NamaFile);
      }
      for (const r of db.sheets.Pengumpulan || []) {
        await tryAddDiskOrRemote(r.FileID, 'tugas', r.NamaFile);
      }
      for (const r of db.sheets.TP || []) {
        await tryAddDiskOrRemote(r.FileID, 'ajar', r.NamaFile);
      }
      for (const r of db.sheets.Modul || []) {
        await tryAddDiskOrRemote(r.FileID, 'ajar', r.NamaFile);
      }
    }

    return {
      format: 'kelasku-backup',
      version: 1,
      createdAt: new Date().toISOString(),
      sekolah: set.sekolah || 'KelasKU',
      storageEngine: storage.engine,
      storageLabel: storage.label,
      data: {
        admin: db.admin,
        sheets: db.sheets
      },
      files
    };
  },

  async api_restoreBackup(
    token: string,
    backup: any,
    opts?: { keepCurrentAdmin?: boolean }
  ) {
    sesi_(token, 'admin');
    if (!backup || typeof backup !== 'object') {
      throw new Error('Format berkas backup tidak valid.');
    }
    const rawData =
      backup.format === 'kelasku-backup' && backup.data
        ? backup.data
        : backup.sheets
          ? backup
          : backup.data?.sheets
            ? backup.data
            : null;
    if (!rawData || typeof rawData.sheets !== 'object') {
      throw new Error('Berkas backup tidak memiliki struktur data tabel KelasKU.');
    }

    const currentDb = getDb();
    const keepAdmin = opts?.keepCurrentAdmin !== false;
    const restoredNormalized = normalizeLoadedDb({
      admin:
        keepAdmin || !rawData.admin?.hash
          ? currentDb.admin
          : rawData.admin,
      sheets: rawData.sheets
    });

    dbCache = restoredNormalized;
    saveDb();

    let filesRestored = 0;
    const files = Array.isArray(backup.files) ? backup.files : [];
    const storage = detectStorageEngine();
    for (const f of files) {
      if (!f || !f.id || !f.contentBase64) continue;
      const safeId = String(f.id).replace(/[^a-zA-Z0-9_-]/g, '');
      const cleanName = String(f.filename || 'lampiran').replace(/[^a-zA-Z0-9._-]/g, '_');
      const kind = f.kind === 'cloud' ? 'cloud' : f.kind === 'ajar' ? 'ajar' : 'tugas';
      const dir = kind === 'cloud' ? CLOUD_DIR : kind === 'ajar' ? AJAR_DIR : TUGAS_DIR;
      try {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const diskName = kind === 'cloud' ? `${safeId}_${cleanName}` : `${safeId}__${cleanName}`;
        fs.writeFileSync(path.join(dir, diskName), Buffer.from(String(f.contentBase64), 'base64'));
        if (kind === 'cloud' && f.textSidecar) {
          fs.writeFileSync(path.join(dir, diskName + '.txt'), String(f.textSidecar), 'utf8');
        }
      } catch (_) {}
      if (storage.isVercelCloud) {
        await saveRemoteFile({
          id: safeId,
          kind,
          filename: String(f.filename || cleanName),
          mime: String(f.mime || 'application/octet-stream'),
          contentBase64: String(f.contentBase64),
          textSidecar: f.textSidecar ? String(f.textSidecar) : undefined
        });
      }
      filesRestored++;
    }

    return {
      restoredAt: new Date().toISOString(),
      filesRestored,
      kelasCount: (restoredNormalized.sheets.Kelas || []).length,
      siswaCount: (restoredNormalized.sheets.Siswa || []).length
    };
  },

  async api_listBackups(token: string) {
    sesi_(token, 'admin');
    const list = await readBackupsStorage();
    return list.map(({ data: _d, ...meta }) => meta);
  },

  async api_createBackupSnapshot(token: string, label?: string) {
    sesi_(token, 'admin');
    const db = getDb();
    const list = await readBackupsStorage();
    const storage = detectStorageEngine();
    const snap = {
      id: 'bak_' + uidShort(),
      createdAt: new Date().toISOString(),
      label: String(label || '').trim() || 'Snapshot Manual',
      storageLabel: storage.label,
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
    const next = [snap, ...list].slice(0, 5);
    await writeBackupsStorage(next);
    return next.map(({ data: _d, ...meta }) => meta);
  },

  async api_getBackupSnapshot(token: string, snapshotId: string) {
    sesi_(token, 'admin');
    const list = await readBackupsStorage();
    const snap = list.find(s => s.id === snapshotId);
    if (!snap) throw new Error('Snapshot backup tidak ditemukan.');
    return {
      format: 'kelasku-backup',
      version: 1,
      createdAt: snap.createdAt,
      label: snap.label,
      storageLabel: snap.storageLabel,
      data: {
        admin: null,
        sheets: snap.data?.sheets || {}
      },
      files: []
    };
  },

  async api_restoreBackupSnapshot(token: string, snapshotId: string) {
    sesi_(token, 'admin');
    const list = await readBackupsStorage();
    const snap = list.find(s => s.id === snapshotId);
    if (!snap || !snap.data?.sheets) throw new Error('Snapshot backup tidak ditemukan.');
    const currentDb = getDb();
    dbCache = normalizeLoadedDb({
      admin: currentDb.admin,
      sheets: snap.data.sheets
    });
    saveDb();
    return true;
  },

  async api_deleteBackupSnapshot(token: string, snapshotId: string) {
    sesi_(token, 'admin');
    const list = await readBackupsStorage();
    const next = list.filter(s => s.id !== snapshotId);
    await writeBackupsStorage(next);
    return next.map(({ data: _d, ...meta }) => meta);
  }
};

async function readBackupsStorage(): Promise<any[]> {
  if (detectStorageEngine().isVercelCloud) {
    try {
      const remote = await loadRemoteBackups<any[]>();
      if (Array.isArray(remote)) return remote;
    } catch (_) {}
  }
  try {
    if (fs.existsSync(BACKUPS_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(BACKUPS_PATH, 'utf8'));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) {}
  return [];
}

async function writeBackupsStorage(list: any[]): Promise<void> {
  try {
    const dir = path.dirname(BACKUPS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(BACKUPS_PATH, JSON.stringify(list, null, 2), 'utf8');
  } catch (_) {}
  if (detectStorageEngine().isVercelCloud) {
    await saveRemoteBackups(list);
  }
}

async function startServer() {
  const app = express();
  const PORT = process.env.NODE_ENV === 'production' ? Number(process.env.PORT) || 3000 : 3000;

  app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' }));
  app.use(express.json({ limit: '50mb' }));
  app.use((err: any, req: any, res: any, next: any) => {
    if (req.path.startsWith('/api/') || err) {
      if (err?.type === 'entity.too.large' || err?.status === 413) {
        res.status(413).json({ ok: false, error: 'Ukuran data atau berkas melebihi batas 50 MB.' });
        return;
      }
      if (err instanceof SyntaxError && 'body' in err) {
        res.status(400).json({ ok: false, error: 'Format payload JSON tidak valid.' });
        return;
      }
      if (err) {
        res.status(err.status || 500).json({ ok: false, error: err.message || 'Kesalahan server internal.' });
        return;
      }
    }
    next();
  });

  // Hydrate Vercel DB state and active session token on every /api/* request
  app.use('/api', async (req, res, next) => {
    try {
      await ensureDbLoaded();
      const headerToken = typeof req.headers['x-ajar-token'] === 'string' ? req.headers['x-ajar-token'] : '';
      const bodyToken =
        headerToken ||
        (typeof (req.body as any)?.token === 'string'
          ? (req.body as any).token
          : Array.isArray((req.body as any)?.args) && typeof (req.body as any).args[0] === 'string'
          ? (req.body as any).args[0]
          : '');
      if (bodyToken && !sessions.has(bodyToken) && detectStorageEngine().isVercelCloud) {
        const remoteSess = await loadRemoteSession(bodyToken);
        if (remoteSess && Date.now() <= remoteSess.expires) {
          sessions.set(bodyToken, remoteSess);
        }
      }
      next();
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || 'Gagal menghubungkan database Vercel.' });
    }
  });

  app.post('/api/rpc', async (req, res) => {
    try {
      const { fn, args } = req.body || {};
      if (!fn || typeof rpcMethods[fn] !== 'function') {
        res.status(400).json({ ok: false, error: 'Metode API tidak ditemukan: ' + fn });
        return;
      }
      const result = await rpcMethods[fn](...(Array.isArray(args) ? args : []));
      await flushWrites();
      res.json({ ok: true, data: result });
    } catch (e: any) {
      res.status(200).json({ ok: false, error: e?.message || String(e) });
    }
  });

  // Sync & Auto-Update Jawa Barat Education Calendar (with optional Gemini Search Grounding)
  app.post('/api/kaldik/sync-jabar', async (req, res) => {
    try {
      const { token, tahunAjaran, useAi } = req.body || {};
      staf_(token);
      const ta = String(tahunAjaran || KALDIK_JABAR_REF.tahunAjaran).trim();
      let jabarEvents = getKaldikJabarEvents(ta);
      let sourceNote = `${KALDIK_JABAR_REF.dasarSurat} (${ta})`;

      if (useAi && process.env.GEMINI_API_KEY) {
        try {
          const aiClient = getAiClient();
          const aiResp = await aiClient.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: `Susun daftar agenda utama Kalender Pendidikan Provinsi Jawa Barat Tahun Ajaran ${ta} berdasarkan pedoman resmi Dinas Pendidikan Provinsi Jawa Barat (Hari Pertama Masuk Sekolah, MPLS, PTS/STS Ganjil & Genap, SAS Ganjil, Pembagian Rapor Ganjil & Genap, Libur Semester, Libur Akhir Tahun, serta Hari Libur Nasional utama). Kembalikan JSON valid.`,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              tools: [{ googleSearch: {} }],
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  catatanSumber: { type: Type.STRING },
                  agenda: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        mulai: { type: Type.STRING, description: 'Format YYYY-MM-DD' },
                        selesai: { type: Type.STRING, description: 'Format YYYY-MM-DD' },
                        kegiatan: { type: Type.STRING },
                        jenis: {
                          type: Type.STRING,
                          description: 'Pilih salah satu: Kegiatan belajar, Ujian, Rapor, Kegiatan sekolah, Libur, Lainnya'
                        }
                      },
                      required: ['mulai', 'selesai', 'kegiatan', 'jenis']
                    }
                  }
                },
                required: ['agenda']
              }
            }
          });
          const parsed = JSON.parse((aiResp.text ?? '{}').trim());
          if (Array.isArray(parsed.agenda) && parsed.agenda.length >= 6) {
            const validJenis = ['Kegiatan belajar', 'Ujian', 'Rapor', 'Kegiatan sekolah', 'Libur', 'Lainnya'];
            jabarEvents = parsed.agenda
              .filter((x: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(x.mulai || '')))
              .map((x: any, i: number) => ({
                ID: `jabar_${ta.replace(/[^0-9]/g, '_')}_${i + 1}`,
                Mulai: String(x.mulai),
                Selesai: /^\d{4}-\d{2}-\d{2}$/.test(String(x.selesai || '')) ? String(x.selesai) : String(x.mulai),
                Kegiatan: String(x.kegiatan || '').slice(0, 250),
                Jenis: validJenis.includes(x.jenis) ? x.jenis : 'Kegiatan sekolah',
                Sumber: `Kaldik Disdik Jabar ${ta} (AI + Web)`
              }));
            if (parsed.catatanSumber) sourceNote = String(parsed.catatanSumber);
          }
        } catch (aiErr) {
          console.warn('Kaldik AI search fallback to local Disdik Jabar dataset:', aiErr);
        }
      }

      // Merge Jabar events while preserving custom school events
      const existing = baca_('Akademik');
      const customEvents = existing.filter(
        ev => !String(ev.ID).startsWith('jabar_') && !String(ev.Sumber || '').includes('Jabar')
      );
      const merged = [...jabarEvents, ...customEvents].sort((a, b) =>
        (a.Mulai || '').localeCompare(b.Mulai || '')
      );
      tulis_('Akademik', merged);

      const now = new Date();
      const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const curSet = pengaturan_();
      curSet.kaldikTahunAjaran = ta;
      curSet.kaldikWilayah = KALDIK_JABAR_REF.wilayah;
      curSet.kaldikLastSync = stamp;
      tulis_(
        'Pengaturan',
        Object.keys(curSet).map(k => ({ Kunci: k, Nilai: curSet[k] }))
      );

      await flushWrites();
      res.json({
        ok: true,
        data: {
          akademik: merged,
          pengaturan: curSet,
          addedCount: jabarEvents.length,
          sourceNote
        }
      });
    } catch (e: any) {
      res.status(200).json({ ok: false, error: e?.message || String(e) });
    }
  });

  // Cloud Vault Upload Endpoint
  app.post('/api/cloud/upload', async (req, res) => {
    try {
      const { token, kelas, namaFile, tipeMime, ukuran, base64Data, teksEkstrak } = req.body || {};
      const s = sesi_(token);
      if (!namaFile || !base64Data) {
        res.status(400).json({ ok: false, error: 'Data berkas tidak lengkap.' });
        return;
      }

      const id = 'cld_' + uidShort();
      const safeName = String(namaFile).replace(/[^a-zA-Z0-9._-]/g, '_');
      const storedFileName = `${id}_${safeName}`;
      const fullPath = path.join(CLOUD_DIR, storedFileName);
      const buffer = Buffer.from(base64Data, 'base64');

      try {
        if (!fs.existsSync(CLOUD_DIR)) {
          fs.mkdirSync(CLOUD_DIR, { recursive: true });
        }
        fs.writeFileSync(fullPath, buffer);
        if (teksEkstrak) {
          fs.writeFileSync(fullPath + '.txt', String(teksEkstrak), 'utf8');
        }
      } catch (_) {}

      if (detectStorageEngine().isVercelCloud) {
        await saveRemoteFile({
          id,
          kind: 'cloud',
          filename: String(namaFile),
          mime: String(tipeMime || 'application/octet-stream'),
          contentBase64: String(base64Data),
          textSidecar: teksEkstrak ? String(teksEkstrak) : ''
        });
      }

      const now = new Date();
      const tgl = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const record = {
        ID: id,
        Kelas: String(kelas || ''),
        NamaFile: String(namaFile),
        TipeMime: String(tipeMime || 'application/octet-stream'),
        Ukuran: String(ukuran || buffer.length),
        TanggalUnggah: tgl,
        Pengunggah: s.nama || (s.role === 'admin' ? 'Administrator' : 'Pengguna'),
        StatusCloud: 'Tersimpan Aman (AES-256 Cloud Vault)',
        PathSimpan: storedFileName,
        AnalisisJSON: ''
      };

      const semua = baca_('BerkasCloud');
      semua.unshift(record);
      tulis_('BerkasCloud', semua);
      await flushWrites();

      res.json({ ok: true, data: record });
    } catch (e: any) {
      res.status(200).json({ ok: false, error: e?.message || String(e) });
    }
  });

  // AI Document & Media Analysis Endpoint using gemini-3.8-flash
  app.post('/api/cloud/analyze', async (req, res) => {
    try {
      const { token, fileId, instruksiTambahan } = req.body || {};
      sesi_(token);

      const semua = baca_('BerkasCloud');
      const rec = semua.find(x => x.ID === fileId);
      if (!rec) {
        res.status(404).json({ ok: false, error: 'Berkas tidak ditemukan di penyimpanan cloud.' });
        return;
      }

      const fullPath = path.join(CLOUD_DIR, rec.PathSimpan);
      const parts: any[] = [];

      const mime = (rec.TipeMime || '').toLowerCase();
      const isTextLike =
        mime.includes('text') ||
        mime.includes('csv') ||
        mime.includes('json') ||
        mime.includes('xml') ||
        /\.(txt|csv|tsv|json|md|html|gs|js|ts)$/i.test(rec.NamaFile);

      const isInlineSupported =
        mime.startsWith('image/') ||
        mime === 'application/pdf' ||
        mime.startsWith('audio/');

      let fileBuf: Buffer | null = null;
      let sidecarText = '';
      if (fs.existsSync(fullPath)) {
        fileBuf = fs.readFileSync(fullPath);
        if (fs.existsSync(fullPath + '.txt')) {
          sidecarText = fs.readFileSync(fullPath + '.txt', 'utf8');
        }
      } else if (detectStorageEngine().isVercelCloud) {
        const remote = await loadRemoteFile(rec.ID);
        if (remote) {
          fileBuf = Buffer.from(remote.contentBase64, 'base64');
          sidecarText = remote.textSidecar || '';
        }
      }

      if (fileBuf) {
        if (isTextLike) {
          const textContent = fileBuf.toString('utf8').slice(0, 60000);
          parts.push({
            text: `Nama Berkas: ${rec.NamaFile}\nTipe: ${rec.TipeMime}\nIsi Berkas:\n\`\`\`\n${textContent}\n\`\`\``
          });
        } else if (isInlineSupported) {
          parts.push({
            inlineData: {
              mimeType: mime || 'image/png',
              data: fileBuf.toString('base64')
            }
          });
        } else if (sidecarText) {
          parts.push({
            text: `Nama Berkas: ${rec.NamaFile}\nIsi Teks Ekstraksi:\n${sidecarText.slice(0, 60000)}`
          });
        } else {
          const rawStr = fileBuf.toString('utf8').replace(/[^\x20-\x7E\n\r\t]/g, ' ').slice(0, 30000);
          parts.push({
            text: `Nama Berkas: ${rec.NamaFile} (${rec.TipeMime}, ${rec.Ukuran} bytes).\nKonten terbaca:\n${rawStr}`
          });
        }
      } else {
        parts.push({
          text: `Nama Berkas: ${rec.NamaFile} (${rec.TipeMime}). Analisis berdasarkan konteks dokumen akademik kelas.`
        });
      }

      const promptText = `Analisis berkas "${rec.NamaFile}" ini secara mendalam dalam konteks pendidikan dan manajemen kelas.
${instruksiTambahan ? `Fokus tambahan dari pengguna: ${instruksiTambahan}\n` : ''}
Ekstrak informasi kunci, identifikasi tren atau pola penting, dan berikan ringkasan eksekutif serta rekomendasi tindak lanjut yang konkret dan dapat langsung diterapkan oleh guru, wali kelas, atau siswa.`;

      parts.push({ text: promptText });

      const aiClient = getAiClient();
      const response = await aiClient.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'Anda adalah analis data pendidikan dan asisten akademik ahli. Analisis dokumen teks, spreadsheet nilai/absensi, PDF, atau gambar kegiatan/catatan belajar dengan presisi tinggi dalam Bahasa Indonesia.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              kategoriDokumen: {
                type: Type.STRING,
                description: 'Kategori dokumen (mis. Spreadsheet Nilai, Dokumen Modul Ajar, Foto Catatan Kelas, Laporan Absensi).'
              },
              ringkasanEksekutif: {
                type: Type.STRING,
                description: 'Ringkasan padat dan komprehensif mengenai isi dokumen (2-4 kalimat).'
              },
              informasiKunci: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Poin-poin informasi kunci, angka statistik, atau fakta penting yang diekstrak dari berkas.'
              },
              identifikasiTren: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Pola, anomali, atau tren yang teridentifikasi dari data/dokumen.'
              },
              rekomendasiTindakLanjut: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Langkah tindak lanjut konkret dan dapat ditindaklanjuti (actionable) untuk guru atau siswa.'
              }
            },
            required: [
              'kategoriDokumen',
              'ringkasanEksekutif',
              'informasiKunci',
              'identifikasiTren',
              'rekomendasiTindakLanjut'
            ]
          }
        }
      });

      const parsed = parseJsonSafe<any>(response.text, {});

      rec.AnalisisJSON = JSON.stringify(parsed);
      rec.StatusCloud = 'Tersimpan & Teranalisis AI';
      tulis_('BerkasCloud', semua);
      await flushWrites();

      res.json({ ok: true, data: { record: rec, analisis: parsed } });
    } catch (e: any) {
      res.status(200).json({
        ok: false,
        error: e?.message || 'Gagal menganalisis berkas dengan AI.'
      });
    }
  });

  // Delete Cloud File Endpoint
  app.post('/api/cloud/delete', async (req, res) => {
    try {
      const { token, fileId } = req.body || {};
      sesi_(token);
      const semua = baca_('BerkasCloud');
      const target = semua.find(x => x.ID === fileId);
      if (target && target.PathSimpan) {
        const fullPath = path.join(CLOUD_DIR, target.PathSimpan);
        if (fs.existsSync(fullPath)) {
          try { fs.unlinkSync(fullPath); } catch (_) {}
        }
      }
      if (target && detectStorageEngine().isVercelCloud) {
        await deleteRemoteFile(target.ID);
      }
      const sisa = semua.filter(x => x.ID !== fileId);
      tulis_('BerkasCloud', sisa);
      await flushWrites();
      res.json({ ok: true, data: sisa });
    } catch (e: any) {
      res.status(200).json({ ok: false, error: e?.message || String(e) });
    }
  });

  // Download Cloud File Endpoint
  app.get('/api/cloud/file/:id', async (req, res) => {
    try {
      const rec = baca_('BerkasCloud').find(x => x.ID === req.params.id);
      if (!rec) {
        res.status(404).send('Berkas tidak ditemukan');
        return;
      }
      const fullPath = path.join(CLOUD_DIR, rec.PathSimpan);
      if (fs.existsSync(fullPath)) {
        res.setHeader('Content-Type', rec.TipeMime || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${rec.NamaFile}"`);
        res.sendFile(fullPath);
        return;
      }
      if (detectStorageEngine().isVercelCloud) {
        const remote = await loadRemoteFile(rec.ID);
        if (remote) {
          res.setHeader('Content-Type', rec.TipeMime || remote.mime || 'application/octet-stream');
          res.setHeader('Content-Disposition', `attachment; filename="${rec.NamaFile}"`);
          res.send(Buffer.from(remote.contentBase64, 'base64'));
          return;
        }
      }
      res.status(404).send('Data fisik berkas merupakan sampel pratinjau metadata.');
    } catch (e) {
      res.status(500).send('Gagal mengunduh berkas');
    }
  });

  async function generateContentFastWithFallback(
    aiClient: GoogleGenAI,
    params: {
      modeCepat: boolean;
      contents: any;
      systemInstruction: string;
      responseSchema: any;
    }
  ) {
    const primaryModel = params.modeCepat ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen';
    const primaryLevel = params.modeCepat ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW;
    try {
      return await aiClient.models.generateContent({
        model: primaryModel,
        contents: params.contents,
        config: {
          thinkingConfig: { thinkingLevel: primaryLevel },
          systemInstruction: params.systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: params.responseSchema
        }
      });
    } catch (err: any) {
      if (primaryModel !== 'gemini-4-hydrogen') {
        return await aiClient.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: params.contents,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            systemInstruction: params.systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: params.responseSchema
          }
        });
      }
      throw err;
    }
  }

  function buildCbtSourceParts(body: any): any[] {
    const { uraianMateri, namaFile, tipeMime, base64Data } = body || {};
    const teksMateri = String(uraianMateri || '').trim();
    const hasFile = Boolean(base64Data && namaFile);
    const parts: any[] = [];

    if (hasFile) {
      const buf = Buffer.from(String(base64Data), 'base64');
      const mime = String(tipeMime || '').toLowerCase();
      const fname = String(namaFile);
      const isTextLike =
        mime.includes('text') ||
        mime.includes('csv') ||
        mime.includes('json') ||
        mime.includes('xml') ||
        /\.(txt|csv|tsv|json|md|html|gs|js|ts)$/i.test(fname);
      const isOfficeZip =
        /\.(docx|pptx|xlsx)$/i.test(fname) ||
        mime.includes('wordprocessingml') ||
        mime.includes('presentationml') ||
        mime.includes('spreadsheetml');
      const isInline = mime.startsWith('image/') || mime === 'application/pdf' || /\.pdf$/i.test(fname);

      if (isTextLike) {
        parts.push({
          text: `=== BERKAS MATERI SUMBER (${fname}) ===\n${buf.toString('utf8').slice(0, 45000)}`
        });
      } else if (isOfficeZip) {
        const extracted = extractOfficeXmlText(buf);
        if (extracted) {
          parts.push({
            text: `=== BERKAS MATERI SUMBER (${fname}) ===\n${extracted.slice(0, 45000)}`
          });
        } else if (!teksMateri) {
          throw new Error(
            `Berkas "${fname}" tidak berisi teks yang dapat dibaca (mungkin berisi gambar saja atau terproteksi). Simpan ke PDF atau tempelkan teks materi.`
          );
        }
      } else if (isInline) {
        parts.push({
          inlineData: {
            mimeType: /\.pdf$/i.test(fname) ? 'application/pdf' : (mime || 'image/png'),
            data: String(base64Data)
          }
        });
      } else {
        const readable = buf
          .toString('utf8')
          .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
          .replace(/\s{3,}/g, ' ')
          .trim()
          .slice(0, 35000);
        if (readable) {
          parts.push({
            text: `=== BERKAS MATERI SUMBER (${fname}) ===\n${readable}`
          });
        } else if (!teksMateri) {
          throw new Error(`Format berkas "${fname}" belum didukung untuk dibaca langsung. Gunakan PDF, DOCX, PPTX, TXT, atau Gambar.`);
        }
      }
    }

    if (teksMateri) {
      parts.push({
        text: `=== URAIAN MATERI SUMBER ===\n${teksMateri.slice(0, 45000)}`
      });
    }
    return parts;
  }

  async function runCbtGenerationBatches(
    body: any,
    callbacks?: {
      onStart?: (info: { totalPG: number; totalUr: number; totalBatches: number }) => void;
      onBatch?: (batch: {
        ringkasanMateri: string;
        soalPG: any[];
        soalUraian: any[];
        batchIndex: number;
        totalBatches: number;
      }) => void;
      isAborted?: () => boolean;
    }
  ) {
    const aiClient = getAiClient();
    const nPG = Math.max(0, Math.min(50, Math.floor(Number(body?.jumlahPG) || 0)));
    const nUr = Math.max(0, Math.min(5, Math.floor(Number(body?.jumlahUraian) || 0)));
    const modeCepat = body?.modeCepat !== false && body?.modeCepat !== 'mendalam';
    const baseParts = buildCbtSourceParts(body);
    const judul = String(body?.judul || 'Evaluasi Materi');
    const mapel = String(body?.mapel || 'Umum');
    const tingkat = String(body?.tingkat || 'Campuran (C1–C5)');

    // Split large requests into fast parallel chunks
    const tasks: { nPG: number; nUr: number; wantSummary: boolean; focusHint: string }[] = [];
    const CHUNK = modeCepat ? 10 : 8;
    if (nPG <= CHUNK) {
      tasks.push({
        nPG,
        nUr,
        wantSummary: true,
        focusHint: ''
      });
    } else {
      let remPG = nPG;
      let batchNum = 0;
      while (remPG > 0) {
        const takePG = Math.min(CHUNK, remPG);
        const isLast = remPG - takePG === 0;
        const takeUr = isLast && takePG <= 5 ? nUr : 0;
        tasks.push({
          nPG: takePG,
          nUr: takeUr,
          wantSummary: batchNum === 0,
          focusHint: `Bagian ke-${batchNum + 1} (buat pertanyaan beragam dan tidak mengulang soal lain).`
        });
        remPG -= takePG;
        batchNum++;
      }
      if (!tasks.some(t => t.nUr > 0) && nUr > 0) {
        tasks.push({
          nPG: 0,
          nUr,
          wantSummary: false,
          focusHint: 'Fokus menyusun soal Uraian analitis beserta rubrik.'
        });
      }
    }

    const totalBatches = tasks.length;
    callbacks?.onStart?.({ totalPG: nPG, totalUr: nUr, totalBatches });

    const pgByTask: any[][] = Array.from({ length: tasks.length }, () => []);
    const urByTask: any[][] = Array.from({ length: tasks.length }, () => []);
    let summaryText = '';

    const runSingleTask = async (task: typeof tasks[number], taskIdx: number) => {
      if (callbacks?.isAborted?.()) return;
      const props: Record<string, any> = {};
      const required: string[] = [];
      if (task.wantSummary) {
        props.ringkasanMateri = {
          type: Type.STRING,
          description: 'Ringkasan padat materi sumber (1-2 kalimat singkat).'
        };
        required.push('ringkasanMateri');
      }
      if (task.nPG > 0) {
        props.soalPG = {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              pertanyaan: { type: Type.STRING },
              opsiA: { type: Type.STRING },
              opsiB: { type: Type.STRING },
              opsiC: { type: Type.STRING },
              opsiD: { type: Type.STRING },
              opsiE: { type: Type.STRING },
              kunci: { type: Type.STRING, description: 'A, B, C, D, atau E' },
              pembahasan: { type: Type.STRING, description: '1 kalimat singkat.' },
              kutipanMateri: { type: Type.STRING, description: 'Kutipan singkat maks 15 kata dari materi.' }
            },
            required: ['pertanyaan', 'opsiA', 'opsiB', 'opsiC', 'opsiD', 'opsiE', 'kunci', 'pembahasan', 'kutipanMateri']
          }
        };
        required.push('soalPG');
      }
      if (task.nUr > 0) {
        props.soalUraian = {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              pertanyaan: { type: Type.STRING },
              kunciRubrik: { type: Type.STRING },
              poinMaksimal: { type: Type.NUMBER },
              kutipanMateri: { type: Type.STRING, description: 'Kutipan singkat maks 15 kata dari materi.' }
            },
            required: ['pertanyaan', 'kunciRubrik', 'poinMaksimal', 'kutipanMateri']
          }
        };
        required.push('soalUraian');
      }

      const instruksi = `Susun soal CBT HANYA dari materi sumber di atas:
- Topik: ${judul} (${mapel}) · Level: ${tingkat}
${task.focusHint ? `- ${task.focusHint}\n` : ''}${task.nPG > 0 ? `- Buat TEPAT ${task.nPG} soal PG (5 opsi A-E, 1 kunci tepat, pembahasan 1 kalimat singkat).\n` : ''}${task.nUr > 0 ? `- Buat TEPAT ${task.nUr} soal Uraian dengan rubrik singkat dan total poinMaksimal = 100.\n` : ''}- Cantumkan "kutipanMateri" singkat (<=15 kata) langsung dari materi sumber. Dilarang mengambil fakta di luar materi.`;

      const resp = await generateContentFastWithFallback(aiClient, {
        modeCepat,
        contents: { parts: [...baseParts, { text: instruksi }] },
        systemInstruction:
          'Anda penyusun soal CBT Indonesia yang cepat, ringkas, dan akurat. Gunakan HANYA fakta dari materi sumber pengguna. Buat pembahasan dan kutipan sesingkat dan sepadat mungkin.',
        responseSchema: {
          type: Type.OBJECT,
          properties: props,
          required
        }
      });

      if (callbacks?.isAborted?.()) return;

      const parsed = parseJsonSafe<any>(resp.text, {});
      const stamp = `${Date.now()}_${taskIdx}`;
      const pgBatch = task.nPG > 0
        ? (Array.isArray(parsed.soalPG) ? parsed.soalPG : []).slice(0, task.nPG).map((q: any, i: number) => ({
            id: `pg_${stamp}_${i + 1}`,
            pertanyaan: String(q.pertanyaan || ''),
            opsiA: String(q.opsiA || ''),
            opsiB: String(q.opsiB || ''),
            opsiC: String(q.opsiC || ''),
            opsiD: String(q.opsiD || ''),
            opsiE: String(q.opsiE || ''),
            kunci: ['A', 'B', 'C', 'D', 'E'].includes(String(q.kunci || '').toUpperCase().trim())
              ? String(q.kunci).toUpperCase().trim()
              : 'A',
            pembahasan: String(q.pembahasan || ''),
            kutipanMateri: String(q.kutipanMateri || '')
          }))
        : [];
      const urBatch = task.nUr > 0
        ? (Array.isArray(parsed.soalUraian) ? parsed.soalUraian : []).slice(0, task.nUr).map((q: any, i: number) => ({
            id: `ur_${stamp}_${i + 1}`,
            pertanyaan: String(q.pertanyaan || ''),
            kunciRubrik: String(q.kunciRubrik || ''),
            poinMaksimal: Number(q.poinMaksimal) || Math.round(100 / nUr),
            kutipanMateri: String(q.kutipanMateri || '')
          }))
        : [];
      const ringkasan = String(parsed.ringkasanMateri || '');
      if (ringkasan && !summaryText) summaryText = ringkasan;
      pgByTask[taskIdx] = pgBatch;
      urByTask[taskIdx] = urBatch;

      callbacks?.onBatch?.({
        ringkasanMateri: ringkasan,
        soalPG: pgBatch,
        soalUraian: urBatch,
        batchIndex: taskIdx,
        totalBatches
      });
    };

    // Bounded concurrency = 3 for high speed without hitting rate limits
    const concurrency = Math.min(3, tasks.length);
    let cursor = 0;
    const workers = Array.from({ length: concurrency }, async () => {
      while (cursor < tasks.length && !callbacks?.isAborted?.()) {
        const myIdx = cursor++;
        await runSingleTask(tasks[myIdx], myIdx);
      }
    });
    await Promise.all(workers);

    return {
      ringkasanMateri: summaryText,
      soalPG: pgByTask.flat().slice(0, nPG),
      soalUraian: urByTask.flat().slice(0, nUr)
    };
  }

  // Fast Streaming CBT Generator (NDJSON progress + real-time partial batches)
  app.post('/api/cbt/generate-stream', async (req, res) => {
    let clientAborted = false;
    req.on('close', () => {
      if (!res.writableEnded) clientAborted = true;
    });

    try {
      const body = req.body || {};
      staf_(body.token);

      const nPG = Math.max(0, Math.min(50, Math.floor(Number(body.jumlahPG) || 0)));
      const nUr = Math.max(0, Math.min(5, Math.floor(Number(body.jumlahUraian) || 0)));
      if (nPG === 0 && nUr === 0) {
        res.status(400).json({ ok: false, error: 'Masukkan minimal 1 soal PG (maks. 50) atau 1 soal Uraian (maks. 5).' });
        return;
      }
      if (!String(body.uraianMateri || '').trim() && !(body.base64Data && body.namaFile)) {
        res.status(400).json({ ok: false, error: 'Masukkan uraian materi atau unggah berkas materi terlebih dahulu.' });
        return;
      }

      // Validate API key and source material BEFORE switching response to NDJSON stream
      getAiClient();
      buildCbtSourceParts(body);

      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();

      const sendEvent = (obj: any) => {
        if (!res.writableEnded && !clientAborted) {
          res.write(JSON.stringify(obj) + '\n');
        }
      };

      let completedBatches = 0;
      const finalResult = await runCbtGenerationBatches(body, {
        isAborted: () => clientAborted,
        onStart: info => {
          sendEvent({ type: 'start', ...info });
        },
        onBatch: batch => {
          completedBatches++;
          sendEvent({
            type: 'batch',
            ringkasanMateri: batch.ringkasanMateri,
            soalPG: batch.soalPG,
            soalUraian: batch.soalUraian,
            completedBatches,
            totalBatches: batch.totalBatches
          });
        }
      });

      if (!clientAborted && !res.writableEnded) {
        sendEvent({ type: 'done', data: finalResult });
        res.end();
      }
    } catch (e: any) {
      if (!res.headersSent) {
        res.status(200).json({ ok: false, error: e?.message || 'Gagal menghasilkan soal CBT dengan AI.' });
      } else if (!res.writableEnded && !clientAborted) {
        res.write(JSON.stringify({ type: 'error', error: e?.message || 'Gagal menghasilkan soal CBT dengan AI.' }) + '\n');
        res.end();
      }
    }
  });

  // Fast Non-Streaming CBT Generator (uses same parallel batch engine)
  app.post('/api/cbt/generate', async (req, res) => {
    try {
      const body = req.body || {};
      staf_(body.token);

      const nPG = Math.max(0, Math.min(50, Math.floor(Number(body.jumlahPG) || 0)));
      const nUr = Math.max(0, Math.min(5, Math.floor(Number(body.jumlahUraian) || 0)));
      if (nPG === 0 && nUr === 0) {
        res.status(400).json({ ok: false, error: 'Masukkan minimal 1 soal PG (maks. 50) atau 1 soal Uraian (maks. 5).' });
        return;
      }
      if (!String(body.uraianMateri || '').trim() && !(body.base64Data && body.namaFile)) {
        res.status(400).json({ ok: false, error: 'Masukkan uraian materi atau unggah berkas materi terlebih dahulu.' });
        return;
      }

      const data = await runCbtGenerationBatches(body);
      res.json({ ok: true, data });
    } catch (e: any) {
      res.status(200).json({
        ok: false,
        error: e?.message || 'Gagal menghasilkan soal CBT dengan AI.'
      });
    }
  });

  // Student submits CBT PG & Uraian answers
  app.post('/api/cbt/submit', async (req, res) => {
    try {
      const { token, cbtId, jawabanPG, jawabanUraian, mulai } = req.body || {};
      const sesi = sesi_(token, 'siswa');
      const siswa = baca_('Siswa').find(s => s.ID === sesi.sid);
      if (!siswa) throw new Error('SESI_HABIS');

      const cbt = baca_('CBT').find(c => c.ID === cbtId && c.Kelas === siswa.Kelas);
      if (!cbt) {
        res.status(404).json({ ok: false, error: 'Paket CBT tidak ditemukan.' });
        return;
      }
      if (cbt.Status !== 'Aktif') {
        res.status(400).json({ ok: false, error: 'Ujian CBT ini sedang tidak dibuka.' });
        return;
      }

      const semuaHasil = baca_('HasilCBT');
      if (semuaHasil.some(h => h.CBTID === cbtId && h.SiswaID === siswa.ID)) {
        res.status(400).json({ ok: false, error: 'Anda sudah mengumpulkan ujian CBT ini.' });
        return;
      }

      let soalObj: any = { soalPG: [], soalUraian: [] };
      try { soalObj = JSON.parse(cbt.SoalJSON || '{}'); } catch (_) {}
      const soalPG = soalObj.soalPG || [];
      const soalUraian = soalObj.soalUraian || [];

      let benarPG = 0;
      soalPG.forEach((q: any) => {
        const jwb = String((jawabanPG || {})[q.id] || '').toUpperCase().trim();
        if (jwb && jwb === String(q.kunci || '').toUpperCase().trim()) {
          benarPG++;
        }
      });

      const skorPG = soalPG.length > 0 ? Math.round((benarPG / soalPG.length) * 1000) / 10 : 0;
      const hasUraian = soalUraian.length > 0;
      const hasPG = soalPG.length > 0;

      const now = new Date();
      const selesaiStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const record = {
        ID: 'hcbt_' + uidShort(),
        CBTID: cbtId,
        Kelas: siswa.Kelas,
        SiswaID: siswa.ID,
        Mulai: String(mulai || selesaiStr),
        Selesai: selesaiStr,
        JawabanJSON: JSON.stringify({
          pg: jawabanPG || {},
          uraian: jawabanUraian || {}
        }),
        SkorPG: hasPG ? String(skorPG) : '-',
        SkorUraian: hasUraian ? '' : '-',
        SkorAkhir: hasUraian ? '' : String(skorPG),
        FeedbackAI: '',
        StatusNilai: hasUraian ? 'Menunggu Nilai Uraian' : 'Selesai'
      };

      semuaHasil.push(record);
      tulis_('HasilCBT', semuaHasil);
      await flushWrites();
      res.json({ ok: true, data: record });
    } catch (e: any) {
      res.status(200).json({ ok: false, error: e?.message || String(e) });
    }
  });

  // AI Grades Student Uraian Answers using gemini-4-hydrogen
  app.post('/api/cbt/grade-essay', async (req, res) => {
    try {
      const { token, hasilId } = req.body || {};
      staf_(token);

      const semuaHasil = baca_('HasilCBT');
      const hasil = semuaHasil.find(h => h.ID === hasilId);
      if (!hasil) {
        res.status(404).json({ ok: false, error: 'Data hasil CBT tidak ditemukan.' });
        return;
      }
      const cbt = baca_('CBT').find(c => c.ID === hasil.CBTID);
      if (!cbt) {
        res.status(404).json({ ok: false, error: 'Paket CBT tidak ditemukan.' });
        return;
      }

      let soalObj: any = { soalPG: [], soalUraian: [] };
      let jwbObj: any = { pg: {}, uraian: {} };
      try { soalObj = JSON.parse(cbt.SoalJSON || '{}'); } catch (_) {}
      try { jwbObj = JSON.parse(hasil.JawabanJSON || '{}'); } catch (_) {}

      const soalPG = soalObj.soalPG || [];
      const soalUraian = soalObj.soalUraian || [];
      if (!soalUraian.length) {
        res.json({ ok: true, data: hasil });
        return;
      }

      const evaluasiPayload = soalUraian.map((q: any, idx: number) => ({
        nomor: idx + 1,
        id: q.id,
        pertanyaan: q.pertanyaan,
        kunciRubrik: q.kunciRubrik,
        poinMaksimal: Number(q.poinMaksimal) || Math.round(100 / soalUraian.length),
        jawabanSiswa: String((jwbObj.uraian || {})[q.id] || '(Tidak dijawab)')
      }));

      const aiClient = getAiClient();
      const response = await generateContentFastWithFallback(aiClient, {
        modeCepat: true,
        contents: `Materi Sumber CBT:\n${String(cbt.SumberMateri || '-').slice(0, 12000)}\n\nDaftar Soal Uraian, Rubrik, & Jawaban Siswa:\n${JSON.stringify(evaluasiPayload)}\n\nNilai setiap jawaban uraian siswa secara objektif berdasarkan rubrik dan materi sumber.`,
        systemInstruction:
          'Anda penilai asesmen uraian guru Indonesia yang cepat, objektif, dan adil. Berikan skor numerik sesuai poinMaksimal serta komentar singkat 1 kalimat per soal dalam Bahasa Indonesia.',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detail: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  skor: { type: Type.NUMBER },
                  maksimal: { type: Type.NUMBER },
                  komentar: { type: Type.STRING }
                },
                required: ['id', 'skor', 'maksimal', 'komentar']
              }
            },
            ringkasanFeedback: { type: Type.STRING }
          },
          required: ['detail', 'ringkasanFeedback']
        }
      });

      const parsed = parseJsonSafe<any>(response.text, {});
      const detail = parsed.detail || [];
      const totSkor = detail.reduce((acc: number, d: any) => acc + (Number(d.skor) || 0), 0);
      const totMax = soalUraian.reduce((acc: number, q: any) => acc + (Number(q.poinMaksimal) || Math.round(100 / soalUraian.length)), 0);
      const skorUraian = totMax > 0 ? Math.min(100, Math.round((totSkor / totMax) * 1000) / 10) : 0;

      const hasPG = soalPG.length > 0;
      const skorPGVal = Number(hasil.SkorPG) || 0;
      const skorAkhir = hasPG
        ? Math.round((skorPGVal * 0.6 + skorUraian * 0.4) * 10) / 10
        : skorUraian;

      hasil.SkorUraian = String(skorUraian);
      hasil.SkorAkhir = String(skorAkhir);
      hasil.FeedbackAI = JSON.stringify({
        ringkasan: parsed.ringkasanFeedback || '',
        detail
      });
      hasil.StatusNilai = 'Dinilai AI';

      tulis_('HasilCBT', semuaHasil);
      await flushWrites();
      res.json({ ok: true, data: hasil });
    } catch (e: any) {
      res.status(200).json({ ok: false, error: e?.message || 'Gagal menilai uraian dengan AI.' });
    }
  });

  // Teacher manually saves/confirms CBT grades
  app.post('/api/cbt/save-grade', async (req, res) => {
    try {
      const { token, hasilId, skorUraian, skorAkhir, catatanGuru } = req.body || {};
      staf_(token);

      const semuaHasil = baca_('HasilCBT');
      const hasil = semuaHasil.find(h => h.ID === hasilId);
      if (!hasil) {
        res.status(404).json({ ok: false, error: 'Data hasil CBT tidak ditemukan.' });
        return;
      }

      if (skorUraian !== undefined) hasil.SkorUraian = String(skorUraian);
      if (skorAkhir !== undefined) hasil.SkorAkhir = String(skorAkhir);
      if (catatanGuru !== undefined) {
        let fbObj: any = {};
        try { fbObj = JSON.parse(hasil.FeedbackAI || '{}'); } catch (_) {}
        fbObj.catatanGuru = String(catatanGuru);
        hasil.FeedbackAI = JSON.stringify(fbObj);
      }
      hasil.StatusNilai = 'Final';
      tulis_('HasilCBT', semuaHasil);
      await flushWrites();
      res.json({ ok: true, data: hasil });
    } catch (e: any) {
      res.status(200).json({ ok: false, error: e?.message || String(e) });
    }
  });

  // Upload Teacher Attachment for Tugas
  app.post('/api/tugas/upload-soal', async (req, res) => {
    try {
      const { token, namaFile, base64Data } = req.body || {};
      staf_(token);
      if (!namaFile || !base64Data) {
        res.status(400).json({ ok: false, error: 'Pilih berkas lampiran tugas terlebih dahulu.' });
        return;
      }
      const fileId = 'tgs_' + uidShort();
      const cleanName = String(namaFile).replace(/[^a-zA-Z0-9._-]/g, '_');
      const diskName = `${fileId}__${cleanName}`;
      const buf = Buffer.from(String(base64Data), 'base64');
      try {
        if (!fs.existsSync(TUGAS_DIR)) fs.mkdirSync(TUGAS_DIR, { recursive: true });
        fs.writeFileSync(path.join(TUGAS_DIR, diskName), buf);
      } catch (_) {}
      if (detectStorageEngine().isVercelCloud) {
        await saveRemoteFile({
          id: fileId,
          kind: 'tugas',
          filename: String(namaFile),
          mime: 'application/octet-stream',
          contentBase64: String(base64Data)
        });
      }
      res.json({ ok: true, data: { fileId, namaFile: String(namaFile) } });
    } catch (e: any) {
      res.status(200).json({ ok: false, error: e?.message || String(e) });
    }
  });

  // Student Submits Assignment File
  app.post('/api/tugas/submit', async (req, res) => {
    try {
      const { token, tugasId, namaFile, base64Data, catatan } = req.body || {};
      const sesi = sesi_(token, 'siswa');
      const siswa = baca_('Siswa').find(s => s.ID === sesi.sid);
      if (!siswa) throw new Error('SESI_HABIS');

      const tugas = baca_('Tugas').find(t => t.ID === tugasId && t.Kelas === siswa.Kelas);
      if (!tugas) {
        res.status(404).json({ ok: false, error: 'Tugas tidak ditemukan.' });
        return;
      }
      if (!namaFile || !base64Data) {
        res.status(400).json({ ok: false, error: 'Pilih berkas hasil tugas untuk diunggah.' });
        return;
      }

      const fileId = 'tsis_' + uidShort();
      const cleanName = String(namaFile).replace(/[^a-zA-Z0-9._-]/g, '_');
      const diskName = `${fileId}__${cleanName}`;
      const buf = Buffer.from(String(base64Data), 'base64');
      try {
        if (!fs.existsSync(TUGAS_DIR)) fs.mkdirSync(TUGAS_DIR, { recursive: true });
        fs.writeFileSync(path.join(TUGAS_DIR, diskName), buf);
      } catch (_) {}
      if (detectStorageEngine().isVercelCloud) {
        await saveRemoteFile({
          id: fileId,
          kind: 'tugas',
          filename: String(namaFile),
          mime: 'application/octet-stream',
          contentBase64: String(base64Data)
        });
      }

      const now = new Date();
      const todayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const tanggalKumpul = `${todayYmd} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const statusWaktu = !tugas.Tenggat || todayYmd <= String(tugas.Tenggat) ? 'Tepat Waktu' : 'Terlambat';

      const semuaPg = baca_('Pengumpulan');
      const idx = semuaPg.findIndex(p => p.TugasID === tugasId && p.SiswaID === siswa.ID);
      const updated = {
        TugasID: tugasId,
        SiswaID: siswa.ID,
        Status: statusWaktu,
        Nilai: idx >= 0 ? semuaPg[idx].Nilai || '' : '',
        FileID: fileId,
        NamaFile: String(namaFile),
        TanggalKumpul: tanggalKumpul,
        CatatanSiswa: String(catatan || '').trim()
      };
      if (idx >= 0) semuaPg[idx] = updated;
      else semuaPg.push(updated);

      tulis_('Pengumpulan', semuaPg);
      await flushWrites();
      res.json({ ok: true, data: updated });
    } catch (e: any) {
      res.status(200).json({ ok: false, error: e?.message || String(e) });
    }
  });

  // Download Tugas / Student Submission File
  app.get('/api/tugas/file/:fileId', async (req, res) => {
    try {
      const fileId = String(req.params.fileId || '').replace(/[^a-zA-Z0-9_-]/g, '');
      if (!fileId) {
        res.status(404).send('Berkas tugas tidak ditemukan');
        return;
      }
      if (fs.existsSync(TUGAS_DIR)) {
        const match = fs.readdirSync(TUGAS_DIR).find(f => f.startsWith(fileId + '__'));
        if (match) {
          const origName = match.slice((fileId + '__').length);
          res.setHeader('Content-Disposition', `attachment; filename="${origName}"`);
          res.sendFile(path.join(TUGAS_DIR, match));
          return;
        }
      }
      if (detectStorageEngine().isVercelCloud) {
        const remote = await loadRemoteFile(fileId);
        if (remote) {
          res.setHeader('Content-Disposition', `attachment; filename="${remote.filename}"`);
          res.send(Buffer.from(remote.contentBase64, 'base64'));
          return;
        }
      }
      res.status(404).send('Berkas tugas tidak ditemukan');
    } catch {
      res.status(500).send('Gagal mengunduh berkas tugas');
    }
  });

  // Upload Lampiran Perangkat Ajar (TP, Modul Ajar & Materi Pelajaran)
  app.post('/api/ajar/upload', async (req, res) => {
    try {
      let token = '';
      let namaFile = '';
      let mime = 'application/octet-stream';
      let buf: Buffer | null = null;
      let base64Str = '';

      if (Buffer.isBuffer(req.body)) {
        token = String(req.headers['x-ajar-token'] || '');
        const rawNameHdr = String(req.headers['x-ajar-filename'] || '');
        try {
          namaFile = decodeURIComponent(rawNameHdr);
        } catch {
          namaFile = rawNameHdr;
        }
        mime = String(req.headers['x-ajar-mime'] || 'application/octet-stream');
        buf = req.body;
      } else {
        const body = req.body || {};
        token = String(body.token || req.headers['x-ajar-token'] || '');
        namaFile = String(body.namaFile || '');
        mime = String(body.mimeType || 'application/octet-stream');
        base64Str = String(body.base64Data || '');
        if (base64Str) {
          buf = Buffer.from(base64Str, 'base64');
        }
      }

      staf_(token);
      if (!namaFile || !buf || buf.length === 0) {
        res.status(400).json({ ok: false, error: 'Pilih berkas Perangkat Ajar terlebih dahulu.' });
        return;
      }

      const fileId = 'ajr_' + uidShort();
      const cleanName = String(namaFile).replace(/[^a-zA-Z0-9._-]/g, '_');
      const diskName = `${fileId}__${cleanName}`;
      const isVercel = detectStorageEngine().isVercelCloud;

      try {
        if (!fs.existsSync(AJAR_DIR)) fs.mkdirSync(AJAR_DIR, { recursive: true });
        fs.writeFileSync(path.join(AJAR_DIR, diskName), buf);
      } catch (diskErr: any) {
        if (!isVercel) {
          throw new Error('Gagal menyimpan berkas ke penyimpanan server: ' + (diskErr?.message || String(diskErr)));
        }
      }

      if (isVercel) {
        await saveRemoteFile({
          id: fileId,
          kind: 'ajar',
          filename: String(namaFile),
          mime,
          contentBase64: base64Str || buf.toString('base64')
        });
      }
      res.json({ ok: true, data: { fileId, namaFile: String(namaFile) } });
    } catch (e: any) {
      res.status(200).json({ ok: false, error: e?.message || String(e) });
    }
  });

  // Download / Preview Lampiran Perangkat Ajar & Materi Pelajaran
  app.get('/api/ajar/file/:fileId', async (req, res) => {
    try {
      const fileId = String(req.params.fileId || '').replace(/[^a-zA-Z0-9_-]/g, '');
      const isInline = String(req.query.inline || '') === '1' || String(req.query.inline || '') === 'true';
      const disp = isInline ? 'inline' : 'attachment';
      if (!fileId) {
        res.status(404).send('Berkas tidak ditemukan');
        return;
      }
      if (fs.existsSync(AJAR_DIR)) {
        const match = fs.readdirSync(AJAR_DIR).find(f => f.startsWith(fileId + '__'));
        if (match) {
          const origName = match.slice((fileId + '__').length).replace(/"/g, '');
          res.setHeader('Content-Disposition', `${disp}; filename="${origName}"`);
          res.sendFile(path.join(AJAR_DIR, match));
          return;
        }
      }
      if (detectStorageEngine().isVercelCloud) {
        const remote = await loadRemoteFile(fileId);
        if (remote) {
          const safeName = String(remote.filename || 'lampiran').replace(/"/g, '');
          if (remote.mime) res.setHeader('Content-Type', remote.mime);
          res.setHeader('Content-Disposition', `${disp}; filename="${safeName}"`);
          res.send(Buffer.from(remote.contentBase64, 'base64'));
          return;
        }
      }
      res.status(404).send('Berkas tidak ditemukan');
    } catch {
      res.status(500).send('Gagal mengunduh berkas');
    }
  });

  // Extract / Split Tujuan Pembelajaran (TP) from an uploaded Modul Ajar file
  app.post('/api/ajar/extract-tp', async (req, res) => {
    try {
      const { token, fileId, namaFile, mimeType, base64Data, judulModul, mapel } = req.body || {};
      staf_(token);

      let buf: Buffer | null = base64Data ? Buffer.from(String(base64Data), 'base64') : null;
      let resolvedName = String(namaFile || '');
      let resolvedMime = String(mimeType || '');

      if ((!buf || buf.length === 0) && fileId) {
        const safeId = String(fileId).replace(/[^a-zA-Z0-9_-]/g, '');
        if (safeId && fs.existsSync(AJAR_DIR)) {
          const match = fs.readdirSync(AJAR_DIR).find(f => f.startsWith(safeId + '__'));
          if (match) {
            buf = fs.readFileSync(path.join(AJAR_DIR, match));
            if (!resolvedName) resolvedName = match.slice((safeId + '__').length);
          }
        }
        if ((!buf || buf.length === 0) && safeId && detectStorageEngine().isVercelCloud) {
          const remote = await loadRemoteFile(safeId);
          if (remote?.contentBase64) {
            buf = Buffer.from(remote.contentBase64, 'base64');
            if (!resolvedName) resolvedName = remote.filename || 'modul';
            if (!resolvedMime) resolvedMime = remote.mime || '';
          }
        }
      }

      if (!resolvedName || !buf || buf.length === 0) {
        res.status(400).json({ ok: false, error: 'Unggah berkas Modul Ajar terlebih dahulu.' });
        return;
      }

      const mime = resolvedMime.toLowerCase();
      const fname = resolvedName;
      const isTextLike =
        mime.includes('text') ||
        mime.includes('csv') ||
        mime.includes('json') ||
        mime.includes('xml') ||
        /\.(txt|csv|tsv|json|md|html)$/i.test(fname);
      const isOfficeZip =
        /\.(docx|pptx|xlsx)$/i.test(fname) ||
        mime.includes('wordprocessingml') ||
        mime.includes('presentationml') ||
        mime.includes('spreadsheetml');
      const isInline = mime.startsWith('image/') || mime === 'application/pdf' || /\.pdf$/i.test(fname);

      let extractedText = '';
      if (isTextLike) {
        extractedText = buf.toString('utf8').slice(0, 40000);
      } else if (isOfficeZip) {
        extractedText = extractOfficeXmlText(buf).slice(0, 40000);
      }

      const fallbackParseTpsFromText = (raw: string) => {
        const lines = String(raw || '')
          .split(/\r?\n/)
          .map(l => l.trim())
          .filter(Boolean);
        const found: { kode: string; tujuan: string; materi: string }[] = [];
        let inTpSection = false;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (/^(?:[A-Z]\.\s*)?(?:tujuan\s+pembelajaran|capaian\s+dan\s+tujuan|indikator\s+tujuan)/i.test(line)) {
            inTpSection = true;
            const inlineAfterColon = line.split(':').slice(1).join(':').trim();
            if (inlineAfterColon.length > 15) {
              found.push({
                kode: `TP ${found.length + 1}`,
                tujuan: inlineAfterColon,
                materi: String(judulModul || mapel || '').trim()
              });
            }
            continue;
          }
          if (inTpSection && /^(?:[A-Z]\.\s*)?(?:pemahaman\s+bermakna|pertanyaan\s+pemantik|kegiatan\s+pembelajaran|asesmen|sarana|profil\s+pelajar|langkah)/i.test(line)) {
            inTpSection = false;
            continue;
          }

          const tpPrefixMatch = /^(?:TP\s*[\d.]+)\s*[:\-–.]\s*(.+)$/i.exec(line);
          if (tpPrefixMatch && tpPrefixMatch[1].trim().length > 10) {
            const rawCode = line.slice(0, line.indexOf(tpPrefixMatch[1])).replace(/[:\-–.\s]+$/, '').trim();
            found.push({
              kode: rawCode || `TP ${found.length + 1}`,
              tujuan: tpPrefixMatch[1].trim(),
              materi: String(judulModul || mapel || '').trim()
            });
            continue;
          }

          if (inTpSection) {
            const cleaned = line.replace(/^(?:\d+[.)]|[a-z][.)]|[-•*▪➢])\s*/i, '').trim();
            if (cleaned.length >= 15 && !/^(?:peserta didik diharapkan|berikut|setelah mengikuti)/i.test(cleaned)) {
              found.push({
                kode: `TP ${found.length + 1}`,
                tujuan: cleaned,
                materi: String(judulModul || mapel || '').trim()
              });
            }
          } else if (/^(?:\d+[.)]|[-•*])\s*(?:peserta\s+didik|siswa|murid)\s+(?:mampu|dapat|memahami|menjelaskan|menganalisis|mengidentifikasi|menerapkan|menyelesaikan|merancang)/i.test(line)) {
            const cleaned = line.replace(/^(?:\d+[.)]|[-•*])\s*/i, '').trim();
            found.push({
              kode: `TP ${found.length + 1}`,
              tujuan: cleaned,
              materi: String(judulModul || mapel || '').trim()
            });
          }
          if (found.length >= 15) break;
        }
        return found;
      };

      const hasAiKey = Boolean((process.env.GEMINI_API_KEY || '').trim() && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
      if (hasAiKey && (extractedText || isInline)) {
        try {
          const aiClient = getAiClient();
          const parts: any[] = [];
          if (extractedText) {
            parts.push({ text: `Dokumen Modul Ajar (${fname}):\n${extractedText}` });
          } else if (isInline) {
            parts.push({
              inlineData: {
                mimeType: /\.pdf$/i.test(fname) ? 'application/pdf' : (mime || 'image/png'),
                data: String(base64Data)
              }
            });
          }
          parts.push({
            text: `Ekstrak dan pisahkan seluruh Tujuan Pembelajaran (TP) yang ada pada dokumen Modul Ajar "${judulModul || fname}" (${mapel || 'Umum'}) menjadi daftar item TP terpisah. Selain itu, ekstrak juga Pertanyaan Pemantik yang ada pada dokumen modul ajar jika tersedia.`
          });

          const resp = await generateContentFastWithFallback(aiClient, {
            modeCepat: true,
            contents: { parts },
            systemInstruction:
              'Anda asisten kurikulum sekolah Indonesia. Ekstrak dan pisahkan daftar Tujuan Pembelajaran (TP) serta Pertanyaan Pemantik dari dokumen modul ajar.',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                pertanyaanPemantik: {
                  type: Type.STRING,
                  description: 'Daftar pertanyaan pemantik dari modul ajar (pisahkan tiap pertanyaan dengan baris baru jika lebih dari satu, atau kosong jika tidak ada).'
                },
                tps: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      kode: { type: Type.STRING, description: 'Misal TP 1, TP 2, dst.' },
                      tujuan: { type: Type.STRING, description: 'Rumusan lengkap Tujuan Pembelajaran.' },
                      materi: { type: Type.STRING, description: 'Materi pokok singkat terkait TP.' }
                    },
                    required: ['kode', 'tujuan', 'materi']
                  }
                }
              },
              required: ['tps']
            }
          });
          const parsed = parseJsonSafe<{ tps?: any[]; pertanyaanPemantik?: string }>(resp.text, {});
          const items = (Array.isArray(parsed.tps) ? parsed.tps : [])
            .map((x: any, idx: number) => ({
              kode: String(x.kode || `TP ${idx + 1}`).trim(),
              tujuan: String(x.tujuan || '').trim(),
              materi: String(x.materi || judulModul || '').trim()
            }))
            .filter(x => x.tujuan.length > 0);
          const pertanyaanPemantik = String(parsed.pertanyaanPemantik || '').trim();
          if (items.length > 0 || pertanyaanPemantik) {
            res.json({ ok: true, data: { tps: items, pertanyaanPemantik, source: 'ai' } });
            return;
          }
        } catch (aiErr) {
          if (!extractedText) throw aiErr;
        }
      }

      if (extractedText) {
        const parsedLocal = fallbackParseTpsFromText(extractedText);
        res.json({
          ok: true,
          data: {
            tps: parsedLocal,
            source: 'parser',
            note: parsedLocal.length === 0 ? 'Tidak ditemukan poin TP otomatis pada teks dokumen; silakan tambah TP manual di bawah.' : ''
          }
        });
        return;
      }

      res.status(200).json({
        ok: false,
        error: 'Ekstraksi otomatis berkas PDF/Gambar membutuhkan GEMINI_API_KEY di server, atau gunakan tombol Tambah TP Khusus Modul Ini secara manual.'
      });
    } catch (e: any) {
      res.status(200).json({ ok: false, error: e?.message || 'Gagal mengekstrak TP dari modul ajar.' });
    }
  });

  let broadcastChatMessage: (msg: any) => void = () => {};

  // Endpoint Chat Antar Siswa & Guru
  app.get('/api/chat/messages', async (req, res) => {
    try {
      await ensureDbLoaded();
      const kelas = String(req.query.kelas || '').trim();
      const userId = String(req.query.userId || '').trim();
      const peran = String(req.query.peran || '').trim();
      const allMessages = baca_('Pesan');
      const filtered = allMessages.filter((m: any) => {
        const mKelas = String(m.Kelas || '').trim();
        const matchKelas = !kelas || mKelas === '__ALL__' || mKelas === kelas || !mKelas;
        if (!matchKelas) return false;
        const penerima = String(m.PenerimaID || 'ALL').trim();
        const pengirim = String(m.PengirimID || '').trim();
        if (penerima === 'ALL') return true;
        if (peran === 'admin' || peran === 'wali' || peran === 'guru') return true;
        if (userId && (penerima === userId || pengirim === userId)) return true;
        return false;
      });
      res.json({ ok: true, data: filtered });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || 'Gagal memuat pesan chat' });
    }
  });

  app.post('/api/chat/send', async (req, res) => {
    try {
      await ensureDbLoaded();
      const {
        kelas,
        pengirimId,
        pengirimNama,
        pengirimPeran,
        penerimaId,
        penerimaNama,
        pesan,
        tipe,
        lampiran
      } = req.body || {};
      const cleanPesan = String(pesan || '').trim();
      if (!cleanPesan) {
        res.status(400).json({ ok: false, error: 'Pesan tidak boleh kosong' });
        return;
      }
      const newMsg = {
        ID: 'msg_' + uidShort(),
        Kelas: String(kelas || '').trim(),
        PengirimID: String(pengirimId || '').trim(),
        PengirimNama: String(pengirimNama || 'Anonim').trim(),
        PengirimPeran: String(pengirimPeran || 'siswa').trim(),
        PenerimaID: String(penerimaId || 'ALL').trim(),
        PenerimaNama: String(penerimaNama || 'Semua Siswa').trim(),
        Pesan: cleanPesan,
        Waktu: new Date().toISOString(),
        Tipe: String(tipe || 'teks').trim(),
        Lampiran: String(lampiran || '').trim()
      };
      const cur = baca_('Pesan');
      cur.push(newMsg);
      tulis_('Pesan', cur);

      broadcastChatMessage(newMsg);

      res.json({ ok: true, data: newMsg });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || 'Gagal mengirim pesan chat' });
    }
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, storage: detectStorageEngine() });
  });

  app.all('/api/*', (_req, res) => {
    res.status(404).json({ ok: false, error: 'Endpoint API tidak ditemukan.' });
  });

  let viteMiddleware: any = null;

  if (!process.env.VERCEL) {
    if (process.env.NODE_ENV !== 'production') {
      app.use((req, res, next) => {
        if (viteMiddleware) {
          viteMiddleware(req, res, next);
          return;
        }
        res
          .status(503)
          .set('Retry-After', '1')
          .send(
            '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="1"><title>Menyiapkan Aplikasi</title></head><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#334155">Menyiapkan layanan aplikasi…</body></html>'
          );
      });
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    const server = http.createServer(app);

    // Setup WebSocket server for real-time chat using noServer so Vite HMR upgrades are never rejected
    const wss = new WebSocketServer({ noServer: true });
    server.on('upgrade', (req, socket, head) => {
      const urlPath = (req.url || '').split('?')[0];
      if (urlPath === '/ws/chat') {
        wss.handleUpgrade(req, socket, head, ws => {
          wss.emit('connection', ws, req);
        });
      }
    });
    interface ChatClientInfo {
      ws: WebSocket;
      kelas: string;
      userId: string;
      peran: string;
      nama: string;
    }
    const chatClients = new Set<ChatClientInfo>();

    broadcastChatMessage = (msg: any) => {
      const payload = JSON.stringify({ type: 'message', message: msg });
      for (const client of chatClients) {
        if (client.ws.readyState === WebSocket.OPEN) {
          const matchKelas = !client.kelas || !msg.Kelas || msg.Kelas === '__ALL__' || client.kelas === msg.Kelas;
          if (!matchKelas) continue;
          const penerima = msg.PenerimaID || 'ALL';
          const pengirim = msg.PengirimID || '';
          const canReceive =
            penerima === 'ALL' ||
            client.peran === 'admin' ||
            client.peran === 'wali' ||
            client.peran === 'guru' ||
            (client.userId && (penerima === client.userId || pengirim === client.userId));
          if (canReceive) {
            try {
              client.ws.send(payload);
            } catch {}
          }
        }
      }
    };

    wss.on('connection', ws => {
      const clientInfo: ChatClientInfo = {
        ws,
        kelas: '',
        userId: '',
        peran: 'siswa',
        nama: ''
      };
      chatClients.add(clientInfo);

      ws.on('message', async raw => {
        try {
          const data = JSON.parse(String(raw || ''));
          if (data.type === 'join') {
            clientInfo.kelas = String(data.kelas || '').trim();
            clientInfo.userId = String(data.userId || '').trim();
            clientInfo.peran = String(data.peran || 'siswa').trim();
            clientInfo.nama = String(data.nama || '').trim();
            ws.send(JSON.stringify({ type: 'joined', ok: true }));
            return;
          }
          if (data.type === 'chat') {
            const cleanPesan = String(data.pesan || '').trim();
            if (!cleanPesan) return;
            const newMsg = {
              ID: 'msg_' + uidShort(),
              Kelas: String(data.kelas || clientInfo.kelas || '').trim(),
              PengirimID: String(data.pengirimId || clientInfo.userId || '').trim(),
              PengirimNama: String(data.pengirimNama || clientInfo.nama || 'Anonim').trim(),
              PengirimPeran: String(data.pengirimPeran || clientInfo.peran || 'siswa').trim(),
              PenerimaID: String(data.penerimaId || 'ALL').trim(),
              PenerimaNama: String(data.penerimaNama || 'Semua Siswa').trim(),
              Pesan: cleanPesan,
              Waktu: new Date().toISOString(),
              Tipe: String(data.tipe || 'teks').trim(),
              Lampiran: String(data.lampiran || '').trim()
            };
            await ensureDbLoaded();
            const cur = baca_('Pesan');
            cur.push(newMsg);
            tulis_('Pesan', cur);

            broadcastChatMessage(newMsg);
          }
        } catch (err) {
          console.error('WS Chat Error:', err);
        }
      });

      ws.on('close', () => {
        chatClients.delete(clientInfo);
      });
    });

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT} [${detectStorageEngine().label}]`);
      if (process.env.NODE_ENV !== 'production') {
        import('vite')
          .then(({ createServer: createViteServer }) =>
            createViteServer({
              plugins:
                process.env.DISABLE_HMR === 'true'
                  ? [
                      {
                        name: 'disable-hmr-ws-client',
                        transform(code: string, id: string) {
                          if (id.replace(/\\/g, '/').includes('vite/dist/client/client.mjs')) {
                            return {
                              code: code.replace(
                                /createConnection:\s*\(\)\s*=>\s*new WebSocket\([^)]+\)/g,
                                'createConnection: () => ({ readyState: 1, OPEN: 1, addEventListener() {}, send() {}, close() {} })'
                              ),
                              map: null
                            };
                          }
                        }
                      }
                    ]
                  : undefined,
              server: {
                middlewareMode: true,
                allowedHosts: true,
                hmr: process.env.DISABLE_HMR !== 'true',
                ws: process.env.DISABLE_HMR === 'true' ? false : { server }
              },
              appType: 'spa'
            })
          )
          .then(vite => {
            viteMiddleware = vite.middlewares;
          })
          .catch(err => {
            console.error('Failed to initialize Vite dev middleware:', err);
          });
      }
    });
  }

  return app;
}

export const appPromise = startServer();
export default appPromise;

