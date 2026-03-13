# Usul

Usul is an AI-assisted government procurement document analysis app built with Next.js, Supabase, and OpenAI.

It lets authenticated users:

- Upload or paste procurement documents
- Extract structured contract insights
- Store rich document metadata, people, organizations, and retrieval chunks
- Search past documents with keyword or semantic search
- Ask questions across one document or the full document set

## What The App Does

The application is optimized for procurement and contracting workflows. A user uploads a PDF or TXT file, or pastes document text. The app extracts structured fields such as:

- Document type
- Title and summary
- Issuing organization
- Buyer or point of contact
- Solicitation or tracking number
- Key dates
- Period of performance
- Location
- Contract type
- Key requirements
- Submission requirements
- Important people with roles, organization, contact info, and context
- Important organizations with type, role, and context

After extraction, the app stores the document and creates embeddings for:

- Document-level semantic search
- Chunk-level retrieval for question answering

## Tech Stack

- Next.js App Router
- React 19
- TypeScript
- Tailwind CSS
- shadcn/ui primitives
- Supabase Auth and Postgres
- pgvector in Supabase
- OpenAI for extraction, embeddings, and Q&A

## Project Structure

```text
src/
  app/                  Next.js pages and route handlers
  components/           UI and feature components
  lib/                  Shared utilities, types, OpenAI, Supabase, embeddings
  proxy.ts              Auth/session proxy
supabase/
  migration.sql         Full schema for a fresh database
  upgrade.sql           Safe upgrade script for an existing database
examples/
  documents/            Sample procurement documents for testing
```

Notes:

- The app uses a `src/` layout for cleaner source organization.
- `supabase/` stays at the repository root so SQL workflows remain straightforward.

## Main User Flows

### 1. Analyze a Document

Route: `/protected` -> `Analyze`

- User uploads a PDF/TXT or pastes text
- The backend extracts text if needed
- OpenAI generates structured procurement insights
- The app chunks the raw text and creates embeddings
- Supabase stores the analyzed document, chunks, people, and organizations

Key file:

- `src/app/api/analyze/route.ts`

### 2. Browse and Search History

Route: `/protected` -> `History`

- Keyword search uses SQL `ilike`
- Semantic search uses pgvector document embeddings
- If semantic RPC search is unavailable, the route falls back to keyword search

Key file:

- `src/app/api/documents/route.ts`

### 3. Ask Questions About Documents

Route: `/protected` -> `Ask AI`

- The app embeds the user question
- It tries chunk-level vector retrieval first
- If vector retrieval is unavailable, it falls back to document-level keyword retrieval
- Retrieved context is sent to OpenAI to generate an answer

Key file:

- `src/app/api/ask/route.ts`

## Environment Variables

Create `.env.local` with at least:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
OPENAI_API_KEY=your_openai_api_key
```

## Database Setup

You have two options:

### New database

Run:

- `supabase/migration.sql`

### Existing database that already has the base app data

Run:

- `supabase/upgrade.sql`

Important:

- The latest SQL includes pgvector search functions used by Ask AI and semantic search.
- If semantic search or Ask AI is failing in Supabase, rerun `upgrade.sql`.

## Local Development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Verification Commands

Useful local checks:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Sample Documents

Sample procurement files live in:

- `examples/documents`

These are useful for validating:

- Extraction quality
- Semantic search
- Ask AI responses

## Current Behavior Notes

- Authentication gates the protected workspace and API routes
- Drag-and-drop upload is supported for PDF and TXT files
- Ask AI now falls back gracefully if vector search is unavailable
- Semantic document search also falls back to keyword search when needed

## Recommended Next Improvements

- Add an `.env.example`
- Add automated integration tests for analyze/search/ask flows
- Add better per-route error diagnostics in the UI
- Add document deletion and re-indexing tools
- Add support for OCR on image-based PDFs

## Additional Documentation

For a full architectural walkthrough and design rationale, see:

- `walkthrough.md`
