# Security policy

## Reporting a vulnerability

Please report security issues privately by email to **contato@converzap.com**. Do **not** open a public GitHub issue for security reports.

Include what you found, how to reproduce it and the potential impact. We will acknowledge your report and keep you informed while we investigate and fix it.

## Scope of this repository

This repository is a **client for the ConverZAP public API** (the `@converzap/sdk` package). It contains no server code, no database access and no credentials. The security boundary — authentication, API key validation, per-workspace isolation, scopes, plan checks and rate limits — is enforced **server-side** by the ConverZAP platform, which is not part of this repository.

Never commit API keys (`czk_live_…`) or webhook secrets (`whsec_…`). If a key is exposed, revoke it immediately in the app under **Settings → Public API**.
