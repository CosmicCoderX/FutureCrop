/* Enhanced price_app.js – Future Crop AI
   Compatible with backend endpoints + image folder support
*/

const API_BASE = "https://futurecrop.onrender.com";
const IMAGE_BASE = "/images"; // Folder containing crop images

/* DOM refs */
const $ = (id) => document.getElementById(id);
const apiStatus = $("apiStatus");
const apiStatusDot = $("apiStatusDot");
const commodity = $("commodity");
const stateSel = $("state");
const marketSel = $("market");
const predictBtn = $("predictBtn");
const clearBtn = $("clearBtn");
const modelCount = $("modelCount");
const forecastPeriod = $("forecastPeriod");
const toaster = $("toaster");
const menuToggle = $("menuToggle");
const sidebar = $("sidebar");
const exportBtn = $("exportBtn");
const fullscreenBtn = $("fullscreenBtn");

const currentPriceEl = $("currentPrice");
const predictedPriceEl = $("predictedPrice");
const predictedPctEl = $("predictedPct");
const peakMonthEl = $("peakMonth");
const marketLabel = $("marketLabel");
const metaWindow = $("metaWindow");
const metaUsed = $("metaUsed");
const metaPadded = $("metaPadded");
const cropImg = $("cropImg");
const cropName = $("cropName");
const cropDesc = $("cropDesc");
const resultBox = $("result");
const confidenceBadge = $("confidenceBadge");
const chartNote = $("chartNote");
const loadingOverlay = $("loading");
const insightsSection = $("insights");
const insightsList = $("insightsList");
const quickStats = $("quickStats");

// State management
let chartData = {
  labels: [],
  historical: [],
  predicted: []
};

let cropDatabase = {}; // Will be loaded from crops.json

/* Toast notifications */
function toast(msg, bad = false) {
  const n = document.createElement("div");
  n.className = bad ? "toast error" : "toast";
  n.textContent = msg;
  toaster.appendChild(n);
  setTimeout(() => {
    n.style.animation = "slideInRight 0.4s ease-out reverse";
    setTimeout(() => n.remove(), 400);
  }, 3500);
}

/* Loading overlay */
function showLoading(show = true) {
  loadingOverlay.classList.toggle("hide", !show);
}

/* API wrappers */
async function apiGet(path) {
  const r = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

async function apiPost(path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const txt = await r.text();
  let data;
  try {
    data = JSON.parse(txt);
  } catch {
    data = { raw: txt };
  }
  if (!r.ok) throw new Error(data?.detail || txt || "Request failed");
  return data;
}

/* Load crop database from JSON */
async function loadCropDatabase() {
  try {
    const response = await fetch("/crops.json", { cache: "no-store" });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data || typeof data !== "object") {
      throw new Error("Invalid JSON format");
    }

    cropDatabase = data;
    console.log("Crop database loaded:", Object.keys(cropDatabase).length, "crops");

  } catch (err) {
    console.error("Failed to load crops.json:", err);

    cropDatabase = {}; // Use empty object — not stale fallback crops
  }
}


/* DOM helpers */
function fillSelect(sel, items, placeholder = "Select…") {
  sel.innerHTML = `<option value="">${placeholder}</option>` + 
    items.map(i => `<option value="${i}">${i}</option>`).join("");
  sel.disabled = items.length === 0;
}

function setDisabled(sel, flag, placeholder) {
  sel.disabled = flag;
  if (placeholder !== undefined) {
    sel.innerHTML = `<option value="">${placeholder}</option>`;
  }
}

/* Initialize app */
let chart;
window.addEventListener("DOMContentLoaded", init);

async function init() {
  await loadCropDatabase();
  
  // Check API health
  try {
    await apiGet("/health");
    apiStatus.textContent = "API: Online";
    apiStatusDot.classList.add("online");
    apiStatusDot.classList.remove("offline");
  } catch (e) {
    apiStatus.textContent = "API: Offline";
    apiStatusDot.classList.add("offline");
    apiStatusDot.classList.remove("online");
    toast("Backend not reachable. Please start your backend server.", true);
  }

  // Load models (commodities)
  try {
    const m = await apiGet("/models");
    const list = m.models || [];
    fillSelect(commodity, list, "Select a crop…");
    modelCount.textContent = `${m.count ?? list.length} models available`;
  } catch (e) {
    fillSelect(commodity, [], "(no models)");
    modelCount.textContent = "0 models";
    toast("Failed to load model list.", true);
  }

  setDisabled(stateSel, true, "Select crop first…");
  setDisabled(marketSel, true, "Select state first…");

  setupChart();
  setupEventListeners();
}

/* Setup event listeners */
function setupEventListeners() {
  // Sidebar toggle
  menuToggle.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    document.querySelector(".topbar").classList.toggle("sidebar-collapsed");
    document.querySelector(".main-grid").classList.toggle("sidebar-collapsed");
    document.querySelector(".footer").classList.toggle("sidebar-collapsed");
  });

  // Cascading selects
  commodity.addEventListener("change", handleCommodityChange);
  stateSel.addEventListener("change", handleStateChange);
  
  // Action buttons
  predictBtn.addEventListener("click", handlePredict);
  clearBtn.addEventListener("click", handleClear);
  exportBtn.addEventListener("click", handleExport);
  fullscreenBtn.addEventListener("click", handleFullscreen);
}

/* Handle commodity selection */
async function handleCommodityChange() {
  const c = commodity.value.trim();
  setDisabled(stateSel, true, "Loading states…");
  setDisabled(marketSel, true, "Select state first…");
  clearCards();
  
  if (!c) {
    setDisabled(stateSel, true, "Select crop first…");
    return;
  }

  // Update crop info from database
  updateCropInfo(c);

  try {
    const res = await apiGet(`/states?commodity=${encodeURIComponent(c)}`);
    fillSelect(stateSel, res.states || [], "Select a state…");
  } catch {
    setDisabled(stateSel, true, "States unavailable");
    toast("Could not load states for this crop.", true);
  }
}

/* Update crop information display */
function updateCropInfo(selectedCrop) {
  const info =
    cropDatabase[selectedCrop] ||
    cropDatabase[selectedCrop.charAt(0).toUpperCase() + selectedCrop.slice(1)] ||
    Object.values(cropDatabase).find(
      (c) => c.name.toLowerCase() === selectedCrop.toLowerCase()
    );

  if (info) {
    cropName.textContent = info.name;
    cropDesc.textContent = info.desc;

    if (info.image) {
      cropImg.src = `${IMAGE_BASE}/${info.image}`;
      cropImg.alt = info.name;
    }
  } else {
    cropName.textContent = selectedCrop;
    cropDesc.textContent = "Crop information being updated. Check back soon!";
    cropImg.src = "";
  }
}


/* Handle state selection */
async function handleStateChange() {
  const c = commodity.value.trim();
  const s = stateSel.value.trim();
  setDisabled(marketSel, true, "Loading markets…");
  clearCards();
  
  if (!c || !s) {
    setDisabled(marketSel, true, "Select state first…");
    return;
  }

  try {
    const res = await apiGet(`/markets?commodity=${encodeURIComponent(c)}&state=${encodeURIComponent(s)}`);
    fillSelect(marketSel, res.markets || [], "Select a market…");
  } catch {
    setDisabled(marketSel, true, "Markets unavailable");
    toast("Could not load markets for that state.", true);
  }
}

/* Validate inputs */
function validate() {
  const c = commodity.value.trim();
  const s = stateSel.value.trim();
  const m = marketSel.value.trim();
  
  if (!c) {
    toast("Please select a crop.", true);
    return null;
  }
  if (!s) {
    toast("Please select a state.", true);
    return null;
  }
  if (!m) {
    toast("Please select a market.", true);
    return null;
  }
  
  return {
    commodity: c,
    state: s,
    market: m,
    period: Number(forecastPeriod.value || 12)
  };
}

/* Handle prediction */
async function handlePredict() {
  const q = validate();
  if (!q) return;

  predictBtn.disabled = true;
  showLoading(true);
  resultBox.classList.add("hide");
  insightsSection.classList.add("hide");
  quickStats.classList.add("hide");
  chartNote.textContent = "";
  resetChartUI();

  try {
    const resp = await apiPost("/predict_by_context", q);
    
    // Update metadata
    metaWindow.textContent = resp.window_size ?? "—";
    metaUsed.textContent = resp.used_points ?? "—";
    metaPadded.textContent = resp.padded ? "Yes" : "No";
    
    // Update confidence badge
    if (resp.confidence) {
      confidenceBadge.innerHTML = `
        <span class="badge-icon">🎯</span>
        <span>${Math.round(resp.confidence * 100)}% Confidence</span>
      `;
    }

    // Show prediction result
    if (resp.predicted_next_price !== undefined) {
      const priceIN = Number(resp.predicted_next_price).toLocaleString("en-IN");
      resultBox.innerHTML = `<strong>Predicted next price:</strong> ₹${priceIN}`;
      resultBox.classList.remove("hide");
    }

    // Update crop info from response or database
    if (resp.crop_info) {
      cropName.textContent = resp.crop_info.name || q.commodity;
      cropDesc.textContent = resp.crop_info.desc || "—";
      if (resp.crop_info.image) {
        cropImg.src = resp.crop_info.image;
      }
    } else {
      updateCropInfo(q.commodity);
    }

    // Draw chart with series data
    await drawSeries(q, resp);
    
    // Generate insights
    generateInsights(resp, q);
    
    toast("Prediction completed successfully! 🎉");
  } catch (e) {
    toast(`Prediction failed: ${e.message}`, true);
    chartNote.textContent = "Chart not updated due to error.";
  } finally {
    predictBtn.disabled = false;
    showLoading(false);
  }
}

/* Generate market insights */
function generateInsights(resp, query) {
  const insights = [];
  
  if (resp.confidence) {
    const conf = Math.round(resp.confidence * 100);
    if (conf >= 80) {
      insights.push("🎯 High confidence prediction - strong historical data patterns detected.");
    } else if (conf >= 60) {
      insights.push("📊 Moderate confidence - consider market volatility in planning.");
    } else {
      insights.push("⚠️ Lower confidence - limited historical data available.");
    }
  }

  if (chartData.predicted.length > 0 && chartData.historical.length > 0) {
    const lastHist = chartData.historical[chartData.historical.length - 1];
    const lastPred = chartData.predicted[chartData.predicted.length - 1];
    const change = ((lastPred - lastHist) / lastHist) * 100;
    
    if (change > 10) {
      insights.push("📈 Significant price increase expected - good time to hold inventory.");
    } else if (change < -10) {
      insights.push("📉 Price decline forecasted - consider selling sooner.");
    } else {
      insights.push("➡️ Relatively stable prices expected in the forecast period.");
    }
  }

  if (query.period >= 6) {
    insights.push("📅 Long-term forecast - monitor regularly for market changes.");
  }

  if (resp.padded) {
    insights.push("ℹ️ Prediction uses interpolated data due to gaps in historical records.");
  }

  if (insights.length > 0) {
    insightsList.innerHTML = insights
      .map(text => `<div class="insight-item">${text}</div>`)
      .join("");
    insightsSection.classList.remove("hide");
  }
}

/* Clear form and data */
function handleClear() {
  commodity.value = "";
  setDisabled(stateSel, true, "Select crop first…");
  setDisabled(marketSel, true, "Select state first…");
  clearCards();
  resetChart();
  insightsSection.classList.add("hide");
  quickStats.classList.add("hide");
  toast("Selection cleared");
}

/* Export chart data */
function handleExport() {
  if (chartData.labels.length === 0) {
    toast("No data to export. Run a prediction first.", true);
    return;
  }

  const csvContent = "data:text/csv;charset=utf-8," +
    "Date,Historical Price,Predicted Price\n" +
    chartData.labels.map((label, i) => {
      const hist = chartData.historical[i] || "";
      const pred = chartData.predicted[i] || "";
      return `${label},${hist},${pred}`;
    }).join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `crop_forecast_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  toast("Data exported successfully! 📥");
}

/* Toggle fullscreen chart */
function handleFullscreen() {
  const chartPanel = document.querySelector(".chart-panel");
  if (!document.fullscreenElement) {
    chartPanel.requestFullscreen().catch(err => {
      toast("Fullscreen not supported on this browser.", true);
    });
  } else {
    document.exitFullscreen();
  }
}

/* Chart.js setup */
function setupChart() {
  const ctx = $("priceChart").getContext("2d");
  
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Historical",
          data: [],
          fill: "start",
          backgroundColor: createGradient(ctx, "hist"),
          borderColor: "#4bd07a",
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: "#4bd07a",
          tension: 0.3,
          borderWidth: 3
        },
        {
          label: "Predicted",
          data: [],
          fill: false,
          borderColor: "#f0b63a",
          pointStyle: "rectRot",
          pointRadius: 5,
          pointHoverRadius: 8,
          pointBackgroundColor: "#f0b63a",
          borderDash: [8, 4],
          borderWidth: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      scales: {
        x: {
          grid: {
            color: "rgba(255,255,255,0.04)",
            drawBorder: false
          },
          ticks: {
            color: "#95a0a0",
            font: { size: 11, weight: "600" }
          }
        },
        y: {
          grid: {
            color: "rgba(255,255,255,0.03)",
            drawBorder: false
          },
          ticks: {
            color: "#95a0a0",
            font: { size: 11, weight: "600" },
            callback: function(value) {
              return "₹" + value.toLocaleString("en-IN");
            }
          },
          beginAtZero: false
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: "rgba(21, 23, 24, 0.95)",
          titleColor: "#e6efea",
          bodyColor: "#95a0a0",
          borderColor: "rgba(255,255,255,0.1)",
          borderWidth: 1,
          padding: 12,
          displayColors: true,
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || "";
              if (label) label += ": ";
              if (context.parsed.y !== null) {
                label += "₹" + context.parsed.y.toLocaleString("en-IN");
              }
              return label;
            }
          }
        }
      },
      animation: {
        duration: 800,
        easing: "easeInOutQuart"
      }
    }
  });

  window.addEventListener("resize", () => {
    if (chart) updateGradients();
  });
}

/* Gradient helpers */
function createGradient(ctx, which) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  
  if (which === "hist") {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "rgba(58,200,123,0.25)");
    g.addColorStop(0.5, "rgba(58,200,123,0.10)");
    g.addColorStop(1, "rgba(20,30,18,0.02)");
    return g;
  }
  
  const g2 = ctx.createLinearGradient(0, 0, 0, h);
  g2.addColorStop(0, "rgba(240,182,58,0.15)");
  g2.addColorStop(1, "rgba(199,123,26,0.02)");
  return g2;
}

function updateGradients() {
  const ctx = chart.ctx;
  chart.data.datasets[0].backgroundColor = createGradient(ctx, "hist");
  chart.update("none");
}

/* Chart reset helpers */
function resetChart() {
  if (!chart) return;
  chart.data.labels = [];
  chart.data.datasets[0].data = [];
  chart.data.datasets[1].data = [];
  chartData = { labels: [], historical: [], predicted: [] };
  chart.update();
}

function resetChartUI() {
  currentPriceEl.textContent = "—";
  predictedPriceEl.textContent = "—";
  predictedPctEl.textContent = "";
  peakMonthEl.textContent = "—";
  marketLabel.textContent = "—";
  chartNote.textContent = "";
}

/* Fetch and draw series data */
function seriesEndpoint(q) {
  const p = new URLSearchParams({
    commodity: q.commodity,
    state: q.state,
    market: q.market,
    period: String(q.period || 12)
  });
  return `${API_BASE}/series_by_context?${p.toString()}`;
}

async function drawSeries(q, predictResp) {
  try {
    const r = await fetch(seriesEndpoint(q));
    if (!r.ok) throw new Error("series endpoint failed");
    
    const hist = await r.json();
    const labels = (hist.dates || []).slice();
    const prices = (hist.prices || []).slice();

    let predictedDates = hist.predicted?.dates || [];
    let predictedPrices = hist.predicted?.prices || [];

    // Fallback to single prediction if no series
    if (predictedPrices.length === 0 && predictResp?.predicted_next_price !== undefined) {
      const nextDate = nextDateFrom(labels);
      predictedDates = [nextDate];
      predictedPrices = [predictResp.predicted_next_price];
    }

    // Build chart data
    const fullLabels = labels.concat(predictedDates);
    const histData = prices.slice();
    const predData = new Array(Math.max(0, histData.length)).fill(null).concat(predictedPrices);

    // Store data for export
    chartData = {
      labels: fullLabels,
      historical: histData.concat(new Array(predictedPrices.length).fill(null)),
      predicted: predData
    };

    // Update chart
    chart.data.labels = fullLabels;
    chart.data.datasets[0].data = chartData.historical;
    chart.data.datasets[1].data = chartData.predicted;
    updateGradients();
    chart.update();

    // Update UI cards
    updatePriceCards(prices, predictedPrices, predictResp);
    updatePeakMonth(fullLabels, prices, predictedPrices);
    updateMarketLabel(q);
    calculateStatistics(prices, predictedPrices);

    if (labels.length === 0) {
      chartNote.textContent = "⚠️ Limited historical data - showing prediction only.";
    }
  } catch (e) {
    // Fallback rendering
    if (predictResp?.predicted_next_price !== undefined) {
      const d = new Date().toISOString().slice(0, 10);
      chart.data.labels = [d];
      chart.data.datasets[0].data = [null];
      chart.data.datasets[1].data = [predictResp.predicted_next_price];
      chart.update();

      currentPriceEl.textContent = "—";
      predictedPriceEl.textContent = `₹${Number(predictResp.predicted_next_price).toLocaleString("en-IN")}`;
      chartNote.textContent = "⚠️ Historical data unavailable.";
    } else {
      toast("Could not render chart data.", true);
    }
  }
}

/* Update price display cards */
function updatePriceCards(prices, predictedPrices, predictResp) {
  const lastHist = prices.length ? prices[prices.length - 1] : undefined;
  
  if (lastHist !== undefined) {
    currentPriceEl.textContent = `₹${Number(lastHist).toLocaleString("en-IN")}`;
  } else {
    currentPriceEl.textContent = "—";
  }

  const lastPred = predictedPrices.length ? 
    predictedPrices[predictedPrices.length - 1] : 
    predictResp?.predicted_next_price;

  if (lastPred !== undefined) {
    predictedPriceEl.textContent = `₹${Number(lastPred).toLocaleString("en-IN")}`;
    
    if (lastHist !== undefined && Number(lastHist) > 0) {
      const pct = ((Number(lastPred) - Number(lastHist)) / Number(lastHist)) * 100;
      const sign = pct >= 0 ? "+" : "";
      predictedPctEl.textContent = `${sign}${pct.toFixed(1)}%`;
      predictedPctEl.style.color = pct >= 0 ? "#7ee7b1" : "#ffb3b3";
    }
  }
}

/* Update peak month display */
function updatePeakMonth(fullLabels, prices, predictedPrices) {
  const combinedValues = (prices || []).concat(predictedPrices);
  
  if (combinedValues.length) {
    let maxIdx = 0;
    for (let i = 1; i < combinedValues.length; i++) {
      if (Number(combinedValues[i]) > Number(combinedValues[maxIdx])) {
        maxIdx = i;
      }
    }
    const peakLabel = fullLabels[maxIdx] || "—";
    peakMonthEl.textContent = formatMonth(peakLabel);
  }
}

/* Update market label */
function updateMarketLabel(q) {
  marketLabel.textContent = `${q.market} • ${q.state}`;
}

/* Calculate and display statistics */
function calculateStatistics(prices, predicted) {
  if (prices.length < 2) return;

  // Calculate volatility (coefficient of variation)
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / prices.length;
  const stdDev = Math.sqrt(variance);
  const cv = (stdDev / mean) * 100;

  $("volatility").textContent = cv < 10 ? "Low" : cv < 20 ? "Moderate" : "High";

  // Calculate trend
  const firstHalf = prices.slice(0, Math.floor(prices.length / 2));
  const secondHalf = prices.slice(Math.floor(prices.length / 2));
  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const trendPct = ((avgSecond - avgFirst) / avgFirst) * 100;

  $("trend").textContent = trendPct > 5 ? "📈 Upward" : trendPct < -5 ? "📉 Downward" : "➡️ Stable";
  $("trend").style.color = trendPct > 5 ? "#7ee7b1" : trendPct < -5 ? "#ffb3b3" : "#95a0a0";

  // Average change
  let totalChange = 0;
  for (let i = 1; i < prices.length; i++) {
    totalChange += Math.abs(prices[i] - prices[i - 1]);
  }
  const avgChange = totalChange / (prices.length - 1);
  $("avgChange").textContent = `₹${avgChange.toFixed(0)}`;

  quickStats.classList.remove("hide");
}

/* Utility functions */
function nextDateFrom(labels) {
  if (!labels || labels.length === 0) {
    return new Date().toISOString().slice(0, 10);
  }
  
  const last = labels[labels.length - 1];
  if (/^\d{4}-\d{2}-\d{2}$/.test(last)) {
    const d = new Date(last);
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  }
  
  return new Date().toISOString().slice(0, 10);
}

function formatMonth(label) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) {
    const d = new Date(label);
    return d.toLocaleString("en-US", { month: "long", year: "numeric" });
  }
  return label;
}

function clearCards() {
  currentPriceEl.textContent = "—";
  predictedPriceEl.textContent = "—";
  predictedPctEl.textContent = "";
  peakMonthEl.textContent = "—";
  cropName.textContent = "—";
  cropDesc.textContent = "Select a crop to see information.";
  cropImg.src = "";
  confidenceBadge.innerHTML = '<span class="badge-icon">🎯</span><span>— Confidence</span>';
  metaWindow.textContent = "—";
  metaUsed.textContent = "—";
  metaPadded.textContent = "—";
  resultBox.classList.add("hide");
  chartNote.textContent = "";
}
