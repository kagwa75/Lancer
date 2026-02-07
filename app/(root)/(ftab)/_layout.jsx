import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform, Text, useColorScheme, View } from "react-native";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  // Consistent icon names with proper focused states
  const tabConfigs = [
    {
      name: "home",
      title: "Home",
      icon: { focused: "home", outline: "home-outline" },
    },
    {
      name: "jobs",
      title: "Jobs",
      icon: { focused: "briefcase", outline: "briefcase-outline" },
      badgeCount: 3, // Example: Could be dynamic from context/state
    },
    {
      name: "proposals",
      title: "Proposals",
      icon: { focused: "document-text", outline: "document-text-outline" },
    },
    {
      name: "conversations",
      title: "Chats",
      icon: { focused: "chatbubble", outline: "chatbubble-outline" },
      badgeCount: 5, // Example: Unread messages count
    },
  ];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: isDark ? "#0ea5e9" : "#2563eb", // Blue-600 for better contrast
        tabBarInactiveTintColor: isDark ? "#94a3b8" : "#64748b",
        tabBarStyle: {
          backgroundColor: isDark ? "#0f172a" : "#f8fafc", // Darker dark / lighter light
          borderTopColor: isDark ? "#1e293b" : "#e2e8f0",
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 88 : 68,
          paddingBottom: Platform.OS === "ios" ? 28 : 10,
          paddingTop: 8,
          elevation: 2, // Subtle Android shadow for depth
          shadowColor: isDark ? "#000" : "#94a3b8",
          shadowOpacity: isDark ? 0.3 : 0.1,
          shadowRadius: isDark ? 6 : 4,
          shadowOffset: { width: 0, height: -2 },
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600", // Slightly bolder for better readability
          marginTop: 4,
          letterSpacing: -0.2,
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
        headerShown: false,
        tabBarHideOnKeyboard: true,
        // Haptic feedback for iOS
        tabBarButton: Platform.select({
          ios: (props) => <PressableWithHaptic {...props} />,
          default: undefined,
        }),
      }}
    >
      {tabConfigs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused, color, size }) => (
              <View style={{ position: "relative" }}>
                <Ionicons
                  name={focused ? tab.icon.focused : tab.icon.outline}
                  size={size}
                  color={color}
                />
                {tab.badgeCount && tab.badgeCount > 0 && (
                  <View
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -6,
                      backgroundColor: "#ef4444", // Red-500
                      borderRadius: 10,
                      minWidth: 18,
                      height: 18,
                      justifyContent: "center",
                      alignItems: "center",
                      borderWidth: 2,
                      borderColor: isDark ? "#0f172a" : "#f8fafc",
                    }}
                  >
                    <Text
                      style={{
                        color: "white",
                        fontSize: 10,
                        fontWeight: "bold",
                        paddingHorizontal: 4,
                      }}
                    >
                      {tab.badgeCount > 9 ? "9+" : tab.badgeCount}
                    </Text>
                  </View>
                )}
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

// Optional: Add haptic feedback for better UX (iOS only)
import * as Haptics from "expo-haptics";
import { Pressable } from "react-native";

const PressableWithHaptic = ({ children, onPress, ...props }) => {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  return (
    <Pressable onPress={handlePress} {...props}>
      {children}
    </Pressable>
  );
};
