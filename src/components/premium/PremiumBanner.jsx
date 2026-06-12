import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Zap, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const PRICE_ID = 'price_1ThUtgAgVUT8qzAAuIFyRspj';

const FEATURES = [
  'Unlimited AI track generation',
  'Priority AI processing',
  'Advanced genre & mood controls',
  'HD cover art generation',
];

export default function PremiumBanner({ compact = false }) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    // Block checkout inside iframe (preview mode)
    if (window.self !== window.top) {
      alert('Checkout is only available from the published app. Please open the app in a new tab.');
      return;
    }

    setLoading(true);
    const res = await base44.functions.invoke('createCheckout', {
      price_id: PRICE_ID,
      success_url: `${window.location.origin}/?premium=success`,
      cancel_url: `${window.location.origin}/?premium=cancelled`,
    });

    if (res.data?.url) {
      window.location.href = res.data.url;
    } else {
      toast.error('Could not start checkout. Please try again.');
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <div className="rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 to-accent p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold">Go Premium</p>
            <p className="text-xs text-muted-foreground">Unlimited tracks · $9.99/mo</p>
          </div>
        </div>
        <Button size="sm" onClick={handleUpgrade} disabled={loading} className="flex-shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Upgrade
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-accent/50 to-background p-6 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
          <Zap className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="font-bold font-heading text-lg">AuraDJ Premium</h3>
          <p className="text-xs text-muted-foreground">$9.99 / month · Cancel anytime</p>
        </div>
      </div>

      <ul className="space-y-1.5">
        {FEATURES.map(f => (
          <li key={f} className="flex items-center gap-2 text-sm">
            <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            {f}
          </li>
        ))}
      </ul>

      <Button onClick={handleUpgrade} disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
        {loading ? 'Redirecting to checkout…' : 'Upgrade to Premium'}
      </Button>
    </div>
  );
}