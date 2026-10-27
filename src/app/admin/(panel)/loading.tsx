import { LoadingLabel } from "@/components/ui/skeletons";

export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <LoadingLabel />
      <div className="h-10 w-64 animate-pulse rounded-xl bg-white" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-[var(--radius-card)] bg-white" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-[var(--radius-card)] bg-white" />
    </div>
  );
}
