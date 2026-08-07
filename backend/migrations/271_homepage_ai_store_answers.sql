-- Homepage AI — store what we SAID, not just what was asked.
--
-- Two reasons, and the second one turned out to matter more than the first.
--
-- 1. Restoring the thread on refresh. Without the answer text there is nothing to rebuild the
--    conversation from, so a refresh emptied the thread and re-enabled the input while the server
--    still (correctly) refused to answer — the UI inviting something it would then decline.
--
-- 2. Judging answer quality at all. The logs recorded the question and how it was answered, but never
--    the answer. That makes "is this any good?" unanswerable from the data, which is the whole point
--    of the P2 review. An assistant speaking publicly for the brand should have a readable record of
--    what it said.
--
-- Our own output, not the visitor's, so no new PII surface — the question column keeps its stripping.

ALTER TABLE homepage_ai_messages
  ADD COLUMN IF NOT EXISTS answer    TEXT,
  ADD COLUMN IF NOT EXISTS next_step TEXT;

COMMENT ON COLUMN homepage_ai_messages.answer IS
  'What the assistant replied. Used to restore the thread on refresh, and to review answer quality — the question alone cannot tell you whether the reply was any good.';
