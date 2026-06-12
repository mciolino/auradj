import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('google_analytics');

    // First, list GA4 properties
    const accountsRes = await fetch(
      'https://analyticsadmin.googleapis.com/v1beta/accountSummaries',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const accountsData = await accountsRes.json();
    console.log('GA accounts response:', JSON.stringify(accountsData).slice(0, 500));

    if (!accountsRes.ok) {
      return Response.json({ error: 'Failed to fetch GA accounts', details: accountsData }, { status: 400 });
    }

    const accounts = accountsData.accountSummaries || [];
    if (accounts.length === 0) {
      return Response.json({ error: 'No Google Analytics accounts found. Please make sure GA4 is set up.' }, { status: 404 });
    }

    // Use the first property found
    const firstAccount = accounts[0];
    const firstProperty = firstAccount.propertySummaries?.[0];
    if (!firstProperty) {
      return Response.json({ error: 'No GA4 properties found in your account.' }, { status: 404 });
    }

    const propertyId = firstProperty.property.replace('properties/', '');
    const propertyName = firstProperty.displayName;

    const { dateRange, propertyIdOverride } = await req.json().catch(() => ({}));
    const finalPropertyId = propertyIdOverride || propertyId;

    const endDate = 'today';
    const startDate = dateRange || '30daysAgo';

    // Fetch page views / sessions / traffic sources in parallel
    const [pageViewsRes, trafficSourcesRes] = await Promise.all([
      fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${finalPropertyId}:runReport`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
          metrics: [{ name: 'screenPageViews' }, { name: 'sessions' }, { name: 'activeUsers' }],
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
          limit: 20,
        })
      }),
      fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${finalPropertyId}:runReport`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'sessionDefaultChannelGroup' }],
          metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        })
      }),
    ]);

    const [pageViewsData, trafficSourcesData] = await Promise.all([
      pageViewsRes.json(),
      trafficSourcesRes.json(),
    ]);

    console.log('Page views response ok:', pageViewsRes.ok);
    console.log('Traffic sources response ok:', trafficSourcesRes.ok);

    // Parse top pages
    const topPages = (pageViewsData.rows || []).map(row => ({
      path: row.dimensionValues[0].value,
      title: row.dimensionValues[1].value,
      views: parseInt(row.metricValues[0].value, 10),
      sessions: parseInt(row.metricValues[1].value, 10),
      users: parseInt(row.metricValues[2].value, 10),
    }));

    // Parse traffic sources
    const trafficSources = (trafficSourcesData.rows || []).map(row => ({
      channel: row.dimensionValues[0].value,
      sessions: parseInt(row.metricValues[0].value, 10),
      users: parseInt(row.metricValues[1].value, 10),
    }));

    // Summary totals
    const totalViews = topPages.reduce((sum, p) => sum + p.views, 0);
    const totalSessions = topPages.reduce((sum, p) => sum + p.sessions, 0);

    return Response.json({
      propertyName,
      propertyId: finalPropertyId,
      accounts: accounts.map(a => ({
        name: a.displayName,
        properties: (a.propertySummaries || []).map(p => ({
          id: p.property.replace('properties/', ''),
          name: p.displayName,
        }))
      })),
      summary: { totalViews, totalSessions },
      topPages,
      trafficSources,
      dateRange: startDate,
    });
  } catch (error) {
    console.error('analyticsData error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});