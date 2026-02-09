/**
 * Topology Capture Widget
 * Custom widget for react-jsonschema-form to capture network topology as SVG
 * Enhanced with quality indicators and better feedback
 */

import { useState } from 'react';
import { WidgetProps } from '@rjsf/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, Check, AlertCircle, Info } from 'lucide-react';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { useSSPMetadataStore } from '@/core/stores/sspMetadataStore';
import { captureTopologyAsBase64 } from '@/lib/topologyCapture';

interface TopologyCaptureWidgetProps extends WidgetProps {
  onSwitchToTopology?: () => void;
}

export const TopologyCaptureWidget: React.FC<TopologyCaptureWidgetProps> = ({
  value,
  onChange,
  onSwitchToTopology: _onSwitchToTopology,
}) => {
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [imageQuality, setImageQuality] = useState<{ sizeKB: number } | null>(null);
  const currentProject = useFlowStore((state) => state.currentProject);
  const { updateMetadata, saveMetadata } = useSSPMetadataStore();

  const handleCaptureClick = async () => {
    setCaptureError(null);
    setIsCapturing(true);
    
    try {
      console.log('[TopologyWidget] Starting SVG capture...');

      // Capture topology as SVG directly
      const base64Svg = await captureTopologyAsBase64();

      if (!base64Svg) {
        throw new Error('Failed to capture topology as SVG');
      }

      console.log('[TopologyWidget] SVG capture successful');

      // Calculate quality metrics
      const sizeBytes = (base64Svg.length * 3) / 4; // Approximate decoded size
      const sizeKB = Math.round(sizeBytes / 1024);
      
      setImageQuality({ sizeKB });
      console.log('[TopologyWidget] SVG size:', sizeKB, 'KB');

      // Update form value
      onChange(base64Svg);

      // Save to metadata store for persistence
      if (currentProject?.id) {
        updateMetadata({ topology_screenshot: base64Svg });
        await saveMetadata(currentProject.id);
      }

      setCaptureError(null);
    } catch (error) {
      console.error('[TopologyWidget] Capture failed:', error);
      setCaptureError(error instanceof Error ? error.message : 'Capture failed');
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">Network Topology Diagram</span>
        </div>
        <Button 
          onClick={handleCaptureClick} 
          variant="outline" 
          size="sm" 
          type="button"
          disabled={isCapturing}
        >
          {isCapturing ? (
            <>
              <Camera className="w-4 h-4 mr-2 animate-pulse" />
              Capturing...
            </>
          ) : (
            <>
              <Camera className="w-4 h-4 mr-2" />
              {value ? 'Update Diagram' : 'Capture Diagram'}
            </>
          )}
        </Button>
      </div>

      {captureError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
          <p className="text-sm text-red-700">{captureError}</p>
        </div>
      )}

      {value ? (
        <div className="space-y-3">
          <img
            src={`data:image/svg+xml;base64,${value}`}
            alt="Network Topology"
            className="w-full border-2 border-gray-200 rounded-lg max-h-64 object-contain bg-gray-50 shadow-sm"
            onError={(_e) => {
              console.error('[TopologyWidget] Failed to load SVG');
              setCaptureError('Failed to load topology preview');
            }}
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <Check className="w-4 h-4" />
              <span>This diagram will be included in Section 2.1 of your SSP</span>
            </div>
            {imageQuality && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  SVG · {imageQuality.sizeKB} KB
                </Badge>
              </div>
            )}
          </div>
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              SVG format ensures your network diagram appears crisp and clear at any zoom level in the final SSP document.
            </p>
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed border-purple-300 rounded-lg p-8 text-center bg-purple-50/50">
          <Camera className="w-12 h-12 mx-auto text-purple-400 mb-3" />
          <p className="text-sm font-semibold text-gray-700 mb-1">No Topology Diagram</p>
          <p className="text-xs text-gray-600 mb-3">
            Click "Capture Diagram" to export your network topology as a vector graphic
          </p>
          <p className="text-xs text-purple-600 font-medium">
            → SVG format provides infinite zoom without quality loss
          </p>
        </div>
      )}
    </div>
  );
};

