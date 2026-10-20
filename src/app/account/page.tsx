import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui/display";
import { AccountForm, ChangePasswordForm } from "@/features/auth/components/account-forms";
import { label } from "@/lib/format";
import { requirePageUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Account settings" };

export default async function AccountPage() {
  const user = await requirePageUser(undefined, "/account");
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <PageHeader title="Account settings" description={`Signed in as ${user.email} (${label(user.role)}).`} />
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Account details">
          <AccountForm name={user.name} email={user.email} />
        </Card>
        <Card title="Change password">
          <ChangePasswordForm />
        </Card>
      </div>
    </div>
  );
}
