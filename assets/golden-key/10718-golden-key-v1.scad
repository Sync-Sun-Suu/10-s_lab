// 10718 Golden Key — v1
// Original decorative key for Sumie, 10, and Fireseed.
// Units: millimetres. Print flat on the back; no supports required.

$fn = 72;

base_thickness = 4.0;
edge_radius = 0.55;
text_height = 0.75;

// The five lower teeth encode 1・0・7・1・8 as a small rhythm rather than
// pretending to fit an existing lock. A future 10718 box can be designed
// around this key.
tooth_depths = [1.4, 0.8, 3.0, 1.4, 3.3];

module seed_hole_2d() {
  // A soft seed / flame opening for Fireseed.
  offset(r = 1.0)
    offset(delta = -1.0)
      polygon(points = [
        [11.0, 7.0],
        [6.4, 1.8],
        [6.8, -3.4],
        [11.0, -7.0],
        [15.2, -3.4],
        [15.6, 1.8]
      ]);
}

module key_outline_2d() {
  union() {
    // Rounded bow and neck.
    hull() {
      translate([11.5, 0]) circle(r = 12.5);
      translate([21.0, 0]) circle(r = 7.0);
    }

    // Shaft and a small collar.
    translate([19.0, -3.5]) square([43.0, 7.0]);
    translate([21.0, -5.0]) square([3.2, 10.0]);

    // Pointed but rounded-looking tip silhouette.
    polygon(points = [
      [59.0, -3.5], [66.8, -2.8], [68.5, 0],
      [66.8, 2.8], [59.0, 3.5]
    ]);

    // Decorative 10718 rhythm along the lower edge.
    for (i = [0 : 4]) {
      x = 47.7 + i * 3.45;
      d = tooth_depths[i];
      y0 = -2.8; // overlap the shaft/tip so every tooth is one solid body
      polygon(points = [
        [x, y0],
        [x + 2.45, y0],
        [x + 2.05, -3.45 - d],
        [x + 0.45, -3.45 - d]
      ]);
    }
  }
}

module rounded_key_body() {
  // Round every exterior edge while preserving a flat, support-free form.
  translate([0, 0, edge_radius])
    minkowski() {
      linear_extrude(height = base_thickness - 2 * edge_radius)
        offset(delta = -edge_radius)
          key_outline_2d();
      sphere(r = edge_radius, $fn = 24);
    }
}

module key_body_with_seed() {
  difference() {
    rounded_key_body();
    translate([0, 0, -1])
      linear_extrude(height = base_thickness + 2)
        seed_hole_2d();
  }
}

union() {
  key_body_with_seed();

  // Raised inscription. It overlaps the body by 0.2 mm for a robust union.
  translate([40.0, 0, base_thickness - 0.20])
    linear_extrude(height = text_height + 0.20)
      text(
        "10718",
        size = 5.3,
        font = "DejaVu Sans:style=Bold",
        halign = "center",
        valign = "center",
        spacing = 1.03
      );
}
