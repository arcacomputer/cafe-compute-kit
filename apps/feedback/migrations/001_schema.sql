BEGIN;
-- Run only in a new, isolated event database with a trusted CREATEROLE owner.
-- NOLOGIN groups separate capabilities; create private LOGIN users separately.
CREATE ROLE cc_owner NOLOGIN;
CREATE ROLE cc_runtime NOLOGIN;
CREATE ROLE cc_admin NOLOGIN;
CREATE ROLE cc_sender NOLOGIN;
GRANT cc_owner TO CURRENT_USER;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE,CREATE ON SCHEMA public TO cc_owner;
SET LOCAL ROLE cc_owner;
CREATE TABLE cc_recipients (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), guest_id text UNIQUE,
 email text NOT NULL UNIQUE CHECK(email=lower(btrim(email))),
 name text NOT NULL DEFAULT '', affiliation text NOT NULL DEFAULT '', role text NOT NULL DEFAULT '',
 eligible boolean NOT NULL DEFAULT false, claim_eligible boolean NOT NULL DEFAULT false,
 synthetic boolean NOT NULL DEFAULT false, eligibility_basis text NOT NULL,
 checked_in_at timestamptz, provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
 CHECK(NOT claim_eligible OR eligible), CHECK(NOT claim_eligible OR eligibility_basis IN ('checked-in','organizer-exception'))
);
CREATE TABLE cc_magic_tokens (
 hash text PRIMARY KEY CHECK(hash ~ '^[a-f0-9]{64}$'), recipient_id uuid NOT NULL REFERENCES cc_recipients,
 expires_at timestamptz NOT NULL, consumed_at timestamptz
);
CREATE INDEX ON cc_magic_tokens(expires_at);
CREATE TABLE cc_sessions (
 hash text PRIMARY KEY CHECK(hash ~ '^[a-f0-9]{64}$'), recipient_id uuid NOT NULL REFERENCES cc_recipients,
 expires_at timestamptz NOT NULL
);
CREATE INDEX ON cc_sessions(expires_at);
CREATE TABLE cc_auth_rate (key text PRIMARY KEY,count integer NOT NULL CHECK(count>0),expires_at timestamptz NOT NULL DEFAULT now()+interval '2 days');
CREATE INDEX ON cc_auth_rate(expires_at);
CREATE TABLE event_feedback (
 id uuid PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL CHECK(status='saved'), payload jsonb NOT NULL,
 photos jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX ON event_feedback((payload->>'recipientId'));
CREATE TABLE feedback_daily (day date PRIMARY KEY,total integer NOT NULL CHECK(total>0));
CREATE TABLE cc_feedback_account_daily (recipient_id uuid REFERENCES cc_recipients,day date,total integer NOT NULL CHECK(total>0),PRIMARY KEY(recipient_id,day));
CREATE TABLE cc_feedback_uploads (
 submission_id uuid REFERENCES event_feedback,slot integer CHECK(slot>=0 AND slot<20),
 object_key text NOT NULL UNIQUE,content_type text NOT NULL CHECK(content_type IN ('image/jpeg','image/png','image/webp')),
 bytes integer NOT NULL CHECK(bytes>0 AND bytes<=4194304),ready boolean NOT NULL DEFAULT false,
 PRIMARY KEY(submission_id,slot)
);
CREATE TABLE cc_credit_codes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),link text NOT NULL UNIQUE,
 value_type text NOT NULL CHECK(value_type IN ('code','link')),synthetic boolean NOT NULL,withheld boolean NOT NULL DEFAULT false,
 recipient_id uuid UNIQUE REFERENCES cc_recipients,assigned_at timestamptz,revealed_at timestamptz,
 source_sha256 text NOT NULL,source_index integer NOT NULL,
 CHECK((recipient_id IS NULL)=(assigned_at IS NULL))
);
CREATE TABLE cc_release (
 id integer PRIMARY KEY CHECK(id=1),roster_reviewed boolean NOT NULL DEFAULT false,
 inventory_reviewed boolean NOT NULL DEFAULT false,prior_assignments_reviewed boolean NOT NULL DEFAULT false,
 expected_recipients integer NOT NULL DEFAULT 0 CHECK(expected_recipients>=0),
 expected_inventory integer NOT NULL DEFAULT 0 CHECK(expected_inventory>=0),
 version bigint NOT NULL DEFAULT 0,reviewed_version bigint,
 review_note text NOT NULL DEFAULT ''
);
INSERT INTO cc_release(id) VALUES(1);
CREATE TABLE cc_mail_attempts (token_hash text PRIMARY KEY REFERENCES cc_magic_tokens(hash),attempted_at timestamptz NOT NULL DEFAULT now());
-- Any roster/inventory mutation invalidates prior review. Assignment-only updates
-- deliberately do not invalidate a reviewed release. Importers may never reset it.
CREATE FUNCTION cc_invalidate_release() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN UPDATE public.cc_release SET version=version+1,roster_reviewed=false,inventory_reviewed=false,prior_assignments_reviewed=false,reviewed_version=NULL; RETURN NULL; END $$;
CREATE TRIGGER roster_changed AFTER INSERT OR UPDATE OR DELETE ON cc_recipients FOR EACH STATEMENT EXECUTE FUNCTION cc_invalidate_release();
CREATE TRIGGER inventory_inserted AFTER INSERT OR DELETE ON cc_credit_codes FOR EACH STATEMENT EXECUTE FUNCTION cc_invalidate_release();
CREATE TRIGGER inventory_edited AFTER UPDATE OF link,value_type,synthetic,withheld,source_sha256,source_index ON cc_credit_codes FOR EACH STATEMENT EXECUTE FUNCTION cc_invalidate_release();
COMMIT;
