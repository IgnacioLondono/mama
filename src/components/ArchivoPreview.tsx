import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { ArchivoMeta } from '../types'
import styles from './ArchivoPreview.module.css'

interface Props {
  archivo: ArchivoMeta | undefined
  alt?: string
}

export function ArchivoPreview({ archivo, alt = 'Vista previa' }: Props) {
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    async function load() {
      setSrc(null)
      setFailed(false)
      if (!archivo) {
        setFailed(true)
        return
      }

      const url = api.archivoUrl(archivo.id)
      const esPdf =
        archivo.tipo === 'application/pdf' ||
        archivo.nombre.toLowerCase().endsWith('.pdf')
      const esImagen = archivo.tipo.startsWith('image/')

      if (esImagen) {
        if (!cancelled) setSrc(url)
        return
      }

      if (!esPdf) {
        if (!cancelled) setFailed(true)
        return
      }

      try {
        const pdfjs = await import('pdfjs-dist')
        // Worker empaquetado por Vite
        const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default

        const res = await fetch(url)
        if (!res.ok) throw new Error('fetch')
        const data = new Uint8Array(await res.arrayBuffer())
        const doc = await pdfjs.getDocument({ data }).promise
        const page = await doc.getPage(1)
        const viewport = page.getViewport({ scale: 0.55 })
        const canvas = document.createElement('canvas')
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('canvas')
        await page.render({
          canvasContext: ctx,
          viewport,
          canvas,
        }).promise
        objectUrl = canvas.toDataURL('image/jpeg', 0.82)
        if (!cancelled) setSrc(objectUrl)
      } catch {
        if (!cancelled) setFailed(true)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [archivo])

  if (!archivo || failed) {
    return (
      <div className={styles.placeholder} aria-hidden>
        <span>PDF</span>
      </div>
    )
  }

  if (!src) {
    return <div className={styles.loading} aria-hidden />
  }

  return (
    <div className={styles.frame}>
      <img src={src} alt={alt} className={styles.img} loading="lazy" />
    </div>
  )
}
