import { useTheme } from "@/hooks/ThemeContext";
import { useAuth } from "@/hooks/useAuth";
import { router } from "expo-router";
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  ChevronRight,
  Globe,
  HelpCircle,
  Lock,
  Mail,
  Moon,
  Shield,
  Trash2,
  Users,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "../../lib/Client";
import {
  getNotificationPermissionStatus,
  registerForPushNotificationsAsync,
  removePushTokenFromDatabase,
  requestNotificationPermissions,
  savePushTokenToDatabase,
  schedulePushNotification,
} from "../../lib/NotificationService";
import {
  ClientTranscations,
  FreeLancerBids,
  progressProjects,
} from "../../lib/supabase";

export default function SettingsScreen() {
  const { user, userRole, updateUserRole } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [currentRole, setCurrentRole] = useState(userRole);
  const [settings, setSettings] = useState({
    notifications: true,
    emailAlerts: true,
  });

  const [activeCommitments, setActiveCommitments] = useState({
    hasAcceptedBids: false,
    hasEscrowProjects: false,
    hasInProgressProjects: false,
    acceptedBidsCount: 0,
    escrowProjectsCount: 0,
    inProgressProjectsCount: 0,
  });

  // Modals
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [deleteAccountModalVisible, setDeleteAccountModalVisible] =
    useState(false);

  // Password change fields
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    if (user && userRole) {
      loadUserSettings();
      checkActiveCommitments();
    }
  }, [user, userRole]);

  const checkActiveCommitments = async () => {
    try {
      if (userRole === "freelancer") {
        const { data: acceptedBids, error: bidsError } = await FreeLancerBids(
          user.id,
        );

        if (bidsError) throw bidsError;

        const hasAccepted = acceptedBids && acceptedBids.length > 0;

        setActiveCommitments((prev) => ({
          ...prev,
          hasAcceptedBids: hasAccepted,
          acceptedBidsCount: acceptedBids?.length || 0,
        }));
      } else if (userRole === "client") {
        const { data: escrowTransactions, error: escrowError } =
          await ClientTranscations(user.id);

        if (escrowError) throw escrowError;

        const { data: inProgressProjects, error: projectsError } =
          await progressProjects(user.id);

        if (projectsError) throw projectsError;

        const hasEscrow = escrowTransactions && escrowTransactions.length > 0;
        const hasInProgress =
          inProgressProjects && inProgressProjects.length > 0;

        setActiveCommitments((prev) => ({
          ...prev,
          hasEscrowProjects: hasEscrow,
          hasInProgressProjects: hasInProgress,
          escrowProjectsCount: escrowTransactions?.length || 0,
          inProgressProjectsCount: inProgressProjects?.length || 0,
        }));
      }
    } catch (error) {
      console.error("Error checking active commitments:", error);
    }
  };

  const loadUserSettings = async () => {
    try {
      setLoading(true);
      setCurrentRole(userRole);

      const { data: userSettings } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (userSettings) {
        setSettings({
          notifications: userSettings.notifications ?? true,
          emailAlerts: userSettings.email_alerts ?? true,
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationToggle = async () => {
    const newValue = !settings.notifications;

    if (newValue) {
      // User wants to enable notifications
      const permissionStatus = await getNotificationPermissionStatus();

      if (permissionStatus !== "granted") {
        const granted = await requestNotificationPermissions();

        if (!granted) {
          Alert.alert(
            "Permission Denied",
            "Please enable notifications in your device settings to receive updates.",
            [
              {
                text: "Open Settings",
                onPress: () => Linking.openSettings(),
              },
              { text: "Cancel" },
            ],
          );
          return;
        }
      }

      // Register for push notifications
      const token = await registerForPushNotificationsAsync();

      if (token) {
        await savePushTokenToDatabase(user?.id, token);

        // Update settings
        await toggleSetting("notifications", newValue);

        // Send test notification
        Alert.alert(
          "Notifications Enabled",
          "You will now receive push notifications for important updates.",
          [
            {
              text: "Send Test",
              onPress: () =>
                schedulePushNotification(
                  "Test Notification",
                  "Notifications are working! 🎉",
                ),
            },
            { text: "OK" },
          ],
        );
      } else {
        Alert.alert(
          "Error",
          "Failed to register for push notifications. Please try again.",
        );
      }
    } else {
      // User wants to disable notifications
      await removePushTokenFromDatabase(user?.id);
      await toggleSetting("notifications", newValue);

      Alert.alert(
        "Notifications Disabled",
        "You will no longer receive push notifications.",
      );
    }
  };

  const handleRoleSwitch = async () => {
    if (!currentRole) return;

    if (currentRole === "freelancer" && activeCommitments.hasAcceptedBids) {
      Alert.alert(
        "Cannot Switch Role",
        `You have ${activeCommitments.acceptedBidsCount} active accepted bid${activeCommitments.acceptedBidsCount > 1 ? "s" : ""}. Please complete or cancel these projects before switching to a client role.`,
        [{ text: "OK" }],
      );
      return;
    }

    if (currentRole === "client") {
      const issues = [];

      if (activeCommitments.hasEscrowProjects) {
        issues.push(
          `${activeCommitments.escrowProjectsCount} project${activeCommitments.escrowProjectsCount > 1 ? "s" : ""} with funds in escrow`,
        );
      }

      if (activeCommitments.hasInProgressProjects) {
        issues.push(
          `${activeCommitments.inProgressProjectsCount} in-progress project${activeCommitments.inProgressProjectsCount > 1 ? "s" : ""}`,
        );
      }

      if (issues.length > 0) {
        Alert.alert(
          "Cannot Switch Role",
          `You have active commitments:\n\n• ${issues.join("\n• ")}\n\nPlease complete or resolve these before switching to a freelancer role.`,
          [{ text: "OK" }],
        );
        return;
      }
    }

    Alert.alert(
      "Switch Role",
      `Are you sure you want to switch from ${currentRole} to ${
        currentRole === "freelancer" ? "client" : "freelancer"
      }? This will change your dashboard and available features.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Switch",
          onPress: async () => {
            try {
              setSwitching(true);
              const newRole =
                currentRole === "freelancer" ? "client" : "freelancer";

              if (newRole === "client") {
                const { error: clientError } = await supabase
                  .from("client_profiles")
                  .insert({
                    user_id: user?.id,
                    company_name: "",
                    created_at: new Date().toISOString(),
                  });

                if (clientError) throw clientError;

                const { error } = await supabase
                  .from("freelancer_profiles")
                  .delete()
                  .eq("user_id", user?.id);

                if (error) throw error;

                const { error: RoleError } = await supabase
                  .from("user_roles")
                  .delete()
                  .eq("user_id", user?.id);
                if (RoleError) throw RoleError;

                const { error: InsertRoleError } = await supabase
                  .from("user_roles")
                  .insert({
                    user_id: user.id,
                    role: "client",
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  });
                if (InsertRoleError) throw InsertRoleError;

                updateUserRole("client");
              } else {
                const { error: freelancerError } = await supabase
                  .from("freelancer_profiles")
                  .insert({
                    user_id: user?.id,
                    title: "",
                    created_at: new Date().toISOString(),
                  });

                if (freelancerError) throw freelancerError;

                const { error } = await supabase
                  .from("client_profiles")
                  .delete()
                  .eq("user_id", user?.id);

                if (error) throw error;

                const { error: RoleError } = await supabase
                  .from("user_roles")
                  .delete()
                  .eq("user_id", user?.id);
                if (RoleError) throw RoleError;

                const { error: InsertRoleError } = await supabase
                  .from("user_roles")
                  .insert({
                    user_id: user.id,
                    role: "freelancer",
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  });
                if (InsertRoleError) throw InsertRoleError;

                updateUserRole("freelancer");
              }

              setCurrentRole(newRole);

              Alert.alert(
                "Success",
                `Successfully switched to ${newRole} role. Redirecting to dashboard...`,
                [
                  {
                    text: "OK",
                    onPress: () => {
                      router.replace(
                        newRole === "freelancer"
                          ? "/(ftab)/home"
                          : "/(tab)/home",
                      );
                    },
                  },
                ],
              );
            } catch (error) {
              console.error("Error switching role:", error);
              Alert.alert("Error", "Failed to switch role. Please try again.");
            } finally {
              setSwitching(false);
            }
          },
        },
      ],
    );
  };

  const toggleSetting = async (key, value = null) => {
    const newValue = value !== null ? value : !settings[key];
    setSettings((prev) => ({ ...prev, [key]: newValue }));

    try {
      setSavingSettings(true);

      const dbColumnMap = {
        notifications: "notifications",
        emailAlerts: "email_alerts",
      };

      const { error } = await supabase.from("user_settings").upsert(
        {
          user_id: user?.id,
          [dbColumnMap[key]]: newValue,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

      if (error) throw error;
    } catch (error) {
      console.error("Error saving setting:", error);
      setSettings((prev) => ({ ...prev, [key]: !newValue }));
      Alert.alert("Error", "Failed to save setting. Please try again.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleChangePassword = async () => {
    const { currentPassword, newPassword, confirmPassword } = passwordData;

    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters long");
      return;
    }

    try {
      setSavingSettings(true);

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      Alert.alert("Success", "Password changed successfully");
      setPasswordModalVisible(false);
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      console.error("Error changing password:", error);
      Alert.alert("Error", "Failed to change password. Please try again.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteAccount = async () => {
    const hasCommitments =
      activeCommitments.hasAcceptedBids ||
      activeCommitments.hasEscrowProjects ||
      activeCommitments.hasInProgressProjects;

    if (hasCommitments) {
      const issues = [];

      if (activeCommitments.hasAcceptedBids) {
        issues.push(
          `${activeCommitments.acceptedBidsCount} accepted bid${activeCommitments.acceptedBidsCount > 1 ? "s" : ""}`,
        );
      }
      if (activeCommitments.hasEscrowProjects) {
        issues.push(
          `${activeCommitments.escrowProjectsCount} project${activeCommitments.escrowProjectsCount > 1 ? "s" : ""} in escrow`,
        );
      }
      if (activeCommitments.hasInProgressProjects) {
        issues.push(
          `${activeCommitments.inProgressProjectsCount} in-progress project${activeCommitments.inProgressProjectsCount > 1 ? "s" : ""}`,
        );
      }

      Alert.alert(
        "Cannot Delete Account",
        `You have active commitments:\n\n• ${issues.join("\n• ")}\n\nPlease complete or resolve these before deleting your account.`,
        [{ text: "OK" }],
      );
      return;
    }

    Alert.alert(
      "Delete Account",
      "Are you absolutely sure? This action cannot be undone. All your data will be permanently deleted.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setSavingSettings(true);

              if (currentRole === "freelancer") {
                await supabase
                  .from("freelancer_profiles")
                  .delete()
                  .eq("user_id", user?.id);
              } else {
                await supabase
                  .from("client_profiles")
                  .delete()
                  .eq("user_id", user?.id);
              }

              await supabase
                .from("user_settings")
                .delete()
                .eq("user_id", user?.id);

              const { error } = await supabase.rpc("delete_user_account", {
                user_id: user?.id,
              });

              if (error) throw error;

              await supabase.auth.signOut();
              router.replace("/login");

              Alert.alert(
                "Account Deleted",
                "Your account has been deleted successfully",
              );
            } catch (error) {
              console.error("Error deleting account:", error);
              Alert.alert(
                "Error",
                "Failed to delete account. Please contact support.",
              );
            } finally {
              setSavingSettings(false);
              setDeleteAccountModalVisible(false);
            }
          },
        },
      ],
    );
  };

  const handleOpenLink = (url) => {
    Linking.openURL(url).catch((err) =>
      console.error("Failed to open URL:", err),
    );
  };

  const handleContactSupport = () => {
    const email = "support@yourapp.com";
    const subject = "Support Request";
    const body = `User ID: ${user?.id}\nRole: ${currentRole}\n\nDescribe your issue:\n`;

    const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    Linking.openURL(mailto).catch(() => {
      Alert.alert("Contact Support", `Please email us at: ${email}`, [
        {
          text: "Copy Email",
          onPress: () => {
            Alert.alert("Info", "Email: " + email);
          },
        },
        { text: "OK" },
      ]);
    });
  };

  const canSwitchRole = () => {
    if (currentRole === "freelancer") {
      return !activeCommitments.hasAcceptedBids;
    }
    return (
      !activeCommitments.hasEscrowProjects &&
      !activeCommitments.hasInProgressProjects
    );
  };

  const styles = createStyles(theme);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={theme.text} />
          </Pressable>
          <Text style={styles.title}>Settings</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          {/* User Email */}
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={styles.iconContainer}>
                <Mail size={20} color={theme.icon} />
              </View>
              <View>
                <Text style={styles.settingText}>Email</Text>
                <Text style={styles.settingSubtext}>{user?.email}</Text>
              </View>
            </View>
          </View>

          {/* Current Role Display */}
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={styles.iconContainer}>
                <Users size={20} color={theme.icon} />
              </View>
              <View>
                <Text style={styles.settingText}>Current Role</Text>
                <Text style={styles.settingSubtext}>
                  You are logged in as a {currentRole}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.roleBadge,
                currentRole === "freelancer"
                  ? styles.freelancerBadge
                  : styles.clientBadge,
              ]}
            >
              <Text style={styles.roleBadgeText}>
                {currentRole?.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Active Commitments Warning */}
          {!canSwitchRole() && (
            <View style={styles.warningCard}>
              <AlertCircle size={20} color={theme.warning} />
              <View style={styles.warningContent}>
                <Text style={styles.warningTitle}>Active Commitments</Text>
                <Text style={styles.warningText}>
                  {currentRole === "freelancer"
                    ? `You have ${activeCommitments.acceptedBidsCount} active accepted bid${activeCommitments.acceptedBidsCount > 1 ? "s" : ""}. Complete these before switching roles.`
                    : `You have ${activeCommitments.escrowProjectsCount + activeCommitments.inProgressProjectsCount} active project${activeCommitments.escrowProjectsCount + activeCommitments.inProgressProjectsCount > 1 ? "s" : ""}. Complete these before switching roles.`}
                </Text>
              </View>
            </View>
          )}

          {/* Role Switch Button */}
          <Pressable
            style={[
              styles.switchRoleButton,
              (switching || !canSwitchRole()) &&
                styles.switchRoleButtonDisabled,
            ]}
            onPress={handleRoleSwitch}
            disabled={switching || !canSwitchRole()}
          >
            {switching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Users size={20} color="#fff" />
                <Text style={styles.switchRoleText}>
                  Switch to{" "}
                  {currentRole === "freelancer" ? "Client" : "Freelancer"}
                </Text>
                <ChevronRight size={20} color="#fff" />
              </>
            )}
          </Pressable>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={styles.iconContainer}>
                <Bell size={20} color={theme.icon} />
              </View>
              <View>
                <Text style={styles.settingText}>Push Notifications</Text>
                <Text style={styles.settingSubtext}>
                  Receive app notifications
                </Text>
              </View>
            </View>
            <Switch
              value={settings.notifications}
              onValueChange={handleNotificationToggle}
              trackColor={{
                false: theme.borderLight,
                true: theme.primaryLight,
              }}
              thumbColor={
                settings.notifications ? theme.primary : theme.textMuted
              }
              disabled={savingSettings}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={styles.iconContainer}>
                <Globe size={20} color={theme.icon} />
              </View>
              <View>
                <Text style={styles.settingText}>Email Alerts</Text>
                <Text style={styles.settingSubtext}>
                  Get email notifications
                </Text>
              </View>
            </View>
            <Switch
              value={settings.emailAlerts}
              onValueChange={() => toggleSetting("emailAlerts")}
              trackColor={{
                false: theme.borderLight,
                true: theme.primaryLight,
              }}
              thumbColor={
                settings.emailAlerts ? theme.primary : theme.textMuted
              }
              disabled={savingSettings}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={styles.iconContainer}>
                <Moon size={20} color={theme.icon} />
              </View>
              <View>
                <Text style={styles.settingText}>Dark Mode</Text>
                <Text style={styles.settingSubtext}>Toggle dark theme</Text>
              </View>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{
                false: theme.borderLight,
                true: theme.primaryLight,
              }}
              thumbColor={isDark ? theme.primary : theme.textMuted}
            />
          </View>
        </View>

        {/* Security Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security & Privacy</Text>

          <Pressable
            style={styles.settingItem}
            onPress={() => setPasswordModalVisible(true)}
          >
            <View style={styles.settingLeft}>
              <View style={styles.iconContainer}>
                <Lock size={20} color={theme.icon} />
              </View>
              <Text style={styles.settingText}>Change Password</Text>
            </View>
            <ChevronRight size={20} color={theme.textMuted} />
          </Pressable>

          <Pressable
            style={styles.settingItem}
            onPress={() => router.push("/privacy")}
          >
            <View style={styles.settingLeft}>
              <View style={styles.iconContainer}>
                <Shield size={20} color={theme.icon} />
              </View>
              <Text style={styles.settingText}>Privacy Settings</Text>
            </View>
            <ChevronRight size={20} color={theme.textMuted} />
          </Pressable>

          <Pressable
            style={styles.settingItem}
            onPress={() => setDeleteAccountModalVisible(true)}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, styles.dangerIconContainer]}>
                <Trash2 size={20} color={theme.iconDanger} />
              </View>
              <Text style={[styles.settingText, styles.dangerText]}>
                Delete Account
              </Text>
            </View>
            <ChevronRight size={20} color={theme.textMuted} />
          </Pressable>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>

          <Pressable style={styles.settingItem} onPress={handleContactSupport}>
            <View style={styles.settingLeft}>
              <View style={styles.iconContainer}>
                <HelpCircle size={20} color={theme.icon} />
              </View>
              <Text style={styles.settingText}>Help & Support</Text>
            </View>
            <ChevronRight size={20} color={theme.textMuted} />
          </Pressable>

          <Pressable
            style={styles.settingItem}
            onPress={() => handleOpenLink("https://yourapp.com/terms")}
          >
            <View style={styles.settingLeft}>
              <Text style={styles.settingText}>Terms of Service</Text>
            </View>
            <ChevronRight size={20} color={theme.textMuted} />
          </Pressable>

          <Pressable
            style={styles.settingItem}
            onPress={() => handleOpenLink("https://yourapp.com/privacy")}
          >
            <View style={styles.settingLeft}>
              <Text style={styles.settingText}>Privacy Policy</Text>
            </View>
            <ChevronRight size={20} color={theme.textMuted} />
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Version 1.0.0</Text>
          <Text style={styles.footerText}>
            User ID: {user?.id?.slice(0, 8)}...
          </Text>
        </View>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={passwordModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change Password</Text>

            <TextInput
              style={styles.input}
              placeholder="Current Password"
              placeholderTextColor={theme.inputPlaceholder}
              secureTextEntry
              value={passwordData.currentPassword}
              onChangeText={(text) =>
                setPasswordData({ ...passwordData, currentPassword: text })
              }
            />

            <TextInput
              style={styles.input}
              placeholder="New Password"
              placeholderTextColor={theme.inputPlaceholder}
              secureTextEntry
              value={passwordData.newPassword}
              onChangeText={(text) =>
                setPasswordData({ ...passwordData, newPassword: text })
              }
            />

            <TextInput
              style={styles.input}
              placeholder="Confirm New Password"
              placeholderTextColor={theme.inputPlaceholder}
              secureTextEntry
              value={passwordData.confirmPassword}
              onChangeText={(text) =>
                setPasswordData({ ...passwordData, confirmPassword: text })
              }
            />

            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalButtonCancel}
                onPress={() => {
                  setPasswordModalVisible(false);
                  setPasswordData({
                    currentPassword: "",
                    newPassword: "",
                    confirmPassword: "",
                  });
                }}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.modalButtonConfirm,
                  savingSettings && styles.modalButtonDisabled,
                ]}
                onPress={handleChangePassword}
                disabled={savingSettings}
              >
                {savingSettings ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalButtonConfirmText}>
                    Change Password
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        visible={deleteAccountModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteAccountModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.dangerIconContainerLarge}>
              <Trash2 size={32} color={theme.iconDanger} />
            </View>

            <Text style={styles.modalTitle}>Delete Account</Text>
            <Text style={styles.modalDescription}>
              This action cannot be undone. All your data, including profile,
              projects, and bids will be permanently deleted.
            </Text>

            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalButtonCancel}
                onPress={() => setDeleteAccountModalVisible(false)}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={styles.modalButtonDanger}
                onPress={handleDeleteAccount}
              >
                <Text style={styles.modalButtonDangerText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      paddingTop: 20,
    },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 16,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backButton: {
      padding: 4,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.text,
    },
    section: {
      marginTop: 24,
      paddingHorizontal: 16,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.textSecondary,
      marginBottom: 12,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    settingItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: theme.surface,
      padding: 16,
      borderRadius: 12,
      marginBottom: 8,
    },
    settingLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.iconBg,
      justifyContent: "center",
      alignItems: "center",
    },
    dangerIconContainer: {
      backgroundColor: theme.iconDangerBg,
    },
    dangerIconContainerLarge: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.iconDangerBg,
      justifyContent: "center",
      alignItems: "center",
      alignSelf: "center",
      marginBottom: 16,
    },
    settingText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.text,
    },
    dangerText: {
      color: theme.iconDanger,
    },
    settingSubtext: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    warningCard: {
      flexDirection: "row",
      backgroundColor: theme.warningBg,
      padding: 14,
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.warning,
      gap: 12,
    },
    warningContent: {
      flex: 1,
    },
    warningTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.warningText,
      marginBottom: 4,
    },
    warningText: {
      fontSize: 13,
      color: theme.warningText,
      lineHeight: 18,
    },
    switchRoleButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: theme.buttonPrimary,
      padding: 16,
      borderRadius: 12,
      marginTop: 8,
    },
    switchRoleButtonDisabled: {
      backgroundColor: theme.buttonPrimaryDisabled,
      opacity: 0.6,
    },
    switchRoleText: {
      fontSize: 16,
      fontWeight: "600",
      color: "#fff",
    },
    roleBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    freelancerBadge: {
      backgroundColor: theme.freelancerBadge,
    },
    clientBadge: {
      backgroundColor: theme.clientBadge,
    },
    roleBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.5,
      color: theme.text,
    },
    footer: {
      padding: 24,
      alignItems: "center",
      gap: 4,
    },
    footerText: {
      fontSize: 14,
      color: theme.textMuted,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.modalOverlay,
      justifyContent: "center",
      alignItems: "center",
      padding: 16,
    },
    modalContent: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 24,
      width: "100%",
      maxWidth: 400,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 8,
      textAlign: "center",
    },
    modalDescription: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: "center",
      marginBottom: 24,
      lineHeight: 20,
    },
    input: {
      backgroundColor: theme.inputBg,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      marginBottom: 12,
      color: theme.text,
    },
    modalButtons: {
      flexDirection: "row",
      gap: 12,
      marginTop: 12,
    },
    modalButtonCancel: {
      flex: 1,
      padding: 14,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
    },
    modalButtonCancelText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.textSecondary,
    },
    modalButtonConfirm: {
      flex: 1,
      padding: 14,
      borderRadius: 8,
      backgroundColor: theme.buttonPrimary,
      alignItems: "center",
    },
    modalButtonConfirmText: {
      fontSize: 16,
      fontWeight: "600",
      color: "#fff",
    },
    modalButtonDanger: {
      flex: 1,
      padding: 14,
      borderRadius: 8,
      backgroundColor: theme.iconDanger,
      alignItems: "center",
    },
    modalButtonDangerText: {
      fontSize: 16,
      fontWeight: "600",
      color: "#fff",
    },
    modalButtonDisabled: {
      backgroundColor: theme.buttonPrimaryDisabled,
    },
  });
