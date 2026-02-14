import { useTheme } from "@/hooks/ThemeContext";
import { useAuth } from "@/hooks/useAuth";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import moment from "moment";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Avatar from "./avatar";
import { supabase } from "../lib/Client";

const parseNotificationData = (raw) => {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const formatTimestamp = (value) => {
  if (!value) return "";
  const time = moment(value);
  if (!time.isValid()) return "";

  const now = moment();
  if (now.diff(time, "minutes") < 1) return "Just now";
  if (now.diff(time, "hours") < 1) return time.fromNow();
  if (now.isSame(time, "day")) return time.format("h:mm A");
  if (now.diff(time, "days") < 7) return time.format("ddd");
  return time.format("MMM D");
};

const NotificationsScreen = () => {
  const { theme } = useTheme();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [senderProfiles, setSenderProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchSenderProfiles = async (ids) => {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (uniqueIds.length === 0) return;

    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", uniqueIds);

    if (profileError) {
      console.error("Failed to load sender profiles:", profileError);
      return;
    }

    if (!data) return;

    setSenderProfiles((prev) => {
      const next = { ...prev };
      data.forEach((profile) => {
        next[profile.id] = {
          ...profile,
          image: profile.avatar_url || profile.image,
        };
      });
      return next;
    });
  };

  const loadNotifications = async ({ silent } = {}) => {
    if (!user?.id) return;
    if (!silent) setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("notifications")
        .select("*")
        .eq("receiveid", user.id)
        .order("createdat", { ascending: false });

      if (fetchError) throw fetchError;

      const items = data || [];
      setNotifications(items);
      await fetchSenderProfiles(items.map((item) => item.senderid));
    } catch (err) {
      console.error("Failed to load notifications:", err);
      setError("Failed to load notifications. Pull to retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/(auth)/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user?.id) {
      loadNotifications();
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const subscription = supabase
      .channel("notification-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `receiveid.eq.${user.id}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev]);
          if (payload.new?.senderid) {
            fetchSenderProfiles([payload.new.senderid]);
          }
        },
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications({ silent: true });
  };

  const getSenderName = (senderId) => {
    const profile = senderProfiles[senderId];
    if (!profile) return "Someone";
    return profile.full_name || profile.email?.split("@")[0] || "Someone";
  };

  const handleNotificationPress = (notification) => {
    const data = parseNotificationData(notification.data);
    const title = notification.title?.toLowerCase() || "";

    if (data?.type === "message" || title.includes("message")) {
      if (notification.senderid) {
        router.push(`/(chats)/${notification.senderid}`);
      }
      return;
    }

    const projectId = data?.project_id || data?.receiverid;
    if (projectId) {
      router.push(`/(description)/${projectId}`);
    }
  };

  if (authLoading || loading) {
    return (
      <View style={styles(theme).loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles(theme).loadingText}>Loading notifications...</Text>
      </View>
    );
  }

  return (
    <View style={styles(theme).container}>
      <View style={styles(theme).header}>
        <View style={styles(theme).headerLeft}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles(theme).backButton}
          >
            <Feather name="arrow-left" size={20} color={theme.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles(theme).headerTitle}>Notifications</Text>
            <Text style={styles(theme).headerSubtitle}>
              Updates and activity
            </Text>
          </View>
        </View>
        <View style={styles(theme).headerBadge}>
          <Text style={styles(theme).headerBadgeText}>
            {notifications.length}
          </Text>
        </View>
      </View>

      {error && (
        <View style={styles(theme).errorBanner}>
          <Feather name="alert-triangle" size={16} color={theme.errorText} />
          <Text style={styles(theme).errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item) => `${item.id}`}
        contentContainerStyle={styles(theme).listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles(theme).emptyState}>
            <View style={styles(theme).emptyIcon}>
              <Feather name="bell" size={34} color={theme.textMuted} />
            </View>
            <Text style={styles(theme).emptyTitle}>All caught up</Text>
            <Text style={styles(theme).emptySubtitle}>
              New notifications will appear here.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const senderName = getSenderName(item.senderid);
          const title = item.title
            ? `${senderName} ${item.title}`
            : `${senderName} sent you a notification`;
          const isUnread = item.isread === false;

          return (
            <TouchableOpacity
              onPress={() => handleNotificationPress(item)}
              activeOpacity={0.8}
              style={[
                styles(theme).notificationCard,
                isUnread && styles(theme).notificationCardUnread,
              ]}
            >
              <View style={styles(theme).avatarWrapper}>
                <Avatar
                  uri={
                    senderProfiles[item.senderid]?.avatar_url ||
                    senderProfiles[item.senderid]?.image
                  }
                  email={senderProfiles[item.senderid]?.email}
                  size={48}
                />
                {isUnread && <View style={styles(theme).unreadDot} />}
              </View>
              <View style={styles(theme).notificationContent}>
                <Text style={styles(theme).notificationTitle} numberOfLines={2}>
                  {title}
                </Text>
                <Text style={styles(theme).notificationTime}>
                  {formatTimestamp(item.createdat)}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
};

const styles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      paddingTop: 48,
      paddingBottom: 16,
      paddingHorizontal: 16,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
      marginRight: 12,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceAlt,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.text,
    },
    headerSubtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    headerBadge: {
      minWidth: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.iconBg,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
    },
    headerBadgeText: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.primary,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.background,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: theme.textSecondary,
    },
    errorBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      margin: 16,
      padding: 12,
      backgroundColor: theme.errorBg,
      borderRadius: 10,
    },
    errorText: {
      color: theme.errorText,
      fontSize: 13,
      flex: 1,
    },
    listContent: {
      padding: 16,
      paddingBottom: 32,
      gap: 12,
    },
    notificationCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      padding: 12,
      gap: 12,
    },
    notificationCardUnread: {
      backgroundColor: theme.cardHighlight,
      borderColor: theme.primaryLight,
    },
    avatarWrapper: {
      position: "relative",
    },
    unreadDot: {
      position: "absolute",
      right: -2,
      top: -2,
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.primary,
      borderWidth: 2,
      borderColor: theme.surface,
    },
    notificationContent: {
      flex: 1,
      gap: 6,
    },
    notificationTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.text,
    },
    notificationTime: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    emptyState: {
      alignItems: "center",
      paddingTop: 48,
      paddingHorizontal: 24,
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.surfaceAlt,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.text,
    },
    emptySubtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: "center",
      marginTop: 6,
    },
  });

export default NotificationsScreen;
