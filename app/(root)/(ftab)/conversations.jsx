import { useTheme } from "@/hooks/ThemeContext";
import { useAuth } from "@/hooks/useAuth";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import moment from "moment";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Modalize } from "react-native-modalize";
import Avatar from "../../../components/avatar";
import { supabase } from "../../../lib/Client";
import {
  getAllUsers,
  getChatConversations,
  markAllMessagesAsRead,
} from "../../../lib/supabase";

const ChatList = () => {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const [users, setUsers] = useState();
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const usersRef = useRef(null);

  useEffect(() => {
    if (user?.id) {
      loadConversations();
    }
    return;
  }, [user?.id, usersRef]);

  //subscription useEffect
  useEffect(() => {
    if (!user?.id) {
      return;
    }
    // Subscribe to new changes
    const subscription = supabase
      .channel("chat-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chats",
          filter: `or(senderid.eq.${user.id},receiverid.eq.${user.id})`,
        },
        (payload) => {
          if (
            payload.eventType === "INSERT" ||
            payload.eventType === "UPDATE"
          ) {
            // Refresh conversations list
            loadConversations();
          }
        },
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  //modal
  const openModal = () => {
    usersRef.current?.open();
    fetchUsers();
  };

  const fetchUsers = async () => {
    try {
      const results = await getAllUsers();
      if (results) {
        setUsers(results);
      } else {
        Alert.alert("Failed to fetch users", error.message || "Unknown error");
      }
    } catch (error) {
      console.error("Fetch users error:", error);
      Alert.alert("Error", "Could not load users");
    }
  };

  const loadConversations = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const results = await getChatConversations(user.id);
      console.log("results:", results);
      setConversations(Array.isArray(results) ? results : []);
    } catch (error) {
      console.error("Error loading conversations:", error);
      Alert.alert("Error", "Could not load conversations");
    } finally {
      setIsLoading(false);
    }
  };

  const getLastMessagePreview = (content) => {
    if (!content) return "No messages yet";
    return content.length > 50 ? content.substring(0, 50) + "..." : content;
  };

  const formatName = (user) => {
    return user?.name || user?.email?.split("@")[0] || "Unknown User";
  };

  const openChat = async (otherUser, lastMessage, unreadCount) => {
    try {
      // Navigate to chat first (user experience)
      router.push(`/(chats)/${otherUser.id}`);
      if (lastMessage.senderid == user?.id) {
        return;
      }
      // Mark ALL unread messages as read if there are any
      if (unreadCount > 0) {
        const result = await markAllMessagesAsRead(user.id, otherUser.id);

        if (result.success) {
          console.log(`${unreadCount} messages marked as read`);
          loadConversations();
        } else {
          console.warn("Failed to mark messages as read:", result.error);
        }
      }
    } catch (error) {
      console.error("Error in openChat:", error);
    }
  };

  const formatTimestamp = (date) => {
    const now = moment();
    const messageTime = moment(date);

    if (now.diff(messageTime, "minutes") < 1) return "Just now";
    if (now.diff(messageTime, "hours") < 1) return messageTime.fromNow();
    if (now.isSame(messageTime, "day")) return messageTime.format("h:mm A");
    if (now.diff(messageTime, "days") < 7) return messageTime.format("ddd");
    return messageTime.format("MMM D");
  };

  const filteredConversations = conversations.filter((conv) => {
    const otherUser = conv.other_user;
    const name = formatName(otherUser).toLowerCase();
    const lastMessage = conv.last_message?.content?.toLowerCase() || "";
    const query = searchQuery.toLowerCase();
    return name.includes(query) || lastMessage.includes(query);
  });

  const renderConversation = ({ item }) => {
    const otherUser = item.other_user;
    const lastMessage = item.last_message;
    const unreadCount = item.unread_count || 0;
    const sender = item.last_message.senderid === user?.id;
    const isLastMessageFromCurrentUser =
      item.last_message.senderid === user?.id;
    const hasUnread = !isLastMessageFromCurrentUser && unreadCount > 0;

    return (
      <TouchableOpacity
        onPress={() => openChat(otherUser, lastMessage, unreadCount)}
        style={styles.conversationItem}
        activeOpacity={0.7}
      >
        <View style={styles.avatarWrapper}>
          <Avatar uri={otherUser?.image} email={otherUser?.email} size={56} />
          <View style={styles.onlineBadge} />
        </View>

        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text
              style={[styles.userName, hasUnread && styles.userNameUnread]}
              numberOfLines={1}
            >
              {formatName(otherUser)}
            </Text>

            {lastMessage && (
              <Text style={styles.timestamp}>
                {formatTimestamp(lastMessage.createdat)}
              </Text>
            )}
          </View>

          <View style={styles.messageRow}>
            {lastMessage && (
              <View style={styles.messagePreviewContainer}>
                {isLastMessageFromCurrentUser && (
                  <Feather
                    name="check"
                    size={14}
                    color={lastMessage.isread ? theme.primary : theme.textMuted}
                    style={styles.checkIcon}
                  />
                )}
                <Text
                  style={[
                    styles.messagePreview,
                    hasUnread && styles.messagePreviewUnread,
                  ]}
                  numberOfLines={1}
                >
                  {getLastMessagePreview(lastMessage.content)}
                </Text>
              </View>
            )}

            {hasUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Messages</Text>
          <Text style={styles.headerSubtitle}>
            {conversations.length} conversation
            {conversations.length !== 1 ? "s" : ""}
          </Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Feather
            name="search"
            size={18}
            color={theme.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Feather name="x" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Floating Action Button */}
      <TouchableOpacity
        onPress={openModal}
        style={styles.fab}
        activeOpacity={0.8}
      >
        <Feather name="edit-3" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Conversations List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.other_user.id.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Feather name="message-circle" size={64} color={theme.border} />
              </View>
              <Text style={styles.emptyTitle}>
                {searchQuery ? "No results found" : "No conversations yet"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? "Try searching with different keywords"
                  : "Tap the + button to start a new conversation"}
              </Text>
            </View>
          }
          refreshing={isLoading}
          onRefresh={loadConversations}
        />
      )}

      {/* New Chat Modal */}
      <Modalize ref={usersRef} modalHeight={600} modalStyle={styles.modal}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Message</Text>
            <TouchableOpacity onPress={() => usersRef.current?.close()}>
              <Feather name="x" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {!users ? (
            <View style={styles.modalLoadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={styles.modalLoadingText}>Loading users...</Text>
            </View>
          ) : (
            <FlatList
              data={users.filter((u) => u.id !== user?.id)}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.userItem}
                  activeOpacity={0.7}
                  onPress={() => {
                    usersRef.current?.close();
                    router.push(`/(chats)/${item.id}`);
                  }}
                >
                  <Avatar uri={item?.image} size={50} />

                  <View style={styles.userInfo}>
                    <Text style={styles.userItemName} numberOfLines={1}>
                      {item.name || item.email?.split("@")[0]}
                    </Text>
                    <Text style={styles.userItemEmail} numberOfLines={1}>
                      {item.email}
                    </Text>
                  </View>

                  <Feather name="send" size={20} color={theme.primary} />
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => (
                <View style={styles.userSeparator} />
              )}
              ListEmptyComponent={
                <View style={styles.modalEmptyContainer}>
                  <Text style={styles.modalEmptyText}>No users found</Text>
                </View>
              }
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </Modalize>
    </View>
  );
};

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      backgroundColor: theme.surface,
      paddingTop: 56,
      paddingBottom: 16,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 3,
    },
    headerContent: {
      marginBottom: 16,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: "700",
      color: theme.text,
      letterSpacing: -0.5,
    },
    headerSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 4,
      fontWeight: "500",
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surfaceAlt,
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 44,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: theme.text,
      height: 44,
    },
    fab: {
      position: "absolute",
      bottom: 24,
      right: 20,
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: theme.primary,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 999,
      elevation: 8,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    listContent: {
      flexGrow: 1,
    },
    conversationItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 20,
      backgroundColor: theme.surface,
    },
    avatarWrapper: {
      position: "relative",
    },
    onlineBadge: {
      position: "absolute",
      bottom: 2,
      right: 2,
      width: 14,
      height: 14,
      backgroundColor: theme.success,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: theme.surface,
    },
    conversationContent: {
      flex: 1,
      marginLeft: 12,
    },
    conversationHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    userName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.text,
      flex: 1,
      marginRight: 8,
    },
    userNameUnread: {
      fontWeight: "700",
      color: theme.text,
    },
    timestamp: {
      fontSize: 12,
      color: theme.textMuted,
      fontWeight: "500",
    },
    messageRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    messagePreviewContainer: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      marginRight: 8,
    },
    checkIcon: {
      marginRight: 4,
    },
    messagePreview: {
      fontSize: 14,
      color: theme.textSecondary,
      flex: 1,
    },
    messagePreviewUnread: {
      fontWeight: "600",
      color: theme.text,
    },
    unreadBadge: {
      backgroundColor: theme.primary,
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 6,
    },
    unreadText: {
      color: theme.surface,
      fontSize: 11,
      fontWeight: "700",
    },
    separator: {
      height: 1,
      backgroundColor: theme.borderLight,
      marginLeft: 88,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 40,
    },
    loadingText: {
      color: theme.textSecondary,
      marginTop: 12,
      fontSize: 15,
      fontWeight: "500",
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 80,
      paddingHorizontal: 40,
    },
    emptyIconContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: theme.surfaceAlt,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 24,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.textMuted,
      textAlign: "center",
      lineHeight: 20,
    },
    modal: {
      backgroundColor: theme.surface,
    },
    modalContent: {
      flex: 1,
      paddingTop: 20,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.text,
    },
    modalLoadingContainer: {
      alignItems: "center",
      paddingVertical: 60,
    },
    modalLoadingText: {
      color: theme.textSecondary,
      marginTop: 12,
      fontSize: 15,
    },
    userItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 20,
    },
    userInfo: {
      flex: 1,
      marginLeft: 12,
      marginRight: 12,
    },
    userItemName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 2,
    },
    userItemEmail: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    userSeparator: {
      height: 1,
      backgroundColor: theme.borderLight,
      marginLeft: 82,
    },
    modalEmptyContainer: {
      alignItems: "center",
      paddingVertical: 60,
    },
    modalEmptyText: {
      color: theme.textSecondary,
      fontSize: 15,
    },
  });

export default ChatList;
