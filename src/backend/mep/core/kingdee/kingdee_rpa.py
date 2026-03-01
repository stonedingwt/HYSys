"""
Playwright-based RPA engine for Kingdee Cloud (金蝶云星空) K3Cloud.
Automates creation of 生产成本预算表 (Production Cost Budget).

K3Cloud page architecture (confirmed via browser testing):
  - Main page /k3cloud is a frameset, login form is in main frame
  - After login, main page URL stays /k3cloud
  - Dashboard loads in child iframe named 'childframename' at /k3cloud/html5/index.aspx
  - K3Cloud JS API (kd.open, etc.) is available in the dashboard frame
  - All UI elements have overlay div/span layers, need force=True for clicks
"""

import logging
import time
from typing import Optional, Callable

from playwright.sync_api import sync_playwright, Browser, Page, Playwright

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 30_000
NAV_TIMEOUT = 60_000


class KingdeeRPA:

    COST_BUDGET_FORM_ID = 'ecf46ce7-e1a4-45e6-ac1b-192e2b9e229e'

    def __init__(self, progress_callback: Optional[Callable] = None):
        self._pw: Optional[Playwright] = None
        self._browser: Optional[Browser] = None
        self._page: Optional[Page] = None
        self._progress: Optional[Callable] = progress_callback
        self._dashboard_frame = None

    @property
    def page(self) -> Page:
        if not self._page:
            raise RuntimeError('Browser not started')
        return self._page

    @property
    def ctx(self):
        """Active context: dashboard frame if available, else main page."""
        return self._dashboard_frame or self.page

    def _report(self, pct: int, msg: str):
        logger.info('[KingdeeRPA %d%%] %s', pct, msg)
        if self._progress:
            self._progress(pct, msg)

    # ──────────────────────── lifecycle ────────────────────────

    def start_browser(self, headless: bool = True):
        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch(
            headless=headless,
            args=['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        )
        browser_ctx = self._browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            locale='zh-CN',
        )
        browser_ctx.set_default_timeout(DEFAULT_TIMEOUT)
        self._page = browser_ctx.new_page()

    def close_browser(self):
        try:
            if self._browser:
                self._browser.close()
            if self._pw:
                self._pw.stop()
        except Exception:
            logger.warning('Error closing browser', exc_info=True)
        finally:
            self._browser = None
            self._pw = None
            self._page = None
            self._dashboard_frame = None

    def take_screenshot(self, label: str = 'step') -> Optional[bytes]:
        try:
            return self.page.screenshot(full_page=False)
        except Exception:
            return None

    # ──────────────────────── helpers ────────────────────────

    def _retry(self, fn, retries: int = 3, delay: float = 1.0):
        last_err = None
        for attempt in range(retries):
            try:
                return fn()
            except Exception as e:
                last_err = e
                logger.warning('Retry %d/%d failed: %s', attempt + 1, retries, e)
                self.page.wait_for_timeout(int(delay * 1000))
        raise last_err

    def _find_dashboard_frame(self):
        """Find the K3Cloud dashboard iframe (index.aspx or BOS_HtmlConsole)."""
        for frame in self.page.frames:
            url = frame.url or ''
            if url in ('', 'about:blank'):
                continue
            if 'index.aspx' in url or ('dform.aspx' in url and 'BOS_HtmlConsole' in url):
                return frame
        return None

    def _popup_select(self, trigger_locator, search_value: str):
        """Generic popup selector: click magnifier -> search -> double-click first result."""
        trigger_locator.click(force=True)
        self.page.wait_for_timeout(1500)

        popup = self.ctx.locator('.k-window:visible').last
        popup.wait_for(state='visible', timeout=10_000)

        search_input = popup.locator('input[type="text"]').first
        search_input.click()
        search_input.fill(search_value)
        search_input.press('Enter')
        self.page.wait_for_timeout(2000)

        first_row = popup.locator('.k-grid-content tbody tr').first
        first_row.wait_for(state='visible', timeout=10_000)
        first_row.dblclick()
        self.page.wait_for_timeout(1500)

    def _select_dropdown(self, field_name: str, option_text: str):
        ctx = self.ctx
        field = ctx.locator(f'[data-controlname="{field_name}"]')
        field.click(force=True)
        self.page.wait_for_timeout(500)
        option = ctx.locator(f'.k-list-container:visible .k-item:has-text("{option_text}")').first
        option.click(force=True)
        self.page.wait_for_timeout(500)

    def _fill_field(self, field_name: str, value: str):
        ctx = self.ctx
        field = ctx.locator(f'[data-controlname="{field_name}"] input').first
        field.click(force=True)
        field.fill('')
        field.fill(value)
        field.press('Tab')
        self.page.wait_for_timeout(300)

    def _click_button(self, text: str):
        """Click a toolbar button by text. K3Cloud toolbar uses various element types."""
        ctx = self.ctx
        # Try multiple strategies for finding toolbar buttons
        selectors = [
            f'.toolbar-item a:has-text("{text}")',
            f'a.toolbar-item-a:has-text("{text}")',
            f'.k-button:has-text("{text}")',
            f'.kdmenuitem-content:has-text("{text}")',
            f'span.k-link:has-text("{text}")',
        ]
        for sel in selectors:
            try:
                btn = ctx.locator(sel).first
                if btn.is_visible(timeout=2000):
                    btn.click(force=True)
                    self.page.wait_for_timeout(1000)
                    logger.info('Clicked button "%s" via %s', text, sel)
                    return
            except Exception:
                continue
        # JS fallback: find visible element with matching text, prefer <a> over <span>
        clicked = ctx.evaluate(f'''() => {{
            var els = document.querySelectorAll('a, span, button, .k-button, .kdmenuitem-content');
            var candidates = [];
            for (var i = 0; i < els.length; i++) {{
                var el = els[i];
                if (el.offsetParent === null) continue;
                var t = (el.textContent || '').trim();
                if (t === '{text}' || t.indexOf('{text}') === 0) {{
                    var r = el.getBoundingClientRect();
                    if (r.top > 60 && r.top < 120) {{
                        candidates.push({{tag: el.tagName, y: Math.round(r.top), cls: (el.className||'').substring(0,100), el: el}});
                    }}
                }}
            }}
            if (candidates.length === 0) return 'not found';
            // Prefer <A> over <SPAN> for better event handling
            var best = candidates[0];
            for (var c = 0; c < candidates.length; c++) {{
                if (candidates[c].tag === 'A') {{ best = candidates[c]; break; }}
            }}
            best.el.click();
            return 'clicked ' + best.tag + ' at y=' + best.y + ' cls=' + best.cls + ' (total_candidates=' + candidates.length + ')';
        }}''')
        logger.info('Button "%s" JS: %s', text, clicked)

    def _switch_tab(self, tab_name: str):
        ctx = self.ctx
        selectors = [
            f'.k-tabstrip .k-link:has-text("{tab_name}")',
            f'.k-tabstrip li:has-text("{tab_name}")',
        ]
        for sel in selectors:
            try:
                tab = ctx.locator(sel).first
                if tab.is_visible(timeout=3000):
                    tab.click(force=True)
                    self.page.wait_for_timeout(1000)
                    logger.info('Switched to tab: %s', tab_name)
                    return
            except Exception:
                continue
        # JS fallback
        ctx.evaluate(f'''() => {{
            var links = document.querySelectorAll('.k-tabstrip .k-link, .k-tabstrip li a, [role="tab"]');
            for (var i = 0; i < links.length; i++) {{
                if (links[i].textContent.trim().indexOf('{tab_name}') >= 0 && links[i].offsetParent !== null) {{
                    links[i].click();
                    return;
                }}
            }}
        }}''')
        self.page.wait_for_timeout(1000)
        logger.info('Switched to tab (JS): %s', tab_name)

    def _fill_grid_cell(self, row_idx: int, col_name: str, value: str):
        ctx = self.ctx
        try:
            row = ctx.locator('.k-grid:visible .k-grid-content tbody tr').nth(row_idx)
            cell = row.locator(f'td[data-field="{col_name}"]').first
            if not cell.is_visible(timeout=3000):
                cell = row.locator('td').nth(self._find_col_index(col_name))
            cell.dblclick(force=True)
            self.page.wait_for_timeout(500)
            active_input = ctx.locator(
                '.k-grid:visible .k-grid-content input:visible, '
                '.k-grid:visible .k-grid-content .k-input:visible'
            ).first
            active_input.fill('')
            active_input.fill(value)
            active_input.press('Tab')
            self.page.wait_for_timeout(300)
        except Exception as e:
            logger.warning('Failed to fill grid cell row=%d col=%s: %s', row_idx, col_name, e)

    def _find_col_index(self, col_name: str) -> int:
        ctx = self.ctx
        headers = ctx.locator('.k-grid:visible .k-grid-header th')
        count = headers.count()
        for i in range(count):
            text = headers.nth(i).inner_text().strip()
            if col_name in text:
                return i
        return 0

    def _select_grid_dropdown(self, row_idx: int, col_name: str, option_text: str):
        """Select a dropdown option in a grid cell using JS-based cell activation."""
        ctx = self.ctx
        for attempt in range(3):
            try:
                # Use JS to find the correct grid and activate the cell editor
                activate_result = ctx.evaluate(f'''() => {{
                    var rowIdx = {row_idx};
                    var colName = '{col_name}';
                    var grids = document.querySelectorAll('.k-grid');
                    var targetGrid = null;
                    for (var i = 0; i < grids.length; i++) {{
                        var ths = grids[i].querySelectorAll('.k-grid-header th');
                        for (var j = 0; j < ths.length; j++) {{
                            if (ths[j].getAttribute('data-field') === colName) {{
                                targetGrid = grids[i];
                                break;
                            }}
                        }}
                        if (targetGrid) break;
                    }}
                    if (!targetGrid) return {{ok: false, reason: 'grid_not_found'}};
                    var colIdx = -1;
                    var ths2 = targetGrid.querySelectorAll('.k-grid-header th');
                    for (var i = 0; i < ths2.length; i++) {{
                        if (ths2[i].getAttribute('data-field') === colName) {{ colIdx = i; break; }}
                    }}
                    if (colIdx < 0) return {{ok: false, reason: 'col_not_found'}};
                    var tbody = targetGrid.querySelector('.k-grid-content tbody');
                    if (!tbody) return {{ok: false, reason: 'tbody_not_found'}};
                    var rows = tbody.querySelectorAll('tr');
                    if (rowIdx >= rows.length) return {{ok: false, reason: 'row_out_of_range', rows: rows.length}};
                    var row = rows[rowIdx];
                    var cells = row.querySelectorAll('td');
                    if (colIdx >= cells.length) return {{ok: false, reason: 'cell_out_of_range', cells: cells.length}};
                    var cell = cells[colIdx];
                    var cellText = (cell.textContent || '').trim();
                    var cellHtml = cell.innerHTML.substring(0, 200);
                    var r = cell.getBoundingClientRect();
                    return {{ok: true, colIdx: colIdx, cellText: cellText, cellHtml: cellHtml, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height)}};
                }}''')
                logger.info('Grid cell info row=%d col=%s: %s', row_idx, col_name, activate_result)

                if not activate_result.get('ok'):
                    logger.warning('Cannot find grid cell: %s', activate_result)
                    return

                # Activate cell editor via JS dispatched events + K3Cloud grid API
                col_idx = activate_result['colIdx']
                popup_state = ctx.evaluate(f'''() => {{
                    var rowIdx = {row_idx};
                    var colIdx = {col_idx};
                    var colName = '{col_name}';

                    // Find the grid containing FOTHERTYPE
                    var grids = document.querySelectorAll('.k-grid');
                    var targetGrid = null;
                    for (var i = 0; i < grids.length; i++) {{
                        var ths = grids[i].querySelectorAll('.k-grid-header th');
                        for (var j = 0; j < ths.length; j++) {{
                            if (ths[j].getAttribute('data-field') === colName) {{
                                targetGrid = grids[i];
                                break;
                            }}
                        }}
                        if (targetGrid) break;
                    }}
                    if (!targetGrid) return {{method: 'none', reason: 'grid_not_found'}};

                    // Find the cell span
                    var cellSpan = targetGrid.querySelector('span[data-field="' + colName + '"][data-rowid="' + rowIdx + '"]');
                    if (!cellSpan) return {{method: 'none', reason: 'cellspan_not_found'}};
                    var cell = cellSpan.closest('td');
                    if (!cell) cell = cellSpan;

                    // Method 1: Dispatch mouse events on the cell span
                    var evts = ['mousedown', 'mouseup', 'click', 'mousedown', 'mouseup', 'click', 'dblclick'];
                    for (var e = 0; e < evts.length; e++) {{
                        cell.dispatchEvent(new MouseEvent(evts[e], {{bubbles: true, cancelable: true, view: window}}));
                    }}

                    // Wait a moment and check
                    var editCell = document.querySelector('.k-edit-cell');
                    if (editCell) return {{method: 'dispatch_events', editCell: true}};

                    // Method 2: Try using Kendo Grid API
                    try {{
                        var $grid = $(targetGrid).data('kendoGrid');
                        if ($grid) {{
                            var row2 = $grid.tbody.find('tr').eq(rowIdx);
                            var cell2 = row2.find('td').eq(colIdx);
                            $grid.current(cell2);
                            $grid.editCell(cell2);
                            return {{method: 'kendo_editCell'}};
                        }}
                    }} catch(e) {{
                        return {{method: 'kendo_failed', error: e.message}};
                    }}

                    return {{method: 'none', reason: 'no_method_worked'}};
                }}''')
                logger.info('Cell activation result row=%d: %s', row_idx, popup_state)
                self.page.wait_for_timeout(1500)

                # Check what appeared after activation
                after_state = ctx.evaluate('''() => {
                    var popups = [];
                    var els = document.querySelectorAll('.k-list-container, .k-popup, .k-animation-container, .k-list');
                    for (var i = 0; i < els.length; i++) {
                        var p = els[i];
                        if (p.offsetParent === null) continue;
                        var r = p.getBoundingClientRect();
                        if (r.width < 5) continue;
                        var items = [];
                        var lis = p.querySelectorAll('.k-item, li');
                        for (var j = 0; j < Math.min(lis.length, 15); j++) {
                            items.push(lis[j].textContent.trim().substring(0, 40));
                        }
                        popups.push({items: items, w: Math.round(r.width), h: Math.round(r.height)});
                    }
                    var editCell = document.querySelector('.k-edit-cell');
                    var editInfo = null;
                    if (editCell) {
                        var inp = editCell.querySelector('input, select, .k-dropdown-wrap, .k-widget');
                        editInfo = {tag: inp ? inp.tagName : 'none', cls: inp ? (inp.className||'').substring(0,80) : '', html: editCell.innerHTML.substring(0,200)};
                    }
                    return {popups: popups, editCell: editInfo};
                }''')
                logger.info('After cell interaction row=%d: %s', row_idx, popup_state)

                # Try to find and click the option in any visible popup
                option = ctx.locator(
                    f'.k-list-container:visible .k-item:has-text("{option_text}"), '
                    f'.k-popup:visible .k-item:has-text("{option_text}"), '
                    f'.k-animation-container:visible .k-item:has-text("{option_text}")'
                ).first
                option.wait_for(state='visible', timeout=5000)
                option.click(force=True)
                self.page.wait_for_timeout(500)
                return
            except Exception as e:
                logger.warning('_select_grid_dropdown attempt %d failed (row=%d, col=%s, text=%s): %s',
                               attempt + 1, row_idx, col_name, option_text, e)
                self.page.keyboard.press('Escape')
                self.page.wait_for_timeout(500)
        logger.error('_select_grid_dropdown gave up after 3 attempts: row=%d col=%s text=%s',
                     row_idx, col_name, option_text)

    # ──────────────────────── step 1: login ────────────────────────

    def _is_dashboard_loaded(self) -> bool:
        """Check if dashboard is loaded - either main page URL or child frame."""
        current = self.page.url or ''
        if 'index.aspx' in current or 'BOS_HtmlConsole' in current:
            return True
        for frame in self.page.frames:
            furl = frame.url or ''
            if furl in ('', 'about:blank'):
                continue
            if 'index.aspx' in furl or 'BOS_HtmlConsole' in furl:
                return True
        return False

    def login(self, url: str, account_set: str, username: str, password: str):
        self._report(5, '正在打开金蝶云星空登录页...')
        self.page.goto(url, wait_until='domcontentloaded', timeout=NAV_TIMEOUT)
        self.page.wait_for_timeout(5000)

        self._report(8, '输入账号密码...')
        user_input = self.page.locator(
            'input[placeholder="用户名"], input[placeholder*="用户"], #txtUser'
        ).first
        user_input.fill(username)

        pwd_input = self.page.locator(
            'input[placeholder="密码"], input[type="password"], #txtPwd'
        ).first
        pwd_input.fill(password)

        self._report(9, '提交登录...')
        pwd_input.press('Enter')
        self.page.wait_for_timeout(5000)

        self._handle_login_dialogs()
        self.page.wait_for_timeout(3000)

        if not self._is_dashboard_loaded():
            logger.info('Enter key did not trigger login, trying button click...')
            try:
                login_btn = self.page.locator('#btnLogin').first
                if login_btn.is_visible(timeout=3000):
                    login_btn.click(force=True)
                    self.page.wait_for_timeout(5000)
                    self._handle_login_dialogs()
                    self.page.wait_for_timeout(3000)
            except Exception as e:
                logger.info('Button click fallback failed: %s', e)

        for attempt in range(20):
            if self._is_dashboard_loaded():
                self._dashboard_frame = self._find_dashboard_frame()
                logger.info('Login success - page URL: %s', self.page.url[:100])
                self.page.wait_for_timeout(3000)
                self._report(10, '登录成功')
                return
            self._handle_login_dialogs()
            self.page.wait_for_timeout(2000)

        logger.warning('Dashboard not loaded after login, page URL: %s', self.page.url[:100])
        for f in self.page.frames:
            logger.warning('  Frame: name=%s url=%s', f.name, f.url[:100] if f.url else 'N/A')
        self._save_debug_screenshot('login_failed')
        raise RuntimeError('登录失败：未能检测到仪表盘加载')

    def _handle_login_dialogs(self):
        """Handle dialogs that may appear during login (session conflict, errors, etc.)."""
        dialog_selectors = [
            'button:has-text("确认")',
            'button:has-text("确定")',
            '.k-button:has-text("确认")',
            '.k-button:has-text("确定")',
            '#btnConfirm',
        ]
        for sel in dialog_selectors:
            try:
                btn = self.page.locator(sel).first
                if btn.is_visible(timeout=1000):
                    logger.info('Clicking dialog button: %s', sel)
                    btn.click(force=True)
                    self.page.wait_for_timeout(2000)
                    return
            except Exception:
                continue

    # ──────────────────────── step 2: navigate ────────────────────────

    def _find_form_frame(self, form_id: str = None):
        """Find any frame containing the specified form ID in its URL."""
        target = form_id or self.COST_BUDGET_FORM_ID
        for frame in self.page.frames:
            furl = frame.url or ''
            if target in furl:
                return frame
        return None

    def _get_base_url(self) -> str:
        from urllib.parse import urlparse
        for source in [self._find_dashboard_frame(), self.page]:
            url = (source.url if source else '') or ''
            if url and 'about:blank' not in url:
                parsed = urlparse(url)
                if parsed.netloc:
                    return f'{parsed.scheme}://{parsed.netloc}'
        return ''

    def open_cost_budget_form(self):
        self._report(12, '打开生产成本预算表列表页...')
        self.page.wait_for_timeout(5000)
        self._handle_login_dialogs()
        self._save_debug_screenshot('dashboard')

        opened = False

        if not opened:
            opened = self._try_playwright_search()

        if not opened:
            opened = self._try_menu_navigation()

        if not opened:
            opened = self._try_js_frame_navigation()

        self.page.wait_for_timeout(3000)
        self._save_debug_screenshot('after_navigation')

        for frame in self.page.frames:
            furl = frame.url or ''
            if furl and 'about:blank' not in furl:
                logger.info('Frame after nav: name=%s url=%s', frame.name, furl[:120])

        form_frame = self._find_form_frame()
        if form_frame:
            self._dashboard_frame = form_frame
            logger.info('Form frame found: %s', form_frame.url[:120])
        else:
            self._dashboard_frame = self._find_dashboard_frame()
            logger.info('Form frame not found, using dashboard')

        self._report(15, '列表页已打开，点击新增...')
        self._click_add_button()
        self._wait_for_edit_form()
        self._report(20, '新增页面已打开')

    def _wait_for_edit_form(self):
        """Wait for the form editing page to load after clicking 新增, and set ctx."""
        self.page.wait_for_timeout(8000)
        self._save_debug_screenshot('after_add_click')

        for frame in self.page.frames:
            furl = frame.url or ''
            if furl and 'about:blank' not in furl:
                logger.info('Frame after add: name=%s url=%s', frame.name, furl[:120])

        # Wait for K3Cloud form page to fully render by checking for known label text.
        # K3Cloud renders form fields as complex Kendo UI widgets - we detect by visible labels.
        for attempt in range(15):
            for frame in self.page.frames:
                try:
                    has_form = frame.evaluate('''() => {
                        // Check for form-specific labels that only appear on the edit page
                        var labels = ['厂款号', 'BOM版本', '订单类型', '报价数量'];
                        var found = 0;
                        var all = document.querySelectorAll('*');
                        for (var i = 0; i < all.length; i++) {
                            var t = (all[i].textContent || '').trim();
                            for (var j = 0; j < labels.length; j++) {
                                if (t === labels[j] && all[i].offsetParent !== null) {
                                    found++;
                                    break;
                                }
                            }
                            if (found >= 2) return {ready: true, found: found};
                        }
                        // Also check for data-ctlid (K3Cloud form control ID)
                        var ctls = document.querySelectorAll('[data-ctlid]');
                        if (ctls.length > 5) {
                            var names = [];
                            for (var i = 0; i < Math.min(ctls.length, 10); i++) {
                                names.push(ctls[i].getAttribute('data-ctlid'));
                            }
                            return {ready: true, found: found, ctlids: ctls.length, sample: names};
                        }
                        return null;
                    }''')
                    if has_form:
                        logger.info('Form ready: %s', has_form)
                        self._dashboard_frame = frame
                        return
                except Exception:
                    continue
            self.page.wait_for_timeout(2000)

        # Fallback - use main frame anyway
        logger.info('Form labels not detected, using main frame')
        self._dashboard_frame = self._find_dashboard_frame() or self.page.main_frame

    def _try_playwright_search(self) -> bool:
        """Use Playwright native actions for search with multiple interaction strategies."""
        self._report(13, '通过搜索打开表单...')

        # Step 1: Hover then click the search trigger (class=kd-mouseover-el)
        trigger_clicked = False
        try:
            trigger = self.page.locator('.kdfullsearchExtend, .kd-fullsearch-extend').first
            if trigger.is_visible(timeout=3000):
                trigger.hover(force=True)
                self.page.wait_for_timeout(500)
                trigger.click(force=True)
                trigger_clicked = True
                logger.info('Search trigger hovered + clicked')
                self.page.wait_for_timeout(3000)
        except Exception as e:
            logger.info('Search trigger hover+click: %s', e)

        if not trigger_clicked:
            try:
                self.page.evaluate('''() => {
                    var el = document.querySelector('.kdfullsearchExtend, .kd-fullsearch-extend');
                    if (el) {
                        el.dispatchEvent(new MouseEvent('mouseenter', {bubbles: true}));
                        el.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
                        setTimeout(function() { el.click(); }, 500);
                    }
                }''')
                self.page.wait_for_timeout(3000)
                trigger_clicked = True
                logger.info('Search trigger clicked via JS hover+click')
            except Exception:
                pass

        if not trigger_clicked:
            logger.info('Search trigger not found')
            return False

        self._save_debug_screenshot('after_trigger')

        # Step 2: Force search input visible and capture its state
        input_state = self.page.evaluate('''() => {
            var selectors = ['.kd-appplat-searchinput', 'input[placeholder*="搜索"]', 'input[placeholder*="查找"]'];
            for (var s = 0; s < selectors.length; s++) {
                var el = document.querySelector(selectors[s]);
                if (el) {
                    el.style.display = 'block';
                    el.style.visibility = 'visible';
                    el.style.opacity = '1';
                    el.style.position = 'relative';
                    el.style.zIndex = '99999';
                    el.removeAttribute('disabled');
                    el.removeAttribute('readonly');
                    // Also show parent containers
                    var parent = el.parentElement;
                    for (var p = 0; p < 5 && parent; p++) {
                        parent.style.display = parent.style.display === 'none' ? 'block' : parent.style.display;
                        parent.style.visibility = 'visible';
                        parent.style.opacity = '1';
                        parent = parent.parentElement;
                    }
                    var rect = el.getBoundingClientRect();
                    return {found: true, sel: selectors[s], rect: {x: rect.x, y: rect.y, w: rect.width, h: rect.height}};
                }
            }
            return {found: false};
        }''')
        logger.info('Search input state: %s', input_state)

        if not input_state.get('found'):
            logger.info('No search input found in DOM')
            return False

        sel = input_state['sel']
        search_input = self.page.locator(sel).first

        # Step 3: Click to focus, then type using keyboard.type (character-by-character, triggers all events)
        try:
            search_input.click(force=True)
            self.page.wait_for_timeout(300)
            # Clear any existing text
            self.page.keyboard.press('Control+A')
            self.page.keyboard.press('Backspace')
            self.page.wait_for_timeout(200)
            # Type character by character to trigger autocomplete/search events
            self.page.keyboard.type('生产成本预算表', delay=100)
            logger.info('Search term typed via keyboard.type')
            self.page.wait_for_timeout(2000)
        except Exception as e:
            logger.info('keyboard.type failed: %s, trying fill', e)
            try:
                search_input.fill('生产成本预算表')
                self.page.wait_for_timeout(1000)
            except Exception as e2:
                logger.info('fill also failed: %s', e2)
                return False

        # Take screenshot to see if autocomplete appeared during typing
        self._save_debug_screenshot('after_type')

        # Step 4: Press Enter to submit search
        self.page.keyboard.press('Enter')
        logger.info('Enter pressed via page.keyboard')
        self.page.wait_for_timeout(5000)

        # Also try clicking the search button
        try:
            self.page.evaluate('''() => {
                var btn = document.querySelector('.kd-fullsearch-btn-searcharticle, .kd-fullsearch-btn');
                if (btn) {
                    btn.style.display = 'block';
                    btn.style.visibility = 'visible';
                    btn.click();
                    return 'clicked';
                }
                return 'not found';
            }''')
        except Exception:
            pass
        self.page.wait_for_timeout(3000)

        self._save_debug_screenshot('search_results')

        # DOM diagnostics after search
        dom_after = self.page.evaluate('''() => {
            var info = {visible: [], popups: [], page_changed: false};
            // Check if URL or page content changed
            info.url = window.location.href;
            // Find any visible elements with cost/budget text
            var all = document.querySelectorAll('*');
            for (var i = 0; i < all.length; i++) {
                var t = (all[i].textContent || '').trim();
                if ((t.indexOf('预算') >= 0 || t.indexOf('成本') >= 0) && t.length < 80) {
                    if (all[i].offsetParent !== null && all[i].children.length < 3) {
                        info.visible.push({
                            tag: all[i].tagName,
                            cls: (all[i].className || '').substring(0, 50),
                            text: t.substring(0, 60)
                        });
                    }
                }
            }
            // Check for popups/overlays/result containers
            var popupSels = '.k-window, [class*="popup"], [class*="dropdown"], [class*="result"], [class*="suggest"], [class*="search-result"], [class*="searchresult"]';
            document.querySelectorAll(popupSels).forEach(function(el) {
                if (el.offsetParent !== null && (el.innerHTML || '').length > 10) {
                    info.popups.push({
                        tag: el.tagName,
                        cls: (el.className || '').substring(0, 60),
                        len: (el.innerHTML || '').length,
                        text: (el.textContent || '').substring(0, 120).trim()
                    });
                }
            });
            return info;
        }''')
        logger.info('After search URL: %s', dom_after.get('url', '')[:100])
        for el in dom_after.get('visible', [])[:10]:
            logger.info('  Visible [%s.%s]: %s', el.get('tag'), el.get('cls', '')[:30], el.get('text'))
        for popup in dom_after.get('popups', [])[:5]:
            logger.info('  Popup [%s.%s] len=%d: %s', popup.get('tag'), popup.get('cls', '')[:30],
                        popup.get('len', 0), popup.get('text', '')[:80])

        # Step 5: Try to find and click search results
        for wait_round in range(3):
            for sel in [
                '.kd-fullsearch-resultitem:has-text("生产成本预算")',
                '.kd-fullsearch-result li:has-text("生产成本预算")',
                'li:has-text("生产成本预算表")',
                'a:has-text("生产成本预算表")',
                'span:has-text("生产成本预算表")',
            ]:
                try:
                    items = self.page.locator(sel)
                    count = items.count()
                    if count > 0:
                        for i in range(min(count, 5)):
                            item = items.nth(i)
                            try:
                                text = item.inner_text(timeout=1000)
                                if '生产成本预算' in text and len(text) < 200:
                                    item.click(force=True)
                                    logger.info('Clicked search result [%s]: %s', sel, text[:60])
                                    self.page.wait_for_timeout(5000)
                                    # Close search dropdown by pressing Escape and clicking body
                                    self.page.keyboard.press('Escape')
                                    self.page.wait_for_timeout(1000)
                                    self.page.mouse.click(500, 400)
                                    self.page.wait_for_timeout(2000)
                                    return True
                            except Exception:
                                continue
                except Exception:
                    continue
            if wait_round < 2:
                self.page.wait_for_timeout(2000)

        logger.info('Playwright search: no matching results found')
        return False

    def _try_menu_navigation(self) -> bool:
        """Navigate via K3Cloud left sidebar menu tree."""
        self._report(14, '尝试菜单导航...')

        # Dump the menu/sidebar structure
        menu_info = self.page.evaluate('''() => {
            var info = {menus: [], tree_items: [], links: []};
            // Look for K3Cloud menu containers
            var menuSels = '.kd-applist, .k-treeview, .k-panelbar, [class*="menu-tree"], [class*="sidebar"], [class*="nav-tree"]';
            document.querySelectorAll(menuSels).forEach(function(el) {
                if (el.offsetParent !== null) {
                    info.menus.push({
                        tag: el.tagName,
                        cls: (el.className || '').substring(0, 60),
                        childCount: el.children.length,
                        text: (el.textContent || '').substring(0, 200).trim()
                    });
                }
            });
            // Look for tree items / expandable nodes
            document.querySelectorAll('.k-item, .k-treeview-item, [class*="menu-item"], [class*="nav-item"]').forEach(function(el) {
                var t = (el.textContent || '').trim();
                if (t.length < 80 && el.offsetParent !== null) {
                    info.tree_items.push({
                        tag: el.tagName, cls: (el.className || '').substring(0, 50), text: t
                    });
                }
            });
            // Look for links with relevant text
            document.querySelectorAll('a, [role="link"], [data-formid]').forEach(function(el) {
                var t = (el.textContent || '').trim();
                if (t.length < 60 && t.length > 0 && el.offsetParent !== null) {
                    info.links.push({
                        tag: el.tagName, cls: (el.className || '').substring(0, 50),
                        text: t, href: (el.href || el.getAttribute('data-formid') || '').substring(0, 60)
                    });
                }
            });
            return info;
        }''')
        logger.info('Menu structure - menus: %d, tree_items: %d, links: %d',
                     len(menu_info.get('menus', [])),
                     len(menu_info.get('tree_items', [])),
                     len(menu_info.get('links', [])))
        for m in menu_info.get('menus', [])[:3]:
            logger.info('  Menu [%s.%s] children=%d: %s', m.get('tag'), m.get('cls', '')[:30],
                        m.get('childCount', 0), m.get('text', '')[:80])
        for item in menu_info.get('tree_items', [])[:10]:
            logger.info('  TreeItem [%s.%s]: %s', item.get('tag'), item.get('cls', '')[:30], item.get('text'))
        for link in menu_info.get('links', [])[:10]:
            logger.info('  Link [%s.%s]: %s -> %s', link.get('tag'), link.get('cls', '')[:30],
                        link.get('text'), link.get('href', ''))

        # Try to find and click menu items with cost budget text
        try:
            for text_pattern in ['生产成本预算', '成本预算', '预算']:
                items = self.page.locator(f':has-text("{text_pattern}")').all()
                for item in items:
                    try:
                        text = item.inner_text(timeout=500)
                        if text_pattern in text and len(text) < 60:
                            tag = item.evaluate('el => el.tagName')
                            if tag in ('A', 'LI', 'SPAN', 'DIV'):
                                item.click(force=True)
                                logger.info('Clicked menu item: %s (%s)', text[:40], tag)
                                self.page.wait_for_timeout(5000)
                                if self._find_form_frame():
                                    return True
                    except Exception:
                        continue
        except Exception as e:
            logger.info('Menu item search error: %s', e)

        logger.info('Menu navigation: no matching items found')
        return False

    def _try_js_frame_navigation(self) -> bool:
        """Try kd.open or similar K3Cloud JS APIs from within each frame."""
        self._report(14, '尝试JS API导航...')
        form_id = self.COST_BUDGET_FORM_ID

        for frame in self.page.frames:
            furl = frame.url or ''
            if not furl or 'about:blank' in furl:
                continue
            try:
                result = frame.evaluate(f'''() => {{
                    if (typeof kd !== 'undefined' && kd && kd.open) {{
                        kd.open('{form_id}');
                        return 'kd.open called';
                    }}
                    if (typeof KDPageManager !== 'undefined' && KDPageManager.openPage) {{
                        KDPageManager.openPage('{form_id}');
                        return 'KDPageManager called';
                    }}
                    if (typeof window.openMenuNode === 'function') {{
                        window.openMenuNode('{form_id}');
                        return 'openMenuNode called';
                    }}
                    return 'no API';
                }}''')
                logger.info('JS nav in frame [%s]: %s', furl[:60], result)
                if 'called' in str(result):
                    self.page.wait_for_timeout(5000)
                    if self._find_form_frame():
                        return True
            except Exception:
                continue

        return False

    def _click_add_button(self):
        """Find and click the toolbar 新增 button."""
        # First, diagnose all elements containing "新增"
        for frame in self.page.frames:
            try:
                diag = frame.evaluate('''() => {
                    var results = [];
                    var all = document.querySelectorAll('a, button, span, .k-button, [class*="toolbar"]');
                    for (var i = 0; i < all.length; i++) {
                        var t = (all[i].textContent || '').trim();
                        if (t.indexOf('新增') >= 0 && t.length < 30) {
                            var rect = all[i].getBoundingClientRect();
                            results.push({
                                tag: all[i].tagName,
                                cls: (all[i].className || '').substring(0, 50),
                                text: t,
                                y: Math.round(rect.top),
                                x: Math.round(rect.left),
                                w: Math.round(rect.width),
                                h: Math.round(rect.height),
                                visible: all[i].offsetParent !== null
                            });
                        }
                    }
                    return results;
                }''')
                for item in diag[:8]:
                    logger.info('  新增 candidate: tag=%s cls=%s text="%s" y=%d x=%d w=%d visible=%s',
                                item.get('tag'), item.get('cls', '')[:30], item.get('text'),
                                item.get('y', 0), item.get('x', 0), item.get('w', 0), item.get('visible'))
            except Exception:
                continue

        # Strategy 1: Playwright locator for toolbar buttons
        for frame in self.page.frames:
            for sel in [
                '.toolbar-item a:has-text("新增")',
                'a.toolbar-item-a:has-text("新增")',
                'a:has-text("新增")',
            ]:
                try:
                    btns = frame.locator(sel)
                    count = btns.count()
                    for i in range(count):
                        btn = btns.nth(i)
                        try:
                            if btn.is_visible(timeout=1000):
                                text = btn.inner_text(timeout=500)
                                if len(text) < 30:
                                    logger.info('Clicking 新增 via Playwright [%s]: "%s"', sel, text)
                                    btn.click(force=True)
                                    return
                        except Exception:
                            continue
                except Exception:
                    continue

        # Strategy 2: JS click - find by position and text content
        for frame in self.page.frames:
            try:
                clicked = frame.evaluate('''() => {
                    var els = document.querySelectorAll('a, button, span, .k-button');
                    var candidates = [];
                    for (var i = 0; i < els.length; i++) {
                        var t = (els[i].textContent || '').trim();
                        if (t.indexOf('新增') >= 0 && t.length < 20 && els[i].offsetParent !== null) {
                            var rect = els[i].getBoundingClientRect();
                            if (rect.width > 5 && rect.height > 5) {
                                candidates.push({el: els[i], tag: els[i].tagName, y: rect.top, text: t});
                            }
                        }
                    }
                    // Sort by y position (top-most first, as toolbar is at the top)
                    candidates.sort(function(a, b) { return a.y - b.y; });
                    // Click the first candidate (closest to top = toolbar)
                    if (candidates.length > 0) {
                        candidates[0].el.click();
                        return 'clicked: ' + candidates[0].tag + ' at y=' + Math.round(candidates[0].y) + ' text=' + candidates[0].text;
                    }
                    return 'not found';
                }''')
                if 'clicked' in str(clicked):
                    logger.info('新增: %s', clicked)
                    return
            except Exception:
                continue

        raise RuntimeError('无法找到"新增"按钮')

    def _refresh_dashboard_frame(self):
        """Re-detect the dashboard frame (may change after navigation)."""
        form_frame = self._find_form_frame()
        self._dashboard_frame = form_frame or self._find_dashboard_frame()

    # ──────────────────────── step 3: fill header ────────────────────────

    def _discover_form_fields(self):
        """Discover form fields by scanning for Kendo UI widgets and their labels."""
        ctx = self.ctx
        fields = ctx.evaluate('''() => {
            var result = {};
            // Scan for K3Cloud field labels and their adjacent inputs
            var labels = document.querySelectorAll('label, span.title, span.kd-title, ' +
                '[class*="label"], [class*="title"], [class*="caption"]');
            for (var i = 0; i < labels.length; i++) {
                var el = labels[i];
                if (el.offsetParent === null) continue;
                var text = (el.textContent || '').trim();
                if (text.length < 1 || text.length > 10) continue;
                var rect = el.getBoundingClientRect();
                if (rect.top < 60 || rect.top > 600) continue;

                // Look for adjacent input/select/widget
                var parent = el.parentElement;
                for (var p = 0; p < 3 && parent; p++) {
                    var inputs = parent.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]), ' +
                        'select, .k-widget, .k-input');
                    if (inputs.length > 0) {
                        var ctlid = '';
                        for (var pp = parent; pp && !ctlid; pp = pp.parentElement) {
                            ctlid = pp.getAttribute && pp.getAttribute('data-ctlid') || '';
                        }
                        result[text] = {
                            y: Math.round(rect.top), x: Math.round(rect.left),
                            ctlid: ctlid || '',
                            inputTag: inputs[0].tagName,
                            inputCls: (inputs[0].className || '').substring(0, 40)
                        };
                        break;
                    }
                    parent = parent.parentElement;
                }
            }
            return result;
        }''')
        for name, info in sorted(fields.items(), key=lambda x: (x[1].get('y', 0), x[1].get('x', 0))):
            logger.info('  FormField: "%s" -> ctlid=%s y=%d x=%d input=%s.%s',
                        name, info.get('ctlid', ''), info.get('y', 0), info.get('x', 0),
                        info.get('inputTag', ''), info.get('inputCls', '')[:30])
        return fields

    def fill_header(self, data: dict):
        ctx = self.ctx

        self._report(21, '分析表单字段结构...')
        field_map = self._discover_form_fields()
        logger.info('Discovered %d visible header fields', len(field_map))

        self._report(22, '填写厂款号...')
        self._fill_by_label('厂款号', data['factory_article_no'])

        self._report(25, f'选择订单类型: {data["order_type"]}')
        self._fill_by_label('订单类型', data['order_type'])

        if data.get('currency'):
            self._report(26, f'设置报价币别: {data["currency"]}')
            self._fill_by_label('报价币别', data['currency'])

        self._report(27, f'设置核价日期: {data["pricing_date"]}')
        self._fill_by_label('核价日期', data['pricing_date'])

        self._report(30, f'设置报价日期: {data["quote_date"]}')
        self._fill_by_label('报价日期', data['quote_date'])

        self._report(31, f'填写报价数量: {data["quote_quantity"]}')
        self._fill_by_label('报价数量', str(data['quote_quantity']))

        self._report(33, '选择客户...')
        self._fill_by_label('客户', data.get('customer', ''))

        if data.get('brand'):
            self._report(34, f'选择品牌: {data["brand"]}')
            self._fill_by_label('品牌', data['brand'])

        if data.get('quote_size'):
            self._report(35, f'填写报价尺码: {data["quote_size"]}')
            self._fill_by_label('报价尺码', str(data['quote_size']))

        if data.get('product_family'):
            self._report(36, f'选择产品族: {data["product_family"]}')
            self._fill_by_label('产品族', data['product_family'])

        if data.get('production_location'):
            self._report(37, f'选择预计生产地: {data["production_location"]}')
            self._fill_by_label('预计生产地', data['production_location'])

        if data.get('bom_version'):
            self._report(38, f'选择BOM版本: {data["bom_version"]}')
            self._fill_by_label('BOM版本', data['bom_version'])

        if data.get('season'):
            self._report(38, f'选择季节: {data["season"]}')
            self._fill_by_label('季节', data['season'])

        self._report(39, f'选择报价类型: {data["quote_type"]}')
        self._fill_by_label('报价类型', data['quote_type'])

        self._save_debug_screenshot('after_fill_header')
        self._report(40, '表头填写完成')

    def _find_label_widget(self, label_text: str) -> dict | None:
        """Find a Kendo widget near a visible label using JS. Returns widget info dict."""
        ctx = self.ctx
        result = ctx.evaluate('''(labelText) => {
            var allEls = document.querySelectorAll('*');
            var labelEl = null;
            for (var i = 0; i < allEls.length; i++) {
                var el = allEls[i];
                if (el.offsetParent === null) continue;
                var children = el.childNodes;
                var directText = '';
                for (var c = 0; c < children.length; c++) {
                    if (children[c].nodeType === 3) directText += children[c].textContent;
                }
                if (directText.trim() === labelText) { labelEl = el; break; }
            }
            if (!labelEl) {
                for (var i = 0; i < allEls.length; i++) {
                    var el = allEls[i];
                    if (el.offsetParent === null) continue;
                    if (el.textContent.trim() === labelText && el.children.length === 0) {
                        labelEl = el; break;
                    }
                }
            }
            if (!labelEl) return {error: 'label not found'};

            var rect = labelEl.getBoundingClientRect();
            var parent = labelEl.parentElement;
            for (var p = 0; p < 5 && parent; p++) {
                // Check for Kendo widgets
                var widgets = parent.querySelectorAll('.k-widget');
                for (var j = 0; j < widgets.length; j++) {
                    var w = widgets[j];
                    if (w.offsetParent === null) continue;
                    var wr = w.getBoundingClientRect();
                    var cls = w.className || '';
                    var wtype = 'unknown';
                    if (cls.indexOf('k-dropdown') >= 0) wtype = 'dropdown';
                    else if (cls.indexOf('k-datepicker') >= 0 || cls.indexOf('k-datetimepicker') >= 0) wtype = 'datepicker';
                    else if (cls.indexOf('kd-popListEd') >= 0) wtype = 'poplist';
                    else if (cls.indexOf('k-combobox') >= 0) wtype = 'combobox';
                    else if (cls.indexOf('k-numerictextbox') >= 0) wtype = 'numeric';
                    return {
                        wtype: wtype, cls: cls.substring(0, 60),
                        y: Math.round(wr.top), x: Math.round(wr.left),
                        w: Math.round(wr.width), h: Math.round(wr.height),
                        labelY: Math.round(rect.top), labelX: Math.round(rect.left)
                    };
                }
                // Check for raw inputs
                var inputs = parent.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"])');
                for (var j = 0; j < inputs.length; j++) {
                    var inp = inputs[j];
                    if (inp.offsetParent !== null) {
                        var ir = inp.getBoundingClientRect();
                        var disabled = inp.disabled || inp.readOnly || inp.className.indexOf('disabled') >= 0;
                        return {
                            wtype: disabled ? 'disabled' : 'input',
                            y: Math.round(ir.top), x: Math.round(ir.left),
                            w: Math.round(ir.width), h: Math.round(ir.height),
                            labelY: Math.round(rect.top), labelX: Math.round(rect.left)
                        };
                    }
                }
                parent = parent.parentElement;
            }
            return {error: 'no widget near label', labelY: Math.round(rect.top), labelX: Math.round(rect.left)};
        }''', label_text)
        if result and result.get('error'):
            logger.warning('_find_label_widget "%s": %s', label_text, result)
            return None
        logger.info('Widget for "%s": type=%s pos=(%d,%d) size=%dx%d',
                     label_text, result.get('wtype'), result.get('x', 0), result.get('y', 0),
                     result.get('w', 0), result.get('h', 0))
        return result

    def _fill_by_label(self, label_text: str, value: str):
        """Fill a form field by label text, handling different Kendo widget types."""
        if not value:
            return
        widget = self._find_label_widget(label_text)
        if not widget:
            return

        wtype = widget.get('wtype', 'unknown')
        cx = widget['x'] + widget['w'] // 2
        cy = widget['y'] + widget['h'] // 2

        if wtype == 'disabled':
            logger.info('Skipping disabled field "%s"', label_text)
            return

        if wtype == 'dropdown':
            self._interact_dropdown(cx, cy, value, label_text)
        elif wtype == 'datepicker':
            self._interact_datepicker(cx, cy, value, label_text)
        elif wtype == 'poplist':
            self._interact_poplist(cx, cy, value, label_text)
        elif wtype in ('input', 'combobox', 'numeric', 'unknown'):
            self._interact_text_input(cx, cy, value, label_text)

    def _interact_dropdown(self, cx: int, cy: int, value: str, label: str):
        """Click dropdown and select matching option."""
        self.page.mouse.click(cx, cy)
        self.page.wait_for_timeout(1000)
        ctx = self.ctx
        try:
            option = ctx.locator(f'.k-animation-container:visible .k-item:has-text("{value}")').first
            if option.is_visible(timeout=5000):
                option.click(force=True)
                self.page.wait_for_timeout(500)
                logger.info('Dropdown "%s" selected: %s', label, value)
                return
        except Exception:
            pass
        # Fallback: try typing to filter
        self.page.keyboard.type(value, delay=50)
        self.page.wait_for_timeout(1000)
        try:
            option = ctx.locator('.k-animation-container:visible .k-item').first
            if option.is_visible(timeout=3000):
                option.click(force=True)
                logger.info('Dropdown "%s" selected (typed): %s', label, value)
                return
        except Exception:
            pass
        self.page.keyboard.press('Escape')
        logger.warning('Dropdown "%s" could not select: %s', label, value)

    def _interact_datepicker(self, cx: int, cy: int, value: str, label: str):
        """Click date input and type the date value."""
        self.page.mouse.click(cx, cy)
        self.page.wait_for_timeout(500)
        self.page.keyboard.press('Control+A')
        self.page.keyboard.press('Backspace')
        self.page.keyboard.type(value, delay=30)
        self.page.keyboard.press('Tab')
        self.page.wait_for_timeout(500)
        logger.info('Datepicker "%s" set: %s', label, value)

    def _interact_poplist(self, cx: int, cy: int, value: str, label: str):
        """Click poplist trigger icon and handle the popup search dialog."""
        # Click the magnifier icon (right side of the widget)
        icon_x = cx + self.ctx.evaluate(f'''() => {{
            var els = document.elementsFromPoint({cx}, {cy});
            for (var i = 0; i < els.length; i++) {{
                var w = els[i].querySelector('.k-icon');
                if (w) return w.getBoundingClientRect().left - {cx} + 8;
            }}
            return 0;
        }}''')
        self.page.mouse.click(icon_x or (cx + 50), cy)
        self.page.wait_for_timeout(2000)

        # Check if a popup window appeared
        ctx = self.ctx
        try:
            popup = ctx.locator('.k-window:visible').last
            if popup.is_visible(timeout=3000):
                search_input = popup.locator('input[type="text"]').first
                if search_input.is_visible(timeout=3000):
                    search_input.click()
                    search_input.fill(value)
                    search_input.press('Enter')
                    self.page.wait_for_timeout(3000)
                    first_row = popup.locator('.k-grid-content tbody tr').first
                    if first_row.is_visible(timeout=5000):
                        first_row.dblclick()
                        self.page.wait_for_timeout(1500)
                        logger.info('Poplist "%s" selected: %s', label, value)
                        return
        except Exception as e:
            logger.info('Poplist popup handling for "%s": %s', label, e)

        # Fallback: just type into the field
        self.page.mouse.click(cx, cy)
        self.page.wait_for_timeout(300)
        self.page.keyboard.press('Control+A')
        self.page.keyboard.press('Backspace')
        self.page.keyboard.type(value, delay=50)
        self.page.keyboard.press('Tab')
        self.page.wait_for_timeout(1000)
        logger.info('Poplist "%s" typed fallback: %s', label, value)

    def _interact_text_input(self, cx: int, cy: int, value: str, label: str):
        """Click and type into a text input."""
        self.page.mouse.click(cx, cy)
        self.page.wait_for_timeout(300)
        self.page.keyboard.press('Control+A')
        self.page.keyboard.press('Backspace')
        self.page.keyboard.type(value, delay=50)
        self.page.keyboard.press('Tab')
        self.page.wait_for_timeout(500)
        logger.info('Input "%s" filled: %s', label, value)

    # ──────────────────────── step 4: GST ────────────────────────

    def click_get_gst(self):
        self._report(42, '获取GST（仅车缝）...')
        self._click_button('获取GST')
        self.page.wait_for_timeout(3000)
        self._close_popups()
        self._report(44, 'GST获取完成')

    # ──────────────────────── step 5-8: cost tabs ────────────────────────

    def _fill_cost_tab(self, tab_name: str, price_button: str,
                       items: list[dict], pct_start: int, pct_end: int):
        self._report(pct_start, f'切换到{tab_name}...')
        self._switch_tab(tab_name)
        self.page.wait_for_timeout(1000)

        if items:
            self._report(pct_start + 1, f'点击{price_button}...')
            self._click_button(price_button)
            self.page.wait_for_timeout(3000)
            self._close_popups()

        if items:
            self._report(pct_start + 2, f'填写{tab_name}单价...')
            for i, item in enumerate(items):
                if item.get('unit_price') is not None:
                    self._fill_grid_cell(i, 'FUnitPrice', str(item['unit_price']))

        self._report(pct_end, f'{tab_name}填写完成')

    def fill_material_tab(self, items: list[dict]):
        self._fill_cost_tab('面料成本', '获取面料采购价', items, 46, 52)

    def fill_accessory_tab(self, items: list[dict]):
        self._fill_cost_tab('辅料成本', '获取辅料采购价', items, 53, 58)

    def fill_packaging_tab(self, items: list[dict]):
        self._fill_cost_tab('包装成本', '获取包装采购价', items, 59, 64)

    def fill_secondary_tab(self, items: list[dict]):
        self._fill_cost_tab('二道工序成本', '获取二道工序采购价', items, 65, 70)

    # ──────────────────────── step 9: other costs ────────────────────────

    def _close_popups(self):
        """Close BOM list popups. Handle save dialog by clicking '取消' once, then stop."""
        ctx = self.ctx
        save_dialog_seen = False
        for _ in range(5):
            try:
                closed = ctx.evaluate('''() => {
                    // Check for save confirmation dialog (是/否/取消)
                    var allBtns = document.querySelectorAll('.k-button, button');
                    for (var i = 0; i < allBtns.length; i++) {
                        var el = allBtns[i];
                        if (el.offsetParent === null) continue;
                        var t = (el.textContent || '').trim();
                        if (t === '取消') {
                            var parent = el.parentElement;
                            if (parent) {
                                var siblings = parent.querySelectorAll('.k-button, button');
                                for (var j = 0; j < siblings.length; j++) {
                                    if ((siblings[j].textContent||'').trim() === '是' || (siblings[j].textContent||'').trim() === '否') {
                                        el.click();
                                        return 'save_dialog_cancel';
                                    }
                                }
                            }
                        }
                    }
                    // Close BOM list popups via "退出"
                    var exitBtns = document.querySelectorAll('a, button, span');
                    for (var i = exitBtns.length - 1; i >= 0; i--) {
                        var el = exitBtns[i];
                        if (el.offsetParent === null) continue;
                        var t = (el.textContent || '').trim();
                        if (t === '退出') {
                            var r = el.getBoundingClientRect();
                            if (r.width > 0 && r.height > 0) {
                                el.click();
                                return 'clicked_退出';
                            }
                        }
                    }
                    return 'none';
                }''')
                if closed == 'none':
                    break
                logger.info('Closed popup: %s', closed)
                if closed == 'save_dialog_cancel':
                    if save_dialog_seen:
                        break
                    save_dialog_seen = True
                self.page.wait_for_timeout(500)
            except Exception:
                break

    def _switch_to_other_cost_tab(self):
        """Specialized tab switch for 其他成本 using Kendo UI API."""
        ctx = self.ctx
        result = ctx.evaluate('''() => {
            var tabstrips = document.querySelectorAll('.k-tabstrip');
            for (var t = 0; t < tabstrips.length; t++) {
                var ts = tabstrips[t];
                var items = ts.querySelectorAll(':scope > ul > li, :scope > .k-tabstrip-items > li');
                for (var i = 0; i < items.length; i++) {
                    var links = items[i].querySelectorAll('.k-link, a');
                    for (var j = 0; j < links.length; j++) {
                        if (links[j].textContent.trim() === '其他成本') {
                            // Try Kendo API
                            try {
                                var $ts = $(ts);
                                var kts = $ts.data('kendoTabStrip');
                                if (kts) {
                                    kts.select(i);
                                    return {found: true, idx: i, method: 'kendo_api', tabstrip: t};
                                }
                            } catch(e) {}
                            // Fallback: manual DOM manipulation
                            links[j].scrollIntoView({block: 'center'});
                            links[j].click();
                            for (var k = 0; k < items.length; k++) {
                                items[k].classList.remove('k-state-active', 'k-tab-on-top');
                                items[k].setAttribute('aria-selected', 'false');
                            }
                            items[i].classList.add('k-state-active', 'k-tab-on-top');
                            items[i].setAttribute('aria-selected', 'true');
                            var panels = ts.querySelectorAll(':scope > .k-content');
                            if (panels.length === 0) panels = ts.querySelectorAll(':scope > div[role="tabpanel"]');
                            for (var k = 0; k < panels.length; k++) {
                                panels[k].style.display = 'none';
                                panels[k].classList.remove('k-state-active');
                            }
                            if (i < panels.length) {
                                panels[i].style.display = '';
                                panels[i].classList.add('k-state-active');
                            }
                            return {found: true, idx: i, method: 'manual_dom', tabstrip: t, panels: panels.length};
                        }
                    }
                }
            }
            return {found: false, method: 'not_found'};
        }''')
        logger.info('Switch to 其他成本: %s', result)
        return result

    def fill_other_cost_tab(self, items: list[dict] | None):
        self._report(71, '切换到其他成本...')
        self._close_popups()
        self.page.wait_for_timeout(500)

        switch_result = self._switch_to_other_cost_tab()
        self.page.wait_for_timeout(2000)
        self._close_popups()
        self.page.wait_for_timeout(500)
        self._save_debug_screenshot('other_cost_tab')

        items = items or []
        cost_types = ['水电费', '管理运营费', '运费', '测试费', '样品费']

        ctx = self.ctx
        grid_info = ctx.evaluate('''() => {
            var grids = document.querySelectorAll('.k-grid');
            var result = [];
            for (var i = 0; i < grids.length; i++) {
                var g = grids[i];
                var vis = g.offsetParent !== null;
                var tbody = g.querySelector('.k-grid-content tbody');
                var rows = tbody ? tbody.querySelectorAll('tr').length : 0;
                var headers = [];
                var ths = g.querySelectorAll('.k-grid-header th');
                for (var j = 0; j < Math.min(ths.length, 10); j++) {
                    headers.push(ths[j].getAttribute('data-field') || ths[j].innerText.trim().substring(0, 20));
                }
                if (headers.indexOf('FOTHERTYPE') >= 0 || headers.indexOf('FCostType') >= 0) {
                    result.push({idx: i, visible: vis, rows: rows, headers: headers, isOtherCost: true});
                }
            }
            return result;
        }''')
        logger.info('Other cost grid analysis: %s', grid_info)

        other_grid = None
        for gi in (grid_info or []):
            if gi.get('isOtherCost'):
                other_grid = gi
                break

        if other_grid and not other_grid.get('visible'):
            logger.warning('Other cost grid not visible, forcing via JS')
            force_result = ctx.evaluate('''() => {
                var grids = document.querySelectorAll('.k-grid');
                var targetGrid = null;
                for (var i = 0; i < grids.length; i++) {
                    var ths = grids[i].querySelectorAll('.k-grid-header th');
                    for (var j = 0; j < ths.length; j++) {
                        if (ths[j].getAttribute('data-field') === 'FOTHERTYPE') {
                            targetGrid = grids[i];
                            break;
                        }
                    }
                    if (targetGrid) break;
                }
                if (!targetGrid) return {ok: false, reason: 'grid not found'};
                var fixed = [];
                var el = targetGrid;
                while (el && el !== document.body) {
                    var cs = window.getComputedStyle(el);
                    if (cs.display === 'none') {
                        el.style.display = '';
                        fixed.push(el.tagName + '.' + (el.className||'').substring(0,50));
                    }
                    if (cs.visibility === 'hidden') {
                        el.style.visibility = 'visible';
                        fixed.push(el.tagName + '.vis');
                    }
                    el = el.parentElement;
                }
                var vis = targetGrid.offsetParent !== null;
                return {ok: vis, fixed: fixed, gridIdx: Array.from(grids).indexOf(targetGrid)};
            }''')
            logger.info('Force visible result: %s', force_result)
            self.page.wait_for_timeout(1000)
            self._save_debug_screenshot('other_cost_after_force')

        existing_rows = other_grid.get('rows', 0) if other_grid else 0
        needed = len(cost_types)

        if existing_rows < needed:
            for _ in range(needed - existing_rows):
                try:
                    add_btn = ctx.locator(
                        'a:has-text("新增行"), button:has-text("新增行"), '
                        '.k-toolbar:visible a.k-button:has-text("新增"), '
                        '[data-controlname*="AddLine"], [data-controlname*="addline"]'
                    ).first
                    if add_btn.is_visible(timeout=3000):
                        add_btn.click(force=True)
                        self.page.wait_for_timeout(800)
                    else:
                        break
                except Exception:
                    break

        col_name = 'FOTHERTYPE'
        for i, cost_type in enumerate(cost_types):
            if i >= (other_grid.get('rows', 0) if other_grid else 0):
                logger.warning('Skipping cost type %s: row %d does not exist', cost_type, i)
                continue
            item = items[i] if i < len(items) else {}
            self._report(72 + i, f'填写{cost_type}...')
            self._select_grid_dropdown(i, col_name, cost_type)
            price = item.get('unit_price')
            if price is not None and str(price).strip():
                self._fill_grid_cell(i, 'FOTHERAMOUNT', str(price))

        self._report(78, '其他成本填写完成')

    # ──────────────────────── step 10: summary tab ────────────────────────

    def fill_summary_tab(self, data: dict):
        self._report(80, '切换到合计...')
        self._switch_tab('合计')
        self.page.wait_for_timeout(1000)

        field_map = {
            'sewing_gst': '含烫画确认车缝GST',
            'hour_conversion': '小时换算',
            'cutting_price': '裁剪工价',
            'capital_rate': '资金占用率',
            'profit_rate': '利润率',
            'final_price_rmb': '最终成交价',
        }

        for key, label in field_map.items():
            val = data.get(key)
            if val is not None:
                self._report(81, f'填写{label}: {val}')
                self._fill_by_label(label, str(val))

        self._report(88, '合计填写完成')

    # ──────────────────────── step 11: save & submit ────────────────────────

    def _detect_error_dialog(self, stage: str) -> str | None:
        """Check for Kingdee error dialogs/toasts after save/submit."""
        ctx = self.ctx
        error_selectors = [
            '.k-notification-error:visible',
            '.k-alert:visible',
            '.k-window:visible:has-text("错误")',
            '.k-window:visible:has-text("失败")',
            '.k-window:visible:has-text("提示")',
            '.k-dialog:visible',
            '.k-confirm:visible',
        ]
        for sel in error_selectors:
            try:
                el = ctx.locator(sel).first
                if el.is_visible(timeout=1000):
                    text = el.inner_text()[:500]
                    logger.warning('Kingdee dialog detected after %s: sel=%s text=%s', stage, sel, text[:200])
                    return text
            except Exception:
                continue
        # Also check page body for flash messages
        try:
            body_text = ctx.evaluate('() => document.body ? document.body.innerText.substring(0, 2000) : ""')
            for kw in ['保存失败', '提交失败', '必录', '错误', '不能为空', '校验失败']:
                if kw in body_text:
                    logger.warning('Kingdee error keyword "%s" found in body after %s', kw, stage)
                    return f'Body contains "{kw}"'
        except Exception:
            pass
        return None

    def save(self):
        self._report(90, '保存...')
        self._click_button('保存')
        self.page.wait_for_timeout(5000)
        self._save_debug_screenshot('after_save')
        error = self._detect_error_dialog('save')
        if error:
            raise RuntimeError(f'金蝶保存失败: {error[:300]}')
        self._report(93, '保存成功')

    def submit(self):
        self._report(95, '提交...')
        self._click_button('提交')
        self.page.wait_for_timeout(2000)

        self._save_debug_screenshot('after_submit_click')

        try:
            confirm = self.ctx.locator(
                '.k-confirm .k-button:has-text("确定"), '
                '.k-dialog .k-button:has-text("确定")'
            ).first
            if confirm.is_visible(timeout=5000):
                confirm.click(force=True)
        except Exception:
            pass

        self.page.wait_for_timeout(3000)
        self._save_debug_screenshot('after_submit_final')
        error = self._detect_error_dialog('submit')
        if error:
            raise RuntimeError(f'金蝶提交失败: {error[:300]}')
        self._report(100, '提交成功，单据已进入审批环节')

    # ──────────────────────── debug ────────────────────────

    def _save_debug_screenshot(self, label: str):
        try:
            data = self.take_screenshot(label)
            if data:
                path = f'/tmp/kingdee_debug_{label}_{int(time.time())}.png'
                with open(path, 'wb') as f:
                    f.write(data)
                logger.info('Debug screenshot saved: %s (%d bytes)', path, len(data))
        except Exception:
            pass

    # ──────────────────────── orchestrator ────────────────────────

    def execute_full_flow(self, config: dict, form_data: dict):
        """Run the complete budget creation flow end-to-end."""
        self.login(
            url=config['url'],
            account_set=config['account_set'],
            username=config['username'],
            password=config['password'],
        )
        self.open_cost_budget_form()
        self.fill_header(form_data)
        self.click_get_gst()
        self.fill_material_tab(form_data.get('material_costs', []))
        self.fill_accessory_tab(form_data.get('accessory_costs', []))
        self.fill_packaging_tab(form_data.get('packaging_costs', []))
        self.fill_secondary_tab(form_data.get('secondary_costs', []))
        self.fill_other_cost_tab(form_data.get('other_costs', []))
        self.fill_summary_tab(form_data)
        self.save()
        self.submit()
