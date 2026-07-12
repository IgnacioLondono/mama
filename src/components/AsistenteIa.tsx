import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import styles from './AsistenteIa.module.css'

interface Props {
  proyectoId?: string
  patronId?: string
  archivoId?: string | null
}

type Msg = {
  id: string
  rol: 'yo' | 'bot' | 'aviso' | 'error'
  texto: string
}

const SUGERENCIAS = [
  'Explícame las abreviaciones',
  'Tips para no perderme en las vueltas',
  '¿Cómo coser mejor las piezas?',
  'Relleno irregular, ¿qué hago?',
]

function uid() {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function AsistenteIa({ proyectoId, patronId, archivoId }: Props) {
  const [ok, setOk] = useState<boolean | null>(null)
  const [proveedor, setProveedor] = useState('')
  const [pregunta, setPregunta] = useState('')
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      id: 'hola',
      rol: 'bot',
      texto:
        'Hola. Puedo mirar el patrón y el PDF y darte tips claros. ¿Qué necesitas?',
    },
  ])
  const [loading, setLoading] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    void api
      .iaEstado()
      .then((s) => {
        setOk(s.configurada)
        setProveedor(s.proveedor)
      })
      .catch(() => setOk(false))
  }, [])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [msgs, loading])

  async function preguntar(texto?: string) {
    const q = (texto ?? pregunta).trim()
    if (!q || loading) return

    setPregunta('')
    setMsgs((prev) => [...prev, { id: uid(), rol: 'yo', texto: q }])
    setLoading(true)

    try {
      const res = await api.iaAyuda({
        pregunta: q,
        proyectoId,
        patronId,
        archivoId: archivoId ?? undefined,
      })
      setMsgs((prev) => {
        const next = [...prev]
        if (res.aviso) {
          next.push({ id: uid(), rol: 'aviso', texto: res.aviso })
        }
        next.push({ id: uid(), rol: 'bot', texto: res.respuesta })
        return next
      })
    } catch (err) {
      setMsgs((prev) => [
        ...prev,
        {
          id: uid(),
          rol: 'error',
          texto:
            err instanceof Error ? err.message : 'No se pudo pedir ayuda.',
        },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
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
        <p className={styles.muted}>
          Todavía no está conectada. En el servidor pon Ollama o una clave de
          IA.
        </p>
      </div>
    )
  }

  return (
    <div className={styles.chat}>
      <div className={styles.head}>
        <span className={styles.headTitle}>Chat de tejido</span>
        {proveedor ? <span className={styles.badge}>{proveedor}</span> : null}
      </div>

      <div ref={listRef} className={styles.msgs} aria-live="polite">
        {msgs.map((m) => (
          <div
            key={m.id}
            className={
              m.rol === 'yo'
                ? styles.rowYo
                : m.rol === 'aviso'
                  ? styles.rowAviso
                  : m.rol === 'error'
                    ? styles.rowError
                    : styles.rowBot
            }
          >
            <div
              className={
                m.rol === 'yo'
                  ? styles.bubbleYo
                  : m.rol === 'aviso'
                    ? styles.bubbleAviso
                    : m.rol === 'error'
                      ? styles.bubbleError
                      : styles.bubbleBot
              }
            >
              {m.texto.split('\n').map((line, i) => (
                <p key={`${m.id}-${i}`}>{line || '\u00A0'}</p>
              ))}
            </div>
          </div>
        ))}

        {loading ? (
          <div className={styles.rowBot}>
            <div className={`${styles.bubbleBot} ${styles.typing}`}>
              <span />
              <span />
              <span />
            </div>
          </div>
        ) : null}

        {!loading && msgs.length <= 1 ? (
          <div className={styles.chips}>
            {SUGERENCIAS.map((s) => (
              <button
                key={s}
                type="button"
                className={styles.chip}
                onClick={() => void preguntar(s)}
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <form className={styles.composer} onSubmit={onSubmit}>
        <textarea
          ref={inputRef}
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          placeholder="Escribe un mensaje…"
          rows={1}
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void preguntar()
            }
          }}
        />
        <button
          type="submit"
          className={styles.send}
          disabled={loading || !pregunta.trim()}
          aria-label="Enviar"
        >
          Enviar
        </button>
      </form>
    </div>
  )
}
