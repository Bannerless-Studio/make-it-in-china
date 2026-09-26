"""Cross-set mount dimensions: one number shared by the asset that hangs and
the building anchor it hangs from (a mismatch here is a build failure).

* LANTERN_STRING_SPAN  hook-to-hook span of street ``lantern_string``; the
  building anchor ``lantern_string_hooks {left, right}`` must be this far apart.
* LAUNDRY_POLE_SPAN    rest-to-rest span of street ``laundry_pole_bar`` (the
  wall-mounted pole); building anchor ``laundry_pole_mounts {left, right}``.
"""
LANTERN_STRING_SPAN = 3.0
LAUNDRY_POLE_SPAN = 2.2
SPAN_TOL = 0.01


def check_pair(left, right, span, what):
    """Assert a {left,right} anchor pair (any axis order) is ``span`` apart."""
    d = sum((a - b) ** 2 for a, b in zip(left, right)) ** 0.5
    assert abs(d - span) <= SPAN_TOL, "%s: mount pair %.3f m apart, asset span %.3f m" % (what, d, span)
    return d
