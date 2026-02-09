// Narrative Review Modal
// Shows AI-generated narrative for user review and approval

import { useState, useEffect } from 'react';
import type { RAGResponse } from '@/lib/ai/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface NarrativeReviewModalProps {
  isOpen: boolean;
  controlId: string;
  controlTitle: string;
  response: RAGResponse | null;
  onAccept: (narrative: string) => void;
  onReject: () => void;
  onRegenerate: () => void;
  isRegenerating?: boolean;
}

export function NarrativeReviewModal({
  isOpen,
  controlId,
  controlTitle,
  response,
  onAccept,
  onReject,
  onRegenerate,
  isRegenerating = false,
}: NarrativeReviewModalProps) {
  const [editedNarrative, setEditedNarrative] = useState('');

  // Update edited narrative when response changes
  useEffect(() => {
    if (response?.narrative) {
      setEditedNarrative(response.narrative);
    }
  }, [response]);

  const handleAccept = () => {
    onAccept(editedNarrative);
  };

  const hasChanges = editedNarrative !== (response?.narrative || '');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onReject()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Review AI-Generated Narrative</span>
            <span className="text-sm font-normal text-muted-foreground">
              {controlId} - {controlTitle}
            </span>
          </DialogTitle>
          <DialogDescription>
            Review and edit the AI-generated narrative before accepting it. You can modify the text as needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">
                Human Review Required
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Please review and edit the AI-generated narrative before accepting. 
                Verify that all device names and security configurations are accurate.
              </p>
            </div>
          </div>

          {/* Narrative Editor */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Narrative Text (editable)
            </label>
            <Textarea
              value={editedNarrative}
              onChange={(e) => setEditedNarrative(e.target.value)}
              rows={12}
              className="font-mono text-sm"
              placeholder="AI-generated narrative will appear here..."
            />
            {hasChanges && (
              <p className="text-xs text-muted-foreground mt-1">
                You have made changes to the original AI-generated text
              </p>
            )}
          </div>

          {/* References */}
          {response?.references && response.references.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Source References</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {response.references.map((ref, index) => (
                    <div key={index} className="text-xs border-l-2 border-blue-200 pl-2">
                      <div className="font-medium">{ref.reason}</div>
                      <div className="text-muted-foreground">Chunk ID: {ref.chunkId}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Metadata */}
          {response && (
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Tokens used: {response.tokensUsed}</div>
              <div>Retrieved chunks: {response.retrievedChunks?.length || 0}</div>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onRegenerate}
              disabled={isRegenerating}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRegenerating ? 'animate-spin' : ''}`} />
              Regenerate
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onReject}>
              <XCircle className="w-4 h-4 mr-2" />
              Reject
            </Button>
            <Button
              onClick={handleAccept}
              disabled={!editedNarrative.trim() || isRegenerating}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Accept & Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

