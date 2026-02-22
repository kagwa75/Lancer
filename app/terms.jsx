import { useTheme } from "@/hooks/ThemeContext";
import { router } from "expo-router";
import { ArrowLeft, FileText } from "lucide-react-native";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function TermsScreen() {
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
            <FileText size={18} color={theme.primary} />
            <Text style={styles.title}>Terms of Service</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Marketplace Use</Text>
          <Text style={styles.bodyText}>
            Users must provide accurate account information and use the platform
            for lawful freelance work only.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payments and Escrow</Text>
          <Text style={styles.bodyText}>
            Escrow, release, and refund actions follow project status and payment
            provider rules. Payment processing fees may apply.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account Responsibility</Text>
          <Text style={styles.bodyText}>
            You are responsible for account security, data accuracy, and all
            actions under your account.
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
