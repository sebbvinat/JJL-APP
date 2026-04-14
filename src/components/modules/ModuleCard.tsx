import Link from 'next/link';
import { Lock, CheckCircle, BookOpen, ArrowRight } from 'lucide-react';
import Card from '@/components/ui/Card';

interface ModuleCardProps {
  id: string;
  semana: number;
  titulo: string;
  descripcion?: string;
  totalLessons: number;
  completedLessons: number;
  unlocked: boolean;
}

export default function ModuleCard({
  id,
  semana,
  titulo,
  descripcion,
  totalLessons,
  completedLessons,
  unlocked,
}: ModuleCardProps) {
  const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const isCompleted = progress === 100;

  const content = (
    <Card
      hover={unlocked}
      className={`group relative overflow-hidden h-full ${
        !unlocked ? 'opacity-60 cursor-not-allowed' : ''
      }`}
    >
      {/* Top accent line on hover */}
      {unlocked && (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-jjl-red/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center h-6 px-2 rounded-md bg-jjl-red/10 border border-jjl-red/20 text-jjl-red text-[11px] font-bold uppercase tracking-[0.14em]">
              {semana === 0 ? 'Intro' : `S${semana}`}
            </span>
            {isCompleted && unlocked && (
              <span className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-green-500/10 border border-green-500/20 text-green-400 text-[11px] font-semibold">
                <CheckCircle className="h-3 w-3" />
                Completado
              </span>
            )}
          </div>
          <h3 className="text-[17px] font-bold text-white mt-2.5 leading-tight text-balance">
            {titulo}
          </h3>
          {descripcion && (
            <p className="text-[13px] text-jjl-muted mt-1.5 line-clamp-2 leading-relaxed">
              {descripcion}
            </p>
          )}
        </div>
        <div className="shrink-0">
          {!unlocked ? (
            <div className="h-9 w-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
              <Lock className="h-4 w-4 text-jjl-muted" />
            </div>
          ) : (
            <div className="h-9 w-9 rounded-lg bg-jjl-red/10 border border-jjl-red/20 flex items-center justify-center text-jjl-red group-hover:bg-jjl-red group-hover:text-white transition-colors">
              <ArrowRight className="h-4 w-4" />
            </div>
          )}
        </div>
      </div>

      {unlocked && (
        <div className="mt-5">
          <div className="flex items-center justify-between text-[11px] font-medium mb-1.5">
            <span className="flex items-center gap-1.5 text-jjl-muted">
              <BookOpen className="h-3 w-3" />
              {completedLessons}/{totalLessons} lecciones
            </span>
            <span className={isCompleted ? 'text-green-400' : 'text-jjl-red'}>
              {progress}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                isCompleted
                  ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                  : 'bg-gradient-to-r from-jjl-red to-orange-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </Card>
  );

  if (!unlocked) return content;

  return (
    <Link href={`/modules/${id}`} className="block">
      {content}
    </Link>
  );
}
