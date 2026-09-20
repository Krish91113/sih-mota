import type { ComponentType } from "react";
import {
  LayoutDashboard,
  UserRound,
  FolderKanban,
  FilePlus2,
  FolderOpen,
  AlertTriangle,
  Bell,
  LifeBuoy,
  BadgeCheck,
  Landmark,
  Users,
  ClipboardList,
  ShieldCheck,
  Scale,
  Newspaper,
  Settings,
  SlidersHorizontal,
  Plug,
  Cog,
  Sparkles,
  BarChart3,
  ScrollText,
  ListChecks,
  Wallet,
  Banknote,
  ArrowLeftRight,
  ShieldAlert,
  TrendingUp,
  Gauge,
  Database,
  Filter,
  CheckSquare,
  FolderCheck,
} from "lucide-react";

export type NavIcon = ComponentType<{ className?: string }>;

export type NavItem = {
  label: string;
  to: string;
  icon: NavIcon;
  end?: boolean;
  badge?: number;
};

export type NavSection = {
  title?: string;
  items: NavItem[];
};

export const applicantNav: NavSection[] = [
  {
    items: [
      { label: "Dashboard", to: "/portal", icon: LayoutDashboard, end: true },
      { label: "Profile", to: "/portal/profile", icon: UserRound },
      { label: "Applications", to: "/portal/applications", icon: FolderKanban },
      { label: "New Application", to: "/portal/applications/new", icon: FilePlus2 },
      { label: "Documents", to: "/portal/documents", icon: FolderOpen },
      { label: "Deficiencies", to: "/portal/deficiencies", icon: AlertTriangle },
      { label: "Awards", to: "/portal/awards", icon: BadgeCheck },
    ],
  },
  {
    title: "Support",
    items: [
      { label: "Notifications", to: "/portal/notifications", icon: Bell },
      { label: "Grievances", to: "/portal/grievances", icon: LifeBuoy },
    ],
  },
];

export const institutionNav: NavSection[] = [
  {
    items: [
      { label: "Dashboard", to: "/institution", icon: LayoutDashboard, end: true },
      { label: "Assigned Applications", to: "/institution/applications", icon: FolderKanban },
      { label: "Verification Queue", to: "/institution/verifications", icon: ListChecks },
      { label: "Clarifications", to: "/institution/clarifications", icon: ShieldCheck },
    ],
  },
  {
    title: "Administration",
    items: [{ label: "Institution Users", to: "/institution/users", icon: Users }],
  },
];

export const officerNav: NavSection[] = [
  {
    items: [
      { label: "Dashboard", to: "/officer", icon: LayoutDashboard, end: true },
      { label: "Work Queue", to: "/officer/queue", icon: ClipboardList },
      { label: "Deficiencies", to: "/officer/deficiencies", icon: AlertTriangle },
      { label: "Grievances", to: "/officer/grievances", icon: LifeBuoy },
      { label: "Clarifications", to: "/officer/clarifications", icon: ShieldCheck },
      { label: "Notifications", to: "/officer/notifications", icon: Bell },
    ],
  },
];

export const committeeNav: NavSection[] = [
  {
    items: [
      { label: "Dashboard", to: "/committee", icon: LayoutDashboard, end: true },
      { label: "Candidates", to: "/committee/candidates", icon: Users },
    ],
  },
];

export const approvalNav: NavSection[] = [
  {
    items: [
      { label: "Dashboard", to: "/approval", icon: LayoutDashboard, end: true },
      { label: "Approval Queue", to: "/approval/queue", icon: Scale },
    ],
  },
];

export const financeNav: NavSection[] = [
  {
    items: [
      { label: "Dashboard", to: "/finance", icon: LayoutDashboard, end: true },
      { label: "Awards", to: "/finance/awards", icon: BadgeCheck },
      { label: "Sanctions", to: "/finance/sanctions", icon: Landmark },
      { label: "Disbursements", to: "/finance/disbursements", icon: Banknote },
      { label: "Reconciliation", to: "/finance/reconciliation", icon: ArrowLeftRight },
      { label: "Exceptions", to: "/finance/exceptions", icon: ShieldAlert },
    ],
  },
];

export const adminNav: NavSection[] = [
  {
    items: [{ label: "Dashboard", to: "/admin", icon: LayoutDashboard, end: true }],
  },
  {
    title: "Scheme Configuration",
    items: [{ label: "Schemes & Versions", to: "/admin/schemes", icon: FolderKanban }],
  },
  {
    title: "Access Control",
    items: [
      { label: "Users", to: "/admin/users", icon: Users },
      { label: "Roles", to: "/admin/roles", icon: ShieldCheck },
      { label: "Permissions", to: "/admin/permissions", icon: CheckSquare },
      { label: "Scopes", to: "/admin/scopes", icon: Filter },
    ],
  },
  {
    title: "Communications",
    items: [
      { label: "Notifications", to: "/admin/notifications", icon: Bell },
      { label: "Notification Templates", to: "/admin/notification-templates", icon: Newspaper },
    ],
  },
  {
    title: "Platform",
    items: [
      { label: "Integrations", to: "/admin/integrations", icon: Plug },
      { label: "System Configuration", to: "/admin/system", icon: Cog },
      { label: "AI Configuration", to: "/admin/ai", icon: Sparkles },
    ],
  },
];

export const analyticsNav: NavSection[] = [
  {
    items: [
      { label: "Executive", to: "/analytics", icon: Gauge, end: true },
      { label: "Operational", to: "/analytics/operational", icon: Settings },
      { label: "Scheme", to: "/analytics/scheme", icon: FolderKanban },
      { label: "Processing Time", to: "/analytics/processing", icon: TrendingUp },
      { label: "Selection", to: "/analytics/selection", icon: Scale },
      { label: "AI Analytics", to: "/analytics/ai", icon: Sparkles },
    ],
  },
];

export const auditNav: NavSection[] = [
  {
    items: [
      { label: "Audit Dashboard", to: "/audit", icon: ScrollText, end: true },
      { label: "Audit Log", to: "/audit/log", icon: Database },
    ],
  },
];

export const portalLabel = {
  applicant: "Applicant Portal",
  institution: "Institution Portal",
  officer: "Officer Workspace",
  committee: "Committee Workspace",
  approval: "Approval Workspace",
  finance: "Finance Module",
  admin: "Admin Console",
  analytics: "Analytics Console",
  audit: "Audit Trail Viewer",
} as const;

export type PortalKey = keyof typeof portalLabel;
