'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { parseMMF, MMFData } from '@/lib/mmf-parser';
import { MMFPlayer, PlayerState } from '@/lib/mmf-player';

export default function MMFPlayerUI() {
  const [mmfData, setMMfData] = useState<MMFData | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [error, setError] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [playerState, setPlayerState] = useState<PlayerState>('idle');
  const [progress, setProgress] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const playerRef = useRef<MMFPlayer | null>(null);

  // Initialize player
  useEffect(() => {
    playerRef.current = new MMFPlayer({
      onProgress: (p) => setProgress(p),
      onStateChange: (state) => setPlayerState(state),
      onEnd: () => setProgress(1),
    });

    return () => {
      playerRef.current?.dispose();
      playerRef.current = null;
    };
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setError('');
    setProgress(0);
    
    // Validate file
    if (!file.name.toLowerCase().endsWith('.mmf') && !file.name.toLowerCase().endsWith('.smaf')) {
      setError('ファイルはMMF形式またはSMAF形式である必要があります');
      return;
    }

    try {
      // Read file
      const arrayBuffer = await file.arrayBuffer();
      setFileName(file.name);
      setFileSize(file.size);

      // Parse MMF data
      const data = parseMMF(arrayBuffer);
      setMMfData(data);

      // Load into player
      await playerRef.current?.load(data);

      // Stop any existing playback
      if (playerState === 'playing') {
        playerRef.current?.stop();
      }
    } catch (err) {
      console.error('Error parsing MMF file:', err);
      setError(err instanceof Error ? err.message : 'ファイルの解析に失敗しました');
      setMMfData(null);
    }
  }, [playerState]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handlePlayPause = async () => {
    if (!playerRef.current || !mmfData) return;

    if (playerState === 'playing') {
      playerRef.current.pause();
    } else if (playerState === 'paused') {
      await playerRef.current.play();
    } else {
      await playerRef.current.play();
    }
  };

  const handleStop = () => {
    if (!playerRef.current) return;
    playerRef.current.stop();
    setProgress(0);
  };

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* File upload area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 bg-white'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".mmf,.smaf"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="space-y-4">
          <div className="text-6xl">🎵</div>
          <div>
            <p className="text-lg font-medium text-gray-700 mb-2">
              MMFファイルをドロップするか、クリックして選択
            </p>
            <p className="text-sm text-gray-500">
              対応形式: .mmf, .smaf
            </p>
          </div>
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
          >
            ファイルを選択
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 font-medium">エラー</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* File info and player controls */}
      {mmfData && (
        <div className="mt-6 bg-white rounded-lg shadow-lg overflow-hidden">
          {/* File information */}
          <div className="p-6 bg-gradient-to-r from-purple-500 to-pink-500 text-white">
            <h3 className="text-xl font-bold mb-3">ファイル情報</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-2">
                <span className="font-medium">ファイル名:</span>
                <span>{fileName}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-medium">サイズ:</span>
                <span>{formatFileSize(fileSize)}</span>
              </div>
              {mmfData.metadata.title && (
                <div className="flex items-center space-x-2">
                  <span className="font-medium">曲名:</span>
                  <span>{mmfData.metadata.title}</span>
                </div>
              )}
              {mmfData.metadata.composer && (
                <div className="flex items-center space-x-2">
                  <span className="font-medium">作曲者:</span>
                  <span>{mmfData.metadata.composer}</span>
                </div>
              )}
              {mmfData.metadata.arranger && (
                <div className="flex items-center space-x-2">
                  <span className="font-medium">編曲者:</span>
                  <span>{mmfData.metadata.arranger}</span>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <span className="font-medium">長さ:</span>
                <span>{formatTime(mmfData.duration)}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-medium">テンポ:</span>
                <span>{mmfData.tempo} BPM</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-medium">音符数:</span>
                <span>{mmfData.notes.length}</span>
              </div>
            </div>
          </div>

          {/* Player controls */}
          <div className="p-6">
            {/* Progress bar */}
            <div className="mb-6">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>{formatTime(progress * mmfData.duration)}</span>
                <span>{formatTime(mmfData.duration)}</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-200"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>

            {/* Control buttons */}
            <div className="flex justify-center space-x-4">
              <button
                onClick={handlePlayPause}
                className={`px-8 py-3 rounded-lg font-medium transition-all shadow-md hover:shadow-lg ${
                  playerState === 'playing'
                    ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {playerState === 'playing' ? '⏸ 一時停止' : '▶ 再生'}
              </button>
              
              <button
                onClick={handleStop}
                disabled={playerState === 'idle'}
                className={`px-8 py-3 rounded-lg font-medium transition-all shadow-md ${
                  playerState === 'idle'
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-red-500 hover:bg-red-600 text-white hover:shadow-lg'
                }`}
              >
                ⏹ 停止
              </button>
            </div>

            {/* Status indicator */}
            <div className="mt-4 text-center">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                playerState === 'playing'
                  ? 'bg-green-100 text-green-800'
                  : playerState === 'paused'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {playerState === 'playing' && '🎵 再生中'}
                {playerState === 'paused' && '⏸ 一時停止中'}
                {playerState === 'idle' && '待機中'}
                {playerState === 'stopped' && '停止'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Usage instructions */}
      <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="text-lg font-bold text-blue-900 mb-3">使い方</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
          <li>MMF形式またはSMAF形式の着メロファイルを選択またはドラッグ&ドロップ</li>
          <li>ファイル情報が表示されたら、再生ボタンをクリック</li>
          <li>一時停止ボタンで再生を一時停止、停止ボタンで完全に停止</li>
          <li>進捗バーで現在の再生位置を確認</li>
        </ol>
      </div>
    </div>
  );
}
