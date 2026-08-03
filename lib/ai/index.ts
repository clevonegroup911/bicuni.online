export type AcademicAnalysis = { summary: string; keywords: string[]; citations?: string[] };
export interface AcademicAiProvider {
  summarize(text: string, locale: string): Promise<AcademicAnalysis>;
  extractText(objectKey: string): Promise<string>;
}
export const AI_NOTICE = "Les productions IA sont indicatives et doivent être validées par un humain avant publication.";
