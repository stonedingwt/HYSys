from sqlmodel import Session, create_engine, text
from mep.common.services.config_service import settings

engine = create_engine(settings.database_url)
with Session(engine) as session:
    r = session.exec(text("SELECT value FROM config WHERE `key` = :k"), params={"k": "initdb_config"}).first()
    if r:
        val = r[0]
        new_val = val.replace("宁伊助手", "灵思").replace("赛乐助手", "灵思")
        if new_val != val:
            session.exec(text("UPDATE config SET value = :v WHERE `key` = :k"), params={"v": new_val, "k": "initdb_config"})
            session.commit()
            print("Config updated")
        else:
            print("No change needed")
    else:
        print("Config not found")
