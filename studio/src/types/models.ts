export interface ModelOption {
  id: string;
  name: string;
  badge: string;
  description: string;
  provider: string;
  isFree?: boolean;
  isCustom?: boolean;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'gemini-3.8-flash-high',
    name: 'Gemini 3.8 Flash (High)',
    badge: 'High',
    description: 'Default model • Deep reasoning and cinematic motion scene programming',
    provider: 'Google',
  },
  {
    id: 'gemini-3.8-flash-medium',
    name: 'Gemini 3.8 Flash (Medium)',
    badge: 'Medium',
    description: 'Balanced quota consumption and solid speed for standard edits',
    provider: 'Google',
  },
  {
    id: 'gemini-3.8-flash-low',
    name: 'Gemini 3.8 Flash (Low)',
    badge: 'Fast',
    description: 'Ultra fast response and minimal quota usage for light edits',
    provider: 'Google',
  },
];
