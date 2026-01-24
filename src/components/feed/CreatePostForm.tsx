import { useState } from 'react';
import { motion } from 'framer-motion';
import { ImagePlus, X, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createPost } from '@/lib/posts';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface CreatePostFormProps {
  onPostCreated?: () => void;
}

export function CreatePostForm({ onPostCreated }: CreatePostFormProps) {
  const { profile } = useAuth();
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const postType = imageUrl ? 'image' : content.length > 500 ? 'blog' : 'text';
      await createPost(profile.id, content.trim(), postType, imageUrl || undefined);
      setContent('');
      setImageUrl('');
      setShowImageInput(false);
      toast.success('Post created!');
      onPostCreated?.();
    } catch (error) {
      console.error('Error creating post:', error);
      toast.error('Failed to create post');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="glass-card p-4">
        <form onSubmit={handleSubmit}>
          <div className="flex gap-3">
            <Avatar className="h-10 w-10 border-2 border-primary/20">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {profile?.username?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 space-y-3">
              <Textarea
                placeholder="What's on your mind?"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[80px] resize-none border-none bg-transparent p-0 text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
              />

              {showImageInput && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="url"
                    placeholder="Enter image URL..."
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowImageInput(false);
                      setImageUrl('');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </motion.div>
              )}

              {imageUrl && (
                <div className="relative overflow-hidden rounded-xl">
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="max-h-48 w-full object-cover"
                    onError={() => toast.error('Invalid image URL')}
                  />
                </div>
              )}

              <div className="flex items-center justify-between border-t border-border pt-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowImageInput(!showImageInput)}
                  className="gap-2 text-muted-foreground hover:text-primary"
                >
                  <ImagePlus className="h-4 w-4" />
                  Add Image
                </Button>

                <Button
                  type="submit"
                  disabled={!content.trim() || isSubmitting}
                  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Send className="h-4 w-4" />
                  Post
                </Button>
              </div>
            </div>
          </div>
        </form>
      </Card>
    </motion.div>
  );
}
