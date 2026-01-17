PRAGMA foreign_keys = ON;

-- users
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  delete_flag   INTEGER NOT NULL DEFAULT 0,
  version       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  location    INTEGER NOT NULL,
  image       TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  delete_flag INTEGER NOT NULL DEFAULT 0,
  version     INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_events_user_time ON events(user_id, created_at DESC);
