# SC-7 Example

## Prompt Inputs
- **Control**: SC-7 Boundary Protection
- **Selected Devices**: `FW-DMZ-01`, `Web-Proxy-01`, boundary `DMZ`
- **Retrieved Snippets**:
  1. `FW-DMZ-01` — "Cisco ASA 5525-X, running ASA 9.18, default deny, north-south traffic inspected, logs to Splunk."
  2. `DMZ boundary` — "Zone enforces TLS termination, IDS sensors inline, separation between internet and prod LAN."

## Generated Narrative (sample)
> The DMZ boundary is anchored by FW-DMZ-01, a Cisco ASA 5525-X configured with default-deny policies and explicit allow rules for HTTPS and VPN traffic. All ingress flows traverse the firewall where IPS signatures and geo-blocking policies run continuously; alerts stream to Splunk with five-minute retention in hot storage.
>
> Web-Proxy-01 terminates TLS sessions, inspects payloads for OWASP threats, and re-encrypts traffic toward the production LAN. IDS sensors inside the DMZ monitor lateral movement while the firewall enforces segmentation between internet-facing assets and the core network. Administrative changes require dual approval and are committed via Infrastructure-as-Code, ensuring boundary protection remains consistent across deployments.

## Metadata Checklist
- `boundary.label`, `boundary.config.zoneType`
- `device.config.firewallRulesSummary`
- `device.config.loggingDestination`
- `device.config.encryptionInTransit`
