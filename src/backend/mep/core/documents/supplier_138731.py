"""
Supplier 138731 (HKM) order handler.
Parses pre-extracted table JSON (from PaddleOCR + LLM structuring).
"""

import re
import json
from typing import Optional
from mep.core.documents.base import OrderParserBase


class Supplier138731Handler(OrderParserBase):

    @staticmethod
    def is_match(tables: list) -> bool:
        for table in tables:
            rows = table.get('Rows', [])
            for row in rows:
                if len(row) >= 2:
                    key = str(row[0]).strip() if row[0] else ''
                    value = str(row[1]).strip() if row[1] else ''
                    if key == 'Supplier no' and value == '138731':
                        return True
        return False

    def parse(self, tables: list, extra_fields: Optional[dict] = None) -> list:
        """Parse tables into order list.

        Args:
            tables: structured table JSON from LLM
            extra_fields: optional dict with 'po_number', 'total_amount',
                          'total_quantity', 'buying_price', 'generic_article_no',
                          'cargo_delivery_date', 'presentation_date',
                          'article_description', 'delivery_terms'
                          extracted via LLM from full text
        """
        extra_fields = extra_fields or {}
        self._po_number = extra_fields.get('po_number')
        self._total_amount = extra_fields.get('total_amount')
        self._total_quantity = extra_fields.get('total_quantity')

        order_groups = self._split_tables_by_order(tables)
        orders = []
        for group_tables in order_groups:
            extracted = self._extract_all_info(group_tables)
            buying_price = extra_fields.get('buying_price')
            details = self._extract_details(group_tables, extracted)
            for detail in details:
                if not detail.get('unit_price'):
                    detail['unit_price'] = buying_price

            generic_article_no = (
                extracted.get('generic_article_no')
                or extra_fields.get('generic_article_no')
            )
            issue_date = (
                self.format_date(extracted.get('date'))
                or self.format_date(extra_fields.get('date_of_issue'))
            )
            payment_terms = (
                extracted.get('payment')
                or extra_fields.get('payment_terms')
            )

            order = {
                'po_number': self._po_number or extracted.get('supplier_no') or generic_article_no,
                'customer_name': 'HKM',
                'country': self.extract_country_from_code(extracted.get('country_of_origin')),
                'total_quantity': str(self._total_quantity) if self._total_quantity else None,
                'total_amount': self._total_amount,
                'brand': extracted.get('sub_brand'),
                'contract_number': extracted.get('supplier_no'),
                'contract_date': issue_date,
                'is_repeated': False,
                'currency': self.extract_main_currency(extracted.get('sales_prices')),
                'sales_organization': extracted.get('buying_group'),
                'payment_terms': payment_terms,
                'business_type': extracted.get('material_group') or '服装',
                'issue_date': issue_date,
                'cargo_delivery_date': (
                    self.format_date(extracted.get('cargo_delivery_date'))
                    or self.format_date(extra_fields.get('cargo_delivery_date'))
                ),
                'presentation_date': (
                    self.format_date(extracted.get('presentation_date'))
                    or self.format_date(extra_fields.get('presentation_date'))
                ),
                'article_description': (
                    extracted.get('article_description')
                    or extra_fields.get('article_description')
                ),
                'generic_article_no': generic_article_no,
                'delivery_location': '',
                'delivery_terms': (
                    extracted.get('delivery_terms')
                    or extra_fields.get('delivery_terms')
                ),
                'agent': extracted.get('agent'),
                'factory': extracted.get('factory'),
                'factory_no': extracted.get('factory_no'),
                'season': extracted.get('season'),
                'colour': extracted.get('colour'),
                'composition': extracted.get('composition_code'),
                'hs_code': extracted.get('hs_code'),
                'shipment_method': extracted.get('shipment_method'),
                'dc_date': self.format_date(extracted.get('dc_date')),
                'theme': extracted.get('theme'),
                'sales_prices': extracted.get('sales_prices'),
                'size_orders': extracted.get('size_orders'),
                'details': details,
            }
            orders.append(order)
        return self._clean_selected_markers(orders)

    # ──────── internal ────────

    def _clean_selected_markers(self, data):
        if isinstance(data, dict):
            return {k: self._clean_selected_markers(v) for k, v in data.items()}
        elif isinstance(data, list):
            return [self._clean_selected_markers(item) for item in data]
        elif isinstance(data, str):
            return re.sub(r'\n:(selected|unselected):.*?(?=\n|$)', '', data).strip()
        return data

    def _split_tables_by_order(self, tables: list) -> list:
        if not tables:
            return []
        order_groups = []
        current_group: list = []
        found_first = False

        for table in tables:
            headers = table.get('Headers', [])
            rows = table.get('Rows', [])
            first_header = headers[0] if headers else ''
            is_new = False

            if first_header == 'Supplier' and len(headers) >= 2:
                has_supplier_no = any(
                    len(r) >= 2 and str(r[0]).strip() == 'Supplier no' for r in rows
                )
                if has_supplier_no:
                    if found_first:
                        is_new = True
                    found_first = True

            if is_new and current_group:
                order_groups.append(current_group)
                current_group = []
            current_group.append(table)

        if current_group:
            order_groups.append(current_group)
        return order_groups or [tables]

    def _extract_all_info(self, tables: list) -> dict:
        data: dict = {}
        for table in tables:
            headers = table.get('Headers', [])
            rows = table.get('Rows', [])
            if not rows:
                continue
            first_header = headers[0] if headers else ''
            if first_header == 'Supplier' and len(headers) >= 2:
                self._extract_mixed_supplier_table(rows, data)
            elif 'Article Information' in first_header:
                self._extract_article_info_table(rows, data)
            elif 'Ordered pieces per size' in first_header:
                self._extract_size_orders_table(rows, data)
            elif 'HS code' in first_header:
                if len(headers) > 1:
                    data['hs_code'] = headers[1]
                self._extract_shipping_info_table(rows, data)
            elif 'Target group' in first_header:
                self._extract_target_group_table(rows, data)
            elif 'Sales Prices' in first_header:
                self._extract_sales_prices_table(rows, data)
        return data

    def _extract_mixed_supplier_table(self, rows: list, data: dict):
        current_section = 'supplier'
        size_orders: list = []

        for row in rows:
            if len(row) < 2:
                continue
            key = str(row[0]).strip() if row[0] else ''
            value = str(row[1]).strip() if row[1] else ''

            if 'Article Information' in key:
                current_section = 'article'
                continue
            elif 'Labels & Tags' in key or 'Hangers' in key:
                current_section = 'labels'
                continue
            elif 'Ordered pieces per size' in key:
                current_section = 'size_orders'
                continue

            if current_section == 'supplier':
                field_map = {
                    'Date': 'date', 'Supplier': 'supplier',
                    'Supplier no': 'supplier_no', 'Factory': 'factory',
                    'Factory no': 'factory_no', 'Buying group': 'buying_group',
                    'Country of departure': 'country_of_departure',
                    'Country of origin': 'country_of_origin',
                    'Port of loading': 'port_of_loading',
                    'Agent': 'agent', 'Manufacturer': 'manufacturer',
                }
                if 'Packing Rule' in key:
                    data['packing_rule'] = value
                elif key == 'Payment':
                    data['payment'] = self._clean_payment_value(value)
                elif key in field_map:
                    data[field_map[key]] = value

            elif current_section == 'article':
                field_map = {
                    'article description': 'article_description',
                    'material group': 'material_group',
                    'generic article no': 'generic_article_no',
                    'season': 'season',
                    'composition code': 'composition_code',
                    'marketing': 'marketing',
                    'colour': 'colour',
                    'color': 'colour',
                    'furniture': 'furniture',
                    'sub-brand': 'sub_brand',
                    'sub brand': 'sub_brand',
                }
                key_lower = key.lower().rstrip('.')
                for pattern, field_name in field_map.items():
                    if pattern in key_lower:
                        data[field_name] = value
                        break

            elif current_section == 'size_orders':
                if key == 'Article' or 'Total' in value:
                    continue
                qty_str = str(row[2]).strip() if len(row) > 2 and row[2] else ''
                if (key.replace('-', '').isdigit() or re.match(r'^\d+$', key)):
                    try:
                        qty = int(qty_str) if qty_str else 0
                        if qty > 0:
                            size_orders.append({'article': key, 'ean': value, 'quantity': qty})
                    except ValueError:
                        pass

        if size_orders:
            data['size_orders'] = size_orders

    @staticmethod
    def _clean_payment_value(payment_str: Optional[str]) -> Optional[str]:
        if not payment_str:
            return payment_str
        match = re.search(r'\bdate\b', payment_str, re.IGNORECASE)
        if match:
            return payment_str[:match.end()].strip()
        return payment_str

    @staticmethod
    def _extract_article_info_table(rows: list, data: dict):
        field_map = {
            'article description': 'article_description',
            'material group': 'material_group',
            'generic article no': 'generic_article_no',
            'season': 'season',
            'composition code': 'composition_code',
            'colour': 'colour',
            'color': 'colour',
            'furniture': 'furniture',
            'sub-brand': 'sub_brand',
            'sub brand': 'sub_brand',
        }
        for row in rows:
            if len(row) >= 2 and row[0]:
                key = str(row[0]).strip()
                value = str(row[1]).strip() if row[1] else None
                key_lower = key.lower().rstrip('.')
                for pattern, field_name in field_map.items():
                    if pattern in key_lower:
                        data[field_name] = value
                        break

    @staticmethod
    def _extract_size_orders_table(rows: list, data: dict):
        size_orders: list = []
        for row in rows:
            if len(row) >= 3:
                article = str(row[0]).strip() if row[0] else ''
                ean = str(row[1]).strip() if row[1] else ''
                qty_str = str(row[2]).strip() if row[2] else ''
                if article == 'Article' or 'Total' in qty_str or not article:
                    continue
                try:
                    size_orders.append({'article': article, 'ean': ean, 'quantity': int(qty_str)})
                except ValueError:
                    pass
        if size_orders:
            data['size_orders'] = size_orders

    @staticmethod
    def _extract_shipping_info_table(rows: list, data: dict):
        field_map = {
            'cargo delivery date': 'cargo_delivery_date',
            'shipment method': 'shipment_method',
            'delivery terms': 'delivery_terms',
            'dc date': 'dc_date',
            'presentation date': 'presentation_date',
        }
        for row in rows:
            if len(row) >= 2 and row[0]:
                key = str(row[0]).strip()
                key_lower = key.lower()
                for pattern, field_name in field_map.items():
                    if pattern in key_lower:
                        data[field_name] = str(row[1]).strip() if row[1] else None
                        break

    @staticmethod
    def _extract_target_group_table(rows: list, data: dict):
        field_map = {'Theme': 'theme', 'Segment': 'segment'}
        for row in rows:
            if len(row) >= 2 and row[0]:
                key = str(row[0]).strip()
                if key in field_map:
                    data[field_map[key]] = str(row[1]).strip() if row[1] else None

    @staticmethod
    def _extract_sales_prices_table(rows: list, data: dict):
        prices: list = []
        for row in rows:
            if len(row) >= 3:
                country = str(row[0]).strip() if row[0] else ''
                price = str(row[1]).strip() if row[1] else ''
                currency = str(row[2]).strip() if row[2] else ''
                if country and price and currency:
                    prices.append({'country': country, 'price': price, 'currency': currency})
        if prices:
            data['sales_prices'] = prices

    @staticmethod
    def _find_col(col_map: dict, *candidates: str) -> Optional[int]:
        """Find column index by trying multiple candidate header names."""
        for name in candidates:
            if name in col_map:
                return col_map[name]
            for key, idx in col_map.items():
                if name.lower() in key.lower():
                    return idx
        return None

    @staticmethod
    def _detect_column_shift(headers: list, rows: list) -> int:
        """Detect if columns are shifted left by checking value patterns."""
        col_map = {h: i for i, h in enumerate(headers)}
        desc_idx = None
        qty_idx = None
        for h, i in col_map.items():
            if 'description' in h.lower():
                desc_idx = i
            if 'order qty' in h.lower() or 'orderqty' in h.lower():
                qty_idx = i
        if desc_idx is None or qty_idx is None:
            return 0
        numeric_in_desc = 0
        total_checked = 0
        for row in rows[:10]:
            if len(row) <= max(desc_idx, qty_idx):
                continue
            desc_val = str(row[desc_idx]).strip() if row[desc_idx] else ''
            if not desc_val:
                continue
            total_checked += 1
            if desc_val.replace(',', '').replace('.', '').replace(' ', '').isdigit():
                numeric_in_desc += 1
        if total_checked >= 2 and numeric_in_desc >= total_checked * 0.6:
            return 1
        return 0

    def _extract_details(self, tables: list, extracted: dict) -> list:
        details = []
        po_number = (
            self._po_number
            or extracted.get('supplier_no')
            or extracted.get('generic_article_no')
        )
        for table in tables:
            headers = table.get('Headers', [])
            rows = table.get('Rows', [])
            has_position = any('position' in h.lower() for h in headers if h)
            has_article = any('article' in h.lower() for h in headers if h)
            if not has_position or not has_article:
                continue
            col_map = {h: i for i, h in enumerate(headers)}
            shift = self._detect_column_shift(headers, rows)

            for row in rows:
                if len(row) < max(len(headers) // 2, 2):
                    continue
                position = self.get_value(row, self._find_col(col_map, 'Position'))
                article = self.get_value(row, self._find_col(col_map, 'Article'))

                desc_idx = self._find_col(col_map, 'Description')
                qty_idx = self._find_col(col_map, 'Order Qty', 'Order qty', 'OrderQty')
                tot_idx = self._find_col(col_map, 'Tot.Pieces', 'TotPieces', 'Tot Pieces')
                dc_idx = self._find_col(col_map, 'DC')
                wh_idx = self._find_col(col_map, 'Warehouse')
                flow_idx = self._find_col(col_map, 'Flow')
                dest_idx = self._find_col(col_map, 'Destination')

                if shift > 0 and desc_idx is not None:
                    description = None
                    order_qty = self.get_value(row, desc_idx)
                    tot_pieces = self.get_value(row, qty_idx)
                    dc = self.get_value(row, tot_idx)
                    warehouse = self.get_value(row, dc_idx)
                    flow = self.get_value(row, wh_idx)
                    destination = self.get_value(row, flow_idx)
                else:
                    description = self.get_value(row, desc_idx)
                    order_qty = self.get_value(row, qty_idx)
                    tot_pieces = self.get_value(row, tot_idx)
                    dc = self.get_value(row, dc_idx)
                    warehouse = self.get_value(row, wh_idx)
                    flow = self.get_value(row, flow_idx)
                    destination = self.get_value(row, dest_idx)

                price_buying = self.get_value(row, self._find_col(
                    col_map, 'Price unit Buying', 'PriceUnit Buying',
                    'Price Unit Buying', 'Buying Price', 'Unit Price',
                ))
                packing_code = self.get_value(row, self._find_col(col_map, 'Packing Code'))

                qty_val = order_qty or tot_pieces
                if not position or 'Total' in str(qty_val):
                    continue

                size = self.extract_size_from_description(description)
                color = self.extract_color_from_description(description)
                ean = self._find_ean_for_article(extracted.get('size_orders', []), article)

                order_qty_int = self.safe_int(order_qty)
                tot_pieces_int = self.safe_int(tot_pieces)
                quantity = order_qty_int if order_qty_int else tot_pieces_int
                unit_price = None
                if price_buying:
                    try:
                        unit_price = float(str(price_buying).replace(',', '.'))
                    except (ValueError, TypeError):
                        pass

                details.append({
                    'po_number': po_number,
                    'product_code': article,
                    'color': color or extracted.get('colour'),
                    'size': size,
                    'unit_price': unit_price,
                    'quantity': order_qty_int if order_qty_int else quantity,
                    'total_pieces': tot_pieces_int or order_qty_int or quantity,
                    'unit': '件',
                    'delivery_date': self.format_date(extracted.get('cargo_delivery_date')),
                    'position': position,
                    'article': article,
                    'description': description,
                    'dc': dc,
                    'warehouse': warehouse,
                    'flow': flow,
                    'destination': destination,
                    'packing_code': packing_code,
                    'ean': ean,
                })
        return details

    @staticmethod
    def _find_ean_for_article(size_orders: list, article: Optional[str]) -> Optional[str]:
        if not size_orders or not article:
            return None
        for order in size_orders:
            if order.get('article') == article:
                return order.get('ean')
        return None
