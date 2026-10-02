"""Re-chain pre-existing audit_logs rows in `seq` order.

The old writer chose its predecessor with `ORDER BY created_at DESC, id DESC`
(uuid4 tie-break) while the verifier read `created_at ASC, id ASC`, so the
ledger forked at write time. The 148 existing rows therefore carry
`previous_hash` values that do not form a chain, even though no record was
actually tampered with.

This recomputes `previous_hash` / `event_hash` walking from GENESIS in `seq`
order. The original hashes are written to a JSON sidecar first so the previous
state stays recoverable.

Run:  python scripts/rechain_audit_logs.py [--dry-run]
"""
import argparse
import json
import pathlib
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.audit import AuditLog, compute_audit_hash
from app.core.database import SessionLocal

BACKUP = pathlib.Path(__file__).with_name("audit_hashes_before_rechain.json")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    db = SessionLocal()
    try:
        rows = db.scalars(select(AuditLog).order_by(AuditLog.seq.asc())).all()
        print(f"re-chaining {len(rows)} audit_logs rows in seq order")

        prev_hash = "GENESIS"
        plan = []
        for rec in rows:
            expected = compute_audit_hash(
                previous_hash=prev_hash,
                event_type=rec.event_type,
                actor_id=rec.actor_id,
                entity_type=rec.entity_type,
                entity_id=rec.entity_id,
                created_at=rec.created_at,
                data=rec.data,
                before_state=rec.before_state,
                after_state=rec.after_state,
                reason=rec.reason,
            )
            plan.append((rec.id, prev_hash, expected, rec.event_hash))
            prev_hash = expected

        changed = sum(1 for _, _, new, old in plan if new != old)
        print(f"  rows whose event_hash will change: {changed}/{len(plan)}")

        if args.dry_run:
            print("dry run: nothing written")
            return

        # Never clobber an earlier backup: each run needs its own sidecar so
        # the pre-rechain hashes stay recoverable.
        backup = BACKUP
        if backup.exists():
            stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            backup = backup.with_name(f"{backup.stem}_{stamp}{backup.suffix}")
        backup.write_text(
            json.dumps(
                [
                    {
                        "id": rid,
                        "seq": rec.seq,
                        "previous_hash": rec.previous_hash,
                        "event_hash": rec.event_hash,
                    }
                    for rec, (rid, _, _, _) in zip(rows, plan)
                ],
                indent=2,
            ),
            encoding="utf-8",
        )
        print(f"  backup written to {backup}")

        for rec, (_, new_prev, new_hash, _) in zip(rows, plan):
            rec.previous_hash = new_prev
            rec.event_hash = new_hash
        db.commit()

        from app.core.audit import verify_audit_chain

        print("verify_audit_chain ->", verify_audit_chain(db))
    finally:
        db.close()


if __name__ == "__main__":
    main()