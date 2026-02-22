import { supabase } from "./Client";
import { STRIPE_API_URL } from "./api";

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
    const API_URL = STRIPE_API_URL;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("User not authenticated");
      }

      const res = await fetch(`${API_URL}/stripe/Intent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          projectId,
          bidId,
          clientId,
          freelancerId,
          amount: parseFloat(amount),
        }),
      });

      console.log("Function response:", res);

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        const message =
          payload?.error || payload?.message || "Failed to create payment";
        throw new Error(message);
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
