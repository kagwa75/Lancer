import { useTheme } from "@/hooks/ThemeContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Award,
  Briefcase,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  Send,
  Shield,
  User,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import PaymentMethodModal from "../../components/PaymentMethodModal";
import api from "../../lib/api";
import apiMpesa from "../../lib/apiMpesa";
import { supabase } from "../../lib/Client";
import {
  ClientDetails,
  ClientId,
  getFreelancerStripeAccount,
  PostNotifications,
} from "../../lib/supabase";

export default function ProjectDetails() {
  const { id } = useLocalSearchParams();
  const { user, userRole, loading: authLoading } = useAuth();
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const stripeImport =
    Platform.OS === "web"
      ? require("@/lib/stripe-mock")
      : require("@stripe/stripe-react-native");
  const { useStripe } = stripeImport;
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [project, setProject] = useState(null);
  const [clientProfile, setClientProfile] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [existingProposal, setExistingProposal] = useState(null);
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] =
    useState(false);
  const [transaction, setTransaction] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [commissionRate, setCommissionRate] = useState(10);

  const [proposalData, setProposalData] = useState({
    cover_letter: "",
    bid_amount: "",
    estimated_duration: "",
  });

  useEffect(() => {
    if (!authLoading && !user) router.push("/(auth)/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (id && userRole) {
      fetchProjectData();
      fetchCommissionRate();
    }
  }, [id, user, userRole]);

  useEffect(() => {
    const fetchClientProfile = async () => {
      if (user?.id && userRole === "client") {
        try {
          const { clientP } = await ClientDetails(user.id);
          setClientProfile(clientP);
        } catch (error) {
          console.error("Error fetching client profile:", error);
        }
      }
    };

    if (userRole) {
      fetchClientProfile();
    }
  }, [user?.id, userRole]);

  const fetchCommissionRate = async () => {
    const { data } = await supabase
      .from("platform_settings")
      .select("setting_value")
      .eq("setting_key", "commission_rate")
      .single();

    if (data) setCommissionRate(parseFloat(data.setting_value));
  };

  const fetchProjectData = async () => {
    if (!id || !userRole) return;

    try {
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select(
          `*, category:project_categories(name), client_profile:client_profiles!projects_client_id_fkey(user_id,company_name,company_website,phone_number, avatar_url)`,
        )
        .eq("id", id)
        .single();

      if (projectError) {
        console.error("Error fetching project:", projectError);
        setIsLoading(false);
        return;
      }

      if (projectData) {
        const processedProject = {
          ...projectData,
          category: Array.isArray(projectData.category)
            ? projectData.category[0]
            : projectData.category,
          client_profile: Array.isArray(projectData.client_profile)
            ? projectData.client_profile[0]
            : projectData.client_profile,
        };

        setProject(processedProject);

        if (user && userRole === "client") {
          const { clientProfile: currentClientProfile } = await ClientId(
            user.id,
          );

          if (projectData.client_id === currentClientProfile?.id) {
            const { data: proposalsData } = await supabase
              .from("bids")
              .select(
                `*,
                FreelancerProfile:profiles!bids_freelancer_id_fkey(
                  *,
                  freelancer_profile:freelancer_profiles!bids_user_id_fkey(
                    stripe_account_id,
                    title,
                    hourly_rate,
                    skills,
                    availability
                  )
                )`,
              )
              .eq("project_id", id)
              .order("created_at", { ascending: false });

            if (proposalsData) {
              const processedProposals = proposalsData.map((p) => ({
                ...p,
                freelancer_profile: Array.isArray(p.FreelancerProfile)
                  ? p.FreelancerProfile[0]
                  : p.FreelancerProfile,
              }));
              setProposals(processedProposals);
            }

            const { data: transactionData } = await supabase
              .from("transactions")
              .select("*")
              .eq("project_id", id)
              .in("status", ["pending", "held_in_escrow"])
              .single();

            if (transactionData) setTransaction(transactionData);
          }
        }

        if (user && userRole === "freelancer") {
          const { data: existingData } = await supabase
            .from("bids")
            .select("*")
            .eq("project_id", id)
            .eq("freelancer_id", user.id)
            .single();

          if (existingData) {
            setExistingProposal(existingData);
          }
        }
      }
    } catch (error) {
      console.error("Error in fetchProjectData:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitProposal = async () => {
    if (!user || !id || userRole !== "freelancer") return;

    setIsSubmitting(true);
    const { error } = await supabase.from("bids").insert({
      project_id: id,
      freelancer_id: user.id,
      cover_letter: proposalData.cover_letter,
      bid_amount: parseFloat(proposalData.bid_amount),
      estimated_duration: proposalData.estimated_duration,
    });
    setIsSubmitting(false);
    if (error) {
      toast({
        title: "Error",
        description: "Failed to submit proposal. Please try again.",
        variant: "destructive",
      });
    } else {
      if (project?.client_profile?.user_id) {
        await PostNotifications({
          senderid: user.id,
          receiveid: project.client_profile.user_id,
          title: "sent you a proposal",
          createdat: new Date().toISOString(),
          data: JSON.stringify({
            receiverid: project.client_profile.user_id,
            project_id: id,
            type: "proposal",
          }),
        });
      } else {
        console.warn("Skipping notification: missing client user id");
        toast({
          title: "Notification skipped",
          description: "Missing client user id for this project.",
        });
      }
      toast({
        title: "Proposal submitted!",
        description: "The client will review your proposal.",
      });
      setIsModalOpen(false);
      fetchProjectData();
    }
  };

  const handleAcceptProposal = (proposal) => {
    setSelectedProposal(proposal);
    setIsPaymentMethodModalOpen(true);
  };

  const handleSelectStripePayment = () => {
    setIsPaymentMethodModalOpen(false);
    setIsPaymentModalOpen(true);
  };

  const handleSelectMpesaPayment = () => {
    setIsPaymentMethodModalOpen(false);
    router.push({
      pathname: "/mpesa-payment",
      params: {
        projectId: id,
        bidId: selectedProposal?.id,
        clientId: user?.id,
        freelancerId: selectedProposal?.freelancer_id,
        amount: selectedProposal?.bid_amount.toString(),
        commissionRate: commissionRate.toString(),
      },
    });
  };

  const handleConfirmPayment = async () => {
    if (!selectedProposal || !id || !user) return;

    setIsSubmitting(true);

    try {
      const amount = Number(selectedProposal.bid_amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Invalid payment amount");
      }

      const response = await api.post("/stripe/Intent", {
        projectId: id,
        bidId: selectedProposal.id,
        clientId: user.id,
        freelancerId: selectedProposal.freelancer_id,
        amount: amount,
      });

      const { clientSecret, paymentIntentId } = response.data;

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: "FreelanceConnect",
        paymentIntentClientSecret: clientSecret,
        defaultBillingDetails: {
          name: user.email,
        },
        appearance: {
          colors: {
            primary: theme.primary,
          },
        },
        returnURL: "jobs://",
      });

      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        await supabase.from("transactions").delete().eq("id", transaction?.id);
        Alert.alert("Payment Cancelled", presentError.message);
        setIsSubmitting(false);
        setIsPaymentModalOpen(false);
        setSelectedProposal(null);
        return;
      }

      const confirmPaymentResponse = await fetch(
        "https://lancerstripe-production.up.railway.app/stripe/confirm-payment",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentIntentId: paymentIntentId }),
        },
      );

      if (!confirmPaymentResponse.ok) {
        throw new Error("Failed to confirm payment");
      }

      const confirmedData = await confirmPaymentResponse.json();
      const confirmedTransaction = confirmedData.transaction;

      await supabase
        .from("bids")
        .update({ status: "accepted" })
        .eq("id", selectedProposal.id);

      await supabase
        .from("projects")
        .update({ status: "in_progress" })
        .eq("id", id);

      await supabase
        .from("bids")
        .update({ status: "rejected" })
        .eq("project_id", id)
        .neq("id", selectedProposal.id);
      if (selectedProposal?.freelancer_id) {
        await PostNotifications({
          senderid: user.id,
          receiveid: selectedProposal.freelancer_id,
          title: "accepted your bid",
          createdat: new Date().toISOString(),
          data: JSON.stringify({
            receiverid: selectedProposal.freelancer_id,
            project_id: id,
            bidId: selectedProposal.id,
            type: "proposal_accepted",
          }),
        });
      } else {
        console.warn("Skipping notification: missing freelancer id");
        toast({
          title: "Notification skipped",
          description: "Missing freelancer id for this proposal.",
        });
      }

      setTransaction(confirmedTransaction);

      Alert.alert(
        "Payment Successful!",
        `$${confirmedTransaction?.amount?.toFixed(2)} is now held in escrow.\n\n` +
          `Platform Fee: $${confirmedTransaction?.platform_fee.toFixed(2)}\n` +
          `Freelancer receives: $${confirmedTransaction?.freelancer_amount?.toFixed(2)}\n\n` +
          `Funds will be released upon project completion.`,
        [{ text: "OK" }],
      );

      setIsPaymentModalOpen(false);
      setSelectedProposal(null);
      fetchProjectData();
    } catch (error) {
      console.error("Payment error:", error);
      Alert.alert(
        "Payment Failed",
        error.message || "Failed to process payment. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const releaseFunds = async () => {
    if (!transaction || !project) return;

    const acceptedProposal = proposals.find(
      (p) => p.id === transaction.bid_id && p.status === "accepted",
    );

    if (!acceptedProposal) {
      Alert.alert("Error", "Could not find the accepted proposal.");
      return;
    }

    const isMpesaPayment = transaction.payment_method === "mpesa";
    if (isMpesaPayment) {
      await handleMpesaRelease(acceptedProposal);
    } else {
      await handleStripeReleasePayment(acceptedProposal);
    }
  };

  const handleMpesaRelease = async (acceptedProposal) => {
    try {
      if (!transaction) {
        Alert.alert("Error", "Transaction not found.");
        return;
      }

      if (transaction.status === "processing_release") {
        Alert.alert("Release in progress", "A payout is already processing.");
        return;
      }

      if (transaction.status === "released") {
        Alert.alert("Already released", "This payout has already been sent.");
        return;
      }

      if (transaction.status !== "held_in_escrow") {
        Alert.alert(
          "Cannot release funds",
          `Transaction status: ${transaction.status}`,
        );
        return;
      }

      setIsLoading(true);

      const { data: profile } = await supabase
        .from("freelancer_profiles")
        .select("phone_number")
        .eq("user_id", acceptedProposal.freelancer_id)
        .single();

      if (!profile?.phone_number) {
        throw new Error("Freelancer phone number not found");
      }

      const { data: lockedTx, error: lockError } = await supabase
        .from("transactions")
        .update({ status: "processing_release" })
        .eq("id", transaction.id)
        .eq("status", "held_in_escrow")
        .select("id,status")
        .maybeSingle();

      if (lockError) {
        throw lockError;
      }

      if (!lockedTx) {
        Alert.alert(
          "Release not allowed",
          "This payout is already being processed or was released.",
        );
        return;
      }

      const b2cResponse = await apiMpesa.post("/mpesa/b2c-payment", {
        phoneNumber: profile.phone_number,
        amount: transaction?.freelancer_amount,
        remarks: `Project: ${project?.title}`,
        occasion: `Project #${id}`,
        transaction: transaction,
        finalProjectId: id,
      });

      if (b2cResponse?.data?.status !== "success") {
        throw new Error(
          b2cResponse?.data?.message ||
            "Failed to initiate M-Pesa payout. Please try again.",
        );
      }

      await PostNotifications({
        senderid: user.id,
        receiveid: acceptedProposal.freelancer_id,
        title: "Payment release initiated",
        createdat: new Date().toISOString(),
        data: JSON.stringify({
          receiverid: acceptedProposal.freelancer_id,
          project_id: id,
          bidId: acceptedProposal.id,
          type: "payment_release_started",
        }),
      });
      Alert.alert(
        "Payment Initiated!",
        "M-Pesa payout has been initiated. We'll update you when it completes.",
        [{ text: "OK" }],
      );

      fetchProjectData();
    } catch (error) {
      if (transaction?.id) {
        await supabase
          .from("transactions")
          .update({ status: "held_in_escrow" })
          .eq("id", transaction.id)
          .eq("status", "processing_release");
      }
      Alert.alert("Error", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStripeReleasePayment = async (acceptedProposal) => {
    if (!transaction) return;

    const { stripeAccountId: freelancerStripeAccountId } =
      await getFreelancerStripeAccount(acceptedProposal?.FreelancerProfile?.id);

    if (!freelancerStripeAccountId) {
      Alert.alert(
        "Error",
        "Freelancer hasn't connected their Stripe account yet.",
      );
      return;
    }

    Alert.alert(
      "Release Payment",
      `This will release $${transaction.freelancer_amount.toFixed(2)} to the freelancer. Are you sure the project is complete?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Release Funds",
          style: "default",
          onPress: async () => {
            try {
              setIsLoading(true);
              const response = await api.post("/stripe/release-funds", {
                projectId: id,
                transactionId: transaction.id,
                freelancerStripeAccountId: freelancerStripeAccountId,
              });

              if (response.status !== 200) {
                throw new Error(
                  response.data?.error || "Failed to release funds",
                );
              }
              await PostNotifications({
                senderid: user.id,
                receiveid: acceptedProposal.freelancer_id,
                title: "Released payment",
                createdat: new Date().toISOString(),
                data: JSON.stringify({
                  receiverid: acceptedProposal.freelancer_id,
                  project_id: id,
                  bidId: acceptedProposal.id,
                  type: "payment",
                }),
              });
              Alert.alert(
                "Payment Released!",
                `$${transaction.freelancer_amount.toFixed(2)} has been transferred to the freelancer.`,
                [{ text: "OK" }],
              );

              fetchProjectData();
            } catch (error) {
              console.error("Release payment error:", error);
              Alert.alert(
                "Error",
                error.response?.data?.error ||
                  error.message ||
                  "Failed to release payment. Please try again.",
              );
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    );
  };

  const getStatusStyles = (status) => {
    const statusMap = {
      open: { bg: theme.successBg, text: theme.successText },
      in_progress: { bg: theme.infoBg, text: theme.infoText },
      completed: { bg: theme.warningBg, text: theme.warningText },
      cancelled: { bg: theme.errorBg, text: theme.errorText },
    };
    return (
      statusMap[status] || { bg: theme.surfaceAlt, text: theme.textSecondary }
    );
  };

  if (isLoading) {
    return (
      <View style={styles(theme).loading}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles(theme).loadingText}>Loading project...</Text>
      </View>
    );
  }

  if (!project) {
    return (
      <View style={styles(theme).notFound}>
        <View style={styles(theme).notFoundIcon}>
          <Briefcase size={56} color={theme.textMuted} />
        </View>
        <Text style={styles(theme).notFoundTitle}>Project not found</Text>
        <Text style={styles(theme).notFoundDesc}>
          This project may have been removed or doesn't exist.
        </Text>
        <TouchableOpacity
          style={styles(theme).notFoundBtn}
          onPress={() => router.push("/(tab)/home")}
        >
          <Text style={styles(theme).notFoundBtnText}>Go to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOwner = user?.id === clientProfile?.user_id;
  const canApply =
    userRole === "freelancer" && !existingProposal && project.status === "open";
  const statusStyles = getStatusStyles(project.status);
  const s = styles(theme);

  return (
    <ScrollView style={s.container}>
      <View style={s.content}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <ArrowLeft size={18} color={theme.textSecondary} />
          <Text style={s.backText}>Back to Projects</Text>
        </TouchableOpacity>

        {transaction && (
          <View>
            <View style={s.escrowBanner}>
              <Shield size={20} color={theme.primary} />
              <View style={s.escrowInfo}>
                <Text style={s.escrowTitle}>Funds in Escrow</Text>
                <Text style={s.escrowAmount}>
                  ${transaction.amount.toFixed(2)} (Fee: $
                  {transaction.platform_fee.toFixed(2)})
                </Text>
              </View>
              {transaction.status === "held_in_escrow" && isOwner && (
                <TouchableOpacity style={s.releaseBtn} onPress={releaseFunds}>
                  <Text style={s.releaseBtnText}>Release Payment</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={s.messageButton}
              onPress={() =>
                router.push(`/(chats)/${transaction.freelancer_id}`)
              }
            >
              <View style={s.messageButtonContent}>
                <View style={s.messageIconWrapper}>
                  <Send size={18} color={theme.primary} />
                </View>
                <View style={s.messageTextWrapper}>
                  <Text style={s.messageButtonTitle}>Message Freelancer</Text>
                  <Text style={s.messageButtonSubtitle}>
                    {proposals.find((p) => p.id === transaction?.bid_id)
                      ?.FreelancerProfile?.full_name ||
                      "Chat with your freelancer"}
                  </Text>
                </View>
                <View style={s.messageChevron}>
                  <Feather
                    name="chevron-right"
                    size={20}
                    color={theme.textMuted}
                  />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        <View style={s.headerCard}>
          <View style={s.headerTop}>
            <View style={s.headerLeft}>
              <Text style={s.projectTitle}>{project.title}</Text>
              <View style={s.metaRow}>
                <View style={s.metaItem}>
                  <Clock size={14} color={theme.textMuted} />
                  <Text style={s.metaText}>
                    Posted {new Date(project.created_at).toLocaleDateString()}
                  </Text>
                </View>
                {project.category && (
                  <View style={s.categoryBadge}>
                    <Text style={s.categoryText}>{project.category.name}</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={[s.statusBadge, { backgroundColor: statusStyles.bg }]}>
              <Text style={[s.statusText, { color: statusStyles.text }]}>
                {project.status.replace("_", " ")}
              </Text>
            </View>
          </View>

          <View style={s.divider} />

          <View style={s.description}>
            <Text style={s.sectionLabel}>Project Description</Text>
            <Text style={s.descriptionText}>{project.description}</Text>
          </View>

          {project.required_skills && project.required_skills.length > 0 && (
            <>
              <View style={s.divider} />
              <View style={s.skills}>
                <Text style={s.sectionLabel}>Required Skills</Text>
                <View style={s.skillTags}>
                  {project.required_skills.map((skill) => (
                    <View key={skill} style={s.skillTag}>
                      <Text style={s.skillText}>{skill}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </>
          )}
        </View>

        <View style={s.grid}>
          {isOwner && (
            <View style={s.proposalsCard}>
              <View style={s.proposalsHeader}>
                <View style={s.proposalsHeaderIcon}>
                  <User size={24} color={theme.primary} />
                </View>
                <View>
                  <Text style={s.proposalsTitle}>
                    Proposals ({proposals.length})
                  </Text>
                  <Text style={s.proposalsSubtitle}>
                    Review freelancer proposals
                  </Text>
                </View>
              </View>

              {proposals.length === 0 ? (
                <View style={s.empty}>
                  <View style={s.emptyIcon}>
                    <Send size={40} color={theme.border} />
                  </View>
                  <Text style={s.emptyText}>No proposals yet</Text>
                  <Text style={s.emptySubtext}>
                    Freelancers will submit proposals soon.
                  </Text>
                </View>
              ) : (
                <View style={s.proposalsList}>
                  {proposals.map((p) => {
                    const pStatus = getStatusStyles(p.status);
                    return (
                      <View key={p.id} style={s.proposalCard}>
                        <View style={s.proposalHeader}>
                          <View style={s.proposalLeft}>
                            {p.FreelancerProfile?.avatar_url ? (
                              <Image
                                source={{ uri: p.FreelancerProfile.avatar_url }}
                                style={s.avatar}
                              />
                            ) : (
                              <View style={s.avatarPlaceholder}>
                                <Text style={s.avatarText}>
                                  {p.FreelancerProfile?.email?.[0] || "F"}
                                </Text>
                              </View>
                            )}
                            <View>
                              <Text style={s.proposalName}>
                                {p.FreelancerProfile?.full_name || "Freelancer"}
                              </Text>
                            </View>
                          </View>
                          <View style={s.proposalRight}>
                            <Text style={s.proposalAmount}>
                              ${p.bid_amount.toLocaleString()}
                            </Text>
                            <Text style={s.proposalDuration}>
                              {p.estimated_duration?.replace(/_/g, " ")}
                            </Text>
                          </View>
                        </View>

                        <Text style={s.coverLetter} numberOfLines={3}>
                          {p.cover_letter}
                        </Text>

                        <View style={s.proposalFooter}>
                          <View
                            style={[
                              s.proposalStatus,
                              { backgroundColor: pStatus.bg },
                            ]}
                          >
                            <Text
                              style={[
                                s.proposalStatusText,
                                { color: pStatus.text },
                              ]}
                            >
                              {p.status}
                            </Text>
                          </View>
                          {p.status === "pending" && !transaction && (
                            <TouchableOpacity
                              style={s.acceptBtn}
                              onPress={() => handleAcceptProposal(p)}
                            >
                              <CheckCircle size={16} color="#FFF" />
                              <Text style={s.acceptText}>Accept & Pay</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          <View style={s.sidebar}>
            <View style={s.sideCard}>
              <View style={s.sideCardHeader}>
                <DollarSign size={20} color={theme.success} />
                <Text style={s.sideCardTitle}>Budget</Text>
              </View>
              <Text style={s.budgetAmount}>
                ${project.budget_min?.toLocaleString()} - $
                {project.budget_max?.toLocaleString()}
              </Text>
              <Text style={s.budgetType}>
                {project.budget_type === "fixed"
                  ? "Fixed Price"
                  : "Hourly Rate"}
              </Text>
              <View style={s.sideDivider} />
              <View style={s.timelineRow}>
                <Calendar size={16} color={theme.textSecondary} />
                <Text style={s.timelineText}>
                  {project.timeline?.replace(/_/g, " ") || "Not specified"}
                </Text>
              </View>
            </View>

            <View style={s.proposalLeft}>
              {project.client_profile?.avatar_url ? (
                <Image
                  source={{ uri: project.client_profile.avatar_url }}
                  style={s.avatar}
                />
              ) : (
                <View style={s.avatarPlaceholder}>
                  <Text style={s.avatarText}>
                    {project.client_profile?.company_name?.[0] || "C"}
                  </Text>
                </View>
              )}
              <View>
                <Text style={s.proposalName}>
                  {project.client_profile?.company_name || "Client"}
                </Text>
                <Text style={s.proposalName}>
                  {project.client_profile?.company_website || "No website"}
                </Text>
                <Text style={s.proposalName}>
                  {project.client_profile?.phone_number || "No phone"}
                </Text>
              </View>
            </View>

            {canApply && (
              <TouchableOpacity
                style={s.applyBtn}
                onPress={() => setIsModalOpen(true)}
              >
                <Send size={20} color="#FFF" />
                <Text style={s.applyText}>Submit Proposal</Text>
              </TouchableOpacity>
            )}

            {existingProposal && (
              <View style={s.existingProposal}>
                <View style={s.existingHeader}>
                  <CheckCircle size={20} color={theme.success} />
                  <Text style={s.existingTitle}>Proposal Submitted</Text>
                </View>
                <Text style={s.existingBid}>
                  Your bid: ${existingProposal.bid_amount.toLocaleString()}
                </Text>
                <View
                  style={[
                    s.existingStatus,
                    {
                      backgroundColor: getStatusStyles(existingProposal.status)
                        .bg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.existingStatusText,
                      { color: getStatusStyles(existingProposal.status).text },
                    ]}
                  >
                    {existingProposal.status}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        <Modal
          visible={isModalOpen}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsModalOpen(false)}
        >
          <View style={s.modalOverlay}>
            <View style={s.modalContent}>
              <ScrollView>
                <View style={s.modalHeader}>
                  <View style={s.modalIcon}>
                    <Award size={28} color={theme.primary} />
                  </View>
                  <Text style={s.modalTitle}>Submit Your Proposal</Text>
                  <Text style={s.modalSubtitle}>
                    Show the client why you're the best fit
                  </Text>
                </View>

                <View style={s.modalForm}>
                  <View style={s.formGroup}>
                    <Text style={s.formLabel}>Cover Letter *</Text>
                    <TextInput
                      style={s.textArea}
                      placeholder="Introduce yourself..."
                      placeholderTextColor={theme.inputPlaceholder}
                      multiline
                      numberOfLines={6}
                      textAlignVertical="top"
                      value={proposalData.cover_letter}
                      onChangeText={(t) =>
                        setProposalData({ ...proposalData, cover_letter: t })
                      }
                    />
                  </View>

                  <View style={s.formRow}>
                    <View style={s.formGroupHalf}>
                      <Text style={s.formLabel}>Your Bid *</Text>
                      <View style={s.inputWithIcon}>
                        <Text style={s.inputIcon}>$</Text>
                        <TextInput
                          style={s.inputField}
                          placeholder="1500"
                          placeholderTextColor={theme.inputPlaceholder}
                          keyboardType="numeric"
                          value={proposalData.bid_amount}
                          onChangeText={(t) =>
                            setProposalData({ ...proposalData, bid_amount: t })
                          }
                        />
                      </View>
                    </View>
                    <View style={s.formGroupHalf}>
                      <Text style={s.formLabel}>Duration *</Text>
                      <TextInput
                        style={s.input}
                        placeholder="2 weeks"
                        placeholderTextColor={theme.inputPlaceholder}
                        value={proposalData.estimated_duration}
                        onChangeText={(t) =>
                          setProposalData({
                            ...proposalData,
                            estimated_duration: t,
                          })
                        }
                      />
                    </View>
                  </View>

                  <View style={s.modalButtons}>
                    <TouchableOpacity
                      style={s.cancelBtn}
                      onPress={() => setIsModalOpen(false)}
                    >
                      <Text style={s.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        s.submitBtn,
                        (!proposalData.cover_letter ||
                          !proposalData.bid_amount) &&
                          s.submitBtnDisabled,
                      ]}
                      onPress={handleSubmitProposal}
                      disabled={
                        isSubmitting ||
                        !proposalData.cover_letter ||
                        !proposalData.bid_amount
                      }
                    >
                      {isSubmitting ? (
                        <ActivityIndicator color="#FFF" size="small" />
                      ) : (
                        <Text style={s.submitText}>Submit Proposal</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        <PaymentMethodModal
          visible={isPaymentMethodModalOpen}
          onClose={() => {
            setIsPaymentMethodModalOpen(false);
            setSelectedProposal(null);
          }}
          onSelectStripe={handleSelectStripePayment}
          onSelectMpesa={handleSelectMpesaPayment}
          amount={selectedProposal?.bid_amount}
        />

        <Modal
          visible={isPaymentModalOpen}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setIsPaymentModalOpen(false)}
        >
          <View style={s.modalOverlay}>
            <View style={s.paymentModal}>
              <View style={s.paymentIcon}>
                <Shield size={32} color={theme.primary} />
              </View>
              <Text style={s.paymentTitle}>Secure Escrow Payment</Text>
              <Text style={s.paymentSubtitle}>
                Your funds will be held safely until project completion
              </Text>

              {selectedProposal && (
                <View style={s.paymentBreakdown}>
                  <View style={s.breakdownRow}>
                    <Text style={s.breakdownLabel}>Bid Amount</Text>
                    <Text style={s.breakdownValue}>
                      ${selectedProposal.bid_amount.toFixed(2)}
                    </Text>
                  </View>
                  <View style={s.breakdownRow}>
                    <Text style={s.breakdownLabel}>
                      Platform Fee ({commissionRate}%)
                    </Text>
                    <Text style={s.breakdownValue}>
                      $
                      {(
                        (selectedProposal.bid_amount * commissionRate) /
                        100
                      ).toFixed(2)}
                    </Text>
                  </View>
                  <View style={[s.breakdownRow, s.breakdownTotal]}>
                    <Text style={s.breakdownTotalLabel}>
                      Freelancer Receives
                    </Text>
                    <Text style={s.breakdownTotalValue}>
                      $
                      {(
                        selectedProposal.bid_amount -
                        (selectedProposal.bid_amount * commissionRate) / 100
                      ).toFixed(2)}
                    </Text>
                  </View>
                </View>
              )}

              <View style={s.paymentButtons}>
                <TouchableOpacity
                  style={s.paymentCancelBtn}
                  onPress={() => {
                    setIsPaymentModalOpen(false);
                    setSelectedProposal(null);
                  }}
                >
                  <Text style={s.paymentCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.paymentConfirmBtn}
                  onPress={handleConfirmPayment}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={s.paymentConfirmText}>Confirm Payment</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </ScrollView>
  );
}

const styles = (theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    messageButton: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
      marginBottom: 16,
    },
    messageButtonContent: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      gap: 14,
    },
    messageIconWrapper: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: theme.iconBg,
      alignItems: "center",
      justifyContent: "center",
    },
    messageTextWrapper: {
      flex: 1,
      gap: 2,
    },
    messageButtonTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.text,
    },
    messageButtonSubtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      fontWeight: "500",
    },
    messageChevron: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: theme.background,
      alignItems: "center",
      justifyContent: "center",
    },
    content: {
      maxWidth: 1200,
      width: "100%",
      alignSelf: "center",
      padding: 16,
      gap: 24,
    },
    loading: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
    },
    loadingText: {
      color: theme.textSecondary,
      fontSize: 16,
      fontWeight: "500",
    },
    notFound: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 32,
    },
    notFoundIcon: {
      width: 112,
      height: 112,
      borderRadius: 56,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 24,
    },
    notFoundTitle: {
      fontSize: 24,
      fontWeight: "800",
      color: theme.text,
      marginBottom: 8,
    },
    notFoundDesc: {
      fontSize: 15,
      color: theme.textSecondary,
      textAlign: "center",
      marginBottom: 24,
    },
    notFoundBtn: {
      backgroundColor: theme.primary,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 12,
    },
    notFoundBtnText: { color: "#FFF", fontWeight: "700", fontSize: 16 },
    back: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 8,
    },
    backText: { color: theme.textSecondary, fontSize: 15, fontWeight: "500" },

    escrowBanner: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.infoBg,
      borderWidth: 1,
      borderColor: theme.info,
      borderRadius: 12,
      padding: 16,
      gap: 12,
      marginBottom: 16,
    },
    escrowInfo: { flex: 1 },
    escrowTitle: { fontSize: 16, fontWeight: "700", color: theme.infoText },
    escrowAmount: { fontSize: 14, color: theme.info, marginTop: 2 },
    releaseBtn: {
      backgroundColor: theme.primary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
    },
    releaseBtnText: { color: "#FFF", fontSize: 14, fontWeight: "700" },

    headerCard: {
      backgroundColor: theme.surface,
      borderRadius: 20,
      padding: 24,
      borderWidth: 1,
      borderColor: theme.border,
    },
    headerTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 20,
    },
    headerLeft: { flex: 1, marginRight: 16 },
    projectTitle: {
      fontSize: 28,
      fontWeight: "800",
      color: theme.text,
      marginBottom: 12,
      lineHeight: 36,
    },
    metaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 12,
    },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    metaText: { fontSize: 14, color: theme.textSecondary },
    categoryBadge: {
      backgroundColor: theme.iconBg,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    categoryText: { color: theme.primary, fontSize: 13, fontWeight: "600" },
    statusBadge: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 12,
    },
    statusText: {
      fontSize: 13,
      fontWeight: "700",
      textTransform: "capitalize",
    },
    divider: { height: 1, backgroundColor: theme.divider, marginVertical: 20 },
    description: { gap: 12 },
    sectionLabel: { fontSize: 16, fontWeight: "700", color: theme.text },
    descriptionText: {
      fontSize: 15,
      color: theme.textSecondary,
      lineHeight: 24,
    },
    skills: { gap: 12 },
    skillTags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    skillTag: {
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
    },
    skillText: { fontSize: 14, color: theme.text, fontWeight: "500" },
    grid: { gap: 20 },
    proposalsCard: {
      backgroundColor: theme.surface,
      borderRadius: 20,
      padding: 24,
      borderWidth: 1,
      borderColor: theme.border,
    },
    proposalsHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      marginBottom: 24,
    },
    proposalsHeaderIcon: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: theme.iconBg,
      alignItems: "center",
      justifyContent: "center",
    },
    proposalsTitle: { fontSize: 20, fontWeight: "800", color: theme.text },
    proposalsSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 2,
    },
    empty: { alignItems: "center", paddingVertical: 48 },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.background,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    emptyText: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 4,
    },
    emptySubtext: { fontSize: 14, color: theme.textMuted },
    proposalsList: { gap: 16 },
    proposalCard: {
      backgroundColor: theme.background,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 12,
    },
    proposalHeader: { flexDirection: "row", justifyContent: "space-between" },
    proposalLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    avatar: { width: 48, height: 48, borderRadius: 24 },
    avatarPlaceholder: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { fontSize: 18, fontWeight: "700", color: theme.textMuted },
    proposalName: { fontSize: 16, fontWeight: "700", color: theme.text },
    proposalRight: { alignItems: "flex-end" },
    proposalAmount: { fontSize: 18, fontWeight: "800", color: theme.success },
    proposalDuration: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
    coverLetter: { fontSize: 14, color: theme.textSecondary, lineHeight: 20 },
    proposalFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.divider,
    },
    proposalStatus: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    proposalStatusText: {
      fontSize: 12,
      fontWeight: "700",
      textTransform: "capitalize",
    },
    acceptBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.primary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
    },
    acceptText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
    sidebar: { gap: 16 },
    sideCard: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sideCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 16,
    },
    sideCardTitle: { fontSize: 16, fontWeight: "700", color: theme.text },
    budgetAmount: {
      fontSize: 28,
      fontWeight: "800",
      color: theme.text,
      marginBottom: 4,
    },
    budgetType: { fontSize: 14, color: theme.textSecondary, marginBottom: 16 },
    sideDivider: {
      height: 1,
      backgroundColor: theme.divider,
      marginBottom: 12,
    },
    timelineRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    timelineText: { fontSize: 14, color: theme.textSecondary },
    applyBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: theme.primary,
      paddingVertical: 16,
      borderRadius: 14,
    },
    applyText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
    existingProposal: {
      backgroundColor: theme.successBg,
      borderWidth: 1,
      borderColor: theme.success,
      borderRadius: 16,
      padding: 20,
    },
    existingHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
    },
    existingTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.successText,
    },
    existingBid: { fontSize: 14, color: theme.success, marginBottom: 12 },
    existingStatus: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      alignSelf: "flex-start",
    },
    existingStatusText: {
      fontSize: 12,
      fontWeight: "700",
      textTransform: "capitalize",
    },

    modalOverlay: {
      flex: 1,
      backgroundColor: theme.modalOverlay,
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      maxHeight: "90%",
    },
    modalHeader: { alignItems: "center", marginBottom: 28 },
    modalIcon: {
      width: 64,
      height: 64,
      borderRadius: 16,
      backgroundColor: theme.iconBg,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: "800",
      color: theme.text,
      marginBottom: 8,
    },
    modalSubtitle: { fontSize: 15, color: theme.textSecondary },
    modalForm: { gap: 20 },
    formGroup: { gap: 8 },
    formLabel: { fontSize: 14, fontWeight: "600", color: theme.text },
    textArea: {
      backgroundColor: theme.inputBg,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 15,
      color: theme.text,
      minHeight: 120,
      textAlignVertical: "top",
    },
    formRow: { flexDirection: "row", gap: 12 },
    formGroupHalf: { flex: 1, gap: 8 },
    inputWithIcon: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.inputBg,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 12,
    },
    inputIcon: {
      paddingHorizontal: 16,
      fontSize: 16,
      fontWeight: "600",
      color: theme.textSecondary,
    },
    inputField: {
      flex: 1,
      paddingVertical: 14,
      fontSize: 15,
      color: theme.text,
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
    modalButtons: { flexDirection: "row", gap: 12, marginTop: 8 },
    cancelBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
    },
    cancelText: { fontSize: 16, fontWeight: "600", color: theme.textSecondary },
    submitBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    submitBtnDisabled: { backgroundColor: theme.textMuted },
    submitText: { fontSize: 16, fontWeight: "600", color: "#FFF" },

    paymentModal: {
      backgroundColor: theme.surface,
      borderRadius: 20,
      margin: 20,
      padding: 28,
      alignItems: "center",
    },
    paymentIcon: {
      width: 72,
      height: 72,
      borderRadius: 16,
      backgroundColor: theme.iconBg,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 20,
    },
    paymentTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: theme.text,
      marginBottom: 8,
    },
    paymentSubtitle: {
      fontSize: 15,
      color: theme.textSecondary,
      textAlign: "center",
      marginBottom: 24,
    },
    paymentBreakdown: {
      width: "100%",
      backgroundColor: theme.background,
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
    },
    breakdownRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 8,
    },
    breakdownLabel: { fontSize: 14, color: theme.textSecondary },
    breakdownValue: { fontSize: 14, fontWeight: "600", color: theme.text },
    breakdownTotal: {
      borderTopWidth: 1,
      borderTopColor: theme.border,
      marginTop: 8,
      paddingTop: 12,
    },
    breakdownTotalLabel: { fontSize: 16, fontWeight: "700", color: theme.text },
    breakdownTotalValue: {
      fontSize: 16,
      fontWeight: "800",
      color: theme.success,
    },
    paymentButtons: { flexDirection: "row", gap: 12, width: "100%" },
    paymentCancelBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
    },
    paymentCancelText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.textSecondary,
    },
    paymentConfirmBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    paymentConfirmText: { fontSize: 16, fontWeight: "700", color: "#FFF" },
  });
