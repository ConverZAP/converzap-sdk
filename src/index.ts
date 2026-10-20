import { API_VERSION, GeneratedOperations, type Problem, type RequestArgs } from "./generated.js";

export * from "./generated.js";

export type ConverZapOptions = {
  /** Your key (`czk_live_…`), created in the app under Settings → Public API. Keep it on the server. */
  apiKey: string;
  /** Defaults to https://api.converzap.com/v1 */
  baseUrl?: string;
  /** Custom fetch (tests, proxies). Defaults to the global fetch (Node 18+, Deno, Bun, edge). */
  fetch?: typeof fetch;
  /** Retries on 429 and 5xx, honoring `Retry-After`. Default 2. Writes are only retried with an Idempotency-Key. */
  maxRetries?: number;
  /** Per-request timeout in ms. Default 30 000. */
  timeoutMs?: number;
};

/** An RFC 9457 problem returned by the API (`code` is stable, `detail` is human-readable). */
export class ConverZapError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | null;
  readonly errors: { campo: string; mensagem: string }[];
  readonly problem: Partial<Problem> | null;
  constructor(status: number, problem: Partial<Problem> | null, requestId: string | null) {
    super(problem?.detail ?? `HTTP ${status}`);
    this.name = "ConverZapError";
    this.status = status;
    this.code = problem?.code ?? (status === 0 ? "network_error" : "http_error");
    this.requestId = problem?.request_id ?? requestId;
    this.errors = (problem?.errors as { campo: string; mensagem: string }[] | undefined) ?? [];
    this.problem = problem;
  }
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * ConverZAP API client. One method per endpoint (see `OPERATIONS`), fully typed.
 *
 * ```ts
 * const cz = new ConverZap({ apiKey: process.env.CONVERZAP_API_KEY! });
 * const me = await cz.getMe();
 * for await (const c of cz.paginate(cz.listContacts, { query: { label: "vip" } })) console.log(c.name);
 * ```
 */
export class ConverZap extends GeneratedOperations {
  static readonly apiVersion = API_VERSION;
  private readonly key: string;
  private readonly base: string;
  private readonly f: typeof fetch;
  private readonly retries: number;
  private readonly timeout: number;

  constructor(opts: ConverZapOptions) {
    super();
    if (!opts?.apiKey) throw new Error("ConverZap: apiKey is required.");
    this.key = opts.apiKey;
    this.base = (opts.baseUrl ?? "https://api.converzap.com/v1").replace(/\/+$/, "");
    this.f = opts.fetch ?? globalThis.fetch.bind(globalThis);
    this.retries = opts.maxRetries ?? 2;
    this.timeout = opts.timeoutMs ?? 30_000;
  }

  /** Low-level call. Prefer the typed methods (`listContacts`, `sendMessage`…). */
  protected async request(method: string, path: string, args: RequestArgs = {}): Promise<unknown> {
    const { query, body, idempotencyKey, ...pathParams } = args;
    const url = new URL(
      this.base +
        path.replace(/\{(\w+)\}/g, (_, k: string) => {
          const v = pathParams[k];
          if (v === undefined || v === null || v === "") throw new Error(`ConverZap: missing path parameter "${k}".`);
          return encodeURIComponent(String(v));
        }),
    );
    for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    const headers: Record<string, string> = { authorization: `Bearer ${this.key}`, accept: "application/json" };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;
    const podeRepetir = method === "GET" || !!idempotencyKey;

    for (let tentativa = 0; ; tentativa++) {
      let r: Response;
      try {
        r = await this.f(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(this.timeout) });
      } catch (e) {
        if (podeRepetir && tentativa < this.retries) {
          await espera(500 * 2 ** tentativa);
          continue;
        }
        throw new ConverZapError(0, { detail: e instanceof Error ? e.message : "Network error" }, null);
      }
      const requestId = r.headers.get("x-request-id");
      if (r.ok) {
        if (r.status === 204) return undefined;
        const txt = await r.text();
        return txt ? JSON.parse(txt) : undefined;
      }
      if ((r.status === 429 || r.status >= 500) && podeRepetir && tentativa < this.retries) {
        const ra = Number(r.headers.get("retry-after"));
        await espera(Number.isFinite(ra) && ra > 0 ? Math.min(ra, 60) * 1000 : 500 * 2 ** tentativa);
        continue;
      }
      const problem = (await r.json().catch(() => null)) as Partial<Problem> | null;
      throw new ConverZapError(r.status, problem, requestId);
    }
  }

  /**
   * Walks every page of a list method (`listContacts`, `listConversations`…), following `next_cursor`.
   * `for await (const item of cz.paginate(cz.listDeals, { query: { pipeline_id } }))`
   */
  async *paginate<A extends { query?: { cursor?: string } }, T>(
    method: (args: A) => Promise<{ data: T[]; has_more: boolean; next_cursor: string | null }>,
    args?: A,
  ): AsyncGenerator<T> {
    let cursor: string | undefined;
    const base = (args ?? {}) as A;
    do {
      const page = await method.call(this, { ...base, query: { ...(base.query ?? {}), ...(cursor ? { cursor } : {}) } } as A);
      for (const item of page.data) yield item;
      cursor = page.has_more && page.next_cursor ? page.next_cursor : undefined;
    } while (cursor);
  }
}

/**
 * Verifies a webhook from ConverZAP (`X-ConverZAP-Signature: t=<unix>,v1=<hex>`), using the endpoint secret
 * (`whsec_…`). Pass the RAW request body. Rejects signatures older than `toleranceSeconds` (default 300).
 * Works in Node 18+, Deno, Bun and edge runtimes (Web Crypto).
 */
export async function verifyWebhook(rawBody: string, signatureHeader: string | null | undefined, secret: string, toleranceSeconds = 300): Promise<boolean> {
  if (!signatureHeader || !secret) return false;
  const partes = Object.fromEntries(signatureHeader.split(",").map((p) => p.trim().split("=") as [string, string]));
  const t = Number(partes.t);
  const v1 = partes.v1;
  if (!Number.isFinite(t) || !v1 || Math.abs(Date.now() / 1000 - t) > toleranceSeconds) return false;
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(`${t}.${rawBody}`)));
  const hex = Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
  if (hex.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}
