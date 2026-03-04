"""
Base class with utility methods for order parsing.
No remote API calls - all parsing works on pre-extracted table data.
"""

import re
from typing import Optional


class OrderParserBase:
    """Utility base class for sales order table parsing."""

    @staticmethod
    def get_value(row: list, idx: Optional[int]):
        if idx is None or idx >= len(row):
            return None
        v = row[idx]
        return str(v).strip() if v else None

    @staticmethod
    def clean_number(value) -> Optional[str]:
        if not value:
            return None
        return str(value).replace('.', '').replace(',', '.')

    @staticmethod
    def parse_number(value) -> Optional[float]:
        if not value:
            return None
        try:
            return float(str(value).replace(',', '.'))
        except ValueError:
            return None

    @staticmethod
    def safe_int(value) -> Optional[int]:
        if not value:
            return None
        try:
            return int(str(value).replace(',', '').strip())
        except (ValueError, TypeError):
            return None

    @staticmethod
    def format_date(date_str: Optional[str]) -> Optional[str]:
        if not date_str:
            return None
        try:
            parts = date_str.strip().split('.')
            if len(parts) == 3:
                return f'{parts[2]}-{parts[1]}-{parts[0]}'
        except Exception:
            pass
        return date_str

    @staticmethod
    def clean_value(value) -> Optional[str]:
        if not value:
            return None
        value = str(value)
        value = re.sub(r':unselected:|:selected:', '', value)
        value = value.replace('\n', ' ').strip()
        return value if value else None

    @staticmethod
    def clean_supplier_name(name) -> Optional[str]:
        if not name:
            return None
        name = str(name).replace('\u201c', '"').replace('\u201d', '"')
        name = name.replace('\u2018', "'").replace('\u2019', "'")
        name = re.sub(r'INT["\u201c\u201d\u2018\u2019]L', "INT'L", name)
        return name.strip()

    @staticmethod
    def extract_country(delivery_at: Optional[str]) -> Optional[str]:
        if not delivery_at:
            return None
        spain_cities = ['Barcelona', 'Madrid', 'Valencia', 'Sevilla']
        for city in spain_cities:
            if city.lower() in delivery_at.lower():
                return 'Spain'
        return None

    @staticmethod
    def extract_country_from_code(code: Optional[str]) -> Optional[str]:
        if not code:
            return None
        country_map = {
            'CN': '中国', 'US': 'United States', 'DE': 'Germany',
            'NL': 'Netherlands', 'FR': 'France', 'GB': 'United Kingdom',
            'ES': 'Spain', 'IT': 'Italy', 'JP': 'Japan', 'KR': 'South Korea',
            'VN': '越南', 'BD': '孟加拉', 'IN': '印度',
            'PK': '巴基斯坦', 'TR': '土耳其',
        }
        return country_map.get(code.upper(), code)

    @staticmethod
    def extract_currency(currency_terms: Optional[str]) -> Optional[str]:
        if not currency_terms:
            return None
        parts = str(currency_terms).strip().split()
        return parts[0] if parts else None

    @staticmethod
    def extract_delivery_terms(currency_terms: Optional[str]) -> Optional[str]:
        if not currency_terms:
            return None
        parts = str(currency_terms).strip().split(None, 1)
        return parts[1] if len(parts) > 1 else None

    @staticmethod
    def extract_main_currency(sales_prices) -> str:
        if not sales_prices:
            return 'EUR'
        currency_count: dict[str, int] = {}
        for price in sales_prices:
            curr = price.get('currency')
            if curr:
                currency_count[curr] = currency_count.get(curr, 0) + 1
        if currency_count:
            return max(currency_count, key=currency_count.get)
        return 'EUR'

    @staticmethod
    def is_total_row(row: list) -> bool:
        """Check if a row is a Total/summary row by looking at all cells."""
        for cell in row:
            if cell and re.search(r'\bTotal\b', str(cell), re.IGNORECASE):
                return True
        return False

    @staticmethod
    def extract_size_from_description(description: Optional[str]) -> Optional[str]:
        if not description:
            return None
        sizes = ['3XL', '2XL', 'XXL', 'XL', 'XXS', 'XS', 'L', 'M', 'S']
        clean_desc = re.sub(r'\n:selected:.*$', '', description).strip()
        parts = clean_desc.split(',')
        if len(parts) >= 2:
            last_part = parts[-1].strip()
            bra_match = re.match(r'^([A-H]\d{2,3})$', last_part)
            if bra_match:
                return bra_match.group(1)
            for size in sizes:
                if last_part.upper() == size:
                    return size
            if re.match(r'^\d{2,3}$', last_part):
                return last_part
        bra_match = re.search(r',\s*([A-H]\d{2,3})(?:\s*$|,)', clean_desc)
        if bra_match:
            return bra_match.group(1)
        for size in sizes:
            pattern = re.compile(r',\s*' + re.escape(size) + r'\s*(?:,|$)', re.IGNORECASE)
            if pattern.search(clean_desc):
                return size
            if clean_desc.upper().rstrip().endswith(size):
                trailing = clean_desc.upper().rstrip()
                idx = len(trailing) - len(size)
                if idx == 0 or not trailing[idx - 1].isalpha():
                    return size
        num_match = re.search(r',\s*(\d{2,3})\s*$', clean_desc)
        if num_match:
            return num_match.group(1)
        return None

    @staticmethod
    def extract_color_from_description(description: Optional[str]) -> Optional[str]:
        if not description:
            return None
        parts = description.split(',')
        return parts[1].strip() if len(parts) >= 2 else None

    @staticmethod
    def extract_size_from_reference(reference: Optional[str]) -> Optional[str]:
        if not reference:
            return None
        parts = reference.strip().split()
        return parts[-1] if len(parts) >= 2 else None

    @staticmethod
    def extract_product_code(serial: Optional[str]) -> Optional[str]:
        if not serial:
            return None
        parts = serial.strip().split()
        return parts[0] if parts else None
