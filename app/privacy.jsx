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

export default function PrivacySettingsScreen() {
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
            <Text style={styles.title}>Privacy Settings</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>How Privacy Works</Text>
          <Text style={styles.bodyText}>
            Your profile, projects, bids, and conversations are stored securely in
            your project database. Access is governed by your authenticated user
            session and table policies.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>You Can Control</Text>
          <Text style={styles.listItem}>- Push notifications in Settings</Text>
          <Text style={styles.listItem}>- Account role switching limits</Text>
          <Text style={styles.listItem}>- Account deletion from Settings</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Need help?</Text>
          <Text style={styles.bodyText}>
            For privacy requests or data deletion support, contact
            {" "}support@lancer.app from the Support section.
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
    listItem: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.textSecondary,
    },
  });
