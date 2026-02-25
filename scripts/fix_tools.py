import json
from sqlmodel import Session, create_engine, text
from mep.common.services.config_service import settings

engine = create_engine(settings.database_url)
with Session(engine) as session:
    r = session.exec(text("SELECT value FROM config WHERE `key` = 'initdb_config'")).first()
    if r:
        val = r[0]
        updated = val.replace('灵思', '赛乐助手')
        if updated != val:
            session.exec(
                text("UPDATE config SET value = :v WHERE `key` = 'initdb_config'"),
                params={"v": updated}
            )
            session.commit()
            print("Updated initdb_config: '灵思' -> '赛乐助手'")
        else:
            print("No '灵思' found in initdb_config, checking current content...")
            for line in val.split('\n'):
                if 'ws_new_chat' in line or '赛乐' in line or '助手' in line:
                    print(f"  {line}")
    else:
        print("No initdb_config found!")
