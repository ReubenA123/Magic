Drop card art here, named to match each card's `id` field in
`src/data/cards.ts` (and the server's copy at `server/src/data/cards.ts`),
e.g.:

  cloud-strife.jpg
  tifa-lockhart.jpg
  fire-crystal.jpg

Vite serves everything in `client/public/` from the site root, so a file
here at `public/assets/cards/cloud-strife.jpg` is reachable at
`/assets/cards/cloud-strife.jpg` - which is exactly what each card's
`imagePath` field already points to. Nothing else needs to change; the
game already renders a text placeholder for any card whose image is
missing, so you can add art gradually.
