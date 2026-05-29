-- 131_add_original_transcript_to_dispatch_audit.sql
--
-- Voice AI Dispatcher Phase 5 — track when the shop owner edited the
-- transcript before tapping Send.
--
-- ai_dispatch_audit.transcript already captures what was sent to the
-- router. This column records what the STT (Whisper) actually returned
-- BEFORE any user edit. Used for:
--   - Audit clarity: distinguish "Claude got confused on the user's
--     literal words" from "Whisper mis-heard and the user fixed it
--     before sending"
--   - STT accuracy review: replay original_transcript vs transcript to
--     find Whisper failure modes (mis-heard product names, accents,
--     numbers, etc.)
--
-- NULL when the user did NOT edit — transcript == STT output verbatim.
-- TEXT when the user edited — original_transcript stores Whisper's
-- output, transcript stores what they sent.
--
-- Cross-reference: ai_voice_transcriptions also records the same raw
-- transcript via the matching session_id, but that's a JOIN away.
-- Storing both side-by-side in ai_dispatch_audit when an edit occurred
-- keeps audit reads single-table.

ALTER TABLE ai_dispatch_audit
  ADD COLUMN IF NOT EXISTS original_transcript TEXT;

COMMENT ON COLUMN ai_dispatch_audit.original_transcript IS
  'STT (Whisper) output before any user edit. NULL when user did not edit (transcript IS the original). Populated only when the user changed the textarea before tapping Send.';
