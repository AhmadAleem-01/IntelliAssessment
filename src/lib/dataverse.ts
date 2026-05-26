/**
 * Read the human-readable display value for a Dataverse lookup field.
 *
 * The Power Apps SDK requests `odata.include-annotations=*` so Dataverse returns
 * formatted display names for lookups, but it does NOT flatten the annotation
 * onto the typed field (e.g. `owneridname`). Instead the value lives on the raw
 * OData key `_<fieldName>_value@OData.Community.Display.V1.FormattedValue`.
 *
 * Example:
 *   lookupName(project, 'ownerid')    // → "Ahmad Aleem"
 *   lookupName(project, 'createdby')  // → "Ahmad Aleem"
 *   lookupName(instance, 'dnx_project') // → "Q2 Skill Assessments"
 */
export function lookupName(
  record: object | null | undefined,
  fieldName: string,
): string | undefined {
  if (!record) return undefined;
  const key = `_${fieldName}_value@OData.Community.Display.V1.FormattedValue`;
  const value = (record as Record<string, unknown>)[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Read the underlying GUID for a Dataverse lookup field.
 *
 *   lookupId(project, 'ownerid') // → "01e47fe3-aecd-ef11-b8e8-7c1e522b249e"
 */
export function lookupId(
  record: object | null | undefined,
  fieldName: string,
): string | undefined {
  if (!record) return undefined;
  const value = (record as Record<string, unknown>)[`_${fieldName}_value`];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
