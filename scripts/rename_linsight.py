import json
from sqlmodel import Session, create_engine, text
from mep.common.services.config_service import settings

engine = create_engine(settings.database_url)
with Session(engine) as session:
    r = session.exec(text("SELECT value FROM config WHERE `key` = 'initdb_config'")).first()
    if r:
        val = r[0]
        updated = val.replace('灵思', '灵境')
        if updated != val:
            session.exec(
                text("UPDATE config SET value = :v WHERE `key` = 'initdb_config'"),
                params={"v": updated}
            )
            session.commit()
            print("Updated initdb_config: '灵思' -> '灵境'")
        else:
            print("No '灵思' found in initdb_config")

    r2 = session.exec(text("SELECT value FROM config WHERE `key` = 'workstation'")).first()
    if r2:
        val2 = r2[0]
        updated2 = val2.replace('灵思', '灵境')
        if updated2 != val2:
            session.exec(
                text("UPDATE config SET value = :v WHERE `key` = 'workstation'"),
                params={"v": updated2}
            )
            session.commit()
            print("Updated workstation: '灵思' -> '灵境'")
        else:
            print("No '灵思' found in workstation config")

    print("Done!")
