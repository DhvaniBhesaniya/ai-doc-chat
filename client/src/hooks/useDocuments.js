import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient.js";
import { toast } from "@/hooks/use-toast.js";

export function useDocuments() {
  return useQuery({
    queryKey: ["/api/documents"],
    // Poll while any document is uploading or processing, stop when all are done/errored
    refetchInterval: (query) => {
      const docs = query.state.data;
      const shouldPoll = Array.isArray(docs)
        ? docs.some((d) => d?.status === "uploading" || d?.status === "processing")
        : true; // if no data yet (initial load), poll to fetch first state
      return shouldPoll ? 1500 : false;
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    staleTime: 0,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append("file", file);
      
      const token = localStorage.getItem("token");
      const headers = {};
      
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
        headers,
        credentials: "include",
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Success",
        description: "Document uploaded successfully and processing started.",
      });
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (documentId) => {
      const response = await apiRequest("DELETE", `/api/documents/${documentId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Document Deleted",
        description: "Document has been successfully removed.",
      });
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Failed to delete document. Please try again.",
        variant: "destructive",
      });
    },
  });
}
