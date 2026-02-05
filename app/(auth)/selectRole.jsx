import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "expo-router";
import { ArrowRight, Briefcase, Check, UserCheck } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width } = Dimensions.get("window");

export default function SelectRole() {
  const [selectedRole, setSelectedRole] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { user, userRole, setUserRole, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      }
      if (userRole == "client") {
        console.log("Auth user:", user);
        router.replace("/(tab)/home");
      } else if (userRole == "freelancer") {
        console.log("Auth user:", user);
        router.replace("/(ftab)/home");
      }
    }
  }, [user, userRole, loading, router]);

  const handleContinue = async () => {
    if (!selectedRole) return;

    setIsLoading(true);
    const { error } = await setUserRole(selectedRole);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to set role. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
    if (userRole == "client") {
      console.log("Auth user:", user);
      router.replace("/(tab)/home");
    } else if (userRole == "freelancer") {
      console.log("Auth user:", user);
      router.replace("/(ftab)/home");
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.innerContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconBadge}>
              <Briefcase size={32} color="#2563EB" />
            </View>
            <Text style={styles.title}>
              How do you want to use FreelanceHub?
            </Text>
            <Text style={styles.subtitle}>
              Choose your role to get started. You can change this later in
              settings.
            </Text>
          </View>

          {/* Role Cards */}
          <View style={styles.cardsContainer}>
            {/* Client Card */}
            <TouchableOpacity
              onPress={() => setSelectedRole("client")}
              style={[
                styles.roleCard,
                selectedRole === "client" && styles.roleCardSelected,
                {
                  backgroundColor:
                    selectedRole === "client" ? "#EFF6FF" : "#FFFFFF",
                },
              ]}
              activeOpacity={0.7}
            >
              {selectedRole === "client" && (
                <View style={styles.checkBadge}>
                  <Check size={16} color="#FFFFFF" />
                </View>
              )}

              <View style={styles.cardHeader}>
                <View style={[styles.roleIcon, { backgroundColor: "#DBEAFE" }]}>
                  <Briefcase size={28} color="#2563EB" />
                </View>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.roleTitle}>I'm a Client</Text>
                  <Text style={styles.roleDescription}>
                    Hire talented freelancers for your projects
                  </Text>
                </View>
              </View>

              <View style={styles.featuresList}>
                <View style={styles.featureItem}>
                  <View style={styles.featureDot} />
                  <Text style={styles.featureText}>
                    Post projects and receive proposals
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <View style={styles.featureDot} />
                  <Text style={styles.featureText}>
                    Browse and hire top freelancers
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <View style={styles.featureDot} />
                  <Text style={styles.featureText}>
                    Manage projects and payments
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <View style={styles.featureDot} />
                  <Text style={styles.featureText}>Review completed work</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Freelancer Card */}
            <TouchableOpacity
              onPress={() => setSelectedRole("freelancer")}
              style={[
                styles.roleCard,
                selectedRole === "freelancer" && styles.roleCardSelected,
                {
                  backgroundColor:
                    selectedRole === "freelancer" ? "#F0FDF4" : "#FFFFFF",
                },
              ]}
              activeOpacity={0.7}
            >
              {selectedRole === "freelancer" && (
                <View
                  style={[styles.checkBadge, { backgroundColor: "#16A34A" }]}
                >
                  <Check size={16} color="#FFFFFF" />
                </View>
              )}

              <View style={styles.cardHeader}>
                <View style={[styles.roleIcon, { backgroundColor: "#DCFCE7" }]}>
                  <UserCheck size={28} color="#16A34A" />
                </View>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.roleTitle}>I'm a Freelancer</Text>
                  <Text style={styles.roleDescription}>
                    Find work and grow your freelance career
                  </Text>
                </View>
              </View>

              <View style={styles.featuresList}>
                <View style={styles.featureItem}>
                  <View style={styles.featureDot} />
                  <Text style={styles.featureText}>
                    Browse and apply to projects
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <View style={styles.featureDot} />
                  <Text style={styles.featureText}>
                    Showcase your portfolio
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <View style={styles.featureDot} />
                  <Text style={styles.featureText}>Set your own rates</Text>
                </View>
                <View style={styles.featureItem}>
                  <View style={styles.featureDot} />
                  <Text style={styles.featureText}>Get paid securely</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Continue Button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={handleContinue}
              disabled={!selectedRole || isLoading}
              style={[
                styles.continueButton,
                (!selectedRole || isLoading) && styles.continueButtonDisabled,
              ]}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonText}>Continue</Text>
                  <ArrowRight size={20} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>

            {selectedRole && (
              <Text style={styles.helpText}>
                {selectedRole === "client"
                  ? "You'll be able to post projects and hire freelancers"
                  : "You'll be able to browse projects and submit proposals"}
              </Text>
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    color: "#6B7280",
    fontSize: 16,
    fontWeight: "500",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    minHeight: Dimensions.get("window").height,
  },
  innerContent: {
    width: "100%",
    maxWidth: 800,
  },

  // Header
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  iconBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 12,
    textAlign: "center",
    lineHeight: 40,
  },
  subtitle: {
    color: "#6B7280",
    textAlign: "center",
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: 16,
  },

  // Cards Container
  cardsContainer: {
    gap: 16,
    marginBottom: 32,
  },

  // Role Card
  roleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    position: "relative",
  },
  roleCardSelected: {
    borderColor: "#2563EB",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  checkBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },

  // Card Header
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  roleIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  cardHeaderText: {
    flex: 1,
    paddingTop: 4,
  },
  roleTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  roleDescription: {
    color: "#6B7280",
    fontSize: 15,
    lineHeight: 22,
  },

  // Features List
  featuresList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2563EB",
  },
  featureText: {
    fontSize: 15,
    color: "#4B5563",
    flex: 1,
    lineHeight: 22,
  },

  // Button Container
  buttonContainer: {
    alignItems: "center",
    gap: 16,
  },
  continueButton: {
    backgroundColor: "#2563EB",
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 16,
    minWidth: 200,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  continueButtonDisabled: {
    backgroundColor: "#D1D5DB",
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 18,
  },
  helpText: {
    color: "#6B7280",
    fontSize: 14,
    textAlign: "center",
    fontStyle: "italic",
    paddingHorizontal: 32,
  },
});
