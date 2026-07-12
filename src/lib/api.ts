import type { Material, ModoVueltas, Patron, Proyecto } from '../types'

const API = '/api'

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('tm-token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...authHeaders(),
      ...init?.headers,
    },
  })
  if (res.status === 204) return undefined as T
  if (!res.ok) {
    let message = 'Algo falló.'
    try {
      const data = (await res.json()) as { error?: string }
      if (data.error) message = data.error
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  if (res.headers.get('content-type')?.includes('application/json')) {
    return (await res.json()) as T
  }
  return undefined as T
}

export const api = {
  health: () => request<{ ok: boolean }>('/health'),
  login: (password: string) =>
    request<{ ok: boolean; token?: string; needed: boolean }>('/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  getPatrones: () => request<Patron[]>('/patrones'),
  createPatron: (body: Omit<Patron, 'id' | 'archivos' | 'archivoActivoId'>) =>
    request<Patron>('/patrones', { method: 'POST', body: JSON.stringify(body) }),
  updatePatron: (id: string, body: Partial<Patron>) =>
    request<Patron>(`/patrones/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deletePatron: (id: string) =>
    request<void>(`/patrones/${id}`, { method: 'DELETE' }),
  uploadArchivoPatron: async (patronId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API}/patrones/${patronId}/archivos`, {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(data.error ?? 'No se pudo subir.')
    }
    return (await res.json()) as Patron
  },
  replaceArchivoPatron: async (
    patronId: string,
    archivoId: string,
    file: File,
  ) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(
      `${API}/patrones/${patronId}/archivos/${archivoId}`,
      { method: 'PUT', headers: authHeaders(), body: form },
    )
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(data.error ?? 'No se pudo reemplazar.')
    }
    return (await res.json()) as Patron
  },
  renameArchivoPatron: (patronId: string, archivoId: string, nombre: string) =>
    request<Patron>(`/patrones/${patronId}/archivos/${archivoId}`, {
      method: 'PATCH',
      body: JSON.stringify({ nombre }),
    }),
  deleteArchivoPatron: (patronId: string, archivoId: string) =>
    request<Patron>(`/patrones/${patronId}/archivos/${archivoId}`, {
      method: 'DELETE',
    }),

  getProyectos: () => request<Proyecto[]>('/proyectos'),
  createProyecto: (patronId: string, nombre?: string) =>
    request<Proyecto>('/proyectos', {
      method: 'POST',
      body: JSON.stringify({ patronId, nombre }),
    }),
  updateProyecto: (id: string, body: Partial<Proyecto>) =>
    request<Proyecto>(`/proyectos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  setVuelta: (id: string, parteId: string, vuelta: number) =>
    request<Proyecto>(`/proyectos/${id}/vuelta`, {
      method: 'PATCH',
      body: JSON.stringify({ parteId, vuelta }),
    }),
  setParte: (id: string, parteId: string) =>
    request<Proyecto>(`/proyectos/${id}/parte`, {
      method: 'PATCH',
      body: JSON.stringify({ parteId }),
    }),
  setVueltasConfig: (
    id: string,
    body: { modoVueltas?: ModoVueltas; vueltasObjetivo?: number },
  ) =>
    request<Proyecto>(`/proyectos/${id}/vueltas-config`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteProyecto: (id: string) =>
    request<void>(`/proyectos/${id}`, { method: 'DELETE' }),

  uploadArchivo: async (proyectoId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API}/proyectos/${proyectoId}/archivos`, {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(data.error ?? 'No se pudo subir.')
    }
    return (await res.json()) as Proyecto
  },
  replaceArchivo: async (
    proyectoId: string,
    archivoId: string,
    file: File,
  ) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(
      `${API}/proyectos/${proyectoId}/archivos/${archivoId}`,
      { method: 'PUT', headers: authHeaders(), body: form },
    )
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(data.error ?? 'No se pudo reemplazar.')
    }
    return (await res.json()) as Proyecto
  },
  renameArchivo: (proyectoId: string, archivoId: string, nombre: string) =>
    request<Proyecto>(`/proyectos/${proyectoId}/archivos/${archivoId}`, {
      method: 'PATCH',
      body: JSON.stringify({ nombre }),
    }),
  deleteArchivo: (proyectoId: string, archivoId: string) =>
    request<Proyecto>(`/proyectos/${proyectoId}/archivos/${archivoId}`, {
      method: 'DELETE',
    }),
  archivoUrl: (id: string, bust?: string) => {
    const token = localStorage.getItem('tm-token')
    const params = new URLSearchParams()
    if (token) params.set('t', token)
    if (bust) params.set('v', bust)
    const q = params.toString()
    return `${API}/archivos/${id}${q ? `?${q}` : ''}`
  },

  getMateriales: () => request<Material[]>('/materiales'),
  createMaterial: (body: Omit<Material, 'id'>) =>
    request<Material>('/materiales', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateMaterial: (id: string, body: Partial<Material>) =>
    request<Material>(`/materiales/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteMaterial: (id: string) =>
    request<void>(`/materiales/${id}`, { method: 'DELETE' }),
  uploadMaterialImagen: async (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API}/materiales/${id}/imagen`, {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(data.error ?? 'No se pudo subir la foto.')
    }
    return (await res.json()) as Material
  },
  deleteMaterialImagen: (id: string) =>
    request<Material>(`/materiales/${id}/imagen`, { method: 'DELETE' }),
  materialImagenUrl: (id: string, bust?: string) => {
    const token = localStorage.getItem('tm-token')
    const params = new URLSearchParams()
    if (token) params.set('t', token)
    if (bust) params.set('v', bust)
    const q = params.toString()
    return `${API}/materiales/${id}/imagen${q ? `?${q}` : ''}`
  },

  iaEstado: () =>
    request<{ configurada: boolean; proveedor: string }>('/ia/estado'),
  iaAyuda: (body: {
    pregunta?: string
    proyectoId?: string
    patronId?: string
    archivoId?: string
  }) =>
    request<{ respuesta: string; aviso?: string; proveedor: string }>(
      '/ia/ayuda',
      { method: 'POST', body: JSON.stringify(body) },
    ),
}
