/** Stable IDs — must match web/tests/fixtures/inbound_journey_fixture.sql */

export const INBOUND_JOURNEY_VENDOR_ID = 988877001;

export const INBOUND_JOURNEY_GRN_PENDING_AUDIT = 988877101;
export const INBOUND_JOURNEY_GRN_PENDING_INVOICE = 988877102;
export const INBOUND_JOURNEY_GRN_PENDING_ACCOUNTS = 988877103;
export const INBOUND_JOURNEY_GRN_DCN = 988877104;
export const INBOUND_JOURNEY_DCN_NOTE_ID = 988877501;

/** OPEN fixture with invoice on file + rate diff (received_price gt audit_price) for auto-DN-after-close tests. */
export const INBOUND_JOURNEY_GRN_RATE_DIFF_FOR_CLOSE_DN = 988877111;

/** OPEN fixture: invoice on file, audit matches vendor price — close 200, no Zap DN. */
export const INBOUND_JOURNEY_GRN_NO_RATE_DIFF_CLOSE = 988877112;

/** Draft register flow (fixture re-load required after successful register). */
export const INBOUND_JOURNEY_DRAFT_GRN_ID = -988877301;
export const INBOUND_JOURNEY_REGISTER_PO_ID = 988877900;
export const INBOUND_JOURNEY_OPERATIONAL_AFTER_REGISTER = 988877301;
