'use client';

import { CheckCircle, Circle, Play, Clock, MessageCircle } from 'lucide-react';
import { clsx } from 'clsx';

interface Lesson {
  id: string;
  titulo: string;
  duracion: string;
  completed: boolean;
  tipo?: 'video' | 'reflection';
}

interface LessonListProps {
  lessons: Lesson[];
  activeId?: string;
  onSelect: (id: string) => void;
}

export default function LessonList({ lessons, activeId, onSelect }: LessonListProps) {
  return (
    <div className="space-y-1">
      {lessons.map((lesson, idx) => {
        const isActive = lesson.id === activeId;
        const isReflection = lesson.tipo === 'reflection';
        return (
          <button
            key={lesson.id}
            onClick={() => onSelect(lesson.id)}
            className={clsx(
              'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
              isActive
                ? 'bg-jjl-red/10 border border-jjl-red/30'
                : 'hover:bg-jjl-gray-light border border-transparent',
              isReflection && 'border-dashed'
            )}
          >
            {/* Status icon */}
            <div className="shrink-0">
              {lesson.completed ? (
                <CheckCircle className="h-5 w-5 text-green-400" />
              ) : isReflection ? (
                <MessageCircle className={clsx('h-5 w-5', isActive ? 'text-jjl-red' : 'text-yellow-500')} />
              ) : isActive ? (
                <Play className="h-5 w-5 text-jjl-red fill-jjl-red" />
              ) : (
                <Circle className="h-5 w-5 text-jjl-muted" />
              )}
            </div>

            {/* Lesson info */}
            <div className="flex-1 min-w-0">
              <p className={clsx(
                'text-sm font-medium truncate',
                isReflection && !isActive ? 'text-yellow-500' : isActive ? 'text-white' : lesson.completed ? 'text-jjl-muted' : 'text-white'
              )}>
                {idx + 1}. {lesson.titulo}
              </p>
            </div>

            {/* Duration */}
            {lesson.duracion && (
              <div className="flex items-center gap-1 text-xs text-jjl-muted shrink-0">
                <Clock className="h-3 w-3" />
                {lesson.duracion}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
