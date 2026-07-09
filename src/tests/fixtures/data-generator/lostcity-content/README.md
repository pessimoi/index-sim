# LostCityRS/Content Fixture

Synthetic repository-local fixture for data generator path validation tests.
This is not raw upstream content.

`index-sim-source-slice/` contains the normalized source-backed parser fixture
for monsters, drops, items, equipment, weapons, ammo, spells and item
requirements. It is a deterministic migration slice: runtime monster combat
stats and the runtime item/weapon/ammo/spell/equipment catalogs are represented,
while the fixture-only rows keep representative calculation-impact cases
self-contained. It is not a raw upstream dump or accepted upstream field
authority.
