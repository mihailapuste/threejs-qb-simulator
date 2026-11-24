import { LINEMEN, RECEIVER_COLORS, clampAlignment } from '../game/plays.js';
import { smoothStroke } from '../game/stroke.js';

const VIEW = { x0: -12, x1: 40, z0: -26, z1: 26 };

function project(x, z, width, height) {
    return {
        px: ((z - VIEW.z0) / (VIEW.z0 * -1 + VIEW.z1)) * width,
        py: (1 - (x - VIEW.x0) / (VIEW.x1 - VIEW.x0)) * height
    };
}

function unproject(px, py, width, height) {
    return {
        x: VIEW.x0 + (1 - py / height) * (VIEW.x1 - VIEW.x0),
        z: VIEW.z0 + (px / width) * (VIEW.z1 - VIEW.z0)
    };
}

export function mountDesigner({ root, onClose, onSave }) {
    const canvas = root.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const nameInput = root.querySelector('#designer-name');
    const status = root.querySelector('#designer-status');
    let receivers = [];
    let selected = 0;
    let history = [[], [], [], []];
    let drag = null;
    let stroke = null;

    function snapshot(index) {
        history[index] = history[index].slice(-12);
        history[index].push(receivers[index].route.map((step) => ({ ...step })));
    }

    function resize() {
        const rect = canvas.getBoundingClientRect();
        const scale = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.floor(rect.width * scale));
        canvas.height = Math.max(1, Math.floor(rect.height * scale));
        draw();
    }

    function size() {
        const rect = canvas.getBoundingClientRect();
        return { width: rect.width, height: rect.height, scaleX: canvas.width / rect.width, scaleY: canvas.height / rect.height };
    }

    function hitReceiver(px, py) {
        const { width, height } = size();
        let best = -1;
        let bestDist = 28;
        for (let i = 0; i < receivers.length; i += 1) {
            const dot = project(receivers[i].x, receivers[i].z, width, height);
            const dist = Math.hypot(dot.px - px, dot.py - py);
            if (dist < bestDist) {
                best = i;
                bestDist = dist;
            }
        }
        return best;
    }

    function draw() {
        const { width, height, scaleX, scaleY } = size();
        ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#1f6b3a';
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        for (let x = -10; x <= 40; x += 5) {
            const a = project(x, VIEW.z0, width, height);
            const b = project(x, VIEW.z1, width, height);
            ctx.beginPath();
            ctx.moveTo(a.px, a.py);
            ctx.lineTo(b.px, b.py);
            ctx.stroke();
        }
        ctx.strokeStyle = '#f4f4f4';
        ctx.lineWidth = 3;
        const losA = project(0, VIEW.z0, width, height);
        const losB = project(0, VIEW.z1, width, height);
        ctx.beginPath();
        ctx.moveTo(losA.px, losA.py);
        ctx.lineTo(losB.px, losB.py);
        ctx.stroke();
        ctx.fillStyle = 'rgba(47,111,190,0.95)';
        LINEMEN.forEach((man) => {
            const dot = project(0, man.z, width, height);
            ctx.fillRect(dot.px - 7, dot.py - 10, 14, 18);
        });
        receivers.forEach((receiver, index) => {
            const path = [{ x: receiver.x, z: receiver.z }, ...receiver.route.map((step) => ({
                x: receiver.x + step.x,
                z: receiver.z + step.z
            }))];
            ctx.strokeStyle = RECEIVER_COLORS[index];
            ctx.lineWidth = index === selected ? 4 : 2;
            ctx.beginPath();
            path.forEach((point, pointIndex) => {
                const dot = project(point.x, point.z, width, height);
                if (pointIndex === 0) ctx.moveTo(dot.px, dot.py);
                else ctx.lineTo(dot.px, dot.py);
            });
            ctx.stroke();
            const spot = project(receiver.x, receiver.z, width, height);
            ctx.fillStyle = RECEIVER_COLORS[index];
            ctx.beginPath();
            ctx.arc(spot.px, spot.py, index === selected ? 16 : 13, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#1b1b1b';
            ctx.font = '700 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(index + 1), spot.px, spot.py);
        });
        if (stroke && stroke.points.length) {
            ctx.strokeStyle = RECEIVER_COLORS[selected];
            ctx.lineWidth = 3;
            ctx.setLineDash([6, 5]);
            ctx.beginPath();
            stroke.points.forEach((point, index) => {
                const dot = project(point.x, point.z, width, height);
                if (index === 0) ctx.moveTo(dot.px, dot.py);
                else ctx.lineTo(dot.px, dot.py);
            });
            ctx.stroke();
            ctx.setLineDash([]);
        }
        root.querySelectorAll('[data-receiver]').forEach((button) => {
            button.classList.toggle('is-selected', Number(button.dataset.receiver) === selected);
        });
        if (status) {
            status.textContent = `Receiver ${selected + 1}. Drag a dot to align. Draw anywhere else for his route.`;
        }
    }

    function pointerPos(event) {
        const rect = canvas.getBoundingClientRect();
        return { px: event.clientX - rect.left, py: event.clientY - rect.top };
    }

    function onDown(event) {
        event.preventDefault();
        try { canvas.setPointerCapture(event.pointerId); } catch { /* A synthetic pointer has nothing to capture. */ }
        const { px, py } = pointerPos(event);
        const hit = hitReceiver(px, py);
        if (hit >= 0) {
            selected = hit;
            const { width, height } = size();
            const yard = unproject(px, py, width, height);
            drag = { index: hit, dx: receivers[hit].x - yard.x, dz: receivers[hit].z - yard.z };
            draw();
            return;
        }
        const { width, height } = size();
        const yard = unproject(px, py, width, height);
        stroke = { points: [{ x: receivers[selected].x, z: receivers[selected].z }, yard] };
        draw();
    }

    function onMove(event) {
        if (!drag && !stroke) return;
        event.preventDefault();
        const { px, py } = pointerPos(event);
        const { width, height } = size();
        const yard = unproject(px, py, width, height);
        if (drag) {
            const spot = clampAlignment(yard.x + drag.dx, yard.z + drag.dz);
            receivers[drag.index].x = spot.x;
            receivers[drag.index].z = spot.z;
        } else if (stroke) {
            stroke.points.push(yard);
        }
        draw();
    }

    function onUp(event) {
        if (stroke) {
            let travel = 0;
            for (let i = 1; i < stroke.points.length; i += 1) {
                travel += Math.hypot(stroke.points[i].x - stroke.points[i - 1].x, stroke.points[i].z - stroke.points[i - 1].z);
            }
            if (travel > 0.8) {
                snapshot(selected);
                const smooth = smoothStroke(stroke.points);
                const origin = receivers[selected];
                origin.route = smooth.slice(1).map((point) => ({
                    x: point.x - origin.x,
                    z: point.z - origin.z
                }));
            }
        }
        drag = null;
        stroke = null;
        if (event && event.pointerId != null && canvas.hasPointerCapture(event.pointerId)) {
            canvas.releasePointerCapture(event.pointerId);
        }
        draw();
    }

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    window.addEventListener('resize', resize);

    root.querySelectorAll('[data-receiver]').forEach((button) => {
        button.addEventListener('click', () => {
            selected = Number(button.dataset.receiver);
            draw();
        });
    });
    root.querySelector('#designer-undo').addEventListener('click', () => {
        const stack = history[selected];
        if (!stack.length) return;
        receivers[selected].route = stack.pop();
        draw();
    });
    root.querySelector('#designer-clear').addEventListener('click', () => {
        snapshot(selected);
        receivers[selected].route = [];
        draw();
    });
    root.querySelector('#designer-save').addEventListener('click', () => {
        onSave({
            name: nameInput.value,
            receivers: receivers.map((receiver) => ({
                x: receiver.x,
                z: receiver.z,
                route: receiver.route.map((step) => ({ ...step }))
            }))
        });
    });
    root.querySelector('#designer-close').addEventListener('click', () => onClose());

    return {
        open(play) {
            receivers = play.receivers.map((receiver) => ({
                x: receiver.x,
                z: receiver.z,
                route: receiver.route.map((step) => ({ ...step }))
            }));
            history = [[], [], [], []];
            selected = 0;
            nameInput.value = play.custom ? play.name : '';
            nameInput.placeholder = 'Name this play';
            root.hidden = false;
            requestAnimationFrame(resize);
        },
        close() {
            root.hidden = true;
        },
        isOpen() {
            return !root.hidden;
        }
    };
}
