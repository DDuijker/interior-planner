# Adding furniture to the catalogue

The catalogue is generic and self-modelled: no brand names, no shop data, no
downloaded models. Sizes are realistic standard sizes in centimetres.

## Where

- `catalog/builders.ts`: parametric archetypes. A builder gets the size
  `{ w, d, h }` and options, and returns `Part[]` (boxes, cylinders, spheres,
  cones) inside that box, centred on the item with the base at z = 0. The same
  parts draw the 2D top view and the 3D model.
- `catalog/entries.ts`: one `entry(...)` per piece: id, Dutch and English
  name, category, size `[w, d, h]`, builder and options (palette, min and max
  size, mount `floor`/`stack`/`wall`, layer, against the wall, clearance).

## Steps

1. Reuse a builder if one fits (a new size or option is often enough).
   Otherwise add a builder; keep parts inside the box.
2. Add the entry with a unique, lowercase id (`sideboard-low`). The id is
   stored in projects and plan-code, so never rename an existing one.
3. Give both names. Use a name people would search for.
4. Run `npm test catalog`. `validateCatalog` checks unique ids, parts inside
   the box, sizes within min and max, names in both languages. The build also
   runs these tests.

## Colour roles

Parts use roles (`main`, `second`, `wood`, `metal`, `black`, ...) instead of
fixed colours, so the user can recolour a piece and style presets can tint
furniture. See `partColor` in `catalog/catalog.ts`.
