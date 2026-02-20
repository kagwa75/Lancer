import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "../lib/Client";

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#3b82f6",
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Failed to get push token for push notification!");
      return null;
    }

    token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log("Push token:", token);
  } else {
    console.log("Must use physical device for Push Notifications");
  }

  return token;
}

export async function savePushTokenToDatabase(userId, token) {
  if (!token || !userId) return;

  try {
    const { error } = await supabase.from("user_settings").upsert(
      {
        user_id: userId,
        push_token: token,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) throw error;
    console.log("Push token saved to database");
  } catch (error) {
    console.error("Error saving push token:", error);
  }
}

export async function removePushTokenFromDatabase(userId) {
  if (!userId) return;

  try {
    const { error } = await supabase
      .from("user_settings")
      .update({
        push_token: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) throw error;
    console.log("Push token removed from database");
  } catch (error) {
    console.error("Error removing push token:", error);
  }
}

// Local notification for testing
export async function schedulePushNotification(title, body, data = {}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: { seconds: 1 },
  });
}

// Send notification via your backend (example structure)
export async function sendPushNotification(userId, title, body, data = {}) {
  try {
    // Get user's push token from database
    const { data: settings } = await supabase
      .from("user_settings")
      .select("push_token, notifications")
      .eq("user_id", userId)
      .single();

    if (!settings?.push_token || !settings?.notifications) {
      console.log("User does not have push notifications enabled");
      return;
    }

    // Send notification via Expo Push API or your backend
    const message = {
      to: settings.push_token,
      sound: "default",
      title,
      body,
      data,
    };

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    console.log("Notification sent:", result);
    return result;
  } catch (error) {
    console.error("Error sending push notification:", error);
    throw error;
  }
}

// Notification event listeners
export function setupNotificationListeners(
  onNotificationReceived,
  onNotificationResponse,
) {
  // Handle notifications received while app is foregrounded
  const notificationListener = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log("Notification received:", notification);
      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }
    },
  );

  // Handle user tapping on notification
  const responseListener =
    Notifications.addNotificationResponseReceivedListener((response) => {
      console.log("Notification tapped:", response);
      if (onNotificationResponse) {
        onNotificationResponse(response);
      }
    });

  return () => {
    Notifications.removeNotificationSubscription(notificationListener);
    Notifications.removeNotificationSubscription(responseListener);
  };
}

// Get notification permission status
export async function getNotificationPermissionStatus() {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

// Request notification permissions
export async function requestNotificationPermissions() {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}
