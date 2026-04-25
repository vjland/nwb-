// Initialize Lucide icons
lucide.createIcons();

// State
let appMode = 'demo'; // 'demo' | 'live'
let activeTab = 'chart'; // 'chart' | 'log'

let demoLogs = [];
let demoChartData = [];

let liveLogs = [];
let liveChartData = [];

let isPanelOpen = false;
let autoHide = false;
let liveWinner = null; // 'Player' | 'Banker' | 'Tie' | null
let liveIsNatural = null; // boolean | null
let showMA = false;
let showBigRoad = false;
let maPeriod = 9;
let selectionStart = null;
let selectionEnd = null;

// DOM Elements
const btnModeDemo = document.getElementById('btn-mode-demo');
const btnModeLive = document.getElementById('btn-mode-live');
const nextBetIndicator = document.getElementById('next-bet-indicator');
const btnDemoRefresh = document.getElementById('btn-demo-refresh');
const btnLivePanelToggle = document.getElementById('btn-live-panel-toggle');
const liveInputPanel = document.getElementById('live-input-panel');
const btnBigRoadToggle = document.getElementById('btn-big-road-toggle');
const bigRoadContainer = document.getElementById('big-road-container');
const bigRoadGrid = document.getElementById('big-road-grid');
const chartContainer = document.getElementById('chart-container');

const btnWinnerPlayer = document.getElementById('btn-winner-player');
const btnWinnerBanker = document.getElementById('btn-winner-banker');
const btnNaturalY = document.getElementById('btn-natural-y');
const btnNaturalN = document.getElementById('btn-natural-n');
const checkboxAutoHide = document.getElementById('autoHide');

const btnLiveConfirm = document.getElementById('btn-live-confirm');
const btnLiveUndo = document.getElementById('btn-live-undo');
const btnLiveReset = document.getElementById('btn-live-reset');

const tabChart = document.getElementById('tab-chart');
const tabLog = document.getElementById('tab-log');
const logTbody = document.getElementById('log-tbody');

const btnTabChart = document.getElementById('btn-tab-chart');
const btnTabLog = document.getElementById('btn-tab-log');

const resetModal = document.getElementById('reset-modal');
const btnResetCancel = document.getElementById('btn-reset-cancel');
const btnResetConfirm = document.getElementById('btn-reset-confirm');

const bottomNav = document.getElementById('bottom-nav');

// Chart Setup
const ctx = document.getElementById('myChart').getContext('2d');
const labels = Array.from({ length: 80 }, (_, i) => i + 1);
const verticalLinePlugin = {
  id: "verticalLine",
  beforeDraw: (chart, args, options) => {
    const { start, end } = options;
    if (start !== undefined && start !== null) {
      const meta = chart.getDatasetMeta(0);
      const { top, bottom } = chart.chartArea;
      const ctx = chart.ctx;

      const startDataPoint = meta.data[start];
      if (!startDataPoint) return;
      const startX = startDataPoint.x;

      let endX = startX;
      let showArea = false;

      if (end !== undefined && end !== null) {
        const endDataPoint = meta.data[end];
        if (endDataPoint) {
          endX = endDataPoint.x;
          showArea = true;
        }
      }

      ctx.save();
      
      if (showArea) {
        ctx.fillStyle = "rgba(128, 128, 128, 0.2)";
        ctx.fillRect(Math.min(startX, endX), top, Math.abs(endX - startX), bottom - top);
      }

      ctx.beginPath();
      ctx.moveTo(startX, top);
      ctx.lineTo(startX, bottom);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(0, 255, 0, 1)";
      ctx.stroke();

      if (showArea) {
        ctx.beginPath();
        ctx.moveTo(endX, top);
        ctx.lineTo(endX, bottom);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(255, 0, 255, 1)";
        ctx.stroke();
      }

      ctx.restore();
    }
  }
};

const chart = new Chart(ctx, {
  type: 'line',
  data: {
    labels,
    datasets: [{
      label: 'Running Sum',
      data: [],
      borderColor: '#E5446D',
      backgroundColor: 'rgba(229, 68, 109, 0.1)',
      borderWidth: 2,
      tension: 0.1,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointBackgroundColor: '#E5446D',
    }, {
      label: 'MA(9)',
      data: [],
      borderColor: '#6A6B83',
      backgroundColor: 'transparent',
      borderWidth: 1,
      tension: 0.1,
      pointRadius: 0,
      pointHoverRadius: 0,
      hidden: true
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: 0 },
    scales: {
      x: {
        min: 0, max: 79,
        title: { display: false },
        grid: { display: false },
        ticks: { color: '#A1A1AA' }
      },
      y: {
        min: -20, max: 20,
        title: { display: false },
        grid: { 
          display: true, 
          color: '#18181b',
          drawTicks: false
        },
        ticks: { 
          color: '#A1A1AA',
          stepSize: 2
        }
      }
    },
    plugins: {
      verticalLine: {
        start: null,
        end: null,
      },
      legend: { display: false },
      tooltip: {
        enabled: false,
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'y',
        },
        limits: {
          y: { min: -40, max: 40 }
        }
      }
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    onClick: (event, elements, chartInstance) => {
      if (appMode !== 'demo') {
        if (elements && elements.length > 0) {
          selectionStart = elements[0].index;
          selectionEnd = null;
        } else if (chartInstance) {
          let val = chartInstance.scales.x.getValueForPixel(event.x);
          if (val !== undefined && val !== null) {
            val = Math.round(val);
            const currentChartData = appMode === 'live' ? liveChartData : demoChartData;
            if (val >= 0 && val < currentChartData.length) {
              selectionStart = val;
              selectionEnd = null;
            }
          }
        }
        chart.options.plugins.verticalLine.start = selectionStart;
        chart.options.plugins.verticalLine.end = selectionEnd;
        chart.update();
        renderBigRoad();
        updateSelectedHandInfo();
        return;
      }

      let clickedIndex = null;
      if (elements && elements.length > 0) {
        clickedIndex = elements[0].index;
      } else if (chartInstance) {
        let val = chartInstance.scales.x.getValueForPixel(event.x);
        if (val !== undefined && val !== null) {
          val = Math.round(val);
          const currentChartData = appMode === 'live' ? liveChartData : demoChartData;
          if (val >= 0 && val < currentChartData.length) {
            clickedIndex = val;
          }
        }
      }

      if (clickedIndex !== null) {
        if (selectionStart === null || (selectionStart !== null && selectionEnd !== null)) {
          selectionStart = clickedIndex;
          selectionEnd = null;
        } else {
          selectionEnd = clickedIndex;
        }
      } else {
        selectionStart = null;
        selectionEnd = null;
      }

      chart.options.plugins.verticalLine.start = selectionStart;
      chart.options.plugins.verticalLine.end = selectionEnd;
      chart.update();
      renderBigRoad();
      updateSelectedHandInfo();
    }
  },
  plugins: [verticalLinePlugin]
});

function updateSelectedHandInfo() {
  const infoEl = document.getElementById('selected-hand-info');
  if (!infoEl) return;
  const chartData = appMode === 'live' ? liveChartData : demoChartData;
  
  if (selectionStart !== null && chartData[selectionStart] !== undefined) {
    let html = `
      <div class="flex flex-col gap-1">
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full bg-[#00FF00]"></div>
          <span class="text-zinc-100 font-bold">Start: Hand ${selectionStart + 1}</span>
          <span class="text-zinc-600">|</span>
          <span class="${chartData[selectionStart] >= 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}">Score: ${chartData[selectionStart]}</span>
        </div>`;
    
    if (selectionEnd !== null && chartData[selectionEnd] !== undefined) {
      const diff = chartData[selectionEnd] - chartData[selectionStart];
      html += `
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full bg-[#FF00FF]"></div>
          <span class="text-zinc-100 font-bold">End: Hand ${selectionEnd + 1}</span>
          <span class="text-zinc-600">|</span>
          <span class="${chartData[selectionEnd] >= 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}">Score: ${chartData[selectionEnd]}</span>
        </div>
        <div class="flex items-center gap-2 pt-1 border-t border-zinc-800">
          <span class="text-zinc-400">Diff:</span>
          <span class="${diff >= 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}">${diff > 0 ? '+' : ''}${diff}</span>
          <span class="text-zinc-600">|</span>
          <span class="text-zinc-400">Hands: ${Math.abs(selectionEnd - selectionStart)}</span>
        </div>`;
    }
    
    html += `</div>`;
    infoEl.innerHTML = html;
    
    infoEl.classList.remove('hidden');
    // Ensure the container accommodates the larger widget height
    infoEl.className = "hidden flex flex-col items-start bg-zinc-900/90 px-2.5 py-1.5 rounded-md border border-zinc-700 shadow-sm backdrop-blur-sm text-xs font-mono text-zinc-300 w-fit";
    infoEl.classList.remove('hidden');
  } else {
    infoEl.classList.add('hidden');
  }
}

// Baccarat Logic
const createShoe = (numDecks) => {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const values = { 'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 0, 'J': 0, 'Q': 0, 'K': 0 };
  let shoe = [];
  for (let i = 0; i < numDecks; i++) {
    for (const suit of suits) {
      for (const rank of ranks) {
        shoe.push({ suit, rank, value: values[rank] });
      }
    }
  }
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
};

const getHandValue = (cards) => {
  return cards.reduce((sum, card) => sum + card.value, 0) % 10;
};

const dealHand = (shoe) => {
  if (shoe.length < 6) return null;
  const player = [shoe.pop()];
  const banker = [shoe.pop()];
  player.push(shoe.pop());
  banker.push(shoe.pop());

  let playerValue = getHandValue(player);
  let bankerValue = getHandValue(banker);

  let playerDrew = false;
  let playerThirdCard = null;

  if (playerValue >= 8 || bankerValue >= 8) {
    // Natural, both stand
  } else {
    if (playerValue <= 5) {
      playerThirdCard = shoe.pop();
      player.push(playerThirdCard);
      playerValue = getHandValue(player);
      playerDrew = true;
    }

    if (!playerDrew) {
      if (bankerValue <= 5) {
        banker.push(shoe.pop());
        bankerValue = getHandValue(banker);
      }
    } else {
      const p3 = playerThirdCard.value;
      let bankerDraws = false;
      if (bankerValue <= 2) bankerDraws = true;
      else if (bankerValue === 3 && p3 !== 8) bankerDraws = true;
      else if (bankerValue === 4 && p3 >= 2 && p3 <= 7) bankerDraws = true;
      else if (bankerValue === 5 && p3 >= 4 && p3 <= 7) bankerDraws = true;
      else if (bankerValue === 6 && (p3 === 6 || p3 === 7)) bankerDraws = true;

      if (bankerDraws) {
        banker.push(shoe.pop());
        bankerValue = getHandValue(banker);
      }
    }
  }

  let winner = 'Tie';
  if (playerValue > bankerValue) winner = 'Player';
  else if (bankerValue > playerValue) winner = 'Banker';

  return {
    player, banker, playerValue, bankerValue, winner,
    isNatural: player.length === 2 && banker.length === 2
  };
};

const simulate = () => {
  const shoe = createShoe(8);
  const cutCardIndex = 14;
  let runningSum = 0;
  let nextBet = null;
  let handNumber = 1;
  const logs = [];
  const chartData = [];

  while (shoe.length > cutCardIndex && handNumber <= 80) {
    const result = dealHand(shoe);
    if (!result) break;

    let betResult = 'No Bet';
    let betPlaced = nextBet;

    if (nextBet) {
      if (result.winner === 'Tie') betResult = 'Push';
      else if (result.winner === nextBet) { betResult = 'Win'; runningSum += 1; }
      else { betResult = 'Loss'; runningSum -= 1; }
    }

    logs.push({
      handNumber, player: result.player, banker: result.banker,
      playerValue: result.playerValue, bankerValue: result.bankerValue,
      winner: result.winner, isNatural: result.isNatural,
      betPlaced, betResult, runningSum
    });

    if (result.winner !== 'Tie') chartData.push(runningSum);

    if (result.winner !== 'Tie') {
      if (result.isNatural) nextBet = 'Banker';
      else nextBet = 'Player';
    }

    handNumber++;
  }
  return { logs, chartData };
};

const getNextBet = (logs) => {
  for (let i = logs.length - 1; i >= 0; i--) {
    if (logs[i].winner !== 'Tie') {
      return logs[i].isNatural ? 'Banker' : 'Player';
    }
  }
  return null;
};

const calculateMA = (data, period) => {
  const ma = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      ma.push(null);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const sum = slice.reduce((a, b) => a + b, 0);
      ma.push(sum / period);
    }
  }
  return ma;
};

// UI Updates
const updateUI = () => {
  const currentLogs = appMode === 'demo' ? demoLogs : liveLogs;
  const currentChartData = appMode === 'demo' ? demoChartData : liveChartData;
  const nextUpcomingBet = getNextBet(currentLogs);

  // Update Chart
  const color = appMode === 'demo' ? '#E5446D' : '#90BE6D';
  const maColor = appMode === 'demo' ? '#6A6B83' : '#DE6C83';
  const chartBg = appMode === 'demo' ? '#09090b' : '#18181b';
  
  chartContainer.style.backgroundColor = chartBg;
  
  chart.data.datasets[0].data = currentChartData;
  chart.data.datasets[0].borderColor = color;
  chart.data.datasets[0].backgroundColor = color;
  
  chart.data.datasets[1].label = `MA(${maPeriod})`;
  chart.data.datasets[1].data = calculateMA(currentChartData, maPeriod);
  chart.data.datasets[1].borderColor = maColor;
  chart.data.datasets[1].hidden = !showMA;
  
  chart.update();

  // Update MA Period Buttons
  const btnMa6 = document.getElementById('btn-ma-period-6');
  const btnMa9 = document.getElementById('btn-ma-period-9');
  
  if (showMA && maPeriod === 6) {
    btnMa6.classList.add('bg-blue-600', 'text-white');
    btnMa6.classList.remove('text-zinc-500', 'hover:text-zinc-300');
  } else {
    btnMa6.classList.remove('bg-blue-600', 'text-white');
    btnMa6.classList.add('text-zinc-500', 'hover:text-zinc-300');
  }

  if (showMA && maPeriod === 9) {
    btnMa9.classList.add('bg-blue-600', 'text-white');
    btnMa9.classList.remove('text-zinc-500', 'hover:text-zinc-300');
  } else {
    btnMa9.classList.remove('bg-blue-600', 'text-white');
    btnMa9.classList.add('text-zinc-500', 'hover:text-zinc-300');
  }

  // Update Next Bet Indicator
  if (appMode === 'live' && nextUpcomingBet) {
    nextBetIndicator.classList.remove('hidden');
    nextBetIndicator.textContent = nextUpcomingBet.charAt(0);
    if (nextUpcomingBet === 'Banker') {
      nextBetIndicator.className = 'flex items-center justify-center w-8 h-8 rounded border-2 font-bold text-sm border-red-500 text-red-500';
    } else {
      nextBetIndicator.className = 'flex items-center justify-center w-8 h-8 rounded border-2 font-bold text-sm border-blue-500 text-blue-500';
    }
  } else {
    nextBetIndicator.classList.add('hidden');
  }

  // Update Log Table
  logTbody.innerHTML = '';
  const reversedLogs = [...currentLogs].reverse();
  reversedLogs.forEach(log => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-zinc-800/30 transition-colors';
    
    const scoreStr = log.playerValue !== undefined ? `${log.playerValue}-${log.bankerValue}` : '-';
    
    let winColor = 'text-green-400';
    if (log.winner === 'Player') winColor = 'text-blue-400';
    else if (log.winner === 'Banker') winColor = 'text-red-400';

    let betClass = 'text-blue-200/50';
    if (log.betResult === 'Win') betClass = 'bg-green-500/20 text-green-400';
    else if (log.betResult === 'Loss') betClass = 'bg-red-500/20 text-red-400';
    else if (log.betResult === 'Push') betClass = 'bg-[#EA9010]/20 text-[#EA9010]';

    let sumColor = 'text-zinc-100';
    let sumPrefix = '';
    if (log.runningSum > 0) { sumColor = 'text-green-400'; sumPrefix = '+'; }
    else if (log.runningSum < 0) { sumColor = 'text-red-400'; }

    tr.innerHTML = `
      <td class="px-2 py-3 text-zinc-100">${log.handNumber}</td>
      <td class="px-2 py-3">${scoreStr}</td>
      <td class="px-2 py-3 font-medium ${winColor}">${log.winner.charAt(0)}${log.isNatural ? '(N)' : ''}</td>
      <td class="px-2 py-3">
        <span class="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${betClass}">
          ${log.betPlaced ? log.betPlaced.charAt(0) : '-'}
        </span>
      </td>
      <td class="px-2 py-3 font-bold ${sumColor}">${sumPrefix}${log.runningSum}</td>
    `;
    logTbody.appendChild(tr);
  });

  // Update Live Panel Buttons State
  if (appMode === 'live') {
    btnLiveConfirm.disabled = !liveWinner || liveIsNatural === null;
    btnLiveUndo.disabled = liveLogs.length === 0;
    btnLiveReset.disabled = liveLogs.length === 0;

    // Update Winner Buttons
    btnWinnerPlayer.className = `aspect-square flex items-center justify-center rounded-lg text-xl font-bold border ${liveWinner === 'Player' ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800/50'}`;
    btnWinnerBanker.className = `aspect-square flex items-center justify-center rounded-lg text-xl font-bold border ${liveWinner === 'Banker' ? 'bg-red-600 border-red-600 text-white' : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800/50'}`;
    
    // Update Natural Buttons
    btnNaturalY.className = `aspect-square flex items-center justify-center rounded-lg text-xl font-bold border ${liveIsNatural === true ? 'bg-live-500 border-live-500 text-zinc-950' : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800/50'}`;
    btnNaturalN.className = `aspect-square flex items-center justify-center rounded-lg text-xl font-bold border ${liveIsNatural === false ? 'bg-live-highlight border-live-highlight text-zinc-950' : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800/50'}`;
  }

  // Update Big Road Toggle UI
  if (showBigRoad) {
    btnBigRoadToggle.classList.remove('bg-zinc-800', 'hover:bg-zinc-700', 'text-zinc-100');
    btnBigRoadToggle.classList.add('bg-blue-600', 'text-white');
    bigRoadContainer.classList.remove('hidden');
    renderBigRoad();
  } else {
    btnBigRoadToggle.classList.add('bg-zinc-800', 'hover:bg-zinc-700', 'text-zinc-100');
    btnBigRoadToggle.classList.remove('bg-blue-600', 'text-white');
    bigRoadContainer.classList.add('hidden');
  }
  
  updateSelectedHandInfo();
};

function renderBigRoad() {
  const logs = appMode === 'live' ? liveLogs : demoLogs;
  const gridData = [];
  const getCell = (c, r) => gridData[c]?.[r];
  const setCell = (c, r, data) => {
    if (!gridData[c]) gridData[c] = [];
    gridData[c][r] = data;
  };

  let logicalCol = 0;
  let actualCol = 0;
  let actualRow = 0;
  let lastWinner = null;
  let pendingTies = 0;
  let nonTieCount = 0;

  for (const log of logs) {
    if (log.winner === "Tie") {
      if (lastWinner === null) {
        pendingTies++;
      } else {
        const cell = getCell(actualCol, actualRow);
        if (cell) cell.ties = (cell.ties || 0) + 1;
      }
    } else {
      if (log.winner !== lastWinner) {
        if (lastWinner !== null) {
          logicalCol++;
          while (getCell(logicalCol, 0)) logicalCol++;
        }
        actualCol = logicalCol;
        actualRow = 0;
        lastWinner = log.winner;
      } else {
        let nextRow = actualRow + 1;
        let nextCol = actualCol;
        if (nextRow < 6 && !getCell(nextCol, nextRow)) {
          actualRow = nextRow;
        } else {
          actualCol++;
          while (getCell(actualCol, actualRow)) actualCol++;
        }
      }
      setCell(actualCol, actualRow, { winner: log.winner, isNatural: log.isNatural, ties: pendingTies, nonTieIndex: nonTieCount });
      nonTieCount++;
      pendingTies = 0;
    }
  }

  if (lastWinner === null && pendingTies > 0) {
    setCell(0, 0, { winner: "Tie", isNatural: false, ties: pendingTies });
  }

  const maxCols = Math.max(20, gridData.length);
  const renderGrid = Array.from({ length: maxCols }, () => Array(6).fill(null));

  for (let c = 0; c < gridData.length; c++) {
    if (!gridData[c]) continue;
    for (let r = 0; r < 6; r++) {
      if (gridData[c][r]) {
        if (c >= renderGrid.length) {
          renderGrid.push(Array(6).fill(null));
        }
        renderGrid[c][r] = gridData[c][r];
      }
    }
  }

  bigRoadGrid.innerHTML = '';
  bigRoadGrid.className = 'flex gap-[1px] h-full items-start overflow-x-auto overflow-y-hidden p-0.5';
  
  renderGrid.forEach(col => {
    const colDiv = document.createElement('div');
    colDiv.className = 'flex flex-col gap-[1px]';
    col.forEach(cell => {
      const cellWrapper = document.createElement('div');
      cellWrapper.className = 'w-3 h-3 flex items-center justify-center relative flex-shrink-0 bg-zinc-800/20';
      
      if (cell) {
        const cellDiv = document.createElement('div');
        let borderColor = 'border-green-500';
        if (cell.winner === 'Player') borderColor = 'border-blue-500';
        else if (cell.winner === 'Banker') borderColor = 'border-red-500';
        
        cellDiv.className = `w-2.5 h-2.5 rounded-full border-[1.5px] flex items-center justify-center relative ${borderColor}`;
        
        if (cell.ties > 0) {
          const tieLine = document.createElement('div');
          tieLine.className = 'absolute w-3 h-[1.5px] bg-green-500 -rotate-45';
          cellDiv.appendChild(tieLine);
        }
        if (cell.isNatural) {
          const naturalDot = document.createElement('div');
          naturalDot.className = 'absolute w-[3px] h-[3px] bg-yellow-400 rounded-full';
          cellDiv.appendChild(naturalDot);
        }
        if (cell.nonTieIndex === selectionStart) {
          const selectedDot = document.createElement('div');
          selectedDot.id = 'selected-big-road-cell';
          selectedDot.className = 'absolute inset-[-3.5px] border-[2.5px] border-[#00FF00] shadow-[0_0_6px_rgba(0,255,0,0.8)] rounded-full z-10';
          cellDiv.appendChild(selectedDot);
        }
        if (cell.nonTieIndex === selectionEnd) {
          const selectedDot = document.createElement('div');
          selectedDot.className = 'absolute inset-[-3.5px] border-[2.5px] border-[#FF00FF] shadow-[0_0_6px_rgba(255,0,255,0.8)] rounded-full z-10';
          cellDiv.appendChild(selectedDot);
        }
        if (selectionStart !== null && selectionEnd !== null && cell.nonTieIndex > Math.min(selectionStart, selectionEnd) && cell.nonTieIndex < Math.max(selectionStart, selectionEnd)) {
          const betweenDot = document.createElement('div');
          betweenDot.className = 'absolute inset-[-2px] border-[1.5px] border-[rgba(255,255,255,0.5)] rounded-full';
          cellDiv.appendChild(betweenDot);
        }
        cellWrapper.appendChild(cellDiv);
      }
      colDiv.appendChild(cellWrapper);
    });
    bigRoadGrid.appendChild(colDiv);
  });

  setTimeout(() => {
    let el = document.getElementById('selected-big-road-cell');
    if (el) {
      const container = el.closest('.overflow-x-auto') || el.closest('.overflow-auto') || document.getElementById('big-road-container');
      if (container) {
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const offsetFromContainerLeft = (elRect.left + elRect.width / 2) - containerRect.left;
        const centerDifference = offsetFromContainerLeft - (containerRect.width / 2);
        container.scrollBy({ left: centerDifference, behavior: 'smooth' });
      }
    }
  }, 0);
}

const setMode = (mode) => {
  appMode = mode;
  selectionStart = null;
  selectionEnd = null;
  chart.options.plugins.verticalLine.start = null;
  chart.options.plugins.verticalLine.end = null;
  const liveCalculator = document.getElementById('live-calculator');
  if (mode === 'demo') {
    btnModeDemo.className = 'px-3 py-1 rounded-md text-sm font-medium transition-colors bg-[#E5446D] text-zinc-950 shadow-[0_0_10px_rgba(229,68,109,0.5)]';
    btnModeLive.className = 'px-3 py-1 rounded-md text-sm font-medium transition-colors text-zinc-400 hover:text-zinc-100';
    btnDemoRefresh.classList.remove('hidden');
    btnLivePanelToggle.classList.add('hidden');
    liveInputPanel.classList.add('hidden');
    liveCalculator.classList.add('hidden');
    bottomNav.classList.remove('hidden');
    isPanelOpen = false;
  } else {
    btnModeLive.className = 'px-3 py-1 rounded-md text-sm font-medium transition-colors bg-live-500 text-zinc-950';
    btnModeDemo.className = 'px-3 py-1 rounded-md text-sm font-medium transition-colors text-zinc-400 hover:text-zinc-100';
    btnDemoRefresh.classList.add('hidden');
    btnLivePanelToggle.classList.remove('hidden');
    liveCalculator.classList.remove('hidden');
    bottomNav.classList.add('hidden');
    if (isPanelOpen) liveInputPanel.classList.remove('hidden');
  }
  updateUI();
  setTab(activeTab);
};

const setTab = (tab) => {
  activeTab = tab;
  const activeColor = appMode === 'live' ? 'text-live-500 bg-live-500/10' : 'text-[#EA9010] bg-[#EA9010]/10 shadow-[inset_0_0_10px_rgba(234,144,16,0.2)]';
  const inactiveColor = 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50';

  if (tab === 'chart') {
    btnTabChart.className = `flex-1 py-3 flex items-center justify-center rounded-lg transition-colors ${activeColor}`;
    btnTabLog.className = `flex-1 py-3 flex items-center justify-center rounded-lg transition-colors ${inactiveColor}`;
    tabChart.classList.remove('opacity-0', 'pointer-events-none');
    tabChart.classList.add('opacity-100', 'z-10');
    tabLog.classList.remove('opacity-100', 'z-10');
    tabLog.classList.add('opacity-0', 'pointer-events-none');
  } else {
    btnTabLog.className = `flex-1 py-3 flex items-center justify-center rounded-lg transition-colors ${activeColor}`;
    btnTabChart.className = `flex-1 py-3 flex items-center justify-center rounded-lg transition-colors ${inactiveColor}`;
    tabLog.classList.remove('opacity-0', 'pointer-events-none');
    tabLog.classList.add('opacity-100', 'z-10');
    tabChart.classList.remove('opacity-100', 'z-10');
    tabChart.classList.add('opacity-0', 'pointer-events-none');
  }
};

// Event Listeners
btnModeDemo.addEventListener('click', () => setMode('demo'));
btnModeLive.addEventListener('click', () => setMode('live'));

btnTabChart.addEventListener('click', () => setTab('chart'));
btnTabLog.addEventListener('click', () => setTab('log'));

btnBigRoadToggle.addEventListener('click', () => {
  showBigRoad = !showBigRoad;
  updateUI();
});

document.getElementById('btn-ma-period-6').addEventListener('click', () => {
  if (showMA && maPeriod === 6) {
    showMA = false;
  } else {
    maPeriod = 6;
    showMA = true;
  }
  updateUI();
});

document.getElementById('btn-ma-period-9').addEventListener('click', () => {
  if (showMA && maPeriod === 9) {
    showMA = false;
  } else {
    maPeriod = 9;
    showMA = true;
  }
  updateUI();
});

document.getElementById('btn-chart-download').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = `nwb-chart-${Date.now()}.png`;
  link.href = chart.toBase64Image();
  link.click();
});

btnDemoRefresh.addEventListener('click', () => {
  const { logs, chartData } = simulate();
  demoLogs = logs;
  demoChartData = chartData;
  selectionStart = null;
  selectionEnd = null;
  chart.options.plugins.verticalLine.start = null;
  chart.options.plugins.verticalLine.end = null;
  updateUI();
});

btnLivePanelToggle.addEventListener('click', () => {
  isPanelOpen = !isPanelOpen;
  if (isPanelOpen) {
    liveInputPanel.classList.remove('hidden');
    btnLivePanelToggle.className = 'p-2 rounded-lg transition-colors shadow-sm bg-live-600 text-zinc-950';
  } else {
    liveInputPanel.classList.add('hidden');
    btnLivePanelToggle.className = 'p-2 rounded-lg transition-colors shadow-sm bg-live-500 hover:bg-live-600 text-zinc-950';
  }
});

btnWinnerPlayer.addEventListener('click', () => { if (navigator.vibrate) navigator.vibrate(20); liveWinner = 'Player'; updateUI(); });
btnWinnerBanker.addEventListener('click', () => { if (navigator.vibrate) navigator.vibrate(20); liveWinner = 'Banker'; updateUI(); });
btnNaturalY.addEventListener('click', () => { if (navigator.vibrate) navigator.vibrate(20); liveIsNatural = true; updateUI(); });
btnNaturalN.addEventListener('click', () => { if (navigator.vibrate) navigator.vibrate(20); liveIsNatural = false; updateUI(); });
checkboxAutoHide.addEventListener('change', (e) => { autoHide = e.target.checked; });

btnLiveConfirm.addEventListener('click', () => {
  if (navigator.vibrate) navigator.vibrate(20);
  if (!liveWinner || liveIsNatural === null) return;

  const handNumber = liveLogs.length + 1;
  const nextBet = getNextBet(liveLogs);
  let runningSum = liveLogs.length > 0 ? liveLogs[liveLogs.length - 1].runningSum : 0;
  
  let betResult = 'No Bet';
  if (nextBet) {
    if (liveWinner === 'Tie') betResult = 'Push';
    else if (liveWinner === nextBet) { betResult = 'Win'; runningSum += 1; }
    else { betResult = 'Loss'; runningSum -= 1; }
  }

  liveLogs.push({
    handNumber, winner: liveWinner, isNatural: liveIsNatural,
    betPlaced: nextBet, betResult, runningSum
  });

  liveChartData = liveLogs.filter(l => l.winner !== 'Tie').map(l => l.runningSum);

  liveWinner = null;
  liveIsNatural = null;

  if (autoHide) {
    isPanelOpen = false;
    liveInputPanel.classList.add('hidden');
    btnLivePanelToggle.className = 'p-2 rounded-lg transition-colors shadow-sm bg-live-500 hover:bg-live-600 text-zinc-950';
  }

  updateUI();
});

btnLiveUndo.addEventListener('click', () => {
  if (navigator.vibrate) navigator.vibrate(20);
  if (liveLogs.length === 0) return;
  liveLogs.pop();
  liveChartData = liveLogs.filter(l => l.winner !== 'Tie').map(l => l.runningSum);
  updateUI();
});

btnLiveReset.addEventListener('click', () => {
  if (navigator.vibrate) navigator.vibrate(20);
  resetModal.classList.remove('hidden');
});

btnResetCancel.addEventListener('click', () => {
  resetModal.classList.add('hidden');
});

btnResetConfirm.addEventListener('click', () => {
  liveLogs = [];
  liveChartData = [];
  liveWinner = null;
  liveIsNatural = null;
  selectionStart = null;
  selectionEnd = null;
  chart.options.plugins.verticalLine.start = null;
  chart.options.plugins.verticalLine.end = null;
  resetModal.classList.add('hidden');
  updateUI();
});

// Initial run
const { logs, chartData } = simulate();
demoLogs = logs;
demoChartData = chartData;
updateUI();
