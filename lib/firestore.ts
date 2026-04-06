import type { DocumentData } from 'firebase-admin/firestore';

function isTimestamp(val: unknown): boolean {
  return (
    typeof val === 'object' &&
    val !== null &&
    'toDate' in val &&
    typeof (val as { toDate: unknown }).toDate === 'function'
  );
}

function serializeValue(val: unknown): unknown {
  if (val === null || val === undefined) return val;
  if (isTimestamp(val)) {
    return (val as { toDate(): Date }).toDate().toISOString();
  }
  if (Array.isArray(val)) return val.map(serializeValue);
  if (typeof val === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      result[k] = serializeValue(v);
    }
    return result;
  }
  return val;
}

/**
 * Convert a Firestore document snapshot into a plain object with the doc ID
 * set as `id` and all Timestamp values converted to ISO strings.
 */
export function serializeDoc(
  id: string,
  data: DocumentData
): Record<string, unknown> {
  const result: Record<string, unknown> = { id };
  for (const [key, val] of Object.entries(data)) {
    result[key] = serializeValue(val);
  }
  return result;
}
