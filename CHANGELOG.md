# Changelog

All notable changes to this project will be documented in this file.

## 0.1.14

- Use a vendored, self-contained PDFKit runtime with embedded built-in font metrics so ESM server bundles do not depend on CommonJS `__dirname` or PDFKit asset files
- Embed the DejaVu Sans Arabic fallback fonts as runtime bytes so PDF generation does not depend on resolving font files from `node_modules`
- Accept custom PDF fonts as filesystem paths, `Uint8Array` values, or `ArrayBuffer` values

## 0.1.13

- Add Moroccan-style `Bon de retour` support with its own factory, localized title, and quantity-only PDF rendering
- Treat return notes like delivery notes for validation and totals by omitting financial output and normalizing pricing to zero

## 0.1.12

- Fix wrapped issuer names so header details start below the rendered issuer title without overlapping

## 0.1.11

- Add remote logo conversion for SVG and WEBP sources so `issuer.logo` is no longer limited to PNG and JPEG
- Bundle an Arabic-capable DejaVu Sans fallback so Arabic PDFs render without requiring user-supplied font files

## 0.1.10

- Add broader automated behavior tests for delivery-note normalization, sparse documents, bank-field validation, and remote logo format failures
- Harden string validation so missing required string fields now raise library errors instead of raw runtime `TypeError`s

## 0.1.9

- Add automated unit tests for totals, validation, sparse documents, delivery note normalization, and pagination
- Add multi-page item table rendering with repeated table headers on new pages
- Extract shared PDF renderer helpers and add automatic fallback discovery for common Arabic system fonts

## 0.1.8

- Add optional document color customization with named palette slots for accents, text, borders, and footer text
- Validate color overrides as hex values and document the new `colors` module in the README

## 0.1.7

- Add a small overall spacing increase across document metadata, party sections, and trailing notes areas
- Keep delivery notes roomier while also giving invoices, quotes, and purchase orders more breathing room

## 0.1.6

- Increase delivery note header, party section, and table spacing for a roomier layout
- Slightly enlarge delivery note logo fit while keeping financial documents compact

## 0.1.1

- Improve PDF pagination to avoid wasteful extra pages in common document layouts
- Update publish automation to skip cleanly when npm auth is not configured

## 0.1.0

- Initial release of `@ic-labs/invoice-kit`
- Support for invoices, quotes, purchase orders, and delivery notes
- Moroccan business fields and VAT defaults
- PDF rendering with remote logo URL support for PNG/JPEG
- French and Arabic labels
