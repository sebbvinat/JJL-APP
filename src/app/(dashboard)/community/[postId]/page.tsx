'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Heart, Loader2, Send, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import Card from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import Poll from '@/components/community/Poll';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

interface Post {
  id: string;
  autor: string;
  avatar_url: string | null;
  cinturon: string;
  titulo: string;
  contenido: string;
  categoria: string;
  likes: number;
  comments: number;
  liked: boolean;
  isOwner: boolean;
  createdAt: string;
  poll?: import('@/components/community/Poll').PollData | null;
}

interface Comment {
  id: string;
  autor: string;
  avatar_url: string | null;
  cinturon: string;
  contenido: string;
  isOwner: boolean;
  canDelete: boolean;
  createdAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  question: 'Pregunta',
  technique: 'Tecnica',
  progress: 'Progreso',
  discussion: 'Discusion',
  competition: 'Competencia',
  bienvenida: 'Bienvenida',
  offtopic: 'Off Topic',
};

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.postId as string;

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);
  const [liking, setLiking] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetchPost();
  }, [postId]);

  async function fetchPost() {
    try {
      const res = await fetch(`/api/community/posts/${postId}`);
      if (res.ok) {
        const data = await res.json();
        setPost(data.post);
        setComments(data.comments || []);
        setIsAdmin(!!data.isAdmin);
      }
    } catch {}
    setLoading(false);
  }

  async function handleLike() {
    if (!post || liking) return;
    setLiking(true);
    setPost((p) => p ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p);

    try {
      await fetch('/api/community/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      });
    } catch {
      setPost((p) => p ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p);
    }
    setLiking(false);
  }

  async function handleComment() {
    if (!newComment.trim() || sending) return;
    setSending(true);

    try {
      const res = await fetch('/api/community/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, contenido: newComment }),
      });
      if (res.ok) {
        setNewComment('');
        fetchPost(); // Reload to get the new comment with user info
      }
    } catch {}
    setSending(false);
  }

  async function handleDelete() {
    if (!confirm('Eliminar este post?')) return;
    try {
      const res = await fetch(`/api/community/posts/${postId}`, { method: 'DELETE' });
      if (res.ok) router.push('/community');
    } catch {}
  }

  async function handleDeleteComment(commentId: string) {
    if (!confirm('Eliminar este comentario?')) return;
    try {
      const res = await fetch(`/api/community/comments/${commentId}`, { method: 'DELETE' });
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        setPost((p) => p ? { ...p, comments: p.comments - 1 } : p);
      }
    } catch {}
  }

  function timeAgo(dateStr: string) {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: es });
    } catch {
      return '';
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-jjl-muted" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <p className="text-jjl-muted">Post no encontrado</p>
        <button onClick={() => router.push('/community')} className="text-jjl-red hover:underline">
          Volver a Comunidad
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back */}
      <button
        onClick={() => router.push('/community')}
        className="flex items-center gap-2 text-jjl-muted hover:text-white transition-colors text-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a Comunidad
      </button>

      {/* Post */}
      <Card>
        <div className="flex gap-3 mb-4">
          <Avatar src={post.avatar_url} name={post.autor} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{post.autor}</span>
              <Badge belt={post.cinturon} />
            </div>
            <span className="text-xs text-jjl-muted">{timeAgo(post.createdAt)}</span>
          </div>
          {post.isOwner && (
            <button
              onClick={handleDelete}
              className="text-jjl-muted hover:text-red-400 transition-colors p-1"
              title="Eliminar post"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        <h1 className="text-xl font-bold">{post.titulo}</h1>
        <div className="mt-3 text-jjl-muted whitespace-pre-line text-sm leading-relaxed">
          {post.contenido}
        </div>

        {post.poll && <Poll poll={post.poll} isAdmin={isAdmin} />}

        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-jjl-border">
          <button
            onClick={handleLike}
            disabled={liking}
            className={`flex items-center gap-1.5 text-sm transition-colors ${
              post.liked ? 'text-red-400' : 'text-jjl-muted hover:text-red-400'
            }`}
          >
            <Heart className="h-4 w-4" fill={post.liked ? 'currentColor' : 'none'} />
            {post.likes} likes
          </button>
          <Badge>{CATEGORY_LABELS[post.categoria] || post.categoria}</Badge>
        </div>
      </Card>

      {/* Comments */}
      <Card>
        <h2 className="font-semibold mb-4">Comentarios ({comments.length})</h2>

        {comments.length > 0 && (
          <div className="space-y-4 mb-6">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <Avatar src={comment.avatar_url} name={comment.autor} size="sm" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{comment.autor}</span>
                    <Badge belt={comment.cinturon} />
                    <span className="text-xs text-jjl-muted">{timeAgo(comment.createdAt)}</span>
                  </div>
                  <p className="text-sm text-jjl-muted mt-1">{comment.contenido}</p>
                </div>
                {comment.canDelete && (
                  <button
                    onClick={() => handleDeleteComment(comment.id)}
                    className="text-jjl-muted hover:text-red-400 transition-colors p-1 shrink-0 self-start"
                    title="Eliminar comentario"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add comment */}
        <div className="flex gap-2 pt-4 border-t border-jjl-border">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleComment()}
            placeholder="Escribe un comentario..."
            className="flex-1 bg-jjl-gray-light border border-jjl-border rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-jjl-muted/60 focus:outline-none focus:border-jjl-red"
          />
          <Button
            variant="primary"
            onClick={handleComment}
            loading={sending}
            disabled={!newComment.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
