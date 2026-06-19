-- P1.4 reservations depth: email + confirmation/reminder fields + public online
-- booking. email/source/confirm_token/reminded_at on reservations; an anon RPC to
-- read the public booking business + submit a booking (only when enabled).
alter table public.reservations
  add column if not exists email text,
  add column if not exists source text not null default 'staff',
  add column if not exists confirm_token uuid not null default gen_random_uuid(),
  add column if not exists reminded_at timestamptz;

create or replace function public.get_public_booking_business(p_business_id uuid)
returns table (id uuid, name text, enabled boolean, timezone text)
language sql stable security definer set search_path to 'public' as $$
  select b.id, b.name,
    coalesce((b.settings->>'online_booking_enabled')::boolean, false) as enabled,
    coalesce(b.timezone, 'America/Toronto') as timezone
  from public.businesses b
  where b.id = p_business_id and b.industry = 'restaurant';
$$;
grant execute on function public.get_public_booking_business(uuid) to anon, authenticated;

create or replace function public.submit_online_reservation(
  p_business_id uuid, p_name text, p_email text, p_phone text,
  p_party integer, p_scheduled_at timestamptz, p_notes text
) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid; v_enabled boolean;
begin
  select coalesce((settings->>'online_booking_enabled')::boolean, false) into v_enabled
    from public.businesses where id = p_business_id and industry = 'restaurant';
  if not coalesce(v_enabled, false) then
    raise exception 'online booking not enabled';
  end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'name required'; end if;
  insert into public.reservations (business_id, guest_name, email, phone, party_size, scheduled_at, status, source, notes)
  values (p_business_id, left(trim(p_name), 120),
          nullif(left(trim(coalesce(p_email, '')), 120), ''),
          nullif(left(trim(coalesce(p_phone, '')), 40), ''),
          greatest(1, least(99, coalesce(p_party, 2))), p_scheduled_at, 'booked', 'online',
          nullif(left(trim(coalesce(p_notes, '')), 500), ''))
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.submit_online_reservation(uuid, text, text, text, integer, timestamptz, text) to anon, authenticated;
