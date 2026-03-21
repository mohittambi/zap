-- eautomate: forms — form definitions (categories, sub_categories, form_payload)
CREATE TABLE forms (
    id SERIAL PRIMARY KEY,
    category VARCHAR(100) NOT NULL,
    sub_category VARCHAR(100) NOT NULL,
    form_name VARCHAR(255) NOT NULL,
    form_payload JSONB NOT NULL DEFAULT '[]',
    created_by VARCHAR(100),
    is_active INT NOT NULL DEFAULT 1,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    UNIQUE(category, sub_category)
);

CREATE INDEX idx_forms_category ON forms(category);
CREATE INDEX idx_forms_sub_category ON forms(sub_category);
