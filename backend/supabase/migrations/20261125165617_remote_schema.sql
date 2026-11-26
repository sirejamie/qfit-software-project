ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "service_role";

CREATE TABLE "public"."gym_queue" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"     uuid                     NOT NULL,
  "joined_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "status"      text                     NOT NULL DEFAULT 'waiting'::text,
  "admitted_at" timestamp with time zone,
  CONSTRAINT "gym_queue_pkey" PRIMARY KEY (id),
  CONSTRAINT "gym_queue_status_check" CHECK ((status = ANY (ARRAY['waiting'::text, 'admitted'::text, 'removed'::text])))
);

ALTER TABLE "public"."gym_queue"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."gym_sessions" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"           uuid                     NOT NULL,
  "start_time"        timestamp with time zone NOT NULL DEFAULT now(),
  "end_time"          timestamp with time zone,
  "expires_at"        timestamp with time zone,
  "status"            text                     NOT NULL DEFAULT 'active'::text,
  "timer_sync_status" text                     NOT NULL DEFAULT 'synced'::text,
  CONSTRAINT "gym_sessions_pkey" PRIMARY KEY (id),
  CONSTRAINT "gym_sessions_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'expired'::text]))),
  CONSTRAINT "gym_sessions_timer_sync_status_check" CHECK ((timer_sync_status = ANY (ARRAY['synced'::text, 'unsynced'::text]))),
  CONSTRAINT "valid_session_times" CHECK ((((end_time IS NULL) OR (end_time >= start_time)) AND ((expires_at IS NULL) OR (expires_at >= start_time))))
);

ALTER TABLE "public"."gym_sessions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."gym_settings" (
  "id"               integer       NOT NULL DEFAULT 1,
  "max_capacity"     integer       NOT NULL DEFAULT 20,
  "session_duration" integer       NOT NULL DEFAULT 60,
  "qr_active"        boolean       NOT NULL DEFAULT true,
  "opening_hours"    jsonb         NOT NULL DEFAULT '{}'::jsonb,
  "summer_fee"       numeric(10,2) NOT NULL DEFAULT 0,
  CONSTRAINT "gym_settings_id_check" CHECK ((id = 1)),
  CONSTRAINT "gym_settings_max_capacity_check" CHECK ((max_capacity > 0)),
  CONSTRAINT "gym_settings_pkey" PRIMARY KEY (id),
  CONSTRAINT "gym_settings_session_duration_check" CHECK ((session_duration > 0)),
  CONSTRAINT "gym_settings_summer_fee_check" CHECK ((summer_fee >= (0)::numeric))
);

ALTER TABLE "public"."gym_settings"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."notifications" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    uuid                     NOT NULL,
  "title"      text                     NOT NULL,
  "message"    text                     NOT NULL,
  "type"       text                     NOT NULL DEFAULT 'system'::text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "notifications_pkey" PRIMARY KEY (id),
  CONSTRAINT "notifications_type_check" CHECK ((type = ANY (ARRAY['timer'::text, 'queue'::text, 'system'::text])))
);

ALTER TABLE "public"."notifications"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."users" (
  "id"             uuid                     NOT NULL,
  "user_identifier" text,
  "full_name"      text                     NOT NULL,
  "email"          text                     NOT NULL,
  "role"           text                     NOT NULL DEFAULT 'user'::text,
  "is_blacklisted" boolean                  NOT NULL DEFAULT false,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "users_email_key" UNIQUE (email),
  CONSTRAINT "users_pkey" PRIMARY KEY (id),
  CONSTRAINT "users_role_check" CHECK ((role = ANY (ARRAY['user'::text, 'staff'::text]))),
  CONSTRAINT "users_user_identifier_key" UNIQUE (user_identifier)
);

ALTER TABLE "public"."users"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."users"
  ADD CONSTRAINT "users_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."gym_queue"
  ADD CONSTRAINT "gym_queue_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."gym_sessions"
  ADD CONSTRAINT "gym_sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE "public"."notifications"
  ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id);

CREATE INDEX idx_queue_joined ON public.gym_queue USING btree (joined_at)
  WHERE (status = 'waiting'::text);

CREATE INDEX idx_sessions_user ON public.gym_sessions USING btree (user_id);

CREATE UNIQUE INDEX one_active_session_per_user ON public.gym_sessions USING btree (user_id)
  WHERE (status = 'active'::text);

CREATE UNIQUE INDEX one_waiting_entry_per_user ON public.gym_queue USING btree (user_id)
  WHERE (status = 'waiting'::text);

CREATE POLICY "Users can view own queue entries" ON "public"."gym_queue"
  FOR SELECT
  TO "authenticated"
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can view own sessions" ON "public"."gym_sessions"
  FOR SELECT
  TO "authenticated"
  USING ((auth.uid() = user_id));

CREATE POLICY "Allow anonymous users to read gym settings" ON "public"."gym_settings"
  FOR SELECT
  TO "anon"
  USING (true);

CREATE POLICY "Authenticated users can view gym settings" ON "public"."gym_settings"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "Users can view own notifications" ON "public"."notifications"
  FOR SELECT
  TO "authenticated"
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can view own profile" ON "public"."users"
  FOR SELECT
  TO "authenticated"
  USING ((auth.uid() = id));

REVOKE ALL ON TABLE "public"."gym_queue" FROM "anon";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."gym_queue" TO "anon";

REVOKE ALL ON TABLE "public"."gym_queue" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."gym_queue" TO "authenticated";

REVOKE ALL ON TABLE "public"."gym_queue" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."gym_queue" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."gym_queue" TO "service_role";

REVOKE ALL ON TABLE "public"."gym_sessions" FROM "anon";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."gym_sessions" TO "anon";

REVOKE ALL ON TABLE "public"."gym_sessions" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."gym_sessions" TO "authenticated";

REVOKE ALL ON TABLE "public"."gym_sessions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."gym_sessions" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."gym_sessions" TO "service_role";

REVOKE ALL ON TABLE "public"."gym_settings" FROM "anon";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."gym_settings" TO "anon";

REVOKE ALL ON TABLE "public"."gym_settings" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."gym_settings" TO "authenticated";

REVOKE ALL ON TABLE "public"."gym_settings" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."gym_settings" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."gym_settings" TO "service_role";

REVOKE ALL ON TABLE "public"."notifications" FROM "anon";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."notifications" TO "anon";

REVOKE ALL ON TABLE "public"."notifications" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."notifications" TO "authenticated";

REVOKE ALL ON TABLE "public"."notifications" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."notifications" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."notifications" TO "service_role";

REVOKE ALL ON TABLE "public"."users" FROM "anon";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."users" TO "anon";

REVOKE ALL ON TABLE "public"."users" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."users" TO "authenticated";

REVOKE ALL ON TABLE "public"."users" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."users" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."users" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLES TO "service_role";

