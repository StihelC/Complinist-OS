import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Save, Download, FileJson, ImageIcon, Folder, Package, FileText, NotebookPen, Network, BookOpen, Key, CheckCircle2, LogOut, User, FileDown, FileSpreadsheet, Code2, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/core/stores/useAuthStore';
import { AIStatusIndicator } from './AI/AIStatusIndicator';
import { useState, useEffect } from 'react';
import { LicenseTokenDialog } from './Dialogs/LicenseTokenDialog';
import { getTimeUntilExpiration, formatLicenseCode } from '@/lib/auth/licenseFileValidator';
import { TerraformPlanLoader } from '@/features/terraform/components/TerraformPlanLoader';
import { TerraformChangeLegend } from '@/features/terraform/components/TerraformChangeLegend';

interface AppHeaderProps {
  currentProject: { name: string; baseline: string } | null;
  isSaving: boolean;
  isExporting: boolean;
  activeView: 'topology' | 'inventory' | 'ssp' | 'narratives' | 'ai';
  onSave: () => void;
  onExportJSON: () => void;
  onExportPNG: () => void;
  onExportSVG?: () => void;
  onExportInventoryCSV?: () => void;
  onExportSSP?: () => void;
  onShowProjects: () => void;
  onViewChange: (view: 'topology' | 'inventory' | 'ssp' | 'narratives' | 'ai') => void;
}

export const AppHeader = ({
  currentProject,
  isSaving,
  isExporting,
  activeView,
  onSave,
  onExportJSON,
  onExportPNG,
  onExportSVG,
  onExportInventoryCSV,
  onExportSSP,
  onShowProjects,
  onViewChange,
}: AppHeaderProps) => {
  // Use selector to ensure reactivity when isAuthenticated changes
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const license = useAuthStore((state) => state.license);
  const daysRemaining = useAuthStore((state) => state.daysRemaining);
  const clearLicense = useAuthStore((state) => state.clearLicense);
  const [showLicenseDialog, setShowLicenseDialog] = useState(false);
  const [showTerraformDialog, setShowTerraformDialog] = useState(false);

  // Listen for Electron menu events
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onMenuEnterLicense?.(() => {
        setShowLicenseDialog(true);
      });
      
      window.electronAPI.onMenuLicenseStatus?.(() => {
        setShowLicenseDialog(true);
      });
    }
  }, []);

  // Removed handlePremiumFeatureClick - buttons now navigate directly

  const handleDeactivate = async () => {
    await clearLicense();
  };

  return (
    <>
      <div className="h-14 bg-white border-b flex items-center px-4 shadow-sm gap-3">
        {/* Left Section - Branding & Project Info */}
        <div className="flex items-center gap-3 min-w-0 shrink-0">
          <h1 className="text-xl font-bold text-gray-800 whitespace-nowrap">CompliNist</h1>
          <div className="h-6 w-px bg-gray-200" />
          {currentProject ? (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-gray-500 uppercase tracking-wide whitespace-nowrap">Project:</span>
              <span className="text-sm font-medium text-gray-700 truncate max-w-[180px]" title={currentProject.name}>
                {currentProject.name}
              </span>
            </div>
          ) : (
            <span className="text-xs text-amber-600 font-medium whitespace-nowrap">No project loaded</span>
          )}
        </div>

        {/* Center Section - File Actions */}
        <div className="flex items-center gap-1.5">
          <Button
            onClick={onSave}
            variant="outline"
            size="sm"
            disabled={!currentProject || isSaving}
            className="h-8 px-3"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-1.5" />
            )}
            Save
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" disabled={!currentProject || isExporting} className="h-8 px-3">
                {isExporting ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-1.5" />
                )}
                Export
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <div className="space-y-3">
                <h4 className="font-medium text-sm pb-2 border-b">Export Options</h4>

                {/* Canvas/Topology Exports */}
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">Canvas</p>
                  <Button
                    onClick={onExportJSON}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    disabled={isExporting}
                  >
                    <FileJson className="w-4 h-4 mr-2" />
                    Export as JSON
                  </Button>
                  <Button
                    onClick={onExportPNG}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    disabled={isExporting}
                  >
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Export as PNG
                  </Button>
                  {onExportSVG && (
                    <Button
                      onClick={onExportSVG}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      disabled={isExporting}
                    >
                      <ImageIcon className="w-4 h-4 mr-2" />
                      Export as SVG
                    </Button>
                  )}
                </div>

                {/* Inventory Export */}
                {onExportInventoryCSV && (
                  <div className="space-y-1 pt-2 border-t">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">Inventory</p>
                    <Button
                      onClick={onExportInventoryCSV}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      disabled={isExporting}
                    >
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Export Inventory as CSV
                    </Button>
                  </div>
                )}

                {/* SSP Export */}
                {onExportSSP && (
                  <div className="space-y-1 pt-2 border-t">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">SSP</p>
                    <Button
                      onClick={onExportSSP}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      disabled={isExporting}
                    >
                      <FileDown className="w-4 h-4 mr-2" />
                      Generate SSP PDF
                    </Button>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
          <Button
            onClick={onShowProjects}
            variant="outline"
            size="sm"
            className="h-8 px-3"
          >
            <Folder className="w-4 h-4 mr-1.5" />
            Projects
          </Button>
        </div>

        {/* Navigation Tabs - Main Views */}
        <div className="flex items-center gap-1 flex-1 justify-center">
          <Button
            onClick={() => onViewChange('topology')}
            variant={activeView === 'topology' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 px-3"
          >
            <Network className="w-4 h-4 mr-1.5" />
            Topology
          </Button>
          <Button
            onClick={() => onViewChange('inventory')}
            variant={activeView === 'inventory' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 px-3"
          >
            <Package className="w-4 h-4 mr-1.5" />
            Inventory
          </Button>
          {/* Premium tabs - only visible when licensed */}
          {isAuthenticated && (
            <>
              <Button
                onClick={() => onViewChange('ssp')}
                variant={activeView === 'ssp' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 px-3"
              >
                <FileText className="w-4 h-4 mr-1.5" />
                SSP
              </Button>
              <Button
                onClick={() => onViewChange('narratives')}
                variant={activeView === 'narratives' ? 'default' : 'ghost'}
                size="sm"
                disabled={!currentProject}
                title={!currentProject ? 'No project selected' : undefined}
                className="h-8 px-3"
              >
                <NotebookPen className="w-4 h-4 mr-1.5" />
                Narratives
              </Button>
              <Button
                onClick={() => onViewChange('ai')}
                variant={activeView === 'ai' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 px-3"
              >
                <BookOpen className="w-4 h-4 mr-1.5" />
                AI
              </Button>
            </>
          )}
          <Button
            onClick={() => setShowTerraformDialog(true)}
            variant="ghost"
            size="sm"
            className="h-8 px-3"
          >
            <Code2 className="w-4 h-4 mr-1.5" />
            Terraform
          </Button>
        </div>

        {/* Right Section - Status & License */}
        <div className="flex items-center gap-2 shrink-0">
          <AIStatusIndicator />

          {/* License Status */}
          {isAuthenticated && license ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-green-300 bg-green-50 hover:bg-green-100 text-green-700"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                  Licensed
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72" align="end">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <User className="w-4 h-4 text-green-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {license.email}
                      </p>
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Active License
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="text-gray-500">Code: </span>
                      <span className="text-gray-700 font-mono text-xs">
                        {formatLicenseCode(license.license_code)}
                      </span>
                    </p>
                    {license.subscription_plan && (
                      <p>
                        <span className="text-gray-500">Plan: </span>
                        <span className="text-gray-700 capitalize">{license.subscription_plan}</span>
                      </p>
                    )}
                    {daysRemaining !== null && (
                      <p>
                        <span className="text-gray-500">Expires: </span>
                        <span className="text-gray-700">{getTimeUntilExpiration(license.expires_at)}</span>
                      </p>
                    )}
                  </div>
                  
                  <div className="flex gap-2 pt-1">
                    <Button
                      onClick={() => setShowLicenseDialog(true)}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <Key className="w-3 h-3 mr-1" />
                      Manage
                    </Button>
                    <Button
                      onClick={handleDeactivate}
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <LogOut className="w-3 h-3 mr-1" />
                      Deactivate
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <Button
              onClick={() => setShowLicenseDialog(true)}
              variant="default"
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Key className="w-4 h-4 mr-2" />
              Import License
            </Button>
          )}
        </div>
      </div>

      <LicenseTokenDialog
        open={showLicenseDialog}
        onOpenChange={setShowLicenseDialog}
      />

      <Dialog open={showTerraformDialog} onOpenChange={setShowTerraformDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Terraform Plan Visualization</DialogTitle>
            <DialogDescription>
              Import and visualize Terraform infrastructure plans.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <TerraformPlanLoader />
            <TerraformChangeLegend />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
