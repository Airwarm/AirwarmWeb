#!/usr/bin/env python3
"""
Generates the Airwarm contact card, written byte-identical to two paths:

    contact/Airwarm.vcf  https://airwarm.co.uk/contact/Airwarm.vcf
                         THE permanent NFC destination, per Tom's action plan
                         of 15 Sep 2026. This is the URL to programme.
    card/airwarm.vcf     https://airwarm.co.uk/card/airwarm.vcf
                         the September 2026 location, kept working so any
                         card or link already pointing at it does not break.

Run from the repository root:

    python3 card/make-vcard.py

Needs cairosvg to rasterise the Hero Mark. If it is not installed:

    uv run --with cairosvg python3 card/make-vcard.py

See card/README.md before changing anything here — in particular the note about
why this URL must never move.
"""

import base64
import os
import sys

# --- The published contact details -----------------------------------------
# These are the approved values. Do not change them without Airwarm saying so:
# they are printed on cards that are already in people's wallets.
NAME = "Airwarm"
TEL = "+441274947197"          # international form, no spaces, for TEL
EMAIL = "hello@airwarm.co.uk"
URL = "https://airwarm.co.uk"
NOTE = ("Air source heat pump design, installation & servicing. "
        "Serving West Yorkshire.")

# The approved Hero Mark. assets/brand/ is the source of truth for all brand
# artwork and holds the supplied files exactly as delivered.
MARK_SVG = "assets/brand/hero-mark.svg"
PHOTO_PX = 400                 # enough for a retina contact photo

OUTS = ["contact/Airwarm.vcf", "card/airwarm.vcf"]


def rasterise(svg_path, px):
    """Hero Mark SVG -> PNG bytes. Contacts apps cannot render SVG."""
    try:
        import cairosvg
    except ImportError:
        sys.exit("cairosvg is not installed — see the note at the top of this file.")
    return cairosvg.svg2png(url=svg_path, output_width=px, output_height=px)


def fold(line):
    """
    RFC 2426 line folding: no line over 75 octets, continuations start with a
    single space. Parsers do reject unfolded files, so this is not cosmetic.
    """
    if len(line) <= 75:
        return [line]
    out, rest = [line[:75]], line[75:]
    while rest:
        out.append(" " + rest[:74])
        rest = rest[74:]
    return out


def escape(text):
    """vCard escaping: commas and semicolons are field separators."""
    return text.replace("\\", "\\\\").replace(",", "\\,").replace(";", "\\;")


def main():
    if not os.path.exists(MARK_SVG):
        sys.exit("Run this from the repository root — cannot find " + MARK_SVG)

    photo = base64.b64encode(rasterise(MARK_SVG, PHOTO_PX)).decode("ascii")

    # vCard 3.0, not 4.0: 3.0 is what Apple, Google and Outlook all import
    # cleanly. 4.0 support is still patchy.
    lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        # N is structured and required in 3.0. Airwarm is an organisation, so
        # the name sits in the "given" slot and the rest stay empty; that is
        # what makes it save as "Airwarm" rather than a blank contact.
        "N:;" + NAME + ";;;",
        "FN:" + NAME,
        "ORG:" + NAME,
        "TEL;TYPE=WORK,VOICE:" + TEL,
        "EMAIL;TYPE=WORK,INTERNET:" + EMAIL,
        "URL;TYPE=WORK:" + URL,
        "NOTE:" + escape(NOTE),
        "PHOTO;ENCODING=b;TYPE=PNG:" + photo,
        "END:VCARD",
    ]

    folded = []
    for line in lines:
        folded.extend(fold(line))

    # CRLF is required by the spec, hence newline="" to stop Python translating.
    for out in OUTS:
        with open(out, "w", newline="") as fh:
            fh.write("\r\n".join(folded) + "\r\n")
        print("wrote %s (%d bytes)" % (out, os.path.getsize(out)))


if __name__ == "__main__":
    main()
