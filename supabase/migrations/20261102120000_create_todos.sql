create table public.todos (
  id bigint generated always as identity primary key,
  title text not null,
  notes text,
  category text,
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  due_date text,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.todos enable row level security;

create policy "anon full access" on public.todos
  for all to anon
  using (true)
  with check (true);
