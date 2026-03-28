-- Generated from zap (1).xlsx — do not edit by hand
-- Generator: scripts/generate_seed_from_xlsx.mjs

BEGIN;

DELETE FROM warehouse_inventory_dump;
DELETE FROM pack_combos;
DELETE FROM sku_analytics;
DELETE FROM inbound_summary;
DELETE FROM incoming_quantity;

-- warehouses
INSERT INTO warehouses (id, name, created_at, updated_at)
VALUES
(22230, 'Jaipur Main Warehouse', NOW(), NOW()),
(22231, 'Jaipur Secondary Storage', NOW(), NOW()),
(22232, 'Delhi Returns & QC Hub', NOW(), NOW()),
(22233, 'Mumbai Overflow Store', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = EXCLUDED.updated_at;

-- listings
INSERT INTO listings (id, sku_id, master_sku, inventory_sku_id, pack_combo_sku_id, sku_type, inventory_bypass_on, ops_tag, category, description, meta_fields, img_hd, img_white, img_wdim, img_link1, img_link2, no_of_constituents, actual_weight, dimension, bulk_price, keyword_pool, material_info, available_quantity, created_at, updated_at)
VALUES
(1, 'CRTOR500', 'CRTOR500', 'CRTOR500', NULL, 'SINGLE', 'NO', 'LS', 'Showpiece - Feng Shui', 'eCraftIndia Crystal Tortoise Feng Shui Showpiece', 'Showpiece Fengshui Lucky Tortoise', 'https://cdn.ecraftindia.com/CRTOR500_hd.jpg', 'https://cdn.ecraftindia.com/CRTOR500_white.jpg', 'https://cdn.ecraftindia.com/CRTOR500_dim.jpg', NULL, NULL, 1, 150, '11.5 x 11.5 x 4', 99, 'crystal tortoise feng shui lucky gift', 'Crystal', 0, NOW(), NOW()),
(2, 'MSGB589', 'MSGB589', 'MSGB589', NULL, 'SINGLE', 'NO', 'LS', 'Showpiece - Human Figurine', 'eCraftIndia Set of 4 Monk Child Buddhas', 'Showpiece Buddha Monk Meditation', 'https://cdn.ecraftindia.com/MSGB589_hd.jpg', 'https://cdn.ecraftindia.com/MSGB589_white.jpg', 'https://cdn.ecraftindia.com/MSGB589_dim.jpg', NULL, NULL, 4, 320, '12 x 5 x 7', 132, 'buddha monk set gift home decor', 'Resin', 0, NOW(), NOW()),
(3, 'MSAC503', 'MSAC503', 'MSAC503', NULL, 'SINGLE', 'NO', 'SM', 'Showpiece - Animal Figurines', 'eCraftIndia Giraffe Resin Decorative Showpiece', 'Showpiece Animal Figurine Giraffe', 'https://cdn.ecraftindia.com/MSAC503_hd.jpg', 'https://cdn.ecraftindia.com/MSAC503_white.jpg', 'https://cdn.ecraftindia.com/MSAC503_dim.jpg', NULL, NULL, 1, 420, '19.5 x 9 x 13.5', 198, 'giraffe animal figurine desk decor gift', 'Resin', 0, NOW(), NOW()),
(4, 'VGNS101', 'VGNS101', 'VGNS101', NULL, 'SINGLE', 'NO', 'LS', 'Wall Art - Canvas', 'eCraftIndia Lord Ganesha Printed Canvas Wall Art', 'Wall Art Ganesha Religious Canvas', 'https://cdn.ecraftindia.com/VGNS101_hd.jpg', 'https://cdn.ecraftindia.com/VGNS101_white.jpg', 'https://cdn.ecraftindia.com/VGNS101_dim.jpg', NULL, NULL, 1, 600, '45 x 2 x 60', 450, 'ganesha canvas wall art religious home decor', 'Canvas MDF', 0, NOW(), NOW()),
(5, 'HBMBX202', 'HBMBX202', 'HBMBX202', NULL, 'SINGLE', 'NO', 'GF', 'Gifts - Gift Box', 'eCraftIndia Handmade Decorative Bamboo Gift Box', 'Gift Box Bamboo Handmade', 'https://cdn.ecraftindia.com/HBMBX202_hd.jpg', 'https://cdn.ecraftindia.com/HBMBX202_white.jpg', 'https://cdn.ecraftindia.com/HBMBX202_dim.jpg', NULL, NULL, 1, 280, '20 x 15 x 10', 249, 'bamboo gift box handmade storage box', 'Bamboo', 0, NOW(), NOW())
ON CONFLICT (sku_id) DO UPDATE SET
  master_sku = EXCLUDED.master_sku,
  inventory_sku_id = EXCLUDED.inventory_sku_id,
  pack_combo_sku_id = EXCLUDED.pack_combo_sku_id,
  sku_type = EXCLUDED.sku_type,
  inventory_bypass_on = EXCLUDED.inventory_bypass_on,
  ops_tag = EXCLUDED.ops_tag,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  meta_fields = EXCLUDED.meta_fields,
  img_hd = EXCLUDED.img_hd,
  img_white = EXCLUDED.img_white,
  img_wdim = EXCLUDED.img_wdim,
  img_link1 = EXCLUDED.img_link1,
  img_link2 = EXCLUDED.img_link2,
  no_of_constituents = EXCLUDED.no_of_constituents,
  actual_weight = EXCLUDED.actual_weight,
  dimension = EXCLUDED.dimension,
  bulk_price = EXCLUDED.bulk_price,
  keyword_pool = EXCLUDED.keyword_pool,
  material_info = EXCLUDED.material_info,
  updated_at = EXCLUDED.updated_at;

-- vendors
INSERT INTO vendors (id, vendor_name, vendor_address_line, vendor_city, vendor_state, vendor_postal_code, vendor_gstin, vendor_contact_number, created_at, updated_at)
VALUES
(12304, 'Batra Novelties', 'Shop 14 Sitaram Market Tilak Nagar', 'Delhi', 'Delhi', '110018', '07AFBPB4060M1ZO', '9812345670', NOW(), NOW()),
(12305, 'Be You Nick', 'Plot 47 RIICO Industrial Area Vishwakarma', 'Jaipur', 'Rajasthan', '302013', '08DFKPG5870L1ZV', '9414012345', NOW(), NOW()),
(12306, 'Craft House India', '45 Lal Kothi Near MI Road', 'Jaipur', 'Rajasthan', '302015', '08AABCC1234D1Z5', '9829123456', NOW(), NOW()),
(12307, 'ArtCraft Exports', '212 Jodhpur Industrial Zone Basni Phase 2', 'Jodhpur', 'Rajasthan', '342005', '08BBBCC9876E2Z3', '9414567890', NOW(), NOW()),
(12308, 'GreenCraft Makers', '33 Varanasi Craft Cluster Sigra', 'Varanasi', 'Uttar Pradesh', '221010', '09GGBPD3120H1ZM', '9415678901', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  vendor_name = EXCLUDED.vendor_name,
  vendor_address_line = EXCLUDED.vendor_address_line,
  vendor_city = EXCLUDED.vendor_city,
  vendor_state = EXCLUDED.vendor_state,
  vendor_postal_code = EXCLUDED.vendor_postal_code,
  vendor_gstin = EXCLUDED.vendor_gstin,
  vendor_contact_number = EXCLUDED.vendor_contact_number,
  updated_at = EXCLUDED.updated_at;

-- vendor_specialties
INSERT INTO vendor_specialties (id, vendor_id, vendor_speciality, created_at, updated_at)
VALUES
(1, 12304, 'Resin', NOW(), NOW()),
(2, 12304, 'Crystal', NOW(), NOW()),
(3, 12305, 'Foam', NOW(), NOW()),
(4, 12305, 'Plastic', NOW(), NOW()),
(5, 12306, 'Resin', NOW(), NOW()),
(6, 12306, 'Terracotta', NOW(), NOW()),
(7, 12307, 'Canvas Print', NOW(), NOW()),
(8, 12307, 'MDF Wood', NOW(), NOW()),
(9, 12308, 'Bamboo', NOW(), NOW()),
(10, 12308, 'Jute', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  vendor_speciality = EXCLUDED.vendor_speciality,
  updated_at = EXCLUDED.updated_at;

-- secondary_listings
INSERT INTO secondary_listings (id, secondary_sku, master_sku, inventory_sku_id, pack_combo_sku_id, sku_type, inventory_bypass_status, ais_quantity, available_quantity)
VALUES
(1, 'CRTOR500-FK', 'CRTOR500', 'CRTOR500', NULL, 'SINGLE', 'ACTIVE', 120, 120),
(2, 'MSGB589-AMZ', 'MSGB589', 'MSGB589', NULL, 'SINGLE', 'ACTIVE', 98, 98),
(3, 'MSAC503-NYK', 'MSAC503', 'MSAC503', NULL, 'SINGLE', 'INACTIVE', 0, 30),
(4, 'VGNS101-FK', 'VGNS101', 'VGNS101', NULL, 'SINGLE', 'ACTIVE', 200, 200),
(5, 'HBMBX202-AMZ', 'HBMBX202', 'HBMBX202', NULL, 'SINGLE', 'ACTIVE', 150, 150)
ON CONFLICT (id) DO UPDATE SET
  master_sku = EXCLUDED.master_sku,
  inventory_sku_id = EXCLUDED.inventory_sku_id,
  pack_combo_sku_id = EXCLUDED.pack_combo_sku_id,
  sku_type = EXCLUDED.sku_type,
  inventory_bypass_status = EXCLUDED.inventory_bypass_status,
  ais_quantity = EXCLUDED.ais_quantity,
  available_quantity = EXCLUDED.available_quantity;

-- listing_order_details
INSERT INTO listing_order_details (id, po_number, po_secondary_sku, master_sku, sku_type, company_code_primary, demand, hsn_code, title, dispatched_quantity, packed_quantity, created_at, updated_at)
VALUES
(1, 'PO-2024-001', 'CRTOR500', 'CRTOR500', 'SINGLE', 'CC01', 200, '392690', 'Crystal Tortoise Feng Shui Showpiece', 0, 0, NOW(), NOW()),
(2, 'PO-2024-002', 'MSGB589', 'MSGB589', 'SINGLE', 'CC01', 150, '392690', 'Set of 4 Monk Child Buddhas', 0, 0, NOW(), NOW()),
(3, 'PO-2024-003', 'MSAC503', 'MSAC503', 'SINGLE', 'CC01', 100, '392690', 'Giraffe Resin Animal Figurine', 0, 0, NOW(), NOW()),
(4, 'PO-2024-004', 'VGNS101', 'VGNS101', 'SINGLE', 'CC02', 50, '490610', 'Ganesha Printed Canvas Wall Art', 0, 0, NOW(), NOW()),
(5, 'PO-2024-005', 'HBMBX202', 'HBMBX202', 'SINGLE', 'CC01', 80, '460900', 'Handmade Bamboo Decorative Gift Box', 0, 0, NOW(), NOW()),
(6, NULL, 'CRTOR500', 'CRTOR500', 'SINGLE', NULL, NULL, NULL, NULL, 0, 0, NOW(), NOW()),
(7, NULL, 'MSAC503', 'MSAC503', 'SINGLE', NULL, NULL, NULL, NULL, 0, 0, NOW(), NOW()),
(8, NULL, 'MSGB589', 'MSGB589', 'SINGLE', NULL, NULL, NULL, NULL, 0, 0, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  po_number = EXCLUDED.po_number,
  master_sku = EXCLUDED.master_sku,
  sku_type = EXCLUDED.sku_type,
  company_code_primary = EXCLUDED.company_code_primary,
  demand = EXCLUDED.demand,
  hsn_code = EXCLUDED.hsn_code,
  title = EXCLUDED.title,
  updated_at = EXCLUDED.updated_at;

-- bins
INSERT INTO bins (id, warehouse_id, sku_id, bin_id, available_quantity, is_deleted, created_at, updated_at)
VALUES
(1, 22230, 'CRTOR500', 'B-05-10-2-B', 120, FALSE, NOW(), NOW()),
(2, 22230, 'CRTOR500', 'C-08-07-5-A', 80, FALSE, NOW(), NOW()),
(3, 22230, 'MSGB589', 'C-08-07-5-A', 47, FALSE, NOW(), NOW()),
(4, 22230, 'MSGB589', 'D-04-05-4-A', 51, FALSE, NOW(), NOW()),
(5, 22230, 'MSAC503', 'A-02-03-1-C', 30, FALSE, NOW(), NOW()),
(6, 22231, 'VGNS101', 'A-01-01-1-A', 200, FALSE, NOW(), NOW()),
(7, 22231, 'HBMBX202', 'B-03-04-2-B', 150, FALSE, NOW(), NOW())
ON CONFLICT (warehouse_id, sku_id, bin_id) DO UPDATE SET
  available_quantity = EXCLUDED.available_quantity,
  is_deleted = EXCLUDED.is_deleted,
  updated_at = EXCLUDED.updated_at;

-- sku_analytics
INSERT INTO sku_analytics (sku_id, inward_30d, inward_60d, inward_90d, outward_30d, outward_60d, outward_90d, fetched_at)
VALUES
('CRTOR500', 10, 25, 35, 5, 15, 20, NOW()),
('MSGB589', 50, 120, 180, 30, 80, 120, NOW()),
('MSAC503', 5, 10, 18, 2, 5, 8, NOW()),
('VGNS101', 20, 45, 70, 10, 30, 55, NOW()),
('HBMBX202', 15, 35, 60, 8, 22, 40, NOW()),
('CRTOR500', 10, 25, 35, 5, 15, 20, NOW()),
('MSGB589', 50, 120, 180, 30, 80, 120, NOW()),
('MSAC503', 5, 10, 18, 2, 5, 8, NOW()),
('VGNS101', 20, 45, 70, 10, 30, 55, NOW()),
('HBMBX202', 15, 35, 60, 8, 22, 40, NOW()),
('CRTOR500', 10, 25, 35, 5, 15, 20, NOW()),
('MSGB589', 50, 120, 180, 30, 80, 120, NOW()),
('MSAC503', 5, 10, 18, 2, 5, 8, NOW()),
('VGNS101', 20, 45, 70, 10, 30, 55, NOW()),
('HBMBX202', 15, 35, 60, 8, 22, 40, NOW());

-- warehouse_inventory_dump
INSERT INTO warehouse_inventory_dump (warehouse_id, sku_id, inventory_operation_type, quantity, bin_id, user_id, created_at, updated_at)
VALUES
(22230, 'CRTOR500', 'ADD', 200, 'B-05-10-2-B', 'akshit229', '2024-01-10T04:30:00.000Z'::timestamptz, NOW()),
(22230, 'MSGB589', 'ADD', 150, 'C-08-07-5-A', 'akshit229', '2024-01-10T05:30:00.000Z'::timestamptz, NOW()),
(22230, 'MSAC503', 'ADD', 100, 'A-02-03-1-C', 'warehouse.manager', '2024-01-12T04:00:00.000Z'::timestamptz, NOW()),
(22230, 'CRTOR500', 'REMOVE', 20, 'B-05-10-2-B', 'warehouse.manager', '2024-01-15T08:30:00.000Z'::timestamptz, NOW()),
(22231, 'VGNS101', 'ADD', 200, 'A-01-01-1-A', 'akshit229', '2024-01-16T04:30:00.000Z'::timestamptz, NOW());

-- vendor_sku
INSERT INTO vendor_sku (id, vendor_id, sku_id, cost_price, modified_by, created_at, updated_at)
VALUES
(1, 12304, 'CRTOR500', 75, 'akshit229', NOW(), NOW()),
(2, 12304, 'MSAC503', 140, 'akshit229', NOW(), NOW()),
(3, 12305, 'MSGB589', 50, 'akshit229', NOW(), NOW()),
(4, 12307, 'VGNS101', 320, 'akshit229', NOW(), NOW()),
(5, 12308, 'HBMBX202', 180, 'akshit229', NOW(), NOW())
ON CONFLICT (vendor_id, sku_id) DO UPDATE SET
  cost_price = EXCLUDED.cost_price,
  modified_by = EXCLUDED.modified_by,
  updated_at = EXCLUDED.updated_at;

-- inbound_summary
INSERT INTO inbound_summary (sku_id, summary_date, quantity, source, fetched_at, raw_data)
VALUES
('CRTOR500', '2024-01-14'::date, 25, 'PO', '2024-01-15T06:30:00.000Z'::timestamptz, NULL),
('MSGB589', '2024-01-14'::date, 100, 'PO', '2024-01-15T06:30:00.000Z'::timestamptz, NULL),
('MSAC503', '2024-01-19'::date, 50, 'PO', '2024-01-20T03:30:00.000Z'::timestamptz, NULL),
('VGNS101', '2024-01-21'::date, 75, 'PO', '2024-01-22T03:30:00.000Z'::timestamptz, NULL),
('HBMBX202', '2024-01-24'::date, 40, 'PO', '2024-01-25T03:30:00.000Z'::timestamptz, NULL);

-- incoming_quantity
INSERT INTO incoming_quantity (sku_id, quantity, expected_date, source, fetched_at, raw_data)
VALUES
('CRTOR500', 50, '2024-01-19'::date, 'PO', '2024-01-15T06:30:00.000Z'::timestamptz, NULL),
('MSGB589', 200, '2024-01-21'::date, 'PO', '2024-01-15T06:30:00.000Z'::timestamptz, NULL),
('MSAC503', 80, '2024-01-24'::date, 'PO', '2024-01-20T03:30:00.000Z'::timestamptz, NULL),
('VGNS101', 75, '2024-01-27'::date, 'PO', '2024-01-22T03:30:00.000Z'::timestamptz, NULL),
('HBMBX202', 40, '2024-01-29'::date, 'PO', '2024-01-25T03:30:00.000Z'::timestamptz, NULL);

-- forms
INSERT INTO forms (category, sub_category, form_name, form_payload, created_by, is_active, version, created_at, updated_at)
VALUES
('OPS', 'daily_ops_report', 'Daily Operations Report', '[{"type":"number","label":"Packets dispatched - AJIO","name":"ajio_dispatch_count"},{"type":"number","label":"Packets dispatched - Amazon","name":"amazon_dispatch_count"},{"type":"number","label":"Packets dispatched - Flipkart","name":"flipkart_dispatch_count"},{"type":"number","label":"Pending orders count","name":"pending_orders_count"},{"type":"text","label":"Any issue or remarks for the day","name":"remarks"}]'::jsonb, 'akshit229', 1, 1, NOW(), NOW()),
('GRAPHICS', 'graphics_report', 'Graphics Work Report', '[{"type":"number","label":"SKUs designed today","name":"sku_design_count"},{"type":"number","label":"SKUs uploaded today","name":"sku_upload_count"},{"type":"text","label":"Notes / blockers","name":"notes"}]'::jsonb, 'akshit229', 1, 1, NOW(), NOW())
ON CONFLICT (category, sub_category) DO UPDATE SET
  form_name = EXCLUDED.form_name,
  form_payload = EXCLUDED.form_payload,
  created_by = EXCLUDED.created_by,
  is_active = EXCLUDED.is_active,
  version = EXCLUDED.version,
  updated_at = EXCLUDED.updated_at;

COMMIT;
