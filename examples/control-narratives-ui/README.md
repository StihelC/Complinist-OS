# Control Narratives UI Example

This example documents the manual control narrative editor used to customize NIST 800-53 implementation statements before generating an SSP. It explains how the UI is structured, how it integrates with the existing ReactFlow + Zustand topology app, and how narratives flow into the SSP export workflow. AI tailoring is explicitly excluded—this focuses on the human-driven editing experience.

## Goals
- Provide clean documentation that an AI or developer can follow to recreate the control editor.
- Capture the way controls are organized by family, baseline, and customization status.
- Show how edited narratives are persisted and later consumed by the SSP generator.
- Reuse existing topology stores (devices, projects) only for context display, not for generation.

## Contents
| Folder | Description |
| --- | --- |
| `architecture/` | Editor flow diagrams, state management details |
| `frontend/components/` | Annotated React components (editor, control cards, family sections) |
| `frontend/state/` | Zustand stores and helper operations for narratives |
| `catalog/` | Notes on NIST control catalog structure and merging logic |
| `ui-patterns/` | How search, editing, and bulk operations behave |
| `integration/` | How narratives feed SSP export and show topology context |
| `snippets/` | Copyable code for loading, editing, saving, resetting narratives |

## Compatibility
- Works with the same baseline enum (`LOW | MODERATE | HIGH`) and control catalog used in the SSP generator.
- Hooks into existing auth/session plumbing by reusing the same backend endpoints (`/api/control-narratives`).
- UI styles and state shape match the current ReactFlow-based topology interface, so panels can coexist.

Read `QUICK_START.md` to wire the editor into your app in minutes.
