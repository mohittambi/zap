-- Forms seed: OPS category with Daily Ops Form
-- Run after migrations 015 and 016

INSERT INTO forms (category, sub_category, form_name, form_payload, created_by, is_active, version, created_at, updated_at)
VALUES (
  'OPS',
  'daily_ops_report',
  'Daily Ops Form',
  '[
    {"type":"number","label":"No. of packets dipatched for AJIO","name":"ajio_dispatch_count"},
    {"type":"number","label":"No. of packets pending for AJIO","name":"ajio_pending_count"},
    {"type":"number","label":"No. of packets dipatched for AMAZON DF","name":"amazon_df_dispatch_count"},
    {"type":"number","label":"No. of packets pending for AMAZON DF","name":"amazon_df_pending_count"},
    {"type":"number","label":"No. of packets dipatched for AMAZON SELLER FLEX","name":"amazon_flex_dispatch_count"},
    {"type":"number","label":"No. of packets pending for AMAZON SELLER FLEX","name":"amazon_flex_pending_count"},
    {"type":"number","label":"No. of packets dipatched for AMAZON.COM","name":"amazon_com_dispatch_count"},
    {"type":"number","label":"No. of packets pending for AMAZON.COM","name":"amazon_com_pending_count"},
    {"type":"number","label":"No. of packets dipatched for AMAZON.IN","name":"amazon_in_dispatch_count"},
    {"type":"number","label":"No. of packets pending for AMAZON.IN","name":"amazon_in_pending_count"},
    {"type":"number","label":"No. of packets dipatched for ECRAFTINDIA.COM","name":"ecraft_dispatch_count"},
    {"type":"number","label":"No. of packets pending for ECRAFTINDIA.COM","name":"ecraft_pending_count"},
    {"type":"number","label":"No. of packets dipatched for FLIPKART","name":"flipkart_dispatch_count"},
    {"type":"number","label":"No. of packets pending for FLIPKART","name":"flipkart_pending_count"},
    {"type":"number","label":"No. of packets dipatched for FLIPKART EUNOIA","name":"flipkart_eunoia_dispatch_count"},
    {"type":"number","label":"No. of packets pending for FLIPKART EUNOIA","name":"flipkart_eunoia_pending_count"},
    {"type":"number","label":"No. of packets dipatched for FLOWERAURA","name":"floweraura_eunoia_dispatch_count"},
    {"type":"number","label":"No. of packets pending for FLOWERAURA","name":"floweraura_pending_count"},
    {"type":"number","label":"No. of packets dipatched for INDUSTRYBUYING","name":"industrybuying_dispatch_count"},
    {"type":"number","label":"No. of packets pending for INDUSTRYBUYING","name":"industrybuying_pending_count"},
    {"type":"number","label":"No. of packets dipatched for JIOMART","name":"jiomart_dispatch_count"},
    {"type":"number","label":"No. of packets pending for JIOMART","name":"jiomart_pending_count"},
    {"type":"number","label":"No. of packets dipatched for MEESHO","name":"meesho_dispatch_count"},
    {"type":"number","label":"No. of packets pending for MEESHO","name":"meesho_pending_count"},
    {"type":"number","label":"No. of packets dipatched for MIRRAW","name":"mirraw_dispatch_count"},
    {"type":"number","label":"No. of packets pending for MIRRAW","name":"mirraw_pending_count"},
    {"type":"number","label":"No. of packets dipatched for MYNTRA","name":"myntra_dispatch_count"},
    {"type":"number","label":"No. of packets pending for MYNTRA","name":"myntra_pending_count"},
    {"type":"number","label":"No. of packets dipatched for NYKAA","name":"nykaa_dispatch_count"},
    {"type":"number","label":"No. of packets pending for NYKAA","name":"nykaa_pending_count"},
    {"type":"number","label":"No. of packets dipatched for PEPPERFRY","name":"pepperfry_dispatch_count"},
    {"type":"number","label":"No. of packets pending for PEPPERFRY","name":"pepperfry_pending_count"},
    {"type":"number","label":"No. of packets dipatched for SHOPPERSSTOP","name":"shopperstop_dispatch_count"},
    {"type":"number","label":"No. of packets pending for SHOPPERSSTOP","name":"shopperstop_pending_count"},
    {"type":"number","label":"No. of packets dipatched for SNAPDEAL","name":"snapdeal_dispatch_count"},
    {"type":"number","label":"No. of packets pending for SNAPDEAL","name":"snapdeal_pending_count"},
    {"type":"number","label":"No. of packets dipatched for TATACLIQ","name":"tatacliq_dispatch_count"},
    {"type":"number","label":"No. of packets pending for TATACLIQ","name":"tatacliq_pending_count"}
  ]'::jsonb,
  'akshit229',
  1,
  1,
  NULL,
  NULL
)
ON CONFLICT (category, sub_category) DO UPDATE SET
  form_name = EXCLUDED.form_name,
  form_payload = EXCLUDED.form_payload,
  created_by = EXCLUDED.created_by,
  version = EXCLUDED.version,
  updated_at = NOW();

-- GRAPHICS category (matches eautomate: graphics_report, Graphics Report Form)
DELETE FROM forms WHERE category = 'GRAPHICS' AND sub_category = 'placeholder';
INSERT INTO forms (category, sub_category, form_name, form_payload, created_by, is_active, version, created_at, updated_at)
VALUES ('GRAPHICS', 'graphics_report', 'Graphics Report Form', '[]'::jsonb, NULL, 1, 1, NULL, NULL)
ON CONFLICT (category, sub_category) DO UPDATE SET form_name = EXCLUDED.form_name, updated_at = NOW();
