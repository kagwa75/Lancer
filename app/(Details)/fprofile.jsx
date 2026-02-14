import { useTheme } from "@/hooks/ThemeContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import * as Sentry from "@sentry/react-native";
import { useRouter } from "expo-router";
import {
  Award,
  Briefcase,
  CheckCircle,
  DollarSign,
  Edit,
  ExternalLink,
  Link as LinkIcon,
  MapPin,
  Star,
  User,
  Wallet,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getFreelancerProfile, getUser } from "../../lib/supabase";
import { useStripeConnect } from "../../services/useStripeMutation";

export default function Profile() {
  const { theme } = useTheme();
  const { user, userRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [stripeAccountId, setStripeAccountId] = useState(null);
  const [error, setError] = useState(null);

  // Use React Query mutation hook
  const {
    connectAccount,
    disconnectAccount,
    isConnecting,
    isDisconnecting,
    connectError,
    disconnectError,
  } = useStripeConnect(user);

  // Define availability labels and colors using theme
  const getAvailabilityColors = () => ({
    available: theme.success,
    limited: theme.warning,
    busy: theme.error,
    unavailable: theme.textMuted,
    part_time: theme.primary,
    full_time: theme.primaryDark,
  });

  const getAvailabilityLabels = () => ({
    available: "Available Now",
    limited: "Limited Availability",
    busy: "Currently Busy",
    unavailable: "Not Available",
    part_time: "Part Time",
    full_time: "Full Time",
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/(auth)/login");
    } else if (!authLoading && userRole && userRole !== "freelancer") {
      router.push("/(tab)/home");
    }
  }, [user, userRole, authLoading, router]);

  useEffect(() => {
    if (user && !authLoading && userRole === "freelancer") {
      fetchProfile();
    }
  }, [user, authLoading, userRole]);

  useEffect(() => {
    // Show connection error if any
    if (connectError) {
      Alert.alert(
        "Connection Failed",
        connectError.userMessage ||
          "Failed to connect Stripe account. Please try again.",
      );
    }
  }, [connectError]);

  useEffect(() => {
    // Show disconnection error if any
    if (disconnectError) {
      Alert.alert(
        "Error",
        disconnectError.userMessage || "Failed to disconnect Stripe account",
      );
    }
  }, [disconnectError]);

  async function fetchProfile() {
    if (!user) {
      console.log("❌ No user found in fetchProfile");
      return;
    }

    console.log("🔄 Starting fetchProfile for user:", user.id);

    try {
      setLoading(true);
      setError(null);

      // Fetch freelancer profile with error handling
      console.log("📊 Fetching freelancer profile...");
      const { data: freelancerData, error: freelancerError } =
        await getFreelancerProfile(user.id);

      console.log("📊 Freelancer data:", freelancerData);
      console.log("📊 Freelancer error:", freelancerError);

      if (freelancerError) {
        console.error("❌ Error fetching freelancer profile:", freelancerError);
        setError(`Freelancer profile error: ${freelancerError.message}`);
        // Don't return, try to fetch user profile too
      } else if (freelancerData) {
        console.log("✅ Freelancer profile loaded");
        setProfile(freelancerData);
        setStripeAccountId(freelancerData.stripe_account_id);
        setStripeConnected(!!freelancerData.stripe_account_id);
      } else {
        console.log("⚠️ No freelancer data returned");
      }

      // Fetch user profile with error handling
      console.log("👤 Fetching user profile...");
      const { data: userData, error: userError } = await getUser(user.id);

      console.log("👤 User data:", userData);
      console.log("👤 User error:", userError);

      if (userError) {
        console.error("❌ Error fetching user profile:", userError);
        setError(`User profile error: ${userError.message}`);
      } else if (userData) {
        console.log("✅ User profile loaded");
        setUserProfile(userData);
      } else {
        console.log("⚠️ No user data returned");
      }

      console.log("✅ fetchProfile completed");
    } catch (error) {
      console.error("❌ Unexpected error fetching profile:", error);
      console.error("Error stack:", error.stack);
      setError(`Unexpected error: ${error.message}`);
    } finally {
      console.log("🏁 Setting loading to false");
      setLoading(false);
    }
  }

  const handleConnectStripe = async () => {
    try {
      console.log("🔐 Connecting Stripe for user:", user.id);

      const accountLink = await connectAccount();

      console.log("✅ Account link received:", accountLink);

      if (accountLink && accountLink.url) {
        await Linking.openURL(accountLink.url);

        toast({
          title: "Redirecting to Stripe",
          description: "Complete the onboarding to receive payments",
        });
      } else {
        throw new Error("No account link received");
      }
    } catch (error) {
      Sentry.captureException(error, {
        extra: {
          userId: user?.id,
          email: user?.email,
          function: "handleConnectStripe",
        },
      });
      console.error("❌ Stripe connect error:", error);
      // Error is already handled by the useEffect listening to connectError
    }
  };

  const handleDisconnectStripe = () => {
    const userId = user?.id;
    Alert.alert(
      "Disconnect Stripe",
      "Are you sure you want to disconnect your Stripe account? You won't be able to receive payments.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            try {
              await disconnectAccount({ userId, stripeAccountId });

              // Update local state
              setStripeConnected(false);
              setStripeAccountId(null);

              toast({
                title: "Disconnected",
                description: "Your Stripe account has been disconnected",
              });

              // Refresh profile data
              fetchProfile();
            } catch (error) {
              Sentry.captureException(error, {
                extra: {
                  userId: user?.id,
                  email: user?.email,
                  function: "handleDisconnectStripe",
                },
              });
              console.error("❌ Disconnect error:", error);
              // Error is already handled by the useEffect listening to disconnectError
            }
          },
        },
      ],
    );
  };

  const styles = createStyles(theme);
  const availabilityColors = getAvailabilityColors();
  const availabilityLabels = getAvailabilityLabels();

  if (authLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>
          {authLoading ? "Authenticating..." : "Loading profile..."}
        </Text>
        {error && (
          <Text
            style={[styles.loadingText, { color: theme.error, marginTop: 10 }]}
          >
            Error: {error}
          </Text>
        )}
      </View>
    );
  }

  // Add error state display
  if (error && !profile && !userProfile) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={[styles.loadingText, { color: theme.error }]}>
          Failed to load profile
        </Text>
        <Text style={styles.loadingText}>{error}</Text>
        <TouchableOpacity
          style={styles.emptyStateButton}
          onPress={fetchProfile}
        >
          <Text style={styles.emptyStateButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Add debug info at the top of the render
  console.log("🎨 Rendering Profile with:", {
    profile: profile ? "exists" : "null",
    userProfile: userProfile ? "exists" : "null",
    loading,
    authLoading,
    error,
    stripeConnected,
    stripeAccountId,
  });

  const availabilityColor =
    availabilityColors[profile?.availability] || theme.textMuted;
  const availabilityLabel =
    availabilityLabels[profile?.availability] || "Unknown";

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={styles.container}>
      <View style={styles.content}>
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <User size={48} color={theme.primary} />
            </View>
            {stripeConnected && (
              <View style={styles.verifiedBadge}>
                <CheckCircle size={20} color={theme.success} />
              </View>
            )}
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.name}>
              {userProfile?.full_name || "Add your name"}
            </Text>
            <Text style={styles.title}>
              {profile?.title || "Add your title"}
            </Text>
            {userProfile?.location && (
              <View style={styles.locationRow}>
                <MapPin size={14} color={theme.textSecondary} />
                <Text style={styles.location}>{userProfile.location}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() =>
              router.push({
                pathname: "/(EditProfile)/[id]",
                params: { id: user.id },
              })
            }
            activeOpacity={0.8}
          >
            <Edit size={18} color={theme.primary} />
          </TouchableOpacity>
        </View>

        {/* Availability Badge */}
        {profile?.availability && (
          <View
            style={[
              styles.availabilityBadge,
              { backgroundColor: `${availabilityColor}20` },
            ]}
          >
            <View
              style={[
                styles.availabilityDot,
                { backgroundColor: availabilityColor },
              ]}
            />
            <Text
              style={[styles.availabilityText, { color: availabilityColor }]}
            >
              {availabilityLabel}
            </Text>
          </View>
        )}

        {/* Bio */}
        {userProfile?.bio && (
          <View style={styles.card}>
            <Text style={styles.bio}>{userProfile.bio}</Text>
          </View>
        )}

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <DollarSign size={20} color={theme.success} />
            </View>
            <Text style={styles.statValue}>
              ${profile?.hourly_rate || "0"}/hr
            </Text>
            <Text style={styles.statLabel}>Hourly Rate</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Briefcase size={20} color={theme.primary} />
            </View>
            <Text style={styles.statValue}>
              {profile?.years_experience || "0"}
            </Text>
            <Text style={styles.statLabel}>Years Exp.</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Award size={20} color={theme.warning} />
            </View>
            <Text style={styles.statValue}>
              {profile?.skills?.length || "0"}
            </Text>
            <Text style={styles.statLabel}>Skills</Text>
          </View>
        </View>

        {/* Stripe Connection Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.cardIcon}>
                <Wallet size={20} color={theme.primary} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Payment Account</Text>
                <Text style={styles.cardDescription}>
                  {stripeConnected
                    ? "Connected and ready to receive payments"
                    : "Connect Stripe to receive payments"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.cardContent}>
            {stripeConnected ? (
              <View style={styles.stripeConnectedContainer}>
                <View style={styles.stripeConnectedInfo}>
                  <View style={styles.stripeConnectedBadge}>
                    <CheckCircle size={16} color={theme.success} />
                    <Text style={styles.stripeConnectedText}>
                      Stripe Connected
                    </Text>
                  </View>
                  <Text style={styles.stripeAccountId}>
                    Account: {stripeAccountId?.slice(-8)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.disconnectButton,
                    isDisconnecting && styles.buttonDisabled,
                  ]}
                  onPress={handleDisconnectStripe}
                  activeOpacity={0.8}
                  disabled={isDisconnecting}
                >
                  {isDisconnecting ? (
                    <ActivityIndicator
                      size="small"
                      color={theme.textSecondary}
                    />
                  ) : (
                    <Text style={styles.disconnectButtonText}>Disconnect</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.connectButton,
                  isConnecting && styles.buttonDisabled,
                ]}
                onPress={handleConnectStripe}
                activeOpacity={0.8}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <ActivityIndicator size="small" color={theme.surface} />
                ) : (
                  <>
                    <Wallet size={20} color={theme.surface} />
                    <Text style={styles.connectButtonText}>
                      Connect Stripe Account
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            <View style={styles.stripeInfo}>
              <Text style={styles.stripeInfoText}>
                💡 Stripe is required to receive payments from clients. Your
                earnings will be transferred directly to your bank account.
              </Text>
            </View>
          </View>
        </View>

        {/* Skills Section */}
        {profile?.skills && profile.skills.length > 0 && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Star size={18} color={theme.primary} />
              <Text style={styles.sectionTitle}>Skills</Text>
            </View>
            <View style={styles.skillsContainer}>
              {profile.skills.map((skill, index) => (
                <View key={index} style={styles.skillBadge}>
                  <Text style={styles.skillText}>{skill}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Portfolio Section */}
        {profile?.portfolio_urls && profile.portfolio_urls.length > 0 && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <LinkIcon size={18} color={theme.primary} />
              <Text style={styles.sectionTitle}>Portfolio</Text>
            </View>
            <View style={styles.portfolioList}>
              {profile.portfolio_urls.map((url, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.portfolioItem}
                  onPress={() => Linking.openURL(url)}
                  activeOpacity={0.7}
                >
                  <LinkIcon size={16} color={theme.primary} />
                  <Text style={styles.portfolioUrl} numberOfLines={1}>
                    {url}
                  </Text>
                  <ExternalLink size={14} color={theme.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Empty State */}
        {(!profile?.skills || profile.skills.length === 0) &&
          (!profile?.portfolio_urls || profile.portfolio_urls.length === 0) && (
            <View style={styles.emptyState}>
              <User size={48} color={theme.border} />
              <Text style={styles.emptyStateTitle}>Complete Your Profile</Text>
              <Text style={styles.emptyStateDescription}>
                Add your skills, portfolio links, and connect your Stripe
                account to start winning projects
              </Text>
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={() =>
                  router.push({
                    pathname: "/(EditProfile)/[id]",
                    params: { id: user.id },
                  })
                }
                activeOpacity={0.8}
              >
                <Edit size={18} color={theme.surface} />
                <Text style={styles.emptyStateButtonText}>Edit Profile</Text>
              </TouchableOpacity>
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
      paddingTop: 45,
    },
    content: {
      padding: 16,
      maxWidth: 768,
      alignSelf: "center",
      width: "100%",
      paddingBottom: 80,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.background,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: theme.textSecondary,
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 16,
      backgroundColor: theme.surface,
      padding: 20,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    avatarContainer: {
      position: "relative",
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.iconBg,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 3,
      borderColor: theme.surface,
    },
    verifiedBadge: {
      position: "absolute",
      bottom: 0,
      right: 0,
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 2,
    },
    headerInfo: {
      flex: 1,
      marginLeft: 16,
      marginRight: 8,
    },
    name: {
      fontSize: 22,
      fontWeight: "bold",
      color: theme.text,
      marginBottom: 4,
    },
    title: {
      fontSize: 16,
      color: theme.textSecondary,
      marginBottom: 6,
    },
    locationRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    location: {
      fontSize: 14,
      color: theme.textMuted,
    },
    editButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.iconBg,
      justifyContent: "center",
      alignItems: "center",
    },
    availabilityBadge: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      marginBottom: 16,
      gap: 6,
    },
    availabilityDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    availabilityText: {
      fontSize: 14,
      fontWeight: "600",
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    bio: {
      fontSize: 15,
      color: theme.text,
      lineHeight: 22,
    },
    statsGrid: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 16,
    },
    statCard: {
      flex: 1,
      backgroundColor: theme.surface,
      padding: 16,
      borderRadius: 12,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },
    statIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.surfaceAlt,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 8,
    },
    statValue: {
      fontSize: 20,
      fontWeight: "bold",
      color: theme.text,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    cardHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    cardIcon: {
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: theme.iconBg,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.text,
    },
    cardDescription: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    cardContent: {
      gap: 12,
    },
    stripeConnectedContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: theme.successBg,
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.successLight || theme.success,
    },
    stripeConnectedInfo: {
      flex: 1,
    },
    stripeConnectedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 4,
    },
    stripeConnectedText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.successText,
    },
    stripeAccountId: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    disconnectButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    disconnectButtonText: {
      fontSize: 13,
      color: theme.textSecondary,
      fontWeight: "500",
    },
    connectButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primary,
      paddingVertical: 14,
      borderRadius: 8,
      gap: 8,
    },
    connectButtonText: {
      color: theme.surface,
      fontSize: 15,
      fontWeight: "600",
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    stripeInfo: {
      backgroundColor: theme.infoBg,
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.info,
    },
    stripeInfoText: {
      fontSize: 13,
      color: theme.infoText,
      lineHeight: 18,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.text,
    },
    skillsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    skillBadge: {
      backgroundColor: theme.iconBg,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.primaryLight,
    },
    skillText: {
      fontSize: 13,
      color: theme.primary,
      fontWeight: "500",
    },
    portfolioList: {
      gap: 8,
    },
    portfolioItem: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surfaceAlt,
      padding: 12,
      borderRadius: 8,
      gap: 8,
    },
    portfolioUrl: {
      flex: 1,
      fontSize: 14,
      color: theme.primary,
    },
    emptyState: {
      backgroundColor: theme.surface,
      padding: 32,
      borderRadius: 12,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
      marginTop: 16,
    },
    emptyStateTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.text,
      marginTop: 16,
      marginBottom: 8,
    },
    emptyStateDescription: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: "center",
      marginBottom: 20,
      lineHeight: 20,
    },
    emptyStateButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
      gap: 8,
    },
    emptyStateButtonText: {
      color: theme.surface,
      fontSize: 15,
      fontWeight: "600",
    },
  });
