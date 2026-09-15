/**
 * Centralized TanStack Query key factory.
 *
 * Ensures consistent, predictable cache keys across the app.
 * Every query/mutation in the hooks layer references these.
 */

export const queryKeys = {
  // ── Auth ────────────────────────────────────────────────────────────────────
  auth: {
    me: ["auth", "me"] as const,
    profile: ["auth", "profile"] as const,
    sessions: ["auth", "sessions"] as const,
  },

  // ── Schemes ─────────────────────────────────────────────────────────────────
  schemes: {
    all: ["schemes"] as const,
    list: (filters?: Record<string, unknown>) => ["schemes", filters] as const,
    detail: (id: string) => ["schemes", id] as const,
    versions: (schemeId: string) => ["schemes", schemeId, "versions"] as const,
  },

  schemeVersions: {
    detail: (id: string) => ["schemeVersions", id] as const,
    form: (id: string) => ["schemeVersions", id, "form"] as const,
    rules: (id: string) => ["schemeVersions", id, "rules"] as const,
  },

  // ── Applications ────────────────────────────────────────────────────────────
  applications: {
    all: ["applications"] as const,
    list: (filters?: Record<string, unknown>) => ["applications", filters] as const,
    detail: (id: string) => ["applications", id] as const,
    versions: (id: string) => ["applications", id, "versions"] as const,
    answers: (id: string) => ["applications", id, "answers"] as const,
    status: (id: string) => ["applications", id, "status"] as const,
    timeline: (id: string) => ["applications", id, "timeline"] as const,
    transitions: (id: string) => ["applications", id, "transitions"] as const,
    sla: (id: string) => ["applications", id, "sla"] as const,
    approvalPacket: (id: string) => ["applications", id, "approvalPacket"] as const,
    decisionPacket: (id: string) => ["applications", id, "decisionPacket"] as const,
    eligibility: (id: string) => ["applications", id, "eligibility"] as const,
  },

  // ── Documents ───────────────────────────────────────────────────────────────
  documents: {
    all: ["documents"] as const,
    list: (params?: Record<string, unknown>) => ["documents", params] as const,
    detail: (id: string) => ["documents", id] as const,
    downloadUrl: (id: string) => ["documents", id, "downloadUrl"] as const,
    verificationQueue: ["documents", "verificationQueue"] as const,
  },

  // ── Deficiencies ────────────────────────────────────────────────────────────
  deficiencies: {
    all: ["deficiencies"] as const,
    list: (params?: Record<string, unknown>) => ["deficiencies", params] as const,
    detail: (id: string) => ["deficiencies", id] as const,
  },

  // ── Scrutiny ────────────────────────────────────────────────────────────────
  scrutiny: {
    queue: ["scrutiny", "queue"] as const,
    application: (id: string) => ["scrutiny", id] as const,
  },

  // ── Selection ───────────────────────────────────────────────────────────────
  selection: {
    all: ["selection"] as const,
    candidates: (params?: Record<string, unknown>) => ["selection", "candidates", params] as const,
    candidate: (id: string) => ["selection", "candidate", id] as const,
    scores: (id: string) => ["selection", "candidate", id, "scores"] as const,
    reviews: (id: string) => ["selection", "candidate", id, "reviews"] as const,
    comments: (id: string) => ["selection", "candidate", id, "comments"] as const,
    round: (id: string) => ["selectionRounds", id] as const,
  },

  // ── Finance ─────────────────────────────────────────────────────────────────
  finance: {
    exceptions: (params?: Record<string, unknown>) => ["finance", "exceptions", params] as const,
    reconciliation: (params?: Record<string, unknown>) =>
      ["finance", "reconciliation", params] as const,
  },

  awards: {
    all: ["awards"] as const,
    list: (params?: Record<string, unknown>) => ["awards", params] as const,
    detail: (id: string) => ["awards", id] as const,
    financeRecords: (id: string) => ["awards", id, "financeRecords"] as const,
    installments: (id: string) => ["awards", id, "installments"] as const,
  },

  // ── Notifications ───────────────────────────────────────────────────────────
  notifications: {
    all: ["notifications"] as const,
    list: (params?: Record<string, unknown>) => ["notifications", params] as const,
  },

  // ── Grievances ──────────────────────────────────────────────────────────────
  notes: {
    all: ["notes"] as const,
    application: (id: string) => ["notes", "application", id] as const,
  },

  grievances: {
    all: ["grievances"] as const,
    list: (params?: Record<string, unknown>) => ["grievances", params] as const,
    detail: (id: string) => ["grievances", id] as const,
  },

  // ── Users / RBAC ────────────────────────────────────────────────────────────
  users: {
    all: ["users"] as const,
    detail: (id: string) => ["users", id] as const,
    roles: (id: string) => ["users", id, "roles"] as const,
    scopes: (id: string) => ["users", id, "scopes"] as const,
  },

  roles: {
    all: ["roles"] as const,
    detail: (id: string) => ["roles", id] as const,
    permissions: (id: string) => ["roles", id, "permissions"] as const,
  },

  permissions: {
    all: ["permissions"] as const,
  },

  // ── Institutions ────────────────────────────────────────────────────────────
  institutions: {
    all: ["institutions"] as const,
    detail: (id: string) => ["institutions", id] as const,
    users: (id: string) => ["institutions", id, "users"] as const,
  },

  // ── Workflow ────────────────────────────────────────────────────────────────
  workflows: {
    detail: (id: string) => ["workflows", id] as const,
  },

  // ── Reports ─────────────────────────────────────────────────────────────────
  reports: {
    summary: (params?: Record<string, unknown>) => ["reports", "summary", params] as const,
    executive: (params?: Record<string, unknown>) => ["reports", "executive", params] as const,
    operational: (params?: Record<string, unknown>) => ["reports", "operational", params] as const,
    scheme: (params?: Record<string, unknown>) => ["reports", "scheme", params] as const,
    processing: (params?: Record<string, unknown>) => ["reports", "processing", params] as const,
    selection: (params?: Record<string, unknown>) => ["reports", "selection", params] as const,
  },

  // ── Audit ───────────────────────────────────────────────────────────────────
  audit: {
    all: ["audit"] as const,
    list: (params?: Record<string, unknown>) => ["audit", params] as const,
    detail: (id: string) => ["audit", id] as const,
  },

  // ── AI ──────────────────────────────────────────────────────────────────────
  ai: {
    config: ["ai", "config"] as const,
  },

  // ── Approvals queue ─────────────────────────────────────────────────────────
  approvals: {
    queue: (params?: Record<string, unknown>) => ["approvals", "queue", params] as const,
  },
} as const;
