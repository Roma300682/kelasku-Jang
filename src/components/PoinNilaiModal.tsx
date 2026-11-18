import React, { useState } from 'react';
import { ArrowRightLeft, CheckCircle2, Plus, Sparkles, Star } from 'lucide-react';
import {
  POIN_TARGET_OPTIONS,
  PoinTargetKomponen,
  computeStudentPoinStats,
  getPoinTargetLabel
} from '../poinLoginUtils';
import { fmt, num, ymd } from '../api';

export type ModalTargetMode = 'SESUAI_SISWA' | PoinTargetKomponen;

interface PoinNilaiModalProps {
  siswaK: any[];
  poinRows: any[];
  nilaiRows: any[];
  pengaturan: Record<string, any>;
  kelasId: string;
  kelasNama: string;
  onApplyReadyForStudent: (siswaId: string, targetMode: ModalTargetMode) => Promise<void>;
  onConvertAndApplyStudent: (siswaId: string, targetMode: ModalTargetMode) => Promise<void>;
  onApplyAllReady: (targetMode: ModalTargetMode) => Promise<void>;
  onConvertAndApplyAll: (targetMode: ModalTargetMode) => Promise<void>;
  onGiftPoints: (siswa: any, amount: number) => Promise<void>;
  onClose: () => void;
}

export const PoinNilaiModalBody: React.FC<PoinNilaiModalProps> = ({
  siswaK,
  poinRows,
  nilaiRows,
  pengaturan,
  kelasId,
  kelasNama,
  onApplyReadyForStudent,
  onConvertAndApplyStudent,
  onApplyAllReady,
  onConvertAndApplyAll,
  onGiftPoints,
  onClose
}) => {
  const [targetMode, setTargetMode] = useState<ModalTargetMode>('SESUAI_SISWA');
  const [busyKey, setBusyKey] = useState<string>('');
  const today = ymd(new Date());

  const poinPerLogin = Math.max(1, Math.round(Number(pengaturan?.poinPerLogin || 5) || 5));
  const poinPerNilai = Math.max(1, Math.round(Number(pengaturan?.poinPerNilai || 5) || 5));

  const enriched = siswaK.map(s => {
    const stats = computeStudentPoinStats(poinRows, s.ID, pengaturan, today);
    const nilaiRow = nilaiRows.find(n => n.Kelas === kelasId && n.SiswaID === s.ID) || {};
    const convertibleUnits = Math.floor(stats.saldoPoin / poinPerNilai);
    return { s, stats, nilaiRow, convertibleUnits };
  });

  const totalReadyStudents = enriched.filter(x => x.stats.nilaiSiapDitambahkan > 0).length;
  const totalReadyNilai = enriched.reduce((sum, x) => sum + x.stats.nilaiSiapDitambahkan, 0);
  const totalConvertibleUnits = enriched.reduce((sum, x) => sum + x.convertibleUnits, 0);

  const runAction = async (key: string, fn: () => Promise<void>) => {
    if (busyKey) return;
    setBusyKey(key);
    try {
      await fn();
    } finally {
      setBusyKey('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-gradient-to-r from-amber-50 via-orange-50/70 to-indigo-50 border border-amber-200 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
            <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
            <span>Bintang &amp; Poin Login Siswa — Kelas {kelasNama}</span>
          </div>
          <p className="text-[11px] text-slate-600">
            Aturan aktif: <strong>★ +1 Bintang &amp; +{poinPerLogin} Poin</strong> saat siswa login · Kurs:{' '}
            <strong>{poinPerNilai} Poin = +1 Nilai</strong>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-800 font-bold tabular-nums">
            {totalReadyStudents} siswa siap ditambahkan (+{totalReadyNilai} nilai)
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white border border-amber-200 text-amber-800 font-bold tabular-nums">
            +{totalConvertibleUnits} potensi konversi saldo
          </span>
        </div>
      </div>

      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <label className="block text-xs font-semibold text-slate-700 flex-1">
          Target Komponen Penambahan Nilai Siswa
          <select
            value={targetMode}
            onChange={e => setTargetMode(e.target.value as ModalTargetMode)}
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white font-medium"
          >
            <option value="SESUAI_SISWA">
              Sesuai Usulan Siswa (Default: {getPoinTargetLabel(pengaturan?.poinTargetDefault)})
            </option>
            {POIN_TARGET_OPTIONS.map(opt => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!!busyKey || totalReadyNilai <= 0}
            onClick={() => runAction('all-ready', () => onApplyAllReady(targetMode))}
            className="px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Tambahkan Semua Terkonversi (+{totalReadyNilai})
          </button>
          <button
            type="button"
            disabled={!!busyKey || (totalReadyNilai <= 0 && totalConvertibleUnits <= 0)}
            onClick={() => runAction('all-conv', () => onConvertAndApplyAll(targetMode))}
            className="px-3.5 py-2 text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-600 hover:brightness-105 disabled:opacity-50 text-white rounded-xl inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Konversi &amp; Tambahkan Semua
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[52vh]">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-100 border-b border-slate-200 text-slate-800 sticky top-0 z-10">
            <tr>
              <th className="py-2.5 px-3 w-8">#</th>
              <th className="py-2.5 px-3">Siswa &amp; Bintang Login</th>
              <th className="py-2.5 px-3 text-right">Saldo Poin</th>
              <th className="py-2.5 px-3 text-right">Siap Ditambahkan</th>
              <th className="py-2.5 px-3 text-right">Bonus Poin Nilai</th>
              <th className="py-2.5 px-3 text-right">Aksi Nilai &amp; Poin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {enriched.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 px-4 text-center text-slate-500">
                  Belum ada siswa di kelas ini.
                </td>
              </tr>
            ) : (
              enriched.map(({ s, stats, nilaiRow, convertibleUnits }, idx) => {
                const curBonus = num(nilaiRow.BonusPoin) || 0;
                const siapTargets = Array.from(
                  new Set(stats.siapRows.map((r: any) => getPoinTargetLabel(r.KomponenTarget)))
                ).join(', ');

                return (
                  <tr key={s.ID} className="hover:bg-amber-50/30">
                    <td className="py-2.5 px-3 tabular-nums text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900 flex flex-wrap items-center gap-1.5">
                        <span>{s.Nama}</span>
                        {(stats.totalBintang > 0 || stats.loggedInToday) && (
                          <span
                            title={`Total ${stats.totalBintang} Bintang Login`}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold tabular-nums"
                          >
                            <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                            {stats.totalBintang}
                          </span>
                        )}
                        {stats.loggedInToday && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-semibold">
                            <Sparkles className="w-2.5 h-2.5" /> Login Hari Ini
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono tabular-nums">NIS {s.NIS || '-'}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      <div className="font-bold text-slate-900">{stats.saldoPoin} Poin</div>
                      {convertibleUnits > 0 ? (
                        <div className="text-[10px] text-amber-700 font-semibold">
                          Bisa konversi +{convertibleUnits} nilai
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400">
                          Butuh {Math.max(1, poinPerNilai - stats.saldoPoin)} poin lagi
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {stats.nilaiSiapDitambahkan > 0 ? (
                        <div>
                          <span className="inline-block px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold">
                            +{stats.nilaiSiapDitambahkan} Nilai
                          </span>
                          {siapTargets && (
                            <div className="text-[10px] text-slate-500 mt-0.5">Usulan: {siapTargets}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-mono font-bold text-amber-800">
                      {curBonus > 0 ? `+${fmt(curBonus)}` : '0'}
                      {stats.nilaiSudahDitambahkan > 0 && (
                        <div className="text-[10px] font-sans font-normal text-emerald-700">
                          Total masuk: +{stats.nilaiSudahDitambahkan}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={!!busyKey}
                          onClick={() => runAction(`gift-${s.ID}`, () => onGiftPoints(s, poinPerLogin))}
                          title={`Beri +${poinPerLogin} poin bonus`}
                          className="px-2 py-1 text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg inline-flex items-center gap-0.5 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" /> {poinPerLogin} Poin
                        </button>
                        {stats.nilaiSiapDitambahkan > 0 && (
                          <button
                            type="button"
                            disabled={!!busyKey}
                            onClick={() =>
                              runAction(`apply-${s.ID}`, () => onApplyReadyForStudent(s.ID, targetMode))
                            }
                            className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg inline-flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Tambahkan (+{stats.nilaiSiapDitambahkan})
                          </button>
                        )}
                        {convertibleUnits > 0 && (
                          <button
                            type="button"
                            disabled={!!busyKey}
                            onClick={() =>
                              runAction(`conv-${s.ID}`, () => onConvertAndApplyStudent(s.ID, targetMode))
                            }
                            className="px-2.5 py-1 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg inline-flex items-center gap-1 cursor-pointer"
                          >
                            <ArrowRightLeft className="w-3 h-3" /> Konversi &amp; Tambah (+{convertibleUnits})
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer"
        >
          Tutup
        </button>
      </div>
    </div>
  );
};
