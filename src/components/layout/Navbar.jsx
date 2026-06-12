import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Sparkles, Search, User, LogOut, Radio, BarChart2, Timer, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Navbar() {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const NAV = [
    { to: '/', label: 'Home' },
    { to: '/discover', label: 'Discover' },
    { to: '/session', label: 'DJ Studio' },
  ];

  const isActive = (to) => to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  return (
    <>
      <header className={cn(
        'fixed top-0 left-0 right-0 z-20 transition-all duration-200',
        scrolled
          ? 'bg-background/95 backdrop-blur-md border-b border-border'
          : 'bg-background border-b border-border'
      )}>
        <div className="max-w-screen-2xl mx-auto px-6 sm:px-10 h-14 flex items-center justify-between">

          {/* Logo — wordmark only, no icon */}
          <Link to="/" className="flex items-center gap-0">
            <span className="font-heading font-black text-xl uppercase tracking-[-0.04em] leading-none">
              Aura<span className="text-primary">DJ</span>
            </span>
          </Link>

          {/* Desktop nav — clean text links */}
          <nav className="hidden sm:flex items-center gap-8">
            {NAV.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  'font-mono text-xs uppercase tracking-[0.15em] transition-colors duration-150',
                  isActive(to)
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {/* Start session CTA */}
            <Link to="/session" className="hidden sm:flex">
              <button className="btn-sharp-lime flex items-center gap-1.5 py-2 px-4">
                <Sparkles className="w-3 h-3" />
                <span className="text-[11px]">Generate</span>
              </button>
            </Link>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-8 h-8 rounded-none bg-secondary border border-border flex items-center justify-center hover:border-primary hover:text-primary transition-colors text-sm font-bold font-heading uppercase">
                    {user.full_name?.[0]?.toUpperCase() || 'U'}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-none border-border bg-card">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Signed in as</p>
                    <p className="text-sm font-semibold truncate mt-0.5">{user.full_name}</p>
                  </div>
                  <DropdownMenuItem asChild>
                    <Link to={`/profile/${user.id}`} className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
                      <User className="w-3.5 h-3.5" /> Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/dev/${user.id}`} className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
                      <span className="text-primary text-[10px]">{'</>'}</span> Dev Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/mix-stats" className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
                      <Timer className="w-3.5 h-3.5" /> Mix Stats
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/services" className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
                      <Radio className="w-3.5 h-3.5" /> Services
                    </Link>
                  </DropdownMenuItem>
                  {user?.role === 'admin' && (
                    <DropdownMenuItem asChild>
                      <Link to="/analytics" className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
                        <BarChart2 className="w-3.5 h-3.5" /> Analytics
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => base44.auth.logout()}
                    className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-destructive focus:text-destructive"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link to="/login">
                <button className="btn-sharp py-2 px-4 text-[11px]">Sign In</button>
              </Link>
            )}

            {/* Mobile hamburger */}
            <button
              className="sm:hidden w-8 h-8 flex items-center justify-center border border-border hover:border-primary hover:text-primary transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="sm:hidden border-t border-border bg-background">
            {NAV.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  'block px-6 py-4 font-mono text-xs uppercase tracking-[0.2em] border-b border-border',
                  isActive(to) ? 'text-primary bg-primary/5' : 'text-muted-foreground'
                )}
              >
                {label}
              </Link>
            ))}
            <div className="px-6 py-4">
              <Link to="/session">
                <button className="btn-sharp-lime w-full text-center">Generate Music</button>
              </Link>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
