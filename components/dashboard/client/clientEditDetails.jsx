import { useTheme } from "@/hooks/ThemeContext";
import { useAuth } from "@/hooks/useAuth";
import { Check, Save, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../../lib/Client";

const initialForm = {
  full_name: "",
  position: "",
  location: "",
  bio: "",
  company_name: "",
  company_website: "",
  phone_number: "",
  about_company: "",
};

const normalizeWebsite = (value) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

export default function ClientEditDetails({ onSaved, onCancel }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(theme);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientProfileId, setClientProfileId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [baseline, setBaseline] = useState(initialForm);

  useEffect(() => {
    if (user?.id) {
      loadDetails();
    }
  }, [user?.id]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(baseline),
    [form, baseline],
  );

  const validationErrors = useMemo(() => {
    const errors = {};

    if (!form.full_name.trim()) {
      errors.full_name = "Full name is required.";
    }
    if (!form.company_name.trim()) {
      errors.company_name = "Company name is required.";
    }
    if (form.company_website.trim()) {
      try {
        const normalized = normalizeWebsite(form.company_website);
        const parsed = new URL(normalized);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          errors.company_website = "Website must be a valid URL.";
        }
      } catch {
        errors.company_website = "Website must be a valid URL.";
      }
    }

    return errors;
  }, [form]);

  const canSave =
    isDirty && !saving && Object.keys(validationErrors).length === 0 && !!user?.id;

  const loadDetails = async () => {
    try {
      setLoading(true);

      const { data: userProfile, error: userError } = await supabase
        .from("profiles")
        .select("full_name, position, location, bio")
        .eq("id", user.id)
        .maybeSingle();
      if (userError) throw userError;

      const { data: clientProfile, error: clientError } = await supabase
        .from("client_profiles")
        .select(
          "id, company_name, company_website, phone_number, about_company, user_id",
        )
        .eq("user_id", user.id)
        .maybeSingle();
      if (clientError) throw clientError;

      const merged = {
        full_name: userProfile?.full_name || "",
        position: userProfile?.position || "",
        location: userProfile?.location || "",
        bio: userProfile?.bio || "",
        company_name: clientProfile?.company_name || "",
        company_website: clientProfile?.company_website || "",
        phone_number: clientProfile?.phone_number || "",
        about_company: clientProfile?.about_company || "",
      };

      setForm(merged);
      setBaseline(merged);
      setClientProfileId(clientProfile?.id || null);
    } catch (error) {
      console.error("Failed to load client details:", error);
      Alert.alert(
        "Error",
        "Could not load your details. Please pull to refresh or try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleDiscard = () => {
    if (!isDirty) {
      onCancel?.();
      return;
    }

    Alert.alert("Discard changes?", "All unsaved changes will be lost.", [
      { text: "Keep editing", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          setForm(baseline);
          onCancel?.();
        },
      },
    ]);
  };

  const handleSave = async () => {
    if (!user?.id || !canSave) return;

    try {
      setSaving(true);

      const website = normalizeWebsite(form.company_website);

      const { error: userUpdateError } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name.trim(),
          position: form.position.trim(),
          location: form.location.trim(),
          bio: form.bio.trim(),
        })
        .eq("id", user.id);

      if (userUpdateError) throw userUpdateError;

      const payload = {
        user_id: user.id,
        company_name: form.company_name.trim(),
        company_website: website,
        phone_number: form.phone_number.trim(),
        about_company: form.about_company.trim(),
        updated_at: new Date().toISOString(),
      };

      let clientError = null;

      if (clientProfileId) {
        const { error } = await supabase
          .from("client_profiles")
          .update(payload)
          .eq("id", clientProfileId);
        clientError = error;
      } else {
        const { data, error } = await supabase
          .from("client_profiles")
          .insert(payload)
          .select("id")
          .single();
        clientError = error;
        if (!error && data?.id) {
          setClientProfileId(data.id);
        }
      }

      if (clientError) throw clientError;

      const nextBaseline = { ...form, company_website: website };
      setForm(nextBaseline);
      setBaseline(nextBaseline);

      Alert.alert("Saved", "Your details have been updated.");
      onSaved?.(nextBaseline);
    } catch (error) {
      console.error("Failed to save client details:", error);
      Alert.alert("Error", error?.message || "Failed to save details.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading details...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Edit Client Details</Text>
        <Text style={styles.subtitle}>
          Keep your personal and company details up to date.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal</Text>

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={[styles.input, validationErrors.full_name && styles.inputError]}
            value={form.full_name}
            onChangeText={(text) => updateField("full_name", text)}
            placeholder="John Doe"
            placeholderTextColor={theme.textMuted}
          />
          {validationErrors.full_name && (
            <Text style={styles.errorText}>{validationErrors.full_name}</Text>
          )}

          <Text style={styles.label}>Position</Text>
          <TextInput
            style={styles.input}
            value={form.position}
            onChangeText={(text) => updateField("position", text)}
            placeholder="Founder / Project Manager"
            placeholderTextColor={theme.textMuted}
          />

          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            value={form.location}
            onChangeText={(text) => updateField("location", text)}
            placeholder="Nairobi, Kenya"
            placeholderTextColor={theme.textMuted}
          />

          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.bio}
            onChangeText={(text) => updateField("bio", text)}
            placeholder="Tell freelancers about your background..."
            placeholderTextColor={theme.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Company</Text>

          <Text style={styles.label}>Company Name</Text>
          <TextInput
            style={[
              styles.input,
              validationErrors.company_name && styles.inputError,
            ]}
            value={form.company_name}
            onChangeText={(text) => updateField("company_name", text)}
            placeholder="Acme Corporation"
            placeholderTextColor={theme.textMuted}
          />
          {validationErrors.company_name && (
            <Text style={styles.errorText}>{validationErrors.company_name}</Text>
          )}

          <Text style={styles.label}>Website</Text>
          <TextInput
            style={[
              styles.input,
              validationErrors.company_website && styles.inputError,
            ]}
            value={form.company_website}
            onChangeText={(text) => updateField("company_website", text)}
            placeholder="https://company.com"
            placeholderTextColor={theme.textMuted}
            keyboardType="url"
            autoCapitalize="none"
          />
          {validationErrors.company_website && (
            <Text style={styles.errorText}>{validationErrors.company_website}</Text>
          )}

          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            value={form.phone_number}
            onChangeText={(text) => updateField("phone_number", text)}
            placeholder="+254 700 123 456"
            placeholderTextColor={theme.textMuted}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>About Company</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.about_company}
            onChangeText={(text) => updateField("about_company", text)}
            placeholder="Describe what your company does..."
            placeholderTextColor={theme.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleDiscard}
          disabled={saving}
          activeOpacity={0.8}
        >
          <X size={16} color={theme.text} />
          <Text style={styles.secondaryButtonText}>Discard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.primaryButton,
            (!canSave || saving) && styles.primaryButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={!canSave || saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              {isDirty ? (
                <Save size={16} color="#fff" />
              ) : (
                <Check size={16} color="#fff" />
              )}
              <Text style={styles.primaryButtonText}>
                {isDirty ? "Save Changes" : "Saved"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.background,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: theme.textSecondary,
    },
    scroll: {
      flex: 1,
    },
    content: {
      padding: 16,
      paddingBottom: 120,
      gap: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.text,
    },
    subtitle: {
      marginTop: 4,
      fontSize: 14,
      color: theme.textSecondary,
    },
    card: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      padding: 14,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 12,
    },
    label: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.textSecondary,
      marginBottom: 6,
      marginTop: 8,
    },
    input: {
      backgroundColor: theme.inputBg,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.text,
      fontSize: 14,
    },
    textArea: {
      minHeight: 96,
    },
    inputError: {
      borderColor: theme.error,
    },
    errorText: {
      marginTop: 6,
      fontSize: 12,
      color: theme.error,
    },
    actions: {
      position: "absolute",
      left: 12,
      right: 12,
      bottom: 12,
      flexDirection: "row",
      gap: 10,
    },
    button: {
      flex: 1,
      minHeight: 48,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    secondaryButton: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    primaryButton: {
      backgroundColor: theme.primary,
    },
    primaryButtonDisabled: {
      opacity: 0.6,
    },
    primaryButtonText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 14,
    },
    secondaryButtonText: {
      color: theme.text,
      fontWeight: "600",
      fontSize: 14,
    },
  });
