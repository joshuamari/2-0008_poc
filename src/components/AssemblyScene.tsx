import { type MutableRefObject } from 'react'
import type { Part, Shape, ViewApi } from '../types'
import ViewRig from './ViewRig'

type Props = {
  parts: Part[]
  selectedId: string | null
  candidateIds: string[]
  onSelect: (id: string) => void
  apiRef: MutableRefObject<ViewApi | null>
  followSelection?: boolean
}

export default function AssemblyScene({
  parts,
  selectedId,
  candidateIds,
  onSelect,
  apiRef,
  followSelection = true,
}: Props) {
  return (
    <>
      <color attach="background" args={['#d7d0c4']} />
      <hemisphereLight args={['#f4efe4', '#8d8478', 0.85]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[5, 8, 4]}
        intensity={1.45}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={20}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
      />
      <gridHelper args={[8, 16, '#b7ad9e', '#e3dcd0']} position={[0, 0, 0]} />
      {parts.filter((part) => part.shapes.length > 0).map((part) => (
        <PartGroup
          key={part.id}
          part={part}
          selected={part.id === selectedId}
          hot={selectedId === null && candidateIds.includes(part.id)}
          dimmed={selectedId !== null && part.id !== selectedId}
          onSelect={onSelect}
        />
      ))}
      <ViewRig
        apiRef={apiRef}
        focus={
          followSelection
            ? (parts.find((part) => part.id === selectedId && part.shapes.length > 0)?.position ?? null)
            : null
        }
      />
    </>
  )
}

function PartGroup({
  part,
  selected,
  hot,
  dimmed,
  onSelect,
}: {
  part: Part
  selected: boolean
  hot: boolean
  dimmed: boolean
  onSelect: (id: string) => void
}) {
  return (
    <group
      position={part.position}
      rotation={part.rotation ?? [0, 0, 0]}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(part.id)
      }}
      onPointerOver={(event) => {
        event.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default'
      }}
    >
      {part.shapes.map((shape, index) => (
        <ShapeMesh key={index} shape={shape} color={part.color} selected={selected} hot={hot} dimmed={dimmed} />
      ))}
    </group>
  )
}

function ShapeMesh({
  shape,
  color,
  selected,
  hot,
  dimmed,
}: {
  shape: Shape
  color: string
  selected: boolean
  hot: boolean
  dimmed: boolean
}) {
  const position = shape.position ?? [0, 0, 0]
  const rotation = shape.rotation ?? [0, 0, 0]
  const base = shape.color ?? color
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      {shape.kind === 'box' ? (
        <boxGeometry args={shape.size} />
      ) : (
        <cylinderGeometry args={[shape.radius, shape.radius, shape.height, 28]} />
      )}
      <meshStandardMaterial
        color={selected ? '#f2c14d' : base}
        emissive={selected ? '#c98410' : hot ? '#d7a21a' : '#000000'}
        emissiveIntensity={selected ? 0.5 : hot ? 0.28 : 0}
        roughness={0.62}
        metalness={0.16}
        transparent={dimmed}
        opacity={dimmed ? 0.42 : 1}
        depthWrite={!dimmed}
      />
    </mesh>
  )
}

