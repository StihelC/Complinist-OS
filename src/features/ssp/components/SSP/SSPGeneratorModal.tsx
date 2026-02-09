import { useState, useEffect, useMemo, useRef } from 'react';
import { X, FileText, Loader2, Eye, Network, ChevronDown, ChevronUp, Plus, Trash2, BookOpen, CheckCircle, Circle, MinusCircle, Camera } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { buildSSPDocument, generateSSPFromDocument, previewSSPDocument } from '@/lib/ssp/sspGenerator';
import { captureTopologyAsBase64 } from '@/lib/topologyCapture';
import { SSPSystemCharacteristics, UneditedControlsMode, CustomSection } from '@/lib/utils/types';
import { useControlNarrativesStore } from '@/core/stores/useControlNarrativesStore';
import { useSSPMetadataStore } from '@/core/stores/sspMetadataStore';
import { useControlSelectionStore } from '@/core/stores/useControlSelectionStore';
import { getCatalogForBaseline } from '@/lib/controls/controlCatalog';
import { ControlSelectionSummary } from './ControlSelectionSummary';

interface SSPGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  inline?: boolean;
  onSwitchToTopology?: () => void;
}

export const SSPGeneratorModal = ({ isOpen, onClose, inline = false, onSwitchToTopology: _onSwitchToTopology }: SSPGeneratorModalProps) => {
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const currentProject = useFlowStore((state) => state.currentProject);
  
  // SSP Metadata Store
  const { 
    metadata: savedMetadata,
    loadMetadata,
    updateMetadata,
    saveMetadata,
    addCustomSection,
    updateCustomSection,
    deleteCustomSection,
  } = useSSPMetadataStore();
  
  // Control Selection Store (shared)
  const { 
    selectedControlIds,
    setSelectedControlIds,
    initializeSmartDefaults,
  } = useControlSelectionStore();

  // Local state for form and UI
  const [formData, setFormData] = useState<SSPSystemCharacteristics & { unedited_controls_mode: UneditedControlsMode }>({
    system_name: currentProject?.name || '',
    organization_name: '',
    prepared_by: '',
    baseline: currentProject?.baseline || 'MODERATE',
    system_description: '',
    system_purpose: '',
    deployment_model: 'on-premises',
    service_model: 'on-premises',
    information_type_title: '',
    information_type_description: '',
    confidentiality_impact: 'moderate',
    integrity_impact: 'moderate',
    availability_impact: 'moderate',
    authorization_boundary_description: '',
    system_status: 'operational',
    system_owner: '',
    system_owner_email: '',
    authorizing_official: '',
    authorizing_official_email: '',
    security_contact: '',
    security_contact_email: '',
    physical_location: '',
    data_types_processed: '',
    users_description: '',
    unedited_controls_mode: 'placeholder',
    on_premises_details: {
      data_center_location: '',
      physical_security_description: '',
      server_infrastructure: '',
      network_infrastructure: '',
      backup_systems: '',
      disaster_recovery: '',
    },
    cloud_provider: '',
    custom_sections: [],
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [topologyPreview, setTopologyPreview] = useState<string | null>(null);
  const [customInfoType, setCustomInfoType] = useState<string>('');
  const [selectedBoundaries, setSelectedBoundaries] = useState<Set<string>>(new Set());
  const [availableControls, setAvailableControls] = useState<Record<string, any>>({});
  const [controlFamilies, setControlFamilies] = useState<any[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic']));
  const [activeSection, setActiveSection] = useState<string>('basic');
  const [expandedControlFamilies, setExpandedControlFamilies] = useState<Set<string>>(new Set());
  const [controlSearchTerm, setControlSearchTerm] = useState('');
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  
  // Refs for scrolling
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Load saved metadata when modal opens
  useEffect(() => {
    if (isOpen && currentProject?.id) {
      setIsLoadingMetadata(true);
      loadMetadata(currentProject.id).then(() => {
        setIsLoadingMetadata(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentProject?.id]);

  // Apply loaded metadata to form (separate effect to avoid re-triggering on savedMetadata changes)
  useEffect(() => {
    if (isOpen && savedMetadata && currentProject?.id && !isLoadingMetadata) {
      // Ensure all string fields are strings (not null/undefined)
      const ensureString = (value: any): string => value ?? '';
      
      setFormData(prev => ({
        ...prev,
        system_name: currentProject?.name || ensureString(savedMetadata.system_name),
        organization_name: ensureString(savedMetadata.organization_name),
        prepared_by: ensureString(savedMetadata.prepared_by),
        baseline: currentProject?.baseline || savedMetadata.baseline || prev.baseline,
        system_description: ensureString(savedMetadata.system_description),
        system_purpose: ensureString(savedMetadata.system_purpose),
        deployment_model: savedMetadata.deployment_model || prev.deployment_model,
        service_model: savedMetadata.service_model || prev.service_model,
        information_type_title: ensureString(savedMetadata.information_type_title),
        information_type_description: ensureString(savedMetadata.information_type_description),
        confidentiality_impact: savedMetadata.confidentiality_impact || prev.confidentiality_impact,
        integrity_impact: savedMetadata.integrity_impact || prev.integrity_impact,
        availability_impact: savedMetadata.availability_impact || prev.availability_impact,
        authorization_boundary_description: ensureString(savedMetadata.authorization_boundary_description),
        system_status: savedMetadata.system_status || prev.system_status,
        system_owner: ensureString(savedMetadata.system_owner),
        system_owner_email: ensureString(savedMetadata.system_owner_email),
        authorizing_official: ensureString(savedMetadata.authorizing_official),
        authorizing_official_email: ensureString(savedMetadata.authorizing_official_email),
        security_contact: ensureString(savedMetadata.security_contact),
        security_contact_email: ensureString(savedMetadata.security_contact_email),
        physical_location: ensureString(savedMetadata.physical_location),
        data_types_processed: ensureString(savedMetadata.data_types_processed),
        users_description: ensureString(savedMetadata.users_description),
        unedited_controls_mode: (savedMetadata as any).unedited_controls_mode || prev.unedited_controls_mode,
        on_premises_details: savedMetadata.on_premises_details ? {
          data_center_location: ensureString(savedMetadata.on_premises_details.data_center_location),
          physical_security_description: ensureString(savedMetadata.on_premises_details.physical_security_description),
          server_infrastructure: ensureString(savedMetadata.on_premises_details.server_infrastructure),
          network_infrastructure: ensureString(savedMetadata.on_premises_details.network_infrastructure),
          backup_systems: ensureString(savedMetadata.on_premises_details.backup_systems),
          disaster_recovery: ensureString(savedMetadata.on_premises_details.disaster_recovery),
        } : prev.on_premises_details,
        cloud_provider: ensureString(savedMetadata.cloud_provider),
        custom_sections: savedMetadata.custom_sections || [],
      }));
      
      // Load topology screenshot if it exists
      if (savedMetadata.topology_screenshot) {
        setTopologyPreview(savedMetadata.topology_screenshot);
      }
    }
    // Only run when modal opens or project changes - NOT on every savedMetadata update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentProject?.id, isLoadingMetadata]);

  // Load control catalog when baseline changes
  useEffect(() => {
    const loadControls = async () => {
      try {
        const catalog = await getCatalogForBaseline(formData.baseline);
        setAvailableControls(catalog.items);
        setControlFamilies(catalog.families);
        
        // Initialize smart defaults if no selection exists
        const allControlIds = Object.keys(catalog.items);
        if (selectedControlIds.length === 0) {
          initializeSmartDefaults(nodes, edges, allControlIds);
        }
      } catch (error) {
        console.error('Failed to load control catalog:', error);
      }
    };

    if (isOpen) {
      loadControls();
    }
  }, [formData.baseline, isOpen, nodes, edges]);

  // Auto-save on field changes (debounced)
  useEffect(() => {
    // Don't auto-save while loading initial data
    if (!currentProject?.id || !isOpen || isLoadingMetadata) return;
    
    const timeoutId = setTimeout(async () => {
      console.log('[SSP] Auto-saving metadata to database...');
      // First update the store
      updateMetadata(formData);
      // Then persist to database
      try {
        await saveMetadata(currentProject.id);
        console.log('[SSP] Metadata saved successfully');
      } catch (error) {
        console.error('[SSP] Failed to save metadata:', error);
      }
    }, 1000); // Debounce 1 second

    return () => clearTimeout(timeoutId);
  }, [formData, currentProject?.id, isOpen, isLoadingMetadata, updateMetadata, saveMetadata]);

  // Note: Automatic topology capture removed - users now use the "Capture Screenshot" button
  // This provides better control and quality since they can select exactly what to capture

  // Handle custom topology screenshot capture
  const handleCaptureTopologyScreenshot = async () => {
    try {
      console.log('[SSP] Starting SVG topology capture...');
      
      // Capture topology as SVG directly (no selection needed)
      const base64Svg = await captureTopologyAsBase64();
      
      if (!base64Svg) {
        throw new Error('Failed to capture topology as SVG');
      }
      
      console.log('[SSP] SVG capture successful, size:', base64Svg.length, 'characters');
      
      setTopologyPreview(base64Svg);
      
      // Save to metadata store so it persists
      if (currentProject?.id) {
        console.log('[SSP] Saving topology SVG to metadata store...');
        updateMetadata({
          topology_screenshot: base64Svg
        });
        await saveMetadata(currentProject.id);
        console.log('[SSP] Topology SVG saved successfully to database');
      }
      
      setMessage({ type: 'success', text: 'Topology diagram captured as SVG!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('[SSP] Failed to capture topology:', error);
      setMessage({ 
        type: 'error', 
        text: `Failed to capture topology: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  // No longer needed with direct SVG capture
  // Remove handleConfirmTopologyCapture and handleRedrawTopologyCapture functions

  // Detect boundaries from topology
  const detectedBoundaries = useMemo(() => {
    return nodes
      .filter(n => n.type === 'boundary')
      .map(n => ({
        id: n.id,
        name: (n.data as any)?.label || 'Unnamed Boundary',
        type: (n.data as any)?.zoneType || 'Unknown',
        securityLevel: (n.data as any)?.securityLevel
      }));
  }, [nodes]);

  if (!isOpen) return null;

  const updateField = <K extends keyof typeof formData>(field: K, value: typeof formData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  // const _updateOnPremDetails = <K extends keyof NonNullable<typeof formData.on_premises_details>>( // Unused - kept for potential future use
  //   field: K, 
  //   value: NonNullable<typeof formData.on_premises_details>[K]
  // ) => {
  //   setFormData(prev => ({
  //     ...prev,
  //     on_premises_details: {
  //       ...prev.on_premises_details,
  //       [field]: value,
  //     },
  //   }));
  // };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const scrollToSection = (sectionId: string) => {
    const element = sectionRefs.current[sectionId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(sectionId);
      // Expand the section if collapsed
      setExpandedSections(prev => new Set(prev).add(sectionId));
    }
  };

  // Auto-capture topology if not already captured
  const handleGenerateSSP = async () => {
    setIsGenerating(true);
    setMessage(null);

    try {
      // Use saved topology screenshot if available
      let topologyImage: string | undefined = topologyPreview || undefined;
      
      if (!topologyImage) {
        console.warn('[SSP] No topology screenshot saved. Please use the "Capture Screenshot" button to add a network diagram to your SSP.');
        setMessage({ 
          type: 'error', 
          text: 'No topology screenshot. Use "Capture Screenshot" button in the Review section to add a network diagram.' 
        });
        // Continue anyway - topology is optional
      }
      
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

      // Normalize email fields before passing to buildSSPDocument
      const normalizeEmailField = (email: any): string => {
        if (email == null) return '';
        const str = String(email).trim();
        return str === 'null' || str === 'undefined' || str === 'NaN' ? '' : str;
      };

      const sspDoc = await buildSSPDocument(
        {
          ...formData,
          system_owner_email: normalizeEmailField(formData.system_owner_email),
          authorizing_official_email: normalizeEmailField(formData.authorizing_official_email),
          security_contact_email: normalizeEmailField(formData.security_contact_email),
          topology_image: topologyImage,
          custom_narratives: customNarratives,
          project_id: currentProject?.id,
          selected_control_ids: selectedControlIds,
        },
        nodes,
        edges,
        topologyImage
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
      console.error('Failed to generate SSP:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate SSP. Please try again.';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreviewPDF = async () => {
    setMessage(null);
    setIsPreviewing(true);
    
    try {
      setMessage({ type: 'success', text: 'Building SSP preview...' });
      
      const topologyImage = await captureTopologyAsBase64();
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

      // Normalize email fields before passing to buildSSPDocument
      const normalizeEmailField = (email: any): string => {
        if (email == null) return '';
        const str = String(email).trim();
        return str === 'null' || str === 'undefined' || str === 'NaN' ? '' : str;
      };

      const sspDoc = await buildSSPDocument(
        {
          ...formData,
          system_owner_email: normalizeEmailField(formData.system_owner_email),
          authorizing_official_email: normalizeEmailField(formData.authorizing_official_email),
          security_contact_email: normalizeEmailField(formData.security_contact_email),
          topology_image: topologyImage,
          custom_narratives: customNarratives,
          project_id: currentProject?.id,
          selected_control_ids: selectedControlIds,
        },
        nodes,
        edges,
        topologyImage
      );
      
      setMessage({ type: 'success', text: 'Opening preview in new tab...' });
      await previewSSPDocument(sspDoc);
      
      setTimeout(() => setMessage(null), 2000);
    } catch (error) {
      console.error('Failed to preview PDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setMessage({ type: 'error', text: `Failed to open preview: ${errorMessage}` });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleAddCustomSection = () => {
    const newSection: CustomSection = {
      id: `custom-${Date.now()}`,
      title: '',
      content: '',
      position: 'appendix',
    };
    addCustomSection(newSection);
    setFormData(prev => ({
      ...prev,
      custom_sections: [...(prev.custom_sections || []), newSection],
    }));
  };

  const handleUpdateCustomSection = (id: string, updates: Partial<CustomSection>) => {
    updateCustomSection(id, updates);
    setFormData(prev => ({
      ...prev,
      custom_sections: (prev.custom_sections || []).map(section =>
        section.id === id ? { ...section, ...updates } : section
      ),
    }));
  };

  const handleDeleteCustomSection = (id: string) => {
    deleteCustomSection(id);
    setFormData(prev => ({
      ...prev,
      custom_sections: (prev.custom_sections || []).filter(section => section.id !== id),
    }));
  };

  const toggleControlFamily = (familyCode: string) => {
    setExpandedControlFamilies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(familyCode)) {
        newSet.delete(familyCode);
      } else {
        newSet.add(familyCode);
      }
      return newSet;
    });
  };

  const handleControlSelection = (controlId: string, selected: boolean) => {
    if (selected) {
      setSelectedControlIds([...selectedControlIds, controlId]);
    } else {
      setSelectedControlIds(selectedControlIds.filter(id => id !== controlId));
    }
  };

  const handleSelectAllInFamily = (familyCode: string) => {
    const family = controlFamilies.find(f => f.code === familyCode);
    if (!family) return;

    const familyControlIds = family.controls.map((c: any) => c.control_id);
    const allSelected = familyControlIds.every((id: string) => selectedControlIds.includes(id));
    
    if (allSelected) {
      // Deselect all in this family
      setSelectedControlIds(selectedControlIds.filter(id => !familyControlIds.includes(id)));
    } else {
      // Select all in this family
      const newSelection = [...new Set([...selectedControlIds, ...familyControlIds])];
      setSelectedControlIds(newSelection);
    }
  };

  const handleSelectAllBaseline = () => {
    const allControlIds = Object.keys(availableControls);
    setSelectedControlIds(allControlIds);
  };

  const handleClearAllControls = () => {
    setSelectedControlIds([]);
  };

  // Get control narrative completion status
  const getControlNarrativeStatus = (controlId: string): 'complete' | 'partial' | 'none' => {
    const isSelected = selectedControlIds.includes(controlId);
    if (!isSelected) return 'none';
    
    const narrativeState = useControlNarrativesStore.getState();
    const narrative = narrativeState.items[controlId];
    
    if (narrative && narrative.narrative && narrative.narrative.trim().length > 0) {
      return 'complete';
    }
    
    return 'partial';
  };

  const getFamilyStatus = (familyCode: string): 'complete' | 'partial' | 'none' => {
    const family = controlFamilies.find(f => f.code === familyCode);
    if (!family) return 'none';

    const familyControlIds = family.controls.map((c: any) => c.control_id);
    const selectedInFamily = familyControlIds.filter((id: string) => selectedControlIds.includes(id));
    
    if (selectedInFamily.length === 0) return 'none';
    
    const completeCount = selectedInFamily.filter((id: string) => {
      const status = getControlNarrativeStatus(id);
      return status === 'complete';
    }).length;

    if (completeCount === selectedInFamily.length) return 'complete';
    return 'partial';
  };

  // Filter controls by search term
  const filteredFamilies = useMemo(() => {
    if (!controlSearchTerm.trim()) return controlFamilies;
    
    const term = controlSearchTerm.toLowerCase();
    return controlFamilies
      .map(family => ({
        ...family,
        controls: family.controls.filter((control: any) => {
          const haystack = `${control.control_id} ${control.title} ${control.family}`.toLowerCase();
          return haystack.includes(term);
        })
      }))
      .filter(family => family.controls.length > 0);
  }, [controlFamilies, controlSearchTerm]);

  const content = (
    <div className={inline ? "w-full h-full flex" : "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"}>
      <div className={inline ? "w-full h-full flex bg-white" : "w-[95vw] h-[95vh] bg-white rounded-lg shadow-xl flex flex-col"}>
        {/* Close button (top-right, minimal) */}
        {!inline && (
          <div className="absolute top-4 right-4 z-10">
            <Button onClick={onClose} variant="ghost" size="sm" disabled={isGenerating}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        )}

        {/* Message Banner */}
        {message && (
          <div className={`px-6 py-3 ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            <p className="text-sm font-medium">{message.text}</p>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Navigation Buttons */}
          <div className="w-20 bg-gray-50 border-r flex flex-col items-center py-6 gap-3">
            {[
              { id: 'basic', icon: '1', label: 'Basic' },
              { id: 'system', icon: '2', label: 'System' },
              { id: 'data', icon: '3', label: 'Data' },
              { id: 'auth', icon: '4', label: 'Auth' },
              { id: 'review', icon: '5', label: 'Review' },
            ].map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`w-14 h-14 rounded-lg flex flex-col items-center justify-center text-xs font-semibold transition-all shadow-sm ${
                  activeSection === section.id
                    ? 'bg-blue-600 text-white shadow-md scale-105'
                    : 'bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-600 hover:shadow'
                }`}
                title={section.label}
              >
                <span className="text-lg mb-1">{section.icon}</span>
                <span className="text-[10px]">{section.label}</span>
              </button>
            ))}
          </div>

          {/* Main Form Area */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="max-w-4xl mx-auto space-y-6">
              
              {/* Section 1: Basic Information */}
              <div ref={el => sectionRefs.current['basic'] = el}>
                <Card>
                  <CardHeader className="cursor-pointer" onClick={() => toggleSection('basic')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">1. Basic Information</CardTitle>
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">Required</span>
                      </div>
                      {expandedSections.has('basic') ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </CardHeader>
                  {expandedSections.has('basic') && (
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>System Name *</Label>
                          <Input
                            placeholder="Enter system name"
                            value={formData.system_name}
                            onChange={(e) => updateField('system_name', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Organization Name *</Label>
                          <Input
                            placeholder="Enter organization name"
                            value={formData.organization_name}
                            onChange={(e) => updateField('organization_name', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Prepared By *</Label>
                          <Input
                            placeholder="Your name/team"
                            value={formData.prepared_by}
                            onChange={(e) => updateField('prepared_by', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Security Baseline *</Label>
                          <Select
                            value={formData.baseline}
                            onChange={(e) => updateField('baseline', e.target.value as any)}
                          >
                            <option value="LOW">LOW</option>
                            <option value="MODERATE">MODERATE</option>
                            <option value="HIGH">HIGH</option>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              </div>

              {/* Section 2: System Characteristics */}
              <div ref={el => sectionRefs.current['system'] = el}>
                <Card>
                  <CardHeader className="cursor-pointer" onClick={() => toggleSection('system')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">2. System Characteristics</CardTitle>
                        <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">Optional</span>
                      </div>
                      {expandedSections.has('system') ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </CardHeader>
                  {expandedSections.has('system') && (
                    <CardContent className="space-y-4">
                      <div>
                        <Label>System Description</Label>
                        <Textarea
                          placeholder="Describe what the system does..."
                          rows={3}
                          value={formData.system_description}
                          onChange={(e) => updateField('system_description', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>System Purpose</Label>
                        <Input
                          placeholder="Specific capabilities (e.g., 'user management and audit logging')"
                          value={formData.system_purpose}
                          onChange={(e) => updateField('system_purpose', e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Deployment Model</Label>
                          <Select
                            value={formData.deployment_model}
                            onChange={(e) => updateField('deployment_model', e.target.value as any)}
                          >
                            <option value="on-premises">On-Premises</option>
                            <option value="private-cloud">Private Cloud</option>
                            <option value="public-cloud">Public Cloud</option>
                            <option value="hybrid-cloud">Hybrid Cloud</option>
                            <option value="other">Other</option>
                          </Select>
                        </div>
                        <div>
                          <Label>Service Model</Label>
                          <Select
                            value={formData.service_model}
                            onChange={(e) => updateField('service_model', e.target.value as any)}
                          >
                            <option value="on-premises">On-Premises</option>
                            <option value="saas">SaaS (Software as a Service)</option>
                            <option value="paas">PaaS (Platform as a Service)</option>
                            <option value="iaas">IaaS (Infrastructure as a Service)</option>
                            <option value="hybrid">Hybrid</option>
                            <option value="other">Other</option>
                          </Select>
                        </div>
                      </div>
                      {(formData.deployment_model === 'public-cloud' || 
                        formData.deployment_model === 'private-cloud' || 
                        formData.deployment_model === 'hybrid-cloud') && (
                        <div>
                          <Label>Cloud Provider</Label>
                          <Select
                            value={formData.cloud_provider || ''}
                            onChange={(e) => updateField('cloud_provider', e.target.value)}
                          >
                            <option value="">Select Provider</option>
                            <option value="AWS">Amazon Web Services (AWS)</option>
                            <option value="Azure">Microsoft Azure</option>
                            <option value="GCP">Google Cloud Platform (GCP)</option>
                            <option value="Oracle">Oracle Cloud</option>
                            <option value="IBM">IBM Cloud</option>
                            <option value="Other">Other</option>
                          </Select>
                        </div>
                      )}
                      <div>
                        <Label>Physical Location</Label>
                        <Input
                          placeholder="Physical or logical location"
                          value={formData.physical_location}
                          onChange={(e) => updateField('physical_location', e.target.value)}
                        />
                      </div>
                    </CardContent>
                  )}
                </Card>
              </div>

              {/* Section 3: Data & Security */}
              <div ref={el => sectionRefs.current['data'] = el}>
                <Card>
                  <CardHeader className="cursor-pointer" onClick={() => toggleSection('data')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">3. Data & Security</CardTitle>
                        <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">Optional</span>
                      </div>
                      {expandedSections.has('data') ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </CardHeader>
                  {expandedSections.has('data') && (
                    <CardContent className="space-y-4">
                      <div>
                        <Label>Information Type</Label>
                        <Select
                          value={formData.information_type_title === customInfoType && customInfoType ? 'Other (Custom)' : formData.information_type_title}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === 'Other (Custom)') {
                              setCustomInfoType(formData.information_type_title);
                            } else {
                              updateField('information_type_title', value);
                              setCustomInfoType('');
                            }
                          }}
                        >
                          <option value="">Select information type...</option>
                          <option value="User Account Data">User Account Data</option>
                          <option value="Financial Information">Financial Information</option>
                          <option value="Personal Health Information (PHI)">Personal Health Information (PHI)</option>
                          <option value="Personally Identifiable Information (PII)">Personally Identifiable Information (PII)</option>
                          <option value="System and Network Monitoring">System and Network Monitoring</option>
                          <option value="Business Operations Data">Business Operations Data</option>
                          <option value="Customer Service Data">Customer Service Data</option>
                          <option value="Research and Development Data">Research and Development Data</option>
                          <option value="Other (Custom)">Other (Custom)</option>
                        </Select>
                      </div>
                      {(formData.information_type_title === customInfoType && customInfoType) && (
                        <div>
                          <Label>Custom Information Type</Label>
                          <Input
                            placeholder="Enter custom information type"
                            value={customInfoType}
                            onChange={(e) => {
                              setCustomInfoType(e.target.value);
                              updateField('information_type_title', e.target.value);
                            }}
                          />
                        </div>
                      )}
                      <div>
                        <Label>Information Type Description</Label>
                        <Textarea
                          placeholder="Describe the data..."
                          rows={2}
                          value={formData.information_type_description}
                          onChange={(e) => updateField('information_type_description', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Data Types Processed</Label>
                        <Input
                          placeholder="Comma-separated (e.g., 'PII, Financial Data, System Logs')"
                          value={formData.data_types_processed}
                          onChange={(e) => updateField('data_types_processed', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Users Description</Label>
                        <Input
                          placeholder="e.g., 'internal staff and approved contractors'"
                          value={formData.users_description}
                          onChange={(e) => updateField('users_description', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-semibold mb-2 block">FIPS 199 Security Impact Levels</Label>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label className="text-xs">Confidentiality</Label>
                            <Select
                              value={formData.confidentiality_impact}
                              onChange={(e) => updateField('confidentiality_impact', e.target.value as any)}
                            >
                              <option value="low">Low</option>
                              <option value="moderate">Moderate</option>
                              <option value="high">High</option>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Integrity</Label>
                            <Select
                              value={formData.integrity_impact}
                              onChange={(e) => updateField('integrity_impact', e.target.value as any)}
                            >
                              <option value="low">Low</option>
                              <option value="moderate">Moderate</option>
                              <option value="high">High</option>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Availability</Label>
                            <Select
                              value={formData.availability_impact}
                              onChange={(e) => updateField('availability_impact', e.target.value as any)}
                            >
                              <option value="low">Low</option>
                              <option value="moderate">Moderate</option>
                              <option value="high">High</option>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              </div>

              {/* Section 4: Authorization & Responsible Parties */}
              <div ref={el => sectionRefs.current['auth'] = el}>
                <Card>
                  <CardHeader className="cursor-pointer" onClick={() => toggleSection('auth')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">4. Authorization & Responsible Parties</CardTitle>
                        <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">Optional</span>
                      </div>
                      {expandedSections.has('auth') ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </CardHeader>
                  {expandedSections.has('auth') && (
                    <CardContent className="space-y-4">
                      {detectedBoundaries.length > 0 && (
                        <div className="p-3 border border-blue-200 bg-blue-50 rounded-lg">
                          <Label className="text-sm font-semibold mb-2 block">Detected Security Boundaries</Label>
                          <p className="text-xs text-gray-600 mb-3">Select boundaries from your topology to include:</p>
                          <div className="space-y-2">
                            {detectedBoundaries.map((boundary) => (
                              <label key={boundary.id} className="flex items-start space-x-2 p-2 border rounded cursor-pointer hover:bg-blue-100 bg-white">
                                <Checkbox
                                  checked={selectedBoundaries.has(boundary.id)}
                                  onCheckedChange={(checked) => {
                                    const newSet = new Set(selectedBoundaries);
                                    if (checked) {
                                      newSet.add(boundary.id);
                                    } else {
                                      newSet.delete(boundary.id);
                                    }
                                    setSelectedBoundaries(newSet);
                                  }}
                                />
                                <div className="flex-1">
                                  <span className="text-sm font-medium">{boundary.name}</span>
                                  {(boundary.type !== 'Unknown' || boundary.securityLevel) && (
                                    <div className="text-xs text-gray-600">
                                      {boundary.type !== 'Unknown' && <span>Type: {boundary.type}</span>}
                                      {boundary.type !== 'Unknown' && boundary.securityLevel && <span> • </span>}
                                      {boundary.securityLevel && <span>Security: {boundary.securityLevel}</span>}
                                    </div>
                                  )}
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <Label>Authorization Boundary Description</Label>
                        <Textarea
                          placeholder="Describe what's included in the authorization boundary..."
                          rows={3}
                          value={formData.authorization_boundary_description}
                          onChange={(e) => updateField('authorization_boundary_description', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>System Status</Label>
                        <Select
                          value={formData.system_status}
                          onChange={(e) => updateField('system_status', e.target.value as any)}
                        >
                          <option value="operational">Operational</option>
                          <option value="under-development">Under Development</option>
                          <option value="major-modification">Major Modification</option>
                          <option value="other">Other</option>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm font-semibold mb-2 block">Responsible Parties</Label>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs">System Owner *</Label>
                            <Input
                              placeholder="Full Name"
                              value={formData.system_owner}
                              onChange={(e) => updateField('system_owner', e.target.value)}
                            />
                            <Input
                              type="email"
                              placeholder="email@example.com"
                              value={formData.system_owner_email}
                              onChange={(e) => updateField('system_owner_email', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Authorizing Official</Label>
                            <Input
                              placeholder="Full Name"
                              value={formData.authorizing_official}
                              onChange={(e) => updateField('authorizing_official', e.target.value)}
                            />
                            <Input
                              type="email"
                              placeholder="email@example.com"
                              value={formData.authorizing_official_email}
                              onChange={(e) => updateField('authorizing_official_email', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Security Contact</Label>
                            <Input
                              placeholder="Full Name"
                              value={formData.security_contact}
                              onChange={(e) => updateField('security_contact', e.target.value)}
                            />
                            <Input
                              type="email"
                              placeholder="email@example.com"
                              value={formData.security_contact_email}
                              onChange={(e) => updateField('security_contact_email', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              </div>

              {/* Section 5: Review & Options */}
              <div ref={el => sectionRefs.current['review'] = el}>
                <Card>
                  <CardHeader className="cursor-pointer" onClick={() => toggleSection('review')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">5. Review & Options</CardTitle>
                        <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">Optional</span>
                      </div>
                      {expandedSections.has('review') ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </CardHeader>
                  {expandedSections.has('review') && (
                    <CardContent className="space-y-4">
                      {/* Topology Screenshot */}
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Network className="w-4 h-4" />
                            <Label className="text-sm font-semibold">Network Topology Diagram</Label>
                          </div>
                          <Button
                            onClick={handleCaptureTopologyScreenshot}
                            variant="outline"
                            size="sm"
                          >
                            <Camera className="w-4 h-4 mr-2" />
                            {topologyPreview ? 'Update Screenshot' : 'Capture Screenshot'}
                          </Button>
                        </div>
                        
                        {topologyPreview ? (
                          <>
                            <img
                              src={`data:image/png;base64,${topologyPreview}`}
                              alt="Network Topology"
                              className="w-full border rounded max-w-full max-h-full object-contain"
                              onError={(e) => {
                                console.error('[SSP] Failed to load topology preview image:', e);
                                setTopologyPreview(null);
                                setMessage({ type: 'error', text: 'Failed to load topology preview. Please capture again.' });
                                setTimeout(() => setMessage(null), 5000);
                              }}
                            />
                            <p className="text-xs text-gray-500 mt-2">
                              ✓ This diagram will be included in Section 2.1 of your SSP
                            </p>
                          </>
                        ) : (
                          <div className="border-2 border-dashed border-purple-300 rounded-lg p-8 text-center bg-purple-50/50">
                            <Camera className="w-12 h-12 mx-auto text-purple-400 mb-3" />
                            <p className="text-sm font-semibold text-gray-700 mb-1">No Topology Screenshot</p>
                            <p className="text-xs text-gray-600 mb-3">
                              Click "Capture Screenshot" above to select and capture your network topology diagram
                            </p>
                            <p className="text-xs text-purple-600 font-medium">
                              → You'll be taken to the Topology view to make your selection
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Control Selection Summary */}
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <Label className="text-sm font-semibold">Selected Controls</Label>
                          <p className="text-xs text-gray-600">
                            Use the Control Narratives tab to edit narratives
                          </p>
                        </div>
                        <ControlSelectionSummary
                          selectedControlIds={selectedControlIds}
                          allControls={availableControls}
                          onEditControls={() => scrollToSection('controls-sidebar')}
                        />
                      </div>

                      {/* Unedited Controls Handling */}
                      <div>
                        <Label className="text-sm font-semibold mb-2 block">Unedited Controls Handling</Label>
                        <div className="space-y-2">
                          <label className="flex items-center space-x-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                            <input
                              type="radio"
                              name="unedited_controls_mode"
                              value="placeholder"
                              checked={formData.unedited_controls_mode === 'placeholder'}
                              onChange={(e) => updateField('unedited_controls_mode', e.target.value as any)}
                              className="mr-2"
                            />
                            <span className="text-sm">
                              Include with placeholder text <span className="text-gray-500">(auto-generated from topology)</span>
                            </span>
                          </label>
                          <label className="flex items-center space-x-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                            <input
                              type="radio"
                              name="unedited_controls_mode"
                              value="nist_text"
                              checked={formData.unedited_controls_mode === 'nist_text'}
                              onChange={(e) => updateField('unedited_controls_mode', e.target.value as any)}
                              className="mr-2"
                            />
                            <span className="text-sm">
                              Include with NIST objectives <span className="text-gray-500">(use official text)</span>
                            </span>
                          </label>
                          <label className="flex items-center space-x-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                            <input
                              type="radio"
                              name="unedited_controls_mode"
                              value="exclude"
                              checked={formData.unedited_controls_mode === 'exclude'}
                              onChange={(e) => updateField('unedited_controls_mode', e.target.value as any)}
                              className="mr-2"
                            />
                            <span className="text-sm">
                              Exclude unedited controls <span className="text-gray-500">(custom only)</span>
                            </span>
                          </label>
                        </div>
                      </div>

                      {/* Preview Button */}
                      <Button 
                        onClick={handlePreviewPDF} 
                        variant="outline" 
                        className="w-full"
                        disabled={isPreviewing || !formData.system_name || !formData.organization_name || !formData.prepared_by}
                      >
                        {isPreviewing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Building Preview...
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4 mr-2" />
                            Preview PDF
                          </>
                        )}
                      </Button>
                    </CardContent>
                  )}
                </Card>
              </div>

              {/* Custom Sections */}
              {(formData.custom_sections && formData.custom_sections.length > 0) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Custom Sections</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {formData.custom_sections.map((section) => (
                      <div key={section.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Input
                            placeholder="Section Title"
                            value={section.title}
                            onChange={(e) => handleUpdateCustomSection(section.id, { title: e.target.value })}
                            className="flex-1 mr-2"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteCustomSection(section.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                        <Textarea
                          placeholder="Section Content"
                          rows={4}
                          value={section.content}
                          onChange={(e) => handleUpdateCustomSection(section.id, { content: e.target.value })}
                        />
                        <div>
                          <Label className="text-xs">Position in Document</Label>
                          <Select
                            value={section.position}
                            onChange={(e) => handleUpdateCustomSection(section.id, { position: e.target.value })}
                          >
                            <option value="appendix">Appendix</option>
                            <option value="after-section-1">After Section 1</option>
                            <option value="after-section-2">After Section 2</option>
                            <option value="after-section-3">After Section 3</option>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Add Custom Section Button */}
              <Button onClick={handleAddCustomSection} variant="outline" className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Custom Section
              </Button>

            </div>
          </div>

          {/* Right Sidebar: Control Selection */}
          <div className="w-80 bg-gradient-to-b from-gray-50 to-white border-l flex flex-col overflow-hidden shadow-inner">
            <div className="p-4 border-b bg-white shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  Security Controls
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {formData.baseline}
                </Badge>
              </div>
              <Input
                type="search"
                placeholder="Search controls..."
                value={controlSearchTerm}
                onChange={(e) => setControlSearchTerm(e.target.value)}
                className="mb-3"
              />
              <div className="flex gap-2 mb-3">
                <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={handleSelectAllBaseline}>
                  Select All
                </Button>
                <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={handleClearAllControls}>
                  Clear All
                </Button>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">
                  {selectedControlIds.length} of {Object.keys(availableControls).length} selected
                </span>
                {selectedControlIds.length > 0 && (
                  <Badge variant="success" className="text-[10px]">
                    {Math.round((selectedControlIds.length / Object.keys(availableControls).length) * 100)}%
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {filteredFamilies.map((family) => {
                const familyStatus = getFamilyStatus(family.code);
                const selectedInFamily = family.controls.filter((c: any) => selectedControlIds.includes(c.control_id)).length;
                const totalInFamily = family.controls.length;
                const isExpanded = expandedControlFamilies.has(family.code);
                
                return (
                  <div 
                    key={family.code} 
                    className={`border-2 rounded-lg bg-white shadow-sm transition-all ${
                      isExpanded ? 'border-blue-200 shadow-md' : 'border-gray-200'
                    }`}
                  >
                    <div
                      className="p-3 cursor-pointer hover:bg-blue-50 flex items-center justify-between transition-colors"
                      onClick={() => toggleControlFamily(family.code)}
                    >
                      <div className="flex items-center gap-2">
                        {familyStatus === 'complete' && (
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                        )}
                        {familyStatus === 'partial' && (
                          <Circle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                        )}
                        {familyStatus === 'none' && (
                          <MinusCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        )}
                        <span className="text-sm font-semibold text-gray-900">{family.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={selectedInFamily === totalInFamily ? 'success' : selectedInFamily > 0 ? 'warning' : 'secondary'} 
                          className="text-[10px] px-1.5"
                        >
                          {selectedInFamily}/{totalInFamily}
                        </Badge>
                        {isExpanded ? 
                          <ChevronUp className="w-4 h-4 text-gray-600" /> : 
                          <ChevronDown className="w-4 h-4 text-gray-600" />
                        }
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-gray-200 bg-gray-50">
                        <div className="p-2">
                          <button
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline mb-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectAllInFamily(family.code);
                            }}
                          >
                            Toggle All
                          </button>
                        </div>
                        <div className="px-2 pb-2 space-y-1 max-h-64 overflow-y-auto">
                          {family.controls.map((control: any) => {
                            const status = getControlNarrativeStatus(control.control_id);
                            const isSelected = selectedControlIds.includes(control.control_id);
                            return (
                              <label 
                                key={control.control_id} 
                                className={`flex items-start gap-2 p-2 rounded cursor-pointer transition-colors ${
                                  isSelected ? 'bg-blue-50 border border-blue-200' : 'bg-white hover:bg-gray-50 border border-transparent'
                                }`}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(checked) => handleControlSelection(control.control_id, checked)}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-semibold text-gray-900">{control.control_id}</span>
                                    {status === 'complete' && (
                                      <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />
                                    )}
                                    {status === 'partial' && (
                                      <Circle className="w-3 h-3 text-yellow-600 flex-shrink-0" />
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-600 line-clamp-2 mt-0.5">{control.title}</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Floating Generate Button */}
        <Button
          onClick={handleGenerateSSP}
          disabled={isGenerating || !formData.system_name || !formData.organization_name || !formData.prepared_by}
          className="fixed bottom-6 right-6 h-14 px-6 text-lg shadow-lg"
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
  );

  return content;
};
