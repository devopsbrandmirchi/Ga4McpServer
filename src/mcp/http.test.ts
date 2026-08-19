import { describe, expect, it } from "vitest";
import { parseSseJsonPayload, withStreamableAccept } from "@/mcp/http";

describe("MCP HTTP compatibility", () => {
  it("injects the Streamable HTTP Accept header when the client omitted it", () => {
    const req = withStreamableAccept(
      new Request("http://localhost:3000/ga4mcp", {
        method: "POST",
        headers: { Accept: "application/json" },
      }),
    );
    expect(req.headers.get("accept")).toBe("application/json, text/event-stream");
  });

  it("unwraps a single SSE JSON-RPC event", () => {
    const payload = parseSseJsonPayload(
      'event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"ok":true}}\n\n',
    );
    expect(payload).toBe('{"jsonrpc":"2.0","id":1,"result":{"ok":true}}');
  });
});
