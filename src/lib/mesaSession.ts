import type { ModoVueltas, ProgresoParte } from '../types'
import { loadJson, saveJson } from './storage'

export type MesaPanel = 'pasos' | 'partes' | 'apuntes' | null

export interface MesaPdfPos {
  scrollRatio: number
  scrollTop: number
}

export interface MesaProgresoCache {
  progreso: ProgresoParte[]
  parteActivaId: string
  modoVueltas: ModoVueltas
  vueltasObjetivo: number
  archivoActivoId: string | null
}

export interface MesaSession {
  panel: MesaPanel
  pdf: Record<string, MesaPdfPos>
  progreso?: MesaProgresoCache
  updatedEn: string
}

function key(proyectoId: string) {
  return `mesa-${proyectoId}`
}

const empty: MesaSession = {
  panel: 'pasos',
  pdf: {},
  updatedEn: '',
}

export function loadMesaSession(proyectoId: string): MesaSession {
  return loadJson(key(proyectoId), empty)
}

export function saveMesaSession(
  proyectoId: string,
  patch: Partial<MesaSession>,
): void {
  const cur = loadMesaSession(proyectoId)
  saveJson(key(proyectoId), {
    ...cur,
    ...patch,
    pdf: patch.pdf ? { ...cur.pdf, ...patch.pdf } : cur.pdf,
    updatedEn: new Date().toISOString(),
  })
}

export function saveMesaPdfPos(
  proyectoId: string,
  archivoId: string,
  pos: MesaPdfPos,
): void {
  const cur = loadMesaSession(proyectoId)
  saveMesaSession(proyectoId, {
    pdf: {
      ...cur.pdf,
      [archivoId]: pos,
    },
  })
}

export function loadMesaPdfPos(
  proyectoId: string,
  archivoId: string,
): MesaPdfPos | null {
  return loadMesaSession(proyectoId).pdf[archivoId] ?? null
}

export function saveMesaProgreso(
  proyectoId: string,
  progreso: MesaProgresoCache,
): void {
  saveMesaSession(proyectoId, { progreso })
}

/** Si el cache local tiene más avance, úsalo al pintar. */
export function mergeProgresoFromCache<
  T extends {
    id: string
    progreso: ProgresoParte[]
    parteActivaId: string
    modoVueltas: ModoVueltas
    vueltasObjetivo: number
    archivoActivoId: string | null
  },
>(proyecto: T): T {
  const s = loadMesaSession(proyecto.id)
  const c = s.progreso
  if (!c?.progreso?.length) return proyecto
  const sum = (list: ProgresoParte[]) =>
    list.reduce((acc, x) => acc + (x.vueltaActual || 0), 0)
  if (sum(c.progreso) < sum(proyecto.progreso)) return proyecto
  return {
    ...proyecto,
    progreso: c.progreso,
    parteActivaId: c.parteActivaId || proyecto.parteActivaId,
    modoVueltas: c.modoVueltas ?? proyecto.modoVueltas,
    vueltasObjetivo: c.vueltasObjetivo ?? proyecto.vueltasObjetivo,
    archivoActivoId:
      c.archivoActivoId !== undefined
        ? c.archivoActivoId
        : proyecto.archivoActivoId,
  }
}
