# CLAUDE-CMP.md
# CMP — Content Management Platform for EF (Evergreen Farming)

Read CLAUDE.md and EXAMPLES.md first. This file adds project-specific context.

---

## Project Overview

CMP is an internal tool for managing organic content across multiple social platforms (FB, IG, TikTok, YouTube).

**Core pain point:** Creating content is not the problem. Scheduling and distributing it across platforms is — it's tedious enough that it doesn't get done.

**Goal of Phase 1:** Make it easy to plan content once and schedule/distribute to multiple platforms with minimal friction.

**3 pillars:**
1. Content Bank — store and search past + planned content
2. Content Planner — visualize schedule (Calendar / Kanban / Timeline)
3. Analytics — pull post performance from Meta API

---

## Tech Stack

- **Frontend:** Next.js 14 (App Router) + Tailwind CSS
- **Backend/DB:** Supabase (project: `emzvyiwilwsdgdyrupnk`)
- **Automation:** n8n (for FB/IG auto-post and Meta API data pull)
- **Language:** TypeScript

---

## Supabase Schema (Phase 1)

### Existing tables (CHATBOT system — do NOT modify)
```
contacts, posts, interactions, messages_log, comment_log, tags, contact_tags
```

### CMP tables (prefix: cmp_)
```sql
cmp_campaigns       -- campaign grouping
cmp_assets          -- image/video file library
cmp_content_items   -- one content idea = one row
cmp_schedules       -- one content item → many platform schedules
cmp_post_analytics  -- performance data pulled from Meta API
```

### Key relationship
```
cmp_campaigns
  └── cmp_content_items (campaign_id → cmp_campaigns.id)
        └── cmp_schedules (content_item_id → cmp_content_items.id)
              └── cmp_post_analytics (schedule_id → cmp_schedules.id)
```

### cmp_content_items.status flow
```
draft → review → approved → scheduled → published → archived
```

### cmp_schedules.post_mode
- `auto` = n8n triggers actual post to FB/IG
- `manual` = system reminds user, user posts manually (TikTok, YouTube)

### cmp_schedules.status flow
```
pending → auto_posted | manually_posted | failed | skipped
```

---

## Phase 1 Scope (build this, nothing else)

### Pages to build

**1. `/` — Dashboard**
- Today's scheduled posts (what needs to go out today)
- Upcoming posts this week
- Quick stats: total draft / approved / scheduled / published this month

**2. `/content` — Content Bank**
- List all cmp_content_items
- Filter by: status / platform / campaign / content_type / tags
- Search by title and caption
- Click to open detail

**3. `/content/new` — Create Content**
- Form: title, content_type, caption_main, tags, campaign_id
- Add schedules inline: pick platform + date/time + post_mode
- Upload asset (store URL, save to cmp_assets)

**4. `/content/[id]` — Content Detail**
- Show content info + all schedules
- Edit status (approve / archive)
- Show analytics if published

**5. `/planner` — Content Planner**
- Calendar view (default)
- Kanban view (grouped by status)
- Timeline view (grouped by campaign)
- Each item shows: platform icon + title + time + status badge

**6. `/campaigns` — Campaigns**
- List campaigns with content count
- Create / archive campaign

**7. `/analytics` — Analytics**
- Table of published posts with reach / likes / comments / shares
- Filter by platform and date range

### What NOT to build in Phase 1
- User authentication / roles (single user system for now)
- AI content generation
- TikTok / YouTube auto-post (manual remind only)
- Asset management page (upload inline in content form is enough)
- Notification system

---

## n8n Integration Points

n8n handles two things — do NOT replicate this logic in Next.js:

1. **FB/IG Auto-post:** n8n polls `cmp_schedules` where `post_mode = 'auto'` and `status = 'pending'` and `scheduled_at <= now()`, then posts via Meta Graph API and updates `status` and `platform_post_id`

2. **Analytics pull:** n8n runs daily cron, fetches Meta Insights for all `platform_post_id` in `cmp_schedules`, upserts into `cmp_post_analytics`

Next.js only reads/writes Supabase. It does not call Meta API directly.

---

## Platforms Reference

| Key | Platform | Auto-post | Notes |
|-----|----------|-----------|-------|
| fb | Facebook | Yes (n8n) | Main platform |
| ig | Instagram | Yes (n8n) | Business account required |
| tiktok | TikTok | No (manual) | Remind only |
| youtube | YouTube | No (manual) | Remind only |
| shopee | Shopee | No (manual) | Rare use |
| other | Other | No (manual) | Fallback |

---

## UI Reference

See `dashboard-preview.html` in project root for the exact UI design to replicate.

## UI Guidelines

- Language: Thai UI labels, English code/variable names
- Status badge colors:
  - draft → gray
  - review → yellow
  - approved → blue
  - scheduled → purple
  - published → green
  - archived → gray (muted)
- Platform icons: use simple emoji or SVG — FB=🔵, IG=🟣, TikTok=⚫, YouTube=🔴

---

## Supabase Client Setup

```ts
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://emzvyiwilwsdgdyrupnk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from Supabase dashboard>
```

---

## Development Priority Order

Build in this order — each step should be functional before moving to next:

1. Supabase client + TypeScript types for all cmp_ tables
2. `/content` page — list with filter/search
3. `/content/new` — create form with inline schedule
4. `/content/[id]` — detail + status update
5. `/planner` — calendar view first, then kanban
6. `/` dashboard
7. `/campaigns`
8. `/analytics`
