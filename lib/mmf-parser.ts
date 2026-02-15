/**
 * MMF (Mobile Music File / SMAF) Parser
 * Parses MMF/SMAF format binary data used in mobile phone ringtones
 */

const DEFAULT_NOTE_DURATION_MS = 250; // Default duration when note off events are not tracked

export interface MMFNote {
  time: number;        // Time in milliseconds
  note: number;        // MIDI note number (0-127)
  duration: number;    // Duration in milliseconds
  velocity: number;    // Velocity (0-127)
  channel: number;     // MIDI channel
}

export interface MMFMetadata {
  title?: string;
  composer?: string;
  arranger?: string;
  copyright?: string;
}

export interface MMFData {
  metadata: MMFMetadata;
  notes: MMFNote[];
  duration: number;    // Total duration in milliseconds
  tempo: number;       // Tempo in BPM
}

interface ChunkInfo {
  type: string;
  size: number;
  offset: number;
}

export class MMFParser {
  private data: Uint8Array;
  private position: number = 0;

  constructor(arrayBuffer: ArrayBuffer) {
    this.data = new Uint8Array(arrayBuffer);
  }

  parse(): MMFData {
    // Verify MMMD header
    if (!this.verifyHeader()) {
      throw new Error('Invalid MMF file: MMMD header not found');
    }

    const metadata: MMFMetadata = {};
    const notes: MMFNote[] = [];
    let tempo = 120; // Default tempo

    // Parse file size
    const fileSize = this.readUInt32BE();
    
    // Parse chunks
    while (this.position < this.data.length - 8) {
      const chunk = this.readChunkHeader();
      
      if (!chunk) break;

      switch (chunk.type) {
        case 'CNTI':
        case 'OPDA':
          // Parse content info and optional data chunks
          Object.assign(metadata, this.parseCNTI(chunk));
          break;
        case 'MTR ':
        case 'Mtr ':
          // Parse music track chunk
          const trackData = this.parseMTR(chunk);
          notes.push(...trackData.notes);
          if (trackData.tempo) tempo = trackData.tempo;
          break;
        case 'MSTR':
          // Master track - skip for now (contains global tempo/timing)
          this.position = chunk.offset + chunk.size;
          break;
        case 'Atsq':
        case 'ATR ':
          // Audio track - skip for now
          this.position = chunk.offset + chunk.size;
          break;
        default:
          // Skip unknown chunks
          this.position = chunk.offset + chunk.size;
          break;
      }
    }

    // Calculate total duration
    const duration = notes.length > 0
      ? Math.max(...notes.map(n => n.time + n.duration))
      : 0;

    return {
      metadata,
      notes,
      duration,
      tempo
    };
  }

  private verifyHeader(): boolean {
    const header = this.readString(4);
    return header === 'MMMD';
  }

  private readChunkHeader(): ChunkInfo | null {
    if (this.position >= this.data.length - 8) {
      return null;
    }

    const type = this.readString(4);
    const size = this.readUInt32BE();
    const offset = this.position;

    return { type, size, offset };
  }

  private parseCNTI(chunk: ChunkInfo): MMFMetadata {
    const metadata: MMFMetadata = {};
    const endPos = chunk.offset + chunk.size;

    while (this.position < endPos - 2) {
      const contentType = this.readUInt8();
      const contentSize = this.readUInt8();
      
      if (contentSize === 0 || this.position + contentSize > endPos) {
        break;
      }

      const content = this.readString(contentSize);

      switch (contentType) {
        case 0x00:
          metadata.title = content;
          break;
        case 0x01:
          metadata.composer = content;
          break;
        case 0x02:
          metadata.arranger = content;
          break;
        case 0x03:
          metadata.copyright = content;
          break;
      }
    }

    this.position = endPos;
    return metadata;
  }

  private parseMTR(chunk: ChunkInfo): { notes: MMFNote[]; tempo?: number } {
    const notes: MMFNote[] = [];
    const endPos = chunk.offset + chunk.size;
    let currentTime = 0;
    let tempo: number | undefined;

    // Parse MTR chunk header fields
    // These fields define the format and timing for the sequence data
    if (this.position >= endPos) {
      this.position = endPos;
      return { notes, tempo };
    }

    // Format Type (1 byte) - defines the format of sequence data
    const formatType = this.readUInt8();
    if (this.position >= endPos) {
      this.position = endPos;
      return { notes, tempo };
    }

    // Sequence Type (1 byte) - defines if continuous or phrase-based
    const sequenceType = this.readUInt8();
    if (this.position >= endPos) {
      this.position = endPos;
      return { notes, tempo };
    }

    // TimeBase_D (1 byte) - time base for duration
    const timeBaseD = this.readUInt8();
    if (this.position >= endPos) {
      this.position = endPos;
      return { notes, tempo };
    }

    // TimeBase_G (1 byte) - time base for gate time
    const timeBaseG = this.readUInt8();
    if (this.position >= endPos) {
      this.position = endPos;
      return { notes, tempo };
    }

    // Channel status (1 byte)
    const channelStatus = this.readUInt8();
    if (this.position >= endPos) {
      this.position = endPos;
      return { notes, tempo };
    }

    // Calculate time resolution in milliseconds
    // TimeBase values represent ticks per quarter note
    // Default tempo is 120 BPM = 500ms per quarter note
    const msPerQuarterNote = 500; // 120 BPM default
    const tickDuration = timeBaseD > 0 ? msPerQuarterNote / timeBaseD : 1;

    // Parse sequence data
    while (this.position < endPos - 1) {
      const status = this.readUInt8();

      // Note off: 0x80-0x8F
      if (status >= 0x80 && status <= 0x8F) {
        const channel = status & 0x0F;
        if (this.position + 2 > endPos) break;
        const note = this.readUInt8();
        const velocity = this.readUInt8();
        // Skip note off events - using default duration for simplicity
        continue;
      }

      // Note on: 0x90-0x9F
      if (status >= 0x90 && status <= 0x9F) {
        const channel = status & 0x0F;
        if (this.position + 2 > endPos) break;
        const note = this.readUInt8();
        const velocity = this.readUInt8();
        
        if (velocity > 0) {
          // Use default duration since note off tracking is not implemented
          const duration = DEFAULT_NOTE_DURATION_MS;
          notes.push({
            time: currentTime,
            note,
            duration,
            velocity,
            channel
          });
        }
        continue;
      }

      // Tempo change: 0xFF 0x51 0x03
      if (status === 0xFF) {
        if (this.position + 2 > endPos) break;
        const metaType = this.readUInt8();
        const length = this.readUInt8();
        
        if (metaType === 0x51 && length === 3 && this.position + 3 <= endPos) {
          const microsecondsPerBeat = this.readUInt24BE();
          tempo = Math.round(60000000 / microsecondsPerBeat);
        } else {
          // Skip meta event data
          if (this.position + length <= endPos) {
            this.position += length;
          } else {
            break;
          }
        }
        continue;
      }

      // Delta time (variable length)
      if (status < 0x80) {
        const deltaTime = this.readVariableLength(status);
        currentTime += deltaTime * tickDuration;
        continue;
      }

      // Control change, program change, etc - skip
      if (status >= 0xB0 && status <= 0xEF) {
        const dataBytes = status >= 0xC0 && status <= 0xDF ? 1 : 2;
        if (this.position + dataBytes <= endPos) {
          this.position += dataBytes;
        } else {
          break;
        }
        continue;
      }

      // If we get here, try to skip this byte
      if (this.position >= endPos) break;
    }

    this.position = endPos;
    return { notes, tempo };
  }

  private readVariableLength(firstByte?: number): number {
    let value = firstByte ?? this.readUInt8();
    
    if (value & 0x80) {
      value &= 0x7F;
      let byte: number;
      do {
        byte = this.readUInt8();
        value = (value << 7) | (byte & 0x7F);
      } while (byte & 0x80);
    }
    
    return value;
  }

  private readString(length: number): string {
    const bytes = this.data.slice(this.position, this.position + length);
    this.position += length;
    
    // Handle Shift-JIS encoded strings
    try {
      const decoder = new TextDecoder('shift-jis');
      return decoder.decode(bytes).replace(/\0/g, '').trim();
    } catch {
      // Fallback to ASCII
      return String.fromCharCode(...bytes).replace(/\0/g, '').trim();
    }
  }

  private readUInt8(): number {
    return this.data[this.position++];
  }

  private readUInt16BE(): number {
    const value = (this.data[this.position] << 8) | this.data[this.position + 1];
    this.position += 2;
    return value;
  }

  private readUInt24BE(): number {
    const value = (this.data[this.position] << 16) | 
                  (this.data[this.position + 1] << 8) | 
                  this.data[this.position + 2];
    this.position += 3;
    return value;
  }

  private readUInt32BE(): number {
    const value = (this.data[this.position] << 24) | 
                  (this.data[this.position + 1] << 16) | 
                  (this.data[this.position + 2] << 8) | 
                  this.data[this.position + 3];
    this.position += 4;
    return value >>> 0; // Convert to unsigned
  }
}

export function parseMMF(arrayBuffer: ArrayBuffer): MMFData {
  const parser = new MMFParser(arrayBuffer);
  return parser.parse();
}
