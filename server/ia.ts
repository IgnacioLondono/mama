import fs from 'node:fs/promises'
import path from 'node:path'
import { extractText } from 'unpdf'
import {
  getArchivoRow,
  getPatron,
  getProyecto,
  uploadsDir,
} from './db.ts'

const SYSTEM = `Asistente profesional de crochet y amigurumi. Español claro, tono experto y cercano.
Reglas: sé precisa y breve (máx. 6–8 oraciones o lista corta). Priorizá lo útil.
Si hay texto de PDF/patrón, cítalo o parafraséalo con fidelidad; no inventes vueltas, cantidades ni pasos que no estén.
Si el PDF no alcanza, dilo y ofrecé tips generales. Explicá abreviaciones (pb, aum, dis, an…) solo si aportan.`

const SYSTEM_CHAT = `Asistente profesional de crochet. Español claro y breve (máx. 5 oraciones).
Respondé dudas generales, tips y abreviaciones. Sin inventar vueltas de un patrón concreto. No digas que leíste un PDF.`


type CacheEntry = {
  key: string
  texto: string
  nombre: string
  at: number
}

const textoCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 1000 * 60 * 60 * 6
const MAX_CACHE = 40

export function invalidarTextoArchivo(archivoId: string) {
  textoCache.delete(archivoId)
}

export function iaConfigurada(): boolean {
  return Boolean(
    process.env.OPENAI_API_KEY?.trim() || process.env.OLLAMA_BASE_URL?.trim(),
  )
}

export function iaProveedor(): 'openai' | 'ollama' | 'ninguno' {
  if (process.env.OPENAI_API_KEY?.trim()) return 'openai'
  if (process.env.OLLAMA_BASE_URL?.trim()) return 'ollama'
  return 'ninguno'
}

function esPdf(nombre: string, tipo: string) {
  return tipo === 'application/pdf' || nombre.toLowerCase().endsWith('.pdf')
}

function esTextoPlano(nombre: string, tipo: string) {
  const n = nombre.toLowerCase()
  return (
    tipo.startsWith('text/') ||
    n.endsWith('.txt') ||
    n.endsWith('.md') ||
    n.endsWith('.csv')
  )
}

async function extraerTextoPdf(rutaAbs: string): Promise<string> {
  const buf = await fs.readFile(rutaAbs)
  const result = await extractText(new Uint8Array(buf), { mergePages: true })
  const texto = Array.isArray(result.text)
    ? result.text.join('\n')
    : String(result.text ?? '')
  return texto.replace(/\s+\n/g, '\n').replace(/[ \t]+/g, ' ').trim()
}

async function leerArchivoTexto(archivoId: string): Promise<{
  texto: string
  nombre: string
  aviso: string
}> {
  const row = await getArchivoRow(archivoId)
  if (!row) {
    return { texto: '', nombre: '', aviso: 'No encontré el archivo.' }
  }

  const full = path.join(uploadsDir, row.ruta)
  let mtime = 0
  try {
    const st = await fs.stat(full)
    mtime = st.mtimeMs
  } catch {
    return {
      texto: '',
      nombre: row.nombre,
      aviso: 'El archivo no está en disco.',
    }
  }

  const cacheKey = `${row.tamano}:${mtime}`
  const cached = textoCache.get(archivoId)
  if (cached && cached.key === cacheKey) {
    cached.at = Date.now()
    return { texto: cached.texto, nombre: cached.nombre, aviso: '' }
  }

  let texto = ''
  let aviso = ''

  if (esPdf(row.nombre, row.tipo)) {
    try {
      texto = await extraerTextoPdf(full)
      if (texto.length < 40) {
        aviso =
          'El PDF casi no tiene texto legible (puede ser escaneado o foto).'
      }
    } catch {
      aviso = 'No pude leer el PDF.'
    }
  } else if (esTextoPlano(row.nombre, row.tipo)) {
    try {
      texto = (await fs.readFile(full, 'utf8')).trim()
    } catch {
      aviso = 'No pude leer el archivo de texto.'
    }
  } else {
    aviso = `El archivo "${row.nombre}" no es PDF ni texto; me baso en el patrón anotado.`
  }

  if (texto) {
    if (textoCache.size >= MAX_CACHE) {
      let oldestId = ''
      let oldestAt = Infinity
      for (const [id, e] of textoCache) {
        if (e.at < oldestAt) {
          oldestAt = e.at
          oldestId = id
        }
      }
      if (oldestId) textoCache.delete(oldestId)
    }
    textoCache.set(archivoId, {
      key: cacheKey,
      texto,
      nombre: row.nombre,
      at: Date.now(),
    })
  }

  // Limpieza suave por TTL
  const now = Date.now()
  for (const [id, e] of textoCache) {
    if (now - e.at > CACHE_TTL_MS) textoCache.delete(id)
  }

  return { texto, nombre: row.nombre, aviso }
}

/** Elige trozos del PDF relevantes a la pregunta (más rápido y útil que mandar todo). */
function quiereLecturaAmplia(pregunta: string): boolean {
  return /\b(todo|toda|completo|completa|entero|entera|resumen|resum[ií]|lee|leer|lectura|explica(me)? el patr[oó]n|recorre|detalle)\b/i.test(
    pregunta,
  )
}

function seleccionarFragmentos(
  texto: string,
  pregunta: string,
  maxChars: number,
): string {
  if (texto.length <= maxChars) return texto

  const amplia = quiereLecturaAmplia(pregunta)
  // Lectura amplia: más del inicio + tramos equiespaciados (cobertura del PDF)
  if (amplia) {
    const head = Math.floor(maxChars * 0.45)
    const resto = maxChars - head - 40
    const chunks: string[] = [texto.slice(0, head)]
    const step = Math.max(800, Math.floor(texto.length / 5))
    let used = head
    for (let i = head; i < texto.length && used < maxChars; i += step) {
      const take = Math.min(Math.floor(resto / 4), maxChars - used)
      if (take < 120) break
      chunks.push(texto.slice(i, i + take))
      used += take + 10
    }
    return `${chunks.join('\n\n…\n\n')}\n…`
  }

  const stop = new Set([
    'para',
    'como',
    'qué',
    'que',
    'una',
    'uno',
    'los',
    'las',
    'del',
    'con',
    'por',
    'tips',
    'dame',
    'mejor',
    'este',
    'esta',
    'esto',
    'explica',
    'explicame',
    'explícame',
    'puedes',
    'hacer',
    'tengo',
    'sobre',
    'desde',
    'hacia',
  ])

  const keys =
    pregunta
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .match(/[a-z0-9]{3,}/g)
      ?.filter((w) => !stop.has(w)) ?? []

  const bloques = texto
    .split(/\n{2,}|(?=\n\s*(?:V\d+|Vuelta\s*\d+|Round\s*\d+|R\d+))/i)
    .map((b) => b.trim())
    .filter((b) => b.length > 15)

  const scored = bloques.map((b, i) => {
    const bl = b.toLowerCase()
    let score = i < 4 ? 1.5 : 0
    for (const k of keys) {
      if (bl.includes(k)) score += 3
    }
    if (
      /\bv\s*\d+\b|\bvuelta\s*\d+/i.test(pregunta) &&
      /\bv\s*\d+\b|\bvuelta/i.test(b)
    ) {
      score += 4
    }
    return { b, score, i }
  })

  scored.sort((a, c) => c.score - a.score || a.i - c.i)

  const elegidos: { b: string; i: number }[] = []
  let usado = 0
  const cabecera = texto.slice(0, Math.min(1200, Math.floor(maxChars * 0.3)))
  usado += cabecera.length
  elegidos.push({ b: cabecera, i: -1 })

  for (const s of scored) {
    if (s.score <= 0 && elegidos.length > 3) continue
    if (usado + s.b.length > maxChars) continue
    if (elegidos.some((e) => e.i === s.i || e.b === s.b)) continue
    elegidos.push({ b: s.b, i: s.i })
    usado += s.b.length + 8
    if (usado >= maxChars * 0.95) break
  }

  elegidos.sort((a, c) => a.i - c.i)
  const out = elegidos.map((e) => e.b).join('\n\n---\n\n')
  return out.length > maxChars ? `${out.slice(0, maxChars)}\n…` : out
}

async function cargarContexto(opts: {
  archivoId?: string
  patronId?: string
  proyectoId?: string
  pregunta?: string
}): Promise<{
  textoPdf: string
  resumenPatron: string
  aviso: string
  archivosLeidos: string[]
}> {
  let aviso = ''
  let textoPdf = ''
  let resumenPatron = ''
  const archivosLeidos: string[] = []

  let archivoId = opts.archivoId
  let patronId = opts.patronId
  const idsExtra: string[] = []

  if (opts.proyectoId) {
    const proy = await getProyecto(opts.proyectoId)
    if (proy) {
      patronId = patronId ?? proy.patronId
      archivoId =
        archivoId ?? proy.archivoActivoId ?? proy.archivos[0]?.id ?? undefined
      for (const a of proy.archivos) {
        if (a.id !== archivoId) idsExtra.push(a.id)
      }
      resumenPatron += `Proyecto: ${proy.nombre}. Parte activa: ${proy.parteActivaId}. Vueltas modo ${proy.modoVueltas}, objetivo ${proy.vueltasObjetivo}. Notas: ${proy.notas || '(sin notas)'}.\n`
    }
  }

  if (patronId) {
    const patron = await getPatron(patronId)
    if (patron) {
      archivoId =
        archivoId ??
        patron.archivoActivoId ??
        patron.archivos[0]?.id ??
        undefined
      for (const a of patron.archivos) {
        if (a.id !== archivoId && !idsExtra.includes(a.id)) idsExtra.push(a.id)
      }
      const partes = patron.partes
        .map(
          (p) =>
            `- ${p.nombre} (${p.vueltasTotales} vueltas): ${p.instrucciones.join(' | ')}`,
        )
        .join('\n')
      resumenPatron += `Patrón: ${patron.nombre}. ${patron.descripcion}. Dificultad: ${patron.dificultad}. Tiempo: ${patron.tiempoEstimado}.\nAbreviaciones: ${patron.abreviaciones.join('; ')}.\nPartes:\n${partes}\n`
    }
  }

  const partesTexto: string[] = []

  if (archivoId) {
    const principal = await leerArchivoTexto(archivoId)
    if (principal.nombre) archivosLeidos.push(principal.nombre)
    if (principal.texto) {
      partesTexto.push(`[Archivo: ${principal.nombre}]\n${principal.texto}`)
    }
    if (principal.aviso) aviso = principal.aviso
  } else {
    aviso = 'No hay archivo cargado; me baso en el patrón anotado.'
  }

  // Si el activo tiene poco texto, intenta otros PDFs/txt del proyecto o patrón
  if (partesTexto.join('').length < 80 && idsExtra.length) {
    for (const id of idsExtra.slice(0, 3)) {
      const extra = await leerArchivoTexto(id)
      if (extra.texto.length >= 40) {
        archivosLeidos.push(extra.nombre)
        partesTexto.push(`[Archivo: ${extra.nombre}]\n${extra.texto}`)
        if (aviso.includes('escaneado') || aviso.includes('No pude')) {
          aviso = ''
        }
      }
      if (partesTexto.join('').length > 200) break
    }
  }

  textoPdf = partesTexto.join('\n\n')
  if (textoPdf.length > 48000) {
    textoPdf = `${textoPdf.slice(0, 48000)}\n…(recortado)`
  }

  if (opts.pregunta && textoPdf) {
    const amplia = quiereLecturaAmplia(opts.pregunta)
    const max =
      iaProveedor() === 'ollama'
        ? Number(
            process.env.OLLAMA_PDF_CHARS ||
              (amplia ? 9000 : 6500),
          )
        : amplia
          ? 16000
          : 12000
    textoPdf = seleccionarFragmentos(textoPdf, opts.pregunta, max)
  }

  return { textoPdf, resumenPatron, aviso, archivosLeidos }
}

function acortar(texto: string, max: number): string {
  if (texto.length <= max) return texto
  return `${texto.slice(0, max)}\n…(recortado)`
}

async function llamarOpenAI(
  userContent: string,
  system = SYSTEM,
  opts?: { maxTokens?: number; signal?: AbortSignal },
): Promise<string> {
  const key = process.env.OPENAI_API_KEY!.trim()
  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini'
  const base =
    process.env.OPENAI_BASE_URL?.trim().replace(/\/$/, '') ||
    'https://api.openai.com/v1'

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    signal: opts?.signal,
    body: JSON.stringify({
      model,
      temperature: 0.25,
      max_tokens: opts?.maxTokens ?? 380,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OpenAI falló (${res.status}): ${errText.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  return data.choices?.[0]?.message?.content?.trim() || 'No hubo respuesta.'
}

async function llamarOllama(
  userContent: string,
  system = SYSTEM,
  opts?: { numPredict?: number; numCtx?: number; signal?: AbortSignal },
): Promise<string> {
  const base = process.env.OLLAMA_BASE_URL!.trim().replace(/\/$/, '')
  const model = process.env.OLLAMA_MODEL?.trim() || 'llama3.2'
  const numPredict =
    opts?.numPredict ?? Number(process.env.OLLAMA_NUM_PREDICT || 200)
  const numCtx = opts?.numCtx ?? Number(process.env.OLLAMA_NUM_CTX || 3072)

  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: opts?.signal,
    body: JSON.stringify({
      model,
      stream: false,
      keep_alive: '30m',
      options: {
        num_ctx: numCtx,
        num_predict: numPredict,
        temperature: 0.28,
        top_p: 0.85,
        num_thread: Number(process.env.OLLAMA_NUM_THREAD || 0) || undefined,
      },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Ollama falló (${res.status}): ${errText.slice(0, 200)}`)
  }

  const data = (await res.json()) as { message?: { content?: string } }
  return data.message?.content?.trim() || 'No hubo respuesta.'
}

/** Precarga texto del PDF y mantiene el modelo de Ollama en memoria. */
export async function precargarIa(opts: {
  archivoId?: string
  patronId?: string
  proyectoId?: string
}): Promise<{ ok: boolean; archivos: string[]; proveedor: string }> {
  const ctx = await cargarContexto({ ...opts, pregunta: '' })
  const proveedor = iaProveedor()

  if (proveedor === 'ollama') {
    const base = process.env.OLLAMA_BASE_URL!.trim().replace(/\/$/, '')
    const model = process.env.OLLAMA_MODEL?.trim() || 'llama3.2'
    // Keep-alive sin generar respuesta larga
    void fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        keep_alive: '30m',
        options: { num_predict: 1, num_ctx: 512 },
        messages: [{ role: 'user', content: 'ok' }],
      }),
    }).catch(() => {})
  }

  return {
    ok: true,
    archivos: ctx.archivosLeidos,
    proveedor,
  }
}

export async function pedirAyudaIa(opts: {
  pregunta?: string
  archivoId?: string
  patronId?: string
  proyectoId?: string
  /** Si es false, charla normal sin leer PDF (más rápido). */
  usarPdf?: boolean
  signal?: AbortSignal
}): Promise<{
  respuesta: string
  aviso?: string
  proveedor: string
  archivosLeidos?: string[]
}> {
  if (!iaConfigurada()) {
    throw new Error(
      'No hay IA configurada. Pon OPENAI_API_KEY u OLLAMA_BASE_URL en el servidor.',
    )
  }

  if (opts.signal?.aborted) {
    const e = new Error('Abortado')
    e.name = 'AbortError'
    throw e
  }

  const usarPdf = opts.usarPdf === true
  const pregunta =
    opts.pregunta?.trim() ||
    (usarPdf
      ? 'Lee el patrón y dame 4 tips prácticos para tejer sin perder vueltas.'
      : 'Dame un tip rápido de crochet para hoy.')

  let textoPdf = ''
  let resumenPatron = ''
  let aviso = ''
  let archivosLeidos: string[] = []

  if (usarPdf) {
    const ctx = await cargarContexto({
      archivoId: opts.archivoId,
      patronId: opts.patronId,
      proyectoId: opts.proyectoId,
      pregunta,
    })
    if (opts.signal?.aborted) {
      const e = new Error('Abortado')
      e.name = 'AbortError'
      throw e
    }
    textoPdf = ctx.textoPdf
    resumenPatron = ctx.resumenPatron
    aviso = ctx.aviso
    archivosLeidos = ctx.archivosLeidos
  } else if (opts.proyectoId || opts.patronId) {
    if (opts.proyectoId) {
      const proy = await getProyecto(opts.proyectoId)
      if (proy) {
        resumenPatron = `Proyecto: ${proy.nombre}. Parte: ${proy.parteActivaId}.`
      }
    } else if (opts.patronId) {
      const patron = await getPatron(opts.patronId)
      if (patron) {
        resumenPatron = `Patrón: ${patron.nombre}.`
      }
    }
  }

  const amplia = usarPdf && quiereLecturaAmplia(pregunta)
  const proveedor = iaProveedor()
  if (proveedor === 'ollama') {
    resumenPatron = acortar(resumenPatron, usarPdf ? 1000 : 280)
    // Ya viene fragmentado; no recortar de más
    if (usarPdf) {
      const tope = Number(
        process.env.OLLAMA_PDF_CHARS || (amplia ? 9000 : 6500),
      )
      textoPdf = acortar(textoPdf, tope)
    }
  }

  const system = usarPdf ? SYSTEM : SYSTEM_CHAT
  const userContent = [
    usarPdf
      ? archivosLeidos.length > 0
        ? `Archivos leídos: ${archivosLeidos.join(', ')}.`
        : 'Sin texto de archivo; solo cuaderno.'
      : 'Modo charla (sin PDF).',
    resumenPatron && `Contexto breve:\n${resumenPatron}`,
    usarPdf &&
      textoPdf &&
      `Texto del patrón / PDF (basate en esto; no inventes):\n${textoPdf}`,
    usarPdf && aviso && `Nota: ${aviso}`,
    `Pregunta:\n${pregunta}`,
    amplia
      ? 'Respondé con estructura clara y completa pero sin relleno.'
      : 'Respondé ya, profesional, corta y concreta.',
  ]
    .filter(Boolean)
    .join('\n\n')

  const genOpts = {
    signal: opts.signal,
    maxTokens: usarPdf ? (amplia ? 520 : 360) : 220,
    numPredict: usarPdf ? (amplia ? 320 : 240) : 160,
    numCtx: usarPdf ? (amplia ? 6144 : 4096) : 2048,
  }

  const respuesta =
    proveedor === 'openai'
      ? await llamarOpenAI(userContent, system, {
          maxTokens: genOpts.maxTokens,
          signal: genOpts.signal,
        })
      : await llamarOllama(userContent, system, {
          numPredict: genOpts.numPredict,
          numCtx: genOpts.numCtx,
          signal: genOpts.signal,
        })

  const avisoFinal = usarPdf
    ? [
        aviso || undefined,
        archivosLeidos.length
          ? `Leí: ${archivosLeidos.join(', ')}.`
          : undefined,
      ]
        .filter(Boolean)
        .join(' ')
    : undefined

  return {
    respuesta,
    aviso: avisoFinal || undefined,
    proveedor,
    archivosLeidos: usarPdf ? archivosLeidos : [],
  }
}

/** Calienta Ollama en segundo plano al arrancar el servidor. */
export function calentarIaEnSegundoPlano() {
  if (iaProveedor() !== 'ollama') return
  setTimeout(() => {
    void precargarIa({}).catch(() => {})
  }, 4000)
}
