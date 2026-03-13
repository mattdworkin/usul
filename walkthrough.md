# Project Walkthrough

This document explains the app as if a CTO asked for a technical and product walkthrough: what it is, why it is shaped this way, how data moves through the system, and what tradeoffs were chosen.

## Executive Summary

Usul is a focused internal-style application for analyzing government procurement documents. It combines:

- Authentication and persistence via Supabase
- Structured extraction via OpenAI
- Semantic retrieval via embeddings and pgvector
- A simple but practical operator workflow inside one protected workspace

The core idea is not just "upload a document and summarize it." The app treats each document as a reusable asset:

- It extracts structured procurement metadata
- It stores people and organizations in richer forms
- It creates retrieval chunks for later question answering
- It enables both discovery and follow-up analysis after the first upload

That is the reason the app has three main tabs:

- Analyze
- History
- Ask AI

This is a deliberate progression from ingestion -> persistence -> reuse.

## Product Intent

Government procurement documents are high-friction to work with because they are:

- Long
- Inconsistently formatted
- Often PDF-first
- Packed with dates, obligations, contacts, and organizational relationships

The app is designed to reduce that friction by making a single upload useful in three ways:

1. Immediate extraction
2. Long-term searchable storage
3. Follow-up conversational analysis

This avoids a common failure mode of LLM apps where the model produces one answer and then the document disappears from the workflow.

## Why The App Uses One Next.js Application

The project currently uses a single Next.js App Router application instead of separate frontend and backend repositories.

That decision is intentional.

Benefits:

- Lower operational complexity
- Faster iteration
- Shared types between UI and server routes
- Simpler auth boundaries
- Easier deployment story

Tradeoff:

- The application is not split into independently deployable services

Why that is acceptable here:

- The product is still centered around a single operator workflow
- The API surface is small and application-specific
- Next route handlers are sufficient for current throughput and complexity

If the system later grows into background pipelines, multi-tenant indexing jobs, OCR workers, or external integrations, a separate ingestion or retrieval service could make sense. Right now, that would add complexity faster than it adds value.

## High-Level Architecture

### Presentation layer

Files in `src/app` and `src/components`

Responsibilities:

- Authentication-aware pages
- Tabbed workflow for analyze/history/ask
- Upload UX
- Search UX
- Chat UX
- Rendering extracted document data

### Application layer

Files in `src/app/api`

Responsibilities:

- Accept user input
- Validate requests
- Call OpenAI and Supabase
- Orchestrate extraction, storage, search, and question answering

### Domain/shared logic

Files in `src/lib`

Responsibilities:

- Type definitions
- OpenAI prompt/schema logic
- Embedding generation
- Chunking logic
- Supabase clients and shared helpers

### Data layer

Files in `supabase`

Responsibilities:

- Database schema
- pgvector setup
- Search functions
- RLS policies

## Source Layout Decision

The source code lives in `src/`:

- `src/app`
- `src/components`
- `src/lib`

This was chosen for cleanliness and signal-to-noise reduction at the repository root. The top level now mostly contains:

- source root
- database SQL
- examples
- project config

The Supabase folder was intentionally left at the repository root rather than moved under `backend/` or `infra/`, because:

- it keeps SQL scripts easy to find
- it aligns with common Supabase project conventions
- it avoids creating a fake backend boundary when the runtime backend is the Next app itself

## Authentication Model

Authentication is handled through Supabase SSR with cookie-backed sessions.

Key pieces:

- `src/lib/supabase/server.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/proxy.ts`
- `src/proxy.ts`

Why this design:

- The UI needs protected pages
- The API routes need to know the current user
- Row-level security should align with the authenticated user identity

The proxy keeps sessions refreshed and protects routes early. The route handlers still perform auth checks directly, which is good defense in depth.

## Main UX Flow

### 1. Analyze

Primary component:

- `src/components/documents/document-uploader.tsx`

User behavior:

- Upload PDF
- Upload TXT
- Drag and drop
- Paste raw text

The UX allows both files and pasted text because procurement workflows are messy in practice:

- some inputs are original files
- some are copied text from portals or emails
- some PDFs are good enough for extraction without OCR

Why no OCR yet:

- OCR adds cost, latency, and complexity
- the current version is optimized for text-based PDFs and TXT files first

### 2. Review

Primary component:

- `src/components/documents/document-result-card.tsx`

This card is intentionally rich, because a procurement document is valuable mostly through its extracted structure. The UI surfaces:

- summary
- metadata
- dates
- requirements
- people
- organizations

This makes the first post-upload interaction useful even before any chat begins.

### 3. Search History

Primary component:

- `src/components/documents/document-history.tsx`

Two search modes exist:

- keyword search
- semantic search

Why both:

- Keyword search is predictable and cheap
- Semantic search is useful when the user remembers the concept but not exact wording

This dual-mode approach is practical. Semantic search alone can feel opaque, while keyword search alone misses meaning-based retrieval.

### 4. Ask AI

Primary component:

- `src/components/documents/document-chat.tsx`

The chat supports:

- asking across all uploaded documents
- asking about one selected document
- showing retrieval sources

The source display is important because procurement workflows benefit from evidence, not just fluent answers.

## Analyze Pipeline

Primary route:

- `src/app/api/analyze/route.ts`

Step-by-step:

1. Verify the current user
2. Accept file or pasted text
3. Extract PDF text when needed
4. Reject unsupported types or empty inputs
5. Truncate overly large text
6. Send the text to OpenAI for structured extraction
7. Chunk the text for retrieval
8. Generate embeddings for:
   - document summary
   - every chunk
9. Insert the main analyzed document row
10. Insert related chunks, people, and organizations

Why store both structured fields and raw text:

- Structured fields power the UI directly
- Raw text powers retrieval and future reprocessing

Why store people and organizations separately in dedicated tables even though some data also sits in JSON on the document row:

- The JSON fields are convenient for immediate rendering
- Separate tables support future querying, joins, analytics, and normalization

This is a common pattern: denormalize for product speed, normalize for future flexibility.

## Extraction Design Decisions

Primary file:

- `src/lib/openai.ts`

The extraction prompt is domain-specific rather than generic summarization.

That is a deliberate product decision. Generic summarization is not enough for procurement workflows because users care about fields like:

- solicitation number
- response date
- contract type
- named contacts
- organizational roles

The schema forces the model to produce a consistent shape. This reduces frontend ambiguity and makes persistence reliable.

Why JSON schema output was chosen:

- predictable contract between model and app
- lower parsing risk
- cleaner error handling
- easier downstream rendering

## Embedding And Retrieval Design

Primary file:

- `src/lib/embeddings.ts`

Embeddings are used in two distinct ways:

### Document-level embedding

Purpose:

- semantic search across documents in History

Stored on:

- `analyzed_documents.embedding`

### Chunk-level embeddings

Purpose:

- retrieval for Ask AI

Stored in:

- `document_chunks.embedding`

Why both levels exist:

- Document-level search is best for finding which document matters
- Chunk-level search is best for finding which passage answers a question

Using only one of these would weaken part of the product.

## Chunking Strategy

The chunker is intentionally simple and sentence-aware.

Design goals:

- preserve useful context
- avoid chopping text at arbitrary mid-sentence boundaries
- keep enough overlap for retrieval continuity

Why not a more elaborate chunker yet:

- complexity was not necessary for the current document scale
- simpler chunking is easier to reason about and debug
- the retrieval quality is already good enough for this stage

## Ask AI Flow

Primary route:

- `src/app/api/ask/route.ts`

Step-by-step:

1. Verify user
2. Accept question and optional document scope
3. Embed the question
4. Attempt vector search over `document_chunks`
5. If vector retrieval fails or returns nothing useful, fall back to keyword retrieval over `analyzed_documents`
6. Build a context set with titles and passages
7. Send context plus chat history to OpenAI
8. Return answer and source snippets

The fallback behavior is an important design choice.

Why it exists:

- vector infrastructure can be missing or misconfigured in early environments
- a hard failure is bad UX
- keyword fallback provides graceful degradation

This means the system is resilient:

- best case: semantic chunk retrieval
- acceptable case: keyword-backed document retrieval
- worst case: clear user message instead of silent failure

## Database Design

Primary files:

- `supabase/migration.sql`
- `supabase/upgrade.sql`

Core tables:

### `analyzed_documents`

Stores:

- raw document text
- extracted metadata
- summary
- JSON copies of people and organizations
- document-level embedding

### `document_chunks`

Stores:

- overlapping chunks of document text
- chunk index
- chunk embedding

### `document_people`

Stores:

- extracted people with role and context

### `document_organizations`

Stores:

- extracted organizations with role and context

Why the schema is shaped this way:

- It supports both product rendering and retrieval
- It gives a clear future path to reporting and analytics
- It balances shipping speed with long-term extensibility

## Row-Level Security

RLS is enabled so users can only access their own data.

This is critical because the app handles:

- potentially sensitive procurement data
- user-specific uploads
- AI-enriched records that should not bleed across tenants

The design assumes multi-user separation even if the initial deployment is small.

That is the right default.

## Search Function Design

The search functions use pgvector and return similarity-ranked results.

Why SQL functions were chosen instead of only client-side heuristics:

- vector operations belong close to the database
- similarity filtering is more efficient in Postgres
- the route handlers stay simpler when retrieval is abstracted behind RPC calls

The updated SQL accepts text representations of embeddings and casts them to vector inside the function. This makes the app-to-database interface more tolerant and avoids brittle RPC argument mismatches.

## UI Design Philosophy

The UI is intentionally straightforward:

- one protected workspace
- three clear tabs
- cards for document results
- chat for follow-up questions

This is the right level of complexity for the current product stage.

Why this is a good decision:

- users can understand the app quickly
- the workflow is easy to explain
- the product does not over-promise "agent" behavior
- the app stays focused on operational usefulness

The design favors clarity over novelty.

## Error Handling Philosophy

The app currently favors graceful fallback and operator-friendly messages.

Examples:

- invalid files are rejected early
- empty extracted text is surfaced clearly
- semantic search failures fall back to keyword search
- Ask AI now surfaces server-provided errors instead of only showing a generic apology

This is important because most trust in internal AI tools is lost through opaque failure states.

## Why Example Documents Exist In The Repo

The sample documents in `examples/documents` are there to make the product testable and demoable without hunting for realistic inputs.

This supports:

- faster QA
- consistent extraction comparison
- easier onboarding for new engineers or stakeholders

## What I Would Tell A CTO About Risks

### Current strengths

- Cohesive, understandable architecture
- Good balance of structure and flexibility
- Strong fit for a focused internal workflow
- Retrieval-aware design instead of one-shot summarization
- Clear path to future improvement

### Current limitations

- No OCR pipeline yet for image-based PDFs
- No automated end-to-end integration suite yet
- OpenAI calls are synchronous in request flow
- Retrieval quality is only as good as chunking, embeddings, and stored text quality
- Prompt and schema tuning will likely continue as more real documents appear

### Scale considerations

At moderate internal usage, the current architecture is reasonable.

If usage grows, likely next architectural changes would be:

- background jobs for ingestion and embedding generation
- explicit observability around extraction and retrieval quality
- document lifecycle management
- re-indexing and schema migration tooling
- OCR and pre-processing for scanned PDFs

## Why The Design Is Good For This Stage

The most important thing about this project is that it does not try to be too much at once.

It does a small number of things well:

- ingest
- extract
- store
- retrieve
- answer

That makes it a solid foundation rather than a fragile demo.

## File Map For A New Engineer

If I were onboarding a new engineer, I would point them here first:

- `src/app/protected/page.tsx`
  This is the main workspace shell.

- `src/components/documents/document-uploader.tsx`
  This is the entry point for ingestion UX.

- `src/app/api/analyze/route.ts`
  This is the ingestion and extraction pipeline.

- `src/components/documents/document-history.tsx`
  This is document retrieval and browsing.

- `src/app/api/documents/route.ts`
  This is the search endpoint.

- `src/components/documents/document-chat.tsx`
  This is the Q&A interface.

- `src/app/api/ask/route.ts`
  This is the retrieval and answer orchestration layer.

- `src/lib/openai.ts`
  This contains the model-facing extraction and answer logic.

- `src/lib/embeddings.ts`
  This contains chunking and embedding generation.

- `supabase/upgrade.sql`
  This is the critical database upgrade path for retrieval features.

## Closing Summary

This app is a well-scoped AI document analysis system for procurement workflows.

The design choices show a clear intent:

- keep product flow simple
- keep retrieval useful
- keep persistence structured
- keep architecture light until scale justifies more separation

That is the right design posture for a project like this.
