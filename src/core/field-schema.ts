// Field schema recorder (M1 spike).
//
// Walks every decoded SDK message and remembers which fields exist, what type
// they are, an example value and how long arrays are. The result answers
// "what does the SDK really send on this PC?" without storing whole messages.
// Pure: no file or SDK access, so it is unit-tested.

export interface FieldInfo {
  /** e.g. "face.blinking[].detected" */
  path: string;
  /** JS types seen at this path: number, boolean, string, object, array, null */
  types: string[];
  /** How many times the field was seen with a value. */
  count: number;
  /** First value seen (primitives only; objects/arrays are summarised). */
  example?: unknown;
  /** For numbers: smallest and largest seen. */
  min?: number;
  max?: number;
  /** For arrays: shortest and longest length seen. */
  minLength?: number;
  maxLength?: number;
  /** For strings: distinct values (capped), e.g. expression names. */
  values?: string[];
}

export type FieldSchema = Map<string, FieldInfo>;

const MAX_STRING_VALUES = 20;
/** Arrays longer than this are sampled (first few + last) to keep it fast. */
const MAX_ITEMS_WALKED = 8;

export function createSchema(): FieldSchema {
  return new Map();
}

function typeOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function touch(schema: FieldSchema, path: string, value: unknown): FieldInfo {
  let info = schema.get(path);
  if (!info) {
    info = { path, types: [], count: 0 };
    schema.set(path, info);
  }
  const t = typeOf(value);
  if (!info.types.includes(t)) info.types.push(t);
  info.count += 1;
  return info;
}

/** Record one decoded message (a plain object) into the schema. */
export function recordMessage(schema: FieldSchema, msg: unknown, path = ''): void {
  if (msg === undefined) return;
  if (path !== '') {
    const info = touch(schema, path, msg);
    if (typeof msg === 'number' && Number.isFinite(msg)) {
      if (info.example === undefined) info.example = msg;
      info.min = info.min === undefined ? msg : Math.min(info.min, msg);
      info.max = info.max === undefined ? msg : Math.max(info.max, msg);
    } else if (typeof msg === 'boolean') {
      if (info.example === undefined) info.example = msg;
    } else if (typeof msg === 'string') {
      if (info.example === undefined) info.example = msg;
      info.values ??= [];
      if (info.values.length < MAX_STRING_VALUES && !info.values.includes(msg)) info.values.push(msg);
    } else if (Array.isArray(msg)) {
      info.minLength = info.minLength === undefined ? msg.length : Math.min(info.minLength, msg.length);
      info.maxLength = info.maxLength === undefined ? msg.length : Math.max(info.maxLength, msg.length);
    }
  }
  if (Array.isArray(msg)) {
    const items =
      msg.length <= MAX_ITEMS_WALKED ? msg : [...msg.slice(0, MAX_ITEMS_WALKED - 1), msg[msg.length - 1]];
    for (const item of items) recordMessage(schema, item, `${path}[]`);
  } else if (msg !== null && typeof msg === 'object') {
    for (const [key, value] of Object.entries(msg as Record<string, unknown>)) {
      recordMessage(schema, value, path === '' ? key : `${path}.${key}`);
    }
  }
}

/** Sorted list for writing to a report. */
export function schemaToList(schema: FieldSchema): FieldInfo[] {
  return [...schema.values()].sort((a, b) => a.path.localeCompare(b.path));
}

/** Copy of a message with long arrays cut down, for a small readable sample. */
export function truncateArrays(msg: unknown, keep = 3): unknown {
  if (Array.isArray(msg)) {
    const head = msg.slice(0, keep).map((m) => truncateArrays(m, keep));
    return msg.length > keep ? [...head, `… ${msg.length - keep} more`] : head;
  }
  if (msg !== null && typeof msg === 'object') {
    return Object.fromEntries(
      Object.entries(msg as Record<string, unknown>).map(([k, v]) => [k, truncateArrays(v, keep)]),
    );
  }
  return msg;
}
