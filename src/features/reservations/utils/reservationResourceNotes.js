const RESOURCE_NOTES_PREFIX = '[[LABCONNECT_RESOURCES]]'

function safeString(value) {
  return String(value || '').trim()
}

export function buildReservationResourceNotes({ assets = [], materials = [], userNotes = '' } = {}) {
  const normalizedAssets = Array.isArray(assets)
    ? assets
        .map((asset) => ({
          id: safeString(asset?.id),
          name: safeString(asset?.name),
          serial_number: safeString(asset?.serial_number),
        }))
        .filter((asset) => asset.id)
    : []

  const normalizedMaterials = Array.isArray(materials)
    ? materials
        .map((material) => ({
          id: safeString(material?.id),
          name: safeString(material?.name),
          quantity: Number(material?.quantity || 0),
          unit: safeString(material?.unit),
        }))
        .filter((material) => material.id && material.quantity > 0)
    : []

  const normalizedUserNotes = safeString(userNotes)
  if (normalizedAssets.length === 0 && normalizedMaterials.length === 0 && !normalizedUserNotes) {
    return ''
  }

  return `${RESOURCE_NOTES_PREFIX}${JSON.stringify({
    assets: normalizedAssets,
    materials: normalizedMaterials,
    user_notes: normalizedUserNotes,
  })}`
}

export function parseReservationResourceNotes(notes) {
  const rawNotes = String(notes || '').trim()
  const emptyResult = {
    raw_notes: rawNotes,
    user_notes: rawNotes,
    assets: [],
    materials: [],
  }

  if (!rawNotes.startsWith(RESOURCE_NOTES_PREFIX)) {
    return emptyResult
  }

  const payload = rawNotes.slice(RESOURCE_NOTES_PREFIX.length).trim()
  if (!payload) {
    return { ...emptyResult, raw_notes: '', user_notes: '' }
  }

  try {
    const parsed = JSON.parse(payload)
    const assets = Array.isArray(parsed?.assets)
      ? parsed.assets
          .map((asset) => ({
            id: safeString(asset?.id),
            name: safeString(asset?.name),
            serial_number: safeString(asset?.serial_number),
          }))
          .filter((asset) => asset.id)
      : []
    const materials = Array.isArray(parsed?.materials)
      ? parsed.materials
          .map((material) => ({
            id: safeString(material?.id),
            name: safeString(material?.name),
            quantity: Number(material?.quantity || 0),
            unit: safeString(material?.unit),
          }))
          .filter((material) => material.id && material.quantity > 0)
      : []

    return {
      raw_notes: rawNotes,
      user_notes: safeString(parsed?.user_notes),
      assets,
      materials,
    }
  } catch {
    return emptyResult
  }
}
