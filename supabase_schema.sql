-- Enable pgvector
create extension if not exists vector;

-- 1. Repositories table
create table repositories (
  id uuid primary key default gen_random_uuid(),
  github_url text not null unique,
  name text not null,
  branch text,
  last_indexed_at timestamp with time zone default now()
);

-- 2. Code chunks table
create table code_chunks (
  id uuid primary key default gen_random_uuid(),
  repo_id uuid references repositories(id) on delete cascade,
  file_path text not null,
  content text not null,
  start_line int,
  end_line int,
  embedding vector(1536), -- text-embedding-3-small dimension
  metadata jsonb
);

-- 3. HNSW index for faster similarity search
create index on code_chunks using hnsw (embedding vector_cosine_ops);

-- 4. RPC function for vector similarity search
create or replace function match_code_chunks (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_repo_id uuid,
  p_file_paths text[] default null
)
returns table (
  id uuid,
  content text,
  file_path text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    cc.id,
    cc.content,
    cc.file_path,
    1 - (cc.embedding <=> query_embedding) as similarity
  from code_chunks cc
  where cc.repo_id = p_repo_id
    and (p_file_paths is null or cc.file_path = any(p_file_paths))
    and 1 - (cc.embedding <=> query_embedding) > match_threshold
  order by cc.embedding <=> query_embedding
  limit match_count;
end;
$$;
