
-- Roles
create type public.app_role as enum ('admin','staff','checkin');
create type public.registration_status as enum ('inscrito','cancelado','checkin','ausente');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select, insert, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_team(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles ur join public.profiles p on p.id = ur.user_id
                 where ur.user_id = _user_id and p.active)
$$;

create or replace function public.is_manager(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles ur join public.profiles p on p.id = ur.user_id
                 where ur.user_id = _user_id and p.active and ur.role in ('admin','staff'))
$$;

create policy "own profile or admin read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin update profiles" on public.profiles for update to authenticated
  using (public.has_role(auth.uid(),'admin'));

create policy "own roles or admin read" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin insert roles" on public.user_roles for insert to authenticated
  with check (public.has_role(auth.uid(),'admin'));
create policy "admin delete roles" on public.user_roles for delete to authenticated
  using (public.has_role(auth.uid(),'admin'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''), new.email);
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Events
create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  slogan text,
  description text,
  date date,
  start_time time,
  end_time time,
  location text,
  status text not null default 'draft' check (status in ('draft','published','closed')),
  registration_open boolean not null default false,
  registration_limit integer,
  logo_url text,
  cover_image_url text,
  how_to_participate text,
  food_rule_text text,
  rules jsonb not null default '[]'::jsonb,
  activities jsonb not null default '[]'::jsonb,
  faq jsonb not null default '[]'::jsonb,
  consent_text text,
  consent_version text not null default 'v1',
  confirmation_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.events to anon;
grant select, insert, update, delete on public.events to authenticated;
grant all on public.events to service_role;
alter table public.events enable row level security;
create policy "public reads published events" on public.events for select to anon, authenticated
  using (status <> 'draft' or public.is_team(auth.uid()));
create policy "managers insert events" on public.events for insert to authenticated with check (public.is_manager(auth.uid()));
create policy "managers update events" on public.events for update to authenticated using (public.is_manager(auth.uid()));
create policy "admin delete events" on public.events for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
create trigger events_touch before update on public.events for each row execute function public.touch_updated_at();

-- Partners
create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  description text,
  website text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.partners to anon;
grant select, insert, update, delete on public.partners to authenticated;
grant all on public.partners to service_role;
alter table public.partners enable row level security;
create policy "read active partners" on public.partners for select to anon, authenticated
  using (active or public.is_team(auth.uid()));
create policy "managers write partners" on public.partners for all to authenticated
  using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));

create table public.event_partners (
  event_id uuid not null references public.events(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete cascade,
  primary key (event_id, partner_id)
);
grant select on public.event_partners to anon;
grant select, insert, delete on public.event_partners to authenticated;
grant all on public.event_partners to service_role;
alter table public.event_partners enable row level security;
create policy "read event partners" on public.event_partners for select to anon, authenticated using (true);
create policy "managers write event partners" on public.event_partners for all to authenticated
  using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));

-- Participants & registrations (never public)
create table public.participants (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  cpf text not null unique,
  birth_date date not null,
  whatsapp text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.participants to authenticated;
grant all on public.participants to service_role;
alter table public.participants enable row level security;
create policy "team reads participants" on public.participants for select to authenticated using (public.is_team(auth.uid()));
create trigger participants_touch before update on public.participants for each row execute function public.touch_updated_at();

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  participant_id uuid not null references public.participants(id) on delete restrict,
  registration_code text not null unique,
  food_item text,
  registration_status registration_status not null default 'inscrito',
  registered_at timestamptz not null default now(),
  checked_in_at timestamptz,
  checked_in_by uuid,
  unique (event_id, participant_id)
);
create index on public.registrations(event_id);
grant select, update on public.registrations to authenticated;
grant all on public.registrations to service_role;
alter table public.registrations enable row level security;
create policy "team reads registrations" on public.registrations for select to authenticated using (public.is_team(auth.uid()));
create policy "managers update registrations" on public.registrations for update to authenticated using (public.is_manager(auth.uid()));

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  consent_type text not null,
  consent_version text not null,
  accepted_at timestamptz not null default now()
);
grant select on public.consents to authenticated;
grant all on public.consents to service_role;
alter table public.consents enable row level security;
create policy "managers read consents" on public.consents for select to authenticated using (public.is_manager(auth.uid()));

-- CPF validation
create or replace function public.is_valid_cpf(_cpf text) returns boolean language plpgsql immutable set search_path = public as $$
declare d text := regexp_replace(coalesce(_cpf,''), '\D', '', 'g'); s int; r int; i int;
begin
  if length(d) <> 11 or d ~ '^(\d)\1{10}$' then return false; end if;
  s := 0; for i in 1..9 loop s := s + substr(d,i,1)::int * (11-i); end loop;
  r := (s*10) % 11; if r = 10 then r := 0; end if;
  if r <> substr(d,10,1)::int then return false; end if;
  s := 0; for i in 1..10 loop s := s + substr(d,i,1)::int * (12-i); end loop;
  r := (s*10) % 11; if r = 10 then r := 0; end if;
  return r = substr(d,11,1)::int;
end $$;

-- Public registration RPC (validates everything server-side)
create or replace function public.register_for_event(
  _event_id uuid, _first_name text, _last_name text, _cpf text, _birth_date date,
  _whatsapp text, _food_item text, _consent boolean
) returns text language plpgsql security definer set search_path = public as $$
declare ev public.events; cpf_n text; wa text; pid uuid; code text; cnt int;
begin
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
    code := upper(substr(translate(encode(gen_random_bytes(8),'base64'),'+/=0OIl1',''),1,8));
    exit when length(code) = 8 and not exists (select 1 from public.registrations where registration_code = code);
  end loop;

  insert into public.registrations (event_id, participant_id, registration_code, food_item)
  values (_event_id, pid, code, nullif(trim(coalesce(_food_item,'')),''));
  insert into public.consents (participant_id, event_id, consent_type, consent_version)
  values (pid, _event_id, 'tratamento_dados_evento', ev.consent_version);
  return code;
end $$;
revoke all on function public.register_for_event from public;
grant execute on function public.register_for_event to anon, authenticated;

-- Public confirmation lookup (minimal data)
create or replace function public.get_registration_confirmation(_code text)
returns table (first_name text, last_name text, food_item text, registration_code text, registration_status registration_status, event_slug text)
language sql stable security definer set search_path = public as $$
  select p.first_name, p.last_name, r.food_item, r.registration_code, r.registration_status, e.slug
  from public.registrations r join public.participants p on p.id = r.participant_id
  join public.events e on e.id = r.event_id
  where r.registration_code = upper(trim(_code))
$$;
grant execute on function public.get_registration_confirmation to anon, authenticated;

-- Check-in RPC
create or replace function public.confirm_checkin(_registration_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare r public.registrations;
begin
  if not public.is_team(auth.uid()) then raise exception 'FORBIDDEN'; end if;
  select * into r from public.registrations where id = _registration_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if r.registration_status = 'checkin' then return 'ALREADY'; end if;
  if r.registration_status = 'cancelado' then raise exception 'CANCELLED'; end if;
  update public.registrations set registration_status = 'checkin', checked_in_at = now(), checked_in_by = auth.uid()
  where id = _registration_id;
  return 'OK';
end $$;
revoke all on function public.confirm_checkin from public;
grant execute on function public.confirm_checkin to authenticated;

-- Initial event
insert into public.events (name, slug, slogan, description, date, status, registration_open, food_rule_text, consent_text, confirmation_message)
values (
  'GAVIÕES NA AREIA', 'gavioes-na-areia', 'Seu treino saiu da academia.',
  'Experiência esportiva da Academia Gaviões Poá na quadra de areia, com atividades físicas, desafios e experiências com parceiros.',
  '2026-10-24', 'published', true,
  'Para participar, leve pelo menos 1 alimento não perecível no dia do evento.',
  'Autorizo a Academia Gaviões Poá a utilizar os dados informados neste formulário exclusivamente para a organização e o controle de presença deste evento.',
  'Inscrição realizada com sucesso!'
);
