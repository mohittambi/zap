# Postman collection

## Location

`web/postman/Zap-API.postman_collection.json`  
`web/postman/README.md` — short import instructions

## Import

1. Open Postman → **Import** → select `Zap-API.postman_collection.json`.
2. Configure variables (collection or environment):

| Variable | Example |
|----------|---------|
| `base_url` | `http://localhost:3000/api` |
| `token` | From **Auth → Login** test script |
| `api_key` | e.g. `zap_seed_admin_key` (local seed admin) |
| `sku_id`, `vendor_id`, `warehouse_id`, `form_id`, `user_id` | Per-request fixtures |

## Auth modes

- **JWT:** run **Auth → Login**; Bearer `{{token}}`.
- **API key:** `X-API-Key: {{api_key}}`.

## See also

- [../services/auth/api.md](../services/auth/api.md)
- [../architecture/api-index.md](../architecture/api-index.md)
