import fs from 'node:fs/promises'
import path from 'node:path'
import { extractText } from 'unpdf'
import {
  getArchivoRow,
  getPatron,
  getProyecto,
  uploadsDir,
} from './db.ts'

const SYSTEM = `Eres una ayudante de crochet y amigurumi, cercana y clara, como si hablaras con alguien que teje en casa.
Responde siempre en español, con frases cortas y útiles.
Puedes: explicar abreviaciones (pb, aum, dis, an…), dar tips de tensión, relleno, cosido, marcar vueltas, y avisos si algo del patrón parece confuso.
No inventes vueltas exactas si el PDF no las trae: dilo con honestidad.
Si el texto del PDF está vacío o es escaso, pide que revise si el PDF es una foto escaneada y da tips generales.`

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

async function extraerTextoPdf(rutaAbs: string): Promise<string> {
  const buf = await fs.readFile(rutaAbs)
  const result = await extractText(new Uint8Array(buf), { mergePages: true })
  const texto = Array.isArray(result.text)
    ? result.text.join('\n')
    : String(result.text ?? '')
  return texto.replace(/\s+\n/g, '\n').trim()
}

async function cargarContexto(opts: {
  archivoId?: string
  patronId?: string
  proyectoId?: string
}): Promise<{ textoPdf: string; resumenPatron: string; aviso: string }> {
  let aviso = ''
  let textoPdf = ''
  let resumenPatron = ''

  let archivoId = opts.archivoId
  let patronId = opts.patronId

  if (opts.proyectoId) {
    const proy = await getProyecto(opts.proyectoId)
    if (proy) {
      patronId = patronId ?? proy.patronId
      archivoId =
        archivoId ?? proy.archivoActivoId ?? proy.archivos[0]?.id ?? undefined
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
      const partes = patron.partes
        .map(
          (p) =>
            `- ${p.nombre} (${p.vueltasTotales} vueltas): ${p.instrucciones.join(' | ')}`,
        )
        .join('\n')
      resumenPatron += `Patrón: ${patron.nombre}. ${patron.descripcion}. Dificultad: ${patron.dificultad}. Tiempo: ${patron.tiempoEstimado}.\nAbreviaciones: ${patron.abreviaciones.join('; ')}.\nPartes:\n${partes}\n`
    }
  }

  if (archivoId) {
    const row = await getArchivoRow(archivoId)
    if (row) {
      const full = path.join(uploadsDir, row.ruta)
      const esPdf =
        row.tipo === 'application/pdf' ||
        row.nombre.toLowerCase().endsWith('.pdf')
      if (esPdf) {
        try {
          textoPdf = await extraerTextoPdf(full)
          if (textoPdf.length < 40) {
            aviso =
              'El PDF casi no tiene texto legible (puede ser escaneado). Tips generales según el patrón anotado.'
          }
        } catch {
          aviso = 'No pude leer el PDF. Me baso en lo anotado del patrón.'
        }
      } else {
        aviso = 'El archivo activo no es PDF; me baso en el patrón anotado.'
      }
    }
  } else {
    aviso = 'No hay PDF cargado; me baso en el patrón anotado.'
  }

  if (textoPdf.length > 12000) {
    textoPdf = `${textoPdf.slice(0, 12000)}\n…(recortado)`
  }

  return { textoPdf, resumenPatron, aviso }
}

async function llamarOpenAI(userContent: string): Promise<string> {
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
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: [
        { role: 'system', content: SYSTEM },
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

async function llamarOllama(userContent: string): Promise<string> {
  const base = process.env.OLLAMA_BASE_URL!.trim().replace(/\/$/, '')
  const model = process.env.OLLAMA_MODEL?.trim() || 'llama3.2'

  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: 'system', content: SYSTEM },
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

export async function pedirAyudaIa(opts: {
  pregunta?: string
  archivoId?: string
  patronId?: string
  proyectoId?: string
}): Promise<{ respuesta: string; aviso?: string; proveedor: string }> {
  if (!iaConfigurada()) {
    throw new Error(
      'No hay IA configurada. Pon OPENAI_API_KEY u OLLAMA_BASE_URL en el servidor.',
    )
  }

  const { textoPdf, resumenPatron, aviso } = await cargarContexto(opts)
  const pregunta =
    opts.pregunta?.trim() ||
    'Lee lo que hay y dame 4 tips prácticos para tejer este amigurumi sin perder vueltas.'

  const userContent = [
    resumenPatron && `Datos del cuaderno:\n${resumenPatron}`,
    textoPdf && `Texto extraído del PDF:\n${textoPdf}`,
    aviso && `Nota: ${aviso}`,
    `Pregunta de quien teje:\n${pregunta}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  const proveedor = iaProveedor()
  const respuesta =
    proveedor === 'openai'
      ? await llamarOpenAI(userContent)
      : await llamarOllama(userContent)

  return { respuesta, aviso: aviso || undefined, proveedor }
}
