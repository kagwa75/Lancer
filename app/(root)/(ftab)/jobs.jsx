import { useTheme } from "@/hooks/ThemeContext";
import { useAuth } from "@/hooks/useAuth";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import {
  ChevronRight,
  Clock,
  DollarSign,
  MapPin,
  Search,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../../lib/Client";
import { FetchCategories } from "../../../lib/supabase";

export default function FindWork() {
  const { theme, isDark } = useTheme();
  const { user, userRole, loading: authLoading } = useAuth();
  const navigation = useNavigation();
  const router = useRouter();
  const isFocused = useIsFocused();

  const [projects, setProjects] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/(auth)/login");
    } else if (!authLoading && userRole && userRole !== "freelancer") {
      router.push("/(tab)/home");
    }
  }, [user, userRole, authLoading, router]);

  useEffect(() => {
    if (isFocused) {
      fetchData();
    }
  }, [isFocused]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch categories
      const { data: categoriesData } = await FetchCategories();
      if (categoriesData) setCategories(categoriesData);

      // Fetch open projects
      const { data: projectsData } = await supabase
        .from("projects")
        .select(
          `
          *,
          category:project_categories(name),
          client_profile:client_profiles!projects_client_id_fkey(*)
        `,
        )
        .eq("status", "open")
        .order("created_at", { ascending: false });

      if (projectsData) {
        console.log("projects", projectsData);
        const transformedProjects = projectsData.map((p) => ({
          ...p,
          category: Array.isArray(p.category) ? p.category[0] : p.category,
          client_profile: Array.isArray(p.client_profile)
            ? p.client_profile[0]
            : p.client_profile,
        }));
        setProjects(transformedProjects);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.required_skills.some((skill) =>
        skill.toLowerCase().includes(searchTerm.toLowerCase()),
      );

    const matchesCategory =
      selectedCategory === "all" || project.category?.name === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const formatTimeAgo = (date) => {
    const now = new Date();
    const created = new Date(date);
    const diffMs = now.getTime() - created.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return "Just now";
  };

  const formatBudget = (min, max) => {
    return `${min?.toLocaleString()} - ${max?.toLocaleString()}`;
  };

  const styles = createStyles(theme);

  if (authLoading || userRole !== "freelancer") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Find Work</Text>
          <Text style={styles.subtitle}>
            Browse and apply to projects that match your skills
          </Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Search
              size={20}
              color={theme.textMuted}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search projects or skills..."
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholderTextColor={theme.textMuted}
            />
          </View>
        </View>

        {/* Category Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryContainer}
        >
          <TouchableOpacity
            style={[
              styles.categoryChip,
              selectedCategory === "all" && styles.categoryChipSelected,
            ]}
            onPress={() => setSelectedCategory("all")}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === "all" && styles.categoryChipTextSelected,
              ]}
            >
              All Categories
            </Text>
          </TouchableOpacity>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryChip,
                selectedCategory === category.name &&
                  styles.categoryChipSelected,
              ]}
              onPress={() => setSelectedCategory(category.name)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory === category.name &&
                    styles.categoryChipTextSelected,
                ]}
              >
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Projects List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.projectSkeleton} />
            ))}
          </View>
        ) : filteredProjects.length === 0 ? (
          <View style={styles.emptyState}>
            <Search size={48} color={theme.border} />
            <Text style={styles.emptyStateTitle}>No projects found</Text>
            <Text style={styles.emptyStateText}>
              {searchTerm || selectedCategory !== "all"
                ? "Try adjusting your search or filters"
                : "Check back later for new opportunities"}
            </Text>
          </View>
        ) : (
          <View style={styles.projectsList}>
            {filteredProjects.map((project) => (
              <TouchableOpacity
                key={project.id}
                style={styles.projectCard}
                onPress={() =>
                  router.push({
                    pathname: "/(description)/[id]",
                    params: { id: project.id },
                  })
                }
              >
                <View style={styles.projectHeader}>
                  <View style={styles.projectTitleContainer}>
                    <Text style={styles.projectTitle}>{project.title}</Text>
                    <View style={styles.projectMeta}>
                      <View style={styles.metaItem}>
                        <Clock size={14} color={theme.textSecondary} />
                        <Text style={styles.metaText}>
                          {formatTimeAgo(project.created_at)}
                        </Text>
                      </View>
                      {project.client_profile?.location && (
                        <View style={styles.metaItem}>
                          <MapPin size={14} color={theme.textSecondary} />
                          <Text style={styles.metaText}>
                            {project.client_profile.location}
                          </Text>
                        </View>
                      )}
                      {project.category && (
                        <View style={styles.categoryBadge}>
                          <Text style={styles.categoryBadgeText}>
                            {project.category.name}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.budgetContainer}>
                    <View style={styles.budgetAmount}>
                      <DollarSign size={16} color={theme.success} />
                      <Text style={styles.budgetText}>
                        {formatBudget(project.budget_min, project.budget_max)}
                      </Text>
                    </View>
                    <Text style={styles.budgetType}>
                      {project.budget_type === "fixed"
                        ? "Fixed Price"
                        : "Hourly"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.projectDescription} numberOfLines={2}>
                  {project.description}
                </Text>

                <View style={styles.skillsContainer}>
                  {project.required_skills.slice(0, 4).map((skill) => (
                    <View key={skill} style={styles.skillBadge}>
                      <Text style={styles.skillText}>{skill}</Text>
                    </View>
                  ))}
                  {project.required_skills.length > 4 && (
                    <View style={styles.skillBadge}>
                      <Text style={styles.skillText}>
                        +{project.required_skills.length - 4}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.clientName}>
                    {project.client_profile?.company_name || "Anonymous Client"}
                  </Text>
                  <ChevronRight size={20} color={theme.textSecondary} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
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
      padding: 16,
      paddingTop: 45,
    },
    header: {
      marginBottom: 24,
    },
    title: {
      fontSize: 28,
      fontWeight: "bold",
      color: theme.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 16,
      color: theme.textSecondary,
    },
    searchContainer: {
      marginBottom: 16,
    },
    searchInputContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    searchIcon: {
      marginRight: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: theme.text,
    },
    categoryContainer: {
      marginBottom: 24,
    },
    categoryChip: {
      backgroundColor: theme.surface,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      marginRight: 8,
    },
    categoryChipSelected: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    categoryChipText: {
      color: theme.textSecondary,
      fontSize: 14,
      fontWeight: "500",
    },
    categoryChipTextSelected: {
      color: theme.surface,
    },
    loadingContainer: {
      gap: 16,
    },
    projectSkeleton: {
      height: 180,
      backgroundColor: theme.border,
      borderRadius: 12,
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 48,
    },
    emptyStateTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.text,
      marginTop: 16,
      marginBottom: 8,
    },
    emptyStateText: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: "center",
      paddingHorizontal: 32,
    },
    projectsList: {
      gap: 16,
    },
    projectCard: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 3,
    },
    projectHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    projectTitleContainer: {
      flex: 1,
      marginRight: 12,
    },
    projectTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 8,
    },
    projectMeta: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 12,
    },
    metaItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    metaText: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    categoryBadge: {
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    categoryBadgeText: {
      fontSize: 12,
      color: theme.text,
      fontWeight: "500",
    },
    budgetContainer: {
      alignItems: "flex-end",
    },
    budgetAmount: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      marginBottom: 2,
    },
    budgetText: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.success,
    },
    budgetType: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    projectDescription: {
      fontSize: 14,
      color: theme.text,
      lineHeight: 20,
      marginBottom: 16,
    },
    skillsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 16,
    },
    skillBadge: {
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    skillText: {
      fontSize: 12,
      color: theme.text,
      fontWeight: "500",
    },
    cardFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
      paddingTop: 16,
    },
    clientName: {
      fontSize: 14,
      color: theme.textSecondary,
      fontWeight: "500",
    },
  });
