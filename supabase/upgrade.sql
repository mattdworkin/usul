-- Run this AFTER the initial migration.sql if you already have the base table.
-- It adds pgvector, chunks, people, organizations, and search functions.
-- Safe to run multiple times (uses IF NOT EXISTS / OR REPLACE).

-- 1. Enable pgvector
create extension if not exists vector with schema extensions;

-- 2. Add embedding column to existing analyzed_documents
alter table public.analyzed_documents
  add column if not exists embedding extensions.vector(1536);

-- 3. Document chunks for RAG
create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.analyzed_documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding extensions.vector(1536) not null,
  created_at timestamptz not null default now()
);

-- 4. Rich people extraction
create table if not exists public.document_people (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.analyzed_documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  role text,
  organization text,
  contact_info text,
  context text not null,
  created_at timestamptz not null default now()
);

-- 5. Rich organization extraction
create table if not exists public.document_organizations (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.analyzed_documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  org_type text,
  role_in_contract text not null,
  context text not null,
  created_at timestamptz not null default now()
);

-- 6. RLS
alter table public.document_chunks enable row level security;
alter table public.document_people enable row level security;
alter table public.document_organizations enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Users can view own chunks') then
    create policy "Users can view own chunks" on public.document_chunks for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can insert own chunks') then
    create policy "Users can insert own chunks" on public.document_chunks for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can view own people') then
    create policy "Users can view own people" on public.document_people for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can insert own people') then
    create policy "Users can insert own people" on public.document_people for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can view own organizations') then
    create policy "Users can view own organizations" on public.document_organizations for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can insert own organizations') then
    create policy "Users can insert own organizations" on public.document_organizations for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can update own documents') then
    create policy "Users can update own documents" on public.analyzed_documents for update using (auth.uid() = user_id);
  end if;
end $$;

-- 7. Indexes
create index if not exists idx_document_chunks_document_id on public.document_chunks(document_id);
create index if not exists idx_document_chunks_user_id on public.document_chunks(user_id);
create index if not exists idx_document_people_document_id on public.document_people(document_id);
create index if not exists idx_document_organizations_document_id on public.document_organizations(document_id);

create index if not exists idx_analyzed_documents_embedding
  on public.analyzed_documents using hnsw (embedding extensions.vector_cosine_ops);
create index if not exists idx_document_chunks_embedding
  on public.document_chunks using hnsw (embedding extensions.vector_cosine_ops);

-- 8. Vector search functions
create or replace function match_document_chunks(
  query_embedding extensions.vector(1536),
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
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  where dc.user_id = match_user_id
    and (match_document_id is null or dc.document_id = match_document_id)
    and 1 - (dc.embedding <=> query_embedding) > match_threshold
  order by dc.embedding <=> query_embedding
  limit match_count;
end;
$$;

create or replace function match_documents(
  query_embedding extensions.vector(1536),
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
    1 - (ad.embedding <=> query_embedding) as similarity
  from public.analyzed_documents ad
  where ad.user_id = match_user_id
    and ad.embedding is not null
    and 1 - (ad.embedding <=> query_embedding) > match_threshold
  order by ad.embedding <=> query_embedding
  limit match_count;
end;
$$;
