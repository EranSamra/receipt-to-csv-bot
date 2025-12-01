import { useState, useEffect } from "react";
import { X, AlertCircle, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trackEvent, Events } from "@/utils/posthogEvents";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const LoginModal = ({ isOpen, onClose, onSuccess }: LoginModalProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(true);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);
  
  const { signIn, signUp, isBusinessEmail } = useAuth();

  // Track modal open
  useEffect(() => {
    if (isOpen) {
      trackEvent(Events.LOGIN_MODAL_OPENED);
    }
  }, [isOpen]);

  const validateEmail = (email: string) => {
    if (!email) {
      setEmailError("");
      return false;
    }

    if (!email.includes("@")) {
      setEmailError("Please enter a valid email address");
      return false;
    }

    if (!isBusinessEmail(email)) {
      setEmailError("Personal email addresses (Gmail, Yahoo, etc.) are not allowed. Please use your business email.");
      return false;
    }

    setEmailError("");
    return true;
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    if (newEmail) {
      validateEmail(newEmail);
    } else {
      setEmailError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validateEmail(email)) {
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    const eventType = isSignUp ? Events.SIGNUP_ATTEMPTED : Events.LOGIN_ATTEMPTED;
    trackEvent(eventType, {
      email_domain: email.split('@')[1],
      is_business_email: isBusinessEmail(email)
    });

    try {
      const { error: authError } = isSignUp 
        ? await signUp(email, password)
        : await signIn(email, password);

      if (authError) {
        const errorEvent = isSignUp ? Events.SIGNUP_FAILED : Events.LOGIN_FAILED;
        trackEvent(errorEvent, {
          error_message: authError.message,
          email_domain: email.split('@')[1]
        });
        
        if (authError.message.includes("Invalid login credentials")) {
          setError("Invalid email or password");
        } else if (authError.message.includes("User already registered")) {
          setError("This email is already registered. Please sign in instead.");
        } else {
          setError(authError.message);
        }
      } else {
        const successEvent = isSignUp ? Events.SIGNUP_SUCCESS : Events.LOGIN_SUCCESS;
        trackEvent(successEvent, {
          email_domain: email.split('@')[1]
        });
        
        if (onSuccess) {
          onSuccess();
        }
        onClose();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('[LoginModal] Authentication error:', err);
      
      trackEvent(Events.LOGIN_FAILED, { 
        error: 'unexpected_error',
        error_message: errorMessage,
        error_type: err instanceof Error ? err.constructor.name : 'unknown'
      });
      
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        setError("Network error. Please check your connection and try again.");
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-background rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative border border-border max-h-[90vh] overflow-y-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 rounded-full p-2"
        >
          <X className="h-5 w-5 sm:h-4 sm:w-4" />
        </Button>

        <h2 className="text-xl sm:text-2xl font-bold mb-2 text-foreground pr-8">
          {isSignUp ? "Create Account" : "Sign In"}
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground mb-2">
          Please use your <strong>business email</strong> to access receipt processing.
        </p>
        <p className="text-xs sm:text-sm text-muted-foreground mb-6">
          Personal email addresses (Gmail, Yahoo, etc.) are not accepted.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Business Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={handleEmailChange}
                className="pl-10"
                required
              />
            </div>
            {emailError && (
              <p className="text-sm text-destructive flex items-start gap-1">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{emailError}</span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                required
                minLength={6}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Minimum 6 characters
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            className="w-full h-12 sm:h-10 text-base sm:text-sm touch-manipulation"
            disabled={loading || !!emailError || !email || !password}
          >
            {loading ? "Processing..." : isSignUp ? "Create Account" : "Sign In"}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
              setEmailError("");
            }}
            className="text-sm sm:text-base text-primary hover:underline py-2 touch-manipulation"
          >
            {isSignUp 
              ? "Already have an account? Sign in" 
              : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
};
