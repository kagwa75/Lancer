import { useTheme } from "@/hooks/ThemeContext";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "expo-router";
import {
  CheckCircle,
  Clock,
  FolderOpen,
  PlusCircle,
  TrendingUp,
  Users,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../../lib/Client";
import { ClientId, getProjects } from "../../../lib/supabase";

export default function Projects() {
  const { theme, isDark } = useTheme();
  const { user, userRole, loading } = useAuth();
  const router = useRouter();

  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/(auth)/login");
      } else if (userRole !== "client") {
        router.push("/(ftab)/home");
      }
    }
  }, [user, userRole, loading, router]);

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  const fetchProjects = async () => {
    if (!user) return;
    const { clientProfile } = await ClientId(user?.id);
    const { data } = await getProjects(clientProfile?.id);
    if (data) {
      const projectsWithProposals = await Promise.all(
        data.map(async (project) => {
          const { count } = await supabase
            .from("bids")
            .select("*", { count: "exact", head: true })
            .eq("project_id", project.id);
          return { ...project, proposals_count: count || 0 };
        }),
      );
      setProjects(projectsWithProposals);
    }

    setIsLoading(false);
  };

  const getStatusStyles = (status) => {
    const styles = {
      draft: { bg: theme.surfaceAlt, text: theme.textSecondary, icon: Clock },
      open: { bg: theme.successBg, text: theme.successText, icon: TrendingUp },
      in_progress: { bg: theme.infoBg, text: theme.infoText, icon: Clock },
      completed: {
        bg: theme.warningBg,
        text: theme.warningText,
        icon: CheckCircle,
      },
      cancelled: { bg: theme.errorBg, text: theme.errorText, icon: Clock },
    };
    return styles[status] || styles.draft;
  };

  const filteredProjects = projects.filter((project) => {
    if (activeTab === "all") return true;
    if (activeTab === "active")
      return ["open", "in_progress"].includes(project.status);
    if (activeTab === "completed") return project.status === "completed";
    return true;
  });

  const getTabCount = (tab) => {
    switch (tab) {
      case "all":
        return projects.length;
      case "active":
        return projects.filter((p) =>
          ["open", "in_progress"].includes(p.status),
        ).length;
      case "completed":
        return projects.filter((p) => p.status === "completed").length;
      default:
        return 0;
    }
  };

  const styles = createStyles(theme);

  if (loading || userRole !== "client") {
    return null;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>My Projects</Text>
            <Text style={styles.headerSubtitle}>
              Manage your posted projects
            </Text>
          </View>

          <TouchableOpacity
            style={styles.postButton}
            activeOpacity={0.8}
            onPress={() => router.push(`/(Details)/NewProject`)}
          >
            <PlusCircle size={18} color={theme.surface} />
            <Text style={styles.postButtonText}>Post Project</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          {["all", "active", "completed"].map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.tabTextActive,
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
              <View
                style={[
                  styles.tabBadge,
                  activeTab === tab && styles.tabBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    activeTab === tab && styles.tabBadgeTextActive,
                  ]}
                >
                  {getTabCount(tab)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.skeletonCard}>
                <View style={styles.skeletonHeader}>
                  <View style={styles.skeletonTitle} />
                  <View style={styles.skeletonBadge} />
                </View>
                <View style={styles.skeletonLine} />
                <View style={styles.skeletonLineSmall} />
              </View>
            ))}
          </View>
        ) : filteredProjects.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <FolderOpen size={56} color={theme.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No projects found</Text>
            <Text style={styles.emptyDescription}>
              {activeTab === "all"
                ? "Post your first project to start receiving proposals from talented freelancers."
                : `No ${activeTab} projects yet.`}
            </Text>
            {activeTab === "all" && (
              <TouchableOpacity
                style={styles.emptyButton}
                activeOpacity={0.8}
                onPress={() => router.push(`/(Details)/NewProject`)}
              >
                <PlusCircle size={20} color={theme.surface} />
                <Text style={styles.emptyButtonText}>
                  Post Your First Project
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.projectsList}>
            {filteredProjects.map((project) => {
              const statusStyles = getStatusStyles(project.status);
              const StatusIcon = statusStyles.icon;

              return (
                <TouchableOpacity
                  key={project?.id}
                  style={styles.projectCard}
                  onPress={() =>
                    router.push({
                      pathname: "/(Details)/[id]",
                      params: { id: project.id },
                    })
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.projectCardContent}>
                    <View style={styles.projectHeader}>
                      <View style={styles.projectTitleContainer}>
                        <Text style={styles.projectTitle} numberOfLines={2}>
                          {project.title}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: statusStyles.bg },
                        ]}
                      >
                        <StatusIcon size={12} color={statusStyles.text} />
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

                    <View style={styles.projectMeta}>
                      <View style={styles.budgetContainer}>
                        <View style={styles.budgetBadge}>
                          <Text style={styles.budgetText}>
                            ${project.budget_min?.toLocaleString()} - $
                            {project.budget_max?.toLocaleString()}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.metaRow}>
                        <View style={styles.metaItem}>
                          <Clock size={14} color={theme.textMuted} />
                          <Text style={styles.metaText}>
                            {new Date(project.created_at).toLocaleDateString()}
                          </Text>
                        </View>

                        <View style={styles.proposalsContainer}>
                          <Users size={14} color={theme.primary} />
                          <Text style={styles.proposalsText}>
                            {project.proposals_count}
                          </Text>
                          <Text style={styles.proposalsLabel}>
                            {project.proposals_count === 1
                              ? "proposal"
                              : "proposals"}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      paddingTop: 35,
    },
    content: {
      padding: 16,
      gap: 24,
    },

    // Header
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerText: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 32,
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
      color: theme.surface,
      fontWeight: "700",
      fontSize: 15,
    },

    // Tabs
    tabsContainer: {
      flexDirection: "row",
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 4,
      gap: 4,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    tab: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
    },
    tabActive: {
      backgroundColor: theme.iconBg,
    },
    tabText: {
      fontWeight: "600",
      fontSize: 14,
      color: theme.textSecondary,
    },
    tabTextActive: {
      color: theme.primary,
    },
    tabBadge: {
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      minWidth: 24,
      alignItems: "center",
    },
    tabBadgeActive: {
      backgroundColor: theme.primary,
    },
    tabBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.textSecondary,
    },
    tabBadgeTextActive: {
      color: theme.surface,
    },

    // Loading State
    loadingContainer: {
      gap: 16,
    },
    skeletonCard: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 20,
      gap: 12,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    skeletonHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    skeletonTitle: {
      width: "60%",
      height: 20,
      backgroundColor: theme.border,
      borderRadius: 4,
    },
    skeletonBadge: {
      width: 60,
      height: 24,
      backgroundColor: theme.border,
      borderRadius: 12,
    },
    skeletonLine: {
      width: "100%",
      height: 16,
      backgroundColor: theme.border,
      borderRadius: 4,
    },
    skeletonLineSmall: {
      width: "40%",
      height: 14,
      backgroundColor: theme.border,
      borderRadius: 4,
    },

    // Empty State
    emptyState: {
      backgroundColor: theme.surface,
      borderRadius: 20,
      padding: 48,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },
    emptyIconContainer: {
      width: 112,
      height: 112,
      borderRadius: 56,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 24,
    },
    emptyTitle: {
      fontWeight: "700",
      fontSize: 20,
      marginBottom: 12,
      color: theme.text,
    },
    emptyDescription: {
      color: theme.textSecondary,
      textAlign: "center",
      marginBottom: 28,
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
      gap: 16,
    },
    projectCard: {
      backgroundColor: theme.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
    },
    projectCardContent: {
      padding: 20,
    },
    projectHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 16,
      gap: 12,
    },
    projectTitleContainer: {
      flex: 1,
    },
    projectTitle: {
      fontWeight: "700",
      fontSize: 18,
      color: theme.text,
      lineHeight: 26,
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
    },
    statusText: {
      fontSize: 12,
      fontWeight: "700",
      textTransform: "capitalize",
    },

    // Project Meta
    projectMeta: {
      gap: 12,
    },
    budgetContainer: {
      flexDirection: "row",
      alignItems: "center",
    },
    budgetBadge: {
      backgroundColor: theme.successBg,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
    },
    budgetText: {
      fontSize: 15,
      color: theme.successText,
      fontWeight: "700",
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
    },
    metaItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    metaText: {
      fontSize: 13,
      color: theme.textSecondary,
      fontWeight: "500",
    },
    proposalsContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.iconBg,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    proposalsText: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.primary,
    },
    proposalsLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.primary,
    },
  });
