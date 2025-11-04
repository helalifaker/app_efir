// lib/breadcrumbs.tsx
// Breadcrumb navigation component

'use client';

import React from 'react';
import Link from 'next/link';

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
};

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400 mb-4">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        
        return (
          <React.Fragment key={index}>
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-slate-900 dark:text-white font-medium' : ''}>
                {item.label}
              </span>
            )}
            {!isLast && (
              <span className="text-slate-400">/</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

