import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { createContext, useContext, useEffect, useState } from "react";
import { Alert, Platform } from "react-native";
import { supabase } from "../lib/Client";
WebBrowser.maybeCompleteAuthSession();
const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [userRole, setUserRoleState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false); // Add this
  const [loadingMessage, setLoadingMessage] = useState(""); // Add this
  useEffect(() => {
    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      // Defer role fetching
      if (session?.user) {
        setTimeout(() => {
          fetchUserRole(session.user.id);
        }, 0);
      } else {
        setUserRoleState(null);
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    setUserRoleState(data?.role);
  };

  const signUp = async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      fullName,
    });
    console.log("signup response:", data);

    if (error) {
      console.error("supabase error", JSON.stringify(error, null, 2));
      Alert.alert("Error", error.message);
      return error;
    } else {
      Alert.alert("Success", "Please check your inbox for email verification!");
      return data;
    }
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      Alert.alert("Login Error", error.message);
      console.error("Supabase error", JSON.stringify(error, null, 2));
      return error;
    }
    return data;
  };
  const signInWithGoogle = async () => {
    try {
      setIsGoogleLoading(true); // Set Google-specific loading state
      setLoadingMessage("Initializing Google sign-in...");

      const redirectUrl = Linking.createURL("/");
      console.log("🔗 Redirect:", redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: Platform.OS !== "web",
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) throw error;

      console.log("✅ Opening browser...");
      setLoadingMessage("Opening Google authentication...");

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl,
        );

        console.log("🔐 Browser closed:", result.type);

        if (result.type === "success") {
          console.log("✅ Redirect successful, getting session...");
          setLoadingMessage("Authenticating with Google...");

          // Multiple retry attempts with increasing delay
          for (let i = 1; i <= 5; i++) {
            console.log(`⏳ Attempt ${i}/5...`);
            setLoadingMessage(`Setting up ... (${i}/5)`);
            await new Promise((r) => setTimeout(r, 1000 * i));

            const { data: sessionData } = await supabase.auth.getSession();

            if (sessionData?.session) {
              console.log("✅ Session found!");
              setSession(sessionData.session);
              setUser(sessionData.session.user);
              await fetchUserRole(sessionData.session.user.id);
              setIsGoogleLoading(false);
              setLoadingMessage("");
              return { error: null };
            }
          }

          // If no session, try manual extraction from URL
          console.log("🔍 Trying manual token extraction...");
          setLoadingMessage("Finalizing authentication...");

          if (result.url && result.url.includes("access_token")) {
            const hashPart =
              result.url.split("#")[1] || result.url.split("?")[1];
            if (hashPart) {
              const params = new URLSearchParams(hashPart);
              const accessToken = params.get("access_token");
              const refreshToken = params.get("refresh_token");

              if (accessToken) {
                console.log("🔑 Tokens found, setting session...");
                const { data: sessionData, error: setError } =
                  await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                  });

                if (sessionData?.session) {
                  console.log("✅ Manual session created!");
                  setSession(sessionData.session);
                  setUser(sessionData.session.user);
                  await fetchUserRole(sessionData.session.user.id);
                  setIsGoogleLoading(false);
                  setLoadingMessage("");
                  return { error: null };
                }

                console.error("❌ Manual session failed:", setError);
              }
            }
          }

          console.error("💥 All session attempts failed");
          setIsGoogleLoading(false);
          setLoadingMessage("");
          return { error: new Error("Failed to establish session") };
        }

        if (result.type === "cancel") {
          setIsGoogleLoading(false);
          setLoadingMessage("");
          return { error: new Error("Sign in cancelled") };
        }
      }

      setIsGoogleLoading(false);
      setLoadingMessage("");
      return { error: null };
    } catch (error) {
      console.error("💥 Google sign in error:", error);
      setIsGoogleLoading(false);
      setLoadingMessage("");
      return { error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserRoleState(null);
  };

  const setUserRole = async (role) => {
    if (!user) return { error: new Error("No user logged in") };

    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: user.id, role });

    if (!error) {
      setUserRoleState(role);

      // Create freelancer profile if freelancer
      if (role === "freelancer") {
        await supabase
          .from("freelancer_profiles")
          .insert({ user_id: user?.id });
      }
    }

    return { error };
  };

  const updateUserRole = (role) => {
    setUserRoleState(role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        userRole,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        setUserRole,
        updateUserRole,
        isGoogleLoading, // Export this
        loadingMessage, // Export this new function
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
