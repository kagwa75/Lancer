import {
  CheckCircle,
  CreditCard,
  Shield,
  Smartphone,
  X,
} from "lucide-react-native";
import React from "react";
import {
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width } = Dimensions.get("window");

export default function PaymentMethodModal({
  visible,
  onClose,
  onSelectStripe,
  onSelectMpesa,
  amount,
}) {
  const scaleAnim = React.useRef(new Animated.Value(0.9)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <Animated.View style={[s.overlay, { opacity: opacityAnim }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View
          style={[
            s.container,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={s.header}>
            <View style={s.headerIconWrapper}>
              <Shield size={28} color="#2563EB" />
            </View>
            <View style={s.headerText}>
              <Text style={s.title}>Secure Payment</Text>
              <Text style={s.subtitle}>
                Choose your preferred payment method
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Amount Display */}
          <View style={s.amountCard}>
            <Text style={s.amountLabel}>Total Amount</Text>
            <Text style={s.amountValue}>${amount?.toFixed(2)}</Text>
            <Text style={s.amountNote}>Held in secure escrow</Text>
          </View>

          {/* Payment Options */}
          <View style={s.options}>
            {/* M-Pesa Option - Featured */}
            <TouchableOpacity
              style={[s.option, s.optionFeatured]}
              onPress={onSelectMpesa}
              activeOpacity={0.7}
            >
              <View style={s.optionBadge}>
                <Text style={s.badgeText}>POPULAR</Text>
              </View>
              <View style={s.optionContent}>
                <View
                  style={[s.optionIconLarge, { backgroundColor: "#DCFCE7" }]}
                >
                  <Smartphone size={32} color="#16A34A" />
                </View>
                <View style={s.optionTextContainer}>
                  <View style={s.optionTitleRow}>
                    <Text style={s.optionTitleLarge}>M-Pesa</Text>
                    <View style={s.instantBadge}>
                      <Text style={s.instantText}>⚡ Instant</Text>
                    </View>
                  </View>
                  <Text style={s.optionDescLarge}>
                    Pay instantly with mobile money
                  </Text>
                  <View style={s.features}>
                    <View style={s.feature}>
                      <CheckCircle size={14} color="#16A34A" />
                      <Text style={s.featureText}>No card needed</Text>
                    </View>
                    <View style={s.feature}>
                      <CheckCircle size={14} color="#16A34A" />
                      <Text style={s.featureText}>Enter PIN on phone</Text>
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>

            {/* Stripe Option */}
            <TouchableOpacity
              style={s.option}
              onPress={onSelectStripe}
              activeOpacity={0.7}
            >
              <View style={s.optionContent}>
                <View style={s.optionIcon}>
                  <CreditCard size={24} color="#635BFF" />
                </View>
                <View style={s.optionText}>
                  <Text style={s.optionTitle}>Card Payment</Text>
                  <Text style={s.optionDesc}>Visa, Mastercard, Amex</Text>
                </View>
                <View style={s.chevron}>
                  <Text style={s.chevronText}>›</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Security Footer */}
          <View style={s.securityFooter}>
            <Shield size={14} color="#6B7280" />
            <Text style={s.securityText}>
              256-bit SSL encryption • PCI DSS compliant
            </Text>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    width: "100%",
    maxWidth: 440,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 40,
    elevation: 15,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    paddingBottom: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
  },
  amountCard: {
    backgroundColor: "#F9FAFB",
    padding: 20,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  amountLabel: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "600",
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 36,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },
  amountNote: {
    fontSize: 12,
    color: "#16A34A",
    fontWeight: "600",
  },
  options: {
    padding: 20,
    gap: 12,
  },
  option: {
    backgroundColor: "#FAFAFA",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    overflow: "visible",
    position: "relative",
  },
  optionFeatured: {
    borderColor: "#16A34A",
    borderWidth: 2.5,
    backgroundColor: "#F0FDF4",
    shadowColor: "#16A34A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  optionBadge: {
    position: "absolute",
    top: -10,
    right: 12,
    backgroundColor: "#16A34A",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: 0.5,
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  optionIconLarge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: {
    flex: 1,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  optionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  optionTitleLarge: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  instantBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  instantText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#D97706",
  },
  optionDesc: {
    fontSize: 13,
    color: "#6B7280",
  },
  optionDescLarge: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 10,
  },
  features: {
    gap: 6,
  },
  feature: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  featureText: {
    fontSize: 13,
    color: "#15803D",
    fontWeight: "600",
  },
  chevron: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  chevronText: {
    fontSize: 24,
    color: "#9CA3AF",
    fontWeight: "600",
  },
  securityFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 16,
    backgroundColor: "#F9FAFB",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  securityText: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
  },
});
