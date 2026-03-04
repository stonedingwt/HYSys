"""Response formatter: chooses text / Markdown table / HTML card based on result size."""

from __future__ import annotations

import json
from typing import List

HTML_CARD_THRESHOLD = 10


def format_as_markdown_table(headers: list[str], rows: list[list[str]]) -> str:
    if not rows:
        return '未找到相关数据。'
    header_line = '| ' + ' | '.join(headers) + ' |'
    sep_line = '| ' + ' | '.join(['---'] * len(headers)) + ' |'
    data_lines = []
    for row in rows:
        cells = [str(c).replace('|', '/').replace('\n', ' ') if c is not None else '-' for c in row]
        data_lines.append('| ' + ' | '.join(cells) + ' |')
    return '\n'.join([header_line, sep_line, *data_lines])


def format_as_html_table(headers: list[str], rows: list[list[str]], title: str = '查询结果', data_type: str = 'generic') -> str:
    """Return an HTML table wrapped in a fenced code block with lang ``html_card``.

    The first line inside the block is a JSON metadata object; the rest is the
    HTML table body.  The frontend Markdown renderer detects ``language-html_card``
    and renders a clickable card preview.
    """
    th_cells = ''.join(f'<th>{h}</th>' for h in headers)
    tr_rows = []
    for row in rows:
        cells = ''.join(f'<td>{c if c is not None else "-"}</td>' for c in row)
        tr_rows.append(f'<tr>{cells}</tr>')
    html = (
        f'<table class="data-table">'
        f'<thead><tr>{th_cells}</tr></thead>'
        f'<tbody>{"".join(tr_rows)}</tbody>'
        f'</table>'
    )
    meta = json.dumps({'title': title, 'type': data_type, 'count': len(rows)}, ensure_ascii=False)
    return f'```html_card\n{meta}\n{html}\n```'


def auto_format(
    headers: list[str],
    rows: list[list[str]],
    *,
    title: str = '查询结果',
    data_type: str = 'generic',
    summary_prefix: str = '',
) -> str:
    """Pick the best format automatically.

    - 0 rows → friendly "no data" text
    - 1–10 rows → Markdown table (with optional summary prefix)
    - >10 rows → HTML card
    """
    if not rows:
        return '未找到相关数据。'

    count = len(rows)
    if count <= HTML_CARD_THRESHOLD:
        prefix = f'{summary_prefix}共 {count} 条记录：\n\n' if summary_prefix else ''
        return prefix + format_as_markdown_table(headers, rows)
    else:
        return format_as_html_table(headers, rows, title=title, data_type=data_type)
