import { Skeleton } from '../ui/skeleton';

export function MailListSkeleton() {
  return (
    <div className="p-3 space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="p-3 rounded-lg border border-border/40 space-y-2 bg-card/40">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}

export function MailDisplaySkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="h-6 w-2/3" />
      <div className="space-y-2 pt-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}
