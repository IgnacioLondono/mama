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

/** Icono temático de la tarjeta/carpeta del patrón. */
export type IconoPatron =
  | 'carpeta'
  | 'anime'
  | 'series'
  | 'pelicula'
  | 'juego'
  | 'musica'
  | 'animal'
  | 'corazon'
  | 'estrella'
  | 'libro'
  | 'lana'
  | 'casa'
  /** @deprecated valores viejos; se migran al hidratar */
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
  { id: 'carpeta', label: 'Carpeta' },
  { id: 'anime', label: 'Anime' },
  { id: 'series', label: 'Series' },
  { id: 'pelicula', label: 'Película' },
  { id: 'juego', label: 'Juegos' },
  { id: 'musica', label: 'Música' },
  { id: 'animal', label: 'Animal' },
  { id: 'corazon', label: 'Corazón' },
  { id: 'estrella', label: 'Estrella' },
  { id: 'libro', label: 'Libro' },
  { id: 'lana', label: 'Lana' },
  { id: 'casa', label: 'Casa' },
]

/** Color de la carpeta (independiente del tema). */
export type ColorCarpeta =
  | 'coral'
  | 'sage'
  | 'wool'
  | 'ink'
  | 'rose'
  | 'sky'

export const COLORES_CARPETA: { id: ColorCarpeta; label: string; hex: string }[] = [
  { id: 'coral', label: 'Coral', hex: '#c45f48' },
  { id: 'sage', label: 'Verde', hex: '#5f7d64' },
  { id: 'wool', label: 'Lana', hex: '#b89a78' },
  { id: 'ink', label: 'Tinta', hex: '#2a2420' },
  { id: 'rose', label: 'Rosa', hex: '#c4788a' },
  { id: 'sky', label: 'Cielo', hex: '#6a8fa8' },
]

export function normalizarColorCarpeta(color?: string | null): ColorCarpeta {
  if (color && COLORES_CARPETA.some((c) => c.id === color)) {
    return color as ColorCarpeta
  }
  return 'coral'
}

const ICONO_LEGACY: Record<string, IconoPatron> = {
  coral: 'carpeta',
  sage: 'casa',
  wool: 'lana',
  ink: 'libro',
  rose: 'corazon',
  sky: 'anime',
}

export function normalizarIconoPatron(icono?: string | null): IconoPatron {
  if (!icono) return 'carpeta'
  if (ICONO_LEGACY[icono]) return ICONO_LEGACY[icono]
  if (ICONOS_PATRON.some((i) => i.id === icono)) return icono as IconoPatron
  return 'carpeta'
}

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
  colorCarpeta: ColorCarpeta
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
