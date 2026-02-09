import React from 'react'
import { useControlNarrativesStore } from '../state/useControlNarrativesStore'
import ControlFamilySection from './ControlFamilySection'

interface ControlNarrativeEditorProps {
  isOpen: boolean
  baseline: 'LOW' | 'MODERATE' | 'HIGH'
  systemName: string
  onClose: () => void
}

const ControlNarrativeEditor: React.FC<ControlNarrativeEditorProps> = ({ isOpen, baseline, systemName, onClose }) => {
  const { families, searchTerm, setSearchTerm, dirtyCount, saveNarratives } = useControlNarrativesStore()

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content narrative-editor" onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <h2>Control Narratives • {systemName}</h2>
            <p>Baseline: {baseline}</p>
          </div>
          <button onClick={onClose}>×</button>
        </header>

        <div className="toolbar">
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by control ID, title, or text..."
          />
          <span>{dirtyCount} unsaved change(s)</span>
          <button disabled={dirtyCount === 0} onClick={saveNarratives}>Save Changes</button>
        </div>

        <div className="families">
          {families.map((family) => (
            <ControlFamilySection key={family.code} family={family} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default ControlNarrativeEditor
