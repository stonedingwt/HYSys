"""
Supplier 0978635 order handler.
Parses pre-extracted table JSON (from PaddleOCR + LLM structuring).
"""

import re
from typing import Optional
from mep.core.documents.base import OrderParserBase


class Supplier0978635Handler(OrderParserBase):

    @staticmethod
    def is_match(tables: list) -> bool:
        for table in tables:
            headers = table.get('Headers', [])
            rows = table.get('Rows', [])
            if not rows or 'Supplier' not in headers:
                continue
            supplier_idx = headers.index('Supplier')
            for row in rows:
                if supplier_idx < len(row) and row[supplier_idx] == '0978635':
                    return True
        return False

    def parse(self, tables: list, extra_fields: Optional[dict] = None) -> list:
        """Parse tables into order list.

        Args:
            tables: structured table JSON from LLM
            extra_fields: optional dict with 'po_number' and 'total_amount'
                          extracted via LLM from full text
        """
        extra_fields = extra_fields or {}
        self._po_number = extra_fields.get('po_number')
        self._total_amount = extra_fields.get('total_amount')

        extracted = self._extract_header_info(tables)
        details = self._extract_details(tables, extracted.get('po_number'))
        total_quantity = sum(d.get('quantity', 0) or 0 for d in details)

        order = {
            'po_number': self._po_number or extracted.get('po_number'),
            'customer_name': extracted.get('customer_name'),
            'country': extracted.get('country'),
            'total_quantity': str(total_quantity) if total_quantity else extracted.get('total_units'),
            'total_amount': self._total_amount or extracted.get('total_amount'),
            'brand': extracted.get('brand'),
            'contract_number': extracted.get('po_number'),
            'contract_date': self.format_date(extracted.get('issue_date')),
            'is_repeated': False,
            'currency': extracted.get('currency'),
            'sales_organization': extracted.get('sales_organization'),
            'payment_terms': extracted.get('payment_terms'),
            'business_type': extracted.get('business_type', '服装'),
            'issue_date': self.format_date(extracted.get('issue_date')),
            'cargo_delivery_date': self.format_date(extracted.get('delivery_date')),
            'presentation_date': self.format_date(extracted.get('presentation_date')),
            'article_description': extracted.get('article_description'),
            'generic_article_no': extracted.get('generic_article_no'),
            'delivery_location': extracted.get('delivery_location'),
            'delivery_terms': extracted.get('delivery_terms'),
            'agent': extracted.get('agent'),
            'details': details,
        }
        return [order]

    def _extract_header_info(self, tables: list) -> dict:
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
                    data['supplier_code'] = value
                elif 'Comp' in header and 'Store' in header:
                    data['sales_organization'] = value
                elif 'D. of Issue' in header:
                    data['issue_date'] = value
                elif 'Deliv. Date' in header:
                    data['delivery_date'] = value
                elif 'Delivery At' in header:
                    data['delivery_at'] = value
                    data['country'] = self.extract_country(value)
                    data['delivery_location'] = value
                elif 'Payment Terms' in header:
                    data['payment_terms'] = value
                elif 'Currency' in header and 'Delivery' in header:
                    data['currency'] = self.extract_currency(value)
                    data['delivery_terms'] = self.extract_delivery_terms(value)
                elif header == 'Agent':
                    data['agent'] = value
                    data['customer_name'] = value
                elif 'Total Units' in header:
                    data['total_units'] = self.clean_number(value)
                elif 'Gross Amount' in header:
                    data['total_amount'] = self.clean_number(value)

        data.setdefault('business_type', '服装')
        data.setdefault('brand', None)
        return data

    def _extract_details(self, tables: list, po_number: Optional[str]) -> list:
        details = []
        for table in tables:
            headers = table.get('Headers', [])
            rows = table.get('Rows', [])
            if 'Nº Line' not in headers and 'Reference' not in headers:
                continue
            col_idx = self._get_column_indices(headers)
            current_line = None
            current_serial = None
            current_color = None
            pending_detail = None

            for row in rows:
                if len(row) > 2 and 'Composition' in str(row):
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

                    detail = {
                        'po_number': self._po_number or po_number,
                        'product_code': reference.strip(),
                        'customer_product_code': self.extract_product_code(current_serial),
                        'color': current_color,
                        'size': size,
                        'unit_price': str(unit_price) if unit_price else None,
                        'quantity': int(qty) if qty else None,
                        'total_price': str(total) if total else None,
                        'unit': '件',
                        'reference': reference.strip(),
                        'position': current_line,
                        'article': self.extract_product_code(current_serial),
                        'description': None,
                        'total_pieces': int(qty) if qty else None,
                        'ean': None,
                        'final_sale_price': str(sale_price) if sale_price else None,
                    }
                    pending_detail = detail
                    details.append(detail)
                elif pending_detail and serial and serial.strip():
                    ean_value = self.get_value(row, col_idx.get('ean'))
                    if ean_value and ean_value.strip():
                        pending_detail['ean'] = ean_value.strip()
                    pending_detail['description'] = serial.strip()
        return details

    @staticmethod
    def _get_column_indices(headers: list) -> dict:
        indices: dict = {}
        for i, h in enumerate(headers):
            h_lower = str(h).lower() if h else ''
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
                'quantity': 8, 'unit_price': 11, 'sale_price': 15, 'ean': 6,
            }
        return indices
