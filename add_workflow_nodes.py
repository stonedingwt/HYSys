#!/usr/bin/env python3
"""Add nodes (输入, 助手, 结束) and connect: 开始 → 输入 → 助手 → 结束"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

SCREENSHOT_DIR = Path("test_screenshots")
SCREENSHOT_DIR.mkdir(exist_ok=True)
FLOW_URL = "https://yuanjing.noooyi.com/flow/3ceb5682fe254a4cadd62118a42a10d7"

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            locale="zh-CN",
        )
        page = await context.new_page()
        page.set_default_timeout(30000)

        try:
            # Login (same flow as create_saile_workflow.py)
            await page.goto("https://yuanjing.noooyi.com/", wait_until="domcontentloaded", timeout=25000)
            await page.wait_for_timeout(3000)
            body = await page.evaluate("() => document.body.innerText")
            if "钉钉" in body and "扫码" in body:
                key_btn = page.locator('button:has(svg)').first
                await key_btn.click()
                await page.wait_for_timeout(2000)
            body = await page.evaluate("() => document.body.innerText")
            if "请输入" in body or "密码" in body:
                await page.fill("#email", "admin")
                await page.fill("#pwd", "admin123")
                await page.click('button:has-text("登录")')
                await page.wait_for_timeout(8000)
            await page.screenshot(path=SCREENSHOT_DIR / "wf0_after_login.png", full_page=True)

            # Navigate to flow editor
            await page.goto(FLOW_URL, wait_until="domcontentloaded", timeout=25000)
            await page.wait_for_timeout(6000)
            await page.screenshot(path=SCREENSHOT_DIR / "wf1_initial.png", full_page=True)

            body = await page.evaluate("() => document.body.innerText")
            if "钉钉" in body and "扫码" in body:
                # Try going to build/apps first (establishes session)
                await page.goto("https://yuanjing.noooyi.com/build/apps", wait_until="domcontentloaded", timeout=20000)
                await page.wait_for_timeout(4000)
                body2 = await page.evaluate("() => document.body.innerText")
                if "新建" in body2 or "应用" in body2:
                    await page.goto(FLOW_URL, wait_until="domcontentloaded", timeout=20000)
                    await page.wait_for_timeout(5000)
                    body = await page.evaluate("() => document.body.innerText")
                if "钉钉" in body and "扫码" in body:
                    print("Still on login - credentials may be invalid")
                    raise Exception("Login failed - still on login page")

            # Canvas: try multiple selectors
            canvas = page.locator('.react-flow__viewport, [class*="react-flow"], #flow-page main').first
            try:
                await canvas.wait_for(state="visible", timeout=5000)
            except Exception:
                canvas = page.locator('main').first
            canvas_box = await canvas.bounding_box()
            if not canvas_box:
                canvas_box = {"x": 350, "y": 120, "width": 900, "height": 600}

            # Drag nodes - use draggable div (parent of the text span)
            main = page.locator('main').first
            input_div = page.locator('div[draggable]:has-text("输入")').first
            await input_div.drag_to(main, target_position={"x": 350, "y": 150})
            await page.wait_for_timeout(2000)
            await page.screenshot(path=SCREENSHOT_DIR / "wf3_after_input.png", full_page=True)

            agent_div = page.locator('div[draggable]:has-text("助手")').first
            await agent_div.drag_to(main, target_position={"x": 550, "y": 150})
            await page.wait_for_timeout(2000)
            await page.screenshot(path=SCREENSHOT_DIR / "wf4_after_agent.png", full_page=True)

            end_div = page.locator('div[draggable]:has-text("结束")').first
            await end_div.drag_to(main, target_position={"x": 750, "y": 150})
            await page.wait_for_timeout(2000)
            await page.screenshot(path=SCREENSHOT_DIR / "wf5_after_end.png", full_page=True)

            # Connect: find handles (data-handleid or similar)
            handles = await page.locator('[class*="handle"], [data-handlepos]').all()
            print(f"Found {len(handles)} handles")
            if len(handles) >= 4:
                await handles[0].drag_to(handles[1])
                await page.wait_for_timeout(500)
                await handles[2].drag_to(handles[3])
                await page.wait_for_timeout(500)
                if len(handles) >= 6:
                    await handles[4].drag_to(handles[5])
                    await page.wait_for_timeout(500)

            await page.screenshot(path=SCREENSHOT_DIR / "wf6_final.png", full_page=True)

            nodes = await page.evaluate("""() => {
                const els = document.querySelectorAll('.react-flow__node');
                return els.length;
            }""")
            edges = await page.evaluate("""() => {
                const els = document.querySelectorAll('.react-flow__edge');
                return els.length;
            }""")
            print("Nodes on canvas:", nodes)
            print("Edges:", edges)

        except Exception as e:
            print("ERROR:", type(e).__name__, str(e))
            await page.screenshot(path=SCREENSHOT_DIR / "wf_error.png", full_page=True)
        finally:
            await browser.close()
            print("\nScreenshots:", SCREENSHOT_DIR)

asyncio.run(run())
