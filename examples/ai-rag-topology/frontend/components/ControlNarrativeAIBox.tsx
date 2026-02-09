import React from 'react'
import { useAINarrativesStore } from '../state/useAINarrativesStore.example'
import { useDevicesStore } from '../../../frontend/src/store/stores/devicesStore' // reference path in real app

/**
 * ControlNarrativeAIBox
 *
 * Annotated example that shows how the AI RAG workflow surfaces in the UI.
 * Replace placeholder imports with your actual project paths.
 */

interface ControlNarrativeAIBoxProps {
  controlId: string
  baseline: 'LOW' | 'MODERATE' | 'HIGH'
  systemName: string
}

const ControlNarrativeAIBox: React.FC<ControlNarrativeAIBoxProps> = ({ controlId, baseline, systemName }) => {
  const narrative = useAINarrativesStore((state) => state.items[controlId])
  const requestNarrative = useAINarrativesStore((state) => state.requestNarrative)
  const updateStatus = useAINarrativesStore((state) => state.updateStatus)

  // Example: show which devices are currently selected for context
  const selectedDevices = useDevicesStore((state) => state.items.filter((d) => d.isSelected))

  const handleGenerate = () => {
    requestNarrative({ controlId, selectedDeviceIds: selectedDevices.map((d) => d.id) })
    // Actual implementation should call ragClient.generate(controlId, selectedDevices)
  }

  const handleAccept = () => {
    if (!narrative?.narrative) return
    // Persist into control narrative store / backend
    updateStatus(controlId, { status: 'completed' })
  }

  return (
    <div className="ai-box">
      <header>
        <h3>{controlId} • AI Narrative</h3>
        <p>{systemName} · {baseline} baseline</p>
      </header>

      <section>
        <h4>Context Preview</h4>
        <ul>
          {selectedDevices.map((device) => (
            <li key={device.id}>
              <strong>{device.name}</strong> — {device.config?.operatingSystem || 'Unknown OS'} · {device.config?.riskLevel || 'Risk N/A'}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h4>Status: {narrative?.status || 'idle'}</h4>
        {narrative?.status === 'generating' && <progress max={100} value={60} />}
        {narrative?.status === 'error' && <p className="error">{narrative.error}</p>}
      </section>

      <section>
        <h4>AI Output</h4>
        <textarea
          value={narrative?.narrative || ''}
          placeholder="AI narrative will appear here..."
          onChange={(e) => updateStatus(controlId, { narrative: e.target.value })}
          rows={8}
        />
        {narrative?.references && narrative.references.length > 0 && (
          <details>
            <summary>References ({narrative.references.length})</summary>
            <ul>
              {narrative.references.map((ref) => (
                <li key={ref.chunkId}>{ref.reason} (chunk {ref.chunkId})</li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <footer>
        <button onClick={handleGenerate} disabled={narrative?.status === 'generating'}>
          {narrative?.status === 'generating' ? 'Generating…' : 'Generate Narrative'}
        </button>
        <button onClick={handleAccept} disabled={!narrative?.narrative}>Accept & Save</button>
      </footer>
    </div>
  )
}

export default ControlNarrativeAIBox
