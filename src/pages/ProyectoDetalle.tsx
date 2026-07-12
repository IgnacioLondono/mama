import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ContadorVueltas } from '../components/ContadorVueltas'
import { IaBurbuja } from '../components/IaBurbuja'
import { Modal } from '../components/Modal'
import { ProgresoBar } from '../components/ProgresoBar'
import { VisorArchivos } from '../components/VisorArchivos'
import { useAppData } from '../context/AppDataContext'
import { iaChatScope, loadIaChat, saveIaChat } from '../lib/iaChatSession'
import {
  loadMesaSession,
  saveMesaProgreso,
  saveMesaSession,
  type MesaPanel,
} from '../lib/mesaSession'
import styles from './ProyectoDetalle.module.css'

type Panel = Exclude<MesaPanel, null> | null

export function ProyectoDetalle() {
  const { id } = useParams()
  const {
    getProyecto,
    getPatron,
    setVuelta,
    setParteActiva,
    setModoVueltas,
    setVueltasObjetivo,
    updateProyecto,
    completarProyecto,
    progresoPorcentaje,
    uploadArchivo,
    replaceArchivo,
    renameArchivo,
    deleteArchivo,
  } = useAppData()

  const proyecto = id ? getProyecto(id) : undefined
  const patron = proyecto ? getPatron(proyecto.patronId) : undefined
  const session = id ? loadMesaSession(id) : null
  const [notas, setNotas] = useState(proyecto?.notas ?? '')
  const [panel, setPanel] = useState<Panel>(session?.panel ?? null)
  const [confirmFin, setConfirmFin] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [editNombre, setEditNombre] = useState(false)
  const [nombreDraft, setNombreDraft] = useState(proyecto?.nombre ?? '')
  const [guardando, setGuardando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)

  useEffect(() => {
    if (!id) return
    const s = loadMesaSession(id)
    setPanel(s.panel ?? null)
  }, [id])

  useEffect(() => {
    if (!id) return
    saveMesaSession(id, { panel })
  }, [id, panel])

  useEffect(() => {
    setNotas(proyecto?.notas ?? '')
  }, [proyecto?.id, proyecto?.notas])

  useEffect(() => {
    setNombreDraft(proyecto?.nombre ?? '')
  }, [proyecto?.id, proyecto?.nombre])

  const parteActiva = useMemo(() => {
    if (!patron || !proyecto) return undefined
    return (
      patron.partes.find((p) => p.id === proyecto.parteActivaId) ??
      patron.partes[0]
    )
  }, [patron, proyecto])

  const vueltaActual = useMemo(() => {
    if (!proyecto || !parteActiva) return 0
    return (
      proyecto.progreso.find((p) => p.parteId === parteActiva.id)?.vueltaActual ??
      0
    )
  }, [proyecto, parteActiva])

  const parteIndex =
    patron && parteActiva
      ? patron.partes.findIndex((p) => p.id === parteActiva.id)
      : -1
  const tieneSiguiente =
    !!patron && parteIndex >= 0 && parteIndex < patron.partes.length - 1

  function siguienteParte() {
    if (!patron || !tieneSiguiente) return
    const next = patron.partes[parteIndex + 1]
    if (next) void setParteActiva(proyecto!.id, next.id)
  }

  const objetivo =
    proyecto && parteActiva
      ? proyecto.modoVueltas === 'fijo'
        ? proyecto.vueltasObjetivo
        : parteActiva.vueltasTotales
      : 0

  function togglePanel(next: Panel) {
    setPanel((cur) => (cur === next ? null : next))
  }

  if (!proyecto || !patron || !parteActiva) {
    return (
      <div className="page-enter empty">
        <p>Eso no está.</p>
        <Link to="/proyectos" className="btn btn-secondary">
          Volver
        </Link>
      </div>
    )
  }

  const proy = proyecto
  const pat = patron

  async function guardarProyecto() {
    if (guardando) return
    setGuardando(true)
    setGuardadoOk(false)
    try {
      await updateProyecto(proy.id, { notas })
      saveMesaProgreso(proy.id, {
        progreso: proy.progreso,
        parteActivaId: proy.parteActivaId,
        modoVueltas: proy.modoVueltas,
        vueltasObjetivo: proy.vueltasObjetivo,
        archivoActivoId: proy.archivoActivoId,
      })
      saveMesaSession(proy.id, { panel })
      const scope = iaChatScope({
        proyectoId: proy.id,
        patronId: pat.id,
      })
      saveIaChat(scope, loadIaChat(scope))
      setGuardadoOk(true)
      window.setTimeout(() => setGuardadoOk(false), 1800)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className={`page-enter ${styles.bench}`}>
      <div className={styles.toolbar}>
        <Link to="/" className={styles.back}>
          ← Mesa
        </Link>
        <div className={styles.titleBlock}>
          {editNombre ? (
            <div className={styles.nameEdit}>
              <input
                value={nombreDraft}
                onChange={(e) => setNombreDraft(e.target.value)}
                aria-label="Nombre del proyecto"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const next = nombreDraft.trim() || proyecto.nombre
                    void updateProyecto(proyecto.id, { nombre: next })
                    setEditNombre(false)
                  }
                  if (e.key === 'Escape') {
                    setNombreDraft(proyecto.nombre)
                    setEditNombre(false)
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-sage"
                onClick={() => {
                  const next = nombreDraft.trim() || proyecto.nombre
                  void updateProyecto(proyecto.id, { nombre: next })
                  setEditNombre(false)
                }}
              >
                Guardar
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setNombreDraft(proyecto.nombre)
                  setEditNombre(false)
                }}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className={styles.nameRow}>
              <h1>{proyecto.nombre}</h1>
              <button
                type="button"
                className={styles.editNameBtn}
                onClick={() => {
                  setNombreDraft(proyecto.nombre)
                  setEditNombre(true)
                }}
              >
                Editar
              </button>
            </div>
          )}
          <p>
            {parteActiva.nombre}
            {proyecto.modoVueltas === 'fijo'
              ? ` · ${progresoPorcentaje(proyecto)}%`
              : ' · sin tope'}
          </p>
        </div>
        <div className={styles.toolbarActions}>
          <div className={styles.extraMenu} role="group" aria-label="Más del proyecto">
            <button
              type="button"
              className={panel === 'pasos' ? styles.extraOn : styles.extraBtn}
              onClick={() => togglePanel('pasos')}
            >
              Pasos
            </button>
            <button
              type="button"
              className={panel === 'partes' ? styles.extraOn : styles.extraBtn}
              onClick={() => togglePanel('partes')}
            >
              Partes
            </button>
            <button
              type="button"
              className={panel === 'apuntes' ? styles.extraOn : styles.extraBtn}
              onClick={() => togglePanel('apuntes')}
            >
              Apuntes
            </button>
          </div>
          <button
            type="button"
            className={`btn btn-secondary ${guardadoOk ? styles.saveOk : ''}`}
            onClick={() => void guardarProyecto()}
            disabled={guardando}
          >
            {guardando ? 'Guardando…' : guardadoOk ? 'Guardado' : 'Guardar'}
          </button>
          {proyecto.estado === 'activo' ? (
            <button
              type="button"
              className="btn btn-sage"
              onClick={() => setConfirmFin(true)}
            >
              Terminé
            </button>
          ) : (
            <span className={styles.doneChip}>Listo</span>
          )}
        </div>
      </div>

      <Modal
        open={confirmFin}
        title="¿Ya lo terminaste?"
        confirmLabel="Sí, terminé"
        cancelLabel="Seguir tejiendo"
        busy={finishing}
        onCancel={() => {
          if (!finishing) setConfirmFin(false)
        }}
        onConfirm={() => {
          void (async () => {
            setFinishing(true)
            try {
              await completarProyecto(proyecto.id)
              setConfirmFin(false)
            } finally {
              setFinishing(false)
            }
          })()
        }}
      >
        <p>
          Se marcará <strong>{proyecto.nombre}</strong> como terminado y saldrá
          de «a medias».
        </p>
      </Modal>

      <div className={styles.stage}>
        <div className={styles.stageDoc}>
          <VisorArchivos
            proyectoId={proyecto.id}
            archivos={proyecto.archivos ?? []}
            activoId={proyecto.archivoActivoId ?? null}
            onSelect={(archivoActivoId) =>
              void updateProyecto(proyecto.id, { archivoActivoId })
            }
            onUpload={(file) => uploadArchivo(proyecto.id, file)}
            onReplace={(archivoId, file) =>
              replaceArchivo(proyecto.id, archivoId, file)
            }
            onRename={(archivoId, nombre) =>
              renameArchivo(proyecto.id, archivoId, nombre)
            }
            onDelete={(archivoId) => deleteArchivo(proyecto.id, archivoId)}
            modoMesa
          />
        </div>
        <div className={styles.stageCount}>
          <div className={styles.countStick}>
            <ContadorVueltas
              parteNombre={parteActiva.nombre}
              vueltaActual={vueltaActual}
              vueltasTotales={objetivo}
              modoVueltas={proyecto.modoVueltas}
              onChange={(n) => void setVuelta(proyecto.id, parteActiva.id, n)}
              onModoChange={(modo) => void setModoVueltas(proyecto.id, modo)}
              onObjetivoChange={(n) => void setVueltasObjetivo(proyecto.id, n)}
              onSiguienteParte={siguienteParte}
              tieneSiguiente={tieneSiguiente}
            />
            {proyecto.modoVueltas === 'fijo' ? (
              <div className={styles.miniProgress}>
                <ProgresoBar value={progresoPorcentaje(proyecto)} />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {panel ? (
        <div className={styles.sheet} role="dialog" aria-label={panel}>
          <div className={styles.sheetHead}>
            <strong>
              {panel === 'pasos'
                ? 'Pasos'
                : panel === 'partes'
                  ? 'Partes'
                  : 'Apuntes'}
            </strong>
            <button
              type="button"
              className={styles.sheetClose}
              onClick={() => setPanel(null)}
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
          <div className={styles.sheetBody}>
            {panel === 'pasos' ? (
              <ol>
                {parteActiva.instrucciones.map((ins) => (
                  <li key={ins}>{ins}</li>
                ))}
              </ol>
            ) : null}

            {panel === 'partes' ? (
              <div className={styles.parteList}>
                {patron.partes.map((parte) => {
                  const prog =
                    proyecto.progreso.find((p) => p.parteId === parte.id)
                      ?.vueltaActual ?? 0
                  const active = parte.id === parteActiva.id
                  const denom =
                    active && proyecto.modoVueltas === 'fijo'
                      ? proyecto.vueltasObjetivo
                      : parte.vueltasTotales
                  return (
                    <button
                      key={parte.id}
                      type="button"
                      className={`${styles.parteBtn} ${active ? styles.parteActive : ''}`}
                      onClick={() => void setParteActiva(proyecto.id, parte.id)}
                    >
                      <span>{parte.nombre}</span>
                      <span className={styles.parteProg}>
                        {proyecto.modoVueltas === 'ilimitado' && active
                          ? `${prog}`
                          : `${prog}/${denom}`}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : null}

            {panel === 'apuntes' ? (
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                onBlur={() => {
                  if (notas !== proyecto.notas) {
                    void updateProyecto(proyecto.id, { notas })
                  }
                }}
                placeholder="Colores, cambios, lo que quieras recordar…"
                aria-label="Apuntes"
              />
            ) : null}
          </div>
        </div>
      ) : null}

      <IaBurbuja
        proyectoId={proyecto.id}
        patronId={patron.id}
        archivoId={proyecto.archivoActivoId}
      />
    </div>
  )
}
