import type { ComponentSlot, EquipmentRecord, Part, Vec3 } from '../types'

const alongX: Vec3 = [0, 0, Math.PI / 2]
const alongZ: Vec3 = [Math.PI / 2, 0, 0]

export const equipment = {
  project: '2-0008',
  model: 'CPS-100',
  name: 'Cooling Pump Skid',
  assemblyNo: 'ASM-CPS-100',
  revision: 'A',
}

type MeshPart = Omit<Part, 'drawingNo' | 'quantity' | 'revision' | 'componentId'>

const parts: MeshPart[] = [
  {
    id: 'base',
    partNo: 'BP-1001',
    name: 'Base Plate',
    location: 'Skid foundation',
    color: '#5b656f',
    position: [0, 0.05, 0],
    shapes: [{ kind: 'box', size: [2.8, 0.1, 1.3] }],
  },
  {
    id: 'motor',
    partNo: 'MTR-2200',
    name: 'Drive Motor',
    location: 'Left side of skid',
    color: '#2c4d73',
    position: [-0.72, 0.4, 0],
    shapes: [
      { kind: 'cylinder', radius: 0.22, height: 0.72, rotation: alongX },
      {
        kind: 'cylinder',
        radius: 0.12,
        height: 0.1,
        position: [-0.4, 0, 0],
        rotation: alongX,
        color: '#24384f',
      },
      {
        kind: 'cylinder',
        radius: 0.045,
        height: 0.26,
        position: [0.46, 0, 0],
        rotation: alongX,
        color: '#c5ccd3',
      },
      { kind: 'box', size: [0.16, 0.1, 0.18], position: [-0.16, -0.24, 0], color: '#3d4650' },
      { kind: 'box', size: [0.16, 0.1, 0.18], position: [0.16, -0.24, 0], color: '#3d4650' },
    ],
  },
  {
    id: 'coupling',
    partNo: 'CPL-3100',
    name: 'Coupling',
    location: 'Between motor and pump',
    color: '#c4622d',
    position: [-0.08, 0.4, 0],
    shapes: [{ kind: 'cylinder', radius: 0.09, height: 0.18, rotation: alongX }],
  },
  {
    id: 'guard',
    partNo: 'GRD-7700',
    name: 'Coupling Guard',
    location: 'Over the coupling',
    color: '#e0b134',
    position: [-0.08, 0.52, 0],
    shapes: [
      { kind: 'box', size: [0.34, 0.04, 0.36], position: [0, 0.1, 0] },
      { kind: 'box', size: [0.34, 0.18, 0.03], position: [0, 0.01, 0.16] },
      { kind: 'box', size: [0.34, 0.18, 0.03], position: [0, 0.01, -0.16] },
    ],
  },
  {
    id: 'pump',
    partNo: 'PMP-4400',
    name: 'Pump Housing',
    location: 'Right side of skid',
    color: '#1f6f78',
    position: [0.5, 0.4, 0],
    shapes: [
      { kind: 'box', size: [0.5, 0.46, 0.46] },
      { kind: 'cylinder', radius: 0.18, height: 0.16, position: [0, 0, 0.28], rotation: alongZ },
      { kind: 'box', size: [0.22, 0.1, 0.2], position: [0.05, -0.26, 0], color: '#185860' },
    ],
  },
  {
    id: 'impeller',
    partNo: 'IMP-4412',
    name: 'Impeller',
    location: 'Front of pump housing',
    color: '#a33d3d',
    position: [0.5, 0.4, 0.48],
    shapes: [{ kind: 'cylinder', radius: 0.13, height: 0.045, rotation: alongZ }],
  },
  {
    id: 'inlet',
    partNo: 'FLG-5010',
    name: 'Inlet Flange',
    location: 'Pump suction, front',
    color: '#7e8b98',
    position: [0.5, 0.4, 0.64],
    shapes: [
      { kind: 'cylinder', radius: 0.06, height: 0.28, rotation: alongZ },
      {
        kind: 'cylinder',
        radius: 0.13,
        height: 0.035,
        position: [0, 0, 0.15],
        rotation: alongZ,
      },
    ],
  },
  {
    id: 'outlet',
    partNo: 'FLG-5020',
    name: 'Outlet Flange',
    location: 'Pump discharge, top',
    color: '#8d99a6',
    position: [0.5, 0.78, 0],
    shapes: [
      { kind: 'cylinder', radius: 0.06, height: 0.34 },
      { kind: 'cylinder', radius: 0.13, height: 0.035, position: [0, 0.18, 0] },
    ],
  },
  {
    id: 'plate',
    partNo: 'NPL-0100',
    name: 'Nameplate',
    location: 'Front edge of base',
    color: '#f3ead2',
    position: [-0.2, 0.19, 0.64],
    shapes: [{ kind: 'box', size: [0.34, 0.16, 0.02] }],
  },
  bolt('bolt-fl', 'Front-left corner', [-1.15, 0.145, 0.48]),
  bolt('bolt-fr', 'Front-right corner', [1.15, 0.145, 0.48]),
  bolt('bolt-rl', 'Rear-left corner', [-1.15, 0.145, -0.48]),
  bolt('bolt-rr', 'Rear-right corner', [1.15, 0.145, -0.48]),
]

function bolt(id: string, location: string, position: Vec3): MeshPart {
  return {
    id,
    partNo: 'BLT-M12',
    name: 'Hex Bolt M12',
    location,
    color: '#8d8478',
    position,
    shapes: [
      { kind: 'cylinder', radius: 0.035, height: 0.07 },
      { kind: 'cylinder', radius: 0.055, height: 0.02, position: [0, 0.04, 0], color: '#6f675e' },
    ],
  }
}

export const components: ComponentSlot[] = parts.map((part) => ({
  id: part.id,
  label: part.name,
  location: part.location,
  color: part.color,
  position: part.position,
  rotation: part.rotation,
  shapes: part.shapes,
}))

export const sampleEquipment: EquipmentRecord = {
  id: 'cps-100',
  model: equipment.model,
  name: equipment.name,
  assemblyNo: equipment.assemblyNo,
  revision: equipment.revision,
  description: 'Sample cooling pump skid. Edit the part list from registration.',
  modelFileName: '',
  parts: parts.map((part) => ({
    id: part.id,
    partNo: part.partNo,
    name: part.name,
    drawingNo: '',
    quantity: '1',
    revision: '',
    location: part.location,
    componentId: part.id,
  })),
}

export function componentById(id: string): ComponentSlot | undefined {
  return components.find((slot) => slot.id === id)
}
