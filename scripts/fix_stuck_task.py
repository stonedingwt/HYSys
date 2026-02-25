from sqlmodel import Session, create_engine, text
from mep.common.services.config_service import settings

engine = create_engine(settings.database_url)
with Session(engine) as session:
    stuck = session.exec(text(
        "SELECT id, status, question FROM linsight_session_version WHERE status = 'in_progress'"
    )).all()
    print(f"Found {len(stuck)} stuck in_progress tasks:")
    for t in stuck:
        print(f"  id={t[0]}, status={t[1]}, question={t[2]}")

    if stuck:
        session.exec(text(
            "UPDATE linsight_session_version SET status = 'failed' WHERE status = 'in_progress'"
        ))
        session.exec(text(
            "UPDATE linsight_execute_task SET status = 'failed' WHERE status NOT IN ('success', 'failed') "
            "AND session_version_id IN (SELECT id FROM linsight_session_version WHERE status = 'failed')"
        ))
        session.commit()
        print("Updated stuck tasks to 'failed' status.")
    else:
        print("No stuck tasks found.")
