-- eautomate: warehouses table
-- Stores warehouse locations for inventory management

CREATE TABLE warehouses (
    id BIGINT PRIMARY KEY,
    name TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
