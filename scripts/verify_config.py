import json
from sqlmodel import Session, create_engine, text
from mep.common.services.config_service import settings

engine = create_engine(settings.database_url)
with Session(engine) as session:
    r = session.exec(text("SELECT value FROM config WHERE `key` = 'workstation'")).first()
    val = json.loads(r[0])
    lc = val.get("linsightConfig", {})
    tools = lc.get("tools", [])
    print(f"Total tools: {len(tools)}")
    for t in tools:
        tid = t.get("id")
        tname = t.get("name")
        print(f"  id={tid}, name={tname}")
        for c in t.get("children", []):
            cid = c.get("id")
            cname = c.get("name")
            ckey = c.get("tool_key")
            print(f"    child id={cid}, name={cname}, tool_key={ckey}")

    has_firecrawl = any(t.get("id") == 10 for t in tools)
    print(f"\nFirecrawl in config: {has_firecrawl}")
