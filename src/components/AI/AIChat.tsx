// AI Chat Component
// Main chat interface for AI assistant

import { useState, useRef, useEffect } from 'react';
import { useAINarrativesStore } from '@/core/stores/useAINarrativesStore';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Send, Loader2, Trash2 } from 'lucide-react';
import { AIStatusIndicator } from './AIStatusIndicator';

export function AIChat() {
  const chatHistory = useAINarrativesStore((state) => state.chatHistory);
  const sendMessage = useAINarrativesStore((state) => state.sendMessage);
  const clearChatHistory = useAINarrativesStore((state) => state.clearChatHistory);
  const currentProject = useFlowStore((state) => state.currentProject);
  
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;

    const message = input.trim();
    setInput('');
    setIsSending(true);

    try {
      await sendMessage(message);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
            onClick={clearChatHistory}
            disabled={chatHistory.length === 0}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatHistory.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center text-muted-foreground px-4">
            <div>
              <p className="text-lg font-medium mb-2">Welcome to AI Assistant</p>
              <p className="text-sm mb-4">
                Ask questions about NIST controls, request narrative generation, or get help with your SSP.
              </p>
            </div>
          </div>
        ) : (
          chatHistory.map((message, index) => (
            <div
              key={index}
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
          ))
        )}
        {isSending && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about controls, request narratives, or get help..."
            rows={3}
            className="resize-none"
            disabled={isSending || !currentProject}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isSending || !currentProject}
            size="lg"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        {!currentProject && (
          <p className="text-xs text-muted-foreground mt-2">
            Please select a project to use AI features
          </p>
        )}
      </div>
    </div>
  );
}

