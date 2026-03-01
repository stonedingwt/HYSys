"""
Packing list generator.
Reads order data + packing spec rules and generates Excel packing lists.
"""

import io
import math
import re
import logging
from collections import defaultdict
from functools import reduce
from typing import Optional
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from openpyxl.utils import get_column_letter

logger = logging.getLogger(__name__)

HKM_BOX_BASE = '59*39'
HKM_DEFAULT_BOX_HEIGHT = 30
HKM_VOLUME_MAP = {10: 0.02301, 15: 0.034515, 20: 0.04602, 25: 0.057525, 30: 0.06903}
HKM_DEFAULT_VOLUME = 0.06903

THIN_BORDER = Border(
    left=Side(style='thin'), right=Side(style='thin'),
    top=Side(style='thin'), bottom=Side(style='thin'),
)
HEADER_FILL = PatternFill(start_color='D9E2F3', end_color='D9E2F3', fill_type='solid')
HEADER_FONT = Font(bold=True, size=10)
NORMAL_FONT = Font(size=10)
CENTER_ALIGN = Alignment(horizontal='center', vertical='center', wrap_text=True)

BRA_SIZE_PATTERN = re.compile(r'^([A-H])(\d{2,3})$')
CLOTHING_SIZES = ['3XL', '2XL', 'XXL', 'XL', 'XXS', 'XS', 'S', 'M', 'L']
CUP_ORDER = ['C', 'D', 'E', 'F', 'G', 'H']
CLOTHING_SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL']

COL_COUNT = 24


def _gcd(a: int, b: int) -> int:
    while b:
        a, b = b, a % b
    return a


def _gcd_list(numbers: list[int]) -> int:
    if not numbers:
        return 1
    return reduce(_gcd, numbers)


def _is_bra_size(size: str) -> bool:
    return bool(BRA_SIZE_PATTERN.match(str(size).strip())) if size else False


def _parse_bra_size(size: str) -> tuple[str, int]:
    m = BRA_SIZE_PATTERN.match(str(size).strip())
    if m:
        return m.group(1), int(m.group(2))
    return '', 0


def _clothing_sort_key(size: str) -> int:
    s = str(size).strip().upper()
    if s in CLOTHING_SIZE_ORDER:
        return CLOTHING_SIZE_ORDER.index(s)
    return 100


def _style_cell(ws, row, col, value=None, bold=False, fill=None):
    cell = ws.cell(row=row, column=col, value=value)
    cell.border = THIN_BORDER
    cell.alignment = CENTER_ALIGN
    cell.font = HEADER_FONT if bold else NORMAL_FONT
    if fill:
        cell.fill = fill
    return cell


def _write_group_header_rows(ws, row_num: int):
    """Write the two header rows for a DC group matching reference template."""
    header_row1 = {
        1: '箱号', 4: '箱数', 5: '款号', 6: '尺码',
        7: '每   箱   尺   码   搭   配',
        13: '每包数量', 14: '每箱包数',
        15: '合计', 16: '每箱净重', 17: '每箱毛重',
        19: '纸箱尺寸', 20: '体积', 21: '胶袋尺寸',
        22: '数量', 23: '备注',
    }
    for col_idx in range(1, COL_COUNT + 1):
        val = header_row1.get(col_idx)
        _style_cell(ws, row_num, col_idx, val, bold=True, fill=HEADER_FILL)
    ws.merge_cells(start_row=row_num, start_column=1, end_row=row_num, end_column=3)
    ws.merge_cells(start_row=row_num, start_column=7, end_row=row_num, end_column=12)

    header_row2 = {
        1: '开始箱号', 3: '结束箱号',
        7: 'C', 8: 'D', 9: 'E', 10: 'F', 11: 'G', 12: 'H',
        16: 'N.W.(kg)', 17: 'G.W.(kg)',
    }
    for col_idx in range(1, COL_COUNT + 1):
        val = header_row2.get(col_idx)
        _style_cell(ws, row_num + 1, col_idx, val, bold=True, fill=HEADER_FILL)

    return row_num + 2


def _compute_per_box_distribution(lines: list[dict]) -> tuple[dict[str, int], int]:
    size_totals = defaultdict(int)
    for ln in lines:
        size = ln.get('size') or ''
        qty = ln.get('quantity') or ln.get('tot_pieces') or 0
        if qty > 0 and size:
            size_totals[size] += qty

    if not size_totals:
        return {}, 0

    quantities = list(size_totals.values())
    num_boxes = _gcd_list(quantities)

    size_dist = {size: total // num_boxes for size, total in size_totals.items()}
    return size_dist, num_boxes


def _classify_article_type(lines: list[dict]) -> str:
    for ln in lines:
        size = ln.get('size') or ''
        if _is_bra_size(size):
            return 'bra'
    return 'clothing'


def _organize_bra_distribution(size_dist: dict[str, int]) -> dict[int, dict[str, int]]:
    bands = defaultdict(lambda: defaultdict(int))
    for size, qty in size_dist.items():
        cup, band = _parse_bra_size(size)
        if cup and band:
            bands[band][cup] = qty
    return dict(sorted(bands.items()))


def generate_hkm_packing_list_combined(
    orders: list[dict],
    lines_per_order: list[list[dict]],
) -> bytes:
    """Generate HKM packing list Excel matching the reference template.

    Groups by DC, with multiple articles packed together in the same boxes.
    Each DC group shows size distribution per article.
    """
    wb = Workbook()
    ws = wb.active
    ws.title = '合并表'

    article_data = []
    for order, lines in zip(orders, lines_per_order):
        desc = order.get('article_description', '') or ''
        generic_no = order.get('generic_article_no', '') or ''
        for ln in lines:
            ln['_article_desc'] = desc
            ln['_generic_no'] = generic_no
            ln['_order_id'] = order.get('id', '')
        article_data.append({
            'order': order,
            'lines': lines,
            'description': desc,
            'generic_no': generic_no,
        })

    all_lines = [ln for art in article_data for ln in art['lines']]

    dc_groups = defaultdict(list)
    for ln in all_lines:
        dc_key = ln.get('dc') or ln.get('warehouse') or ln.get('destination') or 'DEFAULT'
        dc_groups[dc_key].append(ln)

    if not dc_groups:
        dc_groups['DEFAULT'] = all_lines

    row_num = 1
    box_start = 1

    for dc_key, dc_lines in dc_groups.items():
        articles_in_dc = defaultdict(list)
        for ln in dc_lines:
            art_desc = ln.get('_article_desc', '')
            articles_in_dc[art_desc].append(ln)

        num_boxes = None
        article_infos = []
        for desc, art_lines in articles_in_dc.items():
            size_dist, boxes = _compute_per_box_distribution(art_lines)
            per_pack = sum(size_dist.values())
            art_type = _classify_article_type(art_lines)
            if num_boxes is None and boxes > 0:
                num_boxes = boxes
            article_infos.append({
                'description': desc,
                'lines': art_lines,
                'size_dist': size_dist,
                'per_pack': per_pack,
                'num_boxes': boxes,
                'type': art_type,
                'generic_no': art_lines[0].get('_generic_no', '') if art_lines else '',
            })

        if num_boxes is None or num_boxes == 0:
            num_boxes = 1

        style_names = []
        barcodes = []
        for info in article_infos:
            name = f"{info['per_pack']} {info['description']}" if info['description'] else info['generic_no']
            style_names.append(name)
            ean_set = set()
            for ln in info['lines']:
                ean = ln.get('ean')
                if ean:
                    ean_set.add(ean)
            if ean_set:
                barcodes.append(' / '.join(sorted(ean_set)))

        dc_display = dc_key
        for ln in dc_lines:
            parts = []
            if ln.get('dc'):
                parts.append(ln['dc'])
            if ln.get('warehouse'):
                parts.append(ln['warehouse'])
            dest = ln.get('destination') or ''
            if dest:
                parts.append(dest)
            flow = ln.get('flow') or ''
            if flow:
                parts.append(flow)
            if len(parts) >= 2:
                dc_display = '/'.join(parts)
                break

        ws.cell(row=row_num, column=1, value='款号：').font = Font(bold=True, size=10)
        ws.cell(row=row_num, column=2, value=' / '.join(style_names))
        row_num += 1

        ws.cell(row=row_num, column=1, value='DC：').font = Font(bold=True, size=10)
        ws.cell(row=row_num, column=2, value=dc_display)
        row_num += 1

        ws.cell(row=row_num, column=1, value='条形码：').font = Font(bold=True, size=10)
        ws.cell(row=row_num, column=2, value=' / '.join(barcodes) if barcodes else '')
        row_num += 1

        row_num += 2

        row_num = _write_group_header_rows(ws, row_num)

        box_end = box_start + num_boxes - 1
        box_size = f'{HKM_BOX_BASE}*{HKM_DEFAULT_BOX_HEIGHT}'
        volume = round(HKM_VOLUME_MAP.get(HKM_DEFAULT_BOX_HEIGHT, HKM_DEFAULT_VOLUME) * num_boxes, 5)

        first_article = True
        for info in article_infos:
            size_dist = info['size_dist']
            per_pack = info['per_pack']
            art_type = info['type']

            if art_type == 'bra':
                band_dist = _organize_bra_distribution(size_dist)
                first_band = True
                for band_size, cup_dist in band_dist.items():
                    row_data = [None] * COL_COUNT
                    if first_band and first_article:
                        row_data[0] = box_start
                        row_data[2] = box_end
                        row_data[3] = num_boxes
                        row_data[18] = box_size
                        row_data[19] = volume

                    row_data[5] = band_size
                    for cup in CUP_ORDER:
                        col_idx = CUP_ORDER.index(cup) + 6
                        row_data[col_idx] = cup_dist.get(cup) or None

                    if first_band:
                        row_data[12] = per_pack
                        total = per_pack * num_boxes
                        row_data[14] = total

                    for col_idx in range(COL_COUNT):
                        _style_cell(ws, row_num, col_idx + 1, row_data[col_idx])
                    row_num += 1
                    first_band = False
            else:
                sorted_sizes = sorted(size_dist.keys(), key=_clothing_sort_key)

                size_row = [None] * COL_COUNT
                for i, sz in enumerate(sorted_sizes):
                    if i < 6:
                        size_row[7 + i] = sz
                for col_idx in range(COL_COUNT):
                    _style_cell(ws, row_num, col_idx + 1, size_row[col_idx])
                row_num += 1

                qty_row = [None] * COL_COUNT
                for i, sz in enumerate(sorted_sizes):
                    if i < 6:
                        qty_row[7 + i] = size_dist[sz]
                qty_row[12] = per_pack
                total = per_pack * num_boxes
                qty_row[14] = total
                for col_idx in range(COL_COUNT):
                    _style_cell(ws, row_num, col_idx + 1, qty_row[col_idx])
                row_num += 1

            first_article = False

        row_num += 1
        box_start = box_end + 1

    col_widths = {
        1: 10, 2: 4, 3: 10, 4: 8, 5: 12, 6: 8,
        7: 5, 8: 5, 9: 5, 10: 5, 11: 5, 12: 5,
        13: 10, 14: 10, 15: 10, 16: 10, 17: 10, 18: 4,
        19: 12, 20: 10, 21: 10, 22: 8, 23: 10, 24: 4,
    }
    for col_idx, width in col_widths.items():
        ws.column_dimensions[get_column_letter(col_idx)].width = width

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def generate_hkm_packing_list(
    order: dict,
    lines: list[dict],
) -> bytes:
    """Generate HKM packing list for a single order (backward compatible)."""
    return generate_hkm_packing_list_combined([order], [lines])


def generate_generic_packing_list(
    order: dict,
    lines: list[dict],
    customer_specs: Optional[list[dict]] = None,
) -> bytes:
    """Generate a generic (non-HKM) packing list Excel."""
    wb = Workbook()
    ws = wb.active
    ws.title = '装箱单'

    po_number = order.get('po', '')
    generic_article_no = order.get('generic_article_no', '')
    country = order.get('country', '')

    ws.append(['订单号', po_number])
    ws.append(['客款号', generic_article_no])
    ws.append(['国家', country])
    ws.append([])

    headers = [
        '箱号(开始)', '箱号(结束)', '箱数', '款式图', '厂款号',
        '颜色', '尺码', '每箱数量', '合计',
        '每箱净重', '每箱毛重', '纸箱尺寸', '体积', '备注',
    ]

    for i, h in enumerate(headers, 1):
        cell = ws.cell(row=5, column=i, value=h)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.border = THIN_BORDER
        cell.alignment = CENTER_ALIGN

    row_num = 6
    box_start = 1
    default_max = 50
    default_box = '60*40*25'
    default_volume = 0.06

    if customer_specs:
        spec = customer_specs[0]
        default_max = spec.get('box_max') or 50
        default_box = spec.get('box_Carton') or default_box
        default_volume = spec.get('box_volume') or default_volume

    for line in lines:
        qty = line.get('quantity') or line.get('tot_pieces') or 0
        if not qty or qty <= 0:
            continue

        max_per_box = default_max
        remaining = qty

        while remaining > 0:
            num_boxes = remaining // max_per_box if remaining >= max_per_box else 0

            if num_boxes > 0:
                box_end = box_start + num_boxes - 1
                total = num_boxes * max_per_box
                _style_cell(ws, row_num, 1, box_start)
                _style_cell(ws, row_num, 2, box_end)
                _style_cell(ws, row_num, 3, num_boxes)
                _style_cell(ws, row_num, 5, generic_article_no)
                _style_cell(ws, row_num, 6, line.get('colour', ''))
                _style_cell(ws, row_num, 7, line.get('size', ''))
                _style_cell(ws, row_num, 8, max_per_box)
                _style_cell(ws, row_num, 9, total)
                _style_cell(ws, row_num, 12, default_box)
                _style_cell(ws, row_num, 13, default_volume)
                row_num += 1
                box_start = box_end + 1
                remaining -= total
            else:
                _style_cell(ws, row_num, 1, box_start)
                _style_cell(ws, row_num, 2, box_start)
                _style_cell(ws, row_num, 3, 1)
                _style_cell(ws, row_num, 5, generic_article_no)
                _style_cell(ws, row_num, 6, line.get('colour', ''))
                _style_cell(ws, row_num, 7, line.get('size', ''))
                _style_cell(ws, row_num, 8, remaining)
                _style_cell(ws, row_num, 9, remaining)
                _style_cell(ws, row_num, 12, default_box)
                _style_cell(ws, row_num, 13, default_volume)
                row_num += 1
                box_start += 1
                remaining = 0

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
