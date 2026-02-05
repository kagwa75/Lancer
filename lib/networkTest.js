import { Alert } from "react-native";

export const testNetworkConnection = async () => {
  const tests = [
    {
      name: "Stripe API",
      url: "https://lancerstripe-production.up.railway.app/health",
    },
    {
      name: "Google",
      url: "https://www.google.com",
    },
  ];

  console.log("🧪 Starting network tests...");

  for (const test of tests) {
    try {
      console.log(`Testing ${test.name}...`);
      const response = await fetch(test.url, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      console.log(`✅ ${test.name}: ${response.status}`);
    } catch (error) {
      console.error(`❌ ${test.name} failed:`, error.message);
      Alert.alert(`Network Test Failed: ${test.name}`, error.message);
      return false;
    }
  }

  Alert.alert("Network Tests", "All tests passed! ✅");
  return true;
};
