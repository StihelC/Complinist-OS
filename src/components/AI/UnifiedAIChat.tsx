// Unified AI Chat Component
// Intelligently routes queries to NIST document RAG, topology queries, or general AI assistant

import { useState, useRef, useEffect } from 'react';
import { useAINarrativesStore } from '@/core/stores/useAINarrativesStore';
import { useNISTQueryStore } from '@/core/stores/useNISTQueryStore';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Send, Loader2, StopCircle, Trash2, Filter } from 'lucide-react';
import { AIStatusIndicator } from './AIStatusIndicator';
import { routeQuery } from '@/lib/ai/queryRouter';
import { getRAGOrchestrator } from '@/lib/ai/ragOrchestrator';

// Document types for NIST queries
const DOCUMENT_TYPES = [
  { value: '800-53_catalog', label: 'NIST 800-53' },
  { value: '800-171', label: 'NIST 800-171' },
  { value: 'cmmc', label: 'CMMC' },
  { value: '800-37_rmf', label: 'RMF (800-37)' },
  { value: 'csf_2.0', label: 'CSF 2.0' },
  { value: 'security_pattern', label: 'Security Patterns' },
  { value: 'positioning_guide', label: 'Positioning Guide' },
  { value: 'zone_guide', label: 'Zone Guide' },
  { value: 'segmentation_guide', label: 'Segmentation Guide' },
  { value: 'grouping_guide', label: 'Grouping Guide' },
];

// Common control families
const CONTROL_FAMILIES = [
  'AC', 'AT', 'AU', 'CA', 'CM', 'CP', 'IA', 'IR', 'MA', 'MP', 'PE', 'PL', 'PS', 'PT', 'RA', 'SA', 'SC', 'SI', 'SR',
];

export function UnifiedAIChat() {
  // General AI Assistant state
  const aiChatHistory = useAINarrativesStore((state) => state.chatHistory);
  const sendAIMessage = useAINarrativesStore((state) => state.sendMessage);
  const clearAIChat = useAINarrativesStore((state) => state.clearChatHistory);
  
  // NIST Query state
  const nistQueryHistory = useNISTQueryStore((state) => state.queryHistory);
  const currentNISTQuery = useNISTQueryStore((state) => state.currentQuery);
  const currentNISTResponse = useNISTQueryStore((state) => state.currentResponse);
  const isNISTStreaming = useNISTQueryStore((state) => state.isStreaming);
  const isNISTLoading = useNISTQueryStore((state) => state.isLoading);
  const nistError = useNISTQueryStore((state) => state.error);
  const currentNISTReferences = useNISTQueryStore((state) => state.currentReferences);
  const currentNISTContextTokens = useNISTQueryStore((state) => state.currentContextTokens);
  const selectedDocumentTypes = useNISTQueryStore((state) => state.selectedDocumentTypes);
  const selectedFamilies = useNISTQueryStore((state) => state.selectedFamilies);
  
  const askNISTQuestion = useNISTQueryStore((state) => state.askQuestion);
  const stopNISTGeneration = useNISTQueryStore((state) => state.stopGeneration);
  const clearNISTHistory = useNISTQueryStore((state) => state.clearHistory);
  const setSelectedDocumentTypes = useNISTQueryStore((state) => state.setSelectedDocumentTypes);
  const setSelectedFamilies = useNISTQueryStore((state) => state.setSelectedFamilies);
  const clearNISTError = useNISTQueryStore((state) => state.clearError);
  
  const currentProject = useFlowStore((state) => state.currentProject);
  
  const [input, setInput] = useState('');
  const [isAISending, setIsAISending] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  // const [expandedReferences, setExpandedReferences] = useState<Set<number>>(new Set()); // Unused - kept for potential future use
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [aiChatHistory, nistQueryHistory, currentNISTResponse]);

  useEffect(() => {
    if (nistError) {
      const timer = setTimeout(() => clearNISTError(), 5000);
      return () => clearTimeout(timer);
    }
  }, [nistError, clearNISTError]);

  const handleSend = async () => {
    if (!input.trim() || isAISending || isNISTLoading || isNISTStreaming) return;

    const message = input.trim();
    setInput('');

    // Use query router to determine how to handle this query
    const route = routeQuery(message);
    console.log('[UnifiedAIChat] Route decision:', route);

    try {
      if (route.type === 'nist-docs') {
        // Use NIST document RAG
        await askNISTQuestion(message, {
          documentTypes: selectedDocumentTypes.length > 0 ? selectedDocumentTypes : route.parameters.documentTypes,
          families: selectedFamilies.length > 0 ? selectedFamilies : route.parameters.families,
        });
      } else if (route.type === 'topology') {
        // Use topology query handler
        setIsAISending(true);
        
        // Add user message
        const userMessage = {
          role: 'user' as const,
          content: message,
          timestamp: Date.now(),
        };
        
        // Add placeholder assistant message
        const assistantMessage = {
          role: 'assistant' as const,
          content: '',
          timestamp: Date.now(),
        };
        
        // Add both at once
        useAINarrativesStore.setState((state) => ({
          chatHistory: [...state.chatHistory, userMessage, assistantMessage],
        }));
        
        // Stream topology response
        const orchestrator = getRAGOrchestrator();
        let response = '';
        
        for await (const chunk of orchestrator.generateTopologyResponseStream(
          message,
          currentProject?.id || null
        )) {
          if (chunk) {
            response += chunk;
            // Update last message
            useAINarrativesStore.setState((state) => {
              const updatedHistory = [...state.chatHistory];
              const lastMessage = updatedHistory[updatedHistory.length - 1];
              if (lastMessage && lastMessage.role === 'assistant') {
                lastMessage.content = response;
              }
              return { chatHistory: updatedHistory };
            });
          }
        }
        
        setIsAISending(false);
      } else if (route.type === 'narrative') {
        // Use narrative generation (existing general assistant with control context)
        setIsAISending(true);
        await sendAIMessage(message, route.parameters.narrativeControlId);
        setIsAISending(false);
      } else {
        // General assistant (default)
        setIsAISending(true);
        await sendAIMessage(message);
        setIsAISending(false);
      }
    } catch (error) {
      console.error('[UnifiedAIChat] Error:', error);
      setIsAISending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStop = () => {
    if (isNISTStreaming) {
      stopNISTGeneration();
    }
  };

  const toggleDocumentType = (type: string) => {
    if (selectedDocumentTypes.includes(type)) {
      setSelectedDocumentTypes(selectedDocumentTypes.filter((t) => t !== type));
    } else {
      setSelectedDocumentTypes([...selectedDocumentTypes, type]);
    }
  };

  const toggleFamily = (family: string) => {
    if (selectedFamilies.includes(family)) {
      setSelectedFamilies(selectedFamilies.filter((f) => f !== family));
    } else {
      setSelectedFamilies([...selectedFamilies, family]);
    }
  };

  // const _toggleReferenceExpansion = (index: number) => { // Unused - kept for potential future use
  //   const newExpanded = new Set(expandedReferences);
  //   if (newExpanded.has(index)) {
  //     newExpanded.delete(index);
  //   } else {
  //     newExpanded.add(index);
  //   }
  //   setExpandedReferences(newExpanded);
  // };

  const clearAllHistory = () => {
    clearAIChat();
    clearNISTHistory();
  };

  const hasHistory = aiChatHistory.length > 0 || nistQueryHistory.length > 0;
  const isStreaming = isNISTStreaming;
  const isLoading = isAISending || isNISTLoading;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold">AI Assistant</h2>
          <p className="text-xs text-muted-foreground">
            {currentProject ? `Project: ${currentProject.name}` : 'No project selected'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AIStatusIndicator />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            title="Filter NIST documents"
          >
            <Filter className="w-4 h-4 mr-1" />
            Filters
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllHistory}
            disabled={!hasHistory}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="border-b px-4 py-3 bg-gray-50 space-y-3">
          <div>
            <label className="text-sm font-medium mb-2 block">Document Types</label>
            <div className="flex flex-wrap gap-2">
              {DOCUMENT_TYPES.map((type) => (
                <Badge
                  key={type.value}
                  variant={selectedDocumentTypes.includes(type.value) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleDocumentType(type.value)}
                >
                  {type.label}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Control Families</label>
            <div className="flex flex-wrap gap-2">
              {CONTROL_FAMILIES.map((family) => (
                <Badge
                  key={family}
                  variant={selectedFamilies.includes(family) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleFamily(family)}
                >
                  {family}
                </Badge>
              ))}
            </div>
          </div>
          {(selectedDocumentTypes.length > 0 || selectedFamilies.length > 0) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedDocumentTypes([]);
                setSelectedFamilies([]);
              }}
            >
              Clear All Filters
            </Button>
          )}
        </div>
      )}

      {/* Error Display */}
      {nistError && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
          {nistError}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!hasHistory && !currentNISTQuery && !currentNISTResponse && aiChatHistory.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center text-muted-foreground px-4">
            <div>
              <p className="text-lg font-medium mb-2">Welcome to AI Assistant</p>
              <p className="text-sm mb-4 max-w-md">
                Ask questions about NIST controls, topology devices, connections, or request help with your SSP.
                I automatically route queries to the best knowledge source.
              </p>
              <div className="text-xs text-left space-y-1 max-w-md mx-auto">
                <p className="font-medium">Example queries:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>"What is AC-1?" (NIST documents)</li>
                  <li>"What devices are on the canvas?" (Topology)</li>
                  <li>"What connections does the firewall have?" (Topology)</li>
                  <li>"What NIST controls apply to this server?" (Controls)</li>
                  <li>"Explain access control requirements" (NIST documents)</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* General AI Chat History */}
            {aiChatHistory.map((message, index) => (
              <div
                key={`ai-${index}`}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">{message.content}</div>
                  {message.references && message.references.length > 0 && (
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer opacity-75">
                        References ({message.references.length})
                      </summary>
                      <ul className="mt-1 space-y-1">
                        {message.references.map((ref, refIndex) => (
                          <li key={refIndex} className="opacity-75">
                            {ref.reason}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </div>
            ))}

            {/* NIST Query History */}
            {nistQueryHistory.map((entry) => (
              <div key={entry.id} className="space-y-2">
                {/* User Query */}
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-lg px-4 py-2 bg-blue-600 text-white">
                    <div className="whitespace-pre-wrap break-words">{entry.query}</div>
                    {entry.filters && (entry.filters.documentTypes || entry.filters.families) && (
                      <div className="mt-2 text-xs opacity-75">
                        {entry.filters.documentTypes && entry.filters.documentTypes.length > 0 && (
                          <div>Docs: {entry.filters.documentTypes.join(', ')}</div>
                        )}
                        {entry.filters.families && entry.filters.families.length > 0 && (
                          <div>Families: {entry.filters.families.join(', ')}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Assistant Response */}
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-lg px-4 py-2 bg-gray-100 text-gray-900">
                    <div className="whitespace-pre-wrap break-words">{entry.response.answer}</div>
                    
                    <div className="mt-2 text-xs text-gray-500">
                      Context: {entry.response.contextTokensUsed} tokens
                    </div>

                    {entry.response.references.length > 0 && (
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer opacity-75 font-medium">
                          References ({entry.response.references.length})
                        </summary>
                        <div className="mt-2 space-y-2">
                          {entry.response.references.map((ref, refIndex) => (
                            <div key={refIndex} className="p-2 bg-white rounded border">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {ref.documentType}
                                </Badge>
                                {ref.controlId && (
                                  <Badge variant="secondary" className="text-xs">
                                    {ref.controlId}
                                  </Badge>
                                )}
                                {ref.family && (
                                  <Badge variant="secondary" className="text-xs">
                                    {ref.family}
                                  </Badge>
                                )}
                              </div>
                              {ref.controlName && (
                                <div className="text-xs mt-1 opacity-75">{ref.controlName}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Current Streaming Query */}
            {(currentNISTQuery || currentNISTResponse) && (
              <div className="space-y-2">
                {currentNISTQuery && (
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-lg px-4 py-2 bg-blue-600 text-white">
                      <div className="whitespace-pre-wrap break-words">{currentNISTQuery}</div>
                    </div>
                  </div>
                )}

                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-lg px-4 py-2 bg-gray-100 text-gray-900">
                    {currentNISTResponse ? (
                      <>
                        <div className="whitespace-pre-wrap break-words">{currentNISTResponse}</div>
                        {isStreaming && <span className="inline-block w-2 h-4 ml-1 bg-gray-900 animate-pulse" />}
                      </>
                    ) : (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                    
                    {currentNISTContextTokens > 0 && (
                      <div className="mt-2 text-xs text-gray-500">
                        Context: {currentNISTContextTokens} tokens
                      </div>
                    )}

                    {currentNISTReferences.length > 0 && (
                      <details className="mt-2 text-xs" open={isStreaming}>
                        <summary className="cursor-pointer opacity-75 font-medium">
                          References ({currentNISTReferences.length})
                        </summary>
                        <div className="mt-2 space-y-2">
                          {currentNISTReferences.map((ref, refIndex) => (
                            <div key={refIndex} className="p-2 bg-white rounded border">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {ref.documentType}
                                </Badge>
                                {ref.controlId && (
                                  <Badge variant="secondary" className="text-xs">
                                    {ref.controlId}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            )}

            {isAISending && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-4 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything - I'll automatically route to the best knowledge source..."
            rows={3}
            className="resize-none"
            disabled={isLoading || isStreaming}
          />
          <div className="flex flex-col gap-2">
            {isStreaming ? (
              <Button
                onClick={handleStop}
                variant="destructive"
                size="icon"
                className="h-full"
              >
                <StopCircle className="w-5 h-5" />
              </Button>
            ) : (
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                size="icon"
                className="h-full"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            )}
          </div>
        </div>
        {selectedDocumentTypes.length > 0 || selectedFamilies.length > 0 ? (
          <div className="mt-2 text-xs text-gray-500">
            Active filters: {selectedDocumentTypes.length + selectedFamilies.length}
          </div>
        ) : null}
      </div>
    </div>
  );
}

