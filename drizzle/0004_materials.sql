-- Immutable versions and conservative reservations: bytes are released only after
-- object deletion has been confirmed. UTC is the quota/ledger day boundary.
CREATE TABLE material_settings (
 id INTEGER PRIMARY KEY CHECK(id=1), uploads_enabled INTEGER NOT NULL DEFAULT 0 CHECK(uploads_enabled IN (0,1)),
 capacity_bytes INTEGER NOT NULL DEFAULT 0 CHECK(capacity_bytes BETWEEN 0 AND 8000000000),
 reconciled_at TEXT, reconcile_cursor TEXT, reconcile_active INTEGER NOT NULL DEFAULT 0, reconcile_busy_until INTEGER NOT NULL DEFAULT 0
);
INSERT INTO material_settings(id) VALUES(1);
CREATE TABLE materials (
 id TEXT PRIMARY KEY, course_code TEXT NOT NULL, owner_id TEXT NOT NULL REFERENCES accounts(id),
 title TEXT NOT NULL, category TEXT NOT NULL CHECK(category IN ('lecture','tutorial','past_exam','notes')),
 academic_year TEXT NOT NULL, semester TEXT NOT NULL CHECK(semester IN ('A','B','Summer')), week INTEGER,
 source_url TEXT NOT NULL, rights_basis TEXT NOT NULL CHECK(rights_basis IN ('own','permission','open_license')),
 rights_declaration TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','taken_down')),
 current_version TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX material_course ON materials(course_code,status);
CREATE TABLE material_versions (
 id TEXT PRIMARY KEY, material_id TEXT NOT NULL REFERENCES materials(id), uploader_id TEXT NOT NULL REFERENCES accounts(id),
 object_key TEXT NOT NULL UNIQUE, expected_sha256 TEXT NOT NULL, verified_sha256 TEXT UNIQUE,
 expected_size INTEGER NOT NULL CHECK(expected_size BETWEEN 1 AND 50000000), size INTEGER,
 held_bytes INTEGER NOT NULL CHECK(held_bytes BETWEEN 0 AND 50000000),
 state TEXT NOT NULL CHECK(state IN ('reserved','uploading','quarantined','approved','rejected','failed','deleted','abandoned')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), expires_at INTEGER NOT NULL,
 verified_at TEXT, error TEXT, approved_at TEXT
);
CREATE INDEX material_version_owner_day ON material_versions(uploader_id,created_at);
CREATE INDEX material_version_material ON material_versions(material_id,state);
CREATE TABLE material_orphans(object_key TEXT PRIMARY KEY,size INTEGER NOT NULL,first_seen TEXT NOT NULL);
CREATE TABLE material_unlocks (
 account_id TEXT NOT NULL REFERENCES accounts(id),material_id TEXT NOT NULL REFERENCES materials(id),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),PRIMARY KEY(account_id,material_id)
);
CREATE TABLE material_reports (
 id TEXT PRIMARY KEY,material_id TEXT NOT NULL REFERENCES materials(id),reporter_id TEXT NOT NULL,
 reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL,
 UNIQUE(material_id,reporter_id)
);
CREATE TABLE material_audit (
 id TEXT PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,material_id TEXT,reason TEXT NOT NULL,created_at TEXT NOT NULL
);
-- SELECT RAISE ... WHERE avoids CASE/END splitting in the remote D1 query API.
CREATE TRIGGER material_reserve_guard BEFORE INSERT ON material_versions BEGIN
 SELECT RAISE(ABORT,'UPLOADS_DISABLED') WHERE (SELECT uploads_enabled FROM material_settings WHERE id=1)<>1;
 SELECT RAISE(ABORT,'CAPACITY_LIMIT') WHERE NEW.held_bytes + COALESCE((SELECT SUM(held_bytes) FROM material_versions),0) + COALESCE((SELECT SUM(size) FROM material_orphans),0) > (SELECT capacity_bytes FROM material_settings WHERE id=1);
 SELECT RAISE(ABORT,'UPLOAD_DAILY_LIMIT') WHERE (SELECT COUNT(*) FROM material_versions WHERE uploader_id=NEW.uploader_id AND created_at>=date('now'))>=3;
 SELECT RAISE(ABORT,'UPLOAD_PENDING_LIMIT') WHERE (SELECT COUNT(*) FROM material_versions WHERE uploader_id=NEW.uploader_id AND state IN ('reserved','uploading','quarantined'))>=3;
END;
CREATE TRIGGER material_unlock_from_ledger AFTER INSERT ON point_ledger WHEN NEW.kind='material_unlock' BEGIN
 INSERT INTO material_unlocks(account_id,material_id,created_at) VALUES(NEW.account_id,NEW.reference_id,NEW.created_at);
END;
-- Publication and reward share the same database transaction; updates never mint again.
CREATE TRIGGER material_approve AFTER UPDATE OF state ON material_versions WHEN NEW.state='approved' AND OLD.state<>'approved' BEGIN
 UPDATE materials SET status='approved',current_version=NEW.id,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=NEW.material_id;
 INSERT INTO point_ledger(id,event_key,account_id,amount,kind,reference_id,reason,actor,created_at)
 SELECT lower(hex(randomblob(16))),'upload_reward:'||m.id,m.owner_id,50,'upload_reward',m.id,'Approved verified upload','system',strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM materials m WHERE m.id=NEW.material_id
 ON CONFLICT(event_key) DO NOTHING;
END;
CREATE TRIGGER material_takedown AFTER UPDATE OF status ON materials WHEN NEW.status='taken_down' AND OLD.status<>'taken_down' BEGIN
 INSERT INTO point_ledger(id,event_key,account_id,amount,kind,reference_id,reason,actor,created_at)
 SELECT lower(hex(randomblob(16))),'upload_revoke:'||NEW.id,account_id,-amount,'upload_revoke',NEW.id,'Material permanently taken down','system',strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM point_ledger WHERE event_key='upload_reward:'||NEW.id
 ON CONFLICT(event_key) DO NOTHING;
 INSERT INTO point_ledger(id,event_key,account_id,amount,kind,reference_id,reason,actor,created_at)
 SELECT lower(hex(randomblob(16))),'material_refund:'||u.account_id||':'||NEW.id,u.account_id,1,'material_refund',NEW.id,'Material permanently taken down','system',strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM material_unlocks u WHERE u.material_id=NEW.id
 ON CONFLICT(event_key) DO NOTHING;
END;
