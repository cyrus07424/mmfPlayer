'use client';

import { useRef, useEffect, useMemo } from 'react';
import { MMFNote } from '@/lib/mmf-parser';

interface PianoRollProps {
  notes: MMFNote[];
  duration: number;
  progress: number;
}

const PIANO_KEY_WIDTH = 36;
const NOTE_HEIGHT = 10;
const CANVAS_WIDTH = 800;
const MIN_NOTE_RANGE = 24; // Minimum 2 octaves visible
const BLACK_NOTE_SET = new Set([1, 3, 6, 8, 10]); // C#, D#, F#, G#, A# within octave
// Yamaha/SMAF octave convention: MIDI note 60 = C3 (Middle C)
const OCTAVE_OFFSET = 2;
// Note rectangle insets (px) for visual separation between rows
const NOTE_MARGIN_X = 0.5;
const NOTE_MARGIN_Y = 1.5;
const NOTE_INNER_HEIGHT = NOTE_HEIGHT - 3;
const MIN_NOTE_WIDTH = 2;

function computeNoteRange(notes: MMFNote[]): { noteMin: number; noteMax: number } {
  if (notes.length === 0) return { noteMin: 48, noteMax: 72 };
  const min = Math.min(...notes.map((n) => n.note));
  const max = Math.max(...notes.map((n) => n.note));
  const padding = 2;
  const clampedMin = Math.max(0, min - padding);
  const clampedMax = Math.min(127, max + padding);
  // Ensure at least MIN_NOTE_RANGE rows
  const range = clampedMax - clampedMin + 1;
  if (range < MIN_NOTE_RANGE) {
    const extra = Math.ceil((MIN_NOTE_RANGE - range) / 2);
    return {
      noteMin: Math.max(0, clampedMin - extra),
      noteMax: Math.min(127, clampedMax + extra),
    };
  }
  return { noteMin: clampedMin, noteMax: clampedMax };
}

export default function PianoRoll({ notes, duration, progress }: PianoRollProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);

  const { noteMin, noteMax } = useMemo(() => computeNoteRange(notes), [notes]);
  const noteRange = noteMax - noteMin + 1;
  const canvasHeight = noteRange * NOTE_HEIGHT;
  const timeWidth = CANVAS_WIDTH - PIANO_KEY_WIDTH;
  const msPerPixel = useMemo(
    () => (duration > 0 ? duration / timeWidth : 1),
    [duration, timeWidth],
  );

  // Render static content (keys + notes) to an offscreen canvas
  useEffect(() => {
    if (notes.length === 0) return;

    const offscreen = document.createElement('canvas');
    offscreen.width = CANVAS_WIDTH;
    offscreen.height = canvasHeight;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    // --- Row backgrounds ---
    for (let noteNum = noteMax; noteNum >= noteMin; noteNum--) {
      const y = (noteMax - noteNum) * NOTE_HEIGHT;
      const isBlack = BLACK_NOTE_SET.has(noteNum % 12);
      ctx.fillStyle = isBlack ? '#0f172a' : '#1e293b';
      ctx.fillRect(PIANO_KEY_WIDTH, y, timeWidth, NOTE_HEIGHT);
    }

    // --- Row separator lines ---
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 0.5;
    for (let noteNum = noteMax; noteNum >= noteMin; noteNum--) {
      const y = (noteMax - noteNum) * NOTE_HEIGHT + NOTE_HEIGHT;
      ctx.beginPath();
      ctx.moveTo(PIANO_KEY_WIDTH, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }

    // --- C-note grid lines (brighter) ---
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 1;
    for (let noteNum = noteMax; noteNum >= noteMin; noteNum--) {
      if (noteNum % 12 === 0) {
        const y = (noteMax - noteNum) * NOTE_HEIGHT;
        ctx.beginPath();
        ctx.moveTo(PIANO_KEY_WIDTH, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }
    }

    // --- Time grid (every second) ---
    const pixelsPerSecond = 1000 / msPerPixel;
    if (pixelsPerSecond > 4) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
      ctx.lineWidth = 1;
      for (let sec = 0; sec * 1000 <= duration; sec++) {
        const x = PIANO_KEY_WIDTH + (sec * 1000) / msPerPixel;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
      }
    }

    // --- Note bars ---
    for (const note of notes) {
      if (note.note < noteMin || note.note > noteMax) continue;
      const x = PIANO_KEY_WIDTH + note.time / msPerPixel;
      const y = (noteMax - note.note) * NOTE_HEIGHT;
      const w = Math.max(MIN_NOTE_WIDTH, note.duration / msPerPixel);
      // Color by pitch class (C=red … B=violet)
      const hue = (note.note % 12) * 30;
      ctx.fillStyle = `hsl(${hue}, 75%, 60%)`;
      ctx.fillRect(
        x + NOTE_MARGIN_X,
        y + NOTE_MARGIN_Y,
        Math.max(w - 1, MIN_NOTE_WIDTH),
        NOTE_INNER_HEIGHT,
      );
    }

    // --- Piano keys (left column) ---
    for (let noteNum = noteMax; noteNum >= noteMin; noteNum--) {
      const y = (noteMax - noteNum) * NOTE_HEIGHT;
      const isBlack = BLACK_NOTE_SET.has(noteNum % 12);

      ctx.fillStyle = isBlack ? '#1f1f1f' : '#e8e8e8';
      ctx.fillRect(0, y, PIANO_KEY_WIDTH - 2, NOTE_HEIGHT);

      ctx.strokeStyle = isBlack ? '#333' : '#bbb';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(0, y, PIANO_KEY_WIDTH - 2, NOTE_HEIGHT);

      // Label every C note
      if (noteNum % 12 === 0) {
        const octave = Math.floor(noteNum / 12) - OCTAVE_OFFSET;
        ctx.fillStyle = '#555';
        ctx.font = `${NOTE_HEIGHT - 3}px monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`C${octave}`, 2, y + NOTE_HEIGHT / 2);
      }
    }

    offscreenRef.current = offscreen;
  }, [notes, duration, noteMin, noteMax, noteRange, canvasHeight, timeWidth, msPerPixel]);

  // Composite offscreen canvas + playback cursor
  useEffect(() => {
    if (notes.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas || !offscreenRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Redraw static content
    ctx.drawImage(offscreenRef.current, 0, 0);

    // Draw playback cursor
    const cursorX = PIANO_KEY_WIDTH + progress * timeWidth;
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cursorX, 0);
    ctx.lineTo(cursorX, canvasHeight);
    ctx.stroke();
  }, [notes, progress, timeWidth, canvasHeight]);

  // Auto-scroll to keep the cursor in view during playback
  useEffect(() => {
    const container = containerRef.current;
    if (!container || progress <= 0 || progress >= 1) return;
    const cursorX = PIANO_KEY_WIDTH + progress * timeWidth;
    const containerWidth = container.clientWidth;
    const scrollLeft = container.scrollLeft;
    if (
      cursorX < scrollLeft + PIANO_KEY_WIDTH ||
      cursorX > scrollLeft + containerWidth - 40
    ) {
      container.scrollLeft = Math.max(0, cursorX - containerWidth / 2);
    }
  }, [progress, timeWidth]);

  if (notes.length === 0) return null;

  return (
    <div className="mt-6 rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
      <div className="px-4 py-2 text-sm font-medium text-slate-300 border-b border-slate-700">
        🎹 ピアノロール
      </div>
      <div ref={containerRef} className="overflow-x-auto">
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={canvasHeight} className="block" />
      </div>
    </div>
  );
}
