import { useRef, useState, type ChangeEvent } from 'react'
import { api } from '../lib/api'
import type { ArchivoMeta } from '../types'
import { Modal } from './Modal'
import { PdfVisor } from './PdfVisor'
import styles from './VisorArchivos.module.css'

const ACCEPT =
  'application/pdf,image/*,.pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.doc,.docx'

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

interface Props {
  proyectoId: string
  archivos: ArchivoMeta[]
  activoId: string | null
  onSelect: (archivoId: string | null) => void
  onUpload: (file: File) => Promise<void>
  onReplace?: (archivoId: string, file: File) => Promise<void>
  onRename?: (archivoId: string, nombre: string) => Promise<void>
  onDelete: (archivoId: string) => Promise<void>
}

export function VisorArchivos({
  proyectoId: _proyectoId,
  archivos,
  activoId,
  onSelect,
  onUpload,
  onReplace,
  onRename,
  onDelete,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const replaceRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [borrarId, setBorrarId] = useState<string | null>(null)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const activo = archivos.find((a) => a.id === activoId) ?? archivos[0] ?? null
  const url = activo ? api.archivoUrl(activo.id, activo.subidoEn) : null
  const borrarMeta = borrarId
    ? archivos.find((a) => a.id === borrarId)
    : undefined

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setBusy(true)
    setError('')
    try {
      for (const file of files) {
        if (file.size > 25 * 1024 * 1024) {
          setError(`«${file.name}» pesa demasiado (máx. 25 MB).`)
          continue
        }
        await onUpload(file)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir.')
    } finally {
      setBusy(false)
    }
  }

  async function onReplacePick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !activo || !onReplace) return
    if (file.size > 25 * 1024 * 1024) {
      setError(`«${file.name}» pesa demasiado (máx. 25 MB).`)
      return
    }
    setBusy(true)
    setError('')
    try {
      await onReplace(activo.id, file)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reemplazar.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmarBorrar() {
    if (!borrarId) return
    setBusy(true)
    setError('')
    try {
      await onDelete(borrarId)
      setBorrarId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo borrar.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmarRename() {
    if (!renameId || !onRename) return
    const nombre = renameValue.trim()
    if (!nombre) {
      setError('Ponle un nombre al archivo.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onRename(renameId, nombre)
      setRenameId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo renombrar.')
    } finally {
      setBusy(false)
    }
  }

  const esPdf =
    activo &&
    (activo.tipo === 'application/pdf' ||
      activo.nombre.toLowerCase().endsWith('.pdf'))
  const esImagen = activo?.tipo.startsWith('image/')

  return (
    <section className={styles.wrap} aria-label="Archivos del patrón">
      <div className={styles.toolbar}>
        <h2 className={styles.title}>Patrón / PDF</h2>
        <div className={styles.toolbarBtns}>
          {activo && onReplace ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => replaceRef.current?.click()}
            >
              Reemplazar
            </button>
          ) : null}
          {activo && onRename ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => {
                setRenameValue(activo.nombre)
                setRenameId(activo.id)
              }}
            >
              Renombrar
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? 'Un momento…' : 'Subir archivo'}
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={ACCEPT}
          multiple
          onChange={(e) => void onPick(e)}
        />
        <input
          ref={replaceRef}
          type="file"
          className="sr-only"
          accept={ACCEPT}
          onChange={(e) => void onReplacePick(e)}
        />
      </div>

      {archivos.length > 0 ? (
        <div className={styles.tabs}>
          {archivos.map((a) => (
            <div key={a.id} className={styles.tabRow}>
              <button
                type="button"
                className={`${styles.tab} ${a.id === activo?.id ? styles.tabActive : ''}`}
                onClick={() => onSelect(a.id)}
              >
                <span className={styles.tabName}>{a.nombre}</span>
                <span className={styles.tabSize}>{formatBytes(a.tamano)}</span>
              </button>
              <button
                type="button"
                className={styles.tabDel}
                aria-label={`Quitar ${a.nombre}`}
                onClick={() => setBorrarId(a.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.viewer}>
        {!activo || !url ? (
          <p className={styles.empty}>
            Sube el PDF del patrón (o una foto) para verlo aquí mientras cuentas
            vueltas.
          </p>
        ) : esPdf ? (
          <PdfVisor
            key={activo.id + activo.subidoEn}
            url={url}
            titulo={activo.nombre}
            proyectoId={_proyectoId}
            archivoId={activo.id}
          />
        ) : esImagen ? (
          <div className={styles.imgWrap}>
            <img src={url} alt={activo.nombre} className={styles.img} />
          </div>
        ) : (
          <div className={styles.fallback}>
            <p>No se puede previsualizar este tipo de archivo aquí.</p>
            <a className="btn btn-primary" href={url} download={activo.nombre}>
              Descargar {activo.nombre}
            </a>
            <a
              className="btn btn-secondary"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              Abrir en otra pestaña
            </a>
          </div>
        )}
      </div>

      <Modal
        open={!!borrarId}
        title="¿Quitar este archivo?"
        confirmLabel="Sí, quitar"
        cancelLabel="Dejarlo"
        danger
        busy={busy}
        onCancel={() => {
          if (!busy) setBorrarId(null)
        }}
        onConfirm={() => void confirmarBorrar()}
      >
        <p>
          Se quitará{' '}
          <strong>{borrarMeta?.nombre ?? 'este archivo'}</strong> de la mesa.
        </p>
      </Modal>

      <Modal
        open={!!renameId}
        title="Renombrar archivo"
        confirmLabel="Guardar"
        cancelLabel="Cancelar"
        busy={busy}
        onCancel={() => {
          if (!busy) setRenameId(null)
        }}
        onConfirm={() => void confirmarRename()}
      >
        <label className={styles.renameLabel} htmlFor="rename-archivo">
          Nombre
        </label>
        <input
          id="rename-archivo"
          className={styles.renameInput}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void confirmarRename()
            }
          }}
          autoFocus
        />
      </Modal>
    </section>
  )
}
