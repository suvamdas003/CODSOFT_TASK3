"use client";

import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { TextField } from "@/components/ui/fields";
import { changePasswordAction, updateAccountAction } from "@/features/auth/actions";

export function AccountForm({ name, email }: { name: string; email: string }) {
  return (
    <ActionForm action={updateAccountAction} className="space-y-4">
      <TextField label="Full name" name="name" defaultValue={name} required maxLength={120} autoComplete="name" />
      <TextField label="Email" name="email_display" defaultValue={email} disabled hint="Contact an administrator to change your email address." />
      <SubmitButton>Save</SubmitButton>
    </ActionForm>
  );
}

export function ChangePasswordForm() {
  return (
    <ActionForm action={changePasswordAction} className="space-y-4" resetOnSuccess>
      <TextField label="Current password" name="currentPassword" type="password" autoComplete="current-password" required />
      <TextField label="New password" name="newPassword" type="password" autoComplete="new-password" required minLength={10} hint="At least 10 characters, with letters and numbers." />
      <TextField label="Confirm new password" name="confirmPassword" type="password" autoComplete="new-password" required />
      <SubmitButton pendingLabel="Updating…">Update password</SubmitButton>
    </ActionForm>
  );
}
