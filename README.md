# AI DocChat (RAG chatbot for your PDFs)

A full‑stack document chat application that lets you upload PDFs, indexes them into a vector database, and chat with them using Retrieval‑Augmented Generation (RAG) powered by Google Gemini. It provides source citations for answers and tracks end‑to‑end processing status.

## Features

- **AI chat with sources**: Answers grounded in your uploaded PDFs, with citations
- **RAG pipeline**: PDF extract → chunk → embed (Gemini) → store/query (Pinecone)
- **Progress tracking**: Live document status, stages, and percentage complete
- **Modern UI**: Responsive, dark/light themes, polished UX
- **Auth**: Email/password with JWT, profile updates

## Architecture

- **Frontend**: React 18, wouter, @tanstack/react-query, Tailwind
- **Backend**: Node.js + Express
- **Database**: MongoDB (users, documents, conversations, messages)
- **Vector DB**: Pinecone (serverless, 1024‑dim, cosine)
- **AI**: Google Gemini (embeddings + generation)

Data flow
1) Upload PDF → Mongo `documents` record with status "uploading"
2) Async processing: extract text (pdf-parse) → chunk → embed (Gemini) → upsert vectors (Pinecone) → update Mongo status/progress → status "completed"
3) Chat: create conversation if needed → store user message → semantic search (Pinecone, optional document filter) → compose context → generate answer (Gemini) → store assistant message with sources → respond to client

## Monorepo layout

- `server/` Express app, routes, controllers, services
  - `routes/` `authRoutes.js`, `documentRoutes.js`, `chatRoutes.js`
  - `controllers/` auth, document, chat logic
  - `services/` `pdfProcessor.js`, `gemini.js`, `pineconeStore.js`
  - `models/storage.js` Mongo driver + CRUD
  - `config/database.js` storage init
  - `middleware/` `auth.js`, `user.js`
- `client/` React app, hooks, components, pages
  - `hooks/` `useAuth.js`, `useDocuments.js`, `useChat.js`
  - `components/` chat UI, document sidebar, upload, theme, shadcn/ui
  - `pages/` `home.jsx`, `auth.jsx`, `Profile.jsx`

## API overview

Base: `/api`

- Auth
  - `POST /auth/register` → { user, token }
  - `POST /auth/login` → { user, token }
  - `POST /auth/logout`
  - `GET /auth/me` → current user (requires `Authorization: Bearer <token>`)
  - `PUT /auth/profile` → update profile (auth)
- Documents (all require auth)
  - `POST /documents/upload` (multipart `file` PDF only, ≤10MB)
  - `GET /documents` → list
  - `GET /documents/:id` → details
  - `GET /documents/:id/status` → processing status
  - `DELETE /documents/:id` → also deletes vectors in Pinecone by filename
- Chat (auth)
  - `POST /chat` → unified endpoint: `{ message, conversationId?, documentName? }` → `{ conversationId, userMessage, aiMessage, sources }`
  - `POST /chat/conversations` → create conversation
  - `GET /chat/conversations` → list
  - `GET /chat/conversations/:id` → conversation + messages
  - `POST /chat/conversations/:id/messages` → send within conversation
  - `PUT /chat/conversations/:id/title` → update title

## Requirements

- Node.js 19+
- MongoDB (e.g., Atlas or local)
- Pinecone account and API key
- Google Gemini API key

## Environment variables

Create a `.env` in project root (see `.env.example`) and set at minimum:

- `PORT=5001` (optional)
- `JWT_SECRET=change-me`
- `MONGODB_URI=mongodb+srv://...`
- `MONGODB_DB=ai-doc-chat`
- `PINECONE_API_KEY=pcn-...`
- `GEMINI_API_KEY=...` (or `GOOGLE_AI_API_KEY=...`)

Notes
- Pinecone index is created automatically on first use: name `ai-doc-chat`, dim `1024`, metric `cosine`, serverless `aws/us-east-1`.
- Gemini embedding returns 768 dims; the service pads to 1024 to match the index.

## Install

```bash
npm install
```

## Run (development)

Single command spins up API and Vite client via server middleware:

```bash
npm run dev
```

Then open the printed URL (default `http://localhost:5001`).

## Build & run (production)

```bash
npm run build
npm start
```

- Build outputs `dist/index.js` (bundled server). In production, static client is served by the built server.

## Using the app

1) Register or log in (email + password)
2) Upload a PDF (sidebar) — watch status and progress
3) After status shows "completed", start chatting
4) Optionally select a specific document name in the chat input placeholder context (frontend passes `documentName` to filter RAG)
5) Answers include source citations (document name, page, excerpt)

## Troubleshooting

- Mongo connection fails (TLS/SSL): The app logs helpful hints. Check Mongo Atlas network/TLS settings or use a different provider.
- Pinecone index errors: Verify `PINECONE_API_KEY`, and that your account supports serverless `aws/us-east-1`.
- Gemini errors: Ensure `GEMINI_API_KEY` (or `GOOGLE_AI_API_KEY`) is set. Region quotas may apply.
- PDF parsing issues: Some PDFs cannot be parsed (encrypted/bitmap/corrupt). Error messages are surfaced in document status. Try another PDF or re-export.
- Auth 401: Make sure the browser has a valid token in `localStorage` and requests include `Authorization: Bearer <token>`.

## Security notes

- JWT is stored in `localStorage` client-side; rotate `JWT_SECRET` and use HTTPS in production.
- Upload limit is 10MB and PDF‑only; server uses in‑memory upload buffer (multer). Adjust for your scale/security needs.

## License

MIT













ID: 4e54ecd0-06f2-48a8-8f4a-e33ed9ef33bf_chunk_79

chunkIndex: 79

content: "loved across generations."

documentId: "4e54ecd0-06f2-48a8-8f4a-e33ed9ef33bf"

documentName: "one_piece_unique_info.pdf"

length: 25

pageNumber: 27

wordCount: 3