import { useTheme } from "@/hooks/ThemeContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  DollarSign,
  FileText,
  X,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/Client";

const skillSuggestions = [
  "React",
  "Node.js",
  "TypeScript",
  "Python",
  "JavaScript",
  "PHP",
  "Ruby",
  "Java",
  "UI/UX Design",
  "Figma",
  "Adobe XD",
  "Graphic Design",
  "Logo Design",
  "Content Writing",
  "SEO",
  "Digital Marketing",
  "Social Media",
  "Video Editing",
  "Motion Graphics",
  "Data Analysis",
  "Machine Learning",
];

export default function NewProject() {
  const { user, userRole, loading } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category_id: "",
    budget_type: "fixed",
    budget_min: "",
    budget_max: "",
    timeline: "",
    required_skills: [],
  });

  const [skillInput, setSkillInput] = useState("");

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
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from("project_categories").select("*");
    if (data) setCategories(data);
  };

  const addSkill = (skill) => {
    const trimmedSkill = skill.trim();
    if (trimmedSkill && !formData.required_skills.includes(trimmedSkill)) {
      setFormData({
        ...formData,
        required_skills: [...formData.required_skills, trimmedSkill],
      });
    }
    setSkillInput("");
  };

  const removeSkill = (skill) => {
    setFormData({
      ...formData,
      required_skills: formData.required_skills.filter((s) => s !== skill),
    });
  };

  const handleSubmit = async () => {
    if (!user) return;

    setIsSubmitting(true);

    const { data: clientProfile, error: profileError } = await supabase
      .from("client_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !clientProfile) {
      console.error("Error in client_profile:", profileError);
      toast({
        title: "Error",
        description: "Could not find your client profile.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase.from("projects").insert({
      client_id: clientProfile.id,
      title: formData.title,
      description: formData.description,
      category_id: formData.category_id || null,
      budget_type: formData.budget_type,
      budget_min: parseFloat(formData.budget_min) || null,
      budget_max: parseFloat(formData.budget_max) || null,
      timeline: formData.timeline || null,
      required_skills: formData.required_skills,
      status: "open",
    });

    setIsSubmitting(false);

    if (error) {
      console.error("Error posting projects:", error);
      toast({
        title: "Error",
        description: "Failed to create project. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Project posted!",
        description:
          "Your project is now live and freelancers can submit proposals.",
      });
      router.push("/projects");
    }
  };

  const canProceed = () => {
    if (step === 1)
      return formData.title.length > 0 && formData.description.length > 10;
    if (step === 2) return formData.budget_min && formData.budget_max;
    return true;
  };

  const getTimelineLabel = (value) => {
    const labels = {
      less_than_1_week: "Less than 1 week",
      "1_2_weeks": "1-2 weeks",
      "2_4_weeks": "2-4 weeks",
      "1_3_months": "1-3 months",
      "3_6_months": "3-6 months",
      ongoing: "Ongoing",
    };
    return labels[value] || value;
  };

  const getStepInfo = () => {
    const steps = [
      { title: "Project Details", icon: FileText },
      { title: "Budget & Timeline", icon: DollarSign },
      { title: "Skills & Review", icon: Award },
    ];
    return steps[step - 1];
  };

  if (loading || userRole !== "client") {
    return null;
  }

  const StepIcon = getStepInfo().icon;
  const styles = createStyles(theme);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <ArrowLeft size={18} color={theme.textSecondary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          {/* Progress Indicator */}
          <View style={styles.progressContainer}>
            {[1, 2, 3].map((stepNum) => (
              <View key={stepNum} style={styles.progressStep}>
                <View
                  style={[
                    styles.progressCircle,
                    step >= stepNum && styles.progressCircleActive,
                    step > stepNum && styles.progressCircleComplete,
                  ]}
                >
                  {step > stepNum ? (
                    <Check size={16} color="#FFFFFF" />
                  ) : (
                    <Text
                      style={[
                        styles.progressNumber,
                        step >= stepNum && styles.progressNumberActive,
                      ]}
                    >
                      {stepNum}
                    </Text>
                  )}
                </View>
                {stepNum < 3 && (
                  <View
                    style={[
                      styles.progressLine,
                      step > stepNum && styles.progressLineActive,
                    ]}
                  />
                )}
              </View>
            ))}
          </View>

          <View style={styles.card}>
            {/* Header */}
            <View style={styles.cardHeader}>
              <View style={styles.headerIcon}>
                <StepIcon size={24} color={theme.primary} />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.headerTitle}>Post a New Project</Text>
                <Text style={styles.headerSubtitle}>
                  Step {step} of 3 - {getStepInfo().title}
                </Text>
              </View>
            </View>

            {/* Step 1: Project Details */}
            {step === 1 && (
              <View style={styles.stepContent}>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Project Title *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Build a responsive e-commerce website"
                    placeholderTextColor={theme.inputPlaceholder}
                    value={formData.title}
                    onChangeText={(text) =>
                      setFormData({ ...formData, title: text })
                    }
                  />
                  <Text style={styles.hint}>
                    Choose a clear, descriptive title that explains your project
                  </Text>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Category</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.chipContainer}>
                      {categories.map((category) => (
                        <TouchableOpacity
                          key={category.id}
                          style={[
                            styles.chip,
                            formData.category_id === category.id &&
                              styles.chipActive,
                          ]}
                          onPress={() =>
                            setFormData({
                              ...formData,
                              category_id: category.id,
                            })
                          }
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              formData.category_id === category.id &&
                                styles.chipTextActive,
                            ]}
                          >
                            {category.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Project Description *</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Describe your project in detail. Include goals, deliverables, and any specific requirements..."
                    placeholderTextColor={theme.inputPlaceholder}
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                    value={formData.description}
                    onChangeText={(text) =>
                      setFormData({ ...formData, description: text })
                    }
                  />
                  <Text style={styles.hint}>
                    {formData.description.length} characters (minimum 10
                    required)
                  </Text>
                </View>
              </View>
            )}

            {/* Step 2: Budget & Timeline */}
            {step === 2 && (
              <View style={styles.stepContent}>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Budget Type *</Text>
                  <View style={styles.budgetTypeContainer}>
                    <TouchableOpacity
                      style={[
                        styles.budgetTypeButton,
                        formData.budget_type === "fixed" &&
                          styles.budgetTypeButtonActive,
                      ]}
                      onPress={() =>
                        setFormData({ ...formData, budget_type: "fixed" })
                      }
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.budgetTypeText,
                          formData.budget_type === "fixed" &&
                            styles.budgetTypeTextActive,
                        ]}
                      >
                        Fixed Price
                      </Text>
                      <Text
                        style={[
                          styles.budgetTypeHint,
                          formData.budget_type === "fixed" &&
                            styles.budgetTypeHintActive,
                        ]}
                      >
                        One-time project fee
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.budgetTypeButton,
                        formData.budget_type === "hourly" &&
                          styles.budgetTypeButtonActive,
                      ]}
                      onPress={() =>
                        setFormData({ ...formData, budget_type: "hourly" })
                      }
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.budgetTypeText,
                          formData.budget_type === "hourly" &&
                            styles.budgetTypeTextActive,
                        ]}
                      >
                        Hourly Rate
                      </Text>
                      <Text
                        style={[
                          styles.budgetTypeHint,
                          formData.budget_type === "hourly" &&
                            styles.budgetTypeHintActive,
                        ]}
                      >
                        Pay per hour worked
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.budgetInputs}>
                  <View style={styles.budgetInputGroup}>
                    <Text style={styles.label}>
                      {formData.budget_type === "fixed"
                        ? "Minimum Budget *"
                        : "Min Hourly Rate *"}
                    </Text>
                    <View style={styles.inputWithIcon}>
                      <Text style={styles.inputIcon}>$</Text>
                      <TextInput
                        style={styles.inputWithIconField}
                        placeholder="500"
                        placeholderTextColor={theme.inputPlaceholder}
                        keyboardType="numeric"
                        value={formData.budget_min}
                        onChangeText={(text) =>
                          setFormData({ ...formData, budget_min: text })
                        }
                      />
                    </View>
                  </View>
                  <View style={styles.budgetInputGroup}>
                    <Text style={styles.label}>
                      {formData.budget_type === "fixed"
                        ? "Maximum Budget *"
                        : "Max Hourly Rate *"}
                    </Text>
                    <View style={styles.inputWithIcon}>
                      <Text style={styles.inputIcon}>$</Text>
                      <TextInput
                        style={styles.inputWithIconField}
                        placeholder="2000"
                        placeholderTextColor={theme.inputPlaceholder}
                        keyboardType="numeric"
                        value={formData.budget_max}
                        onChangeText={(text) =>
                          setFormData({ ...formData, budget_max: text })
                        }
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Project Timeline</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.chipContainer}>
                      {[
                        "less_than_1_week",
                        "1_2_weeks",
                        "2_4_weeks",
                        "1_3_months",
                        "3_6_months",
                        "ongoing",
                      ].map((timelineOption) => (
                        <TouchableOpacity
                          key={timelineOption}
                          style={[
                            styles.chip,
                            formData.timeline === timelineOption &&
                              styles.chipActive,
                          ]}
                          onPress={() =>
                            setFormData({
                              ...formData,
                              timeline: timelineOption,
                            })
                          }
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              formData.timeline === timelineOption &&
                                styles.chipTextActive,
                            ]}
                          >
                            {getTimelineLabel(timelineOption)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </View>
            )}

            {/* Step 3: Skills & Review */}
            {step === 3 && (
              <View style={styles.stepContent}>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Required Skills</Text>
                  <View style={styles.skillInputContainer}>
                    <TextInput
                      style={styles.skillInput}
                      placeholder="Add a skill..."
                      placeholderTextColor={theme.inputPlaceholder}
                      value={skillInput}
                      onChangeText={setSkillInput}
                      onSubmitEditing={() => addSkill(skillInput)}
                      returnKeyType="done"
                    />
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={() => addSkill(skillInput)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.addButtonText}>Add</Text>
                    </TouchableOpacity>
                  </View>

                  {formData.required_skills.length > 0 && (
                    <View style={styles.selectedSkills}>
                      {formData.required_skills.map((skill) => (
                        <View key={skill} style={styles.skillTag}>
                          <Text style={styles.skillTagText}>{skill}</Text>
                          <TouchableOpacity onPress={() => removeSkill(skill)}>
                            <X size={14} color={theme.textSecondary} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.suggestionsContainer}>
                    <Text style={styles.suggestionsLabel}>Suggestions:</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    >
                      <View style={styles.chipContainer}>
                        {skillSuggestions
                          .filter((s) => !formData.required_skills.includes(s))
                          .slice(0, 8)
                          .map((skill) => (
                            <TouchableOpacity
                              key={skill}
                              style={styles.suggestionChip}
                              onPress={() => addSkill(skill)}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.suggestionChipText}>
                                + {skill}
                              </Text>
                            </TouchableOpacity>
                          ))}
                      </View>
                    </ScrollView>
                  </View>
                </View>

                {/* Review Summary */}
                <View style={styles.reviewCard}>
                  <Text style={styles.reviewTitle}>Review Your Project</Text>
                  <View style={styles.reviewContent}>
                    <View style={styles.reviewItem}>
                      <Text style={styles.reviewLabel}>Title:</Text>
                      <Text style={styles.reviewValue}>{formData.title}</Text>
                    </View>
                    <View style={styles.reviewItem}>
                      <Text style={styles.reviewLabel}>Category:</Text>
                      <Text style={styles.reviewValue}>
                        {categories.find((c) => c.id === formData.category_id)
                          ?.name || "Not selected"}
                      </Text>
                    </View>
                    <View style={styles.reviewItem}>
                      <Text style={styles.reviewLabel}>Budget:</Text>
                      <Text style={styles.reviewValue}>
                        ${formData.budget_min} - ${formData.budget_max} (
                        {formData.budget_type})
                      </Text>
                    </View>
                    <View style={styles.reviewItem}>
                      <Text style={styles.reviewLabel}>Timeline:</Text>
                      <Text style={styles.reviewValue}>
                        {getTimelineLabel(formData.timeline) || "Not specified"}
                      </Text>
                    </View>
                    <View style={styles.reviewItem}>
                      <Text style={styles.reviewLabel}>Skills:</Text>
                      <Text style={styles.reviewValue}>
                        {formData.required_skills.length > 0
                          ? formData.required_skills.join(", ")
                          : "None specified"}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Navigation Buttons */}
            <View style={styles.navigation}>
              <TouchableOpacity
                style={[
                  styles.navButton,
                  styles.prevButton,
                  step === 1 && styles.navButtonDisabled,
                ]}
                onPress={() => setStep(step - 1)}
                disabled={step === 1}
                activeOpacity={0.7}
              >
                <ArrowLeft
                  size={18}
                  color={step === 1 ? theme.textMuted : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.navButtonText,
                    step === 1 && styles.navButtonTextDisabled,
                  ]}
                >
                  Previous
                </Text>
              </TouchableOpacity>

              {step < 3 ? (
                <TouchableOpacity
                  style={[
                    styles.navButton,
                    styles.nextButton,
                    !canProceed() && styles.nextButtonDisabled,
                  ]}
                  onPress={() => setStep(step + 1)}
                  disabled={!canProceed()}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.nextButtonText,
                      !canProceed() && styles.nextButtonTextDisabled,
                    ]}
                  >
                    Next Step
                  </Text>
                  <ArrowRight
                    size={18}
                    color={!canProceed() ? theme.textMuted : "#FFFFFF"}
                  />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.navButton,
                    styles.submitButton,
                    isSubmitting && styles.submitButtonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.submitButtonText,
                      isSubmitting && styles.submitButtonTextDisabled,
                    ]}
                  >
                    {isSubmitting ? "Posting Project..." : "Post Project"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
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
    },
    scrollView: {
      flex: 1,
    },
    content: {
      maxWidth: 800,
      width: "100%",
      alignSelf: "center",
      padding: 16,
    },

    // Back Button
    backButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 24,
      marginTop: 24,
    },
    backText: {
      color: theme.textSecondary,
      fontSize: 15,
      fontWeight: "500",
    },

    // Progress Indicator
    progressContainer: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 32,
    },
    progressStep: {
      flexDirection: "row",
      alignItems: "center",
    },
    progressCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
    },
    progressCircleActive: {
      backgroundColor: theme.primary,
    },
    progressCircleComplete: {
      backgroundColor: theme.success,
    },
    progressNumber: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.textMuted,
    },
    progressNumberActive: {
      color: "#FFFFFF",
    },
    progressLine: {
      width: 60,
      height: 3,
      backgroundColor: theme.border,
      marginHorizontal: 8,
    },
    progressLineActive: {
      backgroundColor: theme.success,
    },

    // Card
    card: {
      backgroundColor: theme.surface,
      borderRadius: 24,
      padding: 24,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 32,
      gap: 16,
    },
    headerIcon: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: theme.iconBg,
      alignItems: "center",
      justifyContent: "center",
    },
    headerText: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "800",
      color: theme.text,
      marginBottom: 4,
    },
    headerSubtitle: {
      color: theme.textSecondary,
      fontSize: 15,
    },

    // Step Content
    stepContent: {
      gap: 24,
    },
    formGroup: {
      gap: 8,
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 4,
    },
    input: {
      backgroundColor: theme.inputBg,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 15,
      color: theme.text,
    },
    textArea: {
      minHeight: 120,
      paddingTop: 14,
    },
    hint: {
      fontSize: 13,
      color: theme.textMuted,
      marginTop: 4,
    },

    // Chips
    chipContainer: {
      flexDirection: "row",
      gap: 8,
    },
    chip: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: theme.inputBg,
      borderWidth: 1,
      borderColor: theme.inputBorder,
    },
    chipActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    chipText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.textSecondary,
    },
    chipTextActive: {
      color: "#FFFFFF",
    },

    // Budget Type
    budgetTypeContainer: {
      flexDirection: "row",
      gap: 12,
    },
    budgetTypeButton: {
      flex: 1,
      padding: 16,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    budgetTypeButtonActive: {
      borderColor: theme.primary,
      backgroundColor: theme.iconBg,
    },
    budgetTypeText: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 4,
    },
    budgetTypeTextActive: {
      color: theme.primary,
    },
    budgetTypeHint: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    budgetTypeHintActive: {
      color: theme.primary,
    },

    // Budget Inputs
    budgetInputs: {
      flexDirection: "row",
      gap: 12,
    },
    budgetInputGroup: {
      flex: 1,
      gap: 8,
    },
    inputWithIcon: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.inputBg,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 12,
      overflow: "hidden",
    },
    inputIcon: {
      paddingHorizontal: 16,
      fontSize: 16,
      fontWeight: "600",
      color: theme.textSecondary,
    },
    inputWithIconField: {
      flex: 1,
      paddingVertical: 14,
      fontSize: 15,
      color: theme.text,
    },

    // Skills
    skillInputContainer: {
      flexDirection: "row",
      gap: 8,
    },
    skillInput: {
      flex: 1,
      backgroundColor: theme.inputBg,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 15,
      color: theme.text,
    },
    addButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderRadius: 12,
      justifyContent: "center",
    },
    addButtonText: {
      color: "#FFFFFF",
      fontWeight: "700",
      fontSize: 15,
    },
    selectedSkills: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 12,
    },
    skillTag: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: theme.iconBg,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
    },
    skillTagText: {
      color: theme.primary,
      fontWeight: "600",
      fontSize: 14,
    },
    suggestionsContainer: {
      marginTop: 16,
    },
    suggestionsLabel: {
      fontSize: 13,
      color: theme.textSecondary,
      marginBottom: 8,
    },
    suggestionChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    suggestionChipText: {
      fontSize: 14,
      color: theme.text,
      fontWeight: "500",
    },

    // Review Card
    reviewCard: {
      backgroundColor: theme.background,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    reviewTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 16,
    },
    reviewContent: {
      gap: 12,
    },
    reviewItem: {
      flexDirection: "row",
      gap: 8,
    },
    reviewLabel: {
      fontSize: 14,
      color: theme.textSecondary,
      fontWeight: "500",
      minWidth: 80,
    },
    reviewValue: {
      flex: 1,
      fontSize: 14,
      color: theme.text,
      fontWeight: "600",
    },

    // Navigation
    navigation: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 32,
      gap: 12,
    },
    navButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderRadius: 12,
    },
    prevButton: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    navButtonDisabled: {
      opacity: 0.5,
    },
    navButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.text,
    },
    navButtonTextDisabled: {
      color: theme.textMuted,
    },
    nextButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    nextButtonDisabled: {
      backgroundColor: theme.buttonPrimaryDisabled,
    },
    nextButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: "#FFFFFF",
    },
    nextButtonTextDisabled: {
      color: theme.textMuted,
    },
    nextButtonIcon: {
      color: "#FFFFFF",
    },
    submitButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    submitButtonDisabled: {
      backgroundColor: theme.buttonPrimaryDisabled,
    },
    submitButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: "#FFFFFF",
    },
    submitButtonTextDisabled: {
      color: theme.textMuted,
    },
  });
