import React, { useState } from 'react';
import { Download, Paperclip, Sparkles, Trash2, Upload } from 'lucide-react';
import { MODUL_AWAL, STATUS_TP } from '../constants';
import { downloadAjarFile, pesanErr, uploadAjarFile } from '../api';

interface PendingFile {
  namaFile: string;
  mimeType: string;
  base64Data: string;
  size: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function readFileAsBase64(
  file: File,
  showToast: (msg: string, ms?: number) => void,
  onReady: (pf: PendingFile) => void
) {
  if (file.size > 15 * 1024 * 1024) {
    showToast('Ukuran berkas maksimal 15 MB');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const res = String(reader.result || '');
    const base64Data = res.includes(',') ? res.split(',')[1] : res;
    onReady({
      namaFile: file.name,
      mimeType: file.type || 'application/octet-stream',
      base64Data,
      size: file.size
    });
  };
  reader.readAsDataURL(file);
}

interface TpModalFormProps {
  token: string;
  initial?: any;
  defaultKode: string;
  onClose: () => void;
  onSave: (payload: {
    Kode: string;
    Tujuan: string;
    Materi: string;
    Status: string;
    FileID: string;
    NamaFile: string;
  }) => Promise<void>;
  showToast: (msg: string, ms?: number) => void;
}

export const TpModalForm: React.FC<TpModalFormProps> = ({
  token,
  initial,
  defaultKode,
  onClose,
  onSave,
  showToast
}) => {
  const [kode, setKode] = useState<string>(initial?.Kode || defaultKode);
  const [tujuan, setTujuan] = useState<string>(initial?.Tujuan || '');
  const [materi, setMateri] = useState<string>(initial?.Materi || '');
  const [status, setStatus] = useState<string>(initial?.Status || 'Belum');
  const [fileId, setFileId] = useState<string>(initial?.FileID || '');
  const [namaFile, setNamaFile] = useState<string>(initial?.NamaFile || '');
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const tujuanFinal =
      tujuan.trim() ||
      (pendingFile
        ? `Dokumen TP: ${pendingFile.namaFile}`
        : namaFile
          ? `Dokumen TP: ${namaFile}`
          : '');
    if (!tujuanFinal) {
      showToast('Rumusan Tujuan Pembelajaran atau berkas lampiran wajib diisi');
      return;
    }
    setSaving(true);
    try {
      let finalFileId = fileId;
      let finalNamaFile = namaFile;
      if (pendingFile) {
        showToast('Mengunggah berkas TP…', 6000);
        const uploaded = await uploadAjarFile(
          token,
          pendingFile.namaFile,
          pendingFile.mimeType,
          pendingFile.base64Data
        );
        finalFileId = uploaded.fileId;
        finalNamaFile = uploaded.namaFile;
      }
      await onSave({
        Kode: kode.trim() || defaultKode,
        Tujuan: tujuanFinal,
        Materi: materi.trim(),
        Status: status,
        FileID: finalFileId,
        NamaFile: finalNamaFile
      });
    } catch (e) {
      showToast('Gagal menyimpan TP: ' + pesanErr(e), 4500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-xs font-semibold text-slate-700">
          Kode TP
          <input
            value={kode}
            onChange={e => setKode(e.target.value)}
            placeholder="Contoh: TP 1"
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          Status Ketercapaian
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
          >
            {Object.keys(STATUS_TP).map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-xs font-semibold text-slate-700">
        Rumusan Tujuan Pembelajaran
        <textarea
          rows={3}
          value={tujuan}
          onChange={e => setTujuan(e.target.value)}
          placeholder="Peserta didik mampu... (opsional jika sudah melampirkan berkas TP)"
          className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
      </label>

      <label className="block text-xs font-semibold text-slate-700">
        Materi Pokok
        <input
          value={materi}
          onChange={e => setMateri(e.target.value)}
          placeholder="Contoh: Eksponen dan Logaritma"
          className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
      </label>

      <div className="p-3.5 rounded-xl border border-pink-200 bg-pink-50/50 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-pink-900 flex items-center gap-1.5">
            <Paperclip className="w-3.5 h-3.5 text-pink-600" /> Upload File Dokumen TP (Opsional)
          </span>
          <span className="text-[11px] text-slate-500">Maks 15 MB</span>
        </div>
        <label className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-pink-300 bg-white hover:bg-pink-50 text-xs font-semibold text-pink-700 cursor-pointer transition-colors">
          <Upload className="w-4 h-4" />
          <span>{pendingFile || fileId ? 'Ganti Berkas Lampiran TP' : 'Pilih Berkas (PDF, DOCX, XLSX, PPTX, Gambar)'}</span>
          <input
            type="file"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) {
                readFileAsBase64(f, showToast, pf => {
                  setPendingFile(pf);
                  if (!materi.trim()) {
                    setMateri(f.name.replace(/\.[^.]+$/, ''));
                  }
                });
              }
              e.target.value = '';
            }}
          />
        </label>

        {pendingFile && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs">
            <div className="min-w-0 truncate text-emerald-800 font-medium">
              Siap diunggah: <strong>{pendingFile.namaFile}</strong> ({formatFileSize(pendingFile.size)})
            </div>
            <button
              type="button"
              onClick={() => setPendingFile(null)}
              className="text-rose-600 hover:text-rose-700 shrink-0 p-1 cursor-pointer"
              title="Batalkan pilihan berkas"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {!pendingFile && fileId && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => downloadAjarFile(fileId, namaFile)}
              className="min-w-0 truncate text-sky-700 hover:underline font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{namaFile || 'Unduh lampiran TP'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFileId('');
                setNamaFile('');
              }}
              className="text-rose-600 hover:text-rose-700 shrink-0 text-[11px] font-semibold cursor-pointer"
            >
              Hapus
            </button>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg cursor-pointer disabled:opacity-50"
        >
          {saving ? 'Menyimpan…' : 'Simpan TP'}
        </button>
      </div>
    </div>
  );
};

interface ModulModalFormProps {
  token: string;
  initial?: any;
  mapelList: any[];
  tpList: any[];
  onClose: () => void;
  onSave: (payload: {
    Judul: string;
    Mapel: string;
    Alokasi: string;
    TPIDs: string;
    Pembuka: string;
    Inti: string;
    Penutup: string;
    Asesmen: string;
    Media: string;
    Catatan: string;
    FileID: string;
    NamaFile: string;
  }) => Promise<void>;
  showToast: (msg: string, ms?: number) => void;
}

export const ModulModalForm: React.FC<ModulModalFormProps> = ({
  token,
  initial,
  mapelList,
  tpList,
  onClose,
  onSave,
  showToast
}) => {
  const [judul, setJudul] = useState<string>(initial?.Judul || '');
  const [mapel, setMapel] = useState<string>(initial?.Mapel || mapelList[0]?.Nama || 'Umum');
  const [alokasi, setAlokasi] = useState<string>(initial?.Alokasi || '2 x 45 Menit');
  const [tpIds, setTpIds] = useState<string[]>(
    String(initial?.TPIDs || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  );
  const [pembuka, setPembuka] = useState<string>(initial ? initial.Pembuka || '' : '');
  const [inti, setInti] = useState<string>(initial ? initial.Inti || '' : '');
  const [penutup, setPenutup] = useState<string>(initial ? initial.Penutup || '' : '');
  const [asesmen, setAsesmen] = useState<string>(initial ? initial.Asesmen || '' : '');
  const [media, setMedia] = useState<string>(initial ? initial.Media || '' : '');
  const [catatan, setCatatan] = useState<string>(initial ? initial.Catatan || '' : '');
  const [fileId, setFileId] = useState<string>(initial?.FileID || '');
  const [namaFile, setNamaFile] = useState<string>(initial?.NamaFile || '');
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleTp = (id: string) => {
    setTpIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const handleSubmit = async () => {
    const judulFinal =
      judul.trim() ||
      (pendingFile ? pendingFile.namaFile.replace(/\.[^.]+$/, '') : '') ||
      (namaFile ? namaFile.replace(/\.[^.]+$/, '') : '');
    if (!judulFinal) {
      showToast('Judul Modul Ajar wajib diisi atau unggah berkas modul terlebih dahulu');
      return;
    }
    setSaving(true);
    try {
      let finalFileId = fileId;
      let finalNamaFile = namaFile;
      if (pendingFile) {
        showToast('Mengunggah berkas Modul Ajar…', 6000);
        const uploaded = await uploadAjarFile(
          token,
          pendingFile.namaFile,
          pendingFile.mimeType,
          pendingFile.base64Data
        );
        finalFileId = uploaded.fileId;
        finalNamaFile = uploaded.namaFile;
      }
      await onSave({
        Judul: judulFinal,
        Mapel: mapel.trim() || 'Umum',
        Alokasi: alokasi.trim(),
        TPIDs: tpIds.join(','),
        Pembuka: pembuka.trim(),
        Inti: inti.trim(),
        Penutup: penutup.trim(),
        Asesmen: asesmen.trim(),
        Media: media.trim(),
        Catatan: catatan.trim(),
        FileID: finalFileId,
        NamaFile: finalNamaFile
      });
    } catch (e) {
      showToast('Gagal menyimpan Modul Ajar: ' + pesanErr(e), 4500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-3.5 rounded-xl border border-fuchsia-200 bg-fuchsia-50/50 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-fuchsia-900 flex items-center gap-1.5">
            <Paperclip className="w-3.5 h-3.5 text-fuchsia-600" /> Upload File Modul Ajar / RPP (Opsional)
          </span>
          <span className="text-[11px] text-slate-500">PDF, Word, PPT, Gambar · Maks 15 MB</span>
        </div>
        <label className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-fuchsia-300 bg-white hover:bg-fuchsia-50 text-xs font-semibold text-fuchsia-700 cursor-pointer transition-colors">
          <Upload className="w-4 h-4" />
          <span>{pendingFile || fileId ? 'Ganti Berkas Modul Ajar' : 'Pilih Berkas Modul Ajar untuk Diunggah'}</span>
          <input
            type="file"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) {
                readFileAsBase64(f, showToast, pf => {
                  setPendingFile(pf);
                  if (!judul.trim()) {
                    setJudul(f.name.replace(/\.[^.]+$/, ''));
                  }
                });
              }
              e.target.value = '';
            }}
          />
        </label>

        {pendingFile && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs">
            <div className="min-w-0 truncate text-emerald-800 font-medium">
              Siap diunggah: <strong>{pendingFile.namaFile}</strong> ({formatFileSize(pendingFile.size)})
            </div>
            <button
              type="button"
              onClick={() => setPendingFile(null)}
              className="text-rose-600 hover:text-rose-700 shrink-0 p-1 cursor-pointer"
              title="Batalkan pilihan berkas"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {!pendingFile && fileId && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => downloadAjarFile(fileId, namaFile)}
              className="min-w-0 truncate text-sky-700 hover:underline font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{namaFile || 'Unduh lampiran Modul Ajar'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFileId('');
                setNamaFile('');
              }}
              className="text-rose-600 hover:text-rose-700 shrink-0 text-[11px] font-semibold cursor-pointer"
            >
              Hapus
            </button>
          </div>
        )}
      </div>

      <label className="block text-xs font-semibold text-slate-700">
        Judul Modul Ajar / Topik
        <input
          value={judul}
          onChange={e => setJudul(e.target.value)}
          placeholder="Contoh: Modul Ajar Sistem Persamaan Linear"
          className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-xs font-semibold text-slate-700">
          Mata Pelajaran
          <input
            list="modul-mapel-list"
            value={mapel}
            onChange={e => setMapel(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <datalist id="modul-mapel-list">
            {mapelList.map((m: any) => (
              <option key={m.ID} value={m.Nama} />
            ))}
          </datalist>
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          Alokasi Waktu
          <input
            value={alokasi}
            onChange={e => setAlokasi(e.target.value)}
            placeholder="mis. 2 x 45 Menit"
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </label>
      </div>

      {tpList.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-slate-700">Terkait Tujuan Pembelajaran (Opsional)</div>
          <div className="max-h-28 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1 bg-slate-50">
            {tpList.map((t: any) => (
              <label key={t.ID} className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tpIds.includes(t.ID)}
                  onChange={() => toggleTp(t.ID)}
                  className="mt-0.5 rounded"
                />
                <span>
                  <strong>{t.Kode}:</strong> {t.Tujuan}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-slate-100 pt-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-700">Rincian Skenario Pembelajaran (Opsional)</span>
          <button
            type="button"
            onClick={() => {
              if (!pembuka) setPembuka(MODUL_AWAL.Pembuka);
              if (!inti) setInti(MODUL_AWAL.Inti);
              if (!penutup) setPenutup(MODUL_AWAL.Penutup);
              if (!asesmen) setAsesmen(MODUL_AWAL.Asesmen);
            }}
            className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg inline-flex items-center gap-1 cursor-pointer"
          >
            <Sparkles className="w-3 h-3" /> Isi Template Standar
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block text-xs font-semibold text-slate-700">
            Kegiatan Pembuka
            <textarea
              rows={2}
              value={pembuka}
              onChange={e => setPembuka(e.target.value)}
              placeholder="Salam, apersepsi, tujuan..."
              className="mt-1 w-full p-2 border border-slate-300 rounded-lg text-xs"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Kegiatan Inti
            <textarea
              rows={2}
              value={inti}
              onChange={e => setInti(e.target.value)}
              placeholder="Langkah pembelajaran inti..."
              className="mt-1 w-full p-2 border border-slate-300 rounded-lg text-xs"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Kegiatan Penutup
            <textarea
              rows={2}
              value={penutup}
              onChange={e => setPenutup(e.target.value)}
              placeholder="Refleksi, rangkuman..."
              className="mt-1 w-full p-2 border border-slate-300 rounded-lg text-xs"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Asesmen
            <textarea
              rows={2}
              value={asesmen}
              onChange={e => setAsesmen(e.target.value)}
              placeholder="Formatif & sumatif..."
              className="mt-1 w-full p-2 border border-slate-300 rounded-lg text-xs"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Media & Sumber Belajar
            <input
              value={media}
              onChange={e => setMedia(e.target.value)}
              placeholder="Buku paket, LKPD, video..."
              className="mt-1 w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Catatan & Refleksi Guru
            <input
              value={catatan}
              onChange={e => setCatatan(e.target.value)}
              placeholder="Catatan tambahan..."
              className="mt-1 w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg cursor-pointer disabled:opacity-50"
        >
          {saving ? 'Menyimpan…' : 'Simpan Modul Ajar'}
        </button>
      </div>
    </div>
  );
};
