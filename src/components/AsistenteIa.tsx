import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { api } from '../lib/api'
import {
  clearIaChat,
  iaChatScope,
  loadIaChat,
  saveIaChat,
  type IaChatMsg,
} from '../lib/iaChatSession'
import { IconSend, IconStop } from './Icons'
import styles from './AsistenteIa.module.css'

interface Props {
  proyectoId?: string
  patronId?: string
  archivoId?: string | null
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

function holaMsg(): IaChatMsg {
  return {
    id: `hola-${Date.now()}`,
    rol: 'bot',
    texto:
      'Hola. Puedo ayudarte con tips o, si activás «Con PDF», leer el patrón con precisión. ¿En qué te ayudo?',
  }
}

export function AsistenteIa({ proyectoId, patronId, archivoId }: Props) {
  const scope = useMemo(
    () => iaChatScope({ proyectoId, patronId }),
    [proyectoId, patronId],
  )
  const [ok, setOk] = useState<boolean | null>(null)
  const [proveedor, setProveedor] = useState('')
  const [pregunta, setPregunta] = useState('')
  const [msgs, setMsgs] = useState<IaChatMsg[]>(() => loadIaChat(scope))
  const [loading, setLoading] = useState(false)
  const [usarPdf, setUsarPdf] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [showJump, setShowJump] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const skipFirstSave = useRef(true)
  const stickBottom = useRef(true)
  const abortRef = useRef<AbortController | null>(null)
  const userStopRef = useRef(false)
  const inFlightRef = useRef(false)

  useEffect(() => {
    setMsgs(loadIaChat(scope))
    skipFirstSave.current = true
    setEditId(null)
  }, [scope])

  useEffect(() => {
    if (skipFirstSave.current) {
      skipFirstSave.current = false
      return
    }
    saveIaChat(scope, msgs)
  }, [scope, msgs])

  useEffect(() => {
    let cancelled = false
    void api
      .iaEstado()
      .then((s) => {
        if (cancelled) return
        setOk(s.configurada)
        setProveedor(s.proveedor)
        if (s.configurada && usarPdf) {
          void api
            .iaPrecargar({
              proyectoId,
              patronId,
              archivoId: archivoId ?? undefined,
            })
            .catch(() => {})
        }
      })
      .catch(() => {
        if (!cancelled) setOk(false)
      })
    return () => {
      cancelled = true
    }
  }, [proyectoId, patronId, archivoId, usarPdf])

  useEffect(() => {
    const el = listRef.current
    if (!el || !stickBottom.current) return
    el.scrollTop = el.scrollHeight
  }, [msgs, loading])

  useEffect(() => {
    return () => {
      // Al desmontar, cancelar sin dejar aviso de “detenido”
      userStopRef.current = false
      inFlightRef.current = false
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [])

  function onScrollMsgs() {
    const el = listRef.current
    if (!el) return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    const nearBottom = dist < 48
    stickBottom.current = nearBottom
    setShowJump(!nearBottom && el.scrollHeight > el.clientHeight + 80)
  }

  function irAbajo() {
    const el = listRef.current
    if (!el) return
    stickBottom.current = true
    setShowJump(false)
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }

  async function pedirAlBot(preguntaTexto: string, historial: IaChatMsg[]) {
    const q = preguntaTexto.trim()
    if (!q || inFlightRef.current) return

    inFlightRef.current = true
    userStopRef.current = false
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setLoading(true)
    stickBottom.current = true
    setShowJump(false)
    setMsgs(historial)

    try {
      const res = await api.iaAyuda(
        {
          pregunta: q,
          proyectoId,
          patronId,
          archivoId: archivoId ?? undefined,
          usarPdf,
        },
        { signal: ac.signal },
      )
      if (ac.signal.aborted || userStopRef.current) return
      setMsgs(() => {
        const next = [...historial]
        if (res.aviso) {
          next.push({ id: uid(), rol: 'aviso', texto: res.aviso })
        }
        next.push({ id: uid(), rol: 'bot', texto: res.respuesta })
        return next
      })
    } catch (err) {
      const aborted =
        userStopRef.current ||
        (err instanceof Error && err.name === 'AbortError') ||
        ac.signal.aborted

      if (aborted) {
        // Solo mostrar aviso si el usuario pulsó Detener
        if (userStopRef.current) {
          setMsgs([
            ...historial,
            {
              id: uid(),
              rol: 'aviso',
              texto: 'Respuesta detenida.',
            },
          ])
        }
        return
      }
      setMsgs(() => [
        ...historial,
        {
          id: uid(),
          rol: 'error',
          texto:
            err instanceof Error ? err.message : 'No se pudo pedir ayuda.',
        },
      ])
    } finally {
      if (abortRef.current === ac) abortRef.current = null
      inFlightRef.current = false
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function detener() {
    userStopRef.current = true
    abortRef.current?.abort()
    abortRef.current = null
    inFlightRef.current = false
    setLoading(false)
  }

  async function preguntar(texto?: string) {
    const q = (texto ?? pregunta).trim()
    if (!q || inFlightRef.current) return
    setPregunta('')
    const historial = [...msgs, { id: uid(), rol: 'yo' as const, texto: q }]
    await pedirAlBot(q, historial)
  }

  function ultimaPreguntaAntesDe(botId: string): {
    yoIdx: number
    pregunta: string
  } | null {
    const botIdx = msgs.findIndex((m) => m.id === botId)
    if (botIdx < 0) return null
    for (let i = botIdx - 1; i >= 0; i--) {
      if (msgs[i].rol === 'yo') {
        return { yoIdx: i, pregunta: msgs[i].texto }
      }
    }
    return null
  }

  async function regenerar(botId: string) {
    if (inFlightRef.current) return
    const found = ultimaPreguntaAntesDe(botId)
    if (!found) return
    const historial = msgs.slice(0, found.yoIdx + 1)
    await pedirAlBot(found.pregunta, historial)
  }

  function empezarEditar(m: IaChatMsg) {
    if (inFlightRef.current || m.rol !== 'yo') return
    setEditId(m.id)
    setEditDraft(m.texto)
  }

  async function confirmarEditar() {
    if (!editId || inFlightRef.current) return
    const texto = editDraft.trim()
    if (!texto) return
    const idx = msgs.findIndex((m) => m.id === editId)
    if (idx < 0) return
    setEditId(null)
    const historial = [
      ...msgs.slice(0, idx),
      { ...msgs[idx], texto },
    ]
    await pedirAlBot(texto, historial)
  }

  function limpiar() {
    if (inFlightRef.current) return
    clearIaChat(scope)
    setMsgs([holaMsg()])
    setEditId(null)
    setPregunta('')
    stickBottom.current = true
    setShowJump(false)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (inFlightRef.current) {
      detener()
      return
    }
    void preguntar()
  }

  const ultimoBotId = useMemo(() => {
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].rol === 'bot' && !msgs[i].id.startsWith('hola')) {
        return msgs[i].id
      }
      if (msgs[i].rol === 'error') return msgs[i].id
    }
    return null
  }, [msgs])

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
        <div className={styles.headLeft}>
          <span className={styles.headTitle}>Chat</span>
          {proveedor ? <span className={styles.badge}>{proveedor}</span> : null}
        </div>
        <div className={styles.headActions}>
          <button
            type="button"
            className={`${styles.toggle} ${usarPdf ? styles.toggleOn : ''}`}
            onClick={() => setUsarPdf((v) => !v)}
            title={
              usarPdf
                ? 'Ahora lee el PDF al responder'
                : 'Charla normal, sin leer el PDF'
            }
            aria-pressed={usarPdf}
          >
            {usarPdf ? 'Con PDF' : 'Sin PDF'}
          </button>
          <button
            type="button"
            className={styles.headBtn}
            onClick={limpiar}
            disabled={loading || msgs.length <= 1}
            title="Limpiar chat"
          >
            Limpiar
          </button>
        </div>
      </div>

      <div className={styles.msgsWrap}>
        <div
          ref={listRef}
          className={styles.msgs}
          aria-live="polite"
          onScroll={onScrollMsgs}
        >
          {msgs.map((m) => {
            const esUltimoBot = m.id === ultimoBotId
            const puedeEditar = m.rol === 'yo' && !loading
            const puedeRegen =
              (m.rol === 'bot' || m.rol === 'error') &&
              esUltimoBot &&
              !loading &&
              !m.id.startsWith('hola')

            return (
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
                <div className={styles.msgBlock}>
                  {editId === m.id ? (
                    <div className={styles.editBox}>
                      <textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        rows={3}
                        autoFocus
                      />
                      <div className={styles.editActions}>
                        <button
                          type="button"
                          className={styles.actBtn}
                          onClick={() => setEditId(null)}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className={styles.actBtnPrimary}
                          disabled={!editDraft.trim()}
                          onClick={() => void confirmarEditar()}
                        >
                          Guardar y regenerar
                        </button>
                      </div>
                    </div>
                  ) : (
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
                  )}

                  {(puedeEditar || puedeRegen) && editId !== m.id ? (
                    <div
                      className={
                        m.rol === 'yo' ? styles.msgActionsYo : styles.msgActions
                      }
                    >
                      {puedeEditar ? (
                        <button
                          type="button"
                          className={styles.actBtn}
                          onClick={() => empezarEditar(m)}
                        >
                          Editar
                        </button>
                      ) : null}
                      {puedeRegen ? (
                        <button
                          type="button"
                          className={styles.actBtn}
                          onClick={() => void regenerar(m.id)}
                        >
                          Regenerar
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}

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

        {showJump ? (
          <button
            type="button"
            className={styles.jumpDown}
            onClick={irAbajo}
            aria-label="Ir abajo"
            title="Ir abajo"
          >
            ↓
          </button>
        ) : null}
      </div>

      <form className={styles.composer} onSubmit={onSubmit}>
        <textarea
          ref={inputRef}
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          placeholder={
            usarPdf ? 'Pregunta sobre el patrón…' : 'Escribe un mensaje…'
          }
          rows={1}
          disabled={loading || !!editId}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void preguntar()
            }
          }}
        />
        <button
          type={loading ? 'button' : 'submit'}
          className={loading ? styles.stopSend : styles.send}
          disabled={!loading && (!pregunta.trim() || !!editId)}
          aria-label={loading ? 'Detener' : 'Enviar'}
          title={loading ? 'Detener' : 'Enviar'}
          onClick={loading ? detener : undefined}
        >
          {loading ? (
            <IconStop width={18} height={18} />
          ) : (
            <IconSend width={18} height={18} />
          )}
        </button>
      </form>
    </div>
  )
}
