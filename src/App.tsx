/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import { RefreshCw, LineChart, List, Pencil, Download, Grid3x3 } from "lucide-react";
import "./components/BaccaratCalculator";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin,
);

type Card = { suit: string; rank: string; value: number };

const createShoe = (numDecks: number): Card[] => {
  const suits = ["♠", "♥", "♦", "♣"];
  const ranks = [
    "A",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
  ];
  const values: Record<string, number> = {
    A: 1,
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    "10": 0,
    J: 0,
    Q: 0,
    K: 0,
  };

  let shoe: Card[] = [];
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

const getHandValue = (cards: Card[]): number => {
  return cards.reduce((sum, card) => sum + card.value, 0) % 10;
};

type HandResult = {
  player: Card[];
  banker: Card[];
  playerValue: number;
  bankerValue: number;
  winner: "Player" | "Banker" | "Tie";
  isNatural: boolean;
};

const dealHand = (shoe: Card[]): HandResult | null => {
  if (shoe.length < 6) return null;

  const player: Card[] = [shoe.pop()!];
  const banker: Card[] = [shoe.pop()!];
  player.push(shoe.pop()!);
  banker.push(shoe.pop()!);

  let playerValue = getHandValue(player);
  let bankerValue = getHandValue(banker);

  let playerDrew = false;
  let playerThirdCard: Card | null = null;

  if (playerValue >= 8 || bankerValue >= 8) {
    // Natural, both stand
  } else {
    if (playerValue <= 5) {
      playerThirdCard = shoe.pop()!;
      player.push(playerThirdCard);
      playerValue = getHandValue(player);
      playerDrew = true;
    }

    if (!playerDrew) {
      if (bankerValue <= 5) {
        banker.push(shoe.pop()!);
        bankerValue = getHandValue(banker);
      }
    } else {
      const p3 = playerThirdCard!.value;
      let bankerDraws = false;
      if (bankerValue <= 2) bankerDraws = true;
      else if (bankerValue === 3 && p3 !== 8) bankerDraws = true;
      else if (bankerValue === 4 && p3 >= 2 && p3 <= 7) bankerDraws = true;
      else if (bankerValue === 5 && p3 >= 4 && p3 <= 7) bankerDraws = true;
      else if (bankerValue === 6 && (p3 === 6 || p3 === 7)) bankerDraws = true;

      if (bankerDraws) {
        banker.push(shoe.pop()!);
        bankerValue = getHandValue(banker);
      }
    }
  }

  let winner: "Player" | "Banker" | "Tie" = "Tie";
  if (playerValue > bankerValue) winner = "Player";
  else if (bankerValue > playerValue) winner = "Banker";

  return {
    player,
    banker,
    playerValue,
    bankerValue,
    winner,
    isNatural: player.length === 2 && banker.length === 2,
  };
};

type LogEntry = {
  handNumber: number;
  player?: Card[];
  banker?: Card[];
  playerValue?: number;
  bankerValue?: number;
  winner: "Player" | "Banker" | "Tie";
  isNatural: boolean;
  betPlaced: "Player" | "Banker" | null;
  betResult: "Win" | "Loss" | "Push" | "No Bet";
  runningSum: number;
};

const simulate = () => {
  const shoe = createShoe(8);
  const cutCardIndex = 14;

  let runningSum = 0;
  let nextBet: "Player" | "Banker" | null = null;
  let handNumber = 1;
  const logs: LogEntry[] = [];
  const chartData: number[] = [];

  while (shoe.length > cutCardIndex && handNumber <= 80) {
    const result = dealHand(shoe);
    if (!result) break;

    let betResult: "Win" | "Loss" | "Push" | "No Bet" = "No Bet";
    let betPlaced = nextBet;

    if (nextBet) {
      if (result.winner === "Tie") {
        betResult = "Push";
      } else if (result.winner === nextBet) {
        betResult = "Win";
        runningSum += 1;
      } else {
        betResult = "Loss";
        runningSum -= 1;
      }
    }

    logs.push({
      handNumber,
      player: result.player,
      banker: result.banker,
      playerValue: result.playerValue,
      bankerValue: result.bankerValue,
      winner: result.winner,
      isNatural: result.isNatural,
      betPlaced,
      betResult,
      runningSum,
    });

    // Exclude ties from the performance chart
    if (result.winner !== "Tie") {
      chartData.push(runningSum);
    }

    if (result.winner !== "Tie") {
      if (result.isNatural) {
        nextBet = "Banker";
      } else {
        nextBet = "Player";
      }
    }

    handNumber++;
  }

  return { logs, chartData };
};

const calculateMA = (data: number[], period: number) => {
  const ma: (number | null)[] = [];
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

const BigRoad = ({ logs, selectionStart, selectionEnd }: { logs: LogEntry[], selectionStart: number | null, selectionEnd: number | null }) => {
  const grid = useMemo(() => {
    const gridData: any[][] = [];
    const getCell = (c: number, r: number) => gridData[c]?.[r];
    const setCell = (c: number, r: number, data: any) => {
      if (!gridData[c]) gridData[c] = [];
      gridData[c][r] = data;
    };

    let logicalCol = 0;
    let actualCol = 0;
    let actualRow = 0;
    let lastWinner: "Player" | "Banker" | null = null;
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
    const renderGrid: any[][] = Array.from({ length: maxCols }, () => Array(6).fill(null));

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

    return renderGrid;
  }, [logs]);

  useEffect(() => {
    if (selectionStart !== null) {
      const selectedEl = document.getElementById("selected-big-road-cell");
      if (selectedEl) {
        // Find the scrollable container
        const container = selectedEl.closest('.overflow-x-auto') || selectedEl.closest('.overflow-auto');
        if (container) {
          const containerRect = container.getBoundingClientRect();
          const elRect = selectedEl.getBoundingClientRect();
          // Calculate the difference from the center of the container
          const offsetFromContainerLeft = (elRect.left + elRect.width / 2) - containerRect.left;
          const centerDifference = offsetFromContainerLeft - (containerRect.width / 2);
          container.scrollBy({ left: centerDifference, behavior: 'smooth' });
        }
      }
    }
  }, [selectionStart, logs]);

  return (
    <div className="flex gap-[1px] h-full items-start overflow-x-auto overflow-y-hidden p-0.5">
      {grid.map((col, i) => (
        <div key={i} className="flex flex-col gap-[1px]">
          {col.map((cell, j) => (
            <div key={j} className="w-3 h-3 flex items-center justify-center relative flex-shrink-0 bg-zinc-800/20">
              {cell && (
                <div className={`w-2.5 h-2.5 rounded-full border-[1.5px] flex items-center justify-center relative ${cell.winner === 'Player' ? 'border-blue-500' : cell.winner === 'Banker' ? 'border-red-500' : 'border-green-500'}`}>
                  {cell.ties > 0 && (
                    <div className="absolute w-3 h-[1.5px] bg-green-500 -rotate-45" />
                  )}
                  {cell.isNatural && (
                    <div className="absolute w-[3px] h-[3px] bg-yellow-400 rounded-full" />
                  )}
                  {cell.nonTieIndex === selectionStart && (
                    <div id="selected-big-road-cell" className="absolute inset-[-3.5px] border-[2.5px] border-[#00FF00] shadow-[0_0_6px_rgba(0,255,0,0.8)] rounded-full z-10" />
                  )}
                  {cell.nonTieIndex === selectionEnd && (
                    <div className="absolute inset-[-3.5px] border-[2.5px] border-[#FF00FF] shadow-[0_0_6px_rgba(255,0,255,0.8)] rounded-full z-10" />
                  )}
                  {selectionStart !== null && selectionEnd !== null && cell.nonTieIndex > Math.min(selectionStart, selectionEnd) && cell.nonTieIndex < Math.max(selectionStart, selectionEnd) && (
                    <div className="absolute inset-[-2px] border-[1.5px] border-[rgba(255,255,255,0.5)] rounded-full" />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

const verticalLinePlugin = {
  id: "verticalLine",
  beforeDraw: (chart: any, args: any, options: any) => {
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
  },
};

export default function App() {
  const [appMode, setAppMode] = useState<"demo" | "live">("demo");
  const [activeTab, setActiveTab] = useState<"chart" | "log">("chart");
  const [showMA, setShowMA] = useState(false);
  const [showBigRoad, setShowBigRoad] = useState(false);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [maPeriod, setMaPeriod] = useState<6 | 9>(9);
  const chartRef = useRef<any>(null);

  // Demo state
  const [demoLogs, setDemoLogs] = useState<LogEntry[]>([]);
  const [demoChartData, setDemoChartData] = useState<number[]>([]);

  // Live state
  const [liveLogs, setLiveLogs] = useState<LogEntry[]>([]);
  const [liveChartData, setLiveChartData] = useState<number[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [autoHide, setAutoHide] = useState(false);
  const [liveWinner, setLiveWinner] = useState<
    "Player" | "Banker" | "Tie" | null
  >(null);
  const [liveIsNatural, setLiveIsNatural] = useState<boolean | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const runDemo = () => {
    const { logs: newLogs, chartData: newChartData } = simulate();
    setDemoLogs(newLogs);
    setDemoChartData(newChartData);
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  useEffect(() => {
    runDemo();
  }, []);

  const getNextBet = (logs: LogEntry[]): "Player" | "Banker" | null => {
    for (let i = logs.length - 1; i >= 0; i--) {
      if (logs[i].winner !== "Tie") {
        return logs[i].isNatural ? "Banker" : "Player";
      }
    }
    return null;
  };

  const handleLiveConfirm = () => {
    if (!liveWinner || liveIsNatural === null) return;

    const handNumber = liveLogs.length + 1;
    const nextBet = getNextBet(liveLogs);
    let runningSum =
      liveLogs.length > 0 ? liveLogs[liveLogs.length - 1].runningSum : 0;

    let betResult: "Win" | "Loss" | "Push" | "No Bet" = "No Bet";
    if (nextBet) {
      if (liveWinner === "Tie") {
        betResult = "Push";
      } else if (liveWinner === nextBet) {
        betResult = "Win";
        runningSum += 1;
      } else {
        betResult = "Loss";
        runningSum -= 1;
      }
    }

    const newLog: LogEntry = {
      handNumber,
      winner: liveWinner,
      isNatural: liveIsNatural || false,
      betPlaced: nextBet,
      betResult,
      runningSum,
    };

    const newLogs = [...liveLogs, newLog];
    setLiveLogs(newLogs);

    const newChartData = newLogs
      .filter((l) => l.winner !== "Tie")
      .map((l) => l.runningSum);
    setLiveChartData(newChartData);

    setLiveWinner(null);
    setLiveIsNatural(null);

    if (autoHide) {
      setIsPanelOpen(false);
    }
  };

  const handleLiveUndo = () => {
    if (liveLogs.length === 0) return;
    const newLogs = liveLogs.slice(0, -1);
    setLiveLogs(newLogs);
    const newChartData = newLogs
      .filter((l) => l.winner !== "Tie")
      .map((l) => l.runningSum);
    setLiveChartData(newChartData);
  };

  const handleLiveReset = () => {
    setIsResetConfirmOpen(true);
  };

  const confirmReset = () => {
    setLiveLogs([]);
    setLiveChartData([]);
    setLiveWinner(null);
    setLiveIsNatural(null);
    setIsResetConfirmOpen(false);
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const currentLogs = appMode === "demo" ? demoLogs : liveLogs;
  const handleDownloadChart = () => {
    if (chartRef.current) {
      const link = document.createElement("a");
      link.download = `nwb-chart-${Date.now()}.png`;
      link.href = chartRef.current.toBase64Image();
      link.click();
    }
  };

  const currentChartData = appMode === "demo" ? demoChartData : liveChartData;
  const nextUpcomingBet = getNextBet(currentLogs);

  const labels = Array.from({ length: 80 }, (_, i) => i + 1);

  const data = {
    labels,
    datasets: [
      {
        label: "Running Sum",
        data: currentChartData,
        borderColor: appMode === "demo" ? "#E5446D" : "#90BE6D",
        backgroundColor:
          appMode === "demo"
            ? "rgba(229, 68, 109, 0.1)"
            : "rgba(144, 190, 109, 0.1)",
        borderWidth: 2,
        tension: 0.1,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointBackgroundColor: appMode === "demo" ? "#E5446D" : "#90BE6D",
      },
      ...(showMA
        ? [
            {
              label: `MA(${maPeriod})`,
              data: calculateMA(currentChartData, maPeriod),
              borderColor: appMode === "demo" ? "#6A6B83" : "#DE6C83",
              backgroundColor: "transparent",
              borderWidth: 1,
              tension: 0.1,
              pointRadius: 0,
              pointHoverRadius: 0,
            },
          ]
        : []),
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: 0,
    },
    scales: {
      x: {
        min: 0,
        max: 79,
        title: { display: false },
        grid: {
          display: false,
        },
        ticks: { color: "#A1A1AA" },
      },
      y: {
        min: -20,
        max: 20,
        title: { display: false },
        grid: {
          display: true,
          color: "#18181b",
          drawTicks: false,
        },
        ticks: {
          color: "#A1A1AA",
          stepSize: 2,
        },
      },
    },
    plugins: {
      verticalLine: {
        start: selectionStart,
        end: selectionEnd,
      },
      legend: {
        display: false,
      },
      tooltip: {
        enabled: false,
      },
      zoom: {
        pan: {
          enabled: true,
          mode: "y" as const,
        },
        limits: {
          y: { min: -40, max: 40 },
        },
      },
    },
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    onClick: (event: any, elements: any[], chart: any) => {
      if (appMode !== "demo") {
        if (elements && elements.length > 0) {
          setSelectionStart(elements[0].index);
          setSelectionEnd(null);
        } else if (chart) {
          let val = chart.scales.x.getValueForPixel(event.x);
          if (val !== undefined && val !== null) {
            val = Math.round(val);
            if (val >= 0 && val < currentChartData.length) {
              setSelectionStart(val);
              setSelectionEnd(null);
            }
          }
        }
        return;
      }
      
      let clickedIndex: number | null = null;
      if (elements && elements.length > 0) {
        clickedIndex = elements[0].index;
      } else if (chart) {
        let val = chart.scales.x.getValueForPixel(event.x);
        if (val !== undefined && val !== null) {
          val = Math.round(val);
          if (val >= 0 && val < currentChartData.length) {
            clickedIndex = val;
          }
        }
      }

      if (clickedIndex !== null) {
        if (selectionStart === null || (selectionStart !== null && selectionEnd !== null)) {
          setSelectionStart(clickedIndex);
          setSelectionEnd(null);
        } else {
          setSelectionEnd(clickedIndex);
        }
      } else {
        setSelectionStart(null);
        setSelectionEnd(null);
      }
    },
  };

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
      {/* Header */}
      <div className="flex-none flex justify-between items-center p-4 bg-zinc-900 border-b border-zinc-800 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <svg width="32" height="32" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
            <defs>
              <filter id="blueNeonGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur"/>
                <feFlood flood-color="#00FFFF" result="flood"/> <feComposite in="flood" in2="blur" operator="in" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>

              <filter id="redNeonGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="blur"/> <feFlood flood-color="#FF0000" result="flood"/> <feComposite in="flood" in2="blur" operator="in" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            <rect width="64" height="64" rx="12" fill="#000000"/>
            
            <rect x="3" y="3" width="58" height="58" rx="10" stroke="#CCFFFF" strokeWidth="3" filter="url(#blueNeonGlow)"/>
            
            <text 
              x="26" 
              y="42" 
              fontFamily="'Times New Roman', Times, serif" 
              fontSize="24" 
              fontStyle="italic"
              fontWeight="bold" 
              fill="#80FFFF" 
              textAnchor="middle"
              filter="url(#blueNeonGlow)">
              NW
            </text>
            
            <text 
              x="48" 
              y="26" 
              fontFamily="'Times New Roman', Times, serif" 
              fontSize="20" 
              fontStyle="italic"
              fontWeight="bold" 
              fill="#FFB3B3" 
              textAnchor="middle"
              filter="url(#redNeonGlow)">
              #
            </text>
          </svg>
          <div className="flex items-center bg-zinc-950 p-1 rounded-lg border border-zinc-800">
            <button
              onClick={() => {
                setAppMode("demo");
                setSelectedHandIndex(null);
              }}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${appMode === "demo" ? "bg-[#E5446D] text-zinc-950 shadow-[0_0_10px_rgba(229,68,109,0.5)]" : "text-zinc-400 hover:text-zinc-100"}`}
            >
              Demo
            </button>
            <button
              onClick={() => {
                setAppMode("live");
                setActiveTab("chart");
                setSelectedHandIndex(null);
              }}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${appMode === "live" ? "bg-live-500 text-zinc-950" : "text-zinc-400 hover:text-zinc-100"}`}
            >
              Live
            </button>
          </div>

          {appMode === "live" && nextUpcomingBet && (
            <div
              className={`flex items-center justify-center w-8 h-8 rounded border-2 font-bold text-sm ${
                nextUpcomingBet === "Banker"
                  ? "border-red-500 text-red-500"
                  : "border-blue-500 text-blue-500"
              }`}
            >
              {nextUpcomingBet.charAt(0)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {appMode === "demo" ? (
            <button
              onClick={runDemo}
              className="p-2 bg-[#E5446D] hover:bg-[#C43A5D] text-zinc-950 rounded-lg transition-colors shadow-[0_0_10px_rgba(229,68,109,0.5)]"
              title="Simulate New Shoe"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => setIsPanelOpen(!isPanelOpen)}
              className={`p-2 rounded-lg transition-colors shadow-sm ${isPanelOpen ? "bg-live-600 text-zinc-950" : "bg-live-500 hover:bg-live-600 text-zinc-950"}`}
              title="Toggle Input Panel"
            >
              <Pencil className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 relative overflow-hidden bg-zinc-950 flex flex-col">
        {/* Live Input Panel */}
        {appMode === "live" && isPanelOpen && (
          <div className="absolute top-2 right-2 bg-zinc-900 border border-zinc-800 p-3 rounded-xl shadow-lg z-30 w-36">
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                {["Player", "Banker"].map((w) => {
                  const isSelected = liveWinner === w;
                  const activeColor =
                    w === "Player"
                      ? "bg-blue-600 border-blue-600"
                      : "bg-red-600 border-red-600";
                  return (
                    <button
                      key={w}
                      onClick={() => {
                        if (navigator.vibrate) navigator.vibrate(20);
                        setLiveWinner(w as any);
                      }}
                      className={`aspect-square flex items-center justify-center rounded-lg text-xl font-bold border ${isSelected ? `${activeColor} text-white` : "border-zinc-700 text-zinc-400 hover:bg-zinc-800/50"}`}
                    >
                      {w.charAt(0)}
                    </button>
                  );
                })}
                {["Y", "N"].map((n) => {
                  const isSelected = liveIsNatural === (n === "Y");
                  const activeColor =
                    n === "Y"
                      ? "bg-live-500 border-live-500 text-zinc-950"
                      : "bg-live-highlight border-live-highlight text-zinc-950";
                  return (
                    <button
                      key={n}
                      onClick={() => {
                        if (navigator.vibrate) navigator.vibrate(20);
                        setLiveIsNatural(n === "Y");
                      }}
                      className={`aspect-square flex items-center justify-center rounded-lg text-xl font-bold border ${isSelected ? activeColor : "border-zinc-700 text-zinc-400 hover:bg-zinc-800/50"}`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 mt-1">
                <input
                  type="checkbox"
                  id="autoHide"
                  checked={autoHide}
                  onChange={(e) => setAutoHide(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-950 text-live-500 focus:ring-live-500"
                />
                <label
                  htmlFor="autoHide"
                  className="text-[11px] leading-tight text-zinc-400"
                >
                  Auto hide
                </label>
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => {
                    if (navigator.vibrate) navigator.vibrate(20);
                    handleLiveConfirm();
                  }}
                  disabled={!liveWinner || liveIsNatural === null}
                  className="flex-1 py-2 bg-live-500 hover:bg-live-600 disabled:opacity-50 disabled:hover:bg-live-500 text-zinc-950 rounded text-sm font-medium transition-colors"
                >
                  Confirm
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (navigator.vibrate) navigator.vibrate(20);
                    handleLiveUndo();
                  }}
                  disabled={liveLogs.length === 0}
                  className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-100 rounded text-xs font-medium transition-colors"
                >
                  Undo
                </button>
                <button
                  onClick={() => {
                    if (navigator.vibrate) navigator.vibrate(20);
                    handleLiveReset();
                  }}
                  disabled={liveLogs.length === 0}
                  className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-100 rounded text-xs font-medium transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs Container */}
        <div className="flex-1 relative">
          {/* Chart Tab */}
          <div
            className={`absolute inset-0 transition-opacity duration-200 ${appMode === "live" || activeTab === "chart" ? "opacity-100 z-10" : "opacity-0 pointer-events-none z-0"}`}
          >
          <div className={`w-full h-full relative ${appMode === "live" ? "bg-zinc-900" : "bg-zinc-950"}`}>
            {/* Chart Controls Group */}
            <div className="absolute top-3 left-3 flex flex-col gap-2 z-20">
              <div className="flex items-center gap-3 bg-zinc-900/50 p-1.5 rounded-xl backdrop-blur-sm border border-zinc-800/50">
                <button
                  onClick={handleDownloadChart}
                  className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg transition-colors shadow-sm"
                  title="Download Chart Image"
                >
                  <Download className="w-5 h-5" />
                </button>
                
                <div className="h-6 w-[1px] bg-zinc-700 mx-1" />

                <div className="flex bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
                  <button
                    onClick={() => {
                      if (showMA && maPeriod === 6) setShowMA(false);
                      else { setMaPeriod(6); setShowMA(true); }
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${showMA && maPeriod === 6 ? "bg-blue-600 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                  >
                    6
                  </button>
                  <button
                    onClick={() => {
                      if (showMA && maPeriod === 9) setShowMA(false);
                      else { setMaPeriod(9); setShowMA(true); }
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${showMA && maPeriod === 9 ? "bg-blue-600 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                  >
                    9
                  </button>
                </div>

                <div className="h-6 w-[1px] bg-zinc-700 mx-1" />
                <button
                  onClick={() => setShowBigRoad(!showBigRoad)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors shadow-sm ${showBigRoad ? "bg-blue-600 text-white" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-100"}`}
                  title="Toggle Big Road"
                >
                  Road
                </button>
              </div>

              {selectionStart !== null && currentChartData[selectionStart] !== undefined && (
                <div className="flex flex-col gap-1 bg-zinc-900/90 px-2.5 py-1.5 rounded-md border border-zinc-700 shadow-sm backdrop-blur-sm text-xs font-mono text-zinc-300 w-fit">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#00FF00]"></div>
                    <span className="text-zinc-100 font-bold">Start: Hand {selectionStart + 1}</span>
                    <span className="text-zinc-600">|</span>
                    <span className={currentChartData[selectionStart] >= 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>Score: {currentChartData[selectionStart]}</span>
                  </div>
                  {selectionEnd !== null && currentChartData[selectionEnd] !== undefined && (
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-[#FF00FF]"></div>
                       <span className="text-zinc-100 font-bold">End: Hand {selectionEnd + 1}</span>
                       <span className="text-zinc-600">|</span>
                       <span className={currentChartData[selectionEnd] >= 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>Score: {currentChartData[selectionEnd]}</span>
                    </div>
                  )}
                  {selectionEnd !== null && currentChartData[selectionEnd] !== undefined && (
                    <div className="flex items-center gap-2 pt-1 border-t border-zinc-800">
                      <span className="text-zinc-400">Diff:</span>
                      <span className={currentChartData[selectionEnd] - currentChartData[selectionStart] >= 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                        {currentChartData[selectionEnd] - currentChartData[selectionStart] > 0 ? "+" : ""}
                        {currentChartData[selectionEnd] - currentChartData[selectionStart]}
                      </span>
                      <span className="text-zinc-600">|</span>
                      <span className="text-zinc-400">Hands: {Math.abs(selectionEnd - selectionStart)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Line ref={chartRef} data={data} options={options} plugins={[verticalLinePlugin]} />
          </div>
        </div>

        {/* Log Tab */}
        {appMode !== "live" && (
          <div
            className={`absolute inset-0 overflow-y-auto bg-zinc-950 transition-opacity duration-200 ${activeTab === "log" ? "opacity-100 z-10" : "opacity-0 pointer-events-none z-0"}`}
          >
            <table className="w-full text-sm text-center text-zinc-400">
              <thead className="text-xs text-zinc-400 uppercase bg-zinc-900 sticky top-0 shadow-sm z-20">
                <tr>
                  <th className="px-2 py-3 font-semibold">#</th>
                  <th className="px-2 py-3 font-semibold">Score</th>
                  <th className="px-2 py-3 font-semibold">Win</th>
                  <th className="px-2 py-3 font-semibold">Bet</th>
                  <th className="px-2 py-3 font-semibold">Sum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {[...currentLogs].reverse().map((log, i) => (
                  <tr key={i} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-2 py-3 text-zinc-100">{log.handNumber}</td>
                    <td className="px-2 py-3">
                      {log.playerValue !== undefined
                        ? `${log.playerValue}-${log.bankerValue}`
                        : "-"}
                    </td>
                    <td
                      className={`px-2 py-3 font-medium ${
                        log.winner === "Player"
                          ? "text-blue-400"
                          : log.winner === "Banker"
                            ? "text-red-400"
                            : "text-green-400"
                      }`}
                    >
                      {log.winner.charAt(0)}
                      {log.isNatural ? "(N)" : ""}
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${
                          log.betResult === "Win"
                            ? "bg-green-500/20 text-green-400"
                            : log.betResult === "Loss"
                              ? "bg-red-500/20 text-red-400"
                              : log.betResult === "Push"
                                ? "bg-[#E5446D]/20 text-[#E5446D]"
                                : "text-blue-200/50"
                        }`}
                      >
                        {log.betPlaced ? log.betPlaced.charAt(0) : "-"}
                      </span>
                    </td>
                    <td
                      className={`px-2 py-3 font-bold ${
                        log.runningSum > 0
                          ? "text-green-400"
                          : log.runningSum < 0
                            ? "text-red-400"
                            : "text-zinc-100"
                      }`}
                    >
                      {log.runningSum > 0 ? "+" : ""}
                      {log.runningSum}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </div>

        {/* Big Road */}
        {showBigRoad && (
          <div className="flex-none bg-zinc-900 border-t border-zinc-800 p-0.5 z-20 overflow-auto" style={{ maxHeight: '20%' }}>
            <BigRoad logs={currentLogs} selectionStart={selectionStart} selectionEnd={selectionEnd} />
          </div>
        )}
      </div>

      {/* Calculator (Live Mode Only) */}
      {appMode === "live" && (
        <baccarat-calculator className="z-20 px-4 py-4"></baccarat-calculator>
      )}

      {/* Bottom Navigation */}
      {appMode !== "live" && (
        <div className="flex-none flex bg-zinc-900 border-t border-zinc-800 p-2 gap-2 z-20">
          <button
            onClick={() => setActiveTab("chart")}
            className={`flex-1 py-3 flex items-center justify-center rounded-lg transition-colors ${activeTab === "chart" ? (appMode === "live" ? "text-live-500 bg-live-500/10" : "text-[#E5446D] bg-[#E5446D]/10 shadow-[inset_0_0_10px_rgba(229,68,109,0.2)]") : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"}`}
          >
            <span className="text-xs font-bold uppercase tracking-wider">
              Chart
            </span>
          </button>
          <button
            onClick={() => setActiveTab("log")}
            className={`flex-1 py-3 flex items-center justify-center rounded-lg transition-colors ${activeTab === "log" ? (appMode === "live" ? "text-live-500 bg-live-500/10" : "text-[#E5446D] bg-[#E5446D]/10 shadow-[inset_0_0_10px_rgba(229,68,109,0.2)]") : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"}`}
          >
            <span className="text-xs font-bold uppercase tracking-wider">
              Audit Log
            </span>
          </button>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl shadow-2xl max-w-xs w-full mx-4">
            <h3 className="text-lg font-bold text-zinc-100 mb-2">
              Reset Data?
            </h3>
            <p className="text-sm text-zinc-400 mb-6">
              This will clear all live tracking data. This action cannot be
              undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsResetConfirmOpen(false)}
                className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmReset}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
