-- Give the bins.id column a sequence so admin-created rows get a generated id.
-- eAutomate-synced rows still supply their own explicit id on INSERT.
-- Per zap doctrine (rule 4): zap-created records use sequence from 10000000001+.

CREATE SEQUENCE IF NOT EXISTS bins_id_seq START 10000000001;

ALTER TABLE bins
  ALTER COLUMN id SET DEFAULT nextval('bins_id_seq');
