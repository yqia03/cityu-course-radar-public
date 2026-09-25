# Third-party material

The MIT license applies to original project code. It does not relicense the official university material, third-party packages, model weights or translation datasets.

## City University of Hong Kong

Course codes, names, credits, teaching units and course descriptions originate from the university's publicly accessible catalogue and linked syllabus PDFs. The project records source URLs and academic year for attribution and verification. No university endorsement or affiliation is claimed. Official material retains its original rights; request advice from the university if redistributing a substantial dataset beyond this student reference use.

## Local machine translation

Chinese translations were generated locally with Argos Translate using the `translate-en_zh-1_9` model, followed by OpenCC traditional-character conversion and an explicit correction dictionary. Model package metadata, download URL, SHA-256 and licence are recorded in `data/translation/provenance.json`. The model package README attributes OPUS-MT and specifies CC BY 4.0. The model weights are not distributed in this repository.

These are adapted translations, not official university translations. The project does not claim that all course titles or summaries were reviewed by a human. Corrections and sampled quality findings remain auditable under `data/translation/`.

## Framework and components

The project uses React, Vinext, Cloudflare tooling, Drizzle, Zod, Radix/Shadcn components and Lucide icons. Their licenses are available in their respective installed packages. The bundled scaffold's build/development integration and UI component files are retained with their original package notices. The lockfile identifies exact dependency versions.

## Design reference

The GitHub mark in `public/github-mark.svg` is from [GitHub Octicons](https://github.com/primer/octicons), distributed under the MIT license in `vendor/octicons.LICENSE`. The mark links to the project repository; no GitHub endorsement is implied.

The broad idea of a student-scored caution list was informed by https://unimelbwall.com/worst-ten . No review content, user identity, logo, image or rating dataset was copied from that site.
