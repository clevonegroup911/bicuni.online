import { UserRound } from "lucide-react";
import { safeImageUrl } from "@/lib/profile/contract";

export function ProfileAvatar({
  name,
  image,
  size = 72,
}: {
  name: string;
  image: string | null;
  size?: number;
}) {
  const src = safeImageUrl(image);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

  if (src) {
    return (
      // next/image exigerait d’autoriser tous les hôtes d’avatar utilisateur.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="profile-avatar"
        src={src}
        alt={`Photo de profil de ${name || "l’utilisateur"}`}
        width={size}
        height={size}
      />
    );
  }

  return (
    <span className="profile-avatar-fallback" style={{ width: size, height: size }} aria-hidden="true">
      {initials === "?" ? <UserRound size={Math.round(size * 0.45)} /> : initials}
    </span>
  );
}
