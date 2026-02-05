import { useTheme } from "@/hooks/ThemeContext";
import { useAuth } from "@/hooks/useAuth";
import { Link, router } from "expo-router";
import {
  ArrowRight,
  Briefcase,
  Clock,
  DollarSign,
  FolderOpen,
  LogOut,
  PlusCircle,
  Settings,
  TrendingUp,
  User,
  Users,
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
  TouchableOpacity,
  View,
} from "react-native";

import FeedBackForm from "../../../components/FeedBackForm";
import { supabase } from "../../../lib/Client";
import { ClientId, getProjects } from "../../../lib/supabase";

export default function ClientDashboard() {
  const { theme, isDark } = useTheme();
  const { user, signOut } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState({
    totalProjects: 0,
    activeProjects: 0,
    totalProposals: 0,
  });
  const [loading, setLoading] = useState(true);
  const posthog = usePostHog();
  useEffect(() => {
    if (user) fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;
    const { clientProfile } = await ClientId(user?.id);
    try {
      const { data: projectsData } = await getProjects(clientProfile?.id);

      if (projectsData) {
        const withCounts = await Promise.all(
          projectsData.map(async (project) => {
            const { count, error } = await supabase
              .from("bids")
              .select("*", { count: "exact", head: true })
              .eq("project_id", project.id);
            if (error) return console.error(error);
            return { ...project, proposals_count: count || 0 };
          }),
        );
        setProjects(withCounts);

        const totalProposals = withCounts.reduce(
          (sum, p) => sum + (p.proposals_count || 0),
          0,
        );

        setStats({
          totalProjects: withCounts.length,
          activeProjects: withCounts.filter(
            (p) => p.status === "open" || p.status === "in_progress",
          ).length,
          totalProposals,
        });
      }

      setLoading(false);
    } catch (error) {
      console.error(error);
    }
  };

  const handleLogout = async () => {
    setModalVisible(false);
    posthog.capture("button_pressed", {
      button_name: "signup",
    });
    await signOut();
    router.replace("/login");
  };

  const getStatusStyles = (status) => {
    switch (status) {
      case "open":
        return { bg: theme.successBg, text: theme.successText };
      case "in_progress":
        return { bg: theme.infoBg, text: theme.infoText };
      case "completed":
        return { bg: theme.surfaceAlt, text: theme.text };
      case "cancelled":
        return { bg: theme.errorBg, text: theme.errorText };
      default:
        return { bg: theme.surfaceAlt, text: theme.textSecondary };
    }
  };

  const styles = createStyles(theme);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Client Dashboard</Text>
            <Text style={styles.headerSubtitle}>
              Manage your projects and find talent
            </Text>
          </View>

          <Pressable
            onPress={() => router.push(`/(Details)/NewProject`)}
            style={styles.postButton}
          >
            <PlusCircle size={18} color={theme.surface} />
            <Text style={styles.postButtonText}>Post Project</Text>
          </Pressable>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard
            title="Total Projects"
            value={stats.totalProjects}
            subtitle={`${stats.activeProjects} active`}
            icon={<FolderOpen size={20} color={theme.primary} />}
            bgColor={theme.iconBg}
            theme={theme}
          />

          <StatCard
            title="Proposals"
            value={stats.totalProposals}
            subtitle="From freelancers"
            icon={
              <Users size={20} color={theme.primaryDark || theme.primary} />
            }
            bgColor={theme.cardHighlight || theme.surfaceAlt}
            theme={theme}
          />
          <StatCard
            title="Active Budget"
            value="$0"
            subtitle="In escrow"
            icon={<DollarSign size={20} color={theme.success} />}
            bgColor={theme.successBg}
            theme={theme}
          />
          <StatCard
            title="Success Rate"
            value="100%"
            subtitle="Completed"
            icon={<TrendingUp size={20} color={theme.warning} />}
            bgColor={theme.warningBg}
            theme={theme}
          />
        </View>
        <FeedBackForm user={user} />
        {/* Recent Projects Card */}
        <View style={styles.projectsCard}>
          <View style={styles.projectsHeader}>
            <View>
              <Text style={styles.projectsTitle}>Recent Projects</Text>
              <Text style={styles.projectsSubtitle}>
                Your latest project postings
              </Text>
            </View>

            <Pressable onPress={() => router.push("/(tab)/projects")}>
              <ArrowRight size={20} color={theme.primary} />
            </Pressable>
          </View>

          {projects.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Briefcase size={48} color={theme.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No projects yet</Text>
              <Text style={styles.emptyDescription}>
                Post your first project to receive proposals from talented
                freelancers.
              </Text>
              <Pressable
                onPress={() => router.push(`/(Details)/NewProject`)}
                style={styles.emptyButton}
              >
                <PlusCircle size={18} color={theme.surface} />
                <Text style={styles.emptyButtonText}>
                  Post Your First Project
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.projectsList}>
              {projects.map((project) => {
                const statusStyles = getStatusStyles(project.status);
                return (
                  <Link
                    key={project?.id}
                    href={`/(Details)/${project.id}`}
                    asChild
                  >
                    <TouchableOpacity
                      key={project.id}
                      style={styles.projectItem}
                    >
                      <View style={styles.projectMain}>
                        <View style={styles.projectContent}>
                          <Text style={styles.projectTitle} numberOfLines={2}>
                            {project.title}
                          </Text>

                          <View style={styles.projectMeta}>
                            <View style={styles.budgetContainer}>
                              <DollarSign
                                size={14}
                                color={theme.textSecondary}
                              />
                              <Text style={styles.budgetText}>
                                ${project.budget_min?.toLocaleString()} – $
                                {project.budget_max?.toLocaleString()}
                              </Text>
                            </View>

                            <View style={styles.dateContainer}>
                              <Clock size={12} color={theme.textMuted} />
                              <Text style={styles.dateText}>
                                {new Date(
                                  project.created_at,
                                ).toLocaleDateString()}
                              </Text>
                            </View>
                          </View>
                        </View>

                        <View style={styles.projectStats}>
                          <View style={styles.proposalsContainer}>
                            <Text style={styles.proposalsCount}>
                              {project.proposals_count}
                            </Text>
                            <Text style={styles.proposalsLabel}>proposals</Text>
                          </View>

                          <View
                            style={[
                              styles.statusBadge,
                              { backgroundColor: statusStyles.bg },
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusText,
                                { color: statusStyles.text },
                              ]}
                            >
                              {project.status.replace("_", " ")}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </Link>
                );
              })}
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.quickActionsTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <Pressable
              style={styles.quickActionCard}
              onPress={() => router.push("/(tab)/projects")}
            >
              <FolderOpen size={24} color={theme.primary} />
              <Text style={styles.quickActionText}>View All Projects</Text>
            </Pressable>
            <Pressable
              style={styles.quickActionCard}
              onPress={() => router.push("/freelancers")}
            >
              <Users size={24} color={theme.primaryDark || theme.primary} />
              <Text style={styles.quickActionText}>Browse Freelancers</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
      {/* Floating Profile Avatar */}
      <Pressable
        style={styles.floatingAvatar}
        onPress={() => setModalVisible(true)}
      >
        <User size={24} color={theme.surface} />
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
                router.push("/profile");
              }}
            >
              <User size={20} color={theme.text} />
              <Text style={styles.menuText}>Profile</Text>
            </Pressable>

            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setModalVisible(false);
                router.push("/settings");
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

/* ------------------ Stat Card Component ------------------ */

function StatCard({ title, value, subtitle, icon, bgColor, theme }) {
  const styles = createStatCardStyles(theme);

  return (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <Text style={styles.statTitle}>{title}</Text>
        <View style={[styles.statIcon, { backgroundColor: bgColor }]}>
          {icon}
        </View>
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statSubtitle}>{subtitle}</Text>
    </View>
  );
}

const createStatCardStyles = (theme) =>
  StyleSheet.create({
    statCard: {
      width: "48%",
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    statHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    statTitle: {
      fontSize: 13,
      color: theme.textSecondary,
      fontWeight: "600",
    },
    statIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    statValue: {
      fontSize: 28,
      fontWeight: "800",
      color: theme.text,
      marginBottom: 4,
    },
    statSubtitle: {
      fontSize: 12,
      color: theme.textMuted,
      fontWeight: "500",
    },
  });

/* ------------------ Main Styles ------------------ */

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      paddingHorizontal: 16,
      paddingTop: 35,
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.background,
      gap: 16,
    },
    loadingText: {
      color: theme.textSecondary,
      fontSize: 16,
      fontWeight: "500",
    },

    // Header
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 24,
    },
    headerText: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: "800",
      color: theme.text,
      marginBottom: 4,
    },
    headerSubtitle: {
      color: theme.textSecondary,
      fontSize: 15,
    },
    postButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: theme.primary,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    postButtonText: {
      fontWeight: "700",
      color: theme.surface,
      fontSize: 15,
    },

    // Stats Grid
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      marginBottom: 24,
    },

    // Projects Card
    projectsCard: {
      backgroundColor: theme.surface,
      borderRadius: 20,
      padding: 20,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: theme.border,
    },
    projectsHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 20,
    },
    projectsTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 4,
    },
    projectsSubtitle: {
      color: theme.textSecondary,
      fontSize: 14,
    },

    // Empty State
    emptyState: {
      alignItems: "center",
      paddingVertical: 48,
    },
    emptyIconContainer: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 20,
    },
    emptyTitle: {
      fontWeight: "700",
      fontSize: 18,
      color: theme.text,
      marginBottom: 8,
    },
    emptyDescription: {
      color: theme.textSecondary,
      textAlign: "center",
      marginBottom: 24,
      fontSize: 15,
      lineHeight: 22,
      paddingHorizontal: 20,
    },
    emptyButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    emptyButtonText: {
      fontWeight: "700",
      color: theme.surface,
      fontSize: 16,
    },

    // Projects List
    projectsList: {
      gap: 12,
    },
    projectItem: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      padding: 16,
      backgroundColor: theme.surfaceAlt,
    },
    projectMain: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
    },
    projectContent: {
      flex: 1,
      gap: 8,
    },
    projectTitle: {
      fontWeight: "700",
      fontSize: 16,
      color: theme.text,
      lineHeight: 22,
    },
    projectMeta: {
      gap: 6,
    },
    budgetContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    budgetText: {
      fontSize: 14,
      color: theme.textSecondary,
      fontWeight: "600",
    },
    dateContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    dateText: {
      fontSize: 12,
      color: theme.textMuted,
    },
    projectStats: {
      alignItems: "flex-end",
      gap: 8,
    },
    proposalsContainer: {
      alignItems: "center",
      backgroundColor: theme.iconBg,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    proposalsCount: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.primary,
    },
    proposalsLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.primary,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
    },
    statusText: {
      fontSize: 12,
      fontWeight: "700",
      textTransform: "capitalize",
    },

    // Quick Actions
    quickActions: {
      marginBottom: 24,
    },
    quickActionsTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 16,
    },
    quickActionsGrid: {
      flexDirection: "row",
      gap: 12,
    },
    quickActionCard: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 20,
      alignItems: "center",
      gap: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    quickActionText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.text,
      textAlign: "center",
    },

    bottomSpacer: {
      height: 32,
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
    emailText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.primary,
      marginBottom: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
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
  });
