import React, { useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { avatarColorFor } from '../constants';
import { prosesFotoSiswa } from '../api';

export interface SiswaFormPayload {
  Nama: string;
  NIS: string;
  TempatLahir: string;
  TanggalLahir: string;
  JenisKelamin: string;
  NoSiswa: string;
  NoOrtu: string;
  Alamat: string;
  Kesehatan: string;
  Foto: string;
}

interface SiswaEditorModalBodyProps {
  initial: any;
  onCancel: () => void;
  onSubmit: (payload: SiswaFormPayload) => Promise<void> | void;
  showToast: (msg: string, ms?: number) => void;
}

export const SiswaEditorModalBody: React.FC<SiswaEditorModalBodyProps> = ({
  initial,
  onCancel,
  onSubmit,
  showToast
}) => {
  const [nama, setNama] = useState(String(initial?.Nama || ''));
  const [nis, setNis] = useState(String(initial?.NIS || ''));
  const [tempatLahir, setTempatLahir] = useState(String(initial?.TempatLahir || ''));
  const [tanggalLahir, setTanggalLahir] = useState(String(initial?.TanggalLahir || ''));
  const [jenisKelamin, setJenisKelamin] = useState(String(initial?.JenisKelamin || ''));
  const [noSiswa, setNoSiswa] = useState(String(initial?.NoSiswa || initial?.KontakOrtu || ''));
  const [noOrtu, setNoOrtu] = useState(String(initial?.NoOrtu || ''));
  const [alm, setAlm] = useState(String(initial?.Alamat || ''));
  const [kes, setKes] = useState(String(initial?.Kesehatan || ''));
  const [foto, setFoto] = useState(String(initial?.Foto || ''));
  const [processingFoto, setProcessingFoto] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setProcessingFoto(true);
    try {
      const dataUrl = await prosesFotoSiswa(file, 256);
      setFoto(dataUrl);
      showToast('Foto profil siswa siap disimpan', 2000);
    } catch (err: any) {
      showToast(err?.message || 'Gagal memproses foto siswa', 3500);
    } finally {
      setProcessingFoto(false);
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Photo Upload Row */}
      <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex flex-wrap items-center gap-4">
        <div className="relative shrink-0">
          {foto ? (
            <img
              src={foto}
              alt={nama || 'Foto Siswa'}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-sm bg-white"
            />
          ) : (
            <div
              className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${avatarColorFor(
                nama || 'Siswa'
              )} text-white text-xl font-bold flex items-center justify-center shadow-sm`}
            >
              {(nama.trim() || 'S').slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-[200px] space-y-1.5">
          <div className="text-xs font-bold text-slate-900">Foto Profil Siswa</div>
          <p className="text-[11px] text-slate-500">
            Format JPG, PNG, atau WebP. Otomatis dipotong &amp; diperkecil agar ringan tersimpan.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <label className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-2xs">
              <Camera className="w-3.5 h-3.5" />
              <span>{processingFoto ? 'Memproses…' : foto ? 'Ganti Foto' : 'Unggah Foto'}</span>
              <input
                type="file"
                accept="image/*"
                disabled={processingFoto || saving}
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            {foto && (
              <button
                type="button"
                disabled={processingFoto || saving}
                onClick={() => setFoto('')}
                className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-xl inline-flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Foto</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-xs font-semibold text-slate-700">
          NIS / NISN (Username Portal Siswa)
          <input
            value={nis}
            placeholder="102601"
            onChange={e => setNis(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          Nama Lengkap
          <input
            value={nama}
            placeholder="Nama lengkap siswa"
            onChange={e => setNama(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block text-xs font-semibold text-slate-700">
          Tempat Lahir
          <input
            value={tempatLahir}
            placeholder="Bandung"
            onChange={e => setTempatLahir(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          Tanggal Lahir
          <input
            type="date"
            value={tanggalLahir}
            onChange={e => setTanggalLahir(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          Jenis Kelamin
          <select
            value={jenisKelamin}
            onChange={e => setJenisKelamin(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
          >
            <option value="">-- Pilih --</option>
            <option value="Laki-laki">Laki-laki</option>
            <option value="Perempuan">Perempuan</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-xs font-semibold text-slate-700">
          No. HP / WA Siswa
          <input
            value={noSiswa}
            placeholder="0812..."
            onChange={e => setNoSiswa(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          No. HP / WA Orang Tua
          <input
            value={noOrtu}
            placeholder="0813..."
            onChange={e => setNoOrtu(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
          />
        </label>
      </div>

      <label className="block text-xs font-semibold text-slate-700">
        Alamat Tempat Tinggal
        <input
          value={alm}
          placeholder="Jl. Nama Jalan No. ..."
          onChange={e => setAlm(e.target.value)}
          className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
      </label>

      <label className="block text-xs font-semibold text-slate-700">
        Catatan Kesehatan
        <input
          value={kes}
          placeholder="Normal / riwayat khusus"
          onChange={e => setKes(e.target.value)}
          className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
      </label>

      <div className="flex justify-end gap-2 pt-3">
        <button
          type="button"
          disabled={saving}
          onClick={onCancel}
          className="px-4 py-2 text-xs font-semibold bg-slate-100 text-slate-700 rounded-lg cursor-pointer"
        >
          Batal
        </button>
        <button
          type="button"
          disabled={saving || processingFoto}
          onClick={async () => {
            if (!nama.trim()) return showToast('Nama siswa wajib diisi');
            setSaving(true);
            try {
              await onSubmit({
                Nama: nama.trim(),
                NIS: nis.trim(),
                TempatLahir: tempatLahir.trim(),
                TanggalLahir: tanggalLahir.trim(),
                JenisKelamin: jenisKelamin,
                NoSiswa: noSiswa.trim(),
                NoOrtu: noOrtu.trim(),
                Alamat: alm.trim(),
                Kesehatan: kes.trim(),
                Foto: foto
              });
            } finally {
              setSaving(false);
            }
          }}
          className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-lg cursor-pointer"
        >
          {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </div>
  );
};
