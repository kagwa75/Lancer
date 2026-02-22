import { useTheme } from "@/hooks/ThemeContext";
import { router } from "expo-router";
import { ArrowLeft, Shield } from "lucide-react-native";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function PrivacyPolicyScreen() {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={20} color={theme.text} />
          </Pressable>
          <View style={styles.titleRow}>
            <Shield size={18} color={theme.primary} />
            <Text style={styles.title}>Privacy Policy</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Data Collected</Text>
          <Text style={styles.bodyText}>
            Account profile data, project activity, chat content, transaction
            metadata, and notification preferences are stored to operate the
            marketplace.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>How Data Is Used</Text>
          <Text style={styles.bodyText}>
            Data is used for authentication, matching freelancers and clients,
            project communication, payment processing, and analytics/monitoring.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Data Controls</Text>
          <Text style={styles.bodyText}>
            You can update profile information, notification settings, and request
            account deletion in Settings.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      padding: 16,
      gap: 16,
    },
    header: {
      gap: 12,
    },
    backButton: {
      alignSelf: "flex-start",
      padding: 8,
      borderRadius: 10,
      backgroundColor: theme.surface,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.text,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 8,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.text,
    },
    bodyText: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.textSecondary,
    },
  });
