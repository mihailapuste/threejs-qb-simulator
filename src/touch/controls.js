// Touch controls mount only when the primary pointer is coarse.
// Desktop fine-pointer play never constructs this UI.

export function isCoarsePointer() {
    return window.matchMedia('(pointer: coarse)').matches;
}

function loadTouchFont() {
    const href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600&display=swap';
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
}

function preventGesture(event) {
    event.preventDefault();
}

function findTouch(list, id) {
    for (let i = 0; i < list.length; i += 1) {
        if (list[i].identifier === id) return list[i];
    }
    return null;
}

export function mountTouchControls({ player, getPaused = () => false }) {
    loadTouchFont();

    const root = document.createElement('div');
    root.id = 'touch-ui';

    const lookZone = document.createElement('div');
    lookZone.id = 'touch-look';
    lookZone.setAttribute('aria-hidden', 'true');

    const throwButton = document.createElement('button');
    throwButton.id = 'touch-throw';
    throwButton.type = 'button';
    throwButton.className = 'touch-control';
    throwButton.textContent = 'Throw';
    throwButton.setAttribute('aria-label', 'Hold to charge throw, release to throw');

    const hint = document.createElement('div');
    hint.id = 'touch-rotate-hint';
    hint.innerHTML = `
        <div class="touch-rotate-phone" aria-hidden="true"></div>
        <p>Rotate your phone</p>
    `;

    root.append(lookZone, throwButton, hint);
    document.getElementById('game-container').appendChild(root);

    const instructions = document.getElementById('instructions');
    if (instructions) {
        instructions.innerHTML = `
            <p>Drag the right side to aim</p>
            <p>Hold Throw to charge, release to pass</p>
        `;
    }

    const controlsInfo = document.getElementById('controls-info');
    if (controlsInfo) {
        controlsInfo.style.display = 'none';
    }

    const pauseCopy = document.querySelector('#pause-menu p');
    if (pauseCopy) {
        pauseCopy.textContent = 'Tap Resume to continue';
    }

    const canvas = player.renderer.domElement;
    canvas.style.touchAction = 'none';
    canvas.style.userSelect = 'none';
    canvas.style.webkitUserSelect = 'none';
    canvas.style.webkitTouchCallout = 'none';

    const gameContainer = document.getElementById('game-container');
    gameContainer.style.touchAction = 'none';

    document.addEventListener('touchmove', preventGesture, { passive: false });
    document.addEventListener('gesturestart', preventGesture, { passive: false });
    document.addEventListener('selectstart', (event) => {
        if (document.documentElement.classList.contains('touch-mode')) {
            event.preventDefault();
        }
    });

    let lookId = null;
    let lastX = 0;
    let lastY = 0;

    lookZone.addEventListener('touchstart', (event) => {
        event.preventDefault();
        if (lookId !== null) return;
        const touch = event.changedTouches[0];
        lookId = touch.identifier;
        lastX = touch.clientX;
        lastY = touch.clientY;
    }, { passive: false });

    lookZone.addEventListener('touchmove', (event) => {
        const touch = findTouch(event.changedTouches, lookId);
        if (!touch) return;
        event.preventDefault();
        const dx = touch.clientX - lastX;
        const dy = touch.clientY - lastY;
        lastX = touch.clientX;
        lastY = touch.clientY;
        if (!getPaused()) {
            player.lookBy(dx, dy);
        }
    }, { passive: false });

    const endLook = (event) => {
        if (!findTouch(event.changedTouches, lookId)) return;
        event.preventDefault();
        lookId = null;
    };
    lookZone.addEventListener('touchend', endLook, { passive: false });
    lookZone.addEventListener('touchcancel', endLook, { passive: false });

    let throwTouches = 0;

    const releaseThrow = (event) => {
        event.preventDefault();
        throwTouches = Math.max(0, throwTouches - event.changedTouches.length);
        if (throwTouches === 0) {
            throwButton.classList.remove('is-active');
            player.endThrow();
        }
    };

    throwButton.addEventListener('touchstart', (event) => {
        event.preventDefault();
        event.stopPropagation();
        throwTouches += event.changedTouches.length;
        throwButton.classList.add('is-active');
        if (!getPaused() && !player.isChargingThrow()) {
            player.startThrow();
        }
    }, { passive: false });
    throwButton.addEventListener('touchmove', preventGesture, { passive: false });
    throwButton.addEventListener('touchend', releaseThrow, { passive: false });
    throwButton.addEventListener('touchcancel', releaseThrow, { passive: false });
    throwButton.addEventListener('contextmenu', preventGesture);

    hint.addEventListener('touchstart', preventGesture, { passive: false });
    hint.addEventListener('touchmove', preventGesture, { passive: false });
    hint.addEventListener('contextmenu', preventGesture);

    const portraitQuery = window.matchMedia('(orientation: portrait)');
    const syncOrientation = () => {
        root.classList.toggle('is-portrait', portraitQuery.matches);
    };
    syncOrientation();
    portraitQuery.addEventListener('change', syncOrientation);
    window.addEventListener('resize', syncOrientation);
    window.addEventListener('orientationchange', syncOrientation);
}
