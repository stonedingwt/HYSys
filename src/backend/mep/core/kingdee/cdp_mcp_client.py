"""
Chrome DevTools MCP Client — Python implementation.

Provides the same tool interface as ``chrome-devtools-mcp`` npm package
but communicates directly with Chromium via Chrome DevTools Protocol (CDP)
over WebSocket.  No Node.js required.

Additionally exposes a **Playwright-compatible shim** so existing code that
uses Playwright's ``Page`` / ``Locator`` / ``Frame`` APIs can switch to CDP
with minimal source changes.

Usage (raw)::

    mcp = ChromeDevToolsMCP()
    mcp.start(headless=True)
    mcp.navigate_page("https://example.com")
    title = mcp.evaluate_script("() => document.title")
    mcp.stop()

Usage (compat shim – drop-in replacement for Playwright)::

    mcp = ChromeDevToolsMCP()
    mcp.start(headless=True)
    page = mcp.compat_page()          # looks like playwright.Page
    page.goto("https://example.com")
    page.locator('#btn').click()
    mcp.stop()
"""

from __future__ import annotations

import base64
import json
import logging
import os
import re
import subprocess
import threading
import time
from typing import Any, List, Optional

import requests
import websocket  # websocket-client (sync)

logger = logging.getLogger(__name__)

_CHROME_CANDIDATES = [
    os.environ.get('CHROME_BIN', ''),
    '/root/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
]

_DEFAULT_DEBUGGING_PORT = 9222
_LAUNCH_TIMEOUT = 15


def _find_chrome() -> str:
    for path in _CHROME_CANDIDATES:
        if path and os.path.isfile(path) and os.access(path, os.X_OK):
            return path
    raise FileNotFoundError(
        'Chromium binary not found. Set CHROME_BIN env var or install Chromium.'
    )


# ═══════════════════════════════════════════════════════════════════════
#  Core CDP client
# ═══════════════════════════════════════════════════════════════════════

class ChromeDevToolsMCP:
    """CDP-based browser controller with Chrome DevTools MCP–compatible API."""

    def __init__(self):
        self._process: Optional[subprocess.Popen] = None
        self._ws: Optional[websocket.WebSocket] = None
        self._port: int = _DEFAULT_DEBUGGING_PORT
        self._msg_id: int = 0
        self._callbacks: dict = {}
        self._events: list = []
        self._recv_thread: Optional[threading.Thread] = None
        self._running = False

    # ─── lifecycle ───────────────────────────────────────────────

    def start(self, headless: bool = True, port: int = 0):
        chrome_bin = _find_chrome()
        self._port = port or _DEFAULT_DEBUGGING_PORT
        args = [
            chrome_bin,
            f'--remote-debugging-port={self._port}',
            '--no-first-run', '--no-default-browser-check',
            '--disable-background-networking', '--disable-sync',
            '--disable-translate', '--disable-extensions',
            '--disable-hang-monitor', '--disable-popup-blocking',
            '--disable-prompt-on-repost', '--metrics-recording-only',
            '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
            '--window-size=1920,1080', '--lang=zh-CN',
        ]
        if headless:
            args.append('--headless=new')
        args.append('about:blank')
        logger.info('Launching Chrome: %s (port %d)', chrome_bin, self._port)
        self._process = subprocess.Popen(
            args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        self._wait_for_devtools()
        self._connect_page()
        logger.info('Chrome DevTools MCP ready (pid=%d)', self._process.pid)

    def stop(self):
        self._running = False
        try:
            if self._ws:
                self._ws.close()
        except Exception:
            pass
        try:
            if self._process:
                self._process.terminate()
                self._process.wait(timeout=5)
        except Exception:
            if self._process:
                self._process.kill()
        self._ws = None
        self._process = None

    # ─── CDP low-level ───────────────────────────────────────────

    def _wait_for_devtools(self):
        url = f'http://127.0.0.1:{self._port}/json'
        deadline = time.time() + _LAUNCH_TIMEOUT
        while time.time() < deadline:
            try:
                resp = requests.get(url, timeout=2)
                if resp.status_code == 200:
                    return
            except Exception:
                pass
            time.sleep(0.3)
        raise TimeoutError(f'Chrome not ready within {_LAUNCH_TIMEOUT}s')

    def _connect_page(self):
        targets = requests.get(f'http://127.0.0.1:{self._port}/json').json()
        page_target = next((t for t in targets if t.get('type') == 'page'), None)
        if not page_target:
            raise RuntimeError('No page target found')
        ws_url = page_target['webSocketDebuggerUrl']
        self._ws = websocket.create_connection(ws_url, timeout=60)
        self._running = True
        self._recv_thread = threading.Thread(target=self._recv_loop, daemon=True)
        self._recv_thread.start()
        for domain in ('Page', 'Runtime', 'DOM', 'Network'):
            self._send(f'{domain}.enable')

    def _recv_loop(self):
        while self._running:
            try:
                raw = self._ws.recv()
                if not raw:
                    continue
                msg = json.loads(raw)
                mid = msg.get('id')
                if mid is not None and mid in self._callbacks:
                    self._callbacks[mid] = msg
                else:
                    self._events.append(msg)
            except websocket.WebSocketConnectionClosedException:
                break
            except Exception:
                if self._running:
                    logger.debug('recv error', exc_info=True)

    def _send(self, method: str, params: dict = None, timeout: float = 60) -> dict:
        self._msg_id += 1
        mid = self._msg_id
        self._callbacks[mid] = None
        self._ws.send(json.dumps({'id': mid, 'method': method, 'params': params or {}}))
        deadline = time.time() + timeout
        while time.time() < deadline:
            result = self._callbacks.get(mid)
            if result is not None:
                del self._callbacks[mid]
                if 'error' in result:
                    raise RuntimeError(f'CDP {method}: {result["error"]}')
                return result.get('result', {})
            time.sleep(0.05)
        self._callbacks.pop(mid, None)
        raise TimeoutError(f'CDP {method} timed out ({timeout}s)')

    # ─── navigation ──────────────────────────────────────────────

    def navigate_page(self, url: str, timeout: int = 60_000) -> dict:
        result = self._send('Page.navigate', {'url': url})
        self._wait_for_load(timeout / 1000)
        return result

    def _wait_for_load(self, timeout_sec: float = 60):
        deadline = time.time() + timeout_sec
        while time.time() < deadline:
            for evt in list(self._events):
                if evt.get('method') in ('Page.loadEventFired', 'Page.domContentEventFired'):
                    self._events.remove(evt)
                    return
            time.sleep(0.2)

    # ─── evaluate ────────────────────────────────────────────────

    def evaluate_script(self, function: str, args: list = None, timeout: float = 30) -> Any:
        if args:
            args_json = json.dumps(args)
            expression = f'({function}).apply(null, {args_json})'
        else:
            expression = f'({function})()'
        result = self._send('Runtime.evaluate', {
            'expression': expression,
            'returnByValue': True, 'awaitPromise': True,
            'timeout': int(timeout * 1000),
        }, timeout=timeout + 5)
        if 'exceptionDetails' in result:
            exc = result['exceptionDetails']
            text = exc.get('text', '')
            if 'exception' in exc:
                text = exc['exception'].get('description', text)
            raise RuntimeError(f'JS error: {text}')
        remote = result.get('result', {})
        if remote.get('type') == 'undefined':
            return None
        return remote.get('value')

    # ─── input ───────────────────────────────────────────────────

    _KEY_MAP = {
        'Enter': ('\r', 'Enter', 13), 'Tab': ('\t', 'Tab', 9),
        'Escape': ('\x1b', 'Escape', 27), 'Backspace': ('\b', 'Backspace', 8),
        'Delete': ('', 'Delete', 46),
        'ArrowUp': ('', 'ArrowUp', 38), 'ArrowDown': ('', 'ArrowDown', 40),
        'ArrowLeft': ('', 'ArrowLeft', 37), 'ArrowRight': ('', 'ArrowRight', 39),
    }

    def type_text(self, text: str, submit_key: str = None):
        self._send('Input.insertText', {'text': text})
        if submit_key:
            self.press_key(submit_key)

    def press_key(self, key: str):
        parts = key.split('+')
        mod_map = {'Control': 2, 'Alt': 1, 'Shift': 8, 'Meta': 4}
        modifiers = 0
        for p in parts[:-1]:
            modifiers |= mod_map.get(p, 0)
        main = parts[-1]
        info = self._KEY_MAP.get(main)
        if info:
            text, code, kc = info
        else:
            text = main if len(main) == 1 else ''
            code = f'Key{main.upper()}' if len(main) == 1 else main
            kc = ord(main.upper()) if len(main) == 1 else 0
        base = {'key': main, 'code': code,
                'windowsVirtualKeyCode': kc, 'nativeVirtualKeyCode': kc,
                'modifiers': modifiers}
        if text:
            base['text'] = text
            base['unmodifiedText'] = text
        self._send('Input.dispatchKeyEvent', {**base, 'type': 'keyDown'})
        if text:
            self._send('Input.dispatchKeyEvent', {**base, 'type': 'char'})
        self._send('Input.dispatchKeyEvent', {**base, 'type': 'keyUp'})

    def click_at(self, x: float, y: float, click_count: int = 1):
        for _ in range(click_count):
            for t in ('mousePressed', 'mouseReleased'):
                self._send('Input.dispatchMouseEvent', {
                    'type': t, 'x': x, 'y': y, 'button': 'left', 'clickCount': 1,
                })

    def dblclick_at(self, x: float, y: float):
        for t in ('mousePressed', 'mouseReleased'):
            self._send('Input.dispatchMouseEvent', {
                'type': t, 'x': x, 'y': y, 'button': 'left', 'clickCount': 1,
            })
        for t in ('mousePressed', 'mouseReleased'):
            self._send('Input.dispatchMouseEvent', {
                'type': t, 'x': x, 'y': y, 'button': 'left', 'clickCount': 2,
            })

    def hover_at(self, x: float, y: float):
        self._send('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': x, 'y': y})

    # ─── screenshot ──────────────────────────────────────────────

    def take_screenshot(self, file_path: str = None, full_page: bool = False) -> Optional[bytes]:
        params: dict = {'format': 'png'}
        if full_page:
            metrics = self._send('Page.getLayoutMetrics')
            cs = metrics.get('contentSize', metrics.get('cssContentSize', {}))
            params['clip'] = {'x': 0, 'y': 0, 'width': cs.get('width', 1920),
                              'height': cs.get('height', 1080), 'scale': 1}
        result = self._send('Page.captureScreenshot', params)
        data = base64.b64decode(result['data'])
        if file_path:
            with open(file_path, 'wb') as f:
                f.write(data)
        return data

    # ─── dialog ──────────────────────────────────────────────────

    def handle_dialog(self, accept: bool = True, prompt_text: str = ''):
        self._send('Page.handleJavaScriptDialog', {'accept': accept, 'promptText': prompt_text})

    # ─── wait helpers ────────────────────────────────────────────

    def wait(self, ms: int):
        time.sleep(ms / 1000)

    # ─── compat shim ────────────────────────────────────────────

    def compat_page(self) -> 'CompatPage':
        """Return a Playwright-compatible Page shim backed by this CDP client."""
        return CompatPage(self)


# ═══════════════════════════════════════════════════════════════════════
#  Playwright-compatible shim layer
# ═══════════════════════════════════════════════════════════════════════

def _parse_pw_selectors(raw: str) -> list[dict]:
    """Parse Playwright-style CSS selectors (may contain ``:has-text()``, ``:visible``)."""
    parts = []
    for seg in raw.split(','):
        seg = seg.strip()
        if not seg:
            continue
        has_text = None
        m = re.search(r':has-text\("([^"]+)"\)', seg)
        if m:
            has_text = m.group(1)
            seg = seg[:m.start()] + seg[m.end():]
        visible = ':visible' in seg
        seg = seg.replace(':visible', '').strip()
        parts.append({'css': seg or '*', 'has_text': has_text, 'visible': visible})
    return parts


def _selector_js(parts: list[dict], *, action: str = 'collect') -> str:
    """Build JS that queries elements matching the parsed selector parts.

    *action* can be:
    - ``collect``  – return ``[{el, text, rect, visible}]`` array
    - ``click``    – click first match, return True/False
    - ``dblclick`` – double-click first match
    - ``fill``     – fill first match (requires *value* placeholder ``__VAL__``)
    """
    conditions = []
    for p in parts:
        css_sel = json.dumps(p['css'])
        checks = []
        if p['visible']:
            checks.append('el.offsetParent !== null')
        if p['has_text']:
            ht = json.dumps(p['has_text'])
            checks.append(f'(el.textContent||"").includes({ht})')
        check_str = ' && '.join(checks) if checks else 'true'
        conditions.append(f'{{css:{css_sel}, check:function(el){{return {check_str};}}}}')

    conds = ','.join(conditions)

    if action == 'collect':
        return f'''() => {{
            var conds = [{conds}];
            var results = [];
            for (var c = 0; c < conds.length; c++) {{
                var els = document.querySelectorAll(conds[c].css);
                for (var i = 0; i < els.length; i++) {{
                    var el = els[i];
                    if (!conds[c].check(el)) continue;
                    var r = el.getBoundingClientRect();
                    results.push({{
                        idx: results.length, text: (el.textContent||'').trim().substring(0,500),
                        tag: el.tagName, visible: el.offsetParent !== null,
                        x: r.x, y: r.y, w: r.width, h: r.height
                    }});
                }}
            }}
            return results;
        }}'''
    elif action == 'click':
        return f'''() => {{
            var conds = [{conds}];
            for (var c = 0; c < conds.length; c++) {{
                var els = document.querySelectorAll(conds[c].css);
                for (var i = 0; i < els.length; i++) {{
                    if (conds[c].check(els[i])) {{ els[i].click(); return true; }}
                }}
            }}
            return false;
        }}'''
    elif action == 'dblclick':
        return f'''() => {{
            var conds = [{conds}];
            for (var c = 0; c < conds.length; c++) {{
                var els = document.querySelectorAll(conds[c].css);
                for (var i = 0; i < els.length; i++) {{
                    var el = els[i];
                    if (!conds[c].check(el)) continue;
                    ['mousedown','mouseup','click','mousedown','mouseup','click','dblclick']
                        .forEach(function(t){{ el.dispatchEvent(new MouseEvent(t,{{bubbles:true,cancelable:true,view:window}})); }});
                    return true;
                }}
            }}
            return false;
        }}'''
    elif action == 'fill':
        return f'''(val) => {{
            var conds = [{conds}];
            for (var c = 0; c < conds.length; c++) {{
                var els = document.querySelectorAll(conds[c].css);
                for (var i = 0; i < els.length; i++) {{
                    var el = els[i];
                    if (!conds[c].check(el)) continue;
                    el.focus(); el.value = ''; el.value = val;
                    el.dispatchEvent(new Event('input',{{bubbles:true}}));
                    el.dispatchEvent(new Event('change',{{bubbles:true}}));
                    return true;
                }}
            }}
            return false;
        }}'''
    return '() => null'


class CompatKeyboard:
    """Shim for ``page.keyboard``."""
    def __init__(self, mcp: ChromeDevToolsMCP):
        self._mcp = mcp

    def type(self, text: str, delay: int = 0):
        if delay and delay > 20:
            for ch in text:
                self._mcp.type_text(ch)
                time.sleep(delay / 1000)
        else:
            self._mcp.type_text(text)

    def press(self, key: str):
        self._mcp.press_key(key)


class CompatMouse:
    """Shim for ``page.mouse``."""
    def __init__(self, mcp: ChromeDevToolsMCP):
        self._mcp = mcp

    def click(self, x: float, y: float):
        self._mcp.click_at(x, y)

    def dblclick(self, x: float, y: float):
        self._mcp.dblclick_at(x, y)


class CompatLocator:
    """Shim for Playwright ``Locator``.

    Keeps a reference to the parsed selector and the evaluation context
    (main page or a specific iframe).
    """

    def __init__(self, mcp: ChromeDevToolsMCP, selector: str,
                 frame_url_pattern: str | None = None,
                 nth: int | None = None, pick: str = 'first'):
        self._mcp = mcp
        self._raw = selector
        self._parts = _parse_pw_selectors(selector)
        self._frame = frame_url_pattern
        self._nth = nth
        self._pick = pick  # 'first', 'last', or 'all'

    def _eval(self, js: str, *args) -> Any:
        if self._frame:
            wrapper = f'''() => {{
                var frames = document.querySelectorAll('iframe');
                for (var fi = 0; fi < frames.length; fi++) {{
                    try {{
                        var url = frames[fi].contentWindow.location.href;
                        if (url.indexOf({json.dumps(self._frame)}) >= 0) {{
                            return frames[fi].contentWindow.eval('(' + {json.dumps(js)} + ')({_inline_args(args)})');
                        }}
                    }} catch(e) {{}}
                }}
                return ({js})({_inline_args(args)});
            }}'''
            return self._mcp.evaluate_script(wrapper)
        if args:
            return self._mcp.evaluate_script(js, list(args))
        return self._mcp.evaluate_script(js)

    def _resolve(self) -> list[dict]:
        """Run the selector JS and return element info list."""
        js = _selector_js(self._parts, action='collect')
        items = self._eval(js) or []
        if self._nth is not None:
            return [items[self._nth]] if self._nth < len(items) else []
        if self._pick == 'last':
            return items[-1:] if items else []
        return items

    # ── sub-selectors ────────────────────────────────────────────

    @property
    def first(self) -> 'CompatLocator':
        return CompatLocator(self._mcp, self._raw, self._frame, pick='first')

    @property
    def last(self) -> 'CompatLocator':
        return CompatLocator(self._mcp, self._raw, self._frame, pick='last')

    def nth(self, index: int) -> 'CompatLocator':
        return CompatLocator(self._mcp, self._raw, self._frame, nth=index)

    def locator(self, sub_selector: str) -> 'CompatLocator':
        combined = f'{self._raw} {sub_selector}'
        return CompatLocator(self._mcp, combined, self._frame)

    def all(self) -> list['CompatLocator']:
        items = self._resolve()
        return [CompatLocator(self._mcp, self._raw, self._frame, nth=i)
                for i in range(len(items))]

    # ── actions ──────────────────────────────────────────────────

    def click(self, force: bool = False):
        js = _selector_js(self._parts, action='click')
        if self._nth is not None:
            items = self._eval(_selector_js(self._parts, action='collect')) or []
            if self._nth < len(items):
                self._mcp.click_at(
                    items[self._nth]['x'] + items[self._nth]['w'] / 2,
                    items[self._nth]['y'] + items[self._nth]['h'] / 2,
                )
                return
        if self._pick == 'last':
            items = self._eval(_selector_js(self._parts, action='collect')) or []
            if items:
                it = items[-1]
                self._mcp.click_at(it['x'] + it['w'] / 2, it['y'] + it['h'] / 2)
                return
        self._eval(js)

    def dblclick(self, force: bool = False):
        items = self._resolve()
        if items:
            it = items[0]
            self._mcp.dblclick_at(it['x'] + it['w'] / 2, it['y'] + it['h'] / 2)

    def fill(self, value: str):
        js = _selector_js(self._parts, action='fill')
        self._eval(js, value)

    def press(self, key: str):
        self.click(force=True)
        time.sleep(0.1)
        self._mcp.press_key(key)

    def hover(self, force: bool = False):
        items = self._resolve()
        if items:
            it = items[0]
            self._mcp.hover_at(it['x'] + it['w'] / 2, it['y'] + it['h'] / 2)

    def is_visible(self, timeout: int = 0) -> bool:
        deadline = time.time() + max(timeout, 200) / 1000
        while True:
            items = self._resolve()
            target = items
            if target:
                return any(i.get('visible', False) or i.get('w', 0) > 0 for i in target)
            if time.time() >= deadline:
                return False
            time.sleep(0.3)

    def inner_text(self, timeout: int = 5000) -> str:
        deadline = time.time() + timeout / 1000
        while True:
            items = self._resolve()
            if items:
                return items[0].get('text', '')
            if time.time() >= deadline:
                raise TimeoutError(f'inner_text timeout for {self._raw}')
            time.sleep(0.3)

    def count(self) -> int:
        items = self._eval(_selector_js(self._parts, action='collect')) or []
        return len(items)

    def wait_for(self, state: str = 'visible', timeout: int = 30_000):
        deadline = time.time() + timeout / 1000
        while time.time() < deadline:
            items = self._resolve()
            if state == 'visible' and items:
                if any(i.get('visible', False) or i.get('w', 0) > 0 for i in items):
                    return
            elif state == 'hidden' and not items:
                return
            time.sleep(0.3)
        raise TimeoutError(f'wait_for({state}) timeout for {self._raw}')

    def evaluate(self, expression: str) -> Any:
        items = self._resolve()
        if not items:
            return None
        return self._eval(f'() => {{ var el = document.querySelector({json.dumps(self._parts[0]["css"])}); return ({expression})(el); }}')


def _inline_args(args) -> str:
    if not args:
        return ''
    return ','.join(json.dumps(a) for a in args)


class CompatFrame:
    """Shim for a Playwright ``Frame`` — wraps JS evaluation inside a specific iframe."""

    def __init__(self, mcp: ChromeDevToolsMCP, url_pattern: str, frame_url: str = ''):
        self._mcp = mcp
        self._pattern = url_pattern
        self._url_val = frame_url

    @property
    def url(self) -> str:
        return self._url_val

    @property
    def name(self) -> str:
        return self._pattern

    def evaluate(self, js: str, *args) -> Any:
        if args:
            args_inline = ','.join(json.dumps(a) for a in args)
            call_expr = f'({js})({args_inline})'
        else:
            call_expr = f'({js})()'

        wrapper = f'''() => {{
            var frames = document.querySelectorAll('iframe');
            for (var fi = 0; fi < frames.length; fi++) {{
                try {{
                    var url = frames[fi].contentWindow.location.href;
                    if (url.indexOf({json.dumps(self._pattern)}) >= 0) {{
                        return frames[fi].contentWindow.eval({json.dumps(call_expr)});
                    }}
                }} catch(e) {{}}
            }}
            return eval({json.dumps(call_expr)});
        }}'''
        return self._mcp.evaluate_script(wrapper)

    def locator(self, selector: str) -> CompatLocator:
        return CompatLocator(self._mcp, selector, self._pattern)


class CompatPage:
    """Drop-in replacement for Playwright ``Page``."""

    def __init__(self, mcp: ChromeDevToolsMCP):
        self._mcp = mcp
        self.keyboard = CompatKeyboard(mcp)
        self.mouse = CompatMouse(mcp)

    # ── navigation ───────────────────────────────────────────────

    def goto(self, url: str, wait_until: str = 'domcontentloaded', timeout: int = 60_000):
        self._mcp.navigate_page(url, timeout=timeout)

    @property
    def url(self) -> str:
        return self._mcp.evaluate_script('() => window.location.href') or ''

    @property
    def main_frame(self) -> CompatFrame:
        return CompatFrame(self._mcp, '', self.url)

    @property
    def frames(self) -> list[CompatFrame]:
        """Return compat-frame objects for every iframe in the page."""
        frame_info = self._mcp.evaluate_script('''() => {
            var result = [{url: window.location.href, name: '__main__'}];
            var iframes = document.querySelectorAll('iframe');
            for (var i = 0; i < iframes.length; i++) {
                try {
                    result.push({url: iframes[i].contentWindow.location.href,
                                 name: iframes[i].name || iframes[i].id || ('iframe_' + i)});
                } catch(e) {
                    result.push({url: '', name: iframes[i].name || ('iframe_' + i)});
                }
            }
            return result;
        }''') or []
        out: list[CompatFrame] = []
        for info in frame_info:
            furl = info.get('url', '')
            fname = info.get('name', '')
            if fname == '__main__':
                out.append(CompatFrame(self._mcp, '', furl))
            else:
                pattern = ''
                if furl and furl != 'about:blank':
                    from urllib.parse import urlparse
                    parsed = urlparse(furl)
                    pattern = parsed.path.split('?')[0] if parsed.path else furl
                out.append(CompatFrame(self._mcp, pattern or fname, furl))
        return out

    # ── evaluate ─────────────────────────────────────────────────

    def evaluate(self, js: str, *args) -> Any:
        if args:
            return self._mcp.evaluate_script(js, list(args))
        return self._mcp.evaluate_script(js)

    # ── locator ──────────────────────────────────────────────────

    def locator(self, selector: str) -> CompatLocator:
        return CompatLocator(self._mcp, selector)

    # ── timing / screenshot ──────────────────────────────────────

    def wait_for_timeout(self, ms: int):
        self._mcp.wait(ms)

    def screenshot(self, full_page: bool = False, **_kw) -> bytes:
        return self._mcp.take_screenshot(full_page=full_page)

    # ── content (for test scripts) ───────────────────────────────

    def content(self) -> str:
        return self._mcp.evaluate_script('() => document.documentElement.outerHTML') or ''
