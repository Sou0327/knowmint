-- ========================================
-- Add profile user type and listing type
-- ========================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'profile_user_type'
  ) THEN
    CREATE TYPE public.profile_user_type AS ENUM ('human', 'agent');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'listing_type'
  ) THEN
    CREATE TYPE public.listing_type AS ENUM ('offer', 'request');
  END IF;
END
$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_type public.profile_user_type NOT NULL DEFAULT 'human';

ALTER TABLE public.knowledge_items
  ADD COLUMN IF NOT EXISTS listing_type public.listing_type NOT NULL DEFAULT 'offer';

CREATE INDEX IF NOT EXISTS idx_knowledge_items_listing_type
  ON public.knowledge_items(listing_type);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  raw_user_type TEXT;
BEGIN
  raw_user_type := NEW.raw_user_meta_data->>'user_type';

  INSERT INTO public.profiles (id, display_name, user_type)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'display_name',
    CASE
      WHEN raw_user_type = 'agent' THEN 'agent'::public.profile_user_type
      ELSE 'human'::public.profile_user_type
    END
  );

  RETURN NEW;
END;
$$;

COMMIT;
