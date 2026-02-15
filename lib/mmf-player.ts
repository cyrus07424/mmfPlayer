/**
 * MMF Player using Web Audio API
 * Plays back MMF/SMAF format music data
 */

import { MMFData, MMFNote } from './mmf-parser';

export type PlayerState = 'idle' | 'playing' | 'paused' | 'stopped';

export interface PlayerOptions {
  onProgress?: (progress: number) => void;
  onStateChange?: (state: PlayerState) => void;
  onEnd?: () => void;
}

export class MMFPlayer {
  private audioContext: AudioContext | null = null;
  private mmfData: MMFData | null = null;
  private state: PlayerState = 'idle';
  private startTime: number = 0;
  private pauseTime: number = 0;
  private scheduledNotes: Array<{ source: OscillatorNode; gain: GainNode }> = [];
  private options: PlayerOptions;

  constructor(options: PlayerOptions = {}) {
    this.options = options;
  }

  async load(mmfData: MMFData): Promise<void> {
    this.mmfData = mmfData;
    this.stop(); // Clean up any existing playback
  }

  async play(): Promise<void> {
    if (!this.mmfData) {
      throw new Error('No MMF data loaded');
    }

    // Initialize AudioContext if needed
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }

    // Resume if paused
    if (this.state === 'paused') {
      this.resume();
      return;
    }

    // Stop any existing playback
    if (this.state === 'playing') {
      this.stop();
    }

    this.setState('playing');
    this.startTime = this.audioContext.currentTime;
    
    // Schedule all notes
    this.scheduleNotes();

    // Start progress tracking
    this.startProgressTracking();

    // Schedule end callback
    if (this.mmfData.duration > 0) {
      setTimeout(() => {
        if (this.state === 'playing') {
          this.stop();
          this.options.onEnd?.();
        }
      }, this.mmfData.duration);
    }
  }

  pause(): void {
    if (this.state !== 'playing') return;

    this.setState('paused');
    this.pauseTime = this.audioContext!.currentTime - this.startTime;
    
    // Stop all scheduled notes
    this.clearScheduledNotes();
  }

  resume(): void {
    if (this.state !== 'paused' || !this.audioContext || !this.mmfData) return;

    this.setState('playing');
    this.startTime = this.audioContext.currentTime - this.pauseTime;
    
    // Reschedule remaining notes
    this.scheduleNotes(this.pauseTime * 1000);
    this.startProgressTracking();
  }

  stop(): void {
    if (this.state === 'idle') return;

    this.setState('stopped');
    this.clearScheduledNotes();
    this.startTime = 0;
    this.pauseTime = 0;

    // Reset to idle after a brief moment
    setTimeout(() => {
      if (this.state === 'stopped') {
        this.setState('idle');
      }
    }, 100);
  }

  getState(): PlayerState {
    return this.state;
  }

  getCurrentTime(): number {
    if (!this.audioContext) return 0;
    
    if (this.state === 'playing') {
      return (this.audioContext.currentTime - this.startTime) * 1000;
    } else if (this.state === 'paused') {
      return this.pauseTime * 1000;
    }
    
    return 0;
  }

  getDuration(): number {
    return this.mmfData?.duration ?? 0;
  }

  dispose(): void {
    this.stop();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.mmfData = null;
  }

  private scheduleNotes(fromTime: number = 0): void {
    if (!this.audioContext || !this.mmfData) return;

    const now = this.audioContext.currentTime;
    
    for (const note of this.mmfData.notes) {
      // Skip notes that have already played
      if (note.time < fromTime) continue;

      const startTime = now + (note.time - fromTime) / 1000;
      const endTime = startTime + note.duration / 1000;

      this.playNote(note, startTime, endTime);
    }
  }

  private playNote(note: MMFNote, startTime: number, endTime: number): void {
    if (!this.audioContext) return;

    try {
      // Create oscillator for the note
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      // Set frequency from MIDI note number
      const frequency = this.midiNoteToFrequency(note.note);
      oscillator.frequency.value = frequency;

      // Use a simple waveform (could be enhanced with different timbres)
      oscillator.type = 'square';

      // Set volume based on velocity
      const volume = note.velocity / 127 * 0.3; // Max volume 0.3 to avoid clipping
      gainNode.gain.setValueAtTime(volume, startTime);
      
      // Add envelope (ADSR)
      const attackTime = 0.01;
      const decayTime = 0.1;
      const sustainLevel = volume * 0.7;
      const releaseTime = 0.1;

      gainNode.gain.linearRampToValueAtTime(volume, startTime + attackTime);
      gainNode.gain.linearRampToValueAtTime(sustainLevel, startTime + attackTime + decayTime);
      gainNode.gain.setValueAtTime(sustainLevel, endTime - releaseTime);
      gainNode.gain.linearRampToValueAtTime(0.001, endTime);

      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Schedule start and stop
      oscillator.start(startTime);
      oscillator.stop(endTime);

      // Track scheduled notes for cleanup
      this.scheduledNotes.push({ source: oscillator, gain: gainNode });

      // Clean up after note ends
      oscillator.onended = () => {
        const index = this.scheduledNotes.findIndex(n => n.source === oscillator);
        if (index !== -1) {
          this.scheduledNotes.splice(index, 1);
        }
        gainNode.disconnect();
      };
    } catch (error) {
      console.error('Error playing note:', error);
    }
  }

  private midiNoteToFrequency(note: number): number {
    // MIDI note to frequency conversion
    // A4 (MIDI note 69) = 440 Hz
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  private clearScheduledNotes(): void {
    for (const { source, gain } of this.scheduledNotes) {
      try {
        source.stop();
        source.disconnect();
        gain.disconnect();
      } catch (error) {
        // Ignore errors when stopping already stopped notes
      }
    }
    this.scheduledNotes = [];
  }

  private startProgressTracking(): void {
    if (this.state !== 'playing' || !this.mmfData) return;

    const updateProgress = () => {
      if (this.state !== 'playing') return;

      const currentTime = this.getCurrentTime();
      const progress = this.mmfData!.duration > 0
        ? currentTime / this.mmfData!.duration
        : 0;

      this.options.onProgress?.(Math.min(progress, 1));

      if (progress < 1) {
        requestAnimationFrame(updateProgress);
      }
    };

    requestAnimationFrame(updateProgress);
  }

  private setState(newState: PlayerState): void {
    if (this.state === newState) return;
    
    this.state = newState;
    this.options.onStateChange?.(newState);
  }
}
