/**
 * SSP Generator Component
 * Single-page form for SSP generation with enhanced visual design
 *
 * Features:
 * - Auto-populate metadata from organization defaults
 * - Save/load SSP templates for reuse across projects
 * - Bulk control selection based on baseline + topology analysis
 */

import { useState, useEffect, useCallback } from 'react';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import type { ErrorListProps, RJSFValidationError } from '@rjsf/utils';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, CheckCircle2, AlertCircle, Eye, Save } from 'lucide-react';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { useSSPMetadataStore } from '@/core/stores/sspMetadataStore';
import { useControlSelectionStore } from '@/core/stores/useControlSelectionStore';
import { useControlNarrativesStore } from '@/core/stores/useControlNarrativesStore';
import { buildSSPDocument, generateSSPFromDocument, previewSSPDocument, checkElectronAPIAvailability } from '@/lib/ssp/sspGenerator';
import { combinedSchema, combinedUiSchema, SSPFormData } from './SSPFormSchema';
import { TopologyCaptureWidget } from './widgets/TopologyCaptureWidget';
import { ControlSelectionWidget } from './widgets/ControlSelectionWidget';
import { ControlStatusWidget } from './widgets/ControlStatusWidget';
import { UneditedControlsModeWidget } from './widgets/UneditedControlsModeWidget';
import type { SSPGenerationRequest } from '@/lib/utils/types';

interface SSPWizardProps {
  isOpen: boolean;
  onClose: () => void;
  inline?: boolean;
  activeView?: string;
  onSwitchToTopology?: () => void;
}

export const SSPWizard: React.FC<SSPWizardProps> = ({
  isOpen,
  onClose,
  inline = false,
  activeView,
  onSwitchToTopology,
}) => {
  const [formData, setFormData] = useState<Partial<SSPFormData>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<{ saving: boolean; saved: boolean; error: boolean }>({
    saving: false,
    saved: false,
    error: false,
  });
  const [electronAPIAvailable, setElectronAPIAvailable] = useState<boolean | null>(null);
  const [_expandedSections, _setExpandedSections] = useState<Set<string>>(new Set(['basic', 'system']));

  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const currentProject = useFlowStore((state) => state.currentProject);

  const { metadata: _savedMetadata, loadMetadata, updateMetadata, saveMetadata, enhancedNarratives } = useSSPMetadataStore();
  const { selectedControlIds } = useControlSelectionStore();


  // Check Electron API availability on mount
  useEffect(() => {
    const checkAPI = () => {
      const check = checkElectronAPIAvailability();
      setElectronAPIAvailable(check.available);
      if (!check.available && isOpen) {
        setMessage({
          type: 'error',
          text: check.error || 'PDF generation requires the desktop application.',
        });
      }
    };
    checkAPI();
  }, [isOpen]);


  // Section toggle handler - unused but kept for potential future use
  // const _toggleSection = useCallback((sectionId: string) => {
  //   _setExpandedSections(prev => {
  //     const newSet = new Set(prev);
  //     if (newSet.has(sectionId)) {
  //       newSet.delete(sectionId);
  //     } else {
  //       newSet.add(sectionId);
  //     }
  //     return newSet;
  //   });
  // }, []);

  // Load saved metadata on mount and whenever view switches to SSP
  useEffect(() => {
    if (isOpen && currentProject?.id && activeView === 'ssp') {
      console.log('[SSPWizard] Loading fresh metadata from database...');
      loadMetadata(currentProject.id).then(() => {
        // Get the fresh metadata from the store after loading
        const freshMetadata = useSSPMetadataStore.getState().metadata;
        if (freshMetadata) {
          // Map saved metadata to form data
          setFormData({
            system_name: currentProject?.name || freshMetadata.system_name || '',
            organization_name: freshMetadata.organization_name || '',
            prepared_by: freshMetadata.prepared_by || '',
            baseline: currentProject?.baseline || freshMetadata.baseline || 'MODERATE',
            system_description: freshMetadata.system_description || '',
            system_purpose: freshMetadata.system_purpose || '',
            deployment_model: freshMetadata.deployment_model || 'on-premises',
            service_model: freshMetadata.service_model || 'on-premises',
            cloud_provider: freshMetadata.cloud_provider || '',
            on_premises_details: freshMetadata.on_premises_details ? {
              data_center_location: freshMetadata.on_premises_details.data_center_location || '',
              physical_security_description: freshMetadata.on_premises_details.physical_security_description || '',
              server_infrastructure: freshMetadata.on_premises_details.server_infrastructure || '',
              network_infrastructure: freshMetadata.on_premises_details.network_infrastructure || '',
              backup_systems: freshMetadata.on_premises_details.backup_systems || '',
              disaster_recovery: freshMetadata.on_premises_details.disaster_recovery || '',
            } : undefined,
            physical_location: freshMetadata.physical_location || '',
            information_type_title: freshMetadata.information_type_title || '',
            information_type_description: freshMetadata.information_type_description || '',
            data_types_processed: freshMetadata.data_types_processed || '',
            users_description: freshMetadata.users_description || '',
            confidentiality_impact: freshMetadata.confidentiality_impact || 'moderate',
            integrity_impact: freshMetadata.integrity_impact || 'moderate',
            availability_impact: freshMetadata.availability_impact || 'moderate',
            authorization_boundary_description: freshMetadata.authorization_boundary_description || '',
            system_status: freshMetadata.system_status || 'operational',
            system_owner: freshMetadata.system_owner || '',
            system_owner_email: freshMetadata.system_owner_email || '',
            authorizing_official: freshMetadata.authorizing_official || '',
            authorizing_official_email: freshMetadata.authorizing_official_email || '',
            security_contact: freshMetadata.security_contact || '',
            security_contact_email: freshMetadata.security_contact_email || '',
            topology_screenshot: freshMetadata.topology_screenshot || '',
            // unedited_controls_mode is part of SSPGenerationRequest, not SSPSystemCharacteristics
            custom_sections: freshMetadata.custom_sections || [],
          });
          console.log('[SSPWizard] Metadata loaded successfully');
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentProject?.id, activeView]);

  // Save metadata when component unmounts or view switches away
  useEffect(() => {
    return () => {
      // Cleanup: save on unmount
      if (currentProject?.id && formData && Object.keys(formData).length > 0) {
        console.log('[SSPWizard] Saving metadata on unmount...');
        updateMetadata(formData as any);
        saveMetadata(currentProject.id).catch((error) => {
          console.error('[SSPWizard] Failed to save metadata on unmount:', error);
        });
      }
    };
  }, [currentProject?.id, formData, updateMetadata, saveMetadata]);

  // Custom widgets
  const widgets = {
    topologyCapture: (props: any) => (
      <TopologyCaptureWidget {...props} onSwitchToTopology={onSwitchToTopology} />
    ),
    controlSelector: (props: any) => (
      <ControlSelectionWidget {...props} baseline={formData.baseline} />
    ),
    controlStatus: (props: any) => <ControlStatusWidget {...props} baseline={formData.baseline} />,
    uneditedControlsMode: (props: any) => <UneditedControlsModeWidget {...props} nodes={nodes} edges={edges} />,
  };

  const handleFormChange = useCallback(({ formData: newData }: { formData?: Partial<SSPFormData> }) => {
    if (newData) {
      setFormData(newData);
    }
  }, []);

  
  const handleFormSubmit = useCallback((e: any) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
  }, []);

  // Handle field blur - save metadata immediately
  const handleFieldBlur = useCallback(async (_id: string, _value: any) => {
    if (!currentProject?.id) return;
    
    console.log('[SSPWizard] Field blurred, saving metadata...');
    setSaveStatus({ saving: true, saved: false, error: false });
    
    // Update store with current form data
    updateMetadata(formData as any);
    
    // Save to database
    try {
      await saveMetadata(currentProject.id);
      console.log('[SSPWizard] Metadata saved on blur');
      setSaveStatus({ saving: false, saved: true, error: false });
      // Clear saved status after 2 seconds
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, saved: false }));
      }, 2000);
    } catch (error) {
      console.error('[SSPWizard] Failed to save metadata on blur:', error);
      setSaveStatus({ saving: false, saved: false, error: true });
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, error: false }));
      }, 3000);
    }
  }, [currentProject?.id, formData, updateMetadata, saveMetadata]);

  // Handle close - save metadata before closing
  const handleClose = useCallback(async () => {
    if (currentProject?.id && formData && Object.keys(formData).length > 0) {
      console.log('[SSPWizard] Saving metadata before close...');
      updateMetadata(formData as any);
      try {
        await saveMetadata(currentProject.id);
        console.log('[SSPWizard] Metadata saved on close');
      } catch (error) {
        console.error('[SSPWizard] Failed to save metadata on close:', error);
      }
    }
    onClose();
  }, [currentProject?.id, formData, updateMetadata, saveMetadata, onClose]);

  const handlePreview = async () => {
    setIsPreviewing(true);
    setMessage(null);

    try {
      // Get custom narratives from store
      const narrativeState = useControlNarrativesStore.getState();
      let customNarratives: Record<string, any> | undefined;

      if (narrativeState.baseline === formData.baseline) {
        const narratives = narrativeState.getNarrativesForBaseline();
        const entries = Object.values(narratives)
          .filter((control) => control.isCustom)
          .reduce<Record<string, any>>((acc, control) => {
            acc[control.control_id] = {
              narrative: control.system_implementation || control.narrative,
              implementation_status: control.implementation_status,
              referenced_devices: control.referencedDevices,
              referenced_boundaries: control.referencedBoundaries,
            };
            return acc;
          }, {});

        if (Object.keys(entries).length > 0) {
          customNarratives = entries;
        }
      }

      // Normalize email fields
      const normalizeEmailField = (email: any): string => {
        if (email == null) return '';
        const str = String(email).trim();
        return str === 'null' || str === 'undefined' || str === 'NaN' ? '' : str;
      };

      // Build SSP request
      const sspRequest: SSPGenerationRequest = {
        system_name: formData.system_name || '',
        organization_name: formData.organization_name || '',
        prepared_by: formData.prepared_by || '',
        baseline: formData.baseline || 'MODERATE',
        system_description: formData.system_description || '',
        system_purpose: formData.system_purpose || '',
        deployment_model: formData.deployment_model || 'on-premises',
        service_model: formData.service_model || 'on-premises',
        cloud_provider: formData.cloud_provider || '',
        on_premises_details: formData.on_premises_details,
        physical_location: formData.physical_location || '',
        information_type_title: formData.information_type_title || '',
        information_type_description: formData.information_type_description || '',
        data_types_processed: formData.data_types_processed || '',
        users_description: formData.users_description || '',
        confidentiality_impact: formData.confidentiality_impact || 'moderate',
        integrity_impact: formData.integrity_impact || 'moderate',
        availability_impact: formData.availability_impact || 'moderate',
        authorization_boundary_description: formData.authorization_boundary_description || '',
        system_status: formData.system_status || 'operational',
        system_owner: formData.system_owner || '',
        system_owner_email: normalizeEmailField(formData.system_owner_email),
        authorizing_official: formData.authorizing_official || '',
        authorizing_official_email: normalizeEmailField(formData.authorizing_official_email),
        security_contact: formData.security_contact || '',
        security_contact_email: normalizeEmailField(formData.security_contact_email),
        topology_image: formData.topology_screenshot,
        topology_screenshot: formData.topology_screenshot,
        unedited_controls_mode: formData.unedited_controls_mode || 'placeholder',
        custom_narratives: customNarratives,
        project_id: currentProject?.id,
        selected_control_ids: selectedControlIds,
        custom_sections: formData.custom_sections,
        enhanced_narratives: enhancedNarratives || undefined,
      };

      // Generate SSP document
      const sspDoc = await buildSSPDocument(
        sspRequest,
        nodes,
        edges,
        formData.topology_screenshot
      );

      await previewSSPDocument(sspDoc);
      setMessage({ type: 'success', text: 'SSP preview opened in new window!' });
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    } catch (error) {
      console.error('[SSPWizard] Failed to preview SSP:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to preview SSP. Please try again.';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setMessage(null);

    try {
      // Get custom narratives from store
      const narrativeState = useControlNarrativesStore.getState();
      let customNarratives: Record<string, any> | undefined;

      if (narrativeState.baseline === formData.baseline) {
        const narratives = narrativeState.getNarrativesForBaseline();
        const entries = Object.values(narratives)
          .filter((control) => control.isCustom)
          .reduce<Record<string, any>>((acc, control) => {
            acc[control.control_id] = {
              narrative: control.system_implementation || control.narrative,
              implementation_status: control.implementation_status,
              referenced_devices: control.referencedDevices,
              referenced_boundaries: control.referencedBoundaries,
            };
            return acc;
          }, {});

        if (Object.keys(entries).length > 0) {
          customNarratives = entries;
        }
      }

      // Normalize email fields
      const normalizeEmailField = (email: any): string => {
        if (email == null) return '';
        const str = String(email).trim();
        return str === 'null' || str === 'undefined' || str === 'NaN' ? '' : str;
      };

      // Build SSP request
      const sspRequest: SSPGenerationRequest = {
        system_name: formData.system_name || '',
        organization_name: formData.organization_name || '',
        prepared_by: formData.prepared_by || '',
        baseline: formData.baseline || 'MODERATE',
        system_description: formData.system_description || '',
        system_purpose: formData.system_purpose || '',
        deployment_model: formData.deployment_model || 'on-premises',
        service_model: formData.service_model || 'on-premises',
        cloud_provider: formData.cloud_provider || '',
        on_premises_details: formData.on_premises_details,
        physical_location: formData.physical_location || '',
        information_type_title: formData.information_type_title || '',
        information_type_description: formData.information_type_description || '',
        data_types_processed: formData.data_types_processed || '',
        users_description: formData.users_description || '',
        confidentiality_impact: formData.confidentiality_impact || 'moderate',
        integrity_impact: formData.integrity_impact || 'moderate',
        availability_impact: formData.availability_impact || 'moderate',
        authorization_boundary_description: formData.authorization_boundary_description || '',
        system_status: formData.system_status || 'operational',
        system_owner: formData.system_owner || '',
        system_owner_email: normalizeEmailField(formData.system_owner_email),
        authorizing_official: formData.authorizing_official || '',
        authorizing_official_email: normalizeEmailField(formData.authorizing_official_email),
        security_contact: formData.security_contact || '',
        security_contact_email: normalizeEmailField(formData.security_contact_email),
        topology_image: formData.topology_screenshot,
        topology_screenshot: formData.topology_screenshot,
        unedited_controls_mode: formData.unedited_controls_mode || 'placeholder',
        custom_narratives: customNarratives,
        project_id: currentProject?.id,
        selected_control_ids: selectedControlIds,
        custom_sections: formData.custom_sections,
        enhanced_narratives: enhancedNarratives || undefined,
      };

      // Generate SSP document
      const sspDoc = await buildSSPDocument(
        sspRequest,
        nodes,
        edges,
        formData.topology_screenshot
      );

      await generateSSPFromDocument(sspDoc, true);
      setMessage({ type: 'success', text: 'SSP PDF generated successfully!' });

      if (!inline) {
        setTimeout(() => {
          onClose();
          setMessage(null);
        }, 2000);
      } else {
        setTimeout(() => {
          setMessage(null);
        }, 2000);
      }
    } catch (error) {
      console.error('[SSPWizard] Failed to generate SSP:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to generate SSP. Please try again.';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  // Show warning if Electron API is not available
  if (electronAPIAvailable === false) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md">
          <div className="flex items-center gap-4 mb-4">
            <AlertCircle className="w-8 h-8 text-amber-600" />
            <h2 className="text-xl font-bold text-gray-900">PDF Generation Not Available</h2>
          </div>
          <p className="text-gray-600 mb-6">
            PDF generation requires the desktop application. Please use the Electron desktop app to generate SSP documents.
          </p>
          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        inline
          ? 'w-full h-full flex flex-col bg-white'
          : 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
      }
    >
      <div
        className={
          inline
            ? 'w-full h-full flex flex-col'
            : 'w-[90vw] h-[90vh] bg-white rounded-lg shadow-xl flex flex-col'
        }
      >
        {/* Header */}
        <div className="border-b px-6 py-5 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-7 h-7 text-blue-600" />
                SSP Generator
              </h2>
              <p className="text-sm text-gray-600 mt-2">
                Complete all fields to generate your System Security Plan
              </p>
            </div>
            {!inline && (
              <Button onClick={handleClose} variant="ghost" size="sm" disabled={isGenerating}>
                ✕
              </Button>
            )}
          </div>
        </div>

        {/* Message Banner */}
        {message && (
          <div
            className={`px-6 py-4 border-l-4 ${
              message.type === 'success' 
                ? 'bg-green-50 text-green-800 border-green-500' 
                : 'bg-red-50 text-red-800 border-red-500'
            }`}
          >
            <div className="flex items-center gap-2">
              {message.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              <p className="text-sm font-medium">{message.text}</p>
            </div>
          </div>
        )}

        {/* Save Status Indicator */}
        {saveStatus.saving && (
          <div className="px-6 py-2 bg-blue-50 text-blue-700 border-l-4 border-blue-500">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Saving...</span>
            </div>
          </div>
        )}
        {saveStatus.saved && (
          <div className="px-6 py-2 bg-green-50 text-green-700 border-l-4 border-green-500">
            <div className="flex items-center gap-2">
              <Save className="w-4 h-4" />
              <span className="text-sm">Saved successfully</span>
            </div>
          </div>
        )}
        {saveStatus.error && (
          <div className="px-6 py-2 bg-red-50 text-red-700 border-l-4 border-red-500">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">Failed to save. Please try again.</span>
            </div>
          </div>
        )}

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 bg-gray-50">
          <div className="max-w-4xl mx-auto space-y-6 ssp-form-wrapper">
            <Form
              schema={combinedSchema}
              uiSchema={combinedUiSchema}
              formData={formData}
              validator={validator}
              onChange={handleFormChange}
              onBlur={handleFieldBlur}
              widgets={widgets}
              onSubmit={handleFormSubmit}
              showErrorList="top"
              templates={{
                ErrorListTemplate: ({ errors }: ErrorListProps) => (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <h3 className="font-semibold text-red-900">Please fix the following errors:</h3>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-sm text-red-800">
                      {errors.map((error: RJSFValidationError, idx: number) => (
                        <li key={idx}>{error.stack || error.message}</li>
                      ))}
                    </ul>
                  </div>
                ),
              }}
            >
              {/* Hidden submit button - we control submission manually */}
              <button type="submit" style={{ display: 'none' }} />
            </Form>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex items-center justify-between bg-white shadow-lg">
          <div className="text-sm text-gray-600">
            {formData.system_name && formData.organization_name && formData.prepared_by ? (
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="w-4 h-4" />
                <span>Required fields complete</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-700">
                <AlertCircle className="w-4 h-4" />
                <span>Required fields: System Name, Organization, Prepared By</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handlePreview}
              disabled={isPreviewing || isGenerating || !formData.system_name || !formData.organization_name || !formData.prepared_by}
              variant="outline"
              type="button"
              size="lg"
            >
              {isPreviewing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Opening Preview...
                </>
              ) : (
                <>
                  <Eye className="w-5 h-5 mr-2" />
                  Preview SSP
                </>
              )}
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || isPreviewing || !formData.system_name || !formData.organization_name || !formData.prepared_by}
              className="bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg transition-all"
              type="button"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5 mr-2" />
                  Generate SSP
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

