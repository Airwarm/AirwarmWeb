# Airwarm website change workflow

This repository serves the live Airwarm website. Keep changes small, reviewable and reversible.

## Normal workflow

1. Start from the current `main` branch.
2. Create a short-lived branch named for the change.
3. Make only the files needed for that change.
4. Check customer-facing wording, internal links, mobile layout implications, privacy/legal implications and the Home Energy Assessment if touched.
5. Open a pull request into `main` explaining what changed and why.
6. Review the diff before merging.
7. Merge to `main` only when the change is ready to publish.

Direct commits to `main` are reserved for genuinely trivial corrections where the production risk is negligible.

## Release checks

For customer-journey changes, verify:
- Home Energy Assessment result labels remain GREEN = Likely suitable, BLUE = Needs a closer look, AMBER = Potentially unsuitable.
- AMBER never shows the submission invitation.
- BLUE explains what needs checking and may invite a Desktop Review.
- GREEN may invite a Desktop Review.
- No conventional-cylinder-only assumption is introduced; hot-water storage may include a cylinder or, where appropriate after design, compact thermal storage.
- Installations are described as beginning April 2027 while assessments, Desktop Reviews, surveys and design can happen beforehand.
- Airwarm is not described as holding its own MCS certification while operating through the Ample partnership.
- Finance wording remains generic unless approved wording and regulatory position are confirmed.

For technical changes, verify:
- no framework, package manager or build step is introduced;
- no secrets, internal commercial packs, customer data or working documents are committed;
- canonical URLs, sitemap and robots behaviour remain correct;
- privacy/cookie wording is updated before adding any new tracking, storage or data processor.

## Assessment scoring

The Home Energy Assessment is a screening tool, not an engineering calculation. Physical/property indicators and named practical constraints may affect the outcome. Commercial timing, current heating fuel and general renovation intent do not make the building physically more suitable and therefore do not score.

Any future change to assessment points, thresholds, caps or result behaviour must be called out explicitly in the pull request and tested against representative GREEN, BLUE and AMBER cases.
