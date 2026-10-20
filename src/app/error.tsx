"use client";

import { useEffect } from "react";
import { Button, LinkButton } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <p className="text-sm font-semibold text-red-600">Something went wrong</p>
      <h1 className="mt-2 text-2xl font-semibold">We couldn&apos;t load this page</h1>
      <p className="mt-2 text-sm text-slate-600">
        Please try again. If the problem persists, contact support{error.digest ? ` and quote reference ${error.digest}` : ""}.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <LinkButton href="/" variant="secondary">
          Go home
        </LinkButton>
      </div>
    </div>
  );
}
