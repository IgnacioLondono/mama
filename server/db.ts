import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql, { type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise'
import { seedMateriales, seedPatrones } from '../src/data/seed.ts'
import type { ArchivoMeta, Material, Patron, Proyecto } from '../src/types.ts'
import { normalizarColorCarpeta, normalizarIconoPatron } from '../src/types.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
export const dataDir = path.join(root, 'data')
export const uploadsDir = path.join(dataDir, 'uploads')

fs.mkdirSync(uploadsDir, { recursive: true })

let pool: Pool

export async function initDb() {
  pool = mysql.createPool({
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER ?? 'tejidos',
    password: process.env.MYSQL_PASSWORD ?? 'tejidos',
    database: process.env.MYSQL_DATABASE ?? 'tejidos',
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
  })

  // Esperar a que MySQL esté listo (útil en Docker)
  for (let i = 0; i < 30; i++) {
    try {
      await pool.query('SELECT 1')
      break
    } catch (err) {
      if (i === 29) throw err
      await new Promise((r) => setTimeout(r, 2000))
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS patrones (
      id VARCHAR(64) PRIMARY KEY,
      data JSON NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS proyectos (
      id VARCHAR(64) PRIMARY KEY,
      data JSON NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS materiales (
      id VARCHAR(64) PRIMARY KEY,
      data JSON NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS archivos (
      id VARCHAR(64) PRIMARY KEY,
      proyecto_id VARCHAR(64) NULL,
      patron_id VARCHAR(64) NULL,
      nombre VARCHAR(512) NOT NULL,
      tipo VARCHAR(255) NOT NULL,
      tamano INT NOT NULL,
      ruta VARCHAR(512) NOT NULL,
      subido_en VARCHAR(64) NOT NULL,
      INDEX idx_archivos_proyecto (proyecto_id),
      INDEX idx_archivos_patron (patron_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meta (
      clave VARCHAR(64) PRIMARY KEY,
      valor VARCHAR(255) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  await seedIfEmpty()
}

function parseJson<T>(raw: unknown): T {
  if (typeof raw === 'string') return JSON.parse(raw) as T
  return raw as T
}

export async function seedIfEmpty() {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT valor FROM meta WHERE clave = 'seeded' LIMIT 1`,
  )
  if (rows[0]?.valor === '1') return

  const [pCount] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM patrones`,
  )
  if (Number(pCount[0]?.c ?? 0) === 0) {
    for (const p of seedPatrones) {
      await pool.query(`INSERT INTO patrones (id, data) VALUES (?, ?)`, [
        p.id,
        JSON.stringify(p),
      ])
    }
  }

  const [mCount] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM materiales`,
  )
  if (Number(mCount[0]?.c ?? 0) === 0) {
    for (const m of seedMateriales) {
      await pool.query(`INSERT INTO materiales (id, data) VALUES (?, ?)`, [
        m.id,
        JSON.stringify(m),
      ])
    }
  }

  await pool.query(
    `INSERT INTO meta (clave, valor) VALUES ('seeded', '1')
     ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
  )
}

async function hydratePatron(raw: Patron): Promise<Patron> {
  const archivos = await listArchivosByPatron(raw.id)
  return {
    ...raw,
    categoria: raw.categoria ?? 'Otro',
    icono: normalizarIconoPatron(raw.icono),
    colorCarpeta: normalizarColorCarpeta(raw.colorCarpeta),
    archivos,
    archivoActivoId: raw.archivoActivoId ?? archivos[0]?.id ?? null,
  }
}

export async function listPatrones(): Promise<Patron[]> {
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT data FROM patrones`)
  const out: Patron[] = []
  for (const r of rows) {
    out.push(await hydratePatron(parseJson<Patron>(r.data)))
  }
  return out
}

export async function getPatron(id: string): Promise<Patron | undefined> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT data FROM patrones WHERE id = ? LIMIT 1`,
    [id],
  )
  if (!rows[0]) return undefined
  return hydratePatron(parseJson<Patron>(rows[0].data))
}

export async function upsertPatron(patron: Patron) {
  const { archivos: _a, ...rest } = patron
  const toStore = { ...rest, archivos: [] }
  await pool.query(
    `INSERT INTO patrones (id, data) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE data = VALUES(data)`,
    [patron.id, JSON.stringify(toStore)],
  )
}

export async function deletePatron(id: string) {
  for (const a of await listArchivosByPatron(id)) {
    await deleteArchivo(a.id)
  }
  await pool.query(`DELETE FROM patrones WHERE id = ?`, [id])
}

function archivoSig(a: { nombre: string; tamano: number }) {
  return `${a.nombre}\0${a.tamano}`
}

/** Une archivos del patrón + del proyecto sin repetir el mismo PDF/foto. */
function mergeArchivosProyecto<T extends { id: string; nombre: string; tamano: number }>(
  delPatron: T[],
  propios: T[],
): T[] {
  const seenId = new Set(propios.map((a) => a.id))
  const seenSig = new Set(propios.map(archivoSig))
  const delPatronUnicos = delPatron.filter(
    (a) => !seenId.has(a.id) && !seenSig.has(archivoSig(a)),
  )
  return [...delPatronUnicos, ...propios]
}

async function hydrateProyecto(raw: Proyecto): Promise<Proyecto> {
  const propios = await listArchivosByProyecto(raw.id)
  const delPatron = await listArchivosByPatron(raw.patronId)
  const archivos = mergeArchivosProyecto(delPatron, propios)
  return {
    ...raw,
    archivos,
    archivoActivoId: raw.archivoActivoId ?? archivos[0]?.id ?? null,
    modoVueltas: raw.modoVueltas ?? 'fijo',
    vueltasObjetivo: raw.vueltasObjetivo ?? 10,
    siguiente: Boolean(raw.siguiente),
  }
}

export async function listProyectos(): Promise<Proyecto[]> {
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT data FROM proyectos`)
  const out: Proyecto[] = []
  for (const r of rows) {
    out.push(await hydrateProyecto(parseJson<Proyecto>(r.data)))
  }
  return out.sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn))
}

export async function getProyecto(id: string): Promise<Proyecto | undefined> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT data FROM proyectos WHERE id = ? LIMIT 1`,
    [id],
  )
  if (!rows[0]) return undefined
  return hydrateProyecto(parseJson<Proyecto>(rows[0].data))
}

export async function upsertProyecto(proyecto: Proyecto) {
  const { archivos: _a, ...rest } = proyecto
  const toStore = { ...rest, archivos: [] }
  await pool.query(
    `INSERT INTO proyectos (id, data) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE data = VALUES(data)`,
    [proyecto.id, JSON.stringify(toStore)],
  )
}

export async function deleteProyecto(id: string) {
  for (const a of await listArchivosByProyecto(id)) {
    await deleteArchivo(a.id)
  }
  await pool.query(`DELETE FROM proyectos WHERE id = ?`, [id])
}

export async function listMateriales(): Promise<Material[]> {
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT data FROM materiales`)
  return rows.map((r) => parseJson<Material>(r.data))
}

export async function getMaterial(id: string): Promise<Material | undefined> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT data FROM materiales WHERE id = ? LIMIT 1`,
    [id],
  )
  const row = rows[0]
  return row ? parseJson<Material>(row.data) : undefined
}

export async function upsertMaterial(material: Material) {
  await pool.query(
    `INSERT INTO materiales (id, data) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE data = VALUES(data)`,
    [material.id, JSON.stringify(material)],
  )
}

function unlinkUpload(filename: string | null | undefined) {
  if (!filename) return
  const full = path.isAbsolute(filename)
    ? filename
    : path.join(uploadsDir, filename)
  try {
    fs.unlinkSync(full)
  } catch {
    /* ignore */
  }
}

export async function deleteMaterial(id: string) {
  const existing = await getMaterial(id)
  if (existing?.imagen) unlinkUpload(existing.imagen)
  await pool.query(`DELETE FROM materiales WHERE id = ?`, [id])
}

export async function setMaterialImagen(
  id: string,
  meta: { imagen: string; imagenTipo: string },
) {
  const existing = await getMaterial(id)
  if (!existing) return undefined
  if (existing.imagen && existing.imagen !== meta.imagen) {
    unlinkUpload(existing.imagen)
  }
  const updated: Material = {
    ...existing,
    imagen: meta.imagen,
    imagenTipo: meta.imagenTipo,
  }
  await upsertMaterial(updated)
  return updated
}

export async function clearMaterialImagen(id: string) {
  const existing = await getMaterial(id)
  if (!existing) return undefined
  unlinkUpload(existing.imagen)
  const updated: Material = {
    ...existing,
    imagen: null,
    imagenTipo: null,
  }
  await upsertMaterial(updated)
  return updated
}

function mapArchivoRows(
  rows: Array<{
    id: string
    nombre: string
    tipo: string
    tamano: number
    subidoEn: string
  }>,
): ArchivoMeta[] {
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    tipo: r.tipo,
    tamano: Number(r.tamano),
    subidoEn: r.subidoEn,
  }))
}

export async function listArchivosByProyecto(
  proyectoId: string,
): Promise<ArchivoMeta[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, nombre, tipo, tamano, subido_en AS subidoEn
     FROM archivos WHERE proyecto_id = ? ORDER BY subido_en`,
    [proyectoId],
  )
  return mapArchivoRows(rows as never)
}

export async function listArchivosByPatron(
  patronId: string,
): Promise<ArchivoMeta[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, nombre, tipo, tamano, subido_en AS subidoEn
     FROM archivos WHERE patron_id = ? ORDER BY subido_en`,
    [patronId],
  )
  return mapArchivoRows(rows as never)
}

export async function getArchivoRow(id: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, proyecto_id AS proyectoId, patron_id AS patronId, nombre, tipo, tamano, ruta, subido_en AS subidoEn
     FROM archivos WHERE id = ? LIMIT 1`,
    [id],
  )
  const r = rows[0]
  if (!r) return undefined
  return {
    id: String(r.id),
    proyectoId: (r.proyectoId as string | null) ?? null,
    patronId: (r.patronId as string | null) ?? null,
    nombre: String(r.nombre),
    tipo: String(r.tipo),
    tamano: Number(r.tamano),
    ruta: String(r.ruta),
    subidoEn: String(r.subidoEn),
  }
}

export async function insertArchivo(meta: {
  id: string
  proyectoId?: string | null
  patronId?: string | null
  nombre: string
  tipo: string
  tamano: number
  ruta: string
  subidoEn: string
}) {
  await pool.query(
    `INSERT INTO archivos (id, proyecto_id, patron_id, nombre, tipo, tamano, ruta, subido_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      meta.id,
      meta.proyectoId ?? null,
      meta.patronId ?? null,
      meta.nombre,
      meta.tipo,
      meta.tamano,
      meta.ruta,
      meta.subidoEn,
    ],
  )
}

export async function renameArchivo(id: string, nombre: string) {
  await pool.query(`UPDATE archivos SET nombre = ? WHERE id = ?`, [
    nombre.trim(),
    id,
  ])
}

export async function replaceArchivo(
  id: string,
  meta: {
    nombre: string
    tipo: string
    tamano: number
    ruta: string
    subidoEn: string
  },
) {
  const row = await getArchivoRow(id)
  if (!row) return false
  const oldFull = path.isAbsolute(row.ruta)
    ? row.ruta
    : path.join(uploadsDir, row.ruta)
  try {
    if (oldFull !== path.join(uploadsDir, meta.ruta)) fs.unlinkSync(oldFull)
  } catch {
    /* ignore */
  }
  await pool.query(
    `UPDATE archivos
     SET nombre = ?, tipo = ?, tamano = ?, ruta = ?, subido_en = ?
     WHERE id = ?`,
    [meta.nombre, meta.tipo, meta.tamano, meta.ruta, meta.subidoEn, id],
  )
  return true
}

export async function deleteArchivo(id: string) {
  const row = await getArchivoRow(id)
  if (!row) return
  const full = path.isAbsolute(row.ruta)
    ? row.ruta
    : path.join(uploadsDir, row.ruta)
  try {
    fs.unlinkSync(full)
  } catch {
    /* ignore */
  }
  await pool.query(`DELETE FROM archivos WHERE id = ?`, [id])
}

export function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export type { ResultSetHeader }
