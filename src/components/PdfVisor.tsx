import { useEffect, useRef, useState } from 'react'
import { loadMesaPdfPos, saveMesaPdfPos } from '../lib/mesaSession'
import styles from './PdfVisor.module.css'

interface Props {
  url: string
  titulo: string
  proyectoId?: string
  archivoId?: string
}

function esCancelado(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { name?: string; message?: string }
  return (
    e.name === 'RenderingCancelledException' ||
    /cancel/i.test(e.message ?? '')
  )
}

export function PdfVisor({ url, titulo, proyectoId, archivoId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTaskRef = useRef<any>(null)
  const [paginas, setPaginas] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(true)
  const [pintando, setPintando] = useState(false)
  const [error, setError] = useState('')
  const [ancho, setAncho] = useState(0)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0]?.contentRect.width ?? 0)
      if (w > 40) setAncho(w)
    })
    ro.observe(el)
    setAncho(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    docRef.current = null

    async function load() {
      setLoading(true)
      setError('')
      setPaginas(0)
      setPagina(1)
      try {
        const pdfjs = await import('pdfjs-dist')
        const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default

        const res = await fetch(url)
        if (!res.ok) throw new Error('No se pudo cargar el PDF.')
        const data = new Uint8Array(await res.arrayBuffer())
        const doc = await pdfjs.getDocument({ data }).promise
        if (cancelled) {
          try {
            await (doc as { destroy?: () => Promise<void> }).destroy?.()
          } catch {
            /* ignore */
          }
          return
        }
        docRef.current = doc
        const total = doc.numPages as number
        setPaginas(total)

        let start = 1
        if (proyectoId && archivoId) {
          const saved = loadMesaPdfPos(proyectoId, archivoId)
          if (saved?.pagina && saved.pagina >= 1) {
            start = Math.min(saved.pagina, total)
          }
        }
        setPagina(start)
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'No se pudo leer el PDF.',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
      try {
        renderTaskRef.current?.cancel?.()
      } catch {
        /* ignore */
      }
      renderTaskRef.current = null
      const doc = docRef.current
      docRef.current = null
      try {
        void doc?.destroy?.()
      } catch {
        /* ignore */
      }
    }
  }, [url, proyectoId, archivoId])

  useEffect(() => {
    let cancelled = false

    async function render() {
      const doc = docRef.current
      const canvas = canvasRef.current
      if (loading || error || !doc || !canvas || paginas === 0 || ancho <= 0) {
        return
      }

      setPintando(true)
      try {
        try {
          renderTaskRef.current?.cancel?.()
        } catch {
          /* ignore */
        }

        const page = await doc.getPage(pagina)
        if (cancelled) return

        const base = page.getViewport({ scale: 1 })
        if (!base.width || !base.height) {
          throw new Error('Página sin tamaño.')
        }

        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const fit = Math.max(0.35, (ancho - 8) / base.width)
        const scale = Math.min(2.2, fit) * dpr
        const viewport = page.getViewport({ scale })
        const ctx = canvas.getContext('2d', { alpha: false })
        if (!ctx) throw new Error('Sin canvas.')

        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`

        const task = page.render({
          canvasContext: ctx,
          viewport,
          canvas,
          background: '#ffffff',
        })
        renderTaskRef.current = task
        await task.promise
        if (cancelled) return
        if (wrapRef.current) wrapRef.current.scrollTop = 0
      } catch (err) {
        if (!cancelled && !esCancelado(err)) {
          setError('No se pudo mostrar esta página.')
        }
      } finally {
        if (!cancelled) setPintando(false)
      }
    }

    void render()
    return () => {
      cancelled = true
      try {
        renderTaskRef.current?.cancel?.()
      } catch {
        /* ignore */
      }
      renderTaskRef.current = null
    }
  }, [pagina, paginas, url, ancho, loading, error])

  useEffect(() => {
    if (!proyectoId || !archivoId || paginas === 0 || loading) return
    saveMesaPdfPos(proyectoId, archivoId, {
      pagina,
      scrollTop: 0,
      scrollRatio: 0,
    })
  }, [pagina, paginas, proyectoId, archivoId, loading])

  function ir(delta: number) {
    setError('')
    setPagina((p) => Math.min(paginas, Math.max(1, p + delta)))
  }

  function reintentar() {
    setError('')
  }

  if (error && !docRef.current) {
    return (
      <div className={styles.fallback}>
        <p>{error}</p>
        <a
          className={`btn btn-primary ${styles.openBtn}`}
          href={url}
          target="_blank"
          rel="noreferrer"
        >
          Abrir {titulo}
        </a>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <div className={styles.nav}>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={loading || pagina <= 1}
          onClick={() => ir(-1)}
        >
          Anterior
        </button>
        <span className={styles.pageLabel}>
          {loading
            ? 'Cargando…'
            : pintando
              ? `Pág. ${pagina}…`
              : `Pág. ${pagina} / ${paginas || '—'}`}
        </span>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={loading || pagina >= paginas}
          onClick={() => ir(1)}
        >
          Siguiente
        </button>
      </div>

      {error ? (
        <div className={styles.fallbackInline}>
          <p>{error}</p>
          <div className={styles.fallbackActions}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={reintentar}
            >
              Reintentar
            </button>
            <a
              className={`btn btn-primary ${styles.openBtn}`}
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              Abrir PDF
            </a>
          </div>
        </div>
      ) : null}

      <div ref={wrapRef} className={styles.scroll} hidden={!!error}>
        {loading ? (
          <p className={styles.loading}>Preparando el patrón…</p>
        ) : null}
        {/* Canvas siempre montado (oculto al cargar) para evitar carreras de ref */}
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          style={{ display: loading ? 'none' : 'block' }}
        />
      </div>
    </div>
  )
}
