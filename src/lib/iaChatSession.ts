import { loadJson, saveJson } from './storage'

export type IaChatMsg = {
  id: string
  rol: 'yo' | 'bot' | 'aviso' | 'error'
  texto: string
}

const HOLA: IaChatMsg = {
  id: 'hola',
  rol: 'bot',
  texto:
    'Hola. Puedo charlar normal o mirar el PDF si lo activás. ¿En qué te ayudo?',
}

const MAX_MSGS = 80

function key(scope: string) {
  return `ia-chat-${scope}`
}

export function iaChatScope(opts: {
  proyectoId?: string
  patronId?: string
}): string {
  if (opts.proyectoId) return `proyecto-${opts.proyectoId}`
  if (opts.patronId) return `patron-${opts.patronId}`
  return 'global'
}

export function loadIaChat(scope: string): IaChatMsg[] {
  const saved = loadJson<IaChatMsg[] | null>(key(scope), null)
  if (!Array.isArray(saved) || saved.length === 0) return [{ ...HOLA }]
  return saved.filter(
    (m) =>
      m &&
      typeof m.id === 'string' &&
      typeof m.texto === 'string' &&
      (m.rol === 'yo' ||
        m.rol === 'bot' ||
        m.rol === 'aviso' ||
        m.rol === 'error'),
  )
}

export function saveIaChat(scope: string, msgs: IaChatMsg[]): void {
  saveJson(key(scope), msgs.slice(-MAX_MSGS))
}

export function clearIaChat(scope: string): void {
  saveJson(key(scope), [{ ...HOLA, id: `hola-${Date.now()}` }])
}
