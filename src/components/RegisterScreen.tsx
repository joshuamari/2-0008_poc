import { Canvas } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { componentById, components as sampleComponents } from '../data/assembly'
import { readGlbComponents, type GlbComponent } from '../lib/glb'
import { deleteModel, saveModel, useStoredModel } from '../lib/models'
import {
  blankPart,
  cleanEquipment,
  fromSample,
  previewParts,
  validateEquipment,
} from '../lib/registry'
import type { BomLine, EquipmentRecord, ViewApi } from '../types'
import AssemblyScene from './AssemblyScene'
import GlbScene from './GlbScene'

type Props = {
  initial: EquipmentRecord
  title: string
  onCancel: () => void
  onSave: (record: EquipmentRecord) => void
}

const MODEL_LIMIT = 80 * 1024 * 1024

export default function RegisterScreen({ initial, title, onCancel, onSave }: Props) {
  const [draft, setDraft] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [modelMessage, setModelMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [activePartId, setActivePartId] = useState<string | null>(draft.parts[0]?.id ?? null)
  const [modelFile, setModelFile] = useState<File | null>(null)
  const [modelFileUrl, setModelFileUrl] = useState<string | null>(null)
  const [localComponents, setLocalComponents] = useState<GlbComponent[]>([])
  const [modelRemoved, setModelRemoved] = useState(false)
  const [readyUrl, setReadyUrl] = useState<string | null>(null)
  const [highlightComponentId, setHighlightComponentId] = useState<string | null>(null)
  const apiRef = useRef<ViewApi | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const stored = useStoredModel(initial.id, modelRemoved ? '' : (initial.modelFileName ?? ''))
  const preview = useMemo(() => previewParts(draft), [draft])
  const activePart = draft.parts.find((part) => part.id === activePartId)
  const taken = new Set(draft.parts.map((part) => part.componentId).filter(Boolean))
  const usingModel = Boolean(modelFile) || (Boolean(initial.modelFileName) && !modelRemoved)
  const glbComponents = modelFile ? localComponents : modelRemoved ? [] : stored.components
  const modelUrl = modelFile ? modelFileUrl : modelRemoved ? null : stored.url
  const modelName = modelFile?.name ?? (modelRemoved ? '' : (initial.modelFileName ?? ''))
  const slots = usingModel
    ? glbComponents.map((component) => ({ id: component.id, label: component.label }))
    : sampleComponents.map((slot) => ({ id: slot.id, label: slot.label }))
  const displayModelMessage = modelMessage || (!modelFile && !modelRemoved ? stored.error : null)
  const showLoading = !displayModelMessage && usingModel && (!modelUrl || readyUrl !== modelUrl)

  useEffect(() => {
    if (!modelFile) return
    const url = URL.createObjectURL(modelFile)
    setModelFileUrl(url)
    return () => {
      URL.revokeObjectURL(url)
      setModelFileUrl(null)
    }
  }, [modelFile])

  const updatePart = (id: string, patch: Partial<BomLine>) => {
    setError(null)
    setDraft((current) => ({
      ...current,
      parts: current.parts.map((part) => (part.id === id ? { ...part, ...patch } : part)),
    }))
  }

  const linkComponent = (partId: string, componentId: string) => {
    const slot = componentById(componentId)
    const part = draft.parts.find((item) => item.id === partId)
    updatePart(partId, {
      componentId,
      ...(slot && part && !part.location.trim() ? { location: slot.location } : {}),
    })
  }

  const clearModel = () => {
    setModelFile(null)
    setLocalComponents([])
    setModelRemoved(true)
    setModelMessage(null)
    setDraft((current) => ({
      ...current,
      modelFileName: '',
      parts: current.parts.map((part) => ({ ...part, componentId: '' })),
    }))
  }

  const onModelFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.glb')) {
      setModelMessage('Choose a .glb file.')
      return
    }
    if (file.size > MODEL_LIMIT) {
      setModelMessage('Choose a GLB smaller than 80 MB.')
      return
    }
    try {
      const components = readGlbComponents(await file.arrayBuffer())
      if (components.length === 0) {
        setModelMessage('This GLB has no mesh parts to link.')
        return
      }
      const created = partsForComponents(components)
      setModelMessage(null)
      setModelFile(file)
      setLocalComponents(components)
      setModelRemoved(false)
      setActivePartId(created[0]?.id ?? null)
      setHighlightComponentId(created[0]?.componentId ?? null)
      setDraft((current) => ({
        ...current,
        modelFileName: file.name,
        parts: created,
      }))
    } catch (reason) {
      setModelMessage(reason instanceof Error ? reason.message : 'That file could not be read as a GLB.')
    }
  }

  const useFileParts = () => {
    const created = partsForComponents(glbComponents)
    if (created.length === 0) return
    setActivePartId(created[0].id)
    setHighlightComponentId(created[0].componentId)
    setDraft((current) => ({ ...current, parts: created }))
  }

  const submit = async () => {
    if (saving) return
    const cleaned = cleanEquipment(draft)
    const message = validateEquipment(cleaned)
    if (message) {
      setError(message)
      return
    }
    setSaving(true)
    try {
      if (modelFile) await saveModel(cleaned.id, modelFile)
      else if (modelRemoved && initial.modelFileName) await deleteModel(cleaned.id)
      onSave(cleaned)
    } catch {
      setError('The model could not be saved in this browser.')
      setSaving(false)
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <p className="brand-code">2-0008</p>
          <h1>{title}</h1>
        </div>
        <div className="top-actions">
          <button type="button" className="btn btn-dark" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </header>
      <div className="register-layout">
        <form
          className="register-form"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <section className="form-card">
            <p className="kicker">Equipment</p>
            <div className="form-grid">
              <label className="field">
                <span>Equipment name</span>
                <input
                  value={draft.name}
                  onChange={(event) => {
                    const value = event.target.value
                    setDraft((current) => ({ ...current, name: value }))
                  }}
                  required
                />
              </label>
              <label className="field">
                <span>Model</span>
                <input
                  value={draft.model}
                  onChange={(event) => {
                    const value = event.target.value
                    setDraft((current) => ({ ...current, model: value }))
                  }}
                />
              </label>
              <label className="field">
                <span>Assembly no.</span>
                <input
                  value={draft.assemblyNo}
                  onChange={(event) => {
                    const value = event.target.value
                    setDraft((current) => ({ ...current, assemblyNo: value }))
                  }}
                />
              </label>
              <label className="field">
                <span>Revision</span>
                <input
                  value={draft.revision}
                  onChange={(event) => {
                    const value = event.target.value
                    setDraft((current) => ({ ...current, revision: value }))
                  }}
                />
              </label>
              <label className="field wide">
                <span>Description</span>
                <textarea
                  rows={3}
                  value={draft.description}
                  onChange={(event) => {
                    const value = event.target.value
                    setDraft((current) => ({ ...current, description: value }))
                  }}
                />
              </label>
              <div className="field wide">
                <span>3D model</span>
                <div className="model-file">
                  <input
                    ref={fileRef}
                    className="sr-only"
                    type="file"
                    accept=".glb,model/gltf-binary"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      event.target.value = ''
                      if (file) void onModelFile(file)
                    }}
                  />
                  <button type="button" className="btn btn-line" onClick={() => fileRef.current?.click()}>
                    {modelName ? 'Replace GLB' : 'Upload GLB'}
                  </button>
                  {modelName && (
                    <button type="button" className="btn btn-ghost" onClick={clearModel}>
                      Remove
                    </button>
                  )}
                  <p>
                    {modelName
                      ? modelName
                      : 'Upload a GLB to list the parts in that file. The sample skid is used until you upload one.'}
                  </p>
                </div>
                {glbComponents.length > 0 && (
                  <div className="model-parts">
                    <p className="kicker">{partCountLabel(glbComponents.length)} in this file</p>
                    <p className="model-parts-note">
                      The file has no part names or drawing numbers. Each row is one mesh. Click a row to highlight it.
                    </p>
                    <ul>
                      {glbComponents.map((component, index) => {
                        const linked = draft.parts.find((part) => part.componentId === component.id)
                        const selected = highlightComponentId
                          ? highlightComponentId === component.id
                          : linked?.id === activePartId
                        return (
                          <li key={component.id}>
                            <button
                              type="button"
                              className={selected ? 'model-part is-selected' : 'model-part'}
                              onClick={() => {
                                setHighlightComponentId(component.id)
                                if (linked) setActivePartId(linked.id)
                              }}
                            >
                              <span className="model-part-index">{index + 1}</span>
                              <span>{component.label}</span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
                {displayModelMessage && <p className="form-error">{displayModelMessage}</p>}
              </div>
            </div>
          </section>

          <section className="form-card">
            <div className="page-head">
              <div>
                <p className="kicker">Parts</p>
                <p className="lead">
                  {glbComponents.length > 0
                    ? `${partCountLabel(glbComponents.length)} came from the file. Rename one if you know a better name. Drawing number and revision can stay blank.`
                    : 'Select a part row, then choose its 3D component or click that component on the model.'}
                </p>
              </div>
              <div className="registry-actions">
                {glbComponents.length > 0 && (
                  <button type="button" className="btn btn-line" onClick={useFileParts}>
                    Reset parts from file
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-line"
                  onClick={() => {
                    const sample = fromSample()
                    setDraft({ ...sample, id: draft.id })
                    setActivePartId(sample.parts[0]?.id ?? null)
                    setModelFile(null)
                    setLocalComponents([])
                    setModelRemoved(true)
                    setModelMessage(null)
                  }}
                >
                  Fill from sample skid
                </button>
              </div>
            </div>
            <div className="part-list">
              {draft.parts.map((part, index) => (
                <article
                  key={part.id}
                  className={part.id === activePartId ? 'part-card is-active' : 'part-card'}
                  onClick={() => {
                    setActivePartId(part.id)
                    setHighlightComponentId(part.componentId || null)
                  }}
                  onFocus={() => {
                    setActivePartId(part.id)
                    setHighlightComponentId(part.componentId || null)
                  }}
                >
                  <div className="part-card-head">
                    <p className="kicker">Part {index + 1}</p>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          parts: current.parts.filter((item) => item.id !== part.id),
                        }))
                      }
                    >
                      Remove
                    </button>
                  </div>
                  <div className="part-grid">
                    <label className="field">
                      <span>Part no.</span>
                      <input value={part.partNo} onChange={(event) => updatePart(part.id, { partNo: event.target.value })} />
                    </label>
                    <label className="field">
                      <span>Part name</span>
                      <input value={part.name} onChange={(event) => updatePart(part.id, { name: event.target.value })} />
                    </label>
                    <label className="field">
                      <span>Drawing no.</span>
                      <input
                        value={part.drawingNo}
                        onChange={(event) => updatePart(part.id, { drawingNo: event.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span>Quantity</span>
                      <input
                        value={part.quantity}
                        onChange={(event) => updatePart(part.id, { quantity: event.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span>Revision</span>
                      <input
                        value={part.revision}
                        onChange={(event) => updatePart(part.id, { revision: event.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span>Location</span>
                      <input
                        value={part.location}
                        onChange={(event) => updatePart(part.id, { location: event.target.value })}
                      />
                    </label>
                    <label className="field wide">
                      <span>3D component</span>
                      <select
                        value={part.componentId}
                        onChange={(event) => linkComponent(part.id, event.target.value)}
                      >
                        <option value="">Not linked</option>
                        {slots.map((slot) => (
                          <option
                            key={slot.id}
                            value={slot.id}
                            disabled={taken.has(slot.id) && slot.id !== part.componentId}
                          >
                            {slot.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </article>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-line"
              onClick={() => {
                const part = blankPart()
                setActivePartId(part.id)
                setDraft((current) => ({ ...current, parts: [...current.parts, part] }))
              }}
            >
              Add part
            </button>
          </section>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save assembly'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </form>

        <section className="stage register-stage" aria-label={usingModel ? 'Uploaded model' : 'Sample model'}>
          {(modelName || showLoading || displayModelMessage) && (
            <div className="stage-status">
              {modelName && <p>{modelName}</p>}
              {glbComponents.length > 0 && <p>{partCountLabel(glbComponents.length)}</p>}
              {showLoading && <p>Loading model…</p>}
              {displayModelMessage && <p>{displayModelMessage}</p>}
            </div>
          )}
          <Canvas
            key={usingModel ? 'glb' : 'sample'}
            shadows
            camera={
              usingModel
                ? { position: [2.05, 1.55, 2.35], fov: 42, near: 0.01, far: 100000 }
                : { position: [2.05, 1.55, 2.35], fov: 42 }
            }
            onPointerMissed={() => {
              document.body.style.cursor = 'default'
            }}
          >
            {modelUrl ? (
              <GlbScene
                url={modelUrl}
                components={glbComponents}
                selectedId={highlightComponentId || activePart?.componentId || null}
                candidateIds={[]}
                followSelection={false}
                onSelect={(slotId) => {
                  const linkedPart = draft.parts.find((part) => part.componentId === slotId)
                  if (linkedPart) {
                    setActivePartId(linkedPart.id)
                    setHighlightComponentId(slotId)
                    return
                  }
                  setHighlightComponentId(slotId)
                  if (!activePartId) return
                  if (taken.has(slotId) && activePart?.componentId !== slotId) return
                  linkComponent(activePartId, slotId)
                }}
                onReady={() => setReadyUrl(modelUrl)}
                onError={(message) => setModelMessage(message)}
                apiRef={apiRef}
              />
            ) : usingModel ? (
              <color attach="background" args={['#d7d0c4']} />
            ) : (
              <AssemblyScene
                parts={preview}
                selectedId={activePart?.componentId || null}
                candidateIds={[]}
                followSelection={false}
                onSelect={(slotId) => {
                  if (!activePartId) return
                  if (taken.has(slotId) && activePart?.componentId !== slotId) return
                  linkComponent(activePartId, slotId)
                }}
                apiRef={apiRef}
              />
            )}
          </Canvas>
          <div className="toolbar">
            <button type="button" className="btn btn-tool" onClick={() => apiRef.current?.zoomOut()}>
              Zoom out
            </button>
            <button type="button" className="btn btn-tool" onClick={() => apiRef.current?.zoomIn()}>
              Zoom in
            </button>
            <button type="button" className="btn btn-tool" onClick={() => apiRef.current?.reset()}>
              Reset view
            </button>
            <p>Click a component to link the selected part row.</p>
          </div>
        </section>
      </div>
    </>
  )
}

function partsForComponents(components: GlbComponent[]): BomLine[] {
  return components.map((component, index) => ({
    ...blankPart(),
    partNo: component.label,
    name: `Part ${index + 1}`,
    componentId: component.id,
  }))
}

function partCountLabel(count: number): string {
  return `${count} part${count === 1 ? '' : 's'}`
}
