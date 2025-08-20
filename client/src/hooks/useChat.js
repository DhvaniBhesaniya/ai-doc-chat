import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient.js";
import { toast } from "@/hooks/use-toast.js";

export function useChat(conversationId) {
  const [isTyping, setIsTyping] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState(conversationId);

  const { data: messages = [], refetch: refetchMessages } = useQuery({
    queryKey: ["/api/conversations", currentConversationId, "messages"],
    enabled: !!currentConversationId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ message, conversationId }) => {
      const response = await apiRequest("POST", "/api/chat", {
        message,
        conversationId,
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

  const sendMessage = useCallback((message) => {
    if (!message.trim()) return;
    sendMessageMutation.mutate({ message: message.trim(), conversationId: currentConversationId });
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
