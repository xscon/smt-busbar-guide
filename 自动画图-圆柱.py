import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
from mpl_toolkits.mplot3d import Axes3D
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
import os  # 添加这行导入

# 全局参数设置
PARAMS = {
    # 尺寸参数 (Size Parameters)
    'outer_diameter': 4,    # 外径(mm)
    'inner_diameter': 1.5,     # 螺母内径(M3螺纹孔)(mm)
    'three_quarter_diameter': 2,  # 螺母3/4圆外径径(M3螺纹孔)(mm)
    'main_length': 7,       # 主体长度(mm)
    'step_length': 1.53,       # 台阶长度(mm)
    'step_diameter': 2.5,     # 台阶直径(mm)

    # 倒角参数 (Chamfer Parameters)
    'main_chamfer_size': 0.2,  # 主体矩形倒角尺寸
    'step_chamfer_size': 0.4,  # 台阶矩形倒角尺寸

    # 标注参数 (Dimension Parameters)
    'dimension_line_style': '-',    # 标注线样式: '-' 实线, '--' 虚线
    'dimension_line_width': 0.5,    # 标注线宽度
    'dimension_text_offset': 0.2,   # 标注文字偏移距离
    'endpoint_size': 0.15,          # 标注端点线长度
    'dimension_text_color': 'black', # 标注文字颜色
    'dimension_line_color': 'black', # 标注线颜色

    # 视图布局参数 (Layout Parameters)
    'margin': 1.0,             # 2D视图边距
    'dimension_offset': 0.8,   # 尺寸标注整体偏移量
    'title_offset': 1.5,       # 标题偏移量
    'figsize_combined': (12, 8), # 组合视图画布大小
    'wspace': 0.3,            # 子图水平间距
    'hspace': 0.0,            # 子图垂直间距

    # 3D图参数 (3D View Parameters)
    'max_range_factor': 1.2,   # 3D视图缩放因子
    'view_elev': 30,          # 3D视图仰角
    'view_azim': 45,          # 3D视图方位角
    '3d_face_color': 'white',  # 3D模型面颜色
    '3d_edge_color': 'black',  # 3D模型边线颜色
    '3d_alpha': 1.0,          # 3D模型透明度

    # 文字样式参数 (Text Style Parameters)
    'title_font_size': 10,     # 标题字体大小
    'dimension_font_size': 8,  # 标注文字字体大小
    'font_family': 'sans-serif', # 字体族

    # 输出参数 (Output Parameters)
    'dpi': 300,               # 输出图像DPI
    'bbox_inches': 'tight',   # 输出图像边界裁剪

    # 在PARAMS中添加或调整这些参数
    'dimension_line_width': 0.5,     # 标注线宽度
    'dimension_font_size': 8,        # 标注文字大小
    'dimension_text_offset': 0.2,    # 文字偏移距离
    'arrow_length': 0.8,             # 箭头长度

    # 剖面线参数 (Hatch Parameters)
    'hatch_spacing': 0.3,        # 剖面线间距
    'hatch_angle': 45,           # 剖面线角度
    'hatch_linewidth': 0.5,      # 剖面线线宽
}

# 修改默认保存路径为当前用户的桌面
DEFAULT_SAVE_PATH = os.path.join(os.path.expanduser('~'), 'Desktop')

# 修改文件命名格式
def get_filename(params):
    """根据参数生成文件名"""
    outer_d = str(params['outer_diameter']).replace('.', '')
    length = str(params['main_length']).replace('.', '')
    return f"M{outer_d}{length}.png"

# 添加螺纹规格对照表
THREAD_SPECS = {
    1.0: '×0.25',    # M1
    1.2: '×0.25',    # M1.2
    1.4: '×0.3',     # M1.4
    1.6: '×0.35',    # M1.6
    2.0: '×0.4',     # M2
    2.5: '×0.45',    # M2.5
    3.0: '×0.5',     # M3
    3.5: '×0.6',     # M3.5
    4.0: '×0.7',     # M4
}

def create_circle_view(ax, center_x, center_y, diameter, inner_diameter=None, fill=False):
    """
    创建圆形视图

    Parameters:
        ax (matplotlib.axes.Axes): 绘图轴对象
        center_x (float): 圆心x坐标
        center_y (float): 圆心y坐标
        diameter (float): 外径
        inner_diameter (float, optional): 内径
        fill (bool): 是否填充

    Returns:
        None
    """
    # 外圆
    outer_circle = patches.Circle((center_x, center_y), diameter/2,
                                fill=fill, color='black')
    ax.add_patch(outer_circle)

    # 3/4圆
    three_quarter_diameter = PARAMS['three_quarter_diameter']
    # 创建3/4圆弧 (从0度开始，到270度结束，逆时针方向)
    three_quarter_circle = patches.Arc((center_x, center_y),
                                     three_quarter_diameter,
                                     three_quarter_diameter,
                                     theta1=0, theta2=270,
                                     color='black')
    ax.add_patch(three_quarter_circle)

    # 内圆（如果有）
    if inner_diameter is not None:
        inner_circle = patches.Circle((center_x, center_y), inner_diameter/2,
                                    fill=fill, color='black')
        ax.add_patch(inner_circle)

        # 修改：根据three_quarter_diameter查找对应的螺距
        three_quarter_diameter = PARAMS['three_quarter_diameter']
        # 查找最接近的规格
        thread_pitch = THREAD_SPECS.get(three_quarter_diameter, '×0.5')  # 默认值为'×0.5'
        thread_text = f'M{three_quarter_diameter}{thread_pitch}'

        # 计算3/4圆上的点的位置（45度角处）
        angle = np.pi/4  # 45度
        point_x = center_x + (three_quarter_diameter/2) * np.cos(angle)
        point_y = center_y + (three_quarter_diameter/2) * np.sin(angle)

        # 计算箭头起点（稍微远离3/4圆的位置）
        arrow_start_x = point_x + 0.3
        arrow_start_y = point_y + 0.3

        # 使用annotate绘制箭头（指向3/4圆）
        ax.annotate('',
                   xy=(point_x, point_y),  # 箭头终点（3/4圆上的点）
                   xytext=(arrow_start_x, arrow_start_y),  # 箭头起点
                   arrowprops=dict(arrowstyle='->', color='black', linewidth=0.5))

        # 计算文字位置和延长线终点
        text_offset_x = 2.0  # 文字水平偏移
        text_offset_y = 2.0  # 文字垂直偏
        text_x = point_x + text_offset_x
        text_y = point_y + text_offset_y

        # 绘制延长线（从箭头起点到文字下方）
        ax.plot([arrow_start_x, text_x], [arrow_start_y, text_y + 0.3],
                '-', color='black', linewidth=0.5)

        # 添加文字
        ax.text(text_x, text_y + 0.4,
                thread_text,
                ha='left', va='bottom',
                fontsize=PARAMS['dimension_font_size'])

    # 添加中心线
    margin = PARAMS['margin']
    # 水平中心线
    ax.plot([center_x - diameter/2 - margin, center_x + diameter/2 + margin],
            [center_y, center_y], '--', color='black', linewidth=0.5)
    # 垂直中心线
    ax.plot([center_x, center_x],
            [center_y - diameter/2 - margin, center_y + diameter/2 + margin],
            '--', color='black', linewidth=0.5)

def create_side_view(ax, params):
    """创建图（带圆弧倒角）"""
    total_length = get_total_length(params)  # 计算总长度
    step_length = params['step_length']
    outer_diameter = params['outer_diameter']
    step_diameter = params['step_diameter']
    inner_diameter = params['inner_diameter']
    thread_radius = inner_diameter/2
    main_chamfer = min(params['main_chamfer_size'], outer_diameter/2 - 1e-4, params['main_length'] - 1e-4)  # 主体倒角
    step_chamfer = min(params['step_chamfer_size'], step_diameter/2 - 1e-4, step_length - 1e-4)  # 台阶倒角
    main_chamfer = max(main_chamfer, 0)
    step_chamfer = max(step_chamfer, 0)
    draw_step_chamfer = _display_step_chamfer(step_chamfer, step_length, step_diameter)
    step_chamfer_x = total_length - draw_step_chamfer
    step_top = step_diameter / 2
    step_bottom = -step_diameter / 2

    # 修改倒角绘制部分，统一线条宽度
    # 左边主体倒角（圆弧）
    # 上倒角
    arc_upper_left = patches.Arc((main_chamfer, outer_diameter/2 - main_chamfer),
                                main_chamfer*2, main_chamfer*2,
                                theta1=90, theta2=180,
                                color='black',
                                linewidth=1.0)  # 添加linewidth参数
    ax.add_patch(arc_upper_left)

    # 下倒角
    arc_lower_left = patches.Arc((main_chamfer, -outer_diameter/2 + main_chamfer),
                                main_chamfer*2, main_chamfer*2,
                                theta1=180, theta2=270,
                                color='black',
                                linewidth=1.0)  # 添加linewidth参数
    ax.add_patch(arc_lower_left)

    # 修改连接线的线宽，确保统一
    line_width = 1.0  # 定义统一的线宽

    # 左边竖线
    ax.plot([0, 0],
            [-outer_diameter/2 + main_chamfer, outer_diameter/2 - main_chamfer],
            '-', color='black', linewidth=line_width)

    # 上横线
    ax.plot([main_chamfer, total_length-step_length],
            [outer_diameter/2, outer_diameter/2],
            '-', color='black', linewidth=line_width)

    # 下横线
    ax.plot([main_chamfer, total_length-step_length],
            [-outer_diameter/2, -outer_diameter/2],
            '-', color='black', linewidth=line_width)

    # 添加上半部分斜线填充
    def add_hatches(x_start, x_end, y_bottom, y_top, spacing=0.4):
        """添加斜线填充"""
        angle = 45
        dx = spacing / np.cos(np.radians(angle))
        x_range = np.arange(x_start - (y_top - y_bottom), x_end + dx, dx)

        for x in x_range:
            y1 = y_bottom
            y2 = y_top
            x1 = x
            x2 = x + (y_top - y_bottom) * np.tan(np.radians(angle))

            if x1 < x_start:
                y1 = y_bottom + (x_start - x1) / np.tan(np.radians(angle))
                x1 = x_start
            if x2 > x_end:
                y2 = y_top - (x2 - x_end) / np.tan(np.radians(angle))
                x2 = x_end

            if x1 <= x_end and x2 >= x_start:
                ax.plot([x1, x2], [y1, y2], 'k-', linewidth=0.5)

    # 为上半部分添加斜线填充
    add_hatches(0, total_length-step_length,
               thread_radius, outer_diameter/2,
               spacing=0.4)

    # 为台阶上半部分添加斜填充
    add_hatches(total_length-step_length, step_chamfer_x,
               thread_radius, step_top,
               spacing=0.4)

    # 在斜线区域底部绘制锯齿线
    draw_sawtooth_line(ax, 0, total_length-step_length,
                      y=thread_radius,  # 添加y参数
                      tooth_height=0.15,
                      tooth_width=0.4)
    # 在台阶部分底部绘制锯齿线
    draw_sawtooth_line(ax, total_length-step_length, step_chamfer_x,
                      y=thread_radius,  # 添加y参数
                      tooth_height=0.15,
                      tooth_width=0.4)

    # 添加中心线
    ax.plot([-params['margin'], total_length + params['margin']], [0, 0],
            '--', color='black', linewidth=0.5)

    # 绘制图形外部的虚线部分（左）
    ax.plot([-params['margin'], 0], [0, 0],
            '--', color='black', linewidth=0.5)

    # 绘制图形内部的实线部分
    ax.plot([0, total_length], [0, 0],
            '-', color='black', linewidth=0.5)

    # 绘制图形外部的虚线部分（右边）
    ax.plot([total_length, total_length + params['margin']], [0, 0],
            '--', color='black', linewidth=0.5)

    _redraw_step_outline(ax, total_length, step_length, outer_diameter, step_diameter, draw_step_chamfer)

def _display_step_chamfer(step_chamfer, step_length, step_diameter):
    """收短右端倒角的显示长度，避免小头斜切视觉过重。"""
    if step_chamfer <= 1e-4:
        return 0
    return min(step_chamfer * 0.45, step_length * 0.16, step_diameter * 0.055)

def _redraw_step_outline(ax, total_length, step_length, outer_diameter, step_diameter, step_chamfer):
    """重描台阶外轮廓，避免台阶线被剖面线/螺纹线压住。"""
    shoulder_x = total_length - step_length
    chamfer_x = total_length - step_chamfer
    outer_radius = outer_diameter / 2
    step_radius = step_diameter / 2
    step_bottom = -step_radius
    line_width = 1.0

    ax.plot([shoulder_x, shoulder_x], [step_radius, outer_radius],
            '-', color='black', linewidth=line_width, zorder=8)
    ax.plot([shoulder_x, shoulder_x], [-outer_radius, -step_radius],
            '-', color='black', linewidth=line_width, zorder=8)
    ax.plot([shoulder_x, chamfer_x], [step_radius, step_radius],
            '-', color='black', linewidth=line_width, zorder=8)
    ax.plot([shoulder_x, chamfer_x], [step_bottom, step_bottom],
            '-', color='black', linewidth=line_width, zorder=8)
    if step_chamfer > 1e-4:
        ax.plot([chamfer_x, total_length], [step_radius, step_radius - step_chamfer],
                '-', color='black', linewidth=line_width, zorder=8)
        ax.plot([chamfer_x, total_length], [step_bottom, step_bottom + step_chamfer],
                '-', color='black', linewidth=line_width, zorder=8)
        ax.plot([total_length, total_length],
                [step_bottom + step_chamfer, step_radius - step_chamfer],
                '-', color='black', linewidth=line_width, zorder=8)
    else:
        ax.plot([total_length, total_length],
                [step_bottom, step_radius],
                '-', color='black', linewidth=line_width, zorder=8)

def draw_sawtooth_line(ax, x_start, x_end, y, tooth_height=0.15, tooth_width=0.4):
    """绘制锯齿线和斜线填充
    x_start: 起始x坐标
    x_end: 结束x坐标
    y: y坐标（锯齿线的基高度）
    tooth_height: 锯齿高度
    tooth_width: 锯齿宽度
    """
    # 计算要的完整锯齿数量
    length = x_end - x_start
    if length <= 0:
        return
    num_teeth = max(1, int(length / tooth_width))
    # 调整锯齿宽度以确保均匀分布
    adjusted_width = length / num_teeth

    # 计算斜线的水平移量（减小角度）
    slope_factor = 0.2  # 减小这个值会使斜线更平缓

    for i in range(num_teeth):
        x = x_start + i * adjusted_width
        next_x = x_start + (i + 1) * adjusted_width
        mid_x = x + adjusted_width/2

        # 绘制锯齿的两条线
        ax.plot([x, mid_x], [y, y - tooth_height], '-', color='black', linewidth=1.0)
        ax.plot([mid_x, next_x], [y - tooth_height, y], '-', color='black', linewidth=1.0)

        # 计算斜线的终点x坐标（确保不超出图形区域）
        x_offset_peak = min(x + abs(y) * slope_factor, next_x)  # 从凸点开始的斜线
        x_offset_valley = min(mid_x + abs(y - tooth_height) * slope_factor, next_x)  # 从凹点开始的斜线

        # 添加从锯齿到中轴线的斜线
        # 从锯齿凸点到中轴线的斜线
        ax.plot([x, x_offset_peak], [y, 0], '-', color='black', linewidth=0.5)
        # 从锯齿凹点到中轴线的斜线
        ax.plot([mid_x, x_offset_valley], [y - tooth_height, 0], '-', color='black', linewidth=0.5)

        # 最后一个锯齿的终点斜线
        if i == num_teeth - 1:
            x_offset_end = min(next_x + abs(y) * slope_factor, x_end)
            ax.plot([next_x, x_offset_end], [y, 0], '-', color='black', linewidth=0.5)

def _draw_2d_views(ax_front, ax_side, params):
    """绘制2D视图"""
    # 计算总长度
    total_length = get_total_length(params)
    
    # 前视图（圆形）- 修改这里使用计算的总长度
    create_circle_view(ax_front, total_length/2, total_length/2,
                      params['outer_diameter'], params['inner_diameter'])

    # 侧视图
    create_side_view(ax_side, params)

    # 添加尺寸标注
    _add_dimensions(ax_front, ax_side, params)

def _add_dimensions(ax_front, ax_side, params):
    """添加尺寸标注"""
    total_length = get_total_length(params)  # 计算总长度
    
    # 恢复左视图（前视图）的外径标注
    _draw_horizontal_diameter_dimension(
        ax_front,
        total_length/2,  # 使用计算的总长度
        total_length/2,
        params['outer_diameter'],
        offset=params['outer_diameter']/2 + 1.0
    )

    # 侧视图标注
    # 1. 主体长度标注 - 移到顶部
    _draw_dimension_line(ax_side, (0, 0),
                        (params['main_length'], 0),
                        params['main_length'],
                        offset=-params['outer_diameter']/2 - 2.0)

    # 2. 台阶长度标注 - 移到底部
    _draw_dimension_line(ax_side,
                        (total_length-params['step_length'], 0),
                        (total_length, 0),
                        params['step_length'],
                        offset=params['outer_diameter']/2 + 2.0)

    # 3. 外径标注 - 垂直方向（移到左侧外部）
    _draw_dimension_line(ax_side,
                        (0, -params['outer_diameter']/2),
                        (0, params['outer_diameter']/2),
                        params['outer_diameter'],
                        offset=3.0,
                        direction='vertical')

    # 4. 台阶直径标注 - 垂直方向（移到右侧外部）
    _draw_dimension_line(ax_side,
                        (total_length, -params['step_diameter']/2),
                        (total_length, params['step_diameter']/2),
                        params['step_diameter'],
                        offset=-3.0,
                        direction='vertical')

def _draw_horizontal_diameter_dimension(ax, center_x, center_y, diameter, offset):
    """绘制水平直径标注"""
    radius = diameter/2
    line_style = PARAMS['dimension_line_style']
    line_width = PARAMS['dimension_line_width']
    text_offset = 0.5  # 文字与标注线的垂直距离

    # 计算延伸线的终点位置（延伸到文字位置）
    extension_length = offset + text_offset + 0.3  # 延伸线总长度

    # 绘制左右延伸线，从的边缘开始延伸到文字位置
    ax.plot([center_x - radius, center_x - radius],
            [center_y, center_y - extension_length],  # 延伸到文字位置
            line_style, color='black', linewidth=line_width)
    ax.plot([center_x + radius, center_x + radius],
            [center_y, center_y - extension_length],  # 延伸到文字位置
            line_style, color='black', linewidth=line_width)

    # 绘制水平注线
    ax.plot([center_x - radius, center_x + radius],
            [center_y - offset, center_y - offset],
            line_style, color='black', linewidth=line_width)

    # 添加尺寸文字
    ax.text(center_x, center_y - offset - text_offset,
            f'Φ{diameter}±0.10',
            ha='center', va='top',
            fontsize=PARAMS['dimension_font_size'])

def _draw_dimension_line(ax, start, end, dimension, offset, direction='horizontal'):
    """绘制标注线"""
    line_style = PARAMS['dimension_line_style']
    line_width = PARAMS['dimension_line_width']
    endpoint_size = PARAMS['endpoint_size']
    text_offset = PARAMS['dimension_text_offset']

    # 根据不同类型的尺寸生成不同的标注文字
    if direction == 'vertical' and dimension == PARAMS['step_diameter']:
        dimension_text = f'Φ{dimension}±0.05'  # 台阶直径标注
    elif direction == 'vertical' and dimension == PARAMS['outer_diameter']:
        dimension_text = f'Φ{dimension}±0.10'  # 外径标注
    else:
        dimension_text = f'{dimension}±0.05'  # 其他尺寸标注

    if direction == 'horizontal':
        y = start[1] - offset
        # 绘制主标注线
        ax.plot([start[0], end[0]], [y, y], line_style,
                color=PARAMS['dimension_line_color'], linewidth=line_width)
        # 绘制两端的垂直线
        ax.plot([start[0], start[0]], [start[1], y], line_style,
                color=PARAMS['dimension_line_color'], linewidth=line_width)
        ax.plot([end[0], end[0]], [end[1], y], line_style,
                color=PARAMS['dimension_line_color'], linewidth=line_width)

        # 绘制端点短线
        ax.plot([start[0], start[0]], [y - endpoint_size/2, y + endpoint_size/2],
                line_style, color=PARAMS['dimension_line_color'], linewidth=line_width)
        ax.plot([end[0], end[0]], [y - endpoint_size/2, y + endpoint_size/2],
                line_style, color=PARAMS['dimension_line_color'], linewidth=line_width)

        # 根据偏移量的正负决定文字位置
        if offset > 0:  # 标注在下方
            text_y = y - text_offset
            va = 'top'
        else:  # 标注在上方
            text_y = y + text_offset
            va = 'bottom'

        # 添加尺寸文字
        ax.text((start[0] + end[0])/2, text_y,
                dimension_text,
                ha='center', va=va,
                color=PARAMS['dimension_text_color'],
                fontsize=PARAMS['dimension_font_size'],
                rotation=0)
    else:  # vertical
        x = start[0] - offset
        # 绘制主标注线
        ax.plot([x, x], [start[1], end[1]], line_style,
                color=PARAMS['dimension_line_color'], linewidth=line_width)
        # 绘制两端的水平线
        ax.plot([start[0], x], [start[1], start[1]], line_style,
                color=PARAMS['dimension_line_color'], linewidth=line_width)
        ax.plot([end[0], x], [end[1], end[1]], line_style,
                color=PARAMS['dimension_line_color'], linewidth=line_width)

        # 绘制端点短线
        ax.plot([x - endpoint_size/2, x + endpoint_size/2], [start[1], start[1]],
                line_style, color=PARAMS['dimension_line_color'], linewidth=line_width)
        ax.plot([x - endpoint_size/2, x + endpoint_size/2], [end[1], end[1]],
                line_style, color=PARAMS['dimension_line_color'], linewidth=line_width)

        # 调整文字位置和对齐方式
        if offset < 0:  # 右侧标注
            ha = 'left'
            x_text = x + text_offset
        else:  # 左侧标注
            ha = 'right'
            x_text = x - text_offset

        # 添加尺寸文字 - 垂直方向保持90度旋转
        ax.text(x_text, (start[1] + end[1])/2, dimension_text,
                ha=ha, va='center', color=PARAMS['dimension_text_color'],
                fontsize=PARAMS['dimension_font_size'], rotation=90)

# 添加一个辅助函数来计算总长度
def get_total_length(params):
    """计算总长度"""
    return params['main_length'] + params['step_length']

def create_combined_views(params=PARAMS, save_path=None):
    """建组合视图（主数）"""
    # 调整图形大小和比例
    fig = plt.figure(figsize=(8, 4), facecolor='none')  # 减小整体尺寸

    # 调整子图布局
    gs = fig.add_gridspec(1, 2,
                         width_ratios=[1, 1],
                         left=0.15, right=0.85,  # 调整左右边距
                         bottom=0.15, top=0.85,  # 整上下边距
                         wspace=0.3)  # 减小子图间距

    # 创建子图，设置透明背景
    ax_front = fig.add_subplot(gs[0], facecolor='none')
    ax_side = fig.add_subplot(gs[1], facecolor='none')

    # 绘制2D视图
    _draw_2d_views(ax_front, ax_side, params)

    # 设置视图属性
    for ax in [ax_front, ax_side]:
        ax.set_aspect('equal')
        ax.grid(False)
        ax.set_xticks([])
        ax.set_yticks([])
        # 移除所有边框
        for spine in ax.spines.values():
            spine.set_visible(False)

    # 调整布局
    plt.tight_layout()

    # 保存图片
    if save_path:
        # 确保保存路径的目录存在
        save_dir = os.path.dirname(save_path)
        if not os.path.exists(save_dir):
            os.makedirs(save_dir)

        # 保存图片，确保明背景
        plt.savefig(save_path,
                   dpi=params['dpi'],
                   bbox_inches='tight',
                   transparent=True,  # 置透明背景
                   facecolor='none')  # 确保背景透明
        print(f"图片已存至: {save_path}")

    plt.show()

# 更新PARAMS中的相关参数
PARAMS.update({
    'figsize_combined': (12, 6),   # 加图形宽度，给标注留更多空间
    'margin': 3.0,                # 增加边距
    'dimension_font_size': 8,     # 保持字体大小
    'dimension_line_width': 0.5,  # 保持线条宽度
    'dimension_text_offset': 0.3, # 文字偏移
    'wspace': 0.5,               # 增加子图间距
    'dimension_offset': 2.0,      # 增加基础标注偏移量
})

if __name__ == '__main__':
    # 以在这里修改参数
    custom_params = PARAMS.copy()

    # 根据尺寸生成文件名
    filename = get_filename(custom_params)

    # 设置保存路径（使用os.path.join来正确处理路径）
    save_path = os.path.join(DEFAULT_SAVE_PATH, filename)

    try:
        # 创建、显示并保存图片
        create_combined_views(custom_params, save_path)
    except Exception as e:
        print(f"发生错误: {str(e)}")
        # 尝试保存到当前目录
        current_dir = os.path.dirname(os.path.abspath(__file__))
        save_path = os.path.join(current_dir, filename)
        print(f"尝试保存到当前目录: {save_path}")
        create_combined_views(custom_params, save_path)
