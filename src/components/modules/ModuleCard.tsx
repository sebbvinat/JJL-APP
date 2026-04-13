import Link from 'next/link';
import { Lock, CheckCircle, BookOpen } from 'lucide-react';
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
    <Card hover={unlocked} className={!unlocked ? 'opacity-50 cursor-not-allowed' : ''}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-jjl-red font-semibold uppercase tracking-wider">
            {semana === 0 ? 'Intro' : `Semana ${semana}`}
          </p>
          <h3 className="text-lg font-bold mt-1 truncate">{titulo}</h3>
          {descripcion && (
            <p className="text-sm text-jjl-muted mt-1 line-clamp-2">{descripcion}</p>
          )}
          <div className="flex items-center gap-2 mt-2 text-sm text-jjl-muted">
            <BookOpen className="h-3.5 w-3.5" />
            <span>{totalLessons} lecciones</span>
            {unlocked && completedLessons > 0 && (
              <span className="text-green-400">({completedLessons} completadas)</span>
            )}
          </div>
        </div>
        <div className="ml-3 shrink-0">
          {!unlocked ? (
            <Lock className="h-5 w-5 text-jjl-muted" />
          ) : isCompleted ? (
            <CheckCircle className="h-5 w-5 text-green-400" />
          ) : (
            <div className="h-5 w-5 rounded-full border-2 border-jjl-red" />
          )}
        </div>
      </div>

      {unlocked && (
        <div className="mt-4">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-jjl-muted">Progreso</span>
            <span className="text-jjl-red font-medium">{progress}%</span>
          </div>
          <div className="w-full bg-jjl-gray-light rounded-full h-1.5">
            <div
              className="bg-jjl-red h-1.5 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </Card>
  );

  if (!unlocked) return content;

  return (
    <Link href={`/modules/${id}`}>
      {content}
    </Link>
  );
}
