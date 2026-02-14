// services/stripeApiClient.js
const STRIPE_BASE_URL = "https://lancerstripe-production.up.railway.app";

class StripeApiClient {
  constructor() {
    this.baseURL = STRIPE_BASE_URL;
    if (__DEV__) {
      console.log("🔧 Stripe API Client initialized:", this.baseURL);
    }
  }

  async connectAccount(user) {
    if (__DEV__) {
      console.log("🔐 Connecting Stripe for user:", user.id);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch(`${this.baseURL}/stripe/connect-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          refreshUrl: `${this.baseURL}/stripe/refresh?userId=${user.id}`,
          returnUrl: `${this.baseURL}/stripe/success?userId=${user.id}`,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            errorData.message ||
            `Server error: ${response.status}`,
        );
      }

      const data = await response.json();

      if (__DEV__) {
        console.log("✅ Stripe connect response:", data);
      }

      return data;
    } catch (error) {
      if (__DEV__) {
        console.error("❌ Stripe connect error:", error);
      }
      throw this.handleError(error);
    }
  }

  async disconnectAccount(userId, stripeAccountId) {
    if (__DEV__) {
      console.log("🔓 Disconnecting Stripe:", { userId, stripeAccountId });
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(
        `${this.baseURL}/stripe/disconnect-account`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify({ userId, stripeAccountId }),
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            errorData.message ||
            `Server error: ${response.status}`,
        );
      }

      const data = await response.json();

      if (__DEV__) {
        console.log("✅ Stripe disconnect response:", data);
      }

      return data;
    } catch (error) {
      if (__DEV__) {
        console.error("❌ Stripe disconnect error:", error);
      }
      throw this.handleError(error);
    }
  }

  handleError(error) {
    let errorMessage = "An unexpected error occurred";

    // Check if it's an abort error (timeout)
    if (error.name === "AbortError") {
      errorMessage = "Request timeout. Please try again.";
      error.code = "TIMEOUT";
    }
    // Check if it's a network error
    else if (
      error.message === "Network request failed" ||
      error.message.includes("fetch")
    ) {
      errorMessage = "Network error. Please check your internet connection.";
      error.code = "NETWORK_ERROR";
    }
    // Use the error message from server if available
    else if (error.message) {
      errorMessage = error.message;
    }

    // Add userMessage to the error
    error.userMessage = errorMessage;
    return error;
  }
}

// Export a singleton instance
export const stripeClient = new StripeApiClient();
