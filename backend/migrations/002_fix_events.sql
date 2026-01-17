DROP TABLE IF EXISTS events;

CREATE TABLE events (
    id          INTEGER PRIMARY KEY,
    user_id     INTEGER NOT NULL,
    location    TEXT NOT NULL,
    image       TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    delete_flag INTEGER NOT NULL DEFAULT 0,
    version     INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
