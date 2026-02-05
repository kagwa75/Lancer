import { useTheme } from "@/hooks/ThemeContext";
import { useAuth } from "@/hooks/useAuth";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import {
  ArrowUpRight,
  Award,
  Calendar,
  ChevronRight,
  Clock,
  DollarSign,
  FileText,
  Search,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getAllBids } from "../../../lib/supabase";

export default function MyProposals() {
  const { user, userRole, authLoading, loading } = useAuth();
  const { theme, isDark } = useTheme();
  const styles = createStyles(theme);
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const router = useRouter();

  const [proposals, setProposals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    accepted: 0,
    rejected: 0,
    totalBidAmount: 0,
    successRate: 0,
  });

  // Animation values
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/(auth)/login");
    } else if (!authLoading && userRole && userRole !== "freelancer") {
      router.push("/(tab)/home");
    }
  }, [user, userRole, authLoading, router]);

  useEffect(() => {
    if (isFocused && user) {
      fetchProposals();
    }
  }, [isFocused, user]);

  useEffect(() => {
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const fetchProposals = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data } = await getAllBids(user.id);
      if (data) {
        const transformedProposals = data.map((p) => ({
          ...p,
          project: Array.isArray(p.project) ? p.project[0] : p.project,
        }));
        setProposals(transformedProposals);

        // Calculate advanced stats
        const total = transformedProposals.length;
        const accepted = transformedProposals.filter(
          (p) => p.status === "accepted",
        ).length;
        const pending = transformedProposals.filter(
          (p) => p.status === "pending",
        ).length;
        const rejected = transformedProposals.filter(
          (p) => p.status === "rejected",
        ).length;
        const totalBid = transformedProposals.reduce(
          (sum, p) => sum + (p.bid_amount || 0),
          0,
        );
        const successRate =
          total > 0 ? Math.round((accepted / total) * 100) : 0;

        setStats({
          total,
          pending,
          accepted,
          rejected,
          totalBidAmount: totalBid,
          successRate,
        });
      }
    } catch (error) {
      console.error("Error fetching proposals:", error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchProposals();
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: {
        bg: theme.warningBg,
        text: theme.warningText,
        icon: theme.warning,
        gradient: ["#FEF3C7", "#FDE68A"],
      },
      accepted: {
        bg: theme.successBg,
        text: theme.successText,
        icon: theme.success,
        gradient: ["#D1FAE5", "#A7F3D0"],
      },
      rejected: {
        bg: theme.errorBg,
        text: theme.errorText,
        icon: theme.error,
        gradient: ["#FEE2E2", "#FECACA"],
      },
      withdrawn: {
        bg: theme.surfaceAlt,
        text: theme.textMuted,
        icon: theme.textMuted,
        gradient: [theme.surfaceAlt, theme.surface],
      },
    };
    return colors[status] || colors.withdrawn;
  };

  const getStatusCount = (status) => {
    if (status === "all") return proposals.length;
    return proposals.filter((p) => p.status === status).length;
  };

  const filteredProposals = proposals.filter((proposal) => {
    if (activeTab === "all") return true;
    return proposal.status === activeTab;
  });

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const formatBudget = (min, max) => {
    if (min && max) {
      console.log("Budget", min && max);
      return `$${min.toFixed(0)}k - $${max.toFixed(0)}k`;
    }
    return "Not specified";
  };

  if (loading || userRole !== "freelancer") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading proposals...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        {/* Gradient Header Background */}
        <View style={styles.headerBackground}>
          <View
            style={[
              styles.headerGradient,
              {
                backgroundColor: isDark ? theme.surface : theme.primary + "10",
              },
            ]}
          />
        </View>

        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconContainer}>
                <FileText size={24} color={theme.primary} strokeWidth={2.5} />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={styles.title}>My Proposals</Text>
                <Text style={styles.subtitle}>
                  {proposals.length}{" "}
                  {proposals.length === 1 ? "submission" : "submissions"}{" "}
                  tracked
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.findWorkButton}
              onPress={() => navigation.navigate("jobs")}
              activeOpacity={0.8}
            >
              <Search size={16} color="white" strokeWidth={2.5} />
              <Text style={styles.findWorkButtonText}>Find Work</Text>
              <ArrowUpRight size={14} color="white" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Enhanced Stats Dashboard */}
        {proposals.length > 0 && (
          <Animated.View style={[styles.statsSection, { opacity: fadeAnim }]}>
            {/* Primary Stats Row */}
            <View style={styles.primaryStats}>
              <View style={styles.primaryStatCard}>
                <View style={styles.primaryStatHeader}>
                  <Text style={styles.primaryStatLabel}>Success Rate</Text>
                  <Award size={16} color={theme.success} />
                </View>
                <Text style={styles.primaryStatValue}>
                  {stats.successRate}%
                </Text>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${stats.successRate}%` },
                    ]}
                  />
                </View>
              </View>

              <View style={styles.primaryStatCard}>
                <View style={styles.primaryStatHeader}>
                  <Text style={styles.primaryStatLabel}>Total Bid Value</Text>
                  <DollarSign size={16} color={theme.primary} />
                </View>
                <Text style={styles.primaryStatValue}>
                  ${stats.totalBidAmount.toFixed(1)}k
                </Text>
                <Text style={styles.primaryStatSubtext}>
                  Avg ${Math.round(stats.totalBidAmount / stats.total) || 0}
                </Text>
              </View>
            </View>

            {/* Secondary Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.miniStatCard}>
                <View
                  style={[
                    styles.miniStatIcon,
                    { backgroundColor: theme.infoBg },
                  ]}
                >
                  <Target size={18} color={theme.primary} />
                </View>
                <Text style={styles.miniStatValue}>{stats.total}</Text>
                <Text style={styles.miniStatLabel}>Total</Text>
              </View>

              <View style={styles.miniStatCard}>
                <View
                  style={[
                    styles.miniStatIcon,
                    { backgroundColor: theme.successBg },
                  ]}
                >
                  <Award size={18} color={theme.success} />
                </View>
                <Text style={styles.miniStatValue}>{stats.accepted}</Text>
                <Text style={styles.miniStatLabel}>Won</Text>
              </View>

              <View style={styles.miniStatCard}>
                <View
                  style={[
                    styles.miniStatIcon,
                    { backgroundColor: theme.warningBg },
                  ]}
                >
                  <Clock size={18} color={theme.warning} />
                </View>
                <Text style={styles.miniStatValue}>{stats.pending}</Text>
                <Text style={styles.miniStatLabel}>Pending</Text>
              </View>

              <View style={styles.miniStatCard}>
                <View
                  style={[
                    styles.miniStatIcon,
                    { backgroundColor: theme.errorBg },
                  ]}
                >
                  <Zap size={18} color={theme.error} />
                </View>
                <Text style={styles.miniStatValue}>{stats.rejected}</Text>
                <Text style={styles.miniStatLabel}>Rejected</Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Modern Tabs */}
        <View style={styles.tabsSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsContainer}
          >
            {["all", "pending", "accepted", "rejected"].map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.activeTab]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === tab && styles.activeTabText,
                  ]}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
                <View
                  style={[
                    styles.tabBadge,
                    activeTab === tab && styles.activeTabBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabBadgeText,
                      activeTab === tab && styles.activeTabBadgeText,
                    ]}
                  >
                    {getStatusCount(tab)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Proposals List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.skeletonCard}>
                <View style={styles.skeletonHeader}>
                  <View style={styles.skeletonTitle} />
                  <View style={styles.skeletonBadge} />
                </View>
                <View style={styles.skeletonLine} />
                <View style={styles.skeletonLineShort} />
                <View style={styles.skeletonFooter}>
                  <View style={styles.skeletonFooterItem} />
                  <View style={styles.skeletonFooterItem} />
                </View>
              </View>
            ))}
          </View>
        ) : filteredProposals.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrapper}>
              <View style={styles.emptyIconCircle}>
                <FileText size={48} color={theme.textMuted} strokeWidth={1.5} />
              </View>
            </View>
            <Text style={styles.emptyTitle}>
              No {activeTab !== "all" && activeTab} proposals
            </Text>
            <Text style={styles.emptyText}>
              {activeTab === "all"
                ? "Start submitting proposals to showcase your skills and land projects."
                : `You don't have any ${activeTab} proposals yet.`}
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => navigation.navigate("jobs")}
              activeOpacity={0.8}
            >
              <Search size={18} color="white" strokeWidth={2.5} />
              <Text style={styles.emptyButtonText}>Browse Projects</Text>
              <ArrowUpRight size={14} color="white" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.proposalsList}>
            {filteredProposals.map((proposal, index) => {
              const statusColor = getStatusColor(proposal.status);
              const isFirst = index === 0;
              const isRecent =
                new Date() - new Date(proposal.created_at) < 86400000; // 24 hours

              return (
                <TouchableOpacity
                  key={proposal.id}
                  style={[styles.proposalCard, isFirst && styles.featuredCard]}
                  onPress={() =>
                    proposal.project?.id &&
                    router.push(`/(Details)/${proposal.project.id}`)
                  }
                  activeOpacity={0.7}
                >
                  {/* Featured Badge */}
                  {isFirst && (
                    <View style={styles.featuredBadge}>
                      <TrendingUp
                        size={12}
                        color={theme.primary}
                        strokeWidth={3}
                      />
                      <Text style={styles.featuredText}>Most Recent</Text>
                    </View>
                  )}

                  {/* Card Content */}
                  <View style={styles.cardContent}>
                    {/* Header */}
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderLeft}>
                        <Text style={styles.projectTitle} numberOfLines={2}>
                          {proposal.project?.title || "Project Not Found"}
                        </Text>
                        {isRecent && (
                          <View style={styles.newBadge}>
                            <View style={styles.newDot} />
                            <Text style={styles.newText}>New</Text>
                          </View>
                        )}
                      </View>
                      <View
                        style={[
                          styles.statusPill,
                          { backgroundColor: statusColor.bg },
                        ]}
                      >
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: statusColor.icon },
                          ]}
                        />
                        <Text
                          style={[
                            styles.statusText,
                            { color: statusColor.text },
                          ]}
                        >
                          {proposal.status.charAt(0).toUpperCase() +
                            proposal.status.slice(1)}
                        </Text>
                      </View>
                    </View>

                    {/* Cover Letter */}
                    {proposal.cover_letter && (
                      <View style={styles.coverLetterSection}>
                        <Text style={styles.coverLetter} numberOfLines={2}>
                          "{proposal.cover_letter}"
                        </Text>
                      </View>
                    )}

                    {/* Metrics Row */}
                    <View style={styles.metricsRow}>
                      <View style={styles.metricItem}>
                        <View style={styles.metricIconContainer}>
                          <DollarSign
                            size={14}
                            color={theme.success}
                            strokeWidth={2.5}
                          />
                        </View>
                        <View style={styles.metricContent}>
                          <Text style={styles.metricLabel}>Your Bid</Text>
                          <Text style={styles.metricValue}>
                            ${proposal.bid_amount?.toLocaleString() || "0"}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.metricDivider} />

                      <View style={styles.metricItem}>
                        <View style={styles.metricIconContainer}>
                          <Calendar
                            size={14}
                            color={theme.icon}
                            strokeWidth={2.5}
                          />
                        </View>
                        <View style={styles.metricContent}>
                          <Text style={styles.metricLabel}>Submitted</Text>
                          <Text style={styles.metricValue}>
                            {formatDate(proposal.created_at)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Additional Info */}
                    {(proposal.estimated_duration ||
                      (proposal.project?.budget_min &&
                        proposal.project?.budget_max)) && (
                      <View style={styles.additionalInfo}>
                        {proposal.estimated_duration && (
                          <View style={styles.infoChip}>
                            <Clock size={12} color={theme.textSecondary} />
                            <Text style={styles.infoChipText}>
                              {proposal.estimated_duration}
                            </Text>
                          </View>
                        )}
                        {proposal.project?.budget_min &&
                          proposal.project?.budget_max && (
                            <View style={styles.infoChip}>
                              <Target size={12} color={theme.textSecondary} />
                              <Text style={styles.infoChipText}>
                                Budget:{" "}
                                {formatBudget(
                                  proposal.project.budget_min,
                                  proposal.project.budget_max,
                                )}
                              </Text>
                            </View>
                          )}
                      </View>
                    )}

                    {/* Footer */}
                    <View style={styles.cardFooter}>
                      <Text style={styles.viewDetailsLink}>
                        View Project Details
                      </Text>
                      <ChevronRight
                        size={16}
                        color={theme.primary}
                        strokeWidth={2.5}
                      />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
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
      paddingTop: 45,
    },
    loadingCenter: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      gap: 12,
    },
    loadingText: {
      fontSize: 14,
      color: theme.textSecondary,
      fontWeight: "600",
    },

    // Header Background
    headerBackground: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 200,
      overflow: "hidden",
    },
    headerGradient: {
      flex: 1,
      opacity: 0.3,
    },

    // Header
    header: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 20,
    },
    headerContent: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    headerLeft: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    headerIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: theme.primary + "15",
      justifyContent: "center",
      alignItems: "center",
    },
    headerTextContainer: {
      flex: 1,
    },
    title: {
      fontSize: 26,
      fontWeight: "900",
      color: theme.text,
      letterSpacing: -0.8,
      marginBottom: 2,
    },
    subtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      fontWeight: "600",
    },
    findWorkButton: {
      backgroundColor: theme.primary,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },
    findWorkButtonText: {
      color: "white",
      fontWeight: "800",
      fontSize: 13,
      letterSpacing: 0.3,
    },

    // Stats Section
    statsSection: {
      paddingHorizontal: 20,
      marginBottom: 20,
      gap: 12,
    },
    primaryStats: {
      flexDirection: "row",
      gap: 12,
    },
    primaryStatCard: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    primaryStatHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    primaryStatLabel: {
      fontSize: 11,
      color: theme.textMuted,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    primaryStatValue: {
      fontSize: 28,
      fontWeight: "900",
      color: theme.text,
      letterSpacing: -1,
      marginBottom: 4,
    },
    primaryStatSubtext: {
      fontSize: 11,
      color: theme.textSecondary,
      fontWeight: "600",
    },
    progressBar: {
      height: 4,
      backgroundColor: theme.borderLight,
      borderRadius: 2,
      overflow: "hidden",
      marginTop: 8,
    },
    progressFill: {
      height: "100%",
      backgroundColor: theme.success,
      borderRadius: 2,
    },
    statsGrid: {
      flexDirection: "row",
      gap: 10,
    },
    miniStatCard: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: 14,
      padding: 12,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },
    miniStatIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 8,
    },
    miniStatValue: {
      fontSize: 18,
      fontWeight: "900",
      color: theme.text,
      marginBottom: 2,
    },
    miniStatLabel: {
      fontSize: 10,
      color: theme.textMuted,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },

    // Tabs
    tabsSection: {
      marginBottom: 16,
      paddingTop: 4,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    tabsContainer: {
      paddingHorizontal: 20,
      gap: 10,
      paddingVertical: 16,
    },
    tab: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: theme.surface,
      borderWidth: 1.5,
      borderColor: theme.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    activeTab: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    tabText: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.textSecondary,
      letterSpacing: 0.2,
    },
    activeTabText: {
      color: "white",
    },
    tabBadge: {
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      minWidth: 26,
      alignItems: "center",
    },
    activeTabBadge: {
      backgroundColor: "rgba(255, 255, 255, 0.3)",
    },
    tabBadgeText: {
      fontSize: 11,
      fontWeight: "900",
      color: theme.text,
    },
    activeTabBadgeText: {
      color: "white",
    },

    // Loading Skeletons
    loadingContainer: {
      paddingHorizontal: 20,
      gap: 16,
    },
    skeletonCard: {
      backgroundColor: theme.surface,
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.border,
    },
    skeletonHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    skeletonTitle: {
      width: "60%",
      height: 20,
      backgroundColor: theme.surfaceAlt,
      borderRadius: 6,
    },
    skeletonBadge: {
      width: 70,
      height: 24,
      backgroundColor: theme.surfaceAlt,
      borderRadius: 12,
    },
    skeletonLine: {
      height: 14,
      backgroundColor: theme.surfaceAlt,
      borderRadius: 4,
      marginBottom: 8,
    },
    skeletonLineShort: {
      height: 14,
      width: "70%",
      backgroundColor: theme.surfaceAlt,
      borderRadius: 4,
      marginBottom: 16,
    },
    skeletonFooter: {
      flexDirection: "row",
      gap: 16,
    },
    skeletonFooterItem: {
      flex: 1,
      height: 40,
      backgroundColor: theme.surfaceAlt,
      borderRadius: 8,
    },

    // Empty State
    emptyState: {
      alignItems: "center",
      paddingVertical: 60,
      paddingHorizontal: 32,
    },
    emptyIconWrapper: {
      marginBottom: 24,
    },
    emptyIconCircle: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.surfaceAlt,
      justifyContent: "center",
      alignItems: "center",
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: theme.text,
      marginBottom: 8,
      letterSpacing: -0.5,
    },
    emptyText: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: "center",
      marginBottom: 28,
      lineHeight: 21,
      fontWeight: "500",
    },
    emptyButton: {
      backgroundColor: theme.primary,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 14,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },
    emptyButtonText: {
      color: "white",
      fontWeight: "800",
      fontSize: 15,
      letterSpacing: 0.3,
    },

    // Proposals List
    proposalsList: {
      paddingHorizontal: 20,
      gap: 16,
    },
    proposalCard: {
      backgroundColor: theme.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    featuredCard: {
      borderColor: theme.primary,
      borderWidth: 2,
      shadowColor: theme.primary,
      shadowOpacity: 0.15,
    },
    featuredBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.primary + "15",
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    featuredText: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.primary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    cardContent: {
      padding: 18,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 14,
      gap: 12,
    },
    cardHeaderLeft: {
      flex: 1,
      gap: 8,
    },
    projectTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: theme.text,
      lineHeight: 24,
      letterSpacing: -0.3,
    },
    newBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
    },
    newDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.success,
    },
    newText: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.success,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    statusPill: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusText: {
      fontSize: 11,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    coverLetterSection: {
      marginBottom: 16,
      paddingLeft: 12,
      borderLeftWidth: 3,
      borderLeftColor: theme.border,
    },
    coverLetter: {
      fontSize: 13,
      color: theme.textSecondary,
      lineHeight: 20,
      fontStyle: "italic",
      fontWeight: "500",
    },
    metricsRow: {
      flexDirection: "row",
      backgroundColor: theme.background,
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
      alignItems: "center",
    },
    metricItem: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    metricIconContainer: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: theme.surface,
      justifyContent: "center",
      alignItems: "center",
    },
    metricContent: {
      flex: 1,
    },
    metricLabel: {
      fontSize: 10,
      color: theme.textMuted,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    metricValue: {
      fontSize: 15,
      fontWeight: "800",
      color: theme.text,
      letterSpacing: -0.2,
    },
    metricDivider: {
      width: 1,
      height: 32,
      backgroundColor: theme.border,
      marginHorizontal: 8,
    },
    additionalInfo: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 12,
      flexWrap: "wrap",
    },
    infoChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
    },
    infoChipText: {
      fontSize: 11,
      color: theme.textSecondary,
      fontWeight: "600",
    },
    cardFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 6,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
    },
    viewDetailsLink: {
      fontSize: 13,
      color: theme.primary,
      fontWeight: "800",
      letterSpacing: 0.2,
    },
    bottomSpacing: {
      height: 40,
    },
  });
