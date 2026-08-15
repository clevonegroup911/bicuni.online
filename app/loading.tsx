import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="shell page-loading" aria-busy="true" aria-label="Chargement">
      <div className="page-hero">
        <Skeleton height={16} />
        <Skeleton height={72} />
        <Skeleton height={24} />
      </div>
      <div className="grid3">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="glass card page-loading-card" key={index}>
            <Skeleton height={18} />
            <Skeleton height={34} />
            <Skeleton height={80} />
            <Skeleton height={20} />
          </div>
        ))}
      </div>
    </main>
  );
}
