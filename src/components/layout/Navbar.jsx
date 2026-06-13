import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Disc3, Home, Search, User, LogOut, Sparkles, Moon, Sun, Radio, BarChart2, Timer, Zap } from 'lucide-react';
import { useSpotify } from '@/context/SpotifyContext';

export default function Navbar({ darkMode, setDarkMode }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [hasProfile, setHasProfile] = useState(false);
  const { connected } = useSpotify();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  // Check for taste profile to show the DNA indicator
  useEffect(() => {
    if (connected) {
      base44.functions.invoke('spotifyAnalyze', { action: 'profile' })
        .then(res => setHasProfile(!!res?.data?.profile))
        .catch(() => {});
    }
  }, [connected]);

  const navLinks = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/discover', icon: Search, label: 'Discover' },
    { to: '/session', icon: Sparkles, label: 'DJ Studio' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Disc3 className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">AuraDJ</span>
        </Link>

        {/* Nav Links */}
        <nav className="hidden sm:flex items-center gap-1">
          {navLinks.map(({ to, icon: Icon, label }) => (
            <Link key={to} to={to}>
              <Button
                variant={location.pathname === to ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-2 text-sm font-medium"
              >
                <Icon className="w-4 h-4" />
                {label}
              </Button>
            </Link>
          ))}

          {/* For You — only show when Spotify connected */}
          {connected && (
            <Link to="/session">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-sm font-medium relative"
              >
                <Zap className="w-4 h-4 text-[#1DB954]" />
                For You
                {hasProfile && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#1DB954] ring-2 ring-background" />
                )}
              </Button>
            </Link>
          )}
        </nav>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Spotify status dot */}
          {connected && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#1DB954] px-2 py-1 rounded-full bg-[#1DB954]/10 border border-[#1DB954]/20">
              <svg viewBox="0 0 24 24" className="w-3 h-3 fill-[#1DB954]" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              Live
            </div>
          )}

          <Button variant="ghost" size="icon" onClick={() => setDarkMode(!darkMode)} aria-label="Toggle theme">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 cursor-pointer relative" aria-label="User menu">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                      {user.full_name?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  {connected && hasProfile && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#1DB954] border-2 border-background" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-2 py-1.5 text-xs text-muted-foreground border-b border-border mb-1">
                  {user.email}
                </div>
                <DropdownMenuItem asChild>
                  <Link to={`/profile/${user.id}`} className="flex items-center gap-2">
                    <User className="w-4 h-4" /> Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/mix-stats" className="flex items-center gap-2">
                    <Timer className="w-4 h-4" /> Mix Performance
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/services" className="flex items-center gap-2">
                    <Radio className="w-4 h-4" /> Connected Services
                    {connected && <span className="ml-auto w-2 h-2 rounded-full bg-[#1DB954]" />}
                  </Link>
                </DropdownMenuItem>
                {user?.role === 'admin' && (
                  <DropdownMenuItem asChild>
                    <Link to="/analytics" className="flex items-center gap-2">
                      <BarChart2 className="w-4 h-4" /> Analytics
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => base44.auth.logout()} className="text-destructive">
                  <LogOut className="w-4 h-4 mr-2" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm" asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Link to="/login">Sign In</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
