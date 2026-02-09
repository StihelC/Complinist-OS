/**
 * SampleProjectsSection Component
 *
 * Displays a grid of sample project templates that users can clone
 * to quickly get started with a pre-built topology and control narratives.
 */

import { useState } from 'react';
import { sampleProjects } from '@/lib/samples/sampleProjects';
import { SampleProjectCard } from './SampleProjectCard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Sparkles } from 'lucide-react';

interface SampleProjectsSectionProps {
  onCreateFromTemplate: (templateId: string, projectName: string) => Promise<void>;
  onBack: () => void;
}

export function SampleProjectsSection({ onCreateFromTemplate, onBack }: SampleProjectsSectionProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const selectedTemplate = selectedTemplateId
    ? sampleProjects.find((p) => p.id === selectedTemplateId)
    : null;

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    // Pre-fill project name with template name
    const template = sampleProjects.find((p) => p.id === templateId);
    if (template) {
      setProjectName(template.name);
    }
  };

  const handleCreate = async () => {
    if (!selectedTemplateId || !projectName.trim()) return;

    setIsCreating(true);
    try {
      await onCreateFromTemplate(selectedTemplateId, projectName);
    } finally {
      setIsCreating(false);
    }
  };

  const handleBack = () => {
    if (selectedTemplateId) {
      setSelectedTemplateId(null);
      setProjectName('');
    } else {
      onBack();
    }
  };

  return (
    <div className="space-y-4" data-testid="sample-projects-section">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={handleBack} className="p-1 h-8 w-8">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-yellow-500" />
          <h3 className="font-semibold">
            {selectedTemplate ? 'Name Your Project' : 'Start from Template'}
          </h3>
        </div>
      </div>

      {!selectedTemplate ? (
        // Template Selection Grid
        <>
          <p className="text-sm text-muted-foreground">
            Choose a pre-built template to get started quickly. Each template includes a complete
            topology, device inventory, and starter control narratives.
          </p>
          <div className="grid gap-3">
            {sampleProjects.map((project) => (
              <SampleProjectCard
                key={project.id}
                project={project}
                onSelect={handleSelectTemplate}
                isLoading={isCreating}
              />
            ))}
          </div>
        </>
      ) : (
        // Project Name Input
        <div className="space-y-4">
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">Template:</span>
              <span className="text-muted-foreground">{selectedTemplate.name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm mt-1">
              <span className="font-medium">Baseline:</span>
              <span className="text-muted-foreground">{selectedTemplate.baseline}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-project-name">Project Name</Label>
            <Input
              id="template-project-name"
              placeholder="Enter a name for your project..."
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && projectName.trim()) {
                  handleCreate();
                }
              }}
              disabled={isCreating}
              autoFocus
              data-testid="template-project-name-input"
            />
          </div>

          <Button
            onClick={handleCreate}
            className="w-full"
            disabled={!projectName.trim() || isCreating}
            data-testid="create-from-template-button"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating Project...
              </>
            ) : (
              'Create Project'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
