// データ分析・傾向計算ユーティリティ

/**
 * 馬番ごとの着順確率を計算
 * @param {Array} races - レースデータの配列
 * @returns {Object} 馬番ごとの着順確率
 */
export const calculatePlacementProbability = (races) => {
  const horseStats = {};

  races.forEach((race) => {
    race.horses.forEach((horse) => {
      const horseNum = String(horse.number);
      if (!horseStats[horseNum]) {
        horseStats[horseNum] = {
          number: horseNum,
          name: horse.name,
          total: 0,
          first: 0,
          second: 0,
          third: 0,
          other: 0,
        };
      }

      horseStats[horseNum].total += 1;

      const result = race.results.find((r) => r.number === horseNum);
      if (result) {
        if (result.placement === 1) {
          horseStats[horseNum].first += 1;
        } else if (result.placement === 2) {
          horseStats[horseNum].second += 1;
        } else if (result.placement === 3) {
          horseStats[horseNum].third += 1;
        } else {
          horseStats[horseNum].other += 1;
        }
      } else {
        horseStats[horseNum].other += 1;
      }
    });
  });

  // 確率に変換
  Object.keys(horseStats).forEach((key) => {
    const stats = horseStats[key];
    stats.firstRate = ((stats.first / stats.total) * 100).toFixed(1);
    stats.secondRate = ((stats.second / stats.total) * 100).toFixed(1);
    stats.thirdRate = ((stats.third / stats.total) * 100).toFixed(1);
  });

  return horseStats;
};

/**
 * 馬ごとの過去スコア推移を取得
 * @param {Array} races - レースデータの配列
 * @returns {Object} 馬番ごとのスコア推移
 */
export const calculateScoreTrend = (races) => {
  const scoreTrends = {};

  races.forEach((race) => {
    race.horses.forEach((horse) => {
      const horseNum = String(horse.number);
      if (!scoreTrends[horseNum]) {
        scoreTrends[horseNum] = {
          number: horseNum,
          name: horse.name,
          scores: [],
          dates: [],
          avgScore: 0,
        };
      }

      scoreTrends[horseNum].scores.push(horse.predictedScore || 0);
      scoreTrends[horseNum].dates.push(race.date);
    });
  });

  // 平均スコアを計算
  Object.keys(scoreTrends).forEach((key) => {
    const trend = scoreTrends[key];
    trend.avgScore = trend.scores.length > 0
      ? (trend.scores.reduce((a, b) => a + b, 0) / trend.scores.length).toFixed(2)
      : 0;
  });

  return scoreTrends;
};

/**
 * 枠ごとの着順確率を計算
 * @param {Array} races - レースデータの配列
 * @returns {Object} 枠ごとの着順確率
 */
export const calculateFrameProbability = (races) => {
  const frameStats = {};

  for (let frame = 1; frame <= 8; frame++) {
    frameStats[frame] = {
      frame,
      total: 0,
      first: 0,
      second: 0,
      third: 0,
    };
  }

  races.forEach((race) => {
    race.horses.forEach((horse) => {
      const frame = horse.frame;
      if (frame && frameStats[frame]) {
        frameStats[frame].total += 1;

        const result = race.results.find((r) => r.number === horse.number);
        if (result) {
          if (result.placement === 1) {
            frameStats[frame].first += 1;
          } else if (result.placement === 2) {
            frameStats[frame].second += 1;
          } else if (result.placement === 3) {
            frameStats[frame].third += 1;
          }
        }
      }
    });
  });

  // 確率に変換
  Object.keys(frameStats).forEach((key) => {
    const stats = frameStats[key];
    if (stats.total > 0) {
      stats.firstRate = ((stats.first / stats.total) * 100).toFixed(1);
      stats.secondRate = ((stats.second / stats.total) * 100).toFixed(1);
      stats.thirdRate = ((stats.third / stats.total) * 100).toFixed(1);
    } else {
      stats.firstRate = 0;
      stats.secondRate = 0;
      stats.thirdRate = 0;
    }
  });

  return frameStats;
};

/**
 * 騎手ごとの成績を計算
 * @param {Array} races - レースデータの配列
 * @returns {Object} 騎手ごとの成績
 */
export const calculateJockeyStats = (races) => {
  const jockeyStats = {};

  races.forEach((race) => {
    race.horses.forEach((horse) => {
      const jockey = horse.jockey || 'Unknown';
      if (!jockeyStats[jockey]) {
        jockeyStats[jockey] = {
          jockey,
          total: 0,
          wins: 0,
          winRate: 0,
        };
      }

      jockeyStats[jockey].total += 1;

      const result = race.results.find((r) => r.number === horse.number);
      if (result && result.placement === 1) {
        jockeyStats[jockey].wins += 1;
      }
    });
  });

  // 勝率を計算
  Object.keys(jockeyStats).forEach((key) => {
    const stats = jockeyStats[key];
    stats.winRate = stats.total > 0
      ? ((stats.wins / stats.total) * 100).toFixed(1)
      : 0;
  });

  return jockeyStats;
};

/**
 * TOP horses by win probability を取得
 * @param {Object} horseStats - 馬番ごとの統計データ
 * @param {number} limit - 上位N件
 * @returns {Array} 上位の馬
 */
export const getTopHorsesByWinRate = (horseStats, limit = 5) => {
  return Object.values(horseStats)
    .filter((h) => h.total >= 2) // 最低2回以上出走
    .sort((a, b) => parseFloat(b.firstRate) - parseFloat(a.firstRate))
    .slice(0, limit);
};
