import { supabase } from "../lib/Client";

export const uploadFile = async (fileUri, userId) => {
  try {
    let fileName = getFilePath(userId);

    const formData = new FormData();
    formData.append("file", {
      uri: fileUri,
      type: "image/png",
      name: fileName,
    });

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from("client-profiles")
      .upload(fileName, formData, {
        cacheControl: "3600",
        upsert: true, // Changed to true to allow updates
        contentType: "image/png",
      });

    if (error) {
      console.error("fileUpload error:", error.message);
      return { success: false, error: error.message };
    }

    // Get public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from("client-profiles")
      .getPublicUrl(data.path);

    return {
      success: true,
      path: data.path,
      url: urlData.publicUrl,
    };
  } catch (error) {
    console.error("fileUpload error:", error.message);
    return { success: false, error: error.message };
  }
};

export const getFilePath = (userId) => {
  return `/${userId}/${new Date().getTime()}${".png"}`;
};
