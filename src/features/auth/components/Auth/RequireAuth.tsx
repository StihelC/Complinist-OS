// RequireAuth - Wrapper component for feature gating
// Shows license requirement overlay for unauthenticated users

import { ReactNode, useState } from 'react';
import { useAuthStore } from '@/core/stores/useAuthStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LicenseTokenDialog } from '@/shared/components/Dialogs/LicenseTokenDialog';
import { Lock, Key, ExternalLink } from 'lucide-react';

interface RequireAuthProps {
  children: ReactNode;
  feature?: string;
  fallback?: ReactNode;
}

// Feature descriptions for the UI (premium features only)
const featureDescriptions: Record<string, string> = {
  ssp: 'System Security Plan (SSP) Generation',
  narratives: 'Control Narratives Editor',
  ai: 'AI-Powered Compliance Assistant',
  documents: 'Document Management & RAG',
};

/**
 * Wrapper component that gates content behind authentication
 * Shows a license requirement overlay if user is not authenticated
 * 
 * For this app, having a valid license grants access to all premium features.
 * The feature prop is used for display purposes to show which feature requires licensing.
 */
export const RequireAuth = ({ children, feature, fallback }: RequireAuthProps) => {
  const { isAuthenticated, isLoading } = useAuthStore();
  const [showLicenseDialog, setShowLicenseDialog] = useState(false);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full w-full p-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Checking license...</p>
        </div>
      </div>
    );
  }

  // User is authenticated - allow access to all premium features
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Show custom fallback if provided
  if (fallback) {
    return <>{fallback}</>;
  }

  // Default license requirement overlay
  const featureLabel = feature ? featureDescriptions[feature] || feature : 'This feature';

  return (
    <>
      <div className="flex items-center justify-center h-full w-full p-8 bg-gradient-to-br from-gray-50 to-gray-100">
        <Card className="max-w-md w-full shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-blue-100 mx-auto mb-4">
              <Lock className="w-7 h-7 text-blue-600" />
            </div>
            <CardTitle className="text-xl">License Required</CardTitle>
            <CardDescription className="text-base mt-2">
              {featureLabel} requires an active license.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-gray-600 text-center">
              Unlock premium compliance features with a Complinist license:
            </p>
            <ul className="text-sm text-gray-700 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">✓</span>
                <span>System Security Plan (SSP) Generation</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">✓</span>
                <span>Control Narratives Editor</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">✓</span>
                <span>AI-Powered Compliance Assistant</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">✓</span>
                <span>Document Management & RAG</span>
              </li>
            </ul>
            
            <div className="space-y-3 pt-2">
              <Button
                onClick={() => setShowLicenseDialog(true)}
                className="w-full"
                size="lg"
              >
                <Key className="w-4 h-4 mr-2" />
                Import License File
              </Button>
              
              <div className="text-center">
                <a 
                  href="https://complinist.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                >
                  Get a license at complinist.com
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <LicenseTokenDialog
        open={showLicenseDialog}
        onOpenChange={setShowLicenseDialog}
      />
    </>
  );
};
