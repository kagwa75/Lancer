import { router } from "expo-router";
import {
  ArrowRight,
  Award,
  BarChart,
  Brain,
  Briefcase,
  Clock,
  FileText,
  Globe,
  Megaphone,
  Palette,
  Shield,
  Smartphone,
  Star,
  TrendingUp,
  Users,
  Video,
} from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import "../../global.css";

const categories = [
  { name: "Web Development", icon: Globe, count: "2,340", bgColor: "#EFF6FF", iconColor: "#2563EB" },
  { name: "Mobile Development", icon: Smartphone, count: "1,120", bgColor: "#F5F3FF", iconColor: "#9333EA" },
  { name: "Design & Creative", icon: Palette, count: "1,890", bgColor: "#FDF2F8", iconColor: "#EC4899" },
  { name: "Writing & Content", icon: FileText, count: "980", bgColor: "#FEF3C7", iconColor: "#F59E0B" },
  { name: "Marketing", icon: Megaphone, count: "750", bgColor: "#DCFCE7", iconColor: "#16A34A" },
  { name: "Video & Animation", icon: Video, count: "620", bgColor: "#FEE2E2", iconColor: "#DC2626" },
  { name: "Data & Analytics", icon: BarChart, count: "430", bgColor: "#E0E7FF", iconColor: "#4F46E5" },
  { name: "AI & Machine Learning", icon: Brain, count: "310", bgColor: "#CFFAFE", iconColor: "#0891B2" },
];

const features = [
  {
    icon: Users,
    title: "Top Talent",
    description: "Access a global network of skilled freelancers ready to bring your projects to life.",
    stat: "50K+",
    statLabel: "Freelancers",
  },
  {
    icon: Shield,
    title: "Secure Payments",
    description: "Your money is safe with our escrow system. Pay only when you're satisfied.",
    stat: "100%",
    statLabel: "Protected",
  },
  {
    icon: Star,
    title: "Quality Work",
    description: "Our rating system ensures you work with the best. Check reviews before hiring.",
    stat: "4.9/5",
    statLabel: "Avg Rating",
  },
];

const stats = [
  { icon: TrendingUp, value: "10M+", label: "Projects Completed" },
  { icon: Clock, value: "24/7", label: "Support Available" },
  { icon: Award, value: "99%", label: "Client Satisfaction" },
];

export default function Welcome() {
  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.push("/")}
          style={styles.logoContainer}
        >
          <View style={styles.logoIcon}>
            <Briefcase size={20} color="#FFFFFF" />
          </View>
          <Text style={styles.logoText}>FreelanceHub</Text>
        </Pressable>

        <View style={styles.headerButtons}>
          <Pressable onPress={() => router.push("/login")}>
            <Text style={styles.signInText}>Sign In</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/login")}
            style={styles.getStartedButton}
          >
            <Text style={styles.getStartedText}>Get Started</Text>
          </Pressable>
        </View>
      </View>

      {/* Hero Section */}
      <View style={styles.hero}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            🚀 Trusted by 10M+ professionals worldwide
          </Text>
        </View>

        <Text style={styles.heroTitle}>
          Find the perfect{"\n"}
          <Text style={styles.heroTitleAccent}>freelancer</Text> for{"\n"}
          your project
        </Text>

        <Text style={styles.heroDescription}>
          Connect with top talent worldwide. Post your project, receive
          competitive proposals, and hire the best freelancers to bring your
          vision to life.
        </Text>

        <View style={styles.heroCTAs}>
          <Pressable
             onPress={() => router.push("/login")}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Find Freelancers</Text>
            <ArrowRight size={20} color="#FFFFFF" />
          </Pressable>

          <Pressable
            onPress={() => router.push("/login")}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Start Freelancing</Text>
          </Pressable>
        </View>

        {/* Stats Bar */}
        <View style={styles.statsBar}>
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <View key={stat.label} style={styles.statItem}>
                <View style={styles.statTop}>
                  <Icon size={18} color="#2563EB" />
                  <Text style={styles.statValue}>{stat.value}</Text>
                </View>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Categories */}
      <View style={styles.categoriesSection}>
        <Text style={styles.sectionTitle}>Browse by Category</Text>
        <Text style={styles.sectionSubtitle}>
          Explore thousands of skilled professionals in every field
        </Text>

        <View style={styles.categoriesGrid}>
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <Pressable
                key={category.name}
                 onPress={() => router.push("/login")}
                style={styles.categoryCard}
              >
                <View
                  style={[
                    styles.categoryIcon,
                    { backgroundColor: category.bgColor },
                  ]}
                >
                  <Icon size={28} color={category.iconColor} />
                </View>
                <Text style={styles.categoryName}>{category.name}</Text>
                <Text style={styles.categoryCount}>{category.count} experts</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Features */}
      <View style={styles.featuresSection}>
        <Text style={styles.sectionTitle}>Why Choose FreelanceHub?</Text>
        <Text style={styles.sectionSubtitle}>
          Everything you need to succeed in one platform
        </Text>

        <View style={styles.featuresList}>
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <View key={feature.title} style={styles.featureCard}>
                <View style={styles.featureIcon}>
                  <Icon size={32} color="#2563EB" />
                </View>

                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDescription}>
                    {feature.description}
                  </Text>
                  <View style={styles.featureStat}>
                    <Text style={styles.featureStatValue}>
                      {feature.stat}{" "}
                      <Text style={styles.featureStatLabel}>
                        {feature.statLabel}
                      </Text>
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* CTA Section */}
      <View style={styles.ctaSection}>
        <View style={styles.ctaBadge}>
          <Text style={styles.ctaBadgeText}>✨ Join our growing community</Text>
        </View>

        <Text style={styles.ctaTitle}>Ready to get started?</Text>
        <Text style={styles.ctaDescription}>
          Join thousands of businesses and freelancers who trust FreelanceHub to
          make work happen.
        </Text>

        <View style={styles.ctaButtons}>
          <Pressable
           onPress={() => router.push("/login")}
            style={styles.ctaPrimaryButton}
          >
            <Text style={styles.ctaPrimaryButtonText}>Post a Project</Text>
          </Pressable>

          <Pressable
         onPress={() => router.push("/login")}
            style={styles.ctaSecondaryButton}
          >
            <Text style={styles.ctaSecondaryButtonText}>Find Work</Text>
          </Pressable>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerLogo}>
          <View style={styles.footerLogoIcon}>
            <Briefcase size={20} color="#FFFFFF" />
          </View>
          <Text style={styles.footerLogoText}>FreelanceHub</Text>
        </View>

        <Text style={styles.footerTagline}>Connecting talent with opportunity</Text>
        <Text style={styles.footerCopyright}>
          © {new Date().getFullYear()} FreelanceHub. All rights reserved.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  
  // Header
  header: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  headerButtons: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  signInText: {
    color: "#6B7280",
    fontWeight: "600",
    fontSize: 16,
  },
  getStartedButton: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  getStartedText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  
  // Hero
  hero: {
    paddingHorizontal: 24,
    paddingVertical: 64,
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  badge: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    marginBottom: 24,
  },
  badgeText: {
    color: "#1E40AF",
    fontWeight: "600",
    fontSize: 14,
  },
  heroTitle: {
    fontSize: 48,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 56,
    color: "#111827",
    marginBottom: 24,
  },
  heroTitleAccent: {
    color: "#2563EB",
  },
  heroDescription: {
    color: "#6B7280",
    textAlign: "center",
    fontSize: 18,
    lineHeight: 28,
    marginBottom: 40,
    maxWidth: 600,
  },
  heroCTAs: {
    gap: 16,
    width: "100%",
    maxWidth: 400,
  },
  primaryButton: {
    backgroundColor: "#2563EB",
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 18,
  },
  secondaryButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontWeight: "700",
    fontSize: 18,
    color: "#111827",
  },
  statsBar: {
    flexDirection: "row",
    gap: 32,
    marginTop: 64,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  statItem: {
    alignItems: "center",
  },
  statTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  statLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  
  // Categories
  categoriesSection: {
    paddingHorizontal: 16,
    paddingVertical: 80,
    backgroundColor: "#F9FAFB",
  },
  sectionTitle: {
    fontSize: 36,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
    color: "#111827",
  },
  sectionSubtitle: {
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 48,
    fontSize: 18,
  },
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  categoryCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  categoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  categoryName: {
    fontWeight: "700",
    fontSize: 16,
    color: "#111827",
    marginBottom: 4,
  },
  categoryCount: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  
  // Features
  featuresSection: {
    paddingHorizontal: 24,
    paddingVertical: 80,
    backgroundColor: "#FFFFFF",
  },
  featuresList: {
    gap: 24,
  },
  featureCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    flexDirection: "row",
    gap: 16,
  },
  featureIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    color: "#111827",
  },
  featureDescription: {
    color: "#6B7280",
    lineHeight: 24,
    marginBottom: 12,
  },
  featureStat: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  featureStatValue: {
    color: "#1E40AF",
    fontWeight: "700",
    fontSize: 16,
  },
  featureStatLabel: {
    fontWeight: "400",
    fontSize: 14,
  },
  
  // CTA
  ctaSection: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 24,
    paddingVertical: 80,
    alignItems: "center",
  },
  ctaBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    marginBottom: 24,
  },
  ctaBadgeText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  ctaTitle: {
    fontSize: 36,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 16,
    textAlign: "center",
    lineHeight: 44,
  },
  ctaDescription: {
    color: "rgba(255, 255, 255, 0.9)",
    textAlign: "center",
    marginBottom: 40,
    fontSize: 18,
    lineHeight: 28,
    maxWidth: 500,
  },
  ctaButtons: {
    gap: 16,
    width: "100%",
    maxWidth: 400,
  },
  ctaPrimaryButton: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  ctaPrimaryButtonText: {
    fontWeight: "700",
    fontSize: 18,
    color: "#2563EB",
  },
  ctaSecondaryButton: {
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  ctaSecondaryButtonText: {
    fontWeight: "700",
    fontSize: 18,
    color: "#FFFFFF",
  },
  
  // Footer
  footer: {
    backgroundColor: "#111827",
    paddingHorizontal: 24,
    paddingVertical: 48,
    alignItems: "center",
  },
  footerLogo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  footerLogoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  footerLogoText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  footerTagline: {
    fontSize: 14,
    color: "#9CA3AF",
    marginBottom: 24,
  },
  footerCopyright: {
    fontSize: 12,
    color: "#6B7280",
  },
});