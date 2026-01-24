import { MainLayout } from '@/components/layout/MainLayout';
import { CreatePostForm } from '@/components/feed/CreatePostForm';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function CreatePage() {
  const navigate = useNavigate();

  return (
    <MainLayout>
      <h1 className="text-2xl font-bold text-foreground mb-6">Create Post</h1>
      <CreatePostForm onPostCreated={() => { toast.success('Post created!'); navigate('/'); }} />
    </MainLayout>
  );
}
