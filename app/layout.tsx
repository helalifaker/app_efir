// app/layout.tsx
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './providers/AuthProvider';
import Navigation from './components/Navigation';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <AuthProvider>
          <Navigation />
          <main className="min-h-[calc(100vh-4rem)]">
            {children}
          </main>
          <Toaster 
            position="top-right" 
            toastOptions={{ 
              duration: 3000,
              style: {
                background: 'var(--card)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
              },
            }} 
          />
        </AuthProvider>
      </body>
    </html>
  );
}
