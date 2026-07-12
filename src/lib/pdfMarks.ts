import { loadJson, saveJson } from './storage'

/** Puntos normalizados 0–1 respecto al tamaño visible del PDF. */
export type PdfMarkPoint = { x: number; y: number }

export type PdfMarkStroke = {
  id: string
  /** 'linea' = resaltador horizontal; 'libre' = pincel libre */
  tipo: 'linea' | 'libre'
  color: string
  /** Grosor relativo al alto de página (0–1). */
  grosor: number
  points: PdfMarkPoint[]
}

export type PdfMarksByPage = Record<string, PdfMarkStroke[]>

function key(proyectoId: string, archivoId: string) {
  return `pdf-marks-${proyectoId}-${archivoId}`
}

export function loadPdfMarks(
  proyectoId: string,
  archivoId: string,
): PdfMarksByPage {
  return loadJson(key(proyectoId, archivoId), {})
}

export function savePdfMarks(
  proyectoId: string,
  archivoId: string,
  marks: PdfMarksByPage,
): void {
  saveJson(key(proyectoId, archivoId), marks)
}

export function loadPdfMarksPage(
  proyectoId: string,
  archivoId: string,
  pagina: number,
): PdfMarkStroke[] {
  return loadPdfMarks(proyectoId, archivoId)[String(pagina)] ?? []
}

export function savePdfMarksPage(
  proyectoId: string,
  archivoId: string,
  pagina: number,
  strokes: PdfMarkStroke[],
): void {
  const all = loadPdfMarks(proyectoId, archivoId)
  if (strokes.length === 0) delete all[String(pagina)]
  else all[String(pagina)] = strokes
  savePdfMarks(proyectoId, archivoId, all)
}

export const COLORES_RESALTE = [
  { id: 'amarillo', color: 'rgba(255, 230, 80, 0.45)', label: 'Amarillo' },
  { id: 'rosa', color: 'rgba(255, 140, 180, 0.4)', label: 'Rosa' },
  { id: 'verde', color: 'rgba(120, 220, 140, 0.4)', label: 'Verde' },
  { id: 'celeste', color: 'rgba(120, 190, 255, 0.4)', label: 'Celeste' },
] as const
