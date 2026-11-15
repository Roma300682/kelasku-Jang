import React, { useEffect, useState } from 'react';
import { BookOpen, Check, Image as ImageIcon, Plus, Trash2, Upload, X } from 'lucide-react';

interface AturMapelKelasModalProps {
  kls: any;
  clsSubjects: string[];
  allDbMapels: any[];
  jadwalList: any[];
  onAddGlobalMapel: (newName: string) => Promise<void>;
  onSave: (selectedSubjects: string[]) => Promise<void>;
  onClose: () => void;
  showToast: (msg: string, ms?: number) => void;
}

export const AturMapelKelasModal: React.FC<AturMapelKelasModalProps> = ({
  kls,
  clsSubjects,
  allDbMapels,
  jadwalList,
  onAddGlobalMapel,
  onSave,
  onClose,
  showToast
}) => {
  const mapelById = new Map<string, string>(
    (allDbMapels || []).map((m: any) => [String(m.ID || ''), String(m.Nama || '').trim()])
  );

  const rawExplicit = String(kls?.Mapel || '').trim();
  const initialChecked: string[] = (() => {
    if (rawExplicit === '__NONE__') return [];
    if (rawExplicit) {
      const seen = new Set<string>();
      const out: string[] = [];
      rawExplicit
        .split(',')
        .map(s => mapelById.get(s.trim()) || s.trim())
        .filter(Boolean)
        .forEach(name => {
          const k = name.toLowerCase();
          if (!seen.has(k)) {
            seen.add(k);
            out.push(name);
          }
        });
      return out;
    }
    return clsSubjects;
  })();

  const [checked, setChecked] = useState<string[]>(initialChecked);
  const [newMapelName, setNewMapelName] = useState('');
  const [extraNames, setExtraNames] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const allMapelNames: string[] = (() => {
    const seen = new Set<string>();
    const out: string[] = [];
    [
      ...(allDbMapels || []).map((m: any) => String(m.Nama || '').trim()),
      ...extraNames,
      ...checked
    ]
      .filter(Boolean)
      .forEach(name => {
        const k = name.toLowerCase();
        if (!seen.has(k)) {
          seen.add(k);
          out.push(name);
        }
      });
    return out;
  })();

  const applyPresetJurusan = () => {
    const jur = String(kls?.Jurusan || '').toUpperCase();
    const umum = [
      'Matematika',
      'Bahasa Indonesia',
      'Bahasa Inggris',
      'Sejarah',
      'PJOK',
      'Pendidikan Pancasila',
      'Informatika',
      'Agama'
    ];
    let preset: string[] = [];
    if (jur.includes('MIPA') || jur.includes('IPA')) {
      preset = [...umum, 'Fisika', 'Kimia', 'Biologi'];
    } else if (jur.includes('IPS')) {
      preset = [...umum, 'Ekonomi', 'Sosiologi', 'Geografi'];
    } else if (jur.includes('BAHASA')) {
      preset = [...umum, 'Sastra', 'Bahasa Arab', 'Bahasa Jepang', 'Antropologi'];
    } else {
      preset = [...umum];
    }
    const matched = allMapelNames.filter(x =>
      preset.some(p => x.toLowerCase().includes(p.toLowerCase()))
    );
    setChecked(matched.length > 0 ? matched : allMapelNames);
  };

  const applyFromJadwal = () => {
    const jSubjects = new Set<string>();
    (jadwalList || [])
      .filter((j: any) => j.Kelas === kls?.ID && (!j.Jenis || j.Jenis === 'Pelajaran'))
      .forEach((j: any) => {
        const nm = String(j.Mapel || '').trim();
        if (nm && !/^istirahat$/i.test(nm)) jSubjects.add(nm);
      });
    if (jSubjects.size === 0) {
      showToast('Belum ada jadwal pelajaran di kelas ini');
      return;
    }
    const list = Array.from(jSubjects);
    setExtraNames(prev => Array.from(new Set([...prev, ...list])));
    setChecked(list);
  };

  const handleAddNewMapel = async () => {
    const val = newMapelName.trim();
    if (!val) return;
    if (!allMapelNames.some(x => x.toLowerCase() === val.toLowerCase())) {
      await onAddGlobalMapel(val);
    }
    setExtraNames(prev => (prev.some(x => x.toLowerCase() === val.toLowerCase()) ? prev : [...prev, val]));
    setChecked(prev => (prev.some(x => x.toLowerCase() === val.toLowerCase()) ? prev : [...prev, val]));
    setNewMapelName('');
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-600">
        Pilih mata pelajaran yang dipelajari di kelas <strong>{kls?.Nama}</strong> ({kls?.Jurusan || 'Umum'}).
        Menu <strong>Perangkat Ajar</strong>, <strong>Tugas</strong>, dan <strong>Portal Siswa</strong> akan otomatis menyesuaikan daftar ini.
      </p>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={applyPresetJurusan}
          className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg cursor-pointer"
        >
          Sesuai Jurusan ({kls?.Jurusan || 'Umum'})
        </button>
        <button
          type="button"
          onClick={applyFromJadwal}
          className="px-2.5 py-1 text-[11px] font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg cursor-pointer"
        >
          Ikuti Jadwal Kelas
        </button>
        <button
          type="button"
          onClick={() => setChecked(allMapelNames)}
          className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg cursor-pointer"
        >
          Pilih Semua
        </button>
        <button
          type="button"
          onClick={() => setChecked([])}
          className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
        >
          Kosongkan
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto p-2 border border-slate-200 rounded-xl bg-slate-50/50">
        {allMapelNames.map(mName => {
          const isOn = checked.some(x => x.toLowerCase() === mName.toLowerCase());
          return (
            <label
              key={mName}
              className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                isOn
                  ? 'bg-white border-sky-400 text-sky-950 font-semibold shadow-2xs'
                  : 'bg-white/60 border-slate-200 text-slate-600'
              }`}
            >
              <input
                type="checkbox"
                checked={isOn}
                onChange={() => {
                  setChecked(prev =>
                    isOn
                      ? prev.filter(x => x.toLowerCase() !== mName.toLowerCase())
                      : [...prev, mName]
                  );
                }}
              />
              <span className="truncate">{mName}</span>
            </label>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newMapelName}
          onChange={e => setNewMapelName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddNewMapel();
            }
          }}
          placeholder="Tambah mapel khusus baru (mis. Ekonomi)…"
          className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
        />
        <button
          type="button"
          onClick={handleAddNewMapel}
          className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg inline-flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Tambah
        </button>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
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
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(checked);
            } finally {
              setSaving(false);
            }
          }}
          className="px-4 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-lg cursor-pointer disabled:opacity-50"
        >
          {saving ? 'Menyimpan…' : `Simpan Mapel Kelas (${checked.length})`}
        </button>
      </div>
    </div>
  );
};

interface EditableKelasRowProps {
  kls: any;
  pilihanJur: string[];
  clsSubjects: string[];
  canDelete: boolean;
  onRename: (newName: string) => Promise<void>;
  onChangeJurusan: (newJurusan: string) => Promise<void>;
  onOpenAturMapel: () => void;
  onDelete: () => Promise<void>;
}

export const EditableKelasRow: React.FC<EditableKelasRowProps> = ({
  kls,
  pilihanJur,
  clsSubjects,
  canDelete,
  onRename,
  onChangeJurusan,
  onOpenAturMapel,
  onDelete
}) => {
  const [nameDraft, setNameDraft] = useState(String(kls.Nama || ''));
  useEffect(() => {
    setNameDraft(String(kls.Nama || ''));
  }, [kls.ID, kls.Nama]);

  const isDirty = nameDraft.trim() !== String(kls.Nama || '').trim();
  const explicitRaw = String(kls.Mapel || '').trim();
  const explicitConfigured = explicitRaw.length > 0;

  const commitName = async () => {
    const clean = nameDraft.trim() || 'Kelas';
    if (clean === String(kls.Nama || '').trim()) {
      setNameDraft(String(kls.Nama || ''));
      return;
    }
    await onRename(clean);
  };

  return (
    <div className="p-3 rounded-xl border border-sky-100 bg-sky-50/30 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[140px] flex items-center gap-1">
          <input
            value={nameDraft}
            onChange={e => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitName();
              }
            }}
            placeholder="Nama kelas (mis. X MIPA 1)"
            className={`w-full px-2.5 py-1.5 text-xs font-bold bg-white border rounded-lg ${
              isDirty ? 'border-sky-500 ring-2 ring-sky-100' : 'border-slate-200'
            }`}
          />
          {isDirty && (
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={commitName}
              title="Simpan nama kelas"
              className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg cursor-pointer shrink-0"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <select
          value={kls.Jurusan || ''}
          onChange={e => onChangeJurusan(e.target.value)}
          className="w-32 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-white border border-slate-200 rounded-lg cursor-pointer"
        >
          <option value="">Pilih Jurusan…</option>
          {pilihanJur.map(j => (
            <option key={j} value={j}>
              {j}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onOpenAturMapel}
          className="px-2.5 py-1.5 text-xs font-semibold bg-white hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg inline-flex items-center gap-1 cursor-pointer shrink-0"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Atur Mapel ({clsSubjects.length})</span>
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            title="Hapus Kelas"
            className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap px-0.5">
        <span className="font-semibold text-slate-600">
          {explicitConfigured ? 'Mapel Khusus Kelas:' : 'Mapel Aktif (Jadwal/Sekolah):'}
        </span>
        <span className="truncate">
          {explicitRaw === '__NONE__'
            ? 'Dikosongkan (0 mata pelajaran)'
            : clsSubjects.length > 0
              ? clsSubjects.join(', ')
              : 'Belum ada mata pelajaran'}
        </span>
      </div>
    </div>
  );
};

interface EditableJurusanRowProps {
  jurusanName: string;
  jLogo: string;
  canDelete: boolean;
  onRename: (newName: string) => Promise<void>;
  onUploadLogo: (file: File) => Promise<void>;
  onDeleteLogo: () => Promise<void>;
  onDelete: () => Promise<void>;
}

export const EditableJurusanRow: React.FC<EditableJurusanRowProps> = ({
  jurusanName,
  jLogo,
  canDelete,
  onRename,
  onUploadLogo,
  onDeleteLogo,
  onDelete
}) => {
  const [draft, setDraft] = useState(jurusanName);
  useEffect(() => {
    setDraft(jurusanName);
  }, [jurusanName]);

  const isDirty = draft.trim() !== jurusanName.trim() && draft.trim().length > 0;

  const commit = async () => {
    const val = draft.trim();
    if (!val || val === jurusanName) {
      setDraft(jurusanName);
      return;
    }
    await onRename(val);
  };

  return (
    <div className="p-2 rounded-xl bg-violet-50/40 border border-violet-200 flex items-center gap-2">
      <label
        title={`Unggah logo jurusan ${jurusanName}`}
        className="w-10 h-10 rounded-lg border border-violet-200 bg-white flex items-center justify-center shrink-0 cursor-pointer hover:border-violet-400 overflow-hidden"
      >
        {jLogo ? (
          <img src={jLogo} alt={`Logo ${jurusanName}`} className="w-full h-full object-contain p-0.5" />
        ) : (
          <ImageIcon className="w-4 h-4 text-violet-400" />
        )}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) onUploadLogo(f);
            e.target.value = '';
          }}
        />
      </label>
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
        }}
        className={`flex-1 min-w-0 px-2.5 py-1.5 text-xs font-semibold bg-white border rounded-lg ${
          isDirty ? 'border-violet-500 ring-2 ring-violet-100' : 'border-violet-200'
        }`}
      />
      {isDirty && (
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={commit}
          title="Simpan perubahan nama jurusan"
          className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg cursor-pointer shrink-0"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
      )}
      <label
        title="Unggah / Ganti Logo Jurusan"
        className="px-2.5 py-1.5 text-[11px] font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg cursor-pointer inline-flex items-center gap-1 shrink-0"
      >
        <Upload className="w-3 h-3" /> Logo
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) onUploadLogo(f);
            e.target.value = '';
          }}
        />
      </label>
      {jLogo && (
        <button
          type="button"
          title="Hapus logo jurusan"
          onClick={onDeleteLogo}
          className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          title="Hapus jurusan"
          onClick={onDelete}
          className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

interface EditableMapelRowProps {
  mapel: any;
  canDelete: boolean;
  onRename: (newName: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

export const EditableMapelRow: React.FC<EditableMapelRowProps> = ({
  mapel,
  canDelete,
  onRename,
  onDelete
}) => {
  const [draft, setDraft] = useState(String(mapel.Nama || ''));
  useEffect(() => {
    setDraft(String(mapel.Nama || ''));
  }, [mapel.ID, mapel.Nama]);

  const isDirty = draft.trim() !== String(mapel.Nama || '').trim() && draft.trim().length > 0;

  const commit = async () => {
    const val = draft.trim();
    if (!val || val === mapel.Nama) {
      setDraft(String(mapel.Nama || ''));
      return;
    }
    await onRename(val);
  };

  return (
    <div className="flex items-center gap-1.5">
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
        }}
        className={`flex-1 min-w-0 px-3 py-1.5 text-xs font-semibold bg-emerald-50/40 border rounded-lg ${
          isDirty ? 'border-emerald-500 ring-2 ring-emerald-100 bg-white' : 'border-emerald-200'
        }`}
      />
      {isDirty && (
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={commit}
          title="Simpan perubahan nama mata pelajaran"
          className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg cursor-pointer shrink-0"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          title="Hapus Mata Pelajaran"
          className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
