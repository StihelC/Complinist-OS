/**
 * Unedited Controls Mode Widget
 * Custom widget for selecting how to handle controls without custom narratives
 * Includes AI enhancement option
 */

import { useState } from 'react';
import { WidgetProps } from '@rjsf/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, CheckCircle, MinusCircle, Sparkles, Loader2, Check, X, RefreshCw } from 'lucide-react';
import type { AppNode, AppEdge } from '@/lib/utils/types';
import { useSSPMetadataStore } from '@/core/stores/sspMetadataStore';
import { useControlNarrativesStore } from '@/core/stores/useControlNarrativesStore';
import { enhanceNarrativesWithAI } from '@/lib/ai/narrativeEnhancer';

interface UneditedControlsModeWidgetProps extends WidgetProps {
  nodes?: AppNode[];
  edges?: AppEdge[];
}

interface Option {
  value: string;
  title: string;
  description: string;
  getExamples: (deviceCount: number, boundaryCount: number) => string[];
  icon: React.ComponentType<{ className?: string }>;
  borderColor: string;
  recommended?: boolean;
}

/**
 * Generate topology-aware placeholder examples for different control families
 */
function generatePlaceholderExamples(deviceCount: number, boundaryCount: number): string[] {
  if (deviceCount === 0 && boundaryCount === 0) {
    return [
      'AC-2: Access control is implemented across all system components. Authentication and authorization mechanisms enforce least privilege principles.',
    ];
  }

  return [
    `AC-2: Access control is implemented across ${deviceCount} system component${deviceCount !== 1 ? 's' : ''} within ${boundaryCount} security zone${boundaryCount !== 1 ? 's' : ''}. Authentication and authorization mechanisms enforce least privilege principles.`,
    `SC-7: Communications protection is enforced across ${boundaryCount} security zone${boundaryCount !== 1 ? 's' : ''} with controlled network connections. Boundary protection and encryption protect system communications.`,
    `CM-8: Configuration management applies to all ${deviceCount} system components. Baseline configurations are documented and changes are controlled.`,
  ];
}

const getOptions = (deviceCount: number, boundaryCount: number): Option[] => [
  {
    value: 'placeholder',
    title: 'Auto-Generated Placeholder Text (Recommended)',
    description: `Generates control-specific implementation statements referencing your ${deviceCount} device${deviceCount !== 1 ? 's' : ''} and ${boundaryCount} security zone${boundaryCount !== 1 ? 's' : ''}. Each control family (AC, SC, CM, etc.) gets relevant narrative text describing how your topology implements that control.`,
    getExamples: generatePlaceholderExamples,
    icon: CheckCircle,
    borderColor: 'border-green-200 hover:border-green-400',
    recommended: true,
  },
  {
    value: 'nist_text',
    title: 'NIST 800-53 Official Control Text',
    description: 'Includes the complete official NIST control description from the baseline. Provides full technical requirements but does not describe your specific implementation. May appear generic to auditors.',
    getExamples: () => ['AC-2: The organization: a. Identifies and selects the following types of information system accounts...'],
    icon: FileText,
    borderColor: 'border-blue-200 hover:border-blue-400',
  },
  {
    value: 'exclude',
    title: 'Exclude from SSP Document',
    description: 'Controls without custom narratives will be completely omitted from the SSP. WARNING: This creates compliance documentation gaps. Only use if you plan to document these controls elsewhere.',
    getExamples: () => ['[Control not included in this SSP document]'],
    icon: MinusCircle,
    borderColor: 'border-red-200 hover:border-red-400',
  },
];

export const UneditedControlsModeWidget: React.FC<UneditedControlsModeWidgetProps> = ({
  value,
  onChange,
  id,
  required,
  nodes = [],
  edges = [],
}) => {
  const [showSuccess, setShowSuccess] = useState(false);

  const {
    enhancedNarratives,
    isEnhancing,
    enhancementError,
    setEnhancedNarratives,
    setIsEnhancing,
    setEnhancementError,
    clearEnhancedNarratives,
  } = useSSPMetadataStore();

  const { items: controlItems, updateNarrative } = useControlNarrativesStore();

  const handleChange = (newValue: string) => {
    onChange(newValue);
  };

  const handleEnhance = async () => {
    setIsEnhancing(true);
    setEnhancementError(null);

    try {
      const narratives = await enhanceNarrativesWithAI(nodes, edges);

      if (narratives) {
        setEnhancedNarratives(narratives);

        // Also update control narratives store for controls without custom narratives
        Object.entries(controlItems).forEach(([controlId, control]) => {
          if (!control.isCustom && !control.system_implementation?.trim()) {
            const family = controlId.split('-')[0].toUpperCase();
            const enhancedText = narratives[family];
            if (enhancedText) {
              updateNarrative(controlId, enhancedText);
            }
          }
        });

        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        setEnhancementError('Failed to generate enhanced narratives. Please ensure AI service is running.');
      }
    } catch (error) {
      console.error('[UneditedControlsModeWidget] Enhancement failed:', error);
      setEnhancementError(
        error instanceof Error ? error.message : 'Enhancement failed. Please try again.'
      );
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleClear = () => {
    clearEnhancedNarratives();
  };

  // Calculate topology stats for dynamic examples
  const deviceCount = nodes.filter(n => n.type === 'device' || !n.type).length;
  const boundaryCount = nodes.filter(n => n.type === 'boundary').length;
  const options = getOptions(deviceCount, boundaryCount);
  const hasTopology = nodes.length > 0;
  const familyCount = enhancedNarratives ? Object.keys(enhancedNarratives).length : 0;

  return (
    <div className="space-y-4">
      {/* Radio Options */}
      <div className="space-y-3">
        {options.map((option) => {
          const Icon = option.icon;
          const isSelected = value === option.value;
          const examples = option.getExamples(deviceCount, boundaryCount);

          return (
            <label
              key={option.value}
              className={`block p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : `${option.borderColor} bg-white hover:shadow-md`
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  id={`${id}-${option.value}`}
                  name={id}
                  value={option.value}
                  checked={isSelected}
                  onChange={() => handleChange(option.value)}
                  required={required}
                  className="w-4 h-4 mt-1 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-5 h-5 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`} />
                    <span className={`font-semibold ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                      {option.title}
                    </span>
                    {option.recommended && (
                      <Badge variant="default" className="bg-green-600 text-white">
                        Recommended
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{option.description}</p>
                  <div className="text-xs bg-gray-100 p-2 rounded border-l-2 border-gray-400 font-mono space-y-1">
                    <span className="font-medium text-gray-700">Example outputs:</span>
                    {examples.map((example, idx) => (
                      <div key={idx} className="text-gray-600 pl-2 border-l border-gray-300 ml-1">
                        {example}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {/* AI Enhancement Section - Only show when placeholder is selected */}
      {value === 'placeholder' && (
        <div className="rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-purple-100 p-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-purple-900">AI-Enhanced Narratives</h3>
              <p className="text-sm text-purple-700 mt-1">
                {enhancedNarratives
                  ? `Enhanced narratives active for ${familyCount} control families. These will be used for controls without custom text.`
                  : 'Use AI to generate more detailed, contextual implementation narratives based on your topology. Enhanced narratives will also appear in the Control Narratives tab.'}
              </p>

              {enhancementError && (
                <div className="mt-2 text-sm text-red-600 bg-red-50 rounded p-2 border border-red-200">
                  {enhancementError}
                </div>
              )}

              {showSuccess && (
                <div className="mt-2 text-sm text-green-600 bg-green-50 rounded p-2 border border-green-200 flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Successfully enhanced {familyCount} control families! Narratives also updated in Control Narratives tab.
                </div>
              )}

              {/* Show loading progress */}
              {isEnhancing && (
                <div className="mt-3 p-3 bg-purple-100 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2 text-purple-800">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm font-medium">Analyzing topology and generating narratives...</span>
                  </div>
                  <p className="text-xs text-purple-600 mt-1">
                    This may take 30-60 seconds. The AI is creating custom implementation text for each control family based on your {deviceCount} devices and {boundaryCount} security zones.
                  </p>
                </div>
              )}

              {/* Show generated narratives preview */}
              {enhancedNarratives && !isEnhancing && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs font-medium text-purple-800 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Generated Narratives Preview:
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2 text-xs">
                    {Object.entries(enhancedNarratives).slice(0, 5).map(([family, narrative]) => (
                      <div key={family} className="bg-white rounded p-2 border border-purple-100">
                        <span className="font-semibold text-purple-700">{family}:</span>{' '}
                        <span className="text-gray-700">
                          {narrative.length > 200 ? `${narrative.substring(0, 200)}...` : narrative}
                        </span>
                      </div>
                    ))}
                    {Object.keys(enhancedNarratives).length > 5 && (
                      <div className="text-purple-600 text-center py-1">
                        + {Object.keys(enhancedNarratives).length - 5} more control families
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-3 flex items-center gap-2">
                {!enhancedNarratives ? (
                  <Button
                    onClick={handleEnhance}
                    disabled={isEnhancing || !hasTopology}
                    variant="default"
                    size="sm"
                    type="button"
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {isEnhancing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Enhancing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Enhance with AI
                      </>
                    )}
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handleEnhance}
                      disabled={isEnhancing || !hasTopology}
                      variant="outline"
                      size="sm"
                      type="button"
                    >
                      {isEnhancing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Regenerating...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Regenerate
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleClear}
                      disabled={isEnhancing}
                      variant="ghost"
                      size="sm"
                      type="button"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  </>
                )}

                {!hasTopology && (
                  <span className="text-xs text-amber-600">
                    Add devices to your topology first
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
