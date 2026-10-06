import { useGLTF } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { Component, Suspense, useLayoutEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from 'react'
import type { GlbComponent } from '../lib/glb'
import type { Vec3, ViewApi } from '../types'
import ViewRig, { type CameraFrame } from './ViewRig'
import * as THREE from 'three'

type Props = {
  url: string
  components: GlbComponent[]
  selectedId: string | null
  candidateIds: string[]
  onSelect: (id: string) => void
  apiRef: MutableRefObject<ViewApi | null>
  followSelection?: boolean
  onReady?: () => void
  onError?: (message: string) => void
}

const SELECTED = new THREE.Color('#f2c14d')
const SELECTED_EMISSIVE = new THREE.Color('#c98410')
const HOT_EMISSIVE = new THREE.Color('#d7a21a')

type PaintMode = 'selected' | 'hot' | 'dim' | 'plain'

type BaseState = {
  color: number
  emissive: number
  emissiveIntensity: number
  opacity: number
  transparent: boolean
  depthWrite: boolean
}

const bases = new WeakMap<THREE.Material, BaseState>()

type LoadedGltf = {
  scene: THREE.Group
  parser: {
    associations: Map<THREE.Object3D | THREE.Material | THREE.Texture, { nodes?: number }>
  }
}

export default function GlbScene({ url, onError, ...props }: Props) {
  return (
    <ModelErrorBoundary resetKey={url} onError={onError}>
      <Suspense fallback={<StageWash />}>
        <GlbModel url={url} {...props} />
      </Suspense>
    </ModelErrorBoundary>
  )
}

function GlbModel({
  url,
  components,
  selectedId,
  candidateIds,
  onSelect,
  apiRef,
  followSelection = true,
  onReady,
}: Omit<Props, 'onError'>) {
  const gltf = useGLTF(url) as LoadedGltf
  const scene = useMemo(() => cloneTaggedScene(gltf, components), [gltf, components])
  const layout = useMemo(() => layoutScene(scene), [scene])
  const aim = useMemo(() => (followSelection ? focusOn(scene, selectedId) : null), [scene, selectedId, followSelection])
  const hotKey = candidateIds.join('\0')
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady

  useLayoutEffect(() => {
    const created: THREE.Material[] = []
    const restore: { mesh: THREE.Mesh; material: THREE.Material | THREE.Material[] }[] = []
    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      obj.castShadow = true
      obj.receiveShadow = true
      const list = Array.isArray(obj.material) ? obj.material : [obj.material]
      restore.push({ mesh: obj, material: obj.material })
      const clones = list.map((material) => {
        const clone = material.clone()
        clone.side = THREE.DoubleSide
        created.push(clone)
        return clone
      })
      obj.material = clones.length === 1 ? clones[0] : clones
    })
    return () => {
      for (const item of restore) item.mesh.material = item.material
      for (const material of created) material.dispose()
    }
  }, [scene])

  useLayoutEffect(() => {
    const hot = new Set(hotKey ? hotKey.split('\0') : [])
    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      const id = typeof obj.userData.componentId === 'string' ? obj.userData.componentId : ''
      const mode: PaintMode = !selectedId ? (hot.has(id) ? 'hot' : 'plain') : id === selectedId ? 'selected' : 'dim'
      const list = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const material of list) paintMaterial(material, mode)
    })
  }, [scene, selectedId, hotKey])

  useLayoutEffect(() => {
    onReadyRef.current?.()
  }, [scene])

  useLayoutEffect(() => {
    return () => {
      useGLTF.clear(url)
    }
  }, [url])

  return (
    <>
      <StageWash />
      <gridHelper args={[layout.span, 16, '#b7ad9e', '#e3dcd0']} position={layout.floor} />
      <directionalLight
        position={[layout.span, layout.span * 1.4, layout.span]}
        intensity={1.45}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={layout.span * 0.01}
        shadow-camera-far={layout.span * 8}
        shadow-camera-left={-layout.span}
        shadow-camera-right={layout.span}
        shadow-camera-top={layout.span}
        shadow-camera-bottom={-layout.span}
      />
      <primitive
        object={scene}
        onClick={(event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation()
          const id = componentIdFrom(event.object)
          if (id) onSelect(id)
        }}
        onPointerOver={(event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation()
          if (componentIdFrom(event.object)) document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'default'
        }}
      />
      <ViewRig
        apiRef={apiRef}
        frame={layout.frame}
        focus={aim?.point ?? null}
        focusOffset={aim?.offset}
        maxPolarAngle={Math.PI - 0.08}
      />
    </>
  )
}

function StageWash() {
  return (
    <>
      <color attach="background" args={['#d7d0c4']} />
      <hemisphereLight args={['#f4efe4', '#8d8478', 0.85]} />
      <ambientLight intensity={0.35} />
    </>
  )
}

function cloneTaggedScene(gltf: LoadedGltf, components: GlbComponent[]): THREE.Group {
  const targets = resolveTargets(gltf, components)
  const idByUuid = new Map<string, string>()
  for (const target of targets) {
    target.object?.traverse((obj) => {
      idByUuid.set(obj.uuid, target.id)
    })
  }
  const clone = gltf.scene.clone(true)
  walkPair(gltf.scene, clone, (source, copy) => {
    const id = idByUuid.get(source.uuid)
    if (id) copy.userData.componentId = id
  })
  return clone
}

function resolveTargets(gltf: LoadedGltf, components: GlbComponent[]) {
  const byNode = new Map<number, THREE.Object3D>()
  gltf.parser.associations.forEach((assoc, object) => {
    if (typeof assoc.nodes !== 'number' || !(object instanceof THREE.Object3D)) return
    const current = byNode.get(assoc.nodes)
    if (!current || depth(object) < depth(current)) byNode.set(assoc.nodes, object)
  })
  return components.map((component) => {
    let object = byNode.get(component.nodeIndex) ?? null
    if (!object) {
      gltf.scene.traverse((candidate) => {
        if (!object && candidate.name === component.label) object = candidate
      })
    }
    return { ...component, object }
  })
}

function layoutScene(scene: THREE.Object3D): { frame: CameraFrame; floor: Vec3; span: number } {
  const box = new THREE.Box3().setFromObject(scene)
  if (box.isEmpty()) {
    return {
      frame: { position: [2.05, 1.55, 2.35], target: [0.1, 0.32, 0], minDistance: 0.45, maxDistance: 8 },
      floor: [0, 0, 0],
      span: 8,
    }
  }
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const radius = Math.max(size.length() * 0.5, 0.001)
  const fov = (42 * Math.PI) / 180
  const distance = (radius / Math.sin(fov / 2)) * 1.25
  const position = center.clone().add(new THREE.Vector3(1, 0.7, 1).normalize().multiplyScalar(distance))
  const span = Math.max(size.x, size.y, size.z, 1) * 2.4
  const floorY = box.min.y - Math.max(size.y * 0.18, span * 0.008)
  return {
    frame: {
      position: position.toArray() as Vec3,
      target: center.toArray() as Vec3,
      minDistance: Math.max(radius * 0.04, 0.001),
      maxDistance: distance * 8,
    },
    floor: [center.x, floorY, center.z],
    span,
  }
}

function focusOn(scene: THREE.Object3D, selectedId: string | null): { point: Vec3; offset: Vec3 } | null {
  if (!selectedId) return null
  let found: THREE.Object3D | null = null
  scene.traverse((obj) => {
    if (!found && obj.userData.componentId === selectedId) found = obj
  })
  if (!found) return null
  const box = new THREE.Box3().setFromObject(found)
  if (box.isEmpty()) return null
  const center = box.getCenter(new THREE.Vector3())
  const radius = Math.max(box.getSize(new THREE.Vector3()).length() * 0.5, 0.05)
  const sceneBox = new THREE.Box3().setFromObject(scene)
  const sceneSize = sceneBox.getSize(new THREE.Vector3())
  const sitsLow = box.max.y < sceneBox.min.y + sceneSize.y * 0.28
  const offset = (sitsLow ? new THREE.Vector3(0.35, -1, 0.55) : new THREE.Vector3(1, 0.72, 1))
    .normalize()
    .multiplyScalar(radius * (sitsLow ? 3.2 : 2.4))
  if (sitsLow) {
    const span = Math.max(sceneSize.x, sceneSize.y, sceneSize.z, 1) * 2.4
    const floorY = sceneBox.min.y - Math.max(sceneSize.y * 0.18, span * 0.008)
    const minCamY = floorY + Math.max(sceneSize.y * 0.04, 0.02)
    if (center.y + offset.y < minCamY) offset.y = minCamY - center.y
  }
  return { point: center.toArray() as Vec3, offset: offset.toArray() as Vec3 }
}

function paintMaterial(material: THREE.Material, mode: PaintMode) {
  const standard = (material as THREE.MeshStandardMaterial).isMeshStandardMaterial
    ? (material as THREE.MeshStandardMaterial)
    : null
  if (!bases.has(material)) {
    bases.set(material, {
      color: standard ? standard.color.getHex() : 0xffffff,
      emissive: standard ? standard.emissive.getHex() : 0,
      emissiveIntensity: standard ? standard.emissiveIntensity : 0,
      opacity: material.opacity,
      transparent: material.transparent,
      depthWrite: material.depthWrite,
    })
  }
  const base = bases.get(material)
  if (!base) return
  if (standard) {
    if (mode === 'selected') {
      standard.color.copy(SELECTED)
      standard.emissive.copy(SELECTED_EMISSIVE)
      standard.emissiveIntensity = 0.5
    } else if (mode === 'hot') {
      standard.color.setHex(base.color)
      standard.emissive.copy(HOT_EMISSIVE)
      standard.emissiveIntensity = 0.28
    } else {
      standard.color.setHex(base.color)
      standard.emissive.setHex(base.emissive)
      standard.emissiveIntensity = base.emissiveIntensity
    }
  }
  const dim = mode === 'dim'
  material.transparent = dim || base.transparent
  material.opacity = dim ? 0.42 : base.opacity
  material.depthWrite = dim ? false : base.depthWrite
  material.needsUpdate = true
}

function componentIdFrom(object: THREE.Object3D): string | null {
  let current: THREE.Object3D | null = object
  while (current) {
    if (typeof current.userData.componentId === 'string') return current.userData.componentId
    current = current.parent
  }
  return null
}

function walkPair(source: THREE.Object3D, copy: THREE.Object3D, visit: (source: THREE.Object3D, copy: THREE.Object3D) => void) {
  visit(source, copy)
  const count = Math.min(source.children.length, copy.children.length)
  for (let index = 0; index < count; index += 1) walkPair(source.children[index], copy.children[index], visit)
}

function depth(object: THREE.Object3D): number {
  let count = 0
  let current: THREE.Object3D | null = object
  while (current) {
    count += 1
    current = current.parent
  }
  return count
}

type BoundaryProps = {
  resetKey: string
  onError?: (message: string) => void
  children: ReactNode
}

type BoundaryState = { error: boolean }

class ModelErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: false }

  static getDerivedStateFromError(): BoundaryState {
    return { error: true }
  }

  componentDidUpdate(prev: BoundaryProps) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: false })
  }

  componentDidCatch(error: unknown) {
    this.props.onError?.(error instanceof Error ? error.message : 'This GLB could not be displayed.')
  }

  render() {
    if (this.state.error) return <StageWash />
    return this.props.children
  }
}
