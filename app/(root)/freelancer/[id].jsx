import { useTheme } from "@/hooks/ThemeContext";
import { useAuth } from "@/hooks/useAuth";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Briefcase,
  MapPin,
  Star,
  User,
  Wallet,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../../lib/Client";

export default function FreelancerDetails() {
  const { id } = useLocalSearchParams();
  const { theme } = useTheme();
  const { user, userRole, loading } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
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
    if (id) {
      fetchDetails();
    }
  }, [id]);

  const fetchDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: freelancerProfile, error: freelancerError } =
        await supabase
          .from("freelancer_profiles")
          .select("*")
          .eq("user_id", id)
          .maybeSingle();

      if (freelancerError) throw freelancerError;

      const { data: userData, error: userError } = await supabase
        .from("profiles")
        .select("full_name,avatar_url,location,bio")
        .eq("id", id)
        .maybeSingle();

      if (userError) throw userError;

      const { data: reviewData, error: reviewsError } = await supabase
        .from("project_reviews")
        .select(
          "id,rating,feedback,created_at, client:profiles!project_reviews_client_id_fkey(full_name,avatar_url), project:projects!project_reviews_project_id_fkey(title)",
        )
        .eq("freelancer_id", id)
        .eq("review_type", "client_to_freelancer")
        .order("created_at", { ascending: false });

      if (reviewsError) throw reviewsError;

      setProfile(freelancerProfile);
      setUserProfile(userData);
      setReviews(reviewData || []);
    } catch (error) {
      console.error("Error loading freelancer details:", error);
      setError(error.message || "Failed to load freelancer details.");
    } finally {
      setIsLoading(false);
    }
  };

  const averageRating = useMemo(() => {
    if (!reviews.length) return "0.0";
    const total = reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
    return (total / reviews.length).toFixed(1);
  }, [reviews]);

  const styles = createStyles(theme);

  if (loading || userRole !== "client") {
    return null;
  }

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading freelancer...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchDetails}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={18} color={theme.textSecondary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={styles.avatar}>
              {userProfile?.avatar_url ? (
                <Image
                  source={{ uri: userProfile.avatar_url }}
                  style={styles.avatarImage}
                />
              ) : (
                <User size={36} color={theme.textMuted} />
              )}
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.name}>
                {userProfile?.full_name || "Freelancer"}
              </Text>
              <Text style={styles.title}>
                {profile?.title || "Professional Freelancer"}
              </Text>
              {userProfile?.location && (
                <View style={styles.locationRow}>
                  <MapPin size={14} color={theme.textMuted} />
                  <Text style={styles.locationText}>
                    {userProfile.location}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.rateBadge}>
              <Wallet size={14} color={theme.primary} />
              <Text style={styles.rateText}>
                ${profile?.hourly_rate || 0}/hr
              </Text>
            </View>
          </View>

          <View style={styles.ratingRow}>
            <View style={styles.ratingStars}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Star
                  key={value}
                  size={16}
                  color={value <= Math.round(Number(averageRating)) ? theme.warning : theme.border}
                  fill={value <= Math.round(Number(averageRating)) ? theme.warning : "transparent"}
                />
              ))}
            </View>
            <Text style={styles.ratingValue}>{averageRating}</Text>
            <Text style={styles.ratingCount}>({reviews.length})</Text>
          </View>
        </View>

        {userProfile?.bio && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bio}>{userProfile.bio}</Text>
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Briefcase size={18} color={theme.primary} />
            <Text style={styles.statValue}>
              {profile?.years_experience || 0} yrs
            </Text>
            <Text style={styles.statLabel}>Experience</Text>
          </View>
          <View style={styles.statCard}>
            <Star size={18} color={theme.warning} />
            <Text style={styles.statValue}>{averageRating}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>

        {profile?.skills?.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Skills</Text>
            <View style={styles.skillsRow}>
              {profile.skills.map((skill) => (
                <View key={skill} style={styles.skillPill}>
                  <Text style={styles.skillText}>{skill}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Client Reviews</Text>
          {reviews.length === 0 ? (
            <Text style={styles.reviewEmpty}>
              No reviews yet. Be the first to work with this freelancer!
            </Text>
          ) : (
            <View style={styles.reviewList}>
              {reviews.map((review) => (
                <View key={review.id} style={styles.reviewItem}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewName}>
                      {review.client?.full_name || "Client"}
                    </Text>
                    <View style={styles.reviewStars}>
                      {[1, 2, 3, 4, 5].map((value) => (
                        <Star
                          key={value}
                          size={12}
                          color={
                            value <= review.rating ? theme.warning : theme.border
                          }
                          fill={
                            value <= review.rating ? theme.warning : "transparent"
                          }
                        />
                      ))}
                    </View>
                  </View>
                  {review.project?.title && (
                    <Text style={styles.reviewProject}>
                      Project: {review.project.title}
                    </Text>
                  )}
                  {review.feedback ? (
                    <Text style={styles.reviewFeedback}>
                      {review.feedback}
                    </Text>
                  ) : (
                    <Text style={styles.reviewFeedbackMuted}>
                      No written feedback.
                    </Text>
                  )}
                  <Text style={styles.reviewDate}>
                    {new Date(review.created_at).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
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
    loading: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      backgroundColor: theme.background,
    },
    loadingText: {
      color: theme.textSecondary,
    },
    errorText: {
      color: theme.error,
      fontSize: 14,
    },
    retryButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    retryText: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: "600",
    },
    backButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    backText: {
      color: theme.textSecondary,
      fontSize: 14,
    },
    headerCard: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 12,
    },
    headerTop: {
      flexDirection: "row",
      gap: 12,
      alignItems: "center",
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarImage: {
      width: 64,
      height: 64,
      borderRadius: 32,
    },
    headerInfo: {
      flex: 1,
      gap: 4,
    },
    name: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
    },
    title: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    locationRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    locationText: {
      fontSize: 12,
      color: theme.textMuted,
    },
    rateBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: theme.surfaceAlt,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    rateText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.textSecondary,
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
    card: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 10,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.text,
    },
    bio: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 20,
    },
    statsRow: {
      flexDirection: "row",
      gap: 12,
    },
    statCard: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
      gap: 6,
    },
    statValue: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.text,
    },
    statLabel: {
      fontSize: 12,
      color: theme.textSecondary,
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
      fontSize: 12,
      color: theme.textSecondary,
    },
    reviewEmpty: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    reviewList: {
      gap: 12,
    },
    reviewItem: {
      backgroundColor: theme.surfaceAlt,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 6,
    },
    reviewHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    reviewName: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.text,
    },
    reviewStars: {
      flexDirection: "row",
      gap: 2,
    },
    reviewProject: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    reviewFeedback: {
      fontSize: 13,
      color: theme.text,
      lineHeight: 18,
    },
    reviewFeedbackMuted: {
      fontSize: 12,
      color: theme.textMuted,
    },
    reviewDate: {
      fontSize: 11,
      color: theme.textMuted,
    },
  });
