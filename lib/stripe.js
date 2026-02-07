import Constants from "expo-constants";

const extra =
  Constants.expoConfig?.extra ??
  Constants.manifest?.extra ??
  Constants.expoConfig?.expoClient?.extra ??
  {};

export const stripePublishableKey = extra.stripePublishableKey ?? null;

if (__DEV__) {
  console.log("Stripe key loaded:", stripePublishableKey?.startsWith("pk_"));
}

if (!stripePublishableKey) {
  console.warn("Stripe publishable key not configured");
}
