# AI Models Setup

CompliNist uses in-process AI services powered by node-llama-cpp. This eliminates the need for separate server processes.

## Model Requirements

CompliNist requires GGUF format models for:
1. **LLM (Language Model)**: For generating control narratives and chat responses
2. **Embedding Model**: For vector embeddings and semantic search
3. **ChromaDB**: For vector storage (requires Python package)

## Model Placement

Place your GGUF model files in:
- **Development**: `.data/models/` (relative to project root)
- **Production**: `resources/models/` (bundled with the app)

### Required Models

1. **LLM Model** (default): `mistral-7b-instruct-v0.1.Q4_K_M.gguf`
   - Recommended size: ~4GB (Q4_K_M quantization)
   - Used for: Text generation, control narratives, chat
   - Download from: [Hugging Face](https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.1-GGUF)

2. **Embedding Model** (default): `bge-m3-FP16.gguf`
   - Recommended size: ~2GB
   - Used for: Generating text embeddings for semantic search
   - Download from: [Hugging Face](https://huggingface.co/models?search=bge-m3+gguf)

## Setup Steps

### 1. Create Models Directory

```bash
mkdir -p .data/models
```

### 2. Download Models

Download the models using wget or curl:

```bash
# Example: Download Mistral 7B Instruct (Q4_K_M quantization)
cd .data/models
wget https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.1-GGUF/resolve/main/mistral-7b-instruct-v0.1.Q4_K_M.gguf

# Download BGE-M3 embedding model
# (Replace with actual download URL)
wget <embedding-model-url>/bge-m3-FP16.gguf
```

### 3. Install ChromaDB (Python)

ChromaDB is used for vector storage and requires Python:

```bash
pip install chromadb
```

Or with conda:

```bash
conda install -c conda-forge chromadb
```

### 4. Verify Setup

The models will be automatically loaded when the AI features are first used. Check the Electron console for initialization messages:

- `[AI] Llama instance created`
- `[AI] LLM model loaded successfully`
- `[AI] Embedding model loaded successfully`
- `[AI] AI services initialized successfully`

## GPU Acceleration

### NVIDIA GPU (CUDA)

Models will automatically use CUDA if available:
- Requires NVIDIA GPU with CUDA support
- Automatically detected (no configuration needed)
- Uses 35 GPU layers by default

### macOS (Metal)

Models will automatically use Metal acceleration on macOS:
- Native Apple Silicon support
- Automatically detected
- Uses 35 GPU layers by default

### CPU Only

If no GPU is detected, models run on CPU:
- Slower but works everywhere
- No additional setup required

## Troubleshooting

### Model Not Found

If you see `LLM model not found at: <path>`, ensure:
1. Models are in the correct directory (`.data/models/`)
2. Filenames match exactly (case-sensitive)
3. Files are not corrupted (check file size)

### Out of Memory

If models fail to load due to memory:
1. Use smaller quantized models (Q4_0, Q3_K_M)
2. Reduce GPU layers in config
3. Close other memory-intensive applications

### ChromaDB Not Available

If ChromaDB features don't work:
1. Ensure Python is installed: `python3 --version`
2. Install chromadb: `pip install chromadb`
3. Verify installation: `python3 -c "import chromadb"`

## Model Configuration

Models are configured in `src/lib/ai/config.ts`. Default paths:
- LLM: `mistral-7b-instruct-v0.1.Q4_K_M.gguf`
- Embedding: `bge-m3-FP16.gguf`
- ChromaDB: `.data/chroma_db/`

To use different models, update the paths in config.ts or place files with the default names.

## Performance Tips

1. **Use quantized models**: Q4_K_M provides good balance of size/quality
2. **Enable GPU acceleration**: Dramatically faster inference
3. **Use SSD storage**: Faster model loading
4. **Allocate sufficient RAM**: Models load into memory

## Model Alternatives

You can use any GGUF-format models compatible with llama.cpp:

- **Smaller/Faster**: TinyLlama-1.1B, Phi-2
- **Larger/Better**: Mistral-7B, Llama-2-13B, Mixtral-8x7B
- **Specialized**: Code models, instruction-tuned models

Just place the GGUF file in `.data/models/` and update the config.

## Storage Requirements

Typical storage needs:
- Mistral 7B Q4: ~4GB
- BGE-M3 FP16: ~2GB
- ChromaDB data: <100MB (grows with usage)
- **Total: ~6-7GB**































