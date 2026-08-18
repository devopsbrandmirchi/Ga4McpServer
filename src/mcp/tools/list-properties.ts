import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { listGa4Properties } from "@/google/admin";
import { toToolErrorText } from "@/lib/errors";
import { jsonToolResult } from "@/mcp/tools/schemas";

export const LIST_PROPERTIES_DESCRIPTION = `What it does: lists GA4 properties the connected Google account can access.

When to use: first call when the user says "my site", "my analytics", or has not given a property ID.

Required parameters: none.
Optional parameters: none.

Returns: propertyName, numeric propertyId, account, and propertyType. Use propertyId in later tools.

Limitations: only properties visible to the single connected Google account. Does not return OAuth credentials.`;

export function registerListPropertiesTool(server: McpServer): void {
  server.registerTool(
    "ga4_list_properties",
    {
      title: "List GA4 properties",
      description: LIST_PROPERTIES_DESCRIPTION,
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const properties = await listGa4Properties();
        return jsonToolResult({
          properties,
          count: properties.length,
        });
      } catch (error) {
        return {
          content: [{ type: "text", text: toToolErrorText(error) }],
          isError: true,
        };
      }
    },
  );
}
