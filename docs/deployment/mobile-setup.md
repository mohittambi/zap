# Mobile app setup (Zap Ops)

The React Native client lives in **`mobile/`** at the repo root (package name **ZapMobile**, product branding **Zap Ops**).

## Quick start

```bash
cd mobile
cp .env.example .env
# Set API_BASE_URL to your web API (e.g. http://localhost:3000)
npm install
cd ios && bundle exec pod install && cd ..
```

Run the web API from `web/` (`npm run dev`) in parallel with Metro (`npm start` in `mobile/`).

## Documentation

| Doc | Contents |
|-----|----------|
| [mobile/README.md](../../../mobile/README.md) | Full setup, iOS/Android, troubleshooting |
| [mobile/docs/ui-design-system.md](../../../mobile/docs/ui-design-system.md) | UI tokens and patterns |
| [mobile/docs/ui-professionalization-plan.md](../../../mobile/docs/ui-professionalization-plan.md) | Screen checklist |

## API

The mobile app uses the **same** `/api` routes as the web app with JWT or API key — see [../services/auth/api.md](../services/auth/api.md).

## See also

- [env-reference.md](env-reference.md)
