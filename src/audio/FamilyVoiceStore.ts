const DB_NAME = 'numberblock-rally-voices';
const STORE_NAME = 'clips';
const DB_VERSION = 1;

interface StoredClipRecord {
  id: string;
  blob: Blob;
  updatedAt: number;
}

export interface ActiveRecordingHandle {
  stop: () => Promise<Blob>;
}

export class FamilyVoiceStore {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private memoryFallback = new Map<string, Blob>();
  private activePreviewAudio: HTMLAudioElement | null = null;
  private activePreviewUrl: string | null = null;

  static isRecordingSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== 'undefined'
    );
  }

  async loadAllBlobs(): Promise<Map<string, Blob>> {
    const db = await this.openDb();
    if (!db) {
      return new Map(this.memoryFallback);
    }

    try {
      const records = await new Promise<StoredClipRecord[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          resolve((req.result as StoredClipRecord[]) ?? []);
        };
        req.onerror = () => reject(req.error ?? new Error('Failed to load clips'));
      });

      const result = new Map<string, Blob>();
      for (const rec of records) {
        if (rec && typeof rec.id === 'string' && rec.blob instanceof Blob) {
          result.set(rec.id, rec.blob);
        }
      }
      // Merge any in-memory fallback items if present
      for (const [id, blob] of this.memoryFallback.entries()) {
        if (!result.has(id)) {
          result.set(id, blob);
        }
      }
      return result;
    } catch {
      return new Map(this.memoryFallback);
    }
  }

  async getRecordedIds(): Promise<string[]> {
    const db = await this.openDb();
    if (!db) {
      return Array.from(this.memoryFallback.keys());
    }

    try {
      const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAllKeys();
        req.onsuccess = () => resolve(req.result ?? []);
        req.onerror = () => reject(req.error ?? new Error('Failed to read clip keys'));
      });

      const idSet = new Set<string>(
        keys.filter((k): k is string => typeof k === 'string')
      );
      for (const key of this.memoryFallback.keys()) {
        idSet.add(key);
      }
      return Array.from(idSet);
    } catch {
      return Array.from(this.memoryFallback.keys());
    }
  }

  async saveRecording(clipId: string, blob: Blob): Promise<void> {
    this.memoryFallback.set(clipId, blob);

    const db = await this.openDb();
    if (!db) return;

    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const record: StoredClipRecord = {
          id: clipId,
          blob,
          updatedAt: Date.now(),
        };
        store.put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Failed to save recording'));
        tx.onabort = () => reject(tx.error ?? new Error('Save transaction aborted'));
      });
    } catch {
      // In-memory fallback already has the blob so session continues seamlessly
    }
  }

  async deleteRecording(clipId: string): Promise<void> {
    this.memoryFallback.delete(clipId);

    const db = await this.openDb();
    if (!db) return;

    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(clipId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Failed to delete recording'));
        tx.onabort = () => reject(tx.error ?? new Error('Delete transaction aborted'));
      });
    } catch {
      // Ignore IDB errors; memory fallback is already updated
    }
  }

  async clearAll(): Promise<void> {
    this.memoryFallback.clear();

    const db = await this.openDb();
    if (!db) return;

    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Failed to clear recordings'));
        tx.onabort = () => reject(tx.error ?? new Error('Clear transaction aborted'));
      });
    } catch {
      // Ignore IDB errors
    }
  }

  async startRecording(maxDurationMs = 4000): Promise<ActiveRecordingHandle> {
    if (!FamilyVoiceStore.isRecordingSupported()) {
      throw new Error('Microphone recording is not supported in this browser.');
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }

    const chosenMimeType = this.pickBestMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = chosenMimeType
        ? new MediaRecorder(stream, { mimeType: chosenMimeType })
        : new MediaRecorder(stream);
    } catch {
      recorder = new MediaRecorder(stream);
    }

    const chunks: BlobPart[] = [];
    let settled = false;
    let stopPromise: Promise<Blob> | null = null;
    let autoStopTimer: number | null = null;

    let resolveBlob!: (blob: Blob) => void;
    let rejectBlob!: (err: Error) => void;

    const resultPromise = new Promise<Blob>((resolve, reject) => {
      resolveBlob = resolve;
      rejectBlob = reject;
    });

    const cleanupStream = (): void => {
      if (autoStopTimer !== null) {
        window.clearTimeout(autoStopTimer);
        autoStopTimer = null;
      }
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore track stop errors
        }
      });
    };

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onstop = () => {
      if (settled) return;
      settled = true;
      cleanupStream();
      const finalType = recorder.mimeType || chosenMimeType || 'audio/mp4';
      const blob = new Blob(chunks, { type: finalType });
      resolveBlob(blob);
    };

    recorder.onerror = () => {
      if (settled) return;
      settled = true;
      cleanupStream();
      rejectBlob(new Error('Audio recording failed.'));
    };

    const stop = (): Promise<Blob> => {
      if (stopPromise) return stopPromise;

      stopPromise = (async () => {
        if (autoStopTimer !== null) {
          window.clearTimeout(autoStopTimer);
          autoStopTimer = null;
        }
        if (recorder.state !== 'inactive') {
          try {
            recorder.stop();
          } catch {
            if (!settled) {
              settled = true;
              cleanupStream();
              const fallbackType = recorder.mimeType || chosenMimeType || 'audio/mp4';
              resolveBlob(new Blob(chunks, { type: fallbackType }));
            }
          }
        } else if (!settled) {
          settled = true;
          cleanupStream();
          const fallbackType = recorder.mimeType || chosenMimeType || 'audio/mp4';
          resolveBlob(new Blob(chunks, { type: fallbackType }));
        }
        return resultPromise;
      })();

      return stopPromise;
    };

    recorder.start(120);

    if (maxDurationMs > 0 && Number.isFinite(maxDurationMs)) {
      autoStopTimer = window.setTimeout(() => {
        void stop();
      }, maxDurationMs);
    }

    return { stop };
  }

  async previewBlob(blob: Blob): Promise<void> {
    this.stopPreview();

    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      return;
    }

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    this.activePreviewAudio = audio;
    this.activePreviewUrl = url;

    return new Promise<void>((resolve) => {
      let finished = false;

      const cleanup = (): void => {
        if (finished) return;
        finished = true;
        audio.onended = null;
        audio.onerror = null;
        if (this.activePreviewAudio === audio) {
          this.activePreviewAudio = null;
        }
        if (this.activePreviewUrl === url) {
          this.activePreviewUrl = null;
        }
        try {
          URL.revokeObjectURL(url);
        } catch {
          // Ignore revoke errors
        }
        resolve();
      };

      audio.onended = cleanup;
      audio.onerror = cleanup;

      const playResult = audio.play();
      if (playResult && typeof playResult.catch === 'function') {
        playResult.catch(() => {
          cleanup();
        });
      }
    });
  }

  private stopPreview(): void {
    if (this.activePreviewAudio) {
      try {
        this.activePreviewAudio.pause();
        this.activePreviewAudio.currentTime = 0;
        this.activePreviewAudio.onended = null;
        this.activePreviewAudio.onerror = null;
      } catch {
        // Ignore
      }
      this.activePreviewAudio = null;
    }
    if (this.activePreviewUrl) {
      try {
        URL.revokeObjectURL(this.activePreviewUrl);
      } catch {
        // Ignore
      }
      this.activePreviewUrl = null;
    }
  }

  private pickBestMimeType(): string | undefined {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
      return undefined;
    }
    const candidates = [
      'audio/mp4',
      'audio/webm;codecs=opus',
      'audio/webm',
    ];
    for (const mime of candidates) {
      try {
        if (MediaRecorder.isTypeSupported(mime)) {
          return mime;
        }
      } catch {
        // Ignore unsupported query errors
      }
    }
    return undefined;
  }

  private openDb(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;

    if (typeof indexedDB === 'undefined') {
      this.dbPromise = Promise.resolve(null);
      return this.dbPromise;
    }

    this.dbPromise = new Promise<IDBDatabase | null>((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        };

        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => {
            db.close();
            this.dbPromise = null;
          };
          resolve(db);
        };

        request.onerror = () => {
          resolve(null);
        };

        request.onblocked = () => {
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    });

    return this.dbPromise;
  }
}
