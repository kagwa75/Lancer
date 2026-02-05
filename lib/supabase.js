import { supabase } from "./Client.js";

export const getAllUsers = async () => {
  try {
    const { data, error } = await supabase.from("profiles").select("*");
    if (error) {
      throw error;
    }
    return data;
  } catch (error) {
    console.error(JSON.stringify(error));
  }
};
// Get all unique conversations for a user
export const getChatConversations = async (userId) => {
  try {
    // First, get all unread messages count per conversation
    const { data: unreadCounts, error: countError } = await supabase
      .from("chats")
      .select("senderid, receiverid")
      .eq("receiverid", userId)
      .eq("isread", false);

    if (countError) throw countError;

    // Calculate unread counts per conversation
    const unreadMap = new Map();
    unreadCounts?.forEach((chat) => {
      const otherUserId = chat.senderid; // sender is the other user
      unreadMap.set(otherUserId, (unreadMap.get(otherUserId) || 0) + 1);
    });

    // Get all chats where user is either sender or receiver
    const { data: chats, error } = await supabase
      .from("chats")
      .select("*, profiles!chats_senderid_fkey (*)")
      .or(`senderid.eq.${userId},receiverid.eq.${userId}`)
      .order("createdat", { ascending: false });

    if (error) throw error;

    // Group by other user and get latest message
    const conversationsMap = new Map();

    chats.forEach((chat) => {
      const otherUserId =
        chat.senderid === userId ? chat.receiverid : chat.senderid;
      const isUnread = !chat.isread && chat.receiverid === userId;

      if (!conversationsMap.has(otherUserId)) {
        conversationsMap.set(otherUserId, {
          other_user_id: otherUserId,
          last_message: chat,
          unread_count: unreadMap.get(otherUserId) || 0,
        });
      } else {
        const existing = conversationsMap.get(otherUserId);
        // Update unread count

        // Update latest message if this one is newer
        if (
          new Date(chat.createdat) > new Date(existing.last_message.createdat)
        ) {
          existing.last_message = chat;
        }
      }
    });

    // Convert map to array and get user details for each conversation
    const conversations = Array.from(conversationsMap.values());

    // Fetch complete user details for each conversation
    const conversationsWithUsers = await Promise.all(
      conversations.map(async (conv) => {
        // Get the other user's details (this will be the receiver's details)
        const { data: userData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", conv.other_user_id)
          .single();

        return {
          ...conv,
          other_user: userData,
          // For display purposes, we always want:
          // - Avatar URI to be the receiver's avatar
          // - Latest message to be the actual latest message from the chat
        };
      }),
    );

    return conversationsWithUsers;
  } catch (err) {
    console.error("getChatConversations error:", err.message);
    throw err;
  }
};
export const markAllMessagesAsRead = async (currentUserId, otherUserId) => {
  try {
    const { error } = await supabase
      .from("chats")
      .update({
        isread: true,
        updatedat: new Date().toISOString(),
      })
      .or(
        `and(senderid.eq.${otherUserId},receiverid.eq.${currentUserId},isread.eq.false)`,
      );

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error("markAllMessagesAsRead error:", err.message);
    return { success: false, error: err };
  }
};
export const getChats = async (senderId) => {
  try {
    const { data, error } = await supabase
      .from("chats")
      .select("*, users!chats_senderid_fkey (*)")
      .eq("senderid", senderId);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("getChats error:", err.message);
    throw err;
  }
};
export const getChatsBetweenUsers = async (currentUserId, otherUserId) => {
  try {
    const { data, error } = await supabase
      .from("chats")
      .select("*, profiles!chats_senderid_fkey (*)")
      .or(
        `and(senderid.eq.${currentUserId},receiverid.eq.${otherUserId}),and(senderid.eq.${otherUserId},receiverid.eq.${currentUserId})`,
      )
      .order("createdat", { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("getChatsBetweenUsers error:", err.message);
    throw err;
  }
};

export const PostChats = async (CommentData) => {
  try {
    const { data, error } = await supabase
      .from("chats")
      .insert([CommentData])
      .select("id")
      .single();

    if (error) throw error;
    return { success: true, id: data.id };
  } catch (err) {
    console.error("PostChats error:", err.message);
    return { success: false };
  }
};
export const PostNotifications = async (NotificationData) => {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .insert([NotificationData])
      .select()
      .single();
    if (error) {
      console.log("postin error:", error);
      throw error;
    }
    return { success: true, data: data };
  } catch (error) {
    console.error(JSON.stringify(error));
    return { data: null, error };
  }
};
export const getProjects = async (ClientId) => {
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("client_id", ClientId)
      .order("created_at", { ascending: false });
    if (error) throw error;

    return { data: data || [], error: null };
  } catch (error) {
    console.error("getProjects error:", error.message);
    return { data: null, error: error };
  }
};

export const ClientId = async (userId) => {
  try {
    // First, get the client profile ID for this user
    const { data: clientProfile, error: profileError } = await supabase
      .from("client_profiles")
      .select("id")
      .eq("user_id", userId) // assuming client-profiles has a user_id column
      .single();

    if (profileError || !clientProfile) {
      console.error("Error in client_profile:", profileError);
      return { clientProfile: null, error: profileError };
    }
    return { clientProfile, error: null };
  } catch (error) {
    console.error("getClient_id error:", error);
    return { data: null, error: error };
  }
};

// Fix the ClientDetails function
export const ClientDetails = async (userId) => {
  try {
    const { data: clientP, error: profileError } = await supabase
      .from("client_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(); // ← ADD .single() to get one object instead of array

    if (profileError || !clientP) {
      console.error("Error in client_profile:", profileError);
      return { clientP: null, error: profileError };
    }

    return { clientP, error: null }; // ← This was correct
  } catch (error) {
    console.error("getClient_details error:", error);
    return { clientP: null, error: error }; // ← Fix: use clientP, not data
  }
};
export const InsertTransaction = async (
  projectId,
  bidId,
  clientId,
  freelancerId,
  amount,
  platformFee,
  freelancerAmount,
  paymentIntent,
) => {
  try {
    const { data: transaction, error: transError } = await supabase
      .from("transactions")
      .insert({
        project_id: projectId,
        bid_id: bidId,
        client_id: clientId,
        freelancer_id: freelancerId,
        amount,
        platform_fee: platformFee,
        freelancer_amount: freelancerAmount,
        status: "pending",
        payment_provider: "stripe",
        payment_intent_id: paymentIntent.id,
      })
      .select()
      .single();

    if (transError) {
      console.error("Transaction insert error:", transError);
      return transError;
    }

    console.log("Transaction created:", transaction.id);
    return JSON.stringify({ transaction });
  } catch (error) {
    console.error("insert transcation error:", error);
    return { transaction: null, error: error };
  }
};
export const Commission = async () => {
  try {
    const { data: settingData, error: settingError } = await supabase
      .from("platform_settings")
      .select("setting_value")
      .eq("setting_key", "commission_rate")
      .single();
    if (settingError) {
      console.error("Error fetching commission rate:", settingError);
    }
    return settingData;
  } catch (error) {
    console.error("get commissionRate error:", error);
  }
};
export const getFreelancerStripeAccount = async (userId) => {
  try {
    const { data, error } = await supabase
      .from("freelancer_profiles")
      .select("stripe_account_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Get Stripe account error:", error);
      return { stripeAccountId: null, error };
    }

    return {
      stripeAccountId: data?.stripe_account_id || null,
      error: null,
    };
  } catch (error) {
    console.error("Get Stripe account catch error:", error);
    return { stripeAccountId: null, error };
  }
};
export const FreeLancerBids = async (userId) => {
  try {
    const { error, data } = await supabase
      .from("bids")
      .select("*")
      .eq("freelancer_id", userId)
      .eq("status", "accepted");
    if (error || !data) {
      console.error("Error in bids table:", error);
      return { data: null, error: error };
    }

    return { data, error: null }; // ← This was correct
  } catch (error) {
    console.error("get freelancer bids error:", error);
    return { data: null, error: error };
  }
};
export const ClientTranscations = async (userId) => {
  try {
    const { error, data } = await supabase
      .from("transactions")
      .select("id, status, project:projects(id, title)")
      .eq("client_id", userId)
      .eq("status", "held_in_escrow");
    if (error || !data) {
      console.error("Error in transcations table:", error);
      return { data: null, error: error };
    }

    return { data, error: null }; // ← This was correct
  } catch (error) {
    console.error("get client transcations error:", error);
    return { data: null, error: error };
  }
};
export const progressProjects = async (userId) => {
  try {
    const { error, data } = await supabase
      .from("projects")
      .select("id, title, status")
      .eq("client_id", userId)
      .eq("status", "in_progress");
    if (error || !data) {
      console.error("Error in projects table:", error);
      return { data: null, error: error };
    }

    return { data, error: null }; // ← This was correct
  } catch (error) {
    console.error("get client projects error:", error);
    return { data: null, error: error };
  }
};
export const getAllBids = async (UserId) => {
  try {
    const { data, error } = await supabase
      .from("bids")
      .select(
        `
          *,
          project:projects(id, title, budget_min, budget_max, status)
        `,
      )
      .eq("freelancer_id", UserId)
      .order("created_at", { ascending: false });
    if (error || !data) {
      console.error("Error in fetching bids and projects :", error);
      return { data: null, error: error };
    }

    return { data, error: null }; // ← This was correct
  } catch (error) {
    console.error("get bids & projects error:", error);
    return { data: null, error: error };
  }
};

// lib/supabase.js

export const getFreelancerProfile = async (userId) => {
  try {
    console.log("🔍 getFreelancerProfile called with userId:", userId);
    console.log("🔍 userId type:", typeof userId);

    if (!userId) {
      throw new Error("userId is required");
    }

    const { data, error } = await supabase
      .from("freelancer_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(); // Use maybeSingle instead of single to avoid error if no rows

    console.log("🔍 getFreelancerProfile result:", { data, error });

    if (error) {
      console.error("❌ Supabase query error:", error);
      return { data: null, error };
    }

    if (!data) {
      console.log("⚠️ No freelancer profile found for user:", userId);
      return { data: null, error: new Error("No freelancer profile found") };
    }

    return { data, error: null };
  } catch (error) {
    console.error("❌ getFreelancerProfile exception:", error);
    return { data: null, error };
  }
};

export const getUser = async (userId) => {
  try {
    console.log("🔍 getUser called with userId:", userId);
    console.log("🔍 userId type:", typeof userId);

    if (!userId) {
      throw new Error("userId is required");
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle(); // Use maybeSingle instead of single

    console.log("🔍 getUser result:", { data, error });

    if (error) {
      console.error("❌ Supabase query error:", error);
      return { data: null, error };
    }

    if (!data) {
      console.log("⚠️ No user profile found for user:", userId);
      return { data: null, error: new Error("No user profile found") };
    }

    return { data, error: null };
  } catch (error) {
    console.error("❌ getUser exception:", error);
    return { data: null, error };
  }
};
export const FetchCategories = async () => {
  try {
    const { data, error } = await supabase
      .from("project_categories")
      .select("*");
    if (error || !data) {
      console.error("Error in fetching categories :", error);
      return { data: null, error: error };
    }

    return { data, error: null }; // ← This was correct
  } catch (error) {
    console.error("get categories error:", error);
    return { data: null, error: error };
  }
};
export const FetchOpenProjects = async () => {
  try {
    const { data, error } = supabase
      .from("projects")
      .select(
        `
          *,
          category:project_categories(name),
          client_profile:client_profiles!projects_client_id_fkey(*)
        `,
      )
      .eq("status", "open")
      .order("created_at", { ascending: false });
    if (error || !data) {
      console.error("Error in fetching projects that are oen :", error);
      return { data: null, error: error };
    }

    return { data, error: null }; // ← This was correct
  } catch (error) {
    console.error("get open projects error:", error);
    return { data: null, error: error };
  }
};
