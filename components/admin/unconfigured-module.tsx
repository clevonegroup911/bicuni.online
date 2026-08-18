import { Construction } from "lucide-react";

export function UnconfiguredModule({
  title,
  description,
  contract,
}: {
  title: string;
  description: string;
  contract: readonly string[];
}) {
  return (
    <section className="glass card admin-preparation">
      <Construction size={28} color="#718cff" aria-hidden="true" />
      <h2>{title}</h2>
      <p>{description}</p>
      <p className="muted">Cet écran n’est pas opérationnel. Aucune donnée fictive n’est affichée.</p>
      <ul className="contract-list">
        {contract.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}
