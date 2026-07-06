create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create table if not exists business (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  address text not null default '',
  phone text not null default '',
  instagram_url text default 'https://instagram.com',
  features jsonb not null default '{"businessDescription":true,"preparationMessage":true,"socialLink":true,"whatsapp":true,"phone":true,"waze":true,"calendarExport":true,"customerRescheduling":true,"waitingList":true,"attendanceConfirmation":true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table business
  add column if not exists features jsonb not null default '{"businessDescription":true,"preparationMessage":true,"socialLink":true,"whatsapp":true,"phone":true,"waze":true,"calendarExport":true,"customerRescheduling":true,"waitingList":true,"attendanceConfirmation":true}'::jsonb;

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  name text not null,
  price numeric(10, 2) not null check (price >= 0),
  duration_minutes integer not null check (duration_minutes > 0),
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists working_hours (
  id uuid primary key default gen_random_uuid(),
  day_of_week integer not null check (day_of_week between 0 and 6),
  day_label text not null,
  opens_at time,
  closes_at time,
  slot_interval_minutes integer not null default 30 check (slot_interval_minutes > 0),
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (day_of_week)
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services(id) on delete restrict,
  customer_first_name text not null,
  customer_last_name text not null,
  customer_phone text not null,
  notes text,
  booking_date date not null,
  booking_time time not null,
  duration_minutes integer not null check (duration_minutes > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  customer_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  slot_range tsrange generated always as (
    tsrange(
      (booking_date + booking_time)::timestamp,
      (booking_date + booking_time + make_interval(mins => duration_minutes))::timestamp,
      '[)'
    )
  ) stored
);

alter table bookings add column if not exists service_ids jsonb not null default '[]'::jsonb;
alter table bookings add column if not exists service_names jsonb not null default '[]'::jsonb;
alter table bookings add column if not exists attendance_confirmation_requested_at timestamptz;
alter table bookings add column if not exists attendance_confirmation_status text not null default '' check (attendance_confirmation_status in ('', 'pending', 'confirmed', 'declined'));
alter table bookings add column if not exists attendance_confirmation_answered_at timestamptz;

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null default '',
  last_name text not null default '',
  phone text not null unique,
  password text not null default '',
  owner_note text not null default '',
  is_blocked boolean not null default false,
  blocked_reason text not null default '',
  blocked_at timestamptz,
  no_show_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  customer_phone text not null,
  customer_name text not null default '',
  service_id uuid not null references services(id) on delete cascade,
  service_name text not null default '',
  booking_date date not null,
  notes text not null default '',
  status text not null default 'waiting' check (status in ('waiting', 'notified', 'removed')),
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists waitlist_entries_booking_date_idx on waitlist_entries (booking_date, status);
create index if not exists customers_phone_idx on customers (phone);

alter table bookings
  add constraint bookings_no_overlap
  exclude using gist (
    slot_range with &&
  )
  where (status in ('pending', 'approved'));

create index if not exists bookings_booking_date_idx on bookings (booking_date);
create index if not exists bookings_customer_phone_idx on bookings (customer_phone);
create index if not exists services_display_order_idx on services (display_order);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  created_at timestamptz not null default now(),
  is_read boolean not null default false,
  user_id text not null,
  type text not null default 'general'
);

create index if not exists notifications_user_id_created_at_idx on notifications (user_id, created_at desc);
create index if not exists notifications_user_id_is_read_idx on notifications (user_id, is_read);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_business_updated_at on business;
create trigger set_business_updated_at
before update on business
for each row
execute function set_updated_at();

drop trigger if exists set_services_updated_at on services;
create trigger set_services_updated_at
before update on services
for each row
execute function set_updated_at();

drop trigger if exists set_working_hours_updated_at on working_hours;
create trigger set_working_hours_updated_at
before update on working_hours
for each row
execute function set_updated_at();

drop trigger if exists set_bookings_updated_at on bookings;
create trigger set_bookings_updated_at
before update on bookings
for each row
execute function set_updated_at();

drop trigger if exists set_customers_updated_at on customers;
create trigger set_customers_updated_at
before update on customers
for each row
execute function set_updated_at();

alter publication supabase_realtime add table bookings;

do $$
begin
  alter publication supabase_realtime add table notifications;
exception
  when duplicate_object then null;
end;
$$;

alter table business enable row level security;
alter table services enable row level security;
alter table working_hours enable row level security;
alter table bookings enable row level security;
alter table notifications enable row level security;
alter table customers enable row level security;
alter table waitlist_entries enable row level security;

create table if not exists owner_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_id uuid not null references business(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table owner_profiles enable row level security;

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

revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to authenticated;

drop policy if exists "business public read" on business;
create policy "business public read"
on business
for select
to anon, authenticated
using (true);

drop policy if exists "business public write" on business;
drop policy if exists "business owner write" on business;
create policy "business owner write"
on business
for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

drop policy if exists "services public read" on services;
create policy "services public read"
on services
for select
to anon, authenticated
using (true);

drop policy if exists "services public write" on services;
drop policy if exists "services owner write" on services;
create policy "services owner write"
on services
for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

drop policy if exists "working_hours public read" on working_hours;
create policy "working_hours public read"
on working_hours
for select
to anon, authenticated
using (true);

drop policy if exists "working_hours public write" on working_hours;
drop policy if exists "working_hours owner write" on working_hours;
create policy "working_hours owner write"
on working_hours
for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

drop policy if exists "bookings public read" on bookings;
drop policy if exists "bookings public insert" on bookings;
drop policy if exists "bookings public update" on bookings;
drop policy if exists "bookings owner manage" on bookings;
create policy "bookings owner manage"
on bookings
for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

drop policy if exists "notifications public read" on notifications;
drop policy if exists "notifications public insert" on notifications;
drop policy if exists "notifications public update" on notifications;
drop policy if exists "notifications public delete" on notifications;
drop policy if exists "notifications owner manage" on notifications;
create policy "notifications owner manage"
on notifications
for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

drop policy if exists "customers public read" on customers;
drop policy if exists "customers public write" on customers;
drop policy if exists "customers owner manage" on customers;
create policy "customers owner manage"
on customers
for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

drop policy if exists "waitlist public read" on waitlist_entries;
drop policy if exists "waitlist public write" on waitlist_entries;
drop policy if exists "waitlist owner manage" on waitlist_entries;
create policy "waitlist owner manage"
on waitlist_entries
for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

drop policy if exists "owner_profiles owner read own" on owner_profiles;
create policy "owner_profiles owner read own"
on owner_profiles
for select
to authenticated
using (id = auth.uid());

insert into business (name, description, address, phone, instagram_url)
select
  'Yael nails',
  'מניקור, ג''ל ובנייה באווירה נקייה, רגועה ומדויקת.',
  'נחל צלמון 12',
  '058-560-9500',
  'https://instagram.com'
where not exists (select 1 from business);

insert into services (category, name, price, duration_minutes, display_order)
select * from (
  values
    ('טיפולי ידיים', 'בניה בטיפס הפוך', 230, 120, 1),
    ('טיפולי ידיים', 'לק ג''ל + מבנה אנטומי', 110, 90, 2),
    ('טיפולי ידיים', 'הסרה לק גל', 20, 20, 3),
    ('טיפולי ידיים', 'ציור', 10, 10, 4),
    ('טיפולי ידיים', 'פרנץ', 10, 10, 5),
    ('טיפולי ידיים', 'השלמה', 10, 30, 6)
) as seed(category, name, price, duration_minutes, display_order)
where not exists (select 1 from services);

insert into working_hours (day_of_week, day_label, opens_at, closes_at, slot_interval_minutes, is_closed)
select * from (
  values
    (0, 'ראשון', '17:00'::time, '20:00'::time, 30, false),
    (1, 'שני', '15:40'::time, '20:00'::time, 20, false),
    (2, 'שלישי', '15:00'::time, '20:00'::time, 30, false),
    (3, 'רביעי', null::time, null::time, 30, true),
    (4, 'חמישי', '15:30'::time, '20:00'::time, 30, false),
    (5, 'שישי', null::time, null::time, 30, true),
    (6, 'שבת', null::time, null::time, 30, true)
) as seed(day_of_week, day_label, opens_at, closes_at, slot_interval_minutes, is_closed)
where not exists (select 1 from working_hours);
