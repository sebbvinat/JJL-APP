# Design Handoff Spec: JJL Elite — Jiu Jitsu Training App

> **Stack**: Next.js 16 + React 19 + Tailwind CSS 4 + Supabase + Lucide Icons
> **Target**: Adults 30+ training jiu jitsu. Mobile-first, dark-only theme.
> **Last updated**: 2026-04-13

---

## 1. Design Tokens

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| `jjl-red` | `#DC2626` | Primary CTA, brand accent, active states |
| `jjl-red-hover` | `#B91C1C` | Button hover states |
| `jjl-dark` | `#000000` | Page background |
| `jjl-gray` | `#1A1A1A` | Card backgrounds |
| `jjl-gray-light` | `#262626` | Input backgrounds, secondary surfaces |
| `jjl-muted` | `#B0B8C4` | Secondary text, labels, placeholders |
| `jjl-border` | `#333333` | Borders, dividers |
| `belt-white` | `#FFFFFF` | Belt: Blanco |
| `belt-blue` | `#3B82F6` | Belt: Azul |
| `belt-purple` | `#8B5CF6` | Belt: Purpura |
| `belt-brown` | `#92400E` | Belt: Marron |
| `belt-black` | `#111111` | Belt: Negro |

**Semantic colors** (Tailwind utilities, not custom tokens):

| Purpose | Color | Usage |
|---------|-------|-------|
| Success | `green-400` / `green-500` | Completed lessons, check-in confirmed, trained days |
| Warning | `orange-400` | Streaks, fire emoji |
| Points | `yellow-400` | Points, trophies |
| Info | `blue-400` | Module count |
| Danger | `red-400` + `red-900/30` bg | Delete buttons, sign out, error states |
| Admin | `yellow-500` / `yellow-400` | Admin nav highlight |

### Typography

| Token | Value | Usage |
|-------|-------|-------|
| `font-sans` | Inter, system-ui, -apple-system, sans-serif | All text |
| Hero heading | `text-4xl sm:text-5xl lg:text-6xl font-black leading-tight` | Landing page title |
| Page heading | `text-2xl font-bold` | Dashboard welcome, page titles |
| Card heading | `text-lg font-semibold` | Section titles inside cards |
| Body | `text-sm` (14px) | Default body text |
| Small/label | `text-xs` (12px) | Labels, metadata, nav labels |
| Brand subtitle | `text-xs font-semibold tracking-[0.2em] uppercase` | "Latino" under logo |

> **Minimum text size**: 12px (`text-xs`). No `text-[10px]` allowed — critical for 30+ readability.

### Spacing

| Pattern | Value | Usage |
|---------|-------|-------|
| Section gaps | `space-y-6` (24px) | Between dashboard sections |
| Component gaps | `space-y-4` (16px) | Between related items |
| Card padding | `p-5` (20px) | Standard card interior |
| Page padding | `p-4 lg:p-6` | Main content area |
| Button sm | `px-3 py-1.5` | Small buttons |
| Button md | `px-4 py-2` | Default buttons |
| Button lg | `px-6 py-3` | Large CTA buttons |
| Input | `px-4 py-2.5` | Form inputs |

### Border Radius

| Element | Value |
|---------|-------|
| Cards, containers | `rounded-xl` (12px) |
| Buttons, inputs | `rounded-lg` (8px) |
| Avatars, dots | `rounded-full` |

### Shadows & Effects

| Element | Effect |
|---------|--------|
| Card hover | `border-jjl-red/40` + shadow (implied by hover prop) |
| Focus ring | `ring-2 ring-jjl-red/50` |
| Text selection | `background: #DC2626, color: #FFFFFF` |
| Scrollbar | 6px wide, `#333` thumb, `#000` track |

---

## 2. Layout Architecture

### Dashboard Shell

```
┌─────────────────────────────────────────────────┐
│ Topbar (h-16, sticky, z-40)                     │
├──────────┬──────────────────────────────────────┤
│ Sidebar  │ Main Content                         │
│ (w-64)   │ (flex-1, overflow-y-auto)            │
│ Desktop  │ p-4 lg:p-6 pb-20 lg:pb-6            │
│ only     │ max-w-4xl (dashboard)                │
│          │                                       │
│          │                                       │
├──────────┴──────────────────────────────────────┤
│ MobileNav (h-16, fixed bottom, lg:hidden, z-40) │
└─────────────────────────────────────────────────┘
```

### Responsive Breakpoints

| Breakpoint | Behavior |
|------------|----------|
| Mobile `<1024px` | Sidebar hidden, hamburger menu in topbar, bottom nav visible, `p-4` padding, `pb-20` for nav clearance |
| Desktop `≥1024px` (`lg:`) | Sidebar visible (w-64), bottom nav hidden, `p-6` padding |
| Grids | `grid-cols-2 lg:grid-cols-4` (stats), `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` (modules) |

### Safe Area

```css
.safe-area-bottom { padding-bottom: env(safe-area-inset-bottom); }
```
Applied to MobileNav for notch devices.

---

## 3. Component Specs

### Button

| Variant | Background | Text | Hover |
|---------|-----------|------|-------|
| `primary` | `bg-jjl-red` | `text-white` | `bg-jjl-red-hover` |
| `secondary` | `bg-jjl-gray-light` | `text-white` | `bg-jjl-gray` |
| `ghost` | transparent | `text-jjl-muted` | `text-white bg-jjl-gray-light` |
| `danger` | `bg-red-900/30` | `text-red-400` | `bg-red-900/50` |

**States**: Loading (spinner + disabled), Disabled (opacity-50, cursor-not-allowed)
**Focus**: `ring-2 ring-jjl-red/50`
**Transition**: `transition-colors` (150ms default)

### Card

- Background: `bg-jjl-gray`
- Border: `border border-jjl-border rounded-xl`
- Hover variant: `border-jjl-red/40` + shadow on hover
- Padding: `p-5`

### Input

- Background: `bg-jjl-gray-light`
- Border: `border-jjl-border`
- Focus: `ring-2 ring-jjl-red/50 border-jjl-red`
- Error: `border-red-500` + red error text below
- Padding: `px-4 py-2.5`

### Badge (Belt)

- Dynamic background from `BELT_COLORS[belt]`
- Text: `text-white` (except white belt → `text-black`)
- Size: `text-xs font-bold px-2.5 py-0.5 rounded-full`

### Avatar

| Size | Dimensions |
|------|-----------|
| `sm` | 32×32px |
| `md` | 40×40px |
| `lg` | 64×64px |

Fallback: Initials on gray background, or User icon.

---

## 4. Page-by-Page Specs

### Dashboard (`/dashboard`)

**Section order** (top to bottom):
1. Welcome banner — gradient `from-jjl-red/20 to-transparent`, user name + belt badge
2. **Daily check-in** — "Entrenaste hoy?" card (elevated position for engagement)
3. Stats grid — 2×2 mobile, 4-col desktop
4. Belt progression — horizontal stepper with lock/check/active states
5. Training calendar — 13-week heatmap grid
6. Quick actions — 4 shortcut cards

**Quick Actions Icons**:
- Ver Modulos → `BookOpen`
- Subir Lucha → `Upload`
- Comunidad → `Users`
- Mi Perfil → `User`

### Daily Check-in (TaskDashboard)

| State | Icon | Button | Color |
|-------|------|--------|-------|
| Not checked | Dumbbell | "SI, ENTRENE" primary | Red icon bg |
| Loading | — | Spinner, disabled | — |
| Checked | Checkmark | "Registrado" badge | Green icon bg, green text |

**Weekly feedback**: Textarea + send. Success shows green checkmark + "Feedback enviado."

### Training Calendar

- 13 weeks × 7 days grid
- Cell size: 14×14px, gap-1
- Colors: transparent (future), `jjl-gray-light` (past no-train), `green-500/70` (trained), `jjl-border` (today)
- Today ring: `ring-1 ring-jjl-muted/50` (or `ring-green-300` if trained)
- Hover: Cells darken slightly via `transition-colors`
- Streak counter: Top-right, `text-2xl font-bold text-orange-400`
- Tooltips: Native `title` attribute with localized date

### Belt Progression (BeltProgress)

```
[✓ Blanco]───[● Azul]───[🔒 Purpura]───[🔒 Marron]───[🔒 Negro]
              ↑ active
```

| Belt state | Visual |
|------------|--------|
| Completed | Checkmark, white text, no ring |
| Active | Scale 110%, `ring-2 ring-jjl-red`, red border |
| Future | Lock icon, 50% opacity |

Progress bar below: `bg-jjl-red` fill, `bg-jjl-gray-light` track, `h-1.5 rounded-full`
Transition: `duration-500`

### Modules (`/modules`)

- Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`
- Only shows unlocked modules (admin-controlled)
- Header shows: "X de Y modulos habilitados"
- Empty state: Lock icon (80×80), "Sin modulos disponibles", instructor contact message
- Each card: Week label (red) → title → description (2-line clamp) → lesson count → progress bar

### Module Detail (`/modules/[moduleId]`)

**Layout**: 2-col on desktop (2/3 video + 1/3 lesson list), stacked on mobile

**Video Player** (CustomVideoPlayer):
- YouTube embed with custom controls overlay
- Thumbnail: `maxresdefault.jpg` fallback `hqdefault.jpg`
- Play button on thumbnail: 64px red circle, hover scale 110%
- Controls auto-hide: 3s timeout while playing
- Control bar: `transition-opacity duration-300`
- Progress bar: 4px → 6px on hover, red fill, scrubber dot on hover
- Time display: Monospace format `M:SS / M:SS`

**Lesson List**:
- Vertical list, `space-y-1`
- Active: `bg-jjl-red/10 border-jjl-red/30`
- Completed: Green checkmark icon
- Reflection lessons: Dashed border, yellow message icon

### Community (`/community`)

- Category filter: 6 horizontal buttons (scrollable on mobile)
- Selected: `bg-jjl-red text-white`
- Unselected: `bg-jjl-gray-light text-jjl-muted`
- Post cards: Avatar + name + belt badge + timestamp + title + content (2-line clamp) + likes/comments
- New Post: Modal overlay (`bg-black/70 z-50`), max-w-lg

### Upload (`/upload`)

- Dropzone: Dashed border, pointer cursor
- Drag state: `bg-jjl-red/5 border-jjl-red`
- File selected: Film icon + filename + size + remove X
- Progress: Red bar, animated during upload
- Success: Green checkmark + Google Drive link + "Upload another" button
- Max size: 500MB, accepts `video/*`

### Login (`/login`)

- Centered card, max-w-sm (448px)
- Logo 56×56 + "JIU JITSU" + "Latino" subtitle
- Error: `bg-red-900/30 border-red-500/30 text-red-400`
- Reset sent: `bg-green-900/30 border-green-500/30 text-green-400`
- Footer: "No tienes cuenta? Contacta a tu instructor"
- Invite-only: Register page shows lock + "Acceso Solo por Invitacion"

---

## 5. Interaction & Animation Specs

| Element | Trigger | Animation | Duration | Easing |
|---------|---------|-----------|----------|--------|
| All buttons/links | Hover | Color shift | 150ms | `transition-colors` (ease default) |
| Card hover | Hover | Border brightens to `jjl-red/40` | 150ms | `transition-colors` |
| Video controls | Mouse idle 3s | Fade out | 300ms | `transition-opacity` |
| Video play btn | Hover | Scale 100% → 110% | default | `transition-all` |
| Belt progress | Mount | Color fill | 500ms | `duration-500` |
| Loading spinner | Continuous | Rotate 360° | CSS `animate-spin` | Linear |
| Progress bars | Value change | Width transition | default | `transition-all` |
| Mobile slide menu | Toggle | Instant (conditional render) | — | No animation |
| Dropdown menu | Toggle | Instant (conditional render) | — | No animation |

---

## 6. Edge Cases

| Scenario | Behavior |
|----------|----------|
| **No modules unlocked** | Empty state: Lock icon + "Tu instructor aun no ha habilitado modulos" |
| **No community posts** | Empty state: Icon + "No hay posts" message |
| **API failure** | Falls back to mock data (dashboard, modules) |
| **Long usernames** | Truncated with `truncate` class |
| **Long post content** | `line-clamp-2` on feed cards, full display on detail page |
| **Video load failure** | Thumbnail fallback from maxresdefault → hqdefault |
| **500MB upload** | Progress bar with percentage, no timeout (awaits completion) |
| **No internet** | Graceful degradation — try/catch with empty state fallbacks |
| **Spanish text** | All UI copy in Spanish (Argentina dialect: "vos" forms, "Construi tu...") |

---

## 7. Accessibility Notes

### Focus Order
1. Topbar (hamburger menu → avatar)
2. Sidebar nav items (desktop) or Main content (mobile)
3. Page content (top to bottom)
4. Bottom nav (mobile only)

### Keyboard Interactions
- All buttons: Enter/Space to activate
- Navigation: Links use `<Link>` (Next.js), standard tab order
- Video player: Custom controls require explicit keyboard handling (not yet implemented)
- Modal (PostForm): Closes on backdrop click, needs Escape key handler

### ARIA Requirements
- Training calendar: Needs `role="grid"` + `aria-label` for cells
- Belt progress: Needs `role="progressbar"` + `aria-valuenow`/`aria-valuemax`
- Error messages: Should use `role="alert"` or `aria-live="polite"`
- Modal: Needs `role="dialog"` + `aria-modal="true"` + focus trap

### Color Contrast (WCAG AA)
- ✅ White on black: 21:1
- ✅ Muted text (`#B0B8C4`) on gray (`#1A1A1A`): ~5.2:1 (fixed)
- ⚠️ Red on dark gray (`#DC2626` on `#1A1A1A`): 4.63:1 — passes AA large text only
- ✅ Green on dark (`green-400` on `#1A1A1A`): Passes

### Touch Targets
- Mobile nav items: ~56px min-width, adequate
- Training calendar cells: 14×14px — **below 44px minimum** (consider tooltip/detail view instead of direct tap)
- Community category buttons: Need explicit `min-h-[44px]` on mobile

---

## 8. File Reference

| Area | Path |
|------|------|
| Design tokens | `src/app/globals.css` |
| Font setup | `src/app/layout.tsx` |
| Constants (nav, belts) | `src/lib/constants.ts` |
| Dashboard layout | `src/app/(dashboard)/layout.tsx` |
| Sidebar | `src/components/layout/Sidebar.tsx` |
| Topbar | `src/components/layout/Topbar.tsx` |
| Mobile nav | `src/components/layout/MobileNav.tsx` |
| UI primitives | `src/components/ui/` (Button, Card, Input, Badge, Avatar, Toggle) |
| Dashboard | `src/components/dashboard/` (StatCard, TaskDashboard, TrainingCalendar) |
| Gamification | `src/components/gamification/` (BeltProgress, AchievementBadge) |
| Modules | `src/components/modules/` (ModuleCard, LessonList, WeeklyReflection) |
| Video player | `src/components/video/CustomVideoPlayer.tsx` |
| Upload | `src/components/upload/UploadDropzone.tsx` |
| Community | `src/components/community/` (PostForm, CommentSection) |
| Auth pages | `src/app/(auth)/` (login, register) |
| Admin pages | `src/app/(admin)/` |
