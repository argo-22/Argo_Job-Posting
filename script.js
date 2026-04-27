document.addEventListener('DOMContentLoaded', () => {
    // Set current year in footer
    document.getElementById('year').textContent = new Date().getFullYear();

    // Preloader and Intro Animations
    const preloader = document.getElementById('preloader');
    const container = document.querySelector('.container');
    const fadeElements = document.querySelectorAll('.fade-in');

    // ────────────────────────────────────────────────────────────
    // ARGO loader logic (from ARGO Loader _embed_.html)
    // ────────────────────────────────────────────────────────────
    const CONFIG = {
        durationSec: 5,    // seconds per cycle
        gapWidth: 65,      // gap arc length in 1/1000ths of perimeter
        numGaps: 2,        // 2 or 3
        strokeWidth: 9,    // outline thickness, in viewBox units
        cutAngle: -30,     // gap-edge tilt from perpendicular, degrees
        fill: '#111111',
    };

    const A = { x: 100, y: 30 };
    const B = { x: 176, y: 170 };
    const C = { x: 24, y: 170 };
    const SIDES = [{ from: A, to: B }, { from: B, to: C }, { from: C, to: A }];
    const SIDE_LEN = SIDES.map(s => Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y));
    const PERIMETER = SIDE_LEN.reduce((a, b) => a + b, 0);
    const SIDE_START = SIDE_LEN.reduce((acc, len, i) => {
        acc.push(i === 0 ? 0 : acc[i - 1] + SIDE_LEN[i - 1]);
        return acc;
    }, []);

    function arcToPoint(s) {
        s = ((s % PERIMETER) + PERIMETER) % PERIMETER;
        for (let i = SIDES.length - 1; i >= 0; i--) {
            if (s >= SIDE_START[i]) {
                const local = s - SIDE_START[i];
                const { from, to } = SIDES[i];
                const t = local / SIDE_LEN[i];
                return {
                    x: from.x + (to.x - from.x) * t,
                    y: from.y + (to.y - from.y) * t,
                    tx: (to.x - from.x) / SIDE_LEN[i],
                    ty: (to.y - from.y) / SIDE_LEN[i],
                };
            }
        }
    }

    function lineIntersect(p1, d1, p2, d2) {
        const det = d1.x * d2.y - d1.y * d2.x;
        if (Math.abs(det) < 1e-9) return null;
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const t = (dx * d2.y - dy * d2.x) / det;
        return { x: p1.x + d1.x * t, y: p1.y + d1.y * t };
    }

    function spanPolygon(s0, s1, halfW, cutAngleDeg) {
        const angRad = (cutAngleDeg * Math.PI) / 180;
        const spine = [];
        const startInfo = arcToPoint(s0);
        spine.push({ s: s0, ...startInfo });

        const corners = [];
        for (let k = 0; k < SIDES.length; k++) {
            for (let cycle = 0; cycle <= 1; cycle++) {
                const cs = SIDE_START[k] + cycle * PERIMETER;
                if (cs > s0 && cs < s1) corners.push({ s: cs, sideIdx: k });
            }
        }
        corners.sort((a, b) => a.s - b.s).forEach(c => {
            const prevIdx = (c.sideIdx + SIDES.length - 1) % SIDES.length;
            const prev = SIDES[prevIdx], next = SIDES[c.sideIdx];
            spine.push({
                s: c.s, x: next.from.x, y: next.from.y,
                inTx: (prev.to.x - prev.from.x) / SIDE_LEN[prevIdx],
                inTy: (prev.to.y - prev.from.y) / SIDE_LEN[prevIdx],
                outTx: (next.to.x - next.from.x) / SIDE_LEN[c.sideIdx],
                outTy: (next.to.y - next.from.y) / SIDE_LEN[c.sideIdx],
                isCorner: true,
            });
        });
        const endInfo = arcToPoint(s1);
        spine.push({ s: s1, ...endInfo });

        const left = [], right = [];
        spine.forEach(p => {
            if (p.isCorner) {
                const inN = { x: -p.inTy, y: p.inTx }, outN = { x: -p.outTy, y: p.outTx };
                const lm = lineIntersect({ x: p.x + inN.x * halfW, y: p.y + inN.y * halfW }, { x: p.inTx, y: p.inTy }, { x: p.x + outN.x * halfW, y: p.y + outN.y * halfW }, { x: p.outTx, y: p.outTy }) || { x: p.x + inN.x * halfW, y: p.y + inN.y * halfW };
                const rm = lineIntersect({ x: p.x - inN.x * halfW, y: p.y - inN.y * halfW }, { x: p.inTx, y: p.inTy }, { x: p.x - outN.x * halfW, y: p.y - outN.y * halfW }, { x: p.outTx, y: p.outTy }) || { x: p.x - inN.x * halfW, y: p.y - inN.y * halfW };
                left.push([lm.x, lm.y]); right.push([rm.x, rm.y]);
            } else {
                const cosA = Math.cos(angRad), sinA = Math.sin(angRad);
                const nx = (-p.ty) * cosA - (p.tx) * sinA, ny = (-p.ty) * sinA + (p.tx) * cosA;
                const scale = halfW / Math.max(0.2, Math.abs(cosA));
                left.push([p.x + nx * scale, p.y + ny * scale]); right.push([p.x - nx * scale, p.y - ny * scale]);
            }
        });
        return left.concat(right.reverse()).map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' ');
    }

    const svg = document.querySelector('svg.argo-loader');
    const polys = Array.from({ length: CONFIG.numGaps }, () => {
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        p.setAttribute('fill', CONFIG.fill);
        svg.appendChild(p);
        return p;
    });

    let start = performance.now();
    function tick(now) {
        const t = ((now - start) / 1000) % CONFIG.durationSec;
        const gapWidthArc = (CONFIG.gapWidth / 1000) * PERIMETER;
        const segment = PERIMETER / CONFIG.numGaps;
        const phase = (t / CONFIG.durationSec) * segment;
        const gapStarts = Array.from({ length: CONFIG.numGaps }, (_, i) => (i * segment + phase) % PERIMETER).sort((a, b) => a - b);
        const spans = gapStarts.map((g, i) => [g + gapWidthArc, (i === gapStarts.length - 1 ? gapStarts[0] + PERIMETER : gapStarts[i + 1])]);
        spans.forEach((span, i) => polys[i].setAttribute('points', spanPolygon(span[0], span[1], CONFIG.strokeWidth / 2, CONFIG.cutAngle)));
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    // Minimum display time for the preloader (5 seconds as requested)
    const MIN_PRELOAD_TIME = 5000;
    const startTime = Date.now();

    const revealContent = () => {
        preloader.style.opacity = '0';
        setTimeout(() => {
            preloader.style.visibility = 'hidden';
            document.body.style.overflowY = 'auto';
            container.style.opacity = '1';
            setTimeout(() => fadeElements.forEach(el => el.classList.add('visible')), 100);
        }, 800);
    };

    window.addEventListener('load', () => {
        const elapsedTime = Date.now() - startTime;
        setTimeout(revealContent, Math.max(0, MIN_PRELOAD_TIME - elapsedTime));
    });

    // Fallback just in case load event fires early or fails
    setTimeout(() => {
        if (preloader.style.opacity !== '0') {
            revealContent();
        }
    }, MIN_PRELOAD_TIME + 2000); // Failsafe after 4.5s
});
