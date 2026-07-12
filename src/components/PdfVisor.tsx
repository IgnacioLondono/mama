import { useEffect, useRef, useState } from 'react'
import { loadMesaPdfPos, saveMesaPdfPos } from '../lib/mesaSession'
import styles from './PdfVisor.module.css'

interface Props {
  url: string
  titulo: string
  proyectoId?: string
  archivoId?: string
}

export function PdfVisor({ url, titulo, proyectoId, archivoId }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const restoredRef = useRef(false)
  const saveTimer = useRef<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [paginas, setPaginas] = useState(0)
  const [hechas, setHechas] = useState(0)
  const [srcs, setSrcs] = useState<string[]>([])
  const [ancho, setAncho] = useState(0)

  useEffect(() => {
    restoredRef.current = false
  }, [url, archivoId])

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let doc: any = null

    async function run() {
      if (ancho <= 40) return
      setLoading(true)
      setError('')
      setPaginas(0)
      setHechas(0)
      setSrcs([])

      try {
        const pdfjs = await import('pdfjs-dist')
        const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default

        const res = await fetch(url)
        if (!res.ok) throw new Error('No se pudo cargar el PDF.')
        const data = new Uint8Array(await res.arrayBuffer())
        doc = await pdfjs.getDocument({ data }).promise
        if (cancelled) return

        const total = doc.numPages as number
        setPaginas(total)
        setLoading(false)

        const next: string[] = Array.from({ length: total }, () => '')
        for (let n = 1; n <= total; n++) {
          if (cancelled) return
          const page = await doc.getPage(n)
          const base = page.getViewport({ scale: 1 })
          const scale = Math.min(2.4, Math.max(1, (ancho - 8) / base.width))
          const viewport = page.getViewport({ scale })
          const canvas = document.createElement('canvas')
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          const ctx = canvas.getContext('2d')
          if (!ctx) continue
          await page.render({
            canvasContext: ctx,
            viewport,
            canvas,
          }).promise
          if (cancelled) return
          next[n - 1] = canvas.toDataURL('image/jpeg', 0.88)
          setSrcs([...next])
          setHechas(n)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'No se pudo leer el PDF.',
          )
          setLoading(false)
        }
      } finally {
        try {
          await doc?.destroy?.()
        } catch {
          /* ignore */
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [url, ancho])

  // Restaurar scroll cuando haya contenido suficiente
  useEffect(() => {
    if (restoredRef.current) return
    if (!proyectoId || !archivoId) return
    const el = wrapRef.current
    if (!el || hechas < 1) return

    const saved = loadMesaPdfPos(proyectoId, archivoId)
    if (!saved || (saved.scrollTop <= 0 && saved.scrollRatio <= 0)) {
      restoredRef.current = true
      return
    }

    const target =
      saved.scrollRatio > 0
        ? saved.scrollRatio * Math.max(el.scrollHeight - el.clientHeight, 0)
        : saved.scrollTop

    // Esperar a que el scrollHeight crezca lo bastante
    if (el.scrollHeight < target + el.clientHeight && hechas < paginas) {
      return
    }

    el.scrollTop = target
    restoredRef.current = true
  }, [hechas, paginas, proyectoId, archivoId, srcs])

  function persistScroll() {
    const el = wrapRef.current
    if (!el || !proyectoId || !archivoId) return
    const max = Math.max(el.scrollHeight - el.clientHeight, 1)
    saveMesaPdfPos(proyectoId, archivoId, {
      scrollTop: el.scrollTop,
      scrollRatio: el.scrollTop / max,
    })
  }

  function onScroll() {
    if (!proyectoId || !archivoId) return
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(persistScroll, 180)
  }

  useEffect(() => {
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      persistScroll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId, archivoId])

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
        <span className={styles.pageLabel}>
          {loading && hechas === 0
            ? 'Cargando…'
            : hechas < paginas
              ? `Scroll · cargando ${hechas}/${paginas}`
              : `${paginas} páginas · desliza (se guarda)`}
        </span>
      </div>
      <div ref={wrapRef} className={styles.scroll} onScroll={onScroll}>
        {loading && srcs.length === 0 ? (
          <p className={styles.loading}>Preparando el patrón…</p>
        ) : (
          <div className={styles.pages}>
            {(srcs.length ? srcs : ['']).map((src, i) => (
              <div key={`${url}-p${i}`} className={styles.page}>
                {src ? (
                  <img
                    src={src}
                    alt={`Página ${i + 1}`}
                    className={styles.pageImg}
                  />
                ) : (
                  <div className={styles.pageSkeleton}>Página {i + 1}…</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
