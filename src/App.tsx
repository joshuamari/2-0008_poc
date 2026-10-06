import { Canvas } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import AssemblyScene from './components/AssemblyScene'
import QrDialog from './components/QrDialog'
import { equipment, partById, parts } from './data/assembly'
import { findParts } from './lib/match'
import type { MatchResult, ViewApi } from './types'

const NOTES_KEY = '2-0008-notes'

export default function App() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<MatchResult | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [qrOpen, setQrOpen] = useState(false)
  const [notes, setNotes] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(NOTES_KEY)
      return saved ? (JSON.parse(saved) as Record<string, string>) : {}
    } catch {
      return {}
    }
  })
  const apiRef = useRef<ViewApi | null>(null)
  const selected = selectedId ? partById(selectedId) : undefined
  const candidateIds = result?.kind === 'multiple' ? result.ids : []

  useEffect(() => {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes))
  }, [notes])

  const applyMatches = (raw: string) => {
    const source = raw.trim()
    const matches = findParts(parts, source)
    if (matches.length === 0) {
      setResult({ kind: 'none', source, ids: [] })
      setSelectedId(null)
      return
    }
    if (matches.length === 1) {
      setResult({ kind: 'single', source, ids: [matches[0].id] })
      setSelectedId(matches[0].id)
      return
    }
    setResult({ kind: 'multiple', source, ids: matches.map((part) => part.id) })
    setSelectedId(null)
  }

  const selectPart = (id: string) => {
    setSelectedId(id)
    setResult((current) => {
      if (current?.kind === 'multiple' && current.ids.includes(id)) return current
      const part = partById(id)
      return { kind: 'single', source: part?.partNo ?? id, ids: [id] }
    })
  }

  const clearSearch = () => {
    setQuery('')
    setResult(null)
    setSelectedId(null)
  }

  const status = useMemo(() => {
    if (!result) return null
    if (result.kind === 'none') return `No match for “${result.source}”.`
    if (result.kind === 'single') return `Single match for “${result.source}”.`
    return `${result.ids.length} matches for “${result.source}”. Choose one.`
  }, [result])

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <p className="brand-code">{equipment.project}</p>
          <h1>Equipment viewer</h1>
        </div>
        <div className="equip-meta">
          <p className="equip-name">
            {equipment.model} {equipment.name}
          </p>
          <p className="equip-sub">
            {equipment.assemblyNo} · Rev {equipment.revision} · {parts.length} components
          </p>
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
                Part number or name
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
            <button type="button" className="btn btn-line" onClick={() => setQrOpen(true)}>
              Scan QR code
            </button>
            <p className="hint">Try MTR-2200, flange, or BLT-M12.</p>
          </div>

          {result && (
            <div className={`status status-${result.kind}`} role="status">
              <p>{status}</p>
              {result.kind === 'none' && (
                <button type="button" className="btn btn-ghost" onClick={clearSearch}>
                  Search again
                </button>
              )}
              {result.kind === 'multiple' && (
                <ul className="candidates">
                  {result.ids.map((id) => {
                    const part = partById(id)
                    if (!part) return null
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          className={id === selectedId ? 'candidate is-selected' : 'candidate'}
                          onClick={() => setSelectedId(id)}
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
                const selected = part.id === selectedId
                const candidate = candidateIds.includes(part.id)
                return (
                  <li key={part.id}>
                    <button
                      type="button"
                      className={`bom-row${selected ? ' is-selected' : ''}${candidate ? ' is-candidate' : ''}`}
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
          <Canvas
            shadows
            camera={{ position: [2.05, 1.55, 2.35], fov: 42 }}
            onPointerMissed={() => {
              document.body.style.cursor = 'default'
            }}
          >
            <AssemblyScene
              parts={parts}
              selectedId={selectedId}
              candidateIds={candidateIds}
              onSelect={selectPart}
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
            <p>Scroll to zoom · Right-drag to pan · Left-drag to orbit</p>
          </div>
        </section>

        <section className="panel panel-right" aria-label="Selected part">
          {selected ? (
            <>
              <p className="kicker">Selected part</p>
              <h2>{selected.name}</h2>
              <dl className="facts">
                <div>
                  <dt>Part no.</dt>
                  <dd className="mono">{selected.partNo}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{selected.location}</dd>
                </div>
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
              <button type="button" className="btn btn-ghost" onClick={() => setSelectedId(null)}>
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
          onClose={() => setQrOpen(false)}
          onCode={(code) => {
            setQrOpen(false)
            setQuery(code)
            applyMatches(code)
          }}
        />
      )}
    </div>
  )
}
