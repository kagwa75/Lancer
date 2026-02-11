import { useTheme } from "@/hooks/ThemeContext";
import { useAuth } from "@/hooks/useAuth";
import { router } from "expo-router";
import {
  ArrowRight,
  DollarSign,
  FileText,
  LogOut,
  Search,
  Settings,
  Star,
  TrendingUp,
  User,
  X,
} from "lucide-react-native";
import { usePostHog } from "posthog-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import FeedbackForm from "../../../components/FeedBackForm";
import { supabase } from "../../../lib/Client";
import { getAllBids, getFreelancerProfile } from "../../../lib/supabase";

export default function FreelancerDashboard() {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const posthog = usePostHog();
  const [proposals, setProposals] = useState([]);
  const [profileCompleteness, setProfileCompleteness] = useState(0);
  const [stats, setStats] = useState({
    totalProposals: 0,
    acceptedProposals: 0,
    pendingProposals: 0,
  });
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (user) fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    const { data: profile } = await getFreelancerProfile(user.id);

    if (profile) {
      let completeness = 25;
      if (profile.title) completeness += 25;
      if (profile.hourly_rate) completeness += 25;
      if (profile.skills?.length) completeness += 25;
      setProfileCompleteness(completeness);
    }

    const { data } = await getAllBids(user.id);

    if (data) {
      const normalized = data.map((p) => ({
        ...p,
        project: Array.isArray(p.project) ? p.project[0] : p.project,
      }));
      console.log(normalized);
      setProposals(normalized);
      setStats({
        totalProposals: normalized.length,
        acceptedProposals: normalized.filter((p) => p.status === "accepted")
          .length,
        pendingProposals: normalized.filter((p) => p.status === "pending")
          .length,
      });
    }

    setLoading(false);
  };

  const handleLogout = async () => {
    setModalVisible(false);
    posthog.capture("button_pressed", {
      button_name: "logout",
    });
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const statusStyle = (status) => {
    switch (status) {
      case "accepted":
        return { backgroundColor: theme.successBg, color: theme.successText };
      case "pending":
        return { backgroundColor: theme.warningBg, color: theme.warningText };
      case "rejected":
        return { backgroundColor: theme.errorBg, color: theme.errorText };
      default:
        return { backgroundColor: theme.surfaceAlt, color: theme.textMuted };
    }
  };

  const styles = createStyles(theme);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Freelan Dashboard</Text>
            <Text style={styles.subtitle}>Find work and grow your career</Text>
          </View>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => router.push("/jobs")}
          >
            <Search size={16} color={theme.text} />
            <Text style={styles.btnText}>Find Projects</Text>
          </Pressable>
        </View>

        {/* Profile Completeness */}
        {profileCompleteness < 100 && (
          <View style={styles.cardHighlight}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Complete Your Profile</Text>
              <Text style={styles.percentageText}>{profileCompleteness}%</Text>
            </View>

            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${profileCompleteness}%` },
                ]}
              />
            </View>

            <Text style={styles.mutedText}>
              A complete profile helps you win more projects.
            </Text>

            <Pressable
              style={styles.outlineBtn}
              onPress={() => router.push("/profile")}
            >
              <Text style={styles.outlineBtnText}>Complete Profile</Text>
            </Pressable>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsGrid}>
          <StatCard
            title="Proposals Sent"
            value={stats.totalProposals}
            icon={<FileText size={16} color={theme.primary} />}
            theme={theme}
          />
          <StatCard
            title="Accepted"
            value={stats.acceptedProposals}
            icon={<TrendingUp size={16} color={theme.primary} />}
            theme={theme}
          />
          <StatCard
            title="Earnings"
            value="$0"
            icon={<DollarSign size={16} color={theme.primary} />}
            theme={theme}
          />
          <StatCard
            title="Rating"
            value="-"
            icon={<Star size={16} color={theme.primary} />}
            theme={theme}
          />
        </View>
        <FeedbackForm user={user} />
        {/* Recent Proposals */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.cardTitle}>Recent Proposals</Text>
              <Text style={styles.mutedText}>Track your submissions</Text>
            </View>
            <Pressable onPress={() => router.push("/proposals")}>
              <ArrowRight size={18} color={theme.text} />
            </Pressable>
          </View>

          {proposals.length === 0 ? (
            <Text style={styles.mutedText}>No proposals yet</Text>
          ) : (
            proposals.map((p) => (
              <Pressable
                key={p.id}
                style={styles.proposalItem}
                onPress={() => router.push(`/(description)/${p.project.id}`)}
              >
                <View>
                  <Text style={styles.bold}>{p.project.title}</Text>
                  <Text style={styles.mutedText}>
                    Bid: ${p.bid_amount} •{" "}
                    {new Date(p.created_at).toDateString()}
                  </Text>
                </View>
                <Text style={[styles.badge, statusStyle(p.status)]}>
                  {p.status}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>

      {/* Floating Profile Avatar */}
      <Pressable
        style={styles.floatingAvatar}
        onPress={() => setModalVisible(true)}
      >
        <User size={24} color="#fff" />
      </Pressable>

      {/* Profile Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Account</Text>

              <Pressable onPress={() => setModalVisible(false)}>
                <X size={20} color={theme.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.emailText}>{user?.email}</Text>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setModalVisible(false);
                router.push("/(Details)/fprofile");
              }}
            >
              <User size={20} color={theme.text} />
              <Text style={styles.menuText}>Profile</Text>
            </Pressable>

            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setModalVisible(false);
                router.push("/(auth)/settings");
              }}
            >
              <Settings size={20} color={theme.text} />
              <Text style={styles.menuText}>Settings</Text>
            </Pressable>

            <View style={styles.menuDivider} />

            <Pressable
              style={[styles.menuItem, styles.logoutItem]}
              onPress={handleLogout}
            >
              <LogOut size={20} color={theme.iconDanger} />
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

/* ---------- Small Components ---------- */

function StatCard({ title, value, icon, theme }) {
  const styles = createStatCardStyles(theme);

  return (
    <View style={styles.statCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.mutedText}>{title}</Text>
        {icon}
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const createStatCardStyles = (theme) =>
  StyleSheet.create({
    statCard: {
      width: "48%",
      backgroundColor: theme.cardBg,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    rowBetween: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    mutedText: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    statValue: {
      fontSize: 22,
      fontWeight: "700",
      marginTop: 6,
      color: theme.text,
    },
  });

/* ---------- Styles ---------- */

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      padding: 16,
      gap: 16,
      paddingBottom: 80,
      paddingTop: 45,
      backgroundColor: theme.background,
    },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.text,
    },
    subtitle: {
      color: theme.textSecondary,
      marginTop: 4,
    },

    primaryBtn: {
      flexDirection: "row",
      gap: 6,
      backgroundColor: theme.surfaceAlt,
      padding: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    btnText: {
      fontWeight: "600",
      color: theme.text,
    },

    card: {
      backgroundColor: theme.cardBg,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardHighlight: {
      backgroundColor: theme.cardHighlight,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.text,
    },

    mutedText: {
      color: theme.textSecondary,
      marginTop: 4,
      fontSize: 14,
    },
    bold: {
      fontWeight: "600",
      color: theme.text,
      fontSize: 14,
    },
    percentageText: {
      color: theme.text,
      fontWeight: "600",
    },

    rowBetween: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    progressBar: {
      height: 6,
      backgroundColor: theme.borderLight,
      borderRadius: 4,
      marginVertical: 10,
    },
    progressFill: {
      height: "100%",
      backgroundColor: theme.primary,
      borderRadius: 4,
    },

    outlineBtn: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      padding: 10,
      marginTop: 10,
      alignItems: "center",
      backgroundColor: theme.surface,
    },
    outlineBtnText: {
      color: theme.text,
      fontWeight: "500",
    },

    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },

    proposalItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderColor: theme.borderLight,
    },

    badge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      fontSize: 12,
      fontWeight: "600",
      textTransform: "capitalize",
    },

    // Floating Avatar Styles
    floatingAvatar: {
      position: "absolute",
      bottom: 24,
      right: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.primary,
      justifyContent: "center",
      alignItems: "center",
      elevation: 8,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },

    // Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.modalOverlay,
      justifyContent: "center",
      alignItems: "center",
    },
    modalContent: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 20,
      width: "80%",
      maxWidth: 320,
      elevation: 5,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.text,
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 8,
      borderRadius: 8,
    },
    menuText: {
      fontSize: 16,
      fontWeight: "500",
      color: theme.text,
    },
    menuDivider: {
      height: 1,
      backgroundColor: theme.divider,
      marginVertical: 8,
    },
    logoutItem: {
      backgroundColor: theme.iconDangerBg,
    },
    logoutText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.iconDanger,
    },
    emailText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.primary,
      marginBottom: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
  });
