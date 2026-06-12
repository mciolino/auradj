import React from 'react';

export default function TopPagesTable({ pages }) {
  if (!pages?.length) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-semibold mb-4">All Top Pages</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="pb-3 font-medium">Page</th>
              <th className="pb-3 font-medium text-right">Views</th>
              <th className="pb-3 font-medium text-right">Sessions</th>
              <th className="pb-3 font-medium text-right">Users</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pages.map((page, i) => (
              <tr key={i} className="hover:bg-secondary/40 transition-colors">
                <td className="py-2.5 pr-4">
                  <p className="font-medium truncate max-w-[280px]">{page.title || page.path}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-[280px]">{page.path}</p>
                </td>
                <td className="py-2.5 text-right tabular-nums">{page.views.toLocaleString()}</td>
                <td className="py-2.5 text-right tabular-nums text-muted-foreground">{page.sessions.toLocaleString()}</td>
                <td className="py-2.5 text-right tabular-nums text-muted-foreground">{page.users.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}