import React, { useEffect, useRef, useState } from "react";
import { useChat } from "@/hooks/useChat.js";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDocuments } from "@/hooks/useDocuments.js";

function SourceCitationCard({ source }) {
  return (
    <div
      className="p-3 rounded-lg border border-border bg-muted/50"
      data-testid={`source-citation-${source.documentId}`}
    >
      <p className="text-xs text-muted-foreground mb-2 flex items-center">
        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 012 2h-3l-4 4z" />
        </svg>
        Source from {source.documentName}:
      </p>
      <p className="text-sm italic text-foreground/90">{source.excerpt}</p>
      {source.pageNumber && (
        <p className="text-xs text-muted-foreground mt-2">
          Page {source.pageNumber}
        </p>
      )}
    </div>
  );
}

function MessageBubble({ message, isUser }) {
  return (
    <div
      className="flex items-start space-x-3"
      data-testid={`message-${message.id}`}
    >
      <div 
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? "bg-primary text-primary-foreground" : "ai-gradient text-white"
        }`}
      >
        {isUser ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )}
      </div>
      
      <div className="flex-1">
        <div 
          className={`p-4 rounded-lg max-w-2xl ${
            isUser 
              ? "chat-bubble-user"
              : "chat-bubble-ai"
          }`}
        >
          {isUser ? (
            <p className="text-sm">{message.content}</p>
          ) : (
            <div>
              <div dangerouslySetInnerHTML={{ __html: message.content.replace(/\n/g, '<br />') }} />
              
              {message.sources && message.sources.length > 0 && (
                <div className="mt-4 space-y-2">
                  {message.sources.map((source, index) => (
                    <SourceCitationCard key={index} source={source} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {new Date(message.createdAt).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div
      className="flex items-start space-x-3"
      data-testid="typing-indicator"
    >
      <div className="w-8 h-8 rounded-full ai-gradient flex items-center justify-center flex-shrink-0 text-white">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <div className="flex-1">
        <div className="chat-bubble-ai p-4 rounded-lg max-w-md">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
            <span className="text-sm text-muted-foreground ml-2">AI is thinking...</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function WelcomeSection({ onGetStarted }) {
  return (
    <div
      className="p-6 text-center"
      data-testid="welcome-section"
    >
      <div className="bg-card border border-border rounded-lg p-8 mb-6">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto mb-4 ai-gradient rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-foreground mb-4">
          AI Document Chat
        </h2>
        <p className="text-muted-foreground text-base mb-8">
          Upload your PDF documents and chat with them using advanced AI technology. 
          Get instant answers with source citations.
        </p>
        
        <div className="grid md:grid-cols-3 gap-6">
          {[{icon:(
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              ),title:"Smart Upload",description:"Drag & drop multiple PDFs with automatic text extraction"},{icon:(
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              ),title:"Semantic Search",description:"Find relevant information using AI-powered understanding"},{icon:(
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              ),title:"Contextual Chat",description:"Maintain conversation context with source citations"}].map((feature) => (
            <div
              key={feature.title}
              className="bg-muted/30 p-6 rounded-lg"
            >
              <div className="w-12 h-12 ai-gradient rounded-lg flex items-center justify-center mb-4 mx-auto text-white">
                {feature.icon}
              </div>
              <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
        
        <Button
          className="mt-8 btn-ai px-8 py-3 rounded-lg"
          onClick={onGetStarted}
          data-testid="get-started-button"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Get Started
        </Button>
      </div>
    </div>
  );
}

export function ChatContainer({ selectedDocumentName }) {
  const { messages, isTyping, sendMessage, isLoading } = useChat();
  const { data: documents } = useDocuments();
  const [input, setInput] = useState("");
  const [showWelcome, setShowWelcome] = useState(true);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (messages.length > 0) {
      setShowWelcome(false);
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    setShowWelcome(false);
    sendMessage(input, selectedDocumentName);
    setInput("");
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleGetStarted = () => {
    setShowWelcome(false);
  };

  const documentCount = documents?.length || 0;
  const completedDocs = documents?.filter(doc => doc.status === "completed") || [];
  const totalChunks = completedDocs.reduce((sum, doc) => sum + (doc.totalChunks || 0), 0);

  return (
    <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
      <ScrollArea className="flex-1" data-testid="chat-messages">
        <div className="min-h-full flex flex-col">
          {showWelcome && <WelcomeSection onGetStarted={handleGetStarted} />}
          <div className="flex-1 px-6 pb-6">
            <div className="space-y-4">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isUser={message.role === "user"}
                />
              ))}
              {isTyping && <TypingIndicator />}
            </div>
            <div ref={messagesEndRef} />
          </div>
        </div>
      </ScrollArea>

      {/* Chat Input */}
      <div className="p-6 border-t border-border">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-end space-x-4">
            <div className="flex-1">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={`Ask about ${selectedDocumentName || 'your documents'}...`}
                className="w-full bg-transparent text-foreground placeholder-muted-foreground resize-none focus:outline-none border-0 shadow-none min-h-[24px] max-h-32"
                rows={1}
                data-testid="chat-input"
              />
              {selectedDocumentName && (
                <div className="text-xs text-muted-foreground mt-1">Using document: <span className="font-medium">{selectedDocumentName}</span></div>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                data-testid="attach-button"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </Button>
              <Button
                className="btn-ai px-4 py-2 rounded-lg disabled:opacity-50"
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                data-testid="send-button"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
            <div className="flex items-center space-x-4">
              <span data-testid="document-count">
                <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {documentCount} documents loaded
              </span>
              <span data-testid="chunk-count">
                <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
                {totalChunks} chunks indexed
              </span>
            </div>
            <span>Press Enter to send</span>
          </div>
        </div>
      </div>
    </main>
  );
}
