import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { Send, CornerDownRight } from 'lucide-react';
import { Comment, fetchComments, createComment } from '@/lib/posts';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';

interface CommentsSectionProps {
  postId: string;
}

export function CommentsSection({ postId }: CommentsSectionProps) {
  const { profile } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadComments = async () => {
    try {
      const data = await fetchComments(postId);
      setComments(data);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [postId]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newComment.trim()) return;

    try {
      const comment = await createComment(postId, profile.id, newComment.trim());
      setComments((prev) => [...prev, { ...comment, replies: [] }]);
      setNewComment('');
    } catch (error) {
      console.error('Error creating comment:', error);
    }
  };

  const handleSubmitReply = async (parentId: string) => {
    if (!profile || !replyContent.trim()) return;

    try {
      const reply = await createComment(postId, profile.id, replyContent.trim(), parentId);
      setComments((prev) =>
        prev.map((c) =>
          c.id === parentId
            ? { ...c, replies: [...(c.replies || []), reply] }
            : c
        )
      );
      setReplyContent('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Error creating reply:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* New comment form */}
      <form onSubmit={handleSubmitComment} className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={profile?.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs">
            {profile?.username?.[0]?.toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
        <Input
          placeholder="Write a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="flex-1 bg-input"
        />
        <Button type="submit" size="icon" disabled={!newComment.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>

      {/* Comments list */}
      <div className="space-y-4">
        {comments.map((comment) => (
          <motion.div
            key={comment.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            {/* Main comment */}
            <div className="flex gap-3">
              <Link to={`/profile/${comment.author?.username}`}>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={comment.author?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {comment.author?.username?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
              </Link>
              <div className="flex-1">
                <div className="rounded-xl bg-secondary/50 px-3 py-2">
                  <Link
                    to={`/profile/${comment.author?.username}`}
                    className="text-sm font-medium text-foreground hover:text-primary"
                  >
                    @{comment.author?.username}
                  </Link>
                  <p className="text-sm text-foreground/90">{comment.content}</p>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                  </span>
                  <button
                    onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                    className="hover:text-primary"
                  >
                    Reply
                  </button>
                </div>
              </div>
            </div>

            {/* Replies */}
            {comment.replies && comment.replies.length > 0 && (
              <div className="ml-11 space-y-3">
                {comment.replies.map((reply) => (
                  <motion.div
                    key={reply.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex gap-3"
                  >
                    <CornerDownRight className="h-4 w-4 text-muted-foreground mt-2" />
                    <Link to={`/profile/${reply.author?.username}`}>
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={reply.author?.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {reply.author?.username?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="flex-1">
                      <div className="rounded-xl bg-secondary/30 px-3 py-2">
                        <Link
                          to={`/profile/${reply.author?.username}`}
                          className="text-sm font-medium text-foreground hover:text-primary"
                        >
                          @{reply.author?.username}
                        </Link>
                        <p className="text-sm text-foreground/90">{reply.content}</p>
                      </div>
                      <span className="mt-1 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Reply form */}
            {replyingTo === comment.id && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="ml-11 flex items-center gap-2"
              >
                <Input
                  placeholder={`Reply to @${comment.author?.username}...`}
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  className="flex-1 bg-input text-sm"
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={() => handleSubmitReply(comment.id)}
                  disabled={!replyContent.trim()}
                >
                  Reply
                </Button>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      {comments.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-4">
          No comments yet. Be the first to comment!
        </p>
      )}
    </div>
  );
}
