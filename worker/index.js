/**
 * Cloudflare Worker for DnDForged Subdomain Registration
 * Deploy to Cloudflare Workers and bind to api.forgedvtt.com/register
 * 
 * Required Environment Variables in Cloudflare Worker Dashboard:
 * - CF_ZONE_ID: Your Cloudflare Zone ID for forgedvtt.com
 * - CF_API_TOKEN: Cloudflare API Token with Zone.DNS:Edit permissions
 * - TUNNEL_TARGET: The Cloudflare Tunnel target hostname (e.g. fb0d31a3-48d6-4bd4-ba43-336b7589fbf7.cfargotunnel.com)
 */

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    const url = new URL(request.url);

    if (request.method === "POST" && (url.pathname === "/register" || url.pathname === "/api/register")) {
      try {
        const body = await request.json().catch(() => ({}));
        const { subdomain } = body;

        if (!subdomain || typeof subdomain !== "string") {
          return jsonResponse({ error: "Subdomain parameter is required." }, 400);
        }

        const cleanSubdomain = subdomain.trim().toLowerCase();
        if (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(cleanSubdomain)) {
          return jsonResponse({ 
            error: "Invalid subdomain format. Must be 3-32 characters, lowercase alphanumeric with hyphens, and cannot start or end with a hyphen." 
          }, 400);
        }

        const zoneId = env.CF_ZONE_ID;
        const apiToken = env.CF_API_TOKEN;
        const tunnelTarget = env.TUNNEL_TARGET || "fb0d31a3-48d6-4bd4-ba43-336b7589fbf7.cfargotunnel.com";
        const fullDomain = `${cleanSubdomain}.forgedvtt.com`;

        if (!zoneId || !apiToken) {
          return jsonResponse({ error: "Server misconfiguration: CF_ZONE_ID or CF_API_TOKEN is missing." }, 500);
        }

        // Check if DNS record already exists
        const listRes = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?name=${fullDomain}`,
          {
            headers: {
              Authorization: `Bearer ${apiToken}`,
              "Content-Type": "application/json",
            },
          }
        );
        const listData = await listRes.json();

        if (!listData.success) {
          return jsonResponse({ error: "Cloudflare API Error", details: listData.errors }, 500);
        }

        let recordId = null;
        if (listData.result && listData.result.length > 0) {
          recordId = listData.result[0].id;
        }

        if (recordId) {
          // Update existing CNAME record
          const updateRes = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`,
            {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${apiToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                type: "CNAME",
                name: fullDomain,
                content: tunnelTarget,
                proxied: true,
              }),
            }
          );
          const updateData = await updateRes.json();
          if (!updateData.success) {
            return jsonResponse({ error: "Failed to update DNS record", details: updateData.errors }, 500);
          }
        } else {
          // Create new CNAME record
          const createRes = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                type: "CNAME",
                name: fullDomain,
                content: tunnelTarget,
                proxied: true,
              }),
            }
          );
          const createData = await createRes.json();
          if (!createData.success) {
            return jsonResponse({ error: "Failed to create DNS record", details: createData.errors }, 500);
          }
        }

        return jsonResponse({
          success: true,
          subdomain: cleanSubdomain,
          domain: fullDomain,
          url: `https://${fullDomain}`,
        });
      } catch (err) {
        return jsonResponse({ error: err.message }, 500);
      }
    }

    return jsonResponse({ 
      service: "DnDForged Subdomain Router Worker",
      status: "online",
      usage: "POST /register with JSON body { \"subdomain\": \"your-name\" }"
    }, 200);
  },
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
