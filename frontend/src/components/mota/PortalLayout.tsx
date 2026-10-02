import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import type { NavSection } from "@/lib/portal-nav";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { roleLabel } from "@/lib/auth/rolePortals";
import { isAllowed } from "@/lib/auth/access";
import { useAuth } from "@/lib/auth/AuthProvider";
import { logout as apiLogout } from "@/api/auth";
import { Globe, LogOut, Menu, UserRound, LifeBuoy, Bell, ChevronDown, Home } from "lucide-react";
import { useNotificationsQuery } from "@/hooks/api/useNotifications";
import { isNotificationRead, notificationBody, notificationTitle } from "@/api/notifications";

type PortalUser = {
  name: string;
  role: string;
  roles: string[];
  permissions: string[];
  email: string;
  id: string;
};

export function PortalLayout({
  nav,
  portalName,
  user,
  badgeCounts,
  children,
}: {
  nav: NavSection[];
  portalName: string;
  user: PortalUser;
  badgeCounts?: Record<string, number>;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { data: notifications = [] } = useNotificationsQuery();

  const items = useMemo(() => notifications.filter((n) => !isNotificationRead(n)), [notifications]);
  const unread = items.length;

  // Never offer a link the account cannot open. Empty sections are dropped so
  // the sidebar does not show dangling headings.
  const visibleNav = useMemo(
    () =>
      nav
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => isAllowed(item.to, user.roles)),
        }))
        .filter((section) => section.items.length > 0),
    [nav, user.roles],
  );

  const crumbs = useBreadcrumbs(location.pathname, visibleNav);

  const handleLogout = async () => {
    try {
      await logout();
      navigate({ to: "/login", replace: true });
    } catch {
      toast.error("Could not reach the server to end the session. Try again.");
    }
  };

  const NavBody = ({ onClick }: { onClick?: () => void }) => (
    <nav aria-label={portalName} className="flex flex-1 flex-col gap-6 overflow-y-auto px-3">
      {visibleNav.map((section, i) => (
        <div key={section.title ?? i}>
          {section.title ? (
            <p className="px-3 pb-2 text-[11px] font-semibold tracking-[0.14em] text-ink-foreground/50 uppercase">
              {section.title}
            </p>
          ) : null}
          <ul className="space-y-1">
            {section.items.map((item) => {
              const active = item.end
                ? location.pathname === item.to
                : location.pathname === item.to || location.pathname.startsWith(item.to + "/");
              const Icon = item.icon;
              const badge = badgeCounts?.[item.to] ?? item.badge;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={onClick}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-ink-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="flex-1 truncate">{item.label}</span>
                    {typeof badge === "number" && badge > 0 ? (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                          active
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-primary/20 text-primary",
                        )}
                      >
                        {badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const footer = (
    <div className="border-t border-white/10 p-3">
      <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent px-3 py-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {initials(user.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-sidebar-accent-foreground">{user.name}</p>
          <p className="truncate text-xs text-ink-foreground/50">
            {roleLabel(user.role)}
            {user.roles.length > 1 ? ` +${user.roles.length - 1}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Log out"
          className="text-ink-foreground/60 hover:text-ink-foreground"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  );

  return (
    // `gov-dashboard` scopes the navy administrative palette defined in
    // styles.css. Nothing outside this wrapper inherits it, so the public
    // landing page keeps its own colours.
    <div className="gov-dashboard min-h-screen bg-background">
      <Toaster position="top-right" />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-ink text-ink-foreground lg:flex">
        <Link to="/" className="flex items-center gap-3 px-5 py-4">
          <span className="flex size-9 items-center justify-center rounded-lg bg-saffron text-sm font-bold text-white">
            MoTA
          </span>
          <span className="leading-tight">
            <span className="block font-display text-sm">Scholarship &amp; Fellowship</span>
            <span className="block text-[11px] tracking-wide text-ink-foreground/60 uppercase">
              {portalName}
            </span>
          </span>
        </Link>
        <div className="px-5 pb-3">
          <Badge className="border-white/15 bg-white/5 text-ink-foreground/80" variant="outline">
            {roleLabel(user.role)}
          </Badge>
        </div>
        <NavBody />
        {footer}
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open portal menu">
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 bg-ink p-0 text-ink-foreground">
          <SheetTitle className="sr-only">Portal menu</SheetTitle>
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 px-5 py-4">
              <span className="flex size-9 items-center justify-center rounded-lg bg-saffron text-sm font-bold text-white">
                MoTA
              </span>
              <span className="leading-tight">
                <span className="block font-display text-sm">Scholarship &amp; Fellowship</span>
                <span className="block text-[11px] tracking-wide text-ink-foreground/60 uppercase">
                  {portalName}
                </span>
              </span>
            </div>
            <NavBody onClick={() => setMobileOpen(false)} />
            {footer}
          </div>
        </SheetContent>
      </Sheet>

      {/* Main column */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="lg:hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  className="-ml-2"
                  aria-label="Open portal menu"
                  onClick={() => setMobileOpen(true)}
                >
                  <Menu className="size-5" />
                </Button>
              </div>
              {crumbs.length > 0 ? (
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link to="/" aria-label="Home">
                          <Home className="size-3.5" />
                        </Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    {crumbs.map((crumb, i) => (
                      <BreadcrumbItem key={crumb.to}>
                        <BreadcrumbSeparator />
                        {i === crumbs.length - 1 || !crumb.to ? (
                          <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <Link to={crumb.to}>{crumb.label}</Link>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    ))}
                  </BreadcrumbList>
                </Breadcrumb>
              ) : (
                <p className="truncate font-display text-sm font-medium">{portalName}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:inline-flex"
              >
                <Globe className="size-3.5" aria-hidden /> Public site
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Notifications"
                    className="relative"
                  >
                    <Bell className="size-5" />
                    {unread > 0 ? (
                      <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    ) : null}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Notifications</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {unread} unread
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="max-h-80 overflow-y-auto">
                    {items.length === 0 ? (
                      <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                        You are all caught up.
                      </p>
                    ) : (
                      items.slice(0, 6).map((n) => (
                        <DropdownMenuItem key={n.id} className="items-start gap-3 py-3">
                          <span
                            className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                            aria-hidden
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">
                              {notificationTitle(n)}
                            </span>
                            {notificationBody(n) ? (
                              <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                                {notificationBody(n)}
                              </span>
                            ) : null}
                          </span>
                        </DropdownMenuItem>
                      ))
                    )}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link
                      to="/portal/notifications"
                      className="justify-center text-center text-xs font-medium text-primary"
                    >
                      View all notifications
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 transition-colors hover:bg-accent"
                    aria-label="Account menu"
                  >
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
                        {initials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <ChevronDown
                      className="hidden size-4 text-muted-foreground sm:block"
                      aria-hidden
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel>
                    <p className="truncate">{user.name}</p>
                    <p className="truncate text-xs font-normal text-muted-foreground">
                      {user.email}
                    </p>
                    <p className="mt-1 truncate text-[11px] font-normal text-muted-foreground">
                      {roleLabel(user.role)}
                    </p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/portal/profile">
                      <UserRound className="size-4" aria-hidden /> My profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/portal/grievances">
                      <LifeBuoy className="size-4" aria-hidden /> Help &amp; grievances
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleLogout}>
                    <LogOut className="size-4" aria-hidden /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main id="main" className="px-4 py-6 md:px-6 md:py-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

type Crumb = { label: string; to?: string | undefined };

/**
 * Builds a trail from the visible navigation. Each segment is matched to the
 * nav item that owns it, so labels stay consistent with the sidebar and links
 * point at real routes instead of guessed URLs.
 */
function useBreadcrumbs(pathname: string, nav: NavSection[]): Crumb[] {
  return useMemo(() => {
    const all = nav.flatMap((s) => s.items);
    const bySpecificity = [...all].sort((a, b) => b.to.length - a.to.length);
    let current = pathname;
    const matched: Crumb[] = [];
    while (current !== "/" && current !== "") {
      const owner = bySpecificity.find(
        (item) => current === item.to || current.startsWith(`${item.to}/`),
      );
      if (owner) {
        matched.unshift({ label: owner.label, to: current === owner.to ? undefined : owner.to });
        // Exact matches must advance to their parent. Reusing `owner.to` here
        // made dashboard roots loop forever: `/officer` -> `/officer` -> ...
        current =
          current === owner.to ? current.slice(0, current.lastIndexOf("/")) || "/" : owner.to;
      } else {
        // No nav entry for this segment: fall back to a humanised slug.
        const seg = current.split("/").pop() ?? "";
        matched.unshift({ label: humaniseSlug(seg) });
        current = current.slice(0, current.lastIndexOf("/")) || "/";
      }
    }
    return matched;
  }, [pathname, nav]);
}

function humaniseSlug(seg: string): string {
  const s = seg.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  // Strip trailing ids so "applications 05e3…" reads as just "Applications"
  return /^[a-z ]+$/i.test(s) ? s : s.replace(/\s+[a-f0-9-]{6,}$/i, "");
}
