import { useMutation, useQueryClient } from "@tanstack/react-query";
import { stripeClient } from "./stripeApiClient";

export const useStripeConnect = (user) => {
  const queryClient = useQueryClient();

  const connectMutation = useMutation({
    mutationFn: async () => {
      const data = await stripeClient.connectAccount(user);
      return data?.accountLink || null;
    },
    onSuccess: () => {
      // Invalidate relevant queries if needed
      queryClient.invalidateQueries({ queryKey: ["stripe-status"] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: ({ stripeAccountId }) =>
      stripeClient.disconnectAccount(user.id, stripeAccountId),
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
