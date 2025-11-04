'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TAB_ORDER, TabType } from '@/lib/schemas/tabs';

const TAB_LABELS: Record<TabType, string> = {
  overview: 'Overview',
  assumptions: 'Assumptions',
  pnl: 'P&L',
  bs: 'Balance Sheet',
  cf: 'Cash Flow',
  capex: 'CAPEX',
  validation: 'Validation',
};

type TabNavigationProps = {
  versionId: string;
};

export default function TabNavigation({ versionId }: TabNavigationProps) {
  const pathname = usePathname();
  
  // Extract current tab from pathname
  const currentTab = pathname.split('/').pop() || 'overview';
  
  return (
    <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <nav className="flex overflow-x-auto scrollbar-hide">
        <div className="flex space-x-1 min-w-full">
          {TAB_ORDER.map((tab) => {
            const isActive = currentTab === tab || (tab === 'overview' && currentTab === versionId);
            const href = `/versions/${versionId}/${tab}`;
            
            return (
              <Link
                key={tab}
                href={href}
                className={`
                  px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors
                  border-b-2
                  ${
                    isActive
                      ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:border-slate-300 dark:hover:border-slate-600'
                  }
                `}
              >
                {TAB_LABELS[tab]}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

