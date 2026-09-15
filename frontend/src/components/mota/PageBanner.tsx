import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

export function PageBanner({
  eyebrow = "Ministry of Tribal Affairs",
  title,
  desc,
  crumb,
}: {
  eyebrow?: string;
  title: string;
  desc?: string;
  crumb?: string;
}) {
  return (
    <section className="border-b bg-surface">
      <div className="shell py-10 md:py-14">
        <nav
          aria-label="Breadcrumb"
          className="mb-4 flex items-center gap-1 text-xs text-muted-foreground"
        >
          <Link to="/" className="hover:text-foreground">
            Home
          </Link>
          <ChevronRight className="size-3" aria-hidden />
          <span className="text-foreground">{crumb ?? title}</span>
        </nav>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-3 max-w-3xl text-3xl leading-tight text-balance md:text-[2.75rem]">
          {title}
        </h1>
        {desc ? <p className="mt-4 max-w-2xl text-muted-foreground text-pretty">{desc}</p> : null}
      </div>
    </section>
  );
}
