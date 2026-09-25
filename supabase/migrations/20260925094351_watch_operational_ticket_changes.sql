-- The previous trigger listened only to legacy status, opened_at and closed_at.
drop trigger tickets_operational_dates_trg on public.tickets;
create trigger tickets_operational_dates_trg before insert or update on public.tickets
for each row execute function public.sync_ticket_operational_dates();
