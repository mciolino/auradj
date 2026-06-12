import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, Eye, Globe, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StatCard from '@/components/analytics/StatCard';
import TopPagesTable from '@/components/analytics/TopPagesTable';

const DATE_RANGES = [
  { label: 'Last 7 days', value: '7daysAgo' },
  { label: 'Last 30 days', value: '30daysAgo' },
  { label: 'Last 90 days', value: '90daysAgo' },
];

const CHANNEL_COLORS = ['#7c3aed', '#a78bfa', '#c4b5fd', '#6d28d9', '#4c1d95', '#8b5cf6', '#ddd6fe'];

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState('30daysAgo');
  const [selectedProperty, setSelectedProperty] = useState(null);

  const fetchData = async (range, propertyId) => {
    setLoading(true);
    setError(null);
    const res = await base44.functions.invoke('analyticsData', {
      dateRange: range || dateRange,
      propertyIdOverride: propertyId || selectedProperty || undefined,
    });
    if (res.data?.error) {
      setError(res.data.error);
    } else {
      setData(res.data);
      if (!selectedProperty && res.data?.propertyId) {
        setSelectedProperty(res.data.propertyId);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDateChange = (val) => {
    setDateRange(val);
    fetchData(val, selectedProperty);
  };

  const handlePropertyChange = (val) => {
    setSelectedProperty(val);
    fetchData(dateRange, val);
  };

  // Mix pages: filter paths that look like /mix/...
  const mixPages = (data?.topPages || []).filter(p => p.path.includes('/mix/'));

  return (
    <div className="pt-14 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold font-heading">Analytics Dashboard</h1>
            {data?.propertyName && (
              <p className="text-sm text-muted-foreground mt-1">Property: {data.propertyName}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {data?.accounts?.length > 0 && (
              <Select value={selectedProperty || ''} onValueChange={handlePropertyChange}>
                <SelectTrigger className="w-48 text-sm">
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  {data.accounts.flatMap(a => a.properties.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  )))}
                </SelectContent>
              </Select>
            )}
            <Select value={dateRange} onValueChange={handleDateChange}>
              <SelectTrigger className="w-40 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGES.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => fetchData()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {loading && !data && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Could not load analytics</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {data && !error && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard icon={Eye} label="Total Page Views" value={data.summary.totalViews.toLocaleString()} />
              <StatCard icon={Users} label="Total Sessions" value={data.summary.totalSessions.toLocaleString()} />
              <StatCard icon={TrendingUp} label="Top Mix Views" value={mixPages[0]?.views?.toLocaleString() ?? '—'} sub={mixPages[0]?.title?.slice(0, 20)} />
              <StatCard icon={Globe} label="Traffic Channels" value={data.trafficSources.length} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Top Mix Pages */}
              <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5">
                <h2 className="font-semibold mb-4">Top DJ Mix Pages</h2>
                {mixPages.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No mix page data yet — share your mixes to start tracking!</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={mixPages.slice(0, 8)} layout="vertical" margin={{ left: 0, right: 16 }}>
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="title" tick={{ fontSize: 11 }} width={120} />
                      <Tooltip formatter={(val) => [val, 'Views']} />
                      <Bar dataKey="views" fill="hsl(263 70% 55%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Traffic Sources */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="font-semibold mb-4">Traffic Sources</h2>
                {data.trafficSources.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No traffic data yet.</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={data.trafficSources} dataKey="sessions" nameKey="channel" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                          {data.trafficSources.map((_, i) => (
                            <Cell key={i} fill={CHANNEL_COLORS[i % CHANNEL_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(val) => [val, 'Sessions']} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-3 space-y-2">
                      {data.trafficSources.map((src, i) => (
                        <div key={src.channel} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHANNEL_COLORS[i % CHANNEL_COLORS.length] }} />
                            <span className="text-muted-foreground truncate max-w-[120px]">{src.channel}</span>
                          </div>
                          <span className="font-medium tabular-nums">{src.sessions.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* All Top Pages Table */}
            <TopPagesTable pages={data.topPages} />
          </div>
        )}
      </div>
    </div>
  );
}