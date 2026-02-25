#!/usr/bin/env python3
"""
Browser test script for yuanjing.noooyi.com
Tests: Login, navigate to bench config, 联网搜索 settings gear, fill and save.
"""
import asyncio
import os
from pathlib import Path

from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout


BASE_URL = "https://yuanjing.noooyi.com"
SCREENSHOT_DIR = Path(__file__).parent / "test_screenshots"


async def main():
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    
    async with async_playwright() as p:
        # Use headed mode so we can see what happens (set HEADLESS=0 to run with UI)
        headless = os.environ.get("HEADLESS", "1") != "0"
        browser = await p.chromium.launch(headless=headless)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 900},
            locale="zh-CN",
        )
        page = await context.new_page()
        
        results = []
        
        try:
            # 1. Navigate to login page
            print("1. Navigating to login page...")
            await page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
            await page.screenshot(path=SCREENSHOT_DIR / "01_login_page.png", full_page=True)
            results.append("01_login_page: OK")
            
            # 2. Fill login form: user admin, password admin
            print("2. Attempting login (admin / admin)...")
            # Try common input selectors
            username_selectors = [
                '#email',
                'input[name="username"]',
                'input[placeholder*="用户"]',
                'input[placeholder*="账号"]',
                'input[type="text"]',
                'input[autocomplete="username"]',
            ]
            password_selectors = [
                '#pwd',
                'input[name="password"]',
                'input[type="password"]',
                'input[placeholder*="密码"]',
                'input[autocomplete="current-password"]',
            ]
            
            username_input = None
            for sel in username_selectors:
                try:
                    username_input = await page.wait_for_selector(sel, timeout=2000)
                    if username_input:
                        break
                except PlaywrightTimeout:
                    continue
            
            password_input = None
            for sel in password_selectors:
                try:
                    password_input = await page.wait_for_selector(sel, timeout=2000)
                    if password_input:
                        break
                except PlaywrightTimeout:
                    continue
            
            if username_input and password_input:
                await username_input.fill("admin")
                await password_input.fill("admin")
                await page.screenshot(path=SCREENSHOT_DIR / "02_login_filled.png", full_page=True)
                
                # Click login button - use IDs from login.tsx: #email, #pwd, and button with 登录
                login_btn = await page.query_selector('button:has-text("登录")')
                if login_btn:
                    await login_btn.click()
                else:
                    btn = await page.query_selector('button[type="submit"], form button')
                    if btn:
                        await btn.click()
                # Wait for navigation or network (login is async - encrypts pwd, then posts)
                await page.wait_for_timeout(5000)
                
                await page.wait_for_load_state("networkidle", timeout=10000)
                await page.screenshot(path=SCREENSHOT_DIR / "03_after_login.png", full_page=True)
                current_url = page.url
                if "login" in current_url or "请输入" in await page.content():
                    results.append("02_login: Stayed on login page (auth may have failed or credentials invalid)")
                else:
                    results.append("02_login: Appears to have navigated away (login may have succeeded)")
            else:
                results.append("02_login: Could not find username/password inputs")
                print("Could not find login inputs. Page content structure may differ.")
            
            # 3. Try to navigate to build/client (bench config)
            # The site may use /admin or /workspace as base - try both
            bench_paths = [
                "/admin/build/client",
                "/workspace/build/client",
                "/build/client",
            ]
            
            navigated = False
            for path in bench_paths:
                url = BASE_URL + path
                print(f"3. Trying to navigate to {url}...")
                await page.goto(url, wait_until="domcontentloaded", timeout=15000)
                await page.wait_for_timeout(2000)
                
                # Check if we're on the bench config page (look for 联网搜索 or 配置)
                content = await page.content()
                if "联网搜索" in content or "工作台" in content or "webSea" in content:
                    navigated = True
                    await page.screenshot(path=SCREENSHOT_DIR / "04_bench_page.png", full_page=True)
                    results.append(f"03_navigate: OK ({path})")
                    break
                
                # Maybe we hit login again - check
                if "登录" in content and "password" in content.lower():
                    results.append(f"03_navigate: Redirected to login at {path}")
                    break
                    
            if not navigated:
                await page.screenshot(path=SCREENSHOT_DIR / "04_bench_page.png", full_page=True)
                results.append("03_navigate: Page may have different structure")
            
            # 4. Look for 联网搜索 section and gear icon
            print("4. Looking for 联网搜索 section and settings gear...")
            gear_selectors = [
                'button:has(svg)',
                '[class*="Settings"]',
                'button[class*="ghost"]',
                'button:has-text("")',  # gear might be icon only
            ]
            
            # More specific: find the ToggleSection for 联网搜索, then the settings button
            web_search_section = await page.query_selector('text=联网搜索')
            if web_search_section:
                # Find the gear (Settings icon) - usually a sibling or within the section
                parent = await web_search_section.evaluate_handle("el => el.closest('div')")
                if parent:
                    gear_btn = await page.query_selector('button:has(svg.lucide-settings), button:has(svg[class*="lucide"])')
                    if not gear_btn:
                        # Try clicking any button near 联网搜索
                        buttons = await page.query_selector_all('button')
                        for btn in buttons:
                            box = await btn.bounding_box()
                            if box:
                                # Click the small gear-like button (usually next to the toggle)
                                await btn.click()
                                await page.wait_for_timeout(1500)
                                break
                else:
                    # Fallback: click first settings-looking button in the main content
                    gear_btn = await page.query_selector('div:has-text("联网搜索") >> .. >> button')
                    if gear_btn:
                        await gear_btn.click()
                        await page.wait_for_timeout(1500)
            else:
                # Try generic approach: find dialog trigger
                await page.evaluate("""() => {
                    const btns = document.querySelectorAll('button');
                    for (const b of btns) {
                        if (b.querySelector('svg') && b.closest('[class*="ToggleSection"]')) {
                            b.click();
                            return true;
                        }
                    }
                    return false;
                }""")
                await page.wait_for_timeout(1500)
            
            # 5. Take screenshot of dialog (or page state)
            await page.screenshot(path=SCREENSHOT_DIR / "05_websearch_dialog.png", full_page=True)
            results.append("04_gear_click: Attempted")
            
            # 6. Check if dialog opened - look for 联网搜索配置 or engine selector
            dialog = await page.query_selector('[role="dialog"], [class*="DialogContent"]')
            if dialog:
                dialog_visible = await dialog.is_visible()
                results.append("05_dialog: Opened" if dialog_visible else "05_dialog: Found but may not be visible")
                
                if dialog_visible:
                    # 7. Try to fill a test value - searXNG server_url doesn't require API key
                    print("6. Trying to fill test value...")
                    engine_select = await page.query_selector('select, [role="combobox"]')
                    if engine_select:
                        # Try selecting searXNG (no API key required for basic test)
                        await page.select_option('select', value='searXNG', timeout=3000)
                        await page.wait_for_timeout(500)
                    
                    server_url_input = await page.query_selector(
                        'input[name="server_url"], input[id*="searxng"], input[placeholder*="server"]'
                    )
                    if server_url_input:
                        await server_url_input.fill("https://test.example.com")
                        await page.screenshot(path=SCREENSHOT_DIR / "06_filled.png", full_page=True)
                        results.append("06_fill: Filled server_url with test value")
                        
                        # 8. Click save/confirm
                        confirm_btn = await page.query_selector(
                            'button:has-text("确认"), button:has-text("保存"), button[type="submit"]'
                        )
                        if confirm_btn:
                            await confirm_btn.click()
                            await page.wait_for_timeout(2000)
                            await page.screenshot(path=SCREENSHOT_DIR / "07_after_save.png", full_page=True)
                            
                            # Check for toast/error
                            toast_error = await page.query_selector('[class*="error"], [class*="Toast"][class*="error"]')
                            toast_success = await page.query_selector('[class*="success"]')
                            if toast_error and await toast_error.is_visible():
                                results.append("07_save: Error toast visible")
                            elif toast_success and await toast_success.is_visible():
                                results.append("07_save: Success toast visible")
                            else:
                                results.append("07_save: Clicked, check screenshot for result")
                        else:
                            results.append("07_save: Confirm button not found")
                    else:
                        # Bing is default - would need api_key and base_url
                        bing_key = await page.query_selector('input[name="api_key"], input#bing-api-key')
                        if bing_key:
                            await bing_key.fill("test-key-123")
                            await page.screenshot(path=SCREENSHOT_DIR / "06_filled.png", full_page=True)
                            results.append("06_fill: Filled api_key with test value (validation may fail)")
                        else:
                            results.append("06_fill: No suitable input found for test value")
            else:
                results.append("05_dialog: Not found - gear may not have opened dialog")
            
        except Exception as e:
            results.append(f"ERROR: {type(e).__name__}: {e}")
            await page.screenshot(path=SCREENSHOT_DIR / "99_error.png", full_page=True)
            print(f"Error: {e}")
        finally:
            await browser.close()
        
        # Report
        print("\n" + "=" * 60)
        print("TEST REPORT")
        print("=" * 60)
        for r in results:
            print(f"  {r}")
        print(f"\nScreenshots saved to: {SCREENSHOT_DIR}")


if __name__ == "__main__":
    asyncio.run(main())
