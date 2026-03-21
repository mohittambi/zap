# Auth Flow and RBAC

## Mermaid Flow Diagram

Flow from initial entry point through authentication, RBAC authorization, and protected resources.

```mermaid
flowchart TB
    subgraph entry [Entry Point]
        Request[Incoming Request]
    end

    subgraph auth [Authentication]
        Request --> HasAuth{Has Auth?}
        HasAuth -->|No| Reject401[401 Unauthorized]
        HasAuth -->|Yes| AuthType{Auth Type?}
        AuthType -->|Bearer Token| ValidateAPI[Validate API Key]
        AuthType -->|Basic/Session| ValidateCreds[Validate Email + Password]
        ValidateAPI --> ValidAPI{Valid?}
        ValidateCreds --> ValidCreds{Valid?}
        ValidAPI -->|No| Reject401
        ValidCreds -->|No| Reject401
        ValidAPI -->|Yes| LoadUser
        ValidateCreds -->|Yes| LoadUser[Load User + Roles]
    end

    subgraph rbac [RBAC Authorization]
        LoadUser --> CheckPerm{Has Permission?}
        CheckPerm -->|No| Reject403[403 Forbidden]
        CheckPerm -->|Yes| Allow[Allow Request]
    end

    subgraph resources [Protected Resources]
        Allow --> Listings[Listings API]
        Allow --> Inventory[Inventory API]
        Allow --> Analytics[Analytics API]
        Allow --> Vendors[Vendors API]
        Allow --> POs[Purchase Orders API]
    end
```

## User Behavior Flows

### Email + Password

1. User logs in via `POST /api/auth/login` with `{ email, password }`
2. Server validates credentials and returns JWT
3. Subsequent requests use `Authorization: Bearer <token>`

### API Key

1. Client sends `Authorization: Bearer <api_key>` or `X-API-Key: <api_key>`
2. Server validates against `users.api_key_hash`
3. User and roles are loaded for RBAC checks
