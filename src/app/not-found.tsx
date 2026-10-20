import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <p className="text-sm font-semibold text-brand-600">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-slate-600">The page you are looking for doesn&apos;t exist or is no longer available.</p>
      <div className="mt-6 flex justify-center gap-3">
        <LinkButton href="/jobs">Browse jobs</LinkButton>
        <LinkButton href="/" variant="secondary">
          Go home
        </LinkButton>
      </div>
    </div>
  );
}
