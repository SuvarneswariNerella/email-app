import { Navbar } from './navbar';
import { MailList } from './mail-list';
import { MailDisplay } from './mail-display';
import { EmailComposer } from '../create/email-composer';
import type { UserSession } from '../../types/mail';

interface MailLayoutProps {
  session: UserSession | null;
  onLogout: () => void;
}

export function MailLayout({ session, onLogout }: MailLayoutProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Left Sidebar Pane (Navbar & Folders) */}
      <Navbar session={session} onLogout={onLogout} />

      {/* Center & Right Split Panes */}
      <div className="flex-1 flex overflow-hidden">
        {/* Email List Column (Fixed Width or Scalable) */}
        <div className="w-[380px] max-w-[45vw] h-full shrink-0">
          <MailList />
        </div>

        {/* Selected Email Reader Column */}
        <div className="flex-1 h-full overflow-hidden">
          <MailDisplay />
        </div>
      </div>

      {/* Floating Rich Email Composer */}
      <EmailComposer />
    </div>
  );
}
