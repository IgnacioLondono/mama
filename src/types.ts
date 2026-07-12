export type Dificultad = 'facil' | 'media' | 'dificil'

export type TipoMaterial = 'lana' | 'aguja' | 'relleno' | 'otro'

export type EstadoProyecto = 'activo' | 'terminado'

export type ModoVueltas = 'fijo' | 'ilimitado'

/** Categoría de la estantería de patrones. */
export type CategoriaPatron =
  | 'Amigurumi'
  | 'Ropa'
  | 'Accesorios'
  | 'Hogar'
  | 'Otro'

/** Color / estilo de carpeta en la tarjeta del patrón. */
export type IconoPatron =
  | 'coral'
  | 'sage'
  | 'wool'
  | 'ink'
  | 'rose'
  | 'sky'

export const CATEGORIAS_PATRON: CategoriaPatron[] = [
  'Amigurumi',
  'Ropa',
  'Accesorios',
  'Hogar',
  'Otro',
]

export const ICONOS_PATRON: { id: IconoPatron; label: string }[] = [
  { id: 'coral', label: 'Coral' },
  { id: 'sage', label: 'Verde' },
  { id: 'wool', label: 'Lana' },
  { id: 'ink', label: 'Tinta' },
  { id: 'rose', label: 'Rosa' },
  { id: 'sky', label: 'Cielo' },
]

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
  categoria: CategoriaPatron
  icono: IconoPatron
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
  /** Solo uno activo debería estar marcado como siguiente. */
  siguiente?: boolean
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
