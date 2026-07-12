import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api } from '../lib/api'
import { mergeProgresoFromCache, saveMesaProgreso } from '../lib/mesaSession'
import type { Material, ModoVueltas, Patron, Proyecto } from '../types'

interface AppDataContextValue {
  ready: boolean
  error: string | null
  needsLogin: boolean
  login: (password: string) => Promise<void>
  refresh: () => Promise<void>
  patrones: Patron[]
  proyectos: Proyecto[]
  materiales: Material[]
  addPatron: (patron: Omit<Patron, 'id' | 'archivos' | 'archivoActivoId'>) => Promise<Patron>
  updatePatron: (id: string, patch: Partial<Patron>) => Promise<void>
  deletePatron: (id: string) => Promise<void>
  startProyecto: (patronId: string, nombre?: string) => Promise<Proyecto>
  updateProyecto: (id: string, patch: Partial<Proyecto>) => Promise<void>
  setVuelta: (proyectoId: string, parteId: string, vuelta: number) => Promise<void>
  setParteActiva: (proyectoId: string, parteId: string) => Promise<void>
  setModoVueltas: (proyectoId: string, modo: ModoVueltas) => Promise<void>
  setVueltasObjetivo: (proyectoId: string, n: number) => Promise<void>
  completarProyecto: (id: string) => Promise<void>
  deleteProyecto: (id: string) => Promise<void>
  uploadArchivo: (proyectoId: string, file: File) => Promise<void>
  replaceArchivo: (
    proyectoId: string,
    archivoId: string,
    file: File,
  ) => Promise<void>
  renameArchivo: (
    proyectoId: string,
    archivoId: string,
    nombre: string,
  ) => Promise<void>
  deleteArchivo: (proyectoId: string, archivoId: string) => Promise<void>
  uploadArchivoPatron: (patronId: string, file: File) => Promise<void>
  replaceArchivoPatron: (
    patronId: string,
    archivoId: string,
    file: File,
  ) => Promise<void>
  renameArchivoPatron: (
    patronId: string,
    archivoId: string,
    nombre: string,
  ) => Promise<void>
  deleteArchivoPatron: (patronId: string, archivoId: string) => Promise<void>
  addMaterial: (material: Omit<Material, 'id'>) => Promise<Material>
  updateMaterial: (id: string, patch: Partial<Material>) => Promise<void>
  deleteMaterial: (id: string) => Promise<void>
  uploadMaterialImagen: (id: string, file: File) => Promise<void>
  deleteMaterialImagen: (id: string) => Promise<void>
  getPatron: (id: string) => Patron | undefined
  getProyecto: (id: string) => Proyecto | undefined
  progresoPorcentaje: (proyecto: Proyecto) => number
}

const AppDataContext = createContext<AppDataContextValue | null>(null)

function replaceProyecto(list: Proyecto[], updated: Proyecto) {
  const exists = list.some((p) => p.id === updated.id)
  if (!exists) return [updated, ...list]
  return list.map((p) => (p.id === updated.id ? updated : p))
}

function cacheProyecto(p: Proyecto) {
  saveMesaProgreso(p.id, {
    progreso: p.progreso,
    parteActivaId: p.parteActivaId,
    modoVueltas: p.modoVueltas,
    vueltasObjetivo: p.vueltasObjetivo,
    archivoActivoId: p.archivoActivoId,
  })
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [patrones, setPatrones] = useState<Patron[]>([])
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [materiales, setMateriales] = useState<Material[]>([])

  const refresh = useCallback(async () => {
    const [p, pr, m] = await Promise.all([
      api.getPatrones(),
      api.getProyectos(),
      api.getMateriales(),
    ])
    setPatrones(p)
    setProyectos(pr.map(mergeProgresoFromCache))
    setMateriales(m)
    setNeedsLogin(false)
    setError(null)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function boot() {
      try {
        await api.health()
        await refresh()
        if (!cancelled) setReady(true)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudo conectar.'
        if (msg.includes('clave') || msg.includes('Clave') || msg.includes('acceso')) {
          if (!cancelled) {
            setNeedsLogin(true)
            setReady(true)
          }
        } else {
          if (!cancelled) {
            setError(
              'No hay conexión con el servidor. Arranca la API o revisa la nube.',
            )
            setReady(true)
          }
        }
      }
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [refresh])

  const login = useCallback(
    async (password: string) => {
      const res = await api.login(password)
      if (res.token) localStorage.setItem('tm-token', res.token)
      await refresh()
      setNeedsLogin(false)
    },
    [refresh],
  )

  const getPatron = useCallback(
    (id: string) => patrones.find((p) => p.id === id),
    [patrones],
  )

  const getProyecto = useCallback(
    (id: string) => proyectos.find((p) => p.id === id),
    [proyectos],
  )

  const progresoPorcentaje = useCallback(
    (proyecto: Proyecto) => {
      const patron = getPatron(proyecto.patronId)
      if (!patron || patron.partes.length === 0) return 0
      let hechas = 0
      let total = 0
      for (const parte of patron.partes) {
        total += parte.vueltasTotales
        const prog = proyecto.progreso.find((x) => x.parteId === parte.id)
        hechas += Math.min(prog?.vueltaActual ?? 0, parte.vueltasTotales)
      }
      if (total === 0) return 0
      return Math.round((hechas / total) * 100)
    },
    [getPatron],
  )

  const addPatron = useCallback(
    async (patron: Omit<Patron, 'id' | 'archivos' | 'archivoActivoId'>) => {
      const nuevo = await api.createPatron(patron)
      setPatrones((prev) => [...prev, nuevo])
      return nuevo
    },
    [],
  )

  const updatePatron = useCallback(async (id: string, patch: Partial<Patron>) => {
    const updated = await api.updatePatron(id, patch)
    setPatrones((prev) => prev.map((p) => (p.id === id ? updated : p)))
  }, [])

  const deletePatron = useCallback(async (id: string) => {
    await api.deletePatron(id)
    setPatrones((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const startProyecto = useCallback(async (patronId: string, nombre?: string) => {
    const nuevo = await api.createProyecto(patronId, nombre)
    setProyectos((prev) => [nuevo, ...prev])
    return nuevo
  }, [])

  const updateProyecto = useCallback(async (id: string, patch: Partial<Proyecto>) => {
    const updated = await api.updateProyecto(id, patch)
    cacheProyecto(updated)
    setProyectos((prev) => replaceProyecto(prev, updated))
  }, [])

  const setVuelta = useCallback(
    async (proyectoId: string, parteId: string, vuelta: number) => {
      setProyectos((prev) =>
        prev.map((p) => {
          if (p.id !== proyectoId) return p
          const max =
            p.modoVueltas === 'ilimitado'
              ? Number.MAX_SAFE_INTEGER
              : Math.max(1, p.vueltasObjetivo)
          const clamped = Math.max(0, Math.min(vuelta, max))
          const next = {
            ...p,
            progreso: p.progreso.map((pr) =>
              pr.parteId === parteId ? { ...pr, vueltaActual: clamped } : pr,
            ),
          }
          cacheProyecto(next)
          return next
        }),
      )
      try {
        const updated = await api.setVuelta(proyectoId, parteId, vuelta)
        cacheProyecto(updated)
        setProyectos((prev) => replaceProyecto(prev, updated))
      } catch (err) {
        await refresh()
        throw err
      }
    },
    [refresh],
  )

  const setParteActiva = useCallback(async (proyectoId: string, parteId: string) => {
    const updated = await api.setParte(proyectoId, parteId)
    cacheProyecto(updated)
    setProyectos((prev) => replaceProyecto(prev, updated))
  }, [])

  const setModoVueltas = useCallback(async (proyectoId: string, modo: ModoVueltas) => {
    const updated = await api.setVueltasConfig(proyectoId, { modoVueltas: modo })
    cacheProyecto(updated)
    setProyectos((prev) => replaceProyecto(prev, updated))
  }, [])

  const setVueltasObjetivo = useCallback(async (proyectoId: string, n: number) => {
    const updated = await api.setVueltasConfig(proyectoId, {
      vueltasObjetivo: n,
    })
    cacheProyecto(updated)
    setProyectos((prev) => replaceProyecto(prev, updated))
  }, [])

  const completarProyecto = useCallback(async (id: string) => {
    const updated = await api.updateProyecto(id, { estado: 'terminado' })
    setProyectos((prev) => replaceProyecto(prev, updated))
  }, [])

  const deleteProyectoFn = useCallback(async (id: string) => {
    await api.deleteProyecto(id)
    setProyectos((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const uploadArchivo = useCallback(async (proyectoId: string, file: File) => {
    const updated = await api.uploadArchivo(proyectoId, file)
    cacheProyecto(updated)
    setProyectos((prev) => replaceProyecto(prev, updated))
  }, [])

  const replaceArchivoFn = useCallback(
    async (proyectoId: string, archivoId: string, file: File) => {
      const updated = await api.replaceArchivo(proyectoId, archivoId, file)
      cacheProyecto(updated)
      setProyectos((prev) => replaceProyecto(prev, updated))
    },
    [],
  )

  const renameArchivoFn = useCallback(
    async (proyectoId: string, archivoId: string, nombre: string) => {
      const updated = await api.renameArchivo(proyectoId, archivoId, nombre)
      cacheProyecto(updated)
      setProyectos((prev) => replaceProyecto(prev, updated))
    },
    [],
  )

  const deleteArchivoFn = useCallback(
    async (proyectoId: string, archivoId: string) => {
      const updated = await api.deleteArchivo(proyectoId, archivoId)
      cacheProyecto(updated)
      setProyectos((prev) => replaceProyecto(prev, updated))
    },
    [],
  )

  const uploadArchivoPatron = useCallback(async (patronId: string, file: File) => {
    const updated = await api.uploadArchivoPatron(patronId, file)
    setPatrones((prev) => prev.map((p) => (p.id === patronId ? updated : p)))
  }, [])

  const replaceArchivoPatron = useCallback(
    async (patronId: string, archivoId: string, file: File) => {
      const updated = await api.replaceArchivoPatron(patronId, archivoId, file)
      setPatrones((prev) => prev.map((p) => (p.id === patronId ? updated : p)))
    },
    [],
  )

  const renameArchivoPatron = useCallback(
    async (patronId: string, archivoId: string, nombre: string) => {
      const updated = await api.renameArchivoPatron(patronId, archivoId, nombre)
      setPatrones((prev) => prev.map((p) => (p.id === patronId ? updated : p)))
    },
    [],
  )

  const deleteArchivoPatron = useCallback(
    async (patronId: string, archivoId: string) => {
      const updated = await api.deleteArchivoPatron(patronId, archivoId)
      setPatrones((prev) => prev.map((p) => (p.id === patronId ? updated : p)))
    },
    [],
  )

  const addMaterial = useCallback(async (material: Omit<Material, 'id'>) => {
    const nuevo = await api.createMaterial(material)
    setMateriales((prev) => [...prev, nuevo])
    return nuevo
  }, [])

  const updateMaterial = useCallback(async (id: string, patch: Partial<Material>) => {
    const updated = await api.updateMaterial(id, patch)
    setMateriales((prev) => prev.map((m) => (m.id === id ? updated : m)))
  }, [])

  const deleteMaterialFn = useCallback(async (id: string) => {
    await api.deleteMaterial(id)
    setMateriales((prev) => prev.filter((m) => m.id !== id))
  }, [])

  const uploadMaterialImagen = useCallback(async (id: string, file: File) => {
    const updated = await api.uploadMaterialImagen(id, file)
    setMateriales((prev) => prev.map((m) => (m.id === id ? updated : m)))
  }, [])

  const deleteMaterialImagen = useCallback(async (id: string) => {
    const updated = await api.deleteMaterialImagen(id)
    setMateriales((prev) => prev.map((m) => (m.id === id ? updated : m)))
  }, [])

  const value = useMemo(
    () => ({
      ready,
      error,
      needsLogin,
      login,
      refresh,
      patrones,
      proyectos,
      materiales,
      addPatron,
      updatePatron,
      deletePatron,
      startProyecto,
      updateProyecto,
      setVuelta,
      setParteActiva,
      setModoVueltas,
      setVueltasObjetivo,
      completarProyecto,
      deleteProyecto: deleteProyectoFn,
      uploadArchivo,
      replaceArchivo: replaceArchivoFn,
      renameArchivo: renameArchivoFn,
      deleteArchivo: deleteArchivoFn,
      uploadArchivoPatron,
      replaceArchivoPatron,
      renameArchivoPatron,
      deleteArchivoPatron,
      addMaterial,
      updateMaterial,
      deleteMaterial: deleteMaterialFn,
      uploadMaterialImagen,
      deleteMaterialImagen,
      getPatron,
      getProyecto,
      progresoPorcentaje,
    }),
    [
      ready,
      error,
      needsLogin,
      login,
      refresh,
      patrones,
      proyectos,
      materiales,
      addPatron,
      updatePatron,
      deletePatron,
      startProyecto,
      updateProyecto,
      setVuelta,
      setParteActiva,
      setModoVueltas,
      setVueltasObjetivo,
      completarProyecto,
      deleteProyectoFn,
      uploadArchivo,
      replaceArchivoFn,
      renameArchivoFn,
      deleteArchivoFn,
      uploadArchivoPatron,
      replaceArchivoPatron,
      renameArchivoPatron,
      deleteArchivoPatron,
      addMaterial,
      updateMaterial,
      deleteMaterialFn,
      uploadMaterialImagen,
      deleteMaterialImagen,
      getPatron,
      getProyecto,
      progresoPorcentaje,
    ],
  )

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  )
}

export function useAppData() {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData debe usarse dentro de AppDataProvider')
  return ctx
}
