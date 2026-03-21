// @ts-nocheck
import { query } from '@/server/db';

export async function getFormCategories() {
  const result = await query(
    `SELECT DISTINCT category FROM forms WHERE is_active = 1 ORDER BY category`
  );
  return result.rows.map((r) => r.category);
}

export async function getFormSubCategories(category) {
  const result = await query(
    `SELECT sub_category, form_name FROM forms
     WHERE category = $1 AND is_active = 1 ORDER BY sub_category`,
    [category]
  );
  return result.rows.map((r) => ({ sub_category: r.sub_category, form_name: r.form_name }));
}

export async function getFormByCategoryAndSubCategory(category, subCategory) {
  const result = await query(
    `SELECT id, category, sub_category, form_name, form_payload,
            created_by, is_active, version, created_at, updated_at
     FROM forms WHERE category = $1 AND sub_category = $2 AND is_active = 1`,
    [category, subCategory]
  );
  if (result.rows.length === 0) return null;

  const r = result.rows[0];
  return {
    id: Number(r.id),
    category: r.category,
    sub_category: r.sub_category,
    form_name: r.form_name,
    form_payload: r.form_payload ?? [],
    created_by: r.created_by,
    is_active: Number(r.is_active),
    version: Number(r.version),
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export async function getFormResponse(formId, submittedBy) {
  const result = await query(
    `SELECT payload FROM form_submissions
     WHERE form_id = $1 AND user_id = $2
     ORDER BY submission_date DESC, created_at DESC LIMIT 1`,
    [formId, submittedBy]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0].payload ?? {};
}

export async function getTodaySubmission(formId, userId) {
  const result = await query(
    `SELECT fs.id, fs.form_id, fs.user_id, fs.submission_date, fs.payload, fs.created_at, fs.updated_at
     FROM form_submissions fs
     WHERE fs.form_id = $1 AND fs.user_id = $2 AND fs.submission_date = CURRENT_DATE`,
    [formId, userId]
  );
  if (result.rows.length === 0) return null;

  const r = result.rows[0];
  return {
    id: Number(r.id),
    form_id: Number(r.form_id),
    user_id: r.user_id,
    submission_date: r.submission_date,
    payload: r.payload ?? {},
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}
