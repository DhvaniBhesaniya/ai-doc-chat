import React from "react";
import { useCurrentUser, useLogout } from "@/hooks/useAuth.js";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "wouter";

export default function UserMenu() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();

  if (!user) {
    return (
      <div className="flex items-center space-x-2">
        <Link href="/auth"><Button variant="secondary" size="sm" className="rounded-full">Login</Button></Link>
        <Link href="/auth"><Button size="sm" className="rounded-full">Register</Button></Link>
      </div>
    );
  }

  const initials = (user.name || user.email || "U").trim().slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-9 h-9 rounded-full ai-gradient text-white flex items-center justify-center shadow focus:outline-none">
          <span className="text-xs font-semibold">{initials}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full ai-gradient text-white flex items-center justify-center text-xs font-semibold">{initials}</div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{user.name || 'User'}</div>
              <div className="text-xs text-muted-foreground truncate">{user.email}</div>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>Settings</DropdownMenuItem>
        <DropdownMenuItem disabled>Profile</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => logout.mutate()} className="text-destructive">Logout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 