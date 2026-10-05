import { requireHeadings } from "./common.mjs";

export const PROFILE_SECTIONS = [
  "## Brand",
  "## Language",
  "## Audience",
  "## Networks and register",
  "## Call to action",
  "## Handle",
];

export const validateProfile = (text) => requireHeadings(text, PROFILE_SECTIONS);
