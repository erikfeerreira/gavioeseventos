
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
    code := upper(substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 8));
    exit when not exists (select 1 from public.registrations where registration_code = code);
  end loop;

  insert into public.registrations (event_id, participant_id, registration_code, food_item)
  values (_event_id, pid, code, nullif(trim(coalesce(_food_item,'')),''));
  insert into public.consents (participant_id, event_id, consent_type, consent_version)
  values (pid, _event_id, 'tratamento_dados_evento', ev.consent_version);
  return code;
end $$;
