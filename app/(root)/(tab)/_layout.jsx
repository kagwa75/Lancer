import { useAuth } from "@/hooks/useAuth";
import { Ionicons } from "@expo/vector-icons";
import { Tabs, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Platform, Text, useColorScheme, View } from "react-native";
import { getChatConversations } from "../../../lib/supabase";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);

  const loadConversations = useCallback(async () => {
    if (!user?.id) return;

    try {
      const results = await getChatConversations(user.id);
      console.log("results:", results);
      setConversations(Array.isArray(results) ? results : []);
    } catch (error) {
      console.error("Error loading conversations:", error);
      Alert.alert("Error", "Could not load conversations");
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations]),
  );

  const conversationCount = conversations.reduce(
    (sum, c) => sum + (c.unread_count || 0),
    0,
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: isDark ? "#0ea5e9" : "#3b82f6", // Sky-500 / Blue-500
        tabBarInactiveTintColor: isDark ? "#94a3b8" : "#64748b", // Slate-400 / Slate-500
        tabBarStyle: {
          backgroundColor: isDark ? "#1e293b" : "#ffffff", // Slate-800 / White
          borderTopColor: isDark ? "#334155" : "#e2e8f0", // Slate-700 / Slate-200
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 88 : 64,
          paddingBottom: Platform.OS === "ios" ? 30 : 8,
          paddingTop: 8,
          elevation: 0, // Remove Android shadow
          shadowOpacity: 0.1, // Subtle iOS shadow
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
          marginTop: 4,
        },
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: "Projects",
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? "folder" : "folder"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="conversations"
        options={{
          title: "Chats",
          tabBarIcon: ({ focused, color, size }) => (
            <View style={{ position: "relative" }}>
              <Ionicons
                name={focused ? "chatbubble" : "chatbubble-outline"}
                size={size}
                color={color}
              />
              {conversationCount > 0 && (
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
                    {conversationCount > 9 ? "9+" : conversationCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
