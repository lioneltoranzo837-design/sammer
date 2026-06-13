// --- SINTETIZADOR DE AUDIO PROCEDIMENTAL ---
export class SoundSynth {
    constructor() {
        this.ctx = null;
        this.ambientOsc1 = null;
        this.ambientOsc2 = null;
        this.ambientGain = null;
        
        // Propiedades de la música de pánico/terror procedimental
        this.musicActive = false;
        this.musicTimer = null;
        this.musicStep = 0;
    }

    init() {
        if (this.ctx) return;
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                this.ctx = new AudioContextClass();
                this.startHorrorMusic();
            } else {
                console.warn("Web Audio API no está soportada en este navegador.");
            }
        } catch (e) {
            console.error("No se pudo inicializar el sintetizador de audio:", e);
        }
    }

    startAmbientHum() {
        if (!this.ctx) return;
        
        // Oscilador 1: Hum ultra bajo (55Hz - A1)
        this.ambientOsc1 = this.ctx.createOscillator();
        this.ambientOsc1.type = 'sawtooth';
        this.ambientOsc1.frequency.setValueAtTime(55, this.ctx.currentTime);
        
        // Oscilador 2: Levemente desafinado para batido acústico (55.4Hz)
        this.ambientOsc2 = this.ctx.createOscillator();
        this.ambientOsc2.type = 'sawtooth';
        this.ambientOsc2.frequency.setValueAtTime(55.4, this.ctx.currentTime);
        
        // Filtro paso bajo para opacar las ondas y crear zumbido de terror
        const lowpass = this.ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.setValueAtTime(75, this.ctx.currentTime);
        
        this.ambientGain = this.ctx.createGain();
        this.ambientGain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        
        this.ambientOsc1.connect(lowpass);
        this.ambientOsc2.connect(lowpass);
        lowpass.connect(this.ambientGain);
        this.ambientGain.connect(this.ctx.destination);
        
        this.ambientOsc1.start();
        this.ambientOsc2.start();
    }

    stopAmbientHum() {
        if (this.ambientOsc1) {
            try { this.ambientOsc1.stop(); } catch(e){}
        }
        if (this.ambientOsc2) {
            try { this.ambientOsc2.stop(); } catch(e){}
        }
    }

    startHorrorMusic() {
        if (!this.ctx) return;
        
        // Detener música anterior por seguridad
        this.stopHorrorMusic();
        
        this.startAmbientHum();
        
        this.musicActive = true;
        this.musicStep = 0;
        
        const playMusicStep = () => {
            if (!this.musicActive || !this.ctx) return;
            
            // Latido cardíaco procedimental (Corazón thumping)
            if (this.musicStep % 2 === 0) {
                this.playHeartbeat(55, 0.4); // thud profundo
            } else {
                this.playHeartbeat(58, 0.25); // thud más agudo y ligero
            }
            
            // Melodía / screech disonante desesperante aleatorio
            if (this.musicStep % 8 === 0) {
                // Intervalo de segunda menor ultra disonante y aguda (Tensión extrema)
                this.playHorrorScreech(2637, 2793, 0.08, 1.2); 
            } else if (this.musicStep % 8 === 3) {
                // Segunda menor de tono medio alto (Desesperante)
                this.playHorrorScreech(1975, 2093, 0.06, 0.9);
            } else if (this.musicStep % 8 === 6) {
                // Escupido / Deslizamiento neumático de pánico
                this.playSlidingPanic(1400, 300, 0.4, 0.07);
            }
            
            this.musicStep++;
            
            // ¡Dinamismo Desesperante!: El ritmo del latido y los ruidos se acelera si la vida del jugador es baja
            let interval = 700; // Tempo normal
            const player = window.player;
            if (player && player.health < 40) {
                interval = 350; // Latido frenético de muerte inminente
            } else if (player && player.health < 70) {
                interval = 500; // Estado de alerta / sangrado
            }
            
            this.musicTimer = setTimeout(playMusicStep, interval);
        };
        
        playMusicStep();
    }

    stopHorrorMusic() {
        this.musicActive = false;
        if (this.musicTimer) {
            clearTimeout(this.musicTimer);
            this.musicTimer = null;
        }
        this.stopAmbientHum();
    }

    playHeartbeat(freq, gainVal) {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freq / 2.5, this.ctx.currentTime + 0.18);
        
        gainNode.gain.setValueAtTime(gainVal, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(100, this.ctx.currentTime);
        
        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 0.22);
    }

    playHorrorScreech(f1, f2, volume, duration) {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(f1, this.ctx.currentTime);
        osc1.frequency.linearRampToValueAtTime(f1 + 15, this.ctx.currentTime + duration);
        
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(f2, this.ctx.currentTime);
        osc2.frequency.linearRampToValueAtTime(f2 - 15, this.ctx.currentTime + duration);
        
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1000, this.ctx.currentTime); 
        
        gainNode.gain.setValueAtTime(0.001, this.ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + 0.05); 
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        
        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        
        osc1.start();
        osc2.start();
        osc1.stop(this.ctx.currentTime + duration + 0.05);
        osc2.stop(this.ctx.currentTime + duration + 0.05);
    }

    playSlidingPanic(startFreq, endFreq, duration, volume) {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + duration);
        
        gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(500, this.ctx.currentTime);
        
        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        
        osc.start();
        osc.stop(this.ctx.currentTime + duration + 0.02);
    }

    playGunshot() {
        if (!this.ctx) return;
        
        // Buffer de ruido blanco
        const bufferSize = this.ctx.sampleRate * 0.35; 
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        
        // Filtro paso banda para darle resonancia explosiva
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(450, this.ctx.currentTime);
        filter.Q.setValueAtTime(1.2, this.ctx.currentTime);
        
        // Envolvente de volumen (caída rápida)
        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(1.0, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
        
        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        noise.start();
        
        // Impacto sordo (boom de baja frecuencia)
        const boom = this.ctx.createOscillator();
        boom.type = 'triangle';
        boom.frequency.setValueAtTime(130, this.ctx.currentTime);
        boom.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.15);
        
        const boomGain = this.ctx.createGain();
        boomGain.gain.setValueAtTime(1.2, this.ctx.currentTime);
        boomGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.18);
        
        boom.connect(boomGain);
        boomGain.connect(this.ctx.destination);
        boom.start();
        boom.stop(this.ctx.currentTime + 0.2);
    }

    playGlockShot() {
        if (!this.ctx) return;
        
        const bufferSize = this.ctx.sampleRate * 0.15; 
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(700, this.ctx.currentTime);
        filter.Q.setValueAtTime(2.0, this.ctx.currentTime);
        
        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
        
        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        noise.start();
        
        const click = this.ctx.createOscillator();
        click.type = 'triangle';
        click.frequency.setValueAtTime(320, this.ctx.currentTime);
        click.frequency.exponentialRampToValueAtTime(90, this.ctx.currentTime + 0.07);
        
        const clickGain = this.ctx.createGain();
        clickGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        clickGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.07);
        
        click.connect(clickGain);
        clickGain.connect(this.ctx.destination);
        click.start();
        click.stop(this.ctx.currentTime + 0.09);
    }

    playM4Shot() {
        if (!this.ctx) return;
        
        const bufferSize = this.ctx.sampleRate * 0.12; 
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(600, this.ctx.currentTime);
        filter.Q.setValueAtTime(1.5, this.ctx.currentTime);
        
        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(0.65, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        
        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        noise.start();
        
        const punch = this.ctx.createOscillator();
        punch.type = 'sawtooth';
        punch.frequency.setValueAtTime(240, this.ctx.currentTime);
        punch.frequency.exponentialRampToValueAtTime(70, this.ctx.currentTime + 0.05);
        
        const punchGain = this.ctx.createGain();
        punchGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        punchGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
        
        punch.connect(punchGain);
        punchGain.connect(this.ctx.destination);
        punch.start();
        punch.stop(this.ctx.currentTime + 0.07);
    }

    playAcidBurn() {
        if (!this.ctx) return;
        
        const bufferSize = this.ctx.sampleRate * 0.45;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1400, this.ctx.currentTime);
        
        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(0.35, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
        
        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        noise.start();
    }

    playReload() {
        if (!this.ctx) return;
        // Sonidos metálicos en cadena
        this.playMetallicClick(900, 0.06, 0.2);
        setTimeout(() => {
            this.playMetallicClick(700, 0.1, 0.3);
        }, 250);
        setTimeout(() => {
            this.playMetallicClick(1100, 0.05, 0.25);
        }, 550);
    }

    playMetallicClick(freq, duration, gain) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freq / 2, this.ctx.currentTime + duration);
        
        oscGain.gain.setValueAtTime(gain, this.ctx.currentTime);
        oscGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        
        osc.connect(oscGain);
        oscGain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playEmptyClick() {
        if (!this.ctx) return;
        this.playMetallicClick(1500, 0.03, 0.15);
    }

    playZombieGroan() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80 + Math.random() * 20, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(45, this.ctx.currentTime + 1.2);
        
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(82 + Math.random() * 20, this.ctx.currentTime);
        osc2.frequency.linearRampToValueAtTime(43, this.ctx.currentTime + 1.2);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(250, this.ctx.currentTime);
        
        gainNode.gain.setValueAtTime(0.01, this.ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.25, this.ctx.currentTime + 0.2);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.2);
        
        osc.connect(filter);
        osc2.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        
        osc.start();
        osc2.start();
        osc.stop(this.ctx.currentTime + 1.3);
        osc2.stop(this.ctx.currentTime + 1.3);
    }

    playZombieHurt() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.25);
        
        gainNode.gain.setValueAtTime(0.35, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
        
        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }

    playPlayerHurt() {
        if (!this.ctx) return;
        // Sonido de impacto sordo
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(90, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(35, this.ctx.currentTime + 0.3);
        
        gainNode.gain.setValueAtTime(0.8, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
        
        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.35);
        
        // Ruido sibilante de dolor
        const bufferSize = this.ctx.sampleRate * 0.2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(300, this.ctx.currentTime);
        
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
        
        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        noise.start();
    }

    playDoorOpen() {
        if (!this.ctx) return;
        
        // Chirrido de compuerta neumática mecánica
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(65, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(45, this.ctx.currentTime + 0.9);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(180, this.ctx.currentTime);
        
        gainNode.gain.setValueAtTime(0.01, this.ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + 0.15);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.9);
        
        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 0.95);
        
        // Ruido sibilante de aire a presión
        const bufferSize = this.ctx.sampleRate * 0.8;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(200, this.ctx.currentTime);
        noiseFilter.Q.setValueAtTime(2.0, this.ctx.currentTime);
        
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.75);
        
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        noise.start();
    }

    playFusePickup() {
        if (!this.ctx) return;
        
        // Bip eléctrico ascendente y limpio
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(700, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1400, this.ctx.currentTime + 0.18);
        
        gainNode.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);
        
        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
        
        // Destello armónico agudo rápido
        setTimeout(() => {
            this.playMetallicClick(2200, 0.04, 0.1);
        }, 80);
    }

    playPowerRestored() {
        if (!this.ctx) return;
        
        // Zumbido eléctrico pesado inicial
        const osc = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gainNode = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(60, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(120, this.ctx.currentTime + 1.2);
        
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(60.5, this.ctx.currentTime);
        osc2.frequency.linearRampToValueAtTime(121, this.ctx.currentTime + 1.2);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(250, this.ctx.currentTime);
        
        gainNode.gain.setValueAtTime(0.01, this.ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.45, this.ctx.currentTime + 0.3);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.2);
        
        osc.connect(filter);
        osc2.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        
        osc.start();
        osc2.start();
        osc.stop(this.ctx.currentTime + 1.3);
        osc2.stop(this.ctx.currentTime + 1.3);
        
        // Sonido de turbina de generador encendiéndose
        const turbine = this.ctx.createOscillator();
        const turbineGain = this.ctx.createGain();
        turbine.type = 'sine';
        turbine.frequency.setValueAtTime(100, this.ctx.currentTime);
        turbine.frequency.exponentialRampToValueAtTime(750, this.ctx.currentTime + 1.0);
        
        turbineGain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        turbineGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.1);
        
        turbine.connect(turbineGain);
        turbineGain.connect(this.ctx.destination);
        turbine.start();
        turbine.stop(this.ctx.currentTime + 1.15);
    }

    playWinTune() {
        if (!this.ctx) return;
        // Acorde triunfal sintetizado
        const freqs = [261.63, 329.63, 392.00, 523.25]; // Do mayor
        freqs.forEach((f, index) => {
            setTimeout(() => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(f, this.ctx.currentTime);
                gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.0);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start();
                osc.stop(this.ctx.currentTime + 1.1);
            }, index * 100);
        });
    }

    playLoseTune() {
        if (!this.ctx) return;
        // Descenso melancólico
        const freqs = [220.00, 207.65, 196.00, 174.61]; 
        freqs.forEach((f, index) => {
            setTimeout(() => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(f, this.ctx.currentTime);
                gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start();
                osc.stop(this.ctx.currentTime + 0.9);
            }, index * 150);
        });
    }

    startBossMusic() {
        if (!this.ctx) return;

        // Detener cualquier música anterior
        this.stopHorrorMusic();

        this.musicActive = true;
        this.musicStep = 0;

        // Drone ambiental profundo y ominoso (40Hz + 40.6Hz para batido lento)
        this.ambientOsc1 = this.ctx.createOscillator();
        this.ambientOsc1.type = 'sawtooth';
        this.ambientOsc1.frequency.setValueAtTime(40, this.ctx.currentTime);

        this.ambientOsc2 = this.ctx.createOscillator();
        this.ambientOsc2.type = 'sawtooth';
        this.ambientOsc2.frequency.setValueAtTime(40.6, this.ctx.currentTime);

        const lowpass = this.ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.setValueAtTime(75, this.ctx.currentTime);

        this.ambientGain = this.ctx.createGain();
        this.ambientGain.gain.setValueAtTime(0.1, this.ctx.currentTime);

        this.ambientOsc1.connect(lowpass);
        this.ambientOsc2.connect(lowpass);
        lowpass.connect(this.ambientGain);
        this.ambientGain.connect(this.ctx.destination);

        this.ambientOsc1.start();
        this.ambientOsc2.start();

        const playBossStep = () => {
            if (!this.musicActive || !this.ctx) return;

            // Latido frenético cada paso (alternando graves)
            if (this.musicStep % 2 === 0) {
                this.playHeartbeat(40, 0.5);
            } else {
                this.playHeartbeat(45, 0.5);
            }

            // Alarma chirriante cada 4 pasos
            if (this.musicStep % 4 === 0) {
                this.playHorrorScreech(3000, 3200, 0.1, 0.8);
            }

            // Deslizamiento de pánico cada 6 pasos
            if (this.musicStep % 6 === 0) {
                this.playSlidingPanic(2000, 400, 0.6, 0.09);
            }

            // Acorde disonante cada 8 pasos
            if (this.musicStep % 8 === 0) {
                const oscA = this.ctx.createOscillator();
                const oscB = this.ctx.createOscillator();
                const chordGain = this.ctx.createGain();

                oscA.type = 'sine';
                oscA.frequency.setValueAtTime(73.42, this.ctx.currentTime);

                oscB.type = 'sawtooth';
                oscB.frequency.setValueAtTime(77.78, this.ctx.currentTime);

                chordGain.gain.setValueAtTime(0.15, this.ctx.currentTime);
                chordGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);

                oscA.connect(chordGain);
                oscB.connect(chordGain);
                chordGain.connect(this.ctx.destination);

                oscA.start();
                oscB.start();
                oscA.stop(this.ctx.currentTime + 0.55);
                oscB.stop(this.ctx.currentTime + 0.55);
            }

            this.musicStep++;

            // Tempo base 250ms, se acelera según vida del jugador
            let interval = 250;
            const player = window.player;
            if (player && player.health < 40) {
                interval = 150; // Pánico total
            } else if (player && player.health < 70) {
                interval = 200; // Alerta alta
            }

            this.musicTimer = setTimeout(playBossStep, interval);
        };

        playBossStep();
    }

    stopBossMusic() {
        this.stopHorrorMusic();
    }

    playBossRoar() {
        if (!this.ctx) return;

        // Oscilador principal: rugido grave descendente
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gainNode = this.ctx.createGain();

        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(60, this.ctx.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 1.5);

        osc2.type = 'square';
        osc2.frequency.setValueAtTime(80, this.ctx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 1.5);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(150, this.ctx.currentTime);

        gainNode.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.5);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        osc1.start();
        osc2.start();
        osc1.stop(this.ctx.currentTime + 1.55);
        osc2.stop(this.ctx.currentTime + 1.55);

        // Textura ruidosa con distorsión pesada
        const noiseOsc = this.ctx.createOscillator();
        const distortion = this.ctx.createWaveShaper();
        const noiseGain = this.ctx.createGain();

        noiseOsc.type = 'sawtooth';
        noiseOsc.frequency.setValueAtTime(200, this.ctx.currentTime);

        // Curva de distorsión agresiva
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            const x = (i * 2) / 256 - 1;
            curve[i] = (Math.PI + 200) * x / (Math.PI + 200 * Math.abs(x));
        }
        distortion.curve = curve;
        distortion.oversample = '4x';

        noiseGain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);

        noiseOsc.connect(distortion);
        distortion.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);

        noiseOsc.start();
        noiseOsc.stop(this.ctx.currentTime + 0.85);
    }

    playBossImpact() {
        if (!this.ctx) return;

        // Impacto grave pesado
        const osc1 = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(80, this.ctx.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.3);

        gainNode.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, this.ctx.currentTime);

        osc1.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        osc1.start();
        osc1.stop(this.ctx.currentTime + 0.4);

        // Anillo metálico agudo
        const osc2 = this.ctx.createOscillator();
        const ringGain = this.ctx.createGain();

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(2000, this.ctx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(500, this.ctx.currentTime + 0.2);

        ringGain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        ringGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);

        osc2.connect(ringGain);
        ringGain.connect(this.ctx.destination);

        osc2.start();
        osc2.stop(this.ctx.currentTime + 0.25);
    }
}

export const AudioSynth = new SoundSynth();
