"""
Generic order format handler.
Supports key-value pair format and original table format.
Parses pre-extracted table JSON (from PaddleOCR + LLM structuring).
"""

import re
from typing import Optional
from mep.core.documents.base import OrderParserBase


class GenericFormatHandler(OrderParserBase):

    def parse(self, tables: list, extra_fields: Optional[dict] = None) -> dict:
        """Parse tables into a single order dict.

        Args:
            tables: structured table JSON from LLM
            extra_fields: optional dict with 'po_number', 'total_amount',
                          'generic_article_no', 'cargo_delivery_date',
                          'presentation_date', 'article_description',
                          'delivery_terms', 'buying_price'
        """
        extra_fields = extra_fields or {}
        self._po_number = extra_fields.get('po_number')
        self._total_amount = extra_fields.get('total_amount')
        self._extra_fields = extra_fields

        fmt = self._detect_format_type(tables)
        if fmt == 'key_value':
            return self._parse_key_value_format(tables)
        return self._parse_original_format(tables)

    # ──────── Format detection ────────

    @staticmethod
    def _detect_format_type(tables: list) -> str:
        for table in tables:
            headers = table.get('Headers', [])
            rows = table.get('Rows', [])
            if headers:
                first_header = headers[0] or ''
                if 'Supplier' in first_header or 'Article Information' in first_header:
                    if rows and len(rows[0]) == 2 and rows[0][0] in ('Date', 'Supplier', 'Article description'):
                        return 'key_value'
            if 'Position' in headers and 'Article' in headers:
                return 'key_value'
        return 'original'

    # ──────── Key-value format ────────

    def _parse_key_value_format(self, tables: list):
        article_count = sum(
            1 for t in tables
            if t.get('Headers') and 'Article Information' in (t['Headers'][0] or '')
        )
        if article_count > 1:
            return self._parse_multi_article_format(tables)
        return self._parse_single_article_format(tables)

    def _parse_single_article_format(self, tables: list) -> dict:
        extracted: dict = {}
        split_info = None
        split_qty = None

        for table in tables:
            headers = table.get('Headers', [])
            rows = table.get('Rows', [])
            if not rows:
                continue
            first_header = headers[0] if headers else ''

            if 'Supplier' in first_header and len(headers) <= 2:
                extracted.update(self._parse_kv_table(rows))
            elif 'Article Information' in first_header:
                extracted.update(self._parse_kv_table(rows))
            elif 'Ordered pieces per size' in first_header:
                extracted.setdefault('size_orders', []).extend(self._parse_size_orders(rows))
            elif 'HS code' in first_header:
                extracted['hs_code'] = headers[1] if len(headers) > 1 else None
                extracted.update(self._parse_kv_table(rows))
            elif 'Sales Prices' in first_header:
                extracted['sales_prices'] = self._parse_sales_prices(rows)
            elif 'Position' in headers and 'Article' in headers and 'Order Qty' in headers:
                extracted.setdefault('position_details', []).extend(
                    self._parse_position_details(headers, rows)
                )
            elif ('Position' in headers and 'Article' in headers
                  and 'Description' in headers and 'Order Qty' not in headers):
                split_info = (headers, rows)
            elif 'Order Qty' in headers and 'Tot.Pieces' in headers and 'Position' not in headers:
                split_qty = (headers, rows)
                if split_info:
                    merged = self._merge_split_position_tables(split_info, split_qty)
                    extracted.setdefault('position_details', []).extend(merged)
                    split_info = None
            elif 'Target group' in first_header:
                extracted.update(self._parse_kv_table(rows))
            else:
                if 'Shipment' in first_header or 'Payment' in first_header:
                    extracted.update(self._parse_kv_table(rows))

        total_qty = self._calculate_total_quantity(extracted)
        ef = self._extra_fields or {}
        issue_date = (
            self.format_date(extracted.get('Date'))
            or self.format_date(ef.get('date_of_issue'))
        )
        payment_terms = (
            self.clean_value(extracted.get('Payment'))
            or ef.get('payment_terms')
        )
        return {
            'po_number': self._po_number or extracted.get('Supplier no') or extracted.get('Generic article no.'),
            'customer_name': self.clean_supplier_name(extracted.get('Supplier')) or ef.get('customer_name'),
            'country': self.extract_country_from_code(extracted.get('Country of origin')),
            'total_quantity': total_qty,
            'total_amount': self._total_amount,
            'brand': extracted.get('Sub-Brand'),
            'contract_number': extracted.get('Supplier no'),
            'contract_date': issue_date,
            'issue_date': issue_date,
            'is_repeated': False,
            'currency': self.extract_main_currency(extracted.get('sales_prices')),
            'sales_organization': extracted.get('Buying group'),
            'payment_terms': payment_terms,
            'business_type': extracted.get('Material group') or '服装',
            'delivery_date': (
                self.format_date(extracted.get('Cargo delivery date'))
                or self.format_date(ef.get('cargo_delivery_date'))
            ),
            'cargo_delivery_date': (
                self.format_date(extracted.get('Cargo delivery date'))
                or self.format_date(ef.get('cargo_delivery_date'))
            ),
            'delivery_at': extracted.get('Port of loading'),
            'delivery_terms': extracted.get('Delivery terms') or ef.get('delivery_terms'),
            'factory': extracted.get('Factory'),
            'factory_no': self.clean_value(extracted.get('Factory no')),
            'article_description': (
                extracted.get('Article description')
                or ef.get('article_description')
            ),
            'generic_article_no': (
                extracted.get('Generic article no.')
                or ef.get('generic_article_no')
            ),
            'colour': extracted.get('Colour'),
            'composition': extracted.get('Composition code Marketing') or extracted.get('Composition code'),
            'season': extracted.get('Season'),
            'hs_code': extracted.get('hs_code') or extracted.get('HS code'),
            'shipment_method': extracted.get('Shipment method'),
            'dc_date': self.format_date(extracted.get('DC date')),
            'presentation_date': (
                self.format_date(extracted.get('Presentation date'))
                or self.format_date(ef.get('presentation_date'))
            ),
            'theme': extracted.get('Theme'),
            'sales_prices': extracted.get('sales_prices'),
            'details': self._build_details_from_positions(extracted),
        }

    def _parse_multi_article_format(self, tables: list) -> dict:
        common_info: dict = {}
        for table in tables:
            headers = table.get('Headers', [])
            rows = table.get('Rows', [])
            if headers and 'Supplier' in (headers[0] or '') and len(headers) <= 2:
                common_info.update(self._parse_kv_table(rows))
                break

        article_groups = self._group_tables_by_article(tables)
        articles = []
        all_details = []
        total_quantity = 0

        for group in article_groups:
            article_data = self._parse_article_group(group, common_info)
            if article_data:
                articles.append(article_data)
                all_details.extend(article_data.get('details', []))
                total_quantity += article_data.get('total_quantity', 0) or 0

        first = articles[0] if articles else {}
        ef = self._extra_fields or {}
        issue_date = (
            self.format_date(common_info.get('Date'))
            or self.format_date(ef.get('date_of_issue'))
        )
        payment_terms = (
            self.clean_value(common_info.get('Payment'))
            or ef.get('payment_terms')
        )
        return {
            'po_number': self._po_number or common_info.get('Supplier no') or first.get('po_number'),
            'customer_name': self.clean_supplier_name(common_info.get('Supplier')) or ef.get('customer_name'),
            'country': self.extract_country_from_code(common_info.get('Country of origin')),
            'total_quantity': total_quantity,
            'total_amount': self._total_amount,
            'brand': first.get('brand'),
            'contract_number': common_info.get('Supplier no'),
            'contract_date': issue_date,
            'issue_date': issue_date,
            'is_repeated': False,
            'currency': first.get('currency', 'EUR'),
            'sales_organization': common_info.get('Buying group'),
            'payment_terms': payment_terms,
            'business_type': first.get('business_type') or '服装',
            'factory': common_info.get('Factory'),
            'factory_no': self.clean_value(common_info.get('Factory no')),
            'season': first.get('season'),
            'generic_article_no': ', '.join(
                a['generic_article_no'] for a in articles if a.get('generic_article_no')
            ) or ef.get('generic_article_no'),
            'article_description': first.get('article_description') or ef.get('article_description'),
            'cargo_delivery_date': first.get('delivery_date') or self.format_date(ef.get('cargo_delivery_date')),
            'presentation_date': first.get('presentation_date') or self.format_date(ef.get('presentation_date')),
            'delivery_terms': first.get('delivery_terms') or ef.get('delivery_terms'),
            'articles': articles,
            'details': all_details,
        }

    # ──────── Original table format ────────

    def _parse_original_format(self, tables: list) -> dict:
        extracted = self._extract_all_tables(tables)
        ef = self._extra_fields or {}
        issue_date = (
            self.format_date(extracted.get('issue_date'))
            or self.format_date(ef.get('date_of_issue'))
        )
        payment_terms = (
            extracted.get('payment_terms')
            or ef.get('payment_terms')
        )
        return {
            'po_number': extracted.get('po_number') or self._po_number,
            'customer_name': extracted.get('agent') or ef.get('customer_name'),
            'country': self.extract_country(extracted.get('delivery_at', '')),
            'total_quantity': self.clean_number(extracted.get('total_units')) or ef.get('total_quantity'),
            'total_amount': self.clean_number(extracted.get('gross_amount')) or self._total_amount,
            'brand': None,
            'contract_number': extracted.get('po_number'),
            'contract_date': issue_date,
            'issue_date': issue_date,
            'is_repeated': False,
            'currency': self.extract_currency(extracted.get('currency_terms', '')),
            'sales_organization': extracted.get('comp_store'),
            'payment_terms': payment_terms,
            'business_type': '服装',
            'delivery_date': self.format_date(extracted.get('delivery_date')) or self.format_date(ef.get('cargo_delivery_date')),
            'cargo_delivery_date': self.format_date(extracted.get('delivery_date')) or self.format_date(ef.get('cargo_delivery_date')),
            'delivery_at': extracted.get('delivery_at'),
            'delivery_terms': ef.get('delivery_terms'),
            'supplier_code': extracted.get('supplier'),
            'generic_article_no': ef.get('generic_article_no'),
            'article_description': ef.get('article_description'),
            'presentation_date': self.format_date(ef.get('presentation_date')),
            'details': self._parse_details(tables, extracted.get('po_number')),
        }

    # ──────── helpers ────────

    @staticmethod
    def _parse_kv_table(rows: list) -> dict:
        data: dict = {}
        for row in rows:
            if len(row) >= 2 and row[0]:
                data[str(row[0]).strip()] = str(row[1]).strip() if row[1] else None
        return data

    @staticmethod
    def _parse_size_orders(rows: list) -> list:
        orders: list = []
        for row in rows:
            if len(row) >= 3:
                article = str(row[0]).strip() if row[0] else ''
                ean = str(row[1]).strip() if row[1] else ''
                qty = str(row[2]).strip() if row[2] else ''
                if article == 'Article' or 'Total' in qty:
                    continue
                if article and ean and qty:
                    try:
                        orders.append({'article': article, 'ean': ean, 'quantity': int(qty)})
                    except ValueError:
                        pass
        return orders

    @staticmethod
    def _parse_sales_prices(rows: list) -> list:
        prices: list = []
        for row in rows:
            if len(row) >= 3:
                country = str(row[0]).strip() if row[0] else ''
                price = str(row[1]).strip() if row[1] else ''
                currency = str(row[2]).strip() if row[2] else ''
                if country and price and currency:
                    prices.append({'country': country, 'price': price, 'currency': currency})
        return prices

    @staticmethod
    def _looks_numeric(value) -> bool:
        """Check if a value looks like a number (for column validation)."""
        if not value:
            return False
        cleaned = str(value).replace(',', '').replace('.', '').replace(' ', '').strip()
        return cleaned.isdigit()

    @staticmethod
    def _detect_column_shift(headers: list, sample_rows: list) -> int:
        """Detect if columns are shifted by checking value patterns.

        Returns the number of positions to shift right (positive = shift right to fix).
        Common case: Description column missing causes all subsequent columns
        to shift left by 1.
        """
        col_map = {h: i for i, h in enumerate(headers)}
        desc_idx = None
        qty_idx = None
        for name in ('Description',):
            if name in col_map:
                desc_idx = col_map[name]
                break
            for key, idx in col_map.items():
                if name.lower() in key.lower():
                    desc_idx = idx
                    break
        for name in ('Order Qty', 'Order qty', 'OrderQty'):
            if name in col_map:
                qty_idx = col_map[name]
                break
            for key, idx in col_map.items():
                if name.lower() in key.lower():
                    qty_idx = idx
                    break

        if desc_idx is None or qty_idx is None:
            return 0

        numeric_in_desc = 0
        text_in_qty = 0
        total_checked = 0
        for row in sample_rows[:10]:
            if len(row) <= max(desc_idx, qty_idx):
                continue
            desc_val = str(row[desc_idx]).strip() if row[desc_idx] else ''
            qty_val = str(row[qty_idx]).strip() if row[qty_idx] else ''
            if not desc_val and not qty_val:
                continue
            total_checked += 1
            if desc_val and desc_val.replace(',', '').replace('.', '').replace(' ', '').isdigit():
                numeric_in_desc += 1
            if qty_val and not qty_val.replace(',', '').replace('.', '').replace(' ', '').isdigit() and len(qty_val) > 3:
                text_in_qty += 1

        if total_checked >= 2 and numeric_in_desc >= total_checked * 0.6:
            return 1
        return 0

    def _parse_position_details(self, headers: list, rows: list) -> list:
        details: list = []
        col_map = {h: i for i, h in enumerate(headers)}

        shift = self._detect_column_shift(headers, rows)

        def _find_col(*candidates: str):
            for name in candidates:
                if name in col_map:
                    return col_map[name]
                for key, idx in col_map.items():
                    if name.lower() in key.lower():
                        return idx
            return None

        for row in rows:
            if len(row) < max(len(headers) // 2, 2):
                continue
            position = self.get_value(row, _find_col('Position'))
            order_qty_idx = _find_col('Order Qty', 'Order qty', 'OrderQty')
            order_qty = self.get_value(row, order_qty_idx)
            if not position or 'Total' in str(order_qty):
                continue

            desc_idx = _find_col('Description')

            if shift > 0 and desc_idx is not None:
                actual_desc_idx = desc_idx
                actual_qty_idx = order_qty_idx
                actual_tot_idx = _find_col('Tot.Pieces', 'TotPieces', 'Tot Pieces')
                actual_dc_idx = _find_col('DC')
                actual_wh_idx = _find_col('Warehouse')
                actual_flow_idx = _find_col('Flow')
                actual_dest_idx = _find_col('Destination')

                description = None
                order_qty = self.get_value(row, actual_desc_idx)
                total_pieces_val = self.get_value(row, actual_qty_idx)
                dc_val = self.get_value(row, actual_tot_idx) if actual_tot_idx is not None else None
                wh_val = self.get_value(row, actual_dc_idx) if actual_dc_idx is not None else None
                flow_val = self.get_value(row, actual_wh_idx) if actual_wh_idx is not None else None
                dest_val = self.get_value(row, actual_flow_idx) if actual_flow_idx is not None else None
            else:
                description = self.get_value(row, desc_idx)
                total_pieces_val = self.get_value(row, _find_col('Tot.Pieces', 'TotPieces', 'Tot Pieces'))
                dc_val = self.get_value(row, _find_col('DC'))
                wh_val = self.get_value(row, _find_col('Warehouse'))
                flow_val = self.get_value(row, _find_col('Flow'))
                dest_val = self.get_value(row, _find_col('Destination'))

            price_buying = self.get_value(row, _find_col(
                'Price unit Buying', 'PriceUnit Buying',
                'Price Unit Buying', 'Buying Price',
            ))
            unit_price = None
            if price_buying:
                try:
                    unit_price = float(str(price_buying).replace(',', '.'))
                except (ValueError, TypeError):
                    pass

            details.append({
                'position': position,
                'article': self.get_value(row, _find_col('Article')),
                'description': description,
                'order_qty': self.safe_int(order_qty),
                'total_pieces': self.safe_int(total_pieces_val),
                'price_unit_buying': unit_price,
                'dc': dc_val,
                'warehouse': wh_val,
                'flow': flow_val,
                'destination': dest_val,
                'packing_code': self.get_value(row, _find_col('Packing Code')),
                'size': self.extract_size_from_description(description),
                'color': self.extract_color_from_description(description),
            })
        return details

    def _merge_split_position_tables(self, info_table, qty_table) -> list:
        info_headers, info_rows = info_table
        qty_headers, qty_rows = qty_table
        info_col_map = {h: i for i, h in enumerate(info_headers)}
        qty_col_map = {h: i for i, h in enumerate(qty_headers)}
        details: list = []

        def _find_col(col_map, *candidates):
            for name in candidates:
                if name in col_map:
                    return col_map[name]
                for key, idx in col_map.items():
                    if name.lower() in key.lower():
                        return idx
            return None

        qty_shift = self._detect_column_shift(qty_headers, qty_rows)

        for i, info_row in enumerate(info_rows):
            position = self.get_value(info_row, _find_col(info_col_map, 'Position'))
            if not position or 'Total' in str(position):
                continue
            qty_row = qty_rows[i] if i < len(qty_rows) else []
            order_qty = self.get_value(qty_row, _find_col(qty_col_map, 'Order Qty', 'Order qty'))
            if 'Total' in str(order_qty):
                continue
            description = self.get_value(info_row, _find_col(info_col_map, 'Description'))

            if qty_shift > 0:
                desc_idx = _find_col(qty_col_map, 'Description')
                qty_idx = _find_col(qty_col_map, 'Order Qty', 'Order qty')
                tot_idx = _find_col(qty_col_map, 'Tot.Pieces', 'Tot Pieces')
                dc_idx = _find_col(qty_col_map, 'DC')
                wh_idx = _find_col(qty_col_map, 'Warehouse')
                flow_idx = _find_col(qty_col_map, 'Flow')

                order_qty = self.get_value(qty_row, desc_idx)
                total_pieces_val = self.get_value(qty_row, qty_idx)
                dc_val = self.get_value(qty_row, tot_idx)
                wh_val = self.get_value(qty_row, dc_idx)
                flow_val = self.get_value(qty_row, wh_idx)
                dest_val = self.get_value(qty_row, flow_idx)
            else:
                total_pieces_val = self.get_value(qty_row, _find_col(qty_col_map, 'Tot.Pieces', 'Tot Pieces'))
                dc_val = self.get_value(qty_row, _find_col(qty_col_map, 'DC'))
                wh_val = self.get_value(qty_row, _find_col(qty_col_map, 'Warehouse'))
                flow_val = self.get_value(qty_row, _find_col(qty_col_map, 'Flow'))
                dest_val = self.get_value(qty_row, _find_col(qty_col_map, 'Destination'))

            price_buying = self.get_value(qty_row, _find_col(
                qty_col_map, 'Price unit Buying', 'PriceUnit Buying',
                'Price Unit Buying', 'Buying Price',
            ))
            unit_price = None
            if price_buying:
                try:
                    unit_price = float(str(price_buying).replace(',', '.'))
                except (ValueError, TypeError):
                    pass

            details.append({
                'position': position,
                'article': self.get_value(info_row, _find_col(info_col_map, 'Article')),
                'description': description,
                'order_qty': self.safe_int(order_qty),
                'total_pieces': self.safe_int(total_pieces_val),
                'price_unit_buying': unit_price,
                'dc': dc_val,
                'warehouse': wh_val,
                'flow': flow_val,
                'destination': dest_val,
                'packing_code': self.get_value(qty_row, _find_col(qty_col_map, 'Packing Code')),
                'size': self.extract_size_from_description(description),
                'color': self.extract_color_from_description(description),
            })
        return details

    @staticmethod
    def _group_tables_by_article(tables: list) -> list:
        groups: list = []
        current: list = []
        for table in tables:
            headers = table.get('Headers', [])
            first_header = headers[0] if headers else ''
            if 'Article Information' in first_header:
                if current:
                    groups.append(current)
                current = [table]
            elif current:
                current.append(table)
        if current:
            groups.append(current)
        return groups

    def _parse_article_group(self, tables: list, common_info: dict) -> dict:
        extracted = dict(common_info)
        split_info = None

        for table in tables:
            headers = table.get('Headers', [])
            rows = table.get('Rows', [])
            if not rows:
                continue
            first_header = headers[0] if headers else ''
            if 'Article Information' in first_header:
                extracted.update(self._parse_kv_table(rows))
            elif 'Ordered pieces per size' in first_header:
                extracted.setdefault('size_orders', []).extend(self._parse_size_orders(rows))
            elif 'HS code' in first_header:
                extracted['hs_code'] = headers[1] if len(headers) > 1 else None
                extracted.update(self._parse_kv_table(rows))
            elif 'Sales Prices' in first_header:
                extracted['sales_prices'] = self._parse_sales_prices(rows)
            elif 'Position' in headers and 'Article' in headers and 'Order Qty' in headers:
                extracted.setdefault('position_details', []).extend(
                    self._parse_position_details(headers, rows)
                )
            elif ('Position' in headers and 'Article' in headers
                  and 'Description' in headers and 'Order Qty' not in headers):
                split_info = (headers, rows)
            elif 'Order Qty' in headers and 'Tot.Pieces' in headers and 'Position' not in headers:
                if split_info:
                    merged = self._merge_split_position_tables(split_info, (headers, rows))
                    extracted.setdefault('position_details', []).extend(merged)
                    split_info = None
            elif 'Shipment' in first_header:
                extracted.update(self._parse_kv_table(rows))

        total_qty = self._calculate_total_quantity(extracted)
        return {
            'generic_article_no': extracted.get('Generic article no.'),
            'article_description': extracted.get('Article description'),
            'colour': extracted.get('Colour'),
            'composition': extracted.get('Composition code Marketing') or extracted.get('Composition code'),
            'season': extracted.get('Season'),
            'sub_brand': extracted.get('Sub-Brand'),
            'hs_code': extracted.get('hs_code'),
            'delivery_date': self.format_date(extracted.get('Cargo delivery date')),
            'shipment_method': extracted.get('Shipment method'),
            'delivery_terms': extracted.get('Delivery terms'),
            'dc_date': self.format_date(extracted.get('DC date')),
            'presentation_date': self.format_date(extracted.get('Presentation date')),
            'sales_prices': extracted.get('sales_prices'),
            'total_quantity': total_qty,
            'po_number': self._po_number or extracted.get('Supplier no') or extracted.get('Generic article no.'),
            'brand': extracted.get('Sub-Brand'),
            'currency': self.extract_main_currency(extracted.get('sales_prices')),
            'business_type': extracted.get('Material group'),
            'remarks': extracted.get('Delivery terms'),
            'details': self._build_details_from_positions(
                extracted, extracted.get('Generic article no.'),
                article_no=extracted.get('Generic article no.'),
            ),
        }

    @staticmethod
    def _calculate_total_quantity(extracted: dict):
        if 'position_details' in extracted:
            seen = set()
            total = 0
            for d in extracted['position_details']:
                pos = d.get('position')
                if pos and pos not in seen:
                    seen.add(pos)
                    total += d.get('total_pieces', 0) or 0
            if total > 0:
                return total
        if 'size_orders' in extracted:
            total = sum(item.get('quantity', 0) for item in extracted['size_orders'])
            if total > 0:
                return total
        return None

    def _build_details_from_positions(self, extracted: dict, override_po=None, article_no=None) -> list:
        details: list = []
        if 'position_details' not in extracted:
            return details
        po = (self._po_number or override_po
              or extracted.get('Supplier no')
              or extracted.get('Generic article no.'))
        ef = self._extra_fields or {}
        buying_price = ef.get('buying_price')
        for pos in extracted['position_details']:
            unit_price = pos.get('price_unit_buying')
            if not unit_price and buying_price:
                try:
                    unit_price = float(str(buying_price).replace(',', '.'))
                except (ValueError, TypeError):
                    unit_price = None
            detail_article = article_no or pos.get('article')
            details.append({
                'po_number': po,
                'product_code': detail_article,
                'color': pos.get('color'),
                'size': pos.get('size'),
                'quantity': pos.get('order_qty'),
                'total_pieces': pos.get('total_pieces'),
                'unit_price': unit_price,
                'article': detail_article,
                'description': pos.get('description'),
                'position': pos.get('position'),
                'dc': pos.get('dc'),
                'warehouse': pos.get('warehouse'),
                'destination': pos.get('destination'),
                'flow': pos.get('flow'),
                'packing_code': pos.get('packing_code'),
            })
        return details

    def _extract_all_tables(self, tables: list) -> dict:
        data: dict = {}
        for table in tables:
            headers = table.get('Headers', [])
            rows = table.get('Rows', [])
            if not rows:
                continue
            row = rows[0]
            for i, header in enumerate(headers):
                if i >= len(row):
                    continue
                value = row[i]
                if 'PO' in header and 'Nº' in header:
                    data['po_number'] = value
                elif header == 'Supplier':
                    data['supplier'] = value
                elif 'Comp' in header and 'Store' in header:
                    data['comp_store'] = value
                elif 'D. of Issue' in header or 'Issue' in header:
                    data['issue_date'] = value
                elif 'Deliv. Date' in header:
                    data['delivery_date'] = value
                elif 'Delivery At' in header:
                    data['delivery_at'] = value
                elif 'Payment Terms' in header:
                    data['payment_terms'] = value
                elif 'Currency' in header:
                    data['currency_terms'] = value
                elif 'Agent' in header:
                    data['agent'] = value
                elif 'Total Units' in header:
                    data['total_units'] = value
                elif 'Gross Amount' in header:
                    data['gross_amount'] = value
        return data

    def _parse_details(self, tables: list, po_number: Optional[str]) -> list:
        details: list = []
        for table in tables:
            headers = table.get('Headers', [])
            rows = table.get('Rows', [])
            if 'Nº Line' not in headers and 'Reference' not in headers:
                continue
            col_idx = self._get_column_indices_original(headers)
            current_line = None
            current_serial = None
            current_color = None

            for row in rows:
                if len(row) > 0 and row[0] == '' and 'Composition' in str(row):
                    continue
                line_num = self.get_value(row, col_idx.get('line_num'))
                serial = self.get_value(row, col_idx.get('serial'))
                reference = self.get_value(row, col_idx.get('reference'))
                quantity = self.get_value(row, col_idx.get('quantity'))
                unit_price = self.get_value(row, col_idx.get('unit_price'))
                sale_price = self.get_value(row, col_idx.get('sale_price'))
                color = self.get_value(row, col_idx.get('color'))

                if line_num and line_num.strip():
                    current_line = line_num.strip()
                if serial and serial.strip():
                    current_serial = serial.strip()
                if color and color.strip():
                    current_color = color.strip()

                if reference and reference.strip() and quantity:
                    size = self.extract_size_from_reference(reference)
                    qty = self.parse_number(quantity)
                    price = self.parse_number(unit_price)
                    total = round(qty * price, 2) if qty and price else None
                    details.append({
                        'po_number': po_number,
                        'product_code': reference.strip(),
                        'customer_product_code': self.extract_product_code(current_serial),
                        'color': current_color,
                        'size': size,
                        'quantity': int(qty) if qty else None,
                        'unit_price': unit_price,
                        'total_price': str(total) if total else None,
                        'final_sale_price': sale_price,
                        'ean': None,
                        'position': current_line,
                    })
                elif serial and serial.strip() and details:
                    ean_val = self.get_value(row, col_idx.get('ean'))
                    if ean_val and ean_val.strip():
                        details[-1]['ean'] = ean_val.strip()
                    details[-1]['description'] = serial.strip()
        return details

    @staticmethod
    def _get_column_indices_original(headers: list) -> dict:
        indices: dict = {}
        for i, h in enumerate(headers):
            h_lower = (h or '').lower()
            if 'nº line' in h_lower or 'line' in h_lower:
                indices['line_num'] = i
            elif 'serial' in h_lower:
                indices['serial'] = i
            elif 'reference' in h_lower:
                indices['reference'] = i
            elif 'quantity' in h_lower or 'wide quantity' in h_lower:
                indices['quantity'] = i
            elif 'price unit' in h_lower:
                indices['unit_price'] = i
            elif 'final sale' in h_lower:
                indices['sale_price'] = i
            elif 'ean' in h_lower:
                indices['ean'] = i
            elif 'colour' in h_lower or 'color' in h_lower:
                indices['color'] = i
        if not indices:
            indices = {
                'line_num': 0, 'serial': 1, 'color': 3, 'reference': 6,
                'quantity': 8, 'unit_price': 11, 'sale_price': 15,
            }
        return indices
