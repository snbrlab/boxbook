import { adminMembers, adminSettings } from "@/lib/admin-data";
import { MembersClient } from "@/components/admin/MembersClient";

export default async function MembersPage() {
  const [members, settings] = await Promise.all([adminMembers(), adminSettings()]);
  return <MembersClient members={members} rulesText={settings.rules_text} />;
}
