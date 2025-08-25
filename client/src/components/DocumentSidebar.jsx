import React from "react";
import { FileUpload } from "./FileUpload.jsx";
import { useDocuments, useDeleteDocument } from "@/hooks/useDocuments.js";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

function formatFileSize(bytes) {
  if (bytes === undefined || bytes === null) return "";
  const thresh = 1024;
  if (bytes < thresh) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"]; 
  let u = -1;
  let value = bytes;
  do {
    value /= thresh;
    u++;
  } while (value >= thresh && u < units.length - 1);
  const decimals = value < 10 ? 2 : 1;
  return `${value.toFixed(decimals)} ${units[u]}`;
}

function DocumentItem({ document, isSelected, onSelect }) {
  const deleteMutation = useDeleteDocument();

  const getStatusBadge = (status) => {
    switch (status) {
      case "completed":
        return "status-completed";
      case "processing":
        return "status-processing";
      case "error":
        return "status-error";
      default:
        return "bg-muted";
    }
  };

  const getProgressWidth = (status, progress) => {
    if (progress && typeof progress === 'number') {
      return `${Math.min(100, Math.max(0, progress))}%`;
    }
    switch (status) {
      case "completed":
        return "100%";
      case "processing":
        return "50%";
      case "uploading":
        return "25%";
      case "failed":
      case "error":
        return "0%";
      default:
        return "10%";
    }
  };

  const getStatusText = (status, progress, error, stage) => {
    if (stage && (status === "processing" || status === "uploading")) {
      return stage;
    }
    if (status === "processing" && progress) {
      return `Processing... ${progress}%`;
    }
    switch (status) {
      case "completed":
        return "Ready";
      case "processing":
        return "Processing...";
      case "uploading":
        return "Uploading...";
      case "failed":
      case "error":
        if (error && error.length > 50) {
          return "Processing failed - hover for details";
        }
        return error ? `Failed: ${error}` : "Failed";
      default:
        return "Pending";
    }
  };

  return (
    <div
      className={`relative bg-card border rounded-xl p-3 hover:shadow-md transition-all duration-200 cursor-pointer group w-full overflow-hidden box-border min-h-[84px] ${
        isSelected 
          ? 'border-primary bg-primary/5 shadow-sm' 
          : document.status === 'error' 
            ? 'border-destructive/50 bg-destructive/5'
            : 'border-border hover:border-primary/50'
      }`}
      data-testid={`document-item-${document.id}`}
      onClick={() => onSelect?.(document.originalName || document.filename)}
    >
      {/* Delete Button - Always visible in top right */}
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-1.5 right-2 z-10 w-7 h-7 p-0 rounded-full bg-background/90 backdrop-blur-sm hover:bg-destructive hover:text-destructive-foreground transition-all duration-200 opacity-80 hover:opacity-100 group-hover:opacity-100 shadow-sm"
        onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(document.id); }}
        disabled={deleteMutation.isPending}
        data-testid={`delete-document-${document.id}`}
        title="Delete document"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </Button>

      <div className="flex items-start space-x-2.5 pr-10 min-w-0">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
          isSelected 
            ? 'ai-gradient text-white shadow-md' 
            : document.status === 'error'
              ? 'bg-destructive text-destructive-foreground'
              : document.status === 'completed'
                ? 'bg-green-500 text-white'
                : document.status === 'processing'
                  ? 'bg-amber-500 text-white'
                  : 'bg-muted text-muted-foreground'
        }`}>
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
          </svg>
        </div>
        
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground leading-tight" title={document.originalName || document.filename}>
            <span className="block min-w-0 max-w-full truncate">
              {document.originalName || document.filename}
            </span>
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed whitespace-nowrap overflow-hidden text-ellipsis">
            {document.fileSize !== undefined && document.fileSize !== null ? formatFileSize(document.fileSize) : ''}
            {document.totalPages && ` • ${document.totalPages} pages`}
            {document.totalChunks && ` • ${document.totalChunks} chunks`}
          </p>
        </div>
      </div>
      
      <div className="mt-4 space-y-2">
        {/* Progress Bar */}
        <div className="w-full bg-muted/50 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              getStatusBadge(document.status)
            }`}
            style={{ width: getProgressWidth(document.status, document.metadata?.progress) }}
          />
        </div>
        
        {/* Status and Progress */}
        <div className="flex justify-between items-center">
          <span 
            className={`text-xs font-medium truncate max-w-[150px] ${
              document.status === 'error' 
                ? 'text-destructive' 
                : document.status === 'completed'
                  ? 'text-green-600 dark:text-green-400'
                  : document.status === 'processing'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-muted-foreground'
            }`}
            title={document.metadata?.error && document.metadata.error.length > 50 ? document.metadata.error : undefined}
          >
            {getStatusText(document.status, document.metadata?.progress, document.metadata?.error, document.metadata?.stage)}
          </span>
          
          {document.metadata?.progress && document.status !== "completed" && document.status !== "error" && (
            <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {document.metadata.progress}%
            </span>
          )}
          
          {document.status === 'completed' && (
            <span className="text-xs font-semibold text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
              ✓ Ready
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function DocumentSidebar({ isOpen, onClose, selectedDocumentName, onSelectDocument }) {
  const { data: documents, isLoading, error } = useDocuments();

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={onClose}
        data-testid="sidebar-overlay"
      />
      
      {/* Sidebar */}
      <aside
        className="fixed left-0 top-16 bottom-0 w-80 z-50 lg:static lg:z-auto flex flex-col bg-background border-r border-border overflow-hidden"
        data-testid="document-sidebar"
      >
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Document Library</h2>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={onClose}
              data-testid="close-sidebar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>
          
          <FileUpload />
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-3 max-w-full" data-testid="document-list">
            {isLoading && (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-card border border-border rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-3/4 mb-2" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                    <Skeleton className="h-2 w-full mt-3" />
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="text-center text-muted-foreground py-8">
                <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.232 18.5C3.462 20.333 4.424 22 5.964 22z" />
                </svg>
                <p>Failed to load documents</p>
              </div>
            )}

            {documents && documents.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p>No documents uploaded yet</p>
                <p className="text-xs mt-1">Upload your first PDF to get started</p>
              </div>
            )}

            {documents?.map((document) => (
              <DocumentItem key={document.id} document={document} isSelected={document.filename === selectedDocumentName} onSelect={onSelectDocument} />
            ))}
          </div>
        </ScrollArea>
      </aside>
    </>
  );
}
