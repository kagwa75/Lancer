// lib/apiMpesa.js
const STRIPE_API_URL = "https://lancermpesabackend-production.up.railway.app";

class ApiClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.timeout = 60000; // 60 seconds
    this.defaultHeaders = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "ngrok-skip-browser-warning": "true",
    };
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const method = options.method || "GET";

    // Log request (only in dev)
    if (__DEV__) {
      console.log("🚀 API Request:", {
        url: endpoint,
        method: method,
        data: options.body ? JSON.parse(options.body) : undefined,
      });
    }

    // Setup timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          ...this.defaultHeaders,
          ...options.headers,
        },
        body: options.body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse response
      const data = await response.json().catch(() => ({}));

      // Log response (only in dev)
      if (__DEV__) {
        console.log("✅ API Response:", {
          url: endpoint,
          status: response.status,
          data: data,
        });
      }

      // Handle non-OK responses
      if (!response.ok) {
        const error = new Error(
          data.error || data.message || `Server error: ${response.status}`,
        );
        error.response = {
          status: response.status,
          data: data,
        };
        error.status = response.status;
        throw error;
      }

      // Return in axios-like format for compatibility
      return {
        data: data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      // Log error (only in dev)
      if (__DEV__) {
        console.error("❌ Response Error:", {
          message: error.message,
          code: error.code,
          response: error.response?.data,
          status: error.response?.status,
        });
      }

      // Handle different error types
      let errorMessage = "An unexpected error occurred";
      let errorCode = error.code;

      if (error.name === "AbortError") {
        errorMessage = "Request timeout. Please try again.";
        errorCode = "ECONNABORTED";
      } else if (
        error.message === "Network request failed" ||
        error.message.includes("fetch")
      ) {
        errorMessage = "Network error. Please check your internet connection.";
        errorCode = "ERR_NETWORK";
      } else if (error.response) {
        errorMessage =
          error.response.data?.error ||
          error.response.data?.message ||
          `Server error: ${error.response.status}`;
      } else if (error.message) {
        errorMessage = error.message;
      }

      // Create error object similar to axios
      const apiError = new Error(errorMessage);
      apiError.code = errorCode;
      apiError.response = error.response;
      apiError.userMessage = errorMessage;
      apiError.status = error.status;

      throw apiError;
    }
  }

  async get(endpoint, config = {}) {
    return this.request(endpoint, {
      method: "GET",
      ...config,
    });
  }

  async post(endpoint, data, config = {}) {
    return this.request(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
      ...config,
    });
  }

  async put(endpoint, data, config = {}) {
    return this.request(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
      ...config,
    });
  }

  async delete(endpoint, config = {}) {
    return this.request(endpoint, {
      method: "DELETE",
      ...config,
    });
  }

  async patch(endpoint, data, config = {}) {
    return this.request(endpoint, {
      method: "PATCH",
      body: JSON.stringify(data),
      ...config,
    });
  }
}

// Create and export instance
const apiMpesa = new ApiClient(STRIPE_API_URL);

export default apiMpesa;
export { STRIPE_API_URL };
