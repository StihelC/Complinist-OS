// AI Narratives Store
// Manages AI-generated narratives and chat history

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { AINarrativeStatus, ChatMessage, RAGRequest, RAGResponse } from '@/lib/ai/types';
import { getRAGOrchestrator } from '@/lib/ai/ragOrchestrator';
import { getLLMServer } from '@/lib/ai/llamaServer';
import { getEmbeddingService } from '@/lib/ai/embeddingService';
import { getChromaDBClient } from '@/lib/ai/chromaClient';
import { buildChatPrompt } from '@/lib/ai/promptTemplates';
import { getAllControls } from '@/lib/controls/controlCatalog';
import { NIST_CONTROLS, getControlsByFamily, CONTROL_FAMILIES } from '@/lib/controls/nistControls';

interface AINarrativesState {
  // Narrative statuses keyed by controlId
  narratives: Record<string, AINarrativeStatus>;
  
  // Chat history
  chatHistory: ChatMessage[];
  
  // Actions
  requestNarrative: (request: RAGRequest) => Promise<void>;
  generateNarrative: (request: RAGRequest) => Promise<RAGResponse>;
  acceptNarrative: (controlId: string) => void;
  rejectNarrative: (controlId: string) => void;
  updateNarrative: (controlId: string, narrative: string) => void;
  clearNarrative: (controlId: string) => void;
  
  // Chat actions
  sendMessage: (message: string, controlId?: string) => Promise<void>;
  clearChatHistory: () => void;
  
  // Status helpers
  getNarrative: (controlId: string) => AINarrativeStatus | undefined;
  isGenerating: (controlId: string) => boolean;
}

export const useAINarrativesStore = create<AINarrativesState>()(
  devtools(
    (set, get) => ({
      narratives: {},
      chatHistory: [],

      async requestNarrative(request: RAGRequest) {
        const { controlId } = request;
        const now = Date.now();

        // Set status to queued
        set((state) => ({
          narratives: {
            ...state.narratives,
            [controlId]: {
              controlId,
              status: 'queued',
              requestedAt: now,
              updatedAt: now,
            },
          },
        }));

        // Start generation
        try {
          set((state) => ({
            narratives: {
              ...state.narratives,
              [controlId]: {
                ...state.narratives[controlId],
                status: 'retrieving',
                updatedAt: Date.now(),
              },
            },
          }));

          const response = await get().generateNarrative(request);

          set((state) => ({
            narratives: {
              ...state.narratives,
              [controlId]: {
                controlId,
                status: 'completed',
                narrative: response.narrative,
                references: response.references,
                requestedAt: state.narratives[controlId]?.requestedAt || now,
                updatedAt: Date.now(),
              },
            },
          }));
        } catch (error) {
          set((state) => ({
            narratives: {
              ...state.narratives,
              [controlId]: {
                ...state.narratives[controlId],
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
                updatedAt: Date.now(),
              },
            },
          }));
        }
      },

      async generateNarrative(request: RAGRequest): Promise<RAGResponse> {
        const orchestrator = getRAGOrchestrator();
        
        set((state) => ({
          narratives: {
            ...state.narratives,
            [request.controlId]: {
              ...state.narratives[request.controlId],
              status: 'generating',
              updatedAt: Date.now(),
            },
          },
        }));

        const response = await orchestrator.generateControlNarrative(request);
        return response;
      },

      acceptNarrative(controlId: string) {
        const narrative = get().narratives[controlId];
        if (!narrative || narrative.status !== 'completed') {
          return;
        }

        // Mark as accepted (will be saved to control narratives store)
        set((state) => ({
          narratives: {
            ...state.narratives,
            [controlId]: {
              ...state.narratives[controlId],
              status: 'completed',
              updatedAt: Date.now(),
            },
          },
        }));
      },

      rejectNarrative(controlId: string) {
        set((state) => {
          const next = { ...state.narratives };
          delete next[controlId];
          return { narratives: next };
        });
      },

      updateNarrative(controlId: string, narrative: string) {
        set((state) => ({
          narratives: {
            ...state.narratives,
            [controlId]: {
              ...state.narratives[controlId],
              narrative,
              updatedAt: Date.now(),
            },
          },
        }));
      },

      clearNarrative(controlId: string) {
        set((state) => {
          const next = { ...state.narratives };
          delete next[controlId];
          return { narratives: next };
        });
      },

      async sendMessage(message: string, controlId?: string) {
        const now = Date.now();

        // Add user message to history
        const userMessage: ChatMessage = {
          role: 'user',
          content: message,
          timestamp: now,
        };

        // Add placeholder assistant message that will be updated during streaming
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
        };

        // Add both messages at once to prevent duplication
        set((state) => ({
          chatHistory: [...state.chatHistory, userMessage, assistantMessage],
        }));

        try {
          // Control ID pattern (e.g., "SI-7", "RA-5", "AC-2(1)")
          const CONTROL_ID_PATTERN = /([A-Z]{2,3})-(\d+(?:\(\d+\))?)/i;
          // Control family pattern (e.g., "AC controls", "RA family", "SI")
          const CONTROL_FAMILY_PATTERN = /\b(AC|AU|AT|CM|CP|IA|IR|MA|MP|PE|PL|PS|RA|SA|SC|SI|SR)\s*(?:controls?|family|families)?\b/i;

          // Extract control ID or family from message
          const detectedControlId = message.match(CONTROL_ID_PATTERN)?.[0]?.toUpperCase() || controlId;
          const familyCode = message.match(CONTROL_FAMILY_PATTERN)?.[1]?.toUpperCase();

          // Get control information if detected
          let controlInfo: { title: string; objective: string; family: string } | null = null;
          if (detectedControlId) {
            const nistControl = NIST_CONTROLS.find(c => c.id === detectedControlId);
            if (nistControl) {
              controlInfo = {
                title: nistControl.title,
                objective: nistControl.objective,
                family: nistControl.family,
              };
            } else {
              try {
                const catalog = await getAllControls();
                const control = catalog.items[detectedControlId];
                if (control) {
                  controlInfo = {
                    title: control.title || control.control_id,
                    objective: (control as any).objective || control.default_narrative || '',
                    family: control.family,
                  };
                }
              } catch (e) {
                // Catalog loading failed, continue without control info
              }
            }
          }

          // Get family controls if detected
          let familyInfo: { familyName: string; controls: Array<{ id: string; title: string; objective: string }> } | null = null;
          if (familyCode && !detectedControlId) {
            const family = CONTROL_FAMILIES.find(f => f.id === familyCode);
            if (family) {
              const controls = getControlsByFamily(familyCode);
              if (controls.length > 0) {
                familyInfo = {
                  familyName: family.name,
                  controls: controls.map(c => ({
                    id: c.id,
                    title: c.title,
                    objective: c.objective,
                  })),
                };
              }
            }
          }

          // Get relevant context from ChromaDB
          let retrievedContext: string[] = [];
          try {
            const embeddingService = getEmbeddingService();
            const chromaClient = getChromaDBClient();
            const embeddingResponse = await embeddingService.embed({ text: message });
            const queryEmbedding = embeddingResponse.embeddings[0];

            if (queryEmbedding) {
              const results = await chromaClient.query({
                queryEmbedding,
                topK: 3,
              });
              retrievedContext = results.map(r => r.text);
            }
          } catch (e) {
            // Continue without context if ChromaDB fails
          }

          // Build chat history for prompt
          const chatHistory = get().chatHistory.slice(-5).map(msg => ({
            role: msg.role,
            content: msg.content,
          }));

          // Build prompt
          // Filter chat history to only include user/assistant roles (exclude system)
          const filteredChatHistory = chatHistory.filter(msg => msg.role === 'user' || msg.role === 'assistant') as Array<{ role: 'user' | 'assistant'; content: string }>;
          
          let prompt = buildChatPrompt({
            userMessage: message,
            chatHistory: filteredChatHistory,
            retrievedContext,
            controlId: controlInfo ? detectedControlId : undefined,
            controlTitle: controlInfo ? `${detectedControlId} - ${controlInfo.title}` : undefined,
          });

          // Enhance prompt with control information if available
          if (controlInfo) {
            prompt = `You are an AI assistant helping users understand NIST 800-53 Rev 5 controls.

CRITICAL INSTRUCTIONS - READ CAREFULLY:
The user is asking about control ${detectedControlId}. You MUST answer using ONLY the information provided below. Do NOT reference the Cybersecurity Framework. Do NOT make up information. Do NOT confuse this with other controls.

EXACT Control Information from NIST 800-53 Rev 5:
- Control ID: ${detectedControlId}
- Title: ${controlInfo.title}
- Control Family: ${controlInfo.family}
- Objective: ${controlInfo.objective}

${retrievedContext && retrievedContext.length > 0 ? `Additional Context (use only if directly relevant to implementation):\n${retrievedContext.map((ctx, i) => `${i + 1}. ${ctx}`).join('\n\n')}\n\n` : ''}Conversation History:
${chatHistory.map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n\n')}

User: ${message}

YOUR RESPONSE MUST:
1. State that ${detectedControlId} is from NIST 800-53 Rev 5 (NOT NIST Cybersecurity Framework)
2. Use the exact title: "${controlInfo.title}"
3. Explain the control based on this objective: "${controlInfo.objective}"
4. Be accurate - do NOT invent requirements
5. Do NOT confuse ${detectedControlId} with other controls

Assistant:`;
          } else if (familyInfo) {
            const controlsList = familyInfo.controls.map(c => `- ${c.id}: ${c.title} - ${c.objective}`).join('\n');
            prompt = `You are an AI assistant helping users understand NIST 800-53 Rev 5 controls.

CRITICAL INSTRUCTIONS - READ CAREFULLY:
The user is asking about the ${familyInfo.familyName} (${familyCode}) control family. You MUST list ONLY the controls provided below. Do NOT make up controls. Do NOT repeat the same title for multiple controls.

EXACT Control Family Information from NIST 800-53 Rev 5:
- Family Code: ${familyCode}
- Family Name: ${familyInfo.familyName}
- Number of Controls: ${familyInfo.controls.length}

Controls in this family:
${controlsList}

${retrievedContext && retrievedContext.length > 0 ? `Additional Context (use only if directly relevant):\n${retrievedContext.map((ctx, i) => `${i + 1}. ${ctx}`).join('\n\n')}\n\n` : ''}Conversation History:
${chatHistory.map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n\n')}

User: ${message}

YOUR RESPONSE MUST:
1. State that ${familyCode} is the ${familyInfo.familyName} family from NIST 800-53 Rev 5
2. List ALL ${familyInfo.controls.length} controls with their EXACT IDs and titles as shown above
3. Use the exact titles provided - do NOT make up titles
4. Each control must have a unique title - do NOT repeat titles
5. Be accurate - do NOT invent controls or confuse with other families

Assistant:`;
          }

          // Generate response using LLM
          const llmServer = getLLMServer();
          let response = '';
          
          // Stream the response
          for await (const chunk of llmServer.generateStream({
            prompt,
            temperature: 0.4,
            maxTokens: 600,
          })) {
            if (chunk) {
              response += chunk;
              // Update the last message in real-time (the assistant message we added)
              set((state) => {
                const updatedHistory = [...state.chatHistory];
                const lastMessage = updatedHistory[updatedHistory.length - 1];
                if (lastMessage && lastMessage.role === 'assistant') {
                  lastMessage.content = response;
                }
                return { chatHistory: updatedHistory };
              });
            }
          }

          // No additional update needed - the message is already complete from streaming
        } catch (error) {
          set((state) => {
            const updatedHistory = [...state.chatHistory];
            const lastMessage = updatedHistory[updatedHistory.length - 1];
            if (lastMessage && lastMessage.role === 'assistant') {
              lastMessage.content = `Error: ${error instanceof Error ? error.message : 'Unknown error'}. Make sure AI services are running (LLM on port 8080, Embedding on 8081, ChromaDB on 8000).`;
            }
            return { chatHistory: updatedHistory };
          });
        }
      },

      clearChatHistory() {
        set({ chatHistory: [] });
      },

      getNarrative(controlId: string) {
        return get().narratives[controlId];
      },

      isGenerating(controlId: string) {
        const narrative = get().narratives[controlId];
        return narrative?.status === 'generating' || narrative?.status === 'retrieving' || narrative?.status === 'queued';
      },
    }),
    { name: 'AI Narratives Store' }
  )
);

