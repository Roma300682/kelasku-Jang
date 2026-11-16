import React, { useMemo, useRef, useState } from 'react';
import { Upload, Download, FileSpreadsheet, CheckCircle2, X } from 'lucide-react';
import { petaKolom, uid, uraiCSV } from '../api';
import { HARI, STATUS_TP } from '../constants';

export type ImportTableMode = 'siswa' | 'nilai' | 'tp' | 'jadwal';

interface ImportTableModalProps {
  mode: ImportTableMode;
  kelasId: string;
  kelasNama: string;
  db: Record<string, any>;
  onClose: () => void;
  onConfirm: (payload: any) => Promise<void>;
  showToast: (msg: string, ms?: number) => void;
}

function downloadCsv(filename: string, rows: string[][]) {
  const esc = (v: string) => {
    const s = String(v ?? '');
    if (s.includes(';') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const csv = '\uFEFF' + rows.map(r => r.map(esc).join(';')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function normalizeGradeVal(raw: string): string {
  const s = String(raw || '').trim().replace(',', '.');
  if (!s) return '';
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 100) return '__INVALID__';
  return String(Math.round(n * 10) / 10);
}

function normalizeTimeStr(raw: string): string {
  const s = String(raw || '').trim().replace('.', ':');
  const m = s.match(/^(\d{1,2}):(\d{1,2})/);
  if (!m) return '';
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return '';
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function normalizeHari(raw: string): string {
  const low = String(raw || '').trim().toLowerCase();
  const found = HARI.find(h => h.toLowerCase() === low);
  return found || '';
}

function normalizeTanggalLahir(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  return s.slice(0, 20);
}

function normalizeJenisKelamin(raw: string): string {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return '';
  if (s === 'l' || s.startsWith('laki') || s === 'pria' || s === 'm' || s === 'lk') return 'Laki-laki';
  if (s === 'p' || s.startsWith('peremp') || s === 'wanita' || s === 'f' || s === 'pr') return 'Perempuan';
  return '';
}

export default function ImportTableModal({
  mode,
  kelasId,
  kelasNama,
  db,
  onClose,
  onConfirm,
  showToast
}: ImportTableModalProps) {
  const [rawText, setRawText] = useState('');
  const [updateExistingSiswa, setUpdateExistingSiswa] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const siswaK = useMemo(
    () => (db.Siswa || []).filter((s: any) => s.Kelas === kelasId),
    [db.Siswa, kelasId]
  );

  const parsedSiswa = useMemo(() => {
    if (mode !== 'siswa' || !rawText.trim()) return [];
    const rows = uraiCSV(rawText);
    if (!rows.length) return [];

    const firstMap = petaKolom(rows[0]);
    const hasHeader =
      firstMap.nama !== undefined ||
      firstMap.nis !== undefined ||
      firstMap.tempatLahir !== undefined ||
      firstMap.tanggalLahir !== undefined ||
      firstMap.jenisKelamin !== undefined ||
      firstMap.noSiswa !== undefined ||
      firstMap.noOrtu !== undefined ||
      firstMap.alamat !== undefined ||
      firstMap.kesehatan !== undefined;

    const dataRows = hasHeader ? rows.slice(1) : rows;
    const looksNumbered =
      !hasHeader &&
      dataRows.length > 0 &&
      dataRows.every(r => /^\d{1,3}$/.test(String(r[0] || '').trim()) && String(r[1] || '').trim() !== '');

    const col = hasHeader
      ? firstMap
      : looksNumbered
      ? {
          no: 0,
          nis: 1,
          nama: 2,
          tempatLahir: 3,
          tanggalLahir: 4,
          jenisKelamin: 5,
          alamat: 6,
          noSiswa: 7,
          noOrtu: 8,
          kesehatan: 9
        }
      : {
          nis: 0,
          nama: 1,
          tempatLahir: 2,
          tanggalLahir: 3,
          jenisKelamin: 4,
          alamat: 5,
          noSiswa: 6,
          noOrtu: 7,
          kesehatan: 8
        };

    const seenNisBatch = new Set<string>();
    const allSiswa = db.Siswa || [];
    const kelasNamaById = new Map<string, string>(
      (db.Kelas || []).map((k: any) => [String(k.ID || ''), String(k.Nama || '')])
    );

    return dataRows
      .map((r, idx) => {
        const nama = String((col.nama !== undefined ? r[col.nama] : r[0]) || '').trim();
        const nis = String((col.nis !== undefined ? r[col.nis] : '') || '').trim();
        const tempatLahir = String((col.tempatLahir !== undefined ? r[col.tempatLahir] : '') || '').trim();
        const tanggalLahir = normalizeTanggalLahir(col.tanggalLahir !== undefined ? r[col.tanggalLahir] || '' : '');
        const jenisKelamin = normalizeJenisKelamin(col.jenisKelamin !== undefined ? r[col.jenisKelamin] || '' : '');
        const noSiswa = String((col.noSiswa !== undefined ? r[col.noSiswa] : '') || '').trim();
        const noOrtu = String((col.noOrtu !== undefined ? r[col.noOrtu] : '') || '').trim();
        const alamat = String((col.alamat !== undefined ? r[col.alamat] : '') || '').trim();
        const kesehatan = String((col.kesehatan !== undefined ? r[col.kesehatan] : '') || '').trim() || 'Normal';

        const nisLow = nis.toLowerCase();
        let status: 'baru' | 'perbarui' | 'pindah_update' | 'duplikat_impor' | 'kosong' = 'baru';
        let existingId = '';
        let prevKelasInfo = '';

        if (!nama) {
          status = 'kosong';
        } else if (nisLow) {
          if (seenNisBatch.has(nisLow)) {
            status = 'duplikat_impor';
          } else {
            seenNisBatch.add(nisLow);
            const matchAny = allSiswa.find(
              (s: any) => String(s.NIS || '').trim().toLowerCase() === nisLow
            );
            if (matchAny) {
              existingId = matchAny.ID;
              if (matchAny.Kelas === kelasId) {
                status = 'perbarui';
              } else {
                status = 'pindah_update';
                const prevName = kelasNamaById.get(String(matchAny.Kelas || ''));
                prevKelasInfo = prevName ? `dari ${prevName}` : 'data lama / kelas terhapus';
              }
            }
          }
        }

        return {
          rowNum: idx + 1,
          existingId,
          prevKelasInfo,
          nama,
          nis,
          tempatLahir,
          tanggalLahir,
          jenisKelamin,
          noSiswa,
          noOrtu,
          alamat,
          kesehatan,
          status
        };
      })
      .filter(x => x.status !== 'kosong');
  }, [mode, rawText, db.Siswa, db.Kelas, kelasId]);

  const parsedNilai = useMemo(() => {
    if (mode !== 'nilai' || !rawText.trim()) return [];
    const rows = uraiCSV(rawText);
    if (!rows.length) return [];

    const firstMap = petaKolom(rows[0]);
    const hasHeader =
      firstMap.nis !== undefined ||
      firstMap.nama !== undefined ||
      firstMap.Sikap !== undefined ||
      firstMap.Tugas !== undefined ||
      firstMap.Proyek !== undefined ||
      firstMap.UTS !== undefined ||
      firstMap.UAS !== undefined;

    const dataRows = hasHeader ? rows.slice(1) : rows;
    const looksWithNo =
      !hasHeader &&
      dataRows.length > 0 &&
      /^\d{1,3}$/.test(String(dataRows[0][0] || '').trim()) &&
      dataRows[0].length >= 7;

    const col = hasHeader
      ? firstMap
      : looksWithNo
      ? { no: 0, nis: 1, nama: 2, Sikap: 3, Tugas: 4, Proyek: 5, UTS: 6, UAS: 7 }
      : { nis: 0, nama: 1, Sikap: 2, Tugas: 3, Proyek: 4, UTS: 5, UAS: 6 };

    return dataRows.map((r, idx) => {
      const nisRaw = String((col.nis !== undefined ? r[col.nis] : '') || '').trim();
      const namaRaw = String((col.nama !== undefined ? r[col.nama] : '') || '').trim();

      const byNis = nisRaw
        ? siswaK.find((s: any) => String(s.NIS || '').trim().toLowerCase() === nisRaw.toLowerCase())
        : null;
      const byNama = !byNis && namaRaw
        ? siswaK.find((s: any) => String(s.Nama || '').trim().toLowerCase() === namaRaw.toLowerCase())
        : null;
      const student = byNis || byNama || null;

      const Sikap = normalizeGradeVal(col.Sikap !== undefined ? r[col.Sikap] || '' : '');
      const Tugas = normalizeGradeVal(col.Tugas !== undefined ? r[col.Tugas] || '' : '');
      const Proyek = normalizeGradeVal(col.Proyek !== undefined ? r[col.Proyek] || '' : '');
      const UTS = normalizeGradeVal(col.UTS !== undefined ? r[col.UTS] || '' : '');
      const UAS = normalizeGradeVal(col.UAS !== undefined ? r[col.UAS] || '' : '');

      const hasInvalid = [Sikap, Tugas, Proyek, UTS, UAS].some(v => v === '__INVALID__');

      return {
        rowNum: idx + 1,
        nis: nisRaw || student?.NIS || '',
        nama: student?.Nama || namaRaw,
        siswaId: student?.ID || '',
        matchVia: byNis ? 'NIS' : byNama ? 'Nama' : '',
        Sikap,
        Tugas,
        Proyek,
        UTS,
        UAS,
        valid: Boolean(student) && !hasInvalid,
        errorReason: !student
          ? 'Siswa tidak ditemukan di kelas ini'
          : hasInvalid
          ? 'Nilai harus angka 0–100'
          : ''
      };
    });
  }, [mode, rawText, siswaK]);

  const parsedTp = useMemo(() => {
    if (mode !== 'tp' || !rawText.trim()) return [];
    const rows = uraiCSV(rawText);
    if (!rows.length) return [];

    const firstMap = petaKolom(rows[0]);
    const hasHeader =
      firstMap.kode !== undefined ||
      firstMap.tujuan !== undefined ||
      firstMap.materi !== undefined ||
      firstMap.status !== undefined;

    const dataRows = hasHeader ? rows.slice(1) : rows;
    const col = hasHeader ? firstMap : { kode: 0, tujuan: 1, materi: 2, status: 3 };

    const validStatuses = Object.keys(STATUS_TP);
    return dataRows
      .map((r, idx) => {
        const kode = String((col.kode !== undefined ? r[col.kode] : '') || '').trim() || `TP ${idx + 1}`;
        const tujuan = String((col.tujuan !== undefined ? r[col.tujuan] : r[1] || r[0]) || '').trim();
        const materi = String((col.materi !== undefined ? r[col.materi] : '') || '').trim();
        const statusRaw = String((col.status !== undefined ? r[col.status] : '') || '').trim();
        const status =
          validStatuses.find(s => s.toLowerCase() === statusRaw.toLowerCase()) || 'Belum';
        return {
          rowNum: idx + 1,
          kode,
          tujuan,
          materi,
          status,
          valid: Boolean(tujuan)
        };
      })
      .filter(x => x.tujuan);
  }, [mode, rawText]);

  const parsedJadwal = useMemo(() => {
    if (mode !== 'jadwal' || !rawText.trim()) return [];
    const rows = uraiCSV(rawText);
    if (!rows.length) return [];

    const firstMap = petaKolom(rows[0]);
    const hasHeader =
      firstMap.hari !== undefined ||
      firstMap.mulai !== undefined ||
      firstMap.selesai !== undefined ||
      firstMap.mapel !== undefined;

    const dataRows = hasHeader ? rows.slice(1) : rows;
    const col = hasHeader
      ? firstMap
      : { hari: 0, mulai: 1, selesai: 2, mapel: 3, guru: 4, jenis: 5 };

    return dataRows.map((r, idx) => {
      const hari = normalizeHari(col.hari !== undefined ? r[col.hari] || '' : '');
      const mulai = normalizeTimeStr(col.mulai !== undefined ? r[col.mulai] || '' : '');
      const selesai = normalizeTimeStr(col.selesai !== undefined ? r[col.selesai] || '' : '');
      const mapel = String((col.mapel !== undefined ? r[col.mapel] : '') || '').trim();
      const guru = String((col.guru !== undefined ? r[col.guru] : '') || '').trim();
      const jenisRaw = String((col.jenis !== undefined ? r[col.jenis] : '') || '').trim().toLowerCase();
      const jenis = jenisRaw.includes('istirahat')
        ? 'Istirahat'
        : jenisRaw.includes('lain')
        ? 'Kegiatan lain'
        : 'Pelajaran';

      let errorReason = '';
      if (!hari) errorReason = 'Hari tidak valid (Senin–Sabtu)';
      else if (!mulai || !selesai || mulai >= selesai) errorReason = 'Format jam Mulai/Selesai tidak valid';
      else if (!mapel) errorReason = 'Mata pelajaran kosong';

      return {
        rowNum: idx + 1,
        hari,
        mulai,
        selesai,
        mapel,
        guru,
        jenis,
        valid: !errorReason,
        errorReason
      };
    });
  }, [mode, rawText]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRawText(String(reader.result || ''));
      showToast(`Berkas "${file.name}" dimuat. Periksa pratinjau tabel sebelum menyimpan.`);
    };
    reader.onerror = () => showToast('Gagal membaca berkas CSV/TSV');
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const handleDownloadTemplate = () => {
    const safeKelas = (kelasNama || 'Kelas').replace(/[^a-zA-Z0-9_-]/g, '_');
    if (mode === 'siswa') {
      downloadCsv(`Template_Siswa_${safeKelas}.csv`, [
        ['No', 'NIS', 'Nama Lengkap', 'Tempat Lahir', 'Tanggal Lahir', 'Jenis Kelamin', 'Alamat', 'No. HP Siswa', 'No. HP Orang Tua', 'Kesehatan'],
        ['1', '102601', 'Andi Pratama', 'Bandung', '2010-03-14', 'Laki-laki', 'Jl. Melati No. 5', '081234567801', '081398765001', 'Normal'],
        ['2', '102602', 'Siti Rahma', 'Bogor', '2010-05-22', 'Perempuan', 'Jl. Kenanga No. 12', '081234567802', '081398765002', 'Asma ringan']
      ]);
      showToast('Template CSV Siswa berhasil diunduh');
      return;
    }
    if (mode === 'nilai') {
      const existingNilai = (db.Nilai || []).filter((n: any) => n.Kelas === kelasId);
      const rows = siswaK.length
        ? siswaK.map((s: any, i: number) => {
            const nr = existingNilai.find((n: any) => n.SiswaID === s.ID) || {};
            return [
              String(i + 1),
              String(s.NIS || ''),
              String(s.Nama || ''),
              String(nr.Sikap || ''),
              String(nr.Tugas || ''),
              String(nr.Proyek || ''),
              String(nr.UTS || ''),
              String(nr.UAS || '')
            ];
          })
        : [['1', '102601', 'Nama Siswa Contoh', '90', '85', '88', '82', '86']];
      downloadCsv(`Template_Nilai_${safeKelas}.csv`, [
        ['No', 'NIS', 'Nama Siswa', 'Sikap', 'Tugas', 'Proyek', 'UTS', 'UAS'],
        ...rows
      ]);
      showToast('Template CSV Nilai berhasil diunduh');
      return;
    }
    if (mode === 'tp') {
      downloadCsv(`Template_TP_${safeKelas}.csv`, [
        ['Kode', 'Tujuan Pembelajaran', 'Materi Pokok', 'Status'],
        ['TP 1', 'Peserta didik mampu menjelaskan konsep dasar materi.', 'Konsep Dasar', 'Belum'],
        ['TP 2', 'Peserta didik mampu menyelesaikan studi kasus kontekstual.', 'Aplikasi Kontekstual', 'Berjalan']
      ]);
      showToast('Template CSV Tujuan Pembelajaran berhasil diunduh');
      return;
    }
    downloadCsv(`Template_Jadwal_${safeKelas}.csv`, [
      ['Hari', 'Mulai', 'Selesai', 'Mata Pelajaran', 'Guru', 'Jenis'],
      ['Senin', '07:00', '08:30', 'Matematika', 'Nama Guru', 'Pelajaran'],
      ['Senin', '08:30', '08:45', 'Istirahat Pagi', '', 'Istirahat']
    ]);
    showToast('Template CSV Jadwal berhasil diunduh');
  };

  const validCount =
    mode === 'siswa'
      ? parsedSiswa.filter(
          x =>
            x.status === 'baru' ||
            ((x.status === 'perbarui' || x.status === 'pindah_update') && updateExistingSiswa)
        ).length
      : mode === 'nilai'
      ? parsedNilai.filter(x => x.valid).length
      : mode === 'tp'
      ? parsedTp.filter(x => x.valid).length
      : parsedJadwal.filter(x => x.valid).length;

  const handleApply = async () => {
    if (validCount === 0) {
      showToast('Tidak ada baris data valid untuk diimpor.');
      return;
    }
    setSaving(true);
    try {
      if (mode === 'siswa') {
        const nextSiswa = [...(db.Siswa || [])];
        let added = 0;
        let updated = 0;
        parsedSiswa.forEach(item => {
          if (item.status === 'baru') {
            nextSiswa.push({
              ID: uid(),
              Kelas: kelasId,
              Nama: item.nama,
              NIS: item.nis,
              TempatLahir: item.tempatLahir,
              TanggalLahir: item.tanggalLahir,
              JenisKelamin: item.jenisKelamin,
              NoSiswa: item.noSiswa,
              NoOrtu: item.noOrtu,
              Alamat: item.alamat,
              Kesehatan: item.kesehatan
            });
            added++;
          } else if (
            (item.status === 'perbarui' || item.status === 'pindah_update') &&
            updateExistingSiswa &&
            item.existingId
          ) {
            const idx = nextSiswa.findIndex(x => x.ID === item.existingId);
            if (idx >= 0) {
              nextSiswa[idx] = {
                ...nextSiswa[idx],
                Kelas: kelasId,
                Nama: item.nama,
                NIS: item.nis,
                TempatLahir: item.tempatLahir || nextSiswa[idx].TempatLahir || '',
                TanggalLahir: item.tanggalLahir || nextSiswa[idx].TanggalLahir || '',
                JenisKelamin: item.jenisKelamin || nextSiswa[idx].JenisKelamin || '',
                NoSiswa: item.noSiswa || nextSiswa[idx].NoSiswa || '',
                NoOrtu: item.noOrtu || nextSiswa[idx].NoOrtu || '',
                Alamat: item.alamat || nextSiswa[idx].Alamat || '',
                Kesehatan: item.kesehatan || nextSiswa[idx].Kesehatan || 'Normal'
              };
              updated++;
            }
          }
        });
        await onConfirm({ nextSiswa, added, updated });
      } else if (mode === 'nilai') {
        const nextNilai = [...(db.Nilai || [])];
        let count = 0;
        parsedNilai
          .filter(x => x.valid)
          .forEach(item => {
            const idx = nextNilai.findIndex(
              n => n.Kelas === kelasId && n.SiswaID === item.siswaId
            );
            const cur =
              idx >= 0
                ? { ...nextNilai[idx] }
                : {
                    Kelas: kelasId,
                    SiswaID: item.siswaId,
                    Sikap: '',
                    Tugas: '',
                    Proyek: '',
                    UTS: '',
                    UAS: ''
                  };
            if (item.Sikap !== '') cur.Sikap = item.Sikap;
            if (item.Tugas !== '') cur.Tugas = item.Tugas;
            if (item.Proyek !== '') cur.Proyek = item.Proyek;
            if (item.UTS !== '') cur.UTS = item.UTS;
            if (item.UAS !== '') cur.UAS = item.UAS;
            if (idx >= 0) nextNilai[idx] = cur;
            else nextNilai.push(cur);
            count++;
          });
        await onConfirm({ nextNilai, count });
      } else if (mode === 'tp') {
        const addedRows = parsedTp
          .filter(x => x.valid)
          .map(x => ({
            ID: uid(),
            Kelas: kelasId,
            Kode: x.kode,
            Tujuan: x.tujuan,
            Materi: x.materi,
            Status: x.status
          }));
        await onConfirm({ nextTp: [...(db.TP || []), ...addedRows], count: addedRows.length });
      } else {
        const addedRows = parsedJadwal
          .filter(x => x.valid)
          .map(x => ({
            ID: uid(),
            Kelas: kelasId,
            Hari: x.hari,
            Mulai: x.mulai,
            Selesai: x.selesai,
            Mapel: x.mapel,
            Guru: x.guru,
            Jenis: x.jenis,
            Pekan: ''
          }));
        await onConfirm({
          nextJadwal: [...(db.Jadwal || []), ...addedRows],
          count: addedRows.length
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const titleMap: Record<ImportTableMode, string> = {
    siswa: `Impor Data Siswa — ${kelasNama}`,
    nilai: `Impor Pengolahan Nilai Induk — ${kelasNama}`,
    tp: `Impor Tujuan Pembelajaran — ${kelasNama}`,
    jadwal: `Impor Jadwal Pelajaran — ${kelasNama}`
  };

  const formatHintMap: Record<ImportTableMode, { cols: string[]; placeholder: string }> = {
    siswa: {
      cols: ['NIS', 'Nama Lengkap', 'Tempat Lahir', 'Tanggal Lahir', 'Jenis Kelamin', 'Alamat', 'No. HP Siswa', 'No. HP Orang Tua', 'Kesehatan'],
      placeholder:
        'NIS;Nama Lengkap;Tempat Lahir;Tanggal Lahir;Jenis Kelamin;Alamat;No. HP Siswa;No. HP Orang Tua;Kesehatan\n102601;Andi Pratama;Bandung;2010-03-14;Laki-laki;Jl. Melati No. 5;081234567801;081398765001;Normal'
    },
    nilai: {
      cols: ['No', 'NIS', 'Nama Siswa', 'Sikap', 'Tugas', 'Proyek', 'UTS', 'UAS'],
      placeholder:
        'No;NIS;Nama Siswa;Sikap;Tugas;Proyek;UTS;UAS\n1;102601;Andi Pratama;92;88;90;84;86'
    },
    tp: {
      cols: ['Kode', 'Tujuan Pembelajaran', 'Materi Pokok', 'Status'],
      placeholder:
        'Kode;Tujuan Pembelajaran;Materi Pokok;Status\nTP 1;Peserta didik mampu menjelaskan konsep eksponen.;Eksponen;Belum'
    },
    jadwal: {
      cols: ['Hari', 'Mulai', 'Selesai', 'Mata Pelajaran', 'Guru', 'Jenis'],
      placeholder:
        'Hari;Mulai;Selesai;Mata Pelajaran;Guru;Jenis\nSenin;07:00;08:30;Matematika;Dra. Ratna Sari;Pelajaran'
    }
  };

  const hint = formatHintMap[mode];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{titleMap[mode]}</h3>
              <p className="text-[11px] text-slate-500">
                Mendukung unggah berkas CSV/TSV atau salin-tempel langsung dari Excel & Google Sheets (pemisah koma, titik koma, atau Tab).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          {/* Expected table columns + actions */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold text-slate-700">
                Kolom sesuai tabel aplikasi (header terdeteksi otomatis):
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Unduh Template CSV
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" /> Pilih Berkas CSV / TSV
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {hint.cols.map(c => (
                <span
                  key={c}
                  className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-white border border-slate-200 rounded-md text-slate-700"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>

          <textarea
            rows={5}
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            placeholder={hint.placeholder}
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          {mode === 'siswa' && (
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={updateExistingSiswa}
                onChange={e => setUpdateExistingSiswa(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600"
              />
              Sistem UPSERT aktif: otomatis perbarui data &amp; masukkan ke kelas {kelasNama} jika NIS sudah ada di database
            </label>
          )}

          {/* Live Preview Table */}
          {rawText.trim() !== '' && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-slate-800">Pratinjau Hasil Pemetaan Kolom</span>
                <span className="font-semibold text-emerald-700 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {validCount} baris siap diimpor
                </span>
              </div>
              <div className="overflow-x-auto max-h-60">
                {mode === 'siswa' && (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3">NIS</th>
                        <th className="py-2 px-3">Nama Lengkap</th>
                        <th className="py-2 px-3">Tempat, Tgl Lahir</th>
                        <th className="py-2 px-3">JK</th>
                        <th className="py-2 px-3">Alamat</th>
                        <th className="py-2 px-3">No. HP Siswa</th>
                        <th className="py-2 px-3">No. HP Orang Tua</th>
                        <th className="py-2 px-3">Kesehatan</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedSiswa.map(row => (
                        <tr key={row.rowNum} className="hover:bg-slate-50">
                          <td className="py-1.5 px-3 text-slate-400 tabular-nums">{row.rowNum}</td>
                          <td className="py-1.5 px-3 font-mono text-indigo-700">{row.nis || '-'}</td>
                          <td className="py-1.5 px-3 font-semibold text-slate-900">{row.nama}</td>
                          <td className="py-1.5 px-3 text-slate-600 whitespace-nowrap">
                            {[row.tempatLahir, row.tanggalLahir].filter(Boolean).join(', ') || '-'}
                          </td>
                          <td className="py-1.5 px-3 text-slate-600 whitespace-nowrap">{row.jenisKelamin || '-'}</td>
                          <td className="py-1.5 px-3 text-slate-600">{row.alamat || '-'}</td>
                          <td className="py-1.5 px-3 font-mono text-slate-600">{row.noSiswa || '-'}</td>
                          <td className="py-1.5 px-3 font-mono text-slate-600">{row.noOrtu || '-'}</td>
                          <td className="py-1.5 px-3 text-slate-600">{row.kesehatan}</td>
                          <td className="py-1.5 px-3 whitespace-nowrap">
                            {row.status === 'baru' && (
                              <span className="text-emerald-700 font-semibold">Baru (Insert)</span>
                            )}
                            {row.status === 'perbarui' && (
                              <span className="text-sky-700 font-semibold">
                                {updateExistingSiswa ? 'Perbarui (Update)' : 'Dilewati (NIS ada)'}
                              </span>
                            )}
                            {row.status === 'pindah_update' && (
                              <span className="text-indigo-700 font-semibold">
                                {updateExistingSiswa
                                  ? `UPSERT → Pindah ke ${kelasNama} (${row.prevKelasInfo})`
                                  : 'Dilewati (NIS ada)'}
                              </span>
                            )}
                            {row.status === 'duplikat_impor' && (
                              <span className="text-amber-700 font-semibold">Duplikat di berkas</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {mode === 'nilai' && (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3">NIS</th>
                        <th className="py-2 px-3">Nama Siswa</th>
                        <th className="py-2 px-3 text-center">Sikap</th>
                        <th className="py-2 px-3 text-center">Tugas</th>
                        <th className="py-2 px-3 text-center">Proyek</th>
                        <th className="py-2 px-3 text-center">UTS</th>
                        <th className="py-2 px-3 text-center">UAS</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedNilai.map(row => (
                        <tr key={row.rowNum} className="hover:bg-slate-50">
                          <td className="py-1.5 px-3 text-slate-400 tabular-nums">{row.rowNum}</td>
                          <td className="py-1.5 px-3 font-mono text-indigo-700">{row.nis || '-'}</td>
                          <td className="py-1.5 px-3 font-semibold text-slate-900">{row.nama || '-'}</td>
                          <td className="py-1.5 px-3 text-center font-mono">{row.Sikap || '·'}</td>
                          <td className="py-1.5 px-3 text-center font-mono">{row.Tugas || '·'}</td>
                          <td className="py-1.5 px-3 text-center font-mono">{row.Proyek || '·'}</td>
                          <td className="py-1.5 px-3 text-center font-mono">{row.UTS || '·'}</td>
                          <td className="py-1.5 px-3 text-center font-mono">{row.UAS || '·'}</td>
                          <td className="py-1.5 px-3 whitespace-nowrap">
                            {row.valid ? (
                              <span className="text-emerald-700 font-semibold">
                                Cocok via {row.matchVia}
                              </span>
                            ) : (
                              <span className="text-rose-600 font-semibold">{row.errorReason}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {mode === 'tp' && (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="py-2 px-3">Kode</th>
                        <th className="py-2 px-3">Tujuan Pembelajaran</th>
                        <th className="py-2 px-3">Materi Pokok</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedTp.map(row => (
                        <tr key={row.rowNum} className="hover:bg-slate-50">
                          <td className="py-1.5 px-3 font-bold text-slate-900">{row.kode}</td>
                          <td className="py-1.5 px-3 text-slate-800">{row.tujuan}</td>
                          <td className="py-1.5 px-3 text-slate-600">{row.materi || '-'}</td>
                          <td className="py-1.5 px-3 font-semibold text-indigo-700">{row.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {mode === 'jadwal' && (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="py-2 px-3">Hari</th>
                        <th className="py-2 px-3">Mulai–Selesai</th>
                        <th className="py-2 px-3">Mata Pelajaran</th>
                        <th className="py-2 px-3">Guru</th>
                        <th className="py-2 px-3">Jenis</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedJadwal.map(row => (
                        <tr key={row.rowNum} className="hover:bg-slate-50">
                          <td className="py-1.5 px-3 font-semibold text-slate-900">{row.hari || '-'}</td>
                          <td className="py-1.5 px-3 font-mono text-slate-700">
                            {row.mulai || '?'}–{row.selesai || '?'}
                          </td>
                          <td className="py-1.5 px-3 text-slate-800">{row.mapel || '-'}</td>
                          <td className="py-1.5 px-3 text-slate-600">{row.guru || '-'}</td>
                          <td className="py-1.5 px-3 text-slate-600">{row.jenis}</td>
                          <td className="py-1.5 px-3 whitespace-nowrap">
                            {row.valid ? (
                              <span className="text-emerald-700 font-semibold">Valid</span>
                            ) : (
                              <span className="text-rose-600 font-semibold">{row.errorReason}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50/70 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-xl cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={saving || validCount === 0}
            onClick={handleApply}
            className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            {saving ? 'Menyimpan…' : `Impor ${validCount} Baris Sekarang`}
          </button>
        </div>
      </div>
    </div>
  );
}
