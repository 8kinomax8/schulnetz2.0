


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."handle_user_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  NEW.user_id = auth.uid();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_user_id"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."grades" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "subject_id" "uuid",
    "semester_number" integer,
    "grade" numeric,
    "weight" numeric DEFAULT 1,
    "date" "date",
    "control_name" "text",
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."grades" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."old_profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."old_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."semester_grades" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "subject_id" "uuid",
    "semester_number" integer NOT NULL,
    "grade" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."semester_grades" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subjects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "code" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."subjects" OWNER TO "postgres";


ALTER TABLE ONLY "public"."grades"
    ADD CONSTRAINT "grades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."grades"
    ADD CONSTRAINT "grades_user_id_subject_id_date_control_name_key" UNIQUE ("user_id", "subject_id", "date", "control_name");



ALTER TABLE ONLY "public"."old_profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."semester_grades"
    ADD CONSTRAINT "semester_grades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."semester_grades"
    ADD CONSTRAINT "semester_grades_user_id_subject_id_semester_number_key" UNIQUE ("user_id", "subject_id", "semester_number");



ALTER TABLE ONLY "public"."subjects"
    ADD CONSTRAINT "subjects_pkey" PRIMARY KEY ("id");



CREATE INDEX "grades_user_subject_sem_idx" ON "public"."grades" USING "btree" ("user_id", "subject_id", "semester_number");



CREATE INDEX "subjects_user_name_idx" ON "public"."subjects" USING "btree" ("user_id", "name");



CREATE OR REPLACE TRIGGER "set_user_id_grades" BEFORE INSERT ON "public"."grades" FOR EACH ROW EXECUTE FUNCTION "public"."handle_user_id"();



CREATE OR REPLACE TRIGGER "set_user_id_semester_grades" BEFORE INSERT ON "public"."semester_grades" FOR EACH ROW EXECUTE FUNCTION "public"."handle_user_id"();



CREATE OR REPLACE TRIGGER "set_user_id_subjects" BEFORE INSERT ON "public"."subjects" FOR EACH ROW EXECUTE FUNCTION "public"."handle_user_id"();



ALTER TABLE ONLY "public"."grades"
    ADD CONSTRAINT "grades_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."grades"
    ADD CONSTRAINT "grades_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."old_profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."semester_grades"
    ADD CONSTRAINT "semester_grades_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."semester_grades"
    ADD CONSTRAINT "semester_grades_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subjects"
    ADD CONSTRAINT "subjects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Users can delete own grades" ON "public"."grades" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own semester_grades" ON "public"."semester_grades" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own subjects" ON "public"."subjects" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own grades" ON "public"."grades" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own semester_grades" ON "public"."semester_grades" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own subjects" ON "public"."subjects" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own grades" ON "public"."grades" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own semester_grades" ON "public"."semester_grades" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own subjects" ON "public"."subjects" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own grades" ON "public"."grades" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own semester_grades" ON "public"."semester_grades" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own subjects" ON "public"."subjects" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."grades" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "grades delete own" ON "public"."grades" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "grades insert own" ON "public"."grades" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "grades select own" ON "public"."grades" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "grades update own" ON "public"."grades" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."old_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles select self" ON "public"."old_profiles" FOR SELECT USING (("id" = "auth"."uid"()));



CREATE POLICY "profiles update self" ON "public"."old_profiles" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "profiles upsert self" ON "public"."old_profiles" FOR INSERT WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."semester_grades" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subjects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subjects delete own" ON "public"."subjects" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "subjects insert own" ON "public"."subjects" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "subjects select own" ON "public"."subjects" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "subjects update own" ON "public"."subjects" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."handle_user_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_user_id"() TO "service_role";


















GRANT ALL ON TABLE "public"."grades" TO "anon";
GRANT ALL ON TABLE "public"."grades" TO "authenticated";
GRANT ALL ON TABLE "public"."grades" TO "service_role";



GRANT ALL ON TABLE "public"."old_profiles" TO "anon";
GRANT ALL ON TABLE "public"."old_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."old_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."semester_grades" TO "anon";
GRANT ALL ON TABLE "public"."semester_grades" TO "authenticated";
GRANT ALL ON TABLE "public"."semester_grades" TO "service_role";



GRANT ALL ON TABLE "public"."subjects" TO "anon";
GRANT ALL ON TABLE "public"."subjects" TO "authenticated";
GRANT ALL ON TABLE "public"."subjects" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";


