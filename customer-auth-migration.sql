begin;

alter table public.customers
  add column if not exists email text;

update public.customers
set email = null
where nullif(trim(email), '') is null;

create unique index if not exists customers_email_unique_idx
on public.customers (lower(email))
where email is not null;

create index if not exists customers_auth_user_id_idx
on public.customers (auth_user_id);

create index if not exists bookings_customer_auth_user_id_idx
on public.bookings (customer_auth_user_id);

create index if not exists waitlist_entries_customer_auth_user_id_idx
on public.waitlist_entries (customer_auth_user_id);

create or replace function public.claim_customer_account(
  p_first_name text default '',
  p_last_name text default '',
  p_phone text default '',
  p_email text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_auth_user_id uuid;
  v_phone text;
  v_email text;
  v_first_name text;
  v_last_name text;
  v_customer_id uuid;
begin
  v_auth_user_id := auth.uid();
  if v_auth_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  v_phone := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), '');
  v_email := lower(nullif(trim(coalesce(p_email, auth.jwt() ->> 'email', '')), ''));
  v_first_name := trim(coalesce(p_first_name, coalesce(auth.jwt() -> 'user_metadata' ->> 'first_name', '')));
  v_last_name := trim(coalesce(p_last_name, coalesce(auth.jwt() -> 'user_metadata' ->> 'last_name', '')));

  if v_phone is null and v_email is null then
    raise exception 'PHONE_OR_EMAIL_REQUIRED';
  end if;

  select c.id
  into v_customer_id
  from public.customers c
  where c.auth_user_id = v_auth_user_id
     or (v_phone is not null and c.phone = v_phone)
     or (v_email is not null and lower(coalesce(c.email, '')) = v_email)
  order by
    case when c.auth_user_id = v_auth_user_id then 0 else 1 end,
    case when v_phone is not null and c.phone = v_phone then 0 else 1 end,
    case when v_email is not null and lower(coalesce(c.email, '')) = v_email then 0 else 1 end
  limit 1;

  if v_customer_id is not null then
    if exists (
      select 1
      from public.customers c
      where c.id = v_customer_id
        and c.auth_user_id is not null
        and c.auth_user_id <> v_auth_user_id
    ) then
      raise exception 'CUSTOMER_ALREADY_LINKED';
    end if;

    update public.customers
    set
      auth_user_id = v_auth_user_id,
      first_name = coalesce(nullif(v_first_name, ''), first_name),
      last_name = coalesce(nullif(v_last_name, ''), last_name),
      phone = coalesce(v_phone, phone),
      email = coalesce(v_email, email)
    where id = v_customer_id;
  else
    if v_phone is null then
      raise exception 'PHONE_REQUIRED_TO_CREATE_CUSTOMER';
    end if;

    insert into public.customers (
      auth_user_id,
      first_name,
      last_name,
      phone,
      email
    )
    values (
      v_auth_user_id,
      coalesce(v_first_name, ''),
      coalesce(v_last_name, ''),
      coalesce(v_phone, ''),
      v_email
    )
    returning id into v_customer_id;
  end if;

  if v_phone is not null then
    update public.bookings
    set
      customer_auth_user_id = v_auth_user_id,
      customer_first_name = coalesce(nullif(v_first_name, ''), customer_first_name),
      customer_last_name = coalesce(nullif(v_last_name, ''), customer_last_name),
      customer_phone = v_phone
    where customer_phone = v_phone
      and (customer_auth_user_id is null or customer_auth_user_id = v_auth_user_id);

    update public.waitlist_entries
    set
      customer_auth_user_id = v_auth_user_id,
      customer_phone = v_phone,
      customer_name = trim(concat(coalesce(nullif(v_first_name, ''), ''), ' ', coalesce(nullif(v_last_name, ''), '')))
    where customer_phone = v_phone
      and (customer_auth_user_id is null or customer_auth_user_id = v_auth_user_id);

    update public.notifications
    set user_id = v_auth_user_id::text
    where user_id = v_phone;
  end if;

  return v_customer_id;
end;
$$;

revoke all on function public.claim_customer_account(text, text, text, text) from public;
grant execute on function public.claim_customer_account(text, text, text, text) to authenticated;

commit;
