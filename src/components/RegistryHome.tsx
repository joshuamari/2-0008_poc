import { useState } from 'react'
import type { EquipmentRecord } from '../types'

function partCount(count: number): string {
  return `${count} part${count === 1 ? '' : 's'}`
}

type Props = {
  records: EquipmentRecord[]
  onOpen: (id: string) => void
  onEdit: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
}

export default function RegistryHome({ records, onOpen, onEdit, onCreate, onDelete }: Props) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <p className="brand-code">2-0008</p>
          <h1>Assembly registration</h1>
        </div>
      </header>
      <main className="page">
        <div className="page-head">
          <div>
            <p className="kicker">Registered assemblies</p>
            <p className="lead">
              Enter equipment and parts by hand, then link each part to a component on the sample model. Records stay in
              this browser. A database is not used.
            </p>
          </div>
          <button type="button" className="btn btn-primary" onClick={onCreate}>
            Register assembly
          </button>
        </div>

        {records.length === 0 ? (
          <div className="empty-card">
            <h2>No assemblies yet</h2>
            <p>Register one to open it in the viewer.</p>
          </div>
        ) : (
          <ul className="registry">
            {records.map((record) => (
              <li key={record.id} className="registry-card">
                <div>
                  <h2>{record.name || 'Untitled assembly'}</h2>
                  <p className="registry-meta">
                    {[record.model, record.assemblyNo, record.revision && `Rev ${record.revision}`, partCount(record.parts.length)]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {record.description && <p className="registry-desc">{record.description}</p>}
                </div>
                <div className="registry-actions">
                  <button type="button" className="btn btn-primary" onClick={() => onOpen(record.id)}>
                    Open
                  </button>
                  <button type="button" className="btn btn-line" onClick={() => onEdit(record.id)}>
                    Edit
                  </button>
                  {confirmingId === record.id ? (
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => {
                        setConfirmingId(null)
                        onDelete(record.id)
                      }}
                    >
                      Confirm delete
                    </button>
                  ) : (
                    <button type="button" className="btn btn-ghost" onClick={() => setConfirmingId(record.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  )
}
