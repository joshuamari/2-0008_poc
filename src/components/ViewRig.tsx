import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef, type ElementRef, type MutableRefObject } from 'react'
import type { Vec3, ViewApi } from '../types'
import * as THREE from 'three'

const FOCUS_OFFSET = new THREE.Vector3(0.85, 0.62, 0.9)

export type CameraFrame = {
  position: Vec3
  target: Vec3
  minDistance: number
  maxDistance: number
}

export const SAMPLE_FRAME: CameraFrame = {
  position: [2.05, 1.55, 2.35],
  target: [0.1, 0.32, 0],
  minDistance: 0.45,
  maxDistance: 8,
}

type Props = {
  apiRef: MutableRefObject<ViewApi | null>
  focus: Vec3 | null
  focusOffset?: Vec3
  frame?: CameraFrame
  maxPolarAngle?: number
}

export default function ViewRig({
  apiRef,
  focus,
  focusOffset,
  frame = SAMPLE_FRAME,
  maxPolarAngle = Math.PI - 0.08,
}: Props) {
  const controls = useRef<ElementRef<typeof OrbitControls>>(null)
  const camera = useThree((state) => state.camera)
  const desiredTarget = useRef(new THREE.Vector3(...frame.target))
  const desiredCamera = useRef(new THREE.Vector3(...frame.position))
  const focusUntil = useRef(0)
  const frameRef = useRef(frame)
  const appliedFrame = useRef<CameraFrame | null>(null)
  frameRef.current = frame

  useLayoutEffect(() => {
    const zoomBy = (scale: number) => {
      const orbit = controls.current
      const limits = frameRef.current
      if (!orbit) return
      focusUntil.current = 0
      const offset = camera.position.clone().sub(orbit.target)
      const next = THREE.MathUtils.clamp(offset.length() * scale, limits.minDistance, limits.maxDistance)
      offset.setLength(next)
      camera.position.copy(orbit.target).add(offset)
      orbit.update()
    }
    const reset = () => {
      const orbit = controls.current
      const home = frameRef.current
      if (!orbit) return
      focusUntil.current = 0
      camera.position.set(...home.position)
      orbit.target.set(...home.target)
      orbit.update()
    }
    apiRef.current = {
      zoomIn: () => zoomBy(0.82),
      zoomOut: () => zoomBy(1.22),
      reset,
    }
  })

  useFrame(() => {
    const orbit = controls.current
    const home = frameRef.current
    if (orbit && appliedFrame.current !== home) {
      appliedFrame.current = home
      focusUntil.current = 0
      camera.position.set(...home.position)
      orbit.target.set(...home.target)
      orbit.minDistance = home.minDistance
      orbit.maxDistance = home.maxDistance
      orbit.update()
    }
    if (orbit && home !== SAMPLE_FRAME) fitClip(camera, camera.position.distanceTo(orbit.target), home)
    if (!orbit || performance.now() > focusUntil.current) return
    orbit.target.lerp(desiredTarget.current, 0.16)
    camera.position.lerp(desiredCamera.current, 0.16)
    orbit.update()
  })

  useLayoutEffect(() => {
    if (!focus) return
    desiredTarget.current.set(...focus)
    desiredCamera.current.set(...focus).add(focusOffset ? new THREE.Vector3(...focusOffset) : FOCUS_OFFSET)
    focusUntil.current = performance.now() + 900
  }, [focus, focusOffset])

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      enablePan
      minDistance={frame.minDistance}
      maxDistance={frame.maxDistance}
      minPolarAngle={0.05}
      maxPolarAngle={maxPolarAngle}
      target={frame.target}
    />
  )
}

function fitClip(camera: THREE.Camera, distance: number, home: CameraFrame) {
  if (!(camera instanceof THREE.PerspectiveCamera)) return
  const near = Math.max(Math.min(distance / 400, home.minDistance / 5), 0.0005)
  const far = Math.max(distance * 40, home.maxDistance * 4)
  if (Math.abs(camera.near - near) < near * 0.08 && Math.abs(camera.far - far) < far * 0.08) return
  camera.near = near
  camera.far = far
  camera.updateProjectionMatrix()
}
