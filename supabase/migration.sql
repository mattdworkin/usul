-- AI Government Document Insight Extractor
-- Run this migration in the Supabase SQL Editor

create table public.analyzed_documents (
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
  created_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.analyzed_documents enable row level security;

-- Users can only read their own documents
create policy "Users can view own documents"
  on public.analyzed_documents for select
  using (auth.uid() = user_id);

-- Users can only insert their own documents
create policy "Users can insert own documents"
  on public.analyzed_documents for insert
  with check (auth.uid() = user_id);

-- Indexes for performance
create index idx_analyzed_documents_user_id on public.analyzed_documents(user_id);
create index idx_analyzed_documents_created_at on public.analyzed_documents(created_at desc);
