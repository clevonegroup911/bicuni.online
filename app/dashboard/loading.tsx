import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="page-loading" aria-busy="true" aria-label="Chargement de l’espace">
      <div className="dashboard-header">
        <div className="dashboard-loading-intro">
          <Skeleton height={16} />
          <Skeleton height={48} />
          <Skeleton height={20} />
        </div>
      </div>
      <div className="dashboard-stats">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="glass card dashboard-stat" key={index}>
            <Skeleton height={88} />
          </div>
        ))}
      </div>
    </div>
  );
}
