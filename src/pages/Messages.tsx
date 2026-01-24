import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { ConversationList } from '@/components/chat/ConversationList';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { getConversations, Conversation } from '@/lib/chat';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';

export default function MessagesPage() {
  const { profile } = useAuth();
  const location = useLocation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    getConversations(profile.id).then((data) => {
      setConversations(data);
      setIsLoading(false);
      
      // Handle navigation state
      const state = location.state as { conversationId?: string; otherUser?: any } | null;
      if (state?.conversationId) {
        const conv = data.find((c) => c.id === state.conversationId);
        if (conv) setSelected({ ...conv, other_user: state.otherUser || conv.other_user });
      }
    });
  }, [profile, location.state]);

  return (
    <MainLayout>
      <h1 className="text-2xl font-bold text-foreground mb-6">Messages</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-200px)]">
        <Card className="glass-card p-4 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <ConversationList
              conversations={conversations}
              selectedId={selected?.id}
              onSelect={setSelected}
            />
          )}
        </Card>
        <Card className="glass-card lg:col-span-2 overflow-hidden">
          {selected?.other_user ? (
            <ChatWindow conversationId={selected.id} otherUser={selected.other_user} />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Select a conversation to start chatting
            </div>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
