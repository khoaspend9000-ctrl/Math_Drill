# -*- coding: utf-8 -*-
"""Shop UI helpers: filter, search, preview panel."""


def collect_shop_catalog(pet_system, skin_system):
    """All purchasable items for unified shop list."""
    items = []
    for key, data in pet_system.pet_types.items():
        stage = data.get("stages", [{}])[0]
        items.append({
            "category": "pet",
            "key": key,
            "name": data.get("name", key),
            "icon": stage.get("icon", "🐾"),
            "description": f"Thú cưng đồng hành — {stage.get('name', '')}",
            "price": int(data.get("price", 0)),
        })
    for key, data in skin_system.skin_types.items():
        stype = data.get("type", "pen")
        cat = "pen" if stype == "pen" else "board"
        items.append({
            "category": cat,
            "key": key,
            "name": data.get("name", key),
            "icon": data.get("icon", "✏️"),
            "description": data.get("description", ""),
            "price": int(data.get("price", 0)),
            "effect": data.get("effect"),
            "color": data.get("color"),
            "bg_color": data.get("bg_color"),
        })
    return items


def filter_shop_items(items, shop_filter, search_text):
    q = (search_text or "").strip().lower()
    out = []
    for it in items:
        if shop_filter != "all" and it["category"] != shop_filter:
            continue
        if q:
            blob = f"{it['name']} {it.get('description', '')} {it['key']}".lower()
            if q not in blob:
                continue
        out.append(it)
    return out
