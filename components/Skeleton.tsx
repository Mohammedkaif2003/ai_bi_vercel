import { motion } from "framer-motion";

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={`bg-white/5 animate-pulse rounded-lg ${className}`} />
);

export const ChartSkeleton = () => (
  <div className="w-full space-y-4 p-4">
    <div className="flex items-center justify-between">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-6 w-1/4" />
    </div>
    <div className="flex items-end gap-2 h-48">
      <Skeleton className="h-[20%] flex-1" />
      <Skeleton className="h-[60%] flex-1" />
      <Skeleton className="h-[40%] flex-1" />
      <Skeleton className="h-[90%] flex-1" />
      <Skeleton className="h-[50%] flex-1" />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
    </div>
  </div>
);

export const MessageSkeleton = () => (
  <div className="flex gap-3 max-w-[85%]">
    <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
    <div className="flex-1 space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-32 w-full rounded-xl mt-4" />
    </div>
  </div>
);
