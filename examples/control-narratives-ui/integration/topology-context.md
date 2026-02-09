# Topology Context in Control Editor

While the editor focuses on narrative text, it can show helpful context from the topology:

- **Device References**: List selected devices or highlight ones relevant to control (e.g., firewalls for SC-7).
- **Baseline Hints**: Display counts (e.g., “4 firewalls in DMZ”) to guide edits.
- **Read-Only Panels**: Side panel showing device metadata (OS, owner, risk) pulled from `useDevicesStore`.

Implementation Tips:
- Subscribe to topology stores for context only; do not mutate device data here.
- Provide quick links (“Jump to device in canvas”) to keep narratives grounded in actual topology.
- When user clicks “Insert reference,” append device name to narrative text (simple string helpers, no AI needed).
