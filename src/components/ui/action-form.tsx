"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/action";
import { cn } from "@/lib/utils";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./button";
import { Alert } from "./alert";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const FormContext = createContext<{ fieldErrors?: Record<string, string>; pending: boolean }>({ pending: false });

export function useFieldError(name: string): string | undefined {
  return useContext(FormContext).fieldErrors?.[name];
}

/**
 * A form bound to a server action. Shows the action's success/error message,
 * passes field errors to the inputs, can ask for confirmation before
 * destructive actions and optionally resets on success.
 *
 * With JavaScript the submission is dispatched manually so that React does
 * not reset the inputs after a failed validation (React 19 resets forms after
 * every `action` submission). Without JavaScript the native `action` still works.
 */
export function ActionForm({
  action,
  children,
  className,
  confirm,
  resetOnSuccess = false,
  showSuccess = true,
  encType,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  confirm?: string;
  resetOnSuccess?: boolean;
  showSuccess?: boolean;
  encType?: "multipart/form-data";
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <FormContext.Provider value={{ fieldErrors: state?.ok ? undefined : state?.fieldErrors, pending }}>
      <form
        ref={formRef}
        action={formAction}
        encType={encType}
        className={className}
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          if (confirm && !window.confirm(confirm)) return;
          const submitter = (event.nativeEvent as SubmitEvent).submitter;
          const formData = new FormData(event.currentTarget, submitter);
          startTransition(() => formAction(formData));
        }}
      >
        {state?.message && (state.ok ? showSuccess : true) ? (
          <Alert key={state.at} tone={state.ok ? "success" : "error"} className="mb-3">
            {state.message}
          </Alert>
        ) : null}
        {children}
      </form>
    </FormContext.Provider>
  );
}

/** Submit button that disables itself and shows a pending label while the action runs. */
export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  variant = "primary",
  size = "md",
  className,
  name,
  value,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  name?: string;
  value?: string;
}) {
  const formStatus = useFormStatus();
  const pending = useContext(FormContext).pending || formStatus.pending;
  return (
    <button type="submit" name={name} value={value} disabled={pending} aria-disabled={pending} className={buttonClass(variant, size, className)}>
      {pending ? (
        <>
          <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** A compact one-button form, e.g. "Publish" or "Delete", with optional confirmation. */
export function ActionButton({
  action,
  fields,
  children,
  variant = "secondary",
  size = "sm",
  confirm,
  pendingLabel = "Working…",
  className,
}: {
  action: Action;
  fields: Record<string, string>;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  confirm?: string;
  pendingLabel?: string;
  className?: string;
}) {
  return (
    <ActionForm action={action} confirm={confirm} className={cn("inline-block", className)}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SubmitButton variant={variant} size={size} pendingLabel={pendingLabel}>
        {children}
      </SubmitButton>
    </ActionForm>
  );
}
