// llama.cpp Server Wrapper
// This module handles communication with the in-process llama.cpp service via IPC

import type { LLMRequest, LLMResponse } from './types';

const DEFAULT_TIMEOUT = 120000; // 2 minutes for generation

export class LLMServer {
  private timeout: number;

  constructor(_serverUrl?: string, timeout: number = DEFAULT_TIMEOUT) {
    this.timeout = timeout;
  }

  async checkHealth(): Promise<boolean> {
    // Check via Electron IPC
    if (typeof window !== 'undefined' && (window as any).electronAPI?.checkAIHealth) {
      try {
        const health = await (window as any).electronAPI.checkAIHealth();
        return health?.llm ?? false;
      } catch (error) {
        return false;
      }
    }
    return false;
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const { prompt, temperature = 0.4, maxTokens = 600 } = request;

    // Use Electron IPC for generation
    if (typeof window !== 'undefined' && (window as any).electronAPI?.llmGenerate) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('LLM generation timed out')), this.timeout);
        });

        const generatePromise = (window as any).electronAPI.llmGenerate({
          prompt,
          temperature,
          maxTokens,
        });

        const result = await Promise.race([generatePromise, timeoutPromise]);

        if (!result.success) {
          throw new Error(result.error || 'LLM generation failed');
        }

        return result.data;
      } catch (error) {
        if (error instanceof Error && error.message.includes('timed out')) {
          throw new Error('LLM generation timed out');
        }
        throw error;
      }
    }

    throw new Error('LLM service not available - Electron IPC not found');
  }

  async *generateStream(request: LLMRequest): AsyncGenerator<string, void, unknown> {
    const { prompt, temperature = 0.4, maxTokens = 600 } = request;

    // Use Electron IPC for streaming
    if (typeof window !== 'undefined' && (window as any).electronAPI?.llmGenerateStream) {
      try {
        // Set up listener for stream tokens
        const tokens: string[] = [];
        // const tokenPromises: Array<Promise<string>> = []; // Unused - kept for potential future use
        let resolveNext: ((value: string) => void) | null = null;
        let streamEnded = false;

        if ((window as any).electronAPI.onStreamToken) {
          (window as any).electronAPI.onStreamToken((token: string) => {
            tokens.push(token);
            if (resolveNext) {
              resolveNext(token);
              resolveNext = null;
            }
          });
        }

        // Start the stream
        const streamPromise = (window as any).electronAPI.llmGenerateStream({
          prompt,
          temperature,
          maxTokens,
        });

        // Yield tokens as they arrive
        let tokenIndex = 0;
        const startTime = Date.now();

        while (!streamEnded) {
          if (Date.now() - startTime > this.timeout) {
            throw new Error('LLM generation timed out');
          }

          if (tokenIndex < tokens.length) {
            yield tokens[tokenIndex];
            tokenIndex++;
          } else {
            // Wait for next token
            await new Promise<void>((resolve) => {
              const checkInterval = setInterval(() => {
                if (tokenIndex < tokens.length || streamEnded) {
                  clearInterval(checkInterval);
                  resolve();
                }
              }, 10);
            });

            // Check if stream ended
            const result = await Promise.race([
              streamPromise,
              new Promise((resolve) => setTimeout(() => resolve(null), 50)),
            ]);

            if (result !== null) {
              streamEnded = true;
              // Yield any remaining tokens
              while (tokenIndex < tokens.length) {
                yield tokens[tokenIndex];
                tokenIndex++;
              }
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('timed out')) {
          throw new Error('LLM generation timed out');
        }
        throw error;
      }
    } else {
      throw new Error('LLM service not available - Electron IPC not found');
    }
  }

  setServerUrl(_url: string): void {
    // No-op for IPC-based implementation
  }

  getServerUrl(): string {
    return 'ipc://ai-service';
  }
}

// Singleton instance
let llmServerInstance: LLMServer | null = null;

export function getLLMServer(_serverUrl?: string): LLMServer {
  if (!llmServerInstance) {
    llmServerInstance = new LLMServer();
  }
  return llmServerInstance;
}

