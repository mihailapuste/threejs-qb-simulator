const ROUTE_LABEL = {
    seam: 'Seam',
    out: 'Out',
    slant: 'Slant'
};

export function routeLabel(name) {
    if (!name) return 'Route';
    return ROUTE_LABEL[name] || name.charAt(0).toUpperCase() + name.slice(1);
}

export function createHud() {
    const feedback = document.getElementById('feedback');
    const routeDisplay = document.getElementById('route-display');
    const scoreDisplay = document.getElementById('score-display');
    const catchCounter = document.getElementById('catch-counter');
    const hint = document.getElementById('hint');
    const powerWrap = document.getElementById('throw-power-indicator');
    const powerBar = document.getElementById('power-bar');
    const powerReadout = document.getElementById('power-readout');
    const crosshair = document.getElementById('crosshair');
    const pauseMenu = document.getElementById('pause-menu');
    const pauseHelp = document.getElementById('pause-controls');
    const muteButton = document.getElementById('mute-button');
    const routeMenu = document.getElementById('route-menu');
    const perf = document.getElementById('perf-readout');
    let feedbackTimer = 0;
    let powerShown = false;

    function setPower(power, readout) {
        const charging = power != null;
        if (!charging) {
            if (!powerShown) return;
            powerShown = false;
            powerWrap.hidden = true;
            crosshair.classList.remove('is-ready', 'is-short');
            return;
        }
        powerShown = true;
        powerWrap.hidden = false;
        const amount = Math.max(0, Math.min(1, power));
        powerBar.style.width = `${Math.round(amount * 100)}%`;
        const reachable = !readout || readout.reachable !== false;
        powerWrap.classList.toggle('is-short', !reachable);
        crosshair.classList.toggle('is-ready', reachable);
        crosshair.classList.toggle('is-short', !reachable);
        if (!readout || readout.time == null || !reachable) {
            powerReadout.textContent = reachable ? `${Math.round(amount * 100)}%` : 'Short';
        } else {
            powerReadout.textContent = `${Math.round(amount * 100)}% · ${readout.time.toFixed(1)}s`;
        }
    }

    return {
        setStats({ score = 0, catches = 0, route } = {}) {
            scoreDisplay.textContent = String(score);
            catchCounter.textContent = catches === 1 ? '1 catch' : `${catches} catches`;
            if (route) routeDisplay.textContent = routeLabel(route);
        },
        setHint(text) {
            hint.hidden = false;
            hint.textContent = text;
        },
        hideHint() {
            hint.hidden = true;
        },
        setPower,
        showResult(result) {
            window.clearTimeout(feedbackTimer);
            feedback.className = result.touchdown ? 'is-td' : (result.points > 0 ? 'is-catch' : 'is-miss');
            const points = result.points > 0 ? `  +${result.points}` : '';
            feedback.textContent = `${result.label}${points}`;
            feedback.hidden = false;
            feedbackTimer = window.setTimeout(() => {
                feedback.hidden = true;
            }, result.touchdown ? 1800 : 1500);
        },
        setPaused(paused) {
            pauseMenu.hidden = !paused;
            if (paused) {
                const resume = document.getElementById('resume-button');
                if (resume) resume.focus();
            }
        },
        setMuted(muted) {
            muteButton.textContent = muted ? 'Sound off' : 'Sound on';
            muteButton.setAttribute('aria-pressed', muted ? 'true' : 'false');
        },
        fillPauseHelp(lines) {
            pauseHelp.replaceChildren();
            lines.forEach((line) => {
                const item = document.createElement('li');
                item.textContent = line;
                pauseHelp.appendChild(item);
            });
        },
        renderRoutes(routes, current, onSelect, onClose) {
            routeMenu.replaceChildren();
            const title = document.createElement('h3');
            title.textContent = 'Routes';
            routeMenu.appendChild(title);
            routes.forEach((route) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = route === current ? 'is-selected' : '';
                button.textContent = routeLabel(route);
                button.addEventListener('click', () => onSelect(route));
                routeMenu.appendChild(button);
            });
            const close = document.createElement('button');
            close.type = 'button';
            close.className = 'route-close';
            close.textContent = 'Close';
            close.addEventListener('click', onClose);
            routeMenu.appendChild(close);
            routeMenu.hidden = false;
            const first = routeMenu.querySelector('button');
            if (first) first.focus();
        },
        hideRoutes() {
            routeMenu.hidden = true;
        },
        routesOpen() {
            return !routeMenu.hidden;
        },
        setPerf(text) {
            if (!text) {
                perf.hidden = true;
                return;
            }
            perf.hidden = false;
            perf.textContent = text;
        }
    };
}
