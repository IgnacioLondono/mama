import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import styles from './AsistenteIa.module.css'

interface Props {
  proyectoId?: string
  patronId?: string
  archivoId?: string | null
}

const SUGERENCIAS = [
  'Explícame las abreviaciones de este patrón',
  'Dame tips para no perderme en las vueltas',
  '¿Cómo coser mejor las piezas?',
  '¿Qué hago si el relleno se ve irregular?',
]

export function AsistenteIa({ proyectoId, patronId, archivoId }: Props) {
  const [ok, setOk] = useState<boolean | null>(null)
  const [proveedor, setProveedor] = useState('')
  const [pregunta, setPregunta] = useState('')
  const [respuesta, setRespuesta] = useState('')
  const [aviso, setAviso] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void api
      .iaEstado()
      .then((s) => {
        setOk(s.configurada)
        setProveedor(s.proveedor)
      })
      .catch(() => setOk(false))
  }, [])

  async function preguntar(texto?: string) {
    const q = (texto ?? pregunta).trim()
    if (!q) return
    setLoading(true)
    setError('')
    setAviso('')
    try {
      const res = await api.iaAyuda({
        pregunta: q,
        proyectoId,
        patronId,
        archivoId: archivoId ?? undefined,
      })
      setRespuesta(res.respuesta)
      setAviso(res.aviso ?? '')
      setPregunta('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo pedir ayuda.')
    } finally {
      setLoading(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void preguntar()
  }

  if (ok === null) {
    return <p className={styles.muted}>Revisando la ayuda…</p>
  }

  if (!ok) {
    return (
      <div className={styles.box}>
        <p className={styles.title}>Ayuda de tejido</p>
        <p className={styles.muted}>
          Todavía no está conectada. En el servidor pon{' '}
          <code>OPENAI_API_KEY</code> o <code>OLLAMA_BASE_URL</code>.
        </p>
      </div>
    )
  }

  return (
    <div className={styles.box}>
      <div className={styles.head}>
        <p className={styles.title}>Ayuda de tejido</p>
        <span className={styles.badge}>{proveedor}</span>
      </div>
      <p className={styles.muted}>
        Lee el PDF y lo anotado del patrón, y te da tips claros.
      </p>

      <div className={styles.chips}>
        {SUGERENCIAS.map((s) => (
          <button
            key={s}
            type="button"
            className={styles.chip}
            disabled={loading}
            onClick={() => void preguntar(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <form className={styles.form} onSubmit={onSubmit}>
        <textarea
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          placeholder="¿En qué te ayudo con este tejido?"
          rows={3}
          disabled={loading}
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Pensando…' : 'Preguntar'}
        </button>
      </form>

      {error ? <p className={styles.error}>{error}</p> : null}
      {aviso ? <p className={styles.aviso}>{aviso}</p> : null}
      {respuesta ? (
        <div className={styles.answer}>
          {respuesta.split('\n').map((line, i) => (
            <p key={`${i}-${line.slice(0, 12)}`}>{line || '\u00A0'}</p>
          ))}
        </div>
      ) : null}
    </div>
  )
}
