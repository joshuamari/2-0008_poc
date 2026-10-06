export type Vec3 = [number, number, number]

export type Shape =
  | {
      kind: 'box'
      size: Vec3
      position?: Vec3
      rotation?: Vec3
      color?: string
    }
  | {
      kind: 'cylinder'
      radius: number
      height: number
      position?: Vec3
      rotation?: Vec3
      color?: string
    }

export type ComponentSlot = {
  id: string
  label: string
  location: string
  color: string
  position: Vec3
  rotation?: Vec3
  shapes: Shape[]
}

export type BomLine = {
  id: string
  partNo: string
  name: string
  drawingNo: string
  quantity: string
  revision: string
  location: string
  componentId: string
}

export type EquipmentRecord = {
  id: string
  model: string
  name: string
  assemblyNo: string
  revision: string
  description: string
  modelFileName?: string
  parts: BomLine[]
}

export type Part = {
  id: string
  partNo: string
  name: string
  location: string
  drawingNo: string
  quantity: string
  revision: string
  componentId: string
  color: string
  position: Vec3
  rotation?: Vec3
  shapes: Shape[]
}

export type MatchResult = {
  kind: 'none' | 'single' | 'multiple'
  source: string
  ids: string[]
}

export type ViewApi = {
  zoomIn: () => void
  zoomOut: () => void
  reset: () => void
}
