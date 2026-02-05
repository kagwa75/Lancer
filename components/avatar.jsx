import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

const getInitialsFromEmail = (email = "") => {
  if (!email) return "?";

  const namePart = email.split("@")[0]; // before @
  const parts = namePart.split(/[._-]/); // split by common separators

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const Avatar = ({ uri, style, email, size = 90 }) => {
  if (!uri) {
    const initials = getInitialsFromEmail(email);

    return (
      <View
        style={[
          styles.initialsContainer,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
          StyleSheet.flatten(style),
        ]}
      >
        <Text style={[styles.initialsText, { fontSize: size / 2.5 }]}>
          {initials}
        </Text>
      </View>
    );
  }

  return (
    <View>
      <Image
        source={{ uri }}
        transition={100}
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 1,
            borderColor: "black",
          },
          StyleSheet.flatten(style),
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  initialsContainer: {
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "black",
  },
  initialsText: {
    fontWeight: "600",
    color: "#111827",
  },
});

export default Avatar;
