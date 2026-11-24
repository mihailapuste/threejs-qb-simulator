// Short sounds synthesized in the browser. No audio files, no network.

function noiseBuffer(ctx) {
    const length = Math.floor(ctx.sampleRate * 0.2);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
}

export function createSfx() {
    let ctx = null;
    let noise = null;
    let muted = false;
    let crowd = null;
    let crowdGain = null;
    try {
        muted = localStorage.getItem('qb-muted') === '1';
    } catch {
        muted = false;
    }

    function context() {
        if (!ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return null;
            ctx = new AudioContext();
            noise = noiseBuffer(ctx);
        }
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }

    function startCrowd() {
        const audio = context();
        if (!audio || muted || crowd) return;
        const length = Math.floor(audio.sampleRate * 2);
        const buffer = audio.createBuffer(1, length, audio.sampleRate);
        const data = buffer.getChannelData(0);
        let value = 0;
        for (let i = 0; i < length; i += 1) {
            value = value * 0.985 + (Math.random() * 2 - 1) * 0.02;
            data[i] = value;
        }
        const source = audio.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        const filter = audio.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 680;
        crowdGain = audio.createGain();
        crowdGain.gain.value = 0.045;
        source.connect(filter);
        filter.connect(crowdGain);
        crowdGain.connect(audio.destination);
        source.start();
        crowd = source;
    }

    function hit() {
        const audio = context();
        if (!audio || muted || !noise) return;
        const t = audio.currentTime;
        const src = audio.createBufferSource();
        src.buffer = noise;
        const filter = audio.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(480, t);
        const amp = audio.createGain();
        amp.gain.setValueAtTime(0.22, t);
        amp.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        src.connect(filter);
        filter.connect(amp);
        amp.connect(audio.destination);
        src.start(t);
        src.stop(t + 0.14);
    }

    function swell() {
        if (!crowdGain || muted) return;
        const now = crowdGain.context.currentTime;
        crowdGain.gain.cancelScheduledValues(now);
        crowdGain.gain.setValueAtTime(Math.max(0.045, crowdGain.gain.value), now);
        crowdGain.gain.linearRampToValueAtTime(0.12, now + 0.12);
        crowdGain.gain.linearRampToValueAtTime(0.045, now + 1.3);
    }

    function tone(freq, dur, { type = 'sine', gain = 0.06, slide = 0, delay = 0 } = {}) {
        const audio = context();
        if (!audio || muted) return;
        const t = audio.currentTime + delay;
        const osc = audio.createOscillator();
        const amp = audio.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
        amp.gain.setValueAtTime(0.0001, t);
        amp.gain.exponentialRampToValueAtTime(gain, t + 0.012);
        amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(amp);
        amp.connect(audio.destination);
        osc.start(t);
        osc.stop(t + dur + 0.02);
    }

    return {
        unlock() {
            context();
            startCrowd();
        },
        isMuted() {
            return muted;
        },
        setMuted(value) {
            muted = value === true;
            if (crowdGain) crowdGain.gain.value = muted ? 0 : 0.045;
            if (!muted) startCrowd();
            try {
                localStorage.setItem('qb-muted', muted ? '1' : '0');
            } catch {
                // Private mode can reject storage. The mute still applies this session.
            }
        },
        throw() {
            const audio = context();
            if (!audio || muted || !noise) return;
            const t = audio.currentTime;
            const src = audio.createBufferSource();
            src.buffer = noise;
            const filter = audio.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(900, t);
            filter.frequency.exponentialRampToValueAtTime(220, t + 0.16);
            filter.Q.value = 0.7;
            const amp = audio.createGain();
            amp.gain.setValueAtTime(0.0001, t);
            amp.gain.exponentialRampToValueAtTime(0.12, t + 0.015);
            amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
            src.connect(filter);
            filter.connect(amp);
            amp.connect(audio.destination);
            src.start(t);
            src.stop(t + 0.18);
            tone(340, 0.12, { type: 'triangle', gain: 0.04, slide: -180 });
        },
        catch() {
            hit();
            tone(620, 0.09, { gain: 0.07 });
            tone(880, 0.14, { gain: 0.06, delay: 0.07 });
            swell();
        },
        touchdown() {
            tone(523, 0.1, { gain: 0.07 });
            tone(659, 0.12, { gain: 0.07, delay: 0.08 });
            tone(784, 0.2, { gain: 0.07, delay: 0.16 });
            swell();
        },
        incomplete() {
            tone(130, 0.18, { type: 'sine', gain: 0.05, slide: -50 });
        },
        full() {
            tone(980, 0.05, { type: 'square', gain: 0.03 });
        }
    };
}
