import re
from functools import lru_cache
from html import escape

import cadquery as cq
from cadquery import exporters


TARGET = {"x": 1980.0, "y": 650.0, "width": 750.0, "height": 540.0}
DEFAULT_ANGLE_ID = "e_rotate_x180"
ANGLE_CONFIGS = {
    "e_rotate_x180": {
        "projection_dir": (-1.0, 0.75, -0.7),
        "fillet_side": "top",
        "rotate_x": 180,
    },
    "b_rotate_x180": {
        "projection_dir": (-1.0, 0.6, -0.55),
        "fillet_side": "top",
        "rotate_x": 180,
    },
    "e_bottom_fillet_alt": {
        "projection_dir": (-1.0, 0.75, -0.7),
        "fillet_side": "bottom",
        "rotate_x": 0,
    },
    "b_bottom_fillet_alt": {
        "projection_dir": (-1.0, 0.6, -0.55),
        "fillet_side": "bottom",
        "rotate_x": 0,
    },
}
PATH_RE = re.compile(r'<path d="([^"]+)"')
COORD_RE = re.compile(r"([ML])\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,?(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)")


def _rounded_bar(length: float, width: float, thickness: float, radius: float, fillet_side: str):
    radius = min(max(float(radius), 0.001), width / 2 - 1e-4, thickness / 2 - 1e-4)
    edge_selector = "<Z or |Z" if fillet_side == "bottom" else ">Z or |Z"
    return (
        cq.Workplane("XY")
        .box(length, width, thickness)
        .edges(edge_selector)
        .fillet(radius)
        .val()
    )


def _extract_paths(svg_text: str):
    paths = []
    all_points = []
    for path_match in PATH_RE.finditer(svg_text):
        commands = []
        for command, x_value, y_value in COORD_RE.findall(path_match.group(1)):
            point = (float(x_value), float(y_value))
            commands.append((command, point))
            all_points.append(point)
        if len(commands) >= 2:
            paths.append(commands)
    return paths, all_points


def _transform_paths(paths, all_points):
    min_x = min(point[0] for point in all_points)
    max_x = max(point[0] for point in all_points)
    min_y = min(point[1] for point in all_points)
    max_y = max(point[1] for point in all_points)
    model_width = max(max_x - min_x, 1e-6)
    model_height = max(max_y - min_y, 1e-6)
    # 使用 0.85 的安全缩放系数，确保 3D 能够尽情撑满画布而不溢出
    fit = min(TARGET["width"] / model_width, TARGET["height"] / model_height) * 0.85
    model_center_x = (min_x + max_x) / 2
    model_center_y = (min_y + max_y) / 2
    target_center_x = TARGET["x"] + TARGET["width"] / 2
    target_center_y = TARGET["y"] + TARGET["height"] / 2

    def transform(point):
        return (
            target_center_x + (point[0] - model_center_x) * fit,
            target_center_y + (point[1] - model_center_y) * fit,
        )

    transformed = []
    for path in paths:
        parts = []
        for command, point in path:
            x_value, y_value = transform(point)
            parts.append(f"{command} {x_value:.2f} {y_value:.2f}")
        transformed.append(" ".join(parts))
    return transformed


@lru_cache(maxsize=128)
def generate_iso_svg(length: float, width: float, thickness: float, radius: float, angle_id: str = DEFAULT_ANGLE_ID) -> str:
    length = max(float(length), 0.1)
    width = max(float(width), 0.1)
    thickness = max(float(thickness), 0.1)
    radius = min(max(float(radius), 0.0), width / 2 - 1e-4, thickness / 2 - 1e-4)

    angle_config = ANGLE_CONFIGS.get(angle_id, ANGLE_CONFIGS[DEFAULT_ANGLE_ID])
    proj_dir = angle_config["projection_dir"]

    shape = _rounded_bar(length, width, thickness, radius, angle_config["fillet_side"])
    rotate_x = angle_config.get("rotate_x", 0)
    if rotate_x:
        shape = shape.rotate((0, 0, 0), (1, 0, 0), rotate_x)
    raw_svg = exporters.getSVG(
        shape,
        opts={
            "width": 760,
            "height": 540,
            "marginLeft": 0,
            "marginTop": 0,
            "projectionDir": proj_dir,
            "showAxes": False,
            "strokeWidth": 0.06,
            "strokeColor": (0, 0, 0),
            "hiddenColor": (255, 255, 255),
            "showHidden": False,
        },
    )
    paths, all_points = _extract_paths(raw_svg)
    if not paths or not all_points:
        raise ValueError("CAD projection produced no visible paths")

    mask_pad = 24
    rendered_paths = "\n".join(
        f'<path d="{escape(path_data)}" class="iso-outline" />'
        for path_data in _transform_paths(paths, all_points)
    )
    return f"""<rect x="{TARGET["x"] - mask_pad:.2f}" y="{TARGET["y"] - mask_pad:.2f}" width="{TARGET["width"] + mask_pad * 2:.2f}" height="{TARGET["height"] + mask_pad * 2:.2f}" class="iso-mask" />
{rendered_paths}"""
