#!/usr/bin/env python3
"""Build the whole asset library in one go (idempotent).

    blender -b --python tools/blender/build_all.py

1. runs every set script in order (characters, buildings, street, props,
   interiors) in this Blender process, each via its own ``main()``;
2. writes assets/index.json (all manifests concatenated, ``set`` field);
3. renders the street mock-up (assets/street_mockup.png, _wide.png, .glb);
4. prints a summary table (set, count, total tris).
Exits 1 on the first failure (any build assertion).
"""
import importlib.util
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from lib import ASSETS, manifest  # noqa: E402

ORDER = ("characters", "buildings", "street", "props", "interiors")


def run_module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod.main()


def main():
    times = {}
    for s in ORDER:
        t0 = time.time()
        print("BUILD_ALL >>> set %s" % s)
        run_module(os.path.join(HERE, "sets", s + ".py"), "set_" + s)
        times[s] = time.time() - t0
    index = manifest.build_index(ASSETS, ORDER)
    t0 = time.time()
    print("BUILD_ALL >>> mockup")
    run_module(os.path.join(HERE, "mockup.py"), "mockup")
    times["mockup"] = time.time() - t0
    print()
    print("BUILD_ALL SUMMARY")
    print("%-12s %6s %10s %8s" % ("set", "count", "total_tris", "secs"))
    tc = tt = 0
    for s in ORDER:
        c = index["sets"][s]
        tc += c["count"]
        tt += c["tris"]
        print("%-12s %6d %10d %8.1f" % (s, c["count"], c["tris"], times[s]))
    print("%-12s %6d %10d %8.1f" % ("TOTAL", tc, tt, sum(times.values())))
    print("mockup: assets/street_mockup.png, street_mockup_wide.png, street_mockup.glb (%.1f s)" % times["mockup"])


if __name__ == "__main__":
    try:
        main()
    except BaseException as e:            # blender -b --python exits 0 on errors; force non-zero
        if isinstance(e, SystemExit) and not e.code:
            raise
        import traceback
        traceback.print_exc()
        sys.exit(1)
