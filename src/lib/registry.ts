import { componentById, components, sampleEquipment } from '../data/assembly'
import type { BomLine, EquipmentRecord, Part } from '../types'

const REGISTRY_KEY = '2-0008-registry'

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

export function blankPart(): BomLine {
  return {
    id: newId('part'),
    partNo: '',
    name: '',
    drawingNo: '',
    quantity: '1',
    revision: '',
    location: '',
    componentId: '',
  }
}

export function blankEquipment(): EquipmentRecord {
  return {
    id: newId('eq'),
    model: '',
    name: '',
    assemblyNo: '',
    revision: '',
    description: '',
    parts: [blankPart()],
  }
}

export function fromSample(): EquipmentRecord {
  return {
    ...blankEquipment(),
    model: sampleEquipment.model,
    name: sampleEquipment.name,
    assemblyNo: sampleEquipment.assemblyNo,
    revision: sampleEquipment.revision,
    description: sampleEquipment.description,
    parts: sampleEquipment.parts.map((part) => ({ ...part, id: newId('part') })),
  }
}

export function loadRegistry(): EquipmentRecord[] {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY)
    if (raw === null) {
      const seeded = [structuredClone(sampleEquipment)]
      localStorage.setItem(REGISTRY_KEY, JSON.stringify(seeded))
      return seeded
    }
    const parsed = JSON.parse(raw) as EquipmentRecord[]
    return Array.isArray(parsed) ? parsed : [structuredClone(sampleEquipment)]
  } catch {
    return [structuredClone(sampleEquipment)]
  }
}

export function saveRegistry(records: EquipmentRecord[]): void {
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(records))
}

export function viewParts(record: EquipmentRecord): Part[] {
  return record.parts.map((line) => {
    const slot = componentById(line.componentId)
    return {
      id: line.id,
      partNo: line.partNo,
      name: line.name,
      location: line.location || slot?.location || '',
      drawingNo: line.drawingNo,
      quantity: line.quantity,
      revision: line.revision,
      componentId: line.componentId,
      color: slot?.color ?? '#8a8178',
      position: slot?.position ?? [0, 0, 0],
      rotation: slot?.rotation,
      shapes: slot?.shapes ?? [],
    }
  })
}

export function previewParts(record: EquipmentRecord): Part[] {
  return components.map((slot) => {
    const line = record.parts.find((part) => part.componentId === slot.id)
    return {
      id: slot.id,
      partNo: line?.partNo ?? '',
      name: line?.name || slot.label,
      location: line?.location || slot.location,
      drawingNo: line?.drawingNo ?? '',
      quantity: line?.quantity ?? '',
      revision: line?.revision ?? '',
      componentId: slot.id,
      color: slot.color,
      position: slot.position,
      rotation: slot.rotation,
      shapes: slot.shapes,
    }
  })
}

export function validateEquipment(record: EquipmentRecord): string | null {
  if (!record.name.trim()) return 'Equipment name is required.'
  const parts = record.parts.filter((part) => !isEmptyPart(part))
  if (parts.length === 0) return 'Add at least one part.'
  const missing = parts.find((part) => !part.partNo.trim() || !part.name.trim())
  if (missing) return 'Each part needs a part number and a part name.'
  const links = parts.map((part) => part.componentId).filter(Boolean)
  const duplicate = links.find((id, index) => links.indexOf(id) !== index)
  if (duplicate) return 'Each 3D component can only be linked to one part.'
  return null
}

export function cleanEquipment(record: EquipmentRecord): EquipmentRecord {
  return {
    ...record,
    model: record.model.trim(),
    name: record.name.trim(),
    assemblyNo: record.assemblyNo.trim(),
    revision: record.revision.trim(),
    description: record.description.trim(),
    parts: record.parts.filter((part) => !isEmptyPart(part)).map((part) => ({
      ...part,
      partNo: part.partNo.trim(),
      name: part.name.trim(),
      drawingNo: part.drawingNo.trim(),
      quantity: part.quantity.trim() || '1',
      revision: part.revision.trim(),
      location: part.location.trim(),
    })),
  }
}

function isEmptyPart(part: BomLine): boolean {
  return (
    !part.partNo.trim() &&
    !part.name.trim() &&
    !part.drawingNo.trim() &&
    !part.revision.trim() &&
    !part.location.trim() &&
    !part.componentId
  )
}
