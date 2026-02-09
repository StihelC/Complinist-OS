# Embedding Payloads

## Chunk Template
```json
{
  "id": "device-123",
  "text": "Name: FW-1\nType: firewall\nZone: DMZ\nOS: ASA 9.18\nRisk: High\nControls: AC-4, SC-7\nSecurity Summary: Enforces boundary between DMZ and Prod LAN; default deny in place; logging to SIEM.",
  "metadata": {
    "deviceId": "123",
    "zone": "DMZ",
    "controlFamilies": ["AC", "SC"],
    "baseline": "MODERATE",
    "topologyVersion": 1700000000000
  }
}
```

## Building Chunks
1. **Gather Fields**
   - `device.name`, `device.type`, `device.config` fields (OS, manufacturer, riskLevel, encryptionStatus, owner, securityNotes).
   - Derived facts: `providesRemoteAccess`, `multifactorAuth`, `managesSensitiveData`.
2. **Stringify with Clear Labels** so the LLM sees consistent formatting.
3. **Attach Control Hints**
   - Map metadata to controls:
     - `riskLevel` → RA, PM
     - `encryptionStatus` → SC-12, SC-13
     - `providesRemoteAccess` → AC-17
     - `boundary` membership → SC-7
4. **Versioning**
   - Include `topologyVersion` (timestamp or git SHA) to invalidate old vectors.

## Embedding Strategy
- Use the same embedding model across devices/boundaries for consistent vector space.
- Batch chunks per control request to save inference time.
- Cache embeddings keyed by `deviceId + hash(config)` to avoid recomputation when metadata is unchanged.

## Tips for AI Implementations
- Keep chunk text under ~512 tokens for best cosine similarity.
- Prefer `\n` separators; avoid JSON-in-JSON to reduce noise.
- Include a short summary sentence at the end highlighting why the device matters ("Critical database storing PII").
