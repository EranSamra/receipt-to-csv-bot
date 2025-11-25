import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut } from "lucide-react";

export const UserMenu = () => {
  const { user, signOut } = useAuth();

  if (!user) return null;

  const initials = user.email?.substring(0, 2).toUpperCase() || 'U';
  const displayEmail = user.email || '';

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-white/10 rounded-full backdrop-blur-sm border border-white/20">
      <Avatar className="h-8 w-8">
        <AvatarFallback className="bg-turquoise-500 text-white text-xs">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{displayEmail}</p>
      </div>
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={signOut}
        className="text-white hover:bg-white/20"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
};

