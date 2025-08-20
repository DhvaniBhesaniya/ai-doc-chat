# AI Document Search & Chat (RAG Chatbot)

A full-stack AI-powered document search and chat application with Retrieval-Augmented Generation (RAG) capabilities. Upload PDFs, extract and chunk text, create embeddings, and chat with your documents using Google Gemini AI.

## Features

### 🤖 AI-Powered Chat
- **Retrieval-Augmented Generation (RAG)** using Google Gemini API
- **Contextual conversations** with memory and follow-up support
- **Source citations** with highlighted excerpts from documents
- **Real-time typing indicators** and smooth animations

### 📄 Document Processing
- **PDF upload** with drag-and-drop interface
- **Automatic text extraction** and intelligent chunking
- **Vector embeddings** using Google Gemini embeddings API
- **Semantic search** across all uploaded documents
- **Progress tracking** for document processing

### 🎨 Modern UI/UX
- **Glassmorphism design** with 3D effects and blur backgrounds
- **Dark/Light mode toggle** with system preference detection
- **Framer Motion animations** for smooth interactions
- **Responsive design** optimized for mobile and desktop
- **Professional gradient themes** with accessibility features

### 🔧 Technical Stack
- **Frontend**: React 18, TypeScript, TailwindCSS, Framer Motion
- **Backend**: Node.js, Express.js, LangChain integration
- **AI**: Google Gemini API for embeddings and chat responses
- **Vector Storage**: FAISS (local) with Pinecone support (optional)
- **File Processing**: PDF text extraction and chunking

## Setup Instructions

### Prerequisites
- Node.js 18+ installed
- Google Gemini API key ([Get one here](https://ai.google.dev/))
- (Optional) Pinecone API key for enhanced vector storage

### 1. Clone and Install
```bash
git clone <repository-url>
cd ai-document-chat
npm install
