/**
 * SampleProjectCard Component
 *
 * Displays a sample project template card with name, description,
 * baseline indicator, and tags. Users can click to create a new
 * project from this template.
 */

import { type SampleProject } from '@/lib/samples/sampleProjects';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe, Building2, Cloud, Copy, Server, Shield, Database, Network } from 'lucide-react';
import type { NistBaseline } from '@/lib/utils/types';

interface SampleProjectCardProps {
  project: SampleProject;
  onSelect: (projectId: string) => void;
  isLoading?: boolean;
}

// Get the appropriate icon for the project type
function getProjectIcon(projectId: string) {
  switch (projectId) {
    case 'simple-web-app':
      return <Globe className="w-8 h-8 text-blue-500" />;
    case 'multi-tier-enterprise':
      return <Building2 className="w-8 h-8 text-purple-500" />;
    case 'cloud-native-microservices':
      return <Cloud className="w-8 h-8 text-cyan-500" />;
    default:
      return <Server className="w-8 h-8 text-gray-500" />;
  }
}

// Get badge color based on baseline
function getBaselineBadgeColor(baseline: NistBaseline): string {
  switch (baseline) {
    case 'LOW':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'MODERATE':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'HIGH':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

// Get descriptive stats for the template
function getTemplateStats(project: SampleProject): { devices: number; boundaries: number; connections: number; controls: number } {
  const devices = project.nodes.filter((n) => n.type === 'device').length;
  const boundaries = project.nodes.filter((n) => n.type === 'boundary').length;
  const connections = project.edges.length;
  const controls = Object.keys(project.controlNarratives).length;

  return { devices, boundaries, connections, controls };
}

export function SampleProjectCard({ project, onSelect, isLoading }: SampleProjectCardProps) {
  const stats = getTemplateStats(project);

  return (
    <Card
      className="cursor-pointer hover:border-primary hover:shadow-md transition-all group"
      onClick={() => !isLoading && onSelect(project.id)}
      data-testid={`sample-project-card-${project.id}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {getProjectIcon(project.id)}
            <div>
              <CardTitle className="text-base group-hover:text-primary transition-colors">
                {project.name}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={getBaselineBadgeColor(project.baseline)}>
                  {project.baseline}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <CardDescription className="text-sm line-clamp-2">
          {project.description}
        </CardDescription>

        {/* Stats Row */}
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1" title="Devices">
            <Server className="w-3.5 h-3.5" />
            <span>{stats.devices}</span>
          </div>
          <div className="flex items-center gap-1" title="Security Zones">
            <Shield className="w-3.5 h-3.5" />
            <span>{stats.boundaries}</span>
          </div>
          <div className="flex items-center gap-1" title="Connections">
            <Network className="w-3.5 h-3.5" />
            <span>{stats.connections}</span>
          </div>
          <div className="flex items-center gap-1" title="Pre-filled Controls">
            <Database className="w-3.5 h-3.5" />
            <span>{stats.controls}</span>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mt-3">
          {project.tags.slice(0, 4).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
              {tag}
            </Badge>
          ))}
        </div>
        {/* Footer Button */}
        <div className="pt-3 mt-3 border-t">
          <Button
            size="sm"
            className="w-full gap-2"
            disabled={isLoading}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(project.id);
            }}
          >
            <Copy className="w-4 h-4" />
            Use This Template
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
