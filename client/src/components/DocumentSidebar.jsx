import React from "react";
import { FileUpload } from "./FileUpload.jsx";
import { useDocuments, useDeleteDocument } from "@/hooks/useDocuments.js";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

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

  const getStatusText = (status, progress, error) => {
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
        return error ? `Failed: ${error}` : "Failed";
      default:
        return "Pending";
    }
  };

  return (
    <div
      className={`bg-card border rounded-lg p-4 hover:shadow-sm transition-shadow cursor-pointer ${isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border'}`}
      data-testid={`document-item-${document.id}`}
      onClick={() => onSelect?.(document.filename)}
    >
      <div className="flex items-center space-x-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isSelected ? 'ai-gradient text-white' : 'bg-red-500'}`}>
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate" title={document.filename}>
            {document.filename}
          </p>
          <p className="text-xs text-muted-foreground">
            {document.fileSize ? (document.fileSize / (1024 * 1024)).toFixed(1) : '0.0'} MB
            {document.totalPages && ` • ${document.totalPages} pages`}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive transition-colors p-2 h-auto"
          onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(document.id); }}
          disabled={deleteMutation.isPending}
          data-testid={`delete-document-${document.id}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Button>
      </div>
      
      <div className="mt-3">
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getStatusBadge(document.status)}`}
            style={{ width: getProgressWidth(document.status, document.metadata?.progress) }}
          />
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-muted-foreground">
            {getStatusText(document.status, document.metadata?.progress, document.metadata?.error)}
          </span>
          {document.totalChunks && (
            <span className="text-xs text-muted-foreground">
              {document.totalChunks} chunks
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
        className="fixed left-0 top-16 bottom-0 w-80 z-50 lg:static lg:z-auto flex flex-col bg-background border-r border-border"
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

        <ScrollArea className="flex-1 p-6">
          <div className="space-y-3" data-testid="document-list">
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
