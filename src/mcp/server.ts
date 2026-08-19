import { createMcpHandler } from "mcp-handler";
import { logger } from "@/lib/logger";
import { extractMcpToken, isAuthorizedToken } from "@/mcp/auth";
import {
  mcpOptionsResponse,
  mcpProbeGetResponse,
  toJsonRpcResponse,
  withStreamableAccept,
} from "@/mcp/http";
import { wwwAuthenticateHeader } from "@/mcp/oauth/metadata";
import { registerListPropertiesTool } from "@/mcp/tools/list-properties";
import { registerMetadataTool } from "@/mcp/tools/metadata";
import { registerRealtimeTool } from "@/mcp/tools/realtime";
import { registerRunReportTool } from "@/mcp/tools/run-report";

export function callsProtectedTool(
  body: unknown,
  mcpMethodHeader?: string | null,
): boolean {
  if (mcpMethodHeader === "tools/call") {
    return true;
  }

  const messages = Array.isArray(body) ? body : [body];
  for (const message of messages) {
    if (
      message &&
      typeof message === "object" &&
      (message as { method?: unknown }).method === "tools/call"
    ) {
      return true;
    }
  }
  return false;
}

export function unauthorizedToolCallResponse(): Response {
  return new Response(
    JSON.stringify({
      error: "invalid_token",
      error_description: "Authentication required",
    }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "WWW-Authenticate": wwwAuthenticateHeader(),
      },
    },
  );
}

function createInnerHandler() {
  return createMcpHandler(
    (server) => {
      registerListPropertiesTool(server);
      registerMetadataTool(server);
      registerRunReportTool(server);
      registerRealtimeTool(server);
    },
    {
      serverInfo: {
        name: "GA4 Analytics MCP",
        version: "1.0.0",
      },
      instructions:
        "This is a personal GA4 connector for Claude.ai. Start with ga4_list_properties if the property ID is unknown, then ga4_get_metadata, then ga4_run_report or ga4_run_realtime_report. Dates are passed to GA4 unchanged.",
      onEvent: (event) => {
        if (event.type === "ERROR") {
          logger.error("MCP handler error", {
            source: event.source,
            severity: event.severity,
            context: event.context,
          });
        }
      },
    },
  );
}

export function createGa4McpHandler() {
  const handler = createInnerHandler();

  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return mcpOptionsResponse();
    }
    if (req.method === "GET") {
      return mcpProbeGetResponse();
    }
    if (req.method === "DELETE") {
      return new Response(null, { status: 204 });
    }

    if (req.method === "POST") {
      const token = extractMcpToken(req);
      const authed = await isAuthorizedToken(token);
      if (!authed) {
        let body: unknown;
        try {
          body = await req.clone().json();
        } catch {
          body = undefined;
        }
        if (callsProtectedTool(body, req.headers.get("mcp-method"))) {
          return unauthorizedToolCallResponse();
        }
      }
    }

    return toJsonRpcResponse(await handler(withStreamableAccept(req)));
  };
}
