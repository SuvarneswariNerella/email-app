import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query';
import { ThemeProvider } from './components/theme/theme-provider';
import { MailLayout } from './components/mail/mail';
import { Login } from './components/auth/login';
import { api } from './lib/api';
import { Toaster } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { UserSession } from './types/mail';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30000,
    },
  },
});

function AppContent() {
  const [session, setSession] = useState<UserSession | null>(null);

  const { isLoading, refetch } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      try {
        const s = await api.auth.session();
        setSession(s);
        return s;
      } catch {
        setSession(null);
        return null;
      }
    },
  });

  const loginMutation = useMutation({
    mutationFn: async ({ email, pass }: { email: string; pass: string }) => {
      const s = await api.auth.login(email, pass);
      setSession(s);
      return s;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await api.auth.logout();
      setSession(null);
      queryClient.clear();
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session || !session.isAuthenticated) {
    return (
      <Login
        onLogin={async (email, pass) => {
          await loginMutation.mutateAsync({ email, pass });
        }}
      />
    );
  }

  return <MailLayout session={session} onLogout={() => logoutMutation.mutate()} />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <AppContent />
        <Toaster richColors position="top-right" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
