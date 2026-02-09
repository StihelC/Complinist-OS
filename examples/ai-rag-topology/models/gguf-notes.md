# gguf Integration Notes

## Recommended Models
- `mistral-7b-instruct.Q4_K_M.gguf` — Balanced quality/perf for laptops.
- `llama-3-8b-instruct.Q4_K_M.gguf` — Better reasoning, larger context (8k tokens).
- `phi-3-mini-4k-instruct.Q4_K_M.gguf` — Low memory footprint for edge devices.

## Serving Options
1. **llama.cpp**
   ```bash
   ./main -m models/mistral-7b-instruct.Q4_K_M.gguf -n 600 -c 4096 --repeat-penalty 1.05
   ```
2. **llama-cpp-python** (server mode)
   ```bash
   llama-cpp-python --model models/llama-3-8b-instruct.Q4_K_M.gguf --host 0.0.0.0 --port 8080
   ```
3. **Local GPU wrappers** (KoboldCpp, LM Studio) if you want UI-based testing.

## Prompt Hygiene
- Keep instructions concise; gguf models have tighter context windows than cloud LLMs.
- Use markdown-style sections (`Topology Summary`, `Retrieved Context`, `Task`).
- Provide bullet lists instead of JSON to avoid token waste.

## Performance Tips
- Batch embeddings separately using smaller encoder models (e.g., `all-MiniLM`).
- Warm up the model after launch by generating a short dummy completion.
- Monitor RAM usage; Q4_K_M variants need ~5‑6 GB per 7B model.

## Safety
- Always enforce max tokens to prevent runaway responses.
- Sanitize prompt inputs (no raw user HTML) before sending to gguf.
