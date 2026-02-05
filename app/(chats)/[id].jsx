import { useTheme } from "@/hooks/ThemeContext";
import { useAuth } from "@/hooks/useAuth";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import moment from "moment";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Avatar from "../../components/avatar";
import { supabase } from "../../lib/Client";
import {
  getChatsBetweenUsers,
  getUser,
  PostChats,
  PostNotifications,
} from "../../lib/supabase";

const ChatRoom = () => {
  const { user: currentUser } = useAuth();
  const { theme } = useTheme();
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [newChat, setNewChat] = useState("");
  const [isSubmittingChat, setIsSubmittingChats] = useState(false);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [Chats, setChats] = useState([]);
  const [user, setUser] = useState();
  const flatListRef = useRef(null);
  const sendButtonScale = useRef(new Animated.Value(0.95)).current;

  // Animate send button
  useEffect(() => {
    Animated.spring(sendButtonScale, {
      toValue: newChat.trim() ? 1 : 0.95,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
  }, [newChat]);

  // Subscribe to new messages
  useEffect(() => {
    if (!currentUser?.id || !id) return;

    const subscription = supabase
      .channel("chat-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chats",
          filter: `or(and(senderid.eq.${currentUser.id},receiverid.eq.${id}),and(senderid.eq.${id},receiverid.eq.${currentUser.id}))`,
        },
        (payload) => {
          setChats((prev) => [...prev, payload.new]);
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        },
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [currentUser?.id, id]);

  // Fetch user and chats
  useEffect(() => {
    if (!currentUser?.id || !id) return;
    GetProfile();
    openChats();
  }, [currentUser?.id, id]);

  const GetProfile = async () => {
    try {
      const result = await getUser(id);
      if (result) {
        setUser(result[0]);
      } else {
        Alert.alert("Failed to fetch user details");
      }
    } catch (error) {
      console.error("Error fetching user:", error);
      Alert.alert("An error occurred while fetching the user");
    }
  };

  const openChats = async () => {
    if (!currentUser?.id || !id) return;

    setIsLoadingChats(true);
    try {
      const results = await getChatsBetweenUsers(currentUser?.id, id);
      setChats(Array.isArray(results) ? results : []);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 300);
    } catch (e) {
      console.error("Chat loading error:", e);
      Alert.alert("Could not load chats");
    } finally {
      setIsLoadingChats(false);
    }
  };

  const submitChats = async () => {
    if (!newChat?.trim() || !currentUser?.id || !id) return;

    const messageToSend = newChat.trim();
    setNewChat("");
    setIsSubmittingChats(true);

    try {
      const result = await PostChats({
        receiverid: id,
        senderid: currentUser?.id,
        content: messageToSend,
      });

      if (result.success) {
        openChats();

        if (currentUser.id !== id) {
          await PostNotifications({
            senderid: currentUser.id,
            receiveid: id,
            title: "sent you a message",
            createdat: new Date().toISOString(),
            data: JSON.stringify({
              receiverid: id,
              chatId: result.id,
              type: "message",
            }),
          });
        }
      }
    } catch (err) {
      Alert.alert("Error", "Could not post message");
      console.error("failed to submit", err);
      setNewChat(messageToSend);
    } finally {
      setIsSubmittingChats(false);
    }
  };

  const formatName = (email) => {
    if (!email) return "User";
    const namePart = email.split("@")[0];
    return namePart.charAt(0).toUpperCase() + namePart.slice(1);
  };

  const formatDate = (date) => {
    const d = moment(date);
    const today = moment().startOf("day");
    const yesterday = moment().subtract(1, "days").startOf("day");

    if (d.isSame(today, "d")) return "Today";
    if (d.isSame(yesterday, "d")) return "Yesterday";
    return d.format("MMM D, YYYY");
  };

  const groupMessagesByDate = (messages) => {
    const groups = [];
    let currentDate = null;

    messages.forEach((msg) => {
      const msgDate = formatDate(msg.createdat);
      if (msgDate !== currentDate) {
        groups.push({ type: "date", date: msgDate });
        currentDate = msgDate;
      }
      groups.push({ type: "message", ...msg });
    });

    return groups;
  };

  const renderItem = ({ item }) => {
    if (item.type === "date") {
      return (
        <View style={styles(theme).dateSeparatorContainer}>
          <View style={styles(theme).dateSeparatorLine} />
          <View style={styles(theme).dateSeparatorBadge}>
            <Text style={styles(theme).dateSeparatorText}>{item.date}</Text>
          </View>
          <View style={styles(theme).dateSeparatorLine} />
        </View>
      );
    }

    const chat = item;
    const isCurrentUser = chat.senderid === currentUser?.id;

    return (
      <View
        style={[
          styles(theme).messageContainer,
          isCurrentUser
            ? styles(theme).messageRight
            : styles(theme).messageLeft,
        ]}
      >
        {/* Received message (left side) */}
        {!isCurrentUser && (
          <View style={styles(theme).receivedMessageWrapper}>
            <Avatar
              size={32}
              uri={user?.image}
              email={user?.email}
              style={{ marginBottom: 2 }}
            />
            <View style={styles(theme).messageContentWrapper}>
              <View style={styles(theme).receivedMessageBubble}>
                <Text style={styles(theme).receivedMessageText}>
                  {chat.content}
                </Text>
              </View>
              <Text style={styles(theme).messageTime}>
                {moment(chat.createdat).format("h:mm A")}
              </Text>
            </View>
          </View>
        )}

        {/* Sent message (right side) */}
        {isCurrentUser && (
          <View style={styles(theme).sentMessageWrapper}>
            <View style={styles(theme).messageContentWrapper}>
              <View style={styles(theme).sentMessageBubble}>
                <Text style={styles(theme).sentMessageText}>
                  {chat.content}
                </Text>
              </View>
              <View style={styles(theme).sentMessageFooter}>
                <Text style={styles(theme).messageTime}>
                  {moment(chat.createdat).format("h:mm A")}
                </Text>
                <Feather name="check" size={12} color={theme.primary} />
              </View>
            </View>
            <Avatar
              size={32}
              uri={currentUser?.image}
              email={currentUser?.email}
              style={{ marginBottom: 2 }}
            />
          </View>
        )}
      </View>
    );
  };

  const groupedChats = groupMessagesByDate(Chats);
  const s = styles(theme);

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerContent}>
          <View style={s.headerRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={s.backButton}
            >
              <Feather name="arrow-left" size={22} color={theme.text} />
            </TouchableOpacity>

            <View style={s.avatarContainer}>
              <Avatar
                uri={user?.image}
                email={user?.email}
                size={44}
                style={s.headerAvatar}
              />
              <View style={s.onlineIndicator} />
            </View>

            <View style={s.userInfoContainer}>
              <Text style={s.userName} numberOfLines={1}>
                {user?.full_name || formatName(user?.email)}
              </Text>
              <Text style={s.userStatus}>Active now</Text>
            </View>

            <TouchableOpacity style={s.iconButton}>
              <Feather name="phone" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={s.iconButton}>
              <Feather
                name="more-vertical"
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Messages Area */}
      {isLoadingChats ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={s.loadingText}>Loading messages...</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={groupedChats}
          renderItem={renderItem}
          keyExtractor={(item, index) =>
            item.type === "date" ? `date-${index}` : `msg-${item.id}`
          }
          contentContainerStyle={s.flatListContent}
          ListEmptyComponent={
            <View style={s.emptyContainer}>
              <View style={s.emptyIconContainer}>
                <Feather name="message-circle" size={40} color={theme.border} />
              </View>
              <Text style={s.emptyTitle}>No messages yet</Text>
              <Text style={s.emptySubtitle}>Start the conversation!</Text>
            </View>
          }
          onContentSizeChange={() => {
            if (groupedChats.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: true });
            }
          }}
        />
      )}

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View style={s.inputContainer}>
          <View style={s.inputContent}>
            <View style={s.inputRow}>
              {/* Emoji Button */}
              <TouchableOpacity style={s.emojiButton}>
                <Feather name="smile" size={22} color={theme.textMuted} />
              </TouchableOpacity>

              {/* Input Field */}
              <View style={s.textInputContainer}>
                <TextInput
                  value={newChat}
                  onChangeText={setNewChat}
                  placeholder="Type a message..."
                  placeholderTextColor={theme.inputPlaceholder}
                  style={s.textInput}
                  multiline
                />
              </View>

              {/* Attachment Button */}
              <TouchableOpacity style={s.attachmentButton}>
                <Feather name="paperclip" size={22} color={theme.textMuted} />
              </TouchableOpacity>

              {/* Send Button */}
              <Animated.View
                style={{ transform: [{ scale: sendButtonScale }] }}
              >
                <TouchableOpacity
                  onPress={submitChats}
                  disabled={isSubmittingChat || !newChat.trim()}
                  style={[
                    s.sendButton,
                    newChat.trim() ? s.sendButtonActive : s.sendButtonInactive,
                  ]}
                >
                  {isSubmittingChat ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Feather
                      name="send"
                      size={20}
                      color={newChat.trim() ? "#FFF" : theme.textMuted}
                    />
                  )}
                </TouchableOpacity>
              </Animated.View>
            </View>

            {/* Typing Indicator Placeholder */}
            <View style={s.typingIndicatorPlaceholder} />
          </View>
        </View>
      </KeyboardAvoidingView>
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
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 2,
    },
    headerContent: {
      paddingTop: 48,
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    backButton: {
      padding: 8,
      marginLeft: -8,
      marginRight: 8,
    },
    avatarContainer: {
      position: "relative",
    },
    headerAvatar: {
      borderWidth: 2,
      borderColor: theme.primary,
    },
    onlineIndicator: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 14,
      height: 14,
      backgroundColor: theme.success,
      borderWidth: 2,
      borderColor: theme.surface,
      borderRadius: 7,
    },
    userInfoContainer: {
      flex: 1,
      marginLeft: 12,
    },
    userName: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
    },
    userStatus: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.success,
    },
    iconButton: {
      padding: 8,
      marginRight: 8,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: {
      color: theme.textSecondary,
      marginTop: 16,
      fontWeight: "500",
    },
    flatListContent: {
      paddingTop: 16,
      paddingBottom: 16,
    },
    dateSeparatorContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 24,
    },
    dateSeparatorLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.divider,
    },
    dateSeparatorBadge: {
      marginHorizontal: 16,
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 9999,
    },
    dateSeparatorText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.textSecondary,
    },
    messageContainer: {
      flexDirection: "row",
      marginBottom: 16,
      paddingHorizontal: 16,
    },
    messageLeft: {
      justifyContent: "flex-start",
    },
    messageRight: {
      justifyContent: "flex-end",
    },
    receivedMessageWrapper: {
      flexDirection: "row",
      alignItems: "flex-end",
      maxWidth: "75%",
    },
    sentMessageWrapper: {
      flexDirection: "row",
      alignItems: "flex-end",
      maxWidth: "75%",
    },
    messageContentWrapper: {
      marginLeft: 8,
    },
    receivedMessageBubble: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 16,
      borderBottomLeftRadius: 4,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    receivedMessageText: {
      color: theme.text,
      fontSize: 15,
      lineHeight: 20,
    },
    sentMessageBubble: {
      backgroundColor: theme.primary,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 16,
      borderBottomRightRadius: 4,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    sentMessageText: {
      color: "#FFFFFF",
      fontSize: 15,
      lineHeight: 20,
    },
    messageTime: {
      color: theme.textMuted,
      fontSize: 12,
      marginTop: 4,
      marginLeft: 4,
      fontWeight: "500",
    },
    sentMessageFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 4,
      marginTop: 4,
      marginRight: 4,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 80,
    },
    emptyIconContainer: {
      width: 80,
      height: 80,
      backgroundColor: theme.surfaceAlt,
      borderRadius: 40,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    emptyTitle: {
      color: theme.textSecondary,
      fontSize: 16,
      fontWeight: "600",
    },
    emptySubtitle: {
      color: theme.textMuted,
      fontSize: 14,
      marginTop: 4,
    },
    inputContainer: {
      backgroundColor: theme.surface,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    inputContent: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "flex-end",
    },
    emojiButton: {
      padding: 8,
      marginRight: 8,
      marginBottom: 4,
    },
    textInputContainer: {
      flex: 1,
      backgroundColor: theme.inputBg,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 8,
      minHeight: 44,
      maxHeight: 128,
    },
    textInput: {
      color: theme.text,
      fontSize: 15,
      minHeight: 28,
    },
    attachmentButton: {
      padding: 8,
      marginLeft: 8,
      marginBottom: 4,
    },
    sendButton: {
      padding: 12,
      marginLeft: 8,
      borderRadius: 12,
      marginBottom: 4,
    },
    sendButtonActive: {
      backgroundColor: theme.primary,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    sendButtonInactive: {
      backgroundColor: theme.border,
    },
    typingIndicatorPlaceholder: {
      height: 16,
      marginTop: 4,
      paddingHorizontal: 8,
    },
  });

export default ChatRoom;
