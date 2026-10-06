import type { Part } from '../types'

export function normalizeCode(raw: string): string {
  const trimmed = raw.trim()
  try {
    const url = new URL(trimmed)
    const last = url.pathname.split('/').filter(Boolean).pop()
    if (last) return decodeURIComponent(last)
  } catch {
    // Plain part numbers are the expected QR payload.
  }
  return trimmed
}

export function findParts(parts: Part[], raw: string): Part[] {
  const query = normalizeCode(raw).toLowerCase()
  if (!query) return []

  const exact = parts.filter(
    (part) => part.partNo.toLowerCase() === query || part.id.toLowerCase() === query,
  )
  if (exact.length > 0) return exact

  return parts.filter(
    (part) =>
      part.partNo.toLowerCase().includes(query) ||
      part.name.toLowerCase().includes(query) ||
      part.location.toLowerCase().includes(query) ||
      part.drawingNo.toLowerCase().includes(query) ||
      part.revision.toLowerCase().includes(query),
  )
}
