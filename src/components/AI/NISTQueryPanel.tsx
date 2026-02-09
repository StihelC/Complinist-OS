// NIST Query Panel
// UI for querying NIST documents with Small2Big retrieval
// Features: Streaming responses, stop generation, document filters

import { useState, useRef, useEffect } from 'react';
import { useNISTQueryStore } from '@/core/stores/useNISTQueryStore';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Send, Loader2, StopCircle, Trash2, Filter, ChevronDown, ChevronRight } from 'lucide-react';
import { AIStatusIndicator } from './AIStatusIndicator';

// Document types from Wang et al. metadata schema
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

export function NISTQueryPanel() {
  const queryHistory = useNISTQueryStore((state) => state.queryHistory);
  const currentQuery = useNISTQueryStore((state) => state.currentQuery);
  const currentResponse = useNISTQueryStore((state) => state.currentResponse);
  const isStreaming = useNISTQueryStore((state) => state.isStreaming);
  const isLoading = useNISTQueryStore((state) => state.isLoading);
  const error = useNISTQueryStore((state) => state.error);
  const currentReferences = useNISTQueryStore((state) => state.currentReferences);
  const currentContextTokens = useNISTQueryStore((state) => state.currentContextTokens);
  const selectedDocumentTypes = useNISTQueryStore((state) => state.selectedDocumentTypes);
  const selectedFamilies = useNISTQueryStore((state) => state.selectedFamilies);
  
  const askQuestion = useNISTQueryStore((state) => state.askQuestion);
  const stopGeneration = useNISTQueryStore((state) => state.stopGeneration);
  const clearHistory = useNISTQueryStore((state) => state.clearHistory);
  // const _setCurrentQuery = useNISTQueryStore((state) => state.setCurrentQuery); // Unused - kept for potential future use
  const setSelectedDocumentTypes = useNISTQueryStore((state) => state.setSelectedDocumentTypes);
  const setSelectedFamilies = useNISTQueryStore((state) => state.setSelectedFamilies);
  const clearError = useNISTQueryStore((state) => state.clearError);
  
  const [input, setInput] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedReferences, setExpandedReferences] = useState<Set<number>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [queryHistory, currentResponse]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => clearError(), 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  const handleAsk = async () => {
    if (!input.trim() || isLoading || isStreaming) return;

    const question = input.trim();
    setInput('');
    await askQuestion(question);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  const handleStop = () => {
    stopGeneration();
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

  const toggleReferenceExpansion = (index: number) => {
    const newExpanded = new Set(expandedReferences);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedReferences(newExpanded);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold">NIST Document Assistant</h2>
          <p className="text-xs text-muted-foreground">
            Query compliance documents using Small2Big retrieval
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AIStatusIndicator />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-1" />
            Filters
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearHistory}
            disabled={queryHistory.length === 0}
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
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {queryHistory.length === 0 && !currentQuery && !currentResponse ? (
          <div className="flex items-center justify-center h-full text-center text-muted-foreground px-4">
            <div>
              <p className="text-lg font-medium mb-2">NIST Document Query Assistant</p>
              <p className="text-sm mb-4 max-w-md">
                Ask questions about NIST controls, frameworks, and security guidance. 
                Uses Small2Big retrieval for optimal accuracy (~97.59% faithfulness).
              </p>
              <div className="text-xs text-left space-y-1 max-w-md mx-auto">
                <p className="font-medium">Example queries:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>"What are the access control requirements for moderate baseline?"</li>
                  <li>"Explain cryptographic key management in NIST 800-53"</li>
                  <li>"How does CMMC differ from 800-171?"</li>
                  <li>"What is network segmentation best practice?"</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <>
            {queryHistory.map((entry, _index) => (
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
                    
                    {/* Context Info */}
                    <div className="mt-2 text-xs text-gray-500">
                      Context: {entry.response.contextTokensUsed} tokens
                    </div>

                    {/* References */}
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
                              <div className="text-xs mt-1 opacity-75">
                                {ref.parentTokenCount} tokens
                              </div>
                              {ref.hypotheticalQuestions && ref.hypotheticalQuestions.length > 0 && (
                                <div className="mt-1">
                                  <button
                                    onClick={() => toggleReferenceExpansion(refIndex)}
                                    className="text-xs flex items-center gap-1 opacity-75 hover:opacity-100"
                                  >
                                    {expandedReferences.has(refIndex) ? (
                                      <ChevronDown className="w-3 h-3" />
                                    ) : (
                                      <ChevronRight className="w-3 h-3" />
                                    )}
                                    Hypothetical Questions ({ref.hypotheticalQuestions.length})
                                  </button>
                                  {expandedReferences.has(refIndex) && (
                                    <ul className="mt-1 ml-4 list-disc list-inside space-y-1">
                                      {ref.hypotheticalQuestions.map((q, qIndex) => (
                                        <li key={qIndex} className="text-xs opacity-75">
                                          {q}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
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
            {(currentQuery || currentResponse) && (
              <div className="space-y-2">
                {/* User Query */}
                {currentQuery && (
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-lg px-4 py-2 bg-blue-600 text-white">
                      <div className="whitespace-pre-wrap break-words">{currentQuery}</div>
                    </div>
                  </div>
                )}

                {/* Streaming Response */}
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-lg px-4 py-2 bg-gray-100 text-gray-900">
                    {currentResponse ? (
                      <>
                        <div className="whitespace-pre-wrap break-words">{currentResponse}</div>
                        {isStreaming && <span className="inline-block w-2 h-4 ml-1 bg-gray-900 animate-pulse" />}
                      </>
                    ) : (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                    
                    {/* Context Info (shown during streaming if available) */}
                    {currentContextTokens > 0 && (
                      <div className="mt-2 text-xs text-gray-500">
                        Context: {currentContextTokens} tokens
                      </div>
                    )}

                    {/* References (shown during streaming if available) */}
                    {currentReferences.length > 0 && (
                      <details className="mt-2 text-xs" open={isStreaming}>
                        <summary className="cursor-pointer opacity-75 font-medium">
                          References ({currentReferences.length})
                        </summary>
                        <div className="mt-2 space-y-2">
                          {currentReferences.map((ref, refIndex) => (
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
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t px-4 py-3 bg-gray-50">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about NIST controls, frameworks, or security guidance..."
            className="flex-1 resize-none"
            rows={2}
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
                onClick={handleAsk}
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

