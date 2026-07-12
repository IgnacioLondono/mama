import type { ColorCarpeta, IconoPatron } from '../types'
import { normalizarColorCarpeta, normalizarIconoPatron } from '../types'

const KEY = 'tm-carpetas-vacias'

export type CarpetaVacia = {
  tema: IconoPatron
  color: ColorCarpeta
}

function keyOf(c: CarpetaVacia) {
  return `${c.tema}::${c.color}`
}

export function loadCarpetasVacias(): CarpetaVacia[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as CarpetaVacia[]
    return list.map((c) => ({
      tema: normalizarIconoPatron(c.tema),
      color: normalizarColorCarpeta(c.color),
    }))
  } catch {
    return []
  }
}

export function saveCarpetasVacias(list: CarpetaVacia[]) {
  localStorage.setItem(KEY, JSON.stringify(list))
}

export function addCarpetaVacia(c: CarpetaVacia) {
  const next = loadCarpetasVacias()
  const k = keyOf(c)
  if (next.some((x) => keyOf(x) === k)) return
  saveCarpetasVacias([...next, c])
}

export function removeCarpetaVacia(c: CarpetaVacia) {
  const k = keyOf(c)
  saveCarpetasVacias(loadCarpetasVacias().filter((x) => keyOf(x) !== k))
}
