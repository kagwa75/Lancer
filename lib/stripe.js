import Constants from "expo-constants";

export const stripePublishableKey =
  Constants.expoConfig.extra.stripePublishableKey;
console.log("Stripe key loaded:", stripePublishableKey?.startsWith("pk_"));
if (!stripePublishableKey) {
  throw new Error("Stripe publishable key not configured");
}
