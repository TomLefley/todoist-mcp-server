type FetchCall = {
  url: string;
  method: string;
  body: unknown;
  headers: Record<string, string>;
};

type Responder = (call: FetchCall) => { status?: number; body: unknown };

export class FetchMock {
  calls: FetchCall[] = [];
  private responders: Array<{ match: RegExp | string; method?: string; respond: Responder }> = [];
  private original: typeof globalThis.fetch | undefined;

  install() {
    this.original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = (init?.method || "GET").toUpperCase();
      const headers = (init?.headers || {}) as Record<string, string>;
      let body: unknown = undefined;
      if (typeof init?.body === "string") {
        try { body = JSON.parse(init.body); } catch { body = init.body; }
      }
      const call: FetchCall = { url, method, body, headers };
      this.calls.push(call);

      for (const r of this.responders) {
        const methodOk = !r.method || r.method.toUpperCase() === method;
        const matchOk = typeof r.match === "string" ? url.includes(r.match) : r.match.test(url);
        if (methodOk && matchOk) {
          const { status = 200, body: responseBody } = r.respond(call);
          if (status === 204 || status === 205 || status === 304) {
            return new Response(null, { status });
          }
          const text = typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody);
          return new Response(text, { status, headers: { "content-type": "application/json" } });
        }
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    }) as typeof globalThis.fetch;
  }

  restore() {
    if (this.original) globalThis.fetch = this.original;
  }

  on(match: RegExp | string, method: string | undefined, respond: Responder) {
    this.responders.push({ match, method, respond });
  }

  // Convenience: respond with paged-result envelope { results, next_cursor }
  onPaged(match: RegExp | string, method: string | undefined, items: unknown[]) {
    this.on(match, method, () => ({ body: { results: items, next_cursor: null } }));
  }
}

type ToolResult = { content: Array<{ type: string; text: string }> };

export async function callTool(
  server: object,
  name: string,
  args: Record<string, unknown> = {}
): Promise<ToolResult> {
  const tools = (server as unknown as { _registeredTools: Record<string, { handler: (args: unknown, extra: unknown) => unknown }> })._registeredTools;
  const tool = tools[name];
  if (!tool) throw new Error(`Tool not registered: ${name}`);
  if (typeof tool.handler !== "function") throw new Error(`Tool ${name} has no callable handler (task-based tools not supported)`);
  const extra = { signal: new AbortController().signal, requestId: 1, sendNotification: async () => {}, sendRequest: async () => ({}) };
  return await Promise.resolve(tool.handler(args, extra)) as ToolResult;
}

export function listTools(server: object): string[] {
  const tools = (server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools;
  return Object.keys(tools);
}
