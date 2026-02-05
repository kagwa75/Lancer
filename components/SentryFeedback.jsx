import * as Sentry from "@sentry/react-native";
import { StyleSheet, Text, TouchableOpacity } from "react-native";

/**
 * Sentry Feedback Button Component
 *
 * Opens Sentry's user feedback form when pressed.
 * Users can report bugs, suggest features, or provide general feedback.
 */
export const SentryFeedbackButton = ({
  style,
  title = "🐛 Report Issue",
  variant = "secondary",
}) => {
  const handleFeedback = () => {
    try {
      // Get the last event ID (if there was a recent error)
      const eventId = Sentry.lastEventId();

      // Show the feedback form
      Sentry.captureFeedback({
        event_id: eventId || "",
        name: "", // Will be filled by user
        email: "", // Will be filled by user
        comments: "", // Will be filled by user
      });

      // Alternative: Create a custom feedback event
      Sentry.captureMessage("User Feedback Requested", {
        level: "info",
        tags: {
          feedback_type: "user_initiated",
        },
      });
    } catch (error) {
      console.error("Error opening feedback:", error);
    }
  };

  const buttonStyle = [styles.button, styles[variant], style];

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={handleFeedback}
      activeOpacity={0.7}
    >
      <Text style={[styles.buttonText, styles[`${variant}Text`]]}>{title}</Text>
    </TouchableOpacity>
  );
};

/**
 * Floating Action Button variant for Feedback
 * Appears as a floating button on the screen
 */
export const SentryFeedbackFAB = ({ position = "bottom-right" }) => {
  const handleFeedback = () => {
    Sentry.captureMessage("User Feedback Requested", {
      level: "info",
      tags: {
        feedback_type: "fab",
      },
    });
  };

  const fabPosition =
    position === "bottom-right" ? styles.fabRight : styles.fabLeft;

  return (
    <TouchableOpacity
      style={[styles.fab, fabPosition]}
      onPress={handleFeedback}
      activeOpacity={0.8}
    >
      <Text style={styles.fabText}>💬</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: "#6366f1",
  },
  secondary: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  minimal: {
    backgroundColor: "transparent",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  primaryText: {
    color: "#ffffff",
  },
  secondaryText: {
    color: "#374151",
  },
  minimalText: {
    color: "#6366f1",
  },
  fab: {
    position: "absolute",
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#6366f1",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  fabRight: {
    right: 24,
  },
  fabLeft: {
    left: 24,
  },
  fabText: {
    fontSize: 24,
  },
});
