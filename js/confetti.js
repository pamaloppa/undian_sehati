/**
 * Standalone High-Performance Canvas Confetti
 * Tidak membutuhkan pustaka eksternal, mendukung burst ganda & efek bintang emas
 */

window.ConfettiManager = {
    canvas: null,
    ctx: null,
    particles: [],
    animationFrameId: null,
    isActive: false,

    init: function() {
        if (this.canvas) return;

        this.canvas = document.createElement('canvas');
        this.canvas.id = 'confetti-canvas';
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100vw';
        this.canvas.style.height = '100vh';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '9999';
        document.body.appendChild(this.canvas);

        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
    },

    resize: function() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth * window.devicePixelRatio;
        this.canvas.height = window.innerHeight * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    },

    colors: [
        '#ffd700', '#fbbf24', '#f59e0b', '#10b981', '#059669', 
        '#06b6d4', '#0ea5e9', '#34d399', '#67e8f9', '#ffffff'
    ],

    createParticle: function(x, y, isGoldTheme = false) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 12 + 4;
        const color = isGoldTheme 
            ? ['#ffd700', '#fbbf24', '#f59e0b', '#10b981', '#06b6d4', '#ffffff', '#a7f3d0'][Math.floor(Math.random() * 7)]
            : this.colors[Math.floor(Math.random() * this.colors.length)];

        return {
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 5,
            size: Math.random() * 8 + 4,
            color: color,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 12,
            gravity: 0.22,
            friction: 0.96,
            opacity: 1,
            decay: Math.random() * 0.008 + 0.004,
            shape: Math.random() > 0.4 ? 'rect' : 'circle'
        };
    },

    /**
     * Memicu ledakan kembang api konfeti
     */
    burst: function(count = 180, isGold = false) {
        this.init();
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Titik ledakan kiri, tengah, kanan
        const origins = [
            { x: width * 0.2, y: height * 0.5 },
            { x: width * 0.5, y: height * 0.4 },
            { x: width * 0.8, y: height * 0.5 }
        ];

        origins.forEach(orig => {
            for (let i = 0; i < count / origins.length; i++) {
                this.particles.push(this.createParticle(orig.x, orig.y, isGold));
            }
        });

        if (!this.isActive) {
            this.isActive = true;
            this.render();
        }
    },

    render: function() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            p.vx *= p.friction;
            p.vy *= p.friction;
            p.vy += p.gravity;
            p.x += p.vx;
            p.y += p.vy;
            p.rotation += p.rotationSpeed;
            p.opacity -= p.decay;

            if (p.opacity <= 0 || p.y > window.innerHeight + 50) {
                this.particles.splice(i, 1);
                continue;
            }

            this.ctx.save();
            this.ctx.globalAlpha = Math.max(0, p.opacity);
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate((p.rotation * Math.PI) / 180);
            this.ctx.fillStyle = p.color;

            if (p.shape === 'rect') {
                this.ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
            } else {
                this.ctx.beginPath();
                this.ctx.arc(0, 0, p.size / 3, 0, Math.PI * 2);
                this.ctx.fill();
            }

            this.ctx.restore();
        }

        if (this.particles.length > 0) {
            this.animationFrameId = requestAnimationFrame(() => this.render());
        } else {
            this.isActive = false;
            this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        }
    },

    clear: function() {
        this.particles = [];
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        if (this.ctx) {
            this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        }
        this.isActive = false;
    }
};
