import api, { STRIPE_API_URL } from "../lib/api";

export const stripeApi = {
  connectAccount: (user) =>
    api.post("/stripe/connect-account", {
      userId: user.id,
      email: user.email,
      refreshUrl: `${STRIPE_API_URL}/stripe/refresh?userId=${user.id}`,
      returnUrl: `${STRIPE_API_URL}/stripe/success?userId=${user.id}`,
    }),

  disconnectAccount: (userId, stripeAccountId) =>
    api.post("/stripe/disconnect-account", { userId, stripeAccountId }),

  getAccountStatus: (stripeAccountId) =>
    api.get(`/stripe/account-status/${stripeAccountId}`),
};
