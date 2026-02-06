import { Alert, Linking } from "react-native";
import api from "../lib/api";

/**
 * Handle Stripe account connection
 * @param {Object} params - Function parameters
 * @param {Object} params.user - User object with id and email
 * @param {Function} params.setConnectingStripe - State setter for loading state
 * @param {Function} params.toast - Toast notification function
 */
export const handleConnectStripe = async ({
  user,
  setConnectingStripe,
  toast,
}) => {
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

/**
 * Handle Stripe account disconnection
 * @param {Object} params - Function parameters
 * @param {Object} params.user - User object with id
 * @param {string} params.stripeAccountId - Stripe account ID to disconnect
 * @param {Function} params.setStripeConnected - State setter for connection status
 * @param {Function} params.setStripeAccountId - State setter for account ID
 * @param {Function} params.toast - Toast notification function
 * @param {Function} params.fetchProfile - Function to refresh profile data
 */
export const handleDisconnectStripe = ({
  user,
  stripeAccountId,
  setStripeConnected,
  setStripeAccountId,
  toast,
  fetchProfile,
}) => {
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
            console.log("🔌 Disconnecting Stripe for user:", user.id);

            await api.post("/stripe/disconnect-account", {
              userId: user.id,
              stripeAccountId: stripeAccountId,
            });

            console.log("✅ Stripe disconnected successfully");

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
