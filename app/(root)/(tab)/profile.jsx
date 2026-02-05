import { useTheme } from "@/hooks/ThemeContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  Award,
  Briefcase,
  Building,
  DollarSign,
  Globe,
  Link as LinkIcon,
  Plus,
  Save,
  Upload,
  User,
  Users,
  X,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { uploadFile } from "../../../constants/imageService";
import { useScreenPerformance } from "../../../helpers/sentryPerformance";
import { supabase } from "../../../lib/Client";
import { ClientId, getProjects, getUser } from "../../../lib/supabase";

const INDUSTRY_OPTIONS = [
  "Technology",
  "Finance",
  "Healthcare",
  "Education",
  "Retail",
  "Manufacturing",
  "Real Estate",
  "Marketing",
  "Entertainment",
  "Non-Profit",
  "Consulting",
  "Other",
];

const COMPANY_SIZE_OPTIONS = [
  { value: "1-10", label: "1-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-500", label: "201-500 employees" },
  { value: "501-1000", label: "501-1000 employees" },
  { value: "1000+", label: "1000+ employees" },
];

export default function ClientProfile() {
  const { theme, isDark } = useTheme();
  const { user, userRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newIndustry, setNewIndustry] = useState("");
  const [newSocialLink, setNewSocialLink] = useState("");
  const [socialPlatform, setSocialPlatform] = useState("linkedin");

  const [profile, setProfile] = useState({
    company_name: "",
    company_website: "",
    phone_number: "",
    company_size: "1-10",
    industries: [],
    about_company: "",
    social_links: [],
    avatar_url: "",
    cover_image_url: "",
    billing_address: {
      street: "",
      city: "",
      state: "",
      country: "",
      postal_code: "",
    },
  });

  const [userProfile, setUserProfile] = useState({
    full_name: "",
    position: "",
    bio: "",
    location: "",
  });
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState(null);

  useScreenPerformance("ClientProfile");
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/(auth)/login");
    } else if (!authLoading && userRole && userRole !== "client") {
      router.push("/(ftab)/home");
    }
  }, [user, userRole, authLoading, router]);

  useEffect(() => {
    if (user) {
      console.log("project completed", projects);
      fetchClientProfile();
      FetchClientProjects();
    }
  }, [user]);
  const FetchClientProjects = async () => {
    if (!user?.id) return;

    setProjectsLoading(true);
    setProjectsError(null);
    const { clientProfile } = await ClientId(user?.id);
    const { data, error } = await getProjects(clientProfile?.id);

    if (error) {
      setProjectsError(error.message);
      setProjects([]);
    } else {
      setProjects(data);
    }

    setProjectsLoading(false);
  };
  const activeProjects = projects?.filter(
    (p) => p.status !== "completed" && p.status !== "cancelled",
  );
  const Hired = projects?.filter(
    (p) =>
      p.status !== "active" && p.status !== "open" && p.status !== "cancelled",
  );
  const completedProjects = projects?.filter((p) => p.status === "completed");

  const fetchClientProfile = async () => {
    if (!user) return;

    try {
      // Fetch client profile
      const { data: clientData } = await supabase
        .from("client_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (clientData) {
        setProfile({
          company_name: clientData.company_name || "",
          company_website: clientData.company_website || "",
          phone_number: clientData.phone_number || "",
          company_size: clientData.company_size || "1-10",
          industries: clientData.industries || [],
          about_company: clientData.about_company || "",
          social_links: clientData.social_links || [],
          avatar_url: clientData.avatar_url || "",
          cover_image_url: clientData.cover_image_url || "",
          billing_address: clientData.billing_address || {
            street: "",
            city: "",
            state: "",
            country: "",
            postal_code: "",
          },
        });
      }

      // Fetch user profile
      const { data: userData } = await getUser(user.id);

      if (userData) {
        setUserProfile({
          full_name: userData.full_name || "",
          position: userData.position || "",
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

  const pickImage = async (type) => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          "Permission required",
          "Please allow access to your photos to upload images.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: type === "avatar" ? [1, 1] : [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setUploading(true);
        const { url, error } = await uploadFile(result.assets[0].uri, user?.id);
        if (!error) setUploading(false);
        if (type === "avatar") {
          setProfile({ ...profile, avatar_url: url });
        } else {
          setProfile({ ...profile, cover_image_url: url });
        }
      }
    } catch (error) {
      console.error("Error picking image:", error);
      toast({
        title: "Error",
        description: "Failed to pick image",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      // Update client profile with proper upsert conflict handling
      const { error: clientError } = await supabase
        .from("client_profiles")
        .upsert(
          {
            user_id: user.id,
            company_name: profile.company_name || null,
            company_website: profile.company_website || null,
            phone_number: profile.phone_number || null,
            company_size: profile.company_size,
            industries: profile.industries,
            about_company: profile.about_company || null,
            social_links: profile.social_links,
            avatar_url: profile.avatar_url || null,
            cover_image_url: profile.cover_image_url || null,
            billing_address: profile.billing_address,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id", // Specify the unique constraint column
            ignoreDuplicates: false, // This ensures it updates on conflict
          },
        );

      if (clientError) throw clientError;

      // Update user profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: userProfile.full_name || null,
          position: userProfile.position || null,
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

  const addIndustry = (industry) => {
    const trimmedIndustry = industry.trim();
    if (trimmedIndustry && !profile.industries.includes(trimmedIndustry)) {
      setProfile({
        ...profile,
        industries: [...profile.industries, trimmedIndustry],
      });
    }
    setNewIndustry("");
  };

  const removeIndustry = (industryToRemove) => {
    setProfile({
      ...profile,
      industries: profile.industries.filter((i) => i !== industryToRemove),
    });
  };

  const addSocialLink = () => {
    if (!newSocialLink.trim()) return;

    const platformUrls = {
      linkedin: "https://linkedin.com/",
      twitter: "https://twitter.com/",
      facebook: "https://facebook.com/",
      instagram: "https://instagram.com/",
      website: "",
    };

    const baseUrl = platformUrls[socialPlatform];
    const fullUrl =
      socialPlatform === "website"
        ? newSocialLink
        : `${baseUrl}${newSocialLink}`;

    const newLink = {
      platform: socialPlatform,
      url: fullUrl,
      label: `${socialPlatform.charAt(0).toUpperCase() + socialPlatform.slice(1)} Profile`,
    };

    setProfile({
      ...profile,
      social_links: [...profile.social_links, newLink],
    });
    setNewSocialLink("");
  };

  const removeSocialLink = (index) => {
    const updatedLinks = [...profile.social_links];
    updatedLinks.splice(index, 1);
    setProfile({ ...profile, social_links: updatedLinks });
  };

  const updateBillingAddress = (field, value) => {
    setProfile({
      ...profile,
      billing_address: {
        ...profile.billing_address,
        [field]: value,
      },
    });
  };

  const filteredIndustrySuggestions = INDUSTRY_OPTIONS.filter(
    (industry) =>
      industry.toLowerCase().includes(newIndustry.toLowerCase()) &&
      !profile.industries.includes(industry),
  );

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
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Client Profile</Text>
              <Text style={styles.subtitle}>
                Manage your company information
              </Text>
              <Text style={styles.subtitle}>and preferences</Text>
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

          {/* Profile Images */}
          <View style={styles.imagesSection}>
            {/* Cover Image */}
            <View style={styles.coverImageContainer}>
              {profile.cover_image_url ? (
                <Image
                  source={{ uri: profile.cover_image_url }}
                  style={styles.coverImage}
                />
              ) : (
                <View style={styles.coverImagePlaceholder}>
                  <Building size={40} color={theme.textMuted} />
                  <Text style={styles.coverImageText}>Add cover image</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.coverImageUploadButton}
                onPress={() => pickImage("cover")}
                disabled={uploading}
                activeOpacity={0.8}
              >
                <Upload size={20} color={theme.surface} />
                <Text style={styles.uploadButtonText}>
                  {uploading ? "Uploading..." : "Upload Cover"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Avatar */}
            <View style={styles.avatarContainer}>
              <View style={styles.avatarWrapper}>
                {profile.avatar_url ? (
                  <Image
                    source={{ uri: profile.avatar_url }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Building size={40} color={theme.surface} />
                  </View>
                )}
                <TouchableOpacity
                  style={styles.avatarUploadButton}
                  onPress={() => pickImage("avatar")}
                  disabled={uploading}
                  activeOpacity={0.8}
                >
                  <Upload size={16} color={theme.surface} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Personal Information */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIcon}>
                <User size={20} color={theme.primary} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Personal Information</Text>
                <Text style={styles.cardDescription}>Your contact details</Text>
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
                  <Text style={styles.label}>Position</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="CEO / Project Manager"
                    placeholderTextColor={theme.textMuted}
                    value={userProfile.position}
                    onChangeText={(text) =>
                      setUserProfile({ ...userProfile, position: text })
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
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Phone Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="+1 (555) 123-4567"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="phone-pad"
                    value={profile.phone_number}
                    onChangeText={(text) =>
                      setProfile({ ...profile, phone_number: text })
                    }
                  />
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Bio</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Tell us about yourself and your role in the company..."
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

          {/* Company Information */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIcon}>
                <Building size={20} color={theme.primary} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Company Information</Text>
                <Text style={styles.cardDescription}>
                  Details about your organization
                </Text>
              </View>
            </View>
            <View style={styles.cardContent}>
              <View style={styles.formGrid}>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Company Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Acme Corporation"
                    placeholderTextColor={theme.textMuted}
                    value={profile.company_name}
                    onChangeText={(text) =>
                      setProfile({ ...profile, company_name: text })
                    }
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Company Website</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="https://company.com"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={profile.company_website}
                    onChangeText={(text) =>
                      setProfile({ ...profile, company_website: text })
                    }
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Company Size</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.optionsContainer}>
                      {COMPANY_SIZE_OPTIONS.map((option) => (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            styles.optionButton,
                            profile.company_size === option.value &&
                              styles.optionButtonSelected,
                          ]}
                          onPress={() =>
                            setProfile({
                              ...profile,
                              company_size: option.value,
                            })
                          }
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.optionButtonText,
                              profile.company_size === option.value &&
                                styles.optionButtonTextSelected,
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

              {/* Industries */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Industries</Text>
                <View style={styles.industriesContainer}>
                  {profile.industries.map((industry) => (
                    <View key={industry} style={styles.industryBadge}>
                      <Text style={styles.industryText}>{industry}</Text>
                      <TouchableOpacity
                        onPress={() => removeIndustry(industry)}
                        style={styles.removeIndustryButton}
                        activeOpacity={0.7}
                      >
                        <X size={14} color={theme.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
                <View style={styles.addIndustryContainer}>
                  <TextInput
                    style={[styles.input, styles.flex1]}
                    placeholder="Add an industry..."
                    placeholderTextColor={theme.textMuted}
                    value={newIndustry}
                    onChangeText={setNewIndustry}
                    onSubmitEditing={() => addIndustry(newIndustry)}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => addIndustry(newIndustry)}
                    disabled={!newIndustry.trim()}
                    activeOpacity={0.8}
                  >
                    <Plus
                      size={20}
                      color={
                        newIndustry.trim() ? theme.surface : theme.textMuted
                      }
                    />
                  </TouchableOpacity>
                </View>
                {newIndustry && filteredIndustrySuggestions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    >
                      <View style={styles.suggestionsList}>
                        {filteredIndustrySuggestions.map((suggestion) => (
                          <TouchableOpacity
                            key={suggestion}
                            style={styles.suggestionItem}
                            onPress={() => addIndustry(suggestion)}
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
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>About Company</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Describe your company, mission, and values..."
                  placeholderTextColor={theme.textMuted}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                  value={profile.about_company}
                  onChangeText={(text) =>
                    setProfile({ ...profile, about_company: text })
                  }
                />
              </View>
            </View>
          </View>

          {/* Social Links */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIcon}>
                <Globe size={20} color={theme.primary} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Social Links</Text>
                <Text style={styles.cardDescription}>
                  Connect your social media profiles
                </Text>
              </View>
            </View>
            <View style={styles.cardContent}>
              <View style={styles.socialLinksList}>
                {profile.social_links.map((link, index) => (
                  <View key={index} style={styles.socialLinkItem}>
                    <View style={styles.socialLinkIcon}>
                      <LinkIcon size={16} color={theme.textSecondary} />
                    </View>
                    <View style={styles.socialLinkDetails}>
                      <Text style={styles.socialLinkPlatform}>
                        {link.platform}
                      </Text>
                      <Text style={styles.socialLinkUrl} numberOfLines={1}>
                        {link.url}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => removeSocialLink(index)}
                      style={styles.removeSocialLinkButton}
                      activeOpacity={0.7}
                    >
                      <X size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <View style={styles.addSocialLinkContainer}>
                <View style={styles.socialPlatformSelector}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.platformOptions}>
                      {[
                        "linkedin",
                        "twitter",
                        "facebook",
                        "instagram",
                        "website",
                      ].map((platform) => (
                        <TouchableOpacity
                          key={platform}
                          style={[
                            styles.platformOption,
                            socialPlatform === platform &&
                              styles.platformOptionSelected,
                          ]}
                          onPress={() => setSocialPlatform(platform)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.platformOptionText,
                              socialPlatform === platform &&
                                styles.platformOptionTextSelected,
                            ]}
                          >
                            {platform.charAt(0).toUpperCase() +
                              platform.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                <View style={styles.socialLinkInputContainer}>
                  {socialPlatform !== "website" && (
                    <View style={styles.socialLinkPrefix}>
                      <Text style={styles.socialLinkPrefixText}>
                        {socialPlatform === "linkedin"
                          ? "linkedin.com/"
                          : socialPlatform === "twitter"
                            ? "twitter.com/"
                            : socialPlatform === "facebook"
                              ? "facebook.com/"
                              : "instagram.com/"}
                      </Text>
                    </View>
                  )}
                  <TextInput
                    style={[styles.input, styles.flex1]}
                    placeholder={
                      socialPlatform === "website"
                        ? "https://yourwebsite.com"
                        : "username"
                    }
                    placeholderTextColor={theme.textMuted}
                    value={newSocialLink}
                    onChangeText={setNewSocialLink}
                    onSubmitEditing={addSocialLink}
                    returnKeyType="done"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={addSocialLink}
                    disabled={!newSocialLink.trim()}
                    activeOpacity={0.8}
                  >
                    <Plus
                      size={20}
                      color={
                        newSocialLink.trim() ? theme.surface : theme.textMuted
                      }
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          {/* Billing Address */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIcon}>
                <DollarSign size={20} color={theme.primary} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Billing Address</Text>
                <Text style={styles.cardDescription}>
                  For invoices and payments
                </Text>
              </View>
            </View>
            <View style={styles.cardContent}>
              <View style={styles.formGrid}>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Street Address</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="123 Main St"
                    placeholderTextColor={theme.textMuted}
                    value={profile?.billing_address.street}
                    onChangeText={(text) =>
                      updateBillingAddress("street", text)
                    }
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>City</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="New York"
                    placeholderTextColor={theme.textMuted}
                    value={profile?.billing_address.city}
                    onChangeText={(text) => updateBillingAddress("city", text)}
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>State/Province</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="NY"
                    placeholderTextColor={theme.textMuted}
                    value={profile.billing_address.state}
                    onChangeText={(text) => updateBillingAddress("state", text)}
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Postal Code</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="10001"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="numeric"
                    value={profile?.billing_address.postal_code}
                    onChangeText={(text) =>
                      updateBillingAddress("postal_code", text)
                    }
                  />
                </View>
                <View style={[styles.formGroup, { flexBasis: "100%" }]}>
                  <Text style={styles.label}>Country</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="United States"
                    placeholderTextColor={theme.textMuted}
                    value={profile.billing_address.country}
                    onChangeText={(text) =>
                      updateBillingAddress("country", text)
                    }
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Stats Summary (Optional) */}
          <View style={styles.statsCard}>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <View style={styles.statIcon}>
                  <Briefcase size={24} color={theme.primary} />
                </View>
                <View>
                  <Text style={styles.statValue}>
                    {" "}
                    {projectsLoading ? "…" : activeProjects?.length}
                  </Text>
                  <Text style={styles.statLabel}>Active Projects</Text>
                </View>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <View style={styles.statIcon}>
                  <Users size={24} color={theme.success} />
                </View>
                <View>
                  <Text style={styles.statValue}>
                    {projectsLoading ? "…" : Hired?.length}
                  </Text>
                  <Text style={styles.statLabel}>Hired Freelancers</Text>
                </View>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <View style={styles.statIcon}>
                  <Award size={24} color={theme.warning} />
                </View>
                <View>
                  <Text style={styles.statValue}>
                    {projectsLoading ? "…" : completedProjects?.length}
                  </Text>
                  <Text style={styles.statLabel}>Completed Projects</Text>
                </View>
                {projectsError && (
                  <Text
                    style={{
                      color: theme.error,
                      textAlign: "center",
                      marginBottom: 8,
                    }}
                  >
                    Failed to load projects
                  </Text>
                )}
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
}

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      paddingTop: 35,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      paddingBottom: 32,
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
      padding: 16,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    title: {
      fontSize: 24,
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
    imagesSection: {
      position: "relative",
      marginBottom: 80,
    },
    coverImageContainer: {
      height: 200,
      backgroundColor: theme.surfaceAlt,
    },
    coverImage: {
      width: "100%",
      height: "100%",
    },
    coverImagePlaceholder: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    coverImageText: {
      marginTop: 8,
      fontSize: 14,
      color: theme.textMuted,
    },
    coverImageUploadButton: {
      position: "absolute",
      bottom: 12,
      right: 12,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 6,
      gap: 6,
    },
    uploadButtonText: {
      color: theme.surface,
      fontSize: 12,
      fontWeight: "500",
    },
    avatarContainer: {
      position: "absolute",
      bottom: -60,
      left: 16,
    },
    avatarWrapper: {
      position: "relative",
    },
    avatar: {
      width: 120,
      height: 120,
      borderRadius: 60,
      borderWidth: 4,
      borderColor: theme.surface,
    },
    avatarPlaceholder: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: theme.primary,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 4,
      borderColor: theme.surface,
    },
    avatarUploadButton: {
      position: "absolute",
      bottom: 0,
      right: 0,
      backgroundColor: theme.primary,
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: theme.surface,
    },
    card: {
      backgroundColor: theme.surface,
      marginHorizontal: 16,
      marginBottom: 16,
      borderRadius: 12,
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
    optionsContainer: {
      flexDirection: "row",
      gap: 8,
      paddingVertical: 4,
    },
    optionButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceAlt,
    },
    optionButtonSelected: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    optionButtonText: {
      fontSize: 14,
      color: theme.text,
      fontWeight: "500",
    },
    optionButtonTextSelected: {
      color: theme.surface,
    },
    industriesContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 16,
    },
    industryBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.iconBg,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      gap: 6,
    },
    industryText: {
      fontSize: 14,
      color: theme.primary,
    },
    removeIndustryButton: {
      padding: 2,
    },
    addIndustryContainer: {
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
    socialLinksList: {
      gap: 8,
      marginBottom: 16,
    },
    socialLinkItem: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.inputBg,
      borderRadius: 8,
      padding: 12,
      gap: 12,
    },
    socialLinkIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.border,
      justifyContent: "center",
      alignItems: "center",
    },
    socialLinkDetails: {
      flex: 1,
    },
    socialLinkPlatform: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.text,
      textTransform: "capitalize",
    },
    socialLinkUrl: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    removeSocialLinkButton: {
      padding: 4,
    },
    addSocialLinkContainer: {
      gap: 12,
    },
    socialPlatformSelector: {
      marginBottom: 8,
    },
    platformOptions: {
      flexDirection: "row",
      gap: 8,
    },
    platformOption: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceAlt,
    },
    platformOptionSelected: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    platformOptionText: {
      fontSize: 14,
      color: theme.text,
      fontWeight: "500",
      textTransform: "capitalize",
    },
    platformOptionTextSelected: {
      color: theme.surface,
    },
    socialLinkInputContainer: {
      flexDirection: "row",
      gap: 8,
      alignItems: "center",
    },
    socialLinkPrefix: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.surfaceAlt,
      borderRadius: 8,
    },
    socialLinkPrefixText: {
      fontSize: 15,
      color: theme.textSecondary,
    },
    statsCard: {
      backgroundColor: theme.surface,
      marginHorizontal: 16,
      marginBottom: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 20,
    },
    statsContainer: {
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "center",
    },
    statItem: {
      alignItems: "center",
      flex: 1,
    },
    statIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.iconBg,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 8,
    },
    statValue: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.text,
      textAlign: "center",
    },
    statLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: "center",
      marginTop: 2,
    },
    statDivider: {
      width: 1,
      height: 40,
      backgroundColor: theme.border,
    },
    mobileSaveButton: {
      display: "none",
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 32,
    },
  });

/* Responsive styles
const isTablet = false;
if (Platform.OS === 'web' || isTablet) {
  styles.content = {
    paddingBottom: 32,
    maxWidth: 1024,
    alignSelf: 'center',
    width: '100%',
  };
  styles.formGrid = {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  };
  styles.formGroup = {
    flex: 1,
    minWidth: 200,
    gap: 8,
  };
  styles.mobileSaveButton.display = 'none';
} else {
  styles.mobileSaveButton.display = 'flex';
}*/
