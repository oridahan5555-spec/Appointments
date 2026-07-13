begin;

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- These are the original application tables. Abort before changing anything if
-- the core schema is not the booking application this migration was written for.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'business', 'services', 'working_hours', 'bookings',
    'customers', 'notifications', 'waitlist_entries'
  ]
  loop
    if to_regclass(format('public.%I', v_table)) is null then
      raise exception 'MISSING_REQUIRED_TABLE_%', upper(v_table);
    end if;
  end loop;
end;
$$;

-- These tables were introduced by earlier migrations. CREATE IF NOT EXISTS
-- keeps this final migration compatible with both the current production
-- database and an installation that missed one of those additive migrations.
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

create table if not exists public.owner_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_id uuid not null references public.business(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id)
);

-- Add every post-launch column used below before any policy, trigger, or RPC
-- references it. Existing values are preserved.
alter table public.business
  add column if not exists features jsonb not null default '{}'::jsonb,
  add column if not exists cover_image text not null default '',
  add column if not exists profile_image text not null default '',
  add column if not exists preparation_message text not null default '',
  add column if not exists owner_email text;

alter table public.customers
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists email text,
  add column if not exists owner_note text not null default '',
  add column if not exists is_blocked boolean not null default false,
  add column if not exists blocked_reason text not null default '',
  add column if not exists blocked_at timestamptz,
  add column if not exists no_show_count integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

alter table public.bookings
  add column if not exists service_ids jsonb not null default '[]'::jsonb,
  add column if not exists service_names jsonb not null default '[]'::jsonb,
  add column if not exists customer_auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists customer_email text,
  add column if not exists replaces_booking_id uuid references public.bookings(id) on delete set null,
  add column if not exists hidden_for_customer boolean not null default false,
  add column if not exists arrival_status text not null default '',
  add column if not exists attendance_confirmation_requested_at timestamptz,
  add column if not exists attendance_confirmation_status text not null default '',
  add column if not exists attendance_confirmation_answered_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists slot_range tsrange generated always as (
    tsrange(
      (booking_date + booking_time)::timestamp,
      (booking_date + booking_time + make_interval(mins => duration_minutes))::timestamp,
      '[)'
    )
  ) stored;

alter table public.waitlist_entries
  add column if not exists customer_auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists notified_at timestamptz;

alter table public.notifications
  add column if not exists booking_id uuid references public.bookings(id) on delete cascade,
  add column if not exists action_url text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists event_key text;

-- The exclusion constraint is the database-level race-condition guard. The
-- explicit preflight avoids changing historical bookings if old active rows
-- already overlap.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and conname = 'bookings_no_overlap'
      and contype = 'x'
  ) then
    if exists (
      select 1
      from public.bookings left_booking
      join public.bookings right_booking
        on left_booking.id < right_booking.id
       and left_booking.status in ('pending', 'approved')
       and right_booking.status in ('pending', 'approved')
       and left_booking.slot_range && right_booking.slot_range
    ) then
      raise exception 'ACTIVE_BOOKING_OVERLAPS_MUST_BE_RESOLVED_BEFORE_MIGRATION';
    end if;

    if exists (
      select 1
      from pg_constraint
      where conrelid = 'public.bookings'::regclass
        and conname = 'bookings_no_overlap'
    ) then
      raise exception 'BOOKINGS_NO_OVERLAP_CONSTRAINT_HAS_UNEXPECTED_TYPE';
    end if;

    alter table public.bookings
      add constraint bookings_no_overlap
      exclude using gist (slot_range with &&)
      where (status in ('pending', 'approved'));
  end if;
end;
$$;

-- Blank keys have no idempotency meaning. For historical duplicate keys, keep
-- the first key and give every later row a deterministic unique legacy key.
-- No notification is deleted or merged.
drop trigger if exists protect_customer_notification_fields on public.notifications;

update public.notifications
set event_key = null
where event_key is not null and btrim(event_key) = '';

do $$
begin
  loop
    with ranked as (
      select id, event_key,
             row_number() over (
               partition by event_key
               order by created_at, id
             ) as duplicate_number
      from public.notifications
      where event_key is not null
    )
    update public.notifications notification
    set event_key = notification.event_key || ':legacy-duplicate:' || notification.id::text
    from ranked
    where notification.id = ranked.id
      and ranked.duplicate_number > 1;

    exit when not found;
  end loop;
end;
$$;

-- Recover safely from a previously interrupted or incorrectly non-unique index
-- creation, then enforce uniqueness for all future notification events.
do $$
declare
  v_is_unique boolean;
  v_is_valid boolean;
  v_is_expected boolean;
begin
  select index_definition.indisunique,
         index_definition.indisvalid,
         index_definition.indpred is null
           and index_definition.indnkeyatts = 1
           and indexed_column.attname = 'event_key'
  into v_is_unique, v_is_valid, v_is_expected
  from pg_class index_name
  join pg_namespace index_schema on index_schema.oid = index_name.relnamespace
  join pg_index index_definition on index_definition.indexrelid = index_name.oid
  left join pg_attribute indexed_column
    on indexed_column.attrelid = index_definition.indrelid
   and indexed_column.attnum = index_definition.indkey[0]
  where index_schema.nspname = 'public'
    and index_name.relname = 'notifications_event_key_uidx';

  if found and (not v_is_unique or not v_is_valid or not coalesce(v_is_expected, false)) then
    execute 'drop index public.notifications_event_key_uidx';
  end if;
end;
$$;

create unique index if not exists notifications_event_key_uidx
on public.notifications (event_key);

alter table public.business enable row level security;
alter table public.services enable row level security;
alter table public.working_hours enable row level security;
alter table public.bookings enable row level security;
alter table public.customers enable row level security;
alter table public.notifications enable row level security;
alter table public.waitlist_entries enable row level security;
alter table public.owner_profiles enable row level security;
alter table public.special_hours enable row level security;
alter table public.blocked_slots enable row level security;

-- Table privileges are explicit. This also removes privileges such as TRUNCATE,
-- which are not protected by row-level policies.
revoke all on table public.business, public.services, public.working_hours,
  public.bookings, public.customers, public.notifications, public.waitlist_entries,
  public.owner_profiles, public.special_hours, public.blocked_slots
from public, anon, authenticated;
grant select, insert, update, delete on table public.bookings, public.customers,
  public.notifications, public.waitlist_entries to authenticated;
grant select on table public.owner_profiles to authenticated;
grant select, insert, update, delete on table public.services, public.working_hours,
  public.special_hours, public.blocked_slots to authenticated;
grant select on table public.services, public.working_hours to anon;
grant insert, update, delete on table public.business to authenticated;

-- Replace policy drift with one explicit policy set. Public booking creation
-- and private availability continue only through the narrow RPCs below.
do $$
declare
  v_policy record;
begin
  for v_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'business', 'services', 'working_hours', 'special_hours', 'blocked_slots',
        'bookings', 'customers', 'notifications', 'waitlist_entries', 'owner_profiles'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', v_policy.policyname, v_policy.schemaname, v_policy.tablename);
  end loop;
end;
$$;

update public.business b
set owner_email = u.email
from public.owner_profiles op
join auth.users u on u.id = op.id
where op.business_id = b.id
  and nullif(trim(coalesce(b.owner_email, '')), '') is null
  and nullif(trim(coalesce(u.email, '')), '') is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;

drop trigger if exists set_special_hours_updated_at on public.special_hours;
create trigger set_special_hours_updated_at
before update on public.special_hours
for each row execute function public.set_updated_at();

drop trigger if exists set_owner_profiles_updated_at on public.owner_profiles;
create trigger set_owner_profiles_updated_at
before update on public.owner_profiles
for each row execute function public.set_updated_at();

-- Recreate the authorization helpers before any policy or RPC references them.
-- They return information only for the current authenticated JWT subject.
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1
    from public.owner_profiles profile
    where profile.id = auth.uid()
  )
$$;

create or replace function public.owner_business_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select profile.business_id
  from public.owner_profiles profile
  where profile.id = auth.uid()
  limit 1
$$;

create or replace function public.current_customer_row_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select customer.id
  from public.customers customer
  where customer.auth_user_id = auth.uid()
  limit 1
$$;

revoke all on function public.is_owner() from public;
revoke all on function public.owner_business_id() from public;
revoke all on function public.current_customer_row_id() from public;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.owner_business_id() to authenticated;
grant execute on function public.current_customer_row_id() to authenticated;

-- Keep the business email in the required business table without exposing the
-- column through the public REST table endpoint.
revoke select on table public.business from public, anon, authenticated;
grant select (
  id, name, description, address, phone, instagram_url, features,
  cover_image, profile_image, preparation_message, created_at, updated_at
) on table public.business to anon, authenticated;

create policy "business public read"
on public.business
for select
to anon, authenticated
using (true);

create policy "business owner manage"
on public.business
for all
to authenticated
using (id = public.owner_business_id())
with check (id = public.owner_business_id());

create policy "services public read"
on public.services
for select
to anon, authenticated
using (true);

create policy "services owner manage"
on public.services
for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

create policy "working_hours public read"
on public.working_hours
for select
to anon, authenticated
using (true);

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

-- Public availability is exposed through narrow RPCs. Internal notes remain
-- visible only to the owner through the tables' owner policy.
revoke select on table public.blocked_slots from public, anon;
revoke select on table public.special_hours from public, anon;
grant select on table public.blocked_slots to authenticated;
grant select on table public.special_hours to authenticated;

-- A manually blocked time represents one configured scheduling interval on
-- that date. Keeping this calculation in one function makes the availability
-- check consistent for regular and special working days.
create or replace function public.blocked_slot_duration_minutes(p_blocked_date date)
returns integer
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select greatest(
    coalesce(
      (
        select special.slot_interval_minutes
        from public.special_hours special
        where special.special_date = p_blocked_date
        limit 1
      ),
      (
        select regular.slot_interval_minutes
        from public.working_hours regular
        where regular.day_of_week = extract(dow from p_blocked_date)::integer
        limit 1
      ),
      30
    ),
    1
  )
$$;

revoke all on function public.blocked_slot_duration_minutes(date) from public;

-- PostgreSQL cannot use CREATE OR REPLACE when a function's TABLE/OUT row
-- shape changed. Compare the installed shape with the shape required below,
-- and drop only an incompatible exact signature. A dependency guard aborts
-- the whole transaction instead of removing dependent objects implicitly.
do $return_shape_compatibility$
declare
  v_target record;
  v_function_oid oid;
  v_actual_returns_set boolean;
  v_actual_result_names text[];
  v_actual_result_types oid[];
  v_drop_identity text;
  v_dependencies text;
begin
  for v_target in
    select *
    from (values
      (
        'public.get_public_blocked_slots()'::text,
        array['id', 'blocked_date', 'blocked_time']::text[],
        array[
          'uuid'::regtype::oid,
          'date'::regtype::oid,
          'time without time zone'::regtype::oid
        ]::oid[]
      ),
      (
        'public.get_public_special_hours()'::text,
        array[
          'id', 'special_date', 'opens_at', 'closes_at',
          'slot_interval_minutes', 'is_closed'
        ]::text[],
        array[
          'uuid'::regtype::oid,
          'date'::regtype::oid,
          'time without time zone'::regtype::oid,
          'time without time zone'::regtype::oid,
          'integer'::regtype::oid,
          'boolean'::regtype::oid
        ]::oid[]
      ),
      (
        'public.get_public_booking_slots()'::text,
        array[
          'id', 'service_id', 'service_ids', 'service_names', 'booking_date',
          'booking_time', 'duration_minutes', 'status', 'replaces_booking_id',
          'hidden_for_customer', 'arrival_status',
          'attendance_confirmation_requested_at',
          'attendance_confirmation_status',
          'attendance_confirmation_answered_at'
        ]::text[],
        array[
          'uuid'::regtype::oid,
          'uuid'::regtype::oid,
          'jsonb'::regtype::oid,
          'jsonb'::regtype::oid,
          'date'::regtype::oid,
          'time without time zone'::regtype::oid,
          'integer'::regtype::oid,
          'text'::regtype::oid,
          'uuid'::regtype::oid,
          'boolean'::regtype::oid,
          'text'::regtype::oid,
          'timestamp with time zone'::regtype::oid,
          'text'::regtype::oid,
          'timestamp with time zone'::regtype::oid
        ]::oid[]
      ),
      (
        'public.create_booking_public(uuid,jsonb,text,text,text,text,date,time without time zone,uuid)'::text,
        array[
          'booking_id', 'booking_status', 'booking_date', 'booking_time',
          'duration_minutes'
        ]::text[],
        array[
          'uuid'::regtype::oid,
          'text'::regtype::oid,
          'date'::regtype::oid,
          'time without time zone'::regtype::oid,
          'integer'::regtype::oid
        ]::oid[]
      )
    ) as expected(function_signature, result_names, result_types)
  loop
    v_function_oid := to_regprocedure(v_target.function_signature)::oid;
    if v_function_oid is null then
      continue;
    end if;

    select
      function_definition.proretset,
      coalesce(
        array_agg(result_argument.argument_name order by result_argument.ordinality)
          filter (where result_argument.argument_mode::text in ('o', 'b', 't')),
        array[]::text[]
      ),
      coalesce(
        array_agg(result_argument.argument_type order by result_argument.ordinality)
          filter (where result_argument.argument_mode::text in ('o', 'b', 't')),
        array[]::oid[]
      ),
      format(
        '%I.%I(%s)',
        function_schema.nspname,
        function_definition.proname,
        pg_get_function_identity_arguments(function_definition.oid)
      )
    into
      v_actual_returns_set,
      v_actual_result_names,
      v_actual_result_types,
      v_drop_identity
    from pg_proc function_definition
    join pg_namespace function_schema
      on function_schema.oid = function_definition.pronamespace
    left join lateral unnest(
      function_definition.proallargtypes,
      function_definition.proargmodes,
      function_definition.proargnames
    ) with ordinality as result_argument(
      argument_type,
      argument_mode,
      argument_name,
      ordinality
    ) on true
    where function_definition.oid = v_function_oid
    group by
      function_definition.oid,
      function_definition.proretset,
      function_definition.proname,
      function_schema.nspname;

    if v_actual_returns_set
       and v_actual_result_names is not distinct from v_target.result_names
       and v_actual_result_types is not distinct from v_target.result_types then
      continue;
    end if;

    select string_agg(
      distinct pg_describe_object(
        dependency.classid,
        dependency.objid,
        dependency.objsubid
      ),
      E'\n- '
    )
    into v_dependencies
    from pg_depend dependency
    where dependency.refclassid = 'pg_proc'::regclass
      and dependency.refobjid = v_function_oid
      and not (
        dependency.classid = 'pg_proc'::regclass
        and dependency.objid = v_function_oid
      );

    if v_dependencies is not null then
      raise exception using
        message = format(
          'Cannot safely recreate %s because dependent objects exist: %s',
          v_target.function_signature,
          v_dependencies
        ),
        hint = 'Update those dependencies explicitly, then run this migration again.';
    end if;

    execute format('drop function %s', v_drop_identity);
  end loop;
end;
$return_shape_compatibility$;

create or replace function public.get_public_blocked_slots()
returns table (
  id uuid,
  blocked_date date,
  blocked_time time
)
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

-- Preserve the existing RPC signature while returning only the three values
-- needed to calculate availability. Booking IDs and internal state stay private.
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
    and b.booking_date >= current_date
$$;

revoke all on function public.get_public_booking_slots() from public;
grant execute on function public.get_public_booking_slots() to anon, authenticated;

create or replace function public.get_owner_email_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_business public.business%rowtype;
begin
  if auth.uid() is null or not public.is_owner() then
    raise exception 'OWNER_REQUIRED';
  end if;

  select b.* into v_business
  from public.business b
  where b.id = public.owner_business_id();

  if not found then
    raise exception 'BUSINESS_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'actor_user_id', auth.uid(),
    'actor_is_owner', true,
    'actor_is_customer', false,
    'business_id', v_business.id,
    'business_name', v_business.name,
    'owner_email', v_business.owner_email
  );
end;
$$;

revoke all on function public.get_owner_email_context() from public;
grant execute on function public.get_owner_email_context() to authenticated;

create or replace function public.get_booking_email_context(p_booking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_booking public.bookings%rowtype;
  v_business public.business%rowtype;
  v_customer_email text;
  v_service_name text;
  v_is_owner boolean;
  v_is_customer boolean;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select b.* into v_booking
  from public.bookings b
  where b.id = p_booking_id;

  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  v_is_owner := public.is_owner();
  v_is_customer := v_booking.customer_auth_user_id = auth.uid();
  if not v_is_owner and not v_is_customer then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  if v_is_owner then
    select b.* into v_business
    from public.business b
    where b.id = public.owner_business_id();
  else
    select b.* into v_business
    from public.business b
    order by b.created_at
    limit 1;
  end if;

  select c.email into v_customer_email
  from public.customers c
  where c.auth_user_id = v_booking.customer_auth_user_id
  limit 1;

  v_customer_email := coalesce(
    nullif(trim(coalesce(v_booking.customer_email, '')), ''),
    nullif(trim(coalesce(v_customer_email, '')), '')
  );

  select coalesce(
    nullif(array_to_string(array(
      select jsonb_array_elements_text(coalesce(v_booking.service_names, '[]'::jsonb))
    ), ' + '), ''),
    (select s.name from public.services s where s.id = v_booking.service_id),
    'שירות'
  ) into v_service_name;

  return jsonb_build_object(
    'actor_user_id', auth.uid(),
    'actor_is_owner', v_is_owner,
    'actor_is_customer', v_is_customer,
    'business_id', v_business.id,
    'business_name', v_business.name,
    'business_address', v_business.address,
    'business_phone', v_business.phone,
    'owner_email', v_business.owner_email,
    'booking_id', v_booking.id,
    'status', v_booking.status,
    'replaces_booking_id', v_booking.replaces_booking_id,
    'attendance_confirmation_requested_at', v_booking.attendance_confirmation_requested_at,
    'attendance_confirmation_status', v_booking.attendance_confirmation_status,
    'service_name', v_service_name,
    'booking_date', v_booking.booking_date,
    'booking_time', to_char(v_booking.booking_time, 'HH24:MI'),
    'customer_name', trim(concat(v_booking.customer_first_name, ' ', v_booking.customer_last_name)),
    'customer_phone', v_booking.customer_phone,
    'customer_email', v_customer_email,
    'notes', v_booking.notes
  );
end;
$$;

revoke all on function public.get_booking_email_context(uuid) from public;
grant execute on function public.get_booking_email_context(uuid) to authenticated;

-- Customers may edit contact details, but cannot unblock themselves or alter
-- internal notes and counters even if they call PostgREST directly.
create or replace function public.protect_customer_internal_fields()
returns trigger
language plpgsql
set search_path = pg_catalog, public, auth
as $$
declare
  v_auth_email text;
begin
  if public.is_owner() then
    return new;
  end if;

  v_auth_email := lower(nullif(trim(coalesce(auth.jwt() ->> 'email', '')), ''));
  if auth.uid() is null or v_auth_email is null then
    raise exception 'AUTH_REQUIRED';
  end if;

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

create or replace function public.protect_customer_notification_fields()
returns trigger
language plpgsql
set search_path = pg_catalog, public, auth
as $$
begin
  if public.is_owner() then
    return new;
  end if;
  if new.title is distinct from old.title
     or new.message is distinct from old.message
     or new.user_id is distinct from old.user_id
     or new.type is distinct from old.type
     or new.booking_id is distinct from old.booking_id
     or new.action_url is distinct from old.action_url
     or new.metadata is distinct from old.metadata
     or new.event_key is distinct from old.event_key
     or new.created_at is distinct from old.created_at then
    raise exception 'NOTIFICATION_FIELDS_FORBIDDEN';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_customer_notification_fields() from public;
drop trigger if exists protect_customer_notification_fields on public.notifications;
create trigger protect_customer_notification_fields
before update on public.notifications
for each row execute function public.protect_customer_notification_fields();

drop policy if exists "waitlist customer insert own" on public.waitlist_entries;
drop policy if exists "waitlist customer delete own" on public.waitlist_entries;

create or replace function public.claim_customer_account(
  p_first_name text default '',
  p_last_name text default '',
  p_phone text default '',
  p_email text default ''
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_phone text;
  v_email text;
  v_first_name text;
  v_last_name text;
  v_customer public.customers%rowtype;
begin
  if v_auth_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  v_phone := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), '');
  v_email := lower(nullif(trim(coalesce(auth.jwt() ->> 'email', '')), ''));
  v_first_name := left(trim(coalesce(p_first_name, auth.jwt() -> 'user_metadata' ->> 'first_name', '')), 100);
  v_last_name := left(trim(coalesce(p_last_name, auth.jwt() -> 'user_metadata' ->> 'last_name', '')), 100);

  if v_email is null then raise exception 'VERIFIED_EMAIL_REQUIRED'; end if;
  if nullif(trim(coalesce(p_email, '')), '') is not null and lower(trim(p_email)) <> v_email then
    raise exception 'EMAIL_MISMATCH';
  end if;

  select c.* into v_customer
  from public.customers c
  where c.auth_user_id = v_auth_user_id
     or lower(coalesce(c.email, '')) = v_email
  order by case when c.auth_user_id = v_auth_user_id then 0 else 1 end
  limit 1
  for update;

  if found then
    v_phone := coalesce(v_phone, nullif(regexp_replace(coalesce(v_customer.phone, ''), '[^0-9+]', '', 'g'), ''));
    if v_phone is null or length(regexp_replace(v_phone, '[^0-9]', '', 'g')) not between 9 and 15 then
      raise exception 'VALID_PHONE_REQUIRED';
    end if;
    if v_customer.auth_user_id is not null and v_customer.auth_user_id <> v_auth_user_id then
      raise exception 'CUSTOMER_ALREADY_LINKED';
    end if;
    if exists (
      select 1 from public.customers c
      where c.phone = v_phone and c.id <> v_customer.id
    ) then
      raise exception 'PHONE_ALREADY_REGISTERED';
    end if;

    update public.customers
    set auth_user_id = v_auth_user_id,
        first_name = coalesce(nullif(v_first_name, ''), first_name),
        last_name = coalesce(nullif(v_last_name, ''), last_name),
        phone = v_phone,
        email = v_email,
        updated_at = now()
    where id = v_customer.id;

    update public.bookings
    set customer_auth_user_id = v_auth_user_id,
        customer_email = v_email,
        updated_at = now()
    where customer_auth_user_id is null
      and customer_phone = v_customer.phone;

    update public.waitlist_entries
    set customer_auth_user_id = v_auth_user_id
    where customer_auth_user_id is null
      and customer_phone = v_customer.phone;

    update public.notifications
    set user_id = v_auth_user_id::text
    where user_id = v_customer.phone;

    return v_customer.id;
  end if;

  if v_phone is null or length(regexp_replace(v_phone, '[^0-9]', '', 'g')) not between 9 and 15 then
    raise exception 'VALID_PHONE_REQUIRED';
  end if;
  if exists (select 1 from public.customers c where c.phone = v_phone) then
    raise exception 'PHONE_ALREADY_REGISTERED';
  end if;

  insert into public.customers (auth_user_id, first_name, last_name, phone, email)
  values (v_auth_user_id, v_first_name, v_last_name, v_phone, v_email)
  returning id into v_customer.id;
  return v_customer.id;
end;
$$;

revoke all on function public.claim_customer_account(text, text, text, text) from public;
grant execute on function public.claim_customer_account(text, text, text, text) to authenticated;

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
  select * into v_customer from public.customers where auth_user_id = auth.uid() limit 1;
  if not found then raise exception 'CUSTOMER_PROFILE_REQUIRED'; end if;
  if v_customer.is_blocked then raise exception 'CUSTOMER_BLOCKED'; end if;
  if p_booking_date < current_date then raise exception 'INVALID_WAITLIST_DATE'; end if;

  select s.name into v_service_name
  from public.services s
  where s.id = p_service_id and s.is_active = true;
  if not found then raise exception 'INVALID_SERVICE'; end if;

  select w.id into v_entry_id
  from public.waitlist_entries w
  where w.customer_auth_user_id = auth.uid()
    and w.service_id = p_service_id
    and w.booking_date = p_booking_date
    and w.status = 'waiting'
  limit 1;
  if v_entry_id is not null then return v_entry_id; end if;

  insert into public.waitlist_entries (
    customer_auth_user_id, customer_phone, customer_name, service_id,
    service_name, booking_date, notes, status
  ) values (
    auth.uid(), v_customer.phone,
    trim(concat(v_customer.first_name, ' ', v_customer.last_name)),
    p_service_id, v_service_name, p_booking_date,
    left(trim(coalesce(p_notes, '')), 1000), 'waiting'
  ) returning id into v_entry_id;

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
  set attendance_confirmation_status = p_response,
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

-- Durable delivery claims prevent refreshes and repeated clicks from sending
-- the same state-change email again. The table contains no message body or PII.
create table if not exists public.email_delivery_events (
  event_key text primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  event_type text not null,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  delivery_status text not null default 'processing'
    check (delivery_status in ('processing', 'sent', 'failed')),
  attempts integer not null default 1 check (attempts > 0),
  claimed_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.email_delivery_events enable row level security;
revoke all on table public.email_delivery_events from public, anon, authenticated;

create or replace function public.claim_email_delivery_event(
  p_booking_id uuid,
  p_event_type text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_context jsonb;
  v_event_key text;
  v_existing public.email_delivery_events%rowtype;
  v_is_owner boolean;
  v_is_customer boolean;
  v_status text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_event_type not in (
    'booking_created_owner', 'booking_created_customer',
    'booking_approved_customer', 'booking_rejected_customer',
    'booking_cancelled_owner', 'booking_cancelled_customer',
    'booking_rescheduled_customer', 'attendance_confirmation_customer',
    'attendance_response_owner', 'reminder_customer'
  ) then raise exception 'INVALID_EMAIL_EVENT'; end if;

  v_context := public.get_booking_email_context(p_booking_id);
  v_is_owner := coalesce((v_context ->> 'actor_is_owner')::boolean, false);
  v_is_customer := coalesce((v_context ->> 'actor_is_customer')::boolean, false);
  v_status := coalesce(v_context ->> 'status', '');

  if p_event_type in ('booking_created_owner', 'booking_created_customer')
     and (not v_is_customer or v_status <> 'pending') then raise exception 'EVENT_NOT_ALLOWED'; end if;
  if p_event_type in ('booking_approved_customer', 'booking_rescheduled_customer', 'attendance_confirmation_customer', 'reminder_customer')
     and (not v_is_owner or v_status <> 'approved') then raise exception 'EVENT_NOT_ALLOWED'; end if;
  if p_event_type = 'booking_rejected_customer'
     and (not v_is_owner or v_status <> 'rejected') then raise exception 'EVENT_NOT_ALLOWED'; end if;
  if p_event_type = 'booking_cancelled_owner'
     and (not v_is_customer or v_status <> 'cancelled') then raise exception 'EVENT_NOT_ALLOWED'; end if;
  if p_event_type = 'booking_cancelled_customer'
     and (not (v_is_owner or v_is_customer) or v_status <> 'cancelled') then raise exception 'EVENT_NOT_ALLOWED'; end if;
  if p_event_type = 'booking_rescheduled_customer'
     and nullif(v_context ->> 'replaces_booking_id', '') is null then raise exception 'EVENT_NOT_ALLOWED'; end if;
  if p_event_type = 'attendance_confirmation_customer'
     and nullif(v_context ->> 'attendance_confirmation_requested_at', '') is null then raise exception 'EVENT_NOT_ALLOWED'; end if;
  if p_event_type = 'attendance_response_owner'
     and (not v_is_customer or coalesce(v_context ->> 'attendance_confirmation_status', '') not in ('confirmed', 'declined')) then
    raise exception 'EVENT_NOT_ALLOWED';
  end if;

  v_event_key := p_event_type || ':' || p_booking_id::text;

  insert into public.email_delivery_events (
    event_key, booking_id, event_type, actor_user_id
  ) values (
    v_event_key, p_booking_id, p_event_type, auth.uid()
  )
  on conflict (event_key) do nothing;

  if found then return v_event_key; end if;

  select * into v_existing
  from public.email_delivery_events
  where event_key = v_event_key
  for update;

  if v_existing.delivery_status = 'sent'
     or (v_existing.delivery_status = 'processing' and v_existing.claimed_at > now() - interval '10 minutes') then
    return null;
  end if;

  update public.email_delivery_events
  set delivery_status = 'processing', actor_user_id = auth.uid(),
      attempts = attempts + 1, claimed_at = now(), sent_at = null
  where event_key = v_event_key;
  return v_event_key;
end;
$$;

create or replace function public.complete_email_delivery_event(p_event_key text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  update public.email_delivery_events
  set delivery_status = 'sent', sent_at = now()
  where event_key = p_event_key
    and actor_user_id = auth.uid()
    and delivery_status = 'processing';
  return found;
end;
$$;

create or replace function public.release_email_delivery_event(p_event_key text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  update public.email_delivery_events
  set delivery_status = 'failed', claimed_at = now()
  where event_key = p_event_key
    and actor_user_id = auth.uid()
    and delivery_status = 'processing';
  return found;
end;
$$;

revoke all on function public.claim_email_delivery_event(uuid, text) from public;
revoke all on function public.complete_email_delivery_event(text) from public;
revoke all on function public.release_email_delivery_event(text) from public;
grant execute on function public.claim_email_delivery_event(uuid, text) to authenticated;
grant execute on function public.complete_email_delivery_event(text) to authenticated;
grant execute on function public.release_email_delivery_event(text) to authenticated;

create or replace function public.enforce_booking_status_transition()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.status is not distinct from old.status then return new; end if;
  if (old.status = 'pending' and new.status in ('approved', 'rejected', 'cancelled'))
     or (old.status = 'approved' and new.status = 'cancelled')
     or (old.status = 'rejected' and new.status = 'pending') then
    return new;
  end if;
  raise exception 'INVALID_BOOKING_STATUS_TRANSITION';
end;
$$;

revoke all on function public.enforce_booking_status_transition() from public;
drop trigger if exists enforce_booking_status_transition on public.bookings;
create trigger enforce_booking_status_transition
before update of status on public.bookings
for each row execute function public.enforce_booking_status_transition();

create or replace function public.touch_business_schedule_version()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.business set updated_at = now();
  return null;
end;
$$;

revoke all on function public.touch_business_schedule_version() from public;
drop trigger if exists touch_business_after_booking_change on public.bookings;
create trigger touch_business_after_booking_change
after insert or update or delete on public.bookings
for each statement execute function public.touch_business_schedule_version();
drop trigger if exists touch_business_after_blocked_slot_change on public.blocked_slots;
create trigger touch_business_after_blocked_slot_change
after insert or update or delete on public.blocked_slots
for each statement execute function public.touch_business_schedule_version();
drop trigger if exists touch_business_after_special_hours_change on public.special_hours;
create trigger touch_business_after_special_hours_change
after insert or update or delete on public.special_hours
for each statement execute function public.touch_business_schedule_version();

-- Keep the tables used by the current browser subscriptions in Realtime. The
-- private tables remain protected by their RLS policies for every subscriber.
do $$
declare
  v_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array[
      'business', 'services', 'working_hours', 'special_hours', 'blocked_slots',
      'bookings', 'customers', 'notifications', 'waitlist_entries'
    ]
    loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = v_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end;
$$;

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
  v_title text;
  v_message text;
begin
  if p_event_type not in (
    'appointment_booked', 'appointment_rescheduled', 'appointment_cancelled',
    'appointment_rejected', 'appointment_updated'
  ) then raise exception 'INVALID_NOTIFICATION_EVENT'; end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;

  select id into v_owner_id from public.owner_profiles order by created_at limit 1;
  if v_owner_id is null then return null; end if;

  select coalesce(
    nullif(array_to_string(array(
      select jsonb_array_elements_text(coalesce(v_booking.service_names, '[]'::jsonb))
    ), ' + '), ''),
    (select s.name from public.services s where s.id = v_booking.service_id),
    'שירות'
  ) into v_service_label;
  v_customer_name := coalesce(nullif(trim(concat(v_booking.customer_first_name, ' ', v_booking.customer_last_name)), ''), 'לקוחה');

  v_title := case p_event_type
    when 'appointment_rejected' then 'תור נדחה'
    when 'appointment_rescheduled' then 'בקשת שינוי תור'
    when 'appointment_cancelled' then 'תור בוטל'
    when 'appointment_updated' then 'תור עודכן'
    else 'בקשה חדשה לתור'
  end;
  v_message := format('%s - %s, בתאריך %s בשעה %s.', v_customer_name, v_service_label, v_booking.booking_date, to_char(v_booking.booking_time, 'HH24:MI'));

  insert into public.notifications (
    title, message, user_id, type, booking_id, action_url, metadata, event_key
  ) values (
    v_title, v_message, v_owner_id::text, p_event_type, v_booking.id,
    'owner.html?booking=' || v_booking.id::text,
    jsonb_build_object('booking_id', v_booking.id),
    'owner:' || p_event_type || ':' || v_booking.id::text
  )
  on conflict (event_key) do update
  set title = excluded.title,
      message = excluded.message,
      is_read = false,
      created_at = now()
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

revoke all on function public.create_owner_notification_for_booking(uuid, text) from public;

create or replace function public.handle_booking_app_notifications()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_title text;
  v_message text;
  v_type text;
  v_event_key text;
  v_service_label text;
  v_owner_id uuid;
  v_customer_name text;
begin
  select coalesce(
    nullif(array_to_string(array(
      select jsonb_array_elements_text(coalesce(new.service_names, '[]'::jsonb))
    ), ' + '), ''),
    (select s.name from public.services s where s.id = new.service_id),
    'שירות'
  ) into v_service_label;

  if new.customer_auth_user_id is not null then
    if new.status is distinct from old.status then
      if new.status = 'approved' then
        v_title := case when new.replaces_booking_id is null then 'התור שלך אושר' else 'שינוי התור אושר' end;
        v_message := format('%s בתאריך %s בשעה %s.', v_service_label, new.booking_date, to_char(new.booking_time, 'HH24:MI'));
        v_type := case when new.replaces_booking_id is null then 'appointment_updated' else 'appointment_rescheduled' end;
        v_event_key := 'customer:approved:' || new.id::text;
      elsif new.status = 'rejected' then
        v_title := 'בקשת התור לא אושרה';
        v_message := format('הבקשה ל%s בתאריך %s בשעה %s לא אושרה.', v_service_label, new.booking_date, to_char(new.booking_time, 'HH24:MI'));
        v_type := 'appointment_updated';
        v_event_key := 'customer:rejected:' || new.id::text;
      elsif new.status = 'cancelled' and not exists (
        select 1 from public.bookings replacement
        where replacement.replaces_booking_id = new.id
          and replacement.status in ('pending', 'approved')
      ) then
        v_title := 'התור בוטל';
        v_message := format('התור ל%s בתאריך %s בשעה %s בוטל.', v_service_label, new.booking_date, to_char(new.booking_time, 'HH24:MI'));
        v_type := 'appointment_cancelled';
        v_event_key := 'customer:cancelled:' || new.id::text;
      end if;
    elsif new.status in ('pending', 'approved') and (
      new.booking_date is distinct from old.booking_date
      or new.booking_time is distinct from old.booking_time
      or new.service_ids is distinct from old.service_ids
      or new.duration_minutes is distinct from old.duration_minutes
    ) then
      v_title := 'פרטי התור עודכנו';
      v_message := format('התור ל%s עודכן לתאריך %s בשעה %s.', v_service_label, new.booking_date, to_char(new.booking_time, 'HH24:MI'));
      v_type := 'appointment_rescheduled';
      v_event_key := 'customer:details-updated:' || new.id::text;
    elsif new.status = 'approved' and new.arrival_status is distinct from old.arrival_status then
      v_title := 'מצב ההגעה עודכן';
      v_message := format('מצב ההגעה לתור ל%s בתאריך %s עודכן.', v_service_label, new.booking_date);
      v_type := 'appointment_updated';
      v_event_key := 'customer:arrival:' || new.id::text || ':' || coalesce(new.arrival_status, '');
    end if;

    if v_event_key is not null then
      insert into public.notifications (
        title, message, user_id, type, booking_id, action_url, metadata, event_key
      ) values (
        v_title, v_message, new.customer_auth_user_id::text, v_type, new.id,
        'index.html?booking=' || new.id::text,
        jsonb_build_object('booking_id', new.id),
        v_event_key
      )
      on conflict (event_key) do update
      set title = excluded.title,
          message = excluded.message,
          is_read = false,
          created_at = now();
    end if;
  end if;

  if new.attendance_confirmation_status is distinct from old.attendance_confirmation_status
     and new.attendance_confirmation_status in ('confirmed', 'declined') then
    select id into v_owner_id from public.owner_profiles order by created_at limit 1;
    if v_owner_id is not null then
      v_customer_name := coalesce(nullif(trim(concat(new.customer_first_name, ' ', new.customer_last_name)), ''), 'לקוחה');
      insert into public.notifications (
        title, message, user_id, type, booking_id, action_url, metadata, event_key
      ) values (
        case when new.attendance_confirmation_status = 'confirmed' then 'הלקוחה אישרה הגעה' else 'הלקוחה לא תגיע' end,
        format('%s עדכנה אישור הגעה לתור בתאריך %s בשעה %s.', v_customer_name, new.booking_date, to_char(new.booking_time, 'HH24:MI')),
        v_owner_id::text,
        'attendance_confirmation',
        new.id,
        'owner.html?booking=' || new.id::text,
        jsonb_build_object('booking_id', new.id, 'response', new.attendance_confirmation_status),
        'owner:attendance:' || new.id::text || ':' || new.attendance_confirmation_status
      )
      on conflict (event_key) do update
      set message = excluded.message,
          is_read = false,
          created_at = now();
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.handle_waitlist_app_notifications()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if new.status = 'notified'
     and old.status is distinct from new.status
     and new.customer_auth_user_id is not null then
    insert into public.notifications (
      title, message, user_id, type, action_url, metadata, event_key
    ) values (
      'התפנה מקום מרשימת ההמתנה',
      format('התפנה מקום ל%s בתאריך %s. אפשר להיכנס לאתר ולבחור שעה.', new.service_name, new.booking_date),
      new.customer_auth_user_id::text,
      'waitlist_available',
      'index.html',
      jsonb_build_object('waitlist_id', new.id, 'booking_date', new.booking_date),
      'customer:waitlist-available:' || new.id::text
    )
    on conflict (event_key) do update
    set message = excluded.message,
        is_read = false,
        created_at = now();
  end if;
  return new;
end;
$$;

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

revoke all on function public.handle_booking_app_notifications() from public;
revoke all on function public.handle_waitlist_app_notifications() from public;
revoke all on function public.promote_waitlist_after_booking_cancel() from public;

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
  v_auth_user_id uuid := auth.uid();
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
  if v_auth_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_customer from public.customers where auth_user_id = v_auth_user_id limit 1;
  if not found then raise exception 'CUSTOMER_PROFILE_REQUIRED'; end if;
  if v_customer.is_blocked then raise exception 'CUSTOMER_BLOCKED'; end if;
  if p_booking_date is null or p_booking_time is null then raise exception 'BOOKING_DATE_AND_TIME_REQUIRED'; end if;
  if p_booking_date < current_date or p_booking_date > current_date + 365 then raise exception 'INVALID_BOOKING_DATE'; end if;

  v_requested_service_ids := case
    when jsonb_typeof(coalesce(p_service_ids, '[]'::jsonb)) = 'array'
      and jsonb_array_length(coalesce(p_service_ids, '[]'::jsonb)) > 0 then p_service_ids
    else jsonb_build_array(p_service_id::text)
  end;
  v_requested_count := jsonb_array_length(v_requested_service_ids);
  if v_requested_count < 1 or v_requested_count > 10 then raise exception 'INVALID_SERVICE_SELECTION'; end if;

  with requested as (
    select value::uuid service_id, ordinality
    from jsonb_array_elements_text(v_requested_service_ids) with ordinality
  ), valid as (
    select r.service_id, r.ordinality, s.name, s.duration_minutes
    from requested r join public.services s on s.id = r.service_id
    where s.is_active = true
  )
  select (array_agg(service_id order by ordinality))[1],
         to_jsonb(array_agg(name order by ordinality)),
         coalesce(sum(duration_minutes), 0), count(distinct service_id)
  into v_primary_service_id, v_service_names, v_total_duration, v_valid_count
  from valid;

  if v_primary_service_id is null or v_total_duration <= 0 or v_valid_count <> v_requested_count then
    raise exception 'INVALID_SERVICE_SELECTION';
  end if;

  v_start_at := (p_booking_date + p_booking_time)::timestamp;
  v_end_at := v_start_at + make_interval(mins => v_total_duration);
  if v_start_at <= (now() at time zone 'Asia/Jerusalem') then raise exception 'TIME_SLOT_NOT_AVAILABLE'; end if;

  select sh.opens_at, sh.closes_at, sh.slot_interval_minutes, sh.is_closed
  into v_open_at, v_close_at, v_interval_minutes, v_is_closed
  from public.special_hours sh where sh.special_date = p_booking_date limit 1;
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
  if v_slot_offset % v_interval_minutes <> 0 then raise exception 'TIME_SLOT_NOT_AVAILABLE'; end if;

  if p_replaces_booking_id is not null and not exists (
    select 1 from public.bookings b
    where b.id = p_replaces_booking_id
      and b.customer_auth_user_id = v_auth_user_id
      and b.status in ('pending', 'approved')
  ) then raise exception 'BOOKING_NOT_FOUND'; end if;

  if exists (
    select 1 from public.blocked_slots bs
    where tsrange((bs.blocked_date + bs.blocked_time)::timestamp,
                  (bs.blocked_date + bs.blocked_time)::timestamp
                    + make_interval(mins => public.blocked_slot_duration_minutes(bs.blocked_date)),
                  '[)')
          && tsrange(v_start_at, v_end_at, '[)')
  ) then raise exception 'TIME_SLOT_BLOCKED'; end if;

  if exists (
    select 1 from public.bookings b
    where b.status in ('pending', 'approved')
      and tsrange(v_start_at, v_end_at, '[)') && b.slot_range
  ) then raise exception 'TIME_SLOT_NOT_AVAILABLE'; end if;

  insert into public.bookings (
    service_id, service_ids, service_names, customer_first_name,
    customer_last_name, customer_phone, customer_email,
    customer_auth_user_id, notes, booking_date, booking_time,
    duration_minutes, status, customer_confirmed, replaces_booking_id
  ) values (
    v_primary_service_id, v_requested_service_ids, coalesce(v_service_names, '[]'::jsonb),
    coalesce(nullif(left(trim(p_customer_first_name), 100), ''), v_customer.first_name),
    coalesce(nullif(left(trim(p_customer_last_name), 100), ''), v_customer.last_name),
    coalesce(nullif(regexp_replace(coalesce(p_customer_phone, ''), '[^0-9+]', '', 'g'), ''), v_customer.phone),
    v_customer.email, v_auth_user_id, left(trim(coalesce(p_notes, '')), 1000),
    p_booking_date, p_booking_time, v_total_duration, 'pending', false, p_replaces_booking_id
  ) returning id into v_booking_id;

  perform public.create_owner_notification_for_booking(
    v_booking_id,
    case when p_replaces_booking_id is null then 'appointment_booked' else 'appointment_rescheduled' end
  );

  return query select b.id, b.status, b.booking_date, b.booking_time, b.duration_minutes
  from public.bookings b where b.id = v_booking_id;
exception
  when exclusion_violation then raise exception 'TIME_SLOT_NOT_AVAILABLE';
end;
$$;

revoke all on function public.create_booking_public(uuid, jsonb, text, text, text, text, date, time, uuid) from public;
grant execute on function public.create_booking_public(uuid, jsonb, text, text, text, text, date, time, uuid) to authenticated;

-- These two authenticated customer RPCs are still called by supabase-client.js.
-- They never accept a customer id; ownership is derived from auth.uid().
create or replace function public.cancel_my_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_booking public.bookings%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select booking.* into v_booking
  from public.bookings booking
  where booking.id = p_booking_id
    and booking.customer_auth_user_id = auth.uid()
  for update;

  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  if v_booking.status not in ('pending', 'approved') then
    raise exception 'BOOKING_CANNOT_BE_CANCELLED';
  end if;

  update public.bookings
  set status = 'cancelled',
      arrival_status = '',
      updated_at = now()
  where id = v_booking.id;

  perform public.create_owner_notification_for_booking(v_booking.id, 'appointment_cancelled');
end;
$$;

create or replace function public.hide_my_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  update public.bookings
  set hidden_for_customer = true,
      updated_at = now()
  where id = p_booking_id
    and customer_auth_user_id = auth.uid()
    and status in ('cancelled', 'rejected');

  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
end;
$$;

revoke all on function public.cancel_my_booking(uuid) from public;
revoke all on function public.hide_my_booking(uuid) from public;
grant execute on function public.cancel_my_booking(uuid) to authenticated;
grant execute on function public.hide_my_booking(uuid) to authenticated;

-- Disable the obsolete Supabase email worker path without deleting historical
-- outbox rows.
drop trigger if exists booking_notification_events on public.bookings;
create trigger booking_notification_events
after update on public.bookings
for each row execute function public.handle_booking_app_notifications();

drop trigger if exists promote_waitlist_after_booking_cancel on public.bookings;
create trigger promote_waitlist_after_booking_cancel
after update of status on public.bookings
for each row execute function public.promote_waitlist_after_booking_cancel();

drop trigger if exists waitlist_notification_events on public.waitlist_entries;
create trigger waitlist_notification_events
after update on public.waitlist_entries
for each row execute function public.handle_waitlist_app_notifications();

do $$
begin
  if to_regclass('public.email_outbox') is not null then
    execute 'alter table public.email_outbox enable row level security';
    execute 'revoke all on table public.email_outbox from public, anon, authenticated';
    execute 'drop trigger if exists kick_booking_email_worker on public.email_outbox';
  end if;
  if to_regclass('public.booking_action_tokens') is not null then
    execute 'alter table public.booking_action_tokens enable row level security';
    execute 'revoke all on table public.booking_action_tokens from public, anon, authenticated';
  end if;
  if to_regclass('public.private_app_config') is not null then
    execute 'alter table public.private_app_config enable row level security';
    execute 'revoke all on table public.private_app_config from public, anon, authenticated';
  end if;
end;
$$;

do $$
declare
  v_job_id bigint;
begin
  if to_regclass('cron.job') is not null then
    select jobid into v_job_id from cron.job
    where jobname = 'booking-email-worker-every-5-minutes' limit 1;
    if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  end if;
exception when undefined_table then null;
end;
$$;

-- A full reset is deliberately server-side and owner-only. It clears the
-- single business's operational data atomically while preserving auth.users,
-- owner_profiles, the owner's password, and business.owner_email.
create or replace function public.reset_owner_business_data()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_business_id uuid;
begin
  select profile.business_id
  into v_business_id
  from public.owner_profiles profile
  where profile.id = auth.uid()
  limit 1;

  if auth.uid() is null or v_business_id is null then
    raise exception 'OWNER_AUTH_REQUIRED' using errcode = '42501';
  end if;

  -- These legacy tables may exist from the retired email worker. Their rows
  -- reference bookings, so clear only their queued/action data before bookings.
  if to_regclass('public.email_outbox') is not null then
    execute 'delete from public.email_outbox';
  end if;
  if to_regclass('public.booking_action_tokens') is not null then
    execute 'delete from public.booking_action_tokens';
  end if;

  delete from public.email_delivery_events;
  delete from public.notifications;
  delete from public.waitlist_entries;
  delete from public.bookings;
  delete from public.customers;
  delete from public.special_hours;
  delete from public.blocked_slots;
  delete from public.services;
  delete from public.working_hours;

  update public.business
  set name = 'שם העסק שלך',
      description = 'כתבי כאן תיאור קצר על העסק שלך.',
      address = 'כתובת העסק',
      phone = '',
      instagram_url = '',
      cover_image = '',
      profile_image = '',
      preparation_message = 'נא להגיע בזמן. אם צריך לבטל או לשנות תור, עדכני מראש.',
      features = jsonb_build_object(
        'businessDescription', true,
        'preparationMessage', true,
        'socialLink', true,
        'whatsapp', true,
        'phone', true,
        'waze', true,
        'calendarExport', true,
        'customerRescheduling', true,
        'waitingList', true,
        'attendanceConfirmation', true,
        'workingDaysMode', 'select_open_days',
        'themeAccent', '#b25fd1'
      ),
      updated_at = now()
  where id = v_business_id;

  if not found then
    raise exception 'OWNER_BUSINESS_NOT_FOUND';
  end if;

  insert into public.services (
    category, name, price, duration_minutes, is_active, display_order
  ) values
    ('קטגוריה ראשית', 'שירות לדוגמה 1', 150, 60, true, 0),
    ('קטגוריה ראשית', 'שירות לדוגמה 2', 220, 90, true, 1),
    ('קטגוריה נוספת', 'שירות לדוגמה 3', 80, 30, true, 2);

  insert into public.working_hours (
    day_of_week, day_label, opens_at, closes_at, slot_interval_minutes, is_closed
  ) values
    (0, 'ראשון', '09:00', '18:00', 30, false),
    (1, 'שני', '09:00', '18:00', 30, false),
    (2, 'שלישי', '09:00', '18:00', 30, false),
    (3, 'רביעי', '09:00', '18:00', 30, false),
    (4, 'חמישי', '09:00', '18:00', 30, false),
    (5, 'שישי', '09:00', '14:00', 30, false),
    (6, 'שבת', null, null, 30, true);

  return jsonb_build_object(
    'ok', true,
    'business_id', v_business_id,
    'credentials_preserved', true,
    'owner_email_preserved', true
  );
end;
$$;

revoke all on function public.reset_owner_business_data() from public, anon;
grant execute on function public.reset_owner_business_data() to authenticated;

-- Abort the transaction rather than leave a partially open installation.
do $$
declare
  v_table text;
  v_column text;
  v_signature text;
begin
  foreach v_table in array array[
    'bookings', 'customers', 'notifications', 'waitlist_entries', 'owner_profiles'
  ]
  loop
    if has_table_privilege('anon', format('public.%I', v_table), 'SELECT')
       or has_table_privilege('anon', format('public.%I', v_table), 'INSERT')
       or has_table_privilege('anon', format('public.%I', v_table), 'UPDATE')
       or has_table_privilege('anon', format('public.%I', v_table), 'DELETE') then
      raise exception 'ANON_PRIVILEGE_REMAINS_ON_%', upper(v_table);
    end if;
  end loop;

  if has_column_privilege('anon', 'public.business', 'owner_email', 'SELECT') then
    raise exception 'BUSINESS_NOTIFICATION_EMAIL_IS_PUBLIC';
  end if;

  if has_column_privilege('authenticated', 'public.business', 'owner_email', 'SELECT') then
    raise exception 'BUSINESS_NOTIFICATION_EMAIL_IS_EXPOSED_TO_CUSTOMERS';
  end if;

  if not has_column_privilege('authenticated', 'public.business', 'owner_email', 'UPDATE') then
    raise exception 'OWNER_EMAIL_CANNOT_BE_SAVED';
  end if;

  foreach v_column in array array[
    'id', 'name', 'description', 'address', 'phone', 'instagram_url', 'features',
    'cover_image', 'profile_image', 'preparation_message', 'created_at', 'updated_at'
  ]
  loop
    if not has_column_privilege('anon', 'public.business', v_column, 'SELECT')
       or not has_column_privilege('authenticated', 'public.business', v_column, 'SELECT') then
      raise exception 'REQUIRED_PUBLIC_BUSINESS_COLUMN_IS_NOT_READABLE_%', upper(v_column);
    end if;
  end loop;

  if has_function_privilege('anon', 'public.get_owner_email_context()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_owner_email_context()', 'EXECUTE') then
    raise exception 'OWNER_EMAIL_RPC_PRIVILEGES_ARE_INVALID';
  end if;

  foreach v_signature in array array[
    'public.claim_customer_account(text,text,text,text)',
    'public.get_public_special_hours()',
    'public.get_public_blocked_slots()',
    'public.get_public_booking_slots()',
    'public.get_owner_email_context()',
    'public.get_booking_email_context(uuid)',
    'public.create_booking_public(uuid,jsonb,text,text,text,text,date,time without time zone,uuid)',
    'public.cancel_my_booking(uuid)',
    'public.hide_my_booking(uuid)',
    'public.respond_attendance_confirmation(uuid,text)',
    'public.request_booking_attendance_confirmation(uuid)',
    'public.join_waitlist_public(uuid,text,date,text)',
    'public.claim_email_delivery_event(uuid,text)',
    'public.complete_email_delivery_event(text)',
    'public.release_email_delivery_event(text)',
    'public.reset_owner_business_data()'
  ]
  loop
    if to_regprocedure(v_signature) is null then
      raise exception 'REQUIRED_RPC_SIGNATURE_IS_MISSING_%', v_signature;
    end if;
  end loop;

  foreach v_signature in array array[
    'public.claim_customer_account(text,text,text,text)',
    'public.get_owner_email_context()',
    'public.get_booking_email_context(uuid)',
    'public.create_booking_public(uuid,jsonb,text,text,text,text,date,time without time zone,uuid)',
    'public.cancel_my_booking(uuid)',
    'public.hide_my_booking(uuid)',
    'public.respond_attendance_confirmation(uuid,text)',
    'public.request_booking_attendance_confirmation(uuid)',
    'public.join_waitlist_public(uuid,text,date,text)',
    'public.claim_email_delivery_event(uuid,text)',
    'public.complete_email_delivery_event(text)',
    'public.release_email_delivery_event(text)',
    'public.reset_owner_business_data()'
  ]
  loop
    if has_function_privilege('anon', v_signature, 'EXECUTE')
       or not has_function_privilege('authenticated', v_signature, 'EXECUTE') then
      raise exception 'PRIVATE_RPC_PRIVILEGES_ARE_INVALID_%', v_signature;
    end if;
  end loop;

  foreach v_signature in array array[
    'public.get_public_special_hours()',
    'public.get_public_blocked_slots()',
    'public.get_public_booking_slots()'
  ]
  loop
    if not has_function_privilege('anon', v_signature, 'EXECUTE')
       or not has_function_privilege('authenticated', v_signature, 'EXECUTE') then
      raise exception 'PUBLIC_AVAILABILITY_RPC_PRIVILEGES_ARE_INVALID_%', v_signature;
    end if;
  end loop;

  if not exists (
    select 1
    from pg_index index_definition
    join pg_class index_name on index_name.oid = index_definition.indexrelid
    join pg_namespace index_schema on index_schema.oid = index_name.relnamespace
    where index_schema.nspname = 'public'
      and index_name.relname = 'notifications_event_key_uidx'
      and index_definition.indisunique
      and index_definition.indisvalid
      and index_definition.indpred is null
      and index_definition.indnkeyatts = 1
      and exists (
        select 1
        from pg_attribute indexed_column
        where indexed_column.attrelid = index_definition.indrelid
          and indexed_column.attnum = index_definition.indkey[0]
          and indexed_column.attname = 'event_key'
      )
  ) then
    raise exception 'NOTIFICATION_EVENT_KEY_UNIQUENESS_IS_NOT_ACTIVE';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and conname = 'bookings_no_overlap'
      and contype = 'x'
  ) then
    raise exception 'BOOKING_OVERLAP_CONSTRAINT_IS_NOT_ACTIVE';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in ('bookings', 'customers', 'notifications', 'waitlist_entries', 'owner_profiles')
      and ('public' = any(roles) or 'anon' = any(roles))
  ) then
    raise exception 'ANONYMOUS_PRIVATE_DATA_POLICY_REMAINS';
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'business', 'services', 'working_hours', 'special_hours', 'blocked_slots',
        'bookings', 'customers', 'notifications', 'waitlist_entries',
        'owner_profiles', 'email_delivery_events'
      )
      and not c.relrowsecurity
  ) then
    raise exception 'RLS_IS_NOT_ENABLED_ON_ALL_APPLICATION_TABLES';
  end if;
end;
$$;

commit;
