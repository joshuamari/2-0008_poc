import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef, type ElementRef, type MutableRefObject } from 'react'
import type { Part, Shape, Vec3, ViewApi } from '../types'
import * as THREE from 'three'

const INITIAL_POSITION: Vec3 = [2.05, 1.55, 2.35]
const INITIAL_TARGET: Vec3 = [0.1, 0.32, 0]
const FOCUS_OFFSET = new THREE.Vector3(0.85, 0.62, 0.9)

type Props = {
  parts: Part[]
  selectedId: string | null
  candidateIds: string[]
  onSelect: (id: string) => void
  apiRef: MutableRefObject<ViewApi | null>
}

export default function AssemblyScene({ parts, selectedId, candidateIds, onSelect, apiRef }: Props) {
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#cfc6b8" />
      </mesh>
      <gridHelper args={[8, 16, '#b7ad9e', '#e3dcd0']} position={[0, 0.002, 0]} />
      {parts.map((part) => (
        <PartGroup
          key={part.id}
          part={part}
          selected={part.id === selectedId}
          hot={selectedId === null && candidateIds.includes(part.id)}
          dimmed={selectedId !== null && part.id !== selectedId}
          onSelect={onSelect}
        />
      ))}
      <ViewRig apiRef={apiRef} focus={parts.find((part) => part.id === selectedId)?.position ?? null} />
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

function ViewRig({
  apiRef,
  focus,
}: {
  apiRef: MutableRefObject<ViewApi | null>
  focus: Vec3 | null
}) {
  const controls = useRef<ElementRef<typeof OrbitControls>>(null)
  const camera = useThree((state) => state.camera)
  const desiredTarget = useRef(new THREE.Vector3(...INITIAL_TARGET))
  const desiredCamera = useRef(new THREE.Vector3(...INITIAL_POSITION))
  const focusUntil = useRef(0)

  useLayoutEffect(() => {
    const zoomBy = (scale: number) => {
      const orbit = controls.current
      if (!orbit) return
      focusUntil.current = 0
      const offset = camera.position.clone().sub(orbit.target)
      const next = THREE.MathUtils.clamp(offset.length() * scale, 0.45, 8)
      offset.setLength(next)
      camera.position.copy(orbit.target).add(offset)
      orbit.update()
    }
    const reset = () => {
      const orbit = controls.current
      if (!orbit) return
      focusUntil.current = 0
      camera.position.set(...INITIAL_POSITION)
      orbit.target.set(...INITIAL_TARGET)
      orbit.update()
    }
    apiRef.current = {
      zoomIn: () => zoomBy(0.82),
      zoomOut: () => zoomBy(1.22),
      reset,
    }
  })

  useLayoutEffect(() => {
    if (!focus) return
    desiredTarget.current.set(...focus)
    desiredCamera.current.set(...focus).add(FOCUS_OFFSET)
    focusUntil.current = performance.now() + 900
  }, [focus])

  useFrame(() => {
    const orbit = controls.current
    if (!orbit || performance.now() > focusUntil.current) return
    orbit.target.lerp(desiredTarget.current, 0.16)
    camera.position.lerp(desiredCamera.current, 0.16)
    orbit.update()
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      enablePan
      minDistance={0.45}
      maxDistance={8}
      minPolarAngle={0.2}
      maxPolarAngle={Math.PI / 2.08}
      target={INITIAL_TARGET}
    />
  )
}
