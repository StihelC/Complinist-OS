/**
 * SSP Template Manager Widget
 *
 * Provides UI for saving, loading, and managing SSP templates.
 * Integrates with the SSP Wizard for template-based auto-population.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FileDown,
  FileUp,
  Save,
  Trash2,
  Clock,
  Building,
  ChevronDown,
  ChevronUp,
  Check,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useSSPTemplateStore } from '@/core/stores/useSSPTemplateStore';
import { useOrganizationDefaultsStore } from '@/core/stores/useOrganizationDefaultsStore';
import type { SSPTemplate, SSPSystemCharacteristics } from '@/core/types/ssp.types';

interface SSPTemplateManagerProps {
  currentMetadata: Partial<SSPSystemCharacteristics>;
  onApplyTemplate: (metadata: Partial<SSPSystemCharacteristics>, controlIds?: string[]) => void;
  onApplyDefaults: (defaults: Partial<SSPSystemCharacteristics>) => void;
  selectedControlIds?: string[];
  projectName?: string;
  projectId?: number;
}

export const SSPTemplateManager: React.FC<SSPTemplateManagerProps> = ({
  currentMetadata,
  onApplyTemplate,
  onApplyDefaults,
  selectedControlIds,
  projectName,
  projectId,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const {
    templates,
    createFromMetadata,
    deleteTemplate,
    applyTemplate,
    getSortedTemplates,
  } = useSSPTemplateStore();

  const { defaults, getSSPDefaults, importFromSSPMetadata } = useOrganizationDefaultsStore();

  const sortedTemplates = useMemo(() => getSortedTemplates(), [templates]);

  const hasOrganizationDefaults = useMemo(() => {
    return defaults.organization_name || defaults.prepared_by || defaults.system_owner;
  }, [defaults]);

  const handleSaveTemplate = useCallback(() => {
    if (!newTemplateName.trim()) {
      setSaveMessage({ type: 'error', text: 'Please enter a template name' });
      return;
    }

    try {
      createFromMetadata(
        newTemplateName.trim(),
        newTemplateDescription.trim(),
        currentMetadata,
        selectedControlIds ? { selectedControlIds } : undefined,
        projectId && projectName ? { id: projectId, name: projectName } : undefined
      );

      setSaveMessage({ type: 'success', text: 'Template saved successfully!' });
      setNewTemplateName('');
      setNewTemplateDescription('');
      setIsSaveDialogOpen(false);

      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      setSaveMessage({ type: 'error', text: 'Failed to save template' });
    }
  }, [newTemplateName, newTemplateDescription, currentMetadata, selectedControlIds, projectId, projectName, createFromMetadata]);

  const handleApplyTemplate = useCallback((template: SSPTemplate) => {
    const templateData = applyTemplate(template.id);
    if (templateData) {
      onApplyTemplate(
        templateData.metadata,
        templateData.controlConfig?.selectedControlIds
      );
      setSaveMessage({ type: 'success', text: `Applied template: ${template.name}` });
      setTimeout(() => setSaveMessage(null), 3000);
    }
  }, [applyTemplate, onApplyTemplate]);

  const handleApplyOrganizationDefaults = useCallback(() => {
    const sspDefaults = getSSPDefaults();

    // Map organization defaults to SSP form fields
    const mappedDefaults: Partial<SSPSystemCharacteristics> = {
      organization_name: sspDefaults.organization_name,
      physical_location: sspDefaults.physical_location,
      prepared_by: sspDefaults.prepared_by,
      system_owner: sspDefaults.system_owner,
      system_owner_email: sspDefaults.system_owner_email,
      authorizing_official: sspDefaults.authorizing_official,
      authorizing_official_email: sspDefaults.authorizing_official_email,
      security_contact: sspDefaults.security_contact,
      security_contact_email: sspDefaults.security_contact_email,
      deployment_model: sspDefaults.default_deployment_model,
      service_model: sspDefaults.default_service_model,
      on_premises_details: sspDefaults.default_on_premises_details,
    };

    // Filter out empty values
    const filteredDefaults = Object.fromEntries(
      Object.entries(mappedDefaults).filter(([_, v]) => v !== undefined && v !== '')
    ) as Partial<SSPSystemCharacteristics>;

    onApplyDefaults(filteredDefaults);
    setSaveMessage({ type: 'success', text: 'Applied organization defaults' });
    setTimeout(() => setSaveMessage(null), 3000);
  }, [getSSPDefaults, onApplyDefaults]);

  const handleSaveAsOrganizationDefaults = useCallback(() => {
    importFromSSPMetadata(currentMetadata);
    setSaveMessage({ type: 'success', text: 'Saved current settings as organization defaults' });
    setTimeout(() => setSaveMessage(null), 3000);
  }, [currentMetadata, importFromSSPMetadata]);

  const handleDeleteTemplate = useCallback((templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this template?')) {
      deleteTemplate(templateId);
    }
  }, [deleteTemplate]);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Unknown';
    }
  };

  return (
    <div className="border rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 overflow-hidden">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/50 transition-colors"
        type="button"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-gray-900">Quick Start Options</h3>
            <p className="text-xs text-gray-500">
              Templates & Organization Defaults
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasOrganizationDefaults && (
            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
              Defaults Available
            </span>
          )}
          {templates.length > 0 && (
            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
              {templates.length} Template{templates.length !== 1 ? 's' : ''}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t bg-white p-4 space-y-4">
          {/* Message Banner */}
          {saveMessage && (
            <div
              className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                saveMessage.type === 'success'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              {saveMessage.type === 'success' ? (
                <Check className="w-4 h-4" />
              ) : null}
              {saveMessage.text}
            </div>
          )}

          {/* Organization Defaults Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-gray-700">Organization Defaults</span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleApplyOrganizationDefaults}
                  disabled={!hasOrganizationDefaults}
                  className="text-xs"
                  type="button"
                >
                  <FileDown className="w-3 h-3 mr-1" />
                  Apply Defaults
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveAsOrganizationDefaults}
                  className="text-xs"
                  type="button"
                >
                  <Save className="w-3 h-3 mr-1" />
                  Save as Defaults
                </Button>
              </div>
            </div>
            {hasOrganizationDefaults && (
              <p className="text-xs text-gray-500 pl-6">
                Organization: {defaults.organization_name || 'Not set'} •
                Prepared by: {defaults.prepared_by || 'Not set'}
              </p>
            )}
            {!hasOrganizationDefaults && (
              <p className="text-xs text-gray-500 pl-6">
                No defaults saved. Fill out the form and save as defaults for future use.
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="border-t" />

          {/* Templates Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileUp className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium text-gray-700">SSP Templates</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsSaveDialogOpen(true)}
                className="text-xs"
                type="button"
              >
                <Save className="w-3 h-3 mr-1" />
                Save as Template
              </Button>
            </div>

            {/* Save Template Dialog */}
            {isSaveDialogOpen && (
              <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                <Input
                  placeholder="Template name"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  className="text-sm"
                />
                <Input
                  placeholder="Description (optional)"
                  value={newTemplateDescription}
                  onChange={(e) => setNewTemplateDescription(e.target.value)}
                  className="text-sm"
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsSaveDialogOpen(false);
                      setNewTemplateName('');
                      setNewTemplateDescription('');
                    }}
                    type="button"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveTemplate}
                    className="bg-purple-600 hover:bg-purple-700"
                    type="button"
                  >
                    Save Template
                  </Button>
                </div>
              </div>
            )}

            {/* Template List */}
            {sortedTemplates.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {sortedTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {template.name}
                        </span>
                        {template.sourceProjectName && (
                          <span className="px-1.5 py-0.5 bg-gray-200 text-gray-600 text-xs rounded">
                            from: {template.sourceProjectName}
                          </span>
                        )}
                      </div>
                      {template.description && (
                        <p className="text-xs text-gray-500 truncate">
                          {template.description}
                        </p>
                      )}
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {formatDate(template.updatedAt)}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleApplyTemplate(template)}
                        className="h-7 px-2 text-xs"
                        type="button"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Apply
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => handleDeleteTemplate(template.id, e)}
                        className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        type="button"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 text-center py-3">
                No templates saved yet. Complete the form and save as a template for reuse.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
