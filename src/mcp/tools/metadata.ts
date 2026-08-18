import type { McpServer } from "@modelcontextprotocol/server";
import { getPropertyMetadata } from "@/google/analytics";
import { toToolErrorText } from "@/lib/errors";
import { jsonToolResult, metadataInputSchema } from "@/mcp/tools/schemas";

export const METADATA_DESCRIPTION = `What it does: returns available GA4 dimensions and metrics for one property.

When to use: before ga4_run_report or ga4_run_realtime_report when you are unsure of valid API names (users, sessions, conversions, landing pages, countries, traffic sources).

Required parameters: propertyId (123456789 or properties/123456789).
Optional parameters: none.

Returns: apiName, uiName, description, category, and whether the field is custom.

Limitations: metadata is property-specific. Common report names include activeUsers, sessions, keyEvents, date, country, sessionSource, landingPagePlusQueryString.`;

export function registerMetadataTool(server: McpServer): void {
  server.registerTool(
    "ga4_get_metadata",
    {
      title: "Get GA4 metadata",
      description: METADATA_DESCRIPTION,
      inputSchema: metadataInputSchema,
    },
    async ({ propertyId }) => {
      try {
        const metadata = await getPropertyMetadata(propertyId);
        return jsonToolResult(metadata);
      } catch (error) {
        return {
          content: [{ type: "text", text: toToolErrorText(error) }],
          isError: true,
        };
      }
    },
  );
}
