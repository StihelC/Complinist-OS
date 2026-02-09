/**
 * Error Stats Cards
 *
 * Displays key error metrics in card format.
 */

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertCircle,
  AlertTriangle,
  XCircle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils/utils';
import type { ErrorStats } from '@/core/stores/useErrorDashboardStore';

interface ErrorStatsCardsProps {
  stats: ErrorStats | null;
  isLoading: boolean;
}

export function ErrorStatsCards({ stats, isLoading }: ErrorStatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const criticalCount = stats?.bySeverity?.critical || 0;
  const errorCount = stats?.bySeverity?.error || 0;
  const warningCount = stats?.bySeverity?.warning || 0;

  const cards = [
    {
      title: 'Total Errors',
      value: stats?.total || 0,
      icon: AlertCircle,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
      description: `${stats?.lastHourCount || 0} in last hour`,
      trend: stats?.lastHourCount && stats?.lastDayCount
        ? ((stats.lastHourCount / (stats.lastDayCount / 24)) * 100 - 100).toFixed(0)
        : null,
    },
    {
      title: 'Critical',
      value: criticalCount,
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      description: 'Requires immediate attention',
    },
    {
      title: 'Errors',
      value: errorCount,
      icon: AlertTriangle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      description: 'Application errors',
    },
    {
      title: 'Warnings',
      value: warningCount,
      icon: AlertTriangle,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
      description: 'Non-critical issues',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const trendValue = card.trend ? parseFloat(card.trend) : null;

        return (
          <Card key={card.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">{card.title}</span>
                <div className={cn("p-2 rounded-lg", card.bgColor)}>
                  <Icon className={cn("w-5 h-5", card.color)} />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {card.value.toLocaleString()}
                  </span>
                  {trendValue !== null && trendValue !== 0 && (
                    <div className={cn(
                      "flex items-center text-sm font-medium",
                      trendValue > 0 ? "text-red-600" : "text-green-600"
                    )}>
                      {trendValue > 0 ? (
                        <TrendingUp className="w-4 h-4 mr-1" />
                      ) : (
                        <TrendingDown className="w-4 h-4 mr-1" />
                      )}
                      {Math.abs(trendValue)}%
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">{card.description}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
