import React, { useState } from 'react';
import {
  Download,
  ExternalLink,
  Link2,
  Loader2,
  Paperclip,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Unlink,
  Users,
  Check,
  Layers
} from 'lucide-react';
import { MODUL_AWAL, STATUS_TP } from '../constants';
import { downloadAjarFile, fetchJson, pesanErr, uploadAjarFile } from '../api';

interface PendingFile {
  namaFile: string;
  mimeType: string;
  base64Data: string;
  size: number;
}

export interface ModuleTpDraft {
  existingId?: string;
  Kode: string;
  Tujuan: string;
  Materi: string;
  Status: string;
}

export interface SumberLinkItem {
  label: string;
  url: string;
}

export function normalizeHttpUrl(rawUrl: string): string {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^www\./i.test(trimmed) || /^[a-z0-9-]+(\.[a-z0-9-]+)+([/?#].*)?$/i.test(trimmed)) {
    return 'https://' + trimmed;
  }
  return '';
}

function defaultLabelForUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./i, '');
  } catch {
    return 'Sumber Pelajaran';
  }
}

export function extractUrlsFromText(text?: string): SumberLinkItem[] {
  const raw = String(text || '');
  const matches = raw.match(/(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi) || [];
  const seen = new Set<string>();
  const out: SumberLinkItem[] = [];
  matches.forEach(m => {
    const url = normalizeHttpUrl(m.replace(/[.,;:!?]+$/, ''));
    if (!url || !/^https?:\/\//i.test(url)) return;
    const key = url.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ label: defaultLabelForUrl(url), url });
  });
  return out;
}

export function parseSumberLinks(raw?: string, fallbackUrl?: string): SumberLinkItem[] {
  const items: SumberLinkItem[] = [];
  const seen = new Set<string>();
  const push = (label: string, rawUrl: string) => {
    const url = normalizeHttpUrl(rawUrl);
    if (!url || !/^https?:\/\//i.test(url)) return;
    const key = url.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    items.push({
      label: String(label || '').trim() || defaultLabelForUrl(url),
      url
    });
  };

  const str = String(raw || '').trim();
  if (str) {
    let parsedJson: any = null;
    if (str.startsWith('[')) {
      try {
        parsedJson = JSON.parse(str);
      } catch {
        parsedJson = null;
      }
    }
    if (Array.isArray(parsedJson)) {
      parsedJson.forEach((x: any) => {
        if (typeof x === 'string') push('', x);
        else if (x && typeof x === 'object') push(x.label || x.nama || x.title || '', x.url || x.link || x.href || '');
      });
    } else {
      str
        .split(/\r?\n|;/)
        .map(line => line.trim())
        .filter(Boolean)
        .forEach(line => {
          if (line.includes('|')) {
            const [lbl, ...rest] = line.split('|');
            push(lbl, rest.join('|'));
          } else {
            push('', line);
          }
        });
    }
  }

  if (fallbackUrl) {
    push('Tautan Utama', fallbackUrl);
  }
  return items;
}

export function serializeSumberLinks(items: SumberLinkItem[]): string {
  const clean: SumberLinkItem[] = [];
  const seen = new Set<string>();
  (items || []).forEach(it => {
    const url = normalizeHttpUrl(it.url);
    if (!url || !/^https?:\/\//i.test(url)) return;
    const key = url.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    clean.push({
      label: String(it.label || '').trim() || defaultLabelForUrl(url),
      url
    });
  });
  return clean.length > 0 ? JSON.stringify(clean) : '';
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
  defaultModulId?: string;
  modList?: any[];
  onClose: () => void;
  onSave: (payload: {
    ModulID: string;
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
  defaultModulId = '',
  modList = [],
  onClose,
  onSave,
  showToast
}) => {
  const [modulId, setModulId] = useState<string>(initial?.ModulID || defaultModulId || '');
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
        ModulID: modulId,
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
      <label className="block text-xs font-semibold text-slate-700">
        Kelompokkan pada Modul Ajar (Pemisah TP per Modul)
        <select
          value={modulId}
          onChange={e => setModulId(e.target.value)}
          className="mt-1 w-full px-3 py-2 border border-fuchsia-200 bg-fuchsia-50/30 rounded-lg text-sm font-medium text-slate-800"
        >
          <option value="">Umum (Tidak Terikat Modul Tertentu)</option>
          {modList.map((m: any) => (
            <option key={m.ID} value={m.ID}>
              Modul: {m.Judul} ({m.Mapel || 'Umum'})
            </option>
          ))}
        </select>
      </label>

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
  kelasList?: any[];
  currentKelasId?: string;
  onClose: () => void;
  onSave: (payload: {
    Judul: string;
    Mapel: string;
    Alokasi: string;
    Pembuka: string;
    Inti: string;
    Penutup: string;
    Asesmen: string;
    Media: string;
    Catatan: string;
    PertanyaanPemantik: string;
    LinkSumber: string;
    FileID: string;
    NamaFile: string;
    moduleTps: ModuleTpDraft[];
    Kelas?: string;
  }) => Promise<void>;
  showToast: (msg: string, ms?: number) => void;
}

export const ModulModalForm: React.FC<ModulModalFormProps> = ({
  token,
  initial,
  mapelList,
  tpList,
  kelasList = [],
  currentKelasId = '',
  onClose,
  onSave,
  showToast
}) => {
  const [judul, setJudul] = useState<string>(initial?.Judul || '');
  const [mapel, setMapel] = useState<string>(initial?.Mapel || mapelList[0]?.Nama || 'Umum');
  const [alokasi, setAlokasi] = useState<string>(initial?.Alokasi || '2 x 45 Menit');
  const [cakupanKelas, setCakupanKelas] = useState<'all_subject' | 'selected'>(() => {
    if (!initial?.Kelas) return 'all_subject';
    if (initial.Kelas === '__ALL__' || initial.Kelas === 'all') return 'all_subject';
    return 'selected';
  });
  const [selectedKelasIds, setSelectedKelasIds] = useState<string[]>(() => {
    if (initial?.Kelas && initial.Kelas !== '__ALL__' && initial.Kelas !== 'all') {
      return String(initial.Kelas).split(',').map(s => s.trim()).filter(Boolean);
    }
    return currentKelasId ? [currentKelasId] : (kelasList?.map(k => k.ID) || []);
  });

  const initialTpIdSet = new Set(
    String(initial?.TPIDs || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  );

  const [moduleTps, setModuleTps] = useState<ModuleTpDraft[]>(() => {
    if (!initial) return [];
    return (tpList || [])
      .filter((t: any) => t.ModulID === initial.ID || (!t.ModulID && initialTpIdSet.has(t.ID)))
      .map((t: any) => ({
        existingId: t.ID,
        Kode: t.Kode || '',
        Tujuan: t.Tujuan || '',
        Materi: t.Materi || '',
        Status: t.Status || 'Belum'
      }));
  });

  const [pembuka, setPembuka] = useState<string>(initial ? initial.Pembuka || '' : '');
  const [inti, setInti] = useState<string>(initial ? initial.Inti || '' : '');
  const [penutup, setPenutup] = useState<string>(initial ? initial.Penutup || '' : '');
  const [asesmen, setAsesmen] = useState<string>(initial ? initial.Asesmen || '' : '');
  const [media, setMedia] = useState<string>(initial ? initial.Media || '' : '');
  const [catatan, setCatatan] = useState<string>(initial ? initial.Catatan || '' : '');
  const [pertanyaanPemantik, setPertanyaanPemantik] = useState<string>(
    initial ? initial.PertanyaanPemantik || '' : ''
  );
  const [linkSumberRows, setLinkSumberRows] = useState<SumberLinkItem[]>(() =>
    parseSumberLinks(initial?.LinkSumber)
  );
  const [fileId, setFileId] = useState<string>(initial?.FileID || '');
  const [namaFile, setNamaFile] = useState<string>(initial?.NamaFile || '');
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [extractingTp, setExtractingTp] = useState(false);
  const [saving, setSaving] = useState(false);

  const availableOtherTps = (tpList || []).filter(
    (t: any) => !moduleTps.some(mt => mt.existingId === t.ID)
  );

  const addBlankTp = () => {
    const nextNum = (tpList?.length || 0) + moduleTps.length + 1;
    setModuleTps(prev => [
      ...prev,
      {
        Kode: `TP ${nextNum}`,
        Tujuan: '',
        Materi: judul.trim() || mapel.trim() || '',
        Status: 'Belum'
      }
    ]);
  };

  const attachExistingTp = (tpId: string) => {
    if (!tpId) return;
    const found = (tpList || []).find((t: any) => t.ID === tpId);
    if (!found) return;
    setModuleTps(prev => [
      ...prev,
      {
        existingId: found.ID,
        Kode: found.Kode || 'TP',
        Tujuan: found.Tujuan || '',
        Materi: found.Materi || '',
        Status: found.Status || 'Belum'
      }
    ]);
  };

  const handleExtractTpFromFile = async () => {
    if (!pendingFile) {
      showToast('Pilih berkas Modul Ajar yang ingin dipisahkan TP-nya terlebih dahulu.');
      return;
    }
    setExtractingTp(true);
    try {
      const json = await fetchJson(
        '/api/ajar/extract-tp',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            namaFile: pendingFile.namaFile,
            mimeType: pendingFile.mimeType,
            base64Data: pendingFile.base64Data,
            judulModul: judul.trim() || pendingFile.namaFile.replace(/\.[^.]+$/, ''),
            mapel: mapel.trim() || 'Umum'
          })
        },
        0
      );
      if (!json.ok) {
        showToast(json.error || 'Gagal memisahkan TP dari berkas modul.', 4500);
        return;
      }
      const list: any[] = json.data?.tps || [];
      const extractedPemantik = String(json.data?.pertanyaanPemantik || '').trim();
      if (extractedPemantik && !pertanyaanPemantik.trim()) {
        setPertanyaanPemantik(extractedPemantik);
      }
      if (!list.length) {
        if (extractedPemantik) {
          showToast('Pertanyaan pemantik berhasil diekstrak dari dokumen modul!');
        } else {
          showToast(json.data?.note || 'Tidak ditemukan poin TP otomatis. Silakan tambah TP manual.', 4500);
          if (moduleTps.length === 0) addBlankTp();
        }
        return;
      }
      setModuleTps(prev => [
        ...prev,
        ...list.map((item, idx) => ({
          Kode: item.kode || `TP ${prev.length + idx + 1}`,
          Tujuan: item.tujuan || '',
          Materi: item.materi || judul.trim() || '',
          Status: 'Belum'
        }))
      ]);
      showToast(
        extractedPemantik
          ? `Berhasil memisahkan ${list.length} TP & Pertanyaan Pemantik dari modul!`
          : `Berhasil memisahkan ${list.length} TP dari berkas modul!`
      );
    } catch (err: any) {
      showToast('Gagal membaca TP dari file: ' + pesanErr(err), 4500);
    } finally {
      setExtractingTp(false);
    }
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
    const validTps = moduleTps.filter(t => t.Tujuan.trim().length > 0);
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
      const finalKelas =
        cakupanKelas === 'all_subject'
          ? '__ALL__'
          : (selectedKelasIds.length > 0 ? selectedKelasIds.join(',') : (currentKelasId || '__ALL__'));

      await onSave({
        Judul: judulFinal,
        Mapel: mapel.trim() || 'Umum',
        Alokasi: alokasi.trim(),
        Pembuka: pembuka.trim(),
        Inti: inti.trim(),
        Penutup: penutup.trim(),
        Asesmen: asesmen.trim(),
        Media: media.trim(),
        Catatan: catatan.trim(),
        PertanyaanPemantik: pertanyaanPemantik.trim(),
        LinkSumber: serializeSumberLinks(linkSumberRows),
        FileID: finalFileId,
        NamaFile: finalNamaFile,
        Kelas: finalKelas,
        moduleTps: validTps.map((t, i) => ({
          ...t,
          Kode: t.Kode.trim() || `TP ${i + 1}`,
          Tujuan: t.Tujuan.trim(),
          Materi: t.Materi.trim() || judulFinal
        }))
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
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs">
            <div className="min-w-0 truncate text-emerald-800 font-medium">
              Siap diunggah: <strong>{pendingFile.namaFile}</strong> ({formatFileSize(pendingFile.size)})
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleExtractTpFromFile}
                disabled={extractingTp}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-60"
              >
                {extractingTp ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" /> Memisahkan…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3" /> Pisahkan TP dari File
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setPendingFile(null)}
                className="text-rose-600 hover:text-rose-700 shrink-0 p-1 cursor-pointer"
                title="Batalkan pilihan berkas"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
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

      {/* Cakupan Kelas (Hanya Sekali Upload Modul) */}
      <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            Cakupan Kelas (Cukup Sekali Upload Modul)
          </label>
          <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded">
            Otomatis Lintas Kelas
          </span>
        </div>
        <p className="text-[11px] text-slate-600">
          Sesuaikan agar guru tidak perlu mengunggah ulang modul ajar untuk setiap kelas yang mempelajari mata pelajaran ini.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label
            onClick={() => setCakupanKelas('all_subject')}
            className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-start gap-2.5 transition-colors ${
              cakupanKelas === 'all_subject'
                ? 'bg-white border-indigo-500 shadow-2xs text-indigo-950 font-semibold'
                : 'bg-white/60 border-slate-200 text-slate-700'
            }`}
          >
            <input
              type="radio"
              name="cakupanKelas"
              checked={cakupanKelas === 'all_subject'}
              onChange={() => setCakupanKelas('all_subject')}
              className="mt-0.5 text-indigo-600"
            />
            <div>
              <div className="font-semibold text-indigo-950">Semua Kelas yang Mempelajari {mapel || 'Mapel ini'}</div>
              <div className="text-[11px] font-normal text-slate-500 mt-0.5">
                (Direkomendasikan) 1x upload modul berlaku untuk seluruh kelas yang mempelajari mata pelajaran ini.
              </div>
            </div>
          </label>
          <label
            onClick={() => setCakupanKelas('selected')}
            className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-start gap-2.5 transition-colors ${
              cakupanKelas === 'selected'
                ? 'bg-white border-indigo-500 shadow-2xs text-indigo-950 font-semibold'
                : 'bg-white/60 border-slate-200 text-slate-700'
            }`}
          >
            <input
              type="radio"
              name="cakupanKelas"
              checked={cakupanKelas === 'selected'}
              onChange={() => setCakupanKelas('selected')}
              className="mt-0.5 text-indigo-600"
            />
            <div>
              <div className="font-semibold text-indigo-950">Pilih Kelas Tertentu</div>
              <div className="text-[11px] font-normal text-slate-500 mt-0.5">
                Khusus untuk kelas tertentu saja yang dicentang di bawah.
              </div>
            </div>
          </label>
        </div>

        {cakupanKelas === 'selected' && kelasList && kelasList.length > 0 && (
          <div className="pt-1 border-t border-indigo-100 flex flex-wrap gap-2">
            {kelasList.map((k: any) => {
              const isChecked = selectedKelasIds.includes(k.ID);
              return (
                <button
                  type="button"
                  key={k.ID}
                  onClick={() => {
                    setSelectedKelasIds(prev =>
                      prev.includes(k.ID) ? prev.filter(id => id !== k.ID) : [...prev, k.ID]
                    );
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                    isChecked
                      ? 'bg-indigo-600 text-white border-indigo-600 font-semibold'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {isChecked && <Check className="w-3.5 h-3.5" />}
                  <span>{k.Nama}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Separated TPs Specifically for This Uploaded Module */}
      <div className="p-3.5 rounded-xl border border-pink-200 bg-pink-50/40 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-bold text-pink-950">
              Tujuan Pembelajaran (TP) Khusus Modul Ini ({moduleTps.length})
            </div>
            <p className="text-[11px] text-slate-500">
              Setiap modul yang diunggah memiliki daftar TP terpisah yang otomatis terkelompok pada modul ini.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {availableOtherTps.length > 0 && (
              <select
                value=""
                onChange={e => {
                  attachExistingTp(e.target.value);
                  e.target.value = '';
                }}
                className="px-2 py-1 text-[11px] font-semibold bg-white border border-pink-200 text-pink-800 rounded-lg cursor-pointer max-w-[180px]"
              >
                <option value="">+ Tautkan TP Ada…</option>
                {availableOtherTps.map((t: any) => (
                  <option key={t.ID} value={t.ID}>
                    {t.Kode}: {String(t.Tujuan || '').slice(0, 42)}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={addBlankTp}
              className="px-2.5 py-1 text-[11px] font-semibold bg-pink-600 hover:bg-pink-500 text-white rounded-lg inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Tambah TP Modul Ini
            </button>
          </div>
        </div>

        {moduleTps.length === 0 ? (
          <div className="p-3 rounded-lg border border-dashed border-pink-200 bg-white text-[11px] text-slate-500 text-center">
            Belum ada TP pada modul ini. Klik <strong>+ Tambah TP Modul Ini</strong> atau unggah file lalu klik <strong>Pisahkan TP dari File</strong>.
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {moduleTps.map((tp, idx) => (
              <div
                key={tp.existingId || `draft-${idx}`}
                className="p-2.5 rounded-lg bg-white border border-pink-100 space-y-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={tp.Kode}
                    onChange={e =>
                      setModuleTps(prev =>
                        prev.map((x, i) => (i === idx ? { ...x, Kode: e.target.value } : x))
                      )
                    }
                    placeholder={`TP ${idx + 1}`}
                    className="w-24 px-2 py-1 border border-slate-300 rounded-md text-xs font-bold"
                  />
                  <input
                    value={tp.Materi}
                    onChange={e =>
                      setModuleTps(prev =>
                        prev.map((x, i) => (i === idx ? { ...x, Materi: e.target.value } : x))
                      )
                    }
                    placeholder="Materi pokok TP..."
                    className="flex-1 min-w-[140px] px-2 py-1 border border-slate-300 rounded-md text-xs"
                  />
                  <select
                    value={tp.Status}
                    onChange={e =>
                      setModuleTps(prev =>
                        prev.map((x, i) => (i === idx ? { ...x, Status: e.target.value } : x))
                      )
                    }
                    className="px-2 py-1 border border-slate-300 rounded-md text-xs bg-slate-50"
                  >
                    {Object.keys(STATUS_TP).map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setModuleTps(prev => prev.filter((_, i) => i !== idx))}
                    className="p-1 text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer"
                    title={tp.existingId ? 'Lepas TP ini dari modul' : 'Hapus baris TP'}
                  >
                    {tp.existingId ? <Unlink className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={tp.Tujuan}
                  onChange={e =>
                    setModuleTps(prev =>
                      prev.map((x, i) => (i === idx ? { ...x, Tujuan: e.target.value } : x))
                    )
                  }
                  placeholder="Rumusan Tujuan Pembelajaran (mis. Peserta didik mampu...)"
                  className="w-full p-2 border border-slate-200 rounded-md text-xs"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pertanyaan Pemantik & Link Sumber Pelajaran on Modul Ajar */}
      <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-3">
        <label className="block text-xs font-semibold text-indigo-950">
          Pertanyaan Pemantik (Otomatis Tampil di Slide Pemantik)
          <textarea
            rows={2}
            value={pertanyaanPemantik}
            onChange={e => setPertanyaanPemantik(e.target.value)}
            placeholder="Contoh: Mengapa fenomena ini terjadi di sekitar kita? Bagaimana cara memecahkannya?"
            className="mt-1 w-full p-2.5 border border-indigo-200 bg-white rounded-lg text-xs"
          />
        </label>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-indigo-600" /> Link Sumber Pelajaran ({linkSumberRows.length})
            </span>
            <button
              type="button"
              onClick={() => setLinkSumberRows(prev => [...prev, { label: '', url: '' }])}
              className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Tambah Link Sumber
            </button>
          </div>
          {linkSumberRows.length === 0 ? (
            <div className="text-[11px] text-slate-500">
              Belum ada link sumber pelajaran. Klik <strong>+ Tambah Link Sumber</strong> untuk menambahkan tautan video, simulasi, LKPD digital, atau referensi materi.
            </div>
          ) : (
            <div className="space-y-2">
              {linkSumberRows.map((row, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-2">
                  <input
                    value={row.label}
                    onChange={e =>
                      setLinkSumberRows(prev =>
                        prev.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x))
                      )
                    }
                    placeholder="Judul sumber (mis. Video / GeoGebra)"
                    className="w-44 px-2.5 py-1.5 border border-slate-300 bg-white rounded-lg text-xs"
                  />
                  <input
                    value={row.url}
                    onChange={e =>
                      setLinkSumberRows(prev =>
                        prev.map((x, i) => (i === idx ? { ...x, url: e.target.value } : x))
                      )
                    }
                    placeholder="https://..."
                    className="flex-1 min-w-[180px] px-2.5 py-1.5 border border-slate-300 bg-white rounded-lg text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setLinkSumberRows(prev => prev.filter((_, i) => i !== idx))}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                    title="Hapus link"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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

interface PemantikModalFormProps {
  initial?: any;
  defaultModulId?: string;
  modList: any[];
  mapelList: any[];
  tpList?: any[];
  kelasList?: any[];
  currentKelasId?: string;
  onClose: () => void;
  onSave: (payload: {
    ModulID: string;
    Mapel: string;
    Judul: string;
    Pertanyaan: string;
    Slide: string;
    Tautan: string;
    SumberPelajaran: string;
    Kelas?: string;
  }) => Promise<void>;
  showToast: (msg: string, ms?: number) => void;
}

export const PemantikModalForm: React.FC<PemantikModalFormProps> = ({
  initial,
  defaultModulId = '',
  modList,
  mapelList,
  tpList = [],
  kelasList = [],
  currentKelasId = '',
  onClose,
  onSave,
  showToast
}) => {
  const initialMod =
    modList.find((m: any) => m.ID === (initial?.ModulID || defaultModulId)) || null;

  const [modulId, setModulId] = useState<string>(initial?.ModulID || defaultModulId || '');
  const [mapel, setMapel] = useState<string>(
    initial?.Mapel || initialMod?.Mapel || mapelList[0]?.Nama || 'Umum'
  );
  const [judul, setJudul] = useState<string>(
    initial?.Judul || (initialMod ? `Pemantik: ${initialMod.Judul}` : '')
  );
  const [pertanyaan, setPertanyaan] = useState<string>(
    initial?.Pertanyaan ||
      initialMod?.PertanyaanPemantik ||
      ''
  );
  const [links, setLinks] = useState<SumberLinkItem[]>(() => {
    const existing = parseSumberLinks(initial?.SumberPelajaran, initial?.Tautan);
    if (existing.length > 0) return existing;
    if (initialMod) {
      const modLinks = [
        ...parseSumberLinks(initialMod.LinkSumber),
        ...extractUrlsFromText(`${initialMod.Media || ''} ${initialMod.Pembuka || ''}`)
      ];
      if (modLinks.length > 0) return modLinks;
    }
    return [{ label: '', url: '' }];
  });
  const [slide, setSlide] = useState<string>(() => {
    if (initial?.Slide) return initial.Slide;
    if (initialMod) {
      const parts: string[] = [];
      if (initialMod.Pembuka) parts.push(`Apersepsi & Tujuan\n${initialMod.Pembuka}`);
      if (initialMod.Inti) parts.push(`Eksplorasi Materi\n${initialMod.Inti}`);
      return parts.join('\n---\n');
    }
    return '';
  });
  const [saving, setSaving] = useState(false);

  const applyFromModul = (selectedModId: string) => {
    setModulId(selectedModId);
    const m = modList.find((x: any) => x.ID === selectedModId);
    if (!m) return;
    if (!mapel.trim() || mapel === 'Umum' || !initial) setMapel(m.Mapel || mapel);
    if (!judul.trim() || !initial) setJudul(`Pemantik: ${m.Judul}`);
    if (m.PertanyaanPemantik) {
      setPertanyaan(m.PertanyaanPemantik);
    } else if (!pertanyaan.trim() && m.Pembuka) {
      setPertanyaan(m.Pembuka.split('\n')[0] || '');
    }
    const fromMod = [
      ...parseSumberLinks(m.LinkSumber),
      ...extractUrlsFromText(`${m.Media || ''} ${m.Pembuka || ''} ${m.Catatan || ''}`)
    ];
    if (fromMod.length > 0) {
      setLinks(prev => {
        const merged = [...prev.filter(x => x.url.trim()), ...fromMod];
        const seen = new Set<string>();
        return merged.filter(it => {
          const k = normalizeHttpUrl(it.url).toLowerCase();
          if (!k || seen.has(k)) return false;
          seen.add(k);
          return true;
        });
      });
    }
    if (!slide.trim()) {
      const modTps = (tpList || []).filter((t: any) => t.ModulID === m.ID);
      const chunks: string[] = [];
      if (modTps.length > 0) {
        chunks.push(
          `Tujuan Pembelajaran\n${modTps.map((t: any) => `• ${t.Kode}: ${t.Tujuan}`).join('\n')}`
        );
      }
      if (m.Pembuka) chunks.push(`Apersepsi\n${m.Pembuka}`);
      if (m.Inti) chunks.push(`Materi Inti\n${m.Inti}`);
      if (chunks.length > 0) setSlide(chunks.join('\n---\n'));
    }
    showToast(`Data pemantik & sumber dari "${m.Judul}" dimuat`);
  };

  const handleSubmit = async () => {
    if (!judul.trim()) {
      showToast('Judul Slide Pemantik wajib diisi');
      return;
    }
    const cleanLinks = links
      .map(l => ({ label: l.label.trim(), url: normalizeHttpUrl(l.url) }))
      .filter(l => /^https?:\/\//i.test(l.url));
    const serializedLinks = serializeSumberLinks(cleanLinks);
    const firstUrl = cleanLinks[0]?.url || '';

    const linkedMod = modList.find((m: any) => m.ID === modulId);
    const finalKelas = initial?.Kelas || linkedMod?.Kelas || '__ALL__';

    setSaving(true);
    try {
      await onSave({
        ModulID: modulId,
        Mapel: mapel.trim() || 'Umum',
        Judul: judul.trim(),
        Pertanyaan: pertanyaan.trim(),
        Slide: slide.trim(),
        Tautan: firstUrl,
        SumberPelajaran: serializedLinks,
        Kelas: finalKelas
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-2">
        <label className="block text-xs font-bold text-indigo-950">
          Ambil / Tautkan dari Perangkat Ajar (Modul Ajar)
          <select
            value={modulId}
            onChange={e => applyFromModul(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-indigo-200 bg-white rounded-lg text-xs font-semibold text-slate-800 cursor-pointer"
          >
            <option value="">-- Tidak tertaut modul tertentu (Mandiri) --</option>
            {modList.map((m: any) => (
              <option key={m.ID} value={m.ID}>
                {m.Mapel || 'Umum'} — {m.Judul}
                {m.PertanyaanPemantik ? ' (Ada Pertanyaan Pemantik)' : ''}
              </option>
            ))}
          </select>
        </label>
        <p className="text-[11px] text-indigo-800/80">
          Memilih Modul Ajar otomatis menyinkronkan Pertanyaan Pemantik, ringkasan slide, dan Link Sumber Pelajaran dari perangkat ajar tersebut.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="sm:col-span-2 block text-xs font-semibold text-slate-700">
          Judul Slide Pemantik
          <input
            value={judul}
            onChange={e => setJudul(e.target.value)}
            placeholder="Contoh: Mengapa Air Mancur Membentuk Parabola?"
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          Mata Pelajaran
          <input
            list="pemantik-mapel-list"
            value={mapel}
            onChange={e => setMapel(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <datalist id="pemantik-mapel-list">
            {mapelList.map((m: any) => (
              <option key={m.ID} value={m.Nama} />
            ))}
          </datalist>
        </label>
      </div>

      <label className="block text-xs font-semibold text-slate-700">
        Pertanyaan Pemantik
        <textarea
          rows={3}
          value={pertanyaan}
          onChange={e => setPertanyaan(e.target.value)}
          placeholder="Tulis pertanyaan pemantik untuk memancing rasa ingin tahu siswa (atau pilih Modul Ajar di atas untuk mengambil otomatis)..."
          className="mt-1 w-full p-2.5 border border-slate-300 rounded-lg text-xs"
        />
      </label>

      {/* Learning Resource Links Builder */}
      <div className="p-3.5 rounded-xl border border-sky-200 bg-sky-50/40 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5 text-sky-600" /> Link Sumber Pelajaran
            </div>
            <p className="text-[11px] text-slate-500">
              Tambahkan link video YouTube, simulasi interaktif, artikel, atau materi ajar yang dapat diklik guru/siswa langsung dari slide.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLinks(prev => [...prev, { label: '', url: '' }])}
            className="px-2.5 py-1 text-[11px] font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-lg inline-flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" /> Tambah Link Sumber
          </button>
        </div>
        <div className="space-y-2">
          {links.map((row, idx) => (
            <div key={idx} className="flex flex-wrap items-center gap-2">
              <input
                value={row.label}
                onChange={e =>
                  setLinks(prev =>
                    prev.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x))
                  )
                }
                placeholder="Nama Sumber (mis. Video Pembuka)"
                className="w-44 px-2.5 py-1.5 border border-slate-300 bg-white rounded-lg text-xs"
              />
              <input
                value={row.url}
                onChange={e =>
                  setLinks(prev =>
                    prev.map((x, i) => (i === idx ? { ...x, url: e.target.value } : x))
                  )
                }
                placeholder="https://youtube.com/... atau portal sumber belajar"
                className="flex-1 min-w-[200px] px-2.5 py-1.5 border border-slate-300 bg-white rounded-lg text-xs"
              />
              <button
                type="button"
                onClick={() =>
                  setLinks(prev => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : [{ label: '', url: '' }]))
                }
                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                title="Hapus baris link"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <label className="block text-xs font-semibold text-slate-700">
        Isi Slide Materi (pisahkan antar slide dengan baris <code className="px-1 bg-slate-100 rounded">---</code>)
        <textarea
          rows={5}
          value={slide}
          onChange={e => setSlide(e.target.value)}
          placeholder={'Slide 1: Judul Topik\nPenjelasan singkat...\n---\nSlide 2: Diskusi Kelompok\nPoin diskusi...'}
          className="mt-1 w-full p-2.5 border border-slate-300 rounded-lg text-xs font-mono"
        />
      </label>

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
          className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg cursor-pointer disabled:opacity-50"
        >
          {saving ? 'Menyimpan…' : 'Simpan Slide Pemantik'}
        </button>
      </div>
    </div>
  );
};

