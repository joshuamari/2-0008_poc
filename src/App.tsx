import { useState } from 'react'
import RegisterScreen from './components/RegisterScreen'
import RegistryHome from './components/RegistryHome'
import Viewer from './components/Viewer'
import { deleteModel } from './lib/models'
import { blankEquipment, loadRegistry, saveRegistry } from './lib/registry'
import type { EquipmentRecord } from './types'

type Screen =
  | { name: 'list' }
  | { name: 'edit'; id: string | null }
  | { name: 'view'; id: string }

export default function App() {
  const [records, setRecords] = useState<EquipmentRecord[]>(() => loadRegistry())
  const [screen, setScreen] = useState<Screen>({ name: 'list' })

  const persist = (next: EquipmentRecord[]) => {
    setRecords(next)
    saveRegistry(next)
  }

  const editing = screen.name === 'edit' ? records.find((record) => record.id === screen.id) : undefined
  const viewing = screen.name === 'view' ? records.find((record) => record.id === screen.id) : undefined

  if (screen.name === 'edit') {
    return (
      <div className="app">
        <RegisterScreen
          key={editing?.id ?? 'new'}
          title={editing ? 'Edit assembly' : 'Register assembly'}
          initial={editing ?? blankEquipment()}
          onCancel={() => setScreen({ name: 'list' })}
          onSave={(record) => {
            const next = records.some((item) => item.id === record.id)
              ? records.map((item) => (item.id === record.id ? record : item))
              : [record, ...records]
            persist(next)
            setScreen({ name: 'list' })
          }}
        />
      </div>
    )
  }

  if (screen.name === 'view' && viewing) {
    return (
      <div className="app">
        <Viewer
          record={viewing}
          onBack={() => setScreen({ name: 'list' })}
          onEdit={() => setScreen({ name: 'edit', id: viewing.id })}
        />
      </div>
    )
  }

  return (
    <div className="app">
      <RegistryHome
        records={records}
        onOpen={(id) => setScreen({ name: 'view', id })}
        onEdit={(id) => setScreen({ name: 'edit', id })}
        onCreate={() => setScreen({ name: 'edit', id: null })}
        onDelete={(id) => {
          void deleteModel(id)
          persist(records.filter((record) => record.id !== id))
        }}
      />
    </div>
  )
}
