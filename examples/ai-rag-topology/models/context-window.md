# Context Window Guidance

| Model | Context | Practical Guidance |
| --- | --- | --- |
| Mistral 7B (gguf) | 4K tokens | Keep prompt + completion < 3.2K to avoid truncation. |
| Llama 3 8B (gguf) | 8K tokens | Comfortable for ~6K tokens of context + 2K output. |
| Phi-3 mini | 4K tokens | Similar to Mistral; optimize snippets aggressively. |

## Budgeting Tokens
- **Prompt Header**: 150 tokens (instructions, control metadata).
- **Topology Summary**: 200 tokens (counts, zone notes).
- **Retrieved Snippets**: 4 × 200 = 800 tokens (truncate per snippet).
- **User Notes**: 100 tokens.
- **Completion**: 400–600 tokens.

Total ≈ 1,650–1,850 tokens → safe for 4K models.

## Truncation Strategy
1. Sort retrieved chunks by relevance score.
2. Trim each chunk to the most important sentences (owner, security setting, evidence).
3. If still over budget, drop the lowest-score chunk or summarize it in 1 sentence.

## Streaming UI Considerations
- Show token count as soon as generation starts.
- If model hits context limit, surface warning and auto-regenerate with fewer snippets.
- Cache token usage per control so future runs can reuse safe budgets.
