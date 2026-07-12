import styles from './ProgresoBar.module.css'

interface Props {
  value: number
  label?: string
}

export function ProgresoBar({ value, label }: Props) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className={styles.wrap} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      {label ? <div className={styles.label}>{label}</div> : null}
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.pct}>{pct}%</span>
    </div>
  )
}
