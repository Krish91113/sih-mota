import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Phone, Mail, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import emblem from "@/assets/emblem.png";

const nav = [
  { to: "/", label: "Home" },
  { to: "/schemes", label: "Schemes" },
  { to: "/guidelines", label: "Guidelines" },
  { to: "/notices", label: "Notices" },
  { to: "/faqs", label: "FAQs" },
  { to: "/grievance", label: "Grievance" },
  { to: "/contact", label: "Contact" },
];

export function PublicLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      <div className="bg-ink text-ink-foreground">
        <div className="shell flex flex-wrap items-center justify-between gap-2 py-2 text-[11px] sm:text-xs">
          <p className="opacity-90">
            भारत सरकार · Government of India · Ministry of Tribal Affairs
          </p>
          <div className="flex items-center gap-4 opacity-90">
            <span className="hidden sm:inline">Screen Reader Access</span>
            <span aria-hidden className="hidden sm:inline opacity-40">
              |
            </span>
            <span>A- A A+</span>
            <span aria-hidden className="opacity-40">
              |
            </span>
            <span>हिन्दी</span>
          </div>
        </div>
      </div>
      <div className="tricolor-rule" aria-hidden />

      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
        <div className="shell flex items-center justify-between gap-4 py-3">
          <Link to="/" className="flex items-center gap-3">
            <img src={emblem} alt="" className="size-11 shrink-0" />
            <span className="leading-tight">
              <span className="block font-display text-base sm:text-lg">
                Ministry of Tribal Affairs
              </span>
              <span className="block text-[11px] tracking-wide text-muted-foreground uppercase">
                Scholarship &amp; Fellowship Portal
              </span>
            </span>
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.to === "/" }}
                className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground data-[status=active]:bg-accent data-[status=active]:text-accent-foreground"
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link to="/login">Login</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/register">Register</Link>
            </Button>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetTitle className="px-4 pt-4 font-display">Menu</SheetTitle>
                <nav aria-label="Mobile" className="mt-2 flex flex-col p-2">
                  {[...nav, { to: "/login", label: "Login" }].map((n) => (
                    <Link
                      key={n.to}
                      to={n.to}
                      onClick={() => setOpen(false)}
                      className="rounded-md px-3 py-2.5 text-sm font-medium hover:bg-accent"
                    >
                      {n.label}
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main id="main">{children}</main>
      <SiteFooter />
    </div>
  );
}

const footerCols = [
  {
    title: "Schemes",
    links: [
      { label: "National Fellowship (NFST)", to: "/schemes/nfst" },
      { label: "National Overseas Scholarship", to: "/schemes/nos" },
      { label: "Top Class Education", to: "/schemes/top-class" },
      { label: "Post-Matric Scholarship", to: "/schemes/postmatric" },
    ],
  },
  {
    title: "Applicants",
    links: [
      { label: "Register", to: "/register" },
      { label: "Login", to: "/login" },
      { label: "Guidelines", to: "/guidelines" },
      { label: "Document checklist", to: "/guidelines" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Frequently asked questions", to: "/faqs" },
      { label: "Grievance redressal", to: "/grievance" },
      { label: "Notices & circulars", to: "/notices" },
      { label: "Contact the Ministry", to: "/contact" },
    ],
  },
];

function SiteFooter() {
  return (
    <footer className="mt-20 bg-ink text-ink-foreground">
      <div className="shell grid gap-10 py-14 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-3">
            <img src={emblem} alt="" className="size-10 brightness-0 invert" />
            <p className="font-display text-lg">Ministry of Tribal Affairs</p>
          </div>
          <p className="mt-4 text-sm text-ink-foreground/70">
            Shastri Bhawan, Dr. Rajendra Prasad Road, New Delhi 110001
          </p>
          <p className="mt-4 flex items-center gap-2 text-sm text-ink-foreground/70">
            <Phone className="size-4" aria-hidden /> Helpdesk 1800 XXX XXXX
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm text-ink-foreground/70">
            <Mail className="size-4" aria-hidden /> helpdesk-scholarship@mota.gov.in
          </p>
        </div>
        {footerCols.map((c) => (
          <div key={c.title}>
            <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
              {c.title}
            </p>
            <ul className="mt-4 space-y-2.5">
              {c.links.map((l) => (
                <li key={l.label}>
                  <Link
                    to={l.to}
                    className="text-sm text-ink-foreground/75 underline-offset-4 hover:text-ink-foreground hover:underline"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="shell flex flex-col gap-2 py-5 text-xs text-ink-foreground/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Ministry of Tribal Affairs, Government of India. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            Content owned and maintained by MoTA <ExternalLink className="size-3" aria-hidden />
          </p>
        </div>
      </div>
    </footer>
  );
}

export function UsefulLinks({ className }: { className?: string }) {
  const links = [
    "National Scholarship Portal",
    "Ministry of Education",
    "University Grants Commission",
    "DigiLocker",
    "Public Grievance Portal (CPGRAMS)",
    "India.gov.in",
    "Tribal Affairs Annual Report",
    "State Tribal Welfare Departments",
  ];
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {links.map((l) => (
        <a
          key={l}
          href="#"
          className="flex items-center justify-between gap-2 rounded-lg border bg-card px-4 py-3 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-accent"
        >
          {l}
          <ExternalLink className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </a>
      ))}
    </div>
  );
}
