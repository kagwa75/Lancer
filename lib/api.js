import axios from "axios";

//const STRIPE_API_URL2 = "https://lancerstripe-production.up.railway.app";
const STRIPE_API_URL =
  "https://jargonistic-meadow-heliographically.ngrok-free.dev";

// Create axios instance
const api = axios.create({
  baseURL: STRIPE_API_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log("🚀 API Request:", {
      url: config.url,
      method: config.method,
      data: config.data,
    });
    return config;
  },
  (error) => {
    console.error("❌ Request Error:", error);
    return Promise.reject(error);
  },
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    console.log("✅ API Response:", {
      url: response.config.url,
      status: response.status,
      data: response.data,
    });
    return response;
  },
  (error) => {
    console.error("❌ Response Error:", {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      status: error.response?.status,
    });

    let errorMessage = "An unexpected error occurred";

    if (error.code === "ECONNABORTED") {
      errorMessage = "Request timeout. Please try again.";
    } else if (
      error.code === "ERR_NETWORK" ||
      error.message === "Network Error"
    ) {
      errorMessage = "Network error. Please check your internet connection.";
    } else if (error.response) {
      errorMessage =
        error.response.data?.error ||
        error.response.data?.message ||
        `Server error: ${error.response.status}`;
    }

    return Promise.reject({
      ...error,
      userMessage: errorMessage,
    });
  },
);

export default api;
export { STRIPE_API_URL };
