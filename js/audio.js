/**
 * Web Audio API Sound Synthesizer
 * 100% Client-side, bekerja tanpa internet & tanpa file .mp3 eksternal
 */

class SoundEffects {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.rollInterval = null;
        this.init();
    }

    init() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            this.ctx = new AudioContext();
        }
    }

    ensureContext() {
        if (!this.ctx) {
            this.init();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    setEnabled(enabled) {
        this.enabled = !!enabled;
    }

    /**
     * Efek suara detak putaran roda undian (Slot Tick)
     */
    playTick(pitchOffset = 0) {
        if (!this.enabled) return;
        this.ensureContext();
        if (!this.ctx) return;

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(600 + pitchOffset, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.04);

            gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + 0.04);
        } catch (e) {
            // Abaikan jika browser membatasi autoplay
        }
    }

    /**
     * Memulai efek suara gemuruh / ketegangan putaran (Drumroll / Tension)
     */
    startRollSound() {
        if (!this.enabled) return;
        this.ensureContext();
        this.stopRollSound();

        let speed = 90;
        let counter = 0;

        const tickLoop = () => {
            counter++;
            const pitchVariation = (counter % 5) * 40;
            this.playTick(pitchVariation);

            // Sedikit mempercepat laju detak seiring waktu
            if (counter > 30 && speed > 50) speed -= 2;

            this.rollInterval = setTimeout(tickLoop, speed);
        };

        tickLoop();
    }

    /**
     * Menghentikan suara gemuruh
     */
    stopRollSound() {
        if (this.rollInterval) {
            clearTimeout(this.rollInterval);
            this.rollInterval = null;
        }
    }

    /**
     * Efek suara kunci kartu pemenang (Lock-in Thud & Chime)
     */
    playCardLock(slotIndex = 0) {
        if (!this.enabled) return;
        this.ensureContext();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;

            // 1. Bass Impact Thud
            const oscBass = this.ctx.createOscillator();
            const gainBass = this.ctx.createGain();
            oscBass.type = 'sine';
            oscBass.frequency.setValueAtTime(160, now);
            oscBass.frequency.exponentialRampToValueAtTime(40, now + 0.25);
            gainBass.gain.setValueAtTime(0.4, now);
            gainBass.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
            oscBass.connect(gainBass);
            gainBass.connect(this.ctx.destination);
            oscBass.start(now);
            oscBass.stop(now + 0.25);

            // 2. High Chime ascending by slot index
            const baseFreqs = [523.25, 659.25, 783.99, 880.00, 1046.50]; // C5, E5, G5, A5, C6
            const freq = baseFreqs[slotIndex % baseFreqs.length] || 784;

            const oscChime = this.ctx.createOscillator();
            const gainChime = this.ctx.createGain();
            oscChime.type = 'sine';
            oscChime.frequency.setValueAtTime(freq, now + 0.05);
            oscChime.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.35);
            gainChime.gain.setValueAtTime(0.25, now + 0.05);
            gainChime.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
            oscChime.connect(gainChime);
            gainChime.connect(this.ctx.destination);
            oscChime.start(now + 0.05);
            oscChime.stop(now + 0.35);
        } catch (e) {}
    }

    /**
     * Efek suara kemenangan akbar (Grand Celebration Fanfare)
     */
    playFanfare() {
        if (!this.enabled) return;
        this.ensureContext();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            // Arpeggio nada megah: C4, E4, G4, C5, E5, G5 lalu akor serentak
            const notes = [
                { f: 261.63, t: 0.0,  d: 0.15 }, // C4
                { f: 329.63, t: 0.12, d: 0.15 }, // E4
                { f: 392.00, t: 0.24, d: 0.18 }, // G4
                { f: 523.25, t: 0.38, d: 0.20 }, // C5
                { f: 659.25, t: 0.52, d: 0.20 }, // E5
                { f: 783.99, t: 0.68, d: 0.70 }  // G5 (Hold)
            ];

            notes.forEach(note => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(note.f, now + note.t);

                gain.gain.setValueAtTime(0.35, now + note.t);
                gain.gain.exponentialRampToValueAtTime(0.001, now + note.t + note.d);

                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now + note.t);
                osc.stop(now + note.t + note.d);
            });

            // Akor harmoni penutup (C Major chord: C5 + E5 + G5 + C6)
            setTimeout(() => {
                if (!this.ctx) return;
                const chordTime = this.ctx.currentTime;
                const chordFreqs = [523.25, 659.25, 783.99, 1046.50];

                chordFreqs.forEach(f => {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(f, chordTime);

                    gain.gain.setValueAtTime(0.18, chordTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, chordTime + 1.2);

                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start(chordTime);
                    osc.stop(chordTime + 1.2);
                });
            }, 850);
        } catch (e) {}
    }

    /**
     * Backsound Selamat & Fanfare Meriah Akbar khusus GRAND PRIZE (Sepeda Listrik)
     * Paduan Terompet Megah Kerajaan, Dentuman Meriam Perayaan, Akor Akbar Orkestra, & Lonceng Kilau Emas
     */
    playGrandPrizeFanfare() {
        if (!this.enabled) return;
        this.ensureContext();
        if (!this.ctx) return;

        try {
            // Mainkan elemen audio eksternal jika pengguna menyediakan file kustom di assets
            const extAudio = document.getElementById('audio-grand-prize');
            if (extAudio && typeof extAudio.play === 'function') {
                extAudio.currentTime = 0;
                extAudio.play().catch(() => {});
            }

            const now = this.ctx.currentTime;

            // 1. INTRO: ROYAL TRUMPET CALL (Panggilan Terompet Pembuka Megah)
            const trumpetIntro = [
                { f: 392.00, t: 0.00, d: 0.12, g: 0.45 }, // G4
                { f: 392.00, t: 0.14, d: 0.12, g: 0.45 }, // G4
                { f: 392.00, t: 0.28, d: 0.14, g: 0.50 }, // G4
                { f: 523.25, t: 0.45, d: 0.45, g: 0.55 }, // C5 (Klimaks Aksen)
                { f: 392.00, t: 0.95, d: 0.12, g: 0.45 }, // G4
                { f: 523.25, t: 1.10, d: 0.14, g: 0.50 }, // C5
                { f: 659.25, t: 1.28, d: 0.50, g: 0.55 }, // E5 (Sustain Terompet)
            ];

            trumpetIntro.forEach(note => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(note.f, now + note.t);

                gain.gain.setValueAtTime(note.g, now + note.t);
                gain.gain.exponentialRampToValueAtTime(0.001, now + note.t + note.d);

                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now + note.t);
                osc.stop(now + note.t + note.d);
            });

            // 2. TIMPANI / CANNON BASS HITS (Dentuman Gemuruh Kemenangan)
            const cannonHits = [0.00, 0.45, 1.28, 1.85, 2.30, 2.80];
            cannonHits.forEach(delay => {
                const oscBass = this.ctx.createOscillator();
                const gainBass = this.ctx.createGain();
                oscBass.type = 'sine';
                oscBass.frequency.setValueAtTime(140, now + delay);
                oscBass.frequency.exponentialRampToValueAtTime(35, now + delay + 0.35);

                gainBass.gain.setValueAtTime(0.65, now + delay);
                gainBass.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.35);

                oscBass.connect(gainBass);
                gainBass.connect(this.ctx.destination);
                oscBass.start(now + delay);
                oscBass.stop(now + delay + 0.35);
            });

            // 3. TAHAP PUNCAK: GRAND CELEBRATION CHORD & MELODI KEMENANGAN (detik 1.80)
            setTimeout(() => {
                if (!this.ctx) return;
                const climaxTime = this.ctx.currentTime;
                const grandChord = [
                    { f: 130.81, type: 'triangle', g: 0.50 }, // C3 (Sub-Bass)
                    { f: 196.00, type: 'triangle', g: 0.45 }, // G3 (Tenor)
                    { f: 261.63, type: 'sawtooth', g: 0.35 }, // C4 (Brass Mid)
                    { f: 329.63, type: 'sawtooth', g: 0.35 }, // E4 (French Horn)
                    { f: 392.00, type: 'sawtooth', g: 0.35 }, // G4 (Trumpet)
                    { f: 523.25, type: 'sawtooth', g: 0.40 }, // C5 (Lead Trumpet)
                    { f: 659.25, type: 'triangle', g: 0.30 }, // E5 (High)
                    { f: 783.99, type: 'triangle', g: 0.30 }, // G5 (High)
                    { f: 1046.50, type: 'sine',     g: 0.25 }, // C6 (Flute Sparkle)
                ];

                grandChord.forEach(voice => {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = voice.type;
                    osc.frequency.setValueAtTime(voice.f, climaxTime);

                    // Vibrato megah kerajaan
                    osc.frequency.linearRampToValueAtTime(voice.f * 1.008, climaxTime + 1.2);
                    osc.frequency.linearRampToValueAtTime(voice.f, climaxTime + 2.0);

                    gain.gain.setValueAtTime(voice.g, climaxTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, climaxTime + 2.8);

                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start(climaxTime);
                    osc.stop(climaxTime + 2.8);
                });

                // Melodi Utama Sorak Kemenangan (Triumphant Victory Lead)
                const celebrationMelody = [
                    { f: 523.25, t: 0.05, d: 0.18, g: 0.45 }, // C5
                    { f: 587.33, t: 0.22, d: 0.18, g: 0.45 }, // D5
                    { f: 659.25, t: 0.40, d: 0.22, g: 0.50 }, // E5
                    { f: 783.99, t: 0.65, d: 0.30, g: 0.55 }, // G5
                    { f: 1046.50, t: 0.98, d: 1.40, g: 0.60 }, // C6 (Klimaks Tertinggi Grand Prize!)
                    { f: 1318.51, t: 1.60, d: 0.90, g: 0.35 }  // E6 (Harmoni Kilau Puncak)
                ];

                celebrationMelody.forEach(note => {
                    const oscLead = this.ctx.createOscillator();
                    const gainLead = this.ctx.createGain();
                    oscLead.type = 'sawtooth';
                    oscLead.frequency.setValueAtTime(note.f, climaxTime + note.t);

                    gainLead.gain.setValueAtTime(note.g, climaxTime + note.t);
                    gainLead.gain.exponentialRampToValueAtTime(0.001, climaxTime + note.t + note.d);

                    oscLead.connect(gainLead);
                    gainLead.connect(this.ctx.destination);
                    oscLead.start(climaxTime + note.t);
                    oscLead.stop(climaxTime + note.t + note.d);
                });

                // Simulasi Gemuruh Tepuk Tangan & Sorak Penonton (Stadium Applause & Cheer Wave)
                try {
                    const bufferSize = Math.floor(this.ctx.sampleRate * 2.8);
                    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                    const output = noiseBuffer.getChannelData(0);
                    for (let i = 0; i < bufferSize; i++) {
                        output[i] = Math.random() * 2 - 1;
                    }
                    const whiteNoise = this.ctx.createBufferSource();
                    whiteNoise.buffer = noiseBuffer;

                    const filter = this.ctx.createBiquadFilter();
                    filter.type = 'bandpass';
                    filter.frequency.setValueAtTime(950, climaxTime);
                    filter.Q.setValueAtTime(1.1, climaxTime);

                    const cheerGain = this.ctx.createGain();
                    cheerGain.gain.setValueAtTime(0.001, climaxTime);
                    cheerGain.gain.linearRampToValueAtTime(0.20, climaxTime + 0.5);
                    cheerGain.gain.exponentialRampToValueAtTime(0.001, climaxTime + 2.8);

                    whiteNoise.connect(filter);
                    filter.connect(cheerGain);
                    cheerGain.connect(this.ctx.destination);
                    whiteNoise.start(climaxTime);
                    whiteNoise.stop(climaxTime + 2.8);
                } catch (e) {}

            }, 1800);

            // 4. KILAUAN LONCENG EMAS & FIREWORKS SPARKLE (pada detik 2.1 - 3.5)
            const sparkleBells = [
                { f: 1046.50, t: 2.10 }, // C6
                { f: 1318.51, t: 2.25 }, // E6
                { f: 1567.98, t: 2.40 }, // G6
                { f: 2093.00, t: 2.55 }, // C7
                { f: 1567.98, t: 2.75 }, // G6
                { f: 2093.00, t: 2.95 }, // C7
                { f: 2637.02, t: 3.15 }  // E7 (Ultra High Sparkle)
            ];

            sparkleBells.forEach(bell => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(bell.f, now + bell.t);

                gain.gain.setValueAtTime(0.20, now + bell.t);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + bell.t + 0.45);

                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now + bell.t);
                osc.stop(now + bell.t + 0.45);
            });

        } catch (e) {
            console.warn('Gagal memutar Grand Prize Fanfare:', e);
        }
    }
}

window.soundEffects = new SoundEffects();
