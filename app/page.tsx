import MMFPlayerUI from '@/components/mmf-player-ui';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 mb-3">
            MMF 着メロプレイヤー
          </h1>
          <p className="text-gray-600 text-lg">
            携帯電話の着メロファイル（MMF/SMAF形式）をブラウザで再生
          </p>
        </div>
        
        <MMFPlayerUI />
      </div>
      
      <footer className="text-center text-gray-500 mt-12">
        &copy; 2026 <a href="https://github.com/cyrus07424" target="_blank" className="hover:text-purple-600 transition-colors">cyrus</a>
      </footer>
    </div>
  );
}
