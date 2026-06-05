document.addEventListener('DOMContentLoaded', () => {
    // 缩放控制
    let currentZoom = 1;
    const zoomStep = 0.1;
    const drawingPaper = document.getElementById('drawing-container');
    const zoomLevelText = document.getElementById('zoom-level');
    let drawPromise = Promise.resolve();
    const DEFAULT_ISO_ANGLE = 'e_rotate_x180';
    const DEFAULT_DRAWING_DATE = '2025-6-12';
    const MATERIAL_CODES = [
        { keywords: ['黄铜'], code: 'B', en: 'Brass' },
        { keywords: ['紫铜'], code: 'Z', en: 'T2 copper' },
        { keywords: ['锰钢'], code: 'M', en: 'Manganese steel' }
    ];
    const PLATING_CODES = [
        { keywords: ['镀雾锡', '雾锡'], code: 'MT', en: 'Matte tin plating' },
        { keywords: ['镀镍', '镍'], code: 'N', en: 'Ni plating' },
        { keywords: ['镀金', '金'], code: 'G', en: 'Gold plating' },
        { keywords: ['亮锡'], code: 'T', en: 'Bright tin plating' }
    ];
    const PACK_CODES = [
        { keywords: ['编带', 'T&R', 'T＆R', '02'], code: '02', en: 'T&R' },
        { keywords: ['袋装', '散装', '01'], code: '01', en: 'Bag' }
    ];

    document.getElementById('btn-zoom-in').addEventListener('click', () => {
        if (currentZoom < 3) {
            currentZoom += zoomStep;
            updateZoom();
        }
    });

    document.getElementById('btn-zoom-out').addEventListener('click', () => {
        if (currentZoom > 0.3) {
            currentZoom -= zoomStep;
            updateZoom();
        }
    });

    // 鼠标滚轮缩放
    const canvasWrapper = document.querySelector('.canvas-wrapper');
    canvasWrapper.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.deltaY < 0 && currentZoom < 3) {
                currentZoom += zoomStep;
            } else if (e.deltaY > 0 && currentZoom > 0.3) {
                currentZoom -= zoomStep;
            }
            updateZoom();
        }
    });

    function updateZoom() {
        drawingPaper.style.transform = `scale(${currentZoom})`;
        zoomLevelText.textContent = `${Math.round(currentZoom * 100)}%`;
    }

    function getSelectedIsoAngle() {
        const angleInput = document.getElementById('input-angle');
        return angleInput?.value || DEFAULT_ISO_ANGLE;
    }

    function drawIsoErrorSvg() {
        const target = { x: 1980, y: 650, width: 750, height: 540 };
        const maskPad = 24;
        return `
            <rect x="${target.x - maskPad}" y="${target.y - maskPad}" width="${target.width + maskPad * 2}" height="${target.height + maskPad * 2}" class="iso-mask" />
            <text x="${target.x + target.width / 2}" y="${target.y + target.height / 2}" class="note-text" text-anchor="middle">CAD 3D 生成失败</text>
        `;
    }

    async function getIsometricSvg(L, W, T, C) {
        const angle = getSelectedIsoAngle();
        const params = new URLSearchParams({
            l: L.toFixed(4),
            w: W.toFixed(4),
            t: T.toFixed(4),
            c: C.toFixed(4),
            angle: angle
        });
        try {
            const response = await fetch(`/api/iso-svg?${params.toString()}`, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`CAD API ${response.status}`);
            }
            return await response.text();
        } catch (error) {
            console.warn('CAD 3D generation failed.', error);
            return drawIsoErrorSvg();
        }
    }

    function scheduleDraw() {
        drawPromise = draw();
        return drawPromise;
    }

    function resolveCode(value, rules) {
        const text = String(value || '').toUpperCase();
        const rule = rules.find(item => item.keywords.some(keyword => text.includes(keyword.toUpperCase())));
        return rule?.code || '';
    }

    function resolveEnglish(value, rules, fallback) {
        const text = String(value || '').toUpperCase();
        const rule = rules.find(item => item.keywords.some(keyword => text.includes(keyword.toUpperCase())));
        return rule?.en || fallback;
    }

    function formatDimensionLabel(value) {
        return Number(value).toFixed(2).replace(/\.?0+$/, '');
    }

    function hasDecimalPart(value) {
        return Math.abs(value - Math.round(value)) > 1e-6;
    }

    function buildDimensionCode(L, W, T) {
        const values = [L, W, T];
        const useTenths = values.some(hasDecimalPart);
        return values.map(value => {
            if (useTenths) {
                return String(Math.round(value * 10)).padStart(2, '0');
            }
            return String(Math.round(value));
        }).join('');
    }

    function buildPartNumber(L, W, T, mat, plat, pack) {
        const dimensionCode = buildDimensionCode(L, W, T);
        const materialCode = resolveCode(mat, MATERIAL_CODES);
        const platingCode = resolveCode(plat, PLATING_CODES);
        const packCode = resolveCode(pack, PACK_CODES);
        const suffix = materialCode && platingCode && packCode ? `${materialCode}${platingCode}${packCode}` : 'XXX';
        return `BTC-${dimensionCode}-${suffix}`;
    }

    function buildPackingEnglish(mat, plat, pack, partNo) {
        const packLabel = resolveEnglish(pack, PACK_CODES, pack);
        const partSuffix = String(partNo || '').split('-').pop();
        if (/^[A-Z]{1,3}\d{2}$/i.test(partSuffix)) {
            return `${packLabel} (${partSuffix.toUpperCase()})`;
        }

        const materialCode = resolveCode(mat, MATERIAL_CODES);
        const platingCode = resolveCode(plat, PLATING_CODES);
        const packCode = resolveCode(pack, PACK_CODES);
        const suffix = materialCode && platingCode && packCode ? `${materialCode}${platingCode}${packCode}` : '';
        return suffix ? `${packLabel} (${suffix})` : packLabel;
    }

    function isPartNumberAuto() {
        return document.getElementById('input-partno-auto')?.checked !== false;
    }

    function updatePartNumberInputState() {
        const partNoInput = document.getElementById('input-partno');
        partNoInput.readOnly = isPartNumberAuto();
        partNoInput.classList.toggle('input-readonly', isPartNumberAuto());
    }

    function syncPartNumberField() {
        const L = parseFloat(document.getElementById('input-l').value) || 16;
        const W = parseFloat(document.getElementById('input-w').value) || 3;
        const T = parseFloat(document.getElementById('input-t').value) || 2;
        const mat = document.getElementById('input-mat').value || '紫铜';
        const plat = document.getElementById('input-plat').value || '镀雾锡';
        const pack = document.getElementById('input-pack').value || '袋装';
        const partNoInput = document.getElementById('input-partno');
        if (isPartNumberAuto()) {
            partNoInput.value = buildPartNumber(L, W, T, mat, plat, pack);
        }
        updatePartNumberInputState();
        return partNoInput.value.trim();
    }

    function getExportValues() {
        const L = parseFloat(document.getElementById('input-l').value) || 16;
        const W = parseFloat(document.getElementById('input-w').value) || 3;
        const T = parseFloat(document.getElementById('input-t').value) || 2;
        const C = parseFloat(document.getElementById('input-c').value) || 0.2;
        const mat = document.getElementById('input-mat').value || '紫铜';
        const plat = document.getElementById('input-plat').value || '镀雾锡';
        const pack = document.getElementById('input-pack').value || '袋装';
        const partNo = syncPartNumberField() || buildPartNumber(L, W, T, mat, plat, pack);
        return { L, W, T, C, mat, plat, pack, partNo };
    }

    // 绘制图纸
    async function draw() {
        // 获取输入值
        const L = parseFloat(document.getElementById('input-l').value) || 16;
        const W = parseFloat(document.getElementById('input-w').value) || 3;
        const T = parseFloat(document.getElementById('input-t').value) || 2;
        const C = parseFloat(document.getElementById('input-c').value) || 0.2;
        
        const mat = document.getElementById('input-mat').value || '紫铜';
        const plat = document.getElementById('input-plat').value || '镀雾锡';
        const pack = document.getElementById('input-pack').value || '袋装';
        const partNo = syncPartNumberField() || buildPartNumber(L, W, T, mat, plat, pack);
        const design = document.getElementById('input-design').value || 'XIAO';
        const materialEn = resolveEnglish(mat, MATERIAL_CODES, mat);
        const platingEn = resolveEnglish(plat, PLATING_CODES, plat);
        const packEn = buildPackingEnglish(mat, plat, pack, partNo);
        
        const date = DEFAULT_DRAWING_DATE;

        // SVG 参数设置 (A4比例 2970x2100)
        const vbW = 2970;
        const vbH = 2100;
        const margin = 100;
        
        // 智能缩放逻辑：自适应填充画布左侧区域
        // 左侧留给 2D 视图的总宽度大约是 1600 像素，高度约 1500
        let scale = 1300 / (L + T);
        scale = Math.min(scale, 1000 / W);
        scale = Math.min(scale, 400); // 限制极端放大
        
        const sL = L * scale;
        const sW = W * scale;
        const sT = T * scale;
        const sC = C * scale;

        // 视图位置计算：完美居中算法
        const gap = Math.min(400, Math.max(200, 1600 - (sL + sT))); // 动态间距
        const total2DWidth = sL + gap + sT;
        const startX = Math.max(margin + 250, margin + (1800 - total2DWidth) / 2); // 给左侧尺寸标注预留空间
        
        const frontX = startX;
        const rightX = frontX + sL + gap;
        const frontY = 920 - sW/2; // 垂直居中
        const rightY = frontY;
        const widthDimX = Math.max(margin + 80, frontX - 135);
        const widthLabelWidth = 205;
        const widthLabelX = Math.max(margin + 8, widthDimX - widthLabelWidth / 2);
        const thicknessLabelRightX = rightX + sT - 8;
        const thicknessLabelWidth = 360;
        
        const isoSvg = await getIsometricSvg(L, W, T, C);
        
        // 生成SVG内容
        let svg = `<svg viewBox="0 0 ${vbW} ${vbH}" xmlns="http://www.w3.org/2000/svg">
            <style>
                .t-bold { font-weight: bold; font-family: Arial, sans-serif; }
                .t-norm { font-family: Arial, sans-serif; }
                .line-thick { stroke: #000; stroke-width: 4; fill: none; stroke-linejoin: round; }
                .line-norm { stroke: #000; stroke-width: 2; fill: none; }
                .line-dim { stroke: #000; stroke-width: 1.5; fill: none; }
                .dim-text { font-size: 32px; font-family: Arial, sans-serif; text-anchor: middle; }
                .note-text { font-size: 24px; font-family: Arial, sans-serif; }
                .title-text { font-size: 40px; font-family: Arial, sans-serif; font-weight: bold; }
                .grid-text { font-size: 48px; font-family: Arial, sans-serif; text-anchor: middle; dominant-baseline: central; fill: #555; }
                .bg-white { fill: #fff; }
                .bg-black { fill: #000; }
                .iso-outline { stroke: #000; stroke-width: 2.4; fill: none; stroke-linecap: round; stroke-linejoin: round; }
                .iso-inner { stroke: #000; stroke-width: 2.4; fill: none; stroke-linecap: round; stroke-linejoin: round; }
                .iso-mask { fill: #fff; stroke: none; }
            </style>
            
            <!-- 外边框 -->
            <rect x="${margin}" y="${margin}" width="${vbW - 2*margin}" height="${vbH - 2*margin}" class="line-thick" />
            
            <!-- 网格线和标记 -->
            ${generateGrid(vbW, vbH, margin)}

            <!-- 左视图 (正面) -->
            <g id="front-view">
                <!-- 轮廓: 带有4个倒角的矩形 -->
                <rect x="${frontX}" y="${frontY}" width="${sL}" height="${sW}" rx="${sC}" ry="${sC}" class="line-thick bg-white" />
                
                <!-- 中心线 (可选) -->
                <line x1="${frontX - 20}" y1="${frontY + sW/2}" x2="${frontX + sL + 20}" y2="${frontY + sW/2}" class="line-dim" stroke-dasharray="20,10,5,10" />
                <line x1="${frontX + sL/2}" y1="${frontY - 20}" x2="${frontX + sL/2}" y2="${frontY + sW + 20}" class="line-dim" stroke-dasharray="20,10,5,10" />

                <!-- 尺寸线: 长度 -->
                <line x1="${frontX}" y1="${frontY - 20}" x2="${frontX}" y2="${frontY - 120}" class="line-dim" />
                <line x1="${frontX + sL}" y1="${frontY - 20}" x2="${frontX + sL}" y2="${frontY - 120}" class="line-dim" />
                <line x1="${frontX}" y1="${frontY - 100}" x2="${frontX + sL}" y2="${frontY - 100}" class="line-dim" />
                <!-- 箭头朝外 -->
                <polygon points="${frontX},${frontY-100} ${frontX+15},${frontY-105} ${frontX+15},${frontY-95}" class="bg-black" />
                <polygon points="${frontX+sL},${frontY-100} ${frontX+sL-15},${frontY-105} ${frontX+sL-15},${frontY-95}" class="bg-black" />
                <rect x="${frontX + sL/2 - 120}" y="${frontY - 120}" width="240" height="40" class="bg-white" />
                <text x="${frontX + sL/2}" y="${frontY - 90}" class="dim-text">${L.toFixed(2)} [${(L/25.4).toFixed(2)}"]</text>
                
                <!-- 尺寸线: 宽度 -->
                <line x1="${frontX - 20}" y1="${frontY}" x2="${widthDimX}" y2="${frontY}" class="line-dim" />
                <line x1="${frontX - 20}" y1="${frontY + sW}" x2="${widthDimX}" y2="${frontY + sW}" class="line-dim" />
                <line x1="${widthDimX}" y1="${frontY}" x2="${widthDimX}" y2="${frontY + sW}" class="line-dim" />
                <polygon points="${widthDimX},${frontY} ${widthDimX-5},${frontY+15} ${widthDimX+5},${frontY+15}" class="bg-black" />
                <polygon points="${widthDimX},${frontY+sW} ${widthDimX-5},${frontY+sW-15} ${widthDimX+5},${frontY+sW-15}" class="bg-black" />
                <rect x="${widthLabelX}" y="${frontY + sW/2 - 20}" width="${widthLabelWidth}" height="40" class="bg-white" />
                <text x="${widthLabelX + widthLabelWidth / 2}" y="${frontY + sW/2 + 10}" class="dim-text">${W.toFixed(2)} [${(W/25.4).toFixed(2)}"]</text>
                
                <!-- 倒角尺寸 -->
                ${drawChamferCallout(frontX, frontY, sL, sW, sC, C)}
            </g>

            <!-- 右视图 (侧面) -->
            <g id="right-view">
                <!-- 侧面轮廓为左直右圆 -->
                <path d="M ${rightX} ${rightY} 
                         L ${rightX + sT - sC} ${rightY} 
                         Q ${rightX + sT} ${rightY} ${rightX + sT} ${rightY + sC} 
                         L ${rightX + sT} ${rightY + sW - sC} 
                         Q ${rightX + sT} ${rightY + sW} ${rightX + sT - sC} ${rightY + sW} 
                         L ${rightX} ${rightY + sW} 
                         Z" class="line-thick bg-white" />
                
                <!-- 尺寸线: 厚度 -->
                <line x1="${rightX}" y1="${rightY - 20}" x2="${rightX}" y2="${rightY - 120}" class="line-dim" />
                <line x1="${rightX + sT}" y1="${rightY - 20}" x2="${rightX + sT}" y2="${rightY - 120}" class="line-dim" />
                <line x1="${rightX}" y1="${rightY - 100}" x2="${rightX + sT}" y2="${rightY - 100}" class="line-dim" />
                <polygon points="${rightX},${rightY-100} ${rightX+15},${rightY-105} ${rightX+15},${rightY-95}" class="bg-black" />
                <polygon points="${rightX+sT},${rightY-100} ${rightX+sT-15},${rightY-105} ${rightX+sT-15},${rightY-95}" class="bg-black" />
                <rect x="${thicknessLabelRightX - thicknessLabelWidth}" y="${rightY - 120}" width="${thicknessLabelWidth}" height="40" class="bg-white" />
                <text x="${thicknessLabelRightX}" y="${rightY - 90}" class="dim-text" style="text-anchor: end;">${T.toFixed(2)} [${(T/25.4).toFixed(2)}"]±0.05</text>
            </g>

            <!-- 3D 等轴测视图 (右上角) -->
            <g id="iso-view">
                <!-- L为长(x), W为宽(y), T为厚度(z), C为圆角半径 -->
                ${isoSvg}
            </g>

            <!-- 技术要求文字 -->
            <g id="notes" transform="translate(2050, 1250)">
                <text x="0" y="0" class="note-text" style="font-size: 28px;">1.材质:${mat}, 厚度:${T.toFixed(1)}mm±0.05mm;</text>
                <text x="25" y="35" class="note-text">Material: ${materialEn} T=${T.toFixed(1)}mm±0.05mm</text>
                
                <text x="0" y="80" class="note-text" style="font-size: 28px;">2.表面处理:${plat}; 盐雾;24H</text>
                <text x="25" y="115" class="note-text">Surface treatment: ${platingEn}, Salt spray level 24H</text>
                
                <text x="0" y="160" class="note-text" style="font-size: 28px;">3.未注公差:±0.1mm;</text>
                <text x="25" y="195" class="note-text">Unspecified tolerance: ±0.1mm;</text>
                
                <text x="0" y="240" class="note-text" style="font-size: 28px;">4.符合RoHS、REACH环保要求;</text>
                <text x="25" y="275" class="note-text">RoHS、REACH Compliance</text>
                
                <text x="0" y="320" class="note-text" style="font-size: 28px;">5.包装方式:${pack}</text>
                <text x="25" y="355" class="note-text">Packing: ${packEn}</text>
            </g>

            <!-- 右下角标题栏 -->
            ${drawTitleBlock(margin, vbW, vbH, L, W, T, mat, plat, partNo, design, date, scale)}
            
            <!-- 右上角修订记录栏 -->
            ${drawRevisionBlock(vbW, margin)}

        </svg>`;

        drawingPaper.innerHTML = svg;
    }

    function generateGrid(w, h, m) {
        let grid = '';
        const gw = (w - 2*m) / 8;
        const gh = (h - 2*m) / 6;
        
        for (let i = 1; i < 8; i++) {
            const x = m + i * gw;
            grid += `<line x1="${x}" y1="${m}" x2="${x}" y2="0" class="line-norm" />`;
            grid += `<line x1="${x}" y1="${h - m}" x2="${x}" y2="${h}" class="line-norm" />`;
        }
        for (let i = 0; i < 8; i++) {
            const cx = m + i * gw + gw/2;
            grid += `<text x="${cx}" y="${m - 30}" class="grid-text">${i+1}</text>`;
            grid += `<text x="${cx}" y="${h - m + 30}" class="grid-text">${i+1}</text>`;
        }
        
        const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
        for (let i = 1; i < 6; i++) {
            const y = m + i * gh;
            grid += `<line x1="${m}" y1="${y}" x2="0" y2="${y}" class="line-norm" />`;
            grid += `<line x1="${w - m}" y1="${y}" x2="${w}" y2="${y}" class="line-norm" />`;
        }
        for (let i = 0; i < 6; i++) {
            const cy = m + i * gh + gh/2;
            grid += `<text x="${m - 30}" y="${cy}" class="grid-text">${letters[i]}</text>`;
            grid += `<text x="${w - m + 30}" y="${cy}" class="grid-text">${letters[i]}</text>`;
        }
        return grid;
    }

    function drawChamferCallout(x, y, width, height, radius, value) {
        const label = `4-R${value.toFixed(2)} [R${(value/25.4).toFixed(2)}"]`;
        const textWidth = Math.max(260, label.length * 17);
        const cornerOffset = Math.max(6, Math.min(radius * 0.45, height * 0.25));
        const startX = x + width - cornerOffset;
        const startY = y + height - cornerOffset;
        const elbowX = startX + 70;
        const elbowY = y + height + 78;
        const textX = elbowX + 20;
        const textY = elbowY + 46;

        return `
            <path d="M ${startX} ${startY} L ${elbowX} ${elbowY}" class="line-dim" />
            <polygon points="${startX},${startY} ${startX+13},${startY+3} ${startX+4},${startY+13}" class="bg-black" />
            <rect x="${textX - 10}" y="${textY - 34}" width="${textWidth + 20}" height="44" class="bg-white" />
            <text x="${textX}" y="${textY}" class="dim-text" style="text-anchor: start;">${label}</text>
        `;
    }

    function drawShortIsometricBox(l, w, t, c) {
        const safeL = Math.max(l, 0.1);
        const safeW = Math.max(w, 0.1);
        const safeT = Math.max(t, 0.1);
        const safeR = Math.min(Math.max(c, 0), safeW / 2, safeT / 2);
        const target = { x: 1980, y: 430, width: 750, height: 540 };
        const fmt = (value) => Number(value).toFixed(2);
        const lengthAxis = { x: 36.2 * safeL, y: -20.65 * safeL };
        const widthAxis = { x: 31.3 * safeW, y: 18 * safeW };
        const thicknessAxis = { x: 0, y: 39.4 * safeT };
        const radius = Math.min(safeR, safeW / 2, safeT / 2);

        const point = (u, v, end = 0) => ({
            x: lengthAxis.x * end + widthAxis.x * (u / safeW) + thicknessAxis.x * (v / safeT),
            y: lengthAxis.y * end + widthAxis.y * (u / safeW) + thicknessAxis.y * (v / safeT)
        });

        const frontFace = [
            ['M', point(radius, 0)],
            ['L', point(safeW - radius, 0)],
            ['Q', point(safeW, 0), point(safeW, radius)],
            ['L', point(safeW, safeT - radius)],
            ['Q', point(safeW, safeT), point(safeW - radius, safeT)],
            ['L', point(radius, safeT)],
            ['Q', point(0, safeT), point(0, safeT - radius)],
            ['L', point(0, radius)],
            ['Q', point(0, 0), point(radius, 0)]
        ];
        const rearFace = [
            ['M', point(radius, 0, 1)],
            ['L', point(safeW - radius, 0, 1)],
            ['Q', point(safeW, 0, 1), point(safeW, radius, 1)],
            ['L', point(safeW, safeT - radius, 1)],
            ['Q', point(safeW, safeT, 1), point(safeW - radius, safeT, 1)]
        ];
        const longEdges = [
            [point(radius, 0), point(radius, 0, 1)],
            [point(safeW - radius, 0), point(safeW - radius, 0, 1)],
            [point(safeW, radius), point(safeW, radius, 1)],
            [point(safeW, safeT - radius), point(safeW, safeT - radius, 1)],
            [point(safeW - radius, safeT), point(safeW - radius, safeT, 1)]
        ];
        const allPoints = [
            ...frontFace.flatMap((segment) => segment.slice(1)),
            ...rearFace.flatMap((segment) => segment.slice(1)),
            ...longEdges.flat()
        ];
        const minX = Math.min(...allPoints.map((pointValue) => pointValue.x));
        const maxX = Math.max(...allPoints.map((pointValue) => pointValue.x));
        const minY = Math.min(...allPoints.map((pointValue) => pointValue.y));
        const maxY = Math.max(...allPoints.map((pointValue) => pointValue.y));
        const fit = Math.min(1, target.width / (maxX - minX), target.height / (maxY - minY));
        const modelCenterX = (minX + maxX) / 2;
        const modelCenterY = (minY + maxY) / 2;
        const targetCenterX = target.x + target.width / 2;
        const targetCenterY = target.y + target.height / 2;
        const transform = (pointValue) => ({
            x: targetCenterX + (pointValue.x - modelCenterX) * fit,
            y: targetCenterY + (pointValue.y - modelCenterY) * fit
        });
        const pathData = (segments) => segments.map((segment) => {
            if (segment[0] === 'M' || segment[0] === 'L') {
                const pointValue = transform(segment[1]);
                return `${segment[0]} ${fmt(pointValue.x)} ${fmt(pointValue.y)}`;
            }
            const control = transform(segment[1]);
            const end = transform(segment[2]);
            return `Q ${fmt(control.x)} ${fmt(control.y)} ${fmt(end.x)} ${fmt(end.y)}`;
        }).join(' ');
        const maskPad = 24;
        let svg = `<rect x="${target.x - maskPad}" y="${target.y - maskPad}" width="${target.width + maskPad * 2}" height="${target.height + maskPad * 2}" class="iso-mask" />`;
        svg += `<path d="${pathData(frontFace)}" class="iso-outline" />`;
        svg += `<path d="${pathData(rearFace)}" class="iso-outline" />`;
        longEdges.forEach(([start, end]) => {
            const a = transform(start);
            const b = transform(end);
            svg += `<path d="M ${fmt(a.x)} ${fmt(a.y)} L ${fmt(b.x)} ${fmt(b.y)}" class="iso-outline" />`;
        });
        return svg;
    }

    // CAD风格3D线稿：常规长条基于参考PDF矢量线稿，短件使用真实比例线稿。
    function drawIsometricBox(l, w, t, c) {
        const safeL = Math.max(l, 0.1);
        const safeW = Math.max(w, 0.1);
        const safeT = Math.max(t, 0.1);
        const safeR = Math.min(Math.max(c, 0), safeW / 2, safeT / 2);
        if (safeL <= Math.max(safeW, safeT) * 3) {
            return drawShortIsometricBox(safeL, safeW, safeT, safeR);
        }
        const displayL = Math.min(safeL, 22);
        const target = { x: 1980, y: 430, width: 750, height: 540 };
        const fmt = (value) => Number(value).toFixed(2);
        const template = [
            [[2015.49,791.05],[2585.72,461.70]],
            [[2024.80,791.05],[2594.61,461.70]],
            [[2608.58,461.70],[2700.44,515.04]],
            [[2599.27,461.70],[2691.55,515.04]],
            [[2689.01,513.35],[2116.67,843.97]],
            [[2702.98,537.48],[2130.21,868.10]],
            [[2107.35,868.10],[2012.95,813.49]],
            [[2121.32,843.97],[2026.92,789.78]],
            [[2008.29,802.91],[2008.29,881.65]],
            [[2012.95,810.95],[2012.95,889.69]],
            [[2012.95,889.69],[2107.35,944.30]],
            [[2132.75,942.61],[2132.75,863.87]],
            [[2105.24,942.61],[2105.24,863.87]],
            [[2130.21,944.30],[2702.98,613.68]],
            [[2707.22,605.63],[2707.22,526.89]],
            [[2702.98,613.68],[2702.98,534.94]],
            [[2599.27,461.70],[2597.15,460.85],[2595.03,460.01],[2592.49,460.01],[2589.95,460.01],[2587.84,460.85],[2585.72,461.70]],
            [[2015.49,791.05],[2013.37,792.32],[2011.68,794.02],[2010.41,796.13],[2009.56,798.25],[2008.72,800.37],[2008.72,802.91]],
            [[2608.58,462.12],[2606.46,461.28],[2604.35,460.43],[2601.81,460.43],[2599.27,460.43],[2597.15,461.28],[2595.03,462.12]],
            [[2608.58,461.70],[2604.77,460.01],[2600.96,459.16],[2597.15,458.74],[2593.34,459.16],[2589.53,460.01],[2585.72,461.70]],
            [[2116.67,843.97],[2113.28,846.51],[2110.74,849.05],[2108.20,852.44],[2106.51,856.25],[2105.66,860.06],[2105.24,863.87]],
            [[2702.56,537.05],[2704.68,534.94],[2706.37,531.97],[2707.22,529.01],[2707.22,526.05],[2706.79,522.66],[2705.52,519.70],[2703.41,517.58],[2701.29,515.46],[2698.33,513.77],[2695.36,512.92],[2691.98,512.92],[2689.01,513.77]],
            [[2107.35,868.10],[2111.16,869.79],[2114.97,870.64],[2118.78,871.06],[2122.59,870.64],[2126.40,869.79],[2130.21,868.10]],
            [[2026.92,789.78],[2023.96,788.94],[2020.57,788.94],[2017.61,789.78],[2015.07,791.48],[2012.53,793.17],[2010.41,795.71],[2009.14,798.67],[2008.72,802.06],[2008.72,805.02],[2009.56,807.99],[2011.26,810.95],[2013.37,813.49]],
            [[2024.80,791.05],[2021.42,793.59],[2018.88,796.13],[2016.34,799.52],[2014.64,803.33],[2013.80,807.14],[2013.37,810.95]],
            [[2008.72,881.65],[2009.14,883.76],[2009.99,886.30],[2011.26,888.00],[2013.37,889.27]],
            [[2132.33,863.87],[2131.91,860.06],[2131.06,856.25],[2129.37,852.44],[2126.83,849.05],[2124.29,846.51],[2120.90,843.97]],
            [[2702.56,613.25],[2704.68,611.98],[2705.95,610.29],[2706.79,607.75],[2707.22,605.63]],
            [[2107.35,943.88],[2111.16,945.57],[2114.97,946.42],[2118.78,946.84],[2122.59,946.42],[2126.40,945.57],[2130.21,943.88]],
            [[2707.22,526.89],[2707.22,524.35],[2706.37,522.24],[2705.52,520.12],[2704.25,518.00],[2702.56,516.31],[2700.44,515.04]],
            [[2702.56,534.94],[2702.14,531.13],[2701.29,527.32],[2699.60,523.51],[2697.06,520.12],[2694.52,517.58],[2691.13,515.04]]
        ];
        const allPoints = template.flat();
        const baseFront = [2058.53, 866.52];
        const baseRear = [2637.41, 536.52];
        const axisX = baseRear[0] - baseFront[0];
        const axisY = baseRear[1] - baseFront[1];
        const axisLength = Math.hypot(axisX, axisY);
        const ux = axisX / axisLength;
        const uy = axisY / axisLength;
        const vx = -uy;
        const vy = ux;
        const lengthScale = displayL / 16;
        const sectionScale = Math.max(((safeW / 3) + (safeT / 2)) / 2, 0.4);
        const radiusScale = Math.max(safeR / 0.3, 0.75);

        function transformRaw(point) {
            const dx = point[0] - baseFront[0];
            const dy = point[1] - baseFront[1];
            const along = dx * ux + dy * uy;
            const cross = dx * vx + dy * vy;
            const visualSectionScale = sectionScale * (0.94 + Math.min(radiusScale, 1.5) * 0.06);
            return {
                x: baseFront[0] + ux * along * lengthScale + vx * cross * visualSectionScale,
                y: baseFront[1] + uy * along * lengthScale + vy * cross * visualSectionScale
            };
        }

        const rawPoints = allPoints.map(transformRaw);
        const minX = Math.min(...rawPoints.map((point) => point.x));
        const maxX = Math.max(...rawPoints.map((point) => point.x));
        const minY = Math.min(...rawPoints.map((point) => point.y));
        const maxY = Math.max(...rawPoints.map((point) => point.y));
        const fit = Math.min(1, target.width / (maxX - minX), target.height / (maxY - minY));
        const modelCenterX = (minX + maxX) / 2;
        const modelCenterY = (minY + maxY) / 2;
        const targetCenterX = target.x + target.width / 2;
        const targetCenterY = target.y + target.height / 2;
        const maskPad = 24;
        let svg = `<rect x="${target.x - maskPad}" y="${target.y - maskPad}" width="${target.width + maskPad * 2}" height="${target.height + maskPad * 2}" class="iso-mask" />`;

        function transform(point) {
            const raw = transformRaw(point);
            return [
                targetCenterX + (raw.x - modelCenterX) * fit,
                targetCenterY + (raw.y - modelCenterY) * fit
            ];
        }

        template.forEach((pathPoints) => {
            const commands = pathPoints.map((point, index) => {
                const [x, y] = transform(point);
                return `${index === 0 ? 'M' : 'L'} ${fmt(x)} ${fmt(y)}`;
            }).join(' ');
            svg += `<path d="${commands}" class="iso-outline" />`;
        });

        return svg;
    }

    function drawRevisionBlock(vbW, m) {
        const x = vbW - m - 900;
        const y = m;
        return `
            <g id="revision-block">
                <rect x="${x}" y="${y}" width="900" height="90" class="line-thick" fill="none" />
                <line x1="${x}" y1="${y+45}" x2="${x+900}" y2="${y+45}" class="line-norm" />
                <line x1="${x+200}" y1="${y}" x2="${x+200}" y2="${y+90}" class="line-norm" />
                <line x1="${x+400}" y1="${y}" x2="${x+400}" y2="${y+90}" class="line-norm" />
                <line x1="${x+700}" y1="${y}" x2="${x+700}" y2="${y+90}" class="line-norm" />
                <text x="${x+100}" y="${y+30}" class="note-text" text-anchor="middle">版本/version</text>
                <text x="${x+300}" y="${y+30}" class="note-text" text-anchor="middle">变更内容/ECN</text>
                <text x="${x+550}" y="${y+30}" class="note-text" text-anchor="middle">工程确认/confirmation</text>
                <text x="${x+800}" y="${y+30}" class="note-text" text-anchor="middle">日期/Date</text>
            </g>
        `;
    }

    function drawTitleBlock(m, vbW, vbH, L, W, T, mat, plat, partNo, design, date, scale) {
        const tbW = 2770;
        const tbH = 320;
        const tbX = m;
        const tbY = vbH - m - tbH;
        const rowH = tbH / 3;
        // 计算图纸比例（1mm = 3.7795px 在 SVG 坐标下 scale 表示每mm对应的SVG像素数）
        // SVG viewBox 宽 2970 对应 A4 297mm，故 1 SVG单位 = 0.1mm，实际scale px/mm
        // 我们直接计算一个合适的显示比例
        const nominalScale = Math.round((scale * 0.1) * 10) / 10; // SVG单位到mm
        const scaleLabel = nominalScale >= 1 ? `${Math.round(nominalScale)}:1` : `1:${Math.round(1/nominalScale)}`;
        const itemName = `${formatDimensionLabel(L)}*${formatDimensionLabel(W)}*${formatDimensionLabel(T)} ${mat}${plat} 贴片铜条`;

        const x0 = tbX;
        const x1 = tbX + 230;
        const x2 = tbX + 900;
        const x3 = tbX + 1155;
        const x4 = tbX + 1325;
        const x5 = tbX + 1580;
        const x6 = tbX + 1845;
        const x7 = tbX + 2120;
        const x8 = tbX + 2320;
        const x9 = tbX + 2770;
        const y0 = tbY;
        const y1 = tbY + rowH;
        const y2 = tbY + rowH * 2;
        const y3 = tbY + tbH;
        const rowTextY = (rowIndex, offset = 66) => tbY + rowH * rowIndex + offset;

        return `
            <g id="title-block">
                <rect x="${x0}" y="${tbY}" width="${tbW}" height="${tbH}" class="line-thick" fill="none" />

                <line x1="${x0}" y1="${y1}" x2="${x8}" y2="${y1}" class="line-norm" />
                <line x1="${x0}" y1="${y2}" x2="${x7}" y2="${y2}" class="line-norm" />

                <line x1="${x1}" y1="${tbY}" x2="${x1}" y2="${tbY + tbH}" class="line-thick" />
                <line x1="${x2}" y1="${tbY}" x2="${x2}" y2="${tbY + tbH}" class="line-thick" />
                <line x1="${x3}" y1="${tbY}" x2="${x3}" y2="${tbY + tbH}" class="line-thick" />
                <line x1="${x4}" y1="${tbY}" x2="${x4}" y2="${y2}" class="line-norm" />
                <line x1="${x5}" y1="${tbY}" x2="${x5}" y2="${tbY + tbH}" class="line-thick" />
                <line x1="${x6}" y1="${tbY}" x2="${x6}" y2="${tbY + tbH}" class="line-norm" />
                <line x1="${x7}" y1="${tbY}" x2="${x7}" y2="${tbY + tbH}" class="line-thick" />
                <line x1="${x8}" y1="${tbY}" x2="${x8}" y2="${tbY + tbH}" class="line-thick" />

                <text x="${x0 + 12}" y="${rowTextY(0)}" class="note-text" style="font-size: 28px;">品牌(BRAND)</text>
                <text x="${x0 + 12}" y="${rowTextY(1)}" class="note-text" style="font-size: 28px;">工厂(FACTORY)</text>
                <text x="${x0 + 12}" y="${rowTextY(2)}" class="note-text" style="font-size: 28px;">品名(ITEM NO)</text>

                <image href="image-removebg-preview.png" x="${x1 + 100}" y="${tbY + 22}" width="335" height="62" />
                <text x="${x1 + 470}" y="${tbY + 62}" class="note-text t-bold" style="font-size: 24px;">博众新材</text>

                <text x="${x1 + 12}" y="${rowTextY(1, 52)}" class="title-text" style="font-size: 40px;">东莞市博众新能源材料技术有限公司</text>
                <text x="${x1 + 12}" y="${rowTextY(1, 84)}" class="note-text" style="font-size: 22px;">Dongguan Bozhong New Energy Material Technology Co., Ltd</text>

                <text x="${x1 + 55}" y="${rowTextY(2, 65)}" class="title-text" style="font-size: 36px;">${itemName}</text>

                <text x="${x2 + 12}" y="${rowTextY(0)}" class="note-text" style="font-size: 28px;">页码(SHEET)</text>
                <text x="${(x3 + x4) / 2}" y="${rowTextY(0, 66)}" class="title-text" style="font-size: 40px;" text-anchor="middle">1/1</text>
                <text x="${x4 + 12}" y="${rowTextY(0)}" class="note-text t-bold" style="font-size: 26px;">单位(UNIT):MM</text>

                <text x="${x2 + 12}" y="${rowTextY(1)}" class="note-text" style="font-size: 28px;">版本(REV)</text>
                <text x="${(x3 + x4) / 2}" y="${rowTextY(1, 66)}" class="title-text" style="font-size: 40px;" text-anchor="middle">A1</text>
                <text x="${x4 + 12}" y="${rowTextY(1, 28)}" class="note-text" style="font-size: 26px;">比例(SCALE)</text>
                <text x="${(x4 + x5) / 2}" y="${rowTextY(1, 72)}" class="title-text" style="font-size: 36px;" text-anchor="middle">${scaleLabel}</text>

                <text x="${x2 + 12}" y="${rowTextY(2)}" class="note-text t-bold" style="font-size: 27px;">料号(PART NO)</text>
                <text x="${x3 + 25}" y="${rowTextY(2, 66)}" class="title-text" style="font-size: 36px;">${partNo}</text>

                <text x="${x5 + 12}" y="${rowTextY(0)}" class="note-text" style="font-size: 28px;">日期(DATE)</text>
                <text x="${(x6 + x7) / 2}" y="${rowTextY(0, 66)}" class="title-text" style="font-size: 36px;" text-anchor="middle">${date}</text>

                <text x="${x5 + 12}" y="${rowTextY(1)}" class="note-text t-bold" style="font-size: 28px;">设计(DESIGN)</text>
                <text x="${(x6 + x7) / 2}" y="${rowTextY(1, 66)}" class="title-text" style="font-size: 36px;" text-anchor="middle">${design}</text>

                <text x="${x5 + 12}" y="${rowTextY(2)}" class="note-text t-bold" style="font-size: 28px;">审核(CHECKED)</text>
                <text x="${(x6 + x7) / 2}" y="${rowTextY(2, 66)}" class="title-text" style="font-size: 34px;" text-anchor="middle">HAIJIANG</text>

                <circle cx="${x7 + 70}" cy="${tbY + 48}" r="8" fill="none" stroke="#000" stroke-width="2"/>
                <circle cx="${x7 + 70}" cy="${tbY + 48}" r="17" fill="none" stroke="#000" stroke-width="2"/>
                <line x1="${x7 + 36}" y1="${tbY + 48}" x2="${x7 + 104}" y2="${tbY + 48}" class="line-dim" stroke-dasharray="8,4"/>
                <line x1="${x7 + 70}" y1="${tbY + 21}" x2="${x7 + 70}" y2="${tbY + 75}" class="line-dim" stroke-dasharray="8,4"/>
                <polygon points="${x7 + 120},${tbY + 36} ${x7 + 120},${tbY + 58} ${x7 + 170},${tbY + 68} ${x7 + 170},${tbY + 26}" fill="none" stroke="#000" stroke-width="2"/>
                <line x1="${x7 + 110}" y1="${tbY + 48}" x2="${x7 + 190}" y2="${tbY + 48}" class="line-dim" stroke-dasharray="8,4"/>

                <text x="${(x7 + x8) / 2}" y="${tbY + 142}" class="title-text" style="font-size: 34px;" text-anchor="middle">未注公差</text>
                <text x="${(x7 + x8) / 2}" y="${tbY + 170}" style="font-size: 15px; font-family: Arial;" text-anchor="middle">TOLERANCE UNSPECIFIED</text>
                <text x="${x7 + 72}" y="${tbY + 198}" style="font-size: 17px; font-family: Arial;">X.X      ±0.15</text>
                <text x="${x7 + 72}" y="${tbY + 220}" style="font-size: 17px; font-family: Arial;">X.XX     ±0.10</text>
                <text x="${x7 + 72}" y="${tbY + 242}" style="font-size: 17px; font-family: Arial;">ANG.     ±2°</text>

                <text x="${x8 + 16}" y="${tbY + 42}" style="font-size: 20px; font-family: Arial;">
                    <tspan x="${x8 + 16}" dy="0">These drawings and specifications are</tspan>
                    <tspan x="${x8 + 16}" dy="32">Dongguan Bozhong New Energy CoLtd. The</tspan>
                    <tspan x="${x8 + 16}" dy="32">property should not be copied.</tspan>
                    <tspan x="${x8 + 16}" dy="32">Without Dongguan Bozhong New Energy</tspan>
                    <tspan x="${x8 + 16}" dy="32">Co., Ltd. Prior written consent to copy or</tspan>
                    <tspan x="${x8 + 16}" dy="32">use in any way.</tspan>
                </text>
            </g>
        `;
    }

    function readFileAsDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    function loadExternalScript(src) {
        return new Promise((resolve, reject) => {
            const existing = Array.from(document.scripts).find(script => script.src === src);
            if (existing) {
                existing.addEventListener('load', resolve, { once: true });
                existing.addEventListener('error', reject, { once: true });
                if (existing.dataset.loaded === 'true') resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = () => {
                script.dataset.loaded = 'true';
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async function getJsPdfConstructor() {
        if (window.jspdf?.jsPDF || window.jsPDF) {
            return window.jspdf?.jsPDF || window.jsPDF;
        }
        await loadExternalScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        const JsPDF = window.jspdf?.jsPDF || window.jsPDF;
        if (!JsPDF) {
            throw new Error('jsPDF is not loaded');
        }
        return JsPDF;
    }

    async function inlineSvgImages(svg) {
        const images = Array.from(svg.querySelectorAll('image'));
        await Promise.all(images.map(async image => {
            const href = image.getAttribute('href') || image.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
            if (!href || href.startsWith('data:')) return;
            try {
                const absoluteUrl = new URL(href, window.location.href).href;
                const response = await fetch(absoluteUrl, { cache: 'force-cache' });
                if (!response.ok) throw new Error(`image ${response.status}`);
                const dataUrl = await readFileAsDataUrl(await response.blob());
                image.setAttribute('href', dataUrl);
                image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', dataUrl);
            } catch (error) {
                console.warn('Logo image embedding failed for PDF export.', error);
            }
        }));
    }

    function downloadBlob(blob, filename) {
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function setExportStatus(message, state = '') {
        const status = document.getElementById('export-status');
        status.textContent = message;
        status.classList.toggle('is-success', state === 'success');
        status.classList.toggle('is-error', state === 'error');
    }

    function getDownloadFilename(response, fallback) {
        const disposition = response.headers.get('Content-Disposition') || '';
        const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
        if (utf8Match) {
            return decodeURIComponent(utf8Match[1]);
        }
        const asciiMatch = disposition.match(/filename="([^"]+)"/i);
        return asciiMatch?.[1] || fallback;
    }

    async function savePdfToServer(filename, blob) {
        const data = await readFileAsDataUrl(blob);
        const response = await fetch('/api/save-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, data })
        });
        if (!response.ok) {
            throw new Error(await response.text());
        }
        return response.json();
    }

    async function exportCurrentSvgToPdf(filename) {
        const sourceSvg = document.querySelector('#drawing-container svg');
        if (!sourceSvg) {
            throw new Error('Drawing SVG not found');
        }

        const clone = sourceSvg.cloneNode(true);
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
        clone.setAttribute('width', '2970');
        clone.setAttribute('height', '2100');

        const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        background.setAttribute('x', '0');
        background.setAttribute('y', '0');
        background.setAttribute('width', '2970');
        background.setAttribute('height', '2100');
        background.setAttribute('fill', '#fff');
        clone.insertBefore(background, clone.firstChild);

        await inlineSvgImages(clone);

        const serialized = new XMLSerializer().serializeToString(clone);
        const svgBlob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);
        const image = new Image();
        const imageLoaded = new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = reject;
        });
        image.src = svgUrl;
        await imageLoaded;

        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = 2970 * scale;
        canvas.height = 2100 * scale;
        const context = canvas.getContext('2d');
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(svgUrl);

        const JsPDF = await getJsPdfConstructor();
        const pdf = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 297, 210, undefined, 'FAST');
        const pdfBlob = pdf.output('blob');
        const saved = await savePdfToServer(filename, pdfBlob);
        downloadBlob(pdfBlob, saved.filename || filename);
        return saved;
    }

    async function exportModel(format) {
        const values = getExportValues();
        const params = new URLSearchParams({
            format,
            l: values.L.toFixed(4),
            w: values.W.toFixed(4),
            t: values.T.toFixed(4),
            c: values.C.toFixed(4),
            partNo: values.partNo
        });
        const response = await fetch(`/api/export-model?${params.toString()}`, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(await response.text());
        }
        const blob = await response.blob();
        const filename = getDownloadFilename(response, `${values.partNo}.${format}`);
        downloadBlob(blob, filename);
        return {
            filename,
            path: decodeURIComponent(response.headers.get('X-Output-Path') || `output/${format}/${filename}`)
        };
    }

    async function runExport(button, busyText, exportTask) {
        await drawPromise.catch(() => {});
        const oldText = button.innerHTML;
        button.innerHTML = busyText;
        button.disabled = true;
        setExportStatus('正在生成文件...');
        try {
            const result = await exportTask();
            setExportStatus(`已生成：${result.path}`, 'success');
        } catch (error) {
            console.error('Export failed:', error);
            setExportStatus(`导出失败：${error.message}`, 'error');
            alert('导出失败，请查看控制台日志。');
        } finally {
            button.innerHTML = oldText;
            button.disabled = false;
        }
    }

    document.getElementById('btn-update').addEventListener('click', scheduleDraw);
    document.getElementById('input-angle').addEventListener('change', scheduleDraw);
    document.getElementById('input-partno-auto').addEventListener('change', () => {
        syncPartNumberField();
        scheduleDraw();
    });
    ['input-l', 'input-w', 'input-t', 'input-c', 'input-mat', 'input-plat', 'input-pack'].forEach(id => {
        document.getElementById(id).addEventListener('change', scheduleDraw);
    });
    
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                scheduleDraw();
            }
        });
    });

    document.getElementById('input-partno').addEventListener('input', () => {
        if (!isPartNumberAuto()) {
            scheduleDraw();
        }
    });

    document.getElementById('btn-export').addEventListener('click', () => {
        const btn = document.getElementById('btn-export');
        runExport(btn, '正在生成 PDF...', async () => {
            const partNo = syncPartNumberField() || 'Drawing';
            return exportCurrentSvgToPdf(`${partNo}.pdf`);
        });
    });

    document.getElementById('btn-export-stl').addEventListener('click', () => {
        runExport(document.getElementById('btn-export-stl'), '正在输出 STL...', () => exportModel('stl'));
    });

    document.getElementById('btn-export-step').addEventListener('click', () => {
        runExport(document.getElementById('btn-export-step'), '正在输出 STEP...', () => exportModel('step'));
    });

    drawPromise = draw();
});
