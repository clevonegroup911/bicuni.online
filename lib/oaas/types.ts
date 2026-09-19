export type PlanTaskSpec = {
  key: string;
  title: string;
  description?: string;
  dependsOn: string[];
  agentKey: string;
  parallelGroup?: string;
  requiresHuman?: boolean;
};
