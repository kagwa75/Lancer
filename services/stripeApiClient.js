// services/stripeApiClient.js
import axios from "axios";

const STRIPE_BASE_URL =
  "https://jargonistic-meadow-heliographically.ngrok-free.dev";

class StripeApiClient {
  constructor() {
    this.baseURL = STRIPE_BASE_URL;
  }

  async connectAccount(user) {
    try {
      const response = await axios.post(
        `${this.baseURL}/stripe/connect-account`,
        {
          userId: user.id,
          email: user.email,
          refreshUrl: `${this.baseURL}/stripe/refresh?userId=${user.id}`,
          returnUrl: `${this.baseURL}/stripe/success?userId=${user.id}`,
        },
        {
          timeout: 30000,
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },
        },
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async disconnectAccount(userId, stripeAccountId) {
    try {
      const response = await axios.post(
        `${this.baseURL}/stripe/disconnect-account`,
        { userId, stripeAccountId },
        {
          timeout: 30000,
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },
        },
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  handleError(error) {
    let errorMessage = "An unexpected error occurred";

    if (error.code === "ECONNABORTED") {
      errorMessage = "Request timeout. Please try again.";
    } else if (error.code === "ERR_NETWORK") {
      errorMessage = "Network error. Please check your internet connection.";
    } else if (error.response) {
      errorMessage =
        error.response.data?.error ||
        error.response.data?.message ||
        `Server error: ${error.response.status}`;
    }
    error.userMessage = errorMessage;
    return error;
  }
}

// Export a singleton instance
export const stripeClient = new StripeApiClient();
