import base64
import contextlib
import importlib.util
import io
import json
import re
import tempfile
import threading
import warnings
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, urlparse

import cadquery as cq
from cadquery import exporters

from iso_cad import DEFAULT_ANGLE_ID, generate_iso_svg


APP_DIR = Path(__file__).resolve().parent
ROOT_DIR = APP_DIR.parent
NUT_REFERENCE_FILE = ROOT_DIR / "自动画图-圆柱.py"
OUTPUT_DIR = Path("/Users/futejia/百度网盘/博众/立创图纸更新/铜条新图纸")
EXPORT_DIRS = {
    "pdf": OUTPUT_DIR / "pdf",
    "stl": OUTPUT_DIR / "stl",
    "step": OUTPUT_DIR / "step",
}
FILENAME_SAFE_RE = re.compile(r"[^0-9A-Za-z._()\\-\\[\\]\u4e00-\u9fff]+")
_NUT_REFERENCE_LOCK = threading.Lock()
_NUT_REFERENCE_MODULE = None


def ensure_output_dirs():
    for directory in EXPORT_DIRS.values():
        directory.mkdir(parents=True, exist_ok=True)


def safe_filename(filename, fallback, extension):
    raw_name = Path(str(filename or fallback)).name.strip() or fallback
    stem = raw_name
    if stem.lower().endswith(f".{extension}"):
        stem = stem[: -(len(extension) + 1)]
    stem = FILENAME_SAFE_RE.sub("_", stem).strip("._ ") or fallback
    return f"{stem}.{extension}"


def rounded_bar(length, width, thickness, radius):
    length = max(float(length), 0.1)
    width = max(float(width), 0.1)
    thickness = max(float(thickness), 0.1)
    max_radius = min(width, thickness) / 2 - 1e-4
    radius = min(max(float(radius), 0.0), max_radius)
    part = cq.Workplane("XY").box(length, width, thickness)
    if radius > 0:
        # Keep one L x W face unfilleted; fillet the opposite perimeter and height edges.
        part = part.edges(">Z or |Z").fillet(radius)
    return part


def _load_nut_reference_module():
    global _NUT_REFERENCE_MODULE
    if _NUT_REFERENCE_MODULE is not None:
        return _NUT_REFERENCE_MODULE
    if not NUT_REFERENCE_FILE.exists():
        raise FileNotFoundError(f"reference drawing script not found: {NUT_REFERENCE_FILE}")

    import matplotlib

    matplotlib.use("Agg", force=True)
    spec = importlib.util.spec_from_file_location("nut_reference_drawing", NUT_REFERENCE_FILE)
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load reference drawing script")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    _NUT_REFERENCE_MODULE = module
    return module


def _float_param(params, name, fallback):
    try:
        return float(params.get(name, [fallback])[0])
    except (TypeError, ValueError):
        return float(fallback)


def generate_reference_nut_svg(query):
    params = parse_qs(query)
    reference_params = {
        "outer_diameter": max(_float_param(params, "outerD", 5.56), 0.1),
        "inner_diameter": max(_float_param(params, "innerD", 2.05), 0.1),
        "three_quarter_diameter": max(_float_param(params, "thread", 2.5), 0.1),
        "main_length": max(_float_param(params, "mainLength", 7), 0.1),
        "step_length": max(_float_param(params, "stepLength", 1.53), 0.1),
        "step_diameter": max(_float_param(params, "stepD", 4.09), 0.1),
        "main_chamfer_size": max(_float_param(params, "mainC", 0.2), 0),
        "step_chamfer_size": max(_float_param(params, "stepC", 0.4), 0),
    }

    with _NUT_REFERENCE_LOCK:
        module = _load_nut_reference_module()
        module.PARAMS.update(reference_params)
        module.PARAMS.update(
            {
                "figsize_combined": (12, 6),
                "margin": 3.0,
                "dimension_font_size": 8,
                "dimension_line_width": 0.5,
                "dimension_text_offset": 0.3,
                "wspace": 0.5,
                "dimension_offset": 2.0,
            }
        )
        custom_params = module.PARAMS.copy()
        with tempfile.NamedTemporaryFile(suffix=".svg", delete=False) as temp_file:
            temp_path = Path(temp_file.name)
        original_show = module.plt.show
        try:
            module.plt.show = lambda *args, **kwargs: None
            with contextlib.redirect_stdout(io.StringIO()), warnings.catch_warnings():
                warnings.simplefilter("ignore", UserWarning)
                module.create_combined_views(custom_params, str(temp_path))
            return temp_path.read_bytes()
        finally:
            module.plt.show = original_show
            module.plt.close("all")
            temp_path.unlink(missing_ok=True)


class DrawingRequestHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/iso-svg":
            self._send_iso_svg(parsed.query)
            return
        if parsed.path == "/api/nut-reference-svg":
            self._send_nut_reference_svg(parsed.query)
            return
        if parsed.path == "/api/export-model":
            self._send_model_export(parsed.query)
            return
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/save-pdf":
            self._save_pdf()
            return
        self.send_error(404, "Not found")

    def _send_iso_svg(self, query):
        try:
            params = parse_qs(query)
            length = float(params.get("l", ["16"])[0])
            width = float(params.get("w", ["3"])[0])
            thickness = float(params.get("t", ["2"])[0])
            radius = float(params.get("c", ["0.2"])[0])
            angle = params.get("angle", [DEFAULT_ANGLE_ID])[0]
            body = generate_iso_svg(length, width, thickness, radius, angle).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "image/svg+xml; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as exc:
            body = str(exc).encode("utf-8")
            self.send_response(500)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    def _send_nut_reference_svg(self, query):
        try:
            body = generate_reference_nut_svg(query)
            self.send_response(200)
            self.send_header("Content-Type", "image/svg+xml; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as exc:
            self._send_error_text(500, str(exc))

    def _send_model_export(self, query):
        try:
            ensure_output_dirs()
            params = parse_qs(query)
            export_format = params.get("format", ["stl"])[0].lower()
            if export_format not in {"stl", "step"}:
                raise ValueError("format must be stl or step")

            length = float(params.get("l", ["16"])[0])
            width = float(params.get("w", ["3"])[0])
            thickness = float(params.get("t", ["2"])[0])
            radius = float(params.get("c", ["0.2"])[0])
            part_no = params.get("partNo", ["part"])[0]
            filename = safe_filename(part_no, "part", export_format)
            output_path = EXPORT_DIRS[export_format] / filename

            part = rounded_bar(length, width, thickness, radius)
            if export_format == "stl":
                exporters.export(part, str(output_path), tolerance=0.005, angularTolerance=0.1)
                content_type = "model/stl"
            else:
                exporters.export(part, str(output_path))
                content_type = "application/step"

            self._send_file_download(output_path, content_type)
        except Exception as exc:
            self._send_error_text(500, str(exc))

    def _save_pdf(self):
        try:
            ensure_output_dirs()
            content_length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            filename = safe_filename(payload.get("filename"), "drawing", "pdf")
            data_url = str(payload.get("data", ""))
            if "," in data_url:
                data_url = data_url.split(",", 1)[1]
            pdf_bytes = base64.b64decode(data_url, validate=True)
            if not pdf_bytes.startswith(b"%PDF"):
                raise ValueError("uploaded data is not a PDF")

            output_path = EXPORT_DIRS["pdf"] / filename
            output_path.write_bytes(pdf_bytes)
            body = json.dumps(
                {
                    "ok": True,
                    "filename": filename,
                    "path": str(output_path),
                },
                ensure_ascii=False,
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as exc:
            self._send_error_text(500, str(exc))

    def _send_file_download(self, output_path, content_type):
        body = output_path.read_bytes()
        ascii_name = re.sub(r"[^0-9A-Za-z._-]+", "_", output_path.name)
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.send_header(
            "Content-Disposition",
            f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(output_path.name)}",
        )
        self.send_header("X-Output-Path", quote(str(output_path)))
        self.end_headers()
        self.wfile.write(body)

    def _send_error_text(self, status, message):
        body = str(message).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    ensure_output_dirs()
    handler = partial(DrawingRequestHandler, directory=str(APP_DIR))
    server = ThreadingHTTPServer(("127.0.0.1", 4173), handler)
    print("Serving drawing app with CAD API at http://localhost:4173/index.html")
    server.serve_forever()
