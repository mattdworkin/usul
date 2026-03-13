-- AI Government Document Insight Extractor
-- Run this migration in the Supabase SQL Editor

-- ============================================================
-- 1. Extensions
-- ============================================================
create extension if not exists vector with schema extensions;

-- ============================================================
-- 2. Core document table
-- ============================================================
create table if not exists public.analyzed_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text,
  raw_text text not null,
  document_type text not null,
  title text not null,
  summary text not null,
  issuing_organization text,
  buyer_or_poc text,
  solicitation_or_tracking_number text,
  issue_date text,
  response_due_date text,
  period_of_performance text,
  location text,
  contract_type text,
  important_people jsonb not null default '[]'::jsonb,
  important_organizations jsonb not null default '[]'::jsonb,
  event_dates jsonb not null default '[]'::jsonb,
  key_requirements jsonb not null default '[]'::jsonb,
  submission_requirements jsonb not null default '[]'::jsonb,
  -- Embedding of the full document summary for semantic doc search
  embedding extensions.vector(1536),
  created_at timestamptz not null default now()
);

-- ============================================================
-- 3. Document chunks for RAG retrieval
-- ============================================================
create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.analyzed_documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding extensions.vector(1536) not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 4. Rich people extraction
-- ============================================================
create table if not exists public.document_people (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.analyzed_documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  role text,                     -- e.g. "Contracting Officer", "Program Manager"
  organization text,             -- org they belong to
  contact_info text,             -- email, phone if found
  context text not null,         -- what this person does with this contract
  created_at timestamptz not null default now()
);

-- ============================================================
-- 5. Rich organization extraction
-- ============================================================
create table if not exists public.document_organizations (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.analyzed_documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  org_type text,                 -- e.g. "Government Agency", "Contractor", "Subcontractor"
  role_in_contract text not null,-- what this org does in context of this contract
  context text not null,         -- deeper explanation of their involvement
  created_at timestamptz not null default now()
);

-- ============================================================
-- 6. Row Level Security
-- ============================================================
alter table public.analyzed_documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.document_people enable row level security;
alter table public.document_organizations enable row level security;

-- analyzed_documents policies
create policy "Users can view own documents"
  on public.analyzed_documents for select
  using (auth.uid() = user_id);

create policy "Users can insert own documents"
  on public.analyzed_documents for insert
  with check (auth.uid() = user_id);

create policy "Users can update own documents"
  on public.analyzed_documents for update
  using (auth.uid() = user_id);

-- document_chunks policies
create policy "Users can view own chunks"
  on public.document_chunks for select
  using (auth.uid() = user_id);

create policy "Users can insert own chunks"
  on public.document_chunks for insert
  with check (auth.uid() = user_id);

-- document_people policies
create policy "Users can view own people"
  on public.document_people for select
  using (auth.uid() = user_id);

create policy "Users can insert own people"
  on public.document_people for insert
  with check (auth.uid() = user_id);

-- document_organizations policies
create policy "Users can view own organizations"
  on public.document_organizations for select
  using (auth.uid() = user_id);

create policy "Users can insert own organizations"
  on public.document_organizations for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- 7. Indexes
-- ============================================================
create index if not exists idx_analyzed_documents_user_id
  on public.analyzed_documents(user_id);
create index if not exists idx_analyzed_documents_created_at
  on public.analyzed_documents(created_at desc);

create index if not exists idx_document_chunks_document_id
  on public.document_chunks(document_id);
create index if not exists idx_document_chunks_user_id
  on public.document_chunks(user_id);

create index if not exists idx_document_people_document_id
  on public.document_people(document_id);
create index if not exists idx_document_organizations_document_id
  on public.document_organizations(document_id);

-- HNSW indexes for fast vector similarity search
create index if not exists idx_analyzed_documents_embedding
  on public.analyzed_documents
  using hnsw (embedding extensions.vector_cosine_ops);

create index if not exists idx_document_chunks_embedding
  on public.document_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

-- ============================================================
-- 8. Vector search functions
-- ============================================================

-- Search document chunks by semantic similarity (for RAG Q&A)
create or replace function match_document_chunks(
  query_embedding text,
  match_user_id uuid,
  match_document_id uuid default null,
  match_threshold float default 0.5,
  match_count int default 10
)
returns table (
  id uuid,
  document_id uuid,
  chunk_index integer,
  content text,
  similarity float
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select
    dc.id,
    dc.document_id,
    dc.chunk_index,
    dc.content,
    1 - (dc.embedding <=> query_embedding::extensions.vector) as similarity
  from public.document_chunks dc
  where dc.user_id = match_user_id
    and (match_document_id is null or dc.document_id = match_document_id)
    and 1 - (dc.embedding <=> query_embedding::extensions.vector) > match_threshold
  order by dc.embedding <=> query_embedding::extensions.vector
  limit match_count;
end;
$$;

-- Search documents by semantic similarity (for document discovery)
create or replace function match_documents(
  query_embedding text,
  match_user_id uuid,
  match_threshold float default 0.5,
  match_count int default 20
)
returns table (
  id uuid,
  title text,
  summary text,
  document_type text,
  file_name text,
  issuing_organization text,
  created_at timestamptz,
  similarity float
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select
    ad.id,
    ad.title,
    ad.summary,
    ad.document_type,
    ad.file_name,
    ad.issuing_organization,
    ad.created_at,
    1 - (ad.embedding <=> query_embedding::extensions.vector) as similarity
  from public.analyzed_documents ad
  where ad.user_id = match_user_id
    and ad.embedding is not null
    and 1 - (ad.embedding <=> query_embedding::extensions.vector) > match_threshold
  order by ad.embedding <=> query_embedding::extensions.vector
  limit match_count;
end;
$$;
