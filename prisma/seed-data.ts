// Synthetic demo data. All names, companies and emails are fictional; emails
// use the reserved .test top-level domain so they can never reach a real inbox.

import type { EmploymentType, ExperienceLevel, WorkplaceType } from "../src/generated/prisma/enums";

export const COMPANIES = [
  {
    key: "northwind",
    name: "Northwind Labs",
    slug: "northwind-labs",
    website: "https://northwind.example",
    industry: "Software",
    size: "51-200",
    location: "Berlin, Germany",
    verified: true,
    description:
      "Northwind Labs builds developer tooling used by thousands of engineering teams. We are remote-friendly, value written communication and ship small improvements every day.",
  },
  {
    key: "bluepeak",
    name: "Bluepeak Health",
    slug: "bluepeak-health",
    website: "https://bluepeak.example",
    industry: "Healthcare",
    size: "201-500",
    location: "Toronto, Canada",
    verified: true,
    description: "Bluepeak Health makes clinical scheduling software for hospitals and clinics across North America.",
  },
  {
    key: "orbit",
    name: "Orbit Retail",
    slug: "orbit-retail",
    website: "https://orbit.example",
    industry: "E-commerce",
    size: "1000+",
    location: "Bengaluru, India",
    verified: false,
    description: "Orbit Retail runs an online marketplace connecting independent stores with millions of shoppers.",
  },
] as const;

type JobSeed = {
  company: (typeof COMPANIES)[number]["key"];
  recruiter: "recruiter" | "recruiter2" | "recruiter3";
  title: string;
  location: string;
  workplaceType: WorkplaceType;
  employmentType: EmploymentType;
  experienceLevel: ExperienceLevel;
  salary?: [number, number, string];
  skills: string[];
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  daysAgo: number;
  deadlineInDays?: number;
  views: number;
};

export const JOBS: JobSeed[] = [
  { company: "northwind", recruiter: "recruiter", title: "Senior Frontend Engineer", location: "Berlin, Germany", workplaceType: "HYBRID", employmentType: "FULL_TIME", experienceLevel: "SENIOR", salary: [75000, 95000, "EUR"], skills: ["React", "TypeScript", "Next.js", "CSS"], status: "PUBLISHED", daysAgo: 2, deadlineInDays: 45, views: 312 },
  { company: "northwind", recruiter: "recruiter", title: "Backend Engineer (Node.js)", location: "Remote — Europe", workplaceType: "REMOTE", employmentType: "FULL_TIME", experienceLevel: "MID", salary: [60000, 80000, "EUR"], skills: ["Node.js", "PostgreSQL", "TypeScript", "Docker"], status: "PUBLISHED", daysAgo: 5, views: 254 },
  { company: "northwind", recruiter: "recruiter", title: "Developer Advocate", location: "London, United Kingdom", workplaceType: "HYBRID", employmentType: "FULL_TIME", experienceLevel: "MID", salary: [55000, 70000, "GBP"], skills: ["Public speaking", "Writing", "JavaScript"], status: "PUBLISHED", daysAgo: 9, views: 120 },
  { company: "northwind", recruiter: "recruiter", title: "Engineering Intern", location: "Berlin, Germany", workplaceType: "ONSITE", employmentType: "INTERNSHIP", experienceLevel: "ENTRY", salary: [1800, 2200, "EUR"], skills: ["JavaScript", "Git"], status: "PUBLISHED", daysAgo: 1, deadlineInDays: 30, views: 88 },
  { company: "northwind", recruiter: "recruiter", title: "Staff Platform Engineer", location: "Remote — Worldwide", workplaceType: "REMOTE", employmentType: "FULL_TIME", experienceLevel: "LEAD", skills: ["Kubernetes", "Go", "AWS"], status: "DRAFT", daysAgo: 0, views: 0 },
  { company: "northwind", recruiter: "recruiter", title: "QA Automation Engineer", location: "Berlin, Germany", workplaceType: "HYBRID", employmentType: "CONTRACT", experienceLevel: "MID", salary: [50000, 65000, "EUR"], skills: ["Playwright", "TypeScript", "CI/CD"], status: "CLOSED", daysAgo: 40, views: 190 },
  { company: "bluepeak", recruiter: "recruiter2", title: "Product Designer", location: "Toronto, Canada", workplaceType: "HYBRID", employmentType: "FULL_TIME", experienceLevel: "SENIOR", salary: [95000, 120000, "CAD"], skills: ["Figma", "User research", "Design systems"], status: "PUBLISHED", daysAgo: 3, views: 205 },
  { company: "bluepeak", recruiter: "recruiter2", title: "Data Analyst", location: "Vancouver, Canada", workplaceType: "ONSITE", employmentType: "FULL_TIME", experienceLevel: "MID", salary: [70000, 85000, "CAD"], skills: ["SQL", "Python", "Tableau"], status: "PUBLISHED", daysAgo: 6, views: 141 },
  { company: "bluepeak", recruiter: "recruiter2", title: "Clinical Support Specialist", location: "Toronto, Canada", workplaceType: "ONSITE", employmentType: "PART_TIME", experienceLevel: "ENTRY", skills: ["Customer support", "Healthcare"], status: "PUBLISHED", daysAgo: 12, views: 64 },
  { company: "bluepeak", recruiter: "recruiter2", title: "Site Reliability Engineer", location: "Remote — North America", workplaceType: "REMOTE", employmentType: "FULL_TIME", experienceLevel: "SENIOR", salary: [130000, 160000, "USD"], skills: ["Terraform", "AWS", "Linux", "Observability"], status: "PUBLISHED", daysAgo: 4, views: 178 },
  { company: "orbit", recruiter: "recruiter3", title: "Mobile Engineer (React Native)", location: "Bengaluru, India", workplaceType: "HYBRID", employmentType: "FULL_TIME", experienceLevel: "MID", salary: [1800000, 2600000, "INR"], skills: ["React Native", "TypeScript", "iOS", "Android"], status: "PUBLISHED", daysAgo: 7, views: 230 },
  { company: "orbit", recruiter: "recruiter3", title: "Customer Success Manager", location: "Mumbai, India", workplaceType: "ONSITE", employmentType: "FULL_TIME", experienceLevel: "MID", salary: [900000, 1400000, "INR"], skills: ["Account management", "CRM"], status: "PUBLISHED", daysAgo: 10, views: 97 },
  { company: "orbit", recruiter: "recruiter3", title: "Earn $5,000/week from home — no experience!", location: "Anywhere", workplaceType: "REMOTE", employmentType: "TEMPORARY", experienceLevel: "ENTRY", skills: ["None"], status: "PUBLISHED", daysAgo: 1, views: 41 },
  { company: "orbit", recruiter: "recruiter3", title: "Machine Learning Engineer", location: "Bengaluru, India", workplaceType: "HYBRID", employmentType: "FULL_TIME", experienceLevel: "SENIOR", salary: [3500000, 5000000, "INR"], skills: ["Python", "PyTorch", "MLOps"], status: "PUBLISHED", daysAgo: 8, views: 260 },
];

export function describe(title: string, company: string) {
  return {
    description: `${company} is hiring a ${title} to join a small, focused team. You will work closely with product and engineering peers, take ownership of meaningful projects and help shape how we build.\n\nThis is a demo listing created with synthetic data for the CareerHub portal.`,
    responsibilities: `• Deliver high-quality work in your area of expertise\n• Collaborate with cross-functional teammates\n• Share knowledge through reviews and documentation\n• Continuously improve our processes and tools`,
    requirements: `• Relevant experience for a ${title} role\n• Clear written and verbal communication\n• A habit of learning and helping others learn\n• Eligibility to work in the listed location`,
    benefits: `• Flexible working hours\n• Learning budget\n• Health coverage\n• 28 days of paid leave`,
  };
}
