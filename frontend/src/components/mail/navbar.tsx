import { useAtom } from 'jotai';
import {
  Inbox,
  Send,
  FileText,
  Trash2,
  AlertOctagon,
  Star,
  Folder,
  Plus,
  LogOut,
  Mail,
  User,
} from 'lucide-react';
import { activeFolderAtom, isComposeOpenAtom, selectedMessageIdAtom } from '../../store/mail-store';
import { api } from '../../lib/api';
import { Button } from '../ui/button';
import { ThemeToggle } from '../theme/theme-toggle';
import type { MailFolder, UserSession } from '../../types/mail';
import { useQuery } from '@tanstack/react-query';

interface NavbarProps {
  session?: UserSession | null;
  onLogout: () => void;
}

export function Navbar({ session, onLogout }: NavbarProps) {
  const [activeFolder, setActiveFolder] = useAtom(activeFolderAtom);
  const [, setIsComposeOpen] = useAtom(isComposeOpenAtom);
  const [, setSelectedMessageId] = useAtom(selectedMessageIdAtom);

  const { data: folders = [] } = useQuery({
    queryKey: ['folders'],
    queryFn: () => api.folders.list(),
    refetchInterval: 30000,
  });

  const getFolderIcon = (path: string, specialUse?: string) => {
    const lower = (specialUse || path).toLowerCase();
    if (lower.includes('inbox')) return <Inbox className="h-4 w-4" />;
    if (lower.includes('sent')) return <Send className="h-4 w-4" />;
    if (lower.includes('draft')) return <FileText className="h-4 w-4" />;
    if (lower.includes('trash') || lower.includes('bin')) return <Trash2 className="h-4 w-4" />;
    if (lower.includes('spam') || lower.includes('junk')) return <AlertOctagon className="h-4 w-4" />;
    if (lower.includes('star')) return <Star className="h-4 w-4" />;
    return <Folder className="h-4 w-4" />;
  };

  const handleSelectFolder = (path: string) => {
    setActiveFolder(path);
    setSelectedMessageId(null);
  };

  return (
    <div className="w-60 h-full bg-sidebar border-r border-sidebar-border flex flex-col justify-between select-none">
      {/* Brand & Compose */}
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between px-2 pt-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary text-primary-foreground">
              <Mail className="h-4 w-4" />
            </div>
            <span className="font-bold text-sm tracking-tight text-sidebar-foreground">Webmail</span>
          </div>
          <ThemeToggle />
        </div>

        <Button
          type="button"
          onClick={() => setIsComposeOpen(true)}
          className="w-full justify-start gap-2 h-9 text-xs font-semibold shadow-xs"
        >
          <Plus className="h-4 w-4" />
          Compose
        </Button>

        {/* Folder List */}
        <div className="space-y-0.5 pt-2">
          {folders.map((folder) => {
            const isActive = activeFolder.toLowerCase() === folder.path.toLowerCase();
            return (
              <button
                key={folder.id || folder.path}
                type="button"
                onClick={() => handleSelectFolder(folder.path)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-foreground font-semibold shadow-xs'
                    : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className={isActive ? 'text-primary' : 'text-muted-foreground'}>
                    {getFolderIcon(folder.path, folder.specialUse)}
                  </span>
                  <span className="truncate">{folder.name}</span>
                </div>
                {folder.unreadMessages > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                    {folder.unreadMessages}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* User Session Footer */}
      <div className="p-3 border-t border-sidebar-border/80 bg-sidebar/50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 truncate">
            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <User className="h-3.5 w-3.5" />
            </div>
            <div className="truncate text-left">
              <p className="text-xs font-medium text-sidebar-foreground truncate">
                {session?.name || session?.email?.split('@')[0] || 'User'}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">{session?.email}</p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onLogout}
            title="Log out"
            className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
