// Model Picker Component
// Allows users to select LLM and embedding models from detected GGUF files

import { useState, useEffect } from 'react';
import { useAIServiceStore } from '@/core/stores/useAIServiceStore';
import { Button } from '../ui/button';
import { Select } from '../ui/select';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Loader2, RefreshCw, Save, AlertCircle, FolderOpen, RotateCcw } from 'lucide-react';

interface ModelPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ModelPicker({ open, onOpenChange }: ModelPickerProps) {
  const {
    availableModels,
    modelPreferences,
    currentModelsDirectory,
    customModelsPath,
    scanModels,
    getAvailableModels,
    setModelPreferences,
    getModelPreferences,
    setCustomModelsPath,
    getCustomModelsPath,
    clearCustomModelsPath,
    browseModelsFolder,
    refreshCurrentModelsDirectory,
  } = useAIServiceStore();

  const [selectedLLM, setSelectedLLM] = useState<string>('');
  const [selectedEmbedding, setSelectedEmbedding] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load preferences and available models when dialog opens
  useEffect(() => {
    if (open) {
      getAvailableModels();
      getModelPreferences();
      getCustomModelsPath();
      refreshCurrentModelsDirectory();
    }
  }, [open, getAvailableModels, getModelPreferences, getCustomModelsPath, refreshCurrentModelsDirectory]);

  // Update selected models when preferences or available models change
  useEffect(() => {
    if (modelPreferences) {
      setSelectedLLM(modelPreferences.llmModelPath);
      setSelectedEmbedding(modelPreferences.embeddingModelPath);
    } else if (availableModels.length > 0) {
      // Auto-select first available models if no preferences
      const llmModels = availableModels.filter((m) => m.capabilities.canDoLLM);
      const embeddingModels = availableModels.filter((m) => m.capabilities.canDoEmbeddings);
      
      if (llmModels.length > 0 && !selectedLLM) {
        setSelectedLLM(llmModels[0].path);
      }
      if (embeddingModels.length > 0 && !selectedEmbedding) {
        setSelectedEmbedding(embeddingModels[0].path);
      }
    }
  }, [modelPreferences, availableModels]);

  const handleBrowse = async () => {
    setIsBrowsing(true);
    setError(null);
    try {
      const selectedPath = await browseModelsFolder();
      if (selectedPath) {
        const success = await setCustomModelsPath(selectedPath);
        if (success) {
          setSuccess('Models directory updated. Scanning for models...');
          // Clear model selections since directory changed
          setSelectedLLM('');
          setSelectedEmbedding('');
          setTimeout(() => setSuccess(null), 3000);
        } else {
          setError('Failed to set models directory');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to browse for folder');
    } finally {
      setIsBrowsing(false);
    }
  };

  const handleUseDefault = async () => {
    setIsClearing(true);
    setError(null);
    try {
      const success = await clearCustomModelsPath();
      if (success) {
        setSuccess('Reverted to default models directory. Scanning for models...');
        // Clear model selections since directory changed
        setSelectedLLM('');
        setSelectedEmbedding('');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError('Failed to revert to default directory');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revert to default');
    } finally {
      setIsClearing(false);
    }
  };

  const handleScan = async () => {
    setIsScanning(true);
    setError(null);
    try {
      await scanModels();
      setSuccess('Models scanned successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan models');
    } finally {
      setIsScanning(false);
    }
  };

  const handleSave = async () => {
    if (!selectedLLM || !selectedEmbedding) {
      setError('Please select both LLM and embedding models');
      return;
    }

    // Validate that selected models are in the available models list
    const llmModel = availableModels.find((m) => m.path === selectedLLM);
    const embeddingModel = availableModels.find((m) => m.path === selectedEmbedding);

    if (!llmModel) {
      setError('Selected LLM model is not available. Please scan for models.');
      return;
    }

    if (!embeddingModel) {
      setError('Selected embedding model is not available. Please scan for models.');
      return;
    }

    // Warn if using same model for both (not recommended but allowed)
    if (selectedLLM === selectedEmbedding) {
      // This is allowed but we'll just log it
      console.warn('[ModelPicker] Using same model for LLM and embeddings');
    }

    setIsSaving(true);
    setError(null);
    try {
      await setModelPreferences(selectedLLM, selectedEmbedding);
      setSuccess('Model preferences saved successfully. Restart the app or reinitialize AI services to use the new models.');
      setTimeout(() => {
        setSuccess(null);
        onOpenChange(false);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const llmModels = availableModels.filter((m) => m.capabilities.canDoLLM);
  const embeddingModels = availableModels.filter((m) => m.capabilities.canDoEmbeddings);

  const getModelDisplayName = (modelPath: string) => {
    const model = availableModels.find((m) => m.path === modelPath);
    if (!model) return modelPath;
    return `${model.filename} (${model.sizeGB}GB)`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>AI Model Configuration</DialogTitle>
          <DialogDescription>
            Select the models to use for LLM generation and embeddings. Models are automatically detected from the models directory.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Models Directory Section */}
          <div className="space-y-2">
            <Label>Models Directory</Label>
            <div className="flex gap-2">
              <Input
                value={currentModelsDirectory || 'Loading...'}
                readOnly
                className="flex-1 text-xs bg-muted"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleBrowse}
                disabled={isBrowsing}
                title="Browse for models folder"
              >
                {isBrowsing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FolderOpen className="w-4 h-4" />
                )}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {customModelsPath && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUseDefault}
                  disabled={isClearing}
                  className="text-xs h-7"
                >
                  {isClearing ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3 h-3 mr-1" />
                  )}
                  Use Default
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                {customModelsPath ? 'Using custom directory' : 'Using default directory'}
              </p>
            </div>
          </div>

          {/* LLM Model Selection */}
          <div className="space-y-2">
            <Label htmlFor="llm-select">LLM Model</Label>
            <Select
              id="llm-select"
              value={selectedLLM}
              onChange={(e) => setSelectedLLM(e.target.value)}
              disabled={llmModels.length === 0}
            >
              <option value="">Select LLM model...</option>
              {llmModels.map((model) => (
                <option key={model.path} value={model.path}>
                  {model.filename} ({model.sizeGB}GB)
                </option>
              ))}
            </Select>
            {selectedLLM && (
              <p className="text-xs text-muted-foreground">
                Selected: {getModelDisplayName(selectedLLM)}
              </p>
            )}
            {llmModels.length === 0 && (
              <p className="text-xs text-amber-600">
                No LLM-capable models found. Scan for models or add models to the models directory.
              </p>
            )}
          </div>

          {/* Embedding Model Selection */}
          <div className="space-y-2">
            <Label htmlFor="embedding-select">Embedding Model</Label>
            <Select
              id="embedding-select"
              value={selectedEmbedding}
              onChange={(e) => setSelectedEmbedding(e.target.value)}
              disabled={embeddingModels.length === 0}
            >
              <option value="">Select embedding model...</option>
              {embeddingModels.map((model) => (
                <option key={model.path} value={model.path}>
                  {model.filename} ({model.sizeGB}GB)
                </option>
              ))}
            </Select>
            {selectedEmbedding && (
              <p className="text-xs text-muted-foreground">
                Selected: {getModelDisplayName(selectedEmbedding)}
              </p>
            )}
            {embeddingModels.length === 0 && (
              <p className="text-xs text-amber-600">
                No embedding-capable models found. Scan for models or add models to the models directory.
              </p>
            )}
          </div>

          {/* Model Count Info */}
          {availableModels.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Found {availableModels.length} model(s) in models directory
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded">
              <Save className="w-4 h-4" />
              {success}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={handleScan}
              disabled={isScanning}
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Scan for Models
                </>
              )}
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !selectedLLM || !selectedEmbedding}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
