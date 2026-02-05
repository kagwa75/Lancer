import { useTheme } from "@/hooks/ThemeContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "expo-router";
import {
  Briefcase,
  Clock,
  DollarSign,
  Link as LinkIcon,
  Plus,
  Save,
  User,
  X,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/Client";

const SKILL_SUGGESTIONS = [
  "React",
  "TypeScript",
  "JavaScript",
  "Node.js",
  "Python",
  "Java",
  "UI/UX Design",
  "Figma",
  "Adobe XD",
  "Graphic Design",
  "WordPress",
  "PHP",
  "Laravel",
  "Vue.js",
  "Angular",
  "Next.js",
  "Tailwind CSS",
  "PostgreSQL",
  "MongoDB",
  "AWS",
  "Docker",
  "DevOps",
  "Mobile Development",
  "React Native",
  "Flutter",
  "iOS",
  "Android",
  "SEO",
  "Content Writing",
  "Video Editing",
  "Motion Graphics",
  "Data Analysis",
  "Machine Learning",
];

const AVAILABILITY_OPTIONS = [
  { value: "available", label: "Available Now" },
  { value: "limited", label: "Limited Availability" },
  { value: "busy", label: "Currently Busy" },
  { value: "unavailable", label: "Not Available" },
  { value: "part_time", label: "part time" },
  { value: "full_time", label: "full time" },
];

const ProfileEdit = () => {
  const { theme, isDark } = useTheme();
  const { user, userRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newSkill, setNewSkill] = useState("");
  const [newPortfolioUrl, setNewPortfolioUrl] = useState("");
  const [showSkillSuggestions, setShowSkillSuggestions] = useState(false);

  const [profile, setProfile] = useState({
    phone_number: null,
    title: "",
    hourly_rate: null,
    years_experience: null,
    availability: "available",
    skills: [],
    portfolio_urls: [],
  });

  const [userProfile, setUserProfile] = useState({
    full_name: "",
    bio: "",
    location: "",
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/(auth)/login");
    } else if (!authLoading && userRole && userRole !== "freelancer") {
      router.push("/(tab)/home");
    }
  }, [user, userRole, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      // Fetch freelancer profile
      const { data: freelancerData } = await supabase
        .from("freelancer_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (freelancerData) {
        setProfile({
          phone_number: freelancerData.phone_number,
          title: freelancerData.title || "",
          hourly_rate: freelancerData.hourly_rate,
          years_experience: freelancerData.years_experience,
          availability: freelancerData.availability || "available",
          skills: freelancerData.skills || [],
          portfolio_urls: freelancerData.portfolio_urls || [],
        });
      }

      // Fetch user profile
      const { data: userData } = await supabase
        .from("profiles")
        .select("full_name, bio, location")
        .eq("id", user.id)
        .single();

      if (userData) {
        setUserProfile({
          full_name: userData.full_name || "",
          bio: userData.bio || "",
          location: userData.location || "",
        });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      // Update freelancer profile
      const { error: freelancerError } = await supabase
        .from("freelancer_profiles")
        .upsert(
          {
            user_id: user.id,
            title: profile.title || null,
            hourly_rate: profile.hourly_rate,
            years_experience: profile.years_experience,
            availability: profile.availability,
            skills: profile.skills,
            phone_number: profile.phone_number,
            portfolio_urls: profile.portfolio_urls,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id", // Specify the unique constraint column
            ignoreDuplicates: false, // This ensures it updates on conflict
          },
        );

      if (freelancerError) throw freelancerError;

      // Update user profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: userProfile.full_name || null,
          bio: userProfile.bio || null,
          location: userProfile.location || null,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      Alert.alert(
        "Profile saved",
        "Your profile has been updated successfully.",
        [
          {
            text: "Ok",
            style: "cancel",
          },
        ],
      );
    } catch (error) {
      console.error("Error saving profile:", error);
      Alert.alert(
        "Error saving profile",
        "Failed to save profile. Please try again.",
        [
          {
            text: "Ok",
            style: "cancel",
          },
        ],
      );
    } finally {
      setSaving(false);
    }
  };

  const addSkill = (skill) => {
    const trimmedSkill = skill.trim();
    if (trimmedSkill && !profile.skills.includes(trimmedSkill)) {
      setProfile({ ...profile, skills: [...profile.skills, trimmedSkill] });
    }
    setNewSkill("");
    setShowSkillSuggestions(false);
  };

  const removeSkill = (skillToRemove) => {
    setProfile({
      ...profile,
      skills: profile.skills.filter((s) => s !== skillToRemove),
    });
  };

  const addPortfolioUrl = () => {
    const trimmedUrl = newPortfolioUrl.trim();
    if (trimmedUrl && !profile.portfolio_urls.includes(trimmedUrl)) {
      setProfile({
        ...profile,
        portfolio_urls: [...profile.portfolio_urls, trimmedUrl],
      });
    }
    setNewPortfolioUrl("");
  };

  const removePortfolioUrl = (urlToRemove) => {
    setProfile({
      ...profile,
      portfolio_urls: profile.portfolio_urls.filter((u) => u !== urlToRemove),
    });
  };

  const filteredSuggestions = SKILL_SUGGESTIONS.filter(
    (skill) =>
      skill.toLowerCase().includes(newSkill.toLowerCase()) &&
      !profile.skills.includes(skill),
  ).slice(0, 8);

  const styles = createStyles(theme);

  if (authLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Edit Profile</Text>
              <Text style={styles.subtitle}>
                Build a profile that wins projects
              </Text>
            </View>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color={theme.surface} />
              ) : (
                <>
                  <Save size={18} color={theme.surface} />
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Basic Info */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIcon}>
                <User size={20} color={theme.primary} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Basic Information</Text>
                <Text style={styles.cardDescription}>
                  Your personal details visible to clients
                </Text>
              </View>
            </View>
            <View style={styles.cardContent}>
              <View style={styles.formGrid}>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Full Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="John Doe"
                    placeholderTextColor={theme.textMuted}
                    value={userProfile.full_name}
                    onChangeText={(text) =>
                      setUserProfile({ ...userProfile, full_name: text })
                    }
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>phone number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="You'll receive payments here"
                    placeholderTextColor={theme.textMuted}
                    value={profile.phone_number}
                    onChangeText={(text) =>
                      setProfile({ ...profile, phone_number: text })
                    }
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Location</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="New York, USA"
                    placeholderTextColor={theme.textMuted}
                    value={userProfile.location}
                    onChangeText={(text) =>
                      setUserProfile({ ...userProfile, location: text })
                    }
                  />
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Professional Title</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Full Stack Developer"
                  placeholderTextColor={theme.textMuted}
                  value={profile.title}
                  onChangeText={(text) =>
                    setProfile({ ...profile, title: text })
                  }
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Bio</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Tell clients about your experience, expertise, and what makes you unique..."
                  placeholderTextColor={theme.textMuted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  value={userProfile.bio}
                  onChangeText={(text) =>
                    setUserProfile({ ...userProfile, bio: text })
                  }
                />
              </View>
            </View>
          </View>

          {/* Professional Details */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIcon}>
                <Briefcase size={20} color={theme.primary} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Professional Details</Text>
                <Text style={styles.cardDescription}>
                  Your rates and availability
                </Text>
              </View>
            </View>
            <View style={styles.cardContent}>
              <View style={styles.formGrid}>
                <View style={styles.formGroup}>
                  <View style={styles.labelRow}>
                    <DollarSign size={16} color={theme.textSecondary} />
                    <Text style={styles.label}>Hourly Rate</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="50"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="numeric"
                    value={profile.hourly_rate?.toString() || ""}
                    onChangeText={(text) =>
                      setProfile({
                        ...profile,
                        hourly_rate: text ? parseInt(text) : null,
                      })
                    }
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Years Experience</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="5"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="numeric"
                    value={profile.years_experience?.toString() || ""}
                    onChangeText={(text) =>
                      setProfile({
                        ...profile,
                        years_experience: text ? parseInt(text) : null,
                      })
                    }
                  />
                </View>
                <View style={styles.formGroup}>
                  <View style={styles.labelRow}>
                    <Clock size={16} color={theme.textSecondary} />
                    <Text style={styles.label}>Availability</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.availabilityContainer}>
                      {AVAILABILITY_OPTIONS.map((option) => (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            styles.availabilityOption,
                            profile.availability === option.value &&
                              styles.availabilityOptionSelected,
                          ]}
                          onPress={() =>
                            setProfile({
                              ...profile,
                              availability: option.value,
                            })
                          }
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.availabilityOptionText,
                              profile.availability === option.value &&
                                styles.availabilityOptionTextSelected,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </View>
            </View>
          </View>

          {/* Skills */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>Skills</Text>
                <Text style={styles.cardDescription}>
                  Add skills that highlight your expertise
                </Text>
              </View>
            </View>
            <View style={styles.cardContent}>
              <View style={styles.skillsContainer}>
                {profile.skills.map((skill) => (
                  <View key={skill} style={styles.skillBadge}>
                    <Text style={styles.skillText}>{skill}</Text>
                    <TouchableOpacity
                      onPress={() => removeSkill(skill)}
                      style={styles.removeSkillButton}
                      activeOpacity={0.7}
                    >
                      <X size={14} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              <View style={styles.addSkillContainer}>
                <TextInput
                  style={[styles.input, styles.flex1]}
                  placeholder="Add a skill..."
                  placeholderTextColor={theme.textMuted}
                  value={newSkill}
                  onChangeText={(text) => {
                    setNewSkill(text);
                    setShowSkillSuggestions(text.length > 0);
                  }}
                  onSubmitEditing={() => addSkill(newSkill)}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => addSkill(newSkill)}
                  disabled={!newSkill.trim()}
                  activeOpacity={0.8}
                >
                  <Plus
                    size={20}
                    color={newSkill.trim() ? theme.surface : theme.textMuted}
                  />
                </TouchableOpacity>
              </View>
              {showSkillSuggestions && filteredSuggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.suggestionsList}>
                      {filteredSuggestions.map((suggestion) => (
                        <TouchableOpacity
                          key={suggestion}
                          style={styles.suggestionItem}
                          onPress={() => addSkill(suggestion)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.suggestionText}>
                            + {suggestion}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}
              <Text style={styles.helperText}>
                Press Enter or click + to add custom skills
              </Text>
            </View>
          </View>

          {/* Portfolio */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIcon}>
                <LinkIcon size={20} color={theme.primary} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Portfolio Links</Text>
                <Text style={styles.cardDescription}>
                  Showcase your work with external links
                </Text>
              </View>
            </View>
            <View style={styles.cardContent}>
              <View style={styles.portfolioList}>
                {profile.portfolio_urls.map((url) => (
                  <View key={url} style={styles.portfolioItem}>
                    <LinkIcon size={16} color={theme.textSecondary} />
                    <TouchableOpacity
                      style={styles.portfolioLink}
                      onPress={() => Linking.openURL(url)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.portfolioLinkText} numberOfLines={1}>
                        {url}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => removePortfolioUrl(url)}
                      style={styles.removePortfolioButton}
                      activeOpacity={0.7}
                    >
                      <X size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              <View style={styles.addPortfolioContainer}>
                <TextInput
                  style={[styles.input, styles.flex1]}
                  placeholder="https://github.com/yourprofile"
                  placeholderTextColor={theme.textMuted}
                  value={newPortfolioUrl}
                  onChangeText={setNewPortfolioUrl}
                  onSubmitEditing={addPortfolioUrl}
                  returnKeyType="done"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={addPortfolioUrl}
                  disabled={!newPortfolioUrl.trim()}
                  activeOpacity={0.8}
                >
                  <Plus
                    size={20}
                    color={
                      newPortfolioUrl.trim() ? theme.surface : theme.textMuted
                    }
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Save Button (Mobile) */}
          <View style={styles.mobileSaveButton}>
            <TouchableOpacity
              style={[styles.saveButton, styles.fullWidth]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color={theme.surface} />
              ) : (
                <>
                  <Save size={18} color={theme.surface} />
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
export default ProfileEdit;

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollView: {
      flex: 1,
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
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 24,
    },
    title: {
      fontSize: 28,
      fontWeight: "bold",
      color: theme.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    saveButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.primary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      gap: 8,
    },
    saveButtonText: {
      color: theme.surface,
      fontWeight: "600",
      fontSize: 14,
    },
    fullWidth: {
      width: "100%",
      justifyContent: "center",
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    cardHeaderIcon: {
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: theme.iconBg,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.text,
    },
    cardDescription: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 2,
    },
    cardContent: {
      padding: 16,
    },
    formGrid: {
      gap: 16,
    },
    formGroup: {
      gap: 8,
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.text,
    },
    labelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    input: {
      backgroundColor: theme.inputBg,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: theme.text,
    },
    textArea: {
      minHeight: 100,
      textAlignVertical: "top",
    },
    flex1: {
      flex: 1,
    },
    availabilityContainer: {
      flexDirection: "row",
      gap: 8,
      paddingVertical: 4,
    },
    availabilityOption: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceAlt,
    },
    availabilityOptionSelected: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    availabilityOptionText: {
      fontSize: 14,
      color: theme.text,
      fontWeight: "500",
    },
    availabilityOptionTextSelected: {
      color: theme.surface,
    },
    skillsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 16,
    },
    skillBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      gap: 6,
    },
    skillText: {
      fontSize: 14,
      color: theme.text,
    },
    removeSkillButton: {
      padding: 2,
    },
    addSkillContainer: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 8,
    },
    addButton: {
      width: 44,
      height: 44,
      borderRadius: 8,
      backgroundColor: theme.primary,
      justifyContent: "center",
      alignItems: "center",
    },
    suggestionsContainer: {
      marginBottom: 8,
    },
    suggestionsList: {
      flexDirection: "row",
      gap: 8,
    },
    suggestionItem: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceAlt,
    },
    suggestionText: {
      fontSize: 14,
      color: theme.text,
    },
    helperText: {
      fontSize: 12,
      color: theme.textMuted,
    },
    portfolioList: {
      gap: 8,
      marginBottom: 16,
    },
    portfolioItem: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.inputBg,
      borderRadius: 8,
      padding: 12,
      gap: 12,
    },
    portfolioLink: {
      flex: 1,
    },
    portfolioLinkText: {
      fontSize: 14,
      color: theme.primary,
    },
    removePortfolioButton: {
      padding: 4,
    },
    addPortfolioContainer: {
      flexDirection: "row",
      gap: 8,
    },
    mobileSaveButton: {
      display: "none",
      marginTop: 8,
      marginBottom: 32,
    },
  });

/* For responsive design
const isTablet = false; // You can implement device detection if needed
if (Platform.OS === 'web' || isTablet) {
  styles.formGrid = {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  };
  styles.formGroup = {
    flex: 1,
    minWidth: 150,
    gap: 8,
  };
  styles.mobileSaveButton.display = 'none';
} else {
  styles.mobileSaveButton.display = 'flex';
}*/
