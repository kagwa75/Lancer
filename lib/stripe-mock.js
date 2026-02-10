export const useStripe = () => ({
  initPaymentSheet: () => ({ error: null }),
  presentPaymentSheet: () => ({
    error: { message: "Stripe not available on web" },
  }),
});
