import { StatusBadge } from "@/components/ui/display";
import { formatDateTime } from "@/lib/format";

export function StatusTimeline({ events }: { events: { id: string; toStatus: string; createdAt: Date; changedBy?: { name: string } | null }[] }) {
  if (!events.length) return <p className="text-sm text-slate-600">No history yet.</p>;
  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-5">
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full bg-brand-500 ring-4 ring-white" aria-hidden />
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={event.toStatus} />
            <span className="text-xs text-slate-500">{formatDateTime(event.createdAt)}</span>
          </div>
          {event.changedBy ? <p className="mt-0.5 text-xs text-slate-500">by {event.changedBy.name}</p> : null}
        </li>
      ))}
    </ol>
  );
}
