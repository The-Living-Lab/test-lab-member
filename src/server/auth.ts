/* Identity for server functions. Every browser (host, player, designer) has an invisible anonymous
   Supabase session. The client half attaches its access token; the server half verifies it and passes
   the user id and a request address to the handler. Nobody is asked to sign in. */
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const playerAuth = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
  })
  .server(async ({ next }) => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("Backend is not configured.");
    const request = getRequest();
    const auth = request?.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (token.split(".").length !== 3) throw new Error("Not connected. Refresh the page and try again.");
    const client = createClient(url, key, { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.getClaims(token);
    const userId = data?.claims?.sub;
    if (error || !userId) throw new Error("Not connected. Refresh the page and try again.");
    const ip = request?.headers.get("cf-connecting-ip") || (request?.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() || "unknown";
    return next({ context: { userId: String(userId), ip } });
  });
