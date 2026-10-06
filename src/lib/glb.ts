export type GlbComponent = {
  id: string
  label: string
  nodeIndex: number
}

type GlbNode = {
  name?: string
  mesh?: number
  children?: number[]
}

type GlbJson = {
  scene?: number
  scenes?: { nodes?: number[] }[]
  nodes?: GlbNode[]
}

export function readGlbComponents(buffer: ArrayBuffer): GlbComponent[] {
  const json = readGlbJson(buffer)
  const nodes = json.nodes ?? []
  const sceneIndex = json.scene ?? 0
  const roots = json.scenes?.[sceneIndex]?.nodes ?? []
  const seen = new Set<number>()
  const nameCount = new Map<string, number>()
  const components: GlbComponent[] = []

  const visit = (index: number) => {
    if (seen.has(index)) return
    seen.add(index)
    const node = nodes[index]
    if (!node) return
    if (node.mesh !== undefined) {
      const base = node.name?.trim() || `Component ${index + 1}`
      const count = (nameCount.get(base) ?? 0) + 1
      nameCount.set(base, count)
      const label = count === 1 ? base : `${base} (${count})`
      components.push({ id: label, label, nodeIndex: index })
    }
    for (const child of node.children ?? []) visit(child)
  }

  for (const root of roots) visit(root)
  return components
}

function readGlbJson(buffer: ArrayBuffer): GlbJson {
  if (buffer.byteLength < 20) throw new Error('That file is not a GLB.')
  const view = new DataView(buffer)
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))
  if (magic !== 'glTF') throw new Error('That file is not a GLB.')
  if (view.getUint32(4, true) !== 2) throw new Error('Only GLB version 2 is supported.')
  const chunkLength = view.getUint32(12, true)
  const chunkType = view.getUint32(16, true)
  if (chunkType !== 0x4e4f534a || 20 + chunkLength > buffer.byteLength) {
    throw new Error('That GLB is missing its JSON data.')
  }
  try {
    return JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, chunkLength))) as GlbJson
  } catch {
    throw new Error('That GLB could not be read.')
  }
}
