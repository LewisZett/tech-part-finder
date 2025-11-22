CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: cleanup_old_rate_limits(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_rate_limits() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE last_call_at < now() - interval '24 hours';
END;
$$;


--
-- Name: cleanup_old_security_events(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_security_events() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Keep security events for 90 days
  DELETE FROM public.security_events
  WHERE created_at < now() - interval '90 days';
END;
$$;


--
-- Name: detect_suspicious_login_activity(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.detect_suspicious_login_activity(p_user_id uuid, p_ip_address text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  failed_attempts integer;
  different_ips integer;
  result jsonb;
BEGIN
  -- Count failed login attempts in last hour
  SELECT COUNT(*)
  INTO failed_attempts
  FROM security_events
  WHERE user_id = p_user_id
    AND event_type = 'login_failed'
    AND created_at > now() - interval '1 hour';
  
  -- Count different IPs used in last 24 hours
  SELECT COUNT(DISTINCT ip_address)
  INTO different_ips
  FROM security_events
  WHERE user_id = p_user_id
    AND event_category = 'authentication'
    AND created_at > now() - interval '24 hours';
  
  -- Build result
  result := jsonb_build_object(
    'failed_attempts_last_hour', failed_attempts,
    'different_ips_last_24h', different_ips,
    'is_suspicious', (failed_attempts >= 5 OR different_ips >= 5)
  );
  
  RETURN result;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, trade_type)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'trade_type', 'general')
  );
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    part_id uuid,
    request_id uuid,
    supplier_id uuid NOT NULL,
    requester_id uuid NOT NULL,
    status text DEFAULT 'pending'::text,
    supplier_agreed boolean DEFAULT false,
    requester_agreed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT matches_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'both_agreed'::text, 'cancelled'::text])))
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    match_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    receiver_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT content_length CHECK (((char_length(content) >= 1) AND (char_length(content) <= 2000))),
    CONSTRAINT message_content_length CHECK (((char_length(content) > 0) AND (char_length(content) <= 2000)))
);


--
-- Name: part_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.part_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    requester_id uuid NOT NULL,
    part_name text NOT NULL,
    category text NOT NULL,
    condition_preference text,
    max_price numeric(10,2),
    description text,
    location text,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT max_price_positive CHECK (((max_price IS NULL) OR (max_price >= (0)::numeric))),
    CONSTRAINT part_requests_status_check CHECK ((status = ANY (ARRAY['active'::text, 'fulfilled'::text, 'cancelled'::text]))),
    CONSTRAINT request_part_name_length CHECK (((char_length(part_name) >= 2) AND (char_length(part_name) <= 100))),
    CONSTRAINT requests_description_length CHECK (((description IS NULL) OR (char_length(description) <= 500))),
    CONSTRAINT requests_location_length CHECK (((location IS NULL) OR (char_length(location) <= 100)))
);


--
-- Name: parts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_id uuid NOT NULL,
    part_name text NOT NULL,
    category text NOT NULL,
    condition text NOT NULL,
    price numeric(10,2),
    description text,
    location text,
    image_url text,
    status text DEFAULT 'available'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT part_name_length CHECK (((char_length(part_name) >= 2) AND (char_length(part_name) <= 100))),
    CONSTRAINT parts_condition_check CHECK ((condition = ANY (ARRAY['new'::text, 'used'::text, 'refurbished'::text]))),
    CONSTRAINT parts_description_length CHECK (((description IS NULL) OR (char_length(description) <= 500))),
    CONSTRAINT parts_location_length CHECK (((location IS NULL) OR (char_length(location) <= 100))),
    CONSTRAINT parts_status_check CHECK ((status = ANY (ARRAY['available'::text, 'sold'::text, 'reserved'::text]))),
    CONSTRAINT price_positive CHECK (((price IS NULL) OR (price >= (0)::numeric)))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text,
    full_name text,
    trade_type text NOT NULL,
    is_verified boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    phone_number text,
    CONSTRAINT full_name_length CHECK ((char_length(full_name) <= 100)),
    CONSTRAINT phone_format CHECK (((phone_number IS NULL) OR (phone_number ~ '^\+?[0-9]{10,15}$'::text))),
    CONSTRAINT phone_number_format CHECK (((phone_number IS NULL) OR (phone_number ~ '^\+[1-9]\d{1,14}$'::text)))
);


--
-- Name: public_profiles; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.public_profiles WITH (security_invoker='true') AS
 SELECT id,
    full_name,
    trade_type,
    is_verified,
    created_at
   FROM public.profiles;


--
-- Name: rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_limits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    function_name text NOT NULL,
    last_call_at timestamp with time zone DEFAULT now() NOT NULL,
    call_count integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ratings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ratings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    match_id uuid NOT NULL,
    rater_id uuid NOT NULL,
    rated_id uuid NOT NULL,
    rating integer NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ratings_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: security_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    event_type text NOT NULL,
    event_category text NOT NULL,
    severity text NOT NULL,
    ip_address text,
    user_agent text,
    details jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: matches matches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: part_requests part_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.part_requests
    ADD CONSTRAINT part_requests_pkey PRIMARY KEY (id);


--
-- Name: parts parts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parts
    ADD CONSTRAINT parts_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: rate_limits rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limits
    ADD CONSTRAINT rate_limits_pkey PRIMARY KEY (id);


--
-- Name: ratings ratings_match_id_rater_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ratings
    ADD CONSTRAINT ratings_match_id_rater_id_key UNIQUE (match_id, rater_id);


--
-- Name: ratings ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ratings
    ADD CONSTRAINT ratings_pkey PRIMARY KEY (id);


--
-- Name: security_events security_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_events
    ADD CONSTRAINT security_events_pkey PRIMARY KEY (id);


--
-- Name: idx_rate_limits_user_function; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_limits_user_function ON public.rate_limits USING btree (user_id, function_name);


--
-- Name: idx_security_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_events_created_at ON public.security_events USING btree (created_at DESC);


--
-- Name: idx_security_events_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_events_severity ON public.security_events USING btree (severity);


--
-- Name: idx_security_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_events_type ON public.security_events USING btree (event_type);


--
-- Name: idx_security_events_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_events_user_id ON public.security_events USING btree (user_id);


--
-- Name: matches update_matches_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: part_requests update_part_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_part_requests_updated_at BEFORE UPDATE ON public.part_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: parts update_parts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_parts_updated_at BEFORE UPDATE ON public.parts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: matches matches_part_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_part_id_fkey FOREIGN KEY (part_id) REFERENCES public.parts(id) ON DELETE CASCADE;


--
-- Name: matches matches_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.part_requests(id) ON DELETE CASCADE;


--
-- Name: matches matches_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: matches matches_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;


--
-- Name: messages messages_receiver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: part_requests part_requests_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.part_requests
    ADD CONSTRAINT part_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: parts parts_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parts
    ADD CONSTRAINT parts_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ratings ratings_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ratings
    ADD CONSTRAINT ratings_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;


--
-- Name: ratings ratings_rated_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ratings
    ADD CONSTRAINT ratings_rated_id_fkey FOREIGN KEY (rated_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ratings ratings_rater_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ratings
    ADD CONSTRAINT ratings_rater_id_fkey FOREIGN KEY (rater_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: part_requests Anyone can view active part requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active part requests" ON public.part_requests FOR SELECT USING ((status = 'active'::text));


--
-- Name: parts Anyone can view available parts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view available parts" ON public.parts FOR SELECT USING ((status = 'available'::text));


--
-- Name: ratings Anyone can view ratings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view ratings" ON public.ratings FOR SELECT USING (true);


--
-- Name: profiles Matched users can view contact info; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Matched users can view contact info" ON public.profiles FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.matches
  WHERE (((matches.supplier_id = auth.uid()) AND (matches.requester_id = profiles.id)) OR ((matches.requester_id = auth.uid()) AND (matches.supplier_id = profiles.id))))));


--
-- Name: ratings Ratings cannot be deleted; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Ratings cannot be deleted" ON public.ratings FOR DELETE USING (false);


--
-- Name: ratings Ratings cannot be modified; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Ratings cannot be modified" ON public.ratings FOR UPDATE USING (false);


--
-- Name: part_requests Requesters can delete own requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Requesters can delete own requests" ON public.part_requests FOR DELETE USING ((auth.uid() = requester_id));


--
-- Name: part_requests Requesters can insert own requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Requesters can insert own requests" ON public.part_requests FOR INSERT WITH CHECK ((auth.uid() = requester_id));


--
-- Name: part_requests Requesters can update own requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Requesters can update own requests" ON public.part_requests FOR UPDATE USING ((auth.uid() = requester_id));


--
-- Name: rate_limits Service role can manage rate limits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage rate limits" ON public.rate_limits USING (true) WITH CHECK (true);


--
-- Name: security_events Service role can manage security events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage security events" ON public.security_events USING (true) WITH CHECK (true);


--
-- Name: parts Suppliers can delete own parts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Suppliers can delete own parts" ON public.parts FOR DELETE USING ((auth.uid() = supplier_id));


--
-- Name: parts Suppliers can insert own parts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Suppliers can insert own parts" ON public.parts FOR INSERT WITH CHECK ((auth.uid() = supplier_id));


--
-- Name: parts Suppliers can update own parts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Suppliers can update own parts" ON public.parts FOR UPDATE USING ((auth.uid() = supplier_id));


--
-- Name: matches Users can insert matches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert matches" ON public.matches FOR INSERT WITH CHECK (((auth.uid() = supplier_id) OR (auth.uid() = requester_id)));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: ratings Users can insert ratings for completed matches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert ratings for completed matches" ON public.ratings FOR INSERT WITH CHECK ((auth.uid() = rater_id));


--
-- Name: messages Users can send messages in their matches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can send messages in their matches" ON public.messages FOR INSERT WITH CHECK ((auth.uid() = sender_id));


--
-- Name: matches Users can update own matches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own matches" ON public.matches FOR UPDATE USING (((auth.uid() = supplier_id) OR (auth.uid() = requester_id)));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: messages Users can view messages in their matches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view messages in their matches" ON public.messages FOR SELECT USING (((auth.uid() = sender_id) OR (auth.uid() = receiver_id)));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: matches Users can view their own matches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own matches" ON public.matches FOR SELECT USING (((auth.uid() = supplier_id) OR (auth.uid() = requester_id)));


--
-- Name: matches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: part_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.part_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: parts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: ratings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

--
-- Name: security_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


