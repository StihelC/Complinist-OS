# CompliFlow Docker Deployment

## Quick Start

```bash
# 1. Create models directory and download models
mkdir models
# Download to models/:
#   - mistral-7b-instruct-v0.1.Q4_K_M.gguf
#   - bge-m3-FP16.gguf

# 2. Build and run
docker-compose up -d

# 3. Access at http://localhost:3000
```

## Manual Docker Commands

```bash
# Build image
docker build -t compliflow .

# Run container
docker run -p 3000:3000 -v ./models:/data/models compliflow
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| DATA_DIR | /data | Data directory |
| MODELS_DIR | /data/models | AI models directory |
| CHROMA_DIR | /data/shared/chroma_db | ChromaDB directory |

## Volumes

- `/data` - Persistent data (database, ChromaDB)
- `/data/models` - AI models (mount your models here)

## Model Requirements

Download these models to your `models/` directory:

1. **LLM**: `mistral-7b-instruct-v0.1.Q4_K_M.gguf` (~4.4GB)
2. **Embedding**: `bge-m3-FP16.gguf` (~1.1GB)

## Notes

- AI inference runs on CPU (GPU requires nvidia-docker on Linux)
- First startup may take a few minutes to load models
- ChromaDB data persists in the volume
