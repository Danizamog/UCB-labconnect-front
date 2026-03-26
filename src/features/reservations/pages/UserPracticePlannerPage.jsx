import { useEffect, useMemo, useState } from 'react'
import {
  createPracticePlanning,
  getAreas,
  getLabs,
  getMaterials,
  getMyPracticePlannings,
  subscribeReservationsRealtime,
} from '../api/reservationsApi'
import './UserPracticePlannerPage.css'

function formatDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatStatus(status) {
  if (status === 'approved') return 'Aprobada'
  if (status === 'pending') return 'Pendiente'
  if (status === 'rejected') return 'Rechazada'
  if (status === 'cancelled') return 'Cancelada'
  return status
}

function todayPlusDays(days = 1) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function UserPracticePlannerPage({ user }) {
  const token = localStorage.getItem('token') || localStorage.getItem('access_token') || ''
  const [areas, setAreas] = useState([])
  const [labs, setLabs] = useState([])
  const [materials, setMaterials] = useState([])
  const [reservations, setReservations] = useState([])
  const [selectedAreaId, setSelectedAreaId] = useState(null)
  const [selectedLabId, setSelectedLabId] = useState(null)
  const [materialQuantities, setMaterialQuantities] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [realtimeTick, setRealtimeTick] = useState(0)
  const [form, setForm] = useState({
    subject_name: '',
    date: todayPlusDays(1),
    start_time: '08:00',
    end_time: '10:00',
    notes: '',
    needs_support: false,
    support_topic: '',
  })

  const loadData = async (preserveLabId = null) => {
    if (!token) return

    setLoading(true)
    try {
      const [areasData, labsData, reservationsData] = await Promise.all([
        getAreas(token),
        getLabs(token),
        getMyPracticePlannings(token),
      ])

      const activeAreas = areasData.filter((area) => area.is_active)
      const activeLabs = labsData.filter((lab) => lab.is_active !== false)
      const fallbackAreaId = activeAreas[0]?.id ?? null
      const nextAreaId = selectedAreaId && activeAreas.some((area) => area.id === selectedAreaId)
        ? selectedAreaId
        : fallbackAreaId

      const labsForArea = activeLabs.filter((lab) => lab.area_id === nextAreaId)
      const fallbackLabId = labsForArea[0]?.id ?? null
      const nextLabId = preserveLabId && activeLabs.some((lab) => lab.id === preserveLabId)
        ? preserveLabId
        : selectedLabId && activeLabs.some((lab) => lab.id === selectedLabId)
          ? selectedLabId
          : fallbackLabId

      setAreas(activeAreas)
      setLabs(activeLabs)
      setReservations(reservationsData)
      setSelectedAreaId(nextAreaId)
      setSelectedLabId(nextLabId)

      if (nextLabId) {
        const materialsData = await getMaterials(token, nextLabId)
        setMaterials(materialsData)
      } else {
        setMaterials([])
      }

      setError('')
    } catch (err) {
      setError(err.message || 'No se pudo cargar la planificación de prácticas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!token) {
      return undefined
    }

    return subscribeReservationsRealtime(token, {
      onMessage: (message) => {
        if (!message || !['practice_request', 'class_tutorial'].includes(message.entity)) {
          return
        }
        setRealtimeTick((previous) => previous + 1)
      },
    })
  }, [token])

  useEffect(() => {
    if (!token) return
    loadData(selectedLabId)
  }, [realtimeTick])

  useEffect(() => {
    if (!token || !selectedLabId) {
      setMaterials([])
      return
    }

    getMaterials(token, selectedLabId)
      .then((data) => setMaterials(data))
      .catch((err) => setError(err.message || 'No se pudieron cargar los materiales'))
  }, [selectedLabId, token])

  const labsForArea = useMemo(
    () => labs.filter((lab) => lab.area_id === selectedAreaId),
    [labs, selectedAreaId],
  )

  const selectedArea = areas.find((area) => area.id === selectedAreaId) || null
  const selectedLab = labs.find((lab) => lab.id === selectedLabId) || null

  const selectedMaterials = useMemo(
    () =>
      materials
        .map((material) => ({
          ...material,
          quantity: Number(materialQuantities[material.id] || 0),
        }))
        .filter((material) => material.quantity > 0),
    [materials, materialQuantities],
  )

  const materialOverages = useMemo(
    () =>
      materials
        .map((material) => ({
          materialId: material.id,
          name: material.name,
          requested: Number(materialQuantities[material.id] || 0),
          available: Number(material.availableQuantity || 0),
        }))
        .filter((item) => item.requested > item.available),
    [materialQuantities, materials],
  )

  const hasMaterialOverages = materialOverages.length > 0
  const isSubmitDisabled = submitting || loading || !selectedLabId || hasMaterialOverages

  const upcomingReservations = useMemo(
    () =>
      [...reservations]
        .sort((left, right) => new Date(`${left.date}T${left.start_time}`).getTime() - new Date(`${right.date}T${right.start_time}`).getTime())
        .slice(0, 6),
    [reservations],
  )

  const handleAreaChange = (event) => {
    const nextAreaId = Number(event.target.value)
    const nextLabs = labs.filter((lab) => lab.area_id === nextAreaId)
    setSelectedAreaId(nextAreaId)
    setSelectedLabId(nextLabs[0]?.id ?? null)
    setMaterialQuantities({})
  }

  const handleMaterialQuantityChange = (materialId, value) => {
    const parsed = Number(value)
    setMaterialQuantities((previous) => ({
      ...previous,
      [materialId]: Number.isNaN(parsed) ? 0 : parsed,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!selectedLabId) {
      setError('Selecciona un laboratorio para continuar')
      return
    }
    if (hasMaterialOverages) {
      setError('Ajusta las cantidades de materiales porque una o mas superan el stock disponible.')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      await createPracticePlanning(
        {
          laboratory_id: selectedLabId,
          subject_name: form.subject_name.trim(),
          date: form.date,
          start_time: form.start_time,
          end_time: form.end_time,
          notes: form.notes.trim(),
          needs_support: form.needs_support,
          support_topic: form.needs_support ? form.support_topic.trim() : undefined,
          materials: selectedMaterials.map((material) => ({
            asset_id: material.id,
            quantity: material.quantity,
            material_name: material.name,
          })),
        },
        token,
      )

      setSuccess('Tu práctica fue registrada correctamente y los materiales quedaron reservados en inventario.')
      setMaterialQuantities({})
        setForm((previous) => ({
          ...previous,
          subject_name: '',
          notes: '',
          needs_support: false,
          support_topic: '',
      }))
      await loadData(selectedLabId)
    } catch (err) {
      setError(err.message || 'No se pudo registrar la práctica')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="planner-shell" aria-label="Planificador de prácticas">
      <div className="planner-hero">
        <div>
          <p className="planner-kicker">Planificación integral</p>
          <h2>Reserva espacio, materiales y apoyo en una sola solicitud</h2>
          <p>
            Organiza tu práctica completa con visibilidad del área, laboratorio, materiales disponibles y apoyo técnico.
          </p>
        </div>
        <div className="planner-hero-card">
          <span>Solicitante</span>
          <strong>{user?.name || user?.username || 'Usuario institucional'}</strong>
          <small>{user?.role === 'admin' ? 'Administrador' : 'Usuario UCB'}</small>
        </div>
      </div>

      {error ? <p className="planner-alert planner-alert-error">{error}</p> : null}
      {success ? <p className="planner-alert planner-alert-success">{success}</p> : null}

      <div className="planner-grid">
        <form className="planner-form-card" onSubmit={handleSubmit}>
          <div className="planner-section-head">
            <div>
              <h3>Nueva práctica</h3>
              <p>Define el lugar, horario, materiales y el apoyo que necesitas.</p>
            </div>
          </div>

          {loading ? (
            <p className="planner-empty">Cargando datos de laboratorios y materiales...</p>
          ) : (
            <>
              <div className="planner-form-grid">
                <label className="planner-field">
                  <span>Área</span>
                  <select value={selectedAreaId || ''} onChange={handleAreaChange}>
                    {areas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="planner-field">
                  <span>Laboratorio</span>
                  <select
                    value={selectedLabId || ''}
                    onChange={(event) => {
                      setSelectedLabId(Number(event.target.value))
                      setMaterialQuantities({})
                    }}
                  >
                    {labsForArea.map((lab) => (
                      <option key={lab.id} value={lab.id}>
                        {lab.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="planner-field">
                  <span>Materia o asignatura</span>
                  <input
                    type="text"
                    placeholder="Ej. Quimica Organica I"
                    value={form.subject_name}
                    onChange={(event) => setForm((previous) => ({ ...previous, subject_name: event.target.value }))}
                    required
                  />
                </label>

                <label className="planner-field">
                  <span>Fecha</span>
                  <input
                    type="date"
                    min={todayPlusDays(0)}
                    max={todayPlusDays(30)}
                    value={form.date}
                    onChange={(event) => setForm((previous) => ({ ...previous, date: event.target.value }))}
                  />
                </label>

                <label className="planner-field">
                  <span>Hora de inicio</span>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(event) => setForm((previous) => ({ ...previous, start_time: event.target.value }))}
                  />
                </label>

                <label className="planner-field">
                  <span>Hora de fin</span>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(event) => setForm((previous) => ({ ...previous, end_time: event.target.value }))}
                  />
                </label>

                <label className="planner-field planner-checkbox">
                  <span>Apoyo técnico</span>
                  <input
                    type="checkbox"
                    checked={form.needs_support}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        needs_support: event.target.checked,
                        support_topic: event.target.checked ? previous.support_topic : '',
                      }))
                    }
                  />
                </label>
              </div>

              {form.needs_support ? (
                <label className="planner-field">
                  <span>Tipo de apoyo requerido</span>
                  <input
                    type="text"
                    placeholder="Ej. calibración, montaje, asistencia en reactivos"
                    value={form.support_topic}
                    onChange={(event) => setForm((previous) => ({ ...previous, support_topic: event.target.value }))}
                  />
                </label>
              ) : null}

              <label className="planner-field">
                <span>Objetivo u observaciones</span>
                <textarea
                  rows="4"
                  placeholder="Describe la práctica, el grupo o cualquier preparación adicional."
                  value={form.notes}
                  onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))}
                />
              </label>

              <div className="planner-materials">
                <div className="planner-section-head compact">
                  <div>
                    <h3>Materiales disponibles</h3>
                    <p>Selecciona las cantidades que necesitas reservar junto con el laboratorio.</p>
                  </div>
                </div>

                {hasMaterialOverages ? (
                  <p className="planner-alert planner-alert-error">
                    Ajusta las cantidades: no puedes solicitar mas de lo disponible para {materialOverages.map((item) => item.name).join(', ')}.
                  </p>
                ) : null}

                {materials.length === 0 ? (
                  <div className="planner-empty">
                    No hay materiales visibles para este laboratorio todavía.
                  </div>
                ) : (
                  <div className="planner-material-list">
                    {materials.map((material) => (
                      <div
                        key={material.id}
                        className={`planner-material-card ${Number(materialQuantities[material.id] || 0) > Number(material.availableQuantity || 0) ? 'planner-material-card-invalid' : ''}`}
                      >
                        <div>
                          <strong>{material.name}</strong>
                          <p>{material.description || `${material.category || 'Material'} disponible para práctica`}</p>
                          <div className="planner-chip-row">
                            <span>{material.category || 'General'}</span>
                            <span>{material.availableQuantity} {material.unit || 'unidades'} disponibles</span>
                          </div>
                        </div>
                        <label className="planner-quantity">
                          <span>Cantidad</span>
                          <input
                            type="number"
                            min="0"
                            max={material.availableQuantity}
                            value={materialQuantities[material.id] || 0}
                            onChange={(event) => handleMaterialQuantityChange(material.id, event.target.value)}
                          />
                          {Number(materialQuantities[material.id] || 0) > Number(material.availableQuantity || 0) ? (
                            <small className="planner-quantity-error">Supera el stock disponible.</small>
                          ) : null}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button className="planner-submit" type="submit" disabled={isSubmitDisabled}>
                {submitting ? 'Registrando práctica...' : 'Solicitar práctica completa'}
              </button>
            </>
          )}
        </form>

        <aside className="planner-summary-card">
          <div className="planner-section-head compact">
            <div>
              <h3>Resumen de la solicitud</h3>
              <p>Antes de enviar, revisa el alcance completo de tu práctica.</p>
            </div>
          </div>

          <div className="planner-summary-list">
            <div>
              <span>Área</span>
              <strong>{selectedArea?.name || 'Sin seleccionar'}</strong>
            </div>
            <div>
              <span>Laboratorio</span>
              <strong>{selectedLab?.name || 'Sin seleccionar'}</strong>
              <small>{selectedLab ? `${selectedLab.location} · Capacidad ${selectedLab.capacity}` : ''}</small>
            </div>
            <div>
              <span>Materia</span>
              <strong>{form.subject_name.trim() || 'Pendiente'}</strong>
            </div>
            <div>
              <span>Horario</span>
              <strong>{form.date ? `${formatDate(form.date)} · ${form.start_time} - ${form.end_time}` : 'Pendiente'}</strong>
            </div>
            <div>
              <span>Apoyo</span>
              <strong>{form.needs_support ? form.support_topic || 'Sí, pendiente de detalle' : 'No requerido'}</strong>
            </div>
            <div>
              <span>Materiales</span>
              {selectedMaterials.length === 0 ? (
                <small>No seleccionaste materiales todavía.</small>
              ) : (
                <ul className="planner-summary-materials">
                  {selectedMaterials.map((material) => (
                    <li key={material.id}>
                      {material.name} · {material.quantity} {material.unit || 'unidades'}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="planner-section-head compact">
            <div>
              <h3>Mis solicitudes recientes</h3>
              <p>Consulta rápidamente el estado de tus últimas prácticas.</p>
            </div>
          </div>

          {upcomingReservations.length === 0 ? (
            <div className="planner-empty">Todavía no tienes solicitudes registradas.</div>
          ) : (
            <div className="planner-reservation-list">
              {upcomingReservations.map((reservation) => (
                <div key={reservation.id} className="planner-reservation-card">
                  <div className="planner-reservation-head">
                    <strong>{reservation.subject_name || reservation.laboratory_name}</strong>
                    <span className={`planner-status planner-status-${reservation.status}`}>
                      {formatStatus(reservation.status)}
                    </span>
                  </div>
                  <p>{reservation.laboratory_name} · {formatDate(reservation.date)} · {reservation.start_time} - {reservation.end_time}</p>
                  <small>
                    {reservation.materials.length > 0
                      ? `Materiales: ${reservation.materials.map((material) => material.material_name).join(', ')}`
                      : 'Sin materiales seleccionados'}
                  </small>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}

export default UserPracticePlannerPage
