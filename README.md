t8.yiliya.studio
================

Make a Tekken 8 top 8 graphic and text post for your tournament, in the browser. Live at [t8.yiliya.studio](https://t8.yiliya.studio).

Originally made as a fun project for DLSL IGNIS T8 Tourneys

![Screenshot of UI](preview.png)

Features
--------

- Standings graphic in 16:9 (1920×1080) and 4:5 (1080×1350), exported as PNG
- Text post with medals, flags, handles and characters
- Built-in art for the full roster, with crop controls and custom uploads
- Four themes, plus stage or custom backgrounds with shade, blur and position
- Double elim, single elim or custom placements
- No account or server: everything is saved in your browser

Stack
--------

React 18, TypeScript, Vite, Base UI, html-to-image, Vitest

Development
--------

Requires Node 18+.

```sh
npm install
npm run dev        # http://localhost:5173
npm test
npm run build      # outputs dist/
npm run preview    # serves dist/ locally
```

### Art

Character art and stages are served from `public/` and listed in `src/data/published-art.json`. Source files live in the git-ignored `local-art/` folder:

| Folder | Contents |
|---|---|
| `local-art/tekken8/_raw/` | Raw character renders, named by slug (`devil-jin.png`) |
| `local-art/tekken8/` | Cutouts and `frames.json` |
| `local-art/tekken8-stages/` | Stage screenshots, named after the stage (`yakushima.png`) |

```sh
npm run cutout       # raw renders -> cutouts (needs .venv with rembg, pillow, opencv-python-headless)
npm run publish:art  # cutouts and stages -> public/
npm run sync:roster  # update roster names from Wavu Wiki
```

To do
--------

- [ ] Support more games beyond Tekken 8

Disclaimer
--------

Fan-made. Not affiliated with or endorsed by Bandai Namco Entertainment. TEKKEN™8 character art and stage images © Bandai Namco Entertainment Inc.
