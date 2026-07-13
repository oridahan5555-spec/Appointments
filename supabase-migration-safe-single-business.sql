begin;

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

alter table public.business
  add column if not exists cover_image text not null default '',
  add column if not exists profile_image text not null default '',
  add column if not exists preparation_message text not null default '',
  add column if not exists owner_email text;

create table if not exists public.special_hours (
  id uuid primary key default gen_random_uuid(),
  special_date date not null unique,
  opens_at time,
  closes_at time,
  slot_interval_minutes integer not null default 30 check (slot_interval_minutes > 0),
  is_closed boolean not null default false,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.blocked_slots (
  id uuid primary key default gen_random_uuid(),
  blocked_date date not null,
  blocked_time time not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (blocked_date, blocked_time)
);

alter table public.customers
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null,
  add column if not exists email text;

alter table public.bookings
  add column if not exists customer_auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists customer_email text,
  add column if not exists replaces_booking_id uuid references public.bookings(id) on delete set null,
  add column if not exists hidden_for_customer boolean not null default false,
  add column if not exists arrival_status text not null default '' check (arrival_status in ('', 'waiting', 'arrived', 'finished', 'no_show')),
  add column if not exists attendance_confirmation_requested_at timestamptz,
  add column if not exists attendance_confirmation_status text not null default '',
  add column if not exists attendance_confirmation_answered_at timestamptz;

alter table public.waitlist_entries
  add column if not exists customer_auth_user_id uuid references auth.users(id) on delete set null;

create table if not exists public.owner_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_id uuid not null references public.business(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_special_hours_updated_at on public.special_hours;
create trigger set_special_hours_updated_at
before update on public.special_hours
for each row
execute function public.set_updated_at();

drop trigger if exists set_owner_profiles_updated_at on public.owner_profiles;
create trigger set_owner_profiles_updated_at
before update on public.owner_profiles
for each row
execute function public.set_updated_at();

alter table public.business enable row level security;
alter table public.services enable row level security;
alter table public.working_hours enable row level security;
alter table public.special_hours enable row level security;
alter table public.blocked_slots enable row level security;
alter table public.bookings enable row level security;
alter table public.customers enable row level security;
alter table public.notifications enable row level security;
alter table public.waitlist_entries enable row level security;
alter table public.owner_profiles enable row level security;

revoke all on table public.business, public.services, public.working_hours,
  public.bookings, public.customers, public.notifications, public.waitlist_entries,
  public.owner_profiles, public.special_hours, public.blocked_slots
from public, anon, authenticated;
grant select (
  id, name, description, address, phone, instagram_url, features,
  cover_image, profile_image, preparation_message, created_at, updated_at
) on table public.business to anon, authenticated;
grant insert, update, delete on table public.business to authenticated;
grant select on table public.services, public.working_hours to anon, authenticated;
grant insert, update, delete on table public.services, public.working_hours to authenticated;
grant select, insert, update, delete on table public.blocked_slots,
  public.special_hours, public.bookings, public.customers, public.notifications,
  public.waitlist_entries to authenticated;
grant select on table public.owner_profiles to authenticated;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1
    from public.owner_profiles
    where id = auth.uid()
  );
$$;

create or replace function public.owner_business_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select business_id
  from public.owner_profiles
  where id = auth.uid()
  limit 1
$$;

create or replace function public.current_customer_row_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select id
  from public.customers
  where auth_user_id = auth.uid()
  limit 1
$$;

revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to authenticated;

revoke all on function public.owner_business_id() from public;
grant execute on function public.owner_business_id() to authenticated;

revoke all on function public.current_customer_row_id() from public;
grant execute on function public.current_customer_row_id() to authenticated;

drop policy if exists "business public read" on public.business;
drop policy if exists "business public write" on public.business;
drop policy if exists "services public read" on public.services;
drop policy if exists "services public write" on public.services;
drop policy if exists "working_hours public read" on public.working_hours;
drop policy if exists "working_hours public write" on public.working_hours;
drop policy if exists "bookings public read" on public.bookings;
drop policy if exists "bookings public insert" on public.bookings;
drop policy if exists "bookings public update" on public.bookings;
drop policy if exists "notifications public read" on public.notifications;
drop policy if exists "notifications public insert" on public.notifications;
drop policy if exists "notifications public update" on public.notifications;
drop policy if exists "notifications public delete" on public.notifications;
drop policy if exists "customers public read" on public.customers;
drop policy if exists "customers public write" on public.customers;
drop policy if exists "waitlist public read" on public.waitlist_entries;
drop policy if exists "waitlist public write" on public.waitlist_entries;
drop policy if exists "special_hours public read" on public.special_hours;
drop policy if exists "blocked_slots public read" on public.blocked_slots;
drop policy if exists "business owner manage" on public.business;
drop policy if exists "services owner manage" on public.services;
drop policy if exists "working_hours owner manage" on public.working_hours;
drop policy if exists "special_hours owner manage" on public.special_hours;
drop policy if exists "blocked_slots owner manage" on public.blocked_slots;
drop policy if exists "owner_profiles owner read own" on public.owner_profiles;
drop policy if exists "owner_profiles owner update own" on public.owner_profiles;
drop policy if exists "customers owner manage" on public.customers;
drop policy if exists "customers customer read own" on public.customers;
drop policy if exists "customers customer insert own" on public.customers;
drop policy if exists "customers customer update own" on public.customers;
drop policy if exists "bookings owner manage" on public.bookings;
drop policy if exists "bookings customer read own" on public.bookings;
drop policy if exists "notifications owner manage" on public.notifications;
drop policy if exists "notifications customer read own" on public.notifications;
drop policy if exists "notifications customer update own" on public.notifications;
drop policy if exists "notifications customer delete own" on public.notifications;
drop policy if exists "waitlist owner manage" on public.waitlist_entries;
drop policy if exists "waitlist customer read own" on public.waitlist_entries;
drop policy if exists "waitlist customer insert own" on public.waitlist_entries;
drop policy if exists "waitlist customer delete own" on public.waitlist_entries;

create policy "business public read"
on public.business
for select
to anon, authenticated
using (true);

create policy "services public read"
on public.services
for select
to anon, authenticated
using (true);

create policy "working_hours public read"
on public.working_hours
for select
to anon, authenticated
using (true);

create policy "business owner manage"
on public.business
for all
to authenticated
using (id = public.owner_business_id())
with check (id = public.owner_business_id());

create policy "services owner manage"
on public.services
for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

create policy "working_hours owner manage"
on public.working_hours
for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

create policy "special_hours owner manage"
on public.special_hours
for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

create policy "blocked_slots owner manage"
on public.blocked_slots
for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

create policy "owner_profiles owner read own"
on public.owner_profiles
for select
to authenticated
using (id = auth.uid());

create policy "customers owner manage"
on public.customers
for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

create policy "customers customer read own"
on public.customers
for select
to authenticated
using (auth_user_id = auth.uid());

create policy "customers customer insert own"
on public.customers
for insert
to authenticated
with check (auth_user_id = auth.uid());

create policy "customers customer update own"
on public.customers
for update
to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

create policy "bookings owner manage"
on public.bookings
for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

create policy "bookings customer read own"
on public.bookings
for select
to authenticated
using (customer_auth_user_id = auth.uid());

create policy "notifications owner manage"
on public.notifications
for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

create policy "notifications customer read own"
on public.notifications
for select
to authenticated
using (user_id = auth.uid()::text);

create policy "notifications customer update own"
on public.notifications
for update
to authenticated
using (user_id = auth.uid()::text)
with check (user_id = auth.uid()::text);

create policy "notifications customer delete own"
on public.notifications
for delete
to authenticated
using (user_id = auth.uid()::text);

create policy "waitlist owner manage"
on public.waitlist_entries
for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

create policy "waitlist customer read own"
on public.waitlist_entries
for select
to authenticated
using (customer_auth_user_id = auth.uid());

create or replace function public.protect_customer_internal_fields()
returns trigger
language plpgsql
set search_path = pg_catalog, public, auth
as $$
declare
  v_auth_email text;
begin
  if public.is_owner() then return new; end if;

  v_auth_email := lower(nullif(trim(coalesce(auth.jwt() ->> 'email', '')), ''));
  if auth.uid() is null or v_auth_email is null then raise exception 'AUTH_REQUIRED'; end if;

  if tg_op = 'INSERT' then
    if nullif(coalesce(to_jsonb(new) ->> 'password', ''), '') is not null then
      raise exception 'CUSTOMER_PASSWORD_STORAGE_FORBIDDEN';
    end if;
    new.email := v_auth_email;
    new.owner_note := '';
    new.is_blocked := false;
    new.blocked_reason := '';
    new.blocked_at := null;
    new.no_show_count := 0;
    return new;
  end if;

  if new.owner_note is distinct from old.owner_note
     or new.is_blocked is distinct from old.is_blocked
     or new.blocked_reason is distinct from old.blocked_reason
     or new.blocked_at is distinct from old.blocked_at
     or new.no_show_count is distinct from old.no_show_count
     or (to_jsonb(new) -> 'password') is distinct from (to_jsonb(old) -> 'password')
     or new.auth_user_id is distinct from old.auth_user_id then
    raise exception 'CUSTOMER_INTERNAL_FIELDS_FORBIDDEN';
  end if;
  if new.email is distinct from old.email and lower(trim(coalesce(new.email, ''))) <> v_auth_email then
    raise exception 'CUSTOMER_EMAIL_MUST_MATCH_AUTH';
  end if;
  new.email := v_auth_email;
  return new;
end;
$$;

revoke all on function public.protect_customer_internal_fields() from public;
drop trigger if exists protect_customer_internal_fields on public.customers;
create trigger protect_customer_internal_fields
before insert or update on public.customers
for each row execute function public.protect_customer_internal_fields();

create or replace function public.get_public_blocked_slots()
returns table (id uuid, blocked_date date, blocked_time time)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select null::uuid, bs.blocked_date, bs.blocked_time
  from public.blocked_slots bs
  where bs.blocked_date >= current_date
$$;

revoke all on function public.get_public_blocked_slots() from public;
grant execute on function public.get_public_blocked_slots() to anon, authenticated;

create or replace function public.get_public_special_hours()
returns table (
  id uuid,
  special_date date,
  opens_at time,
  closes_at time,
  slot_interval_minutes integer,
  is_closed boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select null::uuid, sh.special_date, sh.opens_at, sh.closes_at,
         sh.slot_interval_minutes, sh.is_closed
  from public.special_hours sh
  where sh.special_date >= current_date
$$;

revoke all on function public.get_public_special_hours() from public;
grant execute on function public.get_public_special_hours() to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.business;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.services;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.working_hours;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.special_hours;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.blocked_slots;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.bookings;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
end;
$$;

create or replace function public.get_public_booking_slots()
returns table (
  id uuid,
  service_id uuid,
  service_ids jsonb,
  service_names jsonb,
  booking_date date,
  booking_time time,
  duration_minutes integer,
  status text,
  replaces_booking_id uuid,
  hidden_for_customer boolean,
  arrival_status text,
  attendance_confirmation_requested_at timestamptz,
  attendance_confirmation_status text,
  attendance_confirmation_answered_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    null::uuid,
    null::uuid,
    '[]'::jsonb,
    '[]'::jsonb,
    b.booking_date,
    b.booking_time,
    b.duration_minutes,
    'approved'::text,
    null::uuid,
    false,
    ''::text,
    null::timestamptz,
    ''::text,
    null::timestamptz
  from public.bookings b
  where b.status in ('pending', 'approved')
$$;

revoke all on function public.get_public_booking_slots() from public;
grant execute on function public.get_public_booking_slots() to anon, authenticated;

create or replace function public.create_owner_notification_for_booking(
  p_booking_id uuid,
  p_event_type text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_booking public.bookings%rowtype;
  v_owner_id uuid;
  v_notification_id uuid;
  v_service_label text;
  v_customer_name text;
begin
  select * into v_booking
  from public.bookings
  where id = p_booking_id;

  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  select id into v_owner_id
  from public.owner_profiles
  limit 1;

  if v_owner_id is null then
    return null;
  end if;

  select coalesce(
    nullif(array_to_string(array(select jsonb_array_elements_text(coalesce(v_booking.service_names, '[]'::jsonb))), ' + '), ''),
    'שירות'
  )
  into v_service_label;

  v_customer_name := trim(concat(v_booking.customer_first_name, ' ', v_booking.customer_last_name));

  insert into public.notifications (title, message, user_id, type)
  values (
    case
      when p_event_type = 'appointment_rejected' then 'תור נדחה'
      when p_event_type = 'appointment_rescheduled' then 'בקשת שינוי תור'
      when p_event_type = 'appointment_cancelled' then 'תור בוטל'
      else 'נקבע תור חדש'
    end,
    case
      when p_event_type = 'appointment_rejected' then format('התור של %s ל%s בתאריך %s בשעה %s נדחה.', coalesce(nullif(v_customer_name, ''), 'לקוחה'), v_service_label, v_booking.booking_date, to_char(v_booking.booking_time, 'HH24:MI'))
      when p_event_type = 'appointment_rescheduled' then format('%s ביקש/ה שינוי תור ל%s בתאריך %s בשעה %s.', coalesce(nullif(v_customer_name, ''), 'לקוחה'), v_service_label, v_booking.booking_date, to_char(v_booking.booking_time, 'HH24:MI'))
      when p_event_type = 'appointment_cancelled' then format('%s ביטל/ה את התור ל%s בתאריך %s בשעה %s.', coalesce(nullif(v_customer_name, ''), 'לקוחה'), v_service_label, v_booking.booking_date, to_char(v_booking.booking_time, 'HH24:MI'))
      else format('%s קבע/ה תור ל%s בתאריך %s בשעה %s.', coalesce(nullif(v_customer_name, ''), 'לקוחה'), v_service_label, v_booking.booking_date, to_char(v_booking.booking_time, 'HH24:MI'))
    end,
    v_owner_id::text,
    p_event_type
  )
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

revoke all on function public.create_owner_notification_for_booking(uuid, text) from public;

create or replace function public.create_booking_public(
  p_service_id uuid,
  p_service_ids jsonb default '[]'::jsonb,
  p_customer_first_name text default '',
  p_customer_last_name text default '',
  p_customer_phone text default '',
  p_notes text default '',
  p_booking_date date default null,
  p_booking_time time default null,
  p_replaces_booking_id uuid default null
)
returns table (
  booking_id uuid,
  booking_status text,
  booking_date date,
  booking_time time,
  duration_minutes integer
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_auth_user_id uuid;
  v_customer public.customers%rowtype;
  v_requested_service_ids jsonb;
  v_primary_service_id uuid;
  v_service_names jsonb;
  v_total_duration integer;
  v_requested_count integer;
  v_valid_count integer;
  v_start_at timestamp;
  v_end_at timestamp;
  v_open_at time;
  v_close_at time;
  v_interval_minutes integer;
  v_is_closed boolean;
  v_slot_offset integer;
  v_booking_id uuid;
begin
  v_auth_user_id := auth.uid();
  if v_auth_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_customer
  from public.customers
  where auth_user_id = v_auth_user_id
  limit 1;

  if not found then
    raise exception 'CUSTOMER_PROFILE_REQUIRED';
  end if;

  if v_customer.is_blocked then
    raise exception 'CUSTOMER_BLOCKED';
  end if;

  if p_booking_date is null or p_booking_time is null then
    raise exception 'BOOKING_DATE_AND_TIME_REQUIRED';
  end if;
  if p_booking_date < current_date or p_booking_date > current_date + 365 then
    raise exception 'INVALID_BOOKING_DATE';
  end if;

  v_requested_service_ids := case
    when jsonb_typeof(coalesce(p_service_ids, '[]'::jsonb)) = 'array'
      and jsonb_array_length(coalesce(p_service_ids, '[]'::jsonb)) > 0
      then p_service_ids
    else jsonb_build_array(p_service_id::text)
  end;
  v_requested_count := jsonb_array_length(v_requested_service_ids);
  if v_requested_count < 1 or v_requested_count > 10 then
    raise exception 'INVALID_SERVICE_SELECTION';
  end if;

  with requested as (
    select value::uuid as service_id, ordinality
    from jsonb_array_elements_text(v_requested_service_ids) with ordinality
  ), valid as (
    select r.service_id, r.ordinality, s.name, s.duration_minutes
    from requested r
    join public.services s on s.id = r.service_id
    where s.is_active = true
  )
  select
    (array_agg(service_id order by ordinality))[1],
    to_jsonb(array_agg(name order by ordinality)),
    coalesce(sum(duration_minutes), 0),
    count(distinct service_id)
  into
    v_primary_service_id,
    v_service_names,
    v_total_duration,
    v_valid_count
  from valid;

  if v_primary_service_id is null or v_total_duration <= 0 or v_valid_count <> v_requested_count then
    raise exception 'INVALID_SERVICE_SELECTION';
  end if;

  v_start_at := (p_booking_date + p_booking_time)::timestamp;
  v_end_at := v_start_at + make_interval(mins => v_total_duration);

  if v_start_at <= (now() at time zone 'Asia/Jerusalem') then
    raise exception 'TIME_SLOT_NOT_AVAILABLE';
  end if;

  select sh.opens_at, sh.closes_at, sh.slot_interval_minutes, sh.is_closed
  into v_open_at, v_close_at, v_interval_minutes, v_is_closed
  from public.special_hours sh
  where sh.special_date = p_booking_date
  limit 1;

  if not found then
    select wh.opens_at, wh.closes_at, wh.slot_interval_minutes, wh.is_closed
    into v_open_at, v_close_at, v_interval_minutes, v_is_closed
    from public.working_hours wh
    where wh.day_of_week = extract(dow from p_booking_date)::integer
    limit 1;
  end if;

  if v_is_closed or v_open_at is null or v_close_at is null
     or v_start_at < (p_booking_date + v_open_at)::timestamp
     or v_end_at > (p_booking_date + v_close_at)::timestamp then
    raise exception 'TIME_SLOT_NOT_AVAILABLE';
  end if;

  v_interval_minutes := greatest(coalesce(v_interval_minutes, 30), 1);
  v_slot_offset := floor(extract(epoch from (v_start_at - (p_booking_date + v_open_at)::timestamp)) / 60)::integer;
  if v_slot_offset % v_interval_minutes <> 0 then
    raise exception 'TIME_SLOT_NOT_AVAILABLE';
  end if;

  if p_replaces_booking_id is not null and not exists (
    select 1 from public.bookings b
    where b.id = p_replaces_booking_id
      and b.customer_auth_user_id = v_auth_user_id
      and b.status in ('pending', 'approved')
  ) then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  if exists (
    select 1
    from public.blocked_slots bs
    where tsrange(
      (bs.blocked_date + bs.blocked_time)::timestamp,
      (bs.blocked_date + bs.blocked_time)::timestamp + interval '1 minute',
      '[)'
    ) && tsrange(v_start_at, v_end_at, '[)')
  ) then
    raise exception 'TIME_SLOT_BLOCKED';
  end if;

  if exists (
    select 1
    from public.bookings b
    where b.status in ('pending', 'approved')
      and tsrange(v_start_at, v_end_at, '[)') && b.slot_range
  ) then
    raise exception 'TIME_SLOT_NOT_AVAILABLE';
  end if;

  insert into public.bookings (
    service_id,
    service_ids,
    service_names,
    customer_first_name,
    customer_last_name,
    customer_phone,
    customer_email,
    customer_auth_user_id,
    notes,
    booking_date,
    booking_time,
    duration_minutes,
    status,
    customer_confirmed,
    replaces_booking_id
  )
  values (
    v_primary_service_id,
    v_requested_service_ids,
    coalesce(v_service_names, '[]'::jsonb),
    coalesce(nullif(left(trim(p_customer_first_name), 100), ''), v_customer.first_name),
    coalesce(nullif(left(trim(p_customer_last_name), 100), ''), v_customer.last_name),
    coalesce(nullif(regexp_replace(coalesce(p_customer_phone, ''), '[^0-9+]', '', 'g'), ''), v_customer.phone),
    v_customer.email,
    v_auth_user_id,
    left(trim(coalesce(p_notes, '')), 1000),
    p_booking_date,
    p_booking_time,
    v_total_duration,
    'pending',
    false,
    p_replaces_booking_id
  )
  returning id into v_booking_id;

  perform public.create_owner_notification_for_booking(
    v_booking_id,
    case when p_replaces_booking_id is null then 'appointment_booked' else 'appointment_rescheduled' end
  );

  return query
  select
    b.id,
    b.status,
    b.booking_date,
    b.booking_time,
    b.duration_minutes
  from public.bookings b
  where b.id = v_booking_id;
exception
  when exclusion_violation then
    raise exception 'TIME_SLOT_NOT_AVAILABLE';
end;
$$;

revoke all on function public.create_booking_public(uuid, jsonb, text, text, text, text, date, time, uuid) from public;
grant execute on function public.create_booking_public(uuid, jsonb, text, text, text, text, date, time, uuid) to authenticated;

create or replace function public.cancel_my_booking(
  p_booking_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_booking public.bookings%rowtype;
begin
  select * into v_booking
  from public.bookings
  where id = p_booking_id
    and customer_auth_user_id = auth.uid();

  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  if v_booking.status not in ('pending', 'approved') then
    raise exception 'BOOKING_CANNOT_BE_CANCELLED';
  end if;

  update public.bookings
  set
    status = 'cancelled',
    arrival_status = '',
    updated_at = now()
  where id = p_booking_id;

  perform public.create_owner_notification_for_booking(p_booking_id, 'appointment_cancelled');
end;
$$;

revoke all on function public.cancel_my_booking(uuid) from public;
grant execute on function public.cancel_my_booking(uuid) to authenticated;

create or replace function public.hide_my_booking(
  p_booking_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  update public.bookings
  set
    hidden_for_customer = true,
    updated_at = now()
  where id = p_booking_id
    and customer_auth_user_id = auth.uid()
    and status in ('cancelled', 'rejected');

  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;
end;
$$;

revoke all on function public.hide_my_booking(uuid) from public;
grant execute on function public.hide_my_booking(uuid) to authenticated;

create or replace function public.respond_attendance_confirmation(
  p_booking_id uuid,
  p_response text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if p_response not in ('confirmed', 'declined') then
    raise exception 'INVALID_ATTENDANCE_RESPONSE';
  end if;

  update public.bookings
  set
    attendance_confirmation_status = p_response,
    attendance_confirmation_answered_at = now(),
    updated_at = now()
  where id = p_booking_id
    and customer_auth_user_id = auth.uid()
    and status = 'approved'
    and attendance_confirmation_requested_at is not null
    and attendance_confirmation_status = 'pending';

  if not found then
    raise exception 'BOOKING_NOT_AVAILABLE_FOR_ATTENDANCE_RESPONSE';
  end if;
end;
$$;

revoke all on function public.respond_attendance_confirmation(uuid, text) from public;
grant execute on function public.respond_attendance_confirmation(uuid, text) to authenticated;

create or replace function public.request_booking_attendance_confirmation(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_booking public.bookings%rowtype;
begin
  if not public.is_owner() then raise exception 'OWNER_REQUIRED'; end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;
  if not found or v_booking.status <> 'approved' then
    raise exception 'BOOKING_NOT_AVAILABLE';
  end if;

  if v_booking.customer_auth_user_id is not null then
    insert into public.notifications (
      title, message, user_id, type, booking_id, action_url, metadata, event_key
    ) values (
      'בקשת אישור הגעה',
      format('נשמח לדעת אם תגיעי לתור בתאריך %s בשעה %s.', v_booking.booking_date, to_char(v_booking.booking_time, 'HH24:MI')),
      v_booking.customer_auth_user_id::text,
      'attendance_confirmation',
      v_booking.id,
      'index.html?booking=' || v_booking.id::text,
      jsonb_build_object('booking_id', v_booking.id),
      'attendance_request:' || v_booking.id::text
    )
    on conflict (event_key) do update
    set message = excluded.message,
        is_read = false,
        created_at = now();
  end if;

  update public.bookings
  set attendance_confirmation_requested_at = coalesce(attendance_confirmation_requested_at, now()),
      attendance_confirmation_status = case when attendance_confirmation_status = '' then 'pending' else attendance_confirmation_status end,
      updated_at = now()
  where id = v_booking.id;
end;
$$;

revoke all on function public.request_booking_attendance_confirmation(uuid) from public;
grant execute on function public.request_booking_attendance_confirmation(uuid) to authenticated;

create or replace function public.join_waitlist_public(
  p_service_id uuid,
  p_service_name text,
  p_booking_date date,
  p_notes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_customer public.customers%rowtype;
  v_service_name text;
  v_entry_id uuid;
  v_owner_id uuid;
begin
  select * into v_customer
  from public.customers
  where auth_user_id = auth.uid()
  limit 1;

  if not found then
    raise exception 'CUSTOMER_PROFILE_REQUIRED';
  end if;
  if v_customer.is_blocked then
    raise exception 'CUSTOMER_BLOCKED';
  end if;
  if p_booking_date < current_date then
    raise exception 'INVALID_WAITLIST_DATE';
  end if;

  select s.name into v_service_name
  from public.services s
  where s.id = p_service_id and s.is_active = true;
  if not found then
    raise exception 'INVALID_SERVICE';
  end if;

  select w.id into v_entry_id
  from public.waitlist_entries w
  where w.customer_auth_user_id = auth.uid()
    and w.service_id = p_service_id
    and w.booking_date = p_booking_date
    and w.status = 'waiting'
  limit 1;
  if v_entry_id is not null then
    return v_entry_id;
  end if;

  insert into public.waitlist_entries (
    customer_auth_user_id,
    customer_phone,
    customer_name,
    service_id,
    service_name,
    booking_date,
    notes,
    status
  )
  values (
    auth.uid(),
    v_customer.phone,
    trim(concat(v_customer.first_name, ' ', v_customer.last_name)),
    p_service_id,
    v_service_name,
    p_booking_date,
    left(trim(coalesce(p_notes, '')), 1000),
    'waiting'
  )
  returning id into v_entry_id;

  select op.id into v_owner_id
  from public.owner_profiles op
  order by op.created_at
  limit 1;
  if v_owner_id is not null then
    insert into public.notifications (
      title, message, user_id, type, action_url, metadata, event_key
    ) values (
      'לקוחה הצטרפה לרשימת ההמתנה',
      format('%s הצטרפה לרשימת ההמתנה ל%s בתאריך %s.', trim(concat(v_customer.first_name, ' ', v_customer.last_name)), v_service_name, p_booking_date),
      v_owner_id::text,
      'waitlist_joined',
      'owner.html#ownerWaitlistSection',
      jsonb_build_object('waitlist_id', v_entry_id),
      'waitlist_joined:' || v_entry_id::text
    )
    on conflict (event_key) do nothing;
  end if;

  return v_entry_id;
end;
$$;

revoke all on function public.join_waitlist_public(uuid, text, date, text) from public;
grant execute on function public.join_waitlist_public(uuid, text, date, text) to authenticated;

create or replace function public.promote_waitlist_after_booking_cancel()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_waitlist_id uuid;
begin
  if new.status <> 'cancelled' or old.status is not distinct from new.status then
    return new;
  end if;

  select w.id into v_waitlist_id
  from public.waitlist_entries w
  where w.status = 'waiting'
    and w.booking_date = new.booking_date
    and (
      w.service_id = new.service_id
      or exists (
        select 1
        from jsonb_array_elements_text(coalesce(new.service_ids, '[]'::jsonb)) selected
        where selected.value = w.service_id::text
      )
    )
  order by w.created_at, w.id
  limit 1
  for update skip locked;

  if v_waitlist_id is not null then
    update public.waitlist_entries
    set status = 'notified', notified_at = now()
    where id = v_waitlist_id and status = 'waiting';
  end if;

  return new;
end;
$$;

revoke all on function public.promote_waitlist_after_booking_cancel() from public;
drop trigger if exists promote_waitlist_after_booking_cancel on public.bookings;
create trigger promote_waitlist_after_booking_cancel
after update of status on public.bookings
for each row execute function public.promote_waitlist_after_booking_cancel();

commit;
