import { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { supabase } from "../lib/Client";
import { useAuth } from "./useAuth";

const ThemeContext = createContext(undefined);

export const lightTheme = {
  // Background colors
  background: "#f9fafb",
  surface: "#ffffff",
  surfaceAlt: "#f3f4f6",

  // Text colors
  text: "#111827",
  textSecondary: "#6b7280",
  textMuted: "#9ca3af",

  // Primary colors
  primary: "#3b82f6",
  primaryLight: "#60a5fa",
  primaryDark: "#2563eb",

  // Status colors
  success: "#10b981",
  successBg: "#dcfce7",
  successText: "#166534",

  warning: "#f59e0b",
  warningBg: "#fef3c7",
  warningText: "#92400e",

  error: "#ef4444",
  errorBg: "#fee2e2",
  errorText: "#991b1b",

  info: "#3b82f6",
  infoBg: "#dbeafe",
  infoText: "#1e40af",

  // UI elements
  border: "#e5e7eb",
  borderLight: "#f3f4f6",
  divider: "#e5e7eb",

  // Badges
  freelancerBadge: "#dbeafe",
  clientBadge: "#fef3c7",

  // Icons
  icon: "#3b82f6",
  iconBg: "#eff6ff",
  iconDanger: "#dc2626",
  iconDangerBg: "#fee2e2",

  // Card
  cardBg: "#ffffff",
  cardHighlight: "#eef5ff",

  // Input
  inputBg: "#f9fafb",
  inputBorder: "#e5e7eb",
  inputPlaceholder: "#9ca3af",

  // Button
  buttonPrimary: "#3b82f6",
  buttonPrimaryDisabled: "#93c5fd",
  buttonSecondary: "#6b7280",

  // Modal
  modalOverlay: "rgba(0, 0, 0, 0.5)",

  // Shadow
  shadowColor: "#000",

  // Chart colors
  chart1: "#3b82f6",
  chart2: "#10b981",
  chart3: "#f59e0b",
  chart4: "#ef4444",
};

export const darkTheme = {
  // Background colors
  background: "#111827",
  surface: "#1f2937",
  surfaceAlt: "#374151",

  // Text colors
  text: "#f9fafb",
  textSecondary: "#d1d5db",
  textMuted: "#9ca3af",

  // Primary colors
  primary: "#60a5fa",
  primaryLight: "#93c5fd",
  primaryDark: "#3b82f6",

  // Status colors
  success: "#34d399",
  successBg: "#065f46",
  successText: "#d1fae5",

  warning: "#fbbf24",
  warningBg: "#78350f",
  warningText: "#fef3c7",

  error: "#f87171",
  errorBg: "#7f1d1d",
  errorText: "#fee2e2",

  info: "#60a5fa",
  infoBg: "#1e3a8a",
  infoText: "#dbeafe",

  // UI elements
  border: "#374151",
  borderLight: "#4b5563",
  divider: "#374151",

  // Badges
  freelancerBadge: "#1e3a8a",
  clientBadge: "#78350f",

  // Icons
  icon: "#60a5fa",
  iconBg: "#1e3a8a",
  iconDanger: "#ef4444",
  iconDangerBg: "#7f1d1d",

  // Card
  cardBg: "#1f2937",
  cardHighlight: "#1e3a8a",

  // Input
  inputBg: "#374151",
  inputBorder: "#4b5563",
  inputPlaceholder: "#9ca3af",

  // Button
  buttonPrimary: "#3b82f6",
  buttonPrimaryDisabled: "#1e40af",
  buttonSecondary: "#4b5563",

  // Modal
  modalOverlay: "rgba(0, 0, 0, 0.7)",

  // Shadow
  shadowColor: "#000",

  // Chart colors
  chart1: "#60a5fa",
  chart2: "#34d399",
  chart3: "#fbbf24",
  chart4: "#f87171",
};

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const systemColorScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemColorScheme === "dark");
  const [loading, setLoading] = useState(true);

  // Load user's theme preference from database
  useEffect(() => {
    if (user) {
      loadThemePreference();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadThemePreference = async () => {
    try {
      const { data } = await supabase
        .from("user_settings")
        .select("dark_mode")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (data && data.dark_mode !== null) {
        setIsDark(data.dark_mode);
      }
    } catch (error) {
      console.error("Error loading theme preference:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTheme = async () => {
    const newValue = !isDark;
    setIsDark(newValue);

    if (user) {
      try {
        await supabase.from("user_settings").upsert(
          {
            user_id: user.id,
            dark_mode: newValue,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
      } catch (error) {
        console.error("Error saving theme preference:", error);
        // Revert on error
        setIsDark(!newValue);
      }
    }
  };

  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, loading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
