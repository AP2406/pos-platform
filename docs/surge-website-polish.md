# Surge website design polish

This pass builds on the international website redesign on `codex/surge-international-website`.

- Expanded the product illustration into four accessible tabs: orders, menu builder, floor plan and reports. These contain sample data and clearly identify themselves as illustrative layouts.
- Refined the home hero, feature cards, device frames, resources, form surfaces, FAQs and shared typography/spacing. The palette remains white, charcoal and restrained blue.
- Added native desktop disclosure menus, a grouped mobile navigation, keyboard dismissal, and in-page navigation on solution pages.
- Added a practical three-step pilot setup explanation on home and pricing, related setup resources on solution pages, and article contents/read-time details.
- Preserved international positioning, the free POS pilot, and the coming-soon status of card processing and terminals. No operational POS, authentication, database or payment processing logic was changed.

## Validation

- Production Next.js build and TypeScript passed.
- ESLint passed for all changed TSX files.
- Twenty route/viewport checks passed at 1440 and 390 pixels: home, POS, restaurants, cafes, hardware, payments, pricing, contact, guides and an article.
- No page errors, horizontal overflow, broken loaded images or missing primary headings in those checks.
- Checked desktop disclosures, Escape dismissal, mobile menu, all four product tabs, keyboard tab controls, demo dialog steps and article contents links.
- Inspected desktop hero and product illustrations and the mobile menu-builder layout.

## Publishing status

The GitHub connector rejects repository content writes with `403 Resource not accessible by integration`. The branch is committed locally; a cumulative binary patch is also preserved with the hosted preview source.

The separate Sites preview is a presentation copy of the compiled marketing pages and login, with navigation and demonstration interactions. Forms and authentication are disabled there. Publishing that preview does not update surgetechpos.com or GitHub.
