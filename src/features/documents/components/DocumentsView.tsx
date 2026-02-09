// Documents View - Upload and manage user documents for AI-powered queries
// Allows users to chunk their own documents for RAG-powered compliance assistance
// Enhanced with drag-and-drop batch upload and processing queue

import { useEffect, useCallback, useState } from 'react';
import { useDocumentStore, useDocumentProgressListener, useQueueListener, UserDocument } from '@/core/stores/useDocumentStore';
import { useAuthStore } from '@/core/stores/useAuthStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  FileUp,
  Trash2,
  RefreshCw,
  FileText,
  FileSpreadsheet,
  FileCode,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Upload,
  Pause,
  Play,
  ListOrdered,
} from 'lucide-react';

const SUPPORTED_EXTENSIONS = ['.pdf', '.xlsx', '.xls', '.csv', '.xml', '.md'];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getFileIcon(fileType: string) {
  switch (fileType) {
    case 'pdf':
      return <FileText className="h-5 w-5 text-red-500" />;
    case 'xlsx':
    case 'xls':
    case 'csv':
      return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
    case 'xml':
    case 'md':
      return <FileCode className="h-5 w-5 text-blue-500" />;
    default:
      return <FileText className="h-5 w-5 text-gray-500" />;
  }
}

function getStatusBadge(status: UserDocument['status']) {
  switch (status) {
    case 'pending':
      return (
        <Badge variant="outline" className="text-yellow-600 border-yellow-600">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    case 'processing':
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-600">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Processing
        </Badge>
      );
    case 'completed':
      return (
        <Badge variant="outline" className="text-green-600 border-green-600">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="outline" className="text-red-600 border-red-600">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
  }
}

interface DocumentRowProps {
  document: UserDocument;
  onProcess: () => void;
  onDelete: () => void;
  isProcessing: boolean;
}

function DocumentRow({ document, onProcess, onDelete, isProcessing }: DocumentRowProps) {
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-4">
        {getFileIcon(document.fileType)}
        <div>
          <div className="font-medium">{document.filename}</div>
          <div className="text-sm text-muted-foreground">
            {formatFileSize(document.sizeBytes)} &bull; {formatDate(document.uploadedAt)}
            {document.chunkCount && ` &bull; ${document.chunkCount} chunks`}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {getStatusBadge(document.status)}
        {document.status === 'pending' && (
          <Button
            size="sm"
            variant="outline"
            onClick={onProcess}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-1" />
                Process
              </>
            )}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          disabled={isProcessing}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function DocumentsView() {
  const {
    documents,
    isLoading,
    processingProgress,
    queueStatus,
    error,
    loadDocuments,
    uploadDocument,
    uploadBatch,
    processDocument,
    queueDocuments,
    pauseQueue,
    resumeQueue,
    deleteDocument,
    clearError
  } = useDocumentStore();
  const { license, isAuthenticated } = useAuthStore();
  const { setupListener, removeListener } = useDocumentProgressListener();
  const { setupListener: setupQueueListener, removeListener: removeQueueListener } = useQueueListener();

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const [showQueue, setShowQueue] = useState(false);

  // Load documents on mount
  useEffect(() => {
    if (isAuthenticated && license?.user_id) {
      loadDocuments();
    }
  }, [isAuthenticated, license?.user_id, loadDocuments]);

  // Setup progress and queue listeners
  useEffect(() => {
    setupListener();
    setupQueueListener();
    return () => {
      removeListener();
      removeQueueListener();
    };
  }, [setupListener, removeListener, setupQueueListener, removeQueueListener]);

  // Drag and drop handlers
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

    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(file => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      return SUPPORTED_EXTENSIONS.includes(ext);
    });

    if (validFiles.length === 0) {
      return;
    }

    // Get file paths (works in Electron)
    const filePaths = validFiles.map(file => (file as any).path).filter(Boolean);

    if (filePaths.length === 0) {
      console.error('File paths not available - running outside Electron?');
      return;
    }

    // Upload batch of files
    const uploadResult = await uploadBatch(filePaths);

    if (uploadResult.success && uploadResult.results) {
      // Queue all successfully uploaded documents for processing
      const docsToQueue = uploadResult.results
        .filter(r => r.success && r.documentId && r.filePath)
        .map(r => ({
          documentId: r.documentId!,
          filePath: r.filePath!
        }));

      if (docsToQueue.length > 0) {
        await queueDocuments(docsToQueue);
      }
    }
  }, [uploadBatch, queueDocuments]);

  const handleFileSelect = useCallback(async () => {
    // This is handled by the Electron dialog - we'll need to add a file picker dialog
    // For now, we'll use a simple input element approach
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = SUPPORTED_EXTENSIONS.join(',');
    input.multiple = true; // Enable multiple file selection

    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length === 0) return;

      // Get file paths (works in Electron)
      const filePaths = files.map(file => (file as any).path).filter(Boolean);

      if (filePaths.length === 0) {
        console.error('File paths not available - running outside Electron?');
        return;
      }

      if (filePaths.length === 1) {
        // Single file - use direct upload and process
        const uploadResult = await uploadDocument(filePaths[0]);
        if (uploadResult.success && uploadResult.documentId) {
          await processDocument(uploadResult.documentId, filePaths[0]);
        }
      } else {
        // Multiple files - use batch upload and queue
        const uploadResult = await uploadBatch(filePaths);

        if (uploadResult.success && uploadResult.results) {
          const docsToQueue = uploadResult.results
            .filter(r => r.success && r.documentId && r.filePath)
            .map(r => ({
              documentId: r.documentId!,
              filePath: r.filePath!
            }));

          if (docsToQueue.length > 0) {
            await queueDocuments(docsToQueue);
          }
        }
      }
    };

    input.click();
  }, [uploadDocument, processDocument, uploadBatch, queueDocuments]);

  const handleProcess = useCallback(async (doc: UserDocument) => {
    await processDocument(doc.id, doc.originalPath);
  }, [processDocument]);

  const handleDelete = useCallback(async (doc: UserDocument) => {
    if (confirm(`Delete "${doc.filename}"? This will also remove all processed chunks.`)) {
      await deleteDocument(doc.id);
    }
  }, [deleteDocument]);

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              Please import your license file to access the Documents feature.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const processingDocId = processingProgress?.documentId;
  const hasQueuedItems = queueStatus && (queueStatus.queueLength > 0 || queueStatus.isProcessing);

  return (
    <div
      className="h-full flex flex-col p-6 bg-background"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-primary/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="p-8 bg-background border-2 border-dashed border-primary rounded-xl shadow-lg">
            <div className="flex flex-col items-center gap-4">
              <Upload className="h-16 w-16 text-primary" />
              <div className="text-center">
                <p className="text-xl font-semibold">Drop files here</p>
                <p className="text-muted-foreground">
                  Drop your compliance documents to upload and process
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Documents</h1>
          <p className="text-muted-foreground">
            Upload and process your own compliance documents for AI-powered queries
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasQueuedItems && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowQueue(!showQueue)}
            >
              <ListOrdered className="h-4 w-4 mr-2" />
              Queue ({queueStatus?.queueLength || 0})
            </Button>
          )}
          <Button onClick={handleFileSelect} disabled={isLoading}>
            <FileUp className="h-4 w-4 mr-2" />
            Upload Documents
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive rounded-lg flex items-center justify-between">
          <span className="text-destructive">{error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Processing Progress */}
      {processingProgress && processingProgress.status !== 'completed' && (
        <Card className="mb-4">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">{processingProgress.message}</span>
                  <span className="text-sm text-muted-foreground">{processingProgress.progress}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${processingProgress.progress}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Queue Status Panel */}
      {showQueue && queueStatus && (
        <Card className="mb-4">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Processing Queue</CardTitle>
              <div className="flex items-center gap-2">
                {queueStatus.isPaused ? (
                  <Button size="sm" variant="outline" onClick={resumeQueue}>
                    <Play className="h-4 w-4 mr-1" />
                    Resume
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={pauseQueue}>
                    <Pause className="h-4 w-4 mr-1" />
                    Pause
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="py-2">
            {queueStatus.isProcessing && queueStatus.currentItem && (
              <div className="flex items-center gap-2 p-2 bg-blue-50 rounded mb-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-sm text-blue-800">
                  Currently processing: {documents.find(d => d.id === queueStatus.currentItem?.documentId)?.filename || 'Unknown'}
                </span>
              </div>
            )}
            {queueStatus.queue.length === 0 && !queueStatus.isProcessing ? (
              <p className="text-sm text-muted-foreground text-center py-2">Queue is empty</p>
            ) : (
              <div className="space-y-1">
                {queueStatus.queue.map((item, index) => (
                  <div key={item.documentId} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">#{index + 1}</span>
                      <span>{documents.find(d => d.id === item.documentId)?.filename || item.documentId}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {item.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Document List */}
      <Card className="flex-1 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg">Uploaded Documents</CardTitle>
          <CardDescription>
            Supported formats: PDF, Excel (.xlsx, .xls), CSV, XML, Markdown (.md)
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-auto h-[calc(100%-80px)]">
          {isLoading && documents.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : documents.length === 0 ? (
            <div className="py-8">
              {/* Empty state with drag-drop hint */}
              <div className="text-center mb-8">
                <div className="relative inline-block">
                  <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                  <Upload className="h-6 w-6 text-primary absolute -bottom-1 -right-1 bg-background rounded-full p-1" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Upload Compliance Documents</h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  Drag and drop multiple files or click to select. Documents will be
                  automatically queued for processing.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Button onClick={handleFileSelect}>
                    <FileUp className="h-4 w-4 mr-2" />
                    Select Documents
                  </Button>
                </div>
              </div>

              {/* Suggested NIST documents */}
              <div className="border-t pt-6 mt-6">
                <h4 className="text-sm font-medium mb-3 text-center text-muted-foreground">
                  Recommended NIST Documents
                </h4>
                <div className="grid gap-2 max-w-lg mx-auto">
                  {[
                    { title: 'NIST SP 800-53 Rev. 5', desc: 'Security and Privacy Controls' },
                    { title: 'NIST SP 800-37 Rev. 2', desc: 'Risk Management Framework' },
                    { title: 'NIST SP 800-171 Rev. 2', desc: 'Protecting CUI' },
                  ].map((doc) => (
                    <div
                      key={doc.title}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 text-sm"
                    >
                      <div>
                        <span className="font-medium">{doc.title}</span>
                        <span className="text-muted-foreground ml-2">- {doc.desc}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">Recommended</Badge>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center mt-4">
                  Download from csrc.nist.gov and upload to enable AI-powered compliance queries
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  document={doc}
                  onProcess={() => handleProcess(doc)}
                  onDelete={() => handleDelete(doc)}
                  isProcessing={processingDocId === doc.id}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Footer */}
      <div className="mt-4 text-sm text-muted-foreground">
        <p>
          Documents are chunked and embedded locally. Your data never leaves your machine.
          Processed documents can be queried alongside the compliance library in the AI assistant.
        </p>
      </div>
    </div>
  );
}
