
export class AudioQueue {
    private queue: string[] = [];
    private isPlaying = false;
    private currentAudio: HTMLAudioElement | null = null;
    private volume = 1.0;

    constructor() {
        this.queue = [];
    }

    setVolume(vol: number) {
        this.volume = Math.max(0, Math.min(1, vol));
        if (this.currentAudio) {
            this.currentAudio.volume = this.volume;
        }
    }

    enqueue(url: string) {
        this.queue.push(url);
        this.processQueue();
    }

    stop() {
        this.queue = [];
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.src = '';
            this.currentAudio = null;
        }
        this.isPlaying = false;
    }

    private async processQueue() {
        if (this.isPlaying || this.queue.length === 0) {
            return;
        }

        this.isPlaying = true;
        const nextUrl = this.queue.shift();

        if (nextUrl) {
            try {
                const audio = new Audio(nextUrl);
                audio.volume = this.volume;
                this.currentAudio = audio;

                await new Promise((resolve, reject) => {
                    audio.onended = resolve;
                    audio.onerror = reject;
                    audio.play().catch(reject);
                });
            } catch (err) {
                console.error("Audio playback failed", err);
            } finally {
                this.currentAudio = null;
                this.isPlaying = false;
                this.processQueue();
            }
        } else {
            this.isPlaying = false;
        }
    }
}

export const audioQueue = new AudioQueue();
