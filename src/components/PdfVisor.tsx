import { useEffect, useRef, useState } from 'react'
import styles from './PdfVisor.module.css'

interface Props {
  url: string
  titulo: string
}

export function PdfVisor({ url, titulo }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  // pdfjs tipado de forma laxa: la API de render cambia entre versiones
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docRef = useRef<any>(null)
  const [paginas, setPaginas] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ancho, setAncho] = useState(0)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0
      if (w > 0) setAncho(w)
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
      setPagina(1)
      setPaginas(0)
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
            // pdfjs tipado incompleto en esta versión
            await (doc as { destroy?: () => Promise<void> }).destroy?.()
          } catch {
            /* ignore */
          }
          return
        }
        docRef.current = doc
        setPaginas(doc.numPages)
        setPagina(1)
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
      const doc = docRef.current
      docRef.current = null
      try {
        void doc?.destroy?.()
      } catch {
        /* ignore */
      }
    }
  }, [url])

  useEffect(() => {
    let cancelled = false

    async function render() {
      const doc = docRef.current
      const canvas = canvasRef.current
      if (!doc || !canvas || paginas === 0 || ancho <= 0) return

      try {
        const page = await doc.getPage(pagina)
        if (cancelled) return

        const base = page.getViewport({ scale: 1 })
        const scale = Math.min(2.4, Math.max(0.85, (ancho - 16) / base.width))
        const viewport = page.getViewport({ scale })
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        await page.render({
          canvasContext: ctx,
          viewport,
          canvas,
        }).promise
      } catch {
        if (!cancelled) setError('No se pudo mostrar esta página.')
      }
    }

    void render()
    return () => {
      cancelled = true
    }
  }, [pagina, paginas, url, ancho])

  if (error) {
    return (
      <div className={styles.fallback}>
        <p>{error}</p>
        <a
          className="btn btn-primary"
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
          onClick={() => setPagina((p) => Math.max(1, p - 1))}
        >
          Anterior
        </button>
        <span className={styles.pageLabel}>
          {loading ? 'Cargando…' : `Pág. ${pagina} / ${paginas || '—'}`}
        </span>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={loading || pagina >= paginas}
          onClick={() => setPagina((p) => Math.min(paginas, p + 1))}
        >
          Siguiente
        </button>
      </div>
      <div ref={wrapRef} className={styles.scroll}>
        {loading ? (
          <p className={styles.loading}>Preparando el patrón…</p>
        ) : (
          <canvas ref={canvasRef} className={styles.canvas} />
        )}
      </div>
    </div>
  )
}
