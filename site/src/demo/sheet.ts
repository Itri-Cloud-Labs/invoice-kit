import type { DocumentColors, PdfSpacingOptions } from "@kit/core/types";

// Measurements for the browser stand-in of packages/typescript/src/renderers/pdf.ts
// (components/Sheet.tsx). One CSS pixel is one PDF point; every default below is
// copied from that renderer.

export const PAGE = { width: 595.28, height: 841.89, margin: 48, headerTop: 42 };

export const DEFAULT_COLORS: Required<DocumentColors> = {
  primary: "#173d73",
  onPrimary: "#ffffff",
  text: "#111827",
  metaText: "#4b5563",
  mutedText: "#6b7280",
  border: "#d1d5db",
  footerText: "#9ca3af"
};

export const spacingDefaults = (quantityOnly: boolean): Required<PdfSpacingOptions> => ({
  issuerNameToDetails: 10,
  titleToMetadata: 10,
  metadataRowGap: 7,
  headerToParties: quantityOnly ? 34 : 30,
  partyLabelToDetails: 22,
  partiesToTable: 24,
  headerToTable: quantityOnly ? 24 : 20,
  tableToSummary: 20,
  bankLabelToDetails: 18,
  bankToNotes: 16,
  notesLabelToDetails: 18,
  detailLineGap: 2,
  tableHeaderHeight: 28,
  tableRowMinHeight: 30,
  tableRowVerticalPadding: 16,
  tableTextTopPadding: 9,
  summaryRowHeight: 26,
  summaryBottomGap: 16
});
