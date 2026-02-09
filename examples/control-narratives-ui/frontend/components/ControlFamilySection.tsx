import React, { useState } from 'react'
import ControlCard from './ControlCard'
import type { ControlFamily } from '../state/types'

interface Props {
  family: ControlFamily
}

const ControlFamilySection: React.FC<Props> = ({ family }) => {
  const [expanded, setExpanded] = useState(true)

  return (
    <section className="family">
      <header onClick={() => setExpanded(!expanded)}>
        <div>
          <h3>{family.code} — {family.name}</h3>
          <p>{family.controls.length} controls</p>
        </div>
        <button>{expanded ? 'Collapse' : 'Expand'}</button>
      </header>

      {expanded && (
        <div className="controls">
          {family.controls.map((control) => (
            <ControlCard key={control.control_id} control={control} />
          ))}
        </div>
      )}
    </section>
  )
}

export default ControlFamilySection
