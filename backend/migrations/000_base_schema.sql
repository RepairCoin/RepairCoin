-- 000_base_schema.sql
-- Baseline schema for building the database from scratch.
-- Generated from a pg_dump --schema-only of the staging database (PostgreSQL 16).
-- Regenerate: pg_dump --schema-only --no-owner --no-privileges --no-comments
--             --exclude-table=public.schema_migrations  (the runner owns that table)
--
-- On a FRESH database this builds the full schema. On databases that already have it
-- (staging/prod) the runner skips this file (version 0 is already recorded there). The
-- trailing seed marks every migration represented by this dump as applied so a fresh
-- build runs only this baseline (plus any migration added after the dump).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============ BEGIN pg_dump (schema-only, cleaned) ============

--
-- PostgreSQL database dump
--


-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14 (Debian 16.14-1.pgdg13+1)

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

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: check_email_uniqueness(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_email_uniqueness() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check if email exists in customers table (for shop inserts/updates)
    IF TG_TABLE_NAME = 'shops' AND NEW.email IS NOT NULL AND NEW.email != '' THEN
        IF EXISTS (SELECT 1 FROM customers WHERE LOWER(email) = LOWER(NEW.email)) THEN
            RAISE EXCEPTION 'Email address already exists in customers table: %', NEW.email
                USING ERRCODE = '23505';
        END IF;
    END IF;
    
    -- Check if email exists in shops table (for customer inserts/updates)
    IF TG_TABLE_NAME = 'customers' AND NEW.email IS NOT NULL AND NEW.email != '' THEN
        IF EXISTS (SELECT 1 FROM shops WHERE LOWER(email) = LOWER(NEW.email)) THEN
            RAISE EXCEPTION 'Email address already exists in shops table: %', NEW.email
                USING ERRCODE = '23505';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: check_shop_gallery_photos_limit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_shop_gallery_photos_limit() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  photo_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO photo_count
  FROM shop_gallery_photos
  WHERE shop_id = NEW.shop_id;

  IF photo_count >= 20 THEN
    RAISE EXCEPTION 'Shop can have a maximum of 20 gallery photos'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: check_wallet_uniqueness(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_wallet_uniqueness() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check if wallet exists in customers table (for shop inserts/updates)
    IF TG_TABLE_NAME = 'shops' THEN
        IF EXISTS (SELECT 1 FROM customers WHERE wallet_address = NEW.wallet_address) THEN
            RAISE EXCEPTION 'Wallet address already exists in customers table: %', NEW.wallet_address
                USING ERRCODE = '23505';
        END IF;
    END IF;
    
    -- Check if wallet exists in shops table (for customer inserts/updates)
    IF TG_TABLE_NAME = 'customers' THEN
        IF EXISTS (SELECT 1 FROM shops WHERE wallet_address = NEW.wallet_address) THEN
            RAISE EXCEPTION 'Wallet address already exists in shops table: %', NEW.wallet_address
                USING ERRCODE = '23505';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: cleanup_expired_idempotency_keys(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_idempotency_keys() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM idempotency_keys WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


--
-- Name: cleanup_expired_typing_indicators(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_typing_indicators() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM typing_indicators WHERE expires_at < NOW();
END;
$$;


--
-- Name: cleanup_old_calendar_connections(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_calendar_connections() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM shop_calendar_connections
  WHERE is_active = false
    AND updated_at < CURRENT_TIMESTAMP - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


--
-- Name: cleanup_old_gmail_connections(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_gmail_connections() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM shop_gmail_connections
  WHERE is_active = false
    AND updated_at < CURRENT_TIMESTAMP - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


--
-- Name: expire_old_reschedule_requests(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.expire_old_reschedule_requests() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE appointment_reschedule_requests
  SET
    status = 'expired',
    updated_at = NOW()
  WHERE status = 'pending'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;


--
-- Name: refresh_platform_statistics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_platform_statistics() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Try concurrent refresh first (faster, but requires unique index)
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY platform_statistics;
    RETURN;
  EXCEPTION
    WHEN OTHERS THEN
      -- If concurrent refresh fails, fall back to regular refresh
      -- This handles cases where the unique index doesn't exist yet
      RAISE NOTICE 'Concurrent refresh failed, using regular refresh: %', SQLERRM;
      REFRESH MATERIALIZED VIEW platform_statistics;
  END;
END;
$$;


--
-- Name: reset_unread_count_on_read(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reset_unread_count_on_read() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.is_read = TRUE AND OLD.is_read = FALSE THEN
    UPDATE conversations
    SET
      unread_count_customer = CASE
        WHEN NEW.sender_type = 'shop' THEN GREATEST(0, unread_count_customer - 1)
        ELSE unread_count_customer
      END,
      unread_count_shop = CASE
        WHEN NEW.sender_type = 'customer' THEN GREATEST(0, unread_count_shop - 1)
        ELSE unread_count_shop
      END,
      updated_at = NOW()
    WHERE conversation_id = NEW.conversation_id;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: sync_review_helpful_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_review_helpful_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Update helpful_count in service_reviews based on actual votes
  UPDATE service_reviews
  SET helpful_count = (
    SELECT COUNT(*)
    FROM review_helpful_votes
    WHERE review_id = COALESCE(NEW.review_id, OLD.review_id)
  )
  WHERE review_id = COALESCE(NEW.review_id, OLD.review_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: update_blocked_customers_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_blocked_customers_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


--
-- Name: update_contact_imports_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_contact_imports_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


--
-- Name: update_conversation_on_message(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_conversation_on_message() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE conversations
  SET
    last_message_at = NEW.created_at,
    updated_at = NOW()
  WHERE conversation_id = NEW.conversation_id;

  RETURN NEW;
END;
$$;


--
-- Name: update_customer_no_show_tier(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_customer_no_show_tier() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_policy RECORD;
BEGIN
  -- Get shop's no-show policy (or use defaults if not found)
  SELECT * INTO v_policy
  FROM shop_no_show_policy
  WHERE shop_id = NEW.shop_id;

  -- If no policy exists, use defaults
  IF NOT FOUND THEN
    v_policy.caution_threshold := 2;
    v_policy.deposit_threshold := 3;
    v_policy.suspension_threshold := 5;
    v_policy.suspension_duration_days := 30;
  END IF;

  -- Update customer tier based on no_show_count
  UPDATE customers
  SET
    no_show_tier = CASE
      WHEN no_show_count >= v_policy.suspension_threshold THEN 'suspended'
      WHEN no_show_count >= v_policy.deposit_threshold THEN 'deposit_required'
      WHEN no_show_count >= v_policy.caution_threshold THEN 'caution'
      WHEN no_show_count = 1 THEN 'warning'
      ELSE 'normal'
    END,
    deposit_required = (no_show_count >= v_policy.deposit_threshold),
    booking_suspended_until = CASE
      WHEN no_show_count >= v_policy.suspension_threshold
      THEN NOW() + (v_policy.suspension_duration_days || ' days')::INTERVAL
      ELSE NULL
    END,
    last_no_show_at = NEW.marked_no_show_at
  WHERE wallet_address = NEW.customer_address;

  RETURN NEW;
END;
$$;


--
-- Name: update_email_template_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_email_template_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_flagged_reviews_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_flagged_reviews_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


--
-- Name: update_general_notif_prefs_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_general_notif_prefs_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_inventory_item_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_inventory_item_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.stock_quantity = 0 THEN
    NEW.status = 'out_of_stock';
  ELSIF NEW.stock_quantity <= NEW.low_stock_threshold THEN
    NEW.status = 'low_stock';
  ELSIF NEW.status IN ('low_stock', 'out_of_stock') THEN
    -- Only auto-change status if it was previously low/out of stock
    NEW.status = 'available';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: update_inventory_items_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_inventory_items_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


--
-- Name: update_notification_prefs_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_notification_prefs_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_order_reschedule_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_order_reschedule_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- On INSERT (new request)
  IF TG_OP = 'INSERT' THEN
    UPDATE service_orders
    SET has_pending_reschedule = TRUE
    WHERE order_id = NEW.order_id;
    RETURN NEW;
  END IF;

  -- On UPDATE (status change)
  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status != 'pending' THEN
    -- Check if there are any other pending requests for this order
    IF NOT EXISTS (
      SELECT 1 FROM appointment_reschedule_requests
      WHERE order_id = NEW.order_id
        AND status = 'pending'
        AND request_id != NEW.request_id
    ) THEN
      UPDATE service_orders
      SET has_pending_reschedule = FALSE
      WHERE order_id = NEW.order_id;
    END IF;

    -- If approved, update the booking details
    IF NEW.status = 'approved' THEN
      UPDATE service_orders
      SET
        booking_date = NEW.requested_date,
        booking_time_slot = NEW.requested_time_slot,
        booking_end_time = NEW.requested_end_time,
        reschedule_count = reschedule_count + 1,
        last_rescheduled_at = NOW()
      WHERE order_id = NEW.order_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: update_promo_code_stats_on_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_promo_code_stats_on_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Decrement times_used and subtract from total_bonus_issued
  -- Use GREATEST to prevent negative values
  UPDATE promo_codes
  SET times_used = GREATEST(0, times_used - 1),
      total_bonus_issued = GREATEST(0, total_bonus_issued - COALESCE(OLD.bonus_amount, 0)),
      updated_at = CURRENT_TIMESTAMP
  WHERE id = OLD.promo_code_id;

  RETURN OLD;
END;
$$;


--
-- Name: update_promo_code_stats_on_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_promo_code_stats_on_insert() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Increment times_used and add to total_bonus_issued
  UPDATE promo_codes
  SET times_used = times_used + 1,
      total_bonus_issued = total_bonus_issued + COALESCE(NEW.bonus_amount, 0),
      updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.promo_code_id;

  RETURN NEW;
END;
$$;


--
-- Name: update_purchase_orders_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_purchase_orders_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


--
-- Name: update_service_rating_aggregate(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_service_rating_aggregate() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Update average_rating and review_count for the service
  UPDATE shop_services
  SET
    average_rating = (
      SELECT ROUND(AVG(rating)::numeric, 1)
      FROM service_reviews
      WHERE service_id = COALESCE(NEW.service_id, OLD.service_id)
    ),
    review_count = (
      SELECT COUNT(*)
      FROM service_reviews
      WHERE service_id = COALESCE(NEW.service_id, OLD.service_id)
    )
  WHERE service_id = COALESCE(NEW.service_id, OLD.service_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: update_shop_calendar_connections_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_shop_calendar_connections_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


--
-- Name: update_shop_email_preferences_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_shop_email_preferences_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


--
-- Name: update_shop_gallery_photos_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_shop_gallery_photos_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


--
-- Name: update_shop_gmail_connections_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_shop_gmail_connections_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


--
-- Name: update_shop_no_show_policy_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_shop_no_show_policy_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


--
-- Name: update_shop_operational_status_on_subscription(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_shop_operational_status_on_subscription() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Update shop's subscription status
    UPDATE shops
    SET
      subscription_active = (NEW.status = 'active' AND NEW.is_active = true),
      subscription_id = CASE
        WHEN NEW.status = 'active' AND NEW.is_active = true THEN NEW.id
        ELSE NULL
      END,
      operational_status = CASE
        WHEN NEW.status = 'active' AND NEW.is_active = true THEN 'commitment_qualified'
        WHEN rcg_balance >= 10000 THEN 'rcg_qualified'
        ELSE 'not_qualified'
      END
    WHERE shop_id = NEW.shop_id;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: update_shop_reports_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_shop_reports_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


--
-- Name: update_support_tickets_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_support_tickets_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


--
-- Name: update_ticket_last_message(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_ticket_last_message() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE support_tickets
  SET last_message_at = NEW.created_at
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$;


--
-- Name: update_waitlist_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_waitlist_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: validate_promo_code(character varying, character varying, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_promo_code(p_code character varying, p_shop_id character varying, p_customer_address character varying) RETURNS TABLE(is_valid boolean, error_message text, promo_code_id integer, bonus_type character varying, bonus_value numeric, max_bonus numeric)
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_promo RECORD;
  v_customer_uses INTEGER;
BEGIN
  -- Normalize inputs
  p_code := UPPER(TRIM(p_code));
  p_customer_address := LOWER(TRIM(p_customer_address));

  -- Find and LOCK the promo code row to prevent concurrent access
  -- FOR UPDATE ensures exclusive lock on this row until transaction ends
  -- This prevents race conditions where multiple requests read stale data
  SELECT * INTO v_promo
  FROM promo_codes
  WHERE UPPER(code) = p_code
    AND shop_id = p_shop_id
    AND is_active = true
  FOR UPDATE;

  -- Check if promo code exists
  IF v_promo IS NULL THEN
    RETURN QUERY SELECT
      false,
      'Invalid promo code'::TEXT,
      NULL::INTEGER,
      NULL::VARCHAR(20),
      NULL::NUMERIC(10, 2),
      NULL::NUMERIC(10, 2);
    RETURN;
  END IF;

  -- Check date validity
  IF CURRENT_TIMESTAMP < v_promo.start_date THEN
    RETURN QUERY SELECT
      false,
      'Promo code not yet active'::TEXT,
      v_promo.id,
      v_promo.bonus_type::VARCHAR(20),
      v_promo.bonus_value,
      v_promo.max_bonus;
    RETURN;
  END IF;

  IF CURRENT_TIMESTAMP > v_promo.end_date THEN
    RETURN QUERY SELECT
      false,
      'Promo code has expired'::TEXT,
      v_promo.id,
      v_promo.bonus_type::VARCHAR(20),
      v_promo.bonus_value,
      v_promo.max_bonus;
    RETURN;
  END IF;

  -- Check total usage limit (now safe from race conditions due to row lock)
  IF v_promo.total_usage_limit IS NOT NULL THEN
    IF v_promo.times_used >= v_promo.total_usage_limit THEN
      RETURN QUERY SELECT
        false,
        'Promo code usage limit reached'::TEXT,
        v_promo.id,
        v_promo.bonus_type::VARCHAR(20),
        v_promo.bonus_value,
        v_promo.max_bonus;
      RETURN;
    END IF;
  END IF;

  -- Check per-customer usage limit (now safe from race conditions due to row lock)
  IF v_promo.per_customer_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_customer_uses
    FROM promo_code_uses pcu
    WHERE pcu.promo_code_id = v_promo.id
      AND pcu.customer_address = p_customer_address;

    IF v_customer_uses >= v_promo.per_customer_limit THEN
      RETURN QUERY SELECT
        false,
        'You have already used this promo code'::TEXT,
        v_promo.id,
        v_promo.bonus_type::VARCHAR(20),
        v_promo.bonus_value,
        v_promo.max_bonus;
      RETURN;
    END IF;
  END IF;

  -- All checks passed
  RETURN QUERY SELECT
    true,
    NULL::TEXT,
    v_promo.id,
    v_promo.bonus_type::VARCHAR(20),
    v_promo.bonus_value,
    v_promo.max_bonus;
END;
$$;


--
-- Name: commitment_enrollments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.commitment_enrollments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: shop_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.shop_subscriptions (
    id integer DEFAULT nextval('public.commitment_enrollments_id_seq'::regclass) NOT NULL,
    shop_id character varying(100) NOT NULL,
    plan_type character varying(50) DEFAULT 'monthly'::character varying,
    amount numeric(10,2) DEFAULT 500.00,
    currency character varying(3) DEFAULT 'USD'::character varying,
    status character varying(50) DEFAULT 'pending'::character varying,
    current_period_start date,
    current_period_end date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    monthly_amount numeric(20,8) DEFAULT 500.00,
    subscription_type character varying(50) DEFAULT 'monthly_commitment'::character varying,
    is_active boolean DEFAULT true,
    paused_at timestamp with time zone,
    resumed_at timestamp with time zone,
    pause_reason text,
    notes text,
    created_by character varying(42),
    billing_method character varying(20),
    billing_reference character varying(255),
    payments_made integer DEFAULT 0 NOT NULL,
    total_paid numeric(10,2) DEFAULT 0 NOT NULL,
    next_payment_date timestamp without time zone,
    last_payment_date timestamp without time zone,
    enrolled_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    activated_at timestamp without time zone,
    cancelled_at timestamp without time zone,
    cancellation_reason text
);


--
-- Name: shops; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.shops (
    shop_id character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    address text NOT NULL,
    phone character varying(20),
    email character varying(255),
    wallet_address character varying(42) NOT NULL,
    reimbursement_address character varying(42),
    verified boolean DEFAULT false,
    active boolean DEFAULT true,
    total_tokens_issued numeric(20,8) DEFAULT 0,
    total_redemptions numeric(20,8) DEFAULT 0,
    total_reimbursements numeric(20,8) DEFAULT 0,
    join_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_activity timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    fixflow_shop_id character varying(100),
    location_lat numeric(10,8),
    location_lng numeric(11,8),
    location_city character varying(100),
    location_state character varying(100),
    location_zip_code character varying(20),
    purchased_rcn_balance numeric(20,8) DEFAULT 0,
    total_rcn_purchased numeric(20,8) DEFAULT 0,
    last_purchase_date timestamp without time zone,
    minimum_balance_alert numeric(20,8) DEFAULT 50,
    auto_purchase_enabled boolean DEFAULT false,
    auto_purchase_amount numeric(20,8) DEFAULT 100,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    suspended_at timestamp without time zone,
    suspension_reason text,
    commitment_enrolled boolean DEFAULT false,
    rcg_tier character varying(20) DEFAULT 'STANDARD'::character varying,
    rcg_balance numeric(20,8) DEFAULT 0,
    verified_at timestamp with time zone,
    verified_by character varying(42),
    rcg_staked_at timestamp with time zone,
    tier_updated_at timestamp with time zone,
    operational_status character varying(50) DEFAULT 'pending'::character varying,
    subscription_active boolean DEFAULT false,
    subscription_id character varying(255),
    facebook character varying(255),
    twitter character varying(255),
    instagram character varying(255),
    first_name character varying(255),
    last_name character varying(255),
    company_size character varying(100),
    monthly_revenue character varying(100),
    website character varying(255),
    referral character varying(255),
    accept_terms boolean DEFAULT false,
    country character varying(100),
    category character varying(100),
    logo_url character varying(512),
    banner_url character varying(512),
    about_text text,
    cross_shop_enabled boolean DEFAULT false,
    low_stock_alerts_enabled boolean DEFAULT true,
    low_stock_alert_email character varying(255),
    low_stock_alert_frequency character varying(20) DEFAULT 'daily'::character varying,
    low_stock_digest_mode character varying(20) DEFAULT 'daily'::character varying,
    low_stock_digest_day_of_week integer DEFAULT 1,
    low_stock_digest_day_of_month integer DEFAULT 1,
    low_stock_digest_time character varying(5) DEFAULT '09:00'::character varying,
    last_digest_sent_at timestamp without time zone,
    meta_oauth_token text,
    meta_oauth_refresh_token text,
    meta_oauth_expires_at timestamp with time zone,
    ads_account_connected boolean DEFAULT false NOT NULL,
    meta_ad_account_id text,
    meta_page_id text,
    meta_page_token text,
    meta_business_id text,
    meta_user_id text,
    CONSTRAINT shops_category_check CHECK (((category IS NULL) OR ((category)::text = ANY ((ARRAY['Repairs and Tech'::character varying, 'Health and Wellness'::character varying, 'Beauty and Personal Care'::character varying, 'Fitness and Lifestyle'::character varying, 'Home and Auto Service'::character varying])::text[])))),
    CONSTRAINT shops_low_stock_digest_day_of_month_check CHECK (((low_stock_digest_day_of_month >= 1) AND (low_stock_digest_day_of_month <= 28))),
    CONSTRAINT shops_low_stock_digest_day_of_week_check CHECK (((low_stock_digest_day_of_week >= 0) AND (low_stock_digest_day_of_week <= 6))),
    CONSTRAINT shops_low_stock_digest_mode_check CHECK (((low_stock_digest_mode)::text = ANY ((ARRAY['immediate'::character varying, 'daily'::character varying, 'weekly'::character varying, 'monthly'::character varying])::text[])))
);


--
-- Name: active_shop_subscriptions; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.active_shop_subscriptions AS
 SELECT s.id,
    s.shop_id,
    s.plan_type,
    s.amount,
    s.currency,
    s.status,
    s.current_period_start,
    s.current_period_end,
    s.created_at,
    s.updated_at,
    s.monthly_amount,
    s.subscription_type,
    s.is_active,
    s.paused_at,
    s.resumed_at,
    s.pause_reason,
    s.notes,
    s.created_by,
    s.billing_method,
    s.billing_reference,
    s.payments_made,
    s.total_paid,
    s.next_payment_date,
    s.last_payment_date,
    s.enrolled_at,
    s.activated_at,
    s.cancelled_at,
    s.cancellation_reason,
    sh.name AS shop_name,
    sh.wallet_address AS shop_wallet,
    sh.email AS shop_email
   FROM (public.shop_subscriptions s
     JOIN public.shops sh ON (((s.shop_id)::text = (sh.shop_id)::text)))
  WHERE (((s.status)::text = 'active'::text) AND (s.is_active = true));


--
-- Name: ad_ai_costs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.ad_ai_costs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    lead_id uuid,
    kind text DEFAULT 'draft_outreach'::text NOT NULL,
    cost_cents numeric(12,4) DEFAULT 0 NOT NULL,
    model text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ad_ai_costs_cost_cents_check CHECK ((cost_cents >= (0)::numeric))
);


--
-- Name: ad_billing_charges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.ad_billing_charges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id text NOT NULL,
    campaign_id uuid,
    period_date date NOT NULL,
    charge_type text NOT NULL,
    basis_cents integer DEFAULT 0 NOT NULL,
    amount_cents integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    stripe_invoice_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ad_billing_charges_amount_cents_check CHECK ((amount_cents >= 0)),
    CONSTRAINT ad_billing_charges_charge_type_check CHECK ((charge_type = ANY (ARRAY['plan_a_dashboard'::text, 'plan_b_margin'::text, 'plan_c_booking'::text, 'plan_c_revenue_share'::text, 'flat_tier_fee'::text]))),
    CONSTRAINT ad_billing_charges_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'invoiced'::text, 'paid'::text, 'void'::text])))
);


--
-- Name: ad_billing_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.ad_billing_plans (
    shop_id text NOT NULL,
    plan_type text DEFAULT 'b'::text NOT NULL,
    markup_bps integer DEFAULT 2000 NOT NULL,
    dashboard_fee_cents integer DEFAULT 29900 NOT NULL,
    per_booking_fee_cents integer DEFAULT 5000 NOT NULL,
    revenue_share_bps integer DEFAULT 1000 NOT NULL,
    plan_c_model text DEFAULT 'per_booking'::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    flat_fee_cents integer DEFAULT 0 NOT NULL,
    flat_tier_name text,
    billing_started_at timestamp with time zone,
    subscription_status text DEFAULT 'active'::text NOT NULL,
    CONSTRAINT ad_billing_plans_dashboard_fee_cents_check CHECK ((dashboard_fee_cents >= 0)),
    CONSTRAINT ad_billing_plans_flat_fee_cents_check CHECK ((flat_fee_cents >= 0)),
    CONSTRAINT ad_billing_plans_markup_bps_check CHECK ((markup_bps >= 0)),
    CONSTRAINT ad_billing_plans_per_booking_fee_cents_check CHECK ((per_booking_fee_cents >= 0)),
    CONSTRAINT ad_billing_plans_plan_c_model_check CHECK ((plan_c_model = ANY (ARRAY['per_booking'::text, 'revenue_share'::text]))),
    CONSTRAINT ad_billing_plans_plan_type_check CHECK ((plan_type = ANY (ARRAY['a'::text, 'b'::text, 'c'::text, 'flat'::text]))),
    CONSTRAINT ad_billing_plans_revenue_share_bps_check CHECK ((revenue_share_bps >= 0)),
    CONSTRAINT ad_billing_plans_subscription_status_check CHECK ((subscription_status = ANY (ARRAY['active'::text, 'past_due'::text, 'paused'::text, 'cancelled'::text])))
);


--
-- Name: ad_campaign_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.ad_campaign_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id text NOT NULL,
    promote_service_ids text[] DEFAULT '{}'::text[] NOT NULL,
    monthly_budget_cents integer,
    offer text,
    target_radius_miles integer,
    goal text,
    message text,
    status text DEFAULT 'pending'::text NOT NULL,
    campaign_id uuid,
    decline_reason text,
    decided_by text,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ad_campaign_requests_goal_check CHECK (((goal IS NULL) OR (goal = ANY (ARRAY['more_bookings'::text, 'awareness'::text, 'promote_service'::text])))),
    CONSTRAINT ad_campaign_requests_monthly_budget_cents_check CHECK (((monthly_budget_cents IS NULL) OR (monthly_budget_cents >= 0))),
    CONSTRAINT ad_campaign_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'building'::text, 'live'::text, 'declined'::text, 'cancelled'::text]))),
    CONSTRAINT ad_campaign_requests_target_radius_miles_check CHECK (((target_radius_miles IS NULL) OR ((target_radius_miles >= 1) AND (target_radius_miles <= 100))))
);


--
-- Name: ad_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.ad_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id text NOT NULL,
    industry_id integer,
    name text NOT NULL,
    platform text DEFAULT 'meta'::text NOT NULL,
    target_radius_miles numeric(6,2),
    target_units text DEFAULT 'mi'::text NOT NULL,
    daily_budget_cents integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    ai_agent_enabled boolean DEFAULT false NOT NULL,
    notes text,
    started_at timestamp with time zone,
    paused_at timestamp with time zone,
    archived_at timestamp with time zone,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    meta_campaign_id text,
    meta_adset_id text,
    meta_ad_id text,
    meta_creative_id text,
    meta_lead_form_id text,
    meta_status text,
    meta_last_synced_at timestamp with time zone,
    CONSTRAINT ad_campaigns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'paused'::text, 'archived'::text]))),
    CONSTRAINT ad_campaigns_target_units_check CHECK ((target_units = ANY (ARRAY['mi'::text, 'km'::text])))
);


--
-- Name: ad_creatives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.ad_creatives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    creative_type text NOT NULL,
    language text DEFAULT 'en'::text NOT NULL,
    landing_url text,
    landing_url_type text,
    headline text,
    body text,
    experiment_id uuid,
    version integer DEFAULT 1 NOT NULL,
    review_status text DEFAULT 'pending'::text NOT NULL,
    reviewed_by text,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    image_url text,
    meta_creative_id text,
    generation_prompt text,
    CONSTRAINT ad_creatives_creative_type_check CHECK ((creative_type = ANY (ARRAY['image'::text, 'video'::text, 'carousel'::text]))),
    CONSTRAINT ad_creatives_landing_url_type_check CHECK ((landing_url_type = ANY (ARRAY['booking_page'::text, 'shop_profile'::text, 'lead_form'::text]))),
    CONSTRAINT ad_creatives_review_status_check CHECK ((review_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: ad_enrollment_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.ad_enrollment_requests (
    shop_id text NOT NULL,
    requested_plan text DEFAULT 'growth'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    message text,
    decided_by text,
    decided_at timestamp with time zone,
    decline_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    promote_service_ids text[] DEFAULT '{}'::text[] NOT NULL,
    monthly_budget_cents integer,
    offer text,
    target_radius_miles integer,
    goal text,
    CONSTRAINT ad_enrollment_requests_goal_check CHECK (((goal IS NULL) OR (goal = ANY (ARRAY['more_bookings'::text, 'awareness'::text, 'promote_service'::text])))),
    CONSTRAINT ad_enrollment_requests_monthly_budget_cents_check CHECK (((monthly_budget_cents IS NULL) OR (monthly_budget_cents >= 0))),
    CONSTRAINT ad_enrollment_requests_requested_plan_check CHECK ((requested_plan = ANY (ARRAY['a'::text, 'b'::text, 'c'::text, 'starter'::text, 'growth'::text, 'business'::text]))),
    CONSTRAINT ad_enrollment_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text]))),
    CONSTRAINT ad_enrollment_requests_target_radius_miles_check CHECK (((target_radius_miles IS NULL) OR ((target_radius_miles >= 1) AND (target_radius_miles <= 100))))
);


--
-- Name: ad_experiments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.ad_experiments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'running'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    winner_creative_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ad_experiments_status_check CHECK ((status = ANY (ARRAY['running'::text, 'ended'::text])))
);


--
-- Name: ad_lead_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.ad_lead_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    direction text NOT NULL,
    author text NOT NULL,
    channel text DEFAULT 'manual'::text NOT NULL,
    body text NOT NULL,
    ai_cost_cents numeric(12,4) DEFAULT 0 NOT NULL,
    delivery_status text DEFAULT 'recorded'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ad_lead_messages_author_check CHECK ((author = ANY (ARRAY['lead'::text, 'ai'::text, 'admin'::text]))),
    CONSTRAINT ad_lead_messages_channel_check CHECK ((channel = ANY (ARRAY['sms'::text, 'whatsapp'::text, 'messenger'::text, 'email'::text, 'manual'::text]))),
    CONSTRAINT ad_lead_messages_delivery_status_check CHECK ((delivery_status = ANY (ARRAY['recorded'::text, 'queued'::text, 'sent'::text, 'delivered'::text, 'failed'::text]))),
    CONSTRAINT ad_lead_messages_direction_check CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text])))
);


--
-- Name: ad_leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.ad_leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    creative_id uuid,
    customer_id text,
    name text,
    phone text,
    email text,
    messenger_id text,
    whatsapp_id text,
    lead_status text DEFAULT 'new'::text NOT NULL,
    assigned_to_employee_id text,
    first_response_at timestamp with time zone,
    consent_to_contact boolean DEFAULT false NOT NULL,
    consent_version text,
    attribution_method text DEFAULT 'manual'::text NOT NULL,
    is_duplicate boolean DEFAULT false NOT NULL,
    ip_address text,
    user_agent text,
    notes text,
    lost_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    meta_lead_id text,
    CONSTRAINT ad_leads_attribution_method_check CHECK ((attribution_method = ANY (ARRAY['manual'::text, 'utm'::text, 'click_id'::text, 'meta_webhook'::text]))),
    CONSTRAINT ad_leads_lead_status_check CHECK ((lead_status = ANY (ARRAY['new'::text, 'contacted'::text, 'booked'::text, 'paid'::text, 'completed'::text, 'lost'::text])))
);


--
-- Name: ad_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.ad_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id text NOT NULL,
    author text NOT NULL,
    body text NOT NULL,
    kind text DEFAULT 'message'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ad_messages_author_check CHECK ((author = ANY (ARRAY['shop'::text, 'admin'::text, 'system'::text]))),
    CONSTRAINT ad_messages_kind_check CHECK ((kind = ANY (ARRAY['message'::text, 'event'::text])))
);


--
-- Name: ad_performance_daily; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.ad_performance_daily (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    date date NOT NULL,
    timezone text DEFAULT 'America/New_York'::text NOT NULL,
    spend_cents integer DEFAULT 0 NOT NULL,
    impressions integer DEFAULT 0 NOT NULL,
    clicks integer DEFAULT 0 NOT NULL,
    leads_captured integer DEFAULT 0 NOT NULL,
    conversations_started integer DEFAULT 0 NOT NULL,
    messages_received integer DEFAULT 0 NOT NULL,
    avg_first_response_minutes numeric(8,2),
    bookings_created integer DEFAULT 0 NOT NULL,
    revenue_cents integer DEFAULT 0 NOT NULL,
    revenue_30d_cents integer,
    revenue_90d_cents integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ad_plan_changes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.ad_plan_changes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id text NOT NULL,
    from_tier text,
    to_tier text,
    kind text NOT NULL,
    status text DEFAULT 'applied'::text NOT NULL,
    effective_at timestamp with time zone DEFAULT now() NOT NULL,
    prorated_amount_cents integer DEFAULT 0 NOT NULL,
    requested_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ad_plan_changes_kind_check CHECK ((kind = ANY (ARRAY['upgrade'::text, 'downgrade'::text, 'cancel'::text]))),
    CONSTRAINT ad_plan_changes_status_check CHECK ((status = ANY (ARRAY['applied'::text, 'scheduled'::text, 'cancelled'::text])))
);


--
-- Name: ad_safeguards_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.ad_safeguards_state (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    auto_pause_threshold_cents integer DEFAULT 40000 NOT NULL,
    auto_pause_no_bookings_cents integer DEFAULT 80000 NOT NULL,
    paused_by_safeguard_at timestamp with time zone,
    paused_reason text,
    notes text
);


--
-- Name: admin_activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.admin_activity_logs (
    id integer NOT NULL,
    admin_address character varying(42) NOT NULL,
    action character varying(100) NOT NULL,
    details jsonb,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: admin_activity_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admin_activity_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admin_activity_logs_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admin_activity_logs_id_seq1
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admin_activity_logs_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admin_activity_logs_id_seq1 OWNED BY public.admin_activity_logs.id;


--
-- Name: admin_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.admin_alerts (
    id integer NOT NULL,
    type character varying(50) NOT NULL,
    severity character varying(20) NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    metadata jsonb,
    acknowledged boolean DEFAULT false,
    acknowledged_by character varying(42),
    acknowledged_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    alert_type character varying(50) DEFAULT 'system'::character varying NOT NULL
);


--
-- Name: admin_alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admin_alerts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admin_alerts_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admin_alerts_id_seq1
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admin_alerts_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admin_alerts_id_seq1 OWNED BY public.admin_alerts.id;


--
-- Name: admin_role_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.admin_role_audit (
    id integer NOT NULL,
    wallet_address character varying(42) NOT NULL,
    action character varying(50) NOT NULL,
    previous_role character varying(20),
    promotion_action character varying(20),
    reason text,
    promoted_by character varying(42),
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    details jsonb
);


--
-- Name: admin_role_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admin_role_audit_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admin_role_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admin_role_audit_id_seq OWNED BY public.admin_role_audit.id;


--
-- Name: admin_treasury; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.admin_treasury (
    id integer DEFAULT 1 NOT NULL,
    total_supply numeric(20,8) DEFAULT NULL::numeric,
    available_supply numeric(20,8) DEFAULT NULL::numeric,
    total_sold numeric(20,8) DEFAULT 0,
    total_revenue numeric(20,8) DEFAULT 0,
    last_updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    supply_model character varying(20) DEFAULT 'unlimited'::character varying,
    circulating_supply numeric(20,8) DEFAULT 0,
    notes text
);


--
-- Name: admins_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admins_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.admins (
    id integer DEFAULT nextval('public.admins_id_seq'::regclass) NOT NULL,
    wallet_address character varying(42) NOT NULL,
    permissions jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_login timestamp without time zone,
    name character varying(255),
    email character varying(255),
    phone character varying(50),
    is_active boolean DEFAULT true,
    is_super_admin boolean DEFAULT false,
    created_by character varying(42),
    metadata jsonb DEFAULT '{}'::jsonb,
    last_login_at timestamp without time zone,
    role character varying(50)
);


--
-- Name: affiliate_group_token_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.affiliate_group_token_transactions (
    id character varying(100) NOT NULL,
    group_id character varying(100) NOT NULL,
    customer_address character varying(42) NOT NULL,
    shop_id character varying(100) NOT NULL,
    type character varying(20) NOT NULL,
    amount numeric(20,8) NOT NULL,
    balance_before numeric(20,8),
    balance_after numeric(20,8),
    reason text,
    metadata jsonb DEFAULT '{}'::jsonb,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: shop_group_members_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shop_group_members_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: affiliate_shop_group_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.affiliate_shop_group_members (
    id integer DEFAULT nextval('public.shop_group_members_id_seq'::regclass) NOT NULL,
    group_id character varying(100) NOT NULL,
    shop_id character varying(100) NOT NULL,
    role character varying(20) DEFAULT 'member'::character varying,
    status character varying(20) DEFAULT 'pending'::character varying,
    joined_at timestamp without time zone,
    request_message text,
    requested_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    approved_by_shop_id character varying(100),
    approved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: affiliate_shop_group_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.affiliate_shop_group_settings (
    group_id character varying(100) NOT NULL,
    daily_earning_limit numeric(20,8),
    minimum_redemption numeric(20,8),
    maximum_redemption numeric(20,8),
    require_minimum_spend boolean DEFAULT false,
    minimum_spend_amount numeric(10,2),
    settings_json jsonb DEFAULT '{}'::jsonb,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: affiliate_shop_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.affiliate_shop_groups (
    group_id character varying(100) NOT NULL,
    group_name character varying(255) NOT NULL,
    description text,
    custom_token_name character varying(100) NOT NULL,
    custom_token_symbol character varying(10) NOT NULL,
    token_value_usd numeric(10,4),
    created_by_shop_id character varying(100) NOT NULL,
    group_type character varying(20) DEFAULT 'public'::character varying,
    logo_url text,
    invite_code character varying(50) NOT NULL,
    auto_approve_requests boolean DEFAULT false,
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    icon character varying(10) DEFAULT '🏪'::character varying
);


--
-- Name: ai_agent_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.ai_agent_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id character varying(255) NOT NULL,
    service_id character varying(255),
    shop_id character varying(255) NOT NULL,
    customer_address character varying(255) NOT NULL,
    request_payload jsonb NOT NULL,
    response_payload jsonb,
    model character varying(50) NOT NULL,
    input_tokens integer DEFAULT 0 NOT NULL,
    output_tokens integer DEFAULT 0 NOT NULL,
    cached_input_tokens integer DEFAULT 0 NOT NULL,
    cost_usd numeric(10,6) DEFAULT 0 NOT NULL,
    tool_calls jsonb DEFAULT '[]'::jsonb,
    latency_ms integer,
    escalated_to_human boolean DEFAULT false NOT NULL,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: ai_customer_chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.ai_customer_chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    role character varying(20) NOT NULL,
    content text NOT NULL,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT ai_customer_chat_messages_role_check CHECK (((role)::text = ANY ((ARRAY['user'::character varying, 'assistant'::character varying])::text[])))
);


--
-- Name: ai_customer_chat_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.ai_customer_chat_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_address character varying(42),
    session_token character varying(255) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: ai_dispatch_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.ai_dispatch_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id character varying(255) NOT NULL,
    session_id character varying(255) NOT NULL,
    transcript text NOT NULL,
    transcript_source character varying(20) NOT NULL,
    router_decision character varying(20) NOT NULL,
    router_input_tokens integer DEFAULT 0 NOT NULL,
    router_output_tokens integer DEFAULT 0 NOT NULL,
    router_cost_usd numeric(10,6) DEFAULT 0 NOT NULL,
    latency_ms integer NOT NULL,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    original_transcript text,
    CONSTRAINT check_router_decision_valid CHECK (((router_decision)::text = ANY ((ARRAY['insights'::character varying, 'marketing'::character varying, 'help'::character varying, 'out_of_scope'::character varying, 'error'::character varying])::text[]))),
    CONSTRAINT check_transcript_source_valid CHECK (((transcript_source)::text = ANY ((ARRAY['voice'::character varying, 'inline_mic'::character varying])::text[])))
);


--
-- Name: ai_help_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.ai_help_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id character varying(255) NOT NULL,
    session_id character varying(255) NOT NULL,
    request_payload jsonb NOT NULL,
    response_payload jsonb,
    model character varying(50) NOT NULL,
    input_tokens integer DEFAULT 0 NOT NULL,
    output_tokens integer DEFAULT 0 NOT NULL,
    cached_input_tokens integer DEFAULT 0 NOT NULL,
    cost_usd numeric(10,6) DEFAULT 0 NOT NULL,
    latency_ms integer,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: ai_image_generations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.ai_image_generations (
    id bigint NOT NULL,
    shop_id character varying(255) NOT NULL,
    operation_type character varying(16) NOT NULL,
    vendor character varying(32) NOT NULL,
    model character varying(64) NOT NULL,
    prompt text NOT NULL,
    source_image_url text,
    image_url text,
    image_key text,
    dimensions character varying(16),
    use_case character varying(32),
    cost_usd numeric(10,6) DEFAULT 0 NOT NULL,
    latency_ms integer,
    moderation_flagged boolean DEFAULT false NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_image_generations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ai_image_generations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ai_image_generations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ai_image_generations_id_seq OWNED BY public.ai_image_generations.id;


--
-- Name: ai_insights_anomalies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.ai_insights_anomalies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id character varying(255) NOT NULL,
    metric_key character varying(64) NOT NULL,
    detected_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    current_value numeric NOT NULL,
    prior_value numeric NOT NULL,
    delta_value numeric NOT NULL,
    delta_pct numeric,
    z_score numeric,
    severity character varying(16) NOT NULL,
    claude_phrasing text,
    follow_up_question text,
    dismissed_at timestamp without time zone,
    expires_at timestamp without time zone NOT NULL,
    CONSTRAINT ck_severity CHECK (((severity)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying])::text[])))
);


--
-- Name: ai_insights_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.ai_insights_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id character varying(255) NOT NULL,
    session_id character varying(255) NOT NULL,
    request_payload jsonb NOT NULL,
    response_payload jsonb,
    model character varying(50) NOT NULL,
    input_tokens integer DEFAULT 0 NOT NULL,
    output_tokens integer DEFAULT 0 NOT NULL,
    cached_input_tokens integer DEFAULT 0 NOT NULL,
    cost_usd numeric(10,6) DEFAULT 0 NOT NULL,
    tool_calls jsonb DEFAULT '[]'::jsonb NOT NULL,
    latency_ms integer,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: ai_insights_pinned_queries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.ai_insights_pinned_queries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id character varying(255) NOT NULL,
    question_text character varying(2000) NOT NULL,
    pinned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_run_at timestamp without time zone,
    last_response_excerpt text,
    display_order integer DEFAULT 0 NOT NULL
);


--
-- Name: ai_marketing_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.ai_marketing_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id character varying(255) NOT NULL,
    session_id character varying(255) NOT NULL,
    request_payload jsonb NOT NULL,
    response_payload jsonb,
    model character varying(50) NOT NULL,
    input_tokens integer DEFAULT 0 NOT NULL,
    output_tokens integer DEFAULT 0 NOT NULL,
    cached_input_tokens integer DEFAULT 0 NOT NULL,
    cost_usd numeric(10,6) DEFAULT 0 NOT NULL,
    tool_calls jsonb DEFAULT '[]'::jsonb NOT NULL,
    latency_ms integer,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: ai_orchestrate_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.ai_orchestrate_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id character varying(255) NOT NULL,
    session_id character varying(255) NOT NULL,
    request_payload jsonb NOT NULL,
    response_payload jsonb,
    model character varying(50) NOT NULL,
    input_tokens integer DEFAULT 0 NOT NULL,
    output_tokens integer DEFAULT 0 NOT NULL,
    cached_input_tokens integer DEFAULT 0 NOT NULL,
    cost_usd numeric(10,6) DEFAULT 0 NOT NULL,
    tool_calls jsonb DEFAULT '[]'::jsonb NOT NULL,
    latency_ms integer,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: ai_shop_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.ai_shop_settings (
    shop_id character varying(255) NOT NULL,
    ai_global_enabled boolean DEFAULT false NOT NULL,
    monthly_budget_usd numeric(10,2) DEFAULT 20.00 NOT NULL,
    current_month_spend_usd numeric(10,2) DEFAULT 0 NOT NULL,
    current_month_started_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    escalation_threshold integer DEFAULT 5 NOT NULL,
    business_hours_only_ai boolean DEFAULT false NOT NULL,
    blacklist_keywords text[] DEFAULT ARRAY[]::text[],
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    ai_followup_enabled boolean DEFAULT false NOT NULL,
    ai_followup_delay_minutes integer DEFAULT 20 NOT NULL,
    human_reply_baseline_minutes integer DEFAULT 240 NOT NULL,
    assistant_name character varying(40),
    ai_images_enabled boolean DEFAULT false NOT NULL,
    campaign_rewards_enabled boolean DEFAULT false NOT NULL,
    CONSTRAINT ai_shop_settings_human_reply_baseline_range CHECK (((human_reply_baseline_minutes >= 15) AND (human_reply_baseline_minutes <= 1440)))
);


--
-- Name: ai_voice_transcriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.ai_voice_transcriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id character varying(255) NOT NULL,
    session_id character varying(255) NOT NULL,
    duration_ms integer NOT NULL,
    audio_size_bytes integer NOT NULL,
    cost_usd numeric(10,6) DEFAULT 0 NOT NULL,
    transcript text,
    latency_ms integer NOT NULL,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: appointment_reschedule_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.appointment_reschedule_requests (
    request_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    order_id character varying(255) NOT NULL,
    shop_id character varying(255) NOT NULL,
    customer_address character varying(255) NOT NULL,
    original_date date NOT NULL,
    original_time_slot time without time zone NOT NULL,
    original_end_time time without time zone,
    requested_date date NOT NULL,
    requested_time_slot time without time zone NOT NULL,
    requested_end_time time without time zone,
    customer_reason text,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    shop_response_reason text,
    responded_at timestamp without time zone,
    responded_by character varying(255),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    expires_at timestamp without time zone
);


--
-- Name: archived_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.archived_transactions (
    id integer NOT NULL,
    original_transaction_id integer NOT NULL,
    transaction_type character varying(50) NOT NULL,
    from_address character varying(255),
    to_address character varying(255),
    amount numeric(20,2) NOT NULL,
    shop_id character varying(255),
    customer_address character varying(255),
    metadata jsonb,
    status character varying(50),
    transaction_hash character varying(255),
    block_number bigint,
    created_at timestamp with time zone NOT NULL,
    archived_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    archived_reason text
);


--
-- Name: archived_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.archived_transactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: archived_transactions_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.archived_transactions_id_seq1
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: archived_transactions_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.archived_transactions_id_seq1 OWNED BY public.archived_transactions.id;


--
-- Name: auto_message_sends; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.auto_message_sends (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auto_message_id uuid NOT NULL,
    shop_id character varying(100) NOT NULL,
    customer_address character varying(255) NOT NULL,
    conversation_id character varying(100),
    message_id character varying(100),
    trigger_reference character varying(255),
    status character varying(20) DEFAULT 'sent'::character varying,
    scheduled_send_at timestamp with time zone,
    sent_at timestamp with time zone DEFAULT now()
);


--
-- Name: blocked_customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.blocked_customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id text NOT NULL,
    customer_id text,
    customer_wallet_address text NOT NULL,
    customer_name text,
    customer_email text,
    reason text NOT NULL,
    blocked_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    blocked_by text NOT NULL,
    unblocked_at timestamp with time zone,
    unblocked_by text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: brand_template_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.brand_template_assets (
    id bigint NOT NULL,
    shop_id text NOT NULL,
    kind text NOT NULL,
    template_key text DEFAULT 'default'::text NOT NULL,
    url text NOT NULL,
    size text,
    cost_usd numeric(10,6) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: brand_template_assets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.brand_template_assets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: brand_template_assets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.brand_template_assets_id_seq OWNED BY public.brand_template_assets.id;


--
-- Name: bug_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.bug_reports (
    id integer NOT NULL,
    wallet_address character varying(42) NOT NULL,
    role character varying(20) NOT NULL,
    category character varying(50) NOT NULL,
    title character varying(100) NOT NULL,
    description text NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: bug_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bug_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bug_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bug_reports_id_seq OWNED BY public.bug_reports.id;


--
-- Name: campaign_recipients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.campaign_recipients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    delivery_type text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    error_message text,
    sent_at timestamp without time zone,
    delivered_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT campaign_recipients_delivery_type_check CHECK ((delivery_type = ANY (ARRAY['email'::text, 'sms'::text]))),
    CONSTRAINT campaign_recipients_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'bounced'::text, 'delivered'::text])))
);


--
-- Name: commitment_benefits_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.commitment_benefits_log (
    id integer NOT NULL,
    shop_id character varying(255) NOT NULL,
    subscription_id character varying(50) NOT NULL,
    benefit_type character varying(100) NOT NULL,
    benefit_value jsonb NOT NULL,
    used_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    metadata jsonb DEFAULT '{}'::jsonb
);


--
-- Name: commitment_benefits_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.commitment_benefits_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: commitment_benefits_log_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.commitment_benefits_log_id_seq1
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: commitment_benefits_log_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.commitment_benefits_log_id_seq1 OWNED BY public.commitment_benefits_log.id;


--
-- Name: commitment_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.commitment_payments (
    id integer NOT NULL,
    subscription_id character varying(50) NOT NULL,
    shop_id character varying(255) NOT NULL,
    payment_id character varying(50) NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying,
    payment_method character varying(50) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    external_payment_id character varying(255),
    transaction_reference character varying(255),
    due_date date NOT NULL,
    paid_at timestamp without time zone,
    failed_at timestamp without time zone,
    retry_count integer DEFAULT 0,
    next_retry_at timestamp without time zone,
    failure_reason text,
    failure_code character varying(100),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: commitment_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.commitment_payments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: commitment_payments_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.commitment_payments_id_seq1
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: commitment_payments_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.commitment_payments_id_seq1 OWNED BY public.commitment_payments.id;


--
-- Name: commitment_payments_payment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.commitment_payments_payment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: commitment_payments_payment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.commitment_payments_payment_id_seq OWNED BY public.commitment_payments.payment_id;


--
-- Name: commitment_retry_schedule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.commitment_retry_schedule (
    id integer NOT NULL,
    payment_id character varying(50) NOT NULL,
    retry_number integer NOT NULL,
    scheduled_at timestamp without time zone NOT NULL,
    attempted_at timestamp without time zone,
    status character varying(50) DEFAULT 'scheduled'::character varying,
    failure_reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: commitment_retry_schedule_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.commitment_retry_schedule_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: commitment_retry_schedule_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.commitment_retry_schedule_id_seq1
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: commitment_retry_schedule_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.commitment_retry_schedule_id_seq1 OWNED BY public.commitment_retry_schedule.id;


--
-- Name: commitment_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.commitment_subscriptions (
    id integer NOT NULL,
    shop_id character varying(255) NOT NULL,
    subscription_id character varying(50) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    monthly_amount numeric(10,2) DEFAULT 500.00 NOT NULL,
    billing_method character varying(50) NOT NULL,
    billing_day integer DEFAULT 1 NOT NULL,
    payments_made integer DEFAULT 0,
    total_paid numeric(12,2) DEFAULT 0,
    last_payment_date timestamp without time zone,
    next_payment_date timestamp without time zone,
    enrolled_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    activated_at timestamp without time zone,
    paused_at timestamp without time zone,
    cancelled_at timestamp without time zone,
    cancellation_reason text,
    expires_at timestamp without time zone,
    billing_email character varying(255),
    billing_contact character varying(255),
    billing_phone character varying(50),
    billing_address jsonb,
    payment_details jsonb DEFAULT '{}'::jsonb,
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: commitment_subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.commitment_subscriptions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: commitment_subscriptions_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.commitment_subscriptions_id_seq1
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: commitment_subscriptions_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.commitment_subscriptions_id_seq1 OWNED BY public.commitment_subscriptions.id;


--
-- Name: commitment_subscriptions_subscription_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.commitment_subscriptions_subscription_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: commitment_subscriptions_subscription_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.commitment_subscriptions_subscription_id_seq OWNED BY public.commitment_subscriptions.subscription_id;


--
-- Name: communication_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.communication_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id text NOT NULL,
    campaign_name text NOT NULL,
    campaign_type text NOT NULL,
    subject text,
    message_template text NOT NULL,
    target_status text[] DEFAULT ARRAY['active'::text],
    target_tags text[],
    total_recipients integer DEFAULT 0,
    sent_count integer DEFAULT 0,
    failed_count integer DEFAULT 0,
    status text DEFAULT 'draft'::text NOT NULL,
    scheduled_at timestamp without time zone,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    created_by text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT communication_campaigns_campaign_type_check CHECK ((campaign_type = ANY (ARRAY['email'::text, 'sms'::text, 'both'::text]))),
    CONSTRAINT communication_campaigns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'sending'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: contact_imports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.contact_imports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id text NOT NULL,
    full_name text NOT NULL,
    email text,
    phone text,
    status text DEFAULT 'active'::text NOT NULL,
    source text DEFAULT 'manual'::text,
    tags text[],
    notes text,
    email_sent_count integer DEFAULT 0,
    sms_sent_count integer DEFAULT 0,
    last_email_sent_at timestamp without time zone,
    last_sms_sent_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT contact_imports_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'csv'::text, 'api'::text]))),
    CONSTRAINT contact_imports_status_check CHECK ((status = ANY (ARRAY['active'::text, 'unsubscribed'::text, 'bounced'::text, 'invalid'::text]))),
    CONSTRAINT contact_method_required CHECK (((email IS NOT NULL) OR (phone IS NOT NULL)))
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.conversations (
    conversation_id character varying(255) NOT NULL,
    customer_address character varying(255) NOT NULL,
    shop_id character varying(255) NOT NULL,
    last_message_at timestamp without time zone,
    last_message_preview text,
    unread_count_customer integer DEFAULT 0,
    unread_count_shop integer DEFAULT 0,
    is_archived_customer boolean DEFAULT false,
    is_archived_shop boolean DEFAULT false,
    is_blocked boolean DEFAULT false,
    blocked_by character varying(20),
    blocked_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    status character varying(20) DEFAULT 'open'::character varying,
    service_id character varying(255),
    ai_paused_until timestamp with time zone,
    CONSTRAINT conversations_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'resolved'::character varying])::text[])))
);


--
-- Name: cross_shop_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.cross_shop_verifications (
    verification_id character varying(100) NOT NULL,
    customer_address character varying(42) NOT NULL,
    from_shop_id character varying(100) NOT NULL,
    to_shop_id character varying(100) NOT NULL,
    requested_amount numeric(18,2) NOT NULL,
    max_allowed_amount numeric(18,2) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    expires_at timestamp without time zone NOT NULL,
    used_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: customer_group_balances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_group_balances_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customer_affiliate_group_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.customer_affiliate_group_balances (
    id integer DEFAULT nextval('public.customer_group_balances_id_seq'::regclass) NOT NULL,
    customer_address character varying(42) NOT NULL,
    group_id character varying(100) NOT NULL,
    balance numeric(20,8) DEFAULT 0,
    lifetime_earned numeric(20,8) DEFAULT 0,
    lifetime_redeemed numeric(20,8) DEFAULT 0,
    last_transaction_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.customers (
    address character varying(42) NOT NULL,
    name character varying(255),
    email character varying(255),
    phone character varying(20),
    wallet_address character varying(42) NOT NULL,
    is_active boolean DEFAULT true,
    lifetime_earnings numeric(20,8) DEFAULT 0,
    tier character varying(20) DEFAULT 'BRONZE'::character varying,
    last_earned_date date DEFAULT CURRENT_DATE,
    referral_count integer DEFAULT 0,
    referral_code character varying(20),
    referred_by character varying(42),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    auth_method character varying(20) DEFAULT 'wallet'::character varying,
    email_verified boolean DEFAULT false,
    home_shop_id character varying(100),
    suspended_at timestamp without time zone,
    suspension_reason text,
    wallet_type character varying(20) DEFAULT 'external'::character varying,
    current_rcn_balance numeric(20,8) DEFAULT 0,
    pending_mint_balance numeric(20,8) DEFAULT 0,
    last_blockchain_sync timestamp without time zone,
    total_redemptions numeric(20,8) DEFAULT 0,
    first_name character varying(100),
    last_name character varying(100),
    no_show_count integer DEFAULT 0,
    no_show_tier character varying(20) DEFAULT 'normal'::character varying,
    deposit_required boolean DEFAULT false,
    last_no_show_at timestamp without time zone,
    booking_suspended_until timestamp without time zone,
    successful_appointments_since_tier3 integer DEFAULT 0,
    profile_image_url character varying(512),
    CONSTRAINT chk_no_show_tier CHECK (((no_show_tier)::text = ANY ((ARRAY['normal'::character varying, 'warning'::character varying, 'caution'::character varying, 'deposit_required'::character varying, 'suspended'::character varying])::text[])))
);


--
-- Name: customer_balance_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.customer_balance_summary AS
 SELECT address,
    name,
    tier,
    lifetime_earnings,
    current_rcn_balance,
    pending_mint_balance,
    total_redemptions,
    last_blockchain_sync,
    is_active,
    (current_rcn_balance + pending_mint_balance) AS total_balance,
    (lifetime_earnings - total_redemptions) AS calculated_balance,
    (abs((current_rcn_balance - (lifetime_earnings - total_redemptions))) < 0.00000001) AS balance_synced
   FROM public.customers c
  WHERE (is_active = true)
  ORDER BY current_rcn_balance DESC;


--
-- Name: customer_notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.customer_notification_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_address character varying(255) NOT NULL,
    email_enabled boolean DEFAULT true,
    sms_enabled boolean DEFAULT false,
    in_app_enabled boolean DEFAULT true,
    reminder_24h_enabled boolean DEFAULT true,
    reminder_2h_enabled boolean DEFAULT true,
    reminder_30m_enabled boolean DEFAULT false,
    quiet_hours_enabled boolean DEFAULT false,
    quiet_hours_start time without time zone,
    quiet_hours_end time without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: customer_rcn_sources_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_rcn_sources_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customer_rcn_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.customer_rcn_sources (
    id integer DEFAULT nextval('public.customer_rcn_sources_id_seq'::regclass) NOT NULL,
    customer_address character varying(42) NOT NULL,
    source_type character varying(50) NOT NULL,
    source_shop_id character varying(50),
    amount numeric(20,8) NOT NULL,
    transaction_id character varying(100),
    transaction_hash character varying(66),
    earned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_redeemable boolean DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb
);


--
-- Name: customers_backup_20250919; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.customers_backup_20250919 (
    address character varying(42),
    name character varying(255),
    email character varying(255),
    phone character varying(20),
    wallet_address character varying(42),
    is_active boolean,
    lifetime_earnings numeric(20,8),
    tier character varying(20),
    daily_earnings numeric(20,8),
    monthly_earnings numeric(20,8),
    last_earned_date date,
    referral_count integer,
    referral_code character varying(10),
    referred_by character varying(10),
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: deposit_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.deposit_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    customer_address character varying(255) NOT NULL,
    shop_id character varying(255) NOT NULL,
    amount numeric(10,2) NOT NULL,
    status character varying(20) DEFAULT 'held'::character varying NOT NULL,
    stripe_payment_intent_id character varying(255),
    stripe_charge_id character varying(255),
    stripe_refund_id character varying(255),
    charged_at timestamp without time zone DEFAULT now() NOT NULL,
    refunded_at timestamp without time zone,
    forfeited_at timestamp without time zone,
    reason text,
    refund_reason text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT chk_deposit_status CHECK (((status)::text = ANY ((ARRAY['held'::character varying, 'refunded'::character varying, 'forfeited'::character varying])::text[])))
);


--
-- Name: device_push_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.device_push_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    wallet_address character varying(42) NOT NULL,
    expo_push_token character varying(255),
    device_id character varying(255),
    device_type character varying(20) NOT NULL,
    device_name character varying(100),
    app_version character varying(20),
    is_active boolean DEFAULT true,
    last_used_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    web_push_subscription jsonb,
    CONSTRAINT device_push_tokens_device_type_check CHECK (((device_type)::text = ANY ((ARRAY['ios'::character varying, 'android'::character varying, 'web'::character varying])::text[]))),
    CONSTRAINT push_token_type_check CHECK (((((device_type)::text = ANY ((ARRAY['ios'::character varying, 'android'::character varying])::text[])) AND (expo_push_token IS NOT NULL)) OR (((device_type)::text = 'web'::text) AND (web_push_subscription IS NOT NULL))))
);


--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.email_templates (
    id integer NOT NULL,
    template_key character varying(100) NOT NULL,
    template_name character varying(255) NOT NULL,
    category character varying(50) NOT NULL,
    subject character varying(255) NOT NULL,
    body_html text NOT NULL,
    body_text text,
    variables jsonb DEFAULT '[]'::jsonb,
    enabled boolean DEFAULT true,
    is_default boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(255),
    modified_by character varying(255),
    last_sent_at timestamp without time zone,
    CONSTRAINT email_templates_category_check CHECK (((category)::text = ANY ((ARRAY['welcome'::character varying, 'booking'::character varying, 'transaction'::character varying, 'shop'::character varying, 'support'::character varying])::text[])))
);


--
-- Name: email_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.email_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: email_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.email_templates_id_seq OWNED BY public.email_templates.id;


--
-- Name: emergency_freeze_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.emergency_freeze_audit (
    id integer NOT NULL,
    action_type character varying(50) NOT NULL,
    reason text NOT NULL,
    admin_address character varying(42) NOT NULL,
    admin_email character varying(255),
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    metadata jsonb,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT emergency_freeze_audit_action_type_check CHECK (((action_type)::text = ANY ((ARRAY['freeze'::character varying, 'unfreeze'::character varying])::text[]))),
    CONSTRAINT emergency_freeze_audit_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])))
);


--
-- Name: emergency_freeze_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.emergency_freeze_audit_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: emergency_freeze_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.emergency_freeze_audit_id_seq OWNED BY public.emergency_freeze_audit.id;


--
-- Name: flagged_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.flagged_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    review_id uuid NOT NULL,
    shop_id text NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    reviewed_by text,
    reviewed_at timestamp with time zone,
    admin_notes text,
    flagged_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT flagged_reviews_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'removed'::text])))
);


--
-- Name: general_notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.general_notification_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_address character varying(255) NOT NULL,
    user_type character varying(20) NOT NULL,
    platform_updates boolean DEFAULT true,
    maintenance_alerts boolean DEFAULT true,
    new_features boolean DEFAULT false,
    security_alerts boolean DEFAULT true,
    login_notifications boolean DEFAULT false,
    password_changes boolean DEFAULT true,
    token_received boolean DEFAULT true,
    token_redeemed boolean DEFAULT true,
    rewards_earned boolean DEFAULT true,
    order_updates boolean DEFAULT true,
    service_approved boolean DEFAULT true,
    review_requests boolean DEFAULT false,
    new_orders boolean DEFAULT true,
    customer_messages boolean DEFAULT true,
    low_token_balance boolean DEFAULT true,
    subscription_reminders boolean DEFAULT true,
    system_alerts boolean DEFAULT true,
    user_reports boolean DEFAULT true,
    treasury_changes boolean DEFAULT true,
    promotions boolean DEFAULT false,
    newsletter boolean DEFAULT false,
    surveys boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    payment_reminders boolean DEFAULT true,
    payment_failure_alerts boolean DEFAULT true,
    subscription_renewal_notices boolean DEFAULT true,
    subscription_expiration_warnings boolean DEFAULT true,
    payment_method_expiring boolean DEFAULT false,
    billing_receipt_notifications boolean DEFAULT true,
    CONSTRAINT general_notification_preferences_user_type_check CHECK (((user_type)::text = ANY ((ARRAY['customer'::character varying, 'shop'::character varying, 'admin'::character varying])::text[])))
);


--
-- Name: idempotency_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
    id integer NOT NULL,
    idempotency_key character varying(255) NOT NULL,
    shop_id character varying(255) NOT NULL,
    endpoint character varying(100) DEFAULT 'issue-reward'::character varying NOT NULL,
    request_hash character varying(64),
    response_status integer NOT NULL,
    response_body jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: idempotency_keys_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.idempotency_keys_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: idempotency_keys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.idempotency_keys_id_seq OWNED BY public.idempotency_keys.id;


--
-- Name: import_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.import_jobs (
    job_id character varying(100) NOT NULL,
    shop_id character varying(100) NOT NULL,
    entity_type character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'processing'::character varying,
    mode character varying(20) NOT NULL,
    dry_run boolean DEFAULT false,
    file_name character varying(255) NOT NULL,
    file_size integer NOT NULL,
    file_type character varying(50) NOT NULL,
    total_rows integer DEFAULT 0,
    valid_rows integer DEFAULT 0,
    invalid_rows integer DEFAULT 0,
    imported_count integer DEFAULT 0,
    updated_count integer DEFAULT 0,
    skipped_count integer DEFAULT 0,
    deleted_count integer DEFAULT 0,
    errors jsonb DEFAULT '[]'::jsonb,
    warnings jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    progress integer DEFAULT 0,
    uploaded_by character varying(42) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    processing_time numeric(10,2),
    expires_at timestamp without time zone DEFAULT (now() + '24:00:00'::interval),
    CONSTRAINT import_jobs_entity_type_check CHECK (((entity_type)::text = ANY ((ARRAY['service'::character varying, 'customer'::character varying])::text[]))),
    CONSTRAINT import_jobs_mode_check CHECK (((mode)::text = ANY ((ARRAY['add'::character varying, 'merge'::character varying, 'replace'::character varying])::text[]))),
    CONSTRAINT import_jobs_progress_check CHECK (((progress >= 0) AND (progress <= 100))),
    CONSTRAINT import_jobs_status_check CHECK (((status)::text = ANY ((ARRAY['processing'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])))
);


--
-- Name: industries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.industries (
    id integer NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: industries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.industries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: industries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.industries_id_seq OWNED BY public.industries.id;


--
-- Name: inventory_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.inventory_adjustments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_id uuid NOT NULL,
    shop_id character varying(255) NOT NULL,
    adjustment_type character varying(50) NOT NULL,
    quantity_change integer NOT NULL,
    quantity_before integer NOT NULL,
    quantity_after integer NOT NULL,
    reference_type character varying(50),
    reference_id character varying(255),
    reason text,
    notes text,
    adjusted_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_adjustment_type_valid CHECK (((adjustment_type)::text = ANY ((ARRAY['manual'::character varying, 'purchase'::character varying, 'sale'::character varying, 'return'::character varying, 'damage'::character varying, 'loss'::character varying, 'recount'::character varying, 'transfer'::character varying])::text[])))
);


--
-- Name: inventory_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.inventory_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id character varying(255) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    icon character varying(50),
    display_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone
);


--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.inventory_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id character varying(255) NOT NULL,
    category_id uuid,
    vendor_id uuid,
    name character varying(255) NOT NULL,
    description text,
    sku character varying(100),
    barcode character varying(100),
    price numeric(10,2) DEFAULT 0 NOT NULL,
    cost numeric(10,2) DEFAULT 0,
    stock_quantity integer DEFAULT 0 NOT NULL,
    reserved_quantity integer DEFAULT 0 NOT NULL,
    low_stock_threshold integer DEFAULT 5,
    status character varying(50) DEFAULT 'available'::character varying NOT NULL,
    images jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone,
    CONSTRAINT check_cost_non_negative CHECK ((cost >= (0)::numeric)),
    CONSTRAINT check_low_stock_threshold CHECK ((low_stock_threshold >= 0)),
    CONSTRAINT check_price_non_negative CHECK ((price >= (0)::numeric)),
    CONSTRAINT check_reserved_not_exceed_stock CHECK ((reserved_quantity <= stock_quantity)),
    CONSTRAINT check_reserved_quantity CHECK ((reserved_quantity >= 0)),
    CONSTRAINT check_status_valid CHECK (((status)::text = ANY ((ARRAY['available'::character varying, 'low_stock'::character varying, 'out_of_stock'::character varying, 'discontinued'::character varying])::text[]))),
    CONSTRAINT check_stock_quantity CHECK ((stock_quantity >= 0))
);


--
-- Name: inventory_vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.inventory_vendors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    contact_name character varying(255),
    email character varying(255),
    phone character varying(50),
    address text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone,
    lead_time_days integer DEFAULT 7,
    CONSTRAINT check_lead_time_days CHECK (((lead_time_days >= 1) AND (lead_time_days <= 365)))
);


--
-- Name: inventory_items_with_availability; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.inventory_items_with_availability AS
 SELECT ii.id,
    ii.shop_id,
    ii.category_id,
    ii.vendor_id,
    ii.name,
    ii.description,
    ii.sku,
    ii.barcode,
    ii.price,
    ii.cost,
    ii.stock_quantity,
    ii.reserved_quantity,
    ii.low_stock_threshold,
    ii.status,
    ii.images,
    ii.metadata,
    ii.created_at,
    ii.updated_at,
    ii.deleted_at,
    (ii.stock_quantity - ii.reserved_quantity) AS available_quantity,
    ic.name AS category_name,
    iv.name AS vendor_name,
        CASE
            WHEN (ii.stock_quantity = 0) THEN 'out_of_stock'::text
            WHEN (ii.stock_quantity <= ii.low_stock_threshold) THEN 'low_stock'::text
            ELSE 'available'::text
        END AS calculated_status
   FROM ((public.inventory_items ii
     LEFT JOIN public.inventory_categories ic ON ((ii.category_id = ic.id)))
     LEFT JOIN public.inventory_vendors iv ON ((ii.vendor_id = iv.id)))
  WHERE (ii.deleted_at IS NULL);


--
-- Name: marketing_campaign_recipients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.marketing_campaign_recipients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    customer_address character varying(42) NOT NULL,
    customer_email character varying(255),
    email_sent_at timestamp with time zone,
    email_opened_at timestamp with time zone,
    email_clicked_at timestamp with time zone,
    in_app_sent_at timestamp with time zone,
    in_app_read_at timestamp with time zone,
    delivery_error text,
    created_at timestamp with time zone DEFAULT now(),
    reward_kind text,
    reward_amount numeric(12,2),
    reward_status text,
    reward_promo_code text,
    reward_tx_hash text,
    reward_issued_at timestamp with time zone,
    reward_redeemed_at timestamp with time zone,
    reward_expires_at timestamp with time zone,
    reward_error text
);


--
-- Name: marketing_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    campaign_type character varying(50) NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    subject character varying(255),
    preview_text character varying(255),
    design_content jsonb DEFAULT '{}'::jsonb NOT NULL,
    template_id character varying(50),
    audience_type character varying(50) DEFAULT 'all_customers'::character varying NOT NULL,
    audience_filters jsonb DEFAULT '{}'::jsonb,
    delivery_method character varying(20) DEFAULT 'in_app'::character varying NOT NULL,
    scheduled_at timestamp with time zone,
    sent_at timestamp with time zone,
    promo_code_id integer,
    coupon_value numeric(10,2),
    coupon_type character varying(20),
    coupon_expires_at timestamp with time zone,
    service_id character varying(50),
    total_recipients integer DEFAULT 0,
    emails_sent integer DEFAULT 0,
    emails_opened integer DEFAULT 0,
    emails_clicked integer DEFAULT 0,
    in_app_sent integer DEFAULT 0,
    in_app_read integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by_source character varying(20) DEFAULT 'manual'::character varying NOT NULL,
    reward_type text DEFAULT 'none'::text NOT NULL,
    reward_mode text,
    reward_rcn_amount numeric(12,2),
    reward_rcn_by_tier jsonb,
    reward_spend_bands jsonb,
    fulfillment_trigger text DEFAULT 'on_send'::text NOT NULL,
    return_window_days integer
);


--
-- Name: marketing_email_unsubscribes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.marketing_email_unsubscribes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    unsubscribed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: marketing_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.marketing_templates (
    id character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category character varying(50) NOT NULL,
    thumbnail_url character varying(500),
    design_content jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.messages (
    message_id character varying(255) NOT NULL,
    conversation_id character varying(255) NOT NULL,
    sender_address character varying(255) NOT NULL,
    sender_type character varying(20) NOT NULL,
    message_text text NOT NULL,
    message_type character varying(50) DEFAULT 'text'::character varying,
    attachments jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_read boolean DEFAULT false,
    read_at timestamp without time zone,
    is_delivered boolean DEFAULT false,
    delivered_at timestamp without time zone,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp without time zone,
    deleted_by character varying(255),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    is_encrypted boolean DEFAULT false,
    client_message_id character varying(64),
    CONSTRAINT messages_message_type_check CHECK (((message_type)::text = ANY ((ARRAY['text'::character varying, 'booking_link'::character varying, 'service_link'::character varying, 'system'::character varying, 'encrypted'::character varying])::text[])))
);


--
-- Name: no_show_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.no_show_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_address character varying(255) NOT NULL,
    order_id character varying(255) NOT NULL,
    service_id character varying(255) NOT NULL,
    shop_id character varying(255) NOT NULL,
    scheduled_time timestamp without time zone NOT NULL,
    marked_no_show_at timestamp without time zone DEFAULT now() NOT NULL,
    marked_by character varying(255),
    notes text,
    grace_period_minutes integer DEFAULT 15,
    customer_tier_at_time character varying(20),
    disputed boolean DEFAULT false,
    dispute_status character varying(20),
    dispute_reason text,
    dispute_submitted_at timestamp without time zone,
    dispute_resolved_at timestamp without time zone,
    dispute_resolved_by character varying(255),
    dispute_resolution_notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT chk_dispute_status CHECK (((dispute_status IS NULL) OR ((dispute_status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[]))))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sender_address character varying(42) NOT NULL,
    receiver_address character varying(42) NOT NULL,
    notification_type character varying(50) NOT NULL,
    message text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: service_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.service_orders (
    order_id character varying(50) NOT NULL,
    service_id character varying(50) NOT NULL,
    customer_address character varying(255) NOT NULL,
    shop_id character varying(255) NOT NULL,
    stripe_payment_intent_id character varying(255),
    status character varying(50) DEFAULT 'pending'::character varying,
    total_amount numeric(10,2) NOT NULL,
    booking_date timestamp without time zone,
    completed_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    booking_time time without time zone,
    rcn_redeemed numeric(10,2) DEFAULT 0,
    rcn_discount_usd numeric(10,2) DEFAULT 0,
    final_amount_usd numeric(10,2),
    booking_time_slot time without time zone,
    booking_end_time time without time zone,
    reminder_sent boolean DEFAULT false,
    cancelled_at timestamp without time zone,
    cancellation_reason character varying(100),
    cancellation_notes text,
    no_show boolean DEFAULT false,
    marked_no_show_at timestamp without time zone,
    no_show_notes text,
    has_pending_reschedule boolean DEFAULT false,
    reschedule_count integer DEFAULT 0,
    last_rescheduled_at timestamp without time zone,
    reminder_24h_sent boolean DEFAULT false,
    reminder_24h_sent_at timestamp without time zone,
    reminder_2h_sent boolean DEFAULT false,
    reminder_2h_sent_at timestamp without time zone,
    shop_approved boolean DEFAULT false,
    approved_at timestamp without time zone,
    approved_by character varying(255),
    original_booking_date timestamp without time zone,
    original_booking_time_slot character varying(50),
    rescheduled_at timestamp without time zone,
    rescheduled_by character varying(50),
    reschedule_reason text,
    booking_type character varying(20) DEFAULT 'online'::character varying,
    booked_by character varying(255),
    payment_status character varying(20) DEFAULT 'paid'::character varying,
    expired_at timestamp without time zone,
    expired_by character varying(255),
    stripe_session_id character varying(255),
    google_calendar_event_id text,
    calendar_sync_status character varying(50) DEFAULT 'not_synced'::character varying,
    calendar_sync_error text,
    calendar_synced_at timestamp with time zone,
    conversation_id text,
    ad_lead_id uuid,
    meta_conversion_event_id text,
    meta_conversion_sent_at timestamp with time zone,
    CONSTRAINT check_calendar_sync_status CHECK (((calendar_sync_status)::text = ANY ((ARRAY['not_synced'::character varying, 'synced'::character varying, 'failed'::character varying, 'deleted'::character varying])::text[]))),
    CONSTRAINT chk_booking_type CHECK (((booking_type)::text = ANY ((ARRAY['online'::character varying, 'manual'::character varying])::text[]))),
    CONSTRAINT chk_payment_status CHECK (((payment_status)::text = ANY ((ARRAY['paid'::character varying, 'pending'::character varying, 'unpaid'::character varying])::text[]))),
    CONSTRAINT service_orders_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'paid'::character varying, 'completed'::character varying, 'cancelled'::character varying, 'refunded'::character varying, 'no_show'::character varying, 'expired'::character varying])::text[])))
);


--
-- Name: shop_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.shop_services (
    service_id character varying(50) DEFAULT public.uuid_generate_v4() NOT NULL,
    shop_id character varying(255) NOT NULL,
    service_name character varying(255) NOT NULL,
    description text,
    price_usd numeric(10,2) NOT NULL,
    duration_minutes integer,
    category character varying(100) NOT NULL,
    image_url character varying(500),
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    tags text[] DEFAULT '{}'::text[],
    average_rating numeric(3,1),
    review_count integer DEFAULT 0,
    group_id character varying(100),
    group_exclusive boolean DEFAULT false,
    group_token_reward_percentage numeric(5,2) DEFAULT 100.00,
    group_bonus_multiplier numeric(5,2) DEFAULT 1.00,
    ai_sales_enabled boolean DEFAULT false,
    ai_tone character varying(20) DEFAULT 'professional'::character varying,
    ai_suggest_upsells boolean DEFAULT false,
    ai_booking_assistance boolean DEFAULT false,
    deleted_at timestamp without time zone,
    CONSTRAINT chk_service_category CHECK (((category)::text = ANY ((ARRAY['repairs'::character varying, 'beauty_personal_care'::character varying, 'health_wellness'::character varying, 'fitness_gyms'::character varying, 'automotive_services'::character varying, 'home_cleaning_services'::character varying, 'pets_animal_care'::character varying, 'professional_services'::character varying, 'education_classes'::character varying, 'tech_it_services'::character varying, 'food_beverage'::character varying, 'other_local_services'::character varying])::text[]))),
    CONSTRAINT chk_shop_services_ai_tone CHECK (((ai_tone)::text = ANY ((ARRAY['friendly'::character varying, 'professional'::character varying, 'urgent'::character varying])::text[])))
);


--
-- Name: pending_reschedule_requests_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.pending_reschedule_requests_view AS
 SELECT r.request_id,
    r.order_id,
    r.shop_id,
    r.customer_address,
    c.name AS customer_name,
    c.email AS customer_email,
    o.service_id,
    s.service_name,
    r.original_date,
    r.original_time_slot,
    r.original_end_time,
    r.requested_date,
    r.requested_time_slot,
    r.requested_end_time,
    r.customer_reason,
    r.status,
    r.created_at,
    r.expires_at,
    (EXTRACT(epoch FROM ((r.expires_at)::timestamp with time zone - now())) / (3600)::numeric) AS hours_until_expiry
   FROM (((public.appointment_reschedule_requests r
     JOIN public.service_orders o ON (((r.order_id)::text = (o.order_id)::text)))
     JOIN public.shop_services s ON (((o.service_id)::text = (s.service_id)::text)))
     LEFT JOIN public.customers c ON (((r.customer_address)::text = (c.wallet_address)::text)))
  WHERE ((r.status)::text = 'pending'::text)
  ORDER BY r.created_at;


--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.transactions (
    id integer DEFAULT nextval('public.transactions_id_seq'::regclass) NOT NULL,
    shop_id character varying(100),
    customer_address character varying(42),
    amount numeric(20,8) NOT NULL,
    type character varying(50) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    base_amount numeric(18,2),
    tier_bonus_amount numeric(18,2) DEFAULT 0,
    is_cross_shop boolean DEFAULT false,
    redemption_shop_id character varying(100),
    source_classification character varying(50),
    token_source character varying(50),
    reason text,
    block_number bigint,
    transaction_hash character varying(100),
    "timestamp" timestamp without time zone,
    confirmed_at timestamp without time zone,
    earning_shop_id character varying(100),
    customer_tier character varying(20),
    is_redeemable_at_shops boolean DEFAULT true
);


--
-- Name: platform_statistics; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.platform_statistics AS
 SELECT ( SELECT COALESCE(sum(transactions.amount), (0)::numeric) AS "coalesce"
           FROM public.transactions
          WHERE ((transactions.type)::text = 'mint'::text)) AS total_rcn_minted,
    ( SELECT COALESCE(sum(transactions.amount), (0)::numeric) AS "coalesce"
           FROM public.transactions
          WHERE ((transactions.type)::text = 'redeem'::text)) AS total_rcn_redeemed,
    (( SELECT COALESCE(sum(transactions.amount), (0)::numeric) AS "coalesce"
           FROM public.transactions
          WHERE ((transactions.type)::text = 'mint'::text)) - ( SELECT COALESCE(sum(transactions.amount), (0)::numeric) AS "coalesce"
           FROM public.transactions
          WHERE ((transactions.type)::text = 'redeem'::text))) AS total_rcn_circulating,
    ( SELECT count(DISTINCT customers.wallet_address) AS count
           FROM public.customers
          WHERE (customers.is_active = true)) AS total_active_customers,
    ( SELECT count(*) AS count
           FROM public.customers
          WHERE (((customers.tier)::text = 'bronze'::text) AND (customers.is_active = true))) AS customers_bronze,
    ( SELECT count(*) AS count
           FROM public.customers
          WHERE (((customers.tier)::text = 'silver'::text) AND (customers.is_active = true))) AS customers_silver,
    ( SELECT count(*) AS count
           FROM public.customers
          WHERE (((customers.tier)::text = 'gold'::text) AND (customers.is_active = true))) AS customers_gold,
    ( SELECT count(*) AS count
           FROM public.shops
          WHERE ((shops.verified = true) AND (shops.active = true))) AS total_active_shops,
    ( SELECT count(*) AS count
           FROM public.shops
          WHERE (shops.active = true)) AS shops_with_subscription,
    0 AS total_revenue,
    0 AS revenue_last_30_days,
    ( SELECT count(*) AS count
           FROM public.transactions) AS total_transactions,
    ( SELECT count(*) AS count
           FROM public.transactions
          WHERE (transactions.created_at >= (now() - '24:00:00'::interval))) AS transactions_last_24h,
    ( SELECT count(*) AS count
           FROM public.customers
          WHERE (customers.referred_by IS NOT NULL)) AS total_referrals,
    ( SELECT COALESCE(sum(transactions.amount), (0)::numeric) AS "coalesce"
           FROM public.transactions
          WHERE ((transactions.type)::text = 'tier_bonus'::text)) AS total_referral_rewards,
    now() AS last_updated
  WITH NO DATA;


--
-- Name: pricing_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pricing_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pricing_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.pricing_history (
    id integer DEFAULT nextval('public.pricing_history_id_seq'::regclass) NOT NULL,
    tier character varying(20) NOT NULL,
    old_price numeric(10,4) NOT NULL,
    new_price numeric(10,4) NOT NULL,
    reason text NOT NULL,
    updated_by character varying(255) NOT NULL,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: promo_code_uses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.promo_code_uses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: promo_code_uses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.promo_code_uses (
    id integer DEFAULT nextval('public.promo_code_uses_id_seq'::regclass) NOT NULL,
    promo_code_id integer NOT NULL,
    customer_address character varying(42) NOT NULL,
    shop_id character varying(255) NOT NULL,
    transaction_id character varying(100),
    base_reward numeric(18,2) NOT NULL,
    bonus_amount numeric(18,2) NOT NULL,
    total_reward numeric(18,2) NOT NULL,
    used_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: promo_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.promo_codes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: promo_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.promo_codes (
    id integer DEFAULT nextval('public.promo_codes_id_seq'::regclass) NOT NULL,
    code character varying(20) NOT NULL,
    shop_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    bonus_type character varying(20) NOT NULL,
    bonus_value numeric(10,2) NOT NULL,
    max_bonus numeric(10,2),
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone NOT NULL,
    total_usage_limit integer,
    per_customer_limit integer DEFAULT 1,
    times_used integer DEFAULT 0,
    total_bonus_issued numeric(18,2) DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    discount_type character varying(20),
    discount_value numeric(10,2),
    status character varying(20) DEFAULT 'active'::character varying,
    used_count integer DEFAULT 0,
    valid_from timestamp without time zone,
    valid_until timestamp without time zone,
    CONSTRAINT fixed_bonus_value_positive CHECK ((((bonus_type)::text <> 'fixed'::text) OR (((bonus_type)::text = 'fixed'::text) AND (bonus_value > (0)::numeric)))),
    CONSTRAINT max_bonus_reasonable CHECK (((max_bonus IS NULL) OR (max_bonus <= (10000)::numeric))),
    CONSTRAINT percentage_bonus_value_valid CHECK ((((bonus_type)::text <> 'percentage'::text) OR (((bonus_type)::text = 'percentage'::text) AND (bonus_value > (0)::numeric) AND (bonus_value <= (100)::numeric)))),
    CONSTRAINT percentage_requires_max_bonus CHECK ((((bonus_type)::text <> 'percentage'::text) OR (((bonus_type)::text = 'percentage'::text) AND (max_bonus IS NOT NULL) AND (max_bonus > (0)::numeric))))
);


--
-- Name: purchase_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    po_id uuid NOT NULL,
    inventory_item_id uuid,
    item_name character varying(255) NOT NULL,
    item_sku character varying(100),
    quantity_ordered integer NOT NULL,
    quantity_received integer DEFAULT 0,
    unit_cost numeric(10,2) NOT NULL,
    line_total numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_quantity_ordered CHECK ((quantity_ordered > 0)),
    CONSTRAINT check_quantity_received CHECK ((quantity_received >= 0)),
    CONSTRAINT check_received_not_exceed CHECK ((quantity_received <= quantity_ordered))
);


--
-- Name: purchase_order_suggestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.purchase_order_suggestions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id character varying(255) NOT NULL,
    item_id uuid NOT NULL,
    vendor_id uuid,
    suggested_quantity integer NOT NULL,
    current_stock integer NOT NULL,
    avg_daily_usage numeric(10,2) DEFAULT 0 NOT NULL,
    days_until_stockout integer,
    days_of_supply integer,
    urgency character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    priority_score integer DEFAULT 50,
    reason text NOT NULL,
    estimated_stockout_date timestamp without time zone,
    reorder_point integer,
    safety_stock integer,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone DEFAULT (CURRENT_TIMESTAMP + '7 days'::interval),
    approved_at timestamp without time zone,
    rejected_at timestamp without time zone,
    ordered_at timestamp without time zone,
    rejection_reason text,
    approved_by character varying(255),
    rejected_by character varying(255),
    purchase_order_id uuid,
    was_accurate boolean,
    actual_need_assessment_date timestamp without time zone,
    actual_need_assessment_notes text,
    suggestion_accuracy_score integer,
    CONSTRAINT check_avg_daily_usage_non_negative CHECK ((avg_daily_usage >= (0)::numeric)),
    CONSTRAINT check_current_stock_non_negative CHECK ((current_stock >= 0)),
    CONSTRAINT check_priority_score_range CHECK (((priority_score >= 0) AND (priority_score <= 100))),
    CONSTRAINT check_suggested_quantity_positive CHECK ((suggested_quantity > 0)),
    CONSTRAINT purchase_order_suggestions_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'expired'::character varying, 'ordered'::character varying])::text[]))),
    CONSTRAINT purchase_order_suggestions_suggestion_accuracy_score_check CHECK (((suggestion_accuracy_score >= 0) AND (suggestion_accuracy_score <= 100))),
    CONSTRAINT purchase_order_suggestions_urgency_check CHECK (((urgency)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::text[])))
);


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    po_number character varying(100) NOT NULL,
    shop_id character varying(255) NOT NULL,
    vendor_id uuid,
    vendor_name character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'draft'::character varying NOT NULL,
    order_date date DEFAULT CURRENT_DATE NOT NULL,
    expected_delivery_date date,
    received_date date,
    subtotal numeric(10,2) DEFAULT 0 NOT NULL,
    tax numeric(10,2) DEFAULT 0,
    shipping numeric(10,2) DEFAULT 0,
    total numeric(10,2) DEFAULT 0 NOT NULL,
    notes text,
    tracking_number character varying(255),
    created_by character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_po_status CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'sent'::character varying, 'confirmed'::character varying, 'partially_received'::character varying, 'received'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: rcg_staking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.rcg_staking (
    id integer NOT NULL,
    wallet_address character varying(42) NOT NULL,
    staked_amount numeric(18,2) NOT NULL,
    staked_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    unstake_requested_at timestamp without time zone,
    last_claim_at timestamp without time zone
);


--
-- Name: rcg_staking_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rcg_staking_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rcg_staking_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rcg_staking_id_seq1
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rcg_staking_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rcg_staking_id_seq1 OWNED BY public.rcg_staking.id;


--
-- Name: recently_viewed_services_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.recently_viewed_services_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: recently_viewed_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.recently_viewed_services (
    id integer DEFAULT nextval('public.recently_viewed_services_id_seq'::regclass) NOT NULL,
    customer_address character varying(42) NOT NULL,
    service_id character varying(50) NOT NULL,
    viewed_at timestamp without time zone DEFAULT now()
);


--
-- Name: redemption_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.redemption_sessions (
    session_id character varying(255) NOT NULL,
    customer_address character varying(42) NOT NULL,
    shop_id character varying(100) NOT NULL,
    max_amount numeric(20,2) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp with time zone NOT NULL,
    approved_at timestamp with time zone,
    used_at timestamp with time zone,
    qr_code text,
    signature text,
    metadata jsonb DEFAULT '{}'::jsonb
);


--
-- Name: redemption_sessions_backup_20250919; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.redemption_sessions_backup_20250919 (
    id character varying(36),
    customer_address character varying(42),
    shop_id character varying(100),
    amount numeric(20,8),
    status character varying(20),
    expires_at timestamp without time zone,
    completed_at timestamp without time zone,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: referrals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.referrals (
    id integer NOT NULL,
    referrer_address character varying(42),
    referred_address character varying(42),
    referral_code character varying(10),
    status character varying(20) DEFAULT 'pending'::character varying,
    reward_amount numeric(18,8) DEFAULT 0,
    referee_bonus numeric(18,8) DEFAULT 0,
    completion_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    referee_address character varying(42),
    completed_at timestamp with time zone,
    expires_at timestamp with time zone,
    reward_transaction_id character varying(255),
    metadata jsonb
);


--
-- Name: referrals_backup_20250919; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.referrals_backup_20250919 (
    id integer,
    referrer_address character varying(42),
    referred_address character varying(42),
    referral_code character varying(10),
    status character varying(20),
    reward_amount numeric(20,8),
    referee_bonus numeric(20,8),
    completion_date timestamp without time zone,
    created_at timestamp without time zone
);


--
-- Name: referrals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.referrals_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: referrals_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.referrals_id_seq1
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: referrals_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.referrals_id_seq1 OWNED BY public.referrals.id;


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.refresh_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token_id character varying(255) NOT NULL,
    user_address character varying(42) NOT NULL,
    user_role character varying(20) NOT NULL,
    shop_id character varying(100),
    token_hash character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    last_used_at timestamp with time zone DEFAULT now(),
    revoked boolean DEFAULT false,
    revoked_at timestamp with time zone,
    revoked_reason text,
    user_agent text,
    ip_address character varying(45),
    revoked_by_admin boolean DEFAULT false NOT NULL,
    location character varying(100),
    device_id character varying(64)
);


--
-- Name: revenue_distributions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.revenue_distributions (
    id integer NOT NULL,
    week_start date NOT NULL,
    week_end date NOT NULL,
    total_rcn_sold numeric(18,2),
    total_revenue_usd numeric(18,2),
    operations_share numeric(18,2),
    stakers_share numeric(18,2),
    dao_treasury_share numeric(18,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: revenue_distributions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.revenue_distributions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: revenue_distributions_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.revenue_distributions_id_seq1
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: revenue_distributions_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.revenue_distributions_id_seq1 OWNED BY public.revenue_distributions.id;


--
-- Name: review_helpful_votes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.review_helpful_votes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: review_helpful_votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.review_helpful_votes (
    id integer DEFAULT nextval('public.review_helpful_votes_id_seq'::regclass) NOT NULL,
    review_id uuid NOT NULL,
    voter_address character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: review_replies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.review_replies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    review_id uuid NOT NULL,
    author_address text NOT NULL,
    author_type text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    CONSTRAINT review_replies_author_type_check CHECK ((author_type = ANY (ARRAY['customer'::text, 'shop'::text]))),
    CONSTRAINT review_replies_content_check CHECK ((char_length(content) <= 1000))
);


--
-- Name: sent_emails_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.sent_emails_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id text NOT NULL,
    to_email text NOT NULL,
    to_name text,
    subject text NOT NULL,
    body_preview text,
    order_id text,
    customer_address text,
    email_type character varying(50) NOT NULL,
    status character varying(50) DEFAULT 'sent'::character varying NOT NULL,
    error_message text,
    gmail_message_id text,
    sent_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_email_status CHECK (((status)::text = ANY ((ARRAY['sent'::character varying, 'failed'::character varying, 'bounced'::character varying])::text[]))),
    CONSTRAINT check_email_type CHECK (((email_type)::text = ANY ((ARRAY['booking_confirmation'::character varying, 'reminder'::character varying, 'promotional'::character varying, 'support'::character varying, 'manual'::character varying, 'cancellation'::character varying, 'reschedule'::character varying])::text[])))
);


--
-- Name: service_ai_faq_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.service_ai_faq_entries (
    faq_entry_id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_id character varying NOT NULL,
    question character varying(300) NOT NULL,
    answer text NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: service_duration_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.service_duration_config (
    duration_id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    service_id character varying(255) NOT NULL,
    duration_minutes integer DEFAULT 60 NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: service_favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.service_favorites (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    customer_address character varying(255) NOT NULL,
    service_id character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: service_group_availability_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.service_group_availability_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: service_group_availability; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.service_group_availability (
    id integer DEFAULT nextval('public.service_group_availability_id_seq'::regclass) NOT NULL,
    service_id character varying(50) NOT NULL,
    group_id character varying(100) NOT NULL,
    token_reward_percentage numeric(5,2) DEFAULT 100.00,
    bonus_multiplier numeric(5,2) DEFAULT 1.00,
    active boolean DEFAULT true,
    added_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: service_inventory_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.service_inventory_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_id character varying(50) NOT NULL,
    shop_id character varying(255) NOT NULL,
    inventory_item_id uuid NOT NULL,
    quantity_required integer DEFAULT 1 NOT NULL,
    is_optional boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_quantity_required CHECK ((quantity_required > 0))
);


--
-- Name: service_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.service_reviews (
    review_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    service_id character varying(50) NOT NULL,
    order_id character varying(50) NOT NULL,
    customer_address character varying(255) NOT NULL,
    shop_id character varying(255) NOT NULL,
    rating integer NOT NULL,
    comment text,
    images text[],
    helpful_count integer DEFAULT 0,
    shop_response text,
    shop_response_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    customer_reply text,
    customer_reply_at timestamp with time zone,
    shop_rejoinder text,
    shop_rejoinder_at timestamp with time zone
);


--
-- Name: shop_auto_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.shop_auto_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id character varying(100) NOT NULL,
    name character varying(200) NOT NULL,
    message_template text NOT NULL,
    trigger_type character varying(50) NOT NULL,
    schedule_type character varying(20),
    schedule_day_of_week integer,
    schedule_day_of_month integer,
    schedule_hour integer DEFAULT 10,
    event_type character varying(50),
    delay_hours integer DEFAULT 0,
    target_audience character varying(50) DEFAULT 'all'::character varying,
    is_active boolean DEFAULT true,
    max_sends_per_customer integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: shop_availability; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.shop_availability (
    availability_id character varying(36) DEFAULT (gen_random_uuid())::text NOT NULL,
    shop_id character varying(255) NOT NULL,
    day_of_week integer NOT NULL,
    is_open boolean DEFAULT true,
    open_time time without time zone,
    close_time time without time zone,
    break_start_time time without time zone,
    break_end_time time without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: shop_brand_kits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.shop_brand_kits (
    shop_id character varying(255) NOT NULL,
    logo_url text,
    primary_color_hex character varying(7),
    secondary_color_hex character varying(7),
    tone_notes character varying(500),
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    onboarding_completed_at timestamp with time zone,
    marketing_style text,
    brand_voice text,
    headline text,
    brand_personality text,
    industry_style text,
    heading_font text,
    body_font text
);


--
-- Name: shop_calendar_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.shop_calendar_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id text NOT NULL,
    provider character varying(50) DEFAULT 'google'::character varying NOT NULL,
    access_token text NOT NULL,
    refresh_token text NOT NULL,
    token_expiry timestamp with time zone NOT NULL,
    calendar_id text DEFAULT 'primary'::text NOT NULL,
    google_account_email text,
    is_active boolean DEFAULT true NOT NULL,
    last_sync_at timestamp with time zone,
    last_sync_status character varying(50),
    sync_error_message text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_provider CHECK (((provider)::text = ANY ((ARRAY['google'::character varying, 'outlook'::character varying, 'apple'::character varying])::text[]))),
    CONSTRAINT check_sync_status CHECK (((last_sync_status IS NULL) OR ((last_sync_status)::text = ANY ((ARRAY['success'::character varying, 'failed'::character varying, 'token_expired'::character varying])::text[]))))
);


--
-- Name: shop_calendar_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.shop_calendar_view AS
 SELECT o.order_id,
    o.shop_id,
    o.service_id,
    s.service_name,
    o.customer_address,
    c.name AS customer_name,
    o.booking_date,
    o.booking_time_slot,
    o.booking_end_time,
    o.status,
    o.total_amount,
    o.notes,
    o.created_at
   FROM ((public.service_orders o
     JOIN public.shop_services s ON (((o.service_id)::text = (s.service_id)::text)))
     LEFT JOIN public.customers c ON (((o.customer_address)::text = (c.wallet_address)::text)))
  WHERE ((o.booking_date IS NOT NULL) AND ((o.status)::text <> ALL ((ARRAY['cancelled'::character varying, 'refunded'::character varying])::text[])))
  ORDER BY o.booking_date, o.booking_time_slot;


--
-- Name: shop_date_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.shop_date_overrides (
    override_id character varying(36) DEFAULT (gen_random_uuid())::text NOT NULL,
    shop_id character varying(255) NOT NULL,
    override_date date NOT NULL,
    is_closed boolean DEFAULT true,
    custom_open_time time without time zone,
    custom_close_time time without time zone,
    reason character varying(255),
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: shop_deposits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.shop_deposits (
    id integer NOT NULL,
    shop_id character varying(255) NOT NULL,
    amount numeric(20,2) NOT NULL,
    wallet_address character varying(42) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    transaction_hash character varying(255),
    transaction_note text,
    deposit_type character varying(50) DEFAULT 'wallet_to_operational'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    completed_at timestamp without time zone
);


--
-- Name: shop_deposits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shop_deposits_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shop_deposits_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shop_deposits_id_seq1
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shop_deposits_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shop_deposits_id_seq1 OWNED BY public.shop_deposits.id;


--
-- Name: shop_email_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.shop_email_preferences (
    shop_id text NOT NULL,
    new_booking boolean DEFAULT true NOT NULL,
    booking_cancellation boolean DEFAULT true NOT NULL,
    booking_reschedule boolean DEFAULT true NOT NULL,
    appointment_reminder boolean DEFAULT true NOT NULL,
    no_show_alert boolean DEFAULT true NOT NULL,
    new_customer boolean DEFAULT true NOT NULL,
    customer_review boolean DEFAULT true NOT NULL,
    customer_message boolean DEFAULT true NOT NULL,
    payment_received boolean DEFAULT true NOT NULL,
    refund_processed boolean DEFAULT true NOT NULL,
    subscription_renewal boolean DEFAULT true NOT NULL,
    subscription_expiring boolean DEFAULT true NOT NULL,
    marketing_updates boolean DEFAULT false NOT NULL,
    feature_announcements boolean DEFAULT true NOT NULL,
    platform_news boolean DEFAULT false NOT NULL,
    daily_digest boolean DEFAULT false NOT NULL,
    weekly_report boolean DEFAULT true NOT NULL,
    monthly_report boolean DEFAULT false NOT NULL,
    digest_time text DEFAULT 'morning'::text NOT NULL,
    weekly_report_day text DEFAULT 'monday'::text NOT NULL,
    monthly_report_day integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_digest_time CHECK ((digest_time = ANY (ARRAY['morning'::text, 'afternoon'::text, 'evening'::text]))),
    CONSTRAINT check_monthly_day CHECK (((monthly_report_day >= 1) AND (monthly_report_day <= 28))),
    CONSTRAINT check_weekly_day CHECK ((weekly_report_day = ANY (ARRAY['monday'::text, 'friday'::text])))
);


--
-- Name: shop_gallery_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.shop_gallery_photos (
    id integer NOT NULL,
    shop_id character varying(255) NOT NULL,
    photo_url character varying(512) NOT NULL,
    caption text,
    display_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: shop_gallery_photos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shop_gallery_photos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shop_gallery_photos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shop_gallery_photos_id_seq OWNED BY public.shop_gallery_photos.id;


--
-- Name: shop_gmail_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.shop_gmail_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id text NOT NULL,
    access_token text NOT NULL,
    refresh_token text NOT NULL,
    token_expiry timestamp with time zone NOT NULL,
    email_address text NOT NULL,
    display_name text,
    is_active boolean DEFAULT true NOT NULL,
    last_email_sent_at timestamp with time zone,
    total_emails_sent integer DEFAULT 0 NOT NULL,
    last_sync_status character varying(50),
    sync_error_message text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_sync_status CHECK (((last_sync_status IS NULL) OR ((last_sync_status)::text = ANY ((ARRAY['success'::character varying, 'failed'::character varying, 'token_expired'::character varying])::text[]))))
);


--
-- Name: shop_group_rcn_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.shop_group_rcn_allocations (
    shop_id character varying(100) NOT NULL,
    group_id character varying(100) NOT NULL,
    allocated_rcn numeric(20,8) DEFAULT 0 NOT NULL,
    used_rcn numeric(20,8) DEFAULT 0 NOT NULL,
    available_rcn numeric(20,8),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: shop_no_show_policy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.shop_no_show_policy (
    shop_id character varying(255) NOT NULL,
    enabled boolean DEFAULT true,
    grace_period_minutes integer DEFAULT 15,
    minimum_cancellation_hours integer DEFAULT 4,
    auto_detection_enabled boolean DEFAULT false,
    auto_detection_delay_hours integer DEFAULT 2,
    caution_threshold integer DEFAULT 2,
    caution_advance_booking_hours integer DEFAULT 24,
    deposit_threshold integer DEFAULT 3,
    deposit_amount numeric(10,2) DEFAULT 25.00,
    deposit_advance_booking_hours integer DEFAULT 48,
    deposit_reset_after_successful integer DEFAULT 3,
    max_rcn_redemption_percent integer DEFAULT 80,
    suspension_threshold integer DEFAULT 5,
    suspension_duration_days integer DEFAULT 30,
    send_email_tier1 boolean DEFAULT true,
    send_email_tier2 boolean DEFAULT true,
    send_email_tier3 boolean DEFAULT true,
    send_email_tier4 boolean DEFAULT true,
    send_sms_tier2 boolean DEFAULT false,
    send_sms_tier3 boolean DEFAULT true,
    send_sms_tier4 boolean DEFAULT true,
    send_push_notifications boolean DEFAULT true,
    allow_disputes boolean DEFAULT true,
    dispute_window_days integer DEFAULT 7,
    auto_approve_first_offense boolean DEFAULT true,
    require_shop_review boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: shop_quick_replies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.shop_quick_replies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id character varying(100) NOT NULL,
    title character varying(100) NOT NULL,
    content text NOT NULL,
    category character varying(50) DEFAULT 'general'::character varying,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    usage_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: shop_rcn_purchases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shop_rcn_purchases_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shop_rcn_purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.shop_rcn_purchases (
    id integer DEFAULT nextval('public.shop_rcn_purchases_id_seq'::regclass) NOT NULL,
    shop_id character varying(100),
    amount numeric(20,8) NOT NULL,
    total_cost numeric(20,2) NOT NULL,
    unit_price numeric(20,8) DEFAULT 0.10,
    payment_method character varying(50),
    payment_reference character varying(255),
    status character varying(50) DEFAULT 'completed'::character varying,
    notes text,
    processed_by character varying(42),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp with time zone,
    shop_tier character varying(20) DEFAULT 'STANDARD'::character varying,
    operations_share numeric(20,8) DEFAULT 0,
    stakers_share numeric(20,8) DEFAULT 0,
    dao_treasury_share numeric(20,8) DEFAULT 0,
    minted_at timestamp with time zone,
    transaction_hash text
);


--
-- Name: shop_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.shop_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id text NOT NULL,
    category text NOT NULL,
    description text NOT NULL,
    severity text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    related_entity_type text,
    related_entity_id text,
    assigned_to text,
    admin_notes text,
    resolved_at timestamp with time zone,
    resolved_by text,
    resolution_details text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT shop_reports_category_check CHECK ((category = ANY (ARRAY['spam'::text, 'fraud'::text, 'inappropriate_review'::text, 'harassment'::text, 'other'::text]))),
    CONSTRAINT shop_reports_related_entity_type_check CHECK ((related_entity_type = ANY (ARRAY['customer'::text, 'review'::text, 'order'::text]))),
    CONSTRAINT shop_reports_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
    CONSTRAINT shop_reports_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'investigating'::text, 'resolved'::text, 'dismissed'::text])))
);


--
-- Name: shop_subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shop_subscriptions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shop_time_slot_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.shop_time_slot_config (
    config_id character varying(36) DEFAULT (gen_random_uuid())::text NOT NULL,
    shop_id character varying(255) NOT NULL,
    slot_duration_minutes integer DEFAULT 60,
    buffer_time_minutes integer DEFAULT 15,
    max_concurrent_bookings integer DEFAULT 1,
    booking_advance_days integer DEFAULT 30,
    min_booking_hours integer DEFAULT 2,
    allow_weekend_booking boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    allow_reschedule boolean DEFAULT true,
    max_reschedules_per_order integer DEFAULT 2,
    reschedule_min_hours integer DEFAULT 24,
    reschedule_expiration_hours integer DEFAULT 48,
    auto_approve_reschedule boolean DEFAULT false,
    require_reschedule_reason boolean DEFAULT false,
    timezone character varying(50) DEFAULT 'America/New_York'::character varying
);


--
-- Name: shops_backup_20250919; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.shops_backup_20250919 (
    shop_id character varying(100),
    name character varying(255),
    address text,
    phone character varying(20),
    email character varying(255),
    wallet_address character varying(42),
    reimbursement_address character varying(42),
    verified boolean,
    active boolean,
    cross_shop_enabled boolean,
    total_tokens_issued numeric(20,8),
    total_redemptions numeric(20,8),
    total_reimbursements numeric(20,8),
    join_date timestamp without time zone,
    last_activity timestamp without time zone,
    fixflow_shop_id character varying(100),
    location_lat numeric(10,8),
    location_lng numeric(11,8),
    location_city character varying(100),
    location_state character varying(100),
    location_zip_code character varying(20),
    purchased_rcn_balance numeric(20,8),
    total_rcn_purchased numeric(20,8),
    last_purchase_date timestamp without time zone,
    minimum_balance_alert numeric(20,8),
    auto_purchase_enabled boolean,
    auto_purchase_amount numeric(20,8),
    first_name character varying(100),
    last_name character varying(100),
    company_name character varying(255),
    company_size character varying(20),
    monthly_revenue character varying(50),
    role character varying(50),
    website character varying(255),
    street_address text,
    city character varying(100),
    country character varying(100),
    referred_by character varying(255),
    terms_accepted boolean,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: stripe_customers_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stripe_customers_id_seq1
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stripe_customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.stripe_customers (
    shop_id character varying(100) NOT NULL,
    stripe_customer_id character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    email character varying(255),
    name character varying(255),
    metadata jsonb DEFAULT '{}'::jsonb,
    id integer DEFAULT nextval('public.stripe_customers_id_seq1'::regclass) NOT NULL
);


--
-- Name: stripe_customers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stripe_customers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stripe_payment_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.stripe_payment_attempts (
    id integer NOT NULL,
    shop_id character varying(100) NOT NULL,
    stripe_payment_intent_id character varying(255),
    amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying,
    status character varying(50) NOT NULL,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: stripe_payment_attempts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stripe_payment_attempts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stripe_payment_attempts_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stripe_payment_attempts_id_seq1
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stripe_payment_attempts_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stripe_payment_attempts_id_seq1 OWNED BY public.stripe_payment_attempts.id;


--
-- Name: stripe_payment_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.stripe_payment_methods (
    id integer NOT NULL,
    shop_id character varying(100) NOT NULL,
    stripe_payment_method_id character varying(255) NOT NULL,
    type character varying(50) NOT NULL,
    last4 character varying(4),
    brand character varying(50),
    exp_month integer,
    exp_year integer,
    is_default boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: stripe_payment_methods_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stripe_payment_methods_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stripe_payment_methods_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stripe_payment_methods_id_seq1
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stripe_payment_methods_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stripe_payment_methods_id_seq1 OWNED BY public.stripe_payment_methods.id;


--
-- Name: stripe_subscription_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.stripe_subscription_events (
    id integer NOT NULL,
    stripe_event_id character varying(255) NOT NULL,
    shop_id character varying(100),
    event_type character varying(100) NOT NULL,
    event_data jsonb NOT NULL,
    processed boolean DEFAULT false,
    processed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: stripe_subscription_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stripe_subscription_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stripe_subscription_events_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stripe_subscription_events_id_seq1
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stripe_subscription_events_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stripe_subscription_events_id_seq1 OWNED BY public.stripe_subscription_events.id;


--
-- Name: stripe_subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stripe_subscriptions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stripe_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.stripe_subscriptions (
    id integer DEFAULT nextval('public.stripe_subscriptions_id_seq'::regclass) NOT NULL,
    shop_id character varying(100) NOT NULL,
    stripe_subscription_id character varying(255) NOT NULL,
    stripe_customer_id character varying(255) NOT NULL,
    status character varying(50) NOT NULL,
    current_period_start timestamp without time zone,
    current_period_end timestamp without time zone,
    cancel_at_period_end boolean DEFAULT false,
    canceled_at timestamp without time zone,
    ended_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    stripe_price_id character varying(255),
    metadata jsonb DEFAULT '{}'::jsonb,
    reminder_7d_sent boolean DEFAULT false,
    reminder_7d_sent_at timestamp with time zone,
    reminder_3d_sent boolean DEFAULT false,
    reminder_3d_sent_at timestamp with time zone,
    reminder_1d_sent boolean DEFAULT false,
    reminder_1d_sent_at timestamp with time zone
);


--
-- Name: subscription_enforcement_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subscription_enforcement_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: subscription_enforcement_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.subscription_enforcement_log (
    id integer DEFAULT nextval('public.subscription_enforcement_log_id_seq'::regclass) NOT NULL,
    stripe_subscription_id character varying(255) NOT NULL,
    last_warning_at timestamp with time zone,
    warning_count integer DEFAULT 0,
    cancelled_at timestamp with time zone,
    cancellation_reason text,
    details jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: subscription_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.subscription_notifications (
    id integer NOT NULL,
    shop_id character varying(100) NOT NULL,
    notification_type character varying(50) NOT NULL,
    message text NOT NULL,
    sent_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    read_at timestamp without time zone
);


--
-- Name: subscription_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subscription_notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: subscription_notifications_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subscription_notifications_id_seq1
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: subscription_notifications_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subscription_notifications_id_seq1 OWNED BY public.subscription_notifications.id;


--
-- Name: subscription_payment_status; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.subscription_payment_status AS
 SELECT s.id,
    s.shop_id,
    sh.name AS shop_name,
    s.monthly_amount,
    s.next_payment_date,
    s.last_payment_date,
    s.payments_made,
    s.total_paid,
        CASE
            WHEN (s.next_payment_date < CURRENT_DATE) THEN 'overdue'::text
            WHEN (s.next_payment_date < (CURRENT_DATE + '7 days'::interval)) THEN 'due_soon'::text
            ELSE 'current'::text
        END AS payment_status,
        CASE
            WHEN (s.next_payment_date < CURRENT_DATE) THEN (EXTRACT(day FROM ((CURRENT_DATE)::timestamp without time zone - s.next_payment_date)))::integer
            ELSE 0
        END AS days_overdue
   FROM (public.shop_subscriptions s
     JOIN public.shops sh ON (((s.shop_id)::text = (sh.shop_id)::text)))
  WHERE (((s.status)::text = 'active'::text) AND (s.is_active = true))
  ORDER BY s.next_payment_date;


--
-- Name: suggestion_accuracy_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.suggestion_accuracy_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id character varying(255) NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    total_suggestions integer DEFAULT 0,
    approved_suggestions integer DEFAULT 0,
    rejected_suggestions integer DEFAULT 0,
    expired_suggestions integer DEFAULT 0,
    suggestions_with_po integer DEFAULT 0,
    accurate_suggestions integer DEFAULT 0,
    inaccurate_suggestions integer DEFAULT 0,
    pending_assessment integer DEFAULT 0,
    average_accuracy_score numeric(5,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: support_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.support_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    sender_type character varying(20) NOT NULL,
    sender_id character varying(255) NOT NULL,
    sender_name character varying(255),
    message text NOT NULL,
    attachments jsonb,
    is_internal boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    read_at timestamp without time zone,
    edited_at timestamp without time zone,
    CONSTRAINT support_messages_sender_type_check CHECK (((sender_type)::text = ANY ((ARRAY['shop'::character varying, 'admin'::character varying, 'system'::character varying])::text[])))
);


--
-- Name: support_ticket_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.support_ticket_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    viewer_type character varying(20) NOT NULL,
    viewer_id character varying(255) NOT NULL,
    last_viewed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT support_ticket_views_viewer_type_check CHECK (((viewer_type)::text = ANY ((ARRAY['shop'::character varying, 'admin'::character varying])::text[])))
);


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.support_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id character varying(255) NOT NULL,
    subject character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'open'::character varying NOT NULL,
    priority character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    category character varying(50),
    assigned_to character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    resolved_at timestamp without time zone,
    closed_at timestamp without time zone,
    last_message_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT support_tickets_category_check CHECK (((category)::text = ANY ((ARRAY['billing'::character varying, 'technical'::character varying, 'account'::character varying, 'general'::character varying, 'feature_request'::character varying])::text[]))),
    CONSTRAINT support_tickets_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'urgent'::character varying])::text[]))),
    CONSTRAINT support_tickets_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'in_progress'::character varying, 'waiting_shop'::character varying, 'resolved'::character varying, 'closed'::character varying])::text[])))
);


--
-- Name: tier_bonuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.tier_bonuses (
    customer_address character varying(42) NOT NULL,
    tier character varying(20) NOT NULL,
    bonus_amount numeric(18,2) NOT NULL,
    transaction_id character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: token_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.token_sources (
    customer_address character varying(42) NOT NULL,
    source character varying(50) NOT NULL,
    amount numeric(18,2) NOT NULL,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: webhook_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.webhook_logs (
    id character varying(100) DEFAULT (public.uuid_generate_v4())::text NOT NULL,
    source character varying(50) NOT NULL,
    event_type character varying(100) NOT NULL,
    payload jsonb NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    processed_at timestamp without time zone,
    webhook_id character varying(255),
    retry_count integer DEFAULT 0,
    last_retry_at timestamp without time zone,
    http_status integer,
    response jsonb,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: system_health; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.system_health AS
 SELECT 'healthy'::text AS status,
    ( SELECT count(*) AS count
           FROM public.customers) AS total_customers,
    ( SELECT count(*) AS count
           FROM public.shops) AS total_shops,
    ( SELECT count(*) AS count
           FROM public.transactions) AS total_transactions,
    ( SELECT count(*) AS count
           FROM public.webhook_logs) AS total_webhook_logs,
    ( SELECT count(*) AS count
           FROM public.shop_rcn_purchases) AS total_shop_purchases,
    ( SELECT count(*) AS count
           FROM public.token_sources) AS total_token_sources,
    ( SELECT count(*) AS count
           FROM public.cross_shop_verifications) AS total_verifications,
    ( SELECT count(*) AS count
           FROM public.tier_bonuses) AS total_tier_bonuses,
    CURRENT_TIMESTAMP AS checked_at;


--
-- Name: system_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.system_settings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.system_settings (
    id integer DEFAULT nextval('public.system_settings_id_seq'::regclass) NOT NULL,
    setting_key character varying(255) NOT NULL,
    setting_value text NOT NULL,
    last_modified timestamp without time zone DEFAULT now(),
    modified_by character varying(255),
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: system_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.system_status (
    id integer NOT NULL,
    component character varying(50) NOT NULL,
    is_frozen boolean DEFAULT false,
    frozen_at timestamp with time zone,
    frozen_by character varying(42),
    freeze_reason text,
    last_updated timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT system_status_component_check CHECK (((component)::text = ANY ((ARRAY['token_minting'::character varying, 'shop_purchases'::character varying, 'customer_rewards'::character varying, 'token_transfers'::character varying])::text[])))
);


--
-- Name: system_status_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.system_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: system_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.system_status_id_seq OWNED BY public.system_status.id;


--
-- Name: tier_pricing_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tier_pricing_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tier_pricing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.tier_pricing (
    id integer DEFAULT nextval('public.tier_pricing_id_seq'::regclass) NOT NULL,
    tier character varying(20) NOT NULL,
    price_per_rcn numeric(10,4) NOT NULL,
    discount_percentage integer DEFAULT 0,
    updated_by character varying(255) NOT NULL,
    reason text,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: typing_indicators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.typing_indicators (
    conversation_id character varying(255) NOT NULL,
    user_address character varying(255) NOT NULL,
    user_type character varying(20) NOT NULL,
    started_at timestamp without time zone DEFAULT now(),
    expires_at timestamp without time zone DEFAULT (now() + '00:00:10'::interval)
);


--
-- Name: unsuspend_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.unsuspend_requests (
    id integer NOT NULL,
    customer_address character varying(42) NOT NULL,
    reason text NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    admin_notes text,
    processed_by character varying(42),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    processed_at timestamp without time zone
);


--
-- Name: unsuspend_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.unsuspend_requests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: unsuspend_requests_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.unsuspend_requests_id_seq1
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: unsuspend_requests_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.unsuspend_requests_id_seq1 OWNED BY public.unsuspend_requests.id;


--
-- Name: waitlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.waitlist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    user_type character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    notified_at timestamp without time zone,
    notes text,
    inquiry_type character varying(20) DEFAULT 'waitlist'::character varying,
    source character varying(50) DEFAULT 'direct'::character varying,
    business_category character varying(50),
    city character varying(100),
    assigned_to character varying(100),
    CONSTRAINT chk_waitlist_inquiry_type CHECK (((inquiry_type)::text = ANY ((ARRAY['waitlist'::character varying, 'demo'::character varying])::text[]))),
    CONSTRAINT waitlist_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'contacted'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[]))),
    CONSTRAINT waitlist_user_type_check CHECK (((user_type)::text = ANY ((ARRAY['customer'::character varying, 'shop'::character varying])::text[])))
);


--
-- Name: waitlist_page_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.waitlist_page_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source character varying(50) DEFAULT 'direct'::character varying NOT NULL,
    user_agent text,
    referrer text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: webhooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.webhooks (
    id character varying(100) NOT NULL,
    type character varying(50) NOT NULL,
    payload jsonb NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    retry_count integer DEFAULT 0,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    processed_at timestamp without time zone
);


--
-- Name: admin_activity_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_activity_logs ALTER COLUMN id SET DEFAULT nextval('public.admin_activity_logs_id_seq1'::regclass);


--
-- Name: admin_alerts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_alerts ALTER COLUMN id SET DEFAULT nextval('public.admin_alerts_id_seq1'::regclass);


--
-- Name: admin_role_audit id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_role_audit ALTER COLUMN id SET DEFAULT nextval('public.admin_role_audit_id_seq'::regclass);


--
-- Name: ai_image_generations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_image_generations ALTER COLUMN id SET DEFAULT nextval('public.ai_image_generations_id_seq'::regclass);


--
-- Name: archived_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.archived_transactions ALTER COLUMN id SET DEFAULT nextval('public.archived_transactions_id_seq1'::regclass);


--
-- Name: brand_template_assets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_template_assets ALTER COLUMN id SET DEFAULT nextval('public.brand_template_assets_id_seq'::regclass);


--
-- Name: bug_reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bug_reports ALTER COLUMN id SET DEFAULT nextval('public.bug_reports_id_seq'::regclass);


--
-- Name: commitment_benefits_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commitment_benefits_log ALTER COLUMN id SET DEFAULT nextval('public.commitment_benefits_log_id_seq1'::regclass);


--
-- Name: commitment_payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commitment_payments ALTER COLUMN id SET DEFAULT nextval('public.commitment_payments_id_seq1'::regclass);


--
-- Name: commitment_payments payment_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commitment_payments ALTER COLUMN payment_id SET DEFAULT nextval('public.commitment_payments_payment_id_seq'::regclass);


--
-- Name: commitment_retry_schedule id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commitment_retry_schedule ALTER COLUMN id SET DEFAULT nextval('public.commitment_retry_schedule_id_seq1'::regclass);


--
-- Name: commitment_subscriptions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commitment_subscriptions ALTER COLUMN id SET DEFAULT nextval('public.commitment_subscriptions_id_seq1'::regclass);


--
-- Name: commitment_subscriptions subscription_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commitment_subscriptions ALTER COLUMN subscription_id SET DEFAULT nextval('public.commitment_subscriptions_subscription_id_seq'::regclass);


--
-- Name: email_templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates ALTER COLUMN id SET DEFAULT nextval('public.email_templates_id_seq'::regclass);


--
-- Name: emergency_freeze_audit id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_freeze_audit ALTER COLUMN id SET DEFAULT nextval('public.emergency_freeze_audit_id_seq'::regclass);


--
-- Name: idempotency_keys id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency_keys ALTER COLUMN id SET DEFAULT nextval('public.idempotency_keys_id_seq'::regclass);


--
-- Name: industries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.industries ALTER COLUMN id SET DEFAULT nextval('public.industries_id_seq'::regclass);


--
-- Name: rcg_staking id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rcg_staking ALTER COLUMN id SET DEFAULT nextval('public.rcg_staking_id_seq1'::regclass);


--
-- Name: referrals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals ALTER COLUMN id SET DEFAULT nextval('public.referrals_id_seq1'::regclass);


--
-- Name: revenue_distributions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revenue_distributions ALTER COLUMN id SET DEFAULT nextval('public.revenue_distributions_id_seq1'::regclass);


--
-- Name: shop_deposits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_deposits ALTER COLUMN id SET DEFAULT nextval('public.shop_deposits_id_seq1'::regclass);


--
-- Name: shop_gallery_photos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_gallery_photos ALTER COLUMN id SET DEFAULT nextval('public.shop_gallery_photos_id_seq'::regclass);


--
-- Name: stripe_payment_attempts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_payment_attempts ALTER COLUMN id SET DEFAULT nextval('public.stripe_payment_attempts_id_seq1'::regclass);


--
-- Name: stripe_payment_methods id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_payment_methods ALTER COLUMN id SET DEFAULT nextval('public.stripe_payment_methods_id_seq1'::regclass);


--
-- Name: stripe_subscription_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_subscription_events ALTER COLUMN id SET DEFAULT nextval('public.stripe_subscription_events_id_seq1'::regclass);


--
-- Name: subscription_notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_notifications ALTER COLUMN id SET DEFAULT nextval('public.subscription_notifications_id_seq1'::regclass);


--
-- Name: system_status id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_status ALTER COLUMN id SET DEFAULT nextval('public.system_status_id_seq'::regclass);


--
-- Name: unsuspend_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unsuspend_requests ALTER COLUMN id SET DEFAULT nextval('public.unsuspend_requests_id_seq1'::regclass);


--
-- Name: ad_ai_costs ad_ai_costs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_ai_costs
    ADD CONSTRAINT ad_ai_costs_pkey PRIMARY KEY (id);


--
-- Name: ad_billing_charges ad_billing_charges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_billing_charges
    ADD CONSTRAINT ad_billing_charges_pkey PRIMARY KEY (id);


--
-- Name: ad_billing_plans ad_billing_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_billing_plans
    ADD CONSTRAINT ad_billing_plans_pkey PRIMARY KEY (shop_id);


--
-- Name: ad_campaign_requests ad_campaign_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_campaign_requests
    ADD CONSTRAINT ad_campaign_requests_pkey PRIMARY KEY (id);


--
-- Name: ad_campaigns ad_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_campaigns
    ADD CONSTRAINT ad_campaigns_pkey PRIMARY KEY (id);


--
-- Name: ad_creatives ad_creatives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_creatives
    ADD CONSTRAINT ad_creatives_pkey PRIMARY KEY (id);


--
-- Name: ad_enrollment_requests ad_enrollment_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_enrollment_requests
    ADD CONSTRAINT ad_enrollment_requests_pkey PRIMARY KEY (shop_id);


--
-- Name: ad_experiments ad_experiments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_experiments
    ADD CONSTRAINT ad_experiments_pkey PRIMARY KEY (id);


--
-- Name: ad_lead_messages ad_lead_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_lead_messages
    ADD CONSTRAINT ad_lead_messages_pkey PRIMARY KEY (id);


--
-- Name: ad_leads ad_leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_leads
    ADD CONSTRAINT ad_leads_pkey PRIMARY KEY (id);


--
-- Name: ad_messages ad_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_messages
    ADD CONSTRAINT ad_messages_pkey PRIMARY KEY (id);


--
-- Name: ad_performance_daily ad_performance_daily_campaign_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_performance_daily
    ADD CONSTRAINT ad_performance_daily_campaign_id_date_key UNIQUE (campaign_id, date);


--
-- Name: ad_performance_daily ad_performance_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_performance_daily
    ADD CONSTRAINT ad_performance_daily_pkey PRIMARY KEY (id);


--
-- Name: ad_plan_changes ad_plan_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_plan_changes
    ADD CONSTRAINT ad_plan_changes_pkey PRIMARY KEY (id);


--
-- Name: ad_safeguards_state ad_safeguards_state_campaign_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_safeguards_state
    ADD CONSTRAINT ad_safeguards_state_campaign_id_key UNIQUE (campaign_id);


--
-- Name: ad_safeguards_state ad_safeguards_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_safeguards_state
    ADD CONSTRAINT ad_safeguards_state_pkey PRIMARY KEY (id);


--
-- Name: admin_role_audit admin_role_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_role_audit
    ADD CONSTRAINT admin_role_audit_pkey PRIMARY KEY (id);


--
-- Name: admin_treasury admin_treasury_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_treasury
    ADD CONSTRAINT admin_treasury_pkey PRIMARY KEY (id);


--
-- Name: affiliate_group_token_transactions affiliate_group_token_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_group_token_transactions
    ADD CONSTRAINT affiliate_group_token_transactions_pkey PRIMARY KEY (id);


--
-- Name: affiliate_shop_group_settings affiliate_shop_group_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_shop_group_settings
    ADD CONSTRAINT affiliate_shop_group_settings_pkey PRIMARY KEY (group_id);


--
-- Name: affiliate_shop_groups affiliate_shop_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_shop_groups
    ADD CONSTRAINT affiliate_shop_groups_pkey PRIMARY KEY (group_id);


--
-- Name: ai_agent_messages ai_agent_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_agent_messages
    ADD CONSTRAINT ai_agent_messages_pkey PRIMARY KEY (id);


--
-- Name: ai_customer_chat_messages ai_customer_chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_customer_chat_messages
    ADD CONSTRAINT ai_customer_chat_messages_pkey PRIMARY KEY (id);


--
-- Name: ai_customer_chat_sessions ai_customer_chat_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_customer_chat_sessions
    ADD CONSTRAINT ai_customer_chat_sessions_pkey PRIMARY KEY (id);


--
-- Name: ai_customer_chat_sessions ai_customer_chat_sessions_session_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_customer_chat_sessions
    ADD CONSTRAINT ai_customer_chat_sessions_session_token_key UNIQUE (session_token);


--
-- Name: ai_dispatch_audit ai_dispatch_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_dispatch_audit
    ADD CONSTRAINT ai_dispatch_audit_pkey PRIMARY KEY (id);


--
-- Name: ai_help_messages ai_help_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_help_messages
    ADD CONSTRAINT ai_help_messages_pkey PRIMARY KEY (id);


--
-- Name: ai_image_generations ai_image_generations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_image_generations
    ADD CONSTRAINT ai_image_generations_pkey PRIMARY KEY (id);


--
-- Name: ai_insights_anomalies ai_insights_anomalies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_insights_anomalies
    ADD CONSTRAINT ai_insights_anomalies_pkey PRIMARY KEY (id);


--
-- Name: ai_insights_messages ai_insights_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_insights_messages
    ADD CONSTRAINT ai_insights_messages_pkey PRIMARY KEY (id);


--
-- Name: ai_insights_pinned_queries ai_insights_pinned_queries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_insights_pinned_queries
    ADD CONSTRAINT ai_insights_pinned_queries_pkey PRIMARY KEY (id);


--
-- Name: ai_marketing_messages ai_marketing_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_marketing_messages
    ADD CONSTRAINT ai_marketing_messages_pkey PRIMARY KEY (id);


--
-- Name: ai_orchestrate_messages ai_orchestrate_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_orchestrate_messages
    ADD CONSTRAINT ai_orchestrate_messages_pkey PRIMARY KEY (id);


--
-- Name: ai_shop_settings ai_shop_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_shop_settings
    ADD CONSTRAINT ai_shop_settings_pkey PRIMARY KEY (shop_id);


--
-- Name: ai_voice_transcriptions ai_voice_transcriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_voice_transcriptions
    ADD CONSTRAINT ai_voice_transcriptions_pkey PRIMARY KEY (id);


--
-- Name: auto_message_sends auto_message_sends_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auto_message_sends
    ADD CONSTRAINT auto_message_sends_pkey PRIMARY KEY (id);


--
-- Name: blocked_customers blocked_customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocked_customers
    ADD CONSTRAINT blocked_customers_pkey PRIMARY KEY (id);


--
-- Name: brand_template_assets brand_template_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_template_assets
    ADD CONSTRAINT brand_template_assets_pkey PRIMARY KEY (id);


--
-- Name: bug_reports bug_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bug_reports
    ADD CONSTRAINT bug_reports_pkey PRIMARY KEY (id);


--
-- Name: campaign_recipients campaign_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_recipients
    ADD CONSTRAINT campaign_recipients_pkey PRIMARY KEY (id);


--
-- Name: communication_campaigns communication_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_campaigns
    ADD CONSTRAINT communication_campaigns_pkey PRIMARY KEY (id);


--
-- Name: contact_imports contact_imports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_imports
    ADD CONSTRAINT contact_imports_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (conversation_id);


--
-- Name: cross_shop_verifications cross_shop_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cross_shop_verifications
    ADD CONSTRAINT cross_shop_verifications_pkey PRIMARY KEY (verification_id);


--
-- Name: customer_notification_preferences customer_notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_notification_preferences
    ADD CONSTRAINT customer_notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (address);


--
-- Name: deposit_transactions deposit_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deposit_transactions
    ADD CONSTRAINT deposit_transactions_pkey PRIMARY KEY (id);


--
-- Name: device_push_tokens device_push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_push_tokens
    ADD CONSTRAINT device_push_tokens_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_template_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_template_key_key UNIQUE (template_key);


--
-- Name: emergency_freeze_audit emergency_freeze_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_freeze_audit
    ADD CONSTRAINT emergency_freeze_audit_pkey PRIMARY KEY (id);


--
-- Name: flagged_reviews flagged_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flagged_reviews
    ADD CONSTRAINT flagged_reviews_pkey PRIMARY KEY (id);


--
-- Name: general_notification_preferences general_notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.general_notification_preferences
    ADD CONSTRAINT general_notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: idempotency_keys idempotency_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency_keys
    ADD CONSTRAINT idempotency_keys_pkey PRIMARY KEY (id);


--
-- Name: import_jobs import_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_jobs
    ADD CONSTRAINT import_jobs_pkey PRIMARY KEY (job_id);


--
-- Name: industries industries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.industries
    ADD CONSTRAINT industries_pkey PRIMARY KEY (id);


--
-- Name: industries industries_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.industries
    ADD CONSTRAINT industries_slug_key UNIQUE (slug);


--
-- Name: inventory_adjustments inventory_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustments
    ADD CONSTRAINT inventory_adjustments_pkey PRIMARY KEY (id);


--
-- Name: inventory_categories inventory_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_categories
    ADD CONSTRAINT inventory_categories_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_vendors inventory_vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_vendors
    ADD CONSTRAINT inventory_vendors_pkey PRIMARY KEY (id);


--
-- Name: marketing_campaign_recipients marketing_campaign_recipients_campaign_customer_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_campaign_recipients
    ADD CONSTRAINT marketing_campaign_recipients_campaign_customer_unique UNIQUE (campaign_id, customer_address);


--
-- Name: marketing_campaign_recipients marketing_campaign_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_campaign_recipients
    ADD CONSTRAINT marketing_campaign_recipients_pkey PRIMARY KEY (id);


--
-- Name: marketing_campaigns marketing_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_campaigns
    ADD CONSTRAINT marketing_campaigns_pkey PRIMARY KEY (id);


--
-- Name: marketing_email_unsubscribes marketing_email_unsubscribes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_email_unsubscribes
    ADD CONSTRAINT marketing_email_unsubscribes_pkey PRIMARY KEY (id);


--
-- Name: marketing_email_unsubscribes marketing_email_unsubscribes_shop_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_email_unsubscribes
    ADD CONSTRAINT marketing_email_unsubscribes_shop_id_email_key UNIQUE (shop_id, email);


--
-- Name: marketing_templates marketing_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_templates
    ADD CONSTRAINT marketing_templates_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (message_id);


--
-- Name: no_show_history no_show_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.no_show_history
    ADD CONSTRAINT no_show_history_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: promo_code_uses promo_code_uses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_code_uses
    ADD CONSTRAINT promo_code_uses_pkey PRIMARY KEY (id);


--
-- Name: promo_codes promo_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_suggestions purchase_order_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_suggestions
    ADD CONSTRAINT purchase_order_suggestions_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: recently_viewed_services recently_viewed_services_customer_service_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recently_viewed_services
    ADD CONSTRAINT recently_viewed_services_customer_service_unique UNIQUE (customer_address, service_id);


--
-- Name: redemption_sessions redemption_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redemption_sessions
    ADD CONSTRAINT redemption_sessions_pkey PRIMARY KEY (session_id);


--
-- Name: referrals referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: review_replies review_replies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_replies
    ADD CONSTRAINT review_replies_pkey PRIMARY KEY (id);


--
-- Name: sent_emails_log sent_emails_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sent_emails_log
    ADD CONSTRAINT sent_emails_log_pkey PRIMARY KEY (id);


--
-- Name: service_ai_faq_entries service_ai_faq_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_ai_faq_entries
    ADD CONSTRAINT service_ai_faq_entries_pkey PRIMARY KEY (faq_entry_id);


--
-- Name: service_duration_config service_duration_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_duration_config
    ADD CONSTRAINT service_duration_config_pkey PRIMARY KEY (duration_id);


--
-- Name: service_duration_config service_duration_config_service_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_duration_config
    ADD CONSTRAINT service_duration_config_service_id_key UNIQUE (service_id);


--
-- Name: service_favorites service_favorites_customer_service_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_favorites
    ADD CONSTRAINT service_favorites_customer_service_unique UNIQUE (customer_address, service_id);


--
-- Name: service_inventory_items service_inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_inventory_items
    ADD CONSTRAINT service_inventory_items_pkey PRIMARY KEY (id);


--
-- Name: service_inventory_items service_inventory_items_service_id_inventory_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_inventory_items
    ADD CONSTRAINT service_inventory_items_service_id_inventory_item_id_key UNIQUE (service_id, inventory_item_id);


--
-- Name: service_orders service_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_orders
    ADD CONSTRAINT service_orders_pkey PRIMARY KEY (order_id);


--
-- Name: shop_auto_messages shop_auto_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_auto_messages
    ADD CONSTRAINT shop_auto_messages_pkey PRIMARY KEY (id);


--
-- Name: shop_availability shop_availability_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_availability
    ADD CONSTRAINT shop_availability_pkey PRIMARY KEY (availability_id);


--
-- Name: shop_availability shop_availability_shop_id_day_of_week_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_availability
    ADD CONSTRAINT shop_availability_shop_id_day_of_week_key UNIQUE (shop_id, day_of_week);


--
-- Name: shop_brand_kits shop_brand_kits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_brand_kits
    ADD CONSTRAINT shop_brand_kits_pkey PRIMARY KEY (shop_id);


--
-- Name: shop_calendar_connections shop_calendar_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_calendar_connections
    ADD CONSTRAINT shop_calendar_connections_pkey PRIMARY KEY (id);


--
-- Name: shop_date_overrides shop_date_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_date_overrides
    ADD CONSTRAINT shop_date_overrides_pkey PRIMARY KEY (override_id);


--
-- Name: shop_date_overrides shop_date_overrides_shop_id_override_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_date_overrides
    ADD CONSTRAINT shop_date_overrides_shop_id_override_date_key UNIQUE (shop_id, override_date);


--
-- Name: shop_email_preferences shop_email_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_email_preferences
    ADD CONSTRAINT shop_email_preferences_pkey PRIMARY KEY (shop_id);


--
-- Name: shop_gallery_photos shop_gallery_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_gallery_photos
    ADD CONSTRAINT shop_gallery_photos_pkey PRIMARY KEY (id);


--
-- Name: shop_gmail_connections shop_gmail_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_gmail_connections
    ADD CONSTRAINT shop_gmail_connections_pkey PRIMARY KEY (id);


--
-- Name: shop_group_rcn_allocations shop_group_rcn_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_group_rcn_allocations
    ADD CONSTRAINT shop_group_rcn_allocations_pkey PRIMARY KEY (shop_id, group_id);


--
-- Name: shop_no_show_policy shop_no_show_policy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_no_show_policy
    ADD CONSTRAINT shop_no_show_policy_pkey PRIMARY KEY (shop_id);


--
-- Name: shop_quick_replies shop_quick_replies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_quick_replies
    ADD CONSTRAINT shop_quick_replies_pkey PRIMARY KEY (id);


--
-- Name: shop_reports shop_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_reports
    ADD CONSTRAINT shop_reports_pkey PRIMARY KEY (id);


--
-- Name: shop_time_slot_config shop_time_slot_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_time_slot_config
    ADD CONSTRAINT shop_time_slot_config_pkey PRIMARY KEY (config_id);


--
-- Name: shop_time_slot_config shop_time_slot_config_shop_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_time_slot_config
    ADD CONSTRAINT shop_time_slot_config_shop_id_unique UNIQUE (shop_id);


--
-- Name: shops shops_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shops
    ADD CONSTRAINT shops_pkey PRIMARY KEY (shop_id);


--
-- Name: suggestion_accuracy_metrics suggestion_accuracy_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestion_accuracy_metrics
    ADD CONSTRAINT suggestion_accuracy_metrics_pkey PRIMARY KEY (id);


--
-- Name: suggestion_accuracy_metrics suggestion_accuracy_metrics_shop_id_period_start_period_end_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestion_accuracy_metrics
    ADD CONSTRAINT suggestion_accuracy_metrics_shop_id_period_start_period_end_key UNIQUE (shop_id, period_start, period_end);


--
-- Name: support_messages support_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_pkey PRIMARY KEY (id);


--
-- Name: support_ticket_views support_ticket_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_views
    ADD CONSTRAINT support_ticket_views_pkey PRIMARY KEY (id);


--
-- Name: support_ticket_views support_ticket_views_ticket_id_viewer_type_viewer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_views
    ADD CONSTRAINT support_ticket_views_ticket_id_viewer_type_viewer_id_key UNIQUE (ticket_id, viewer_type, viewer_id);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_setting_key_key UNIQUE (setting_key);


--
-- Name: system_status system_status_component_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_status
    ADD CONSTRAINT system_status_component_key UNIQUE (component);


--
-- Name: system_status system_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_status
    ADD CONSTRAINT system_status_pkey PRIMARY KEY (id);


--
-- Name: typing_indicators typing_indicators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.typing_indicators
    ADD CONSTRAINT typing_indicators_pkey PRIMARY KEY (conversation_id, user_address);


--
-- Name: inventory_categories unique_category_per_shop; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_categories
    ADD CONSTRAINT unique_category_per_shop UNIQUE (shop_id, name);


--
-- Name: idempotency_keys unique_idempotency_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency_keys
    ADD CONSTRAINT unique_idempotency_key UNIQUE (idempotency_key, shop_id, endpoint);


--
-- Name: flagged_reviews unique_review_flag; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flagged_reviews
    ADD CONSTRAINT unique_review_flag UNIQUE (review_id, shop_id);


--
-- Name: service_group_availability unique_service_group_link; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_group_availability
    ADD CONSTRAINT unique_service_group_link UNIQUE (service_id, group_id);


--
-- Name: blocked_customers unique_shop_customer_block; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocked_customers
    ADD CONSTRAINT unique_shop_customer_block UNIQUE (shop_id, customer_wallet_address, is_active);


--
-- Name: shop_gmail_connections unique_shop_gmail; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_gmail_connections
    ADD CONSTRAINT unique_shop_gmail UNIQUE (shop_id);


--
-- Name: purchase_orders unique_shop_po_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT unique_shop_po_number UNIQUE (shop_id, po_number);


--
-- Name: shop_calendar_connections unique_shop_provider; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_calendar_connections
    ADD CONSTRAINT unique_shop_provider UNIQUE (shop_id, provider);


--
-- Name: device_push_tokens unique_user_device; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_push_tokens
    ADD CONSTRAINT unique_user_device UNIQUE (wallet_address, device_id);


--
-- Name: general_notification_preferences unique_user_general_preferences; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.general_notification_preferences
    ADD CONSTRAINT unique_user_general_preferences UNIQUE (user_address, user_type);


--
-- Name: inventory_vendors unique_vendor_per_shop; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_vendors
    ADD CONSTRAINT unique_vendor_per_shop UNIQUE (shop_id, name);


--
-- Name: waitlist waitlist_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist
    ADD CONSTRAINT waitlist_email_key UNIQUE (email);


--
-- Name: waitlist_page_views waitlist_page_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist_page_views
    ADD CONSTRAINT waitlist_page_views_pkey PRIMARY KEY (id);


--
-- Name: waitlist waitlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist
    ADD CONSTRAINT waitlist_pkey PRIMARY KEY (id);


--
-- Name: webhooks webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhooks
    ADD CONSTRAINT webhooks_pkey PRIMARY KEY (id);


--
-- Name: idx_ad_ai_costs_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_ai_costs_campaign ON public.ad_ai_costs USING btree (campaign_id);


--
-- Name: idx_ad_ai_costs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_ai_costs_created ON public.ad_ai_costs USING btree (created_at);


--
-- Name: idx_ad_billing_charges_shop; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_billing_charges_shop ON public.ad_billing_charges USING btree (shop_id);


--
-- Name: idx_ad_campaign_requests_shop; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_campaign_requests_shop ON public.ad_campaign_requests USING btree (shop_id, created_at);


--
-- Name: idx_ad_campaign_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_campaign_requests_status ON public.ad_campaign_requests USING btree (status);


--
-- Name: idx_ad_campaigns_meta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_campaigns_meta ON public.ad_campaigns USING btree (meta_campaign_id) WHERE (meta_campaign_id IS NOT NULL);


--
-- Name: idx_ad_campaigns_shop; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_campaigns_shop ON public.ad_campaigns USING btree (shop_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_ad_campaigns_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_campaigns_status ON public.ad_campaigns USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_ad_creatives_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_creatives_campaign ON public.ad_creatives USING btree (campaign_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_ad_creatives_meta_creative; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_creatives_meta_creative ON public.ad_creatives USING btree (campaign_id) WHERE ((meta_creative_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: idx_ad_enrollment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_enrollment_status ON public.ad_enrollment_requests USING btree (status);


--
-- Name: idx_ad_experiments_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_experiments_campaign ON public.ad_experiments USING btree (campaign_id);


--
-- Name: idx_ad_lead_messages_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_lead_messages_lead ON public.ad_lead_messages USING btree (lead_id, created_at);


--
-- Name: idx_ad_leads_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_leads_campaign ON public.ad_leads USING btree (campaign_id);


--
-- Name: idx_ad_leads_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_leads_phone ON public.ad_leads USING btree (phone);


--
-- Name: idx_ad_leads_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_leads_status ON public.ad_leads USING btree (lead_status);


--
-- Name: idx_ad_messages_shop; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_messages_shop ON public.ad_messages USING btree (shop_id, created_at);


--
-- Name: idx_ad_plan_changes_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_plan_changes_scheduled ON public.ad_plan_changes USING btree (status, effective_at) WHERE (status = 'scheduled'::text);


--
-- Name: idx_ad_plan_changes_shop; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_plan_changes_shop ON public.ad_plan_changes USING btree (shop_id, created_at);


--
-- Name: idx_admin_alerts_acknowledged; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_alerts_acknowledged ON public.admin_alerts USING btree (acknowledged);


--
-- Name: idx_admin_alerts_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_alerts_severity ON public.admin_alerts USING btree (severity);


--
-- Name: idx_admin_alerts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_alerts_type ON public.admin_alerts USING btree (alert_type);


--
-- Name: idx_affiliate_group_members_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_affiliate_group_members_group ON public.affiliate_shop_group_members USING btree (group_id);


--
-- Name: idx_affiliate_group_members_shop; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_affiliate_group_members_shop ON public.affiliate_shop_group_members USING btree (shop_id);


--
-- Name: idx_affiliate_group_members_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_affiliate_group_members_status ON public.affiliate_shop_group_members USING btree (status);


--
-- Name: idx_affiliate_group_transactions_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_affiliate_group_transactions_customer ON public.affiliate_group_token_transactions USING btree (customer_address);


--
-- Name: idx_affiliate_group_transactions_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_affiliate_group_transactions_group ON public.affiliate_group_token_transactions USING btree (group_id);


--
-- Name: idx_affiliate_group_transactions_shop; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_affiliate_group_transactions_shop ON public.affiliate_group_token_transactions USING btree (shop_id);


--
-- Name: idx_affiliate_group_transactions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_affiliate_group_transactions_type ON public.affiliate_group_token_transactions USING btree (type);


--
-- Name: idx_affiliate_shop_groups_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_affiliate_shop_groups_active ON public.affiliate_shop_groups USING btree (active);


--
-- Name: idx_affiliate_shop_groups_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_affiliate_shop_groups_type ON public.affiliate_shop_groups USING btree (group_type);


--
-- Name: idx_ai_agent_messages_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_agent_messages_conversation ON public.ai_agent_messages USING btree (conversation_id, created_at DESC);


--
-- Name: idx_ai_agent_messages_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_agent_messages_customer ON public.ai_agent_messages USING btree (customer_address, created_at DESC);


--
-- Name: idx_ai_agent_messages_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_agent_messages_service ON public.ai_agent_messages USING btree (service_id) WHERE (service_id IS NOT NULL);


--
-- Name: idx_ai_agent_messages_shop_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_agent_messages_shop_created ON public.ai_agent_messages USING btree (shop_id, created_at DESC);


--
-- Name: idx_ai_dispatch_audit_decision; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_dispatch_audit_decision ON public.ai_dispatch_audit USING btree (router_decision, created_at DESC);


--
-- Name: idx_ai_dispatch_audit_session_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_dispatch_audit_session_created ON public.ai_dispatch_audit USING btree (session_id, created_at);


--
-- Name: idx_ai_dispatch_audit_shop_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_dispatch_audit_shop_created ON public.ai_dispatch_audit USING btree (shop_id, created_at DESC);


--
-- Name: idx_ai_help_messages_session_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_help_messages_session_created ON public.ai_help_messages USING btree (session_id, created_at);


--
-- Name: idx_ai_help_messages_shop_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_help_messages_shop_created ON public.ai_help_messages USING btree (shop_id, created_at DESC);


--
-- Name: idx_ai_image_gen_shop_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_image_gen_shop_created ON public.ai_image_generations USING btree (shop_id, created_at DESC);


--
-- Name: idx_ai_insights_anomalies_shop_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_insights_anomalies_shop_active ON public.ai_insights_anomalies USING btree (shop_id, dismissed_at, expires_at);


--
-- Name: idx_ai_insights_anomalies_shop_metric_detected; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_insights_anomalies_shop_metric_detected ON public.ai_insights_anomalies USING btree (shop_id, metric_key, detected_at DESC);


--
-- Name: idx_ai_insights_messages_session_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_insights_messages_session_created ON public.ai_insights_messages USING btree (session_id, created_at);


--
-- Name: idx_ai_insights_messages_shop_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_insights_messages_shop_created ON public.ai_insights_messages USING btree (shop_id, created_at DESC);


--
-- Name: idx_ai_insights_pinned_shop_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_insights_pinned_shop_order ON public.ai_insights_pinned_queries USING btree (shop_id, display_order, pinned_at DESC);


--
-- Name: idx_ai_marketing_messages_session_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_marketing_messages_session_created ON public.ai_marketing_messages USING btree (session_id, created_at);


--
-- Name: idx_ai_marketing_messages_shop_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_marketing_messages_shop_created ON public.ai_marketing_messages USING btree (shop_id, created_at DESC);


--
-- Name: idx_ai_orchestrate_messages_session_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_orchestrate_messages_session_created ON public.ai_orchestrate_messages USING btree (session_id, created_at);


--
-- Name: idx_ai_orchestrate_messages_shop_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_orchestrate_messages_shop_created ON public.ai_orchestrate_messages USING btree (shop_id, created_at DESC);


--
-- Name: idx_ai_shop_settings_global_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_shop_settings_global_enabled ON public.ai_shop_settings USING btree (ai_global_enabled) WHERE (ai_global_enabled = true);


--
-- Name: idx_ai_voice_transcriptions_session_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_voice_transcriptions_session_created ON public.ai_voice_transcriptions USING btree (session_id, created_at);


--
-- Name: idx_ai_voice_transcriptions_shop_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_voice_transcriptions_shop_created ON public.ai_voice_transcriptions USING btree (shop_id, created_at DESC);


--
-- Name: idx_auto_messages_shop; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auto_messages_shop ON public.shop_auto_messages USING btree (shop_id, is_active);


--
-- Name: idx_auto_sends_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auto_sends_lookup ON public.auto_message_sends USING btree (auto_message_id, customer_address);


--
-- Name: idx_auto_sends_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auto_sends_pending ON public.auto_message_sends USING btree (status, scheduled_send_at) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_auto_sends_shop; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auto_sends_shop ON public.auto_message_sends USING btree (shop_id, sent_at);


--
-- Name: idx_blocked_customers_shop_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocked_customers_shop_id ON public.blocked_customers USING btree (shop_id) WHERE (is_active = true);


--
-- Name: idx_blocked_customers_shop_wallet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocked_customers_shop_wallet ON public.blocked_customers USING btree (shop_id, customer_wallet_address) WHERE (is_active = true);


--
-- Name: idx_blocked_customers_wallet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocked_customers_wallet ON public.blocked_customers USING btree (customer_wallet_address) WHERE (is_active = true);


--
-- Name: idx_brand_template_assets_shop; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brand_template_assets_shop ON public.brand_template_assets USING btree (shop_id, created_at DESC);


--
-- Name: idx_bug_reports_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bug_reports_category ON public.bug_reports USING btree (category);


--
-- Name: idx_bug_reports_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bug_reports_created_at ON public.bug_reports USING btree (created_at DESC);


--
-- Name: idx_bug_reports_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bug_reports_status ON public.bug_reports USING btree (status);


--
-- Name: idx_bug_reports_wallet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bug_reports_wallet ON public.bug_reports USING btree (wallet_address);


--
-- Name: idx_campaign_recipients_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_recipients_campaign ON public.marketing_campaign_recipients USING btree (campaign_id);


--
-- Name: idx_campaign_recipients_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_recipients_campaign_id ON public.campaign_recipients USING btree (campaign_id);


--
-- Name: idx_campaign_recipients_contact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_recipients_contact_id ON public.campaign_recipients USING btree (contact_id);


--
-- Name: idx_campaign_recipients_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_recipients_customer ON public.marketing_campaign_recipients USING btree (customer_address);


--
-- Name: idx_campaign_recipients_reward_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_recipients_reward_lookup ON public.marketing_campaign_recipients USING btree (customer_address, reward_status);


--
-- Name: idx_campaign_recipients_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_recipients_status ON public.campaign_recipients USING btree (status);


--
-- Name: idx_campaign_recipients_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_campaign_recipients_unique ON public.campaign_recipients USING btree (campaign_id, contact_id, delivery_type);


--
-- Name: idx_communication_campaigns_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_communication_campaigns_created_at ON public.communication_campaigns USING btree (created_at DESC);


--
-- Name: idx_communication_campaigns_shop_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_communication_campaigns_shop_id ON public.communication_campaigns USING btree (shop_id);


--
-- Name: idx_communication_campaigns_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_communication_campaigns_status ON public.communication_campaigns USING btree (status);


--
-- Name: idx_contact_imports_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_imports_created_at ON public.contact_imports USING btree (created_at DESC);


--
-- Name: idx_contact_imports_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_imports_email ON public.contact_imports USING btree (email) WHERE (email IS NOT NULL);


--
-- Name: idx_contact_imports_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_imports_phone ON public.contact_imports USING btree (phone) WHERE (phone IS NOT NULL);


--
-- Name: idx_contact_imports_shop_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_contact_imports_shop_email ON public.contact_imports USING btree (shop_id, email) WHERE ((email IS NOT NULL) AND (status <> 'invalid'::text));


--
-- Name: idx_contact_imports_shop_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_imports_shop_id ON public.contact_imports USING btree (shop_id);


--
-- Name: idx_contact_imports_shop_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_contact_imports_shop_phone ON public.contact_imports USING btree (shop_id, phone) WHERE ((phone IS NOT NULL) AND (status <> 'invalid'::text));


--
-- Name: idx_contact_imports_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_imports_status ON public.contact_imports USING btree (status);


--
-- Name: idx_conversations_ai_paused_until; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_ai_paused_until ON public.conversations USING btree (ai_paused_until) WHERE (ai_paused_until IS NOT NULL);


--
-- Name: idx_conversations_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_customer ON public.conversations USING btree (customer_address, updated_at DESC);


--
-- Name: idx_conversations_last_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_last_message ON public.conversations USING btree (last_message_at DESC);


--
-- Name: idx_conversations_service_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_service_id ON public.conversations USING btree (service_id) WHERE (service_id IS NOT NULL);


--
-- Name: idx_conversations_shop; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_shop ON public.conversations USING btree (shop_id, updated_at DESC);


--
-- Name: idx_conversations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_status ON public.conversations USING btree (status);


--
-- Name: idx_customer_affiliate_group_balances_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_affiliate_group_balances_customer ON public.customer_affiliate_group_balances USING btree (customer_address);


--
-- Name: idx_customer_affiliate_group_balances_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_affiliate_group_balances_group ON public.customer_affiliate_group_balances USING btree (group_id);


--
-- Name: idx_customer_chat_messages_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_chat_messages_created ON public.ai_customer_chat_messages USING btree (created_at);


--
-- Name: idx_customer_chat_messages_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_chat_messages_session ON public.ai_customer_chat_messages USING btree (session_id, created_at);


--
-- Name: idx_customer_chat_sessions_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_chat_sessions_expires ON public.ai_customer_chat_sessions USING btree (expires_at);


--
-- Name: idx_customer_chat_sessions_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_chat_sessions_token ON public.ai_customer_chat_sessions USING btree (session_token);


--
-- Name: idx_customers_no_show_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_no_show_tier ON public.customers USING btree (no_show_tier);


--
-- Name: idx_customers_suspended; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_suspended ON public.customers USING btree (booking_suspended_until) WHERE (booking_suspended_until IS NOT NULL);


--
-- Name: idx_customers_wallet_address; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_wallet_address ON public.customers USING btree (wallet_address);


--
-- Name: idx_customers_wallet_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_wallet_tier ON public.customers USING btree (wallet_address, tier);


--
-- Name: idx_date_overrides_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_date_overrides_date ON public.shop_date_overrides USING btree (override_date);


--
-- Name: idx_date_overrides_shop; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_date_overrides_shop ON public.shop_date_overrides USING btree (shop_id);


--
-- Name: idx_deposit_transactions_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deposit_transactions_customer ON public.deposit_transactions USING btree (customer_address, created_at DESC);


--
-- Name: idx_deposit_transactions_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deposit_transactions_order ON public.deposit_transactions USING btree (order_id);


--
-- Name: idx_deposit_transactions_shop; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deposit_transactions_shop ON public.deposit_transactions USING btree (shop_id, created_at DESC);


--
-- Name: idx_deposit_transactions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deposit_transactions_status ON public.deposit_transactions USING btree (status);


--
-- Name: idx_email_templates_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_templates_category ON public.email_templates USING btree (category);


--
-- Name: idx_email_templates_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_templates_enabled ON public.email_templates USING btree (enabled);


--
-- Name: idx_email_templates_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_templates_key ON public.email_templates USING btree (template_key);


--
-- Name: idx_emergency_freeze_audit_admin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emergency_freeze_audit_admin ON public.emergency_freeze_audit USING btree (admin_address);


--
-- Name: idx_emergency_freeze_audit_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emergency_freeze_audit_timestamp ON public.emergency_freeze_audit USING btree ("timestamp");


--
-- Name: idx_favorites_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_favorites_created_at ON public.service_favorites USING btree (created_at DESC);


--
-- Name: idx_favorites_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_favorites_customer ON public.service_favorites USING btree (customer_address);


--
-- Name: idx_favorites_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_favorites_service ON public.service_favorites USING btree (service_id);


--
-- Name: idx_flagged_reviews_review_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_flagged_reviews_review_id ON public.flagged_reviews USING btree (review_id);


--
-- Name: idx_flagged_reviews_shop_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_flagged_reviews_shop_id ON public.flagged_reviews USING btree (shop_id);


--
-- Name: idx_flagged_reviews_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_flagged_reviews_status ON public.flagged_reviews USING btree (status);


--
-- Name: idx_general_notif_prefs_composite; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_general_notif_prefs_composite ON public.general_notification_preferences USING btree (user_address, user_type);


--
-- Name: idx_general_notif_prefs_user_address; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_general_notif_prefs_user_address ON public.general_notification_preferences USING btree (user_address);


--
-- Name: idx_general_notif_prefs_user_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_general_notif_prefs_user_type ON public.general_notification_preferences USING btree (user_type);


--
-- Name: idx_helpful_votes_review; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_helpful_votes_review ON public.review_helpful_votes USING btree (review_id);


--
-- Name: idx_helpful_votes_voter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_helpful_votes_voter ON public.review_helpful_votes USING btree (voter_address);


--
-- Name: idx_idempotency_keys_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_idempotency_keys_expires ON public.idempotency_keys USING btree (expires_at);


--
-- Name: idx_idempotency_keys_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_idempotency_keys_lookup ON public.idempotency_keys USING btree (idempotency_key, shop_id, endpoint);


--
-- Name: idx_import_jobs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_jobs_created_at ON public.import_jobs USING btree (created_at DESC);


--
-- Name: idx_import_jobs_entity_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_jobs_entity_type ON public.import_jobs USING btree (entity_type);


--
-- Name: idx_import_jobs_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_jobs_expires_at ON public.import_jobs USING btree (expires_at);


--
-- Name: idx_import_jobs_shop_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_jobs_shop_id ON public.import_jobs USING btree (shop_id);


--
-- Name: idx_import_jobs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_jobs_status ON public.import_jobs USING btree (status);


--
-- Name: idx_inventory_adjustments_adjustment_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_adjustments_adjustment_type ON public.inventory_adjustments USING btree (adjustment_type);


--
-- Name: idx_inventory_adjustments_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_adjustments_created_at ON public.inventory_adjustments USING btree (created_at DESC);


--
-- Name: idx_inventory_adjustments_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_adjustments_item_id ON public.inventory_adjustments USING btree (item_id);


--
-- Name: idx_inventory_adjustments_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_adjustments_reference ON public.inventory_adjustments USING btree (reference_type, reference_id);


--
-- Name: idx_inventory_adjustments_shop_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_adjustments_shop_id ON public.inventory_adjustments USING btree (shop_id);


--
-- Name: idx_inventory_categories_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_categories_deleted_at ON public.inventory_categories USING btree (deleted_at);


--
-- Name: idx_inventory_categories_shop_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_categories_shop_id ON public.inventory_categories USING btree (shop_id);


--
-- Name: idx_inventory_items_barcode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_items_barcode ON public.inventory_items USING btree (barcode);


--
-- Name: idx_inventory_items_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_items_category_id ON public.inventory_items USING btree (category_id);


--
-- Name: idx_inventory_items_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_items_deleted_at ON public.inventory_items USING btree (deleted_at);


--
-- Name: idx_inventory_items_name_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_items_name_search ON public.inventory_items USING gin (to_tsvector('english'::regconfig, (name)::text));


--
-- Name: idx_inventory_items_shop_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_items_shop_id ON public.inventory_items USING btree (shop_id);


--
-- Name: idx_inventory_items_shop_sku_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_inventory_items_shop_sku_unique ON public.inventory_items USING btree (shop_id, sku) WHERE ((deleted_at IS NULL) AND (sku IS NOT NULL));


--
-- Name: idx_inventory_items_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_items_sku ON public.inventory_items USING btree (sku);


--
-- Name: idx_inventory_items_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_items_status ON public.inventory_items USING btree (status);


--
-- Name: idx_inventory_items_vendor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_items_vendor_id ON public.inventory_items USING btree (vendor_id);


--
-- Name: idx_inventory_vendors_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_vendors_deleted_at ON public.inventory_vendors USING btree (deleted_at);


--
-- Name: idx_inventory_vendors_shop_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_vendors_shop_id ON public.inventory_vendors USING btree (shop_id);


--
-- Name: idx_marketing_campaigns_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_campaigns_created ON public.marketing_campaigns USING btree (created_at DESC);


--
-- Name: idx_marketing_campaigns_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_campaigns_scheduled ON public.marketing_campaigns USING btree (scheduled_at) WHERE ((status)::text = 'scheduled'::text);


--
-- Name: idx_marketing_campaigns_shop; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_campaigns_shop ON public.marketing_campaigns USING btree (shop_id);


--
-- Name: idx_marketing_campaigns_source_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_campaigns_source_created ON public.marketing_campaigns USING btree (shop_id, created_by_source, created_at DESC);


--
-- Name: idx_marketing_campaigns_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_campaigns_status ON public.marketing_campaigns USING btree (status);


--
-- Name: idx_marketing_email_unsubscribes_shop; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_email_unsubscribes_shop ON public.marketing_email_unsubscribes USING btree (shop_id);


--
-- Name: idx_messages_client_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_messages_client_message_id ON public.messages USING btree (conversation_id, client_message_id) WHERE (client_message_id IS NOT NULL);


--
-- Name: idx_messages_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_conversation ON public.messages USING btree (conversation_id, created_at DESC);


--
-- Name: idx_messages_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_created ON public.messages USING btree (created_at DESC);


--
-- Name: idx_messages_encrypted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_encrypted ON public.messages USING btree (conversation_id, is_encrypted) WHERE (is_encrypted = true);


--
-- Name: idx_messages_sender; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_sender ON public.messages USING btree (sender_address, created_at DESC);


--
-- Name: idx_messages_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_unread ON public.messages USING btree (conversation_id, is_read) WHERE (is_read = false);


--
-- Name: idx_no_show_history_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_no_show_history_customer ON public.no_show_history USING btree (customer_address, marked_no_show_at DESC);


--
-- Name: idx_no_show_history_disputed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_no_show_history_disputed ON public.no_show_history USING btree (disputed, dispute_status) WHERE (disputed = true);


--
-- Name: idx_no_show_history_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_no_show_history_order ON public.no_show_history USING btree (order_id);


--
-- Name: idx_no_show_history_shop; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_no_show_history_shop ON public.no_show_history USING btree (shop_id, marked_no_show_at DESC);


--
-- Name: idx_notification_prefs_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_prefs_customer ON public.customer_notification_preferences USING btree (customer_address);


--
-- Name: idx_notifications_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at DESC);


--
-- Name: idx_notifications_receiver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_receiver ON public.notifications USING btree (receiver_address);


--
-- Name: idx_notifications_receiver_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_receiver_read ON public.notifications USING btree (receiver_address, is_read);


--
-- Name: idx_notifications_sender; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_sender ON public.notifications USING btree (sender_address);


--
-- Name: idx_notifications_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_type ON public.notifications USING btree (notification_type);


--
-- Name: idx_platform_statistics_singleton; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_platform_statistics_singleton ON public.platform_statistics USING btree ((1));


--
-- Name: idx_po_suggestions_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_po_suggestions_active ON public.purchase_order_suggestions USING btree (shop_id, status, priority_score DESC) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_po_suggestions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_po_suggestions_created_at ON public.purchase_order_suggestions USING btree (created_at DESC);


--
-- Name: idx_po_suggestions_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_po_suggestions_expires_at ON public.purchase_order_suggestions USING btree (expires_at);


--
-- Name: idx_po_suggestions_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_po_suggestions_item_id ON public.purchase_order_suggestions USING btree (item_id);


--
-- Name: idx_po_suggestions_shop_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_po_suggestions_shop_id ON public.purchase_order_suggestions USING btree (shop_id);


--
-- Name: idx_po_suggestions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_po_suggestions_status ON public.purchase_order_suggestions USING btree (status);


--
-- Name: idx_po_suggestions_urgency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_po_suggestions_urgency ON public.purchase_order_suggestions USING btree (urgency);


--
-- Name: idx_po_suggestions_vendor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_po_suggestions_vendor_id ON public.purchase_order_suggestions USING btree (vendor_id);


--
-- Name: idx_promo_code_uses_customer_address; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_code_uses_customer_address ON public.promo_code_uses USING btree (customer_address);


--
-- Name: idx_promo_code_uses_promo_code_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_code_uses_promo_code_id ON public.promo_code_uses USING btree (promo_code_id);


--
-- Name: idx_promo_code_uses_shop_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_code_uses_shop_id ON public.promo_code_uses USING btree (shop_id);


--
-- Name: idx_promo_codes_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_codes_code ON public.promo_codes USING btree (upper((code)::text));


--
-- Name: idx_promo_codes_code_shop_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_promo_codes_code_shop_unique ON public.promo_codes USING btree (upper((code)::text), shop_id);


--
-- Name: idx_promo_codes_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_codes_dates ON public.promo_codes USING btree (start_date, end_date);


--
-- Name: idx_promo_codes_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_codes_is_active ON public.promo_codes USING btree (is_active);


--
-- Name: idx_promo_codes_shop_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_codes_shop_id ON public.promo_codes USING btree (shop_id);


--
-- Name: idx_promo_codes_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_codes_status ON public.promo_codes USING btree (status);


--
-- Name: idx_purchase_order_items_inventory_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_order_items_inventory_item_id ON public.purchase_order_items USING btree (inventory_item_id);


--
-- Name: idx_purchase_order_items_po_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_order_items_po_id ON public.purchase_order_items USING btree (po_id);


--
-- Name: idx_purchase_orders_order_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_order_date ON public.purchase_orders USING btree (order_date DESC);


--
-- Name: idx_purchase_orders_po_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_po_number ON public.purchase_orders USING btree (po_number);


--
-- Name: idx_purchase_orders_shop_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_shop_id ON public.purchase_orders USING btree (shop_id);


--
-- Name: idx_purchase_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_status ON public.purchase_orders USING btree (status);


--
-- Name: idx_purchase_orders_vendor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_vendor_id ON public.purchase_orders USING btree (vendor_id);


--
-- Name: idx_push_tokens_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_push_tokens_active ON public.device_push_tokens USING btree (wallet_address, is_active) WHERE (is_active = true);


--
-- Name: idx_push_tokens_last_used; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_push_tokens_last_used ON public.device_push_tokens USING btree (last_used_at) WHERE (is_active = false);


--
-- Name: idx_push_tokens_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_push_tokens_token ON public.device_push_tokens USING btree (expo_push_token);


--
-- Name: idx_push_tokens_wallet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_push_tokens_wallet ON public.device_push_tokens USING btree (wallet_address);


--
-- Name: idx_push_tokens_wallet_web; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_push_tokens_wallet_web ON public.device_push_tokens USING btree (wallet_address) WHERE ((device_type)::text = 'web'::text);


--
-- Name: idx_push_tokens_web_endpoint; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_push_tokens_web_endpoint ON public.device_push_tokens USING btree (((web_push_subscription ->> 'endpoint'::text))) WHERE ((device_type)::text = 'web'::text);


--
-- Name: idx_quick_replies_shop; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quick_replies_shop ON public.shop_quick_replies USING btree (shop_id, is_active);


--
-- Name: idx_refresh_tokens_admin_revocations; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_admin_revocations ON public.refresh_tokens USING btree (user_address, revoked_by_admin, revoked_at) WHERE ((revoked = true) AND (revoked_by_admin = true));


--
-- Name: idx_refresh_tokens_user_device; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_user_device ON public.refresh_tokens USING btree (user_address, device_id) WHERE (device_id IS NOT NULL);


--
-- Name: idx_reschedule_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reschedule_created ON public.appointment_reschedule_requests USING btree (created_at DESC);


--
-- Name: idx_reschedule_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reschedule_customer ON public.appointment_reschedule_requests USING btree (customer_address);


--
-- Name: idx_reschedule_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reschedule_expires ON public.appointment_reschedule_requests USING btree (expires_at) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_reschedule_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reschedule_order ON public.appointment_reschedule_requests USING btree (order_id);


--
-- Name: idx_reschedule_shop_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reschedule_shop_status ON public.appointment_reschedule_requests USING btree (shop_id, status);


--
-- Name: idx_review_replies_review_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_review_replies_review_id ON public.review_replies USING btree (review_id);


--
-- Name: idx_reviews_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_created_at ON public.service_reviews USING btree (created_at DESC);


--
-- Name: idx_reviews_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_customer ON public.service_reviews USING btree (customer_address);


--
-- Name: idx_reviews_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_rating ON public.service_reviews USING btree (rating);


--
-- Name: idx_reviews_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_service ON public.service_reviews USING btree (service_id);


--
-- Name: idx_reviews_shop; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_shop ON public.service_reviews USING btree (shop_id);


--
-- Name: idx_sent_emails_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sent_emails_customer ON public.sent_emails_log USING btree (customer_address) WHERE (customer_address IS NOT NULL);


--
-- Name: idx_sent_emails_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sent_emails_order_id ON public.sent_emails_log USING btree (order_id) WHERE (order_id IS NOT NULL);


--
-- Name: idx_sent_emails_sent_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sent_emails_sent_at ON public.sent_emails_log USING btree (sent_at DESC);


--
-- Name: idx_sent_emails_shop_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sent_emails_shop_id ON public.sent_emails_log USING btree (shop_id);


--
-- Name: idx_sent_emails_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sent_emails_type ON public.sent_emails_log USING btree (shop_id, email_type);


--
-- Name: idx_service_ai_faq_entries_service_id_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_ai_faq_entries_service_id_order ON public.service_ai_faq_entries USING btree (service_id, display_order);


--
-- Name: idx_service_duration_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_duration_service ON public.service_duration_config USING btree (service_id);


--
-- Name: idx_service_inventory_items_inventory_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_inventory_items_inventory_item_id ON public.service_inventory_items USING btree (inventory_item_id);


--
-- Name: idx_service_inventory_items_service_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_inventory_items_service_id ON public.service_inventory_items USING btree (service_id);


--
-- Name: idx_service_inventory_items_shop_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_inventory_items_shop_id ON public.service_inventory_items USING btree (shop_id);


--
-- Name: idx_service_orders_ad_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_orders_ad_lead ON public.service_orders USING btree (ad_lead_id) WHERE (ad_lead_id IS NOT NULL);


--
-- Name: idx_service_orders_approved_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_orders_approved_at ON public.service_orders USING btree (approved_at);


--
-- Name: idx_service_orders_booking_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_orders_booking_time ON public.service_orders USING btree (booking_date, booking_time_slot);


--
-- Name: idx_service_orders_booking_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_orders_booking_type ON public.service_orders USING btree (booking_type);


--
-- Name: idx_service_orders_calendar_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_orders_calendar_event ON public.service_orders USING btree (google_calendar_event_id) WHERE (google_calendar_event_id IS NOT NULL);


--
-- Name: idx_service_orders_calendar_sync_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_orders_calendar_sync_status ON public.service_orders USING btree (calendar_sync_status) WHERE ((calendar_sync_status)::text <> 'not_synced'::text);


--
-- Name: idx_service_orders_cancelled_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_orders_cancelled_at ON public.service_orders USING btree (cancelled_at);


--
-- Name: idx_service_orders_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_orders_created_at ON public.service_orders USING btree (created_at DESC);


--
-- Name: idx_service_orders_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_orders_customer ON public.service_orders USING btree (customer_address);


--
-- Name: idx_service_orders_expired; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_orders_expired ON public.service_orders USING btree (status) WHERE ((status)::text = 'expired'::text);


--
-- Name: idx_service_orders_no_show; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_orders_no_show ON public.service_orders USING btree (no_show, marked_no_show_at);


--
-- Name: idx_service_orders_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_orders_payment_status ON public.service_orders USING btree (payment_status);


--
-- Name: idx_service_orders_pending_reschedule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_orders_pending_reschedule ON public.service_orders USING btree (has_pending_reschedule) WHERE (has_pending_reschedule = true);


--
-- Name: idx_service_orders_reminder_24h; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_orders_reminder_24h ON public.service_orders USING btree (reminder_24h_sent) WHERE (((status)::text = ANY ((ARRAY['paid'::character varying, 'confirmed'::character varying])::text[])) AND (booking_date IS NOT NULL));


--
-- Name: idx_service_orders_reminder_2h; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_orders_reminder_2h ON public.service_orders USING btree (reminder_2h_sent) WHERE (((status)::text = ANY ((ARRAY['paid'::character varying, 'confirmed'::character varying])::text[])) AND (booking_date IS NOT NULL));


--
-- Name: idx_service_orders_service_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_orders_service_id ON public.service_orders USING btree (service_id);


--
-- Name: idx_service_orders_shop_approved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_orders_shop_approved ON public.service_orders USING btree (shop_approved);


--
-- Name: idx_service_orders_shop_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_orders_shop_id ON public.service_orders USING btree (shop_id);


--
-- Name: idx_service_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_orders_status ON public.service_orders USING btree (status);


--
-- Name: idx_service_orders_stripe_payment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_orders_stripe_payment ON public.service_orders USING btree (stripe_payment_intent_id);


--
-- Name: idx_service_orders_stripe_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_orders_stripe_session ON public.service_orders USING btree (stripe_session_id);


--
-- Name: idx_service_reviews_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_reviews_rating ON public.service_reviews USING btree (service_id, rating) WHERE (rating IS NOT NULL);


--
-- Name: idx_service_reviews_service_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_reviews_service_id ON public.service_reviews USING btree (service_id);


--
-- Name: idx_services_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_rating ON public.shop_services USING btree (average_rating DESC);


--
-- Name: idx_sga_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sga_active ON public.service_group_availability USING btree (active) WHERE (active = true);


--
-- Name: idx_sga_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sga_group_id ON public.service_group_availability USING btree (group_id);


--
-- Name: idx_sga_service_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sga_service_id ON public.service_group_availability USING btree (service_id);


--
-- Name: idx_shop_availability_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_availability_day ON public.shop_availability USING btree (day_of_week);


--
-- Name: idx_shop_availability_shop; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_availability_shop ON public.shop_availability USING btree (shop_id);


--
-- Name: idx_shop_calendar_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_calendar_active ON public.shop_calendar_connections USING btree (shop_id, is_active) WHERE (is_active = true);


--
-- Name: idx_shop_calendar_shop_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_calendar_shop_id ON public.shop_calendar_connections USING btree (shop_id);


--
-- Name: idx_shop_calendar_token_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_calendar_token_expiry ON public.shop_calendar_connections USING btree (token_expiry) WHERE (is_active = true);


--
-- Name: idx_shop_gallery_photos_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_gallery_photos_order ON public.shop_gallery_photos USING btree (shop_id, display_order);


--
-- Name: idx_shop_gallery_photos_shop_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_gallery_photos_shop_id ON public.shop_gallery_photos USING btree (shop_id);


--
-- Name: idx_shop_gmail_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_gmail_active ON public.shop_gmail_connections USING btree (shop_id, is_active) WHERE (is_active = true);


--
-- Name: idx_shop_gmail_shop_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_gmail_shop_id ON public.shop_gmail_connections USING btree (shop_id);


--
-- Name: idx_shop_gmail_token_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_gmail_token_expiry ON public.shop_gmail_connections USING btree (token_expiry) WHERE (is_active = true);


--
-- Name: idx_shop_group_allocations_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_group_allocations_group ON public.shop_group_rcn_allocations USING btree (group_id);


--
-- Name: idx_shop_group_allocations_shop; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_group_allocations_shop ON public.shop_group_rcn_allocations USING btree (shop_id);


--
-- Name: idx_shop_no_show_policy_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_no_show_policy_enabled ON public.shop_no_show_policy USING btree (enabled);


--
-- Name: idx_shop_reports_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_reports_category ON public.shop_reports USING btree (category);


--
-- Name: idx_shop_reports_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_reports_created_at ON public.shop_reports USING btree (created_at DESC);


--
-- Name: idx_shop_reports_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_reports_severity ON public.shop_reports USING btree (severity);


--
-- Name: idx_shop_reports_shop_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_reports_shop_id ON public.shop_reports USING btree (shop_id);


--
-- Name: idx_shop_reports_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_reports_status ON public.shop_reports USING btree (status);


--
-- Name: idx_shop_services_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_services_active ON public.shop_services USING btree (active);


--
-- Name: idx_shop_services_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_services_category ON public.shop_services USING btree (category);


--
-- Name: idx_shop_services_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_services_created_at ON public.shop_services USING btree (created_at DESC);


--
-- Name: idx_shop_services_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_services_deleted_at ON public.shop_services USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_shop_services_shop_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_services_shop_id ON public.shop_services USING btree (shop_id);


--
-- Name: idx_shop_services_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_services_tags ON public.shop_services USING gin (tags);


--
-- Name: idx_shop_subscriptions_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_subscriptions_active ON public.shop_subscriptions USING btree (is_active);


--
-- Name: idx_shop_subscriptions_next_payment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_subscriptions_next_payment ON public.shop_subscriptions USING btree (next_payment_date);


--
-- Name: idx_shop_subscriptions_shop_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_subscriptions_shop_id ON public.shop_subscriptions USING btree (shop_id);


--
-- Name: idx_shop_subscriptions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_subscriptions_status ON public.shop_subscriptions USING btree (status);


--
-- Name: idx_shop_time_slot_config_timezone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_time_slot_config_timezone ON public.shop_time_slot_config USING btree (timezone);


--
-- Name: idx_shops_active_verified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shops_active_verified ON public.shops USING btree (active, verified);


--
-- Name: idx_shops_active_verified_partial; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shops_active_verified_partial ON public.shops USING btree (shop_id, name, verified, active) WHERE ((active = true) AND (verified = true));


--
-- Name: idx_shops_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shops_category ON public.shops USING btree (category);


--
-- Name: idx_shops_digest_schedule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shops_digest_schedule ON public.shops USING btree (low_stock_digest_mode, last_digest_sent_at) WHERE (low_stock_alerts_enabled = true);


--
-- Name: idx_shops_meta_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shops_meta_user ON public.shops USING btree (meta_user_id) WHERE (meta_user_id IS NOT NULL);


--
-- Name: idx_stripe_customers_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stripe_customers_email ON public.stripe_customers USING btree (email);


--
-- Name: idx_stripe_subscriptions_reminder_tracking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stripe_subscriptions_reminder_tracking ON public.stripe_subscriptions USING btree (status, current_period_end, reminder_7d_sent, reminder_3d_sent, reminder_1d_sent) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_suggestion_accuracy_metrics_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suggestion_accuracy_metrics_period ON public.suggestion_accuracy_metrics USING btree (period_start, period_end);


--
-- Name: idx_suggestion_accuracy_metrics_shop; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suggestion_accuracy_metrics_shop ON public.suggestion_accuracy_metrics USING btree (shop_id);


--
-- Name: idx_support_messages_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_messages_created ON public.support_messages USING btree (created_at);


--
-- Name: idx_support_messages_sender; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_messages_sender ON public.support_messages USING btree (sender_type, sender_id);


--
-- Name: idx_support_messages_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_messages_ticket ON public.support_messages USING btree (ticket_id);


--
-- Name: idx_support_ticket_views_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_ticket_views_ticket ON public.support_ticket_views USING btree (ticket_id);


--
-- Name: idx_support_ticket_views_viewer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_ticket_views_viewer ON public.support_ticket_views USING btree (viewer_type, viewer_id);


--
-- Name: idx_support_tickets_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_assigned ON public.support_tickets USING btree (assigned_to);


--
-- Name: idx_support_tickets_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_created ON public.support_tickets USING btree (created_at DESC);


--
-- Name: idx_support_tickets_last_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_last_message ON public.support_tickets USING btree (last_message_at DESC);


--
-- Name: idx_support_tickets_shop; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_shop ON public.support_tickets USING btree (shop_id);


--
-- Name: idx_support_tickets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_status ON public.support_tickets USING btree (status);


--
-- Name: idx_support_tickets_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_updated ON public.support_tickets USING btree (updated_at DESC);


--
-- Name: idx_system_status_component; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_status_component ON public.system_status USING btree (component);


--
-- Name: idx_time_slot_config_shop; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_time_slot_config_shop ON public.shop_time_slot_config USING btree (shop_id);


--
-- Name: idx_transactions_cross_shop_redemptions; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_cross_shop_redemptions ON public.transactions USING btree (shop_id, amount, created_at) WHERE (((type)::text = 'redeem'::text) AND ((status)::text = 'confirmed'::text) AND ((metadata ->> 'redemptionType'::text) = 'cross_shop'::text));


--
-- Name: idx_transactions_metadata_redemption_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_metadata_redemption_type ON public.transactions USING btree (((metadata ->> 'redemptionType'::text))) WHERE ((metadata ->> 'redemptionType'::text) IS NOT NULL);


--
-- Name: idx_transactions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_status ON public.transactions USING btree (status);


--
-- Name: idx_transactions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_type ON public.transactions USING btree (type);


--
-- Name: idx_transactions_type_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_type_status ON public.transactions USING btree (type, status);


--
-- Name: idx_typing_indicators_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_typing_indicators_conversation ON public.typing_indicators USING btree (conversation_id, expires_at);


--
-- Name: idx_unique_expo_push_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_unique_expo_push_token ON public.device_push_tokens USING btree (expo_push_token) WHERE (expo_push_token IS NOT NULL);


--
-- Name: idx_waitlist_business_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waitlist_business_category ON public.waitlist USING btree (business_category);


--
-- Name: idx_waitlist_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waitlist_created_at ON public.waitlist USING btree (created_at DESC);


--
-- Name: idx_waitlist_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waitlist_email ON public.waitlist USING btree (email);


--
-- Name: idx_waitlist_inquiry_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waitlist_inquiry_type ON public.waitlist USING btree (inquiry_type);


--
-- Name: idx_waitlist_page_views_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waitlist_page_views_created_at ON public.waitlist_page_views USING btree (created_at DESC);


--
-- Name: idx_waitlist_page_views_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waitlist_page_views_source ON public.waitlist_page_views USING btree (source);


--
-- Name: idx_waitlist_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waitlist_source ON public.waitlist USING btree (source);


--
-- Name: idx_waitlist_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waitlist_status ON public.waitlist USING btree (status);


--
-- Name: unique_customers_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_customers_email ON public.customers USING btree (lower((email)::text)) WHERE ((email IS NOT NULL) AND ((email)::text <> ''::text));


--
-- Name: unique_customers_wallet; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_customers_wallet ON public.customers USING btree (wallet_address);


--
-- Name: unique_shops_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_shops_email ON public.shops USING btree (lower((email)::text)) WHERE ((email IS NOT NULL) AND ((email)::text <> ''::text));


--
-- Name: unique_shops_wallet; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_shops_wallet ON public.shops USING btree (wallet_address);


--
-- Name: uq_ad_billing_charge_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ad_billing_charge_campaign ON public.ad_billing_charges USING btree (campaign_id, period_date, charge_type) WHERE (campaign_id IS NOT NULL);


--
-- Name: uq_ad_billing_charge_shop; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ad_billing_charge_shop ON public.ad_billing_charges USING btree (shop_id, period_date, charge_type) WHERE (campaign_id IS NULL);


--
-- Name: uq_ad_leads_meta_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ad_leads_meta_lead ON public.ad_leads USING btree (meta_lead_id) WHERE (meta_lead_id IS NOT NULL);


--
-- Name: blocked_customers blocked_customers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER blocked_customers_updated_at BEFORE UPDATE ON public.blocked_customers FOR EACH ROW EXECUTE FUNCTION public.update_blocked_customers_updated_at();


--
-- Name: communication_campaigns communication_campaigns_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER communication_campaigns_updated_at_trigger BEFORE UPDATE ON public.communication_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_contact_imports_updated_at();


--
-- Name: contact_imports contact_imports_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER contact_imports_updated_at_trigger BEFORE UPDATE ON public.contact_imports FOR EACH ROW EXECUTE FUNCTION public.update_contact_imports_updated_at();


--
-- Name: email_templates email_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER email_templates_updated_at BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.update_email_template_timestamp();


--
-- Name: flagged_reviews flagged_reviews_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER flagged_reviews_updated_at BEFORE UPDATE ON public.flagged_reviews FOR EACH ROW EXECUTE FUNCTION public.update_flagged_reviews_updated_at();


--
-- Name: promo_code_uses promo_code_uses_delete_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER promo_code_uses_delete_trigger AFTER DELETE ON public.promo_code_uses FOR EACH ROW EXECUTE FUNCTION public.update_promo_code_stats_on_delete();


--
-- Name: promo_code_uses promo_code_uses_insert_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER promo_code_uses_insert_trigger AFTER INSERT ON public.promo_code_uses FOR EACH ROW EXECUTE FUNCTION public.update_promo_code_stats_on_insert();


--
-- Name: shop_email_preferences shop_email_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER shop_email_preferences_updated_at BEFORE UPDATE ON public.shop_email_preferences FOR EACH ROW EXECUTE FUNCTION public.update_shop_email_preferences_updated_at();


--
-- Name: shop_no_show_policy shop_no_show_policy_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER shop_no_show_policy_updated_at BEFORE UPDATE ON public.shop_no_show_policy FOR EACH ROW EXECUTE FUNCTION public.update_shop_no_show_policy_updated_at();


--
-- Name: shop_reports shop_reports_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER shop_reports_updated_at BEFORE UPDATE ON public.shop_reports FOR EACH ROW EXECUTE FUNCTION public.update_shop_reports_updated_at();


--
-- Name: no_show_history trg_update_customer_tier; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_customer_tier AFTER INSERT ON public.no_show_history FOR EACH ROW EXECUTE FUNCTION public.update_customer_no_show_tier();


--
-- Name: shop_gallery_photos trigger_check_shop_gallery_photos_limit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_check_shop_gallery_photos_limit BEFORE INSERT ON public.shop_gallery_photos FOR EACH ROW EXECUTE FUNCTION public.check_shop_gallery_photos_limit();


--
-- Name: customers trigger_customers_email_uniqueness; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_customers_email_uniqueness BEFORE INSERT OR UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.check_email_uniqueness();


--
-- Name: customers trigger_customers_wallet_uniqueness; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_customers_wallet_uniqueness BEFORE INSERT OR UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.check_wallet_uniqueness();


--
-- Name: general_notification_preferences trigger_general_notif_prefs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_general_notif_prefs_updated_at BEFORE UPDATE ON public.general_notification_preferences FOR EACH ROW EXECUTE FUNCTION public.update_general_notif_prefs_updated_at();


--
-- Name: customer_notification_preferences trigger_notification_prefs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_notification_prefs_updated_at BEFORE UPDATE ON public.customer_notification_preferences FOR EACH ROW EXECUTE FUNCTION public.update_notification_prefs_updated_at();


--
-- Name: messages trigger_reset_unread_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_reset_unread_count AFTER UPDATE ON public.messages FOR EACH ROW WHEN ((new.is_read IS DISTINCT FROM old.is_read)) EXECUTE FUNCTION public.reset_unread_count_on_read();


--
-- Name: shops trigger_shops_email_uniqueness; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_shops_email_uniqueness BEFORE INSERT OR UPDATE ON public.shops FOR EACH ROW EXECUTE FUNCTION public.check_email_uniqueness();


--
-- Name: shops trigger_shops_wallet_uniqueness; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_shops_wallet_uniqueness BEFORE INSERT OR UPDATE ON public.shops FOR EACH ROW EXECUTE FUNCTION public.check_wallet_uniqueness();


--
-- Name: review_helpful_votes trigger_sync_helpful_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_helpful_count AFTER INSERT OR DELETE ON public.review_helpful_votes FOR EACH ROW EXECUTE FUNCTION public.sync_review_helpful_count();


--
-- Name: messages trigger_update_conversation_on_message; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_conversation_on_message AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_conversation_on_message();


--
-- Name: inventory_categories trigger_update_inventory_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_inventory_categories_updated_at BEFORE UPDATE ON public.inventory_categories FOR EACH ROW EXECUTE FUNCTION public.update_inventory_items_updated_at();


--
-- Name: inventory_items trigger_update_inventory_item_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_inventory_item_status BEFORE INSERT OR UPDATE OF stock_quantity, low_stock_threshold ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.update_inventory_item_status();


--
-- Name: inventory_items trigger_update_inventory_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_inventory_items_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.update_inventory_items_updated_at();


--
-- Name: inventory_vendors trigger_update_inventory_vendors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_inventory_vendors_updated_at BEFORE UPDATE ON public.inventory_vendors FOR EACH ROW EXECUTE FUNCTION public.update_inventory_items_updated_at();


--
-- Name: appointment_reschedule_requests trigger_update_order_reschedule_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_order_reschedule_status AFTER INSERT OR UPDATE ON public.appointment_reschedule_requests FOR EACH ROW EXECUTE FUNCTION public.update_order_reschedule_status();


--
-- Name: purchase_order_items trigger_update_purchase_order_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_purchase_order_items_updated_at BEFORE UPDATE ON public.purchase_order_items FOR EACH ROW EXECUTE FUNCTION public.update_purchase_orders_updated_at();


--
-- Name: purchase_orders trigger_update_purchase_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_purchase_orders_updated_at();


--
-- Name: service_reviews trigger_update_service_rating; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_service_rating AFTER INSERT OR DELETE OR UPDATE ON public.service_reviews FOR EACH ROW EXECUTE FUNCTION public.update_service_rating_aggregate();


--
-- Name: shop_calendar_connections trigger_update_shop_calendar_connections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_shop_calendar_connections_updated_at BEFORE UPDATE ON public.shop_calendar_connections FOR EACH ROW EXECUTE FUNCTION public.update_shop_calendar_connections_updated_at();


--
-- Name: shop_gallery_photos trigger_update_shop_gallery_photos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_shop_gallery_photos_updated_at BEFORE UPDATE ON public.shop_gallery_photos FOR EACH ROW EXECUTE FUNCTION public.update_shop_gallery_photos_updated_at();


--
-- Name: shop_gmail_connections trigger_update_shop_gmail_connections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_shop_gmail_connections_updated_at BEFORE UPDATE ON public.shop_gmail_connections FOR EACH ROW EXECUTE FUNCTION public.update_shop_gmail_connections_updated_at();


--
-- Name: shop_subscriptions trigger_update_shop_on_subscription_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_shop_on_subscription_change AFTER INSERT OR UPDATE ON public.shop_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_shop_operational_status_on_subscription();


--
-- Name: support_tickets trigger_update_support_tickets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.update_support_tickets_updated_at();


--
-- Name: support_messages trigger_update_ticket_last_message; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_ticket_last_message AFTER INSERT ON public.support_messages FOR EACH ROW EXECUTE FUNCTION public.update_ticket_last_message();


--
-- Name: waitlist waitlist_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER waitlist_updated_at_trigger BEFORE UPDATE ON public.waitlist FOR EACH ROW EXECUTE FUNCTION public.update_waitlist_updated_at();


--
-- Name: ad_ai_costs ad_ai_costs_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_ai_costs
    ADD CONSTRAINT ad_ai_costs_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.ad_campaigns(id) ON DELETE CASCADE;


--
-- Name: ad_ai_costs ad_ai_costs_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_ai_costs
    ADD CONSTRAINT ad_ai_costs_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.ad_leads(id) ON DELETE SET NULL;


--
-- Name: ad_billing_charges ad_billing_charges_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_billing_charges
    ADD CONSTRAINT ad_billing_charges_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.ad_campaigns(id) ON DELETE CASCADE;


--
-- Name: ad_billing_charges ad_billing_charges_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_billing_charges
    ADD CONSTRAINT ad_billing_charges_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: ad_billing_plans ad_billing_plans_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_billing_plans
    ADD CONSTRAINT ad_billing_plans_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: ad_campaign_requests ad_campaign_requests_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_campaign_requests
    ADD CONSTRAINT ad_campaign_requests_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.ad_campaigns(id) ON DELETE SET NULL;


--
-- Name: ad_campaign_requests ad_campaign_requests_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_campaign_requests
    ADD CONSTRAINT ad_campaign_requests_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: ad_campaigns ad_campaigns_industry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_campaigns
    ADD CONSTRAINT ad_campaigns_industry_id_fkey FOREIGN KEY (industry_id) REFERENCES public.industries(id);


--
-- Name: ad_campaigns ad_campaigns_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_campaigns
    ADD CONSTRAINT ad_campaigns_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: ad_creatives ad_creatives_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_creatives
    ADD CONSTRAINT ad_creatives_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.ad_campaigns(id) ON DELETE CASCADE;


--
-- Name: ad_enrollment_requests ad_enrollment_requests_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_enrollment_requests
    ADD CONSTRAINT ad_enrollment_requests_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: ad_experiments ad_experiments_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_experiments
    ADD CONSTRAINT ad_experiments_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.ad_campaigns(id) ON DELETE CASCADE;


--
-- Name: ad_experiments ad_experiments_winner_creative_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_experiments
    ADD CONSTRAINT ad_experiments_winner_creative_id_fkey FOREIGN KEY (winner_creative_id) REFERENCES public.ad_creatives(id);


--
-- Name: ad_lead_messages ad_lead_messages_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_lead_messages
    ADD CONSTRAINT ad_lead_messages_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.ad_leads(id) ON DELETE CASCADE;


--
-- Name: ad_leads ad_leads_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_leads
    ADD CONSTRAINT ad_leads_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.ad_campaigns(id) ON DELETE CASCADE;


--
-- Name: ad_leads ad_leads_creative_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_leads
    ADD CONSTRAINT ad_leads_creative_id_fkey FOREIGN KEY (creative_id) REFERENCES public.ad_creatives(id);


--
-- Name: ad_leads ad_leads_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_leads
    ADD CONSTRAINT ad_leads_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(address);


--
-- Name: ad_messages ad_messages_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_messages
    ADD CONSTRAINT ad_messages_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: ad_performance_daily ad_performance_daily_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_performance_daily
    ADD CONSTRAINT ad_performance_daily_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.ad_campaigns(id) ON DELETE CASCADE;


--
-- Name: ad_plan_changes ad_plan_changes_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_plan_changes
    ADD CONSTRAINT ad_plan_changes_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: ad_safeguards_state ad_safeguards_state_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_safeguards_state
    ADD CONSTRAINT ad_safeguards_state_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.ad_campaigns(id) ON DELETE CASCADE;


--
-- Name: ai_agent_messages ai_agent_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_agent_messages
    ADD CONSTRAINT ai_agent_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(conversation_id) ON DELETE CASCADE;


--
-- Name: ai_agent_messages ai_agent_messages_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_agent_messages
    ADD CONSTRAINT ai_agent_messages_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id);


--
-- Name: ai_customer_chat_messages ai_customer_chat_messages_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_customer_chat_messages
    ADD CONSTRAINT ai_customer_chat_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.ai_customer_chat_sessions(id) ON DELETE CASCADE;


--
-- Name: ai_dispatch_audit ai_dispatch_audit_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_dispatch_audit
    ADD CONSTRAINT ai_dispatch_audit_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: ai_help_messages ai_help_messages_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_help_messages
    ADD CONSTRAINT ai_help_messages_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: ai_insights_anomalies ai_insights_anomalies_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_insights_anomalies
    ADD CONSTRAINT ai_insights_anomalies_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: ai_insights_messages ai_insights_messages_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_insights_messages
    ADD CONSTRAINT ai_insights_messages_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: ai_insights_pinned_queries ai_insights_pinned_queries_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_insights_pinned_queries
    ADD CONSTRAINT ai_insights_pinned_queries_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: ai_marketing_messages ai_marketing_messages_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_marketing_messages
    ADD CONSTRAINT ai_marketing_messages_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: ai_orchestrate_messages ai_orchestrate_messages_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_orchestrate_messages
    ADD CONSTRAINT ai_orchestrate_messages_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: ai_shop_settings ai_shop_settings_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_shop_settings
    ADD CONSTRAINT ai_shop_settings_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: ai_voice_transcriptions ai_voice_transcriptions_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_voice_transcriptions
    ADD CONSTRAINT ai_voice_transcriptions_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: auto_message_sends auto_message_sends_auto_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auto_message_sends
    ADD CONSTRAINT auto_message_sends_auto_message_id_fkey FOREIGN KEY (auto_message_id) REFERENCES public.shop_auto_messages(id);


--
-- Name: blocked_customers blocked_customers_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocked_customers
    ADD CONSTRAINT blocked_customers_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: brand_template_assets brand_template_assets_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_template_assets
    ADD CONSTRAINT brand_template_assets_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: campaign_recipients campaign_recipients_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_recipients
    ADD CONSTRAINT campaign_recipients_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.communication_campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_recipients campaign_recipients_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_recipients
    ADD CONSTRAINT campaign_recipients_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contact_imports(id) ON DELETE CASCADE;


--
-- Name: communication_campaigns communication_campaigns_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_campaigns
    ADD CONSTRAINT communication_campaigns_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: contact_imports contact_imports_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_imports
    ADD CONSTRAINT contact_imports_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: flagged_reviews flagged_reviews_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flagged_reviews
    ADD CONSTRAINT flagged_reviews_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: import_jobs import_jobs_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_jobs
    ADD CONSTRAINT import_jobs_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id);


--
-- Name: import_jobs import_jobs_shop_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_jobs
    ADD CONSTRAINT import_jobs_shop_id_fkey1 FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: inventory_adjustments inventory_adjustments_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustments
    ADD CONSTRAINT inventory_adjustments_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;


--
-- Name: inventory_adjustments inventory_adjustments_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustments
    ADD CONSTRAINT inventory_adjustments_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: inventory_categories inventory_categories_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_categories
    ADD CONSTRAINT inventory_categories_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: inventory_items inventory_items_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.inventory_categories(id) ON DELETE SET NULL;


--
-- Name: inventory_items inventory_items_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: inventory_items inventory_items_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.inventory_vendors(id) ON DELETE SET NULL;


--
-- Name: inventory_vendors inventory_vendors_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_vendors
    ADD CONSTRAINT inventory_vendors_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: promo_code_uses promo_code_uses_promo_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_code_uses
    ADD CONSTRAINT promo_code_uses_promo_code_fkey FOREIGN KEY (promo_code_id) REFERENCES public.promo_codes(id) ON DELETE CASCADE;


--
-- Name: purchase_order_items purchase_order_items_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id) ON DELETE SET NULL;


--
-- Name: purchase_order_items purchase_order_items_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_order_suggestions purchase_order_suggestions_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_suggestions
    ADD CONSTRAINT purchase_order_suggestions_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;


--
-- Name: purchase_order_suggestions purchase_order_suggestions_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_suggestions
    ADD CONSTRAINT purchase_order_suggestions_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE SET NULL;


--
-- Name: purchase_order_suggestions purchase_order_suggestions_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_suggestions
    ADD CONSTRAINT purchase_order_suggestions_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: purchase_order_suggestions purchase_order_suggestions_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_suggestions
    ADD CONSTRAINT purchase_order_suggestions_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.inventory_vendors(id) ON DELETE SET NULL;


--
-- Name: purchase_orders purchase_orders_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.inventory_vendors(id) ON DELETE SET NULL;


--
-- Name: sent_emails_log sent_emails_log_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sent_emails_log
    ADD CONSTRAINT sent_emails_log_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: service_inventory_items service_inventory_items_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_inventory_items
    ADD CONSTRAINT service_inventory_items_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;


--
-- Name: service_orders service_orders_ad_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_orders
    ADD CONSTRAINT service_orders_ad_lead_id_fkey FOREIGN KEY (ad_lead_id) REFERENCES public.ad_leads(id);


--
-- Name: shop_auto_messages shop_auto_messages_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_auto_messages
    ADD CONSTRAINT shop_auto_messages_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id);


--
-- Name: shop_calendar_connections shop_calendar_connections_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_calendar_connections
    ADD CONSTRAINT shop_calendar_connections_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: shop_email_preferences shop_email_preferences_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_email_preferences
    ADD CONSTRAINT shop_email_preferences_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: shop_gallery_photos shop_gallery_photos_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_gallery_photos
    ADD CONSTRAINT shop_gallery_photos_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: shop_gmail_connections shop_gmail_connections_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_gmail_connections
    ADD CONSTRAINT shop_gmail_connections_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: shop_quick_replies shop_quick_replies_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_quick_replies
    ADD CONSTRAINT shop_quick_replies_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id);


--
-- Name: shop_reports shop_reports_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_reports
    ADD CONSTRAINT shop_reports_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- Name: suggestion_accuracy_metrics suggestion_accuracy_metrics_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestion_accuracy_metrics
    ADD CONSTRAINT suggestion_accuracy_metrics_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id);


--
-- Name: support_messages support_messages_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;


--
-- Name: support_ticket_views support_ticket_views_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_views
    ADD CONSTRAINT support_ticket_views_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;


--
-- Name: support_tickets support_tickets_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(shop_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--




-- ============ END pg_dump ============

-- Reset search_path (the dump set it empty) so the unqualified seed INSERT resolves.
SET search_path TO public;

-- Baseline: mark all migrations already represented by this dump as applied.
INSERT INTO schema_migrations (version, name) VALUES
(0,'baselined_via_000'),(4,'baselined_via_000'),(6,'baselined_via_000'),(8,'baselined_via_000'),(16,'baselined_via_000'),(17,'baselined_via_000'),(18,'baselined_via_000'),(19,'baselined_via_000'),(20,'baselined_via_000'),(21,'baselined_via_000'),(22,'baselined_via_000'),(23,'baselined_via_000'),(24,'baselined_via_000'),(25,'baselined_via_000'),(26,'baselined_via_000'),(27,'baselined_via_000'),(28,'baselined_via_000'),(29,'baselined_via_000'),(30,'baselined_via_000'),(34,'baselined_via_000'),(35,'baselined_via_000'),(36,'baselined_via_000'),(37,'baselined_via_000'),(38,'baselined_via_000'),(39,'baselined_via_000'),(40,'baselined_via_000'),(41,'baselined_via_000'),(42,'baselined_via_000'),(43,'baselined_via_000'),(44,'baselined_via_000'),(45,'baselined_via_000'),(46,'baselined_via_000'),(47,'baselined_via_000'),(48,'baselined_via_000'),(49,'baselined_via_000'),(50,'baselined_via_000'),(51,'baselined_via_000'),(52,'baselined_via_000'),(53,'baselined_via_000'),(54,'baselined_via_000'),(55,'baselined_via_000'),(56,'baselined_via_000'),(57,'baselined_via_000'),(58,'baselined_via_000'),(59,'baselined_via_000'),(60,'baselined_via_000'),(61,'baselined_via_000'),(62,'baselined_via_000'),(63,'baselined_via_000'),(64,'baselined_via_000'),(65,'baselined_via_000'),(66,'baselined_via_000'),(67,'baselined_via_000'),(68,'baselined_via_000'),(69,'baselined_via_000'),(70,'baselined_via_000'),(71,'baselined_via_000'),(72,'baselined_via_000'),(73,'baselined_via_000'),(74,'baselined_via_000'),(75,'baselined_via_000'),(76,'baselined_via_000'),(77,'baselined_via_000'),(78,'baselined_via_000'),(79,'baselined_via_000'),(80,'baselined_via_000'),(81,'baselined_via_000'),(82,'baselined_via_000'),(83,'baselined_via_000'),(84,'baselined_via_000'),(85,'baselined_via_000'),(86,'baselined_via_000'),(87,'baselined_via_000'),(88,'baselined_via_000'),(89,'baselined_via_000'),(90,'baselined_via_000'),(91,'baselined_via_000'),(92,'baselined_via_000'),(93,'baselined_via_000'),(94,'baselined_via_000'),(95,'baselined_via_000'),(96,'baselined_via_000'),(97,'baselined_via_000'),(98,'baselined_via_000'),(99,'baselined_via_000'),(100,'baselined_via_000'),(101,'baselined_via_000'),(102,'baselined_via_000'),(103,'baselined_via_000'),(104,'baselined_via_000'),(105,'baselined_via_000'),(106,'baselined_via_000'),(107,'baselined_via_000'),(108,'baselined_via_000'),(109,'baselined_via_000'),(110,'baselined_via_000'),(111,'baselined_via_000'),(112,'baselined_via_000'),(113,'baselined_via_000'),(114,'baselined_via_000'),(115,'baselined_via_000'),(116,'baselined_via_000'),(117,'baselined_via_000'),(118,'baselined_via_000'),(119,'baselined_via_000'),(120,'baselined_via_000'),(121,'baselined_via_000'),(122,'baselined_via_000'),(123,'baselined_via_000'),(124,'baselined_via_000'),(125,'baselined_via_000'),(126,'baselined_via_000'),(127,'baselined_via_000'),(128,'baselined_via_000'),(129,'baselined_via_000'),(130,'baselined_via_000'),(131,'baselined_via_000'),(132,'baselined_via_000'),(133,'baselined_via_000'),(134,'baselined_via_000'),(135,'baselined_via_000'),(136,'baselined_via_000'),(137,'baselined_via_000'),(138,'baselined_via_000'),(139,'baselined_via_000'),(140,'baselined_via_000'),(141,'baselined_via_000'),(142,'baselined_via_000'),(143,'baselined_via_000'),(144,'baselined_via_000'),(145,'baselined_via_000'),(146,'baselined_via_000'),(147,'baselined_via_000'),(148,'baselined_via_000'),(149,'baselined_via_000'),(150,'baselined_via_000'),(151,'baselined_via_000'),(152,'baselined_via_000'),(153,'baselined_via_000'),(154,'baselined_via_000'),(155,'baselined_via_000'),(156,'baselined_via_000'),(157,'baselined_via_000'),(158,'baselined_via_000'),(159,'baselined_via_000'),(160,'baselined_via_000'),(161,'baselined_via_000'),(162,'baselined_via_000'),(163,'baselined_via_000'),(164,'baselined_via_000'),(165,'baselined_via_000'),(166,'baselined_via_000'),(1000,'baselined_via_000'),(1016,'baselined_via_000'),(1017,'baselined_via_000'),(1018,'baselined_via_000'),(1020,'baselined_via_000'),(1021,'baselined_via_000')
ON CONFLICT (version) DO NOTHING;
