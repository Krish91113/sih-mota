import { Link } from "@tanstack/react-router";
import emblem from "@/assets/emblem.png";
import { Globe, Phone, Mail } from "lucide-react";
import type { ReactNode } from "react";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <a
        href="#auth-main"
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
            <span>हिन्दी</span>
          </div>
        </div>
      </div>
      <div className="tricolor-rule" aria-hidden />

      <header className="border-b bg-card/95 backdrop-blur">
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
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              aria-label="Go to public portal"
            >
              <Globe className="size-3.5" aria-hidden /> Public site
            </Link>
          </div>
        </div>
      </header>

      <main id="auth-main" className="grid min-h-[calc(100vh-8rem)] lg:grid-cols-2">
        <div className="hidden bg-surface lg:flex lg:flex-col lg:justify-center lg:p-12">
          <div className="max-w-lg">
            <p className="eyebrow mb-2">Ministry of Tribal Affairs · Government of India</p>
            <h1 className="text-4xl leading-[1.08] text-balance">
              Scholarships and fellowships for Scheduled Tribe students
            </h1>
            <p className="mt-5 max-w-md text-base text-muted-foreground text-pretty">
              One portal to discover schemes, apply online, upload documents and follow every stage
              of your application — from submission to award.
            </p>
            <div className="mt-10 border-t pt-6 space-y-4 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <Phone className="size-4 text-primary" aria-hidden /> Helpdesk 1800 XXX XXXX (toll
                free)
              </p>
              <p className="flex items-center gap-2">
                <Mail className="size-4 text-primary" aria-hidden />{" "}
                helpdesk-scholarship@mota.gov.in
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col justify-center px-4 py-10 sm:px-8 lg:px-12">{children}</div>
      </main>
    </div>
  );
}
