import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { loadMesaPdfPos, saveMesaPdfPos } from '../lib/mesaSession'
import {
  COLORES_RESALTE,
  GROSORES_PINCEL,
  loadPdfMarksPage,
  savePdfMarksPage,
  type PdfMarkPoint,
  type PdfMarkStroke,
} from '../lib/pdfMarks'
import {
  IconBrush,
  IconEraser,
  IconTrash,
  IconZoomIn,
  IconZoomOut,
} from './Icons'
import styles from './PdfVisor.module.css'

interface Props {
  url: string
  titulo: string
  proyectoId?: string
  archivoId?: string
}

const ZOOM_MIN = 0.5
const ZOOM_MAX = 3
const ZOOM_STEP = 0.25
const ZOOM_FIT = 1

function clampZoom(z: number) {
  const stepped = Math.round(z / 0.05) * 0.05
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(stepped.toFixed(2))))
}

function formatZoom(z: number) {
  return `${Math.round(z * 100)}%`
}

function esCancelado(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { name?: string; message?: string }
  return (
    e.name === 'RenderingCancelledException' ||
    /cancel/i.test(e.message ?? '')
  )
}

function uid() {
  return `mk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`
}

function pintarStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: PdfMarkStroke[],
  w: number,
  h: number,
) {
  ctx.clearRect(0, 0, w, h)
  for (const s of strokes) {
    if (s.points.length < 1) continue
    const lineW = Math.max(8, s.grosor * h)
    ctx.strokeStyle = s.color
    ctx.fillStyle = s.color
    ctx.lineWidth = lineW
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalCompositeOperation = 'multiply'

    if (s.tipo === 'linea' || s.points.length === 1) {
      const y = s.points[0].y * h
      const xs = s.points.map((p) => p.x * w)
      const x0 = Math.min(...xs)
      const x1 = Math.max(...xs)
      ctx.beginPath()
      ctx.moveTo(x0, y)
      ctx.lineTo(Math.max(x0 + 2, x1), y)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.moveTo(s.points[0].x * w, s.points[0].y * h)
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x * w, s.points[i].y * h)
      }
      ctx.stroke()
    }
  }
  ctx.globalCompositeOperation = 'source-over'
}

export function PdfVisor({ url, titulo, proyectoId, archivoId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const markRef = useRef<HTMLCanvasElement>(null)
  const stackRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTaskRef = useRef<any>(null)
  const drawingRef = useRef(false)
  const draftRef = useRef<PdfMarkPoint[]>([])
  const strokesRef = useRef<PdfMarkStroke[]>([])
  const scrollPosRef = useRef({ top: 0, left: 0, ratio: 0 })
  const skipScrollSaveRef = useRef(false)
  const lastPaginaRef = useRef<number | null>(null)
  const zoomRef = useRef(ZOOM_FIT)
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null)
  const lastTapRef = useRef(0)
  const pincelRef = useRef(false)
  const applyZoomRef = useRef<
    (next: number, origin?: { x: number; y: number }) => void
  >(() => {})

  const [paginas, setPaginas] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(true)
  const [pintando, setPintando] = useState(false)
  const [error, setError] = useState('')
  const [ancho, setAncho] = useState(0)
  const [zoom, setZoom] = useState(ZOOM_FIT)
  const [pincel, setPincel] = useState(false)
  const [borrador, setBorrador] = useState(false)
  const [colorIdx, setColorIdx] = useState(0)
  const [grosorIdx, setGrosorIdx] = useState(1)
  const [strokes, setStrokes] = useState<PdfMarkStroke[]>([])

  const puedeMarcar = Boolean(proyectoId && archivoId)
  const grosorActual = GROSORES_PINCEL[grosorIdx].grosor

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  useEffect(() => {
    pincelRef.current = pincel
  }, [pincel])

  // Bloquear zoom de página del navegador (Safari/iPad) y manejar pellizco solo en el PDF.
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return

    function distOf(touches: TouchList) {
      if (touches.length < 2) return 0
      const a = touches[0]
      const b = touches[1]
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    }

    function centerOf(touches: TouchList) {
      const a = touches[0]
      const b = touches[1]
      return {
        x: (a.clientX + b.clientX) / 2,
        y: (a.clientY + b.clientY) / 2,
      }
    }

    function onPinchStart(e: TouchEvent) {
      if (pincelRef.current || e.touches.length !== 2) {
        pinchRef.current = null
        return
      }
      e.preventDefault()
      pinchRef.current = {
        dist: distOf(e.touches),
        zoom: zoomRef.current,
      }
    }

    function onPinchMove(e: TouchEvent) {
      if (e.touches.length >= 2) e.preventDefault()
      if (!pinchRef.current || e.touches.length !== 2) return
      const dist = distOf(e.touches)
      if (dist < 8 || pinchRef.current.dist < 8) return
      const factor = dist / pinchRef.current.dist
      applyZoomRef.current(pinchRef.current.zoom * factor, centerOf(e.touches))
    }

    function onPinchEnd(e: TouchEvent) {
      if (e.touches.length < 2) pinchRef.current = null
    }

    function blockPageZoom(e: TouchEvent) {
      if (e.touches.length >= 2) e.preventDefault()
    }

    function blockGesture(e: Event) {
      e.preventDefault()
    }

    const opts: AddEventListenerOptions = { passive: false, capture: true }

    wrap.addEventListener('touchstart', onPinchStart, opts)
    wrap.addEventListener('touchmove', onPinchMove, opts)
    wrap.addEventListener('touchend', onPinchEnd, opts)
    wrap.addEventListener('touchcancel', onPinchEnd, opts)
    wrap.addEventListener('gesturestart', blockGesture, opts)
    wrap.addEventListener('gesturechange', blockGesture, opts)
    wrap.addEventListener('gestureend', blockGesture, opts)

    // Mientras el PDF está abierto, ningún pellizco debe zoomar la página entera.
    document.addEventListener('touchmove', blockPageZoom, opts)
    document.addEventListener('gesturestart', blockGesture, opts)
    document.addEventListener('gesturechange', blockGesture, opts)

    return () => {
      wrap.removeEventListener('touchstart', onPinchStart, opts)
      wrap.removeEventListener('touchmove', onPinchMove, opts)
      wrap.removeEventListener('touchend', onPinchEnd, opts)
      wrap.removeEventListener('touchcancel', onPinchEnd, opts)
      wrap.removeEventListener('gesturestart', blockGesture, opts)
      wrap.removeEventListener('gesturechange', blockGesture, opts)
      wrap.removeEventListener('gestureend', blockGesture, opts)
      document.removeEventListener('touchmove', blockPageZoom, opts)
      document.removeEventListener('gesturestart', blockGesture, opts)
      document.removeEventListener('gesturechange', blockGesture, opts)
    }
  }, [loading, error])

  const redibujarMarcas = useCallback((list: PdfMarkStroke[]) => {
    const mark = markRef.current
    const pdf = canvasRef.current
    if (!mark || !pdf) return
    mark.width = pdf.width
    mark.height = pdf.height
    mark.style.width = pdf.style.width
    mark.style.height = pdf.style.height
    const ctx = mark.getContext('2d')
    if (!ctx) return
    const cssW = pdf.clientWidth || parseFloat(pdf.style.width) || mark.width
    const cssH = pdf.clientHeight || parseFloat(pdf.style.height) || mark.height
    // Dibujar en coordenadas CSS vía transform del canvas bitmap
    const dprX = mark.width / cssW
    const dprY = mark.height / cssH
    ctx.setTransform(dprX, 0, 0, dprY, 0, 0)
    pintarStrokes(ctx, list, cssW, cssH)
  }, [])

  useEffect(() => {
    strokesRef.current = strokes
    redibujarMarcas(strokes)
  }, [strokes, redibujarMarcas, pintando, loading])

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
      setZoom(ZOOM_FIT)
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
        let scrollTop = 0
        let scrollRatio = 0
        let savedZoom = ZOOM_FIT
        if (proyectoId && archivoId) {
          const saved = loadMesaPdfPos(proyectoId, archivoId)
          if (saved?.pagina && saved.pagina >= 1) {
            start = Math.min(saved.pagina, total)
          }
          if (saved && (!saved.pagina || saved.pagina === start)) {
            scrollTop = saved.scrollTop || 0
            scrollRatio = saved.scrollRatio || 0
          }
          if (saved?.zoom && Number.isFinite(saved.zoom)) {
            savedZoom = clampZoom(saved.zoom)
          }
        }
        scrollPosRef.current = { top: scrollTop, left: 0, ratio: scrollRatio }
        setZoom(savedZoom)
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
    if (!proyectoId || !archivoId || paginas === 0) {
      setStrokes([])
      return
    }
    setStrokes(loadPdfMarksPage(proyectoId, archivoId, pagina))
  }, [proyectoId, archivoId, pagina, paginas])

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

        const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
        const fit = Math.max(0.35, (ancho - 8) / base.width)
        const scale = Math.min(fit * zoom * 1.15, fit * ZOOM_MAX) * dpr
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
        redibujarMarcas(strokesRef.current)

        const wrap = wrapRef.current
        if (wrap) {
          skipScrollSaveRef.current = true
          const pageChanged =
            lastPaginaRef.current !== null && lastPaginaRef.current !== pagina
          if (pageChanged) {
            wrap.scrollTop = 0
            wrap.scrollLeft = 0
            scrollPosRef.current = { top: 0, left: 0, ratio: 0 }
          } else {
            const maxY = Math.max(0, wrap.scrollHeight - wrap.clientHeight)
            const maxX = Math.max(0, wrap.scrollWidth - wrap.clientWidth)
            const { top, left, ratio } = scrollPosRef.current
            if (ratio > 0 && maxY > 0) {
              wrap.scrollTop = ratio * maxY
            } else {
              wrap.scrollTop = Math.min(top, maxY)
            }
            wrap.scrollLeft = Math.min(left, maxX)
          }
          lastPaginaRef.current = pagina
          requestAnimationFrame(() => {
            skipScrollSaveRef.current = false
          })
        }
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
  }, [pagina, paginas, url, ancho, zoom, loading, error, redibujarMarcas])

  useEffect(() => {
    if (!proyectoId || !archivoId || paginas === 0 || loading) return
    saveMesaPdfPos(proyectoId, archivoId, {
      pagina,
      scrollTop: scrollPosRef.current.top,
      scrollRatio: scrollPosRef.current.ratio,
      zoom,
    })
  }, [pagina, paginas, proyectoId, archivoId, loading, zoom])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || !proyectoId || !archivoId) return

    let timer: number | undefined
    function onScroll() {
      if (skipScrollSaveRef.current) return
      const max = Math.max(0, wrap!.scrollHeight - wrap!.clientHeight)
      const top = wrap!.scrollTop
      const left = wrap!.scrollLeft
      const ratio = max > 0 ? top / max : 0
      scrollPosRef.current = { top, left, ratio }
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        saveMesaPdfPos(proyectoId!, archivoId!, {
          pagina,
          scrollTop: top,
          scrollRatio: ratio,
          zoom: zoomRef.current,
        })
      }, 120)
    }

    wrap.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.clearTimeout(timer)
      wrap.removeEventListener('scroll', onScroll)
    }
  }, [proyectoId, archivoId, pagina, loading])

  function applyZoom(next: number, origin?: { x: number; y: number }) {
    const wrap = wrapRef.current
    const prev = zoomRef.current
    const z = clampZoom(next)
    if (Math.abs(z - prev) < 0.01) return

    if (wrap) {
      const rect = wrap.getBoundingClientRect()
      const ox = origin?.x ?? rect.left + wrap.clientWidth / 2
      const oy = origin?.y ?? rect.top + wrap.clientHeight / 2
      const relX = (wrap.scrollLeft + (ox - rect.left)) / Math.max(0.01, prev)
      const relY = (wrap.scrollTop + (oy - rect.top)) / Math.max(0.01, prev)
      skipScrollSaveRef.current = true
      setZoom(z)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const maxX = Math.max(0, wrap.scrollWidth - wrap.clientWidth)
          const maxY = Math.max(0, wrap.scrollHeight - wrap.clientHeight)
          wrap.scrollLeft = Math.min(
            maxX,
            Math.max(0, relX * z - (ox - rect.left)),
          )
          wrap.scrollTop = Math.min(
            maxY,
            Math.max(0, relY * z - (oy - rect.top)),
          )
          scrollPosRef.current = {
            top: wrap.scrollTop,
            left: wrap.scrollLeft,
            ratio: maxY > 0 ? wrap.scrollTop / maxY : 0,
          }
          skipScrollSaveRef.current = false
        })
      })
    } else {
      setZoom(z)
    }
  }
  applyZoomRef.current = applyZoom

  function zoomIn() {
    applyZoom(zoomRef.current + ZOOM_STEP)
  }

  function zoomOut() {
    applyZoom(zoomRef.current - ZOOM_STEP)
  }

  function zoomFit() {
    applyZoom(ZOOM_FIT)
  }

  function onViewerClick(e: React.MouseEvent<HTMLDivElement>) {
    if (pincel || loading) return
    if ((e.target as HTMLElement).closest('button, a')) return
    const now = Date.now()
    if (now - lastTapRef.current < 280) {
      lastTapRef.current = 0
      const next = zoomRef.current > 1.2 ? ZOOM_FIT : 1.75
      applyZoom(next, { x: e.clientX, y: e.clientY })
    } else {
      lastTapRef.current = now
    }
  }

  function persist(next: PdfMarkStroke[]) {
    setStrokes(next)
    if (proyectoId && archivoId) {
      savePdfMarksPage(proyectoId, archivoId, pagina, next)
    }
  }

  function puntoDesdeEvento(
    e: ReactPointerEvent<HTMLCanvasElement>,
  ): PdfMarkPoint | null {
    const mark = markRef.current
    if (!mark) return null
    const rect = mark.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return null
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!pincel || !puedeMarcar || loading) return
    e.preventDefault()
    const p = puntoDesdeEvento(e)
    if (!p) return
    markRef.current?.setPointerCapture(e.pointerId)

    if (borrador) {
      const hitR = 0.035
      const next = strokesRef.current.filter((s) => {
        return !s.points.some(
          (pt) =>
            Math.hypot(pt.x - p.x, pt.y - p.y) < hitR ||
            (s.tipo === 'linea' &&
              Math.abs(pt.y - p.y) < hitR * 1.2 &&
              p.x >= Math.min(...s.points.map((x) => x.x)) - hitR &&
              p.x <= Math.max(...s.points.map((x) => x.x)) + hitR),
        )
      })
      persist(next)
      return
    }

    drawingRef.current = true
    draftRef.current = [p]
    redibujarMarcas([
      ...strokesRef.current,
      {
        id: 'draft',
        tipo: 'linea',
        color: COLORES_RESALTE[colorIdx].color,
        grosor: grosorActual,
        points: [p, p],
      },
    ])
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || borrador) return
    const p = puntoDesdeEvento(e)
    if (!p) return
    const start = draftRef.current[0]
    if (!start) return
    // Resaltador de línea: fija Y al inicio (como marcar texto)
    draftRef.current = [start, { x: p.x, y: start.y }]
    redibujarMarcas([
      ...strokesRef.current,
      {
        id: 'draft',
        tipo: 'linea',
        color: COLORES_RESALTE[colorIdx].color,
        grosor: grosorActual,
        points: draftRef.current,
      },
    ])
  }

  function onPointerUp(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    drawingRef.current = false
    try {
      markRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    const pts = draftRef.current
    draftRef.current = []
    if (pts.length < 1) return
    const xs = pts.map((p) => p.x)
    const span = Math.abs(Math.max(...xs) - Math.min(...xs))
    if (span < 0.01) {
      redibujarMarcas(strokesRef.current)
      return
    }
    const stroke: PdfMarkStroke = {
      id: uid(),
      tipo: 'linea',
      color: COLORES_RESALTE[colorIdx].color,
      grosor: grosorActual,
      points: pts,
    }
    persist([...strokesRef.current, stroke])
  }

  function ir(delta: number) {
    setError('')
    scrollPosRef.current = { top: 0, left: 0, ratio: 0 }
    setPagina((p) => Math.min(paginas, Math.max(1, p + delta)))
  }

  function reintentar() {
    setError('')
  }

  function borrarPagina() {
    if (!puedeMarcar) return
    persist([])
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

      <div className={styles.zoomBar} role="toolbar" aria-label="Zoom del PDF">
        <button
          type="button"
          className={styles.zoomBtn}
          disabled={loading || zoom <= ZOOM_MIN}
          onClick={zoomOut}
          title="Alejar"
          aria-label="Alejar"
        >
          <IconZoomOut width={20} height={20} />
        </button>
        <button
          type="button"
          className={styles.zoomPct}
          disabled={loading}
          onClick={zoomFit}
          title="Ajustar al ancho"
          aria-label={`Zoom ${formatZoom(zoom)}. Tocar para ajustar al ancho`}
        >
          {formatZoom(zoom)}
        </button>
        <button
          type="button"
          className={styles.zoomBtn}
          disabled={loading || zoom >= ZOOM_MAX}
          onClick={zoomIn}
          title="Acercar"
          aria-label="Acercar"
        >
          <IconZoomIn width={20} height={20} />
        </button>
        <button
          type="button"
          className={styles.zoomFit}
          disabled={loading || zoom === ZOOM_FIT}
          onClick={zoomFit}
        >
          Ajustar
        </button>
        <span className={styles.zoomHint}>Pellizcá o doble toque</span>
      </div>

      {puedeMarcar ? (
        <div className={styles.markBar}>
          <button
            type="button"
            className={`${styles.iconBtn} ${pincel && !borrador ? styles.toolOn : ''}`}
            onClick={() => {
              setPincel((v) => !v || borrador)
              setBorrador(false)
            }}
            title="Pincel"
            aria-label="Pincel"
            aria-pressed={pincel && !borrador}
          >
            <IconBrush width={18} height={18} />
          </button>
          <button
            type="button"
            className={`${styles.iconBtn} ${borrador ? styles.toolOn : ''}`}
            disabled={!pincel && strokes.length === 0}
            onClick={() => {
              setPincel(true)
              setBorrador((v) => !v)
            }}
            title="Borrar"
            aria-label="Borrar"
            aria-pressed={borrador}
          >
            <IconEraser width={18} height={18} />
          </button>
          <div className={styles.swatches} role="group" aria-label="Color">
            {COLORES_RESALTE.map((c, i) => (
              <button
                key={c.id}
                type="button"
                className={`${styles.swatch} ${colorIdx === i ? styles.swatchOn : ''}`}
                style={{ background: c.color.replace(/[\d.]+\)$/, '0.85)') }}
                title={c.label}
                aria-label={c.label}
                onClick={() => {
                  setColorIdx(i)
                  setPincel(true)
                  setBorrador(false)
                }}
              />
            ))}
          </div>
          <div className={styles.sizes} role="group" aria-label="Tamaño">
            {GROSORES_PINCEL.map((g, i) => (
              <button
                key={g.id}
                type="button"
                className={`${styles.sizeDot} ${grosorIdx === i ? styles.sizeDotOn : ''}`}
                title={g.label}
                aria-label={`Tamaño ${g.label}`}
                aria-pressed={grosorIdx === i}
                onClick={() => {
                  setGrosorIdx(i)
                  setPincel(true)
                  setBorrador(false)
                }}
              >
                <span
                  className={styles.sizeDotInner}
                  style={{
                    width: `${0.35 + i * 0.22}rem`,
                    height: `${0.35 + i * 0.22}rem`,
                  }}
                />
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.iconBtn}
            disabled={strokes.length === 0}
            onClick={borrarPagina}
            title="Limpiar página"
            aria-label="Limpiar página"
          >
            <IconTrash width={18} height={18} />
          </button>
        </div>
      ) : null}

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

      <div
        ref={wrapRef}
        className={`${styles.scroll} ${pincel ? styles.scrollPaint : ''}`}
        hidden={!!error}
        onClick={onViewerClick}
      >
        <div className={styles.scrollInner}>
          {loading ? (
            <p className={styles.loading}>Preparando el patrón…</p>
          ) : null}
          <div
            ref={stackRef}
            className={styles.stack}
            style={{ display: loading ? 'none' : 'inline-block' }}
          >
            <canvas ref={canvasRef} className={styles.canvas} />
            <canvas
              ref={markRef}
              className={`${styles.markCanvas} ${pincel ? styles.markActive : ''}`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
