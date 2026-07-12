import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from 'react'
import { IconTrash, IconYarn } from '../components/Icons'
import { Modal } from '../components/Modal'
import { useAppData } from '../context/AppDataContext'
import { api } from '../lib/api'
import type { TipoMaterial } from '../types'
import styles from './Materiales.module.css'

const tipoLabels: Record<TipoMaterial, string> = {
  lana: 'Lana',
  aguja: 'Aguja',
  relleno: 'Relleno',
  otro: 'Otro',
}

const empty = {
  nombre: '',
  tipo: 'lana' as TipoMaterial,
  color: '#D4B896',
  cantidad: 50,
  unidad: 'g',
  minimo: 20,
}

type FiltroTipo = 'todos' | TipoMaterial | 'bajos'

export function Materiales() {
  const {
    materiales,
    addMaterial,
    updateMaterial,
    deleteMaterial,
    uploadMaterialImagen,
    deleteMaterialImagen,
  } = useAppData()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState<string | null>(null)
  const [fotoPendiente, setFotoPendiente] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<FiltroTipo>('todos')
  const [q, setQ] = useState('')
  const [borrarId, setBorrarId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const bajos = materiales.filter(
    (m) => m.minimo != null && m.cantidad <= m.minimo,
  )
  const lanas = materiales.filter((m) => m.tipo === 'lana').length
  const aBorrar = borrarId
    ? materiales.find((m) => m.id === borrarId)
    : undefined

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return materiales.filter((m) => {
      const matchQ =
        !query ||
        m.nombre.toLowerCase().includes(query) ||
        tipoLabels[m.tipo].toLowerCase().includes(query)
      if (!matchQ) return false
      if (filtro === 'todos') return true
      if (filtro === 'bajos')
        return m.minimo != null && m.cantidad <= m.minimo
      return m.tipo === filtro
    })
  }, [materiales, filtro, q])

  function clearFotoLocal() {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    setFotoPendiente(null)
    setFotoPreview(null)
  }

  function pickFoto(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 12 * 1024 * 1024) return
    clearFotoLocal()
    setFotoPendiente(file)
    setFotoPreview(URL.createObjectURL(file))
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    pickFoto(e.dataTransfer.files?.[0])
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim() || busy) return
    setBusy(true)
    try {
      const payload = {
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        color: form.color,
        cantidad: Number(form.cantidad) || 0,
        unidad: form.unidad.trim() || 'u',
        minimo: Number(form.minimo) || 0,
      }
      let id = editId
      if (editId) {
        await updateMaterial(editId, payload)
      } else {
        const creado = await addMaterial(payload)
        id = creado.id
      }
      if (id && fotoPendiente) {
        await uploadMaterialImagen(id, fotoPendiente)
      }
      clearFotoLocal()
      setForm(empty)
      setEditId(null)
      setShowForm(false)
    } finally {
      setBusy(false)
    }
  }

  function startEdit(id: string) {
    const m = materiales.find((x) => x.id === id)
    if (!m) return
    clearFotoLocal()
    setForm({
      nombre: m.nombre,
      tipo: m.tipo,
      color: m.color,
      cantidad: m.cantidad,
      unidad: m.unidad,
      minimo: m.minimo ?? 0,
    })
    setEditId(id)
    setShowForm(true)
  }

  function openNew() {
    clearFotoLocal()
    setEditId(null)
    setForm(empty)
    setShowForm((v) => !v)
  }

  async function onCardFoto(id: string, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      await uploadMaterialImagen(id, file)
    } finally {
      setBusy(false)
    }
  }

  const editando = editId
    ? materiales.find((m) => m.id === editId)
    : undefined
  const formPreview =
    fotoPreview ??
    (editando?.imagen
      ? api.materialImagenUrl(editando.id, editando.imagen)
      : null)

  return (
    <div className={`page-enter ${styles.page}`}>
      <header className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.kicker}>Inventario</p>
          <h1>Lana</h1>
          <p className={styles.lead}>
            Ovillos, agujas y relleno que tenés en casa. Si se acaba, te lo
            marco.
          </p>
        </div>
        <button
          type="button"
          className={`btn btn-primary btn-lg ${styles.cta}`}
          onClick={openNew}
        >
          {showForm && !editId ? 'Cerrar' : 'Anotar algo'}
        </button>

        <div className={styles.stats} aria-label="Resumen">
          <div className={styles.stat}>
            <strong>{materiales.length}</strong>
            <span>en total</span>
          </div>
          <div className={`${styles.stat} ${bajos.length ? styles.statWarn : ''}`}>
            <strong>{bajos.length}</strong>
            <span>por comprar</span>
          </div>
          <div className={styles.stat}>
            <strong>{lanas}</strong>
            <span>lanas</span>
          </div>
        </div>
      </header>

      {bajos.length > 0 && filtro !== 'bajos' ? (
        <button
          type="button"
          className={styles.alert}
          onClick={() => setFiltro('bajos')}
        >
          <span className={styles.alertDot} aria-hidden />
          {bajos.length === 1
            ? `1 material se está acabando`
            : `${bajos.length} materiales se están acabando`}
          <span className={styles.alertLink}>Ver</span>
        </button>
      ) : null}

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          type="search"
          placeholder="Buscar por nombre o tipo…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar en el inventario"
        />
        <div className={styles.chips} role="tablist" aria-label="Filtro">
          {(
            [
              ['todos', 'Todo'],
              ['bajos', 'Por comprar'],
              ['lana', 'Lana'],
              ['aguja', 'Agujas'],
              ['relleno', 'Relleno'],
              ['otro', 'Otros'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filtro === id}
              className={filtro === id ? styles.chipOn : styles.chip}
              onClick={() => setFiltro(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Modal
        open={Boolean(borrarId)}
        title="¿Borrar del inventario?"
        confirmLabel="Sí, borrar"
        cancelLabel="Dejarlo"
        danger
        busy={busy}
        onCancel={() => {
          if (!busy) setBorrarId(null)
        }}
        onConfirm={() => {
          if (!borrarId) return
          void (async () => {
            setBusy(true)
            try {
              await deleteMaterial(borrarId)
              setBorrarId(null)
            } finally {
              setBusy(false)
            }
          })()
        }}
      >
        <p>
          Se borrará <strong>{aBorrar?.nombre ?? 'esto'}</strong> del
          inventario.
        </p>
      </Modal>

      {showForm ? (
        <form className={styles.form} onSubmit={(e) => void onSubmit(e)}>
          <div className={styles.formHead}>
            <h2>{editId ? 'Editar material' : 'Anotar material'}</h2>
            <p>Nombre, cantidad y una foto del ovillo si querés.</p>
          </div>

          <div
            className={`${styles.drop} ${dragging ? styles.dropOn : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            {formPreview ? (
              <img src={formPreview} alt="" className={styles.dropPreview} />
            ) : (
              <span className={styles.dropIcon}>
                <IconYarn width={28} height={28} />
              </span>
            )}
            <div className={styles.dropText}>
              <strong>Foto (opcional)</strong>
              <span>Arrastrá o elegí una imagen</span>
            </div>
            <div className={styles.dropActions}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => fileRef.current?.click()}
              >
                Elegir foto
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => pickFoto(e.target.files?.[0])}
              />
              {editando?.imagen && !fotoPendiente ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void deleteMaterialImagen(editando.id)}
                >
                  Quitar foto
                </button>
              ) : null}
              {fotoPendiente ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={clearFotoLocal}
                >
                  Quitar
                </button>
              ) : null}
            </div>
          </div>

          <div className="field">
            <label htmlFor="mat-nombre">Nombre</label>
            <input
              id="mat-nombre"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              required
              placeholder="Lana beige, aguja 2.5…"
            />
          </div>
          <div className={styles.row}>
            <div className="field">
              <label htmlFor="mat-tipo">Tipo</label>
              <select
                id="mat-tipo"
                value={form.tipo}
                onChange={(e) =>
                  setForm({ ...form, tipo: e.target.value as TipoMaterial })
                }
              >
                {(Object.keys(tipoLabels) as TipoMaterial[]).map((t) => (
                  <option key={t} value={t}>
                    {tipoLabels[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="mat-color">Color</label>
              <div className={styles.colorRow}>
                <input
                  id="mat-color"
                  type="color"
                  value={form.color}
                  onChange={(e) =>
                    setForm({ ...form, color: e.target.value })
                  }
                />
                <span
                  style={{ background: form.color }}
                  className={styles.colorSwatch}
                />
              </div>
            </div>
          </div>
          <div className={styles.row3}>
            <div className="field">
              <label htmlFor="mat-cant">Cantidad</label>
              <input
                id="mat-cant"
                type="number"
                min={0}
                value={form.cantidad}
                onChange={(e) =>
                  setForm({ ...form, cantidad: Number(e.target.value) })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="mat-unidad">Unidad</label>
              <input
                id="mat-unidad"
                value={form.unidad}
                onChange={(e) => setForm({ ...form, unidad: e.target.value })}
                placeholder="g, u, ovillos…"
              />
            </div>
            <div className="field">
              <label htmlFor="mat-min">Avisar bajo</label>
              <input
                id="mat-min"
                type="number"
                min={0}
                value={form.minimo}
                onChange={(e) =>
                  setForm({ ...form, minimo: Number(e.target.value) })
                }
              />
            </div>
          </div>
          <div className={styles.formActions}>
            <button type="submit" className="btn btn-sage" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setShowForm(false)
                setEditId(null)
                setForm(empty)
                clearFotoLocal()
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {materiales.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>
            <IconYarn width={36} height={36} />
          </span>
          <h2>El cajón está vacío</h2>
          <p>Anotá la primera madeja o aguja para empezar el inventario.</p>
          <button type="button" className="btn btn-primary" onClick={openNew}>
            Anotar algo
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyFilter}>
          <p>Nada coincide con esa búsqueda.</p>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setQ('')
              setFiltro('todos')
            }}
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <ul className={styles.grid}>
          {filtered.map((m, i) => {
            const bajo = m.minimo != null && m.cantidad <= m.minimo
            const maxRef = Math.max(m.minimo ?? 1, m.cantidad, 1)
            const pct = Math.min(100, Math.round((m.cantidad / maxRef) * 100))
            return (
              <li
                key={m.id}
                className={`${styles.card} ${bajo ? styles.bajo : ''}`}
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              >
                <div className={styles.media}>
                  {m.imagen ? (
                    <img
                      src={api.materialImagenUrl(m.id, m.imagen)}
                      alt=""
                      className={styles.photo}
                    />
                  ) : (
                    <div
                      className={styles.swatchBig}
                      style={{ background: m.color }}
                      aria-hidden
                    >
                      <IconYarn width={40} height={40} />
                    </div>
                  )}
                  {bajo ? (
                    <span className={styles.badgeLow}>Se acaba</span>
                  ) : null}
                  <label className={styles.fotoBtn}>
                    Foto
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={busy}
                      onChange={(e) => void onCardFoto(m.id, e)}
                    />
                  </label>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.cardTop}>
                    <div>
                      <p className={styles.tipo}>{tipoLabels[m.tipo]}</p>
                      <h3>{m.nombre}</h3>
                    </div>
                    <span
                      className={styles.dot}
                      style={{ background: m.color }}
                      title={m.color}
                    />
                  </div>
                  <div className={styles.qty}>
                    <strong>
                      {m.cantidad}
                      <span className={styles.unit}> {m.unidad}</span>
                    </strong>
                    {m.minimo != null ? (
                      <span className={styles.min}>mín. {m.minimo}</span>
                    ) : null}
                  </div>
                  <div
                    className={styles.bar}
                    role="meter"
                    aria-valuenow={m.cantidad}
                    aria-valuemin={0}
                    aria-valuemax={maxRef}
                  >
                    <span
                      className={bajo ? styles.barLow : styles.barFill}
                      style={{ width: `${Math.max(pct, 4)}%` }}
                    />
                  </div>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.qtyBtn}
                      onClick={() =>
                        void updateMaterial(m.id, {
                          cantidad: Math.max(0, m.cantidad - 10),
                        })
                      }
                      aria-label="Restar 10"
                    >
                      −10
                    </button>
                    <button
                      type="button"
                      className={styles.qtyBtn}
                      onClick={() =>
                        void updateMaterial(m.id, {
                          cantidad: m.cantidad + 10,
                        })
                      }
                      aria-label="Sumar 10"
                    >
                      +10
                    </button>
                    <button
                      type="button"
                      className={styles.textBtn}
                      onClick={() => startEdit(m.id)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className={styles.iconDanger}
                      onClick={() => setBorrarId(m.id)}
                      aria-label={`Borrar ${m.nombre}`}
                      title="Borrar"
                    >
                      <IconTrash width={16} height={16} />
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
