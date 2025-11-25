import { createContext, useContext, useEffect, useState } from 'react';

interface User {
  name?: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  sessionToken: string | null;
  loading: boolean;
  signIn: () => void;
  signOut: () => void;
  isBusinessEmail: (email: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session in localStorage
    const storedUser = localStorage.getItem('descope_user');
    const storedToken = localStorage.getItem('descope_session_token');
    
    if (storedUser && storedToken) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setSessionToken(storedToken);
        console.log('[AuthContext] Restored session from localStorage:', parsedUser.email);
      } catch (e) {
        console.error('[AuthContext] Error parsing stored user:', e);
        // Clear corrupted data
        localStorage.removeItem('descope_user');
        localStorage.removeItem('descope_session_token');
      }
    } else {
      console.log('[AuthContext] No stored session found');
    }
    
    setLoading(false);

    // Listen for Descope events
    const handleDescopeSuccess = (e: CustomEvent) => {
      const userData = e.detail.user;
      const token = e.detail.sessionJwt;
      
      console.log('[AuthContext] Descope success:', userData);
      
      const userObj = {
        name: userData.name,
        email: userData.email
      };
      
      setUser(userObj);
      setSessionToken(token);
      
      // Store in localStorage
      localStorage.setItem('descope_user', JSON.stringify(userObj));
      localStorage.setItem('descope_session_token', token);
    };

    const handleDescopeError = (err: CustomEvent) => {
      console.error('[AuthContext] Descope error:', err);
    };

    // Listen on document for Descope events (bubbles from web component)
    document.addEventListener('success', handleDescopeSuccess as EventListener, true);
    document.addEventListener('error', handleDescopeError as EventListener, true);

    // Also listen on any existing descope-wc elements
    const checkForWCElement = () => {
      const wcElements = document.getElementsByTagName('descope-wc');
      for (let i = 0; i < wcElements.length; i++) {
        const wcElement = wcElements[i];
        wcElement.addEventListener('success', handleDescopeSuccess as EventListener);
        wcElement.addEventListener('error', handleDescopeError as EventListener);
      }
    };

    // Check immediately and also periodically (in case component loads later)
    checkForWCElement();
    const intervalId = setInterval(checkForWCElement, 500);
    const timeoutId = setTimeout(() => clearInterval(intervalId), 10000); // Stop after 10s

    return () => {
      document.removeEventListener('success', handleDescopeSuccess as EventListener, true);
      document.removeEventListener('error', handleDescopeError as EventListener, true);
      clearInterval(intervalId);
      clearTimeout(timeoutId);
      
      const wcElements = document.getElementsByTagName('descope-wc');
      for (let i = 0; i < wcElements.length; i++) {
        const wcElement = wcElements[i];
        wcElement.removeEventListener('success', handleDescopeSuccess as EventListener);
        wcElement.removeEventListener('error', handleDescopeError as EventListener);
      }
    };
  }, []);

  const signIn = () => {
    // Trigger Descope web component
    const wcElement = document.getElementsByTagName('descope-wc')[0];
    if (wcElement) {
      (wcElement as any).start();
    }
  };

  const signOut = () => {
    setUser(null);
    setSessionToken(null);
    localStorage.removeItem('descope_user');
    localStorage.removeItem('descope_session_token');
    
    // Trigger Descope logout
    const wcElement = document.getElementsByTagName('descope-wc')[0];
    if (wcElement) {
      (wcElement as any).logout();
    }
  };

  const isBusinessEmail = (email: string): boolean => {
    const blockedDomains = [
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
      'icloud.com', 'aol.com', 'mail.com', 'protonmail.com',
      'yandex.com', 'zoho.com', 'gmx.com', 'live.com', 'msn.com'
    ];
    const match = String(email || '').toLowerCase().match(/@([^@]+)$/);
    return match ? !blockedDomains.includes(match[1]) : false;
  };

  return (
    <AuthContext.Provider value={{ user, sessionToken, loading, signIn, signOut, isBusinessEmail }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

