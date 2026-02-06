import { useState } from "react";
import { Alert, Linking } from "react-native";
import api from "../lib/api";
import { useToast } from "./use-toast";

export const useStripeConnection = ({ user, fetchProfile }) => {
  const { toast } = useToast();
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [stripeAccountId, setStripeAccountId] = useState(null);

  const handleConnectStripe = async () => {
    if (!user?.id || !user?.email) {
      Alert.alert("Error", "User information is missing");
      return;
    }

    setConnectingStripe(true);

    try {
      console.log("🔐 Connecting Stripe for user:", user.id);

      const response = await api.post("/stripe/connect-account", {
        userId: user.id,
        email: user.email,
        refreshUrl: `${api.defaults.baseURL}/stripe/refresh?userId=${user.id}`,
        returnUrl: `${api.defaults.baseURL}/stripe/success?userId=${user.id}`,
      });

      const { accountLink } = response.data;
      console.log("✅ Account link received");

      await Linking.openURL(accountLink.url);

      toast({
        title: "Redirecting to Stripe",
        description: "Complete the onboarding to receive payments",
      });
    } catch (error) {
      console.error("❌ Stripe connect error:", error);

      Alert.alert(
        "Connection Failed",
        error.userMessage ||
          "Failed to connect Stripe account. Please try again.",
      );
    } finally {
      setConnectingStripe(false);
    }
  };

  const handleDisconnectStripe = () => {
    Alert.alert(
      "Disconnect Stripe",
      "Are you sure you want to disconnect your Stripe account? You won't be able to receive payments.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            try {
              await api.post("/stripe/disconnect-account", {
                userId: user.id,
                stripeAccountId: stripeAccountId,
              });

              setStripeConnected(false);
              setStripeAccountId(null);

              toast({
                title: "Disconnected",
                description: "Your Stripe account has been disconnected",
              });

              fetchProfile();
            } catch (error) {
              console.error("❌ Disconnect error:", error);
              Alert.alert(
                "Error",
                error.userMessage || "Failed to disconnect Stripe account",
              );
            }
          },
        },
      ],
    );
  };

  return {
    connectingStripe,
    stripeConnected,
    stripeAccountId,
    setStripeConnected,
    setStripeAccountId,
    handleConnectStripe,
    handleDisconnectStripe,
  };
};
