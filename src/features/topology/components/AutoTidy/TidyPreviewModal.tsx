import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Check, X, ArrowRight, AlertTriangle } from 'lucide-react';
import { TidyResult } from './TidyStatusIndicator';

export interface TidyPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  onCancel: () => void;
  beforeSnapshot?: string; // Base64 image of before state
  afterSnapshot?: string; // Base64 image of after state
  result: TidyResult | null;
  isProcessing?: boolean;
}

export const TidyPreviewModal = ({
  isOpen,
  onClose,
  onAccept,
  onCancel,
  beforeSnapshot,
  afterSnapshot,
  result,
  isProcessing = false,
}: TidyPreviewModalProps) => {
  const qualityColor = result?.qualityScore
    ? result.qualityScore >= 80
      ? 'text-green-600'
      : result.qualityScore >= 50
        ? 'text-yellow-600'
        : 'text-red-600'
    : 'text-gray-500';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px]" data-testid="tidy-preview-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Auto-Tidy Preview
            {isProcessing && <Spinner size="sm" />}
          </DialogTitle>
          <DialogDescription>
            Preview the layout changes before applying them to your diagram.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Before/After Comparison */}
          <div className="grid grid-cols-2 gap-4">
            {/* Before */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Before</span>
                {result && (
                  <Badge variant="outline" className="text-xs">
                    {result.collisionsBefore} overlaps
                  </Badge>
                )}
              </div>
              <div className="aspect-[4/3] bg-gray-100 rounded-lg border overflow-hidden flex items-center justify-center">
                {beforeSnapshot ? (
                  <img
                    src={beforeSnapshot}
                    alt="Before tidy"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">Original layout</span>
                )}
              </div>
            </div>

            {/* After */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">After</span>
                {result && (
                  <Badge
                    variant={result.collisionsResolved > 0 ? 'default' : 'outline'}
                    className="text-xs"
                  >
                    {result.collisionsBefore - result.collisionsResolved} overlaps
                  </Badge>
                )}
              </div>
              <div className="aspect-[4/3] bg-gray-100 rounded-lg border overflow-hidden flex items-center justify-center">
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-2">
                    <Spinner size="lg" />
                    <span className="text-sm text-muted-foreground">Processing...</span>
                  </div>
                ) : afterSnapshot ? (
                  <img
                    src={afterSnapshot}
                    alt="After tidy"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">Tidied layout</span>
                )}
              </div>
            </div>
          </div>

          {/* Results Summary */}
          {result && !isProcessing && (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-6">
                {/* Node Count */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Nodes:</span>
                  <span className="font-medium">
                    {result.nodesBefore}
                    {result.nodesBefore !== result.nodesAfter && (
                      <>
                        <ArrowRight className="w-3 h-3 inline mx-1" />
                        {result.nodesAfter}
                      </>
                    )}
                  </span>
                </div>

                {/* Collisions Resolved */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Resolved:</span>
                  <span className="font-medium text-green-600">
                    {result.collisionsResolved} overlap{result.collisionsResolved !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Quality Score */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Quality:</span>
                  <span className={`font-medium ${qualityColor}`}>
                    {result.qualityScore}/100
                  </span>
                </div>

                {/* Duration */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Time:</span>
                  <span className="font-medium">
                    {result.duration < 1000
                      ? `${Math.round(result.duration)}ms`
                      : `${(result.duration / 1000).toFixed(1)}s`}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Warning if quality is low */}
          {result && result.qualityScore < 50 && !isProcessing && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <strong>Low quality score.</strong> Consider adjusting spacing options or
                manually repositioning some nodes for better results.
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isProcessing}
            data-testid="tidy-preview-cancel"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={onAccept}
            disabled={isProcessing}
            data-testid="tidy-preview-accept"
          >
            <Check className="w-4 h-4 mr-2" />
            Accept Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
