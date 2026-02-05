import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/client";
import { router } from "expo-router";
import {
  ArrowRight,
  Clock,
  DollarSign,
  FolderOpen,
  PlusCircle,
  Users,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";


export default function ClientDashboard() {
  const { user } = useAuth();

  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState({
    totalProjects: 0,
    activeProjects: 0,
    totalProposals: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    const { data: projectsData } = await supabase
      .from("projects")
      .select("*")
      .eq("client_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (projectsData) {
      const withCounts = await Promise.all(
        projectsData.map(async (project) => {
          const { count } = await supabase
            .from("bids")
            .select("*", { count: "exact", head: true })
            .eq("project_id", project.id);

          return { ...project, proposals_count: count || 0 };
        })
      );

      setProjects(withCounts);//projects wit proposals

      const totalProposals = withCounts.reduce(
        (sum, p) => sum + (p.proposals_count || 0),
        0
      );

      setStats({
        totalProjects: withCounts.length,
        activeProjects: withCounts.filter(
          (p) => p.status === "open" || p.status === "in_progress"
        ).length,
        totalProposals,
      });
    }

    setLoading(false);
  };

  const statusClasses = (status) => {
    switch (status) {
      case "open":
        return "bg-green-100 text-green-700";
      case "in_progress":
        return "bg-blue-100 text-blue-700";
      case "completed":
        return "bg-gray-200 text-gray-700";
      case "cancelled":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background px-4 pt-6">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-6">
        <View>
          <Text className="text-2xl font-bold text-foreground">
            Client Dashboard
          </Text>
          <Text className="text-muted-foreground">
            Manage your projects and find talent
          </Text>
        </View>

        <Pressable
          onPress={() => router.push("/projects/new")}
          className="flex-row items-center gap-2 bg-primary px-4 py-2 rounded-lg"
        >
          <PlusCircle size={16} />
          <Text className="font-semibold text-primary-foreground">
            Post Project
          </Text>
        </Pressable>
      </View>

      {/* Stats */}
      <View className="flex-row flex-wrap gap-3 mb-6">
        <StatCard
          title="Total Projects"
          value={stats.totalProjects}
          subtitle={`${stats.activeProjects} active`}
          icon={<FolderOpen size={16} />}
        />
        <StatCard
          title="Proposals"
          value={stats.totalProposals}
          subtitle="From freelancers"
          icon={<Users size={16} />}
        />
        <StatCard
          title="Active Budget"
          value="$0"
          subtitle="In escrow"
          icon={<DollarSign size={16} />}
        />
      </View>

      {/* Recent Projects */}
      <View className="bg-card rounded-xl p-4">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-lg font-semibold">Recent Projects</Text>
            <Text className="text-muted-foreground">
              Your latest project postings
            </Text>
          </View>

          <Pressable onPress={() => router.push("/projects")}>
            <ArrowRight size={18} />
          </Pressable>
        </View>

        {projects.length === 0 ? (
          <View className="items-center py-10">
            <FolderOpen size={40} className="text-muted-foreground mb-3" />
            <Text className="font-medium mb-1">No projects yet</Text>
            <Text className="text-muted-foreground text-center mb-4">
              Post your first project to receive proposals.
            </Text>
            <Pressable
              onPress={() => router.push("/projects/new")}
              className="bg-primary px-4 py-2 rounded-lg"
            >
              <Text className="font-semibold text-primary-foreground">
                Post Your First Project
              </Text>
            </Pressable>
          </View>
        ) : (
          <View className="gap-3">
            {projects.map((project) => (
              <Pressable
                key={project.id}
                onPress={() => router.push(`/projects/${project.id}`)}
                className="border border-border rounded-lg p-4 flex-row justify-between"
              >
                <View className="gap-1 flex-1">
                  <Text className="font-semibold">
                    {project.title}
                  </Text>

                  <Text className="text-sm text-muted-foreground">
                    ${project.budget_min?.toLocaleString()} – $
                    {project.budget_max?.toLocaleString()}
                  </Text>

                  <View className="flex-row items-center gap-1">
                    <Clock size={12} />
                    <Text className="text-xs text-muted-foreground">
                      {new Date(project.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </View>

                <View className="items-end gap-1">
                  <Text className="text-sm font-medium">
                    {project.proposals_count} proposals
                  </Text>
                  <Text
                    className={`text-xs px-2 py-1 rounded-full ${statusClasses(
                      project.status
                    )}`}
                  >
                    {project.status.replace("_", " ")}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

/* ------------------ Small Components ------------------ */

function StatCard({
  title,
  value,
  subtitle,
  icon,
}) {
  return (
    <View className="w-[48%] bg-card rounded-xl p-4">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-sm text-muted-foreground">{title}</Text>
        {icon}
      </View>
      <Text className="text-2xl font-bold">{value}</Text>
      <Text className="text-xs text-muted-foreground">{subtitle}</Text>
    </View>
  );
}
