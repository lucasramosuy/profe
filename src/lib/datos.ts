import { readFileSync } from 'node:fs';
import { fechaLarga } from './fechas';

function leerJson(ruta: string): any {
  try {
    const txt = readFileSync(new URL(ruta, import.meta.url), 'utf8').trim();
    return txt ? JSON.parse(txt) : null;
  } catch {
    return null;
  }
}

export interface Material { titulo: string; curso: string; descripcion?: string; archivo: string; fecha?: string }
export interface Video { id: string; titulo: string; fecha?: string; fijado?: boolean }

export type Tipo = 'pdf' | 'doc' | 'ppt' | 'otro';
export function tipoDe(archivo: string): Tipo {
  const ext = (archivo.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx', 'odt'].includes(ext)) return 'doc';
  if (['ppt', 'pptx', 'odp'].includes(ext)) return 'ppt';
  return 'otro';
}
export const BADGE: Record<Tipo, string> = { pdf: 'PDF', doc: 'DOC', ppt: 'PPT', otro: 'ADJ' };

// Materiales agrupados por curso, cada grupo ordenado por fecha (más nuevo primero).
export function materialesPorCurso(): { curso: string; docs: (Material & { meta: string })[] }[] {
  const d = leerJson('../../docs/materiales.json');
  const lista: Material[] = Array.isArray(d) ? d : (d?.materiales ?? []);
  const grupos = new Map<string, Material[]>();
  for (const m of lista) {
    if (!m?.titulo || !m?.archivo) continue;
    const curso = m.curso || 'Otros';
    grupos.set(curso, [...(grupos.get(curso) ?? []), m]);
  }
  return [...grupos].map(([curso, docs]) => ({
    curso,
    docs: docs
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
      .map(m => ({
        ...m,
        meta: [m.descripcion, m.fecha ? 'Actualizado el ' + fechaLarga(m.fecha) : ''].filter(Boolean).join(' · '),
      })),
  }));
}

export function videos(): Video[] {
  const d = leerJson('../../docs/videos.json');
  if (!d) return [];
  const ok = (v: any) => v && /^[\w-]{6,}$/.test(v.id);
  const fijos: Video[] = (Array.isArray(d.destacados) ? d.destacados : []).filter(ok).slice(0, 6);
  const ids = new Set(fijos.map(v => v.id));
  const auto: Video[] = (Array.isArray(d.videos) ? d.videos : []).filter((v: any) => ok(v) && !ids.has(v.id));
  return fijos.map(v => ({ ...v, fijado: true })).concat(auto).slice(0, 6);
}
