DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'student_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'user_identifier'
  ) THEN
    ALTER TABLE public.users RENAME COLUMN student_id TO user_identifier;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND conname = 'users_student_id_key'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND conname = 'users_user_identifier_key'
  ) THEN
    ALTER TABLE public.users
      RENAME CONSTRAINT users_student_id_key TO users_user_identifier_key;
  END IF;
END
$migration$;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
UPDATE public.users SET role = 'user' WHERE role = 'student';
ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'user';
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check CHECK (role = ANY (ARRAY['user'::text, 'staff'::text]));
