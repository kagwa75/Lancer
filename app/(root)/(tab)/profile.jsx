import { useTheme } from "@/hooks/ThemeContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  Award,
  Briefcase,
  Building,
  ChevronDown,
  ChevronUp,
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
import { useEffect, useMemo, useRef, useState } from "react";
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

const cloneValue = (value) => JSON.parse(JSON.stringify(value));

const createEmptyProfile = () => ({
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

const createEmptyUserProfile = () => ({
  full_name: "",
  position: "",
  bio: "",
  location: "",
});

const normalizeProfile = (value) => {
  const industries = Array.isArray(value?.industries)
    ? [...value.industries]
    : [];
  industries.sort((a, b) => a.localeCompare(b));

  const socialLinks = Array.isArray(value?.social_links)
    ? value.social_links.map((link) => ({
        platform: link?.platform || "",
        url: link?.url || "",
        label: link?.label || "",
      }))
    : [];
  socialLinks.sort((a, b) =>
    `${a.platform}|${a.url}|${a.label}`.localeCompare(
      `${b.platform}|${b.url}|${b.label}`,
    ),
  );

  const billingAddress = value?.billing_address || {};

  return {
    company_name: value?.company_name?.trim() || "",
    company_website: value?.company_website?.trim() || "",
    phone_number: value?.phone_number?.trim() || "",
    company_size: value?.company_size || "1-10",
    industries,
    about_company: value?.about_company?.trim() || "",
    social_links: socialLinks,
    avatar_url: value?.avatar_url || "",
    cover_image_url: value?.cover_image_url || "",
    billing_address: {
      street: billingAddress.street?.trim() || "",
      city: billingAddress.city?.trim() || "",
      state: billingAddress.state?.trim() || "",
      country: billingAddress.country?.trim() || "",
      postal_code: billingAddress.postal_code?.trim() || "",
    },
  };
};

const normalizeUserProfile = (value) => ({
  full_name: value?.full_name?.trim() || "",
  position: value?.position?.trim() || "",
  bio: value?.bio?.trim() || "",
  location: value?.location?.trim() || "",
});

const ensureHttp = (value) => {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const isValidUrl = (value) => {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

export default function ClientProfile() {
  const { theme, isDark } = useTheme();
  const { user, userRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingType, setUploadingType] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [lastSelectedImage, setLastSelectedImage] = useState({
    avatar: null,
    cover: null,
  });
  const [newIndustry, setNewIndustry] = useState("");
  const [newSocialLink, setNewSocialLink] = useState("");
  const [socialPlatform, setSocialPlatform] = useState("linkedin");

  const [profile, setProfile] = useState(createEmptyProfile);
  const [userProfile, setUserProfile] = useState(createEmptyUserProfile);
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState(null);
  const [baselineReady, setBaselineReady] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({
    personal: false,
    company: false,
    social: false,
    billing: false,
    stats: false,
  });
  const baselineRef = useRef({
    profile: "",
    user: "",
    profileRaw: createEmptyProfile(),
    userRaw: createEmptyUserProfile(),
  });
  const scrollRef = useRef(null);
  const sectionOffsets = useRef({});

  const currentProfileSnapshot = useMemo(
    () => JSON.stringify(normalizeProfile(profile)),
    [profile],
  );
  const currentUserSnapshot = useMemo(
    () => JSON.stringify(normalizeUserProfile(userProfile)),
    [userProfile],
  );

  const validationErrors = useMemo(() => {
    const errors = {};
    const fullName = userProfile.full_name?.trim() || "";
    const companyName = profile.company_name?.trim() || "";
    const phone = profile.phone_number?.trim() || "";

    if (!fullName) {
      errors.full_name = "Full name is required.";
    } else if (fullName.length < 2) {
      errors.full_name = "Full name is too short.";
    }

    if (!companyName) {
      errors.company_name = "Company name is required.";
    } else if (companyName.length < 2) {
      errors.company_name = "Company name is too short.";
    }

    if (phone) {
      const digits = phone.replace(/[^\d]/g, "");
      if (digits.length < 7 || digits.length > 15) {
        errors.phone_number = "Enter a valid phone number.";
      }
    }

    if (profile.company_website?.trim()) {
      const normalized = ensureHttp(profile.company_website);
      if (!isValidUrl(normalized)) {
        errors.company_website = "Enter a valid website URL.";
      }
    }

    return errors;
  }, [
    profile.company_name,
    profile.company_website,
    profile.phone_number,
    userProfile.full_name,
  ]);

  const socialInputError = useMemo(() => {
    if (socialPlatform !== "website") return "";
    if (!newSocialLink.trim()) return "";
    const normalized = ensureHttp(newSocialLink);
    return isValidUrl(normalized) ? "" : "Enter a valid website URL.";
  }, [socialPlatform, newSocialLink]);

  const hasBlockingErrors = Object.keys(validationErrors).length > 0;

  const isDirty = useMemo(() => {
    if (!baselineReady) return false;
    return (
      baselineRef.current.profile !== currentProfileSnapshot ||
      baselineRef.current.user !== currentUserSnapshot
    );
  }, [baselineReady, currentProfileSnapshot, currentUserSnapshot]);

  const canSave = isDirty && !saving && !uploading && !hasBlockingErrors;

  const completionItems = useMemo(() => {
    const billing = profile.billing_address || {};
    return [
      { key: "full_name", label: "Full name", filled: !!userProfile.full_name?.trim() },
      { key: "position", label: "Position", filled: !!userProfile.position?.trim() },
      { key: "location", label: "Location", filled: !!userProfile.location?.trim() },
      { key: "phone", label: "Phone", filled: !!profile.phone_number?.trim() },
      { key: "bio", label: "Bio", filled: !!userProfile.bio?.trim() },
      { key: "company", label: "Company name", filled: !!profile.company_name?.trim() },
      { key: "website", label: "Website", filled: !!profile.company_website?.trim() },
      { key: "industries", label: "Industries", filled: (profile.industries || []).length > 0 },
      { key: "about", label: "About", filled: !!profile.about_company?.trim() },
      { key: "social", label: "Social links", filled: (profile.social_links || []).length > 0 },
      { key: "avatar", label: "Avatar", filled: !!profile.avatar_url },
      { key: "cover", label: "Cover", filled: !!profile.cover_image_url },
      { key: "street", label: "Street", filled: !!billing.street?.trim() },
      { key: "city", label: "City", filled: !!billing.city?.trim() },
      { key: "state", label: "State", filled: !!billing.state?.trim() },
      { key: "country", label: "Country", filled: !!billing.country?.trim() },
      { key: "postal", label: "Postal code", filled: !!billing.postal_code?.trim() },
    ];
  }, [profile, userProfile]);

  const completionCount = completionItems.filter((item) => item.filled).length;
  const completionPercent = Math.round(
    (completionCount / completionItems.length) * 100,
  );

  const sectionItems = [
    { key: "personal", label: "Personal" },
    { key: "company", label: "Company" },
    { key: "social", label: "Social" },
    { key: "billing", label: "Billing" },
    { key: "stats", label: "Stats" },
  ];

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
    let baselineSet = false;

    try {
      // Fetch client profile
      const { data: clientData } = await supabase
        .from("client_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      const nextProfile = clientData
        ? {
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
          }
        : createEmptyProfile();

      // Fetch user profile
      const { data: userData } = await getUser(user.id);

      const nextUserProfile = userData
        ? {
            full_name: userData.full_name || "",
            position: userData.position || "",
            bio: userData.bio || "",
            location: userData.location || "",
          }
        : createEmptyUserProfile();

      setProfile(nextProfile);
      setUserProfile(nextUserProfile);
      baselineRef.current = {
        profile: JSON.stringify(normalizeProfile(nextProfile)),
        user: JSON.stringify(normalizeUserProfile(nextUserProfile)),
        profileRaw: cloneValue(nextProfile),
        userRaw: cloneValue(nextUserProfile),
      };
      setBaselineReady(true);
      baselineSet = true;
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      if (!baselineSet) {
        baselineRef.current = {
          profile: JSON.stringify(normalizeProfile(profile)),
          user: JSON.stringify(normalizeUserProfile(userProfile)),
          profileRaw: cloneValue(profile),
          userRaw: cloneValue(userProfile),
        };
        setBaselineReady(true);
      }
      setLoading(false);
    }
  };

  const toggleSection = (key) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const registerSection = (key, y) => {
    sectionOffsets.current[key] = y;
  };

  const handleNavigate = (key) => {
    if (collapsedSections[key]) {
      setCollapsedSections((prev) => ({ ...prev, [key]: false }));
    }
    const y = sectionOffsets.current[key];
    if (typeof y === "number") {
      scrollRef.current?.scrollTo({
        y: Math.max(0, y - 12),
        animated: true,
      });
    }
  };

  const uploadSelectedImage = async (type, uri) => {
    if (!uri) return;
    setUploading(true);
    setUploadingType(type);
    setUploadError(null);
    try {
      const { url, error } = await uploadFile(uri, user?.id);
      if (error || !url) {
        throw new Error("Upload failed");
      }
      if (type === "avatar") {
        setProfile((prev) => ({ ...prev, avatar_url: url }));
      } else {
        setProfile((prev) => ({ ...prev, cover_image_url: url }));
      }
    } catch (error) {
      setUploadError({
        type,
        message: "Failed to upload image. Tap to retry.",
      });
      toast({
        title: "Upload failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadingType(null);
    }
  };

  const handleRetryUpload = (type) => {
    const uri = lastSelectedImage[type];
    if (!uri) {
      toast({
        title: "No image selected",
        description: "Pick an image first.",
      });
      return;
    }
    uploadSelectedImage(type, uri);
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
        const uri = result.assets[0].uri;
        setLastSelectedImage((prev) => ({ ...prev, [type]: uri }));
        await uploadSelectedImage(type, uri);
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
    if (!isDirty) {
      toast({
        title: "No changes",
        description: "Update a field before saving.",
      });
      return;
    }
    if (hasBlockingErrors) {
      toast({
        title: "Fix validation errors",
        description: "Please correct the highlighted fields before saving.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);

    try {
      const normalizedWebsite = profile.company_website
        ? ensureHttp(profile.company_website)
        : "";

      // Update client profile with proper upsert conflict handling
      const { error: clientError } = await supabase
        .from("client_profiles")
        .upsert(
          {
            user_id: user.id,
            company_name: profile.company_name || null,
            company_website: normalizedWebsite || null,
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

      const nextProfile =
        normalizedWebsite && normalizedWebsite !== profile.company_website
          ? { ...profile, company_website: normalizedWebsite }
          : profile;
      if (nextProfile !== profile) {
        setProfile(nextProfile);
      }

      baselineRef.current = {
        profile: JSON.stringify(normalizeProfile(nextProfile)),
        user: JSON.stringify(normalizeUserProfile(userProfile)),
        profileRaw: cloneValue(nextProfile),
        userRaw: cloneValue(userProfile),
      };
      setBaselineReady(true);

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

  const handleDiscardChanges = () => {
    if (!isDirty) return;
    Alert.alert("Discard changes?", "This will revert all unsaved edits.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          setProfile(cloneValue(baselineRef.current.profileRaw));
          setUserProfile(cloneValue(baselineRef.current.userRaw));
          toast({
            title: "Changes discarded",
            description: "Your profile is back to the last saved version.",
          });
        },
      },
    ]);
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
    const trimmedInput = newSocialLink.trim();
    let fullUrl = trimmedInput;

    if (socialPlatform === "website") {
      fullUrl = ensureHttp(trimmedInput);
      if (!isValidUrl(fullUrl)) {
        toast({
          title: "Invalid URL",
          description: "Enter a valid website address.",
          variant: "destructive",
        });
        return;
      }
    } else if (/^https?:\/\//i.test(trimmedInput)) {
      fullUrl = trimmedInput;
    } else {
      fullUrl = `${baseUrl}${trimmedInput.replace(/^@/, "")}`;
    }

    const isDuplicate = profile.social_links.some(
      (link) => link.url?.toLowerCase() === fullUrl.toLowerCase(),
    );
    if (isDuplicate) {
      toast({
        title: "Already added",
        description: "That social link is already on your profile.",
      });
      return;
    }

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
      <ScrollView
        style={styles.scrollView}
        keyboardShouldPersistTaps="handled"
        ref={scrollRef}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Client Profile</Text>
              <Text style={styles.subtitle}>
                Manage your company information
              </Text>
              <Text style={styles.subtitle}>and preferences</Text>
              {isDirty && (
                <Text style={styles.unsavedText}>Unsaved changes</Text>
              )}
            </View>
            <View style={styles.headerActions}>
              {isDirty && (
                <TouchableOpacity
                  style={styles.discardButton}
                  onPress={handleDiscardChanges}
                  disabled={saving || uploading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.discardButtonText}>Discard</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  !canSave && styles.saveButtonDisabled,
                ]}
                onPress={handleSave}
                disabled={!canSave}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={theme.surface} />
                ) : (
                  <>
                    <Save size={18} color={theme.surface} />
                  <Text style={styles.saveButtonText}>
                    {isDirty
                      ? hasBlockingErrors
                        ? "Fix Errors"
                        : "Save Changes"
                      : "No Changes"}
                  </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.completionCard}>
            <View style={styles.completionHeader}>
              <Text style={styles.completionTitle}>Profile completeness</Text>
              <Text style={styles.completionPercent}>
                {completionPercent}%
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${completionPercent}%` },
                ]}
              />
            </View>
            <Text style={styles.completionSubtitle}>
              {completionCount} of {completionItems.length} fields completed
            </Text>
          </View>

          <View style={styles.quickNav}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.quickNavList}>
                {sectionItems.map((section) => (
                  <TouchableOpacity
                    key={section.key}
                    style={[
                      styles.quickNavChip,
                      collapsedSections[section.key] &&
                        styles.quickNavChipCollapsed,
                    ]}
                    onPress={() => handleNavigate(section.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.quickNavText}>{section.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
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
              {uploading && uploadingType === "cover" && (
                <View style={styles.imageOverlay}>
                  <ActivityIndicator size="small" color={theme.surface} />
                  <Text style={styles.imageOverlayText}>Uploading...</Text>
                </View>
              )}
              {uploadError?.type === "cover" && !uploading && (
                <TouchableOpacity
                  style={styles.retryOverlay}
                  onPress={() => handleRetryUpload("cover")}
                  activeOpacity={0.8}
                >
                  <Text style={styles.retryOverlayText}>Retry upload</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.coverImageUploadButton}
                onPress={() => pickImage("cover")}
                disabled={uploading}
                activeOpacity={0.8}
              >
                <Upload size={20} color={theme.surface} />
                <Text style={styles.uploadButtonText}>
                  {uploading && uploadingType === "cover"
                    ? "Uploading..."
                    : uploadError?.type === "cover"
                      ? "Change Cover"
                      : "Upload Cover"}
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
                {uploading && uploadingType === "avatar" && (
                  <View style={styles.avatarOverlay}>
                    <ActivityIndicator size="small" color={theme.surface} />
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
                {uploadError?.type === "avatar" && !uploading && (
                  <TouchableOpacity
                    style={styles.avatarRetry}
                    onPress={() => handleRetryUpload("avatar")}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.avatarRetryText}>Retry</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* Personal Information */}
          <View
            onLayout={(event) =>
              registerSection("personal", event.nativeEvent.layout.y)
            }
          >
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.cardHeader}
                onPress={() => toggleSection("personal")}
                activeOpacity={0.8}
              >
                <View style={styles.cardHeaderLeft}>
                  <View style={styles.cardHeaderIcon}>
                    <User size={20} color={theme.primary} />
                  </View>
                  <View>
                    <Text style={styles.cardTitle}>Personal Information</Text>
                    <Text style={styles.cardDescription}>
                      Your contact details
                    </Text>
                  </View>
                </View>
                {collapsedSections.personal ? (
                  <ChevronDown size={20} color={theme.textSecondary} />
                ) : (
                  <ChevronUp size={20} color={theme.textSecondary} />
                )}
              </TouchableOpacity>
              {!collapsedSections.personal && (
                <View style={styles.cardContent}>
                <View style={styles.formGrid}>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Full Name</Text>
                  <TextInput
                    style={[
                      styles.input,
                      validationErrors.full_name && styles.inputError,
                    ]}
                    placeholder="John Doe"
                    placeholderTextColor={theme.textMuted}
                    value={userProfile.full_name}
                    onChangeText={(text) =>
                      setUserProfile({ ...userProfile, full_name: text })
                    }
                  />
                  {validationErrors.full_name && (
                    <Text style={styles.inputErrorText}>
                      {validationErrors.full_name}
                    </Text>
                  )}
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
                    style={[
                      styles.input,
                      validationErrors.phone_number && styles.inputError,
                    ]}
                    placeholder="+1 (555) 123-4567"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="phone-pad"
                    value={profile.phone_number}
                    onChangeText={(text) =>
                      setProfile({ ...profile, phone_number: text })
                    }
                  />
                  {validationErrors.phone_number && (
                    <Text style={styles.inputErrorText}>
                      {validationErrors.phone_number}
                    </Text>
                  )}
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
                  maxLength={500}
                />
                <Text style={styles.charCount}>
                  {userProfile.bio?.length || 0}/500
                </Text>
              </View>
            </View>
              )}
            </View>
          </View>

          {/* Company Information */}
          <View
            onLayout={(event) =>
              registerSection("company", event.nativeEvent.layout.y)
            }
          >
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.cardHeader}
                onPress={() => toggleSection("company")}
                activeOpacity={0.8}
              >
                <View style={styles.cardHeaderLeft}>
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
                {collapsedSections.company ? (
                  <ChevronDown size={20} color={theme.textSecondary} />
                ) : (
                  <ChevronUp size={20} color={theme.textSecondary} />
                )}
              </TouchableOpacity>
              {!collapsedSections.company && (
                <View style={styles.cardContent}>
              <View style={styles.formGrid}>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Company Name</Text>
                  <TextInput
                    style={[
                      styles.input,
                      validationErrors.company_name && styles.inputError,
                    ]}
                    placeholder="Acme Corporation"
                    placeholderTextColor={theme.textMuted}
                    value={profile.company_name}
                    onChangeText={(text) =>
                      setProfile({ ...profile, company_name: text })
                    }
                  />
                  {validationErrors.company_name && (
                    <Text style={styles.inputErrorText}>
                      {validationErrors.company_name}
                    </Text>
                  )}
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Company Website</Text>
                  <TextInput
                    style={[
                      styles.input,
                      validationErrors.company_website && styles.inputError,
                    ]}
                    placeholder="https://company.com"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={profile.company_website}
                    onChangeText={(text) =>
                      setProfile({ ...profile, company_website: text })
                    }
                    onBlur={() => {
                      const normalized = ensureHttp(profile.company_website);
                      if (
                        profile.company_website.trim() &&
                        normalized !== profile.company_website
                      ) {
                        setProfile((prev) => ({
                          ...prev,
                          company_website: normalized,
                        }));
                      }
                    }}
                  />
                  {validationErrors.company_website && (
                    <Text style={styles.inputErrorText}>
                      {validationErrors.company_website}
                    </Text>
                  )}
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
                  maxLength={1000}
                />
                <Text style={styles.charCount}>
                  {profile.about_company?.length || 0}/1000
                </Text>
              </View>
            </View>
              )}
            </View>
          </View>

          {/* Social Links */}
          <View
            onLayout={(event) =>
              registerSection("social", event.nativeEvent.layout.y)
            }
          >
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.cardHeader}
                onPress={() => toggleSection("social")}
                activeOpacity={0.8}
              >
                <View style={styles.cardHeaderLeft}>
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
                {collapsedSections.social ? (
                  <ChevronDown size={20} color={theme.textSecondary} />
                ) : (
                  <ChevronUp size={20} color={theme.textSecondary} />
                )}
              </TouchableOpacity>
              {!collapsedSections.social && (
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
                    style={[
                      styles.input,
                      styles.flex1,
                      socialInputError && styles.inputError,
                    ]}
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
                {socialInputError && (
                  <Text style={styles.inputErrorText}>
                    {socialInputError}
                  </Text>
                )}
              </View>
            </View>
              )}
            </View>
          </View>

          {/* Billing Address */}
          <View
            onLayout={(event) =>
              registerSection("billing", event.nativeEvent.layout.y)
            }
          >
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.cardHeader}
                onPress={() => toggleSection("billing")}
                activeOpacity={0.8}
              >
                <View style={styles.cardHeaderLeft}>
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
                {collapsedSections.billing ? (
                  <ChevronDown size={20} color={theme.textSecondary} />
                ) : (
                  <ChevronUp size={20} color={theme.textSecondary} />
                )}
              </TouchableOpacity>
              {!collapsedSections.billing && (
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
              )}
            </View>
          </View>

          {/* Stats Summary (Optional) */}
          <View
            onLayout={(event) =>
              registerSection("stats", event.nativeEvent.layout.y)
            }
          >
            <View style={styles.statsCard}>
              <TouchableOpacity
                style={styles.statsHeader}
                onPress={() => toggleSection("stats")}
                activeOpacity={0.8}
              >
                <Text style={styles.statsTitle}>Stats Summary</Text>
                {collapsedSections.stats ? (
                  <ChevronDown size={20} color={theme.textSecondary} />
                ) : (
                  <ChevronUp size={20} color={theme.textSecondary} />
                )}
              </TouchableOpacity>
              {!collapsedSections.stats && (
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
              )}
            </View>
          </View>

          {/* Save Button (Mobile) */}
          <View style={styles.mobileSaveButton}>
            <TouchableOpacity
              style={[
                styles.saveButton,
                styles.fullWidth,
                !canSave && styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={!canSave}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color={theme.surface} />
              ) : (
                <>
                  <Save size={18} color={theme.surface} />
                  <Text style={styles.saveButtonText}>
                    {isDirty
                      ? hasBlockingErrors
                        ? "Fix Errors"
                        : "Save Changes"
                      : "No Changes"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            {isDirty && (
              <TouchableOpacity
                style={styles.discardButton}
                onPress={handleDiscardChanges}
                disabled={saving || uploading}
                activeOpacity={0.8}
              >
                <Text style={styles.discardButtonText}>Discard Changes</Text>
              </TouchableOpacity>
            )}
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
    headerActions: {
      flexDirection: "column",
      alignItems: "flex-end",
      gap: 10,
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
    unsavedText: {
      marginTop: 6,
      fontSize: 12,
      color: theme.warning,
      fontWeight: "600",
    },
    completionCard: {
      marginHorizontal: 16,
      marginTop: 16,
      padding: 16,
      borderRadius: 12,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    completionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    completionTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.text,
    },
    completionPercent: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.primary,
    },
    progressTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: theme.border,
      overflow: "hidden",
    },
    progressFill: {
      height: 8,
      borderRadius: 999,
      backgroundColor: theme.success,
    },
    completionSubtitle: {
      marginTop: 8,
      fontSize: 12,
      color: theme.textSecondary,
    },
    quickNav: {
      marginTop: 12,
      marginBottom: 8,
      paddingHorizontal: 16,
    },
    quickNavList: {
      flexDirection: "row",
      gap: 8,
      paddingVertical: 4,
    },
    quickNavChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceAlt,
    },
    quickNavChipCollapsed: {
      opacity: 0.6,
    },
    quickNavText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.text,
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
    saveButtonDisabled: {
      opacity: 0.6,
    },
    discardButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceAlt,
    },
    discardButtonText: {
      color: theme.text,
      fontWeight: "600",
      fontSize: 13,
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
    imageOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.45)",
      justifyContent: "center",
      alignItems: "center",
      gap: 6,
    },
    imageOverlayText: {
      color: theme.surface,
      fontSize: 12,
      fontWeight: "600",
    },
    retryOverlay: {
      position: "absolute",
      top: 12,
      right: 12,
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    retryOverlayText: {
      color: theme.surface,
      fontSize: 12,
      fontWeight: "600",
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
    avatarOverlay: {
      position: "absolute",
      top: 4,
      bottom: 4,
      left: 4,
      right: 4,
      borderRadius: 56,
      backgroundColor: "rgba(0, 0, 0, 0.35)",
      justifyContent: "center",
      alignItems: "center",
    },
    avatarRetry: {
      position: "absolute",
      top: 6,
      left: 6,
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    avatarRetryText: {
      color: theme.surface,
      fontSize: 10,
      fontWeight: "600",
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
      justifyContent: "space-between",
    },
    cardHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
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
    inputError: {
      borderColor: theme.error,
    },
    inputErrorText: {
      color: theme.error,
      fontSize: 12,
    },
    textArea: {
      minHeight: 100,
      textAlignVertical: "top",
    },
    charCount: {
      fontSize: 12,
      color: theme.textMuted,
      textAlign: "right",
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
    statsHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    statsTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.text,
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
      gap: 10,
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
