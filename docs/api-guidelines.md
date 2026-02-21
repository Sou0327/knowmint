# Knowledge Market API Guidelines

## Authentication
- Default: `Authorization: Bearer km_...`
- `/api/v1/keys` additionally supports authenticated browser session cookies for dashboard use.

## Error Model
All errors follow:

```json
{
  "success": false,
  "error": {
    "code": "bad_request",
    "message": "Invalid request"
  }
}
```

## Error Codes
- `unauthorized` (401): API key/session invalid or missing
- `forbidden` (403): permission/ownership mismatch
- `not_found` (404): resource does not exist or is not visible
- `rate_limited` (429): throttled
- `bad_request` (400): validation/verification failed
- `conflict` (409): duplicate state or idempotency conflict
- `internal_error` (500): unexpected server error

## Retry Policy
- Retryable:
  - `429 rate_limited`
  - `500 internal_error`
- Conditionally retryable:
  - `400 bad_request` only for transient blockchain confirmation lag
- Not retryable:
  - `401 unauthorized`
  - `403 forbidden`
  - `404 not_found`
  - `409 conflict` (requires caller state refresh)

## Rate Limit Headers
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset` (seconds until reset)

When `429`, clients should wait at least `X-RateLimit-Reset` seconds before retry.

## Purchase Verification Rules (Phase 5.1)
- Solana only in this phase.
- `tx_hash`, token, chain, expected recipient wallet, and DB price must all match.
- Client-sent `amount` is ignored; DB price is authoritative.
- Verification must pass before transaction can become `confirmed`.

## Dataset Upload Flow (Phase 5.2)
1. `POST /api/v1/knowledge/{id}/dataset/upload-url`
2. Upload file to signed URL
3. `POST /api/v1/knowledge/{id}/dataset/finalize`
4. Publish item via `POST /api/v1/knowledge/{id}/publish`
