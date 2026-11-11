import { findText } from '../tags.ts';
import type { Finding, Tags } from '../types.ts';

const AI_SOURCE_TYPE = /trainedAlgorithmicMedia/i;
const AI_TOOL = /midjourney|dall[-·. ]?e|stable[ -]?diffusion|comfyui|automatic1111|adobe firefly|openai|chatgpt|google ai|imagen|sora\b|runway/i;
const AI_TOOL_TAGS = ['Software', 'CreatorTool', 'Credit', 'ClaimGenerator', 'HistorySoftwareAgent'];
const GENERATOR_CHUNKS = ['PNG:Parameters', 'PNG:Prompt', 'PNG:Workflow', 'PNG:Sd-metadata', 'PNG:Dream'];
const CONTENT_CREDENTIALS = /^JUMBF:|c2pa|:ClaimGenerator$/i;

function sourceTypeFindings(tags: Tags): Finding[] {
  const sourceType = findText(tags, 'DigitalSourceType');
  if (!sourceType || !AI_SOURCE_TYPE.test(sourceType)) return [];
  return [{ severity: 'warn', area: 'provenance', message: `metadata declares AI-generated media: ${sourceType}` }];
}

function toolFindings(tags: Tags): Finding[] {
  return AI_TOOL_TAGS.flatMap((name): Finding[] => {
    const value = findText(tags, name);
    if (!value || !AI_TOOL.test(value)) return [];
    return [{ severity: 'warn', area: 'provenance', message: `AI tool named in ${name}: ${value}` }];
  });
}

function generatorChunkFindings(tags: Tags): Finding[] {
  const found = GENERATOR_CHUNKS.filter((key) => tags[key] !== undefined);
  if (found.length === 0) return [];
  return [{ severity: 'warn', area: 'provenance', message: `image generator settings embedded: ${found.join(', ')}` }];
}

function credentialFindings(tags: Tags): Finding[] {
  if (!Object.keys(tags).some((key) => CONTENT_CREDENTIALS.test(key))) return [];
  return [{
    severity: 'info',
    area: 'provenance',
    message: 'contains C2PA content credentials (present, but the signature is not validated by this tool)',
  }];
}

export function provenanceFindings(tags: Tags): Finding[] {
  return [...sourceTypeFindings(tags), ...toolFindings(tags), ...generatorChunkFindings(tags), ...credentialFindings(tags)];
}
