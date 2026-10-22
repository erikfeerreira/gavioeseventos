-- Role helpers: only answer about the caller, require active account
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select _user_id = auth.uid() and exists (
    select 1 from public.user_roles ur join public.profiles p on p.id = ur.user_id
    where ur.user_id = _user_id and ur.role = _role and p.active)
$$;
create or replace function public.is_team(_user_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select _user_id = auth.uid() and exists (
    select 1 from public.user_roles ur join public.profiles p on p.id = ur.user_id
    where ur.user_id = _user_id and p.active)
$$;
create or replace function public.is_manager(_user_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select _user_id = auth.uid() and exists (
    select 1 from public.user_roles ur join public.profiles p on p.id = ur.user_id
    where ur.user_id = _user_id and p.active and ur.role in ('admin','staff'))
$$;

-- Audit log (append only)
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid,
  action text not null,
  target text,
  details jsonb not null default '{}'::jsonb
);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "admins read audit" on public.audit_log for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create or replace function public.write_audit(_action text, _target text, _details jsonb)
returns void language sql security definer set search_path to 'public' as $$
  insert into public.audit_log (actor_id, action, target, details)
  values (auth.uid(), _action, _target, coalesce(_details,'{}'::jsonb))
$$;
revoke execute on function public.write_audit(text,text,jsonb) from public, anon, authenticated;

-- Export logging callable by managers
create or replace function public.log_export(_kind text, _rows int)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_manager(auth.uid()) then raise exception 'FORBIDDEN'; end if;
  perform public.write_audit('export', left(_kind, 60), jsonb_build_object('rows', _rows));
end $$;
revoke execute on function public.log_export(text,int) from public, anon;
grant execute on function public.log_export(text,int) to authenticated;

-- Staff invites
create table public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  role app_role not null,
  status text not null default 'pending',
  expires_at timestamptz not null default now() + interval '24 hours',
  invited_by uuid not null default auth.uid(),
  send_count int not null default 1,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  constraint staff_invites_status_chk check (status in ('pending','accepted','revoked'))
);
create unique index staff_invites_one_pending on public.staff_invites (lower(email)) where status = 'pending';
grant select, insert, update on public.staff_invites to authenticated;
grant all on public.staff_invites to service_role;
alter table public.staff_invites enable row level security;
create policy "admins read invites" on public.staff_invites for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admins create invites" on public.staff_invites for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admins update invites" on public.staff_invites for update to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.staff_invites_guard()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'INSERT' then
    new.email := lower(trim(new.email));
    if new.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(new.email) > 254 then raise exception 'INVALID_EMAIL'; end if;
    new.name := left(trim(coalesce(new.name,'')), 120);
    new.status := 'pending'; new.send_count := 1; new.accepted_at := null; new.revoked_at := null;
    new.invited_by := coalesce(auth.uid(), new.invited_by);
    new.created_at := now();
    if new.expires_at is null or new.expires_at > now() + interval '7 days' or new.expires_at <= now() then
      new.expires_at := now() + interval '24 hours';
    end if;
    if (select count(*) from public.staff_invites where invited_by = new.invited_by and created_at > now() - interval '1 hour') >= 20 then
      raise exception 'RATE_LIMIT';
    end if;
    perform public.write_audit('invite_created', new.email, jsonb_build_object('role', new.role));
  else
    -- recipient and permissions are immutable
    if new.email <> old.email or new.role <> old.role or new.invited_by <> old.invited_by or new.created_at <> old.created_at then
      raise exception 'IMMUTABLE_FIELDS';
    end if;
    if old.status <> 'pending' and new.status is distinct from old.status then raise exception 'INVITE_CLOSED'; end if;
    if new.status = 'revoked' and old.status = 'pending' then
      new.revoked_at := now();
      perform public.write_audit('invite_revoked', old.email, '{}'::jsonb);
    elsif new.status = 'accepted' and auth.uid() is not null then
      raise exception 'FORBIDDEN';
    elsif new.send_count <> old.send_count then
      if new.send_count <> old.send_count + 1 or old.send_count >= 5 then raise exception 'RATE_LIMIT'; end if;
      new.expires_at := now() + interval '24 hours';
      perform public.write_audit('invite_resent', old.email, '{}'::jsonb);
    end if;
  end if;
  return new;
end $$;
create trigger staff_invites_guard before insert or update on public.staff_invites
  for each row execute function public.staff_invites_guard();

-- Signup: profile only, no automatic admin
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''), new.email)
  on conflict (id) do nothing;
  return new;
end $$;

-- Grant role from a valid invite when the recipient confirms their email
create or replace function public.handle_user_confirmed()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare inv public.staff_invites;
begin
  select * into inv from public.staff_invites
   where lower(email) = lower(new.email) and status = 'pending' and expires_at > now()
   order by created_at desc limit 1;
  if found then
    insert into public.user_roles (user_id, role) values (new.id, inv.role) on conflict do nothing;
    update public.staff_invites set status = 'accepted', accepted_at = now() where id = inv.id;
    if coalesce(inv.name,'') <> '' then
      update public.profiles set name = inv.name where id = new.id and coalesce(name,'') = '';
    end if;
    insert into public.audit_log (actor_id, action, target, details)
    values (new.id, 'invite_accepted', new.email, jsonb_build_object('role', inv.role));
  end if;
  return new;
end $$;
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users
  for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_user_confirmed();

-- Protect against admin lockout + audit role/active changes
create or replace function public.user_roles_guard()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'DELETE' then
    if old.role = 'admin' and not exists (
      select 1 from public.user_roles ur join public.profiles p on p.id = ur.user_id
      where ur.role = 'admin' and p.active and ur.user_id <> old.user_id) then
      raise exception 'LAST_ADMIN';
    end if;
    if old.user_id = auth.uid() and old.role = 'admin' then raise exception 'SELF_DEMOTE'; end if;
    perform public.write_audit('role_removed', old.user_id::text, jsonb_build_object('role', old.role));
    return old;
  end if;
  perform public.write_audit('role_added', new.user_id::text, jsonb_build_object('role', new.role));
  return new;
end $$;
create trigger user_roles_guard before insert or delete on public.user_roles
  for each row execute function public.user_roles_guard();

create or replace function public.profiles_guard()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.id <> old.id or new.email is distinct from old.email or new.created_at <> old.created_at then
    raise exception 'IMMUTABLE_FIELDS';
  end if;
  if old.active and not new.active then
    if new.id = auth.uid() then raise exception 'SELF_DEACTIVATE'; end if;
    if exists (select 1 from public.user_roles where user_id = new.id and role = 'admin') and not exists (
      select 1 from public.user_roles ur join public.profiles p on p.id = ur.user_id
      where ur.role = 'admin' and p.active and ur.user_id <> new.id) then
      raise exception 'LAST_ADMIN';
    end if;
  end if;
  if new.active is distinct from old.active then
    perform public.write_audit(case when new.active then 'account_activated' else 'account_deactivated' end, new.id::text, '{}'::jsonb);
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- Audit registration status changes (check-in etc.)
create or replace function public.registrations_audit()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.registration_status is distinct from old.registration_status then
    perform public.write_audit('registration_status', new.registration_code,
      jsonb_build_object('from', old.registration_status, 'to', new.registration_status));
  end if;
  return new;
end $$;
create trigger registrations_audit after update on public.registrations
  for each row execute function public.registrations_audit();

-- Rate limiting for public functions (per client IP)
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key, window_start)
);
grant all on public.rate_limits to service_role;
alter table public.rate_limits enable row level security;

create or replace function public.hit_rate_limit(_scope text, _max int, _window_seconds int)
returns void language plpgsql security definer set search_path to 'public' as $$
declare ip text; w timestamptz; n int;
begin
  ip := coalesce(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1), 'unknown');
  w := to_timestamp(floor(extract(epoch from now()) / _window_seconds) * _window_seconds);
  insert into public.rate_limits (key, window_start, hits) values (_scope || ':' || ip, w, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into n;
  if n > _max then raise exception 'RATE_LIMIT'; end if;
  delete from public.rate_limits where window_start < now() - interval '1 day';
end $$;
revoke execute on function public.hit_rate_limit(text,int,int) from public, anon, authenticated;

create or replace function public.get_registration_confirmation(_code text)
returns table(first_name text, last_name text, food_item text, registration_code text, registration_status registration_status, event_slug text)
language plpgsql volatile security definer set search_path to 'public' as $$
begin
  perform public.hit_rate_limit('confirm', 30, 600);
  return query
  select p.first_name, p.last_name, r.food_item, r.registration_code, r.registration_status, e.slug
  from public.registrations r join public.participants p on p.id = r.participant_id
  join public.events e on e.id = r.event_id
  where r.registration_code = upper(trim(_code));
end $$;

create or replace function public.register_for_event(_event_id uuid, _first_name text, _last_name text, _cpf text, _birth_date date, _whatsapp text, _food_item text, _consent boolean)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare ev public.events; cpf_n text; wa text; pid uuid; code text; cnt int;
begin
  perform public.hit_rate_limit('register', 10, 600);
  select * into ev from public.events where id = _event_id;
  if not found or ev.status = 'draft' then raise exception 'EVENT_NOT_FOUND'; end if;
  if ev.status = 'closed' or (ev.date is not null and ev.date < current_date) then raise exception 'EVENT_CLOSED'; end if;
  if not ev.registration_open then raise exception 'REGISTRATION_CLOSED'; end if;
  if coalesce(trim(_first_name),'') = '' or coalesce(trim(_last_name),'') = '' then raise exception 'INVALID_NAME'; end if;
  if length(_first_name) > 80 or length(_last_name) > 120 then raise exception 'INVALID_NAME'; end if;
  if not public.is_valid_cpf(_cpf) then raise exception 'INVALID_CPF'; end if;
  if _birth_date is null or _birth_date > current_date or _birth_date < date '1900-01-01' then raise exception 'INVALID_BIRTH_DATE'; end if;
  if not coalesce(_consent,false) then raise exception 'CONSENT_REQUIRED'; end if;
  cpf_n := regexp_replace(_cpf, '\D', '', 'g');
  wa := nullif(regexp_replace(coalesce(_whatsapp,''), '\D', '', 'g'), '');
  if wa is not null and length(wa) not in (10,11) then raise exception 'INVALID_WHATSAPP'; end if;
  if length(coalesce(_food_item,'')) > 200 then raise exception 'INVALID_FOOD'; end if;

  perform pg_advisory_xact_lock(hashtext(_event_id::text));
  if ev.registration_limit is not null then
    select count(*) into cnt from public.registrations where event_id = _event_id and registration_status <> 'cancelado';
    if cnt >= ev.registration_limit then raise exception 'EVENT_FULL'; end if;
  end if;

  select id into pid from public.participants where cpf = cpf_n;
  if pid is null then
    insert into public.participants (first_name,last_name,cpf,birth_date,whatsapp)
    values (trim(_first_name), trim(_last_name), cpf_n, _birth_date, wa) returning id into pid;
  else
    if exists (select 1 from public.registrations where event_id = _event_id and participant_id = pid) then
      raise exception 'DUPLICATE';
    end if;
    update public.participants set first_name = trim(_first_name), last_name = trim(_last_name),
      birth_date = _birth_date, whatsapp = coalesce(wa, whatsapp) where id = pid;
  end if;

  loop
    code := upper(substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 8));
    exit when not exists (select 1 from public.registrations where registration_code = code);
  end loop;

  insert into public.registrations (event_id, participant_id, registration_code, food_item)
  values (_event_id, pid, code, nullif(trim(coalesce(_food_item,'')),''));
  insert into public.consents (participant_id, event_id, consent_type, consent_version)
  values (pid, _event_id, 'tratamento_dados_evento', ev.consent_version);
  return code;
end $function$;

-- Execute permissions: internal functions not callable by visitors
revoke execute on function public.has_role(uuid, app_role) from public, anon;
revoke execute on function public.is_manager(uuid) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_confirmed() from public, anon, authenticated;
revoke execute on function public.confirm_checkin(uuid) from public, anon;
grant execute on function public.has_role(uuid, app_role) to authenticated;
grant execute on function public.is_manager(uuid) to authenticated;
grant execute on function public.confirm_checkin(uuid) to authenticated;
