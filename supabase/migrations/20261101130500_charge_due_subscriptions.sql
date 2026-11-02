create table public.subscription_charges (
  subscription_id integer not null references public.subscriptions(id) on delete cascade,
  charge_date text not null check (charge_date ~ '^\d{4}-\d{2}-\d{2}$'),
  transaction_id integer references public.transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (subscription_id, charge_date)
);

alter table public.subscription_charges enable row level security;
revoke all on table public.subscription_charges from anon, authenticated;

create or replace function public.charge_due_subscriptions(p_today date default null)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_utc date := (now() at time zone 'UTC')::date;
  v_today date := coalesce(p_today, v_utc);
  v_today_text text;
  s record;
  v_base date;
  v_dim int;
  v_due date;
  v_guard int;
  v_txn_id int;
  v_result jsonb := '[]'::jsonb;
begin
  if abs(v_today - v_utc) > 1 then
    raise exception 'p_today is out of range';
  end if;
  v_today_text := to_char(v_today, 'YYYY-MM-DD');

  for s in
    select id, name, amount, billing_day, last_charged_on
    from public.subscriptions
    order by id
    for update skip locked
  loop
    if s.last_charged_on is null then
      v_base := date_trunc('month', v_today)::date;
    elsif s.last_charged_on ~ '^\d{4}-\d{2}-\d{2}$' then
      v_base := (date_trunc('month', s.last_charged_on::date) + interval '1 month')::date;
    else
      continue;
    end if;

    v_dim := extract(day from (v_base + interval '1 month' - interval '1 day'))::int;
    if s.billing_day <= v_dim then
      v_due := v_base + (s.billing_day - 1);
    else
      v_due := (v_base + interval '1 month')::date;
    end if;

    if v_due > v_today then
      continue;
    end if;

    insert into public.subscription_charges (subscription_id, charge_date)
    values (s.id, v_today_text)
    on conflict do nothing
    returning 1 into v_guard;

    if v_guard is null then
      continue;
    end if;

    insert into public.transactions (type, amount, vendor, category, date, status)
    values ('expense', s.amount, s.name, 'Subscriptions', v_today_text, 'pending_review')
    returning id into v_txn_id;

    update public.subscription_charges
    set transaction_id = v_txn_id
    where subscription_id = s.id and charge_date = v_today_text;

    update public.subscriptions
    set last_charged_on = v_today_text
    where id = s.id;

    v_result := v_result || jsonb_build_object(
      'subscription_id', s.id,
      'transaction_id', v_txn_id,
      'vendor', s.name,
      'amount', s.amount,
      'date', v_today_text
    );
  end loop;

  return v_result;
end;
$$;

revoke all on function public.charge_due_subscriptions(date) from public;
grant execute on function public.charge_due_subscriptions(date) to anon;
