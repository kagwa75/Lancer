export const stripeApi = {
  connectAccount: (user) =>
    api.post("/stripe/connect-account", {
      userId: user.id,
      email: user.email,
      refreshUrl: `${api.defaults.baseURL}/stripe/refresh?userId=${user.id}`,
      returnUrl: `${api.defaults.baseURL}/stripe/success?userId=${user.id}`,
    }),

  disconnectAccount: (userId, stripeAccountId) =>
    api.post("/stripe/disconnect-account", { userId, stripeAccountId }),

  getAccountStatus: (stripeAccountId) =>
    api.get(`/stripe/account-status/${stripeAccountId}`),
};
