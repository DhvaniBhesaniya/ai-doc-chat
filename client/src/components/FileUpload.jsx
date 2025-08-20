import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useUploadDocument } from "@/hooks/useDocuments.js";

export function FileUpload({ onUploadStart, onUploadComplete }) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploadMutation = useUploadDocument();

  const onDrop = useCallback(
    (acceptedFiles) => {
      acceptedFiles.forEach((file) => {
        if (file.type === "application/pdf") {
          onUploadStart?.();
          setUploadProgress(0);
          
          // Simulate upload progress
          const progressInterval = setInterval(() => {
            setUploadProgress(prev => {
              if (prev >= 90) {
                clearInterval(progressInterval);
                return 90; // Stop at 90% until actual completion
              }
              return prev + Math.random() * 15;
            });
          }, 200);
          
          uploadMutation.mutate(file, {
            onSuccess: () => {
              setUploadProgress(100);
              setTimeout(() => {
                setUploadProgress(0);
                onUploadComplete?.();
              }, 500);
            },
            onError: () => {
              clearInterval(progressInterval);
              setUploadProgress(0);
              onUploadComplete?.();
            }
          });
        }
      });
      setIsDragActive(false);
    },
    [uploadMutation, onUploadStart, onUploadComplete]
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
    },
    multiple: true,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
  });

  return (
    <div
      {...getRootProps()}
      className={`
        upload-area p-6 rounded-lg cursor-pointer text-center transition-all duration-200
        ${isDragActive ? "drag-over" : ""}
        ${uploadMutation.isPending ? "opacity-50 pointer-events-none" : ""}
      `}
      data-testid="file-upload-area"
    >
      <input {...getInputProps()} data-testid="file-input" />
      
      <div className="flex flex-col items-center">
        <svg className="w-12 h-12 text-muted-foreground mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        
        {uploadMutation.isPending ? (
          <div className="w-full max-w-xs">
            <p className="text-sm font-medium text-foreground mb-2">
              Uploading... {Math.round(uploadProgress)}%
            </p>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="ai-gradient h-2 rounded-full transition-all duration-300" 
                style={{width: `${uploadProgress}%`}} 
              />
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-foreground mb-1">
              {isDragActive ? "Drop PDFs here" : "Drop PDFs here or click to upload"}
            </p>
            <p className="text-xs text-muted-foreground">
              Supports multiple PDF files
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
