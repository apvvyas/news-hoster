import { Init1790700000000 } from './1790700000000-Init.js';
import { SeedCategories1790700000001 } from './1790700000001-SeedCategories.js';
import { EditorialFeatures1790800000000 } from './1790800000000-EditorialFeatures.js';

/** Register every migration here (ESM builds can't glob-load them). */
export const MIGRATIONS = [
  Init1790700000000,
  SeedCategories1790700000001,
  EditorialFeatures1790800000000,
];
