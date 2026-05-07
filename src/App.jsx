import React, { useState, useRef } from 'react';
import { Upload, Download, Settings, BarChart3, TrendingUp, AlertCircle, CheckCircle2, Edit2, Save, X, Camera, Loader, Plus, Trash2, Star } from 'lucide-react';

const KeibaAnalysisApp = () => {
  const [races, setRaces] = useState([]);
  const [currentStep, setCurrentStep] = useState('upload');
  const [pendingRace, setPendingRace] = useState(null);
  const [editingRace, setEditingRace] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(/iPhone|iPad|Android/i.test(navigator.userAgent));
  const [resultInputMethod, setResultInputMethod] = useState('image');
  const [manualResults, setManualResults] = useState({ first: '', second: '', third: '' });

  const [parameters, setParameters] = useState({
    frameWeight: 0.25,
    conditionWeight: 0.35,
    jockeyWeight: 0.2,
    otherWeight: 0.2,
  });

  const [budget, setBudget] = useState(10000);
  const [showSettings, setShowSettings] = useState(false);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const extractTextFromImage = async (imageFile) => {
    setOcrLoading(true);
    try {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/2.1.5/tesseract.min.js';
      document.body.appendChild(script);
      return new Promise((resolve) => {
        script.onload = async () => {
          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              const result = await Tesseract.recognize(e.target.result, 'jpn+eng', {
                logger: (m) => console.log('OCR Progress:', Math.round(m.progress * 100) + '%'),
              });
              resolve(result.data.text);
            } catch (error) {
              console.error('OCR Error:', error);
              resolve('');
            }
          };
          reader.readAsDataURL(imageFile);
        };
      });
    } catch (error) {
      console.error('Script loading error:', error);
      setOcrLoading(false);
      return '';
    }
  };

  const parseRaceData = async (ocrText, imageType) => {
    const lines = ocrText.split('\n').filter((l) => l.trim().length > 0);
    let raceData = {
      id: Date.now(),
      date: new Date().toLocaleDateString('ja-JP'),
      imageType,
      horses: [],
      results: [],
      ocrRawText: ocrText,
    };
    if (imageType === 'lineup') {
      raceData.horses = parseLineupTable(lines);
    } else if (imageType === 'results') {
      raceData.results = parseResultsTable(lines);
    }
    return raceData;
  };

  const parseLineupTable = (lines) => {
    const horses = [];
    lines.forEach((line, idx) => {
      const match = line.match(/(\d+)\s+(.+?)\s+(◎|○|▲|△|×)?(.+)?/);
      if (match) {
        horses.push({
          id: idx,
          number: match[1],
          name: match[2].trim(),
          mark: match[3] || '△',
          condition: match[4] ? parseCondition(match[4]) : 'normal',
          frame: Math.floor(Math.random() * 8) + 1,
          jockey: 'Unknown',
          predictedScore: 0,
        });
      }
    });
    return horses;
  };

  const parseResultsTable = (lines) => {
    const results = [];
    lines.forEach((line, idx) => {
      const match = line.match(/(\d+)着\s+(\d+)番/);
      if (match) {
        results.push({
          placement: parseInt(match[1]),
          number: match[2],
        });
      }
    });
    return results;
  };

  const parseCondition = (text) => {
    if (text.includes('↑')) return 'up';
    if (text.includes('↓')) return 'down';
    return 'normal';
  };

  const calculateExpectedValue = (horse) => {
    const scores = {
      frame: (horse.frame / 8) * parameters.frameWeight,
      condition: (horse.condition === 'up' ? 1 : horse.condition === 'down' ? 0.3 : 0.6) * parameters.conditionWeight,
      mark: (horse.mark === '◎' ? 1 : horse.mark === '○' ? 0.7 : horse.mark === '▲' ? 0.4 : 0.1) * parameters.otherWeight,
    };
    return Object.values(scores).reduce((a, b) => a + b, 0);
  };

  const isValidHorse = (h) => {
    const num = String(h.number || '').trim();
    return num !== '' && num !== '0';
  };

  const getCurrentRaceRecommendations = (horses) => {
    if (!horses || horses.length === 0) return [];
    return horses
      .filter(isValidHorse)
      .map((h) => ({ ...h, ev: calculateExpectedValue(h) }))
      .sort((a, b) => b.ev - a.ev)
      .slice(0, 3);
  };

  const determineMode = (recentRaces) => {
    if (recentRaces.length === 0) return 'unknown';
    const recentWins = recentRaces
      .flatMap((r) => r.results)
      .filter((res) => res.placement === 1);
    const topFavoriteWins = recentWins.filter((w) =>
      recentRaces.some((r) => r.horses.some((h) => h.number === w.number && h.mark === '◎'))
    );
    const topFavoriteWinRate = recentWins.length > 0 ? topFavoriteWins.length / recentWins.length : 0;
    if (topFavoriteWinRate < 0.4) return 'recovery';
    if (topFavoriteWinRate > 0.7) return 'reduction';
    return 'adjustment';
  };

  const calculateKellyBetting = (horses, mode) => {
    const recommendations = horses
      .filter(isValidHorse)
      .map((h) => ({ ...h, ev: calculateExpectedValue(h) }))
      .sort((a, b) => b.ev - a.ev)
      .slice(0, 3);
    const totalEV = recommendations.reduce((sum, h) => sum + h.ev, 0);
    const modeMultiplier = mode === 'recovery' ? 1.2 : mode === 'reduction' ? 0.7 : 1.0;
    return recommendations.map((h) => {
      const ratio = totalEV > 0 ? (h.ev / totalEV) * modeMultiplier : 0;
      const amount = Math.floor(budget * ratio);
      return {
        ...h,
        recommendedAmount: amount,
        recommendedTickets: Math.max(1, Math.floor(amount / 100)),
      };
    });
  };

  const handleImageUpload = async (event, imageType) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setOcrLoading(true);
    const ocrText = await extractTextFromImage(file);
    const parsed = await parseRaceData(ocrText, imageType);
    setPendingRace(parsed);
    setCurrentStep('review');
    setOcrLoading(false);
  };

  const handleAddManualResult = () => {
    if (!manualResults.first) {
      alert('1着の馬番を入力してください');
      return;
    }
    const newResults = [];
    if (manualResults.first) newResults.push({ placement: 1, number: manualResults.first });
    if (manualResults.second) newResults.push({ placement: 2, number: manualResults.second });
    if (manualResults.third) newResults.push({ placement: 3, number: manualResults.third });
    if (pendingRace) {
      pendingRace.results = newResults;
      setPendingRace({ ...pendingRace });
    }
    setManualResults({ first: '', second: '', third: '' });
    setResultInputMethod('image');
  };

  const handleSaveRace = () => {
    if (editingRace) {
      setRaces(races.map((r) => (r.id === editingRace.id ? editingRace : r)));
      setEditingRace(null);
    } else if (pendingRace) {
      setRaces([...races, pendingRace]);
      setPendingRace(null);
    }
    setCurrentStep('analyze');
  };

  const exportToCSV = () => {
    const csvContent = [
      ['Date', 'Mode', 'Horse#', 'Mark', 'Frame', 'Condition', 'Placement', 'EV Score'].join(','),
      ...races.flatMap((r) =>
        r.horses.map((h) => {
          const result = r.results.find((res) => res.number === h.number);
          return [
            r.date,
            determineMode([r]),
            h.number,
            h.mark,
            h.frame,
            h.condition,
            result?.placement || '-',
            calculateExpectedValue(h).toFixed(3),
          ].join(',');
        })
      ),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `keiba_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const conditionLabel = (c) => (c === 'up' ? '↑ 好調' : c === 'down' ? '↓ 不調' : '→ 普通');

  const recentRaces = races.slice(-5);
  const currentMode = determineMode(recentRaces);
  const currentRaceRecommendations = pendingRace ? getCurrentRaceRecommendations(pendingRace.horses) : [];
  const pastRaceRecommendations =
    races.length > 0 && races[races.length - 1].horses
      ? calculateKellyBetting(races[races.length - 1].horses, currentMode)
      : [];

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-gray-100 ${isMobile ? 'p-3' : 'p-6'}`}>
      <div className={isMobile ? 'mb-4' : 'mb-8'}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} text-cyan-400`} />
            <h1 className={`${isMobile ? 'text-lg' : 'text-4xl'} font-bold text-cyan-400`}>
              メダル競馬予想アプリ
            </h1>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 transition border border-slate-600"
          >
            <Settings className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'}`} />
          </button>
        </div>
      </div>

      <div className={isMobile ? 'space-y-3' : 'space-y-4'}>
        {/* 出馬表入力 */}
        <div className="bg-slate-700/30 rounded-xl border border-slate-600 p-4 backdrop-blur">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Upload className="w-4 h-4 text-cyan-400" />
            出馬表データ入力
          </h2>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-2 px-3 border-2 border-dashed border-slate-500 rounded-lg hover:border-cyan-400 cursor-pointer transition bg-slate-800/50 text-sm font-semibold"
          >
            📸 出馬表画像を選択
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleImageUpload(e, 'lineup')}
            className="hidden"
          />
          {ocrLoading && (
            <div className="mt-3 p-3 bg-blue-500/20 border border-blue-500 rounded-lg flex items-center gap-2">
              <Loader className="w-4 h-4 animate-spin text-blue-400" />
              <span className="text-sm">処理中...</span>
            </div>
          )}
        </div>

        {/* 本レース推奨馬 */}
        {pendingRace && pendingRace.horses.length > 0 && currentRaceRecommendations.length > 0 && (
          <div className="bg-gradient-to-r from-yellow-900/40 to-amber-900/40 rounded-xl border border-yellow-600 p-4 backdrop-blur">
            <h2 className="font-semibold mb-3 flex items-center gap-2 text-yellow-300">
              <Star className="w-5 h-5" />
              本レース推奨馬（TOP 3）
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-yellow-500/50 text-yellow-300">
                    <th className="text-left py-2 px-2 font-semibold">順位</th>
                    <th className="text-left py-2 px-2 font-semibold">馬番</th>
                    <th className="text-left py-2 px-2 font-semibold">馬名</th>
                    <th className="text-left py-2 px-2 font-semibold">印</th>
                    <th className="text-left py-2 px-2 font-semibold">調子</th>
                    <th className="text-left py-2 px-2 font-semibold">枠</th>
                    <th className="text-right py-2 px-2 font-semibold">スコア</th>
                  </tr>
                </thead>
                <tbody>
                  {currentRaceRecommendations.map((horse, idx) => (
                    <tr key={horse.id} className="border-b border-slate-700/60">
                      <td className="py-2 px-2 font-bold text-yellow-300">{idx + 1}</td>
                      <td className="py-2 px-2 font-semibold">#{horse.number}</td>
                      <td className="py-2 px-2 text-gray-200">{horse.name}</td>
                      <td className="py-2 px-2">
                        <span className="inline-block px-2 py-0.5 bg-yellow-600/30 rounded text-yellow-200 text-xs">
                          {horse.mark}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-cyan-300">{conditionLabel(horse.condition)}</td>
                      <td className="py-2 px-2 text-cyan-300">{horse.frame}</td>
                      <td className="py-2 px-2 text-right font-mono text-cyan-300">{horse.ev.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-xs text-gray-400 space-y-1">
              <p>📖 印: ◎本命 / ○対抗 / ▲単穴 / △連下 / ×大穴</p>
              <p>📖 調子: ↑好調 / →普通 / ↓不調　/　スコア: 期待値（高いほど推奨）</p>
            </div>
          </div>
        )}

        {/* 結果入力 */}
        {pendingRace && pendingRace.horses.length > 0 && pendingRace.results.length === 0 && (
          <div className="bg-slate-700/30 rounded-xl border border-slate-600 p-4 backdrop-blur">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              結果入力
            </h2>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setResultInputMethod('image')}
                className={`flex-1 py-2 rounded-lg font-semibold text-sm transition ${
                  resultInputMethod === 'image' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                }`}
              >
                📸 画像から
              </button>
              <button
                onClick={() => setResultInputMethod('manual')}
                className={`flex-1 py-2 rounded-lg font-semibold text-sm transition ${
                  resultInputMethod === 'manual' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                }`}
              >
                ✏️ 手入力
              </button>
            </div>
            {resultInputMethod === 'image' && (
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="w-full py-2 px-3 border-2 border-dashed border-slate-500 rounded-lg hover:border-cyan-400 cursor-pointer transition bg-slate-800/50 text-sm font-semibold"
              >
                📸 結果画像を選択
              </button>
            )}
            {resultInputMethod === 'manual' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">1着（必須）</label>
                  <input
                    type="text"
                    placeholder="馬番を入力（例：1）"
                    value={manualResults.first}
                    onChange={(e) => setManualResults({ ...manualResults, first: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-500 rounded text-gray-100 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">2着（オプション）</label>
                  <input
                    type="text"
                    placeholder="馬番を入力"
                    value={manualResults.second}
                    onChange={(e) => setManualResults({ ...manualResults, second: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-500 rounded text-gray-100 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">3着（オプション）</label>
                  <input
                    type="text"
                    placeholder="馬番を入力"
                    value={manualResults.third}
                    onChange={(e) => setManualResults({ ...manualResults, third: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-500 rounded text-gray-100 text-sm"
                  />
                </div>
                <button
                  onClick={handleAddManualResult}
                  className="w-full py-2 bg-green-600 hover:bg-green-500 rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  結果を確定
                </button>
              </div>
            )}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleImageUpload(e, 'results')}
              className="hidden"
            />
          </div>
        )}

        {/* データ確認・編集 */}
        {(editingRace || pendingRace) && (
          <div className="bg-slate-700/30 rounded-xl border border-slate-600 p-4 backdrop-blur">
            <h2 className="font-semibold mb-3">データ確認・編集</h2>
            {(editingRace || pendingRace)?.horses && (
              <div>
                <p className="text-sm font-semibold mb-1 text-cyan-400">出馬表（OCR認識結果を編集）</p>
                <p className="text-xs text-gray-400 mb-3">
                  ⚠ 馬番が「0」または空、馬名が認識できなかった行は<span className="text-red-400">赤枠</span>で表示されます。実際の値に修正してください。
                </p>
                <div className="overflow-x-auto mb-4">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-600 text-cyan-400">
                        <th className="text-left py-2 px-2 font-semibold w-12">No.</th>
                        <th className="text-left py-2 px-2 font-semibold w-24">馬番</th>
                        <th className="text-left py-2 px-2 font-semibold">馬名</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(editingRace || pendingRace).horses.map((horse, idx) => {
                        const numStr = String(horse.number || '');
                        const numInvalid = !numStr || numStr === '0';
                        const nameInvalid = !horse.name || horse.name.trim().length <= 1;
                        return (
                          <tr key={horse.id} className="border-b border-slate-700/60">
                            <td className="py-1 px-2 text-gray-400">{idx + 1}</td>
                            <td className="py-1 px-2">
                              <input
                                type="text"
                                value={numStr === '0' ? '' : numStr}
                                onChange={(e) => {
                                  const updated = editingRace || pendingRace;
                                  updated.horses[idx].number = e.target.value;
                                  editingRace ? setEditingRace({ ...updated }) : setPendingRace({ ...updated });
                                }}
                                placeholder="（要入力）"
                                className={`w-full px-2 py-1 bg-slate-900 border rounded text-gray-100 text-xs ${numInvalid ? 'border-red-500' : 'border-slate-500'}`}
                              />
                            </td>
                            <td className="py-1 px-2">
                              <input
                                type="text"
                                value={horse.name || ''}
                                onChange={(e) => {
                                  const updated = editingRace || pendingRace;
                                  updated.horses[idx].name = e.target.value;
                                  editingRace ? setEditingRace({ ...updated }) : setPendingRace({ ...updated });
                                }}
                                placeholder="（馬名を入力）"
                                className={`w-full px-2 py-1 bg-slate-900 border rounded text-gray-100 text-xs ${nameInvalid ? 'border-red-500' : 'border-slate-500'}`}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {(editingRace || pendingRace)?.results && (editingRace || pendingRace).results.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2 text-green-400">入力済み結果</p>
                <div className="space-y-1 mb-4">
                  {(editingRace || pendingRace).results.map((result, idx) => (
                    <div key={idx} className="p-2 bg-slate-800/50 rounded text-sm">
                      <p>{result.placement}着：{result.number}番</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSaveRace}
                disabled={!((editingRace || pendingRace)?.results && (editingRace || pendingRace).results.length > 0)}
                className="flex-1 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold text-sm"
              >
                保存
              </button>
              <button
                onClick={() => {
                  setEditingRace(null);
                  setPendingRace(null);
                  setManualResults({ first: '', second: '', third: '' });
                }}
                className="flex-1 py-2 bg-red-600/30 hover:bg-red-600/40 rounded-lg font-semibold text-sm"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {/* レース履歴 */}
        {races.length > 0 && (
          <div className="bg-slate-700/30 rounded-xl border border-slate-600 p-4 backdrop-blur">
            <h2 className="font-semibold mb-2">レース履歴：{races.length}ゲーム</h2>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {races.map((race) => {
                const mode = determineMode([race]);
                return (
                  <div key={race.id} className="p-2 bg-slate-800/50 rounded border border-slate-600 text-xs">
                    <p className="font-semibold">{race.date} - {race.horses.length}頭</p>
                    <p className="text-gray-400">
                      モード: {mode === 'recovery' ? '回収' : mode === 'reduction' ? '還元' : '調整'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 統計情報 */}
        {races.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-700/30 rounded-xl border border-slate-600 p-3 backdrop-blur">
              <p className="text-xs text-gray-400">入力レース数</p>
              <p className="text-2xl font-bold text-cyan-400">{races.length}</p>
            </div>
            <div className="bg-slate-700/30 rounded-xl border border-slate-600 p-3 backdrop-blur">
              <p className="text-xs text-gray-400">現在のモード</p>
              <p className="text-lg font-bold text-yellow-400">
                {currentMode === 'recovery' ? '回収' : currentMode === 'reduction' ? '還元' : '調整'}
              </p>
            </div>
          </div>
        )}

        {/* 過去レース推奨馬 */}
        {pastRaceRecommendations.length > 0 && (
          <div className="bg-slate-700/30 rounded-xl border border-slate-600 p-4 backdrop-blur">
            <h2 className="font-semibold mb-2 flex items-center gap-2 text-blue-300">
              <TrendingUp className="w-4 h-4" />
              過去統計の推奨馬（TOP 3）
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-blue-500/50 text-blue-300">
                    <th className="text-left py-2 px-2 font-semibold">順位</th>
                    <th className="text-left py-2 px-2 font-semibold">馬番</th>
                    <th className="text-left py-2 px-2 font-semibold">馬名</th>
                    <th className="text-left py-2 px-2 font-semibold">印</th>
                    <th className="text-right py-2 px-2 font-semibold">スコア</th>
                    <th className="text-right py-2 px-2 font-semibold">推奨金額</th>
                  </tr>
                </thead>
                <tbody>
                  {pastRaceRecommendations.map((h, idx) => (
                    <tr key={h.id} className="border-b border-slate-700/60">
                      <td className="py-2 px-2 font-bold text-blue-300">{idx + 1}</td>
                      <td className="py-2 px-2 font-semibold">#{h.number}</td>
                      <td className="py-2 px-2 text-gray-200">{h.name}</td>
                      <td className="py-2 px-2">
                        <span className="inline-block px-2 py-0.5 bg-blue-600/30 rounded text-blue-200 text-xs">
                          {h.mark}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-cyan-300">{h.ev.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right font-mono text-green-300">¥{h.recommendedAmount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CSV出力 */}
        {races.length > 0 && (
          <button
            onClick={exportToCSV}
            className="w-full py-2 bg-green-600 hover:bg-green-500 rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            CSV出力（全ゲーム）
          </button>
        )}
      </div>

      {/* 設定モーダル */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-xl border border-slate-600 p-6 max-w-sm w-full">
            <h2 className="text-xl font-bold mb-4">設定</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  予算: ¥{budget.toLocaleString()}
                </label>
                <input
                  type="range"
                  min="1000"
                  max="100000"
                  step="1000"
                  value={budget}
                  onChange={(e) => setBudget(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg font-semibold"
              >
                完了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const globalStyle = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; }
`;
if (typeof document !== 'undefined' && !document.getElementById('global-style')) {
  const style = document.createElement('style');
  style.id = 'global-style';
  style.textContent = globalStyle;
  document.head.appendChild(style);
}

export default KeibaAnalysisApp;
