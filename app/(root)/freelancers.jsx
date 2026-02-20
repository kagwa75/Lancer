import { useTheme } from "@/hooks/ThemeContext";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "expo-router";
import {
  MapPin,
  Search,
  Star,
  User,
  Users,
  Wallet,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/Client";

export default function FreelancersScreen() {
  const { theme } = useTheme();
  const { user, userRole, loading } = useAuth();
  const router = useRouter();

  const [freelancers, setFreelancers] = useState([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

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
    if (user && userRole === "client") {
      fetchFreelancers();
    }
  }, [user, userRole]);

  const fetchFreelancers = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: freelancerData, error: freelancerError } = await supabase
        .from("freelancer_profiles")
        .select("id,user_id,title,hourly_rate,availability,skills")
        .order("created_at", { ascending: false });

      if (freelancerError) throw freelancerError;

      const freelancerList = freelancerData || [];
      if (freelancerList.length === 0) {
        setFreelancers([]);
        return;
      }

      const freelancerIds = freelancerList.map((f) => f.user_id);
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id,full_name,avatar_url,location")
        .in("id", freelancerIds);

      if (profileError) throw profileError;

      const profileMap = new Map(
        (profileData || []).map((profile) => [profile.id, profile]),
      );

      const { data: reviewsData, error: reviewsError } = await supabase
        .from("project_reviews")
        .select(
          "freelancer_id,rating,feedback,created_at,client:profiles!project_reviews_client_id_fkey(full_name)",
        )
        .in("freelancer_id", freelancerIds)
        .eq("review_type", "client_to_freelancer")
        .order("created_at", { ascending: false });

      if (reviewsError) throw reviewsError;

      const reviewStats = new Map();
      (reviewsData || []).forEach((review) => {
        const entry = reviewStats.get(review.freelancer_id) || {
          sum: 0,
          count: 0,
          latest: null,
        };
        entry.sum += review.rating || 0;
        entry.count += 1;
        if (!entry.latest && review.feedback) {
          entry.latest = {
            feedback: review.feedback,
            clientName: review.client?.full_name || "Client",
            created_at: review.created_at,
          };
        }
        reviewStats.set(review.freelancer_id, entry);
      });

      const enriched = freelancerList.map((freelancer) => {
        const stats = reviewStats.get(freelancer.user_id) || {
          sum: 0,
          count: 0,
          latest: null,
        };
        const average = stats.count ? stats.sum / stats.count : 0;
        return {
          ...freelancer,
          profiles: profileMap.get(freelancer.user_id) || null,
          rating_avg: average,
          rating_count: stats.count,
          latest_review: stats.latest,
        };
      });

      setFreelancers(enriched);
    } catch (error) {
      console.error("Error fetching freelancers:", error);
      setError(error.message || "Failed to load freelancers.");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredFreelancers = useMemo(() => {
    if (!query.trim()) return freelancers;
    const lowered = query.toLowerCase();
    return freelancers.filter((freelancer) => {
      const name = freelancer.profiles?.full_name || "";
      const title = freelancer.title || "";
      const skills = (freelancer.skills || []).join(" ");
      return [name, title, skills].some((value) =>
        value.toLowerCase().includes(lowered),
      );
    });
  }, [freelancers, query]);

  const styles = createStyles(theme);

  if (loading || userRole !== "client") {
    return null;
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Browse Freelancers</Text>
            <Text style={styles.subtitle}>
              Find the right talent for your project
            </Text>
          </View>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchInput}>
            <Search size={18} color={theme.textMuted} />
            <TextInput
              style={styles.searchText}
              placeholder="Search by name, title, or skill"
              placeholderTextColor={theme.textMuted}
              value={query}
              onChangeText={setQuery}
            />
          </View>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={fetchFreelancers}
          >
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.loadingText}>Loading freelancers...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={fetchFreelancers}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : filteredFreelancers.length === 0 ? (
          <View style={styles.emptyState}>
            <Users size={52} color={theme.textMuted} />
            <Text style={styles.emptyTitle}>No freelancers found</Text>
            <Text style={styles.emptySubtitle}>
              Try a different search or check back later.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filteredFreelancers.map((freelancer) => {
              const ratingValue = freelancer.rating_avg
                ? freelancer.rating_avg.toFixed(1)
                : "0.0";
              return (
                <View key={freelancer.user_id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.avatar}>
                      {freelancer.profiles?.avatar_url ? (
                        <Image
                          source={{ uri: freelancer.profiles.avatar_url }}
                          style={styles.avatarImage}
                        />
                      ) : (
                        <User size={28} color={theme.textMuted} />
                      )}
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.name}>
                        {freelancer.profiles?.full_name || "Freelancer"}
                      </Text>
                      <Text style={styles.titleText}>
                        {freelancer.title || "Professional Freelancer"}
                      </Text>
                      {freelancer.profiles?.location && (
                        <View style={styles.metaRow}>
                          <MapPin size={14} color={theme.textMuted} />
                          <Text style={styles.metaText}>
                            {freelancer.profiles.location}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.rateBadge}>
                      <Wallet size={14} color={theme.primary} />
                      <Text style={styles.rateText}>
                        ${freelancer.hourly_rate || 0}/hr
                      </Text>
                    </View>
                  </View>

                  <View style={styles.ratingRow}>
                    <View style={styles.ratingStars}>
                      {[1, 2, 3, 4, 5].map((value) => (
                        <Star
                          key={value}
                          size={14}
                          color={
                            value <= Math.round(freelancer.rating_avg || 0)
                              ? theme.warning
                              : theme.border
                          }
                          fill={
                            value <= Math.round(freelancer.rating_avg || 0)
                              ? theme.warning
                              : "transparent"
                          }
                        />
                      ))}
                    </View>
                    <Text style={styles.ratingValue}>{ratingValue}</Text>
                    <Text style={styles.ratingCount}>
                      ({freelancer.rating_count})
                    </Text>
                  </View>

                  {freelancer.latest_review ? (
                    <View style={styles.reviewPreview}>
                      <Text style={styles.reviewText} numberOfLines={3}>
                        “{freelancer.latest_review.feedback}”
                      </Text>
                      <Text style={styles.reviewBy}>
                        — {freelancer.latest_review.clientName}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.reviewEmpty}>
                      No reviews yet.
                    </Text>
                  )}

                  {freelancer.skills?.length > 0 && (
                    <View style={styles.skillsRow}>
                      {freelancer.skills.slice(0, 4).map((skill) => (
                        <View key={skill} style={styles.skillPill}>
                          <Text style={styles.skillText}>{skill}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.viewButton}
                    onPress={() =>
                      router.push({
                        pathname: "/freelancer/[id]",
                        params: { id: freelancer.user_id },
                      })
                    }
                  >
                    <Text style={styles.viewButtonText}>View Profile</Text>
                  </TouchableOpacity>
                </View>
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
      gap: 16,
    },
    header: {
      gap: 6,
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: theme.text,
    },
    subtitle: {
      color: theme.textSecondary,
      fontSize: 14,
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    searchInput: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: theme.surface,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    searchText: {
      flex: 1,
      color: theme.text,
      fontSize: 14,
    },
    refreshButton: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceAlt,
    },
    refreshText: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: "600",
    },
    loading: {
      alignItems: "center",
      paddingVertical: 40,
      gap: 10,
    },
    loadingText: {
      color: theme.textSecondary,
      fontSize: 14,
    },
    errorCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.error,
      gap: 8,
    },
    errorText: {
      color: theme.error,
      fontSize: 14,
    },
    retryButton: {
      alignSelf: "flex-start",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceAlt,
    },
    retryText: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: "600",
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: 40,
      gap: 10,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: "center",
      maxWidth: 260,
    },
    list: {
      gap: 16,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 12,
    },
    cardHeader: {
      flexDirection: "row",
      gap: 12,
      alignItems: "flex-start",
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarImage: {
      width: 56,
      height: 56,
      borderRadius: 28,
    },
    cardInfo: {
      flex: 1,
      gap: 4,
    },
    name: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.text,
    },
    titleText: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    metaText: {
      fontSize: 12,
      color: theme.textMuted,
    },
    rateBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
    },
    rateText: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: "600",
    },
    ratingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    ratingStars: {
      flexDirection: "row",
      gap: 2,
    },
    ratingValue: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.text,
    },
    ratingCount: {
      fontSize: 12,
      color: theme.textMuted,
    },
    reviewPreview: {
      backgroundColor: theme.surfaceAlt,
      borderRadius: 12,
      padding: 10,
    },
    reviewText: {
      fontSize: 13,
      color: theme.text,
      lineHeight: 18,
    },
    reviewBy: {
      fontSize: 12,
      color: theme.textMuted,
      marginTop: 6,
    },
    reviewEmpty: {
      fontSize: 12,
      color: theme.textMuted,
    },
    skillsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    skillPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: theme.iconBg,
      borderWidth: 1,
      borderColor: theme.border,
    },
    skillText: {
      fontSize: 11,
      color: theme.textSecondary,
    },
    viewButton: {
      alignSelf: "flex-start",
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: theme.primary,
    },
    viewButtonText: {
      color: theme.surface,
      fontWeight: "600",
      fontSize: 13,
    },
  });
