-- eautomate: form_submissions — daily form submissions by user
CREATE TABLE IF NOT EXISTS form_submissions (
    id BIGSERIAL PRIMARY KEY,
    form_id INT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    submission_date DATE NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(form_id, user_id, submission_date)
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_form_date ON form_submissions(form_id, submission_date);
CREATE INDEX IF NOT EXISTS idx_form_submissions_user_date ON form_submissions(user_id, submission_date);
