-- Sales Order schema upgrade: add new columns to header and line tables

ALTER TABLE sales_order_header
  ADD COLUMN country VARCHAR(100) DEFAULT NULL AFTER reference,
  ADD COLUMN brand VARCHAR(100) DEFAULT NULL AFTER country,
  ADD COLUMN season VARCHAR(50) DEFAULT NULL AFTER brand,
  ADD COLUMN factory VARCHAR(200) DEFAULT NULL AFTER season,
  ADD COLUMN source_file_url TEXT DEFAULT NULL AFTER factory,
  ADD COLUMN markdown_url TEXT DEFAULT NULL AFTER source_file_url,
  ADD COLUMN packing_list_url TEXT DEFAULT NULL AFTER markdown_url;

ALTER TABLE sales_order_line
  ADD COLUMN ean VARCHAR(200) DEFAULT NULL AFTER destination,
  ADD COLUMN packing_code VARCHAR(100) DEFAULT NULL AFTER ean;
