import { motion } from 'framer-motion';
import { formatDistanceToNow, isToday, format } from 'date-fns';
import { Users, ShieldCheck } from 'lucide-react';
import { Conversation } from '@/lib/chat';
import { Group } from '@/lib/groups';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface ConversationListProps {
  conversations: Conversation[];
  groups: Group[];
  selectedId?: string;
  onSelectConversation: (conversation: Conversation) => void;
  onSelectGroup: (group: Group) => void;
}

export function ConversationList({
  conversations,
  groups,
  selectedId,
  onSelectConversation,
  onSelectGroup
}: ConversationListProps) {
  if (conversations.length === 0 && groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="h-16 w-16 rounded-3xl bg-primary/5 flex items-center justify-center">
          <Users className="h-8 w-8 text-primary/20" />
        </div>
        <div>
          <p className="font-bold text-foreground">No chats yet</p>
          <p className="text-xs text-muted-foreground max-w-[180px] mx-auto leading-relaxed">
            Follow people or create a group to start your first conversation!
          </p>
        </div>
      </div>
    );
  }

  const formatTimestamp = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'p');
    return formatDistanceToNow(date, { addSuffix: true });
  };

  return (
    <div className="space-y-6">
      {groups.length > 0 && (
        <div className="space-y-2">
          <p className="px-3 text-[10px] font-black text-primary/50 uppercase tracking-[0.2em]">Groups</p>
          <div className="space-y-1">
            {groups.map((group, index) => (
              <motion.button
                key={group.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onSelectGroup(group)}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-all duration-300 relative',
                  selectedId === group.id
                    ? 'bg-primary/10 shadow-sm'
                    : 'hover:bg-secondary/50'
                )}
              >
                <div className="relative">
                  <Avatar className="h-12 w-12 border-2 border-primary/10 shadow-sm transition-transform group-hover:scale-105">
                    <AvatarImage src={group.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/5 text-primary">
                      <Users className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  {group.unread_count && group.unread_count > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 bg-primary text-primary-foreground text-[10px] font-black rounded-full flex items-center justify-center border-2 border-background shadow-lg">
                      {group.unread_count}
                    </span>
                  )}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                      {group.name}
                    </p>
                  </div>
                  <p className="text-[10px] font-semibold text-muted-foreground truncate uppercase tracking-tighter opacity-70">
                    Group Community
                  </p>
                </div>
                {selectedId === group.id && (
                  <motion.div layoutId="active-indicator" className="absolute left-0 w-1 h-6 bg-primary rounded-r-full" />
                )}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {conversations.length > 0 && (
        <div className="space-y-2">
          <p className="px-3 text-[10px] font-black text-primary/50 uppercase tracking-[0.2em]">Direct Messages</p>
          <div className="space-y-1">
            {conversations.map((conv, index) => (
              <motion.button
                key={conv.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onSelectConversation(conv)}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-all duration-300 relative',
                  selectedId === conv.id
                    ? 'bg-primary/10 shadow-sm'
                    : 'hover:bg-secondary/50'
                )}
              >
                <div className="relative">
                  <Avatar className="h-12 w-12 border-2 border-primary/10 shadow-sm transition-transform group-hover:scale-105">
                    <AvatarImage src={conv.other_user?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/5 text-primary font-bold">
                      {conv.other_user?.username?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  {conv.unread_count && conv.unread_count > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 bg-primary text-primary-foreground text-[10px] font-black rounded-full flex items-center justify-center border-2 border-background shadow-lg">
                      {conv.unread_count}
                    </span>
                  )}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                      @{conv.other_user?.username}
                    </p>
                    <span className="text-[9px] font-bold text-muted-foreground whitespace-nowrap">
                      {formatTimestamp(conv.updated_at)}
                    </span>
                  </div>
                  <p className={cn(
                    "text-xs truncate",
                    conv.unread_count && conv.unread_count > 0 ? "text-foreground font-bold" : "text-muted-foreground font-medium"
                  )}>
                    {conv.last_message?.content || 'Started a conversation'}
                  </p>
                </div>
                {selectedId === conv.id && (
                  <motion.div layoutId="active-indicator" className="absolute left-0 w-1 h-6 bg-primary rounded-r-full" />
                )}
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
