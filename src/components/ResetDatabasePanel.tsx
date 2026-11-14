import React, { useEffect, useState } from 'react';
import {
  Database,
  RotateCcw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Download,
  Upload,
  ShieldCheck,
  Clock,
  HardDriveDownload,
  ArchiveRestore
} from 'lucide-react';
import { pesanErr } from '../api';

export interface BackupSnapshotMeta {
  id: string;
  createdAt: string;
  label: string;
  storageLabel?: string;
  stats?: {
    kelas?: number;
    siswa?: number;
    absensi?: number;
    nilai?: number;
    tp?: number;
    modul?: number;
  };
}

interface ResetDatabasePanelProps {
  db: Record<string, any>;
  onResetAll: (opts: {
    resetKelas: boolean;
    resetMapel: boolean;
    resetPengguna: boolean;
    resetPengaturan: boolean;
  }) => Promise<void>;
  onResetPartial: (category: string, label: string) => Promise<void>;
  onResetDemo: () => Promise<void>;
  onExportBackup: (includeFiles: boolean) => Promise<any>;
  onRestoreBackup: (backupData: any, opts: { keepCurrentAdmin: boolean }) => Promise<void>;
  onListSnapshots: () => Promise<BackupSnapshotMeta[]>;
  onCreateSnapshot: (label: string) => Promise<BackupSnapshotMeta[]>;
  onDownloadSnapshot: (snapshotId: string) => Promise<any>;
  onRestoreSnapshot: (snapshotId: string) => Promise<void>;
  onDeleteSnapshot: (snapshotId: string) => Promise<BackupSnapshotMeta[]>;
  askConfirm: (msg: string) => Promise<boolean>;
  showToast: (msg: string, ms?: number) => void;
}

const PARTIAL_CATEGORIES = [
  {
    id: 'absensi',
    title: 'Absensi & Kehadiran',
    desc: 'Hapus seluruh riwayat absensi harian dan keterlambatan semua kelas.'
  },
  {
    id: 'nilai_tugas',
    title: 'Tugas, Pengumpulan & Nilai',
    desc: 'Hapus seluruh daftar tugas, pengumpulan siswa, dan rekap nilai.'
  },
  {
    id: 'cbt',
    title: 'Ujian CBT & Hasil AI',
    desc: 'Hapus seluruh paket soal CBT beserta riwayat nilai ujian siswa.'
  },
  {
    id: 'operasional_kelas',
    title: 'Denah, Piket, Struktur & Jadwal',
    desc: 'Kosongkan denah duduk, piket, pengurus kelas, dan jadwal pelajaran.'
  },
  {
    id: 'perangkat_ajar',
    title: 'Perangkat Ajar (TP, Modul, Pemantik)',
    desc: 'Hapus seluruh Tujuan Pembelajaran, Modul Ajar, dan Slide Pemantik.'
  },
  {
    id: 'kalender',
    title: 'Kalender Akademik',
    desc: 'Kosongkan agenda kalender pendidikan (dapat disinkron ulang dengan Jabar).'
  },
  {
    id: 'siswa',
    title: 'Data Siswa & PIN Portal',
    desc: 'Hapus seluruh daftar siswa beserta akun PIN masuk Portal Siswa.'
  }
];

function triggerJsonDownload(obj: any, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fmtTanggalWaktu(iso?: string): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return iso;
  }
}

export default function ResetDatabasePanel({
  db,
  onResetAll,
  onResetPartial,
  onResetDemo,
  onExportBackup,
  onRestoreBackup,
  onListSnapshots,
  onCreateSnapshot,
  onDownloadSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  askConfirm,
  showToast
}: ResetDatabasePanelProps) {
  const [busy, setBusy] = useState(false);

  // Backup & Restore state
  const [includeFiles, setIncludeFiles] = useState(true);
  const [keepCurrentAdmin, setKeepCurrentAdmin] = useState(true);
  const [pendingBackupName, setPendingBackupName] = useState('');
  const [pendingBackupObj, setPendingBackupObj] = useState<any>(null);

  // Snapshots state
  const [snapshots, setSnapshots] = useState<BackupSnapshotMeta[]>([]);
  const [loadingSnap, setLoadingSnap] = useState(false);
  const [snapshotLabel, setSnapshotLabel] = useState('');

  // Full wipe safeguards
  const [confirmText, setConfirmText] = useState('');
  const [resetKelas, setResetKelas] = useState(false);
  const [resetMapel, setResetMapel] = useState(false);
  const [resetPengguna, setResetPengguna] = useState(false);
  const [resetPengaturan, setResetPengaturan] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingSnap(true);
    onListSnapshots()
      .then(list => {
        if (active && Array.isArray(list)) setSnapshots(list);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingSnap(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const localStats = [
    ['Kelas', (db.Kelas || []).length],
    ['Siswa', (db.Siswa || []).length],
    ['Absensi', (db.Absensi || []).length],
    ['Tugas', (db.Tugas || []).length],
    ['Nilai', (db.Nilai || []).length],
    ['TP / Modul', (db.TP || []).length + (db.Modul || []).length],
    ['Jadwal', (db.Jadwal || []).length],
    ['CBT', (db.CBT || []).length]
  ];

  async function handleDownloadBackup() {
    setBusy(true);
    try {
      const bundle = await onExportBackup(includeFiles);
      const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(/:/g, '-');
      triggerJsonDownload(bundle, `kelasku-backup-${stamp}.json`);
      const filesCount = Array.isArray(bundle?.files) ? bundle.files.length : 0;
      showToast(
        filesCount > 0
          ? `Backup berhasil diunduh beserta ${filesCount} berkas lampiran`
          : 'Backup basis data berhasil diunduh'
      );
    } catch (e) {
      showToast('Gagal mengunduh backup: ' + pesanErr(e), 4500);
    } finally {
      setBusy(false);
    }
  }

  function handleSelectBackupFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        const sheets =
          parsed?.format === 'kelasku-backup' && parsed?.data?.sheets
            ? parsed.data.sheets
            : parsed?.sheets || parsed?.data?.sheets;
        if (!sheets || typeof sheets !== 'object') {
          showToast('File JSON tidak dikenali sebagai backup KelasKU.', 4000);
          return;
        }
        setPendingBackupObj(parsed);
        setPendingBackupName(file.name);
        showToast(`Berkas "${file.name}" siap dipulihkan`, 3000);
      } catch {
        showToast('Format JSON tidak valid atau file rusak.', 4000);
      }
    };
    reader.readAsText(file);
  }

  async function handleApplyRestore() {
    if (!pendingBackupObj) return;
    const ok = await askConfirm(
      `Pulihkan basis data dari "${pendingBackupName}"? Data saat ini akan digantikan sesuai isi berkas backup.`
    );
    if (!ok) return;
    setBusy(true);
    try {
      await onRestoreBackup(pendingBackupObj, { keepCurrentAdmin });
      setPendingBackupObj(null);
      setPendingBackupName('');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateSnapshot() {
    setBusy(true);
    try {
      const next = await onCreateSnapshot(snapshotLabel.trim() || 'Snapshot Manual');
      setSnapshots(next);
      setSnapshotLabel('');
      showToast('Snapshot cadangan tersimpan di penyimpanan server');
    } catch (e) {
      showToast('Gagal membuat snapshot: ' + pesanErr(e), 4500);
    } finally {
      setBusy(false);
    }
  }

  const previewSheets =
    pendingBackupObj?.format === 'kelasku-backup' && pendingBackupObj?.data?.sheets
      ? pendingBackupObj.data.sheets
      : pendingBackupObj?.sheets || pendingBackupObj?.data?.sheets || null;

  async function runFullReset() {
    if (confirmText.trim().toUpperCase() !== 'RESET') {
      showToast('Ketik kata RESET terlebih dahulu untuk mengaktifkan tombol reset total.');
      return;
    }
    const ok = await askConfirm(
      'PERINGATAN: Semua data yang dipilih akan dihapus permanen dari basis data aplikasi. Lanjutkan?'
    );
    if (!ok) return;
    setBusy(true);
    try {
      await onResetAll({
        resetKelas,
        resetMapel,
        resetPengguna,
        resetPengaturan
      });
      setConfirmText('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-sky-600 to-teal-600 text-white rounded-2xl p-6 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Backup, Pulihkan & Basis Data</h1>
          <p className="text-xs text-sky-100 mt-1">
            Unduh cadangan data penuh (.json), simpan snapshot di server/Vercel, pulihkan data kapan saja, atau bersihkan data.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            if (
              await askConfirm(
                'Kembalikan seluruh data ke paket pratinjau awal (SMA Negeri 1 Nusantara)?'
              )
            ) {
              setBusy(true);
              try {
                await onResetDemo();
              } finally {
                setBusy(false);
              }
            }
          }}
          className="px-4 py-2 text-xs font-bold bg-white text-indigo-700 hover:bg-sky-50 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" /> Isi Data Demo Awal
        </button>
      </div>

      {/* Database Status Overview */}
      <div className="bg-white border border-indigo-100 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-sky-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Ringkasan Basis Data Aplikasi
                </h2>
                {db.vercelConfigured ? (
                  <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {db.storageLabel || 'Vercel Database Aktif'}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full border bg-sky-50 text-sky-700 border-sky-200 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {db.storageLabel || 'Server Lokal Aktif'} · Siap Vercel DB
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {db.vercelConfigured
                  ? `Seluruh data sekolah, sesi login, berkas lampiran, nilai, jadwal, dan CBT tersimpan persisten di ${db.storageLabel || 'Vercel Storage'}.`
                  : 'Saat ini data tersimpan di server lokal. Untuk deployment Vercel, hubungkan Vercel Postgres, Vercel KV, atau Vercel Blob pada Environment Variables proyek Vercel Anda.'}
              </p>
            </div>
          </div>
        </div>

        {/* Record Counts Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {localStats.map(([label, val]) => (
            <div
              key={String(label)}
              className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-center"
            >
              <div className="text-[11px] font-semibold text-slate-500">{label}</div>
              <div className="text-lg font-extrabold text-slate-900 tabular-nums mt-0.5">{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Backup & Restore Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Export Backup (.json) */}
        <div className="bg-white border border-emerald-200 rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <HardDriveDownload className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Unduh Backup Database (.json)</h2>
                <p className="text-xs text-slate-600 mt-1">
                  Simpan salinan lengkap seluruh data kelas, siswa, akun PIN, absensi, nilai, jadwal, TP, Modul Ajar, dan CBT ke perangkat Anda.
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-emerald-100 bg-emerald-50/50 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeFiles}
                onChange={e => setIncludeFiles(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600"
              />
              <span>Sertakan berkas lampiran terunggah (TP, Modul Ajar, Tugas, Berkas Cloud)</span>
            </label>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={handleDownloadBackup}
            className="w-full py-2.5 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4" />
            {busy ? 'Menyiapkan Berkas Backup…' : 'Unduh File Backup Sekarang (.json)'}
          </button>
        </div>

        {/* Restore Backup (.json) */}
        <div className="bg-white border border-sky-200 rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                <ArchiveRestore className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Pulihkan (Restore) dari Backup</h2>
                <p className="text-xs text-slate-600 mt-1">
                  Pilih berkas <code className="px-1 py-0.5 bg-slate-100 rounded text-[11px]">.json</code> hasil backup KelasKU untuk mengembalikan seluruh data dan lampiran.
                </p>
              </div>
            </div>

            <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-sky-300 bg-sky-50/40 hover:bg-sky-50 text-xs font-semibold text-sky-800 cursor-pointer transition-colors">
              <Upload className="w-4 h-4" />
              <span>{pendingBackupName ? `Terpilih: ${pendingBackupName}` : 'Pilih Berkas Backup (.json)'}</span>
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleSelectBackupFile(f);
                  e.target.value = '';
                }}
              />
            </label>

            {previewSheets && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                <div className="font-bold text-slate-800 flex items-center justify-between gap-2">
                  <span>Pratinjau Isi Backup</span>
                  {pendingBackupObj?.createdAt && (
                    <span className="text-[11px] font-normal text-slate-500">
                      {fmtTanggalWaktu(pendingBackupObj.createdAt)}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-600">
                  <div>Kelas: <strong>{(previewSheets.Kelas || []).length}</strong></div>
                  <div>Siswa: <strong>{(previewSheets.Siswa || []).length}</strong></div>
                  <div>Nilai: <strong>{(previewSheets.Nilai || []).length}</strong></div>
                  <div>TP/Modul: <strong>{(previewSheets.TP || []).length + (previewSheets.Modul || []).length}</strong></div>
                  <div>CBT: <strong>{(previewSheets.CBT || []).length}</strong></div>
                  <div>Berkas: <strong>{Array.isArray(pendingBackupObj?.files) ? pendingBackupObj.files.length : 0}</strong></div>
                </div>
                <label className="flex items-center gap-2 pt-1 text-[11px] font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={keepCurrentAdmin}
                    onChange={e => setKeepCurrentAdmin(e.target.checked)}
                    className="rounded text-sky-600"
                  />
                  <span>Pertahankan akun Admin yang sedang login saat ini</span>
                </label>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={busy || !pendingBackupObj}
            onClick={handleApplyRestore}
            className="w-full py-2.5 px-4 text-xs font-bold bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-xl inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            {busy ? 'Memulihkan Basis Data…' : 'Pulihkan Database Sekarang'}
          </button>
        </div>
      </div>

      {/* Snapshot History in Server / Vercel Storage */}
      <div className="bg-white border border-indigo-100 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" /> Snapshot Cadangan Cepat (Server / Vercel)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Simpan hingga 5 titik pemulihan langsung di basis data server/Vercel sebelum melakukan perubahan besar atau reset data.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={snapshotLabel}
              onChange={e => setSnapshotLabel(e.target.value)}
              placeholder="Label (mis. Sebelum Ujian / Kenaikan)"
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs w-56"
            />
            <button
              type="button"
              disabled={busy}
              onClick={handleCreateSnapshot}
              className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl cursor-pointer shadow-xs"
            >
              + Simpan Snapshot Sekarang
            </button>
          </div>
        </div>

        {loadingSnap ? (
          <div className="text-xs text-slate-400 py-4">Memuat daftar snapshot…</div>
        ) : snapshots.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500 text-center">
            Belum ada snapshot tersimpan. Klik <strong>+ Simpan Snapshot Sekarang</strong> untuk membuat cadangan cepat.
          </div>
        ) : (
          <div className="space-y-2.5">
            {snapshots.map(snap => (
              <div
                key={snap.id}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">{snap.label}</div>
                  <div className="text-[11px] text-slate-500">
                    {fmtTanggalWaktu(snap.createdAt)} · Kelas: {snap.stats?.kelas ?? 0} · Siswa: {snap.stats?.siswa ?? 0} · Nilai: {snap.stats?.nilai ?? 0} · TP/Modul: {(snap.stats?.tp ?? 0) + (snap.stats?.modul ?? 0)}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const data = await onDownloadSnapshot(snap.id);
                        const stamp = String(snap.createdAt || '').slice(0, 16).replace('T', '_').replace(/:/g, '-') || snap.id;
                        triggerJsonDownload(data, `kelasku-snapshot-${stamp}.json`);
                        showToast('Snapshot berhasil diunduh');
                      } catch (e) {
                        showToast('Gagal mengunduh snapshot: ' + pesanErr(e));
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="px-2.5 py-1.5 text-[11px] font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3 h-3" /> Unduh
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      if (
                        await askConfirm(
                          `Pulihkan data tabel ke snapshot "${snap.label}" (${fmtTanggalWaktu(snap.createdAt)})?`
                        )
                      ) {
                        setBusy(true);
                        try {
                          await onRestoreSnapshot(snap.id);
                        } finally {
                          setBusy(false);
                        }
                      }
                    }}
                    className="px-2.5 py-1.5 text-[11px] font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-lg inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" /> Pulihkan
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      if (await askConfirm(`Hapus snapshot "${snap.label}"?`)) {
                        setBusy(true);
                        try {
                          const next = await onDeleteSnapshot(snap.id);
                          setSnapshots(next);
                        } finally {
                          setBusy(false);
                        }
                      }
                    }}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                    title="Hapus snapshot"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full Reset Card */}
      <div className="bg-white border-2 border-rose-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-rose-950">
              Reset Semua Data ke Kosong (Bersih / Siap Pakai)
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Menghapus seluruh data siswa, absensi, tugas, pengumpulan, nilai, jurnal perilaku, denah duduk, jadwal piket, struktur kelas, jadwal pelajaran, perangkat ajar, berkas cloud, soal CBT, hasil CBT, dan kalender akademik. Akun login Admin tetap dipertahankan.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={resetKelas}
              onChange={e => setResetKelas(e.target.checked)}
              className="w-4 h-4 rounded text-rose-600"
            />
            Hapus juga Daftar Kelas
          </label>
          <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={resetMapel}
              onChange={e => setResetMapel(e.target.checked)}
              className="w-4 h-4 rounded text-rose-600"
            />
            Hapus juga Mata Pelajaran
          </label>
          <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={resetPengguna}
              onChange={e => setResetPengguna(e.target.checked)}
              className="w-4 h-4 rounded text-rose-600"
            />
            Hapus juga Akun Guru/Wali
          </label>
          <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={resetPengaturan}
              onChange={e => setResetPengaturan(e.target.checked)}
              className="w-4 h-4 rounded text-rose-600"
            />
            Reset Pengaturan Sekolah
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <input
            type="text"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder='Ketik "RESET" untuk konfirmasi'
            className="px-3.5 py-2 border border-rose-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-rose-500 w-64"
          />
          <button
            type="button"
            disabled={busy || confirmText.trim().toUpperCase() !== 'RESET'}
            onClick={runFullReset}
            className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Trash2 className="w-4 h-4" />
            {busy ? 'Mereset Data…' : 'Reset Semua Data Sekarang'}
          </button>
        </div>
      </div>

      {/* Partial Reset Grid */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Reset Parsial per Kategori Data</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Hapus hanya modul tertentu tanpa memengaruhi data lainnya.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {PARTIAL_CATEGORIES.map(cat => (
            <div
              key={cat.id}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between gap-3"
            >
              <div>
                <div className="text-xs font-bold text-slate-900">{cat.title}</div>
                <div className="text-[11px] text-slate-500 mt-1">{cat.desc}</div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (await askConfirm(`Kosongkan seluruh data "${cat.title}"?`)) {
                    setBusy(true);
                    try {
                      await onResetPartial(cat.id, cat.title);
                    } finally {
                      setBusy(false);
                    }
                  }
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Kosongkan Kategori
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
