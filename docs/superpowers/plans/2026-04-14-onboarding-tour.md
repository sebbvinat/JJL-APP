# Onboarding Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** First-time users (alumnos and the admin) are redirected to a 5-step welcome flow at `/bienvenida` before reaching the dashboard, persisting their progress step-by-step so they can resume if they close the browser.

**Architecture:** A new `/bienvenida` route outside the dashboard layout group, 6 client components in `src/components/onboarding/`, 1 new API (`/api/onboarding/step`), and a middleware gate that redirects any authed user with `users.onboarding_completed_at IS NULL` away from every protected page. Step progress is tracked in two new columns on `users` (`onboarding_step`, `onboarding_completed_at`).

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + Auth + RLS), Tailwind v4, existing `@/lib/supabase/server` helpers (`getAuthedUser`, `requireAdmin`), existing UI primitives (`Card`, `Button`, `Input`, `useToast`), existing push infra (`/api/push/subscribe`), existing community posts API (`/api/community/posts`).

**Spec:** [docs/superpowers/specs/2026-04-14-onboarding-tour-design.md](../specs/2026-04-14-onboarding-tour-design.md)

**No unit-test framework is installed in this project.** Verification per task uses `npx tsc --noEmit` (typing), `npm run build` (bundling + SSG), and when needed a dev-server manual smoke test. Each task ends with a commit.

---

## File Structure

**Created**

| Path | Responsibility |
|---|---|
| `supabase/migrations/2026_04_14_onboarding.sql` | DDL for the two new columns |
| `src/app/api/onboarding/step/route.ts` | POST endpoint to advance step or mark complete |
| `src/app/bienvenida/layout.tsx` | Fullscreen dark layout for the onboarding, no sidebar/topbar |
| `src/app/bienvenida/page.tsx` | Server component: reads `onboarding_step`, renders the orchestrator |
| `src/components/onboarding/Shell.tsx` | Progress bar + content area + nav buttons (client) |
| `src/components/onboarding/Orchestrator.tsx` | Client component that owns step state and renders the active step |
| `src/components/onboarding/Step1Welcome.tsx` | Framing + password change form |
| `src/components/onboarding/Step2Program.tsx` | Module list for alumno, adapted copy for admin |
| `src/components/onboarding/Step3Journal.tsx` | Static explanation of the diary |
| `src/components/onboarding/Step4Notifications.tsx` | Push permission + subscribe |
| `src/components/onboarding/Step5Introduction.tsx` | Pre-filled form, publishes community post |

**Modified**

| Path | What changes |
|---|---|
| `src/lib/supabase/types.ts` | Add `onboarding_step` and `onboarding_completed_at` to `User` and `Database['public']['Tables']['users']` |
| `src/lib/supabase/middleware.ts` | Expand existing admin query to also fetch onboarding fields; add onboarding redirect logic |
| `supabase/schema.sql` | Mirror the new columns in the canonical schema |
| `src/app/(dashboard)/dashboard/page.tsx` | Add "Dia N de 180 — empezaste el {fecha}" banner line when profile is within the program window |
| `src/app/api/dashboard-stats/route.ts` | Return `created_at` and `onboarding_completed_at` in `profile` so the banner has data |

---

## Task 1: Schema migration and types

**Files:**
- Create: `supabase/migrations/2026_04_14_onboarding.sql`
- Modify: `supabase/schema.sql`
- Modify: `src/lib/supabase/types.ts`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/2026_04_14_onboarding.sql`:

```sql
-- Onboarding tour state: tracks where in the 5-step welcome flow a user is
-- and when/if they completed it. NULL onboarding_completed_at means the
-- middleware will redirect them to /bienvenida.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 1
    CHECK (onboarding_step BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Partial index so the middleware check (onboarding_completed_at IS NULL)
-- stays cheap even with thousands of completed users.
CREATE INDEX IF NOT EXISTS idx_users_onboarding_pending
  ON public.users(id)
  WHERE onboarding_completed_at IS NULL;
```

- [ ] **Step 2: Mirror the columns in `supabase/schema.sql`**

Find the `CREATE TABLE public.users (...)` block (around line 6) and add the two columns and the index right after the existing fields:

```sql
-- inside CREATE TABLE public.users (...)
  onboarding_step INTEGER DEFAULT 1 CHECK (onboarding_step BETWEEN 1 AND 5),
  onboarding_completed_at TIMESTAMPTZ,
```

And add the index near the other user indexes (search for `idx_users_` or append to the indexes block):

```sql
CREATE INDEX idx_users_onboarding_pending
  ON public.users(id)
  WHERE onboarding_completed_at IS NULL;
```

- [ ] **Step 3: Update TypeScript types**

In `src/lib/supabase/types.ts`, find the `User` interface and add two fields after `updated_at`:

```ts
export interface User {
  id: string;
  nombre: string;
  email: string | null;
  cinturon_actual: BeltLevel;
  puntos: number;
  rol: UserRole;
  avatar_url: string | null;
  planilla_id: string | null;
  created_at: string;
  updated_at: string;
  onboarding_step: number;
  onboarding_completed_at: string | null;
}
```

Then in the `Database['public']['Tables']['users']` definition (same file), ensure the `Row` / `Insert` / `Update` shapes match (they use `Partial<User>` or `Omit` — no manual change needed because they key off `User`).

- [ ] **Step 4: Type-check**

Run from `C:/Users/sebas/Desktop/jjl-app`:

```bash
npx tsc --noEmit
```

Expected: no output (clean).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/2026_04_14_onboarding.sql supabase/schema.sql src/lib/supabase/types.ts
git commit -m "feat(onboarding): add onboarding_step and onboarding_completed_at"
```

---

## Task 2: Onboarding step API

**Files:**
- Create: `src/app/api/onboarding/step/route.ts`

- [ ] **Step 1: Write the handler**

Create `src/app/api/onboarding/step/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * POST /api/onboarding/step
 *
 * Body:
 *   { step: 1|2|3|4|5 }           → advance onboarding_step to that value
 *   { step: 5, complete: true }   → also sets onboarding_completed_at = NOW()
 *
 * Idempotent: going back (lower step) is allowed but only forward updates
 * actually change onboarding_step.
 */
export async function POST(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  let body: { step?: number; complete?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 });
  }

  const step = Number(body.step);
  if (!Number.isInteger(step) || step < 1 || step > 5) {
    return NextResponse.json({ error: 'step debe ser 1..5' }, { status: 400 });
  }

  const patch: Record<string, unknown> = { onboarding_step: step };
  if (body.complete === true) {
    patch.onboarding_completed_at = new Date().toISOString();
  }

  const { error } = await supabase.from('users').update(patch).eq('id', user.id);
  if (error) {
    logger.error('onboarding.step.update.failed', { err: error, userId: user.id, step });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, step, completed: body.complete === true });
}
```

- [ ] **Step 2: Type-check and build**

```bash
npx tsc --noEmit
npm run build
```

Expected: build succeeds, the route appears in the output as `ƒ /api/onboarding/step`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/onboarding/step/route.ts
git commit -m "feat(onboarding): add /api/onboarding/step to persist flow progress"
```

---

## Task 3: Middleware gate

**Files:**
- Modify: `src/lib/supabase/middleware.ts`

Expand the existing admin role query so it also fetches `onboarding_completed_at`, then add the onboarding redirect block right after the admin block.

- [ ] **Step 1: Read the current middleware**

Open `src/lib/supabase/middleware.ts`. Locate the block labelled `// ADMIN ROUTE PROTECTION — server-side role check` near the end of `updateSession`.

- [ ] **Step 2: Rewrite the admin block + add the onboarding gate**

Replace the admin block with this (it keeps the admin check intact and piggybacks the onboarding fetch on the same single query):

```ts
  // SINGLE DB READ: admin-gate + onboarding-gate reuse the same row.
  let profile: { rol: string; onboarding_completed_at: string | null } | null = null;
  if (user && !isPublicRoute) {
    const { data } = await supabase
      .from('users')
      .select('rol, onboarding_completed_at')
      .eq('id', user.id)
      .single<{ rol: string; onboarding_completed_at: string | null }>();
    profile = data;
  }

  // ADMIN ROUTE PROTECTION — server-side role check
  if (user && pathname.startsWith('/admin')) {
    if (profile?.rol !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  // ONBOARDING GATE — force the /bienvenida flow until completed.
  // /auth/* is excluded so OAuth callbacks and password-reset flows work.
  if (
    user &&
    profile &&
    profile.onboarding_completed_at === null &&
    pathname !== '/bienvenida' &&
    !pathname.startsWith('/auth/')
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/bienvenida';
    return NextResponse.redirect(url);
  }

  // Already-completed users visiting /bienvenida directly go to dashboard.
  if (user && profile && profile.onboarding_completed_at !== null && pathname === '/bienvenida') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/middleware.ts
git commit -m "feat(onboarding): middleware gate redirects to /bienvenida until complete"
```

---

## Task 4: `/bienvenida` route skeleton

**Files:**
- Create: `src/app/bienvenida/layout.tsx`
- Create: `src/app/bienvenida/page.tsx`
- Create: `src/components/onboarding/Shell.tsx`
- Create: `src/components/onboarding/Orchestrator.tsx`

- [ ] **Step 1: Layout**

Create `src/app/bienvenida/layout.tsx`:

```tsx
export const metadata = {
  title: 'Bienvenida — JJL Elite',
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      {/* Ambient red glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[640px] w-[640px] rounded-full blur-3xl opacity-25"
        style={{
          background: 'radial-gradient(circle at center, rgba(220,38,38,0.55), transparent 60%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.65) 100%)',
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Page (server component)**

Create `src/app/bienvenida/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import Orchestrator from '@/components/onboarding/Orchestrator';

export default async function BienvenidaPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('id, nombre, email, rol, cinturon_actual, onboarding_step, onboarding_completed_at')
    .eq('id', user.id)
    .single<{
      id: string;
      nombre: string;
      email: string | null;
      rol: string;
      cinturon_actual: string;
      onboarding_step: number;
      onboarding_completed_at: string | null;
    }>();

  // Middleware should have caught this, but guard anyway.
  if (profile?.onboarding_completed_at) redirect('/dashboard');

  return (
    <Orchestrator
      initialStep={profile?.onboarding_step ?? 1}
      userName={profile?.nombre ?? 'Guerrero'}
      userRole={profile?.rol ?? 'alumno'}
      userBelt={profile?.cinturon_actual ?? 'white'}
    />
  );
}
```

- [ ] **Step 3: Shell component**

Create `src/components/onboarding/Shell.tsx`:

```tsx
'use client';

import { clsx } from 'clsx';
import Button from '@/components/ui/Button';

interface ShellProps {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Label for the primary CTA. Null hides the button. */
  primaryLabel?: string | null;
  /** Disable the primary button (e.g. form invalid) */
  primaryDisabled?: boolean;
  /** Show a loading spinner on the primary button */
  primaryLoading?: boolean;
  onPrimary?: () => void | Promise<void>;
  /** Show a "Despues" skip link next to primary. */
  onSkip?: (() => void) | null;
  skipLabel?: string;
}

export default function Shell({
  step,
  total,
  title,
  subtitle,
  children,
  primaryLabel = 'Siguiente',
  primaryDisabled,
  primaryLoading,
  onPrimary,
  onSkip,
  skipLabel = 'Despues',
}: ShellProps) {
  return (
    <div className="mx-auto max-w-xl px-5 pt-10 pb-16 flex flex-col min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <span className="text-[11px] uppercase tracking-[0.22em] text-jjl-muted font-semibold">
          Paso {step} de {total}
        </span>
        <div className="flex-1 ml-4 h-1 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-jjl-red to-orange-500 rounded-full transition-all duration-500"
            style={{ width: `${(step / total) * 100}%` }}
          />
        </div>
      </div>

      <header className="mb-6">
        <h1 className="text-[28px] font-black tracking-tight text-white leading-tight text-balance">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[14px] text-jjl-muted mt-2 leading-relaxed text-balance">
            {subtitle}
          </p>
        )}
      </header>

      <div className={clsx('flex-1', 'animate-fade-in')}>{children}</div>

      <div className="mt-8 flex items-center gap-3">
        {primaryLabel && (
          <Button
            variant="primary"
            size="lg"
            onClick={onPrimary}
            disabled={primaryDisabled}
            loading={primaryLoading}
            fullWidth
          >
            {primaryLabel}
          </Button>
        )}
        {onSkip && (
          <button
            onClick={onSkip}
            className="text-[13px] text-jjl-muted hover:text-white px-3 py-2 rounded-lg transition-colors"
          >
            {skipLabel}
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Orchestrator stub**

Create `src/components/onboarding/Orchestrator.tsx` with a placeholder for each step so the page renders before we fill them in:

```tsx
'use client';

import { useState } from 'react';
import Shell from './Shell';

const TOTAL_STEPS = 5;

interface OrchestratorProps {
  initialStep: number;
  userName: string;
  userRole: string;
  userBelt: string;
}

export default function Orchestrator({ initialStep, userName, userRole, userBelt }: OrchestratorProps) {
  const [step, setStep] = useState(Math.min(Math.max(initialStep, 1), TOTAL_STEPS));

  async function advance(next: number, opts: { complete?: boolean } = {}) {
    await fetch('/api/onboarding/step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: next, complete: opts.complete }),
    });
    if (opts.complete) {
      window.location.href = '/dashboard';
      return;
    }
    setStep(next);
  }

  // Placeholder — real step components come in Tasks 5-9.
  return (
    <Shell
      step={step}
      total={TOTAL_STEPS}
      title={`Paso ${step} — pendiente`}
      subtitle={`Hola ${userName}. Rol: ${userRole}. Cinturon: ${userBelt}.`}
      onPrimary={() =>
        step < TOTAL_STEPS ? advance(step + 1) : advance(TOTAL_STEPS, { complete: true })
      }
    >
      <p className="text-white/70 text-sm">Contenido del paso {step} llega en las proximas tareas.</p>
    </Shell>
  );
}
```

- [ ] **Step 5: Build + smoke test**

```bash
npx tsc --noEmit
npm run build
```

Expected: `/bienvenida` appears as `○ /bienvenida` in the route list.

Quick manual smoke (optional but recommended):

```bash
npm run dev
```

Open `http://localhost:3000/bienvenida` while signed in as a user whose `onboarding_completed_at` is `NULL` — should render the placeholder Shell with "Paso N — pendiente".

- [ ] **Step 6: Commit**

```bash
git add src/app/bienvenida src/components/onboarding
git commit -m "feat(onboarding): /bienvenida route with Shell and Orchestrator stub"
```

---

## Task 5: Step 1 — Welcome + password

**Files:**
- Create: `src/components/onboarding/Step1Welcome.tsx`
- Modify: `src/components/onboarding/Orchestrator.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/onboarding/Step1Welcome.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Shield, Users as UsersIcon, Target } from 'lucide-react';
import Shell from './Shell';
import Input from '@/components/ui/Input';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import { logger } from '@/lib/logger';

interface Props {
  userName: string;
  onNext: () => Promise<void>;
}

export default function Step1Welcome({ userName, onNext }: Props) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const canSubmit =
    password.length >= 8 && password === confirm && !saving;

  async function handleSubmit() {
    setError('');
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) throw updErr;
      toast.success('Contraseña guardada');
      await onNext();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No pudimos guardar la contraseña';
      logger.error('onboarding.step1.password.failed', { err });
      setError(msg);
      toast.error(msg);
    }
    setSaving(false);
  }

  return (
    <Shell
      step={1}
      total={5}
      title={`Bienvenido, ${userName}`}
      subtitle="Hoy arrancas 180 dias de entrenamiento con foco. Cada dia que registres se convierte en tu radar de progreso — y cuando lo compartis, el equipo crece con vos."
      primaryLabel="Guardar y seguir"
      primaryDisabled={!canSubmit}
      primaryLoading={saving}
      onPrimary={handleSubmit}
    >
      <div className="space-y-5">
        <ul className="space-y-2.5 text-[13px] text-jjl-muted">
          {[
            { icon: Target, text: '180 dias estructurados, con objetivos semanales y mediciones claras.' },
            { icon: UsersIcon, text: 'Equipo visible — otros alumnos comparten sus luchas, dudas y logros.' },
            { icon: Shield, text: 'Tu diario es privado salvo que decidas publicarlo en la comunidad.' },
          ].map(({ icon: Icon, text }, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-0.5 h-6 w-6 shrink-0 rounded-md bg-jjl-red/10 ring-1 ring-jjl-red/25 text-jjl-red flex items-center justify-center">
                <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
              </span>
              <span>{text}</span>
            </li>
          ))}
        </ul>

        <div className="pt-4 border-t border-jjl-border space-y-3">
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-jjl-muted">
            Primera tarea: elegi tu contraseña
          </p>
          <Input
            label="Contraseña nueva"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimo 8 caracteres"
            hint="La que te pase tu instructor por WhatsApp era temporal."
          />
          <Input
            label="Repetila"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {error && <p className="text-[12px] text-red-400">{error}</p>}
        </div>
      </div>
    </Shell>
  );
}
```

- [ ] **Step 2: Wire it into the Orchestrator**

Replace the placeholder render in `src/components/onboarding/Orchestrator.tsx` with the step 1 case (other cases stay as placeholder for now):

```tsx
'use client';

import { useState } from 'react';
import Shell from './Shell';
import Step1Welcome from './Step1Welcome';

const TOTAL_STEPS = 5;

interface OrchestratorProps {
  initialStep: number;
  userName: string;
  userRole: string;
  userBelt: string;
}

export default function Orchestrator({ initialStep, userName, userRole, userBelt }: OrchestratorProps) {
  const [step, setStep] = useState(Math.min(Math.max(initialStep, 1), TOTAL_STEPS));

  async function advance(next: number, opts: { complete?: boolean } = {}) {
    await fetch('/api/onboarding/step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: next, complete: opts.complete }),
    });
    if (opts.complete) {
      window.location.href = '/dashboard';
      return;
    }
    setStep(next);
  }

  if (step === 1) {
    return <Step1Welcome userName={userName} onNext={() => advance(2)} />;
  }

  // Placeholder for steps 2..5 — filled in in subsequent tasks.
  return (
    <Shell
      step={step}
      total={TOTAL_STEPS}
      title={`Paso ${step} — pendiente`}
      subtitle={`Rol: ${userRole}. Cinturon: ${userBelt}.`}
      onPrimary={() =>
        step < TOTAL_STEPS ? advance(step + 1) : advance(TOTAL_STEPS, { complete: true })
      }
    >
      <p className="text-white/70 text-sm">Contenido del paso {step} llega en las proximas tareas.</p>
    </Shell>
  );
}
```

- [ ] **Step 3: Type-check + build**

```bash
npx tsc --noEmit
npm run build
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/onboarding/Step1Welcome.tsx src/components/onboarding/Orchestrator.tsx
git commit -m "feat(onboarding): step 1 — framing + password change"
```

---

## Task 6: Step 2 — Your program

**Files:**
- Create: `src/components/onboarding/Step2Program.tsx`
- Modify: `src/components/onboarding/Orchestrator.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/onboarding/Step2Program.tsx`:

```tsx
'use client';

import useSWR from 'swr';
import { BookOpen, Lock } from 'lucide-react';
import Shell from './Shell';
import { fetcher } from '@/lib/fetcher';

interface ModuleInfo {
  id: string;
  semana_numero: number;
  titulo: string;
  descripcion?: string;
  lessonCount: number;
}

interface CourseData {
  modules: ModuleInfo[];
}

interface Props {
  isAdmin: boolean;
  onNext: () => Promise<void>;
  onSkip: () => Promise<void>;
}

export default function Step2Program({ isAdmin, onNext, onSkip }: Props) {
  const { data, isLoading } = useSWR<CourseData>(
    isAdmin ? null : '/api/course-data?all=true',
    fetcher
  );

  const modules = data?.modules ?? [];

  const title = isAdmin ? 'Tu panel de instructor' : 'Tu programa';
  const subtitle = isAdmin
    ? 'Desde aca tus alumnos van a ver su currculum — semanas, lecciones, foco por bloque. Vos los asignas desde la pestana Admin.'
    : 'Este es el camino que armamos para vos. 180 dias, por semanas. No tenes que recordarlo de memoria — esta siempre aca.';

  return (
    <Shell
      step={2}
      total={5}
      title={title}
      subtitle={subtitle}
      primaryLabel="Siguiente"
      onPrimary={onNext}
      onSkip={onSkip}
    >
      {isAdmin ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-5 text-[13px] text-jjl-muted leading-relaxed">
          <p className="text-amber-400 font-semibold mb-1.5">Vista preview</p>
          Este paso muestra los modulos asignados al alumno. Como vos sos el admin, lo vas a ver con
          la data real cuando abras el perfil de cada estudiante.
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          <div className="skeleton h-14 rounded-lg" />
          <div className="skeleton h-14 rounded-lg" />
          <div className="skeleton h-14 rounded-lg" />
        </div>
      ) : modules.length === 0 ? (
        <div className="rounded-xl border border-jjl-border bg-white/[0.02] p-5 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-3">
            <Lock className="h-5 w-5 text-jjl-muted" />
          </div>
          <p className="text-[14px] font-semibold text-white">Tu instructor esta armando tu programa</p>
          <p className="text-[12px] text-jjl-muted mt-1.5">
            Te avisamos por notificacion cuando este listo. Mientras, seguimos con el tour.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
          {modules.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-lg border border-jjl-border bg-white/[0.02] p-3"
            >
              <span className="inline-flex h-8 px-2 items-center rounded-md bg-jjl-red/10 border border-jjl-red/20 text-jjl-red text-[10px] font-bold uppercase tracking-[0.14em]">
                {m.semana_numero === 0 ? 'Intro' : `S${m.semana_numero}`}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-white truncate">{m.titulo}</p>
                <p className="text-[11px] text-jjl-muted flex items-center gap-1.5">
                  <BookOpen className="h-3 w-3" />
                  {m.lessonCount} lecciones
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
```

- [ ] **Step 2: Wire into Orchestrator**

In `src/components/onboarding/Orchestrator.tsx`, add the Step 2 case before the placeholder fallback. Also add `Step2Program` import:

```tsx
import Step1Welcome from './Step1Welcome';
import Step2Program from './Step2Program';
```

And add the branch (right after the `step === 1` block):

```tsx
  if (step === 2) {
    return (
      <Step2Program
        isAdmin={userRole === 'admin'}
        onNext={() => advance(3)}
        onSkip={() => advance(3)}
      />
    );
  }
```

- [ ] **Step 3: Type-check + build**

```bash
npx tsc --noEmit
npm run build
```

Expected: clean. `/bienvenida` still static.

- [ ] **Step 4: Commit**

```bash
git add src/components/onboarding/Step2Program.tsx src/components/onboarding/Orchestrator.tsx
git commit -m "feat(onboarding): step 2 — program list with admin and empty variants"
```

---

## Task 7: Step 3 — Your diary

**Files:**
- Create: `src/components/onboarding/Step3Journal.tsx`
- Modify: `src/components/onboarding/Orchestrator.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/onboarding/Step3Journal.tsx`:

```tsx
'use client';

import { Activity, Sparkles, Search } from 'lucide-react';
import Shell from './Shell';

interface Props {
  onNext: () => Promise<void>;
  onSkip: () => Promise<void>;
}

export default function Step3Journal({ onNext, onSkip }: Props) {
  return (
    <Shell
      step={3}
      total={5}
      title="Tu diario"
      subtitle="Es el corazon de la app. Tres minutos por dia alcanzan — y todo lo que escribas queda para revisar cuando quieras."
      primaryLabel="Siguiente"
      onPrimary={onNext}
      onSkip={onSkip}
    >
      <div className="space-y-3">
        {[
          {
            icon: Activity,
            tone: 'bg-jjl-red/10 ring-jjl-red/25 text-jjl-red',
            title: 'Un check-in por dia',
            body: 'Entrenaste, como te sentiste, que tan intenso fue, un puntaje. Diez segundos.',
          },
          {
            icon: Sparkles,
            tone: 'bg-yellow-500/10 ring-yellow-500/25 text-yellow-400',
            title: 'Reflexion que persiste',
            body: 'Que aprendiste hoy, notas sueltas, links utiles. Todo se guarda 120 dias.',
          },
          {
            icon: Search,
            tone: 'bg-blue-500/10 ring-blue-500/25 text-blue-400',
            title: 'Revisable en cualquier momento',
            body: 'Buscas en la Biblioteca por tema (guardia, pasajes, submissions) o por palabras.',
          },
        ].map((row, i) => {
          const Icon = row.icon;
          return (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl border border-jjl-border bg-white/[0.02] p-4"
            >
              <span
                className={`h-9 w-9 rounded-lg flex items-center justify-center ring-1 shrink-0 ${row.tone}`}
              >
                <Icon className="h-4 w-4" strokeWidth={2.2} />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-white">{row.title}</p>
                <p className="text-[12px] text-jjl-muted mt-0.5 leading-relaxed">{row.body}</p>
              </div>
            </div>
          );
        })}

        <div className="rounded-xl border border-jjl-red/25 bg-jjl-red/[0.05] p-4 text-[12px] text-white/80 leading-relaxed">
          <span className="uppercase tracking-[0.14em] text-jjl-red font-bold text-[10px] block mb-1">
            Tip
          </span>
          Los domingos a la noche hacemos el <em>ritual</em> — revisas tu semana, fijas foco para la
          siguiente. Te vamos a notificar cuando toque.
        </div>
      </div>
    </Shell>
  );
}
```

- [ ] **Step 2: Wire into Orchestrator**

Add import and branch:

```tsx
import Step3Journal from './Step3Journal';
```

```tsx
  if (step === 3) {
    return <Step3Journal onNext={() => advance(4)} onSkip={() => advance(4)} />;
  }
```

- [ ] **Step 3: Type-check + build**

```bash
npx tsc --noEmit
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/onboarding/Step3Journal.tsx src/components/onboarding/Orchestrator.tsx
git commit -m "feat(onboarding): step 3 — explain the diary"
```

---

## Task 8: Step 4 — Notifications

**Files:**
- Create: `src/components/onboarding/Step4Notifications.tsx`
- Modify: `src/components/onboarding/Orchestrator.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/onboarding/Step4Notifications.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Bell, BellOff, CheckCircle } from 'lucide-react';
import Shell from './Shell';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { logger } from '@/lib/logger';

interface Props {
  onNext: () => Promise<void>;
  onSkip: () => Promise<void>;
}

type PermState = 'default' | 'granted' | 'denied' | 'unsupported';

function currentPermState(): PermState {
  if (typeof window === 'undefined') return 'default';
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported';
  return Notification.permission as PermState;
}

export default function Step4Notifications({ onNext, onSkip }: Props) {
  const [state, setState] = useState<PermState>(currentPermState());
  const [working, setWorking] = useState(false);
  const toast = useToast();

  async function enable() {
    setWorking(true);
    try {
      const permission = await Notification.requestPermission();
      setState(permission as PermState);
      if (permission !== 'granted') {
        setWorking(false);
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        }));
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      toast.success('Notificaciones activadas');
      await onNext();
    } catch (err) {
      logger.error('onboarding.step4.subscribe.failed', { err });
      toast.error('No pudimos activarlas. Podes hacerlo mas tarde desde la campanita.');
    }
    setWorking(false);
  }

  return (
    <Shell
      step={4}
      total={5}
      title="Activa las alertas"
      subtitle="Te avisamos cuando tu instructor responde un video, cuando se desbloquea un modulo nuevo, o cuando hace falta el check-in del dia. Las podes apagar cuando quieras."
      primaryLabel={null}
      onSkip={onSkip}
      skipLabel="Despues"
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-jjl-border bg-white/[0.02] p-5">
          <div className="flex items-center gap-3 mb-3">
            <div
              className={`h-10 w-10 rounded-xl flex items-center justify-center ring-1 ${
                state === 'granted'
                  ? 'bg-green-500/10 ring-green-500/25 text-green-400'
                  : state === 'denied'
                    ? 'bg-red-500/10 ring-red-500/25 text-red-400'
                    : 'bg-jjl-red/10 ring-jjl-red/25 text-jjl-red'
              }`}
            >
              {state === 'granted' ? (
                <CheckCircle className="h-5 w-5" />
              ) : state === 'denied' ? (
                <BellOff className="h-5 w-5" />
              ) : (
                <Bell className="h-5 w-5" />
              )}
            </div>
            <div>
              <p className="text-[14px] font-bold text-white">
                {state === 'granted'
                  ? 'Listas'
                  : state === 'denied'
                    ? 'Bloqueadas por el browser'
                    : state === 'unsupported'
                      ? 'Este browser no las soporta'
                      : 'Sin activar'}
              </p>
              <p className="text-[12px] text-jjl-muted">
                {state === 'denied'
                  ? 'Podes habilitarlas en la configuracion del sitio y reintentar.'
                  : state === 'unsupported'
                    ? 'No pasa nada — seguimos sin push.'
                    : 'Un click y listo.'}
              </p>
            </div>
          </div>

          {state === 'default' && (
            <Button variant="primary" size="md" onClick={enable} loading={working} fullWidth>
              <Bell className="h-4 w-4" />
              Activar notificaciones
            </Button>
          )}
          {state === 'granted' && (
            <Button variant="secondary" size="md" onClick={onNext} fullWidth>
              Continuar
            </Button>
          )}
          {(state === 'denied' || state === 'unsupported') && (
            <Button variant="secondary" size="md" onClick={onNext} fullWidth>
              Seguir sin notificaciones
            </Button>
          )}
        </div>
      </div>
    </Shell>
  );
}
```

- [ ] **Step 2: Wire into Orchestrator**

Add import and branch:

```tsx
import Step4Notifications from './Step4Notifications';
```

```tsx
  if (step === 4) {
    return <Step4Notifications onNext={() => advance(5)} onSkip={() => advance(5)} />;
  }
```

- [ ] **Step 3: Type-check + build**

```bash
npx tsc --noEmit
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/onboarding/Step4Notifications.tsx src/components/onboarding/Orchestrator.tsx
git commit -m "feat(onboarding): step 4 — permission request and push subscribe"
```

---

## Task 9: Step 5 — Introduce yourself

**Files:**
- Create: `src/components/onboarding/Step5Introduction.tsx`
- Modify: `src/components/onboarding/Orchestrator.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/onboarding/Step5Introduction.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, Check } from 'lucide-react';
import Shell from './Shell';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { logger } from '@/lib/logger';
import { BELT_LABELS } from '@/lib/constants';

interface Props {
  userName: string;
  userBelt: string;
  isAdmin: boolean;
  onComplete: () => Promise<void>;
}

export default function Step5Introduction({ userName, userBelt, isAdmin, onComplete }: Props) {
  const [horario, setHorario] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [desafio, setDesafio] = useState('');
  const [working, setWorking] = useState(false);
  const [alreadyPosted, setAlreadyPosted] = useState<boolean | null>(null);
  const toast = useToast();

  // Detect if the user already has a community post — if so, allow skip.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/community/posts?mine=1')
      .then((r) => (r.ok ? r.json() : { posts: [] }))
      .then((data: { posts?: Array<{ id: string }> }) => {
        if (!cancelled) setAlreadyPosted((data.posts?.length ?? 0) > 0);
      })
      .catch(() => {
        if (!cancelled) setAlreadyPosted(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const contenido = [
    `Hola, soy ${userName}${isAdmin ? ' — instructor de JJL' : ''}.`,
    isAdmin
      ? ''
      : `Cinturon ${BELT_LABELS[userBelt] || userBelt}.`,
    horario ? `Entreno ${horario}.` : '',
    objetivo ? `Mi objetivo en JJL: ${objetivo}.` : '',
    desafio ? `Mi desafio actual: ${desafio}.` : '',
    '¡Vamos!',
  ]
    .filter(Boolean)
    .join(' ');

  const titulo = isAdmin
    ? `${userName} se suma al equipo — como instructor`
    : `${userName} — me presento`;

  async function publish() {
    setWorking(true);
    try {
      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo,
          contenido,
          categoria: 'progress',
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'No pudimos publicar el post');
      }
      toast.success('Estas adentro. Bienvenido al equipo.');
      await onComplete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al publicar';
      logger.error('onboarding.step5.publish.failed', { err });
      toast.error(msg);
    }
    setWorking(false);
  }

  async function skip() {
    setWorking(true);
    await onComplete();
    setWorking(false);
  }

  const canPublish = !!objetivo.trim() && !working;

  return (
    <Shell
      step={5}
      total={5}
      title={alreadyPosted ? 'Ya te presentaste' : 'Presentate al equipo'}
      subtitle={
        alreadyPosted
          ? 'Tu presentacion esta publicada. Podes actualizarla desde Comunidad cuando quieras.'
          : 'El foro crece cuando cada uno se muestra. Un post corto abre la puerta a que los demas te conozcan.'
      }
      primaryLabel={alreadyPosted ? 'Ir al dashboard' : 'Publicar y terminar'}
      primaryDisabled={!alreadyPosted && !canPublish}
      primaryLoading={working}
      onPrimary={alreadyPosted ? skip : publish}
      onSkip={alreadyPosted ? null : skip}
      skipLabel="Despues"
    >
      {alreadyPosted ? (
        <div className="rounded-xl border border-green-500/30 bg-green-500/[0.05] p-5 flex items-start gap-3">
          <Check className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
          <p className="text-[13px] text-white/80">
            Ya tenes un post en la comunidad. Listo para entrar.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-jjl-border bg-white/[0.02] p-4 space-y-3">
            <Input
              label="Cuando entrenas"
              placeholder="Martes y jueves 19h, sabados manana"
              value={horario}
              onChange={(e) => setHorario(e.target.value)}
            />
            <Input
              label="Tu objetivo en JJL"
              placeholder="Cerrar mi juego de guardia, competir en azul"
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
              hint="Obligatorio"
            />
            <Input
              label="Tu desafio actual"
              placeholder="Me cuesta el pase contra gente pesada"
              value={desafio}
              onChange={(e) => setDesafio(e.target.value)}
            />
          </div>

          <div className="rounded-xl border border-jjl-red/30 bg-jjl-red/[0.04] p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="h-4 w-4 text-jjl-red" />
              <p className="text-[11px] uppercase tracking-[0.14em] text-jjl-red font-bold">
                Tu post
              </p>
            </div>
            <p className="text-[13px] text-white/90 leading-relaxed whitespace-pre-wrap">
              {contenido || 'Llena los campos de arriba para ver tu post.'}
            </p>
          </div>
        </div>
      )}
    </Shell>
  );
}
```

- [ ] **Step 2: Ensure the posts API supports `?mine=1`**

Open `src/app/api/community/posts/route.ts` and check the GET handler. If it doesn't already filter by the current user, add a `mine` query param shortcut. Find the existing GET handler and add this near the beginning (after the user is resolved, before the category filter):

```ts
  const mine = request.nextUrl.searchParams.get('mine') === '1';
  // ... keep the existing query setup, then:
  if (mine && user) {
    query = query.eq('author_id', user.id);
  }
```

(Skip this step if the handler already honors a `mine` or `author_id` filter — search the file first to confirm.)

- [ ] **Step 3: Wire into Orchestrator**

Add import and branch:

```tsx
import Step5Introduction from './Step5Introduction';
```

```tsx
  if (step === 5) {
    return (
      <Step5Introduction
        userName={userName}
        userBelt={userBelt}
        isAdmin={userRole === 'admin'}
        onComplete={() => advance(5, { complete: true })}
      />
    );
  }
```

- [ ] **Step 4: Remove the placeholder fallback**

The Orchestrator's final `return <Shell>...</Shell>` placeholder should now be unreachable. Replace it with an explicit safe-net redirect:

```tsx
  // Unknown step — should be impossible; recover to step 1.
  if (step !== 1 && step !== 2 && step !== 3 && step !== 4 && step !== 5) {
    void advance(1);
  }
  return null;
```

- [ ] **Step 5: Type-check + build**

```bash
npx tsc --noEmit
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/components/onboarding/Step5Introduction.tsx src/components/onboarding/Orchestrator.tsx src/app/api/community/posts/route.ts
git commit -m "feat(onboarding): step 5 — publish presentation post and complete flow"
```

---

## Task 10: Dashboard "day N of 180" banner

**Files:**
- Modify: `src/app/api/dashboard-stats/route.ts`
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Expose `created_at` and `onboarding_completed_at` from the stats API**

In `src/app/api/dashboard-stats/route.ts`, find the `ProfileRow` interface and the `supabase.from('users').select(...)` call. Update both:

```ts
interface ProfileRow {
  cinturon_actual: string;
  puntos: number;
  nombre: string;
  rol: string;
  created_at: string;
  onboarding_completed_at: string | null;
}
```

```ts
  supabase
    .from('users')
    .select('cinturon_actual, puntos, nombre, rol, created_at, onboarding_completed_at')
    .eq('id', userId)
    .single<ProfileRow>(),
```

At the bottom of the handler, the response already spreads `profile` — make sure `created_at` and `onboarding_completed_at` survive the spread. If the response `profile` object is composed field-by-field (not `...profile`), add them explicitly.

- [ ] **Step 2: Render the banner line in the dashboard**

In `src/app/(dashboard)/dashboard/page.tsx`, find the `DashboardData` interface and add the two fields to `profile`:

```ts
interface DashboardData {
  profile: {
    cinturon_actual: string;
    puntos: number;
    nombre: string;
    rol?: string;
    created_at?: string;
    onboarding_completed_at?: string | null;
  };
  // ... rest unchanged
}
```

Then locate the Welcome banner JSX (search for `"Bienvenido"` or the `<p className="text-jjl-muted text-sm mt-2 max-w-md">`). Replace that paragraph with:

```tsx
            <p className="text-jjl-muted text-sm mt-2 max-w-md">
              {(() => {
                if (!profile.created_at) return 'Tu camino en el Jiu Jitsu continua. Un dia mas de trabajo.';
                const start = new Date(profile.created_at);
                const dayNumber = Math.min(
                  180,
                  Math.max(
                    1,
                    Math.floor((Date.now() - start.getTime()) / (24 * 3600 * 1000)) + 1
                  )
                );
                const dateLabel = start.toLocaleDateString('es-AR', {
                  day: 'numeric',
                  month: 'long',
                });
                return dayNumber <= 180
                  ? `Dia ${dayNumber} de 180 — empezaste el ${dateLabel}.`
                  : 'Tu camino en el Jiu Jitsu continua. Un dia mas de trabajo.';
              })()}
            </p>
```

- [ ] **Step 3: Type-check + build**

```bash
npx tsc --noEmit
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/dashboard-stats/route.ts "src/app/(dashboard)/dashboard/page.tsx"
git commit -m "feat(onboarding): show 'dia N de 180' banner in dashboard"
```

---

## Task 11: End-to-end smoke check and push

**Files:** none modified in this task — it's verification.

- [ ] **Step 1: Full build**

```bash
npm run build
```

Expected: route list contains `○ /bienvenida`, `ƒ /api/onboarding/step`. No errors.

- [ ] **Step 2: Run the dev server and walk the flow**

```bash
npm run dev
```

Create a test user (or reset an existing one's `onboarding_completed_at` to NULL via Supabase SQL editor), then sign in and confirm:

1. Any URL you visit redirects to `/bienvenida`.
2. Step 1 loads with the framing copy and password form. Enter matching 8+ char password → advances to step 2.
3. Step 2: as an alumno with modules assigned, the list renders. As admin, the "preview" copy renders. Empty state renders if no modules.
4. Step 3: diary explanation renders, Siguiente advances.
5. Step 4: clicking Activar triggers the browser permission prompt. Grant → subscription saved (network tab shows `POST /api/push/subscribe` with 200). Deny → Continuar button appears.
6. Step 5: the "Tu post" preview updates as you type. Publicar writes to `community_posts` and redirects to `/dashboard`.
7. Dashboard banner reads `Dia 1 de 180 — empezaste el ...`.
8. Going back to `/bienvenida` after completion redirects to `/dashboard`.

- [ ] **Step 3: Push to origin**

```bash
git push origin main
```

Expected: Vercel deploys automatically. Verify the deploy logs are clean.

- [ ] **Step 4: Hand the user the SQL for Supabase**

Post this in chat for the user to paste into Supabase → SQL Editor:

```sql
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 1
    CHECK (onboarding_step BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_onboarding_pending
  ON public.users(id)
  WHERE onboarding_completed_at IS NULL;
```

Note: until this SQL runs, the middleware query for `onboarding_completed_at` will fail gracefully (returns null → new users will still get redirected to `/bienvenida`, but existing users too, and the onboarding API will 500 with a missing-column error). Run the SQL before promoting the deploy.

---
