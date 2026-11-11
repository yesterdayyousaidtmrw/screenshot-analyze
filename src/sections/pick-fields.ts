import { findText } from '../tags.ts';
import type { Field, Section, Tags } from '../types.ts';

const EMPTY_VALUE = /^(|n\/a|unknown( \(.*\))?|undef(ined)?|\(none\))$/i;

export interface FieldSpec {
  label: string;
  /** "Group:Name" matches exactly; a bare name matches any group. */
  tags: string[];
  format?: (value: string) => string;
}

export interface SectionSpec {
  id: string;
  title: string;
  fields: FieldSpec[];
}

function readTag(tags: Tags, name: string): string | null {
  const text = name.includes(':') ? (tags[name] === undefined ? null : String(tags[name])) : findText(tags, name);
  return text === null || EMPTY_VALUE.test(text.trim()) ? null : text;
}

function pickField(tags: Tags, spec: FieldSpec): Field | null {
  for (const name of spec.tags) {
    const value = readTag(tags, name);
    if (value !== null) return { label: spec.label, value: spec.format ? spec.format(value) : value };
  }
  return null;
}

export function pickSection(tags: Tags, spec: SectionSpec): Section | null {
  const fields = spec.fields.flatMap((field) => pickField(tags, field) ?? []);
  return fields.length === 0 ? null : { id: spec.id, title: spec.title, fields };
}
