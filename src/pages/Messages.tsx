import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { ConversationList } from '@/components/chat/ConversationList';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { GroupChatWindow } from '@/components/chat/GroupChatWindow';
import { CreateGroupForm } from '@/components/chat/CreateGroupForm';
import { getConversations, Conversation } from '@/lib/chat';
import { getGroups, Group } from '@/lib/groups';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, MessageSquare, ChevronLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';


export default function MessagesPage() {
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const handledStateRef = useRef(false);

  const loadData = async () => {
    if (!profile) {
      console.log('[Messages] No profile available');
      setIsLoading(false);
      return;
    }
    try {
      console.log('[Messages] Loading conversations/groups for profile:', profile.id);
      const [convData, groupData] = await Promise.all([
        getConversations(profile.id),
        getGroups(profile.id),
      ]);
      console.log('[Messages] Loaded conversations:', convData.length, 'groups:', groupData.length);
      console.log('[Messages] Conversations data:', convData);
      console.log('[Messages] Groups data:', groupData);
      setConversations(convData);
      setGroups(groupData);
    } catch (error) {
      console.error('[Messages] Error loading data:', error);
      setConversations([]);
      setGroups([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    if (!profile) return;

    // Subscribe to new messages in any of my conversations
    const messageChannel = supabase
      .channel('messages-refresh')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => loadData()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages' },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
    };
  }, [profile]);

  // Handle navigation from profile/connect
  useEffect(() => {
    if (!isLoading && profile && location.state?.conversationId && !handledStateRef.current) {
      const state = location.state as { conversationId: string; otherUser: any };
      console.log('[Messages] Handling navigation state:', state);

      let conv = conversations.find(c => c.id === state.conversationId);

      if (!conv && state.otherUser) {
        console.log('[Messages] Conversation not in list, constructing temporary one');
        conv = {
          id: state.conversationId,
          user_1: profile.id,
          user_2: state.otherUser.id,
          other_user: state.otherUser,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as Conversation;
      }

      if (conv) {
        console.log('[Messages] Selecting conversation:', conv.id);
        setSelectedConversation(conv);
        setSelectedGroup(null);
        setShowCreateGroup(false);
        handledStateRef.current = true;
        // Optionally clear state from router
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [isLoading, profile, location.state, conversations, navigate, location.pathname]);

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
    setSelectedGroup(null);
    setShowCreateGroup(false);
  };

  const handleSelectGroup = (group: Group) => {
    setSelectedGroup(group);
    setSelectedConversation(null);
    setShowCreateGroup(false);
  };

  return (
    <MainLayout>
      <div className="flex items-center gap-4 mb-6">
        {(selectedConversation || selectedGroup || showCreateGroup) && (
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden rounded-full h-10 w-10 shrink-0"
            onClick={() => {
              setSelectedConversation(null);
              setSelectedGroup(null);
              setShowCreateGroup(false);
            }}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
        )}
        <h1 className="text-2xl font-bold text-foreground flex-1">
          {showCreateGroup ? 'New Group' : (selectedConversation ? 'Direct Chat' : (selectedGroup ? 'Group Chat' : 'Messages'))}
        </h1>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 shrink-0 h-9 px-4 rounded-xl border-primary/20 hover:bg-primary/10 hover:text-primary transition-all active:scale-95"
          onClick={() => {
            setShowCreateGroup(true);
            setSelectedConversation(null);
            setSelectedGroup(null);
          }}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Group</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-180px)] lg:h-[calc(100vh-220px)] overflow-hidden">
        {/* Sidebar List: Always block on lg, hidden on mobile when chat is open */}
        <Card className={cn(
          "glass-card p-4 overflow-y-auto lg:block",
          (selectedConversation || selectedGroup || showCreateGroup) ? "hidden" : "block"
        )}>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <ConversationList
              conversations={conversations}
              groups={groups}
              selectedId={selectedConversation?.id || selectedGroup?.id}
              onSelectConversation={handleSelectConversation}
              onSelectGroup={handleSelectGroup}
            />
          )}
        </Card>

        {/* Chat Window: block on lg, hidden on mobile when list is open */}
        <Card className={cn(
          "glass-card lg:col-span-2 overflow-hidden flex flex-col border-none sm:border",
          (!selectedConversation && !selectedGroup && !showCreateGroup) ? "hidden lg:flex" : "flex"
        )}>
          {showCreateGroup ? (
            <CreateGroupForm
              onGroupCreated={() => {
                setShowCreateGroup(false);
                loadData();
              }}
              onCancel={() => setShowCreateGroup(false)}
            />
          ) : selectedConversation ? (
            <ChatWindow
              conversationId={selectedConversation.id}
              otherUser={selectedConversation.other_user!}
            />
          ) : selectedGroup ? (
            <GroupChatWindow
              groupId={selectedGroup.id}
              groupName={selectedGroup.name}
              groupAvatar={selectedGroup.avatar_url}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground p-8 text-center animate-fade-in">
              <div className="p-6 rounded-full bg-primary/5 mb-6 border border-primary/10 shadow-glow">
                <MessageSquare className="h-16 w-16 text-primary/30" />
              </div>
              <h3 className="font-bold text-2xl text-foreground mb-3">Your Messages</h3>
              <p className="max-w-[320px] text-muted-foreground leading-relaxed">
                Connect with your community. Select a conversation to start sharing ideas and moments.
              </p>
            </div>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
