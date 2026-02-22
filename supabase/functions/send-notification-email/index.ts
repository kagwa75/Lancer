import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
const emailFrom = Deno.env.get("EMAIL_FROM") || "Lancer <noreply@lancer.app>";

const supabase = createClient(supabaseUrl, serviceRoleKey);

type NotificationPayload = {
  notificationId?: string;
  senderid?: string;
  receiveid?: string;
  title?: string;
  payload?: string | null;
  createdat?: string | null;
};

function htmlEscape(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing auth token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(
      token,
    );
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as NotificationPayload;
    const receiveid = body?.receiveid;
    const senderid = body?.senderid;
    const title = (body?.title || "New activity on Lancer").trim();

    if (!receiveid || !senderid) {
      return new Response(
        JSON.stringify({ error: "senderid and receiveid are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (authData.user.id !== senderid) {
      return new Response(
        JSON.stringify({ error: "senderid must match authenticated user" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: settings, error: settingsError } = await supabase
      .from("user_settings")
      .select("email_alerts")
      .eq("user_id", receiveid)
      .maybeSingle();

    if (settingsError) {
      throw new Error(settingsError.message);
    }

    if (settings?.email_alerts === false) {
      return new Response(
        JSON.stringify({
          sent: false,
          reason: "email_alerts_disabled",
          receiveid,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: recipientData, error: recipientError } =
      await supabase.auth.admin.getUserById(receiveid);
    if (recipientError) {
      throw new Error(recipientError.message);
    }

    const recipientEmail = recipientData?.user?.email;
    if (!recipientEmail) {
      return new Response(
        JSON.stringify({ sent: false, reason: "recipient_email_missing" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ sent: false, reason: "resend_not_configured" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", senderid)
      .maybeSingle();

    const senderName = senderProfile?.full_name?.trim() || "Someone";
    const safeTitle = htmlEscape(title);
    const safeSender = htmlEscape(senderName);

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
        <h2 style="margin:0 0 8px;">${safeTitle}</h2>
        <p style="margin:0 0 16px;"><strong>${safeSender}</strong> triggered a new notification for you in Lancer.</p>
        <p style="margin:0;color:#555">Open the app to view details.</p>
      </div>
    `.trim();

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [recipientEmail],
        subject: title,
        html,
      }),
    });

    const resendPayload = await resendResponse.json().catch(() => ({}));
    if (!resendResponse.ok) {
      throw new Error(
        resendPayload?.error?.message ||
          resendPayload?.message ||
          "Email send failed",
      );
    }

    return new Response(
      JSON.stringify({
        sent: true,
        provider: "resend",
        to: recipientEmail,
        notificationId: body?.notificationId || null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        sent: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
