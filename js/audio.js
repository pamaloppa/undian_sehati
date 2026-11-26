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
}

window.soundEffects = new SoundEffects();
