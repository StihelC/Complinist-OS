// AI Service Configuration

import type { AIConfig } from './types';

// Get paths relative to the project root
const getModelPath = (modelName: string): string => {
  // Model paths are managed by Electron main process
  // This is just for reference in the config
  return modelName;
};

const getChromaDbPath = (): string => {
  // ChromaDB path is managed by Electron main process
  return '';
};

export const defaultAIConfig: AIConfig = {
  embeddingModelPath: getModelPath('bge-m3-FP16.gguf'),
  llmModelPath: getModelPath('mistral-7b-instruct-v0.1.Q4_K_M.gguf'),
  chromaDbPath: getChromaDbPath(),
  gpuBackend: 'auto',
  temperature: 0.4,
  maxTokens: 600,
  topK: 6,
  useInstructionFormat: true, // Enable Mistral instruction formatting by default
  chatTemplate: 'mistral', // Use Mistral template for Mistral 7B Instruct v0.1
};

// Load config from localStorage or use defaults
export function loadAIConfig(): AIConfig {
  try {
    const stored = localStorage.getItem('complinist-ai-config');
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultAIConfig, ...parsed };
    }
  } catch (error) {
    console.error('Failed to load AI config:', error);
  }
  return defaultAIConfig;
}

// Save config to localStorage
export function saveAIConfig(config: Partial<AIConfig>): void {
  try {
    const current = loadAIConfig();
    const updated = { ...current, ...config };
    localStorage.setItem('complinist-ai-config', JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save AI config:', error);
  }
}

