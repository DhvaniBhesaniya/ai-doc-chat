import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient.js";
import { toast } from "@/hooks/use-toast.js";

export function useChat(conversationId) {
  const [isTyping, setIsTyping] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState(conversationId);

  const { data: conversationData, refetch: refetchMessages } = useQuery({
    queryKey: ["/api/chat/conversations", currentConversationId],
    enabled: !!currentConversationId,
  });

  const messages = conversationData?.messages || [];

  const sendMessageMutation = useMutation({
    mutationFn: async ({ message, conversationId, documentName }) => {
      const response = await apiRequest("POST", "/api/chat", {
        message,
        conversationId,
        documentName,
      });
      return response.json();
    },
    onMutate: () => {
      setIsTyping(true);
    },
    onSuccess: (data) => {
      setCurrentConversationId(data.conversationId);
      refetchMessages();
      setIsTyping(false);
    },
    onError: (error) => {
      setIsTyping(false);
      toast({
        title: "Chat Error",
        description: error.message || "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const sendMessage = useCallback((message, documentName) => {
    if (!message.trim()) return;
    sendMessageMutation.mutate({ message: message.trim(), conversationId: currentConversationId, documentName });
  }, [sendMessageMutation, currentConversationId]);

  const startNewConversation = useCallback(() => {
    setCurrentConversationId(undefined);
  }, []);

  return {
    messages,
    isTyping,
    sendMessage,
    isLoading: sendMessageMutation.isPending,
    conversationId: currentConversationId,
    startNewConversation,
  };
}
