// TopologyEmptyState - Animated empty state shown when no devices are on the canvas
// Provides quick-start actions to help new users get started

import { MonitorSmartphone, Upload, Copy, Info, ArrowRight, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils/utils';

interface TopologyEmptyStateProps {
  onAddDevice: () => void;
  onImportTerraform: () => void;
  onLoadSample: () => void;
}

interface QuickActionProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  delay: string;
  variant?: 'primary' | 'secondary';
}

const QuickAction = ({ icon, title, description, onClick, delay, variant = 'secondary' }: QuickActionProps) => (
  <button
    onClick={onClick}
    className={cn(
      'quick-action-card group',
      'flex items-start gap-4 p-4 rounded-xl border-2 text-left w-full',
      'transition-all duration-300 ease-out',
      'hover:shadow-lg hover:-translate-y-1',
      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
      variant === 'primary'
        ? 'bg-blue-50 border-blue-200 hover:border-blue-400 hover:bg-blue-100'
        : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
    )}
    style={{ animationDelay: delay }}
  >
    <div className={cn(
      'flex-shrink-0 p-3 rounded-lg transition-colors duration-300',
      variant === 'primary'
        ? 'bg-blue-100 text-blue-600 group-hover:bg-blue-200'
        : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
    )}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <h3 className={cn(
          'font-semibold text-sm',
          variant === 'primary' ? 'text-blue-900' : 'text-gray-900'
        )}>
          {title}
        </h3>
        <ArrowRight className={cn(
          'w-4 h-4 transition-transform duration-300 group-hover:translate-x-1',
          variant === 'primary' ? 'text-blue-400' : 'text-gray-400'
        )} />
      </div>
      <p className={cn(
        'text-xs mt-1',
        variant === 'primary' ? 'text-blue-700' : 'text-gray-500'
      )}>
        {description}
      </p>
    </div>
  </button>
);

export function TopologyEmptyState({ onAddDevice, onImportTerraform, onLoadSample }: TopologyEmptyStateProps) {
  return (
    <div className="topology-empty-state absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
      {/* Semi-transparent backdrop */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50/80 to-gray-100/80 backdrop-blur-[1px]" />

      {/* Content container */}
      <div className="empty-state-container relative z-10 pointer-events-auto max-w-md w-full mx-4">
        <Card className="shadow-2xl border-0 overflow-hidden">
          {/* Animated gradient header */}
          <div className="empty-state-header relative h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 bg-[length:200%_100%] animate-shimmer" />

          <CardContent className="p-6 space-y-6">
            {/* Title section with tooltip */}
            <div className="empty-state-title text-center space-y-3">
              <div className="inline-flex items-center justify-center p-3 bg-blue-100 rounded-full mb-2">
                <Sparkles className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                Welcome to Your Topology Canvas
              </h2>
              <div className="flex items-center justify-center gap-2">
                <p className="text-sm text-gray-500">
                  Start building your network topology diagram
                </p>
                <Tooltip
                  content="Topology diagrams visualize your network infrastructure, showing how devices connect and communicate. They help with compliance documentation and security analysis."
                >
                  <button className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full">
                    <Info className="w-4 h-4" />
                  </button>
                </Tooltip>
              </div>
            </div>

            {/* Quick start actions */}
            <div className="empty-state-actions space-y-3">
              <QuickAction
                icon={<MonitorSmartphone className="w-5 h-5" />}
                title="Add Your First Device"
                description="Click to open the device palette and place your first network component"
                onClick={onAddDevice}
                delay="0.1s"
                variant="primary"
              />

              <QuickAction
                icon={<Upload className="w-5 h-5" />}
                title="Import from Terraform"
                description="Import infrastructure defined in your Terraform configuration files"
                onClick={onImportTerraform}
                delay="0.2s"
              />

              <QuickAction
                icon={<Copy className="w-5 h-5" />}
                title="Load Sample Network"
                description="Start with a pre-built example topology to explore the features"
                onClick={onLoadSample}
                delay="0.3s"
              />
            </div>

            {/* Hint text */}
            <p className="empty-state-hint text-center text-xs text-gray-400 pt-2">
              You can also drag devices from the toolbar or connect to the canvas directly
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
