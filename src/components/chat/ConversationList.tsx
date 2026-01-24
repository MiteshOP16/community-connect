import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { Conversation } from '@/lib/chat';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId?: string;
  onSelect: (conversation: Conversation) => void;
}

export function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">No conversations yet</p>
        <p className="mt-1 text-sm text-muted-foreground/70">
          Follow users who follow you back to start chatting!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {conversations.map((conv, index) => (
        <motion.button
          key={conv.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          onClick={() => onSelect(conv)}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all duration-200',
            selectedId === conv.id
              ? 'bg-primary/10 border border-primary/20'
              : 'hover:bg-secondary/50'
          )}
        >
          <Avatar className="h-12 w-12 border-2 border-primary/20">
            <AvatarImage src={conv.other_user?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {conv.other_user?.username?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="font-medium text-foreground truncate">
              @{conv.other_user?.username}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })}
            </p>
          </div>
        </motion.button>
      ))}
    </div>
  );
}
