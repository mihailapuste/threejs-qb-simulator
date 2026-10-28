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

function bindTap(element, getPaused, action) {
    let activeId = null;

    element.addEventListener('touchstart', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (activeId !== null) return;
        activeId = event.changedTouches[0].identifier;
        element.classList.add('is-active');
    }, { passive: false });

    const finish = (event) => {
        if (!findTouch(event.changedTouches, activeId)) return;
        event.preventDefault();
        activeId = null;
        element.classList.remove('is-active');
        if (event.type === 'touchend' && !getPaused()) {
            action();
        }
    };

    element.addEventListener('touchend', finish, { passive: false });
    element.addEventListener('touchcancel', finish, { passive: false });
    element.addEventListener('touchmove', preventGesture, { passive: false });
    element.addEventListener('contextmenu', preventGesture);
}

function makeUtilityButton(id, label) {
    const button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.className = 'touch-control touch-btn';
    button.textContent = label;
    return button;
}

export function mountTouchControls({
    player,
    getPaused = () => false,
    onNewBall,
    onStartRoute,
    onReset
}) {
    loadTouchFont();

    const root = document.createElement('div');
    root.id = 'touch-ui';

    const lookZone = document.createElement('div');
    lookZone.id = 'touch-look';
    lookZone.setAttribute('aria-hidden', 'true');

    const joystick = document.createElement('div');
    joystick.id = 'touch-joystick';
    joystick.className = 'touch-control';
    joystick.setAttribute('role', 'application');
    joystick.setAttribute('aria-label', 'Move');
    const knob = document.createElement('div');
    knob.id = 'touch-joystick-knob';
    joystick.appendChild(knob);

    const actions = document.createElement('div');
    actions.id = 'touch-actions';

    const utility = document.createElement('div');
    utility.id = 'touch-utility';
    const newBallButton = makeUtilityButton('touch-new-ball', 'New ball');
    const routeButton = makeUtilityButton('touch-start-route', 'Start route');
    const resetButton = makeUtilityButton('touch-reset', 'Reset');
    utility.append(newBallButton, routeButton, resetButton);

    const throwButton = document.createElement('button');
    throwButton.id = 'touch-throw';
    throwButton.type = 'button';
    throwButton.className = 'touch-control';
    throwButton.textContent = 'Throw';
    throwButton.setAttribute('aria-label', 'Hold to charge throw, release to throw');

    actions.append(utility, throwButton);

    const hint = document.createElement('div');
    hint.id = 'touch-rotate-hint';
    hint.innerHTML = `
        <div class="touch-rotate-phone" aria-hidden="true"></div>
        <p>Rotate your phone</p>
    `;

    root.append(lookZone, joystick, actions, hint);
    document.getElementById('game-container').appendChild(root);

    const instructions = document.getElementById('instructions');
    if (instructions) {
        instructions.innerHTML = `
            <p>Drag the right side to aim</p>
            <p>Hold Throw to charge, release to pass</p>
            <p>Left stick moves · New ball, Start route, Reset</p>
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

    let stickId = null;

    const resetKnob = () => {
        knob.style.transform = 'translate(-50%, -50%)';
        joystick.classList.remove('is-active');
        player.clearTouchMove();
    };

    const applyStick = (touch) => {
        const rect = joystick.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        let dx = touch.clientX - centerX;
        let dy = touch.clientY - centerY;
        const maxTravel = Math.max(28, rect.width / 2 - knob.offsetWidth / 2);
        const distance = Math.hypot(dx, dy);
        const clamped = Math.min(distance, maxTravel);
        const nx = distance > 0 ? (dx / distance) * clamped : 0;
        const ny = distance > 0 ? (dy / distance) * clamped : 0;
        knob.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;

        let x = nx / maxTravel;
        let y = ny / maxTravel;
        if (Math.hypot(x, y) < 0.12) {
            x = 0;
            y = 0;
        }
        if (getPaused()) {
            player.clearTouchMove();
            return;
        }
        // Screen Y grows downward, so up on the stick is forward.
        player.setTouchMove(x, -y);
    };

    joystick.addEventListener('touchstart', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (stickId !== null) return;
        const touch = event.changedTouches[0];
        stickId = touch.identifier;
        joystick.classList.add('is-active');
        applyStick(touch);
    }, { passive: false });

    joystick.addEventListener('touchmove', (event) => {
        const touch = findTouch(event.changedTouches, stickId);
        if (!touch) return;
        event.preventDefault();
        applyStick(touch);
    }, { passive: false });

    const endStick = (event) => {
        if (!findTouch(event.changedTouches, stickId)) return;
        event.preventDefault();
        stickId = null;
        resetKnob();
    };
    joystick.addEventListener('touchend', endStick, { passive: false });
    joystick.addEventListener('touchcancel', endStick, { passive: false });
    joystick.addEventListener('contextmenu', preventGesture);

    if (onNewBall) bindTap(newBallButton, getPaused, onNewBall);
    if (onStartRoute) bindTap(routeButton, getPaused, onStartRoute);
    if (onReset) bindTap(resetButton, getPaused, onReset);

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
