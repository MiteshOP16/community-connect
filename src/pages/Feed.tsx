import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { CreatePostForm } from '@/components/feed/CreatePostForm';
import { PostCard } from '@/components/feed/PostCard';
import { CommentsSection } from '@/components/feed/CommentsSection';
import { fetchPosts, Post } from '@/lib/posts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const loadPosts = async () => {
    try {
      const data = await fetchPosts();
      setPosts(data);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  return (
    <MainLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Feed</h1>
        <CreatePostForm onPostCreated={loadPosts} />
        
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : posts.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No posts yet. Be the first!</p>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onComment={() => setSelectedPost(post)}
                onDelete={loadPosts}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Comments</DialogTitle>
          </DialogHeader>
          {selectedPost && <CommentsSection postId={selectedPost.id} />}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
