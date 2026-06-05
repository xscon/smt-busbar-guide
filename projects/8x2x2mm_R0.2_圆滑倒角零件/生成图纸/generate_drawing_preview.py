import math
from pathlib import Path

from mathutils import Vector

import bpy


OUT_DIR = Path(__file__).resolve().parent
PNG_PATH = str(OUT_DIR / "8x2x2mm_R0.2_标注预览.png")
BLEND_PATH = str(OUT_DIR / "图纸预览场景.blend")


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def look_at(obj, target):
    loc = Vector(obj.location)
    direction = Vector(target) - loc
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def create_material(name, color, metallic=0.0, roughness=0.45):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    bsdf = next((node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if bsdf:
        if "Base Color" in bsdf.inputs:
            bsdf.inputs["Base Color"].default_value = color
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = metallic
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = roughness
    return mat


def create_beveled_block():
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    block = bpy.context.object
    block.name = "8 x 2 x 2 mm block, smooth R0.2 mm"
    block.dimensions = (8.0, 2.0, 2.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    bevel = block.modifiers.new("smooth R0.2 mm bevel", "BEVEL")
    bevel.width = 0.2
    bevel.segments = 16
    bevel.profile = 0.5
    bevel.affect = "EDGES"
    bevel.harden_normals = True

    normals = block.modifiers.new("weighted normals", "WEIGHTED_NORMAL")
    normals.keep_sharp = True

    block.data.materials.append(create_material("satin aluminum", (0.72, 0.78, 0.82, 1), 0.35, 0.32))
    return block


def cylinder_between(name, start, end, radius, mat):
    start_v = Vector(start)
    end_v = Vector(end)
    center = (start_v + end_v) / 2
    direction = end_v - start_v
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=radius, depth=direction.length, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(mat)
    return obj


def cone_at(name, location, direction, mat, radius=0.085, depth=0.23):
    direction_v = Vector(direction).normalized()
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=radius, radius2=0, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = direction_v.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(mat)
    return obj


def arrow_between(name, start, end, mat, radius=0.022):
    start_v = Vector(start)
    end_v = Vector(end)
    direction = (end_v - start_v).normalized()
    head_len = 0.18
    line_start = start_v + direction * head_len
    line_end = end_v - direction * head_len
    if (line_end - line_start).length > 0:
        cylinder_between(f"{name} line", line_start, line_end, radius, mat)
    cone_at(f"{name} head a", start_v, -direction, mat)
    cone_at(f"{name} head b", end_v, direction, mat)


def label_text(body, location, size, mat, camera):
    bpy.ops.object.text_add(location=location)
    text = bpy.context.object
    text.name = body
    text.data.body = body
    text.data.align_x = "CENTER"
    text.data.align_y = "CENTER"
    text.data.size = size
    text.data.extrude = 0.006
    text.rotation_euler = camera.rotation_euler
    text.data.materials.append(mat)
    return text


def setup_camera_and_lights():
    bpy.ops.object.light_add(type="AREA", location=(0, -4.5, 5.5))
    key = bpy.context.object
    key.name = "large softbox"
    key.data.energy = 450
    key.data.size = 5.0

    bpy.ops.object.light_add(type="POINT", location=(-4, 3, 4))
    fill = bpy.context.object
    fill.name = "soft fill"
    fill.data.energy = 55

    bpy.ops.object.camera_add(location=(7.3, -5.2, 3.4))
    camera = bpy.context.object
    look_at(camera, (0, 0, 0))
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 9.8
    bpy.context.scene.camera = camera
    return camera


def add_dimensions(camera):
    dark = create_material("annotation dark", (0.04, 0.045, 0.05, 1), 0.0, 0.5)

    arrow_between("length 8 mm", (-4, -1.65, -1.18), (4, -1.65, -1.18), dark)
    cylinder_between("length ext left", (-4, -1.0, -1.0), (-4, -1.78, -1.18), 0.018, dark)
    cylinder_between("length ext right", (4, -1.0, -1.0), (4, -1.78, -1.18), 0.018, dark)
    label_text("8 mm", (0, -2.08, -1.02), 0.34, dark, camera)

    arrow_between("width 2 mm", (4.62, -1, -1.16), (4.62, 1, -1.16), dark)
    cylinder_between("width ext near", (4, -1, -1.0), (4.78, -1, -1.16), 0.018, dark)
    cylinder_between("width ext far", (4, 1, -1.0), (4.78, 1, -1.16), 0.018, dark)
    label_text("2 mm", (5.12, 0, -1.02), 0.28, dark, camera)

    arrow_between("height 2 mm", (-4.45, -1.38, -1), (-4.45, -1.38, 1), dark)
    cylinder_between("height ext bottom", (-4, -1, -1), (-4.58, -1.5, -1), 0.018, dark)
    cylinder_between("height ext top", (-4, -1, 1), (-4.58, -1.5, 1), 0.018, dark)
    label_text("2 mm", (-4.92, -1.72, 0), 0.28, dark, camera)

    cylinder_between("chamfer leader", (2.8, -2.0, 1.55), (3.84, -1.06, 0.98), 0.02, dark)
    cone_at("chamfer leader head", (3.84, -1.06, 0.98), Vector((3.84, -1.06, 0.98)) - Vector((2.8, -2.0, 1.55)), dark)
    label_text("C0.2 mm", (2.45, -2.22, 1.68), 0.28, dark, camera)


def add_floor():
    mat = create_material("matte floor", (0.86, 0.88, 0.89, 1), 0.0, 0.55)
    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, -1.45))
    floor = bpy.context.object
    floor.name = "matte reference floor"
    floor.data.materials.append(mat)


def configure_scene():
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 0.001
    scene.unit_settings.length_unit = "MILLIMETERS"
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 96
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1800
    scene.render.resolution_y = 1200
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.world = bpy.data.worlds.new("light gray world") if scene.world is None else scene.world
    scene.world.color = (1.0, 1.0, 1.0)


def main():
    clear_scene()
    configure_scene()
    create_beveled_block()
    camera = setup_camera_and_lights()
    add_floor()
    add_dimensions(camera)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    bpy.context.scene.render.filepath = PNG_PATH
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
