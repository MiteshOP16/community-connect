import { useState } from 'react';
import { Search } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { searchProfiles, Profile } from '@/lib/profiles';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Link } from 'react-router-dom';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);

  const handleSearch = async (q: string) => {
    setQuery(q);
    if (q.length > 1) {
      const data = await searchProfiles(q);
      setResults(data);
    } else {
      setResults([]);
    }
  };

  return (
    <MainLayout>
      <h1 className="text-2xl font-bold text-foreground mb-6">Search Users</h1>
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Search by username..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-10 bg-input"
        />
      </div>
      <div className="space-y-2">
        {results.map((user) => (
          <Link key={user.id} to={`/profile/${user.username}`}>
            <Card className="glass-card p-4 flex items-center gap-4 hover:bg-secondary/50 transition-colors">
              <Avatar>
                <AvatarImage src={user.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {user.username?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-foreground">@{user.username}</p>
                {user.bio && <p className="text-sm text-muted-foreground truncate">{user.bio}</p>}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </MainLayout>
  );
}
