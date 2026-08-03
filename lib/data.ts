import { BookOpen, BrainCircuit, Building2, FileSearch, GraduationCap, ShieldCheck } from "lucide-react";

export const categories = ["Sciences", "Éditions", "Nouveautés", "Religions", "Auteurs", "Arts", "Musique", "Technologie", "Informatique", "Langues"];
export const documents = [
  { type: "Mémoire", title: "Intelligence artificielle et transformation de l’enseignement supérieur", author: "Amina Kabasele", university: "Université de Kinshasa", year: "2026", category: "Technologie" },
  { type: "Thèse", title: "Résilience climatique dans le bassin du Congo", author: "David Ilunga", university: "Université de Lubumbashi", year: "2025", category: "Sciences" },
  { type: "Article", title: "Patrimoines linguistiques africains à l’ère numérique", author: "Grâce Mbuyi", university: "Université de Kisangani", year: "2026", category: "Langues" },
  { type: "Rapport", title: "Économie circulaire et villes africaines", author: "Samuel Ebonda", university: "UNIKIN", year: "2025", category: "Sciences" },
  { type: "Ouvrage", title: "Introduction aux systèmes distribués", author: "Patrick Mutombo", university: "BICUNI Éditions", year: "2026", category: "Informatique" },
  { type: "Publication", title: "Arts contemporains et mémoire collective", author: "Naomie Banza", university: "Académie des Beaux-Arts", year: "2024", category: "Arts" }
];
export const features = [
  { icon: FileSearch, title: "Recherche académique", text: "Explorez par auteur, université, année, discipline, mot-clé ou type de publication." },
  { icon: BrainCircuit, title: "Intelligence documentaire", text: "Résumé, OCR, bibliographie et recommandations assistés par IA, avec validation humaine." },
  { icon: Building2, title: "Portails institutionnels", text: "Espaces privés, gouvernance multi-admin et archivage massif pour les universités." },
  { icon: ShieldCheck, title: "Préservation sécurisée", text: "Contrôles d’accès, audit, fichiers protégés et infrastructure pensée pour le cloud." },
  { icon: GraduationCap, title: "Profils académiques", text: "Présentez vos travaux, domaines de recherche, affiliations et impact scientifique." },
  { icon: BookOpen, title: "Publication valorisée", text: "Workflow éditorial, métadonnées riches, indexation et suivi des consultations." }
];
