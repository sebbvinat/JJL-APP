'use client';

import { useState } from 'react';
import { BarChart3, Check } from 'lucide-react';

export interface PollData {
  id: string;
  pregunta: string;
  opciones: { id: string; texto: string }[];
  multiple: boolean;
  totalVotes: number;
  counts: Record<string, number>;
  myVotes: string[];
}

export default function Poll({ poll, onVote }: { poll: PollData; onVote?: (updated: PollData) => void }) {
  const [localPoll, setLocalPoll] = useState<PollData>(poll);
  const [voting, setVoting] = useState(false);

  async function handleVote(e: React.MouseEvent, opcionId: string) {
    e.stopPropagation();
    e.preventDefault();
    if (voting) return;
    setVoting(true);

    const wasVoted = localPoll.myVotes.includes(opcionId);
    const newMyVotes = wasVoted
      ? localPoll.myVotes.filter((v) => v !== opcionId)
      : localPoll.multiple
        ? [...localPoll.myVotes, opcionId]
        : [opcionId];

    // Optimistic update
    const newCounts = { ...localPoll.counts };
    if (wasVoted) {
      newCounts[opcionId] = Math.max(0, (newCounts[opcionId] || 0) - 1);
    } else {
      if (!localPoll.multiple && localPoll.myVotes.length > 0) {
        localPoll.myVotes.forEach((v) => {
          newCounts[v] = Math.max(0, (newCounts[v] || 0) - 1);
        });
      }
      newCounts[opcionId] = (newCounts[opcionId] || 0) + 1;
    }

    const totalVotes = Object.values(newCounts).reduce((s, c) => s + c, 0);
    const updated = { ...localPoll, myVotes: newMyVotes, counts: newCounts, totalVotes };
    setLocalPoll(updated);

    try {
      await fetch('/api/community/polls/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pollId: poll.id, opcionId }),
      });
      onVote?.(updated);
    } catch {
      // Revert on error
      setLocalPoll(localPoll);
    }
    setVoting(false);
  }

  const hasVoted = localPoll.myVotes.length > 0;
  const total = localPoll.totalVotes || 0;

  return (
    <div className="mt-3 bg-white/[0.02] border border-jjl-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-jjl-red" />
        <p className="font-semibold text-sm">{localPoll.pregunta}</p>
      </div>
      <div className="space-y-2">
        {localPoll.opciones.map((opt) => {
          const count = localPoll.counts[opt.id] || 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const isMyVote = localPoll.myVotes.includes(opt.id);

          return (
            <button
              key={opt.id}
              onClick={(e) => handleVote(e, opt.id)}
              disabled={voting}
              className={`w-full relative rounded-lg border overflow-hidden transition-all text-left ${
                isMyVote
                  ? 'border-jjl-red/50 bg-jjl-red/10'
                  : 'border-jjl-border hover:border-jjl-red/30 bg-white/[0.02]'
              }`}
            >
              {/* Progress bar bg - only shown after voting */}
              {hasVoted && (
                <div
                  className={`absolute inset-y-0 left-0 ${isMyVote ? 'bg-jjl-red/20' : 'bg-white/[0.04]'}`}
                  style={{ width: `${pct}%`, transition: 'width 300ms ease-out' }}
                />
              )}
              <div className="relative flex items-center justify-between px-3 py-2.5 gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {isMyVote && <Check className="h-3.5 w-3.5 text-jjl-red shrink-0" />}
                  <span className={`text-sm truncate ${isMyVote ? 'text-white font-semibold' : 'text-white'}`}>
                    {opt.texto}
                  </span>
                </div>
                {hasVoted && (
                  <span className="text-xs tabular-nums shrink-0 text-jjl-muted">
                    <span className={isMyVote ? 'text-jjl-red font-bold' : 'text-white font-semibold'}>{pct}%</span>
                    <span className="ml-1.5 text-[10px]">· {count}</span>
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-jjl-muted">
        {total} voto{total !== 1 ? 's' : ''}{localPoll.multiple ? ' · Multiple' : ''}
      </p>
    </div>
  );
}
