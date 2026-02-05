import { useTheme } from "@/hooks/ThemeContext";
import { useAuth } from "@/hooks/useAuth";
import { FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { z } from "zod";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters");
const nameSchema = z.string().min(2, "Name must be at least 2 characters");

export default function AuthScreen() {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [errors, setErrors] = useState({});

  const {
    signIn,
    signUp,
    signInWithGoogle,
    user,
    userRole,
    isGoogleLoading,
    loadingMessage,
  } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      if (!userRole) {
        router.replace("/selectRole");
      } else if (userRole === "freelancer") {
        router.replace("/(ftab)/home");
      } else {
        router.replace("/(tab)/home");
      }
    }
  }, [user, userRole]);

  const validateForm = () => {
    const newErrors = {};

    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success && emailResult.error?.errors?.[0]) {
      newErrors.email = emailResult.error.errors[0].message;
    }

    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success && passwordResult.error?.errors?.[0]) {
      newErrors.password = passwordResult.error.errors[0].message;
    }

    if (isSignUp) {
      const nameResult = nameSchema.safeParse(fullName);
      if (!nameResult.success && nameResult.error?.errors?.[0]) {
        newErrors.name = nameResult.error.errors[0].message;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setIsLoading(true);

    try {
      if (isSignUp) {
        const result = await signUp(email, password, fullName);
        if (result?.error) {
          Alert.alert("Sign Up Failed", result.error.message);
        }
      } else {
        const result = await signIn(email, password);
        if (result?.error) {
          Alert.alert("Sign In Failed", "Invalid email or password");
        }
      }
    } catch (error) {
      Alert.alert("Error", "An unexpected error occurred");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithGoogle();
      if (result?.error) {
        Alert.alert("Google Sign In Failed", result.error.message);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to sign in with Google");
      console.error(error);
    }
  };
  // Loading Overlay Component
  const LoadingOverlay = () => {
    if (!isGoogleLoading) return null;

    return (
      <Modal
        transparent={true}
        visible={isGoogleLoading}
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#14A800" />
            <Text style={styles.loadingText}>
              {loadingMessage || "Signing in with Google..."}
            </Text>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoBox}>
            <FontAwesome5 name="briefcase" size={28} color="#fff" />
          </View>
          <Text style={styles.logoText}>FreelanceHub</Text>
        </View>

        {/* Tagline */}
        <Text style={styles.tagline}>
          {isSignUp
            ? "Join thousands of freelancers and clients"
            : "Welcome back! Let's get to work"}
        </Text>

        {/* Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.title}>
              {isSignUp ? "Create Account" : "Sign In"}
            </Text>
            <Text style={styles.subtitle}>
              {isSignUp
                ? "Start your freelance journey today"
                : "Continue to your dashboard"}
            </Text>
          </View>

          {/* Google Sign In Button - Prominent Position */}
          <Pressable
            style={[
              styles.googleButton,
              isGoogleLoading && styles.googleButtonLoading,
            ]}
            onPress={handleGoogleSignIn}
            disabled={isGoogleLoading}
          >
            {isGoogleLoading ? (
              <ActivityIndicator color={theme.text} />
            ) : (
              <>
                <FontAwesome5 name="google" size={20} color="#EA4335" />
                <Text style={styles.googleText}>Continue with Google</Text>
              </>
            )}
          </Pressable>

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Form Inputs */}
          {isSignUp && (
            <View style={styles.inputContainer}>
              <Input
                icon="person"
                placeholder="Full Name"
                value={fullName}
                onChangeText={setFullName}
                theme={theme}
                autoCapitalize="words"
              />
              {errors.name && <ErrorText text={errors.name} theme={theme} />}
            </View>
          )}

          <View style={styles.inputContainer}>
            <Input
              icon="email"
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              theme={theme}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {errors.email && <ErrorText text={errors.email} theme={theme} />}
          </View>

          <View style={styles.inputContainer}>
            <Input
              icon="lock"
              placeholder="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              theme={theme}
            />
            {errors.password && (
              <ErrorText text={errors.password} theme={theme} />
            )}
          </View>

          {/* Submit Button */}
          <Pressable
            style={[
              styles.primaryButton,
              (isLoading || isGoogleLoading) && styles.primaryButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isLoading || isGoogleLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {isSignUp ? "Create Account" : "Sign In"}
              </Text>
            )}
          </Pressable>

          {/* Forgot Password */}
          {!isSignUp && (
            <Pressable style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </Pressable>
          )}

          {/* Switch Auth Mode */}
          <View style={styles.switchContainer}>
            <Text style={styles.switchText}>
              {isSignUp ? "Already have an account?" : "Don't have an account?"}
            </Text>
            <Pressable
              onPress={() => {
                setIsSignUp(!isSignUp);
                setErrors({});
              }}
            >
              <Text style={styles.switchLink}>
                {isSignUp ? "Sign In" : "Sign Up"}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By continuing, you agree to our{" "}
            <Text style={styles.footerLink}>Terms of Service</Text> and{" "}
            <Text style={styles.footerLink}>Privacy Policy</Text>
          </Text>
        </View>
      </ScrollView>
      {/* Loading Overlay */}
      <LoadingOverlay />
    </KeyboardAvoidingView>
  );
}

/* ================= COMPONENTS ================= */

const Input = ({ icon, theme, ...props }) => {
  const styles = createStyles(theme);

  return (
    <View style={styles.inputWrapper}>
      <MaterialIcons name={icon} size={20} color={theme.textMuted} />
      <TextInput
        style={styles.input}
        placeholderTextColor={theme.textMuted}
        {...props}
      />
    </View>
  );
};

const ErrorText = ({ text, theme }) => {
  const styles = createStyles(theme);
  return <Text style={styles.errorText}>{text}</Text>;
};

/* ================= STYLES ================= */

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollContent: {
      flexGrow: 1,
      padding: 20,
      justifyContent: "center",
      paddingTop: 60,
      paddingBottom: 40,
    },
    logoContainer: {
      alignItems: "center",
      marginBottom: 16,
      flexDirection: "row",
      justifyContent: "center",
      gap: 12,
    },
    logoBox: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: "#14A800",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#14A800",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    logoText: {
      fontSize: 28,
      fontWeight: "900",
      color: theme.text,
      letterSpacing: -0.5,
    },
    tagline: {
      textAlign: "center",
      fontSize: 15,
      color: theme.textSecondary,
      marginBottom: 32,
      fontWeight: "500",
      paddingHorizontal: 20,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 24,
      padding: 24,
      shadowColor: theme.shadowColor,
      shadowOpacity: 0.1,
      shadowRadius: 20,
      elevation: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardHeader: {
      marginBottom: 24,
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      textAlign: "center",
      color: theme.text,
      marginBottom: 8,
      letterSpacing: -0.5,
    },
    subtitle: {
      textAlign: "center",
      color: theme.textSecondary,
      fontSize: 14,
      fontWeight: "500",
    },
    googleButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      height: 52,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: theme.border,
      gap: 12,
      backgroundColor: theme.background,
      marginBottom: 20,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    googleButtonLoading: {
      opacity: 0.6,
    },
    googleText: {
      fontWeight: "700",
      fontSize: 15,
      color: theme.text,
      letterSpacing: 0.2,
    },
    dividerContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 20,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.border,
    },
    dividerText: {
      marginHorizontal: 16,
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1,
    },
    inputContainer: {
      marginBottom: 16,
    },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: theme.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      height: 52,
      backgroundColor: theme.background,
    },
    input: {
      flex: 1,
      marginLeft: 12,
      fontSize: 15,
      color: theme.text,
      fontWeight: "500",
    },
    errorText: {
      color: theme.error,
      fontSize: 12,
      marginTop: 6,
      marginLeft: 4,
      fontWeight: "600",
    },
    primaryButton: {
      backgroundColor: "#14A800",
      height: 52,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 8,
      shadowColor: "#14A800",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    primaryButtonDisabled: {
      opacity: 0.6,
    },
    primaryButtonText: {
      color: "#fff",
      fontWeight: "800",
      fontSize: 16,
      letterSpacing: 0.3,
    },
    forgotPassword: {
      alignItems: "center",
      marginTop: 16,
    },
    forgotPasswordText: {
      color: theme.primary,
      fontSize: 14,
      fontWeight: "600",
    },
    switchContainer: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginTop: 20,
      gap: 6,
    },
    switchText: {
      color: theme.textSecondary,
      fontSize: 14,
      fontWeight: "500",
    },
    switchLink: {
      color: "#14A800",
      fontWeight: "800",
      fontSize: 14,
    },
    footer: {
      marginTop: 32,
      paddingHorizontal: 20,
    },
    footerText: {
      textAlign: "center",
      fontSize: 12,
      color: theme.textMuted,
      lineHeight: 18,
    },
    footerLink: {
      color: theme.primary,
      fontWeight: "600",
    },
    loadingOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
    },
    loadingContainer: {
      backgroundColor: theme.surface,
      padding: 30,
      borderRadius: 20,
      alignItems: "center",
      width: "80%",
      maxWidth: 300,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 10,
    },
    loadingText: {
      marginTop: 20,
      fontSize: 16,
      fontWeight: "600",
      color: theme.text,
      textAlign: "center",
    },
  });
