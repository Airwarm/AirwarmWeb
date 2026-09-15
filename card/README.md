# Airwarm contact card (NFC endpoint)

## The rule this directory exists to protect

**`https://airwarm.co.uk/contact/Airwarm.vcf` is the permanent NFC destination.**
Tom's action plan of 15 September 2026 fixed that exact URL, capital A
included — GitHub Pages is case-sensitive, so `airwarm.vcf` there would 404.

Once a card is programmed and handed to somebody, its destination can never be
changed. Moving or renaming that file, or deleting it, silently breaks every
card already in circulation — the person taps it and gets a 404, and there is
no way to reach them to apologise.

The same file is also published at the earlier location, and both must keep
working:

- `/contact/Airwarm.vcf` — the contact file; **programme this one**
- `/card/airwarm.vcf` — the September 2026 location, kept so nothing that
  already points at it breaks
- `/card/` — the human-readable landing page

If the site is restructured later, redirect these to wherever things move. Do
not delete them.

## What to programme into the NFC cards

    https://airwarm.co.uk/contact/Airwarm.vcf

It points straight at the contact file, so a tap goes directly to "Add contact"
on both iPhone and Android without an intermediate page. GitHub Pages serves it
as `text/x-vcard`.

**Do not programme the batch until the live URL has been tested on an iPhone and
an Android phone** and both offer to add Airwarm with the name, telephone,
e-mail, website, note and Hero Mark filled in.

## Regenerating the card

The file is **generated, not hand-edited**. It carries the Hero Mark as an
embedded base64 PNG, which is why it is 120 KB of mostly unreadable text.

The script writes the same bytes to both `contact/Airwarm.vcf` and
`card/airwarm.vcf`, so they cannot drift apart. To change the details or the
photo, edit `make-vcard.py` and re-run it:

    python3 card/make-vcard.py

It needs `cairosvg` to rasterise the mark. With `uv` installed:

    uv run --with cairosvg python3 card/make-vcard.py

### Why the photo is embedded rather than linked

A vCard can reference a photo by URL, but contacts apps fetch it inconsistently
and iOS frequently ignores it. Embedding means the mark is saved into the
contact at the moment it is added, and keeps working offline afterwards.

### Why PNG rather than the SVG

Contacts apps on iOS and Android do not render SVG. The mark is rasterised from
`assets/brand/hero-mark.svg` — which stays the source of truth — at 400×400,
which is enough for a retina contact photo without making the file huge.

## Format notes

vCard 3.0, not 4.0. 3.0 is what Apple Contacts, Google Contacts and Outlook all
import without complaint; 4.0 support is still patchy.

The file uses CRLF line endings and folds long lines at 75 octets with a leading
space on continuations, both of which RFC 2426 requires. Some parsers are strict
about it. If you edit the file by hand you will almost certainly break the
folding — use the script.
