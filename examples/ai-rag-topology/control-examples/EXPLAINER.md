# Control Narrative Explainer

Each control family benefits from specific topology metadata. Use this guide to tell the AI which fields to highlight.

| Control | Helpful Metadata | Notes |
| --- | --- | --- |
| AC-2 (Account Management) | Identity sources, MFA coverage, provisioning workflow, device owners | Mention how accounts on selected servers/network gear are approved and reviewed. |
| SC-7 (Boundary Protection) | Boundary labels, firewall devices, logging destinations, encryptionStatus | Reference DMZ vs Prod zones, named firewalls, default deny policies. |
| CM-2 (Baseline Configuration) | manufacturer/model, OS version, patchLevel, configuration storage | Explain how devices maintain baselines and where configs are stored/backed up. |
| IR-4 (Incident Handling) | monitoringEnabled, SIEM integrations, contact info | Highlight detection tooling tied to the selected devices. |

## Prompt Template Snippets
- **Device Reference**: `"${device.name}" (${device.type}) located in ${device.config.securityZone}`
- **Security Claim**: `Implements ${device.config.encryptionStatus || 'standard'} encryption for data in transit.`
- **Evidence Hook**: `Logs forwarded to ${device.config.logDestination || 'central SIEM'} for continuous monitoring.`

Combine these snippets with the main `rag-orchestrator` prompt to keep outputs consistent.
