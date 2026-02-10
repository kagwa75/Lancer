import { useMutation, useQueryClient } from "@tanstack/react-query";
import { stripeApi } from "../services/stripeApi";

export const useStripeConnect = (user) => {
  const queryClient = useQueryClient();

  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await stripeApi.connectAccount(user);
      return response?.data?.accountLink || null;
    },
    onSuccess: () => {
      // Invalidate relevant queries if needed
      queryClient.invalidateQueries({ queryKey: ["stripe-status"] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: ({ stripeAccountId }) =>
      stripeApi.disconnectAccount(user.id, stripeAccountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stripe-status"] });
    },
  });

  return {
    connectAccount: connectMutation.mutateAsync,
    disconnectAccount: disconnectMutation.mutateAsync,
    isConnecting: connectMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
    connectError: connectMutation.error,
    disconnectError: disconnectMutation.error,
  };
};
