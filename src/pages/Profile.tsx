import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { ProfileView } from '@/components/profile/ProfileView';
import { getProfileByUsername } from '@/lib/profiles';

export default function ProfilePage() {
  const { username } = useParams();
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    if (username) {
      getProfileByUsername(username).then((p) => setProfileId(p?.id || null));
    }
  }, [username]);

  return (
    <MainLayout>
      {profileId ? <ProfileView profileId={profileId} /> : (
        <div className="flex justify-center py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
    </MainLayout>
  );
}
