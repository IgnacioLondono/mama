export type Dificultad = 'facil' | 'media' | 'dificil'

export type TipoMaterial = 'lana' | 'aguja' | 'relleno' | 'otro'

export type EstadoProyecto = 'activo' | 'terminado'

export type ModoVueltas = 'fijo' | 'ilimitado'

export interface MaterialPatron {
  nombre: string
  cantidad: string
}

export interface PartePatron {
  id: string
  nombre: string
  vueltasTotales: number
  instrucciones: string[]
}

export interface Patron {
  id: string
  nombre: string
  descripcion: string
  dificultad: Dificultad
  tiempoEstimado: string
  materiales: MaterialPatron[]
  partes: PartePatron[]
  abreviaciones: string[]
  archivos: ArchivoMeta[]
  archivoActivoId: string | null
}

export interface ProgresoParte {
  parteId: string
  vueltaActual: number
}

export interface ArchivoMeta {
  id: string
  nombre: string
  tipo: string
  tamano: number
  subidoEn: string
}

export interface Proyecto {
  id: string
  patronId: string
  nombre: string
  estado: EstadoProyecto
  progreso: ProgresoParte[]
  parteActivaId: string
  notas: string
  creadoEn: string
  actualizadoEn: string
  archivos: ArchivoMeta[]
  archivoActivoId: string | null
  modoVueltas: ModoVueltas
  vueltasObjetivo: number
}

export interface Material {
  id: string
  nombre: string
  tipo: TipoMaterial
  color: string
  cantidad: number
  unidad: string
  minimo?: number
  /** Nombre del archivo en uploads (foto opcional). */
  imagen?: string | null
  imagenTipo?: string | null
}
