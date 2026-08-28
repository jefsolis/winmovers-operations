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
      progress_status  TEXT NOT NULL DEFAULT 'NOT_STARTED',
      pending_progress_status TEXT,
      signature_local_path TEXT,
      signature_blob_path  TEXT,
      signature_declined   INTEGER DEFAULT 0,
      signature_decline_note TEXT,
      review_language  TEXT,
      completion_requested_at TEXT,
      completion_confirmed_at TEXT,
      completion_idempotency_key TEXT,
      completion_observations TEXT,
      satisfaction_rating INTEGER,
      satisfaction_submitted_at TEXT,
      crew_signature_local_path TEXT,
      crew_signature_blob_path TEXT,
      crew_leader_name TEXT,
      latitude         REAL,
      longitude        REAL,
      location_accuracy REAL,
      location_captured_at TEXT,
      location_unavailable_reason TEXT,
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
      barcode         TEXT,
      barcode_state   TEXT NOT NULL DEFAULT 'ASSIGNED',
      barcode_assigned_at TEXT,
      created_at      TEXT NOT NULL,
      UNIQUE(packing_list_id, barcode),
      FOREIGN KEY (packing_list_id) REFERENCES packing_lists(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS packing_workday_events (
      id                           TEXT PRIMARY KEY,
      server_id                    TEXT,
      packing_list_id              TEXT NOT NULL,
      workday_index                INTEGER NOT NULL,
      event_type                   TEXT NOT NULL,
      from_progress_status         TEXT,
      to_progress_status           TEXT,
      observations                 TEXT,
      occurred_at                  TEXT NOT NULL,
      confirmed_at                 TEXT,
      actor_name                   TEXT,
      signature_client_local_path  TEXT,
      signature_client_blob_path   TEXT,
      signature_crew_local_path    TEXT,
      signature_crew_blob_path     TEXT,
      client_signer_name           TEXT,
      crew_leader_name             TEXT,
      signature_language           TEXT,
      latitude                     REAL,
      longitude                    REAL,
      location_accuracy            REAL,
      location_captured_at         TEXT,
      location_unavailable_reason  TEXT,
      sync_state                   TEXT NOT NULL DEFAULT 'PENDING',
      sync_error                   TEXT,
      created_at                   TEXT NOT NULL,
      updated_at                   TEXT NOT NULL,
      FOREIGN KEY (packing_list_id) REFERENCES packing_lists(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_packing_workday_events_local
      ON packing_workday_events (id);

    CREATE INDEX IF NOT EXISTS idx_packing_workday_events_sync
      ON packing_workday_events (packing_list_id, sync_state, occurred_at);

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

    CREATE TABLE IF NOT EXISTS package_item_deletions (
      item_id     TEXT PRIMARY KEY,
      package_id  TEXT NOT NULL,
      deleted_at  TEXT NOT NULL
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

    CREATE TABLE IF NOT EXISTS packing_progress_transitions (
      id                   TEXT PRIMARY KEY,
      server_id            TEXT,
      packing_list_id      TEXT NOT NULL,
      from_status          TEXT NOT NULL,
      to_status            TEXT NOT NULL,
      observations         TEXT,
      signature_local_path TEXT,
      signature_blob_path  TEXT,
      survey_version       INTEGER,
      survey_answers       TEXT,
      occurred_at          TEXT NOT NULL,
      sync_state           TEXT NOT NULL DEFAULT 'PENDING',
      sync_error           TEXT,
      created_at           TEXT NOT NULL,
      confirmed_at         TEXT,
      latitude             REAL,
      longitude            REAL,
      location_accuracy    REAL,
      location_captured_at TEXT,
      location_unavailable_reason TEXT,
      FOREIGN KEY (packing_list_id) REFERENCES packing_lists(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_packing_progress_transition_sync
      ON packing_progress_transitions (packing_list_id, sync_state);

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
      client_id   TEXT,
      phone       TEXT,
      address     TEXT,
      job_type    TEXT,
      service_latitude  REAL,
      service_longitude REAL,
      status      TEXT NOT NULL,
      cached_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key         TEXT PRIMARY KEY,
      value       TEXT,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ingress_egress_operations (
      id                                    TEXT PRIMARY KEY,
      server_id                             TEXT,
      packing_list_id                       TEXT NOT NULL,
      type                                  TEXT NOT NULL,
      status                                TEXT NOT NULL DEFAULT 'IN_PROGRESS',
      device_id                             TEXT NOT NULL,
      idempotency_key                       TEXT NOT NULL,
      warehouse_location                    TEXT,
      observations                          TEXT,
      crew_leader_name                      TEXT,
      crew_leader_signature_local_path      TEXT,
      crew_leader_signature_blob_path       TEXT,
      crew_leader_signed_at                 TEXT,
      warehouse_manager_name                TEXT,
      warehouse_manager_signature_local_path TEXT,
      warehouse_manager_signature_blob_path TEXT,
      warehouse_manager_signed_at           TEXT,
      latitude                              REAL,
      longitude                             REAL,
      location_accuracy                     REAL,
      location_captured_at                  TEXT,
      location_unavailable_reason           TEXT,
      completed_at                          TEXT,
      sync_state                            TEXT NOT NULL DEFAULT 'PENDING',
      sync_error                            TEXT,
      created_at                            TEXT NOT NULL,
      updated_at                            TEXT NOT NULL,
      FOREIGN KEY (packing_list_id) REFERENCES packing_lists(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_ingress_egress_operations_list
      ON ingress_egress_operations (packing_list_id, type);

    CREATE INDEX IF NOT EXISTS idx_ingress_egress_operations_sync
      ON ingress_egress_operations (sync_state);

    CREATE TABLE IF NOT EXISTS ingress_egress_box_scans (
      id              TEXT PRIMARY KEY,
      server_id       TEXT,
      operation_id    TEXT NOT NULL,
      package_id      TEXT NOT NULL,
      scan_method     TEXT NOT NULL,
      scanned_at      TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      sync_state      TEXT NOT NULL DEFAULT 'PENDING',
      sync_error      TEXT,
      created_at      TEXT NOT NULL,
      UNIQUE(operation_id, package_id),
      FOREIGN KEY (operation_id) REFERENCES ingress_egress_operations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_ingress_egress_box_scans_sync
      ON ingress_egress_box_scans (operation_id, sync_state);
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
  await addColumnIfMissing("ALTER TABLE packing_lists ADD COLUMN progress_status TEXT NOT NULL DEFAULT 'NOT_STARTED'");
  await addColumnIfMissing('ALTER TABLE packing_lists ADD COLUMN pending_progress_status TEXT');
  await addColumnIfMissing('ALTER TABLE packing_lists ADD COLUMN completion_idempotency_key TEXT');
  await addColumnIfMissing('ALTER TABLE packing_lists ADD COLUMN completion_observations TEXT');
  await addColumnIfMissing('ALTER TABLE packing_lists ADD COLUMN satisfaction_rating INTEGER');
  await addColumnIfMissing('ALTER TABLE packing_lists ADD COLUMN satisfaction_submitted_at TEXT');
  await addColumnIfMissing('ALTER TABLE packing_lists ADD COLUMN crew_signature_local_path TEXT');
  await addColumnIfMissing('ALTER TABLE packing_lists ADD COLUMN crew_signature_blob_path TEXT');
  await addColumnIfMissing('ALTER TABLE packing_lists ADD COLUMN crew_leader_name TEXT');
  await addColumnIfMissing('ALTER TABLE moving_file_cache ADD COLUMN client_id TEXT');
  await addColumnIfMissing('ALTER TABLE moving_file_cache ADD COLUMN phone TEXT');
  await addColumnIfMissing('ALTER TABLE moving_file_cache ADD COLUMN address TEXT');
  await addColumnIfMissing('ALTER TABLE moving_file_cache ADD COLUMN job_type TEXT');
  await addColumnIfMissing('ALTER TABLE moving_file_cache ADD COLUMN service_latitude REAL');
  await addColumnIfMissing('ALTER TABLE moving_file_cache ADD COLUMN service_longitude REAL');
  await addColumnIfMissing('ALTER TABLE packages ADD COLUMN barcode_state TEXT NOT NULL DEFAULT \'ASSIGNED\'');
  await addColumnIfMissing('ALTER TABLE packages ADD COLUMN barcode_assigned_at TEXT');

  for (const table of ['packing_lists', 'packing_progress_transitions', 'packing_workday_events']) {
    await addColumnIfMissing(`ALTER TABLE ${table} ADD COLUMN latitude REAL`);
    await addColumnIfMissing(`ALTER TABLE ${table} ADD COLUMN longitude REAL`);
    await addColumnIfMissing(`ALTER TABLE ${table} ADD COLUMN location_accuracy REAL`);
    await addColumnIfMissing(`ALTER TABLE ${table} ADD COLUMN location_captured_at TEXT`);
    await addColumnIfMissing(`ALTER TABLE ${table} ADD COLUMN location_unavailable_reason TEXT`);
  }

  // Devices created before deferred barcode support have `barcode NOT NULL`, which blocks boxes without a code.
  const packageColumns = await database.getAllAsync<{ name: string; notnull: number }>('PRAGMA table_info(packages)');
  const barcodeColumn = packageColumns.find(column => column.name === 'barcode');
  if (barcodeColumn?.notnull === 1) {
    await database.execAsync(`
      PRAGMA foreign_keys=off;
      BEGIN TRANSACTION;
      CREATE TABLE packages_migrated (
        id              TEXT PRIMARY KEY,
        server_id       TEXT,
        packing_list_id TEXT NOT NULL,
        barcode         TEXT,
        barcode_state   TEXT NOT NULL DEFAULT 'ASSIGNED',
        barcode_assigned_at TEXT,
        created_at      TEXT NOT NULL,
        UNIQUE(packing_list_id, barcode),
        FOREIGN KEY (packing_list_id) REFERENCES packing_lists(id) ON DELETE CASCADE
      );
      INSERT INTO packages_migrated
        (id, server_id, packing_list_id, barcode, barcode_state, barcode_assigned_at, created_at)
      SELECT id, server_id, packing_list_id, barcode, barcode_state, barcode_assigned_at, created_at
      FROM packages;
      DROP TABLE packages;
      ALTER TABLE packages_migrated RENAME TO packages;
      COMMIT;
      PRAGMA foreign_keys=on;
    `);
  }
}
