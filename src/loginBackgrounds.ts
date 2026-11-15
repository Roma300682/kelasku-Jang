import bgClassroom from './assets/images/login_bg_classroom_1794748058940.jpg';
import bgStudyDesk from './assets/images/login_bg_study_desk_1794748059665.jpg';
import bgScienceLab from './assets/images/login_bg_science_lab_1794748060482.jpg';

export interface LoginBgPreset {
  id: string;
  label: string;
  src: string;
}

export const DEFAULT_LOGIN_BG = 'preset:classroom';

export const LOGIN_BG_PRESETS: LoginBgPreset[] = [
  {
    id: 'preset:classroom',
    label: 'Ruang Belajar & Perpustakaan',
    src: bgClassroom
  },
  {
    id: 'preset:study',
    label: 'Meja Studi & Literasi',
    src: bgStudyDesk
  },
  {
    id: 'preset:science',
    label: 'Studio Sains & STEM',
    src: bgScienceLab
  }
];

export function resolveLoginBgUrl(val?: string): string {
  const clean = String(val || '').trim();
  if (clean === 'none') return '';
  if (!clean) return bgClassroom;
  const preset = LOGIN_BG_PRESETS.find(p => p.id === clean);
  if (preset) return preset.src;
  if (
    clean.startsWith('data:image/') ||
    clean.startsWith('/') ||
    clean.startsWith('http://') ||
    clean.startsWith('https://')
  ) {
    return clean;
  }
  return bgClassroom;
}

export function getLoginBgLabel(val?: string): string {
  const clean = String(val || '').trim();
  if (clean === 'none') return 'Gradien Polos (Tanpa Foto)';
  if (!clean) return LOGIN_BG_PRESETS[0].label;
  const preset = LOGIN_BG_PRESETS.find(p => p.id === clean);
  if (preset) return preset.label;
  if (clean.startsWith('data:image/')) return 'Gambar Latar Kustom';
  return LOGIN_BG_PRESETS[0].label;
}

export async function prosesBackgroundGambar(file: File, maxDim = 1440): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Pilih berkas gambar valid (PNG, JPG, WebP, atau SVG)');
  }
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar latar'));
    reader.onload = () => {
      const raw = String(reader.result || '');
      if (file.type === 'image/svg+xml' && raw.length < 300000) {
        resolve(raw);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(raw);
        ctx.drawImage(img, 0, 0, w, h);
        let encoded = canvas.toDataURL('image/jpeg', 0.84);
        if (encoded.length > 1300000) {
          encoded = canvas.toDataURL('image/jpeg', 0.7);
        }
        resolve(encoded);
      };
      img.onerror = () => reject(new Error('Format gambar tidak didukung browser'));
      img.src = raw;
    };
    reader.readAsDataURL(file);
  });
}
