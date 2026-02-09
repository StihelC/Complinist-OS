import { useDevicesStore } from '../../frontend/src/store/stores/devicesStore'
import { embedText, vectorStore } from '../ai-service/clients' // replace with actual paths

export async function syncSelectedDevicesToVectorStore(selectedDeviceIds: string[]) {
  const devices = useDevicesStore.getState().items.filter((d) => selectedDeviceIds.includes(d.id))
  const topologyVersion = Date.now()

  const chunks = devices.map((device) => {
    const config = device.config || {}
    const text = [
      `Name: ${device.name}`,
      `Type: ${device.type}`,
      `Zone: ${config.securityZone || 'Unassigned'}`,
      `OS: ${config.operatingSystem || 'unknown'} ${config.osVersion || ''}`,
      `Risk: ${config.riskLevel || 'Moderate'}`,
      `Encryption: ${config.encryptionStatus || 'Not Configured'}`,
      `Controls: ${(config.controlHints || ['AC-2','SC-7']).join(', ')}`,
      config.securityNotes ? `Notes: ${config.securityNotes}` : ''
    ].filter(Boolean).join('\n')

    return {
      id: `device-${device.id}`,
      text,
      metadata: {
        deviceId: device.id,
        zone: config.securityZone,
        deviceType: device.type,
        controlIdHints: config.controlHints || inferControlHints(device),
        topologyVersion,
      },
    }
  })

  const payloads = await Promise.all(chunks.map(async (chunk) => ({
    id: chunk.id,
    vector: await embedText(chunk.text),
    metadata: chunk.metadata,
  })))

  await vectorStore.upsert(payloads)
}

function inferControlHints(device: any) {
  const hints = []
  if (device.type?.includes('firewall')) hints.push('SC-7')
  if (device.config?.providesRemoteAccess) hints.push('AC-17')
  if (device.config?.encryptionStatus === 'Enabled') hints.push('SC-13')
  if (hints.length === 0) hints.push('PL-2')
  return hints
}
