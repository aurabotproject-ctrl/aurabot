# Teacher Studio — image prompts

The redesign looks finished **without** any images. These are optional
upgrades: each one has a slot already built into the page that stays
invisible until the file exists, so you can add them one at a time.

## Where the files go

Save each image into your repo at exactly this path, then commit and push:

| File | Where it appears | Size |
|---|---|---|
| `public/teacher/sidebar-bot.png` | Bottom of the sidebar, above "Visit 3D Worlds" | 600 × 600 |
| `public/teacher/empty-students.png` | Students page, before any students are added | 720 × 540 |

Both must be **PNG with a transparent background** — they sit on navy in
dark mode and cream paper in light mode, so a solid background would show
as a box.

## The house style (paste this first, every time)

Consistency is what makes a set of illustrations look designed rather than
collected. Start every prompt with this block so they all match each other
and the 3D robot on your landing page:

> Style: a friendly, glossy 3D-rendered robot mascot called Aurabot, in the
> style of a premium toy or a Pixar short. Rounded pill-shaped body and
> limbs, a large dark glass visor screen for a face with two glowing cyan
> oval eyes, a small antenna, soft studio lighting with gentle rim light,
> subtle ambient occlusion. Colour palette: raspberry pink (#cc3355), cream
> (#f2e8d8) and deep navy (#0d1330) accents only — no purple, no rainbow
> gradients. Clean, minimal, no text, no logos, no background scenery.
> Transparent background, PNG, centred with generous padding.

---

## 1 · Sidebar mascot — `sidebar-bot.png`

> [house style]
>
> Aurabot is peeking up from the bottom edge of the frame and giving a
> small cheerful wave with one hand, as if saying hello to the teacher.
> Only the top two-thirds of the robot is visible; the bottom is cropped
> flat by the frame edge. Three-quarter view, looking slightly up and to
> the right. Body in raspberry pink with cream highlights. Square 1:1.

**Tip:** If the wave looks stiff, ask for *"a relaxed, mid-wave pose, hand
slightly blurred with motion"*.

## 2 · Empty class — `empty-students.png`

> [house style]
>
> Aurabot stands holding an empty clipboard against its chest, head tilted
> curiously, one antenna light glowing softly, ready to welcome a new class.
> A few blank trading cards float gently around it at different angles,
> each card plain cream with a thin raspberry border and no artwork on it.
> Full body, front-facing, slight low angle so it feels friendly rather than
> tiny. Landscape 4:3.

---

## Getting a good result from ChatGPT

- **Ask for transparency explicitly** and check it: open the downloaded PNG
  in Preview — if you see a checkerboard, it's transparent. If you see a
  white or grey box, reply *"make the background fully transparent"*.
- **Generate three, pick one.** Reply *"give me two more variations"* before
  settling; the first attempt is rarely the best.
- **Iterate in plain words.** *"Less shiny"*, *"make the eyes bigger and
  kinder"*, *"remove the purple tint"* all work well.
- **Keep one chat for all of them.** Once you have a robot you like, say
  *"use this exact same robot design for the next image"* so the mascot is
  the same character everywhere.
- **Check the size** before committing — anything over ~400 KB is worth
  shrinking at squoosh.app (keep it PNG so the transparency survives).
