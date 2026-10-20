import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/display";
import { JobCard } from "@/features/jobs/components/job-card";
import { getLandingData } from "@/features/jobs/service";
import { EMPLOYMENT_TYPES, label } from "@/lib/format";

export default async function HomePage() {
  const { recentJobs, stats } = await getLandingData();

  return (
    <>
      <section className="border-b border-slate-200 bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Find work that fits your career.</h1>
            <p className="mt-4 text-lg text-slate-600">
              Search open roles from verified employers, apply in minutes and track every step of your application in one place.
            </p>
          </div>
          <form action="/jobs" method="get" role="search" className="mt-8 flex max-w-3xl flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row">
            <label className="flex-1">
              <span className="sr-only">Job title, skill or company</span>
              <input name="q" type="search" placeholder="Job title, skill or company" className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200" />
            </label>
            <label className="flex-1 sm:border-l sm:border-slate-200">
              <span className="sr-only">Location</span>
              <input name="location" type="search" placeholder="City or country" className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200" />
            </label>
            <button type="submit" className={buttonClass("primary", "md", "h-11 px-6")}>
              Search jobs
            </button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {EMPLOYMENT_TYPES.slice(0, 4).map((type) => (
              <Link key={type} href={`/jobs?employmentType=${type}`} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 no-underline hover:border-brand-300">
                {label(type)}
              </Link>
            ))}
            <Link href="/jobs?workplaceType=REMOTE" className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 no-underline hover:border-brand-300">
              Remote
            </Link>
          </div>

          <dl className="mt-12 grid max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              ["Open jobs", stats.openJobs],
              ["Hiring companies", stats.companies],
              ["Candidates", stats.candidates],
              ["Hires made", stats.hires],
            ].map(([name, value]) => (
              <div key={name}>
                <dt className="text-sm text-slate-500">{name}</dt>
                <dd className="text-2xl font-semibold tabular-nums">{Number(value).toLocaleString("en-US")}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Latest openings</h2>
            <p className="text-sm text-slate-600">Freshly published roles from companies hiring now.</p>
          </div>
          <Link href="/jobs" className="text-sm font-medium">
            View all jobs →
          </Link>
        </div>
        {recentJobs.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {recentJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        ) : (
          <EmptyState title="No open jobs yet" description="Check back soon — new roles are posted every day." />
        )}
      </section>

      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 md:grid-cols-2">
          <div className="card p-6">
            <h2 className="text-lg font-semibold">For candidates</h2>
            <p className="mt-2 text-sm text-slate-600">Build your profile, upload resumes securely and follow every application from submission to offer.</p>
            <Link href="/register?role=CANDIDATE" className={buttonClass("primary", "md", "mt-4")}>
              Create a candidate account
            </Link>
          </div>
          <div className="card p-6">
            <h2 className="text-lg font-semibold">For recruiters</h2>
            <p className="mt-2 text-sm text-slate-600">Publish jobs, review applicants, schedule interviews and keep internal notes in a structured pipeline.</p>
            <Link href="/register?role=RECRUITER" className={buttonClass("secondary", "md", "mt-4")}>
              Start hiring
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
