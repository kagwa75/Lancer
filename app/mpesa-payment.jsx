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
import React, { useEffect, useRef, useState } from "react";
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
import { PostNotifications } from "../lib/supabase";

// Helper function for fetch with timeout
const fetchWithTimeout = async (url, options = {}, timeout = 35000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(
        data.error || data.message || `HTTP ${response.status}`,
      );
      error.response = { status: response.status, data };
      error.status = response.status;
      error.code = data.error; // Include error code
      throw error;
    }

    return { data, status: response.status };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      const timeoutError = new Error("Request timeout");
      timeoutError.code = "ECONNABORTED";
      throw timeoutError;
    }

    throw error;
  }
};

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
  const pollingTimeoutRef = useRef(null);
  const activeRequestRef = useRef(null);
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
  const PAYMENT_TIMEOUT_SECONDS = 240;
  const paymentTimeoutMinutes = Math.ceil(PAYMENT_TIMEOUT_SECONDS / 60);

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
      stopPolling();
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
      {
        const { data: existingTransactions, error: existingError } =
          await supabase
            .from("transactions")
            .select("id,status,mpesa_checkout_request_id,created_at")
            .eq("project_id", projectId)
            .eq("bid_id", bidId)
            .order("created_at", { ascending: false })
            .limit(1);

        if (existingError) {
          console.warn("Failed to check existing transactions:", existingError);
        }

        const existingTx = existingTransactions?.[0];
        if (existingTx) {
          if (existingTx.status === "pending") {
            if (existingTx.mpesa_checkout_request_id) {
              setCheckoutRequestID(existingTx.mpesa_checkout_request_id);
              setPaymentStatus("waiting");
            setCountdown(PAYMENT_TIMEOUT_SECONDS);
              startPollingPaymentStatus(existingTx.mpesa_checkout_request_id);
              return;
            }

            setIsProcessing(false);
            Alert.alert(
              "Payment In Progress",
              "A payment is already pending for this project. Please wait.",
            );
            return;
          }

          if (
            existingTx.status === "held_in_escrow" ||
            existingTx.status === "released" ||
            existingTx.status === "processing_release"
          ) {
            setIsProcessing(false);
            Alert.alert(
              "Payment Completed",
              "This project has already been paid for.",
            );
            return;
          }
        }
      }

      const formattedPhone = formatPhoneNumber(phoneNumber);

      console.log("Initiating M-Pesa payment:", {
        phone: formattedPhone,
        amount: Math.round(parsedAmount),
        projectId,
      });

      const response = await fetchWithTimeout(
        "https://lancermpesabackend-production.up.railway.app/mpesa/stk-push",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phoneNumber: formattedPhone,
            amount: Math.round(parsedAmount),
            accountReference: `PROJECT_${projectId}`,
            transactionDesc: "Escrow Payment",
          }),
        },
        35000,
      );

      console.log("STK Push Response:", JSON.stringify(response.data, null, 2));

      if (response.data?.status === "success" && response.data?.data) {
        const { checkoutRequestID: reqId } = response.data.data;
        setCheckoutRequestID(reqId);
        setPaymentStatus("waiting");
        setCountdown(PAYMENT_TIMEOUT_SECONDS); // 4 minutes countdown

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

  // Helper function to get user-friendly error messages
  const getErrorMessage = (resultCode) => {
    const errorMessages = {
      1: "Insufficient balance in M-Pesa account",
      1032: "Payment prompt was not completed. Please ensure you complete the payment within 60 seconds.",
      1037: "Payment timeout - PIN not entered in time",
      2001: "Wrong PIN entered too many times",
      1001: "Unable to complete transaction",
    };
    return (
      errorMessages[String(resultCode)] ||
      `Transaction failed (Code: ${resultCode})`
    );
  };

  const stopPolling = () => {
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
    activeRequestRef.current = null;
    if (pollingInterval) {
      clearTimeout(pollingInterval);
    }
    setPollingInterval(null);
  };
  const startPollingPaymentStatus = (reqId) => {
    stopPolling();
    activeRequestRef.current = reqId;
    let attempts = 0;
    let consecutiveRateLimits = 0;
    const maxAttempts = 12;

    const getDelay = (attemptNum, wasRateLimited = false) => {
      // If rate limited, wait longer
      if (wasRateLimited) {
        consecutiveRateLimits++;
        const backoff = Math.min(
          20000 * Math.pow(2, consecutiveRateLimits - 1),
          60000,
        );
        console.log(
          `⚠️ Rate limited ${consecutiveRateLimits} times, backing off to ${backoff / 1000}s`,
        );
        return backoff;
      }

      consecutiveRateLimits = 0; // Reset on success

      if (attemptNum === 1) return 10000; // 10s
      if (attemptNum === 2) return 15000; // 15s
      if (attemptNum === 3) return 20000; // 20s
      if (attemptNum <= 6) return 25000; // 25s
      return 30000; // 30s for later attempts
    };

    const scheduleNext = (delay) => {
      console.log(`⏰ Next poll in ${delay / 1000}s`);
      pollingTimeoutRef.current = setTimeout(pollOnce, delay);
      setPollingInterval(pollingTimeoutRef.current);
    };

    const pollOnce = async () => {
      if (activeRequestRef.current !== reqId) {
        console.log("❌ Polling cancelled");
        return;
      }

      attempts += 1;
      console.log(`🔍 Poll ${attempts}/${maxAttempts}: ${reqId.slice(-10)}`);

      try {
        const response = await fetchWithTimeout(
          "https://lancermpesabackend-production.up.railway.app/mpesa/query-stk",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ checkoutRequestID: reqId }),
          },
          20000, // 20s timeout
        );

        console.log(
          "📊 Response:",
          response.data.data?.ResultCode || "Pending",
        );

        if (response.data.status === "success" && response.data.data) {
          const { ResultCode, ResultDesc } = response.data.data;

          if (ResultCode === "0" || ResultCode === 0) {
            console.log("✅ Payment confirmed!");
            stopPolling();
            await handlePaymentSuccess(reqId);
            return;
          }

          if (
            (ResultCode === "1032" || ResultCode === "1037") &&
            attempts <= 6
          ) {
            console.log(
              `⏳ Code ${ResultCode} at attempt ${attempts}, continuing...`,
            );
          } else if (
            ResultCode !== undefined &&
            ResultCode !== null &&
            ResultCode !== "0" &&
            ResultCode !== 0
          ) {
            console.log(`❌ Failed: ${ResultCode}`);
            stopPolling();
            await handlePaymentFailure(
              reqId,
              ResultDesc || getErrorMessage(ResultCode),
            );
            return;
          }

          console.log("⏳ Still pending...");
        }

        // Schedule next poll (not rate limited)
        if (attempts < maxAttempts) {
          const delay = getDelay(attempts + 1, false);
          scheduleNext(delay);
        } else {
          console.log("⏱️ Max attempts reached");
          stopPolling();
          handlePaymentTimeout(reqId);
        }
      } catch (error) {
        const status = error?.status || error?.response?.status;
        console.error(`⚠️ Error (attempt ${attempts}):`, error.message);

        // Handle rate limiting with exponential backoff
        if (
          status === 429 ||
          error.code === "TOO_MANY_REQUESTS" ||
          error.code === "MPESA_RATE_LIMIT"
        ) {
          console.warn("⚠️ Rate limited - backing off");
          if (attempts < maxAttempts) {
            const delay = getDelay(attempts + 1, true); // Mark as rate limited
            scheduleNext(delay);
            return;
          }
        }

        // Other errors - continue with normal delay
        if (attempts < maxAttempts) {
          const delay = getDelay(attempts + 1, false);
          scheduleNext(delay);
        } else {
          console.log("⏱️ Max attempts reached");
          stopPolling();
          handlePaymentTimeout(reqId);
        }
      }
    };

    // Start after 5 seconds
    console.log("🚀 Starting polling in 10 seconds...");
    setTimeout(pollOnce, 10000);
  };

  const handlePaymentSuccess = async (reqId) => {
    try {
      console.log("Handling payment success for:", reqId);

      const { data: existingByRequest } = await supabase
        .from("transactions")
        .select("id,status")
        .eq("mpesa_checkout_request_id", reqId)
        .maybeSingle();

      if (existingByRequest?.id) {
        await supabase
          .from("transactions")
          .update({ status: "held_in_escrow" })
          .eq("id", existingByRequest.id);
      } else {
        const { data: existingByBid } = await supabase
          .from("transactions")
          .select("id,status")
          .eq("project_id", projectId)
          .eq("bid_id", bidId)
          .in("status", [
            "held_in_escrow",
            "released",
            "processing_release",
          ])
          .maybeSingle();

        if (!existingByBid?.id) {
          const { error: insertError } = await supabase
            .from("transactions")
            .insert({
              project_id: projectId,
              bid_id: bidId,
              client_id: params.clientId,
              freelancer_id: freelancerId,
              amount: parsedAmount,
              platform_fee: platformFee,
              freelancer_amount: freelancerAmount,
              status: "held_in_escrow",
              payment_method: "mpesa",
              mpesa_checkout_request_id: reqId,
            })
            .select()
            .single();

          if (insertError) {
            throw insertError;
          }
        }
      }

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

      if (freelancerId) {
        await PostNotifications({
          senderid: params.clientId,
          receiveid: freelancerId,
          title: "accepted your bid",
          createdat: new Date().toISOString(),
          data: JSON.stringify({
            receiverid: freelancerId,
            project_id: projectId,
            bidId,
            type: "proposal_accepted",
          }),
        });
      }

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
              onPress: () => router.replace(`/(description)/${projectId}`),
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
      console.log("Handling payment failure:", reqId, reason);

      await supabase
        .from("transactions")
        .update({ status: "failed", failure_reason: reason })
        .eq("mpesa_checkout_request_id", reqId);

      setPaymentStatus("failed");
      setErrorMessage(reason || "Payment was not completed");

      // Special message for timeout/cancelled
      const isCancelled =
        reason.includes("Cancelled") || reason.includes("timeout");

      Alert.alert(
        isCancelled ? "Payment Not Completed" : "Payment Failed",
        isCancelled
          ? `The M-Pesa prompt was not completed in time. This usually happens when:\n\n• You didn't see the popup\n• Your screen was locked\n• You took too long to enter your PIN\n\nPlease try again and complete the payment within ${paymentTimeoutMinutes} minutes.`
          : reason || "Payment was not completed. Please try again.",
        [
          {
            text: "Try Again",
            onPress: () => {
              setPaymentStatus("idle");
              setErrorMessage("");
              setPhoneNumber(""); // Clear phone to avoid duplicate
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
      console.log("Handling payment timeout:", reqId);

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
            <Text style={s.statusTitle}>M-Pesa Prompt Sent!</Text>
            <Text style={s.statusDesc}>
              Check your phone NOW for the M-Pesa popup
            </Text>

            {countdown > 0 && (
              <View style={s.countdownContainer}>
                <Clock size={16} color="#DC2626" />
                <Text style={s.countdownText}>
                  Complete within {Math.floor(countdown / 60)}:
                  {(countdown % 60).toString().padStart(2, "0")}
                </Text>
              </View>
            )}

            <View style={s.warningBox}>
              <AlertCircle size={20} color="#DC2626" />
              <Text style={s.warningText}>
                ⚠️ You have about {paymentTimeoutMinutes} minutes to enter your
                PIN. Don't dismiss the prompt!
              </Text>
            </View>

            <View style={s.instructionBox}>
              <View style={s.instructionStep}>
                <View style={s.stepNumber}>
                  <Text style={s.stepNumberText}>1</Text>
                </View>
                <Text style={s.instructionText}>
                  Look for M-Pesa popup on your phone
                </Text>
              </View>
              <View style={s.instructionStep}>
                <View style={s.stepNumber}>
                  <Text style={s.stepNumberText}>2</Text>
                </View>
                <Text style={s.instructionText}>
                  Enter your M-Pesa PIN quickly
                </Text>
              </View>
              <View style={s.instructionStep}>
                <View style={s.stepNumber}>
                  <Text style={s.stepNumberText}>3</Text>
                </View>
                <Text style={s.instructionText}>
                  Press OK to confirm payment
                </Text>
              </View>
            </View>

            <View style={s.troubleshootBox}>
              <Text style={s.troubleshootTitle}>Don't see the prompt?</Text>
              <Text style={s.troubleshootText}>
                • Unlock your phone{"\n"}• Check if it's hidden behind other
                apps{"\n"}• Wait a few seconds, it may be delayed{"\n"}• Try
                again if it doesn't appear in 30 seconds
              </Text>
            </View>

            <TouchableOpacity
              style={s.cancelBtn}
              onPress={() => {
                stopPolling();
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
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FEF2F2",
    borderWidth: 2,
    borderColor: "#FEE2E2",
    borderRadius: 12,
    padding: 14,
    width: "100%",
    marginTop: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: "#DC2626",
    lineHeight: 18,
    fontWeight: "600",
  },
  troubleshootBox: {
    width: "100%",
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  troubleshootTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#92400E",
    marginBottom: 8,
  },
  troubleshootText: {
    fontSize: 12,
    color: "#78350F",
    lineHeight: 18,
  },
});
