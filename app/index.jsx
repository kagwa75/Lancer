if (typeof document === "undefined") {
  global.document = { documentElement: {} };
}
import { Redirect } from "expo-router";
const index = () => {
  return <Redirect href={"/(auth)/Welcome"} />;
};

export default index;
