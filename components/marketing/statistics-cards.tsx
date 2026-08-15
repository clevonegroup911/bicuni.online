import { BookOpen, Building2, FileCheck2, Users } from "lucide-react";

export function StatisticsCards({
  documents,
  universities,
  authors,
}: {
  documents: number;
  universities: number;
  authors: number;
}) {
  const stats = [
    [BookOpen, String(documents), "Publications indexées"],
    [Building2, String(universities), "Institutions représentées"],
    [Users, String(authors), "Auteurs visibles"],
    [FileCheck2, "Validés", "Seuls les travaux examinés sont affichés"],
  ] as const;
  return (
    <div className="grid4 stats-grid">
      {stats.map(([Icon, value, label]) => (
        <article className="glass card stat-card" key={label}>
          <Icon size={19} />
          <strong>{value}</strong>
          <span>{label}</span>
        </article>
      ))}
    </div>
  );
}
