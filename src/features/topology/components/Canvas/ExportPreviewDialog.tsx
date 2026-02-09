import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, Edit, X } from 'lucide-react';

interface ExportPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onRedraw: () => void;
  bounds: { x: number; y: number; width: number; height: number };
  previewImage?: string;
  isExporting: boolean;
}

export const ExportPreviewDialog = ({
  isOpen,
  onClose,
  onConfirm,
  onRedraw,
  bounds,
  previewImage,
  isExporting,
}: ExportPreviewDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Export Preview</DialogTitle>
          <DialogDescription>
            Review your capture area selection before exporting.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Preview Image */}
          {previewImage && (
            <div className="border-2 border-purple-200 dark:border-purple-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
              <img 
                src={previewImage} 
                alt="Export preview" 
                className="w-full h-auto max-h-64 object-contain"
              />
            </div>
          )}

          {/* Preview info */}
          <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Camera className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-sm text-purple-900 dark:text-purple-100 mb-1">
                  Capture Area Selected
                </h4>
                <p className="text-xs text-purple-700 dark:text-purple-300 mb-2">
                  This area will be saved and used for all future PNG exports until you redraw it.
                </p>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-purple-600 dark:text-purple-400 font-mono">
                    {Math.round(bounds.width)} × {Math.round(bounds.height)} px
                  </span>
                  <span className="text-purple-500 dark:text-purple-500 text-xs">
                    Position: ({Math.round(bounds.x)}, {Math.round(bounds.y)})
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>✓ Confirm Export:</strong> Export this area now and save for future exports
            </p>
            <p>
              <strong>✏ Redraw Selection:</strong> Choose a different area
            </p>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isExporting}
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          
          <Button
            variant="secondary"
            onClick={onRedraw}
            disabled={isExporting}
          >
            <Edit className="w-4 h-4 mr-2" />
            Redraw Selection
          </Button>
          
          <Button
            onClick={onConfirm}
            disabled={isExporting}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Camera className="w-4 h-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Confirm & Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

