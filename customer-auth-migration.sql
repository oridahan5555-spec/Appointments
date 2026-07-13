begin;

alter table public.customers add column if not exists email text;

update public.customers set email = null where nullif(trim(email), '') is null;

create unique index if not exists customers_email_unique_idx
on public.customers (lower(email)) where email is not null;
create index if not exists customers_auth_user_id_idx on public.customers (auth_user_id);
create index if not exists bookings_customer_auth_user_id_idx on public.bookings (customer_auth_user_id);
create index if not exists waitlist_entries_customer_auth_user_id_idx on public.waitlist_entries (customer_auth_user_id);

-- Existing customer records are linked only by the authenticated account's
-- email. Knowing a phone number alone is not proof of account ownership.
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
    if exists (select 1 from public.customers c where c.phone = v_phone and c.id <> v_customer.id) then
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
    where customer_auth_user_id is null and customer_phone = v_customer.phone;

    update public.waitlist_entries
    set customer_auth_user_id = v_auth_user_id
    where customer_auth_user_id is null and customer_phone = v_customer.phone;

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

commit;
