import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui/display";
import { SettingsForm } from "@/features/admin/components/admin-forms";
import { getSettings } from "@/features/admin/service";
import { formatDateTime } from "@/lib/format";
import { requirePageUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Platform settings" };

export default async function AdminSettingsPage() {
  const admin = await requirePageUser(["ADMIN"], "/admin/settings");
  const settings = await getSettings(admin);
  return (
    <>
      <PageHeader title="Platform settings" description={`Last updated ${formatDateTime(settings.updatedAt)}. Changes are recorded in the audit log.`} />
      <Card className="max-w-2xl">
        <SettingsForm settings={settings} />
      </Card>
    </>
  );
}
