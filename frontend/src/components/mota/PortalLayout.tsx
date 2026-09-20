import { Link, useLocation } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";
import type { NavSection } from "@/lib/portal-nav";
import { cn } from "@/lib/utils";
import { Globe, LogOut, Menu, UserRound, LifeBuoy, Bell, ChevronDown, Clock } from "lucide-react";
import { useNotificationsQuery } from "@/hooks/api/useNotifications";

type PortalUser = { name: string; role: string; id: string };

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
  const { data: notifications = [] } = useNotificationsQuery();
  const unread = Array.isArray(notifications)
    ? notifications.filter((n: Record<string, unknown>) => !n.read && n.unread !== false).length
    : 0;

  const NavBody = ({ onClick }: { onClick?: () => void }) => (
    <nav aria-label={portalName} className="flex flex-1 flex-col gap-6 overflow-y-auto px-3">
      {nav.map((section, i) => (
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
          <p className="truncate text-xs text-ink-foreground/50">{user.role}</p>
        </div>
        <Link
          to="/login"
          aria-label="Log out"
          className="text-ink-foreground/60 hover:text-ink-foreground"
        >
          <LogOut className="size-4" />
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" />
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-ink text-ink-foreground lg:flex">
        <Link to="/" className="flex items-center gap-3 px-5 py-4">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
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
          <Badge className="border-white/10 bg-white/5 text-ink-foreground/80" variant="outline">
            {user.role}
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
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
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
            <div className="flex items-center gap-3">
              <div className="lg:hidden">
                <Menu className="size-5 text-muted-foreground" aria-hidden />
              </div>
              <div className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
                <span className="flex items-center gap-1 rounded-md border bg-accent px-2 py-1 font-medium text-accent-foreground">
                  <Clock className="size-3" aria-hidden /> Session active
                </span>
                <span>Seamless portal experience</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:inline-flex"
                aria-label="Go to public portal"
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
                        {unread}
                      </span>
                    ) : null}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Notifications</span>
                    <span className="text-xs text-muted-foreground">{unread} unread</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.slice(0, 5).map((n: Record<string, unknown>, i: number) => (
                      <DropdownMenuItem
                        key={(n.id as string) ?? i}
                        className="items-start gap-3 py-3"
                      >
                        <span
                          className={cn(
                            "mt-1 size-2 shrink-0 rounded-full",
                            n.unread || !n.read ? "bg-primary" : "bg-border",
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">
                            {(n.title as string) ?? "Notification"}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {(n.body as string) ?? ""}
                          </span>
                          <span className="mt-1 block text-[10px] text-muted-foreground uppercase">
                            {(n.time as string) ?? (n.created_at as string) ?? ""}
                          </span>
                        </span>
                      </DropdownMenuItem>
                    ))}
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
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <p className="truncate">{user.name}</p>
                    <p className="truncate text-xs font-normal text-muted-foreground">{user.id}</p>
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
                  <DropdownMenuItem asChild>
                    <Link to="/login">
                      <LogOut className="size-4" aria-hidden /> Log out
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 md:px-6 md:py-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
