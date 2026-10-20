# @converzap/sdk

[![npm version](https://img.shields.io/npm/v/@converzap/sdk.svg)](https://www.npmjs.com/package/@converzap/sdk)
[![license](https://img.shields.io/npm/l/@converzap/sdk.svg)](./LICENSE)
![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)

Official TypeScript SDK for the [ConverZAP API](https://developers.converzap.com) — WhatsApp on the **official WhatsApp Business Platform** (Meta Cloud API): contacts, conversations, messages, templates, campaigns, deals (CRM), automations, AI agents and webhooks.

**Zero dependencies.** Works in Node 18+, Deno, Bun and edge runtimes. One fully-typed method per endpoint, generated from the OpenAPI spec.

## Install

```bash
npm install @converzap/sdk
```

## Quickstart

```ts
import { ConverZap, ConverZapError } from "@converzap/sdk";

const cz = new ConverZap({ apiKey: process.env.CONVERZAP_API_KEY! });

const me = await cz.getMe();

// Create or update a contact (upsert by phone/email)
const contact = await cz.upsertContact({
  body: { name: "Ana", phone: "+5511987654321", labels: ["lead"] },
});

// Send an approved template (works outside the 24-hour window)
await cz.sendMessage({
  id: conversationId,
  idempotencyKey: crypto.randomUUID(),
  body: { type: "template", template: { name: "boas_vindas", language: "pt_BR", params: { body: ["Ana"] } } },
});

// Iterate every page of a list (follows next_cursor)
for await (const deal of cz.paginate(cz.listDeals, { query: { status: "open" } })) {
  console.log(deal.title);
}

try {
  await cz.startCampaign({ id: campaignId });
} catch (e) {
  if (e instanceof ConverZapError && e.code === "limit_reached") console.log(e.message);
}
```

## What's covered

Contacts · conversations & messages · WhatsApp numbers, health & templates · campaigns · deals (CRM pipeline) · automations · AI agents · webhooks · reports. One typed method per endpoint — see the full reference at [developers.converzap.com](https://developers.converzap.com).

## Authentication

Create a key in the app under **Settings → Public API** (format `czk_live_…`) with the scopes you want to grant. The key acts as the user and never above their role. Keep it on the server — never in a browser or mobile app.

## Pagination

```ts
for await (const c of cz.paginate(cz.listContacts, { query: { label: "vip" } })) {
  console.log(c.name);
}
```

## Errors

Failures throw `ConverZapError` with a stable `code` (plus `status`, `requestId`, and per-field `errors`):

```ts
try {
  await cz.sendMessage({ /* … */ });
} catch (e) {
  if (e instanceof ConverZapError) {
    console.log(e.code);      // e.g. "outside_24h_window", "forbidden_scope", "rate_limited"
    console.log(e.requestId); // for support
  }
}
```

See the [error reference](https://developers.converzap.com/en/erros).

## Webhooks

Verify incoming webhooks (`X-ConverZAP-Signature`) with the endpoint secret (`whsec_…`). Pass the **raw** body. Works on Node 18+, Deno, Bun and edge (Web Crypto).

```ts
import { verifyWebhook } from "@converzap/sdk";

const ok = await verifyWebhook(rawBody, req.headers["x-converzap-signature"], process.env.CONVERZAP_WEBHOOK_SECRET!);
```

## Client options

| Option | Default | Notes |
|---|---|---|
| `apiKey` | — (required) | Your `czk_live_…` key |
| `baseUrl` | `https://api.converzap.com/v1` | Override for testing/proxies |
| `fetch` | global `fetch` | Custom fetch implementation |
| `maxRetries` | `2` | Retries on 429/5xx (honors `Retry-After`); writes only retry with an `idempotencyKey` |
| `timeoutMs` | `30000` | Per-request timeout |

## Links

- API docs: https://developers.converzap.com
- OpenAPI: https://api.converzap.com/v1/openapi.json
- Website: https://converzap.com

## Contributing

`src/generated.ts` is auto-generated from the OpenAPI spec — don't edit it by hand. Changes to the API surface are released by regenerating it.

## Security

Found a vulnerability? Email **contato@converzap.com** — please don't open a public issue for security reports. See [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE)
