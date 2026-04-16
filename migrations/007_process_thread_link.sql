-- Link email threads to their AI-processing thread so all operators can
-- see the follow-up / outcome section after a quote has been sent.
ALTER TABLE email_threads
  ADD COLUMN IF NOT EXISTS process_thread_id TEXT;
