import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ServiceCard({ service, isConnected, onConnect, onDisconnect }) {
  return (
    <div className={cn(
      'rounded-xl border p-4 flex flex-col gap-3 transition-all duration-200',
      isConnected ? 'border-primary/30 bg-accent/30' : 'border-border bg-card hover:border-border/80',
      service.comingSoon && 'opacity-60'
    )}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-white flex items-center justify-center shadow-sm border border-border/40">
          <img src={service.logo} alt={service.name} className="w-7 h-7 object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">{service.name}</h3>
            {service.comingSoon && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Soon</span>
            )}
            {isConnected && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Connected
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{service.description}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {service.features.map(f => (
          <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground flex items-center gap-1">
            <Zap className="w-2.5 h-2.5" style={{ color: service.color }} />
            {f}
          </span>
        ))}
      </div>

      <div className="flex gap-2 mt-auto">
        {isConnected ? (
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={onDisconnect}>
            Disconnect
          </Button>
        ) : (
          <Button
            size="sm"
            className="w-full text-xs text-white"
            style={{ backgroundColor: service.color }}
            onClick={onConnect}
            disabled={service.comingSoon}
          >
            {service.comingSoon ? 'Coming Soon' : `Connect ${service.name}`}
          </Button>
        )}
      </div>
    </div>
  );
}