import { ActionButton } from "@/components/ui/action-form";
import { toggleSaveJobAction } from "@/features/jobs/actions";

export function SaveJobButton({ jobId, saved }: { jobId: string; saved: boolean }) {
  return (
    <ActionButton action={toggleSaveJobAction} fields={{ jobId }} variant={saved ? "secondary" : "ghost"} pendingLabel="Saving…">
      <span aria-hidden>{saved ? "★" : "☆"}</span>
      {saved ? "Saved" : "Save"}
    </ActionButton>
  );
}
