'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import {
  updateCourse,
  createSection,
  updateSection,
  deleteSection,
  createLesson,
  updateLesson,
  deleteLesson,
} from '../../actions';
import type { CursosCourse } from '@/lib/cursos/types';
import SalesCopyEditor from './SalesCopyEditor';

export interface EditorLesson {
  id: string;
  titulo: string;
  tipo: 'video' | 'texto';
  youtube_id: string | null;
  contenido: string | null;
  duracion: string | null;
}
export interface EditorSection {
  id: string;
  titulo: string;
  lessons: EditorLesson[];
}

const inputCls =
  'w-full rounded-lg border border-jjl-border bg-jjl-gray-light px-3 py-2 text-sm text-white outline-none focus:border-jjl-red';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-jjl-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

export default function CourseEditor({
  course,
  sections,
}: {
  course: CursosCourse;
  sections: EditorSection[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');

  // ---- campos del curso ----
  const [f, setF] = useState({
    titulo: course.titulo ?? '',
    slug: course.slug ?? '',
    instructor: course.instructor ?? '',
    nivel: course.nivel ?? '',
    subtitulo: course.subtitulo ?? '',
    descripcion: course.descripcion ?? '',
    precio: course.precio?.toString() ?? '',
    precio_label: course.precio_label ?? '',
    payment_url: course.payment_url ?? '',
    duracion_acceso_meses: course.duracion_acceso_meses?.toString() ?? '',
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const saveCourse = () =>
    start(async () => {
      setMsg('');
      const r = await updateCourse(course.id, {
        titulo: f.titulo,
        slug: f.slug,
        instructor: f.instructor || null,
        nivel: f.nivel || null,
        subtitulo: f.subtitulo || null,
        descripcion: f.descripcion || null,
        precio: f.precio ? Number(f.precio) : null,
        precio_label: f.precio_label || null,
        payment_url: f.payment_url || null,
        duracion_acceso_meses: f.duracion_acceso_meses
          ? Number(f.duracion_acceso_meses)
          : null,
      });
      setMsg(r.error ?? 'Curso guardado.');
      router.refresh();
    });

  const run = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setMsg('');
      const r = await fn();
      if (r.error) setMsg(r.error);
      router.refresh();
    });

  return (
    <div className="space-y-10">
      {/* datos del curso */}
      <section className="rounded-xl border border-jjl-border bg-jjl-gray p-6">
        <h2 className="text-lg font-extrabold">Datos del curso</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Título">
            <input className={inputCls} value={f.titulo} onChange={(e) => set('titulo', e.target.value)} />
          </Field>
          <Field label="Slug (URL)">
            <input className={inputCls} value={f.slug} onChange={(e) => set('slug', e.target.value)} />
          </Field>
          <Field label="Instructor">
            <input className={inputCls} value={f.instructor} onChange={(e) => set('instructor', e.target.value)} />
          </Field>
          <Field label="Nivel (ej: No Gi)">
            <input className={inputCls} value={f.nivel} onChange={(e) => set('nivel', e.target.value)} />
          </Field>
          <Field label="Precio (número)">
            <input className={inputCls} value={f.precio} onChange={(e) => set('precio', e.target.value)} />
          </Field>
          <Field label="Precio mostrado (ej: US$ 47)">
            <input className={inputCls} value={f.precio_label} onChange={(e) => set('precio_label', e.target.value)} />
          </Field>
          <Field label="Link de pago (Mercado Pago / Stripe)">
            <input className={inputCls} value={f.payment_url} onChange={(e) => set('payment_url', e.target.value)} />
          </Field>
          <Field label="Acceso (meses; vacío = de por vida)">
            <input className={inputCls} value={f.duracion_acceso_meses} onChange={(e) => set('duracion_acceso_meses', e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Subtítulo">
              <input className={inputCls} value={f.subtitulo} onChange={(e) => set('subtitulo', e.target.value)} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Descripción">
              <textarea
                className={clsx(inputCls, 'min-h-[80px] resize-y')}
                value={f.descripcion}
                onChange={(e) => set('descripcion', e.target.value)}
              />
            </Field>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={saveCourse}
            disabled={pending}
            className="h-10 rounded-lg bg-jjl-red px-5 text-sm font-semibold transition-colors hover:bg-jjl-red-hover disabled:opacity-50"
          >
            Guardar curso
          </button>
          {msg && <span className="text-[13px] text-jjl-muted">{msg}</span>}
        </div>
      </section>

      {/* página de venta */}
      <SalesCopyEditor courseId={course.id} initial={course.sales_copy ?? {}} />

      {/* contenido */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Contenido</h2>
          <AddSection courseId={course.id} onDone={() => router.refresh()} />
        </div>

        <div className="mt-4 space-y-5">
          {sections.length === 0 && (
            <p className="rounded-xl border border-dashed border-jjl-border px-5 py-8 text-center text-sm text-jjl-muted">
              Todavía no hay secciones. Agregá la primera.
            </p>
          )}
          {sections.map((section) => (
            <SectionBlock
              key={section.id}
              section={section}
              courseId={course.id}
              pending={pending}
              run={run}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function AddSection({ courseId, onDone }: { courseId: string; onDone: () => void }) {
  const [titulo, setTitulo] = useState('');
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <input
        className={clsx(inputCls, 'w-48')}
        placeholder="Nueva sección"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
      />
      <button
        type="button"
        disabled={pending || !titulo}
        onClick={() =>
          start(async () => {
            await createSection(courseId, titulo);
            setTitulo('');
            onDone();
          })
        }
        className="h-[38px] shrink-0 rounded-lg bg-white/10 px-3 text-sm font-semibold disabled:opacity-50"
      >
        + Sección
      </button>
    </div>
  );
}

function SectionBlock({
  section,
  courseId,
  pending,
  run,
}: {
  section: EditorSection;
  courseId: string;
  pending: boolean;
  run: (fn: () => Promise<{ error?: string }>) => void;
}) {
  const [titulo, setTitulo] = useState(section.titulo);
  const [newLesson, setNewLesson] = useState('');

  return (
    <div className="rounded-xl border border-jjl-border bg-jjl-gray">
      <div className="flex items-center gap-2 border-b border-jjl-border p-3">
        <input
          className={clsx(inputCls, 'flex-1 font-semibold')}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onBlur={() => titulo !== section.titulo && run(() => updateSection(section.id, { titulo }))}
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => deleteSection(section.id))}
          className="shrink-0 rounded-md bg-error-soft px-2.5 py-1.5 text-[12px] font-semibold text-error disabled:opacity-50"
        >
          Eliminar
        </button>
      </div>

      <div className="space-y-2 p-3">
        {section.lessons.map((lesson) => (
          <LessonRow key={lesson.id} lesson={lesson} pending={pending} run={run} />
        ))}
        <div className="flex gap-2 pt-1">
          <input
            className={clsx(inputCls, 'flex-1')}
            placeholder="Nueva lección"
            value={newLesson}
            onChange={(e) => setNewLesson(e.target.value)}
          />
          <button
            type="button"
            disabled={pending || !newLesson}
            onClick={() => {
              run(() => createLesson(section.id, courseId, newLesson, 'video'));
              setNewLesson('');
            }}
            className="h-[38px] shrink-0 rounded-lg bg-white/10 px-3 text-sm font-semibold disabled:opacity-50"
          >
            + Lección
          </button>
        </div>
      </div>
    </div>
  );
}

function LessonRow({
  lesson,
  pending,
  run,
}: {
  lesson: EditorLesson;
  pending: boolean;
  run: (fn: () => Promise<{ error?: string }>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [l, setL] = useState({
    titulo: lesson.titulo,
    tipo: lesson.tipo,
    youtube_id: lesson.youtube_id ?? '',
    duracion: lesson.duracion ?? '',
    contenido: lesson.contenido ?? '',
  });
  const setK = (k: keyof typeof l, v: string) => setL((p) => ({ ...p, [k]: v }));

  return (
    <div className="rounded-lg bg-white/[0.03]">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-[11px] font-bold uppercase text-jjl-muted">
          {l.tipo === 'texto' ? 'Texto' : 'Video'}
        </span>
        <span className="flex-1 truncate text-[13.5px]">{l.titulo}</span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-md bg-white/5 px-2.5 py-1 text-[12px] font-semibold"
        >
          {open ? 'Cerrar' : 'Editar'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => deleteLesson(lesson.id))}
          className="rounded-md bg-error-soft px-2 py-1 text-[12px] font-semibold text-error disabled:opacity-50"
        >
          ✕
        </button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-jjl-border p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Título">
              <input className={inputCls} value={l.titulo} onChange={(e) => setK('titulo', e.target.value)} />
            </Field>
            <Field label="Tipo">
              <select className={inputCls} value={l.tipo} onChange={(e) => setK('tipo', e.target.value)}>
                <option value="video">Video</option>
                <option value="texto">Texto / lectura</option>
              </select>
            </Field>
            {l.tipo === 'video' && (
              <>
                <Field label="YouTube ID">
                  <input className={inputCls} value={l.youtube_id} onChange={(e) => setK('youtube_id', e.target.value)} />
                </Field>
                <Field label="Duración (ej: 01:54)">
                  <input className={inputCls} value={l.duracion} onChange={(e) => setK('duracion', e.target.value)} />
                </Field>
              </>
            )}
          </div>
          <Field label={l.tipo === 'texto' ? 'Contenido' : 'Material de estudio'}>
            <textarea
              className={clsx(inputCls, 'min-h-[120px] resize-y')}
              value={l.contenido}
              onChange={(e) => setK('contenido', e.target.value)}
            />
          </Field>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(() =>
                updateLesson(lesson.id, {
                  titulo: l.titulo,
                  tipo: l.tipo,
                  youtube_id: l.youtube_id || null,
                  duracion: l.duracion || null,
                  contenido: l.contenido || null,
                })
              )
            }
            className="h-9 rounded-lg bg-jjl-red px-4 text-sm font-semibold transition-colors hover:bg-jjl-red-hover disabled:opacity-50"
          >
            Guardar lección
          </button>
        </div>
      )}
    </div>
  );
}
