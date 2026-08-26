# CANARY POINT OS — by Apex Sync Intelligence

The Intelligent Operating System for Modern Enterprises.

This is a premium interactive prototype built for demoing Apex Sync's capabilities to CEOs, executives, and enterprise clients. All data is mocked — no backend required.

## What's built (v1 scope)

- **Executive Dashboard** (`/`) — fully built: AI Executive Summary with role-aware typewriter briefing, KPI grid with animated numbers and sparklines, revenue performance chart, portfolio breakdown by subsidiary, recent activity feed, and quick actions — all filtered by a live role switcher (CEO, Operations, Relationship Manager, Compliance, Customer Service).
- **AI Workspace** (`/ai-workspace`) — fully built: a conversational interface with Apex Intelligence. Empty-state welcome with role-aware suggested prompts, a real chat flow (typing indicator → typewriter-streamed response), and three scripted rich responses:
  - *"Summarize today's business performance"* → text summary + inline KPI stat row
  - *"Generate executive report"* → an inline generated report card with sections and a mock export button
  - *"Show customers at risk"* → an inline table of at-risk accounts with risk scores and reasons
  - Any other prompt gets a sensible generic response grounded in the same mock data, so the demo never dead-ends. Suggested prompts and the AI's tone both adapt to the active role.

- **Customer Relationship Workspace** (`/customers`) — fully built: a searchable, filterable customer directory (7 mock accounts across all four subsidiaries — active, at-risk, and onboarding) paired with a full profile view — health-score ring, ARR, owner, contact, and tags — and five connected tabs:
  - **Timeline** — a chronological, color-coded feed of deals, meetings, notes, support events, and system alerts
  - **Notes** — pinned and regular relationship notes
  - **Tasks** — checkable action items with due dates, assignees, and priority
  - **Meetings** — upcoming and completed meetings with attendees and notes
  - **Files** — attached documents with type icons and mock download

  Selecting a different customer or tab updates everything in place with a smooth transition — this is the "everything visually connected" piece of the brief.

- **Operations** (`/operations`) — fully built: an operations command center with four top-line stats (SLA compliance, open incidents, avg resolution time, automation coverage), a subsidiary health grid (all four subsidiaries with reconciliation status, SLA trend sparkline, incidents, and automation coverage bar), an SLA compliance trend chart (8-month, actual vs. target), a filterable incident queue table, and an automation opportunities panel surfacing the workflow bottlenecks referenced in the brief (e.g. Nova Insurance claims processing).

- **Document Intelligence** (`/documents`) — fully built: a searchable, filterable document library (6 mock documents — contracts, financial statements, a compliance filing, and a claims audit — spanning all four subsidiaries), a working "Simulate Upload" flow (drag-and-drop or button, 2.2s mock processing animation, new document lands in the library and auto-selects), and a document viewer with three tabs:
  - **AI Summary** — a generated plain-language summary of the document
  - **Extracted Data** — key-value fields pulled from the document (parties, dates, amounts, terms)
  - **Ask a Question** — a document-scoped Q&A chat (reuses the AI Workspace chat components) with suggested questions and canned answers grounded in the extracted fields, plus a sensible fallback for anything else

  One document (Halden & Cross MSA) is seeded in a "processing" state to show what the in-flight experience looks like.

- **Analytics** (`/analytics`) — fully built: a business intelligence view with four top-line stats (total revenue, net new ARR, net revenue retention, gross churn), a time-range-aware stacked revenue chart by subsidiary (30D/90D/YTD/12M — Nova Insurance's declining share tells the same story as Operations and Customers), a 12-month customer growth chart, a revenue-by-segment donut (Enterprise/Mid-Market/SMB), a subsidiary performance leaderboard, and a top-accounts-by-ARR panel that reuses the same customer data from the CRM screen.

- **Workflow Builder** (`/workflows`) — fully built: a visual, node-based automation builder with a workflow library (4 pre-built automations, each tied to an automation opportunity surfaced in Operations), a real drag-and-drop canvas (nodes are genuinely draggable, connections redraw live via SVG), a node palette to add new steps (Trigger, Action, Condition, AI Agent, Delay, Integration), a node inspector panel, and a working **Run Workflow** simulation that animates execution status through the graph node-by-node, correctly following branches (e.g. the Claims Intake Triage workflow's "Urgent? Yes/No" split).

  This completes all 5 screens from the original product brief.

- **Calendar** (`/calendar`) — an agenda view grouped by date, pulling from the same meeting data used in the CRM screen plus renewals, workflow runs, and reviews. Filterable by event type.

- **Notifications** (`/notifications`) — a notification center with read/unread state, mark-all-as-read, and filters (All / Unread / Alerts / Mentions / Workflows / System). Content is drawn from the same narrative threads as the rest of the app (the Nova Insurance SLA breach, Meridian Logistics risk signal, workflow run summaries, etc).

- **Knowledge Hub** (`/knowledge-hub`) — a searchable library of 8 playbooks, policies, onboarding guides, and product docs (e.g. "Handling At-Risk Account Escalations," "Nova Insurance Claims Triage SOP"), with category filters and a full article reading view.

- **Settings** (`/settings`) — tabbed account settings: Profile (including a role switcher that's wired to the same role context used everywhere else in the app), Notification Preferences (working toggles), Integrations (Salesforce, Slack, Outlook, Snowflake, Okta, etc. — connect/disconnect toggles), and Security (SSO status, active sessions, API access).

Every nav destination in the original brief is now fully built out.

Demo company: **Nova Financial Group** (Nova Bank, Nova Finance, Nova Capital, Nova Insurance).

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Framer Motion · Recharts · lucide-react

## Running it locally

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

To build for production:

```bash
npm run build
npm run start
```

> Note: the first build requires internet access to fetch the Syne, DM Sans, and JetBrains Mono fonts from Google Fonts (handled automatically via `next/font/google`).

## Where things live

- `app/` — routes (one folder per nav item, App Router convention)
- `components/dashboard/` — all Executive Dashboard widgets
- `components/ai-workspace/` — chat window, message bubbles, inline rich-content widgets, sidebar
- `components/customers/` — customer list, profile header, tabbed timeline/notes/tasks/meetings/files
- `components/operations/` — stats, subsidiary health grid, SLA chart, incident queue, automation opportunities
- `components/documents/` — document library, upload dropzone, viewer, summary/extracted/ask tabs
- `components/analytics/` — stats, revenue-by-subsidiary chart, customer growth, segment breakdown, leaderboards
- `components/workflows/` — workflow library, node canvas + drag logic, node palette, inspector, run simulation
- `components/calendar/` — agenda list with type filters
- `components/notifications/` — notification feed with read/unread state and filters
- `components/knowledge-hub/` — article list + detail viewer
- `components/settings/` — tabbed settings (profile, notifications, integrations, security)
- `components/layout/` — Sidebar, Topbar, role switcher + role context
- `components/ui/` — shared primitives (GlassCard, ComingSoon)
- `lib/mockData.ts` — all mock data (KPIs, revenue series, portfolio, activity, quick actions, AI summaries per role)
- `lib/types.ts` — shared TypeScript types

## Design system

- **Palette**: Matte black `#0A0A0B` / Charcoal `#16161A` / Gold `#C9A961` / Ivory `#F7F5F0` / Emerald `#3FBF8F` / Amber `#E0A845` / Crimson `#D8455F`
- **Type**: Syne (display) · DM Sans (body) · JetBrains Mono (data/labels)
- Glassmorphism cards, gold-glow accents, reduced-motion support, keyboard focus states built in.

## Next up (not yet built)

Every screen in the app is now fully built — all 5 original brief screens (Executive Dashboard, AI Workspace, Customer Relationship Workspace, Document Intelligence, Workflow Builder), the two extensions (Operations, Analytics), and all four remaining nav destinations (Calendar, Notifications, Knowledge Hub, Settings). There's nothing left stubbed as "Coming Soon."

From here, natural next steps would be wiring up a real backend (today everything is mock data held in `lib/mockData.ts`), adding persistence for things like task completion and notification read-state, or hooking the AI Workspace and Document Intelligence Q&A up to a live Claude API call instead of the scripted responses.
