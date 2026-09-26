"""The one shared palette. Warm, calm, limited; flat colours only.

Colours are authored as sRGB hex (what an artist picks) and stored in
``COLOURS`` as *linear* RGBA tuples, which is what Blender materials and the
glTF baseColorFactor expect. Use ``build.mat(name)`` to get a material; never
invent ad-hoc colours in set scripts -- add them here with a doc line instead.

Groups: skin, hair, cloth, hi-vis/work, food/signal, animals, materials
(wood, metal, paper, plastic), architecture (plaster, brick, roof tile, glass,
concrete, asphalt, paving, tile), extra materials / food / foliage.

History: the set scripts (buildings, street, props, interiors) each carried an
EXTRA_COLOURS block; they were merged here in the polish pass.  Duplicate
``dark_wood`` (buildings, #5A3B2A) + ``wood_dark`` (interiors, #6B4630) became
one ``wood_dark`` (#62402D).  New colours: add them here, with a doc line.
"""


def srgb_to_linear(c):
    """Convert one sRGB channel in 0..1 to linear."""
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_to_linear(hex_str, alpha=1.0):
    """'#RRGGBB' (sRGB) -> linear (r, g, b, a) tuple."""
    h = hex_str.lstrip("#")
    return tuple(round(srgb_to_linear(int(h[i:i + 2], 16) / 255.0), 5) for i in (0, 2, 4)) + (alpha,)


# name: (sRGB hex, description). Order = documentation order.
SPEC = {
    # --- skin -------------------------------------------------------------
    "skin_light":   ("#F2CBA6", "light skin tone"),
    "skin_mid":     ("#DDA67C", "medium skin tone (default)"),
    "skin_tan":     ("#B98058", "tanned / darker skin tone"),
    # --- hair -------------------------------------------------------------
    "hair_black":   ("#2F2826", "black-brown hair (most characters)"),
    "hair_grey":    ("#B4AEA8", "elderly grey hair"),
    # --- cloth ------------------------------------------------------------
    "cloth_white":  ("#EFEBE1", "off-white cloth: chef jacket, shirts, t-shirts, sneakers, name tag"),
    "cloth_grey":   ("#858C94", "cool mid grey: hoodie, pigeon body"),
    "cloth_oat":    ("#B7A58C", "warm oatmeal grey: knitted cardigan"),
    "charcoal":     ("#3B3E44", "near-black: dark trousers, vests, aprons, phone, tyres"),
    "denim":        ("#4E6F94", "denim blue: jeans"),
    "navy":         ("#2E4166", "navy: trims, uniform trousers, driver cap, backpacks"),
    "work_blue":    ("#4677B0", "work-shirt blue; also a recolour option"),
    "sky_blue":     ("#9DC4E2", "pale uniform blue: bus driver shirt"),
    "khaki_brown":  ("#7B5B40", "brown: trousers, belts, boots, flat cap"),
    "purple":       ("#80609E", "auntie purple padded jacket"),
    "pink":         ("#E89EA8", "floral pink: sleeve guards, sun visor"),
    # --- hi-vis / signal / food ------------------------------------------
    "hivis_orange": ("#F07C2C", "hi-vis orange vest; also orange fruit"),
    "yellow":       ("#F2C232", "courier / raincoat / hard-hat yellow; food yellow (banana, egg)"),
    "red":          ("#C9453B", "warm red: polo, boots, awning red, food red (apple, tomato)"),
    "lantern_red":  ("#D93028", "saturated lantern / couplet red"),
    "leaf_green":   ("#6E9B4F", "leaf green: fruit-seller apron, cabbage, food green"),
    # --- animals ----------------------------------------------------------
    "ginger":       ("#E08A3E", "street-cat ginger"),
    "dog_tan":      ("#B8875A", "small-dog tan"),
    "slate":        ("#5F6772", "dark blue-grey: pigeon wings, dark metal"),
    # --- materials --------------------------------------------------------
    "wood":         ("#A06E45", "mid wood: handles, crates, chopsticks, clipboard board"),
    "straw":        ("#E2C07C", "woven straw / bamboo: straw hat, steamers"),
    "paper":        ("#F5ECD5", "paper / cardboard light side: paper, lantern paper, signs"),
    "metal":        ("#A9B0B5", "light steel: ladle, keys, hooks, reflective stripes"),
    # --- architecture -----------------------------------------------------
    "plaster":      ("#E8DAC0", "warm wall plaster"),
    "brick":        ("#A65B40", "red-brown brick"),
    "roof_tile":    ("#5C6A6D", "grey-green Chinese roof tile"),
    "glass":        ("#A9CDD6", "window glass (opaque flat tint)"),
    "concrete":     ("#B6B1A7", "pavement / kerb concrete"),
    "asphalt":      ("#4A4A4E", "road asphalt"),
    "paving":       ("#C8C1B2", "pavement paving slabs (lighter than kerb concrete)"),
    "tile_white":   ("#DCDDD6", "white ceramic facade tile / appliance white: shop fronts, AC units, freezer"),
    "dado_green":   ("#9FB9A2", "lower-wall green paint band (rented room)"),
    "formica":      ("#D8E2CC", "pale mint formica table top (noodle shop)"),
    "door_red":     ("#A8322B", "deep vermilion door leaves (darker than lantern_red couplets)"),
    # --- extra materials / food / foliage (merged from the set scripts) ----
    "wood_dark":    ("#62402D", "dark stained / lacquered wood: tea-house lattice, beams, furniture, doors"),
    "bamboo_dark":  ("#BE8F4E", "darker bamboo bands: steamer rims, bamboo nodes"),
    "clay":         ("#B8643E", "terracotta flower pot"),
    "gold":         ("#E3B448", "lantern caps, door studs, knockers, sign trim"),
    "cardboard":    ("#C4935B", "brown corrugated cardboard: porter boxes"),
    "canopy_green": ("#4F7D43", "darker leaf green: tree canopy shade clumps"),
    "leaf_dark":    ("#4A7536", "dark leaf green: bamboo leaves, plant foliage"),
    "dark_green":   ("#3F6B3A", "deep green: watermelon rind, tea tin, cabbage outer"),
    "leaf_pale":    ("#B8D08A", "pale leaf green: cabbage heart, scallion"),
    "broth":        ("#C7843F", "noodle broth / soup brown-orange"),
    "egg_shell":    ("#E6CBA3", "brown-cream egg shell"),
}

COLOURS = {name: hex_to_linear(hx) for name, (hx, _doc) in SPEC.items()}


def colour(name):
    """Linear RGBA for a palette name; raises KeyError with the valid names."""
    try:
        return COLOURS[name]
    except KeyError:
        raise KeyError("Unknown palette colour %r. Valid: %s" % (name, ", ".join(COLOURS)))
