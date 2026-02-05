import { supabase } from "./Client";

export class PaymentService {
  // Get commission rate from platform settings
  static async getCommissionRate() {
    const { data } = await supabase
      .from("platform_settings")
      .select("setting_value")
      .eq("setting_key", "commission_rate")
      .single();

    return data ? parseFloat(data.setting_value) : 10;
  }

  // Calculate fees
  static calculateFees(amount, commissionRate) {
    const platformFee = (amount * commissionRate) / 100;
    const freelancerAmount = amount - platformFee;

    return {
      platformFee: parseFloat(platformFee.toFixed(2)),
      freelancerAmount: parseFloat(freelancerAmount.toFixed(2)),
    };
  }

  // Create payment intent for escrow (calls backend)
  static async createEscrowPayment(params) {
    const { projectId, bidId, clientId, freelancerId, amount } = params;
    const API_URL = "http://10.75.96.160:3000";
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("User not authenticated");
      }

      const res = await fetch(`http://10.0.2.2:3000/stripe/Intent`, {
        // Fixed path
        method: "POST",
        headers: {
          "Content-Type": "application/json", // Add this
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          // Stringify the body
          projectId,
          bidId,
          clientId,
          freelancerId,
          amount: parseFloat(amount), // Ensure it's a number
        }),
      });

      console.log("Function response:", res);

      if (!res.ok) {
        console.error("Function error details(paymentServicejs):", error);
        throw new Error(error.message || "Failed to create payment");
      }
      const data = await res.json();
      return data;
    } catch (error) {
      console.error("Error creating escrow payment:", error);
      throw error;
    }
  }

  // Confirm payment received and move to escrow
  static async confirmEscrowPayment(paymentIntentId) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("User not authenticated");
      }

      const { data, error } = await supabase.functions.invoke(
        "confirm-escrow-payment", // ← This matches your function list
        {
          body: { paymentIntentId },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );

      console.log("Confirm response:", { data, error });

      if (error) {
        console.error("Confirm error details:", error);
        throw new Error(error.message || "Failed to confirm payment");
      }

      return data;
    } catch (error) {
      console.error("Error confirming escrow payment:", error);
      throw error;
    }
  }

  // Release funds to freelancer
  static async releaseEscrow(params) {
    const { transactionId, freelancerStripeAccountId } = params;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("User not authenticated");
      }

      const { data, error } = await supabase.functions.invoke(
        "release-escrow", // ← This matches your function list
        {
          body: {
            transactionId,
            freelancerStripeAccountId,
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );

      console.log("Release response:", { data, error });

      if (error) {
        console.error("Release error details:", error);
        throw new Error(error.message || "Failed to release payment");
      }

      return data;
    } catch (error) {
      console.error("Error releasing escrow:", error);
      throw error;
    }
  }

  // Refund to client
  static async refundEscrow(transactionId) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("User not authenticated");
      }

      const { data, error } = await supabase.functions.invoke(
        "refund-escrow", // ← This matches your function list
        {
          body: { transactionId },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );

      console.log("Refund response:", { data, error });

      if (error) {
        console.error("Refund error details:", error);
        throw new Error(error.message || "Failed to refund payment");
      }

      return data;
    } catch (error) {
      console.error("Error refunding escrow:", error);
      throw error;
    }
  }
}
