import { Canvas } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { componentById, components } from '../data/assembly'
import {
  blankPart,
  cleanEquipment,
  fromSample,
  previewParts,
  validateEquipment,
} from '../lib/registry'
import type { BomLine, EquipmentRecord, ViewApi } from '../types'
import AssemblyScene from './AssemblyScene'

type Props = {
  initial: EquipmentRecord
  title: string
  onCancel: () => void
  onSave: (record: EquipmentRecord) => void
}

export default function RegisterScreen({ initial, title, onCancel, onSave }: Props) {
  const [draft, setDraft] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [activePartId, setActivePartId] = useState<string | null>(draft.parts[0]?.id ?? null)
  const apiRef = useRef<ViewApi | null>(null)
  const preview = useMemo(() => previewParts(draft), [draft])
  const activePart = draft.parts.find((part) => part.id === activePartId)
  const taken = new Set(draft.parts.map((part) => part.componentId).filter(Boolean))

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
      location: part && !part.location.trim() && slot ? slot.location : part?.location,
    })
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
            const cleaned = cleanEquipment(draft)
            const message = validateEquipment(cleaned)
            if (message) {
              setError(message)
              return
            }
            onSave(cleaned)
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
            </div>
          </section>

          <section className="form-card">
            <div className="page-head">
              <div>
                <p className="kicker">Parts</p>
                <p className="lead">
                  Select a part row, then choose its 3D component or click that component on the model.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-line"
                onClick={() => {
                  const sample = fromSample()
                  setDraft({ ...sample, id: draft.id })
                  setActivePartId(sample.parts[0]?.id ?? null)
                }}
              >
                Fill from sample skid
              </button>
            </div>
            <div className="part-list">
              {draft.parts.map((part, index) => (
                <article
                  key={part.id}
                  className={part.id === activePartId ? 'part-card is-active' : 'part-card'}
                  onFocus={() => setActivePartId(part.id)}
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
                        {components.map((slot) => (
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
            <button type="submit" className="btn btn-primary">
              Save assembly
            </button>
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </form>

        <section className="stage register-stage" aria-label="Sample model">
          <Canvas
            shadows
            camera={{ position: [2.05, 1.55, 2.35], fov: 42 }}
            onPointerMissed={() => {
              document.body.style.cursor = 'default'
            }}
          >
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
