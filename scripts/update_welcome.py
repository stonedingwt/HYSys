import json
from sqlmodel import Session, create_engine, text
from mep.common.services.config_service import settings

engine = create_engine(settings.database_url)
with Session(engine) as session:
    r = session.exec(text("SELECT value FROM config WHERE `key` = 'workstation'")).first()
    if r:
        val = json.loads(r[0])
        print("Current welcomeMessage:", val.get("welcomeMessage"))
        print("Current functionDescription:", val.get("functionDescription"))

        val["welcomeMessage"] = "您好！我是赛乐助手元境，请问有什么可以帮助您的？"
        val["functionDescription"] = ""

        session.exec(
            text("UPDATE config SET value = :v WHERE `key` = 'workstation'"),
            params={"v": json.dumps(val, ensure_ascii=False)}
        )
        session.commit()
        print("Updated successfully!")
    else:
        print("No workstation config found!")

    print("\n--- t_gpts_tools_type columns ---")
    cols = session.exec(text("SHOW COLUMNS FROM t_gpts_tools_type")).all()
    for c in cols:
        print(f"  {c}")

    print("\n--- t_gpts_tools columns ---")
    cols2 = session.exec(text("SHOW COLUMNS FROM t_gpts_tools")).all()
    for c in cols2:
        print(f"  {c}")

    print("\n--- All tool types ---")
    types = session.exec(text("SELECT * FROM t_gpts_tools_type")).all()
    for t in types:
        print(f"  {t}")

    print("\n--- All tools ---")
    tools = session.exec(text("SELECT * FROM t_gpts_tools")).all()
    for t in tools:
        row_str = str(t)
        if len(row_str) > 300:
            row_str = row_str[:300] + "..."
        print(f"  {row_str}")
