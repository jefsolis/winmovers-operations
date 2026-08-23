import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('packing.db');
    await db.execAsync('PRAGMA journal_mode = WAL;');
  }
  return db;
}

export async function initDb(): Promise<void> {
  const database = await getDb();

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS packing_lists (
      id               TEXT PRIMARY KEY,
      server_id        TEXT,
      list_number      TEXT,
      moving_file_id   TEXT NOT NULL,
      moving_file_ref  TEXT NOT NULL,
      operator_name    TEXT NOT NULL,
      status           TEXT NOT NULL DEFAULT 'ACTIVE',
      signature_local_path TEXT,
      signature_blob_path  TEXT,
      signature_declined   INTEGER DEFAULT 0,
      signature_decline_note TEXT,
      review_language  TEXT,
      completion_requested_at TEXT,
      completion_confirmed_at TEXT,
      deleted_at       TEXT,
      locked_by_device_id  TEXT,
      lock_expires_at      TEXT,
      sync_state       TEXT NOT NULL DEFAULT 'LOCAL',
      sync_error       TEXT,
      last_synced_at   TEXT,
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS packages (
      id              TEXT PRIMARY KEY,
      server_id       TEXT,
      packing_list_id TEXT NOT NULL,
      barcode         TEXT NOT NULL,
      created_at      TEXT NOT NULL,
      UNIQUE(packing_list_id, barcode),
      FOREIGN KEY (packing_list_id) REFERENCES packing_lists(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS package_items (
      id                   TEXT PRIMARY KEY,
      server_id            TEXT,
      package_id           TEXT NOT NULL,
      packing_item_type_id TEXT,
      custom_name          TEXT,
      quantity             INTEGER NOT NULL DEFAULT 1,
      note                 TEXT,
      FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS package_photos (
      id              TEXT PRIMARY KEY,
      server_id       TEXT,
      package_id      TEXT NOT NULL,
      local_path      TEXT,
      blob_path       TEXT,
      upload_state    TEXT NOT NULL DEFAULT 'PENDING',
      FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS item_type_cache (
      id         TEXT PRIMARY KEY,
      name_es    TEXT NOT NULL,
      name_en    TEXT NOT NULL,
      active     INTEGER DEFAULT 1,
      cached_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS moving_file_cache (
      id          TEXT PRIMARY KEY,
      file_number TEXT NOT NULL,
      category    TEXT NOT NULL,
      client_name TEXT,
      status      TEXT NOT NULL,
      cached_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key         TEXT PRIMARY KEY,
      value       TEXT,
      updated_at  TEXT NOT NULL
    );
  `);

  // Lightweight forward-only migrations for existing devices.
  const addColumnIfMissing = async (sql: string) => {
    try {
      await database.runAsync(sql);
    } catch {
      // ignore duplicate-column failures
    }
  };

  await addColumnIfMissing('ALTER TABLE packing_lists ADD COLUMN review_language TEXT');
  await addColumnIfMissing('ALTER TABLE packing_lists ADD COLUMN completion_requested_at TEXT');
  await addColumnIfMissing('ALTER TABLE packing_lists ADD COLUMN completion_confirmed_at TEXT');
  await addColumnIfMissing('ALTER TABLE packing_lists ADD COLUMN deleted_at TEXT');
}
