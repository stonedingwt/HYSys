#!/usr/bin/env python3
"""Create 赛乐助手 workflow via browser UI at yuanjing.noooyi.com"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

SCREENSHOT_DIR = Path("test_screenshots")
SCREENSHOT_DIR.mkdir(exist_ok=True)

WORKFLOW_NAME = "赛乐助手"
WORKFLOW_DESC = "赛乐智能助手工作流：支持知识库检索、联网搜索，严格限制回答范围"

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1440, "height": 900}, locale="zh-CN")
        page.set_default_timeout(20000)

        try:
            # Step 1: Login - use root URL (platform may 404)
            print("Step 1: Navigating to login...")
            await page.goto("https://yuanjing.noooyi.com/", wait_until="domcontentloaded", timeout=25000)
            await page.wait_for_timeout(3000)
            await page.screenshot(path=SCREENSHOT_DIR / "s1_login.png", full_page=True)

            body = await page.evaluate("() => document.body.innerText")
            # Switch to account/password if on DingTalk QR
            if "钉钉" in body and "扫码" in body:
                key_btn = await page.query_selector('button[title*="账号"]')
                if not key_btn:
                    key_btn = await page.query_selector('button:has(svg)')
                if key_btn:
                    await key_btn.click()
                    await page.wait_for_timeout(1500)

            if "请输入" in body or "密码" in body or "登录" in body:
                user_input = await page.query_selector("#email, input[placeholder*='用户'], input[placeholder*='账号']")
                pwd_input = await page.query_selector("#pwd, input[type='password']")
                if user_input and pwd_input:
                    await user_input.fill("admin")
                    await pwd_input.fill("admin123")
                    login_btn = await page.query_selector('button:has-text("登录"), button:has-text("登")')
                    if login_btn:
                        await login_btn.click()
                        await page.wait_for_timeout(8000)
            await page.screenshot(path=SCREENSHOT_DIR / "s2_after_login.png", full_page=True)

            # Step 2: Navigate to build/apps
            print("Step 2: Navigating to apps...")
            await page.goto("https://yuanjing.noooyi.com/build/apps", wait_until="domcontentloaded", timeout=20000)
            await page.wait_for_timeout(4000)
            await page.screenshot(path=SCREENSHOT_DIR / "s3_apps_page.png", full_page=True)

            # Step 3: Click "新建应用" card to open template sheet
            print("Step 3: Opening create sheet...")
            await page.get_by_text("新建应用").first.click()
            await page.wait_for_timeout(2500)
            await page.screenshot(path=SCREENSHOT_DIR / "s4_create_sheet.png", full_page=True)

            # Ensure 工作流 is selected, then click "自定义工作流" to open CreateApp dialog
            await page.get_by_text("工作流", exact=True).first.click()
            await page.wait_for_timeout(800)
            await page.get_by_text("自定义工作流").first.click()
            await page.wait_for_timeout(2000)
            await page.screenshot(path=SCREENSHOT_DIR / "s5_create_dialog.png", full_page=True)

            # Step 4: Fill CreateApp dialog (name, desc)
            print("Step 4: Filling create dialog...")
            name_input = await page.query_selector('#name')
            desc_input = await page.query_selector('#desc')
            if name_input:
                await name_input.fill(WORKFLOW_NAME)
            if desc_input:
                await desc_input.fill(WORKFLOW_DESC)
            await page.wait_for_timeout(500)
            await page.screenshot(path=SCREENSHOT_DIR / "s6_filled_dialog.png", full_page=True)

            # Click create
            await page.locator('button:has-text("创建")').first.click()
            await page.wait_for_timeout(6000)
            await page.screenshot(path=SCREENSHOT_DIR / "s7_workflow_editor.png", full_page=True)

            # Step 5: Report
            final_url = page.url
            print("\n=== REPORT ===")
            print("Final URL:", final_url)

            body = await page.evaluate("() => document.body.innerText")
            if "start" in body.lower() or "节点" in body or "canvas" in body:
                print("Workflow editor: appears to be loaded")
            if "/flow/" in final_url:
                flow_id = final_url.split("/flow/")[-1].split("/")[0].split("?")[0]
                print("Workflow ID:", flow_id)

            # Extract visible node names if any
            nodes_text = await page.evaluate("""() => {
                const nodes = document.querySelectorAll('[class*="node"], [data-id]');
                return Array.from(nodes).slice(0, 15).map(n => n.textContent?.trim().slice(0, 50)).filter(Boolean);
            }""")
            print("Node-like elements:", nodes_text[:10] if nodes_text else "Could not detect")

            # Sidebar/panel text
            panel_text = await page.evaluate("""() => {
                const sidebars = document.querySelectorAll('[class*="sidebar"], [class*="panel"]');
                return sidebars.length ? sidebars[0].innerText?.slice(0, 500) : '';
            }""")
            print("Panel text preview:", panel_text[:300] if panel_text else "N/A")

        except Exception as e:
            print("ERROR:", e)
            await page.screenshot(path=SCREENSHOT_DIR / "s_error.png", full_page=True)
        finally:
            await browser.close()
            print("\nScreenshots saved to", SCREENSHOT_DIR)

asyncio.run(run())
