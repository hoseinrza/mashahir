import React from 'react';
import { Link } from 'react-router-dom';
import { Construction, ArrowLeft } from 'lucide-react';
import { Card, Button } from './index';

/**
 * Honest placeholder for a screen whose module has no backend yet.
 * The old demo data was fabricated; until the API exists this page says so
 * instead of inventing numbers.
 */
export const ModulePending: React.FC<{
  title: string;
  description: string;
  pending: string[];
  backTo?: { href: string; label: string };
}> = ({ title, description, pending, backTo }) => (
  <div className="space-y-6">
    <Card className="text-right border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
          <Construction size={20} />
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB]">{title}</h3>
          <p className="text-xs text-[#526176] dark:text-[#B3C0D2] leading-relaxed">{description}</p>

          {pending.length > 0 && (
            <div>
              <span className="text-[11px] font-bold text-[#526176] dark:text-[#B3C0D2] block mb-1">
                برای راه‌اندازی این بخش لازم است:
              </span>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-[#526176] dark:text-[#B3C0D2] pr-2">
                {pending.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          )}

          {backTo && (
            <Link to={backTo.href} className="inline-block">
              <Button variant="outline" size="sm" icon={<ArrowLeft size={13} />}>
                {backTo.label}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </Card>
  </div>
);
