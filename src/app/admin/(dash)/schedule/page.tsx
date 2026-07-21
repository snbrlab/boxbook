import { adminTemplates, adminClosedDates } from "@/lib/admin-data";
import { ScheduleClient } from "@/components/admin/ScheduleClient";

export default async function SchedulePage() {
  const [templates, closed] = await Promise.all([adminTemplates(), adminClosedDates()]);
  return <ScheduleClient templates={templates as any} closed={closed as any} />;
}
