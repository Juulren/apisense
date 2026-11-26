import { Redirect } from "expo-router";

// "Mis colmenas" is now part of Colmenas; old links still arrive here.
export default function HivesRedirect() {
  return <Redirect href="/hive" />;
}
