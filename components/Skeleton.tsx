import { motion } from "framer-motion";

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={`relative overflow-hidden bg-white/[0.03] border border-white/[0.02] rounded-lg ${className}`}>
    <motion.div 
      animate={{ x: ["-100%", "200%"] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
      className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500/10 to-transparent"
    />
  </div>
);

export const ChartSkeleton = () => (
  <div className="w-full space-y-6 p-6">
    <div className="flex items-center justify-between">
      <Skeleton className="h-5 w-1/4 rounded-full" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
    </div>
    <div className="flex items-end gap-3 h-48 px-2">
      <Skeleton className="h-[25%] flex-1 rounded-t-xl" />
      <Skeleton className="h-[65%] flex-1 rounded-t-xl" />
      <Skeleton className="h-[45%] flex-1 rounded-t-xl" />
      <Skeleton className="h-[95%] flex-1 rounded-t-xl" />
      <Skeleton className="h-[55%] flex-1 rounded-t-xl" />
      <Skeleton className="h-[35%] flex-1 rounded-t-xl" />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-24 rounded-2xl" />
    </div>
  </div>
);

export const MessageSkeleton = () => (
  <div className="flex gap-4 w-full max-w-2xl">
    <Skeleton className="w-10 h-10 rounded-2xl shrink-0" />
    <div className="flex-1 space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-[90%] rounded-full" />
        <Skeleton className="h-4 w-[60%] rounded-full" />
      </div>
      <Skeleton className="h-48 w-full rounded-[2rem] mt-6" />
    </div>
  </div>
);
