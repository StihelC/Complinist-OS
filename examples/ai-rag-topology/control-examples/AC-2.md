# AC-2 Example

## Prompt Inputs
- **Control**: AC-2 Account Management
- **Selected Devices**: `AD-01`, `App-Server-01`
- **Retrieved Snippets**:
  1. `AD-01` — "Azure AD tenant enforces MFA via Microsoft Authenticator; provisioning via ServiceNow; owners: IAM team."
  2. `App-Server-01` — "Linux server joined to Azure AD DS; sudo access limited to DevOps group; quarterly access review scheduled."

## Generated Narrative (sample)
> The Production Network enforces centralized account management through Azure Active Directory (AD-01). User creation requests originate in ServiceNow, require dual approval from the hiring manager and IAM, and automatically place new accounts into least-privilege role groups. Multifactor authentication is mandatory for all interactive logons, and privileged accounts must use hardware tokens.
>
> Application servers such as App-Server-01 inherit Azure AD Directory Services policies; sudo access is constrained to the DevOps group and reviewed each quarter. IAM scripts reconcile inactive or transferred users, disabling access within four hours. Audit logs for account events stream to the central SIEM where the security team validates removals and deprovisions.

## Key Metadata to Include
- `device.config.identityProvider`
- `device.config.mfaType`
- `device.config.accessReviewCadence`
- `device.config.provisioningWorkflow`
