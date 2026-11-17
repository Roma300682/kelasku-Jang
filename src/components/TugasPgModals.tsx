import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Sparkles,
  ChevronRight,
  Trash2,
  ClipboardCheck,
  KeyRound,
  FileUp,
  Eye,
  ExternalLink
} from 'lucide-react';
import { fetchJson } from '../api';
import {
  PgOpsiType,
  getOpsiList,
  normalizeOpsiPG,
  parsePgAnswers,
  serializePgAnswers,
  formatPgCompactString,
  inferTotalSoal,
  koreksiPgSiswa
} from '../pgTugasUtils';
import {
  AkuntansiKunciRow,
  TugasTipeSoal,
  UraianKunciItem,
  parseAkuntansiKunci,
  parseUraianKunci,
  serializeAkuntansiKunci,
  serializeUraianKunci
} from '../uraianAkuntansiUtils';
import { AkuntansiKunciEditor, UraianKunciEditor } from './TugasUraianAkuntansiModals';

interface TugasFormModalBodyProps {
  editRow?: any;
  token?: string;
  kelasNama: string;
  defaultMapel: string;
  defaultTenggat: string;
  subjectOptions: string[];
  onCancel: () => void;
  onDelete?: () => void;
  onSave: (payload: {
    judul: string;
    mapel: string;
    jenis: string;
    deskripsi: string;
    tenggat: string;
    tipeSoal: TugasTipeSoal;
    jumlahSoal: number;
    opsiPG: PgOpsiType;
    kunciJawaban: string;
    pendingFile: { namaFile: string; base64Data: string } | null;
  }) => Promise<void>;
  showToast: (msg: string, ms?: number) => void;
}

export const TugasFormModalBody: React.FC<TugasFormModalBodyProps> = ({
  editRow,
  token,
  kelasNama,
  defaultMapel,
  defaultTenggat,
  subjectOptions,
  onCancel,
  onDelete,
  onSave,
  showToast
}) => {
  const rawTipe = String(editRow?.TipeSoal || '').toLowerCase();
  const initialTipe: TugasTipeSoal =
    rawTipe === 'pg'
      ? 'pg'
      : rawTipe === 'uraian'
      ? 'uraian'
      : rawTipe === 'akuntansi'
      ? 'akuntansi'
      : Boolean(String(editRow?.KunciJawaban || '').trim())
      ? 'pg'
      : 'umum';

  const initialOpsi = normalizeOpsiPG(editRow?.OpsiPG);
  const initialTotal =
    initialTipe === 'pg'
      ? inferTotalSoal(editRow?.KunciJawaban, editRow?.JumlahSoal, undefined, initialOpsi)
      : 10;

  const [judul, setJudul] = useState<string>(editRow?.Judul || '');
  const [mapel, setMapel] = useState<string>(editRow?.Mapel || defaultMapel);
  const [jenis, setJenis] = useState<string>(editRow?.Jenis || 'Tugas');
  const [deskripsi, setDeskripsi] = useState<string>(editRow?.Deskripsi || '');
  const [tenggat, setTenggat] = useState<string>(editRow?.Tenggat || defaultTenggat);
  const [tipeSoal, setTipeSoal] = useState<TugasTipeSoal>(initialTipe);
  const [jumlahSoal, setJumlahSoal] = useState<number>(initialTotal);
  const [opsiPG, setOpsiPG] = useState<PgOpsiType>(initialOpsi);
  const [kunciMap, setKunciMap] = useState<Record<number, string>>(() =>
    initialTipe === 'pg' ? parsePgAnswers(editRow?.KunciJawaban, initialTotal, initialOpsi) : {}
  );
  const [quickKeyText, setQuickKeyText] = useState<string>(() =>
    initialTipe === 'pg'
      ? formatPgCompactString(parsePgAnswers(editRow?.KunciJawaban, initialTotal, initialOpsi), initialTotal).replace(/-+$/, '')
      : ''
  );
  const [uraianItems, setUraianItems] = useState<UraianKunciItem[]>(() => {
    if (initialTipe === 'uraian') {
      const parsed = parseUraianKunci(editRow?.KunciJawaban, Number(editRow?.JumlahSoal || 0));
      if (parsed.length > 0) return parsed;
    }
    return [{ no: 1, pertanyaan: '', kunci: '', bobot: 25 }];
  });
  const [akuntansiRows, setAkuntansiRows] = useState<AkuntansiKunciRow[]>(() => {
    if (initialTipe === 'akuntansi') {
      const parsed = parseAkuntansiKunci(editRow?.KunciJawaban);
      if (parsed.length > 0) return parsed;
    }
    return [
      { no: 1, keterangan: '', akun: '', posisi: 'D', nominal: 0, bobot: 10 },
      { no: 2, keterangan: '', akun: '', posisi: 'K', nominal: 0, bobot: 10 }
    ];
  });
  const [importingPgPdf, setImportingPgPdf] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ namaFile: string; base64Data: string } | null>(
    null
  );
  const [saving, setSaving] = useState(false);

  const opsiList = getOpsiList(opsiPG);
  const safeJumlah = Math.max(1, Math.min(200, Number(jumlahSoal) || 10));
  const filledCount = useMemo(() => {
    let c = 0;
    for (let i = 1; i <= safeJumlah; i++) {
      if (kunciMap[i]) c++;
    }
    return c;
  }, [kunciMap, safeJumlah]);

  const handleApplyQuickKey = () => {
    const parsed = parsePgAnswers(quickKeyText, 200, opsiPG);
    const maxNo = Object.keys(parsed).reduce((mx, k) => Math.max(mx, Number(k) || 0), 0);
    if (maxNo > safeJumlah) {
      setJumlahSoal(Math.min(200, maxNo));
    }
    setKunciMap(parsed);
    const cnt = Object.keys(parsed).length;
    showToast(
      cnt > 0
        ? `${cnt} kunci jawaban diterapkan`
        : 'Format tidak dikenali. Contoh: ABCDE atau 1.A 2.B 3.C'
    );
  };

  const handleImportPgPdf = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !token) return;
    setImportingPgPdf(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const resStr = String(reader.result || '');
        const base64Data = resStr.includes(',') ? resStr.split(',')[1] : resStr;
        const res = await fetchJson('/api/tugas/ekstrak-kunci-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, tipeSoal: 'pg', namaFile: f.name, base64Data })
        });
        if (!res.ok) {
          showToast(res.error || 'Gagal membaca kunci PG dari PDF', 4000);
          return;
        }
        const nextOpsi = normalizeOpsiPG(res.data?.opsiPG || opsiPG);
        const nextTotal = Math.max(1, Math.min(200, Number(res.data?.jumlahSoal) || safeJumlah));
        const parsed = parsePgAnswers(res.data?.kunciJawaban, nextTotal, nextOpsi);
        setOpsiPG(nextOpsi);
        setJumlahSoal(nextTotal);
        setKunciMap(parsed);
        setQuickKeyText(formatPgCompactString(parsed, nextTotal).replace(/-+$/, ''));
        showToast(`${Object.keys(parsed).length} kunci PG diimpor dari ${f.name}`);
      } finally {
        setImportingPgPdf(false);
      }
    };
    reader.readAsDataURL(f);
  };

  const handleSubmit = async () => {
    if (!judul.trim()) {
      showToast('Judul tugas wajib diisi');
      return;
    }
    setSaving(true);
    try {
      let outJumlah = 0;
      let outKunci = '';
      if (tipeSoal === 'pg') {
        outJumlah = safeJumlah;
        outKunci = serializePgAnswers(kunciMap, safeJumlah, opsiPG);
      } else if (tipeSoal === 'uraian') {
        outJumlah = uraianItems.length;
        outKunci = serializeUraianKunci(uraianItems);
      } else if (tipeSoal === 'akuntansi') {
        outJumlah = akuntansiRows.filter(r => r.akun.trim() || r.nominal !== 0).length;
        outKunci = serializeAkuntansiKunci(akuntansiRows);
      }

      await onSave({
        judul: judul.trim(),
        mapel: mapel.trim(),
        jenis,
        deskripsi: deskripsi.trim(),
        tenggat,
        tipeSoal,
        jumlahSoal: outJumlah,
        opsiPG,
        kunciJawaban: outKunci,
        pendingFile
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-xs font-semibold text-slate-700">
        Judul Tugas
        <input
          value={judul}
          onChange={e => setJudul(e.target.value)}
          placeholder="Contoh: Latihan Soal Vektor"
          className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-xs font-semibold text-slate-700">
          Mata Pelajaran (Kelas {kelasNama})
          <input
            list="tugas-mapel-list"
            value={mapel}
            onChange={e => setMapel(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <datalist id="tugas-mapel-list">
            {subjectOptions.map(m => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          Jenis Asesmen
          <select
            value={jenis}
            onChange={e => setJenis(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option>Tugas</option>
            <option>Kuis harian</option>
            <option>Exit ticket</option>
            <option>Proyek</option>
            <option>Praktik</option>
          </select>
        </label>
      </div>

      {/* Tipe Soal Selector (4 modes) */}
      <div className="space-y-1.5">
        <div className="text-xs font-semibold text-slate-700">Format & Mode Koreksi</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTipeSoal('umum')}
            className={`px-3 py-2 rounded-xl border text-left transition-colors cursor-pointer ${
              tipeSoal === 'umum'
                ? 'bg-teal-50 border-teal-500 text-teal-900 ring-1 ring-teal-400'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className="text-xs font-bold">Umum / Berkas Bebas</div>
            <div className="text-[10px] text-slate-500">Siswa unggah berkas, guru input nilai manual</div>
          </button>
          <button
            type="button"
            onClick={() => setTipeSoal('pg')}
            className={`px-3 py-2 rounded-xl border text-left transition-colors cursor-pointer ${
              tipeSoal === 'pg'
                ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-1 ring-indigo-400'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className="text-xs font-bold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Pilihan Ganda (PG)
            </div>
            <div className="text-[10px] text-slate-500">Kunci jawaban A–E & koreksi LJK / PDF</div>
          </button>
          <button
            type="button"
            onClick={() => setTipeSoal('uraian')}
            className={`px-3 py-2 rounded-xl border text-left transition-colors cursor-pointer ${
              tipeSoal === 'uraian'
                ? 'bg-amber-50 border-amber-500 text-amber-950 ring-1 ring-amber-400'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className="text-xs font-bold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Uraian Teks / Esai
            </div>
            <div className="text-[10px] text-slate-500">Input kunci/poin rubrik & koreksi teks/PDF siswa</div>
          </button>
          <button
            type="button"
            onClick={() => setTipeSoal('akuntansi')}
            className={`px-3 py-2 rounded-xl border text-left transition-colors cursor-pointer ${
              tipeSoal === 'akuntansi'
                ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-1 ring-emerald-400'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className="text-xs font-bold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Praktik Akuntansi
            </div>
            <div className="text-[10px] text-slate-500">Kunci Jurnal / Neraca D-K & koreksi tabel/PDF</div>
          </button>
        </div>
      </div>

      {tipeSoal === 'pg' && (
        <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
              Pengaturan & Kunci Jawaban PG
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-800 rounded-md tabular-nums">
                Terisi {filledCount} / {safeJumlah} Soal
              </span>
              {token && (
                <label className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-md cursor-pointer">
                  <FileUp className="w-3 h-3" />
                  {importingPgPdf ? 'Membaca…' : 'Impor Kunci PDF'}
                  <input
                    type="file"
                    accept=".pdf,.txt,.docx,image/*"
                    disabled={importingPgPdf}
                    onChange={handleImportPgPdf}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <label className="block text-[11px] font-semibold text-slate-700">
              Jumlah Soal (1–200)
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={jumlahSoal}
                  onChange={e => setJumlahSoal(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
                  className="w-20 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                />
                {[5, 10, 20, 25, 40].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setJumlahSoal(preset)}
                    className={`px-2 py-1 text-[10px] font-bold rounded-md border cursor-pointer ${
                      safeJumlah === preset
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-indigo-50'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </label>

            <label className="block text-[11px] font-semibold text-slate-700">
              Opsi Pilihan
              <div className="flex items-center gap-2 mt-1">
                {(['ABCD', 'ABCDE'] as PgOpsiType[]).map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setOpsiPG(opt)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border cursor-pointer ${
                      opsiPG === opt
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-indigo-50'
                    }`}
                  >
                    {opt === 'ABCD' ? 'A – D (4 Opsi)' : 'A – E (5 Opsi)'}
                  </button>
                ))}
              </div>
            </label>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-700">
                Ketik / Tempel Kunci Cepat
              </span>
              {filledCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setKunciMap({});
                    setQuickKeyText('');
                  }}
                  className="text-[10px] font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-0.5 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" /> Kosongkan Kunci
                </button>
              )}
            </div>
            <div className="flex gap-1.5">
              <input
                value={quickKeyText}
                onChange={e => setQuickKeyText(e.target.value)}
                placeholder="Contoh: ABCDEABCDE atau 1.A 2.B 3.C 4.D 5.E"
                className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
              />
              <button
                type="button"
                onClick={handleApplyQuickKey}
                className="px-3 py-1.5 text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shrink-0 cursor-pointer"
              >
                Terapkan
              </button>
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto bg-white border border-indigo-100 rounded-xl p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {Array.from({ length: safeJumlah }, (_, idx) => idx + 1).map(no => {
              const val = kunciMap[no] || '';
              return (
                <div
                  key={no}
                  className="flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg bg-slate-50/80 border border-slate-100"
                >
                  <span className="text-[11px] font-bold text-slate-600 w-7 tabular-nums">
                    #{no}
                  </span>
                  <div className="flex items-center gap-1">
                    {opsiList.map(letter => {
                      const active = val === letter;
                      return (
                        <button
                          key={letter}
                          type="button"
                          onClick={() =>
                            setKunciMap(prev => {
                              const next = { ...prev };
                              if (active) delete next[no];
                              else next[no] = letter;
                              return next;
                            })
                          }
                          className={`w-6 h-6 text-[11px] font-bold rounded-md border transition-colors cursor-pointer ${
                            active
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
                          }`}
                        >
                          {letter}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tipeSoal === 'uraian' && (
        <UraianKunciEditor
          items={uraianItems}
          onChange={setUraianItems}
          showToast={showToast}
          token={token}
        />
      )}

      {tipeSoal === 'akuntansi' && (
        <AkuntansiKunciEditor
          rows={akuntansiRows}
          onChange={setAkuntansiRows}
          showToast={showToast}
          token={token}
        />
      )}

      <label className="block text-xs font-semibold text-slate-700">
        Deskripsi / Instruksi Tugas
        <textarea
          rows={2}
          value={deskripsi}
          onChange={e => setDeskripsi(e.target.value)}
          placeholder="Petunjuk pengerjaan untuk siswa..."
          className="mt-1 w-full p-2.5 border border-slate-300 rounded-lg text-xs"
        />
      </label>

      <label className="block text-xs font-semibold text-slate-700">
        Tenggat Pengumpulan
        <input
          type="date"
          value={tenggat}
          onChange={e => setTenggat(e.target.value)}
          className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
      </label>

      <label className="block text-xs font-semibold text-slate-700">
        Upload Berkas Soal / Lampiran Tugas (Opsional)
        <input
          type="file"
          onChange={e => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > 15 * 1024 * 1024) {
              showToast('Ukuran lampiran maksimal 15 MB');
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              const res = String(reader.result || '');
              const base64Data = res.includes(',') ? res.split(',')[1] : res;
              setPendingFile({ namaFile: f.name, base64Data });
              showToast(`Lampiran "${f.name}" siap diunggah`);
            };
            reader.readAsDataURL(f);
          }}
          className="mt-1 w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-teal-50 file:text-teal-700 file:font-semibold hover:file:bg-teal-100"
        />
        {(pendingFile?.namaFile || editRow?.NamaFile) && (
          <div className="text-[11px] text-emerald-700 mt-1">
            Lampiran:{' '}
            <strong>{pendingFile?.namaFile || editRow?.NamaFile}</strong>
          </div>
        )}
      </label>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <div>
          {editRow && onDelete && (
            <button
              type="button"
              disabled={saving}
              onClick={onDelete}
              className="px-3.5 py-2 text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> Hapus Tugas
            </button>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold bg-slate-100 rounded-lg cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSubmit}
            className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface KunciPgQuickModalBodyProps {
  tugas: any;
  token?: string;
  onCancel: () => void;
  onSave: (payload: {
    tipeSoal: 'pg' | 'umum';
    jumlahSoal: number;
    opsiPG: PgOpsiType;
    kunciJawaban: string;
    autoGradeExisting: boolean;
  }) => Promise<void>;
  showToast: (msg: string, ms?: number) => void;
}

export const KunciPgQuickModalBody: React.FC<KunciPgQuickModalBodyProps> = ({
  tugas,
  token,
  onCancel,
  onSave,
  showToast
}) => {
  const initOpsi = normalizeOpsiPG(tugas?.OpsiPG);
  const initTotal = inferTotalSoal(tugas?.KunciJawaban, tugas?.JumlahSoal, undefined, initOpsi);
  const [jumlahSoal, setJumlahSoal] = useState<number>(initTotal);
  const [opsiPG, setOpsiPG] = useState<PgOpsiType>(initOpsi);
  const [kunciMap, setKunciMap] = useState<Record<number, string>>(() =>
    parsePgAnswers(tugas?.KunciJawaban, initTotal, initOpsi)
  );
  const [quickKeyText, setQuickKeyText] = useState<string>(() =>
    formatPgCompactString(parsePgAnswers(tugas?.KunciJawaban, initTotal, initOpsi), initTotal).replace(
      /-+$/,
      ''
    )
  );
  const [saving, setSaving] = useState(false);
  const [importingPdf, setImportingPdf] = useState(false);

  const safeJumlah = Math.max(1, Math.min(200, Number(jumlahSoal) || 10));
  const opsiList = getOpsiList(opsiPG);
  const filledCount = Array.from({ length: safeJumlah }, (_, i) => i + 1).filter(
    no => Boolean(kunciMap[no])
  ).length;

  const applyQuickText = () => {
    const parsed = parsePgAnswers(quickKeyText, 200, opsiPG);
    const maxNo = Object.keys(parsed).reduce((mx, k) => Math.max(mx, Number(k) || 0), 0);
    if (maxNo > safeJumlah) setJumlahSoal(Math.min(200, maxNo));
    setKunciMap(parsed);
    const cnt = Object.keys(parsed).length;
    showToast(
      cnt > 0
        ? `${cnt} kunci jawaban diterapkan`
        : 'Format kunci tidak dikenali. Contoh: ABCDE atau 1.A 2.B 3.C'
    );
  };

  const handleImportPdf = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !token) return;
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
            tipeSoal: 'pg',
            opsiPG,
            jumlahSoal: safeJumlah,
            namaFile: f.name,
            base64Data
          })
        });
        if (!res.ok) {
          showToast('Gagal ekstrak PDF: ' + (res.error || 'Error'), 4500);
          return;
        }
        const rawKey = String(res.data?.kunciJawaban || '');
        const nextOpsi = res.data?.opsiPG ? normalizeOpsiPG(res.data.opsiPG) : opsiPG;
        const parsed = parsePgAnswers(rawKey, 200, nextOpsi);
        const maxNo = Object.keys(parsed).reduce((mx, k) => Math.max(mx, Number(k) || 0), 0);
        if (nextOpsi !== opsiPG) setOpsiPG(nextOpsi);
        if (maxNo > safeJumlah) setJumlahSoal(Math.min(200, maxNo));
        setKunciMap(parsed);
        setQuickKeyText(formatPgCompactString(parsed, Math.max(safeJumlah, maxNo)).replace(/-+$/, ''));
        showToast(
          Object.keys(parsed).length > 0
            ? `${Object.keys(parsed).length} kunci PG diekstrak dari PDF!`
            : 'Tidak ditemukan nomor kunci PG pada PDF tersebut'
        );
      } catch (err: any) {
        showToast('Gagal ekstrak PDF: ' + (err?.message || err), 4000);
      } finally {
        setImportingPdf(false);
      }
    };
    reader.readAsDataURL(f);
  };

  const handleSave = async (autoGradeExisting: boolean) => {
    const serialized = serializePgAnswers(kunciMap, safeJumlah, opsiPG);
    if (!serialized) {
      showToast('Isi minimal 1 kunci jawaban PG terlebih dahulu');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        tipeSoal: 'pg',
        jumlahSoal: safeJumlah,
        opsiPG,
        kunciJawaban: serialized,
        autoGradeExisting
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3.5">
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-bold text-indigo-950">{tugas?.Judul}</div>
          <div className="text-[11px] text-indigo-700">
            Atur jumlah soal dan kunci jawaban A–{opsiPG === 'ABCD' ? 'D' : 'E'} atau impor dari file PDF kunci.
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="px-2.5 py-1 text-[11px] font-bold bg-white text-indigo-700 border border-indigo-200 rounded-lg tabular-nums">
            Terisi: {filledCount} / {safeJumlah}
          </span>
          {token && (
            <label className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg cursor-pointer">
              <FileUp className="w-3 h-3" />
              {importingPdf ? 'Membaca…' : 'Impor Kunci PDF'}
              <input
                type="file"
                accept=".pdf,.txt,.docx,image/*"
                disabled={importingPdf}
                onChange={handleImportPdf}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-xs font-semibold text-slate-700">
          Jumlah Soal
          <div className="flex items-center gap-1.5 mt-1">
            <input
              type="number"
              min={1}
              max={200}
              value={jumlahSoal}
              onChange={e => setJumlahSoal(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
              className="w-20 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
            />
            {[5, 10, 20, 25, 40].map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => setJumlahSoal(preset)}
                className={`px-2 py-1 text-[10px] font-bold rounded-md border cursor-pointer ${
                  safeJumlah === preset
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-indigo-50'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </label>

        <label className="block text-xs font-semibold text-slate-700">
          Opsi Jawaban
          <div className="flex items-center gap-2 mt-1">
            {(['ABCD', 'ABCDE'] as PgOpsiType[]).map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => setOpsiPG(opt)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border cursor-pointer ${
                  opsiPG === opt
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                {opt === 'ABCD' ? 'A – D' : 'A – E'}
              </button>
            ))}
          </div>
        </label>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700">
            Input Cepat Kunci (Teks / Paste)
          </span>
          {filledCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setKunciMap({});
                setQuickKeyText('');
              }}
              className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 cursor-pointer"
            >
              Reset Kunci
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <input
            value={quickKeyText}
            onChange={e => setQuickKeyText(e.target.value)}
            placeholder="Misal: ABCDEABCDE atau 1.A 2.B 3.C 4.D 5.E"
            className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
          />
          <button
            type="button"
            onClick={applyQuickText}
            className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg cursor-pointer"
          >
            Terapkan
          </button>
        </div>
      </div>

      <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-slate-50/40">
        {Array.from({ length: safeJumlah }, (_, idx) => idx + 1).map(no => {
          const val = kunciMap[no] || '';
          return (
            <div
              key={no}
              className="flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg bg-white border border-slate-200/80"
            >
              <span className="text-[11px] font-bold text-slate-600 tabular-nums">#{no}</span>
              <div className="flex items-center gap-1">
                {opsiList.map(letter => {
                  const active = val === letter;
                  return (
                    <button
                      key={letter}
                      type="button"
                      onClick={() =>
                        setKunciMap(prev => {
                          const next = { ...prev };
                          if (active) delete next[no];
                          else next[no] = letter;
                          return next;
                        })
                      }
                      className={`w-6 h-6 text-[11px] font-bold rounded-md border cursor-pointer ${
                        active
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-indigo-50'
                      }`}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

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
          className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <Sparkles className="w-3.5 h-3.5" /> Simpan & Koreksi Semua
        </button>
      </div>
    </div>
  );
};

interface KoreksiPgSiswaModalBodyProps {
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

export const KoreksiPgSiswaModalBody: React.FC<KoreksiPgSiswaModalBodyProps> = ({
  tugas,
  siswa,
  submission,
  token,
  hasNextStudent,
  onCancel,
  onApply,
  showToast
}) => {
  const opsiPG = normalizeOpsiPG(tugas?.OpsiPG);
  const opsiList = getOpsiList(opsiPG);
  const totalSoal = inferTotalSoal(
    tugas?.KunciJawaban,
    tugas?.JumlahSoal,
    submission?.JawabanSiswa,
    opsiPG
  );

  const [jawabanMap, setJawabanMap] = useState<Record<number, string>>(() =>
    parsePgAnswers(submission?.JawabanSiswa, totalSoal, opsiPG)
  );
  const [quickAnswerText, setQuickAnswerText] = useState<string>(() =>
    formatPgCompactString(
      parsePgAnswers(submission?.JawabanSiswa, totalSoal, opsiPG),
      totalSoal
    ).replace(/-+$/, '')
  );
  const [manualOverride, setManualOverride] = useState<string>('');
  const [gradingPdf, setGradingPdf] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  const hasil = useMemo(
    () => koreksiPgSiswa(tugas?.KunciJawaban, jawabanMap, totalSoal, opsiPG),
    [tugas?.KunciJawaban, jawabanMap, totalSoal, opsiPG]
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
        bodyPayload = { ...bodyPayload, namaFile: localFile.name, base64Data };
      }
      const res = await fetchJson('/api/tugas/koreksi-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });
      if (!res.ok) {
        showToast(res.error || 'Gagal membaca & mengoreksi PDF PG', 4500);
        return;
      }
      const pg = res.data?.pengumpulan;
      if (pg?.JawabanSiswa) {
        const parsed = parsePgAnswers(pg.JawabanSiswa, totalSoal, opsiPG);
        setJawabanMap(parsed);
        setQuickAnswerText(formatPgCompactString(parsed, totalSoal).replace(/-+$/, ''));
      }
      setManualOverride('');
      showToast(res.data?.ringkasan || 'Jawaban PG dari PDF berhasil dibaca & dikoreksi!');
    } finally {
      setGradingPdf(false);
    }
  };

  const handleApplyQuickAnswer = () => {
    const parsed = parsePgAnswers(quickAnswerText, totalSoal, opsiPG);
    setJawabanMap(parsed);
    const cnt = Object.keys(parsed).length;
    showToast(
      cnt > 0
        ? `${cnt} jawaban siswa diterapkan & dikoreksi`
        : 'Format tidak dikenali. Contoh: ABCDE atau 1.A 2.B 3.C'
    );
  };

  const commit = (goNext: boolean) => {
    const serializedJawaban = serializePgAnswers(jawabanMap, totalSoal, opsiPG);
    const detailStr = JSON.stringify({
      total: hasil.total,
      jumlahKunci: hasil.jumlahKunci,
      benar: hasil.benar,
      salah: hasil.salah,
      kosong: hasil.kosong,
      nilai: Number(effectiveNilai || 0),
      detail: hasil.detail
    });
    const nextStatus =
      submission?.Status && submission.Status !== 'Belum'
        ? submission.Status
        : 'Tepat Waktu';
    onApply(
      {
        jawabanSiswa: serializedJawaban,
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
      {/* Header Summary */}
      <div className="bg-gradient-to-r from-indigo-50 to-teal-50 border border-indigo-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <ClipboardCheck className="w-4 h-4 text-indigo-600" />
            {siswa?.Nama}
          </div>
          <div className="text-[11px] text-slate-600 mt-0.5">
            {tugas?.Judul} · {totalSoal} Soal ({opsiPG === 'ABCD' ? 'A–D' : 'A–E'})
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[11px] font-bold tabular-nums">
            Benar: {hasil.benar}
          </div>
          <div className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-lg text-[11px] font-bold tabular-nums">
            Salah: {hasil.salah}
          </div>
          <div className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-bold tabular-nums">
            Kosong: {hasil.kosong}
          </div>
          <div className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold tabular-nums">
            Nilai: {effectiveNilai || '0'}
          </div>
        </div>
      </div>

      {(submission?.FileID || token) && (
        <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-2.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] font-semibold text-sky-950 truncate">
              {submission?.FileID
                ? `Berkas Siswa: ${submission.NamaFile || 'Unggahan Siswa'}`
                : 'Atau unggah berkas PDF/foto LJK siswa untuk dibaca otomatis'}
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
                  className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg cursor-pointer disabled:opacity-50"
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
                    accept=".pdf,.txt,.docx,image/*"
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
                  className="w-full h-56"
                />
              ) : isImageFile ? (
                <img
                  src={`/api/tugas/file/${submission.FileID}?inline=1`}
                  alt={submission.NamaFile || 'Preview Gambar'}
                  className="max-h-56 mx-auto object-contain"
                />
              ) : null}
            </div>
          )}
        </div>
      )}

      {!hasil.adaKunci && (
        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
          Kunci jawaban untuk tugas ini belum diisi. Jawaban siswa tetap dapat disimpan, lalu atur kunci agar skor dihitung otomatis.
        </div>
      )}

      {/* Quick Paste Input */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700">
            Input / Tempel Jawaban Siswa ({siswa?.Nama})
          </span>
          {Object.keys(jawabanMap).length > 0 && (
            <button
              type="button"
              onClick={() => {
                setJawabanMap({});
                setQuickAnswerText('');
              }}
              className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 cursor-pointer"
            >
              Bersihkan Jawaban
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <input
            value={quickAnswerText}
            onChange={e => setQuickAnswerText(e.target.value)}
            placeholder="Contoh: ABCDEABCDE atau 1.A 2.B 3.C (pakai - untuk kosong)"
            className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
          />
          <button
            type="button"
            onClick={handleApplyQuickAnswer}
            className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg cursor-pointer"
          >
            Koreksi Cepat
          </button>
        </div>
      </div>

      {/* Per-Number Answer Grid with Live Key Diff */}
      <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-slate-50/40">
        {hasil.detail.map(item => {
          const badgeStyle =
            item.status === 'benar'
              ? 'bg-emerald-50/80 border-emerald-200'
              : item.status === 'salah' && item.kunci
              ? 'bg-rose-50/80 border-rose-200'
              : 'bg-white border-slate-200';
          return (
            <div
              key={item.no}
              className={`flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg border ${badgeStyle}`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[11px] font-bold text-slate-700 w-6 tabular-nums">
                  #{item.no}
                </span>
                {item.kunci ? (
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                      item.status === 'benar'
                        ? 'bg-emerald-600 text-white'
                        : item.status === 'salah'
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                    title={`Kunci: ${item.kunci}`}
                  >
                    K:{item.kunci}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400">K:-</span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {opsiList.map(letter => {
                  const chosen = item.jawaban === letter;
                  const isCorrectChoice = chosen && item.kunci === letter;
                  const isWrongChoice = chosen && item.kunci && item.kunci !== letter;
                  return (
                    <button
                      key={letter}
                      type="button"
                      onClick={() =>
                        setJawabanMap(prev => {
                          const next = { ...prev };
                          if (chosen) delete next[item.no];
                          else next[item.no] = letter;
                          return next;
                        })
                      }
                      className={`w-6 h-6 text-[11px] font-bold rounded-md border cursor-pointer ${
                        isCorrectChoice
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : isWrongChoice
                          ? 'bg-rose-600 text-white border-rose-600'
                          : chosen
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-indigo-50'
                      }`}
                    >
                      {letter}
                    </button>
                  );
                })}
                {item.status === 'benar' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-0.5" />
                ) : item.status === 'salah' && item.kunci ? (
                  <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 ml-0.5" />
                ) : (
                  <span className="w-3.5 shrink-0 ml-0.5" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Optional Score Override */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <span>Sesuaikan Nilai Akhir (opsional):</span>
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
        <div className="flex flex-wrap justify-end gap-2">
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
              className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-1 cursor-pointer"
            >
              Terapkan & Lanjut <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
