-- Adds an explicit publishing workflow, review dates, revision history and a
-- database-side full-text search so Buddy does not download every knowledge
-- entry for each customer message.

alter table public.knowledge_entries
  add column if not exists publication_status text not null default 'published',
  add column if not exists last_verified_at date,
  add column if not exists review_after date,
  add column if not exists updated_by text;

update public.knowledge_entries
set publication_status = case when enabled then 'published' else 'draft' end
where publication_status not in ('draft', 'published', 'archived')
   or (not enabled and publication_status = 'published');

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'knowledge_entries_publication_status_check'
  ) then
    alter table public.knowledge_entries
      add constraint knowledge_entries_publication_status_check
      check (publication_status in ('draft', 'published', 'archived'));
  end if;
end $$;

alter table public.knowledge_entries
  add column if not exists search_vector tsvector;

create or replace function public.update_knowledge_search_vector()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.search_vector := to_tsvector(
    'english'::regconfig,
    coalesce(new.question, '') || ' ' || coalesce(new.answer, '') || ' ' ||
    coalesce(new.category, '') || ' ' || coalesce(new.summary, '') || ' ' ||
    coalesce(array_to_string(new.tags, ' '), '')
  );
  return new;
end;
$$;

drop trigger if exists knowledge_search_vector_trigger on public.knowledge_entries;
create trigger knowledge_search_vector_trigger
before insert or update of question, answer, category, summary, tags
on public.knowledge_entries
for each row execute function public.update_knowledge_search_vector();

update public.knowledge_entries
set search_vector = to_tsvector(
  'english'::regconfig,
  coalesce(question, '') || ' ' || coalesce(answer, '') || ' ' ||
  coalesce(category, '') || ' ' || coalesce(summary, '') || ' ' ||
  coalesce(array_to_string(tags, ' '), '')
)
where search_vector is distinct from to_tsvector(
  'english'::regconfig,
  coalesce(question, '') || ' ' || coalesce(answer, '') || ' ' ||
  coalesce(category, '') || ' ' || coalesce(summary, '') || ' ' ||
  coalesce(array_to_string(tags, ' '), '')
);

create index if not exists knowledge_entries_search_idx
  on public.knowledge_entries using gin (search_vector);

create table if not exists public.knowledge_entry_revisions (
  id bigint generated always as identity primary key,
  knowledge_entry_id uuid not null,
  snapshot jsonb not null,
  changed_by text,
  changed_at timestamptz not null default now()
);

create index if not exists knowledge_entry_revisions_entry_idx
  on public.knowledge_entry_revisions (knowledge_entry_id, changed_at desc);

alter table public.knowledge_entry_revisions enable row level security;
revoke all on public.knowledge_entry_revisions from anon, authenticated;
grant select, insert, delete on public.knowledge_entry_revisions to service_role;

create or replace function public.capture_knowledge_entry_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.knowledge_entry_revisions (knowledge_entry_id, snapshot, changed_by)
  values (old.id, to_jsonb(old), coalesce(new.updated_by, old.updated_by, old.created_by));
  return new;
end;
$$;

drop trigger if exists knowledge_entry_revision_trigger on public.knowledge_entries;
create trigger knowledge_entry_revision_trigger
before update on public.knowledge_entries
for each row execute function public.capture_knowledge_entry_revision();

create or replace function public.search_published_knowledge(search_text text, result_limit integer default 3)
returns setof public.knowledge_entries
language sql
stable
set search_path = public
as $$
  select entry.*
  from public.knowledge_entries entry,
       websearch_to_tsquery('english'::regconfig, search_text) query
  where entry.enabled
    and entry.publication_status = 'published'
    and entry.search_vector @@ query
  order by ts_rank_cd(
    entry.search_vector,
    query
  ) desc,
  entry.updated_at desc
  limit greatest(1, least(result_limit, 10));
$$;

revoke all on function public.search_published_knowledge(text, integer) from public, anon, authenticated;
grant execute on function public.search_published_knowledge(text, integer) to service_role;
