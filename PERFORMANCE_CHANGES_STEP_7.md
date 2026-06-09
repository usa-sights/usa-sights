# Performance Changes – Step 7

Focus: speed up `/admin/media`, especially when showing 72 images on slower connections such as ~20 Mbit/s.

## Changes

- `/api/images/signed-urls` now accepts an optional `transform` payload.
- Transformed signed URLs are created with bounded concurrency.
- If transformed signing is unavailable or fails for specific files, the route falls back to normal signed URLs so images still display.
- `/admin/media` grid now signs only thumbnail paths for the initial page view.
- Original image URLs are no longer signed for all 72 rows upfront.
- Original image URLs are signed only when the large/fullscreen preview is opened.
- Admin media thumbnails request smaller transformed images: 320×240, `cover`, quality 55.
- Signed URLs are cached client-side while the admin media page is open, reducing repeated signing when navigating back and forth.
- Page-size options now include 24 for slower connections, while 72 remains available.
- Added `content-visibility: auto` to large admin media groups/cards to reduce rendering work while scrolling.

## Expected impact

For 72-image pages, initial work is reduced from thumbnail + original signing/downloading to thumbnail-only signing/downloading. The browser should transfer much less image data, and original images are deferred until the admin explicitly opens the large preview.

No visit/view counting was added or changed.
