-- The legacy SECURITY DEFINER function accepted caller-controlled discount data.
-- It must never be callable from the Data API; checkout uses the server role.
revoke all on function public.reserve_promotion(text, uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.release_expired_reservations() from public, anon, authenticated;
