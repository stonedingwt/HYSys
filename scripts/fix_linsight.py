import json
from sqlmodel import Session, create_engine, text
from mep.common.services.config_service import settings

engine = create_engine(settings.database_url)
with Session(engine) as session:
    r = session.exec(text("SELECT value FROM config WHERE `key` = 'workstation'")).first()
    if not r:
        print("No workstation config found!")
        exit(1)

    val = json.loads(r[0])
    lc = val.get("linsightConfig", {})
    tools = lc.get("tools", [])

    print(f"Before: {len(tools)} tools in linsightConfig")
    for t in tools:
        print(f"  id={t['id']}, name={t['name']}")

    # Remove Firecrawl (id=10) since it has no api_key configured
    filtered_tools = [t for t in tools if t.get("id") != 10]

    print(f"\nAfter: {len(filtered_tools)} tools in linsightConfig")
    for t in filtered_tools:
        print(f"  id={t['id']}, name={t['name']}")

    lc["tools"] = filtered_tools
    val["linsightConfig"] = lc

    session.exec(
        text("UPDATE config SET value = :v WHERE `key` = 'workstation'"),
        params={"v": json.dumps(val, ensure_ascii=False)}
    )
    session.commit()
    print("\nUpdated successfully! Removed Firecrawl from linsightConfig.")
