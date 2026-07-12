import type { ReactNode } from 'react'
import {
  IconAnime,
  IconBook,
  IconFilm,
  IconFolder,
  IconGame,
  IconHeart,
  IconHome,
  IconMusic,
  IconPaw,
  IconStar,
  IconTv,
  IconYarn,
} from './Icons'
import type { ColorCarpeta, IconoPatron } from '../types'
import { COLORES_CARPETA, ICONOS_PATRON } from '../types'
import styles from './TemaColorPicker.module.css'

type IconProps = { width?: number; height?: number }

const iconMap: Record<string, (props: IconProps) => ReactNode> = {
  carpeta: (p) => <IconFolder {...p} />,
  anime: (p) => <IconAnime {...p} />,
  series: (p) => <IconTv {...p} />,
  pelicula: (p) => <IconFilm {...p} />,
  juego: (p) => <IconGame {...p} />,
  musica: (p) => <IconMusic {...p} />,
  animal: (p) => <IconPaw {...p} />,
  corazon: (p) => <IconHeart {...p} />,
  estrella: (p) => <IconStar {...p} />,
  libro: (p) => <IconBook {...p} />,
  lana: (p) => <IconYarn {...p} />,
  casa: (p) => <IconHome {...p} />,
}

export function PatronTemaIcon({
  id,
  size = 22,
}: {
  id: IconoPatron | string
  size?: number
}) {
  const key = id in iconMap ? id : 'carpeta'
  const render = iconMap[key] ?? iconMap.carpeta
  return <>{render({ width: size, height: size })}</>
}

interface Props {
  icono: IconoPatron
  color: ColorCarpeta
  onIcono: (v: IconoPatron) => void
  onColor: (v: ColorCarpeta) => void
  compact?: boolean
}

export function TemaColorPicker({
  icono,
  color,
  onIcono,
  onColor,
  compact = false,
}: Props) {
  const colorHex = COLORES_CARPETA.find((c) => c.id === color)?.hex ?? '#c45f48'
  const renderIcon = iconMap[icono] ?? iconMap.carpeta

  return (
    <div className={`${styles.wrap} ${compact ? styles.compact : ''}`}>
      <div
        className={styles.preview}
        style={{ background: colorHex }}
        aria-hidden
      >
        {renderIcon({ width: 32, height: 32 })}
      </div>

      <fieldset className={styles.block}>
        <legend>Tema</legend>
        <div className={styles.temaGrid} role="radiogroup" aria-label="Tema">
          {ICONOS_PATRON.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={icono === opt.id}
              aria-label={opt.label}
              title={opt.label}
              className={`${styles.temaBtn} ${icono === opt.id ? styles.on : ''}`}
              onClick={() => onIcono(opt.id)}
            >
              {(iconMap[opt.id] ?? iconMap.carpeta)({ width: 20, height: 20 })}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.block}>
        <legend>Color de carpeta</legend>
        <div className={styles.colorRow} role="radiogroup" aria-label="Color">
          {COLORES_CARPETA.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={color === opt.id}
              aria-label={opt.label}
              title={opt.label}
              className={`${styles.colorBtn} ${color === opt.id ? styles.colorOn : ''}`}
              style={{ background: opt.hex }}
              onClick={() => onColor(opt.id)}
            />
          ))}
        </div>
      </fieldset>
    </div>
  )
}
