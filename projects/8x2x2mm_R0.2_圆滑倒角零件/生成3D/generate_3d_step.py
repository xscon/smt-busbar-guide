from pathlib import Path

import cadquery as cq
from cadquery import exporters


OUT_DIR = Path(__file__).resolve().parent
STEP_PATH = OUT_DIR / "8x2x2mm_R0.2_smooth.step"


def create_part():
    return cq.Workplane("XY").box(8.0, 2.0, 2.0).edges(">Z or |Z").fillet(0.2)


def main():
    part = create_part()
    exporters.export(part, str(STEP_PATH))

    box = part.val().BoundingBox()
    print("EXPORTED", STEP_PATH)
    print("DIMENSIONS_MM", (round(box.xlen, 6), round(box.ylen, 6), round(box.zlen, 6)))
    print("FILLET_RADIUS_MM", 0.2)


if __name__ == "__main__":
    main()
