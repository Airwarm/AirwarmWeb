# Airwarm website

The Airwarm launch website: air source heat pumps, West Yorkshire.

Plain hand-written HTML and one CSS file. **No framework, no build step, no
npm, no bundler, no JavaScript libraries.** That is deliberate, for two
reasons: it deploys to GitHub Pages exactly as it sits in this repository, and
anyone can open an `.html` file and understand it without installing a single
tool.

Please keep it that way.

## What is in here

```
index.html                     the homepage
air-source-heat-pumps/         one folder per page, each with an index.html
how-it-works/
home-energy-assessment/        the assessment form lives here
heat-pump-survey/
heat-pump-installation/
about/
advice/
contact/
areas/bradford/                location pages
areas/leeds/
areas/shipley/
privacy/  cookies/  terms/     published; installation-terms/ is draft and noindex
404.html                       shown for any unknown address
css/airwarm.css                the ONLY stylesheet
js/assessment.js               the ONLY JavaScript, used on one page
sitemap.xml  robots.txt        for search engines
.nojekyll                      tells GitHub Pages to serve files as they are
README.md                      this file
card/                          NFC/vCard contact endpoint source
endpoint/                      Google Apps Script that receives assessment submissions
```

Each page is a folder containing `index.html`, so the address
`/heat-pump-survey/` works with its trailing slash. That is why there is a
folder per page rather than a pile of `.html` files.

## How to edit a page

1. Open the page's `index.html`.
2. Everything a visitor reads is between `<main id="main">` and `</main>`.
3. Change the words. Leave the tags alone unless you mean to change them.
4. Save, commit, push. It is live within a couple of minutes.

Every file is heavily commented. The comments tell you what each section is
and what is safe to change. Two rules:

- **Do not edit anything between `<!-- HEADER — keep identical across pages -->`
  and `<!-- /HEADER -->`, or between the matching footer comments, in one file
  only.** Those blocks are byte-identical in all sixteen pages. If you change
  one you must change them all, or the site will drift out of step.
- Each page's `<title>` and `<meta name="description">` are its search-engine
  entry. They are near the top of the file, clearly marked.

### Adding a new section to a page

Copy an existing `<section>` and change the text inside it. The useful shapes:

```html
<section class="aw-section">          <!-- white background -->
<section class="aw-section aw-section--light">   <!-- pale grey background -->
<section class="aw-section aw-section--navy">    <!-- navy, white text -->
```

Inside each one, `<div class="aw-wrap">` keeps the content centred at a
sensible width. `aw-grid aw-grid--3` puts cards in three columns on a wide
screen and one column on a phone. There is nothing more to learn than that.

## How to change a colour

All colours are defined once, at the top of `css/airwarm.css`, in the block
marked `01. BRAND TOKENS`:

```css
:root {
  --airwarm-navy: #010F23;
  --airwarm-orange: #F76201;
  ...
}
```

Change the value there and it changes everywhere on the site. Do not put a
colour anywhere else in the CSS, and do not add a new one.

**Before you change one, though:** these eight values are the whole approved
Airwarm palette, and the four brand ones are sampled straight out of the
identity artwork in `assets/brand/hero-logo.svg` rather than typed in from a
document. Several rules here are not ours to relax:

- The tagline is always **SMART HEATING** orange, a blue separator, then
  **GREENER FUTURES** green, in that order. Never reordered, never recoloured.
- Both halves of the tagline stay on **one line**. They are never stacked and
  no punctuation is added.
- Green is for positive outcomes and renewables messaging only. It is not a
  decoration.
- Navy is the principal background.

If the artwork is ever reissued, re-sample it and re-measure the contrast
table at the top of the stylesheet. Do not eyeball a near-match.

There is one more thing worth knowing. The primary button is orange with dark
text rather than blue with white text, because white on the brand blue only
reaches 3.9:1 contrast, which fails the accessibility standard for normal text.
Dark text on the brand orange reaches 7.5:1. If you switch the button to blue,
you break that. The reasoning is written into the CSS at section 05.

## How to add a location page

Bradford, Leeds and Shipley exist. To add a fourth town:

1. Make a folder: `areas/the-town/` with an `index.html` inside it.
2. Copy an existing area page as a **starting structure only**.
3. **Rewrite every word of the content.** The Airwarm pack explicitly forbids
   pages that are the same text with the town name swapped, and search engines
   treat them as doorway pages. Write about that town's actual housing stock:
   what it is built from, when, what that means practically.
4. Update the `<title>`, the meta description, the `<h1>`, the canonical link
   and the two Open Graph tags at the top of the file.
5. Add the town to the footer's "Service areas" list — **in all sixteen
   existing pages plus the new one**, since the footer is identical everywhere.
6. Add a `<url>` block to `sitemap.xml`. Copy an existing one.
7. Add a card linking to it in the "West Yorkshire" section of `index.html`.

Only do this when Airwarm genuinely covers the town. The pack is clear that
coverage comes before the page, not the other way round.

## How Pages deploys

GitHub Pages serves this repository directly from the `main` branch, root
folder. Push to `main` and the live site updates, usually within a minute or
two. There is no build, so there is nothing to go wrong in between.

The `.nojekyll` file is there to stop GitHub trying to process the site as a
Jekyll blog. Do not delete it.

Two things to know:

- **The site is live** at https://airwarm.co.uk, served by GitHub Pages from
  this repository. `.nojekyll` means every file here is served exactly as it
  is, including this one — so keep it accurate and free of anything that
  would embarrass anyone who read it at `airwarm.co.uk/README.md`.
- **The links assume the site is at the root of a domain.** They are written
  as `/about/`, `/contact/` and so on, because that is what the sitemap in the
  brand pack specifies and because it keeps the header identical on every
  page. Those links resolve correctly on `airwarm.co.uk`. They will **not**
  resolve on a `username.github.io/airwarm-website/` style preview address,
  where every page would sit under a sub-folder. Point the custom domain at it
  and everything works.

## Editing with Copilot — for Tom

You do not need to learn to code to change this site. You do need to be
specific about what you want, and to check what you get.

**Where to do it.** Open the repository in GitHub's web editor (press `.` on
the repository page) or in VS Code with Copilot. Both let you edit a file and
commit it without installing anything.

**Ask for what you want in plain English.** Copilot Chat responds well to
requests that name the file and the section:

> In `about/index.html`, in the section commented "What we are committing to",
> change the "Respect" card so it also mentions arriving when we said we would.

> In `areas/bradford/index.html`, add another item to the "Practical
> considerations here" list about shared back yards.

> In `css/airwarm.css`, make the body text one pixel larger on desktop.

**Four things to tell it, every time.** Paste these in if it forgets:

1. This is plain HTML and CSS with no build step. Do not add a framework, a
   package.json, npm, Tailwind, React or a bundler.
2. Only use the colours already defined at the top of `css/airwarm.css`. Do
   not introduce a new colour.
3. Use British spelling: colour, organisation, recognise, optimisation.
4. Do not add prices, savings figures, grant amounts, reviews, testimonials,
   star ratings, accreditation badges, customer numbers or stock photographs.
   Everything on this site has to be true today.

**Things to watch for.** Copilot is enthusiastic and will sometimes:

- Add a cookie banner or Google Analytics. Do not let it. Both are on the
  decisions list, and neither goes in without a matching update to the
  published privacy and cookies pages.
- Invent a phone number, an address, or "trusted by 500 homeowners". Delete
  it. The business line is **01274 947 197** and the address is the registered
  office in the footer; anything else is made up. Airwarm has not started
  trading and the site must never imply that it has — it is preparing for an
  April 2027 launch.
- Add a stock photograph or an image from another website. Nothing on this site
  loads from anywhere except Google Fonts, and that is intentional.
- Rewrite the header or footer in one file only. Check with
  `git diff` before committing, and if it touched the header, either revert it
  or apply the same change everywhere.

**Always check before committing.** Open the file in a browser (double-click
it) and look at it. If you changed a page's words, read them back. If it looks
wrong, `git checkout -- thefile.html` puts it back.

**If you are unsure, commit anyway on a branch.** Nothing here can be broken
permanently. Every version is in the history.

## A note on the source material

The content of this site comes from the Airwarm brand and website pack:
approved copy, the fixed sitemap, the page blueprints, the tone-of-voice rules
and the design tokens.

The wider Airwarm business pack — financial assumptions, pay scenarios, the
risk register, funding terms, the internal plan name — is confidential and
**none of it is in this repository**. Please keep it that way. Nothing from
those documents should ever be pasted into a page, a comment or a commit
message.
