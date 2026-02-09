// AI Status Indicator
// Shows AI service status and model information

import { useState, useEffect } from 'react';
import { useAIServiceStore } from '@/core/stores/useAIServiceStore';
import {
  useShallow,
  selectAIStatusIndicator,
  selectAIStatusIndicatorActions,
} from '@/core/stores/selectors';
import { Loader2, CheckCircle2, XCircle, AlertCircle, Play, Cpu, Settings } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { ModelPicker } from './ModelPicker';

export function AIStatusIndicator() {
  // Use shallow selectors for optimized re-renders
  // Only re-renders when status or preloadProgress actually change
  const { status, preloadProgress, modelPreferences } = useAIServiceStore(useShallow(selectAIStatusIndicator));
  const {
    initialize,
    checkHealth,
    startPreloadListener,
    stopPreloadListener,
  } = useAIServiceStore(useShallow(selectAIStatusIndicatorActions));
  const [isInitializing, setIsInitializing] = useState(false);
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);

  // Start listening for preload progress events on mount
  useEffect(() => {
    startPreloadListener();
    return () => {
      stopPreloadListener();
    };
  }, [startPreloadListener, stopPreloadListener]);

  const handleInitialize = async () => {
    setIsInitializing(true);
    try {
      await initialize();
    } finally {
      setIsInitializing(false);
    }
  };

  const getStatusIcon = () => {
    // Show preload status if currently preloading
    if (preloadProgress.isPreloading) {
      return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
    }

    switch (status.status) {
      case 'not_initialized':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'initializing':
      case 'loading':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'ready':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusText = () => {
    // Show preload progress if currently preloading
    if (preloadProgress.isPreloading) {
      return `Loading ${preloadProgress.progress}%`;
    }

    switch (status.status) {
      case 'not_initialized':
        return 'Not Initialized';
      case 'initializing':
        return 'Initializing...';
      case 'loading':
        return 'Loading models...';
      case 'ready':
        return 'AI Ready';
      case 'error':
        return 'AI Error';
      default:
        return 'Unknown';
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          {getStatusIcon()}
          <span className="text-xs">{getStatusText()}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-sm mb-2">AI Service Status</h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span>Overall Status:</span>
                <span className={`font-medium ${
                  status.status === 'ready' ? 'text-green-600' :
                  status.status === 'error' ? 'text-red-600' :
                  'text-yellow-600'
                }`}>
                  {status.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>LLM:</span>
                <span className={`font-medium ${
                  status.llmStatus === 'ready' ? 'text-green-600' :
                  status.llmStatus === 'error' ? 'text-red-600' :
                  'text-yellow-600'
                }`}>
                  {status.llmStatus}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Embeddings:</span>
                <span className={`font-medium ${
                  status.embeddingStatus === 'ready' ? 'text-green-600' :
                  status.embeddingStatus === 'error' ? 'text-red-600' :
                  'text-yellow-600'
                }`}>
                  {status.embeddingStatus}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>ChromaDB:</span>
                <span className={`font-medium ${
                  status.chromaDbStatus === 'connected' ? 'text-green-600' :
                  status.chromaDbStatus === 'error' ? 'text-red-600' :
                  'text-yellow-600'
                }`}>
                  {status.chromaDbStatus}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>GPU Backend:</span>
                <span className="font-medium">{status.gpuBackend}</span>
              </div>
            </div>
          </div>

          {/* Preload Progress Section */}
          {preloadProgress.isPreloading && (
            <div className="bg-blue-50 p-3 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Loading AI Models</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${preloadProgress.progress}%` }}
                />
              </div>
              <p className="text-xs text-blue-700">{preloadProgress.message}</p>
            </div>
          )}

          {status.modelInfo && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm">Models</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setIsModelPickerOpen(true)}
                >
                  <Settings className="w-3 h-3 mr-1" />
                  Configure
                </Button>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div>
                  LLM: {modelPreferences?.llmModelPath 
                    ? modelPreferences.llmModelPath.split(/[/\\]/).pop() 
                    : status.modelInfo.llmModel}
                </div>
                <div>
                  Embedding: {modelPreferences?.embeddingModelPath 
                    ? modelPreferences.embeddingModelPath.split(/[/\\]/).pop() 
                    : status.modelInfo.embeddingModel}
                </div>
                <div>Context Window: {status.modelInfo.contextWindow} tokens</div>
              </div>
            </div>
          )}

          {/* Model Picker Dialog */}
          <ModelPicker open={isModelPickerOpen} onOpenChange={setIsModelPickerOpen} />

          {status.status === 'not_initialized' && (
            <div className="text-xs text-amber-600 bg-amber-50 p-3 rounded space-y-2">
              <p className="font-medium">AI Services Not Initialized</p>
              <p className="text-xs text-amber-700">
                Click the button below to initialize and check AI service status. Services will be initialized on first use.
              </p>
              <Button
                variant="default"
                size="sm"
                className="w-full mt-2"
                onClick={handleInitialize}
                disabled={isInitializing}
              >
                {isInitializing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Initializing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Initialize AI Services
                  </>
                )}
              </Button>
            </div>
          )}

          {status.status === 'error' && status.error && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
              {status.error}
            </div>
          )}

          {status.status !== 'not_initialized' && (status.llmStatus === 'not_loaded' || status.embeddingStatus === 'not_loaded' || status.chromaDbStatus === 'not_connected') && (
            <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
              <p className="font-medium mb-1">AI Services Not Running</p>
              <p className="text-xs mb-1">
                Start the llama.cpp server, embedding service, and ChromaDB locally to enable AI features.
              </p>
              <p className="text-xs italic text-amber-700 mb-2">
                Note: Connection errors in console are expected when services aren't running.
              </p>
              <details className="text-xs">
                <summary className="cursor-pointer font-medium text-amber-800 hover:text-amber-900">
                  Setup Instructions
                </summary>
                <div className="mt-2 space-y-1 text-amber-700">
                  <p><strong>LLM Server:</strong> llama.cpp server</p>
                  <p><strong>Embedding:</strong> BGE-M3 service</p>
                  <p><strong>ChromaDB:</strong> Vector database</p>
                  <p className="mt-2 text-xs">See AI_SERVICES_SETUP.md for detailed instructions.</p>
                </div>
              </details>
            </div>
          )}

          {status.status !== 'not_initialized' && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={checkHealth}
            >
              Refresh Status
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

