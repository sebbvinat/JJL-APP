'use client';

import { useState } from 'react';
import { Heart, Send } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';

interface Comment {
  id: string;
  author: string;
  belt: string;
  content: string;
  time: string;
  likes: number;
}

interface CommentSectionProps {
  comments: Comment[];
}

export default function CommentSection({ comments: initialComments }: CommentSectionProps) {
  const [comments, setComments] = useState(initialComments);
  const [newComment, setNewComment] = useState('');

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    setComments([
      ...comments,
      {
        id: `new-${Date.now()}`,
        author: 'Tu',
        belt: 'blue',
        content: newComment,
        time: 'Ahora',
        likes: 0,
      },
    ]);
    setNewComment('');
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">{comments.length} Comentarios</h3>

      {/* Comment list */}
      <div className="space-y-3">
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-3 p-3 rounded-lg bg-jjl-gray-light/50">
            <Avatar name={comment.author} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{comment.author}</span>
                <Badge belt={comment.belt} />
                <span className="text-xs text-jjl-muted">{comment.time}</span>
              </div>
              <p className="text-sm text-jjl-muted mt-1">{comment.content}</p>
              <button className="flex items-center gap-1 mt-2 text-xs text-jjl-muted hover:text-jjl-red transition-colors">
                <Heart className="h-3 w-3" />
                {comment.likes}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* New comment */}
      <div className="flex gap-2">
        <Avatar name="Tu" size="sm" />
        <div className="flex-1 flex gap-2">
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Escribe un comentario..."
            className="flex-1 bg-jjl-gray-light border border-jjl-border rounded-lg px-4 py-2 text-white text-sm placeholder:text-jjl-muted/60 focus:outline-none focus:ring-2 focus:ring-jjl-red/50"
          />
          <button
            onClick={handleSubmit}
            className="p-2 bg-jjl-red rounded-lg text-white hover:bg-jjl-red-hover transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
