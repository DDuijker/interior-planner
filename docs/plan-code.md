# Plan-code (version 1)

Plan-code is a small JSON format for floor plans. You can type it, paste it,
export it from the app or let the AI floor plan reader produce it. A file is
one plan (one floor) or a list of plans.

All sizes are **centimetres**. **x** grows to the right, **y** grows down.

```json
{
  "version": 1,
  "name": "Huis begane grond",
  "level": 0,
  "height": 273,
  "rooms": [
    { "name": "Woonkamer", "type": "living", "rects": [[0, 0, 500, 400]] },
    {
      "name": "Hal",
      "type": "hal",
      "points": [
        [500, 0],
        [620, 0],
        [620, 400],
        [500, 400]
      ]
    }
  ],
  "walls": [[250, 0, 10, 150]],
  "doors": [{ "x": 500, "y": 150, "w": 83, "dir": "v", "hinge": "start", "swing": "a" }],
  "windows": [
    { "x": 100, "y": -15, "w": 200, "dir": "h", "glass": false, "sill": 90, "lintel": 210 }
  ],
  "passages": [{ "x": 300, "y": 400, "w": 120, "dir": "h" }],
  "fixtures": [
    { "type": "kitchen", "x": 510, "y": 0, "w": 240, "h": 60 },
    { "type": "stairs", "x": 400, "y": 20, "w": 90, "h": 280, "shape": "straight", "up": "N" }
  ],
  "items": [
    { "name": "Bank 3-zits", "x": 250, "y": 340, "back": "S" },
    { "id": "lamp-floor", "x": 40, "y": 40 }
  ]
}
```

## Fields

| Field      | Required | Meaning                                                                                                                                                                                                                 |
| ---------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version`  | no       | Plan-code version, currently `1`. Exports always include it.                                                                                                                                                            |
| `name`     | yes      | Name of the floor.                                                                                                                                                                                                      |
| `level`    | no       | 0 = ground floor, 1 = first floor, -1 = basement. Defaults to the position in the list.                                                                                                                                 |
| `height`   | no       | Floor-to-ceiling height, default 260.                                                                                                                                                                                   |
| `rooms`    | yes      | Rooms. Each has `name`, `type` and either `rects` (list of `[x, y, w, d]`) or `points` (polygon, list of `[x, y]`).                                                                                                     |
| `walls`    | no       | Extra walls as `[x, y, w, d]`, on top of the walls generated from the rooms.                                                                                                                                            |
| `doors`    | no       | `x, y` is the start of the door on the wall centre line, `w` the width, `dir` `h` (along x) or `v` (along y). Optional `height` (211), `hinge` (`start`/`end`), `swing` (`a` = north/west side, `b` = south/east side). |
| `windows`  | no       | Like doors, plus `glass` (floor-to-ceiling glass wall), `sill` (90) and `lintel` (210).                                                                                                                                 |
| `passages` | no       | Openings without a door (breakthroughs), optional `height`.                                                                                                                                                             |
| `fixtures` | no       | Fixed elements: `type`, top-left `x, y`, width `w` and depth `h` (yes, `h` is the depth in plan), optional `rotation`. Stairs take `shape` (`straight`, `l`, `spiral`) and `up` (`N`, `E`, `S`, `W`).                   |
| `items`    | no       | Furniture: `id` (catalog id) or `name` (Dutch or English catalog name), centre `x, y`, and `back` (`N`, `E`, `S`, `W`: the side the back is against) or `rotation` in degrees. Optional `w, d, h`, `color`, `color2`.   |

Room types: `living`, `kitchen`, `dining`, `bed`, `office`, `bath`,
`toilet`, `hal`, `storage`, `loggia`. A loggia or balcony gets a low edge
instead of a full wall.

Fixture types: `kitchen`, `fridge`, `toilet`, `sink`, `shower`, `bath`,
`tall`, `column`, `stairs`, `chimney`.

## Walls

You never draw the walls between rooms: they are generated. Rooms that touch
get an interior wall centred on the shared edge; the edge of the plan gets an
exterior wall on the outside, so rooms keep the size you typed. Doors and
windows within 40 cm of a wall snap onto it.

## Errors

The importer reports every problem with line, column and field, for example
`line 6, rooms.1.type: Invalid option`. Unknown furniture names are not an
error: they are imported as a plain box with a warning.

## Changes to the format

The format is versioned. A new version must stay readable: add a migration in
`core/plancode` and keep a fixture of the old version in the tests.
