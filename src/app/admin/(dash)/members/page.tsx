import { adminMembers } from "@/lib/admin-data";
import { MembersClient } from "@/components/admin/MembersClient";

export default async function MembersPage() {
  const members = await adminMembers();
  return <MembersClient members={members} />;
}
