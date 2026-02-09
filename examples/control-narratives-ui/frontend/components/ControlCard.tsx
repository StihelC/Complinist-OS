import React, { useState } from 'react'
import { useControlNarrativesStore } from '../state/useControlNarrativesStore'
import type { ControlNarrative } from '../state/types'

interface Props {
  control: ControlNarrative
}

const ControlCard: React.FC<Props> = ({ control }) => {
  const { updateNarrative, updateStatus, resetControl } = useControlNarrativesStore()
  const [isEditing, setIsEditing] = useState(false)

  return (
    <article className={`control-card ${control.isCustom ? 'custom' : ''}`}>
      <header>
        <div>
          <span className="control-id">{control.control_id}</span>
          <span className="control-title">{control.title}</span>
        </div>
        <div className="actions">
          {control.isCustom && <span className="badge">Custom</span>}
          <button onClick={() => setIsEditing(!isEditing)}>{isEditing ? 'Close' : 'Edit'}</button>
          <button onClick={() => resetControl(control.control_id)} disabled={!control.isCustom}>Reset</button>
        </div>
      </header>

      {isEditing ? (
        <div className="editor">
          <select
            value={control.implementation_status || 'Not Implemented'}
            onChange={(e) => updateStatus(control.control_id, e.target.value)}
          >
            <option value="Not Implemented">Not Implemented</option>
            <option value="Planned">Planned</option>
            <option value="Partially Implemented">Partially Implemented</option>
            <option value="Implemented">Implemented</option>
            <option value="Not Applicable">Not Applicable</option>
          </select>
          <textarea
            value={control.narrative}
            onChange={(e) => updateNarrative(control.control_id, e.target.value)}
            rows={6}
          />
        </div>
      ) : (
        <p>{control.narrative}</p>
      )}
    </article>
  )
}

export default ControlCard
