-- Default public focus list (run after 019)
INSERT INTO focus_lists (title, description, is_public, created_by, created_at, updated_at)
SELECT
  'Default Focus List',
  'System default public list for quick curation.',
  TRUE,
  'System',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM focus_lists WHERE title = 'Default Focus List' AND is_public = TRUE
);
