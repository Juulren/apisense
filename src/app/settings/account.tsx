import { AppScreen } from "../../components/AppScreen";
import { ProfileSection } from "../../components/ProfileSection";

export default function Account() {
  return (
    <AppScreen title="Mi cuenta" back>
      <ProfileSection />
    </AppScreen>
  );
}
