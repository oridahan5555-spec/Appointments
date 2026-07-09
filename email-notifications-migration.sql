begin;

create extension if not exists pgcrypto;
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Worker secret note:
-- Set the same value in the Edge Function secret WORKER_SECRET and in the
-- private_app_config row below so cron/trigger calls can send the
-- x-worker-secret header without exposing it to the browser.
-- Replace PASTE_WORKER_SECRET_HERE before running this migration.

create table if not exists public.private_app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.private_app_config enable row level security;
revoke all on public.private_app_config from public, anon, authenticated;

insert into public.private_app_config (key, value, updated_at)
values ('worker_secret', 'PASTE_WORKER_SECRET_HERE', now())
on conflict (key) do update set
  value = excluded.value,
  updated_at = now();

alter table public.customers
  add column if not exists email text;

alter table public.notifications
  add column if not exists booking_id uuid references public.bookings(id) on delete cascade,
  add column if not exists action_url text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists event_key text;

create index if not exists notifications_booking_id_idx
on public.notifications (booking_id);

create unique index if not exists notifications_event_key_uidx
on public.notifications (event_key);

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null,
  recipient_type text not null check (recipient_type in ('customer', 'owner')),
  recipient_user_id uuid references auth.users(id) on delete set null,
  recipient_email text,
  booking_id uuid references public.bookings(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed', 'skipped')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  last_error text,
  email_subject text,
  rendered_html text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.email_outbox
  add column if not exists email_subject text,
  add column if not exists rendered_html text;

create index if not exists email_outbox_pending_idx
on public.email_outbox (status, next_attempt_at, created_at);

create index if not exists email_outbox_booking_idx
on public.email_outbox (booking_id, event_type);

create table if not exists public.booking_action_tokens (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid not null references public.email_outbox(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  action text not null check (action in ('confirm', 'cancel', 'view', 'ics')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  single_use boolean not null default true,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  unique (outbox_id, action)
);

create index if not exists booking_action_tokens_lookup_idx
on public.booking_action_tokens (token_hash, action, expires_at);

alter table public.email_outbox enable row level security;
alter table public.booking_action_tokens enable row level security;

revoke all on public.email_outbox from public, anon, authenticated;
revoke all on public.booking_action_tokens from public, anon, authenticated;

drop policy if exists "email outbox owner read" on public.email_outbox;

create or replace function public.booking_email_payload(p_booking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_business public.business%rowtype;
  v_customer_email text;
  v_service_label text;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  select * into v_business from public.business order by created_at limit 1;
  select c.email into v_customer_email
  from public.customers c
  where c.auth_user_id = v_booking.customer_auth_user_id
  limit 1;

  select coalesce(
    nullif(array_to_string(array(select jsonb_array_elements_text(coalesce(v_booking.service_names, '[]'::jsonb))), ' + '), ''),
    (select s.name from public.services s where s.id = v_booking.service_id),
    'שירות'
  ) into v_service_label;

  return jsonb_build_object(
    'booking_id', v_booking.id,
    'status', v_booking.status,
    'service_name', v_service_label,
    'booking_date', v_booking.booking_date,
    'booking_time', to_char(v_booking.booking_time, 'HH24:MI'),
    'duration_minutes', v_booking.duration_minutes,
    'customer_name', trim(concat(v_booking.customer_first_name, ' ', v_booking.customer_last_name)),
    'customer_email', v_customer_email,
    'customer_phone', v_booking.customer_phone,
    'customer_auth_user_id', v_booking.customer_auth_user_id,
    'business_name', coalesce(v_business.name, 'העסק'),
    'business_address', coalesce(v_business.address, ''),
    'business_phone', coalesce(v_business.phone, ''),
    'attendance_status', v_booking.attendance_confirmation_status
  );
end;
$$;

revoke all on function public.booking_email_payload(uuid) from public, anon, authenticated;

create or replace function public.enqueue_email_event(
  p_event_key text,
  p_event_type text,
  p_recipient_type text,
  p_recipient_user_id uuid,
  p_recipient_email text,
  p_booking_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.email_outbox (
    event_key, event_type, recipient_type, recipient_user_id,
    recipient_email, booking_id, payload
  ) values (
    p_event_key, p_event_type, p_recipient_type, p_recipient_user_id,
    nullif(trim(coalesce(p_recipient_email, '')), ''), p_booking_id, coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (event_key) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.email_outbox where event_key = p_event_key;
  end if;
  return v_id;
end;
$$;

revoke all on function public.enqueue_email_event(text, text, text, uuid, text, uuid, jsonb) from public, anon, authenticated;

create or replace function public.create_customer_booking_notification(
  p_booking_id uuid,
  p_event_type text,
  p_title text,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_booking_status text;
  v_id uuid;
  v_event_key text;
begin
  select customer_auth_user_id, status into v_user_id, v_booking_status
  from public.bookings where id = p_booking_id;
  if v_user_id is null then return null; end if;

  v_event_key := format('customer:%s:%s', p_booking_id, p_event_type);
  insert into public.notifications (
    title, message, user_id, type, booking_id, action_url, metadata, event_key
  ) values (
    p_title, p_message, v_user_id::text, p_event_type, p_booking_id,
    format('index.html?booking=%s', p_booking_id),
    jsonb_build_object('booking_id', p_booking_id, 'booking_status', v_booking_status, 'audience', 'customer'),
    v_event_key
  )
  on conflict (event_key) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.notifications where event_key = v_event_key;
  end if;
  return v_id;
end;
$$;

revoke all on function public.create_customer_booking_notification(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.create_owner_notification_for_booking(
  p_booking_id uuid,
  p_event_type text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_owner_id uuid;
  v_notification_id uuid;
  v_service_label text;
  v_customer_name text;
  v_event_key text;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  select id into v_owner_id from public.owner_profiles limit 1;
  if v_owner_id is null then return null; end if;

  select coalesce(
    nullif(array_to_string(array(select jsonb_array_elements_text(coalesce(v_booking.service_names, '[]'::jsonb))), ' + '), ''),
    'שירות'
  ) into v_service_label;
  v_customer_name := coalesce(nullif(trim(concat(v_booking.customer_first_name, ' ', v_booking.customer_last_name)), ''), 'לקוחה');
  v_event_key := format('owner:%s:%s', p_booking_id, p_event_type);

  insert into public.notifications (
    title, message, user_id, type, booking_id, action_url, metadata, event_key
  ) values (
    case
      when p_event_type = 'appointment_rejected' then 'תור נדחה'
      when p_event_type = 'appointment_rescheduled' then 'בקשת שינוי תור'
      when p_event_type = 'appointment_cancelled' then 'תור בוטל'
      when p_event_type = 'attendance_confirmed' then 'הלקוחה אישרה הגעה'
      when p_event_type = 'attendance_declined' then 'הלקוחה לא תגיע'
      else 'נקבע תור חדש'
    end,
    format('%s - %s, %s בשעה %s.', v_customer_name, v_service_label, v_booking.booking_date, to_char(v_booking.booking_time, 'HH24:MI')),
    v_owner_id::text,
    p_event_type,
    p_booking_id,
    format('owner.html?booking=%s', p_booking_id),
    jsonb_build_object(
      'booking_id', p_booking_id,
      'booking_status', v_booking.status,
      'booking_date', v_booking.booking_date,
      'booking_time', to_char(v_booking.booking_time, 'HH24:MI'),
      'audience', 'owner'
    ),
    v_event_key
  )
  on conflict (event_key) do nothing
  returning id into v_notification_id;

  if v_notification_id is null then
    select id into v_notification_id from public.notifications where event_key = v_event_key;
  end if;
  return v_notification_id;
end;
$$;

revoke all on function public.create_owner_notification_for_booking(uuid, text) from public, anon, authenticated;

create or replace function public.enqueue_customer_booking_event(
  p_booking_id uuid,
  p_event_type text,
  p_title text,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
begin
  v_payload := public.booking_email_payload(p_booking_id);
  perform public.create_customer_booking_notification(p_booking_id, p_event_type, p_title, p_message);
  perform public.enqueue_email_event(
    format('customer:%s:%s', p_booking_id, p_event_type),
    p_event_type,
    'customer',
    (v_payload->>'customer_auth_user_id')::uuid,
    v_payload->>'customer_email',
    p_booking_id,
    v_payload
  );
end;
$$;

revoke all on function public.enqueue_customer_booking_event(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.enqueue_owner_booking_event(
  p_booking_id uuid,
  p_event_type text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
  v_owner_id uuid;
begin
  v_payload := public.booking_email_payload(p_booking_id);
  select id into v_owner_id from public.owner_profiles limit 1;
  perform public.create_owner_notification_for_booking(p_booking_id, p_event_type);
  perform public.enqueue_email_event(
    format('owner:%s:%s', p_booking_id, p_event_type),
    'owner_' || p_event_type,
    'owner',
    v_owner_id,
    null,
    p_booking_id,
    v_payload
  );
end;
$$;

revoke all on function public.enqueue_owner_booking_event(uuid, text) from public, anon, authenticated;

create or replace function public.handle_booking_notification_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service text;
  v_date_text text;
  v_change_key text;
begin
  v_service := coalesce(public.booking_email_payload(new.id)->>'service_name', 'שירות');
  v_date_text := format('%s בשעה %s', new.booking_date, to_char(new.booking_time, 'HH24:MI'));

  if tg_op = 'INSERT' then
    perform public.enqueue_customer_booking_event(
      new.id, 'booking_created', 'התור התקבל',
      format('בקשת התור ל%s בתאריך %s התקבלה וממתינה לאישור.', v_service, v_date_text)
    );
    perform public.enqueue_owner_booking_event(
      new.id,
      case when new.replaces_booking_id is null then 'appointment_booked' else 'appointment_rescheduled' end
    );
    return new;
  end if;

  if old.status is distinct from new.status then
    if new.status = 'approved' then
      perform public.enqueue_customer_booking_event(new.id, 'booking_approved', 'התור אושר', format('התור ל%s בתאריך %s אושר.', v_service, v_date_text));
    elsif new.status = 'rejected' then
      perform public.enqueue_customer_booking_event(new.id, 'booking_rejected', 'התור נדחה', format('התור ל%s בתאריך %s נדחה.', v_service, v_date_text));
    elsif new.status = 'cancelled' then
      perform public.enqueue_customer_booking_event(new.id, 'booking_cancelled', 'ביטול התור נקלט', format('התור ל%s בתאריך %s בוטל.', v_service, v_date_text));
      if auth.uid() = new.customer_auth_user_id then
        perform public.enqueue_owner_booking_event(new.id, 'appointment_cancelled');
      end if;
    end if;
  end if;

  if old.booking_date is distinct from new.booking_date
     or old.booking_time is distinct from new.booking_time
     or old.duration_minutes is distinct from new.duration_minutes
     or old.service_names is distinct from new.service_names then
    v_change_key := 'booking_changed_' || md5(concat(new.booking_date, '|', new.booking_time, '|', new.duration_minutes, '|', new.service_names::text, '|', new.updated_at));
    perform public.enqueue_customer_booking_event(new.id, v_change_key, 'פרטי התור השתנו', format('התור ל%s עודכן לתאריך %s.', v_service, v_date_text));
  end if;

  if old.attendance_confirmation_status is distinct from new.attendance_confirmation_status
     and new.attendance_confirmation_status in ('confirmed', 'declined') then
    perform public.enqueue_owner_booking_event(
      new.id,
      case when new.attendance_confirmation_status = 'confirmed' then 'attendance_confirmed' else 'attendance_declined' end
    );
  end if;

  return new;
end;
$$;

revoke all on function public.handle_booking_notification_events() from public, anon, authenticated;

drop trigger if exists booking_notification_events on public.bookings;
create trigger booking_notification_events
after insert or update on public.bookings
for each row execute function public.handle_booking_notification_events();

create or replace function public.handle_waitlist_notification_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_business public.business%rowtype;
begin
  if tg_op = 'INSERT' then
    select id into v_owner_id from public.owner_profiles limit 1;
    select * into v_business from public.business order by created_at limit 1;
    if v_owner_id is null then return new; end if;
    insert into public.notifications (title, message, user_id, type, metadata, event_key)
    values (
      'הצטרפות לרשימת המתנה',
      format('%s הצטרף/ה לרשימת המתנה ל%s בתאריך %s.', new.customer_name, new.service_name, new.booking_date),
      v_owner_id::text,
      'waitlist_joined',
      jsonb_build_object('waitlist_id', new.id, 'booking_date', new.booking_date),
      format('owner:waitlist:%s:joined', new.id)
    ) on conflict (event_key) do nothing;

    perform public.enqueue_email_event(
      format('owner:waitlist:%s:joined', new.id),
      'owner_waitlist_joined', 'owner', v_owner_id, null, null,
      jsonb_build_object(
        'customer_name', new.customer_name,
        'service_name', new.service_name,
        'booking_date', new.booking_date,
        'customer_phone', new.customer_phone,
        'business_name', coalesce(v_business.name, 'העסק')
      )
    );
  elsif tg_op = 'UPDATE'
        and old.status is distinct from new.status
        and new.status = 'notified'
        and new.customer_auth_user_id is not null then
    insert into public.notifications (title, message, user_id, type, metadata, event_key)
    values (
      'התפנה מקום לתור',
      format('התפנה מקום ל%s בתאריך %s. אפשר להיכנס לאתר ולקבוע.', new.service_name, new.booking_date),
      new.customer_auth_user_id::text,
      'waitlist_opened',
      jsonb_build_object('waitlist_id', new.id, 'booking_date', new.booking_date, 'audience', 'customer'),
      format('customer:waitlist:%s:opened', new.id)
    ) on conflict (event_key) do nothing;

    select * into v_business from public.business order by created_at limit 1;
    perform public.enqueue_email_event(
      format('customer:waitlist:%s:opened', new.id),
      'waitlist_opened', 'customer', new.customer_auth_user_id, null, null,
      jsonb_build_object(
        'customer_name', new.customer_name,
        'service_name', new.service_name,
        'booking_date', new.booking_date,
        'business_name', coalesce(v_business.name, 'העסק'),
        'business_address', coalesce(v_business.address, ''),
        'business_phone', coalesce(v_business.phone, '')
      )
    );
  end if;
  return new;
end;
$$;

revoke all on function public.handle_waitlist_notification_events() from public, anon, authenticated;

drop trigger if exists waitlist_notification_events on public.waitlist_entries;
create trigger waitlist_notification_events
after insert or update of status on public.waitlist_entries
for each row execute function public.handle_waitlist_notification_events();

create or replace function public.enqueue_due_booking_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking record;
  v_count integer := 0;
  v_start_at timestamptz;
begin
  for v_booking in
    select b.*
    from public.bookings b
    where b.status in ('pending', 'approved')
      and b.created_at <= ((b.booking_date + b.booking_time) at time zone 'Asia/Jerusalem') - interval '24 hours'
      and ((b.booking_date + b.booking_time) at time zone 'Asia/Jerusalem') > now() + interval '1 hour'
      and ((b.booking_date + b.booking_time) at time zone 'Asia/Jerusalem') <= now() + interval '24 hours'
  loop
    v_start_at := (v_booking.booking_date + v_booking.booking_time) at time zone 'Asia/Jerusalem';
    if not exists (
      select 1 from public.email_outbox
      where event_key = format('customer:%s:reminder:%s', v_booking.id, v_booking.booking_date)
    ) then
      perform public.enqueue_customer_booking_event(
        v_booking.id,
        'reminder:' || v_booking.booking_date::text,
        'תזכורת לתור מחר',
        format('מחר בשעה %s יש לך תור.', to_char(v_booking.booking_time, 'HH24:MI'))
      );
      update public.bookings
      set
        attendance_confirmation_requested_at = coalesce(attendance_confirmation_requested_at, now()),
        attendance_confirmation_status = case
          when attendance_confirmation_status = '' then 'pending'
          else attendance_confirmation_status
        end,
        updated_at = now()
      where id = v_booking.id;
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.enqueue_due_booking_reminders() from public, anon, authenticated;
grant execute on function public.enqueue_due_booking_reminders() to service_role;

create or replace function public.request_booking_attendance_confirmation(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
begin
  if not public.is_owner() then raise exception 'OWNER_REQUIRED'; end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or v_booking.status <> 'approved' then
    raise exception 'BOOKING_NOT_AVAILABLE';
  end if;

  perform public.enqueue_customer_booking_event(
    v_booking.id,
    'reminder:' || v_booking.booking_date::text,
    'בקשת אישור הגעה',
    format('נשמח לדעת אם תגיעי לתור בתאריך %s בשעה %s.', v_booking.booking_date, to_char(v_booking.booking_time, 'HH24:MI'))
  );

  update public.bookings
  set
    attendance_confirmation_requested_at = coalesce(attendance_confirmation_requested_at, now()),
    attendance_confirmation_status = case when attendance_confirmation_status = '' then 'pending' else attendance_confirmation_status end,
    updated_at = now()
  where id = v_booking.id;
end;
$$;

revoke all on function public.request_booking_attendance_confirmation(uuid) from public, anon, authenticated;
grant execute on function public.request_booking_attendance_confirmation(uuid) to authenticated;

create or replace function public.claim_email_outbox(p_limit integer default 20)
returns setof public.email_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.email_outbox
  set status = 'queued', locked_at = null
  where status = 'sending' and locked_at < now() - interval '15 minutes';

  return query
  update public.email_outbox o
  set
    status = 'sending',
    locked_at = now(),
    attempt_count = o.attempt_count + 1,
    updated_at = now()
  where o.id in (
    select id from public.email_outbox
    where status in ('queued', 'failed')
      and next_attempt_at <= now()
      and attempt_count < 6
    order by created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 50))
  )
  returning o.*;
end;
$$;

revoke all on function public.claim_email_outbox(integer) from public, anon, authenticated;
grant execute on function public.claim_email_outbox(integer) to service_role;

create or replace function public.get_worker_secret()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select value from public.private_app_config where key = 'worker_secret'),
    ''
  );
$$;

revoke all on function public.get_worker_secret() from public, anon, authenticated;

create or replace function public.perform_booking_email_action(
  p_token_hash text,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.booking_action_tokens%rowtype;
  v_booking public.bookings%rowtype;
  v_payload jsonb;
begin
  select * into v_token
  from public.booking_action_tokens
  where token_hash = p_token_hash and action = p_action
  for update;

  if not found or v_token.expires_at <= now() then
    raise exception 'ACTION_LINK_INVALID_OR_EXPIRED';
  end if;
  if v_token.single_use and v_token.used_at is not null then
    raise exception 'ACTION_ALREADY_USED';
  end if;

  select * into v_booking from public.bookings where id = v_token.booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;

  if p_action = 'confirm' then
    if v_booking.status not in ('pending', 'approved')
       or v_booking.attendance_confirmation_status = 'confirmed'
       or now() >= ((v_booking.booking_date + v_booking.booking_time) at time zone 'Asia/Jerusalem') then
      raise exception 'ACTION_NOT_ALLOWED';
    end if;
    update public.bookings set
      customer_confirmed = true,
      attendance_confirmation_status = 'confirmed',
      attendance_confirmation_answered_at = now(),
      updated_at = now()
    where id = v_booking.id;
  elsif p_action = 'cancel' then
    if v_booking.status not in ('pending', 'approved')
       or now() >= ((v_booking.booking_date + v_booking.booking_time) at time zone 'Asia/Jerusalem') then
      raise exception 'ACTION_NOT_ALLOWED';
    end if;
    update public.bookings set status = 'cancelled', arrival_status = '', updated_at = now()
    where id = v_booking.id;
    perform public.enqueue_owner_booking_event(v_booking.id, 'appointment_cancelled');
  elsif p_action not in ('view', 'ics') then
    raise exception 'INVALID_ACTION';
  end if;

  if v_token.single_use then
    update public.booking_action_tokens set used_at = now() where id = v_token.id;
  end if;

  v_payload := public.booking_email_payload(v_booking.id);
  return v_payload || jsonb_build_object('action', p_action, 'action_completed', p_action in ('confirm', 'cancel'));
end;
$$;

revoke all on function public.perform_booking_email_action(text, text) from public, anon, authenticated;
grant execute on function public.perform_booking_email_action(text, text) to service_role;

create or replace function public.kick_booking_email_worker()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://xlbajykvieqauhzysriu.supabase.co/functions/v1/send-booking-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-secret', public.get_worker_secret()
    ),
    body := jsonb_build_object('source', 'outbox-trigger')
  );
  return null;
end;
$$;

revoke all on function public.kick_booking_email_worker() from public, anon, authenticated;

drop trigger if exists kick_booking_email_worker on public.email_outbox;
create trigger kick_booking_email_worker
after insert on public.email_outbox
for each statement execute function public.kick_booking_email_worker();

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'booking-email-worker-every-5-minutes' limit 1;
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule(
    'booking-email-worker-every-5-minutes',
    '*/5 * * * *',
    $cron$
      select net.http_post(
        url := 'https://xlbajykvieqauhzysriu.supabase.co/functions/v1/send-booking-emails',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-worker-secret', public.get_worker_secret()
        ),
        body := jsonb_build_object('source', 'cron')
      );
    $cron$
  );
end;
$$;

commit;
