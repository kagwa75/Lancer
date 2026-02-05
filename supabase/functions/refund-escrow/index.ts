import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import Stripe from "https://esm.sh/stripe@14.21.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

serve(async (req) => {
  try {
    const { transactionId } = await req.json();

    const { data: transaction } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (!transaction || transaction.status !== "held_in_escrow") {
      throw new Error("Cannot refund this transaction");
    }

    // Create refund in Stripe
    const refund = await stripe.refunds.create({
      payment_intent: transaction.payment_intent_id,
    });

    // Update transaction
    const { data, error } = await supabase
      .from("transactions")
      .update({ status: "refunded" })
      .eq("id", transactionId)
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ transaction: data, refund }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
});