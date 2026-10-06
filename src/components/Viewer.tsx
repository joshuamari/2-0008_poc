import { Canvas } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { componentById } from '../data/assembly'
import { findParts } from '../lib/match'
import { useStoredModel } from '../lib/models'
import { viewParts } from '../lib/registry'
import type { EquipmentRecord, MatchResult, ViewApi } from '../types'
import AssemblyScene from './AssemblyScene'
import GlbScene from './GlbScene'
import QrDialog from './QrDialog'

const NOTES_KEY = '2-0008-notes'

type Props = {
  record: EquipmentRecord
  onBack: () => void
  onEdit: () => void
}

export default function Viewer({ record, onBack, onEdit }: Props) {
  const parts = useMemo(() => viewParts(record), [record])
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<MatchResult | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [qrOpen, setQrOpen] = useState(false)
  const [notes, setNotes] = useState<Record<string, string>>(() => readNotes())
  const [readyUrl, setReadyUrl] = useState<string | null>(null)
  const [modelMessage, setModelMessage] = useState<string | null>(null)
  const [fileSelection, setFileSelection] = useState<string | null>(null)
  const apiRef = useRef<ViewApi | null>(null)
  const stored = useStoredModel(record.id, record.modelFileName ?? '')
  const usingModel = Boolean(record.modelFileName)
  const modelUrl = stored.url
  const showLoading = usingModel && !stored.error && !modelMessage && (!modelUrl || readyUrl !== modelUrl)
  const selected = parts.find((part) => part.id === selectedId)
  const candidateIds = result?.kind === 'multiple' ? result.ids : []
  const samples = useMemo(() => qrSamples(parts), [parts])

  useEffect(() => {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes))
  }, [notes])

  const applyMatches = (raw: string) => {
    const source = raw.trim()
    const matches = findParts(parts, source)
    if (matches.length === 0) {
      setResult({ kind: 'none', source, ids: [] })
      setSelectedId(null)
      setFileSelection(null)
      return
    }
    if (matches.length === 1) {
      setResult({ kind: 'single', source, ids: [matches[0].id] })
      setSelectedId(matches[0].id)
      setFileSelection(matches[0].componentId || null)
      return
    }
    setResult({ kind: 'multiple', source, ids: matches.map((part) => part.id) })
    setSelectedId(null)
    setFileSelection(null)
  }

  const selectPart = (id: string) => {
    const part = parts.find((item) => item.id === id)
    setSelectedId(id)
    setFileSelection(part?.componentId || null)
    setResult((current) => {
      if (current?.kind === 'multiple' && current.ids.includes(id)) return current
      return { kind: 'single', source: part?.partNo ?? id, ids: [id] }
    })
  }

  const clearHighlight = () => {
    setSelectedId(null)
    setFileSelection(null)
  }

  const status = useMemo(() => {
    if (!result) return null
    if (result.kind === 'none') return `No match for “${result.source}”.`
    if (result.kind === 'single') return `Single match for “${result.source}”.`
    return `${result.ids.length} matches for “${result.source}”. Choose one.`
  }, [result])

  const linkedLabel = selected?.componentId
    ? (componentById(selected.componentId)?.label ?? selected.componentId)
    : 'Not linked'

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <p className="brand-code">2-0008</p>
          <h1>Equipment viewer</h1>
        </div>
        <div className="equip-meta">
          <p className="equip-name">
            {record.model} {record.name}
          </p>
          <p className="equip-sub">
            {[record.assemblyNo, record.revision && `Rev ${record.revision}`, `${parts.length} part${parts.length === 1 ? '' : 's'}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="top-actions">
          <button type="button" className="btn btn-dark" onClick={onEdit}>
            Edit registration
          </button>
          <button type="button" className="btn btn-dark" onClick={onBack}>
            All assemblies
          </button>
        </div>
      </header>

      <main className="workspace">
        <section className="panel panel-left" aria-label="Find a part">
          <div className="panel-block">
            <p className="kicker">Find a part</p>
            <form
              className="search-form"
              onSubmit={(event) => {
                event.preventDefault()
                if (query.trim()) applyMatches(query)
              }}
            >
              <label className="sr-only" htmlFor="part-search">
                Part number, name, or drawing number
              </label>
              <input
                id="part-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Part number or name"
                autoComplete="off"
              />
              <button type="submit" className="btn btn-primary">
                Search
              </button>
            </form>
            <button type="button" className="btn btn-line btn-block" onClick={() => setQrOpen(true)}>
              Scan QR code
            </button>
            <p className="hint">Search by part number, name, or drawing number.</p>
          </div>

          {stored.components.length > 0 && (
            <div className="model-parts">
              <p className="kicker">{stored.components.length} part{stored.components.length === 1 ? '' : 's'} in this file</p>
              <p className="model-parts-note">Names come from the model. Click one to highlight it.</p>
              <ul>
                {stored.components.map((component, index) => {
                  const part = parts.find((item) => item.componentId === component.id)
                  const highlighted = (fileSelection || selected?.componentId) === component.id
                  return (
                    <li key={component.id}>
                      <button
                        type="button"
                        className={highlighted ? 'model-part is-selected' : 'model-part'}
                        onClick={() => {
                          if (part) selectPart(part.id)
                          else setFileSelection(component.id)
                        }}
                      >
                        <span className="model-part-index">{index + 1}</span>
                        <span>{part?.name && part.name !== component.label ? part.name : component.label}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {result && (
            <div className={`status status-${result.kind}`} role="status">
              <p>{status}</p>
              {result.kind === 'none' && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setQuery('')
                    setResult(null)
                    clearHighlight()
                  }}
                >
                  Search again
                </button>
              )}
              {result.kind === 'multiple' && (
                <ul className="candidates">
                  {result.ids.map((id) => {
                    const part = parts.find((item) => item.id === id)
                    if (!part) return null
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          className={id === selectedId ? 'candidate is-selected' : 'candidate'}
                          onClick={() => selectPart(id)}
                        >
                          <span className="mono">{part.partNo}</span>
                          <span>{part.name}</span>
                          <span className="muted">{part.location}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          <div className="bom-wrap">
            <p className="kicker">Bill of materials</p>
            <ul className="bom">
              {parts.map((part) => {
                const isSelected = part.id === selectedId
                const candidate = candidateIds.includes(part.id)
                return (
                  <li key={part.id}>
                    <button
                      type="button"
                      className={`bom-row${isSelected ? ' is-selected' : ''}${candidate ? ' is-candidate' : ''}`}
                      onClick={() => selectPart(part.id)}
                    >
                      <span className="swatch" style={{ background: part.color }} />
                      <span>
                        <span className="mono">{part.partNo}</span>
                        <span className="bom-name">{part.name}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>

        <section className="stage" aria-label="3D assembly">
          {(usingModel || showLoading || stored.error || modelMessage) && (
            <div className="stage-status">
              {usingModel && <p>{record.modelFileName}</p>}
              {showLoading && <p>Loading model…</p>}
              {(modelMessage || stored.error) && <p>{modelMessage || stored.error}</p>}
            </div>
          )}
          <Canvas
            key={`${record.id}-${usingModel ? 'glb' : 'sample'}`}
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
                components={stored.components}
                selectedId={fileSelection || selected?.componentId || null}
                candidateIds={candidateIds.flatMap((id) => {
                  const componentId = parts.find((part) => part.id === id)?.componentId
                  return componentId ? [componentId] : []
                })}
                onSelect={(componentId) => {
                  const part = parts.find((item) => item.componentId === componentId)
                  if (part) selectPart(part.id)
                  else setFileSelection(componentId)
                }}
                onReady={() => setReadyUrl(modelUrl)}
                onError={(message) => setModelMessage(message)}
                apiRef={apiRef}
              />
            ) : usingModel ? (
              <color attach="background" args={['#d7d0c4']} />
            ) : (
              <AssemblyScene
                parts={parts}
                selectedId={selectedId}
                candidateIds={candidateIds}
                onSelect={selectPart}
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
            <p>Scroll to zoom · Right-drag to pan · Left-drag to orbit</p>
          </div>
        </section>

        <section className="panel panel-right" aria-label="Selected part">
          {selected ? (
            <>
              <p className="kicker">Selected part</p>
              <h2>{selected.name}</h2>
              <dl className="facts">
                <Fact label="Part no." value={selected.partNo} mono />
                <Fact label="Drawing no." value={selected.drawingNo} mono />
                <Fact label="Quantity" value={selected.quantity} />
                <Fact label="Revision" value={selected.revision} />
                <Fact label="Location" value={selected.location} />
                <Fact label="3D component" value={linkedLabel} />
              </dl>
              <label className="notes-label" htmlFor="part-notes">
                Notes
              </label>
              <textarea
                id="part-notes"
                value={notes[selected.id] ?? ''}
                onChange={(event) =>
                  setNotes((current) => ({ ...current, [selected.id]: event.target.value }))
                }
                placeholder="Shop note for this part"
                rows={6}
              />
              <button type="button" className="btn btn-ghost" onClick={clearHighlight}>
                Clear highlight
              </button>
            </>
          ) : (
            <div className="detail-empty">
              <p className="kicker">Selected part</p>
              <h2>Nothing highlighted</h2>
              <p>Search, scan a QR code, or click a part on the model or in the list.</p>
            </div>
          )}
        </section>
      </main>

      {qrOpen && (
        <QrDialog
          samples={samples}
          onClose={() => setQrOpen(false)}
          onCode={(code) => {
            setQrOpen(false)
            setQuery(code)
            applyMatches(code)
          }}
        />
      )}
    </>
  )
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  if (!value) return null
  return (
    <div>
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined}>{value}</dd>
    </div>
  )
}

function readNotes(): Record<string, string> {
  try {
    const saved = localStorage.getItem(NOTES_KEY)
    return saved ? (JSON.parse(saved) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function qrSamples(parts: ReturnType<typeof viewParts>) {
  const counts = new Map<string, number>()
  for (const part of parts) {
    if (!part.partNo) continue
    counts.set(part.partNo, (counts.get(part.partNo) ?? 0) + 1)
  }
  const multi = [...counts.entries()].find(([, count]) => count > 1)?.[0]
  const singles = parts.filter((part) => part.partNo && counts.get(part.partNo) === 1)
  const samples: { code: string; label: string }[] = []
  if (singles[0]) samples.push({ code: singles[0].partNo, label: 'Single match' })
  if (multi) samples.push({ code: multi, label: 'Several matches' })
  if (singles[1]) samples.push({ code: singles[1].partNo, label: singles[1].name })
  samples.push({ code: 'NO-PART', label: 'No match' })
  return samples
}
