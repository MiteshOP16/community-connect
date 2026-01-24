import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Share2, MoreHorizontal, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Post, likePost, unlikePost, checkIfLiked, incrementShareCount, deletePost } from '@/lib/posts';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

interface PostCardProps {
  post: Post;
  onComment?: () => void;
  onDelete?: () => void;
  showFullContent?: boolean;
}

export function PostCard({ post, onComment, onDelete, showFullContent = false }: PostCardProps) {
  const { profile } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [isLiking, setIsLiking] = useState(false);

  useEffect(() => {
    if (profile) {
      checkIfLiked(post.id, profile.id).then(setLiked);
    }
  }, [post.id, profile]);

  const handleLike = async () => {
    if (!profile || isLiking) return;
    setIsLiking(true);

    try {
      if (liked) {
        await unlikePost(post.id, profile.id);
        setLiked(false);
        setLikesCount((c) => c - 1);
      } else {
        await likePost(post.id, profile.id);
        setLiked(true);
        setLikesCount((c) => c + 1);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    } finally {
      setIsLiking(false);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
      await incrementShareCount(post.id);
      toast.success('Link copied to clipboard!');
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleDelete = async () => {
    try {
      await deletePost(post.id);
      toast.success('Post deleted');
      onDelete?.();
    } catch (error) {
      toast.error('Failed to delete post');
    }
  };

  const isOwner = profile?.id === post.author_id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="glass-card overflow-hidden p-4 hover-lift">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Link to={`/profile/${post.author?.username}`}>
            <Avatar className="h-10 w-10 border-2 border-primary/20 transition-transform hover:scale-105">
              <AvatarImage src={post.author?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {post.author?.username?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
          </Link>

          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <Link
                  to={`/profile/${post.author?.username}`}
                  className="font-medium text-foreground hover:text-primary transition-colors"
                >
                  @{post.author?.username}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </p>
              </div>

              {isOwner && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="mt-3">
          <p
            className={cn(
              'whitespace-pre-wrap text-foreground',
              !showFullContent && post.content.length > 280 && 'line-clamp-4'
            )}
          >
            {post.content}
          </p>

          {post.image_url && (
            <div className="mt-3 overflow-hidden rounded-xl">
              <img
                src={post.image_url}
                alt="Post image"
                className="w-full object-cover max-h-96"
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLike}
            className={cn(
              'gap-2 transition-colors',
              liked && 'text-accent'
            )}
          >
            <Heart
              className={cn('h-4 w-4', liked && 'fill-current')}
            />
            {likesCount}
          </Button>

          <Button variant="ghost" size="sm" onClick={onComment} className="gap-2">
            <MessageCircle className="h-4 w-4" />
            {post.comments_count}
          </Button>

          <Button variant="ghost" size="sm" onClick={handleShare} className="gap-2">
            <Share2 className="h-4 w-4" />
            {post.shares_count}
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
