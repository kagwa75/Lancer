import { router } from "expo-router";
import {
    ArrowRight,
    DollarSign,
    FileText,
    Search,
    Star,
    TrendingUp,
} from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";





export default function FreelancerDashboard() {
  /*const { user } = useAuth();*/

  const [proposals, setProposals] = useState([]);
  const [profileCompleteness, setProfileCompleteness] = useState(0);
  const [stats, setStats] = useState({
    totalProposals: 0,
    acceptedProposals: 0,
    pendingProposals: 0,
  });
  const [loading, setLoading] = useState(false);

  /*useEffect(() => {
    if (user) fetchDashboardData();
  }, [user]);

 /* const fetchDashboardData = async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from("freelancer_profiles")
      .select("title, hourly_rate, skills")
      .eq("user_id", user.id)
      .single();

    if (profile) {
      let completeness = 25;
      if (profile.title) completeness += 25;
      if (profile.hourly_rate) completeness += 25;
      if (profile.skills?.length) completeness += 25;
      setProfileCompleteness(completeness);
    }

    const { data } = await supabase
      .from("proposals")
      .select(`
        id,
        bid_amount,
        status,
        created_at,
        project:projects(id, title)
      `)
      .eq("freelancer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (data) {
      const normalized = data.map((p) => ({
        ...p,
        project: Array.isArray(p.project) ? p.project[0] : p.project,
      }));

      setProposals(normalized);
      setStats({
        totalProposals: normalized.length,
        acceptedProposals: normalized.filter(p => p.status === "accepted").length,
        pendingProposals: normalized.filter(p => p.status === "pending").length,
      });
    }

    setLoading(false);
  };*/

  const statusStyle = (status) => {
    switch (status) {
      case "accepted":
        return styles.accepted;
      case "pending":
        return styles.pending;
      case "rejected":
        return styles.rejected;
      default:
        return styles.muted;
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Freelancer Dashboard</Text>
          <Text style={styles.subtitle}>Find work and grow your career</Text>
        </View>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => router.push("/find-work")}
        >
          <Search size={16} />
          <Text style={styles.btnText}>Find Projects</Text>
        </Pressable>
      </View>

      {/* Profile Completeness */}
      {profileCompleteness < 100 && (
        <View style={styles.cardHighlight}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Complete Your Profile</Text>
            <Text>{profileCompleteness}%</Text>
          </View>

          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${profileCompleteness}%` },
              ]}
            />
          </View>

          <Text style={styles.mutedText}>
            A complete profile helps you win more projects.
          </Text>

          <Pressable
            style={styles.outlineBtn}
            onPress={() => router.push("/profile")}
          >
            <Text>Complete Profile</Text>
          </Pressable>
        </View>
      )}

      {/* Stats */}
      <View style={styles.statsGrid}>
        <StatCard title="Proposals Sent" value={stats.totalProposals} icon={<FileText size={16} />} />
        <StatCard title="Accepted" value={stats.acceptedProposals} icon={<TrendingUp size={16} />} />
        <StatCard title="Earnings" value="$0" icon={<DollarSign size={16} />} />
        <StatCard title="Rating" value="-" icon={<Star size={16} />} />
      </View>

      {/* Recent Proposals */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.cardTitle}>Recent Proposals</Text>
            <Text style={styles.mutedText}>Track your submissions</Text>
          </View>
          <Pressable onPress={() => router.push("/my-proposals")}>
            <ArrowRight size={18} />
          </Pressable>
        </View>

        {proposals.length === 0 ? (
          <Text style={styles.mutedText}>No proposals yet</Text>
        ) : (
          proposals.map(p => (
            <Pressable
              key={p.id}
              style={styles.proposalItem}
              onPress={() => router.push(`/projects/${p.project.id}`)}
            >
              <View>
                <Text style={styles.bold}>{p.project.title}</Text>
                <Text style={styles.mutedText}>
                  Bid: ${p.bid_amount} • {new Date(p.created_at).toDateString()}
                </Text>
              </View>
              <Text style={[styles.badge, statusStyle(p.status)]}>
                {p.status}
              </Text>
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}

/* ---------- Small Components ---------- */

function StatCard({ title, value, icon }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.mutedText}>{title}</Text>
        {icon}
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#666" },

  primaryBtn: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#ddd",
    padding: 10,
    borderRadius: 8,
  },
  btnText: { fontWeight: "600" },

  card: { backgroundColor: "#fff", padding: 16, borderRadius: 12 },
  cardHighlight: { backgroundColor: "#eef5ff", padding: 16, borderRadius: 12 },
  cardTitle: { fontSize: 16, fontWeight: "600" },

  mutedText: { color: "#777", marginTop: 4 },
  bold: { fontWeight: "600" },

  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  progressBar: {
    height: 6,
    backgroundColor: "#ddd",
    borderRadius: 4,
    marginVertical: 10,
  },
  progressFill: { height: "100%", backgroundColor: "#3b82f6", borderRadius: 4 },

  outlineBtn: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    alignItems: "center",
  },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: {
    width: "48%",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 12,
  },
  statValue: { fontSize: 22, fontWeight: "700", marginTop: 6 },

  proposalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  accepted: { backgroundColor: "#dcfce7", color: "#166534" },
  pending: { backgroundColor: "#fef3c7", color: "#92400e" },
  rejected: { backgroundColor: "#fee2e2", color: "#991b1b" },
  muted: { backgroundColor: "#eee", color: "#555" },
});
