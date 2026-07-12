import cors from 'cors'
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import multer from 'multer'
import {
  deleteArchivo,
  deleteMaterial,
  deletePatron,
  deleteProyecto,
  getArchivoRow,
  getMaterial,
  getPatron,
  getProyecto,
  initDb,
  insertArchivo,
  listMateriales,
  listPatrones,
  listProyectos,
  renameArchivo,
  replaceArchivo,
  clearMaterialImagen,
  setMaterialImagen,
  uid,
  uploadsDir,
  upsertMaterial,
  upsertPatron,
  upsertProyecto,
} from './db.ts'
import {
  calentarIaEnSegundoPlano,
  iaConfigurada,
  iaProveedor,
  invalidarTextoArchivo,
  pedirAyudaIa,
  precargarIa,
} from './ia.ts'
import type {
  Material,
  ModoVueltas,
  Patron,
  Proyecto,
} from '../src/types.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const PORT = Number(process.env.PORT ?? 3001)
const APP_PASSWORD = process.env.APP_PASSWORD?.trim() || ''

async function main() {
  await initDb()
  console.log('MySQL listo.')

  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '2mb' }))

  function auth(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) {
    if (!APP_PASSWORD) return next()
    const header = req.headers.authorization ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    const queryToken = typeof req.query.t === 'string' ? req.query.t : ''
    const cookie = req.headers.cookie
      ?.split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('tm_auth='))
      ?.slice('tm_auth='.length)
    if (
      token === APP_PASSWORD ||
      cookie === APP_PASSWORD ||
      queryToken === APP_PASSWORD
    ) {
      return next()
    }
    res.status(401).json({ error: 'Necesitas la clave de acceso.' })
  }

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, ia: iaProveedor() })
  })

  app.get('/api/ia/estado', (_req, res) => {
    res.json({
      configurada: iaConfigurada(),
      proveedor: iaProveedor(),
    })
  })

  app.post('/api/ia/ayuda', async (req, res) => {
    const ac = new AbortController()
    // Solo si el cliente corta la conexión ANTES de terminar la respuesta.
    // NO usar req.on('close'): se dispara al terminar el body y aborta siempre.
    const onClientGone = () => {
      if (!res.writableEnded) ac.abort()
    }
    res.on('close', onClientGone)
    try {
      const result = await pedirAyudaIa({
        pregunta: req.body?.pregunta as string | undefined,
        archivoId: req.body?.archivoId as string | undefined,
        patronId: req.body?.patronId as string | undefined,
        proyectoId: req.body?.proyectoId as string | undefined,
        usarPdf: Boolean(req.body?.usarPdf),
        signal: ac.signal,
      })
      if (ac.signal.aborted || res.writableEnded) return
      res.json(result)
    } catch (err) {
      if (
        (err instanceof Error && err.name === 'AbortError') ||
        ac.signal.aborted
      ) {
        if (!res.headersSent) res.status(499).json({ error: 'Detenido.' })
        return
      }
      const message = err instanceof Error ? err.message : 'Falló la IA.'
      if (!res.headersSent) res.status(400).json({ error: message })
    } finally {
      res.off('close', onClientGone)
    }
  })

  app.post('/api/ia/precargar', async (req, res) => {
    try {
      const result = await precargarIa({
        archivoId: req.body?.archivoId as string | undefined,
        patronId: req.body?.patronId as string | undefined,
        proyectoId: req.body?.proyectoId as string | undefined,
      })
      res.json(result)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudo precargar.'
      res.status(400).json({ error: message })
    }
  })

  app.post('/api/login', (req, res) => {
    if (!APP_PASSWORD) {
      res.json({ ok: true, needed: false })
      return
    }
    const password = String(req.body?.password ?? '')
    if (password !== APP_PASSWORD) {
      res.status(401).json({ error: 'Clave incorrecta.' })
      return
    }
    res.setHeader(
      'Set-Cookie',
      `tm_auth=${APP_PASSWORD}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`,
    )
    res.json({ ok: true, needed: true, token: APP_PASSWORD })
  })

  app.use('/api', auth)

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadsDir),
      filename: (_req, file, cb) => {
        const safe = file.originalname.replace(/[^\w.\-áéíóúñÁÉÍÓÚÑ ]+/g, '_')
        cb(null, `${Date.now()}-${safe}`)
      },
    }),
    limits: { fileSize: 25 * 1024 * 1024 },
  })

  app.get('/api/patrones', async (_req, res) => {
    res.json(await listPatrones())
  })

  app.get('/api/patrones/:id', async (req, res) => {
    const patron = await getPatron(req.params.id)
    if (!patron) {
      res.status(404).json({ error: 'No está.' })
      return
    }
    res.json(patron)
  })

  app.post('/api/patrones', async (req, res) => {
    const body = req.body as Omit<Patron, 'id' | 'archivos' | 'archivoActivoId'>
    const patron: Patron = {
      ...body,
      id: uid('patron'),
      archivos: [],
      archivoActivoId: null,
    }
    await upsertPatron(patron)
    res.status(201).json(await getPatron(patron.id))
  })

  app.put('/api/patrones/:id', async (req, res) => {
    const existing = await getPatron(req.params.id)
    if (!existing) {
      res.status(404).json({ error: 'No está.' })
      return
    }
    const { archivos: _a, ...safe } = req.body as Partial<Patron>
    const patron: Patron = { ...existing, ...safe, id: existing.id }
    await upsertPatron(patron)
    res.json(await getPatron(patron.id))
  })

  app.delete('/api/patrones/:id', async (req, res) => {
    await deletePatron(req.params.id)
    res.status(204).end()
  })

  app.post('/api/patrones/:id/archivos', upload.single('file'), async (req, res) => {
    const patron = await getPatron(req.params.id)
    if (!patron) {
      res.status(404).json({ error: 'No está.' })
      return
    }
    if (!req.file) {
      res.status(400).json({ error: 'Falta el archivo.' })
      return
    }
    const id = uid('arch')
    const subidoEn = new Date().toISOString()
    await insertArchivo({
      id,
      patronId: patron.id,
      nombre: req.file.originalname,
      tipo: req.file.mimetype || 'application/octet-stream',
      tamano: req.file.size,
      ruta: req.file.filename,
      subidoEn,
    })
    await upsertPatron({ ...patron, archivoActivoId: id })
    res.status(201).json(await getPatron(patron.id))
  })

  app.put(
    '/api/patrones/:patronId/archivos/:archivoId',
    upload.single('file'),
    async (req, res) => {
      const patron = await getPatron(req.params.patronId)
      if (!patron) {
        res.status(404).json({ error: 'No está.' })
        return
      }
      const row = await getArchivoRow(req.params.archivoId)
      if (!row || row.patronId !== patron.id) {
        res.status(404).json({ error: 'Archivo no está.' })
        return
      }
      if (!req.file) {
        res.status(400).json({ error: 'Falta el archivo.' })
        return
      }
      const subidoEn = new Date().toISOString()
      await replaceArchivo(row.id, {
        nombre: req.file.originalname,
        tipo: req.file.mimetype || 'application/octet-stream',
        tamano: req.file.size,
        ruta: req.file.filename,
        subidoEn,
      })
      invalidarTextoArchivo(row.id)
      await upsertPatron({ ...patron, archivoActivoId: row.id })
      res.json(await getPatron(patron.id))
    },
  )

  app.patch(
    '/api/patrones/:patronId/archivos/:archivoId',
    async (req, res) => {
      const patron = await getPatron(req.params.patronId)
      if (!patron) {
        res.status(404).json({ error: 'No está.' })
        return
      }
      const row = await getArchivoRow(req.params.archivoId)
      if (!row || row.patronId !== patron.id) {
        res.status(404).json({ error: 'Archivo no está.' })
        return
      }
      const nombre = String(req.body?.nombre ?? '').trim()
      if (!nombre) {
        res.status(400).json({ error: 'Ponle un nombre.' })
        return
      }
      await renameArchivo(row.id, nombre)
      res.json(await getPatron(patron.id))
    },
  )

  app.delete(
    '/api/patrones/:patronId/archivos/:archivoId',
    async (req, res) => {
      const patron = await getPatron(req.params.patronId)
      if (!patron) {
        res.status(404).json({ error: 'No está.' })
        return
      }
      invalidarTextoArchivo(req.params.archivoId)
      await deleteArchivo(req.params.archivoId)
      const refreshed = (await getPatron(patron.id))!
      const activo =
        refreshed.archivoActivoId === req.params.archivoId
          ? (refreshed.archivos[0]?.id ?? null)
          : refreshed.archivoActivoId
      await upsertPatron({ ...refreshed, archivoActivoId: activo })
      res.json(await getPatron(patron.id))
    },
  )

  app.get('/api/proyectos', async (_req, res) => {
    res.json(await listProyectos())
  })

  app.get('/api/proyectos/:id', async (req, res) => {
    const proyecto = await getProyecto(req.params.id)
    if (!proyecto) {
      res.status(404).json({ error: 'No está.' })
      return
    }
    res.json(proyecto)
  })

  app.post('/api/proyectos', async (req, res) => {
    const patronId = String(req.body?.patronId ?? '')
    const nombre = req.body?.nombre as string | undefined
    const forceNew = Boolean(req.body?.forceNew)
    const patron = await getPatron(patronId)
    if (!patron) {
      res.status(400).json({ error: 'Patrón no encontrado.' })
      return
    }

    // Evita clones: si ya hay un tejido activo de ese patrón, reutilizarlo.
    if (!forceNew) {
      const activos = (await listProyectos()).filter(
        (p) => p.patronId === patronId && p.estado === 'activo',
      )
      if (activos.length > 0) {
        const best = activos.reduce((a, b) => {
          const score = (p: Proyecto) =>
            p.progreso.reduce((s, x) => s + (x.vueltaActual || 0), 0)
          const sa = score(a)
          const sb = score(b)
          if (sb !== sa) return sb > sa ? b : a
          return b.actualizadoEn.localeCompare(a.actualizadoEn) > 0 ? b : a
        })
        res.json(best)
        return
      }
    }

    const ahora = new Date().toISOString()
    const proyecto: Proyecto = {
      id: uid('proy'),
      patronId,
      nombre: nombre?.trim() || patron.nombre,
      estado: 'activo',
      progreso: patron.partes.map((p) => ({ parteId: p.id, vueltaActual: 0 })),
      parteActivaId: patron.partes[0]?.id ?? '',
      notas: '',
      creadoEn: ahora,
      actualizadoEn: ahora,
      archivos: [],
      archivoActivoId: null,
      modoVueltas: 'fijo',
      vueltasObjetivo: patron.partes[0]?.vueltasTotales ?? 10,
      siguiente: false,
    }
    await upsertProyecto(proyecto)
    res.status(201).json(await getProyecto(proyecto.id))
  })

  app.put('/api/proyectos/:id', async (req, res) => {
    const existing = await getProyecto(req.params.id)
    if (!existing) {
      res.status(404).json({ error: 'No está.' })
      return
    }
    const patch = req.body as Partial<Proyecto>
    const { archivos: _ignore, ...safePatch } = patch
    const proyecto: Proyecto = {
      ...existing,
      ...safePatch,
      id: existing.id,
      actualizadoEn: new Date().toISOString(),
      archivos: existing.archivos,
    }
    await upsertProyecto(proyecto)
    res.json(await getProyecto(proyecto.id))
  })

  app.patch('/api/proyectos/:id/vuelta', async (req, res) => {
    const existing = await getProyecto(req.params.id)
    if (!existing) {
      res.status(404).json({ error: 'No está.' })
      return
    }
    const parteId = String(req.body?.parteId ?? '')
    const vuelta = Number(req.body?.vuelta ?? 0)
    const max =
      existing.modoVueltas === 'ilimitado'
        ? Number.MAX_SAFE_INTEGER
        : Math.max(1, existing.vueltasObjetivo)
    const clamped = Math.max(0, Math.min(vuelta, max))
    const progreso = existing.progreso.map((pr) =>
      pr.parteId === parteId ? { ...pr, vueltaActual: clamped } : pr,
    )
    await upsertProyecto({
      ...existing,
      progreso,
      actualizadoEn: new Date().toISOString(),
    })
    res.json(await getProyecto(existing.id))
  })

  app.patch('/api/proyectos/:id/parte', async (req, res) => {
    const existing = await getProyecto(req.params.id)
    if (!existing) {
      res.status(404).json({ error: 'No está.' })
      return
    }
    const parteId = String(req.body?.parteId ?? '')
    const patron = await getPatron(existing.patronId)
    const parte = patron?.partes.find((p) => p.id === parteId)
    await upsertProyecto({
      ...existing,
      parteActivaId: parteId,
      vueltasObjetivo: parte?.vueltasTotales ?? existing.vueltasObjetivo,
      actualizadoEn: new Date().toISOString(),
    })
    res.json(await getProyecto(existing.id))
  })

  app.patch('/api/proyectos/:id/vueltas-config', async (req, res) => {
    const existing = await getProyecto(req.params.id)
    if (!existing) {
      res.status(404).json({ error: 'No está.' })
      return
    }
    const modo = req.body?.modoVueltas as ModoVueltas | undefined
    let objetivo = existing.vueltasObjetivo
    if (req.body?.vueltasObjetivo != null) {
      objetivo = Math.max(
        1,
        Math.min(9999, Math.floor(Number(req.body.vueltasObjetivo))),
      )
    }
    let progreso = existing.progreso
    if (req.body?.vueltasObjetivo != null) {
      progreso = existing.progreso.map((pr) =>
        pr.parteId === existing.parteActivaId
          ? { ...pr, vueltaActual: Math.min(pr.vueltaActual, objetivo) }
          : pr,
      )
    }
    await upsertProyecto({
      ...existing,
      modoVueltas: modo ?? existing.modoVueltas,
      vueltasObjetivo: objetivo,
      progreso,
      actualizadoEn: new Date().toISOString(),
    })
    res.json(await getProyecto(existing.id))
  })

  app.delete('/api/proyectos/:id', async (req, res) => {
    await deleteProyecto(req.params.id)
    res.status(204).end()
  })

  app.post(
    '/api/proyectos/:id/archivos',
    upload.single('file'),
    async (req, res) => {
      const proyecto = await getProyecto(req.params.id)
      if (!proyecto) {
        res.status(404).json({ error: 'No está.' })
        return
      }
      if (!req.file) {
        res.status(400).json({ error: 'Falta el archivo.' })
        return
      }
      const id = uid('arch')
      const subidoEn = new Date().toISOString()
      await insertArchivo({
        id,
        proyectoId: proyecto.id,
        nombre: req.file.originalname,
        tipo: req.file.mimetype || 'application/octet-stream',
        tamano: req.file.size,
        ruta: req.file.filename,
        subidoEn,
      })
      await upsertProyecto({
        ...proyecto,
        archivoActivoId: id,
        actualizadoEn: subidoEn,
      })
      res.status(201).json(await getProyecto(proyecto.id))
    },
  )

  app.put(
    '/api/proyectos/:proyectoId/archivos/:archivoId',
    upload.single('file'),
    async (req, res) => {
      const proyecto = await getProyecto(req.params.proyectoId)
      if (!proyecto) {
        res.status(404).json({ error: 'No está.' })
        return
      }
      const row = await getArchivoRow(req.params.archivoId)
      if (!row || row.proyectoId !== proyecto.id) {
        res.status(404).json({ error: 'Archivo no está.' })
        return
      }
      if (!req.file) {
        res.status(400).json({ error: 'Falta el archivo.' })
        return
      }
      const subidoEn = new Date().toISOString()
      await replaceArchivo(row.id, {
        nombre: req.file.originalname,
        tipo: req.file.mimetype || 'application/octet-stream',
        tamano: req.file.size,
        ruta: req.file.filename,
        subidoEn,
      })
      invalidarTextoArchivo(row.id)
      await upsertProyecto({
        ...proyecto,
        archivoActivoId: row.id,
        actualizadoEn: subidoEn,
      })
      res.json(await getProyecto(proyecto.id))
    },
  )

  app.patch(
    '/api/proyectos/:proyectoId/archivos/:archivoId',
    async (req, res) => {
      const proyecto = await getProyecto(req.params.proyectoId)
      if (!proyecto) {
        res.status(404).json({ error: 'No está.' })
        return
      }
      const row = await getArchivoRow(req.params.archivoId)
      if (!row || row.proyectoId !== proyecto.id) {
        res.status(404).json({ error: 'Archivo no está.' })
        return
      }
      const nombre = String(req.body?.nombre ?? '').trim()
      if (!nombre) {
        res.status(400).json({ error: 'Ponle un nombre.' })
        return
      }
      await renameArchivo(row.id, nombre)
      res.json(await getProyecto(proyecto.id))
    },
  )

  app.delete(
    '/api/proyectos/:proyectoId/archivos/:archivoId',
    async (req, res) => {
      const proyecto = await getProyecto(req.params.proyectoId)
      if (!proyecto) {
        res.status(404).json({ error: 'No está.' })
        return
      }
      invalidarTextoArchivo(req.params.archivoId)
      await deleteArchivo(req.params.archivoId)
      const refreshed = (await getProyecto(proyecto.id))!
      const activo =
        refreshed.archivoActivoId === req.params.archivoId
          ? (refreshed.archivos[0]?.id ?? null)
          : refreshed.archivoActivoId
      await upsertProyecto({
        ...refreshed,
        archivoActivoId: activo,
        actualizadoEn: new Date().toISOString(),
      })
      res.json(await getProyecto(proyecto.id))
    },
  )

  app.get('/api/archivos/:id', async (req, res) => {
    const row = await getArchivoRow(req.params.id)
    if (!row) {
      res.status(404).json({ error: 'No está.' })
      return
    }
    const full = path.join(uploadsDir, row.ruta)
    if (!fs.existsSync(full)) {
      res.status(404).json({ error: 'Archivo perdido en disco.' })
      return
    }
    res.setHeader('Content-Type', row.tipo)
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(row.nombre)}`,
    )
    res.sendFile(full)
  })

  app.get('/api/materiales', async (_req, res) => {
    res.json(await listMateriales())
  })

  app.post('/api/materiales', async (req, res) => {
    const body = req.body as Omit<Material, 'id'>
    const material: Material = {
      ...body,
      id: uid('mat'),
      imagen: null,
      imagenTipo: null,
    }
    await upsertMaterial(material)
    res.status(201).json(material)
  })

  app.put('/api/materiales/:id', async (req, res) => {
    const existing = await getMaterial(req.params.id)
    if (!existing) {
      res.status(404).json({ error: 'No está.' })
      return
    }
    const patch = req.body as Partial<Material>
    const material: Material = {
      ...existing,
      ...patch,
      id: existing.id,
      imagen: existing.imagen,
      imagenTipo: existing.imagenTipo,
    }
    await upsertMaterial(material)
    res.json(material)
  })

  app.post(
    '/api/materiales/:id/imagen',
    upload.single('file'),
    async (req, res) => {
      const existing = await getMaterial(req.params.id)
      if (!existing) {
        res.status(404).json({ error: 'No está.' })
        return
      }
      if (!req.file) {
        res.status(400).json({ error: 'Falta la foto.' })
        return
      }
      if (!req.file.mimetype.startsWith('image/')) {
        try {
          fs.unlinkSync(req.file.path)
        } catch {
          /* ignore */
        }
        res.status(400).json({ error: 'Solo fotos (jpg, png, webp…).' })
        return
      }
      const updated = await setMaterialImagen(existing.id, {
        imagen: req.file.filename,
        imagenTipo: req.file.mimetype,
      })
      res.json(updated)
    },
  )

  app.delete('/api/materiales/:id/imagen', async (req, res) => {
    const updated = await clearMaterialImagen(req.params.id)
    if (!updated) {
      res.status(404).json({ error: 'No está.' })
      return
    }
    res.json(updated)
  })

  app.get('/api/materiales/:id/imagen', async (req, res) => {
    const material = await getMaterial(req.params.id)
    if (!material?.imagen) {
      res.status(404).json({ error: 'Sin foto.' })
      return
    }
    const full = path.join(uploadsDir, material.imagen)
    if (!fs.existsSync(full)) {
      res.status(404).json({ error: 'Foto perdida en disco.' })
      return
    }
    res.setHeader(
      'Content-Type',
      material.imagenTipo || 'application/octet-stream',
    )
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.sendFile(full)
  })

  app.delete('/api/materiales/:id', async (req, res) => {
    await deleteMaterial(req.params.id)
    res.status(204).end()
  })

  const distDir = path.join(root, 'dist')
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir))
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'))
    })
  }

  app.listen(PORT, () => {
    console.log(`Tejidos de Mamá → http://localhost:${PORT}`)
    if (APP_PASSWORD) console.log('Clave de acceso activada (APP_PASSWORD).')
    calentarIaEnSegundoPlano()
  })
}

main().catch((err) => {
  console.error('No se pudo arrancar:', err)
  process.exit(1)
})
