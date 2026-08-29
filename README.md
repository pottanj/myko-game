# Myko

A simple, playable 2D platform game built with HTML Canvas.

## Start

Open `index.html` directly in a modern browser, or run a local static web server in the folder.

## Controls

- A / left arrow: move left
- D / right arrow: move right
- W/S or up/down arrow: climb ladders
- Space: jump; press again in the air to double jump
- E: enter or leave the cabin
- F: equip or turn off the flashlight

The game contains collectible brown, yellow, and beige mushrooms, poisonous fly
agarics, and healing berries and apples. HP and the mushroom basket appear in
the upper-left corner. The surface is always bright, while the cave becomes
almost completely dark outside the flashlight beam. The darkness disappears
when Myko climbs back to the surface.

Myko starts in the doorway of the cabin. Press E to visit its interior, which
contains a bed, a small kitchen, and an animated fireplace. Myko can move left
and right inside.

The game has two levels with upper forest trails and alternative underground
routes. The second level includes a mountain climb, a suspension bridge, a bear
pit, and a long tunnel with ladders. Each level has 30 collectible mushrooms:
15 on the surface and 15 in the tunnel. Apples hang in trees and berries grow
on bushes. The bear patrols its pit, becomes angry when Myko enters, and deals
two HP of damage on contact. It returns to a neutral patrol after Myko leaves.
The end portal switches between levels 1 and 2, creating a loop.
