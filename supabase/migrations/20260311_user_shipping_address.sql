-- Add default shipping address columns to public.users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS shipping_full_name text,
  ADD COLUMN IF NOT EXISTS shipping_email text,
  ADD COLUMN IF NOT EXISTS shipping_phone text,
  ADD COLUMN IF NOT EXISTS shipping_address1 text,
  ADD COLUMN IF NOT EXISTS shipping_address2 text,
  ADD COLUMN IF NOT EXISTS shipping_city text,
  ADD COLUMN IF NOT EXISTS shipping_state text,
  ADD COLUMN IF NOT EXISTS shipping_zip text,
  ADD COLUMN IF NOT EXISTS shipping_country text DEFAULT 'US';
