import React, { useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Calculator,
  FileUp,
  Eye,
  ExternalLink
} from 'lucide-react';
import { fetchJson } from '../api';
import {
  AkuntansiKunciRow,
  AkuntansiPosisi,
  AkuntansiSiswaRow,
  UraianKunciItem,
  formatRupiah,
  koreksiAkuntansiSiswa,
  koreksiUraianSiswa,
  parseAkuntansiKunci,
  parseAkuntansiNominal,
  parseAkuntansiPosisi,
  parseAkuntansiQuickText,
  parseAkuntansiSiswa,
  parseUraianKunci,
  parseUraianKunciQuickText,
  parseUraianSiswa,
  serializeAkuntansiKunci,
  serializeAkuntansiSiswa,
  serializeUraianKunci,
  serializeUraianSiswa
} from '../uraianAkuntansiUtils';

/* ==================== URAIAN EDITOR ==================== */

interface UraianKunciEditorProps {
  items: UraianKunciItem[];
  onChange: (items: UraianKunciItem[]) => void;
  showToast: (msg: string, ms?: number) => void;
  token?: string;
}

export const UraianKunciEditor: React.FC<UraianKunciEditorProps> = ({
  items,
  onChange,
  showToast,
  token
}) => {
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickText, setQuickText] = useState('');
  const [importingPdf, setImportingPdf] = useState(false);

  const totalBobot = useMemo(
    () => items.reduce((sum, it) => sum + (Number(it.bobot) || 0), 0),
    [items]
  );

  const addItem = () => {
    const nextNo = items.length > 0 ? Math.max(...items.map(i => i.no)) + 1 : 1;
    onChange([...items, { no: nextNo, pertanyaan: '', kunci: '', bobot: 10 }]);
  };

  const applyQuick = () => {
    const parsed = parseUraianKunciQuickText(quickText);
    if (parsed.length === 0) {
      showToast('Tempel minimal 1 baris kunci jawaban');
      return;
    }
    onChange(parsed);
    setQuickOpen(false);
    setQuickText('');
    showToast(`${parsed.length} butir kunci uraian diterapkan`);
  };

  const handleImportKeyPdf = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) {
      showToast('Ukuran berkas maksimal 15 MB');
      return;
    }
    setImportingPdf(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const resStr = String(reader.result || '');
        const base64Data = resStr.includes(',') ? resStr.split(',')[1] : resStr;
        const res = await fetchJson('/api/tugas/ekstrak-kunci-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            tipeSoal: 'uraian',
            namaFile: f.name,
            base64Data
          })
        });
        if (!res.ok) {
          showToast(res.error || 'Gagal membaca kunci dari PDF', 4500);
          return;
        }
        const parsed = parseUraianKunci(res.data?.kunciJawaban);
        if (parsed.length > 0) {
          onChange(parsed);
          showToast(`${parsed.length} kunci jawaban uraian diimpor dari ${f.name}`);
        } else {
          showToast('Tidak ditemukan butir kunci pada berkas tersebut');
        }
      } catch (err: any) {
        showToast('Gagal impor PDF: ' + (err?.message || err), 4000);
      } finally {
        setImportingPdf(false);
      }
    };
    reader.readAsDataURL(f);
  };

  return (
    <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-3.5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-amber-600" />
            Kunci Jawaban & Rubrik Uraian Teks
          </div>
          <div className="text-[11px] text-amber-800/80">
            Pisahkan poin kunci dengan titik koma (<code className="font-mono">;</code>), ketik jawaban rujukan, atau impor dari PDF kunci.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="px-2 py-0.5 text-[10px] font-bold bg-white text-amber-900 border border-amber-200 rounded-md tabular-nums">
            {items.length} Soal · Bobot {totalBobot}
          </span>
          {token && (
            <label className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg cursor-pointer">
              <FileUp className="w-3 h-3" />
              {importingPdf ? 'Membaca PDF…' : 'Impor Kunci PDF'}
              <input
                type="file"
                accept=".pdf,.txt,.docx,image/*"
                disabled={importingPdf}
                onChange={handleImportKeyPdf}
                className="hidden"
              />
            </label>
          )}
          <button
            type="button"
            onClick={() => setQuickOpen(v => !v)}
            className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg cursor-pointer"
          >
            {quickOpen ? 'Tutup Tempel Cepat' : 'Tempel Cepat'}
          </button>
        </div>
      </div>

      {quickOpen && (
        <div className="bg-white border border-amber-200 rounded-lg p-2.5 space-y-2">
          <textarea
            rows={4}
            value={quickText}
            onChange={e => setQuickText(e.target.value)}
            placeholder={
              'Format tiap baris:\n1. Pengertian jurnal penyesuaian | Mencatat saldo akhir periode; prinsip akrual | 25\n2. Fungsi buku besar | Mengelompokkan transaksi per akun | 25'
            }
            className="w-full p-2 border border-slate-200 rounded-lg text-[11px] font-mono"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={applyQuick}
              className="px-3 py-1 text-[11px] font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg cursor-pointer"
            >
              Terapkan ke Daftar Kunci
            </button>
          </div>
        </div>
      )}

      <div className="max-h-60 overflow-y-auto space-y-2 pr-0.5">
        {items.map((item, idx) => (
          <div
            key={`${item.no}-${idx}`}
            className="bg-white border border-amber-100 rounded-xl p-2.5 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="px-2 py-0.5 text-[11px] font-bold bg-amber-100 text-amber-900 rounded-md tabular-nums">
                Soal #{item.no}
              </span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                  Bobot:
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={item.bobot}
                    onChange={e => {
                      const next = [...items];
                      next[idx] = { ...item, bobot: Math.max(1, Number(e.target.value) || 1) };
                      onChange(next);
                    }}
                    className="w-14 px-2 py-0.5 border border-slate-300 rounded text-xs font-mono text-right"
                  />
                </label>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onChange(items.filter((_, j) => j !== idx).map((it, j) => ({ ...it, no: j + 1 })))}
                    className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                    title="Hapus soal"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            <input
              value={item.pertanyaan}
              onChange={e => {
                const next = [...items];
                next[idx] = { ...item, pertanyaan: e.target.value };
                onChange(next);
              }}
              placeholder="Pertanyaan / indikator soal (opsional, tampil ke siswa)"
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
            />
            <textarea
              rows={2}
              value={item.kunci}
              onChange={e => {
                const next = [...items];
                next[idx] = { ...item, kunci: e.target.value };
                onChange(next);
              }}
              placeholder="Kunci jawaban / kata kunci (contoh: aktiva = utang + modal; keseimbangan neraca)"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-amber-50/20"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addItem}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" /> Tambah Butir Soal Uraian
      </button>
    </div>
  );
};

/* ==================== AKUNTANSI EDITOR ==================== */

interface AkuntansiKunciEditorProps {
  rows: AkuntansiKunciRow[];
  onChange: (rows: AkuntansiKunciRow[]) => void;
  showToast: (msg: string, ms?: number) => void;
  token?: string;
}

export const AkuntansiKunciEditor: React.FC<AkuntansiKunciEditorProps> = ({
  rows,
  onChange,
  showToast,
  token
}) => {
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickText, setQuickText] = useState('');
  const [importingPdf, setImportingPdf] = useState(false);

  const { totalDebit, totalKredit, totalBobot } = useMemo(() => {
    let d = 0;
    let k = 0;
    let b = 0;
    for (const r of rows) {
      if (r.posisi === 'D') d += parseAkuntansiNominal(r.nominal);
      else if (r.posisi === 'K') k += parseAkuntansiNominal(r.nominal);
      b += Number(r.bobot) || 0;
    }
    return { totalDebit: d, totalKredit: k, totalBobot: b };
  }, [rows]);

  const addRow = (posisiDefault: AkuntansiPosisi = 'D') => {
    const nextNo = rows.length > 0 ? Math.max(...rows.map(r => r.no)) + 1 : 1;
    onChange([
      ...rows,
      { no: nextNo, keterangan: '', akun: '', posisi: posisiDefault, nominal: 0, bobot: 10 }
    ]);
  };

  const applyQuick = () => {
    const parsed = parseAkuntansiQuickText(quickText);
    if (parsed.length === 0) {
      showToast('Format belum dikenali. Gunakan pemisah Tab (dari Excel) atau |');
      return;
    }
    onChange(parsed);
    setQuickOpen(false);
    setQuickText('');
    showToast(`${parsed.length} baris kunci akuntansi diterapkan`);
  };

  const handleImportKeyPdf = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) {
      showToast('Ukuran berkas maksimal 15 MB');
      return;
    }
    setImportingPdf(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const resStr = String(reader.result || '');
        const base64Data = resStr.includes(',') ? resStr.split(',')[1] : resStr;
        const res = await fetchJson('/api/tugas/ekstrak-kunci-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            tipeSoal: 'akuntansi',
            namaFile: f.name,
            base64Data
          })
        });
        if (!res.ok) {
          showToast(res.error || 'Gagal membaca kunci akuntansi dari PDF', 4500);
          return;
        }
        const parsed = parseAkuntansiKunci(res.data?.kunciJawaban);
        if (parsed.length > 0) {
          onChange(parsed);
          showToast(`${parsed.length} baris kunci akuntansi diimpor dari ${f.name}`);
        } else {
          showToast('Tidak ditemukan tabel/jurnal akuntansi pada berkas tersebut');
        }
      } catch (err: any) {
        showToast('Gagal impor PDF: ' + (err?.message || err), 4000);
      } finally {
        setImportingPdf(false);
      }
    };
    reader.readAsDataURL(f);
  };

  const hasDK = totalDebit > 0 || totalKredit > 0;
  const balanced = hasDK && Math.abs(totalDebit - totalKredit) <= 1;

  return (
    <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-3.5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
            <Calculator className="w-3.5 h-3.5 text-emerald-600" />
            Kunci Jawaban Praktik Akuntansi (Jurnal / Neraca / Laporan)
          </div>
          <div className="text-[11px] text-emerald-800/80">
            Isi nama akun, posisi (D/K/Nilai), nominal, tempel dari Excel, atau impor dari PDF kunci.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="px-2 py-0.5 text-[10px] font-bold bg-white text-emerald-900 border border-emerald-200 rounded-md tabular-nums">
            {rows.length} Baris · Bobot {totalBobot}
          </span>
          {token && (
            <label className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg cursor-pointer">
              <FileUp className="w-3 h-3" />
              {importingPdf ? 'Membaca PDF…' : 'Impor Kunci PDF'}
              <input
                type="file"
                accept=".pdf,.txt,.csv,.tsv,.xlsx,image/*"
                disabled={importingPdf}
                onChange={handleImportKeyPdf}
                className="hidden"
              />
            </label>
          )}
          <button
            type="button"
            onClick={() => setQuickOpen(v => !v)}
            className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg cursor-pointer"
          >
            {quickOpen ? 'Tutup Tempel Excel' : 'Tempel dari Excel'}
          </button>
        </div>
      </div>

      {quickOpen && (
        <div className="bg-white border border-emerald-200 rounded-lg p-2.5 space-y-2">
          <textarea
            rows={4}
            value={quickText}
            onChange={e => setQuickText(e.target.value)}
            placeholder={
              'Tempel dari Excel (Tab) atau pisah dengan | :\n1 Jan Setor Modal | Kas | D | 10000000\n1 Jan Setor Modal | Modal Pemilik | K | 10000000\nBeban Sewa | D | 1500000'
            }
            className="w-full p-2 border border-slate-200 rounded-lg text-[11px] font-mono"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={applyQuick}
              className="px-3 py-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg cursor-pointer"
            >
              Terapkan Tabel Kunci
            </button>
          </div>
        </div>
      )}

      <div className="max-h-60 overflow-auto bg-white border border-emerald-100 rounded-xl">
        <table className="w-full text-left border-collapse text-[11px]">
          <thead className="bg-emerald-50/80 border-b border-emerald-100 text-emerald-900 sticky top-0">
            <tr>
              <th className="py-1.5 px-2 w-8">#</th>
              <th className="py-1.5 px-2">Tgl / Ket (Opsional)</th>
              <th className="py-1.5 px-2">Nama Akun / Item</th>
              <th className="py-1.5 px-2 w-20">Posisi</th>
              <th className="py-1.5 px-2 w-28 text-right">Nominal (Rp)</th>
              <th className="py-1.5 px-2 w-16 text-right">Bobot</th>
              <th className="py-1.5 px-1 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, idx) => (
              <tr key={`${r.no}-${idx}`}>
                <td className="py-1 px-2 text-slate-400 tabular-nums">{idx + 1}</td>
                <td className="py-1 px-1.5">
                  <input
                    value={r.keterangan}
                    onChange={e => {
                      const next = [...rows];
                      next[idx] = { ...r, keterangan: e.target.value };
                      onChange(next);
                    }}
                    placeholder="1 Jan / Trx 1"
                    className="w-full px-2 py-1 border border-slate-200 rounded text-[11px]"
                  />
                </td>
                <td className="py-1 px-1.5">
                  <input
                    value={r.akun}
                    onChange={e => {
                      const next = [...rows];
                      next[idx] = { ...r, akun: e.target.value };
                      onChange(next);
                    }}
                    placeholder="Kas / Modal / Piutang"
                    className="w-full px-2 py-1 border border-slate-200 rounded text-[11px] font-medium"
                  />
                </td>
                <td className="py-1 px-1.5">
                  <select
                    value={r.posisi}
                    onChange={e => {
                      const next = [...rows];
                      next[idx] = { ...r, posisi: parseAkuntansiPosisi(e.target.value) };
                      onChange(next);
                    }}
                    className="w-full px-1.5 py-1 border border-slate-200 rounded text-[11px] font-bold"
                  >
                    <option value="D">Debit (D)</option>
                    <option value="K">Kredit (K)</option>
                    <option value="N">Nilai (N)</option>
                  </select>
                </td>
                <td className="py-1 px-1.5">
                  <input
                    type="text"
                    value={r.nominal ? String(r.nominal) : ''}
                    onChange={e => {
                      const next = [...rows];
                      next[idx] = { ...r, nominal: parseAkuntansiNominal(e.target.value) };
                      onChange(next);
                    }}
                    placeholder="0"
                    className="w-full px-2 py-1 border border-slate-200 rounded text-[11px] font-mono text-right tabular-nums"
                  />
                </td>
                <td className="py-1 px-1.5">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={r.bobot}
                    onChange={e => {
                      const next = [...rows];
                      next[idx] = { ...r, bobot: Math.max(1, Number(e.target.value) || 1) };
                      onChange(next);
                    }}
                    className="w-full px-1.5 py-1 border border-slate-200 rounded text-[11px] font-mono text-right"
                  />
                </td>
                <td className="py-1 px-1 text-center">
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        onChange(rows.filter((_, j) => j !== idx).map((it, j) => ({ ...it, no: j + 1 })))
                      }
                      className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => addRow('D')}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg cursor-pointer"
          >
            <Plus className="w-3 h-3" /> + Baris Debit
          </button>
          <button
            type="button"
            onClick={() => addRow('K')}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg cursor-pointer"
          >
            <Plus className="w-3 h-3" /> + Baris Kredit
          </button>
        </div>

        {hasDK && (
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono tabular-nums">
            <span className="text-slate-700">D: Rp {formatRupiah(totalDebit)}</span>
            <span className="text-slate-700">K: Rp {formatRupiah(totalKredit)}</span>
            <span
              className={`px-2 py-0.5 rounded font-bold font-sans text-[10px] ${
                balanced
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {balanced
                ? 'Seimbang (Balance)'
                : `Selisih Rp ${formatRupiah(Math.abs(totalDebit - totalKredit))}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

/* ==================== QUICK KEY MODALS ==================== */

interface KunciUraianQuickModalBodyProps {
  tugas: any;
  token?: string;
  onCancel: () => void;
  onSave: (payload: {
    tipeSoal: 'uraian';
    jumlahSoal: number;
    kunciJawaban: string;
    autoGradeExisting: boolean;
  }) => Promise<void>;
  showToast: (msg: string, ms?: number) => void;
}

export const KunciUraianQuickModalBody: React.FC<KunciUraianQuickModalBodyProps> = ({
  tugas,
  token,
  onCancel,
  onSave,
  showToast
}) => {
  const [items, setItems] = useState<UraianKunciItem[]>(() => {
    const parsed = parseUraianKunci(tugas?.KunciJawaban, Number(tugas?.JumlahSoal || 0));
    return parsed.length > 0 ? parsed : [{ no: 1, pertanyaan: '', kunci: '', bobot: 25 }];
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async (autoGradeExisting: boolean) => {
    const serialized = serializeUraianKunci(items);
    if (!serialized) {
      showToast('Isi minimal 1 kunci jawaban uraian terlebih dahulu');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        tipeSoal: 'uraian',
        jumlahSoal: items.length,
        kunciJawaban: serialized,
        autoGradeExisting
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3.5">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
        <div className="text-xs font-bold text-amber-950">{tugas?.Judul}</div>
        <div className="text-[11px] text-amber-800">
          Masukkan jawaban rujukan / poin kunci dan bobot tiap nomor (atau impor dari file PDF kunci).
        </div>
      </div>

      <UraianKunciEditor items={items} onChange={setItems} showToast={showToast} token={token} />

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3.5 py-2 text-xs font-semibold bg-slate-100 rounded-lg cursor-pointer"
        >
          Batal
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => handleSave(false)}
          className="px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg cursor-pointer disabled:opacity-50"
        >
          Simpan Kunci Saja
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => handleSave(true)}
          className="px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <Sparkles className="w-3.5 h-3.5" /> Simpan & Koreksi Semua
        </button>
      </div>
    </div>
  );
};

interface KunciAkuntansiQuickModalBodyProps {
  tugas: any;
  token?: string;
  onCancel: () => void;
  onSave: (payload: {
    tipeSoal: 'akuntansi';
    jumlahSoal: number;
    kunciJawaban: string;
    autoGradeExisting: boolean;
  }) => Promise<void>;
  showToast: (msg: string, ms?: number) => void;
}

export const KunciAkuntansiQuickModalBody: React.FC<KunciAkuntansiQuickModalBodyProps> = ({
  tugas,
  token,
  onCancel,
  onSave,
  showToast
}) => {
  const [rows, setRows] = useState<AkuntansiKunciRow[]>(() => {
    const parsed = parseAkuntansiKunci(tugas?.KunciJawaban);
    return parsed.length > 0
      ? parsed
      : [
          { no: 1, keterangan: '', akun: '', posisi: 'D', nominal: 0, bobot: 10 },
          { no: 2, keterangan: '', akun: '', posisi: 'K', nominal: 0, bobot: 10 }
        ];
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async (autoGradeExisting: boolean) => {
    const serialized = serializeAkuntansiKunci(rows);
    if (!serialized) {
      showToast('Isi minimal 1 baris akun/nominal kunci akuntansi terlebih dahulu');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        tipeSoal: 'akuntansi',
        jumlahSoal: rows.filter(r => r.akun.trim() || r.nominal !== 0).length,
        kunciJawaban: serialized,
        autoGradeExisting
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3.5">
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
        <div className="text-xs font-bold text-emerald-950">{tugas?.Judul}</div>
        <div className="text-[11px] text-emerald-800">
          Masukkan tabel kunci jawaban akuntansi atau impor langsung dari file PDF kunci jawaban.
        </div>
      </div>

      <AkuntansiKunciEditor rows={rows} onChange={setRows} showToast={showToast} token={token} />

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3.5 py-2 text-xs font-semibold bg-slate-100 rounded-lg cursor-pointer"
        >
          Batal
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => handleSave(false)}
          className="px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg cursor-pointer disabled:opacity-50"
        >
          Simpan Kunci Saja
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => handleSave(true)}
          className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <Sparkles className="w-3.5 h-3.5" /> Simpan & Koreksi Semua
        </button>
      </div>
    </div>
  );
};

/* ==================== PER-STUDENT URAIAN GRADING MODAL ==================== */

interface KoreksiUraianSiswaModalBodyProps {
  tugas: any;
  siswa: any;
  submission: any;
  token?: string;
  hasNextStudent?: boolean;
  onCancel: () => void;
  onApply: (
    payload: {
      jawabanSiswa: string;
      detailKoreksi: string;
      nilai: string;
      status: string;
    },
    goNext: boolean
  ) => void;
  showToast: (msg: string, ms?: number) => void;
}

export const KoreksiUraianSiswaModalBody: React.FC<KoreksiUraianSiswaModalBodyProps> = ({
  tugas,
  siswa,
  submission,
  token,
  hasNextStudent,
  onCancel,
  onApply,
  showToast
}) => {
  const kunciItems = useMemo(() => {
    const parsed = parseUraianKunci(tugas?.KunciJawaban, Number(tugas?.JumlahSoal || 0));
    return parsed.length > 0 ? parsed : [{ no: 1, pertanyaan: '', kunci: '', bobot: 100 }];
  }, [tugas?.KunciJawaban, tugas?.JumlahSoal]);

  const [jawabanMap, setJawabanMap] = useState<Record<number, string>>(() =>
    parseUraianSiswa(submission?.JawabanSiswa)
  );
  const [skorOverrides, setSkorOverrides] = useState<Record<number, string>>(() => {
    try {
      const det = JSON.parse(String(submission?.DetailKoreksi || '{}'));
      const map: Record<number, string> = {};
      if (Array.isArray(det?.detail)) {
        for (const d of det.detail) {
          if (d?.no && d?.skor !== undefined) map[Number(d.no)] = String(d.skor);
        }
      }
      return map;
    } catch {
      return {};
    }
  });
  const [manualTotal, setManualTotal] = useState<string>('');
  const [gradingPdf, setGradingPdf] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  const hasil = useMemo(
    () => koreksiUraianSiswa(kunciItems, jawabanMap),
    [kunciItems, jawabanMap]
  );

  // Allow teacher to adjust individual item scores cleanly
  const computedTotalFromOverrides = useMemo(() => {
    let totSkor = 0;
    let totBobot = 0;
    for (const d of hasil.detail) {
      totBobot += d.bobot;
      const ov = skorOverrides[d.no];
      const itemSkor = ov !== undefined && ov !== '' ? Math.min(d.bobot, Math.max(0, Number(ov) || 0)) : d.skor;
      totSkor += itemSkor;
    }
    return totBobot > 0 ? Math.min(100, Math.round((totSkor / totBobot) * 100)) : 0;
  }, [hasil, skorOverrides]);

  const effectiveNilai =
    manualTotal.trim() !== ''
      ? manualTotal.trim()
      : hasil.adaKunci || Object.keys(skorOverrides).length > 0
      ? String(computedTotalFromOverrides)
      : String(submission?.Nilai || '');

  const handleGradeFromPdf = async (localFile?: File) => {
    if (!token) return;
    setGradingPdf(true);
    try {
      let bodyPayload: any = {
        token,
        tugasId: tugas.ID,
        siswaId: siswa.ID,
        fileId: submission?.FileID || '',
        saveResult: false
      };
      if (localFile) {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const s = String(reader.result || '');
            resolve(s.includes(',') ? s.split(',')[1] : s);
          };
          reader.onerror = () => reject(new Error('Gagal membaca file'));
          reader.readAsDataURL(localFile);
        });
        bodyPayload = {
          ...bodyPayload,
          namaFile: localFile.name,
          base64Data
        };
      }
      const res = await fetchJson('/api/tugas/koreksi-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });
      if (!res.ok) {
        showToast(res.error || 'Gagal membaca & mengoreksi PDF', 4500);
        return;
      }
      const pg = res.data?.pengumpulan;
      if (pg?.JawabanSiswa) {
        setJawabanMap(parseUraianSiswa(pg.JawabanSiswa));
      }
      if (pg?.DetailKoreksi) {
        try {
          const det = JSON.parse(String(pg.DetailKoreksi));
          if (Array.isArray(det?.detail)) {
            const ovMap: Record<number, string> = {};
            for (const d of det.detail) {
              if (d?.no && d?.skor !== undefined) ovMap[Number(d.no)] = String(d.skor);
            }
            setSkorOverrides(ovMap);
          }
        } catch {}
      }
      setManualTotal('');
      showToast(res.data?.ringkasan || 'Berkas PDF berhasil dibaca & dikoreksi!');
    } catch (err: any) {
      showToast('Gagal koreksi PDF: ' + (err?.message || err), 4500);
    } finally {
      setGradingPdf(false);
    }
  };

  const commit = (goNext: boolean) => {
    const serialized = serializeUraianSiswa(jawabanMap);
    const detailAdjusted = hasil.detail.map(d => {
      const ov = skorOverrides[d.no];
      const finalSkor =
        ov !== undefined && ov !== '' ? Math.min(d.bobot, Math.max(0, Number(ov) || 0)) : d.skor;
      return { ...d, skor: finalSkor };
    });
    const detailStr = JSON.stringify({
      tipe: 'uraian',
      totalSoal: hasil.totalSoal,
      sesuai: hasil.sesuai,
      sebagian: hasil.sebagian,
      belum: hasil.belum,
      nilai: Number(effectiveNilai || 0),
      detail: detailAdjusted
    });
    const nextStatus =
      submission?.Status && submission.Status !== 'Belum'
        ? submission.Status
        : 'Tepat Waktu';
    onApply(
      {
        jawabanSiswa: serialized,
        detailKoreksi: detailStr,
        nilai: effectiveNilai,
        status: nextStatus
      },
      goNext
    );
  };

  const isPdfFile = /\.pdf$/i.test(String(submission?.NamaFile || ''));
  const isImageFile = /\.(png|jpe?g|webp|gif)$/i.test(String(submission?.NamaFile || ''));

  return (
    <div className="space-y-3.5">
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <ClipboardCheck className="w-4 h-4 text-amber-600" />
            {siswa?.Nama}
          </div>
          <div className="text-[11px] text-slate-600 mt-0.5">
            {tugas?.Judul} · Uraian Teks ({kunciItems.length} Soal)
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[11px] font-bold tabular-nums">
            Sesuai: {hasil.sesuai}
          </span>
          <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-lg text-[11px] font-bold tabular-nums">
            Sebagian: {hasil.sebagian}
          </span>
          <span className="px-2 py-1 bg-rose-100 text-rose-800 rounded-lg text-[11px] font-bold tabular-nums">
            Kurang: {hasil.belum}
          </span>
          <span className="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-bold tabular-nums">
            Nilai: {effectiveNilai || '0'}
          </span>
        </div>
      </div>

      {/* PDF Extraction & Inline Preview Bar */}
      {(submission?.FileID || token) && (
        <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-2.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] font-semibold text-sky-950 truncate">
              {submission?.FileID
                ? `Berkas Siswa: ${submission.NamaFile || 'Unggahan Siswa'}`
                : 'Siswa belum unggah berkas — Anda dapat unggah PDF jawaban siswa untuk dikoreksi'}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {submission?.FileID && (isPdfFile || isImageFile) && (
                <button
                  type="button"
                  onClick={() => setShowPdfPreview(v => !v)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-lg cursor-pointer"
                >
                  <Eye className="w-3 h-3" /> {showPdfPreview ? 'Tutup Preview' : 'Lihat PDF'}
                </button>
              )}
              {submission?.FileID && (
                <a
                  href={`/api/tugas/file/${submission.FileID}?inline=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-white hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg"
                >
                  <ExternalLink className="w-3 h-3" /> Tab Baru
                </a>
              )}
              {submission?.FileID && token && (
                <button
                  type="button"
                  disabled={gradingPdf}
                  onClick={() => handleGradeFromPdf()}
                  className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-bold bg-sky-600 hover:bg-sky-500 text-white rounded-lg cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3 h-3" />
                  {gradingPdf ? 'Membaca PDF…' : 'Baca & Koreksi PDF'}
                </button>
              )}
              {token && (
                <label className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-lg cursor-pointer">
                  <FileUp className="w-3 h-3" />
                  Koreksi File PDF
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,image/*"
                    disabled={gradingPdf}
                    onChange={e => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) void handleGradeFromPdf(f);
                    }}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {showPdfPreview && submission?.FileID && (
            <div className="border border-sky-200 rounded-lg overflow-hidden bg-white">
              {isPdfFile ? (
                <iframe
                  src={`/api/tugas/file/${submission.FileID}?inline=1`}
                  title={submission.NamaFile || 'Preview PDF'}
                  className="w-full h-64"
                />
              ) : isImageFile ? (
                <img
                  src={`/api/tugas/file/${submission.FileID}?inline=1`}
                  alt={submission.NamaFile || 'Preview Gambar'}
                  className="max-h-64 mx-auto object-contain"
                />
              ) : null}
            </div>
          )}
        </div>
      )}

      {!hasil.adaKunci && (
        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
          Kunci jawaban uraian belum diisi. Anda dapat meninjau/mengetik jawaban siswa dan memberi skor per soal secara manual.
        </div>
      )}

      <div className="max-h-80 overflow-y-auto space-y-2.5 pr-0.5">
        {hasil.detail.map(d => {
          const ov = skorOverrides[d.no];
          const displaySkor = ov !== undefined ? ov : String(d.skor);
          const cardColor =
            d.status === 'sesuai'
              ? 'border-emerald-200 bg-emerald-50/30'
              : d.status === 'sebagian'
              ? 'border-amber-200 bg-amber-50/30'
              : 'border-slate-200 bg-white';
          return (
            <div key={d.no} className={`border rounded-xl p-3 space-y-2 ${cardColor}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-slate-900">
                  Soal #{d.no} {d.pertanyaan ? `— ${d.pertanyaan}` : ''}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-slate-500 tabular-nums">
                    Kecocokan {d.persen}%
                  </span>
                  <label className="flex items-center gap-1 text-[11px] font-bold text-slate-700">
                    Skor:
                    <input
                      type="number"
                      min={0}
                      max={d.bobot}
                      step="0.5"
                      value={displaySkor}
                      onChange={e =>
                        setSkorOverrides(prev => ({ ...prev, [d.no]: e.target.value }))
                      }
                      className="w-16 px-2 py-0.5 bg-white border border-slate-300 rounded text-xs font-mono text-right"
                    />
                    <span className="text-slate-400 font-normal">/ {d.bobot}</span>
                  </label>
                </div>
              </div>

              {d.kunci && (
                <div className="bg-white/90 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-700">
                  <span className="font-bold text-indigo-700">Kunci:</span> {d.kunci}
                </div>
              )}

              <textarea
                rows={2}
                value={jawabanMap[d.no] || ''}
                onChange={e =>
                  setJawabanMap(prev => ({ ...prev, [d.no]: e.target.value }))
                }
                placeholder={`Jawaban siswa nomor ${d.no}...`}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
              />

              {(d.poinCocok.length > 0 || d.poinKurang.length > 0) && (
                <div className="flex flex-wrap gap-1">
                  {d.poinCocok.map((p, idx) => (
                    <span
                      key={`ok-${idx}`}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 rounded"
                    >
                      <CheckCircle2 className="w-2.5 h-2.5" /> {p}
                    </span>
                  ))}
                  {d.poinKurang.map((p, idx) => (
                    <span
                      key={`miss-${idx}`}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold bg-rose-100 text-rose-800 rounded"
                    >
                      <XCircle className="w-2.5 h-2.5" /> {p}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <span>Sesuaikan Nilai Akhir (0–100):</span>
          <input
            type="number"
            min={0}
            max={100}
            value={manualTotal}
            onChange={e => setManualTotal(e.target.value)}
            placeholder={String(computedTotalFromOverrides)}
            className="w-20 px-2.5 py-1 border border-slate-300 rounded-lg text-xs font-mono text-right"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              showToast('Koreksi otomatis diperbarui dari kunci & jawaban terkini');
              setSkorOverrides({});
              setManualTotal('');
            }}
            className="px-3 py-2 text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 rounded-lg cursor-pointer"
          >
            Hitung Ulang Otomatis
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 text-xs font-semibold bg-slate-100 rounded-lg cursor-pointer"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={() => commit(false)}
            className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg cursor-pointer"
          >
            Terapkan Nilai
          </button>
          {hasNextStudent && (
            <button
              type="button"
              onClick={() => commit(true)}
              className="px-3.5 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg flex items-center gap-1 cursor-pointer"
            >
              Terapkan & Lanjut <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ==================== PER-STUDENT AKUNTANSI GRADING MODAL ==================== */

interface KoreksiAkuntansiSiswaModalBodyProps {
  tugas: any;
  siswa: any;
  submission: any;
  token?: string;
  hasNextStudent?: boolean;
  onCancel: () => void;
  onApply: (
    payload: {
      jawabanSiswa: string;
      detailKoreksi: string;
      nilai: string;
      status: string;
    },
    goNext: boolean
  ) => void;
  showToast: (msg: string, ms?: number) => void;
}

export const KoreksiAkuntansiSiswaModalBody: React.FC<KoreksiAkuntansiSiswaModalBodyProps> = ({
  tugas,
  siswa,
  submission,
  token,
  hasNextStudent,
  onCancel,
  onApply,
  showToast
}) => {
  const kunciRows = useMemo(
    () => parseAkuntansiKunci(tugas?.KunciJawaban),
    [tugas?.KunciJawaban]
  );

  const [siswaRows, setSiswaRows] = useState<AkuntansiSiswaRow[]>(() => {
    const parsed = parseAkuntansiSiswa(submission?.JawabanSiswa);
    if (parsed.length > 0) return parsed;
    return kunciRows.length > 0
      ? kunciRows.map(kr => ({
          no: kr.no,
          keterangan: kr.keterangan,
          akun: '',
          posisi: kr.posisi,
          nominal: 0
        }))
      : [{ no: 1, keterangan: '', akun: '', posisi: 'D', nominal: 0 }];
  });
  const [quickPasteOpen, setQuickPasteOpen] = useState(false);
  const [quickPasteText, setQuickPasteText] = useState('');
  const [manualOverride, setManualOverride] = useState('');
  const [gradingPdf, setGradingPdf] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  const hasil = useMemo(
    () => koreksiAkuntansiSiswa(kunciRows, siswaRows),
    [kunciRows, siswaRows]
  );

  const effectiveNilai =
    manualOverride.trim() !== ''
      ? manualOverride.trim()
      : hasil.adaKunci
      ? String(hasil.nilai)
      : String(submission?.Nilai || '');

  const handleGradeFromPdf = async (localFile?: File) => {
    if (!token) return;
    setGradingPdf(true);
    try {
      let bodyPayload: any = {
        token,
        tugasId: tugas.ID,
        siswaId: siswa.ID,
        fileId: submission?.FileID || '',
        saveResult: false
      };
      if (localFile) {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const s = String(reader.result || '');
            resolve(s.includes(',') ? s.split(',')[1] : s);
          };
          reader.onerror = () => reject(new Error('Gagal membaca file'));
          reader.readAsDataURL(localFile);
        });
        bodyPayload = {
          ...bodyPayload,
          namaFile: localFile.name,
          base64Data
        };
      }
      const res = await fetchJson('/api/tugas/koreksi-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });
      if (!res.ok) {
        showToast(res.error || 'Gagal membaca & mengoreksi PDF akuntansi', 4500);
        return;
      }
      const pg = res.data?.pengumpulan;
      if (pg?.JawabanSiswa) {
        const parsed = parseAkuntansiSiswa(pg.JawabanSiswa);
        if (parsed.length > 0) setSiswaRows(parsed);
      }
      setManualOverride('');
      showToast(res.data?.ringkasan || 'Berkas PDF akuntansi berhasil dibaca & dikoreksi!');
    } catch (err: any) {
      showToast('Gagal koreksi PDF: ' + (err?.message || err), 4500);
    } finally {
      setGradingPdf(false);
    }
  };

  const applyQuickPaste = () => {
    const parsed = parseAkuntansiQuickText(quickPasteText).map(r => ({
      no: r.no,
      keterangan: r.keterangan,
      akun: r.akun,
      posisi: r.posisi,
      nominal: r.nominal
    }));
    if (parsed.length === 0) {
      showToast('Format belum dikenali. Gunakan Tab (copy dari Excel) atau |');
      return;
    }
    setSiswaRows(parsed);
    setQuickPasteOpen(false);
    setQuickPasteText('');
    showToast(`${parsed.length} baris jawaban akuntansi siswa diterapkan`);
  };

  const commit = (goNext: boolean) => {
    const serialized = serializeAkuntansiSiswa(siswaRows);
    const detailStr = JSON.stringify({
      tipe: 'akuntansi',
      totalBaris: hasil.totalBaris,
      benar: hasil.benar,
      sebagian: hasil.sebagian,
      salah: hasil.salah,
      totalDebitSiswa: hasil.totalDebitSiswa,
      totalKreditSiswa: hasil.totalKreditSiswa,
      seimbangSiswa: hasil.seimbangSiswa,
      nilai: Number(effectiveNilai || 0),
      detail: hasil.detail
    });
    const nextStatus =
      submission?.Status && submission.Status !== 'Belum'
        ? submission.Status
        : 'Tepat Waktu';
    onApply(
      {
        jawabanSiswa: serialized,
        detailKoreksi: detailStr,
        nilai: effectiveNilai,
        status: nextStatus
      },
      goNext
    );
  };

  const hasDK = hasil.totalDebitSiswa > 0 || hasil.totalKreditSiswa > 0;
  const isPdfFile = /\.pdf$/i.test(String(submission?.NamaFile || ''));
  const isImageFile = /\.(png|jpe?g|webp|gif)$/i.test(String(submission?.NamaFile || ''));

  return (
    <div className="space-y-3.5">
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <Calculator className="w-4 h-4 text-emerald-600" />
            {siswa?.Nama}
          </div>
          <div className="text-[11px] text-slate-600 mt-0.5">
            {tugas?.Judul} · Praktik Akuntansi ({kunciRows.length} Baris Kunci)
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[11px] font-bold tabular-nums">
            Benar: {hasil.benar}
          </span>
          <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-lg text-[11px] font-bold tabular-nums">
            Sebagian: {hasil.sebagian}
          </span>
          <span className="px-2 py-1 bg-rose-100 text-rose-800 rounded-lg text-[11px] font-bold tabular-nums">
            Salah: {hasil.salah}
          </span>
          {hasDK && (
            <span
              className={`px-2 py-1 rounded-lg text-[11px] font-bold ${
                hasil.seimbangSiswa
                  ? 'bg-teal-100 text-teal-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {hasil.seimbangSiswa ? 'Balance' : 'Tidak Balance'}
            </span>
          )}
          <span className="px-3 py-1 bg-emerald-700 text-white rounded-lg text-xs font-bold tabular-nums">
            Nilai: {effectiveNilai || '0'}
          </span>
        </div>
      </div>

      {/* PDF Extraction & Inline Preview Bar */}
      {(submission?.FileID || token) && (
        <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-2.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] font-semibold text-sky-950 truncate">
              {submission?.FileID
                ? `Berkas Siswa: ${submission.NamaFile || 'Unggahan Siswa'}`
                : 'Siswa belum unggah berkas — Anda dapat unggah PDF jawaban akuntansi untuk dikoreksi'}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {submission?.FileID && (isPdfFile || isImageFile) && (
                <button
                  type="button"
                  onClick={() => setShowPdfPreview(v => !v)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-lg cursor-pointer"
                >
                  <Eye className="w-3 h-3" /> {showPdfPreview ? 'Tutup Preview' : 'Lihat PDF'}
                </button>
              )}
              {submission?.FileID && (
                <a
                  href={`/api/tugas/file/${submission.FileID}?inline=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-white hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg"
                >
                  <ExternalLink className="w-3 h-3" /> Tab Baru
                </a>
              )}
              {submission?.FileID && token && (
                <button
                  type="button"
                  disabled={gradingPdf}
                  onClick={() => handleGradeFromPdf()}
                  className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3 h-3" />
                  {gradingPdf ? 'Membaca PDF…' : 'Baca & Koreksi PDF'}
                </button>
              )}
              {token && (
                <label className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-lg cursor-pointer">
                  <FileUp className="w-3 h-3" />
                  Koreksi File PDF
                  <input
                    type="file"
                    accept=".pdf,.xlsx,.csv,.txt,image/*"
                    disabled={gradingPdf}
                    onChange={e => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) void handleGradeFromPdf(f);
                    }}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {showPdfPreview && submission?.FileID && (
            <div className="border border-sky-200 rounded-lg overflow-hidden bg-white">
              {isPdfFile ? (
                <iframe
                  src={`/api/tugas/file/${submission.FileID}?inline=1`}
                  title={submission.NamaFile || 'Preview PDF'}
                  className="w-full h-64"
                />
              ) : isImageFile ? (
                <img
                  src={`/api/tugas/file/${submission.FileID}?inline=1`}
                  alt={submission.NamaFile || 'Preview Gambar'}
                  className="max-h-64 mx-auto object-contain"
                />
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Input / Edit Student Worksheet */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-800">
            Lembar Jawaban Akuntansi Siswa
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setQuickPasteOpen(v => !v)}
              className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg cursor-pointer"
            >
              {quickPasteOpen ? 'Tutup Tempel Excel' : 'Tempel Jawaban dari Excel'}
            </button>
            <button
              type="button"
              onClick={() =>
                setSiswaRows(prev => [
                  ...prev,
                  { no: prev.length + 1, keterangan: '', akun: '', posisi: 'D', nominal: 0 }
                ])
              }
              className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg cursor-pointer"
            >
              + Baris
            </button>
          </div>
        </div>

        {quickPasteOpen && (
          <div className="bg-slate-50 border border-emerald-200 rounded-lg p-2.5 space-y-2">
            <textarea
              rows={3}
              value={quickPasteText}
              onChange={e => setQuickPasteText(e.target.value)}
              placeholder="Tempel tabel jawaban siswa (Tab atau | ): Akun | D/K | Nominal"
              className="w-full p-2 bg-white border border-slate-200 rounded-lg text-[11px] font-mono"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={applyQuickPaste}
                className="px-3 py-1 text-[11px] font-semibold bg-emerald-600 text-white rounded-lg cursor-pointer"
              >
                Terapkan Jawaban Siswa
              </button>
            </div>
          </div>
        )}

        <div className="max-h-44 overflow-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 sticky top-0">
              <tr>
                <th className="py-1.5 px-2 w-8">#</th>
                <th className="py-1.5 px-2">Tgl / Ket</th>
                <th className="py-1.5 px-2">Nama Akun Siswa</th>
                <th className="py-1.5 px-2 w-20">Posisi</th>
                <th className="py-1.5 px-2 w-28 text-right">Nominal (Rp)</th>
                <th className="py-1.5 px-1 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {siswaRows.map((sr, idx) => (
                <tr key={idx}>
                  <td className="py-1 px-2 text-slate-400 tabular-nums">{idx + 1}</td>
                  <td className="py-1 px-1.5">
                    <input
                      value={sr.keterangan}
                      onChange={e => {
                        const next = [...siswaRows];
                        next[idx] = { ...sr, keterangan: e.target.value };
                        setSiswaRows(next);
                      }}
                      className="w-full px-2 py-1 border border-slate-200 rounded text-[11px]"
                    />
                  </td>
                  <td className="py-1 px-1.5">
                    <input
                      value={sr.akun}
                      onChange={e => {
                        const next = [...siswaRows];
                        next[idx] = { ...sr, akun: e.target.value };
                        setSiswaRows(next);
                      }}
                      placeholder="Nama akun..."
                      className="w-full px-2 py-1 border border-slate-200 rounded text-[11px]"
                    />
                  </td>
                  <td className="py-1 px-1.5">
                    <select
                      value={sr.posisi}
                      onChange={e => {
                        const next = [...siswaRows];
                        next[idx] = { ...sr, posisi: parseAkuntansiPosisi(e.target.value) };
                        setSiswaRows(next);
                      }}
                      className="w-full px-1.5 py-1 border border-slate-200 rounded text-[11px] font-bold"
                    >
                      <option value="D">D</option>
                      <option value="K">K</option>
                      <option value="N">Nilai</option>
                    </select>
                  </td>
                  <td className="py-1 px-1.5">
                    <input
                      type="text"
                      value={sr.nominal ? String(sr.nominal) : ''}
                      onChange={e => {
                        const next = [...siswaRows];
                        next[idx] = { ...sr, nominal: parseAkuntansiNominal(e.target.value) };
                        setSiswaRows(next);
                      }}
                      className="w-full px-2 py-1 border border-slate-200 rounded text-[11px] font-mono text-right tabular-nums"
                    />
                  </td>
                  <td className="py-1 px-1 text-center">
                    {siswaRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setSiswaRows(siswaRows.filter((_, j) => j !== idx))}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Comparison Against Key */}
      {hasil.detail.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] font-bold text-slate-700">
            Hasil Pencocokan Otomatis vs Kunci Jawaban
          </div>
          <div className="max-h-40 overflow-auto border border-emerald-100 rounded-xl">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead className="bg-emerald-50/70 border-b border-emerald-100 text-emerald-900 sticky top-0">
                <tr>
                  <th className="py-1.5 px-2">#</th>
                  <th className="py-1.5 px-2">Kunci (Akun · Posisi · Nominal)</th>
                  <th className="py-1.5 px-2">Jawaban Siswa</th>
                  <th className="py-1.5 px-2 text-right">Skor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hasil.detail.map(d => (
                  <tr
                    key={d.no}
                    className={
                      d.status === 'benar'
                        ? 'bg-emerald-50/40'
                        : d.status === 'sebagian'
                        ? 'bg-amber-50/40'
                        : 'bg-rose-50/30'
                    }
                  >
                    <td className="py-1.5 px-2 tabular-nums text-slate-500">#{d.no}</td>
                    <td className="py-1.5 px-2">
                      <div className="font-semibold text-slate-900">
                        {d.akunKunci} ({d.posisiKunci})
                      </div>
                      <div className="font-mono text-slate-600">
                        Rp {formatRupiah(d.nominalKunci)}
                      </div>
                    </td>
                    <td className="py-1.5 px-2">
                      {d.akunSiswa || d.nominalSiswa ? (
                        <div className="flex flex-wrap items-center gap-1">
                          <span
                            className={`px-1.5 py-0.5 rounded font-semibold ${
                              d.akunCocok
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {d.akunSiswa || '-'}
                          </span>
                          <span
                            className={`px-1 py-0.5 rounded font-bold ${
                              d.posisiCocok
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {d.posisiSiswa || '-'}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded font-mono ${
                              d.nominalCocok
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            Rp {formatRupiah(d.nominalSiswa)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Belum diisi
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-bold tabular-nums">
                      {d.skor} / {d.bobot}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <span>Sesuaikan Nilai Akhir (0–100):</span>
          <input
            type="number"
            min={0}
            max={100}
            value={manualOverride}
            onChange={e => setManualOverride(e.target.value)}
            placeholder={hasil.adaKunci ? String(hasil.nilai) : '0-100'}
            className="w-20 px-2.5 py-1 border border-slate-300 rounded-lg text-xs font-mono text-right"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 text-xs font-semibold bg-slate-100 rounded-lg cursor-pointer"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={() => commit(false)}
            className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg cursor-pointer"
          >
            Terapkan Nilai
          </button>
          {hasNextStudent && (
            <button
              type="button"
              onClick={() => commit(true)}
              className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1 cursor-pointer"
            >
              Terapkan & Lanjut <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
