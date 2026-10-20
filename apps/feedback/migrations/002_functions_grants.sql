BEGIN;
SET LOCAL ROLE cc_owner;
CREATE FUNCTION cc_save_feedback(receipt_id uuid,who uuid,answers jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r public.cc_recipients%ROWTYPE; saved public.event_feedback%ROWTYPE; k text; admitted uuid;
BEGIN
 SELECT * INTO r FROM public.cc_recipients WHERE id=who AND eligible FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'sign-in required'; END IF;
 SELECT * INTO saved FROM public.event_feedback WHERE id=receipt_id;
 IF FOUND THEN
  IF saved.payload->>'recipientId' IS DISTINCT FROM who::text THEN RAISE EXCEPTION 'foreign receipt'; END IF;
  IF saved.payload->>'deleted' IS DISTINCT FROM 'true' AND saved.payload IS DISTINCT FROM (answers||jsonb_build_object('recipientId',who::text,'email',r.email)) THEN RAISE EXCEPTION 'receipt payload mismatch'; END IF;
  RETURN jsonb_build_object('id',receipt_id,'saved',true,'created',false);
 END IF;
 IF jsonb_typeof(answers) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid answers'; END IF;
 FOREACH k IN ARRAY ARRAY['name','affiliation','role','feedback','improvements'] LOOP
  IF jsonb_typeof(answers->k) IS DISTINCT FROM 'string' OR length(btrim(answers->>k))=0 THEN RAISE EXCEPTION 'required answers'; END IF;
 END LOOP;
 IF length(answers->>'name')>100 OR length(answers->>'affiliation')>160 OR length(answers->>'role')>120 OR length(answers->>'feedback')>4000 OR length(answers->>'improvements')>4000 OR octet_length(answers::text)>60000 THEN RAISE EXCEPTION 'answers too long'; END IF;
 answers=answers||jsonb_build_object('recipientId',who::text,'email',r.email);
 INSERT INTO public.event_feedback(id,status,payload) VALUES(receipt_id,'saved',answers) ON CONFLICT(id) DO NOTHING RETURNING id INTO admitted;
 IF admitted IS NULL THEN
  SELECT * INTO saved FROM public.event_feedback WHERE id=receipt_id;
  IF saved.payload->>'recipientId' IS DISTINCT FROM who::text THEN RAISE EXCEPTION 'foreign receipt'; END IF;
  IF saved.payload->>'deleted' IS DISTINCT FROM 'true' AND saved.payload IS DISTINCT FROM (answers||jsonb_build_object('recipientId',who::text,'email',r.email)) THEN RAISE EXCEPTION 'receipt payload mismatch'; END IF;
  RETURN jsonb_build_object('id',receipt_id,'saved',true,'created',false);
 END IF;
 -- Reservation, account quota, global quota and final saved row are ONE commit.
 -- A failure rolls all back. No text-save pending/failed state can become stuck.
 INSERT INTO public.cc_feedback_account_daily(recipient_id,day,total) VALUES(who,CURRENT_DATE,1)
 ON CONFLICT(recipient_id,day) DO UPDATE SET total=cc_feedback_account_daily.total+1 WHERE cc_feedback_account_daily.total<10;
 IF NOT FOUND THEN RAISE EXCEPTION 'account capacity reached'; END IF;
 INSERT INTO public.feedback_daily(day,total) VALUES(CURRENT_DATE,1)
 ON CONFLICT(day) DO UPDATE SET total=feedback_daily.total+1 WHERE feedback_daily.total<300;
 IF NOT FOUND THEN RAISE EXCEPTION 'global capacity reached'; END IF;
 RETURN jsonb_build_object('id',receipt_id,'saved',true,'created',true);
END $$;
CREATE FUNCTION cc_assign_credit(who uuid,allow_real boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r public.cc_recipients%ROWTYPE; release public.cc_release%ROWTYPE; answer public.cc_credit_codes%ROWTYPE; candidate uuid;
BEGIN
 SELECT * INTO r FROM public.cc_recipients WHERE id=who AND eligible AND claim_eligible FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not eligible'; END IF;
 IF NOT r.synthetic THEN
  SELECT * INTO release FROM public.cc_release WHERE id=1 FOR SHARE;
  IF allow_real IS DISTINCT FROM true OR NOT(release.roster_reviewed AND release.inventory_reviewed AND release.prior_assignments_reviewed)
   OR release.reviewed_version IS DISTINCT FROM release.version OR length(btrim(release.review_note))=0
   OR release.expected_recipients<=0 OR release.expected_inventory<=0
   OR (SELECT count(*) FROM public.cc_credit_codes WHERE NOT synthetic AND recipient_id IS NULL AND NOT withheld)<(SELECT count(*) FROM public.cc_recipients r2 WHERE eligible AND claim_eligible AND NOT synthetic AND NOT EXISTS(SELECT 1 FROM public.cc_credit_codes c2 WHERE c2.recipient_id=r2.id))
   OR release.expected_recipients<>(SELECT count(*) FROM public.cc_recipients WHERE eligible AND claim_eligible AND NOT synthetic)
   OR release.expected_inventory<>(SELECT count(*) FROM public.cc_credit_codes WHERE NOT synthetic)
  THEN RAISE EXCEPTION 'distribution disabled'; END IF;
 END IF;
 SELECT * INTO answer FROM public.cc_credit_codes WHERE recipient_id=who;
 IF FOUND THEN
  IF answer.synthetic IS DISTINCT FROM r.synthetic THEN RAISE EXCEPTION 'inventory pool mismatch'; END IF;
  UPDATE public.cc_credit_codes SET revealed_at=coalesce(revealed_at,now()) WHERE id=answer.id;
  RETURN jsonb_build_object('type',answer.value_type,'value',answer.link);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.event_feedback WHERE status='saved' AND payload->>'recipientId'=who::text
   AND length(btrim(payload->>'name'))>0 AND length(btrim(payload->>'affiliation'))>0 AND length(btrim(payload->>'role'))>0
   AND length(btrim(payload->>'feedback'))>0 AND length(btrim(payload->>'improvements'))>0 AND payload->>'email'=r.email)
 THEN RAISE EXCEPTION 'feedback required'; END IF;
 SELECT id INTO candidate FROM public.cc_credit_codes WHERE recipient_id IS NULL AND NOT withheld AND synthetic=r.synthetic ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'inventory temporarily unavailable'; END IF;
 UPDATE public.cc_credit_codes SET recipient_id=who,assigned_at=now(),revealed_at=now() WHERE id=candidate RETURNING * INTO answer;
 RETURN jsonb_build_object('type',answer.value_type,'value',answer.link);
END $$;
-- Sender authorization atomically marks one attempted send per issued token.
-- A provider timeout stays ambiguous and is NEVER automatically retried.
CREATE FUNCTION cc_authorize_mail(digest text,destination text) RETURNS TABLE(name text) LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 WITH eligible AS (
  SELECT t.hash,r.name FROM public.cc_magic_tokens t JOIN public.cc_recipients r ON r.id=t.recipient_id
  WHERE t.hash=digest AND t.expires_at>now() AND t.consumed_at IS NULL AND r.email=destination AND r.eligible AND NOT r.synthetic
 ), reserved AS (
  INSERT INTO public.cc_mail_attempts(token_hash) SELECT hash FROM eligible ON CONFLICT DO NOTHING RETURNING token_hash
 ) SELECT e.name FROM eligible e JOIN reserved a ON a.token_hash=e.hash
$$;
-- Photo writes are receipt-locked capabilities, not direct table privileges.
CREATE FUNCTION cc_valid_photo(receipt_id uuid,photo_slot integer,photo_key text,photo_type text,photo_bytes integer) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT coalesce(photo_slot BETWEEN 0 AND 19 AND photo_bytes BETWEEN 1 AND 4194304
  AND photo_type IN ('image/jpeg','image/png','image/webp')
  AND photo_key ~ ('^feedback/'||receipt_id::text||'/photo-'||photo_slot::text||'-[a-f0-9]{64}\.'||CASE photo_type WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/png' THEN 'png' WHEN 'image/webp' THEN 'webp' END||'$'),false)
$$;
CREATE FUNCTION cc_reserve_photo(receipt_id uuid,who uuid,photo_slot integer,photo_key text,photo_type text,photo_bytes integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE saved public.event_feedback%ROWTYPE; upload public.cc_feedback_uploads%ROWTYPE;
BEGIN
 IF NOT public.cc_valid_photo(receipt_id,photo_slot,photo_key,photo_type,photo_bytes) THEN RAISE EXCEPTION 'invalid photo'; END IF;
 SELECT * INTO saved FROM public.event_feedback WHERE id=receipt_id FOR UPDATE;
 IF NOT FOUND OR saved.status IS DISTINCT FROM 'saved' OR saved.payload->>'recipientId' IS DISTINCT FROM who::text OR saved.payload->>'deleted'='true' THEN RETURN jsonb_build_object('status','denied'); END IF;
 SELECT * INTO upload FROM public.cc_feedback_uploads WHERE submission_id=receipt_id AND slot=photo_slot;
 IF FOUND THEN
  IF upload.object_key IS DISTINCT FROM photo_key OR upload.content_type IS DISTINCT FROM photo_type OR upload.bytes IS DISTINCT FROM photo_bytes THEN RETURN jsonb_build_object('status','conflict'); END IF;
  RETURN jsonb_build_object('status','reserved','ready',upload.ready);
 END IF;
 INSERT INTO public.cc_feedback_uploads(submission_id,slot,object_key,content_type,bytes) VALUES(receipt_id,photo_slot,photo_key,photo_type,photo_bytes);
 RETURN jsonb_build_object('status','reserved','ready',false);
END $$;
CREATE FUNCTION cc_commit_photo(receipt_id uuid,who uuid,photo_slot integer,photo_key text,photo_type text,photo_bytes integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE saved public.event_feedback%ROWTYPE;
BEGIN
 IF NOT public.cc_valid_photo(receipt_id,photo_slot,photo_key,photo_type,photo_bytes) THEN RAISE EXCEPTION 'invalid photo'; END IF;
 SELECT * INTO saved FROM public.event_feedback WHERE id=receipt_id FOR UPDATE;
 IF NOT FOUND OR saved.status IS DISTINCT FROM 'saved' OR saved.payload->>'recipientId' IS DISTINCT FROM who::text OR saved.payload->>'deleted'='true' THEN RETURN false; END IF;
 UPDATE public.cc_feedback_uploads SET ready=true WHERE submission_id=receipt_id AND slot=photo_slot AND object_key=photo_key AND content_type=photo_type AND bytes=photo_bytes;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.event_feedback SET photos=(SELECT coalesce(jsonb_agg(jsonb_build_object('key',object_key,'type',content_type,'bytes',bytes) ORDER BY slot),'[]'::jsonb) FROM public.cc_feedback_uploads WHERE submission_id=receipt_id AND ready) WHERE id=receipt_id;
 RETURN true;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO cc_runtime,cc_admin,cc_sender;
GRANT SELECT ON cc_recipients TO cc_runtime;
GRANT SELECT,INSERT ON cc_magic_tokens TO cc_runtime;
GRANT UPDATE(consumed_at) ON cc_magic_tokens TO cc_runtime;
GRANT SELECT,INSERT,DELETE ON cc_sessions TO cc_runtime;
GRANT SELECT,INSERT,UPDATE ON cc_auth_rate TO cc_runtime;
GRANT SELECT ON event_feedback TO cc_runtime;
GRANT EXECUTE ON FUNCTION cc_save_feedback(uuid,uuid,jsonb),cc_assign_credit(uuid,boolean),cc_reserve_photo(uuid,uuid,integer,text,text,integer),cc_commit_photo(uuid,uuid,integer,text,text,integer) TO cc_runtime;
GRANT SELECT ON event_feedback TO cc_admin;
GRANT EXECUTE ON FUNCTION cc_authorize_mail(text,text) TO cc_sender;
COMMIT;
