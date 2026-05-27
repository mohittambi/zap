-- Zap-native consignment and PO log IDs (avoid collision with eAutomate positive IDs).

CREATE SEQUENCE IF NOT EXISTS outbound_consignments_zap_id_seq START 9000000000000;

CREATE SEQUENCE IF NOT EXISTS outbound_po_logs_zap_id_seq START 9000000000000;
