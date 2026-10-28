# Embun: All Natural template rebuild (mock store)

> **Everything on this site is placeholder content. Do not ship any of it as real.**
>
> Embun, Embun Botanicals Sdn Bhd and every product, price, ingredient claim, review, testimonial,
> journal article, shop, stockist, address, phone number, WhatsApp number, email address, social
> handle, opening hour, shipping rule and policy text are **invented mock data**. They were written
> to show what the template looks like for a Malaysian business.
>
> The people in the photos are AI-generated (Magnific) or Pexels stock models. They are not
> customers, staff or brand ambassadors. The shop and stockist names are fictional, even where the
> street address exists. The footer says "Mock store, not for sale" on every page.
>
> Before using this for a real client, replace all copy, numbers, people and policies with
> verified facts. Then check the legal pages with the client.

## What this is

This is a static HTML/CSS/JS rebuild of the Framer template
[all-natural.framer.website](https://all-natural.framer.website). It keeps the template's layout,
components, effects and animations at every breakpoint. Only colours and content are changed.

| Breakpoint | Template width | Framer hash |
|---|---|---|
| Desktop | ≥1200 | `ipn91j` |
| Tablet | 810–1199 | `1tkk731` |
| Phone | ≤809 | `f4scsy` |

The study behind it is in `_teardown/`:

- `TEARDOWN.md`
- `specs/` for chrome, home, commerce and content pages
- the responsive matrix, the motion inventory and the tokens

The brand brief is `brand/BRAND.md`.

## Brand (mock)

**Embun** is Malay for *dew*. It's natural skincare made with Malaysian botanicals: pandan, serai,
pegaga, kunyit, bunga raya, kelulut honey, rice water and santan.

- **Palette:**
  - Hutan ink `#1F2B24`
  - Santan page `#FCFBF7`
  - Beras surface `#F0EFE7`
  - Pasir muted `#C7C9BC`
  - Cili sale `#C4472D`
- **Wordmark:** Inter Medium with a dew-drop mark, in `brand/embun-wordmark-*.svg`.
- **Catalogue:** 21 products in RM, including 4 kits and a gift card (RM50, RM100, RM150, RM250). See
  `build/products.py`.
- **Shops:**
  - Bangsar
  - George Town
  - Johor Bahru
  - Kota Kinabalu
- **Stockists:**
  - Chow Kit
  - Ipoh
  - Melaka
  - Kuching
  - Petaling Jaya
- **Contact:** +60 3-2201 8890 and WhatsApp +60 12-338 4120. Hours are Mon–Sun.

## Folder layout

The GitHub repository [mysense-my/embun](https://github.com/mysense-my/embun), mirrored at
[zebwan/embun](https://github.com/zebwan/embun), holds the built website: the local
`site/` folder is the repository root, plus this README and CREDITS. The generator (`build/`), brand files and the
template study stay in the local project folder (`~/Desktop/Website Works/All Natural`). They're left out because
the raw image sources run to about 1.1 GB and the study contains the original template's own code and images.

The local `site/` repo pushes to both at once (`origin` has two push URLs), so after `python3 build/build.py` a single
`git push` inside `site/` updates both repositories.

```
site/        the built website (open this; everything is relative-linked)
build/       generator: template HTML + copy + images -> site/
brand/       brand brief, wordmark SVGs, fonts, image plan, contact sheets
_teardown/   the template study (source dump, specs, geometry, captured runtime states, QA tools)
CREDITS.md   every Pexels photo/video and Magnific image actually used
```

## Build and preview

The build needs Python 3 with `beautifulsoup4`, `Pillow` and `fontTools`. The videos also need `ffmpeg`.

```bash
python3 build/build.py
```

This rebuilds the pages, the runtime fragments and `site/js/data.js` in about 25 seconds.

```bash
python3 build/serve.py
```

This serves `site/` at http://127.0.0.1:8790. It uses pretty URLs and a threaded server.

macOS blocks preview servers from reading `~/Desktop`. If the Launch panel shows 404s, serve a
copy of `site/` from somewhere else, or run `serve.py` from a terminal.

Each media script rebuilds one kind of asset:

| Script | What it rebuilds |
|---|---|
| `build/images.py` | every image slot from `build/assignments.py`: crop to the template image's aspect, then WebP full, 1024 and 512 |
| `build/videos.py` | the 15 films, cropped, scaled and trimmed to each template film; `posters` rebuilds only the posters |
| `build/credits.py` | `CREDITS.md` |

### How it is put together

- **Template markup.** Pages are the template's own server-rendered markup with Framer's runtime
  stripped out. Every breakpoint keeps the template's exact CSS, and page heights match the
  template within a few pixels.
- **Behaviour.** Our modules re-create the behaviour:
  - `site/js/embun.js` is the core: the Framer spring maths ported to CSS `linear()`, appear
    animations, cart, favourites and the fragment loader.
  - `m-chrome.js` handles the nav, mega menu, cart and search drawers, and the country modal.
  - `m-home.js` runs the hero slideshow, split headings and carousels.
  - `m-commerce.js` covers cards, filters and sort, the PDP gallery, variants and ingredient tabs.
  - `m-content.js` runs the journal, stockists, FAQ and the values film.
- **Runtime-only states.** Menus, drawers, modals and hero slides 2–3 were captured from the live
  template and live in `site/frag/`.
- **Text and colour.** Copy swaps come from `build/copytext.py`; every string is mock.
  `build/lib.py` maps the colours one-to-one.
- **Checkout.** A full mock checkout with a fictional payment gateway (see the next section). No real payment
  provider is connected.

## Checkout and the mock gateway (no real payments)

1. The bag's **Checkout** button goes to `/checkout/`. That page is built on the Favorites page shell and reuses the
   template's own pieces:
   - the contact-form underline fields
   - the PDP size-picker chips
   - the Add to cart button
   - cart-drawer line items
2. The checkout asks for:
   - **Contact:** email and Malaysian mobile number
   - **Delivery:** ship to me, or free pick-up at one of the four shops. Entering a postcode pre-fills the state.
   - **Shipping:** Standard RM8 (free over RM150), or Sabah & Sarawak at a flat RM15, using the rates already in the
     site's shipping drawer
   - **Payment:** FPX (with a bank list), card, DuitNow QR, Touch 'n Go eWallet or GrabPay
3. The order summary sticks beside the form on desktop and folds into a bar on tablet and phone. Discount code
   `WELCOME10` gives 10 % off, matching the newsletter's welcome offer; gift cards are excluded.
4. **Pay** saves a pending order and hands off to **Pintu Pay** at `/pay/`. Pintu Pay is a fictional hosted payment
   page that always runs in test mode:
   - **Card:** only the test cards work. `4242 4242 4242 4242` is approved and `4000 0000 0000 0002` is declined.
     Any other number is refused and cleared from the field.
   - **FPX:** pick a bank, then *Approve* or *Reject*. This is a simulated approval; it never shows a bank sign-in
     form.
   - **QR methods:** shows a test QR (not scannable) with a 5-minute timer and a *Simulate a successful scan* button.
   - *Cancel and return to Embun* goes back to the checkout with the bag intact.
5. On success the shopper returns to `/checkout/?order=EMB-…`. The order is saved, the bag is emptied and the page
   shows the order confirmation. A thank-you popup opens on top; it reuses the template's newsletter modal (same
   card, image slot, close X and motion) with new content.

Orders, the pending order and saved checkout details live in the visitor's own browser (`localStorage`). Nothing is
sent anywhere, so there's no backend to set up, and nothing to secure. **Before a real launch, replace Pintu Pay with
a real payment provider** (for example Billplz, iPay88, Stripe or HitPay) and send orders to a real backend.

## Images and video

| Source | Slots | What |
|---|---|---|
| Magnific AI (Nano Banana 2.1, Seedream 5 Pro) | 148 | All 21 products as bottle + carton packshots and alternate angles, kit groupings, texture swatches, dark product renders, Malay / Chinese / Indian / Kadazan models, shophouse interiors and facades |
| Pexels photos | 67 | Nature, ingredients, textures, hands, lifestyle and the hero sale slide |
| Pexels videos | 16 films | Hero (slides 1 and 2, desktop and phone), category, values and environment films |
| Magnific still | 1 film | Gift card film (slow push-in) |
| Video first frames | 4 | Image slots that showed a film still in the template, including the slide-2 posters |

That's 219 image slots and 17 films. None of the template's images, videos or icons are left.
This includes media that only appears at runtime: hero slides 2–3, drawers and menus. The social and payment icons and
the press logos were redrawn. The press names (Kembang, Rona, Seruni, Laman) are fictional.
See `CREDITS.md` for every Pexels id and photographer.
