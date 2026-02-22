-- Migration to split full_name into first_name and last_name

-- 1. Add the new columns (safe to run multiple times)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT;

-- 2. Backfill existing data
-- We split by the first space. 
-- The first part goes to first_name.
-- The rest goes to last_name.
-- We check if full_name actually exists in the current schema to prevent errors
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='full_name') THEN
    UPDATE public.profiles
    SET 
      first_name = SPLIT_PART(full_name, ' ', 1),
      last_name = SUBSTRING(full_name FROM STRPOS(full_name, ' ') + 1)
    WHERE full_name IS NOT NULL AND STRPOS(full_name, ' ') > 0;

    -- For users with only one name (no spaces)
    UPDATE public.profiles
    SET 
      first_name = full_name,
      last_name = ''
    WHERE full_name IS NOT NULL AND STRPOS(full_name, ' ') = 0;
  END IF;
END $$;
