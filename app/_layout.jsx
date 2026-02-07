import * as Sentry from "@sentry/react-native";
import { router, Stack } from "expo-router";
import { PostHogProvider } from "posthog-react-native";
import { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ThemeProvider } from "../hooks/ThemeContext";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import { stripePublishableKey } from "../lib/stripe";

Sentry.init({
  dsn: "https://2d8f5a9ae513f8167f696912b91ad07e@o4510803275546624.ingest.de.sentry.io/4510803278692432",
  environment: __DEV__ ? "development" : "production",
  sendDefaultPii: true,
  enableLogs: __DEV__,

  // Session tracking
  enableAutoSessionTracking: true,
  sessionTrackingIntervalMillis: 10000,

  // Sample rates
  replaysSessionSampleRate: __DEV__ ? 1.0 : 0.1,
  replaysOnErrorSampleRate: 1.0,
  tracesSampleRate: __DEV__ ? 1.0 : 0.2,

  integrations: [
    Sentry.mobileReplayIntegration(),
    Sentry.feedbackIntegration({
      autoInject: false, // We'll manually control when to show feedback
      showBranding: false, // Remove Sentry branding
      colorScheme: "system", // Auto adapt to dark/light mode
    }),
    // Performance Monitoring - React Native Tracing
    Sentry.reactNativeTracingIntegration({
      // Track user interactions (taps, scrolls, etc.)
      enableUserInteractionTracing: true,

      // Track component render performance
      enableNativeFramesTracking: Platform.OS !== "web",

      // Track slow/frozen frames
      enableStallTracking: true,

      // Track app start performance
      enableAppStartTracking: true,

      // Routing instrumentation for navigation tracking
      // routingInstrumentation: new Sentry.reactNativeNavigationIntegration(),
    }),
  ],
});

// Stripe provider logic (unchanged)
let StripeProviderComponent;
if (Platform.OS !== "web") {
  const StripeModule = require("@stripe/stripe-react-native");
  StripeProviderComponent = StripeModule.StripeProvider;
} else {
  StripeProviderComponent = ({ children }) => <>{children}</>;
}

const Layout = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PostHogProvider
        apiKey="phc_GfkmKQGQv3EJLiWHWn0vKpOgYnRsByeeDnpWEmSv6YV"
        options={{
          host: "https://us.i.posthog.com",
          enableSessionReplay: true,
        }}
        autocapture
      >
        <AuthProvider>
          <ThemeProvider>
            {stripePublishableKey ? (
              <StripeProviderComponent publishableKey={stripePublishableKey}>
                <RootLayout />
              </StripeProviderComponent>
            ) : (
              <RootLayout />
            )}
          </ThemeProvider>
        </AuthProvider>
      </PostHogProvider>
    </GestureHandlerRootView>
  );
};

const RootLayout = () => {
  const { user, userRole, loading } = useAuth();

  // Set user context in Sentry
  useEffect(() => {
    if (user) {
      Sentry.setUser({
        id: user.uid,
        email: user.email,
        role: userRole,
      });
    } else {
      Sentry.setUser(null);
    }
  }, [user, userRole]);

  useEffect(() => {
    if (loading) return;

    Sentry.addBreadcrumb({
      category: "navigation",
      message: `Auth check - user: ${!!user}, role: ${userRole}`,
      level: "info",
    });

    if (!user) {
      router.replace("/(auth)/Welcome");
      return;
    }

    if (!userRole) {
      router.replace("/(auth)/selectRole");
      return;
    }

    if (userRole === "client") {
      router.replace("/(tab)/home");
    } else if (userRole === "freelancer") {
      router.replace("/(ftab)/home");
    }
  }, [user, userRole, loading]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
};

export default Sentry.wrap(Layout);
