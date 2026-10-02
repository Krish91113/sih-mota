# MoTA Scholarships

Build the UI/UX only for an "AI-Enabled Scholarship and Fellowship Management System for Scheduled Tribes — Ministry of Tribal Affairs (MoTA)".

Use the attached Frontend FRD as the functional reference and the supplied Embassy of India website screenshot as the PRIMARY visual inspiration.

DESIGN:

- Government of India institutional feel

- Premium, trustworthy, clean, modern and highly professional

- White/off-white base with warm saffron/orange/coral accents

- Dark footer

- Strong typography hierarchy

- Spacious editorial sections

- Rounded cards, subtle borders/shadows

- Clean illustrations/images

- Minimal animations

- Mobile-first and accessible

- Do NOT make it look like a generic SaaS, crypto dashboard, or futuristic AI website

- Public website should visually resemble the reference screenshot while being redesigned for MoTA

PUBLIC WEBSITE:

Create:

Home

Schemes

Scheme Details

Guidelines

Notices

FAQs

Contact

Grievance Info

Login

Register

Homepage sections:

- Government top bar

- MoTA navbar

- Hero with scholarship/fellowship messaging

- Explore Schemes cards

- How It Works

- Eligibility/Documents overview

- Important Notices

- Statistics

- Application Status CTA

- FAQs

- Useful Links

- Government-style footer

APPLICANT PORTAL:

Create:

Dashboard

Profile

Applications

New Application

Application Details

Documents

Deficiencies

Notifications

Grievances

Dashboard should show:

- Welcome

- Active applications

- status/progress

- next action

- deficiencies

- notifications

- quick actions

APPLICATION UX:

Create a polished multi-step application experience with:

- progress indicator

- section navigation

- dynamic form area

- application checklist

- autosave UI

- validation/error states

- Save Draft

- Continue

- Review

- Submit

Build reusable dynamic-form UI components; do not create separate NFST/NOS page designs.

DOCUMENT UI:

Create elegant document cards with:

- required/optional

- upload

- preview

- replace

- version history

- verification status

- processing state

DEFICIENCY UI:

Create prominent "Action Required" cards with:

- issue

- required action

- deadline

- Resolve Now

- replacement upload

- review

- submit response

APPLICATION TRACKING:

Create a polished visual timeline:

Submitted → Validation → Documents → Institution Verification → Scrutiny → Selection → Approval → Awarded

INSTITUTION PORTAL:

Dashboard, assigned applications, verification queue, application detail, verification actions and clarification states.

OFFICER WORKSPACE:

Desktop-first professional operations dashboard with:

- sidebar

- topbar

- KPI cards

- filters

- searchable/paginated application table

- SLA/priority indicators

- application review page

- document review split-screen

- eligibility panel

- deficiencies

- notes

- history

- audit trail

- sticky action bar

COMMITTEE PORTAL:

Candidate list, score breakdown, evidence, comments, conflict disclosure, recommend/not recommend/abstain.

APPROVAL PORTAL:

Decision Packet containing applicant, eligibility, documents, institution verification, scrutiny, selection, deficiencies, notes and audit history.

ADMIN CONSOLE:

Create polished interfaces for:

- Scheme Management

- Scheme Versions

- Rule Builder

- Form Builder

- Workflow Builder

- Document Configuration

- Users

- Roles & Permissions

- Notifications

- Integrations

- System Configuration

- AI Configuration

ANALYTICS:

Create:

- Executive Dashboard

- Operational Dashboard

- Scheme Dashboard

- Processing Analytics

- AI Analytics

with polished charts, KPI cards, filters and empty/loading/error states.

AUDIT:

Read-only searchable audit log interface.

AI-READY UI:

Create these components now:

- AI Summary Card

- AI Confidence Badge

- AI Review Workspace

- Cross-document consistency flag

- Duplicate/risk advisory

Initially show:

"AI review not yet available — manual verification in progress."

Do not display fake AI results.

UX RULES:

- One consistent MoTA design system across all portals

- Applicant UI = simple and low-cognitive-load

- Officer/Admin UI = information-dense and productivity-focused

- Responsive on mobile/tablet/desktop

- Accessible keyboard navigation, focus states, labels and readable contrast

- Excellent loading, empty, error and success states

- No lorem ipsum or generic placeholder content

- Use realistic scholarship-domain content without inventing official claims

- Keep components reusable and production-quality

IMPORTANT:

Focus ONLY on the frontend UI/UX and visual implementation for now.

Do not build backend logic or real API integrations.

Use realistic mock data where necessary.

Make the final result look like a polished, launch-ready Government of India scholarship platform rather than a prototype.

build this in minimum token

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
