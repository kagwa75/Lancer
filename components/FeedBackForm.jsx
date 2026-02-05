import { useTheme } from "@/hooks/ThemeContext";
import * as Sentry from "@sentry/react-native";
import * as ImagePicker from "expo-image-picker";
import {
  Bug,
  Camera,
  Lightbulb,
  MessageSquare,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const FeedbackForm = ({
  user,
  onSubmitSuccess,
  onSubmitError,
  buttonStyle,
  buttonText = "Give Feedback",
  context = "Unknown",
}) => {
  const { theme, isDark } = useTheme();
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState(
    "bug" | "suggestion" | "praise",
  );
  const [feedbackText, setFeedbackText] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [screenshot, setScreenshot] = useState(null);

  useEffect(() => {
    if (user) {
      setUserEmail(user.email || "");
      setUserName(user.user_metadata?.name || user.displayName || "");

      // Set user context in Sentry when form opens
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: user.user_metadata?.name || user.displayName,
      });
    }
  }, [user]);

  const styles = createStyles(theme);

  // Get feedback type colors
  const getFeedbackTypeColor = (type) => {
    switch (type) {
      case "bug":
        return theme.error;
      case "suggestion":
        return theme.warning;
      case "praise":
        return theme.success;
      default:
        return theme.textSecondary;
    }
  };

  // Track when feedback modal opens
  const handleOpenFeedback = () => {
    setShowFeedback(true);

    // Add breadcrumb
    Sentry.addBreadcrumb({
      category: "user-feedback",
      message: "User opened custom feedback form",
      level: "info",
      data: {
        context,
        timestamp: new Date().toISOString(),
      },
    });

    // Track in analytics (if you have analytics setup)
    // analytics.track('feedback_form_opened', { context });
  };

  // Track when feedback modal closes
  const handleCloseFeedback = () => {
    const hadContent = feedbackText.trim().length > 0;

    setShowFeedback(false);

    // Add breadcrumb if user abandoned with content
    if (hadContent) {
      Sentry.addBreadcrumb({
        category: "user-feedback",
        message: "User closed feedback form with content",
        level: "warning",
        data: {
          context,
          feedbackType,
          hadScreenshot: !!screenshot,
        },
      });
    }
  };

  // Handle screenshot capture
  const handleAddScreenshot = async () => {
    try {
      // Request permissions
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please grant camera roll permissions to attach screenshots.",
        );
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setScreenshot(result.assets[0].uri);

        Sentry.addBreadcrumb({
          category: "user-feedback",
          message: "Screenshot added to feedback",
          level: "info",
        });
      }
    } catch (error) {
      console.error("Screenshot error:", error);
      Sentry.captureException(error);
    }
  };

  // Handle screenshot removal
  const handleRemoveScreenshot = () => {
    setScreenshot(null);

    Sentry.addBreadcrumb({
      category: "user-feedback",
      message: "Screenshot removed from feedback",
      level: "info",
    });
  };

  // Validate email format
  const isValidEmail = (email) => {
    if (!email) return true; // Email is optional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleFeedbackSubmit = async () => {
    // Validation
    if (!feedbackText.trim()) {
      Alert.alert("Error", "Please enter your feedback");
      return;
    }

    if (userEmail && !isValidEmail(userEmail)) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);

    // Use modern Sentry API with startSpan
    await Sentry.startSpan(
      {
        name: "Submit Feedback",
        op: "user.feedback.submit",
        attributes: {
          feedback_type: feedbackType,
          context,
          has_screenshot: !!screenshot,
        },
      },
      async (span) => {
        try {
          // Prepare feedback data
          await Sentry.startSpan(
            { name: "Prepare feedback data", op: "feedback.prepare" },
            async () => {
              const feedbackData = {
                name: userName || user?.user_metadata?.name || "Anonymous User",
                email: userEmail || user?.email || "no-email@provided.com",
                message: `[${feedbackType.toUpperCase()}] ${feedbackText}`,
                source: "mobile-app",
                associatedEventId: Sentry.lastEventId() || undefined,
              };
              return feedbackData;
            },
          );

          // Submit to Sentry
          await Sentry.startSpan(
            { name: "Submit to Sentry", op: "feedback.sentry" },
            async () => {
              Sentry.captureFeedback({
                name: userName || user?.user_metadata?.name || "Anonymous User",
                email: userEmail || user?.email || "no-email@provided.com",
                message: `[${feedbackType.toUpperCase()}] ${feedbackText}`,
                source: "mobile-app",
                associatedEventId: Sentry.lastEventId() || undefined,
              });
            },
          );

          // Optional: Save to your backend/Supabase
          // await Sentry.startSpan(
          //   { name: 'Submit to backend', op: 'feedback.backend' },
          //   async () => {
          //     const { error } = await supabase.from("user_feedback").insert({
          //       user_id: user?.id,
          //       type: feedbackType,
          //       message: feedbackText,
          //       email: userEmail,
          //       screenshot_url: screenshot, // Upload screenshot first
          //       metadata: {
          //         page: context,
          //         platform: Platform.OS,
          //         app_version: Constants.expoConfig?.version,
          //       },
          //     });
          //
          //     if (error) throw error;
          //   }
          // );

          // Track successful submission
          Sentry.captureMessage("User feedback submitted successfully", {
            level: "info",
            tags: {
              feedback_type: feedbackType,
              context,
              has_screenshot: !!screenshot,
            },
            contexts: {
              feedback: {
                type: feedbackType,
                length: feedbackText.length,
                has_email: !!userEmail,
                has_screenshot: !!screenshot,
              },
            },
          });

          // Mark span as successful
          span?.setStatus({ code: 1, message: "ok" });

          // Show success message
          Alert.alert(
            "Thank You! 🎉",
            getFeedbackSuccessMessage(feedbackType),
            [
              {
                text: "OK",
                onPress: () => {
                  setShowFeedback(false);
                  onSubmitSuccess?.();
                },
              },
            ],
          );

          // Reset form
          setFeedbackText("");
          setFeedbackType("bug");
          setScreenshot(null);
        } catch (error) {
          console.error("Feedback submission error:", error);

          // Mark span as failed
          span?.setStatus({ code: 2, message: "error" });

          // Capture error
          Sentry.captureException(error, {
            tags: {
              feedback_type: feedbackType,
              context,
              operation: "feedback_submission",
            },
          });

          // Show error message
          Alert.alert(
            "Submission Failed",
            "Could not submit feedback. Please try again later.",
          );

          onSubmitError?.(error);
        } finally {
          setIsSubmitting(false);
        }
      },
    );
  };

  // Get success message based on feedback type
  const getFeedbackSuccessMessage = (type) => {
    switch (type) {
      case "bug":
        return "Your bug report has been submitted. We'll investigate and fix it soon!";
      case "suggestion":
        return "Thank you for your suggestion! We're always looking for ways to improve.";
      case "praise":
        return "Thank you for the kind words! It means a lot to our team.";
      default:
        return "Your feedback has been submitted successfully.";
    }
  };

  // Get placeholder text based on feedback type
  const getPlaceholderText = () => {
    switch (feedbackType) {
      case "bug":
        return "What happened? Please include steps to reproduce...";
      case "suggestion":
        return "How can we make this better? What would you like to see?";
      case "praise":
        return "What made your experience great? We'd love to know!";
      default:
        return "Tell us what's on your mind...";
    }
  };

  return (
    <View>
      {/* Feedback Button */}
      <Pressable
        style={[styles.feedbackButton, buttonStyle]}
        onPress={handleOpenFeedback}
      >
        <MessageSquare size={18} color={theme.surface} />
        <Text style={styles.feedbackButtonText}>{buttonText}</Text>
      </Pressable>

      {/* Feedback Modal */}
      <Modal
        visible={showFeedback}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseFeedback}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.feedbackModalOverlay}
        >
          <Pressable
            style={styles.feedbackModalOverlay}
            onPress={handleCloseFeedback}
          >
            <Pressable
              style={styles.feedbackModalContent}
              onPress={(e) => e.stopPropagation()}
            >
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.feedbackModalHeader}>
                  <Text style={styles.feedbackModalTitle}>Send Feedback</Text>
                  <Pressable onPress={handleCloseFeedback}>
                    <X size={24} color={theme.textSecondary} />
                  </Pressable>
                </View>

                <Text style={styles.feedbackModalSubtitle}>
                  Help us improve your experience
                </Text>

                {/* Feedback Type Selector */}
                <View style={styles.feedbackTypeContainer}>
                  <Pressable
                    style={[
                      styles.feedbackTypeButton,
                      feedbackType === "bug" && styles.feedbackTypeButtonActive,
                    ]}
                    onPress={() => setFeedbackType("bug")}
                  >
                    <Bug
                      size={20}
                      color={
                        feedbackType === "bug"
                          ? getFeedbackTypeColor("bug")
                          : theme.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.feedbackTypeText,
                        feedbackType === "bug" && styles.feedbackTypeTextActive,
                      ]}
                    >
                      Report Bug
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.feedbackTypeButton,
                      feedbackType === "suggestion" &&
                        styles.feedbackTypeButtonActive,
                    ]}
                    onPress={() => setFeedbackType("suggestion")}
                  >
                    <Lightbulb
                      size={20}
                      color={
                        feedbackType === "suggestion"
                          ? getFeedbackTypeColor("suggestion")
                          : theme.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.feedbackTypeText,
                        feedbackType === "suggestion" &&
                          styles.feedbackTypeTextActive,
                      ]}
                    >
                      Suggestion
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.feedbackTypeButton,
                      feedbackType === "praise" &&
                        styles.feedbackTypeButtonActive,
                    ]}
                    onPress={() => setFeedbackType("praise")}
                  >
                    <ThumbsUp
                      size={20}
                      color={
                        feedbackType === "praise"
                          ? getFeedbackTypeColor("praise")
                          : theme.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.feedbackTypeText,
                        feedbackType === "praise" &&
                          styles.feedbackTypeTextActive,
                      ]}
                    >
                      Praise
                    </Text>
                  </Pressable>
                </View>

                {/* Name Input (Optional) */}
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Name (optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Your name"
                    value={userName}
                    onChangeText={setUserName}
                    placeholderTextColor={theme.textMuted}
                    autoCapitalize="words"
                  />
                </View>

                {/* Email Input */}
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Email (optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="your@email.com"
                    value={userEmail}
                    onChangeText={setUserEmail}
                    placeholderTextColor={theme.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                {/* Feedback Input */}
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>
                    {feedbackType === "bug" && "Describe the bug *"}
                    {feedbackType === "suggestion" && "Your suggestion *"}
                    {feedbackType === "praise" && "What you love *"}
                  </Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder={getPlaceholderText()}
                    placeholderTextColor={theme.textMuted}
                    value={feedbackText}
                    onChangeText={setFeedbackText}
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                  />
                  <Text style={styles.characterCount}>
                    {feedbackText.length} characters
                  </Text>
                </View>

                {/* Screenshot Section */}
                <View style={styles.screenshotSection}>
                  <Text style={styles.inputLabel}>Screenshot (optional)</Text>

                  {screenshot ? (
                    <View style={styles.screenshotPreview}>
                      <Image
                        source={{ uri: screenshot }}
                        style={styles.screenshotImage}
                        resizeMode="cover"
                      />
                      <Pressable
                        style={styles.removeScreenshotButton}
                        onPress={handleRemoveScreenshot}
                      >
                        <Trash2 size={16} color={theme.iconDanger} />
                        <Text style={styles.removeScreenshotText}>Remove</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      style={styles.addScreenshotButton}
                      onPress={handleAddScreenshot}
                    >
                      <Camera size={20} color={theme.textSecondary} />
                      <Text style={styles.addScreenshotText}>
                        Add Screenshot
                      </Text>
                    </Pressable>
                  )}
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    (isSubmitting || !feedbackText.trim()) &&
                      styles.submitButtonDisabled,
                  ]}
                  onPress={handleFeedbackSubmit}
                  disabled={isSubmitting || !feedbackText.trim()}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={theme.surface} />
                  ) : (
                    <>
                      <MessageSquare size={18} color={theme.surface} />
                      <Text style={styles.submitButtonText}>
                        {feedbackType === "bug" && "Report Bug"}
                        {feedbackType === "suggestion" && "Send Suggestion"}
                        {feedbackType === "praise" && "Send Praise"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Help Text */}
                <Text style={styles.helpText}>
                  Your feedback helps us build a better experience for everyone
                </Text>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

export default FeedbackForm;

const createStyles = (theme) =>
  StyleSheet.create({
    // Feedback Button
    feedbackButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: theme.primaryDark || theme.primary,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
      marginBottom: 24,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    feedbackButtonText: {
      fontWeight: "600",
      color: theme.surface,
      fontSize: 15,
    },

    // Feedback Modal Styles
    feedbackModalOverlay: {
      flex: 1,
      backgroundColor: theme.modalOverlay,
      justifyContent: "flex-end",
    },
    feedbackModalContent: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      maxHeight: "90%",
    },
    feedbackModalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    feedbackModalTitle: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.text,
    },
    feedbackModalSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 24,
    },

    // Feedback Type Selector
    feedbackTypeContainer: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 24,
    },
    feedbackTypeButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.border,
      backgroundColor: theme.surfaceAlt,
    },
    feedbackTypeButtonActive: {
      backgroundColor: theme.cardHighlight || theme.surfaceAlt,
      borderColor: theme.primaryDark || theme.primary,
    },
    feedbackTypeText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.textSecondary,
    },
    feedbackTypeTextActive: {
      color: theme.primaryDark || theme.primary,
    },

    // Input Styles
    inputContainer: {
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 8,
    },
    input: {
      backgroundColor: theme.inputBg,
      borderWidth: 2,
      borderColor: theme.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: theme.text,
    },
    textArea: {
      minHeight: 140,
      textAlignVertical: "top",
    },
    characterCount: {
      fontSize: 12,
      color: theme.textMuted,
      marginTop: 6,
      textAlign: "right",
    },

    // Screenshot Section
    screenshotSection: {
      marginBottom: 20,
    },
    addScreenshotButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: theme.inputBg,
      borderWidth: 2,
      borderColor: theme.inputBorder,
      borderRadius: 12,
      paddingVertical: 14,
      borderStyle: "dashed",
    },
    addScreenshotText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.textSecondary,
    },
    screenshotPreview: {
      position: "relative",
    },
    screenshotImage: {
      width: "100%",
      height: 200,
      borderRadius: 12,
      backgroundColor: theme.surfaceAlt,
    },
    removeScreenshotButton: {
      position: "absolute",
      top: 8,
      right: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.iconDangerBg,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    removeScreenshotText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.iconDanger,
    },

    // Submit Button
    submitButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: theme.primaryDark || theme.primary,
      paddingHorizontal: 24,
      paddingVertical: 16,
      borderRadius: 12,
      marginTop: 8,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    submitButtonDisabled: {
      opacity: 0.5,
    },
    submitButtonText: {
      fontWeight: "700",
      color: theme.surface,
      fontSize: 16,
    },

    // Help Text
    helpText: {
      fontSize: 12,
      color: theme.textMuted,
      textAlign: "center",
      marginTop: 16,
      fontStyle: "italic",
    },
  });
