import axios from "axios";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Clock,
  Info,
  Loader,
  Shield,
  Smartphone,
  XCircle,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../lib/Client";

export default function MpesaPayment() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const {
    projectId,
    bidId,
    freelancerId,
    amount,
    commissionRate = 10,
  } = params;

  const [phoneNumber, setPhoneNumber] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState("idle");
  const [checkoutRequestID, setCheckoutRequestID] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [pollingInterval, setPollingInterval] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [phoneError, setPhoneError] = useState("");

  // Animation values
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(50)).current;
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  const parsedAmount = parseFloat(amount);
  const parsedCommission = parseFloat(commissionRate);
  const platformFee = (parsedAmount * parsedCommission) / 100;
  const freelancerAmount = parsedAmount - platformFee;

  // Helper function to ensure boolean
  const toBoolean = (value) => {
    return Boolean(value);
  };

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, []);

  // Pulse animation for waiting state
  useEffect(() => {
    if (paymentStatus === "waiting") {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [paymentStatus]);

  // Countdown timer for waiting state
  useEffect(() => {
    if (paymentStatus === "waiting" && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown, paymentStatus]);

  const formatPhoneNumber = (phone) => {
    let cleaned = phone.replace(/[\s\-()]/g, "");
    if (cleaned.startsWith("+")) cleaned = cleaned.substring(1);
    if (cleaned.startsWith("0")) cleaned = "254" + cleaned.substring(1);
    if (!cleaned.startsWith("254")) cleaned = "254" + cleaned;
    return cleaned;
  };

  const validatePhoneNumber = (phone) => {
    const formatted = formatPhoneNumber(phone);
    const isValid = formatted.length === 12 && formatted.startsWith("254");

    if (!isValid && phone.length > 0) {
      setPhoneError("Invalid Kenyan phone number");
    } else {
      setPhoneError("");
    }

    return isValid;
  };

  const handlePhoneChange = (text) => {
    setPhoneNumber(text);
    if (text.length > 0) {
      validatePhoneNumber(text);
    } else {
      setPhoneError("");
    }
  };

  const handleInitiatePayment = async () => {
    Keyboard.dismiss();

    if (!phoneNumber) {
      setPhoneError("Phone number is required");
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      setPhoneError(
        "Please enter a valid Kenyan phone number (e.g., 0712345678)",
      );
      return;
    }

    setIsProcessing(true);
    setErrorMessage("");

    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);

      const response = await axios.post(
        "https://lancermpesabackend-production.up.railway.app/mpesa/stk-push",
        {
          phoneNumber: formattedPhone,
          amount: Math.round(parsedAmount),
          accountReference: `PROJECT_${projectId}`,
          transactionDesc: "Escrow Payment",
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 15000,
        },
      );

      if (response.data.status === "success") {
        const { checkoutRequestID: reqId } = response.data.data;
        setCheckoutRequestID(reqId);
        setPaymentStatus("waiting");
        setCountdown(120); // 2 minutes countdown

        // Create transaction record
        const { data: transaction, error } = await supabase
          .from("transactions")
          .insert({
            project_id: projectId,
            bid_id: bidId,
            client_id: params.clientId,
            freelancer_id: freelancerId,
            amount: parsedAmount,
            platform_fee: platformFee,
            freelancer_amount: freelancerAmount,
            status: "pending",
            payment_method: "mpesa",
            mpesa_checkout_request_id: reqId,
          })
          .select()
          .single();

        if (error) throw new Error("Failed to create transaction record");

        startPollingPaymentStatus(reqId);
      } else {
        throw new Error(response.data.message || "Failed to initiate payment");
      }
    } catch (error) {
      console.error("Payment initiation error:", error);
      setPaymentStatus("failed");

      let userMessage = "Failed to initiate payment. Please try again.";
      if (error.code === "ECONNABORTED") {
        userMessage =
          "Request timed out. Please check your connection and try again.";
      } else if (error.response?.status === 500) {
        userMessage = "Server error. Please try again in a moment.";
      }

      setErrorMessage(
        error.response?.data?.error || error.message || userMessage,
      );

      Alert.alert("Payment Failed", userMessage, [
        { text: "Try Again", onPress: () => setPaymentStatus("idle") },
        { text: "Cancel", style: "cancel", onPress: () => router.back() },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const startPollingPaymentStatus = (reqId) => {
    let attempts = 0;
    const maxAttempts = 40;

    const interval = setInterval(async () => {
      attempts++;

      try {
        const response = await axios.post(
          "https://jargonistic-meadow-heliographically.ngrok-free.dev/mpesa/query-stk",
          { checkoutRequestID: reqId },
          { headers: { "Content-Type": "application/json" }, timeout: 10000 },
        );

        if (response.data.status === "success") {
          const { ResultCode, ResultDesc } = response.data.data;

          if (ResultCode === "0") {
            clearInterval(interval);
            setPollingInterval(null);
            await handlePaymentSuccess(reqId);
          } else if (ResultCode !== undefined && ResultCode !== "0") {
            clearInterval(interval);
            setPollingInterval(null);
            await handlePaymentFailure(reqId, ResultDesc);
          }
        }

        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setPollingInterval(null);
          handlePaymentTimeout(reqId);
        }
      } catch (error) {
        console.error("Polling error:", error);
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setPollingInterval(null);
          handlePaymentTimeout(reqId);
        }
      }
    }, 3000);

    setPollingInterval(interval);
  };

  const handlePaymentSuccess = async (reqId) => {
    try {
      await supabase
        .from("transactions")
        .update({ status: "held_in_escrow" })
        .eq("mpesa_checkout_request_id", reqId);

      await supabase
        .from("bids")
        .update({ status: "accepted" })
        .eq("id", bidId);
      await supabase
        .from("projects")
        .update({ status: "in_progress" })
        .eq("id", projectId);
      await supabase
        .from("bids")
        .update({ status: "rejected" })
        .eq("project_id", projectId)
        .neq("id", bidId);

      setPaymentStatus("success");

      setTimeout(() => {
        Alert.alert(
          "Payment Successful! 🎉",
          `KES ${parsedAmount.toFixed(2)} is now held in escrow.\n\n` +
            `Platform Fee: KES ${platformFee.toFixed(2)}\n` +
            `Freelancer receives: KES ${freelancerAmount.toFixed(2)}\n\n` +
            `Funds will be released upon project completion.`,
          [
            {
              text: "Continue",
              onPress: () => router.replace(`/projects/${projectId}`),
            },
          ],
        );
      }, 1500);
    } catch (error) {
      console.error("Error updating payment status:", error);
      Alert.alert(
        "Warning",
        "Payment received but failed to update records. Please contact support.",
      );
    }
  };

  const handlePaymentFailure = async (reqId, reason) => {
    try {
      await supabase
        .from("transactions")
        .update({ status: "failed", failure_reason: reason })
        .eq("mpesa_checkout_request_id", reqId);

      setPaymentStatus("failed");
      setErrorMessage(reason || "Payment was not completed");

      Alert.alert(
        "Payment Failed",
        reason || "Payment was not completed. Please try again.",
        [
          {
            text: "Try Again",
            onPress: () => {
              setPaymentStatus("idle");
              setErrorMessage("");
            },
          },
          { text: "Cancel", style: "cancel", onPress: () => router.back() },
        ],
      );
    } catch (error) {
      console.error("Error updating failed payment:", error);
    }
  };

  const handlePaymentTimeout = async (reqId) => {
    try {
      await supabase
        .from("transactions")
        .update({ status: "failed", failure_reason: "Payment timeout" })
        .eq("mpesa_checkout_request_id", reqId);

      setPaymentStatus("failed");
      setErrorMessage("Payment request timed out");

      Alert.alert(
        "Payment Timeout",
        "The payment request timed out. Please try again.",
        [
          {
            text: "Try Again",
            onPress: () => {
              setPaymentStatus("idle");
              setErrorMessage("");
            },
          },
          { text: "Cancel", style: "cancel", onPress: () => router.back() },
        ],
      );
    } catch (error) {
      console.error("Error handling timeout:", error);
    }
  };

  // Check if button should be disabled
  const isPayButtonDisabled =
    !phoneNumber || isProcessing || toBoolean(phoneError);
  const hasPhoneError = toBoolean(phoneError);

  const renderPaymentStatus = () => {
    switch (paymentStatus) {
      case "waiting":
        return (
          <Animated.View
            style={[s.statusCard, { transform: [{ scale: pulseAnim }] }]}
          >
            <View style={s.statusIconWrapper}>
              <View style={s.loadingRing}>
                <Loader size={56} color="#2563EB" />
              </View>
            </View>
            <Text style={s.statusTitle}>Waiting for Payment</Text>
            <Text style={s.statusDesc}>
              Check your phone for the M-Pesa prompt
            </Text>

            {countdown > 0 && (
              <View style={s.countdownContainer}>
                <Clock size={16} color="#6B7280" />
                <Text style={s.countdownText}>
                  {Math.floor(countdown / 60)}:
                  {(countdown % 60).toString().padStart(2, "0")} remaining
                </Text>
              </View>
            )}

            <View style={s.instructionBox}>
              <View style={s.instructionStep}>
                <View style={s.stepNumber}>
                  <Text style={s.stepNumberText}>1</Text>
                </View>
                <Text style={s.instructionText}>Enter your M-Pesa PIN</Text>
              </View>
              <View style={s.instructionStep}>
                <View style={s.stepNumber}>
                  <Text style={s.stepNumberText}>2</Text>
                </View>
                <Text style={s.instructionText}>Confirm the payment</Text>
              </View>
            </View>

            <TouchableOpacity
              style={s.cancelBtn}
              onPress={() => {
                if (pollingInterval) clearInterval(pollingInterval);
                router.back();
              }}
            >
              <Text style={s.cancelBtnText}>Cancel Payment</Text>
            </TouchableOpacity>
          </Animated.View>
        );

      case "success":
        return (
          <Animated.View style={s.statusCard}>
            <View style={[s.statusIconWrapper, { backgroundColor: "#DCFCE7" }]}>
              <CheckCircle size={56} color="#16A34A" />
            </View>
            <Text style={[s.statusTitle, { color: "#16A34A" }]}>
              Payment Successful!
            </Text>
            <Text style={s.statusDesc}>
              Funds are now securely held in escrow
            </Text>
            <View style={s.successDetails}>
              <View style={s.successRow}>
                <Text style={s.successLabel}>Amount</Text>
                <Text style={s.successValue}>
                  KES {parsedAmount.toFixed(2)}
                </Text>
              </View>
              <View style={s.successRow}>
                <Text style={s.successLabel}>Platform Fee</Text>
                <Text style={s.successValue}>KES {platformFee.toFixed(2)}</Text>
              </View>
              <View style={[s.successRow, s.successRowTotal]}>
                <Text style={s.successLabelTotal}>Freelancer Receives</Text>
                <Text style={s.successValueTotal}>
                  KES {freelancerAmount.toFixed(2)}
                </Text>
              </View>
            </View>
          </Animated.View>
        );

      case "failed":
        return (
          <Animated.View style={s.statusCard}>
            <View style={[s.statusIconWrapper, { backgroundColor: "#FEE2E2" }]}>
              <XCircle size={56} color="#DC2626" />
            </View>
            <Text style={[s.statusTitle, { color: "#DC2626" }]}>
              Payment Failed
            </Text>
            <View style={s.errorBox}>
              <AlertCircle size={16} color="#DC2626" />
              <Text style={s.errorText}>{errorMessage}</Text>
            </View>
            <TouchableOpacity
              style={s.retryBtn}
              onPress={() => {
                setPaymentStatus("idle");
                setErrorMessage("");
              }}
            >
              <Text style={s.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
              <Text style={s.backBtnText}>Back to Project</Text>
            </TouchableOpacity>
          </Animated.View>
        );

      default:
        return null;
    }
  };

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View
        style={[
          s.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
            <ArrowLeft size={20} color="#111827" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>M-Pesa Payment</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* M-Pesa Logo */}
        <View style={s.logoContainer}>
          <View style={s.logoWrapper}>
            <Smartphone size={32} color="#16A34A" />
          </View>
          <Text style={s.logoText}>M-PESA</Text>
          <Text style={s.logoSubtext}>Secure Mobile Payment</Text>
        </View>

        {paymentStatus === "idle" ? (
          <>
            {/* Payment Breakdown */}
            <View style={s.breakdownCard}>
              <Text style={s.breakdownTitle}>Payment Summary</Text>
              <View style={s.divider} />
              <View style={s.breakdownRow}>
                <Text style={s.breakdownLabel}>Project Amount</Text>
                <Text style={s.breakdownValue}>
                  KES {parsedAmount.toFixed(2)}
                </Text>
              </View>
              <View style={s.breakdownRow}>
                <Text style={s.breakdownLabel}>
                  Platform Fee ({parsedCommission}%)
                </Text>
                <Text style={s.breakdownValue}>
                  KES {platformFee.toFixed(2)}
                </Text>
              </View>
              <View style={s.divider} />
              <View style={s.breakdownRow}>
                <Text style={s.breakdownTotalLabel}>Freelancer Receives</Text>
                <Text style={s.breakdownTotalValue}>
                  KES {freelancerAmount.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Phone Number Input */}
            <View style={s.inputCard}>
              <Text style={s.inputLabel}>M-Pesa Phone Number</Text>
              <View
                style={[s.inputWrapper, hasPhoneError && s.inputWrapperError]}
              >
                <View style={s.inputPrefix}>
                  <Text style={s.prefixText}>🇰🇪 +254</Text>
                </View>
                <TextInput
                  style={s.input}
                  placeholder="712 345 678"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={handlePhoneChange}
                  maxLength={15}
                  autoFocus
                  editable={!isProcessing}
                />
              </View>
              {hasPhoneError ? (
                <View style={s.errorHint}>
                  <AlertCircle size={14} color="#DC2626" />
                  <Text style={s.errorHintText}>{phoneError}</Text>
                </View>
              ) : (
                <Text style={s.inputHint}>
                  Enter the phone number registered with M-Pesa
                </Text>
              )}
            </View>

            {/* Info Banners */}
            <View style={s.infoBanner}>
              <Info size={16} color="#2563EB" />
              <Text style={s.infoText}>
                You'll receive an M-Pesa prompt on your phone. Enter your PIN to
                complete the payment.
              </Text>
            </View>

            <View style={s.securityBanner}>
              <Shield size={16} color="#16A34A" />
              <Text style={s.securityText}>
                Funds will be held in secure escrow until project completion
              </Text>
            </View>

            {/* Pay Button */}
            <TouchableOpacity
              style={[s.payBtn, isPayButtonDisabled && s.payBtnDisabled]}
              onPress={handleInitiatePayment}
              disabled={isPayButtonDisabled}
            >
              {isProcessing ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Smartphone size={20} color="#FFF" />
                  <Text style={s.payBtnText}>
                    Pay KES {parsedAmount.toFixed(2)}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          renderPaymentStatus()
        )}
      </Animated.View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    padding: 20,
    gap: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  logoContainer: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
  },
  logoWrapper: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#16A34A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  logoText: {
    fontSize: 28,
    fontWeight: "800",
    color: "#16A34A",
    letterSpacing: 0.5,
  },
  logoSubtext: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "600",
  },
  breakdownCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 12,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  breakdownLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  breakdownTotalLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  breakdownTotalValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#16A34A",
  },
  inputCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    overflow: "hidden",
  },
  inputWrapperError: {
    borderColor: "#DC2626",
    backgroundColor: "#FEF2F2",
  },
  inputPrefix: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
  },
  prefixText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  inputHint: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 8,
  },
  errorHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  errorHintText: {
    fontSize: 12,
    color: "#DC2626",
    fontWeight: "600",
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 12,
    padding: 14,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#1E40AF",
    lineHeight: 18,
  },
  securityBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 12,
    padding: 12,
  },
  securityText: {
    fontSize: 13,
    color: "#15803D",
    fontWeight: "600",
  },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#16A34A",
    paddingVertical: 18,
    borderRadius: 14,
    shadowColor: "#16A34A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  payBtnDisabled: {
    backgroundColor: "#9CA3AF",
    shadowOpacity: 0,
  },
  payBtnText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFF",
  },
  statusCard: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    gap: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  statusIconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  loadingRing: {
    transform: [{ rotate: "0deg" }],
  },
  statusTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  statusDesc: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
  },
  countdownContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 8,
  },
  countdownText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#D97706",
  },
  instructionBox: {
    width: "100%",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginTop: 8,
  },
  instructionStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFF",
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
    fontWeight: "600",
  },
  cancelBtn: {
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFF",
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#6B7280",
    textAlign: "center",
  },
  successDetails: {
    width: "100%",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginTop: 8,
  },
  successRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  successLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  successValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  successRowTotal: {
    borderTopWidth: 2,
    borderTopColor: "#E5E7EB",
    paddingTop: 12,
    marginTop: 4,
  },
  successLabelTotal: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  successValueTotal: {
    fontSize: 16,
    fontWeight: "800",
    color: "#16A34A",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FEE2E2",
    borderRadius: 12,
    padding: 14,
    width: "100%",
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: "#DC2626",
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 16,
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  retryBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFF",
    textAlign: "center",
  },
  backBtn: {
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    width: "100%",
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6B7280",
    textAlign: "center",
  },
});
