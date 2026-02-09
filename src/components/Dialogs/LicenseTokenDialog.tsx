// License Dialog - UI for importing .license files
// Supports file picker and drag-and-drop for offline license activation

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/core/stores/useAuthStore';
import { 
  formatLicenseCode, 
  formatExpirationDate, 
  getTimeUntilExpiration 
} from '@/lib/auth/licenseFileValidator';
import { CheckCircle2, XCircle, Loader2, Key, AlertCircle, Upload, FileText, LogOut } from 'lucide-react';

interface LicenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const LicenseTokenDialog = ({ open, onOpenChange }: LicenseDialogProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  const { 
    isAuthenticated, 
    isLoading, 
    license, 
    daysRemaining,
    error,
    importLicenseFile, 
    importLicenseFromDrop,
    clearLicense 
  } = useAuthStore();

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setImportError(null);
      setImportSuccess(false);
    }
  }, [open]);

  const handleImportClick = async () => {
    setImportError(null);
    setImportSuccess(false);
    
    const result = await importLicenseFile();
    
    if (result.success) {
      setImportSuccess(true);
      // Close dialog after brief success display
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    } else if (result.error && result.error !== 'cancelled') {
      setImportError(result.error);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setImportError(null);
    setImportSuccess(false);

    const files = Array.from(e.dataTransfer.files);
    const licenseFile = files.find(f => f.name.endsWith('.license'));

    if (!licenseFile) {
      setImportError('Please drop a .license file');
      return;
    }

    try {
      const content = await licenseFile.text();
      const result = await importLicenseFromDrop(content);
      
      if (result.success) {
        setImportSuccess(true);
        setTimeout(() => {
          onOpenChange(false);
        }, 1500);
      } else if (result.error) {
        setImportError(result.error);
      }
    } catch (err) {
      setImportError('Failed to read file');
    }
  }, [importLicenseFromDrop, onOpenChange]);

  const handleDeactivate = async () => {
    await clearLicense();
    setImportSuccess(false);
    setImportError(null);
  };

  const handleClose = () => {
    setImportError(null);
    setImportSuccess(false);
    onOpenChange(false);
  };

  // If already authenticated, show license info
  if (isAuthenticated && license) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              License Active
            </DialogTitle>
            <DialogDescription>
              Your license is currently active and valid.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-green-50 border border-green-200">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-900">
                    {formatLicenseCode(license.license_code)}
                  </span>
                </div>
                
                <div className="text-sm text-green-800 space-y-1">
                  <p>
                    <span className="font-medium">Email:</span> {license.email}
                  </p>
                  <p>
                    <span className="font-medium">Plan:</span>{' '}
                    {license.subscription_plan || 'Standard'}
                  </p>
                  <p>
                    <span className="font-medium">Expires:</span>{' '}
                    {formatExpirationDate(license.expires_at)}
                  </p>
                  {daysRemaining !== null && (
                    <p className="text-green-600 font-medium">
                      {getTimeUntilExpiration(license.expires_at)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleDeactivate}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Deactivate
            </Button>
            <Button onClick={handleClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            Activate License
          </DialogTitle>
          <DialogDescription>
            Import your license file to unlock premium features.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-colors
              ${isDragging 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
              }
              ${isLoading ? 'opacity-50 pointer-events-none' : ''}
            `}
          >
            <div className="flex flex-col items-center gap-3">
              <div className={`
                w-12 h-12 rounded-full flex items-center justify-center
                ${isDragging ? 'bg-blue-100' : 'bg-gray-100'}
              `}>
                <Upload className={`w-6 h-6 ${isDragging ? 'text-blue-600' : 'text-gray-500'}`} />
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {isDragging ? 'Drop license file here' : 'Drag & drop your .license file'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  or click the button below to browse
                </p>
              </div>
            </div>
          </div>

          {/* Import Button */}
          <Button
            onClick={handleImportClick}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Select License File
              </>
            )}
          </Button>

          {/* Success Message */}
          {importSuccess && (
            <div className="p-4 rounded-lg bg-green-50 border border-green-200">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-green-900">License Activated!</p>
                  <p className="text-sm text-green-700">All premium features are now unlocked.</p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {(importError || error) && !importSuccess && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-red-900">Import Failed</p>
                  <p className="text-sm text-red-800 mt-1">{importError || error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">How to get your license file:</p>
                <ol className="list-decimal list-inside mt-1 space-y-1 text-blue-700">
                  <li>Visit{' '}
                    <a 
                      href="https://complinist.com" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline hover:text-blue-900"
                    >
                      complinist.com
                    </a>
                  </li>
                  <li>Go to your License Dashboard</li>
                  <li>Download your .license file</li>
                  <li>Import it here</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
