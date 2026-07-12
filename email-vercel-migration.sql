  -- Vercel is the only active email sender in this MVP.
  -- This keeps email_outbox data intact and disables the old Supabase worker path.

  alter table if exists public.bookings
    add column if not exists customer_email text;

  create or replace function public.set_booking_customer_email()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
  as $$
  begin
    if nullif(trim(coalesce(new.customer_email, '')), '') is null then
      select c.email
      into new.customer_email
      from public.customers c
      where c.auth_user_id = new.customer_auth_user_id
        and nullif(trim(coalesce(c.email, '')), '') is not null
      limit 1;
    end if;
    return new;
  end;
  $$;

  revoke all on function public.set_booking_customer_email() from public, anon, authenticated;

  drop trigger if exists set_booking_customer_email on public.bookings;
  create trigger set_booking_customer_email
  before insert or update of customer_auth_user_id, customer_email on public.bookings
  for each row execute function public.set_booking_customer_email();

  update public.bookings b
  set customer_email = c.email
  from public.customers c
  where b.customer_auth_user_id = c.auth_user_id
    and nullif(trim(coalesce(b.customer_email, '')), '') is null
    and nullif(trim(coalesce(c.email, '')), '') is not null;

  do $$
  begin
    if to_regclass('public.email_outbox') is not null then
      execute 'drop trigger if exists kick_booking_email_worker on public.email_outbox';
    end if;
  end;
  $$;

  do $$
  declare
    v_job_id bigint;
  begin
    select jobid into v_job_id
    from cron.job
    where jobname = 'booking-email-worker-every-5-minutes'
    limit 1;

    if v_job_id is not null then
      perform cron.unschedule(v_job_id);
    end if;
  exception
    when undefined_table then
      null;
  end;
  $$;
