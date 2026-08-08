# DESIGN-GAP-ANALYSIS — ra-labs

Date: 2026-08-08
References: `docs/design/wireframes.html` (functional/structural contract),
`docs/design/index-v2.html` (visual contract), current React implementation.

Legend: MATCHED · PARTIALLY_MATCHED · MISSING · INCORRECT

---

## Homepage

### Header / Navigation
| Reference | Current | Class |
|---|---|---|
| Light cream bg; wordmark "R&A *Labs*" italic-emerald; nav Work/Process/Team; live badge with pulsing dot | Dark blueprint bg; wordmark "R&A Labs"; nav work/process/team/contact; no pulsing badge | INCORRECT |
| Nav collapses at 820px (hidden on mobile) | Nav responsive but no matching collapse behavior | PARTIALLY_MATCHED |

### Hero
| Reference | Current | Class |
|---|---|---|
| Eyebrow "Engineering studio" (brass, uppercase) | Eyebrow text present | PARTIALLY_MATCHED |
| Serif H1 with brass-highlighted span | Serif H1, different highlight | PARTIALLY_MATCHED |
| Lede copy: "R&A Labs pairs senior .NET and Azure engineering with an AI agent workforce…" | Generic lede | INCORRECT |
| Dual CTA: primary emerald "Start a project" + ghost "See the work" | CTAs present | PARTIALLY_MATCHED |
| 1:1 hero-art layered gradient with SVG circles + path | Dark abstract art | INCORRECT |
| Two-column hero grid (1.15fr/0.85fr), single-col ≤820px | Grid present | PARTIALLY_MATCHED |

### Process
| Reference | Current | Class |
|---|---|---|
| 5 columns with dashed connector line above circles | 5 steps present | PARTIALLY_MATCHED |
| Numbered circles (emerald border, serif digit) | Circle numbers present but styled differently | PARTIALLY_MATCHED |
| Step titles: Discuss/Sketch/Architect/Build/Refine | Matches (content-driven) | MATCHED |
| Mobile: 2-col grid, connector hidden | Different mobile layout | INCORRECT |

### Portfolio ("Selected work")
| Reference | Current | Class |
|---|---|---|
| 3-col card grid; gradient covers g1/g2/g3 | 3-col grid; dark gradient palette | INCORRECT |
| Card: status (uppercase emerald), serif/Inter title, desc, tags, meta row (build time + "github ↗") | Card: title, desc, tags; no build-time meta | PARTIALLY_MATCHED |
| Card hover (tabindex, interactive) | Link-based card | PARTIALLY_MATCHED |
| Section head: eyebrow + "A few systems we've built" | Similar heading | MATCHED |

### Team
| Reference | Current | Class |
|---|---|---|
| 2-col; person card with initials avatar (gradient), name, brass role, mono stats (commits 90d / active repos / last commit) | 2-col; card with avatar, name, role, stats | PARTIALLY_MATCHED |
| "Two founders, GitHub-verified" + "Stats pulled live" | Heading present | MATCHED |
| Em-dash placeholders for members without stats | Shows zeros instead | INCORRECT |

### Contact
| Reference | Current | Class |
|---|---|---|
| Emerald gradient panel; "Tell us the problem. We'll sketch the first version."; brass on-dark CTA "Start a conversation" (mailto) | Green-dark panel + CTA | PARTIALLY_MATCHED |
| CTA is a mailto link | CTA links to /contact page | PARTIALLY_MATCHED |

### Footer
| Reference | Current | Class |
|---|---|---|
| "© 2026 R&A Labs" + mono "built by the studio it describes" | Copyright + tagline (different) | PARTIALLY_MATCHED |

---

## Portfolio detail (`/work/:slug`)
| Reference | Current | Class |
|---|---|---|
| Cover screenshot hero, live badge, stack tags | Title + status + tags + cover | MATCHED |
| Case study body + "view on github" | GitHub link + rendered body | MATCHED |

## Admin dashboard
| Reference | Current | Class |
|---|---|---|
| Sidebar: Dashboard/Leads/Projects/Portfolio/Team/Content/Settings | Sidebar: Dashboard/Leads/Portfolio/Team/My Profile/Content/Chat/Settings | PARTIALLY_MATCHED (Projects missing) |
| Stat cards: new leads / active projects / invoices pending / last github commit | Stat cards partial (no projects/invoices) | PARTIALLY_MATCHED |
| Activity table (lead/project/github rows) | Recent-leads table only | PARTIALLY_MATCHED |

## Admin add/edit project
| Reference | Current | Class |
|---|---|---|
| Two-column form: title/summary/tags/status/github; cover upload + case study; save draft/publish | Modal form with matching fields | MATCHED |

## Admin add/edit team member
| Reference | Current | Class |
|---|---|---|
| Name/role/github/bio + avatar + read-only snapshot | Present | MATCHED |

## Admin leads inbox
| Reference | Current | Class |
|---|---|---|
| List + thread preview + "convert to customer project" | List + status patch + notes; no thread preview/convert | PARTIALLY_MATCHED |

## MISSING from current implementation entirely
- Customer portal (register/login/dashboard/project/chat/docs/PRD/approval/demo/invoice/feedback)
- Admin Projects board, Customers, PRD editor, Demo, Invoice, Feedback approval
- Services / Testimonials sections (not in index-v2.html; wireframe doesn't mandate — skip, keep to references)

---

## Top design actions
1. Replace `web-public` design tokens with index-v2.html palette/type (P0).
2. Rebuild hero, process connector, portfolio cards (gradient covers + meta), team cards (mono stats, em-dash empty), contact panel, footer to reference (P1).
3. Add admin Projects entry + lead convert + thread preview (P1).
4. Build customer portal (P0 — functional, reference-level fidelity).
