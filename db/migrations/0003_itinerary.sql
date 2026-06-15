-- 0003_itinerary: the capture queue. As Marcellous browses Command Central he
-- drops tasks here (often via voice dictation); the list is read by Monday
-- (the OpenClaw assistant) so when he switches to WhatsApp to work, the agent is
-- already caught up. This is the dashboard's one write surface.
--
--   status: open  = captured, not yet handed off
--           sent  = pushed to Monday / pulled into a work session
--           done  = completed
CREATE TABLE IF NOT EXISTS itinerary (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  body       TEXT NOT NULL,
  project    TEXT,                      -- optional project rel/name tag
  status     TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_itinerary_status  ON itinerary(status);
CREATE INDEX IF NOT EXISTS idx_itinerary_created ON itinerary(created_at);
