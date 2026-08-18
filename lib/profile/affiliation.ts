import type { AffiliationTaxonomy } from "@/lib/profile/contract";

export function facultiesFor(taxonomy: AffiliationTaxonomy, universityId: string) {
  return taxonomy.universities.find((item) => item.id === universityId)?.faculties ?? [];
}

export function departmentsFor(taxonomy: AffiliationTaxonomy, universityId: string, facultyId: string) {
  return facultiesFor(taxonomy, universityId).find((item) => item.id === facultyId)?.departments ?? [];
}

export function facultyIdForDepartment(taxonomy: AffiliationTaxonomy, universityId: string, departmentId: string) {
  if (!universityId || !departmentId) return "";
  for (const faculty of facultiesFor(taxonomy, universityId)) {
    if (faculty.departments.some((department) => department.id === departmentId)) return faculty.id;
  }
  return "";
}

export function departmentBelongsToUniversity(taxonomy: AffiliationTaxonomy, universityId: string, departmentId: string) {
  return Boolean(facultyIdForDepartment(taxonomy, universityId, departmentId));
}
