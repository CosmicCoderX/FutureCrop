/* Enhanced Crop Recommendation - JavaScript */

const API_URL = "http://127.0.0.1:8000/predict";
const IMAGE_BASE = "./images"; // Folder for crop images

/* DOM Elements */
const $ = (id) => document.getElementById(id);
const predictForm = $("predictForm");
const predictBtn = $("predictBtn");
const clearBtn = $("clearBtn");
const menuToggle = $("menuToggle");
const sidebar = $("sidebar");
const toaster = $("toaster");
const loadingOverlay = $("loading");
const exportBtn = $("exportBtn");

// Input fields
const inputs = {
  N: $("N"),
  P: $("P"),
  K: $("K"),
  temperature: $("temperature"),
  humidity: $("humidity"),
  ph: $("ph"),
  rainfall: $("rainfall")
};

// Display elements
const emptyState = $("emptyState");
const resultContent = $("resultContent");
const recommendedCrop = $("recommendedCrop");
const cropIcon = $("cropIcon");
const cropDescription = $("cropDescription");
const confidenceBadge = $("confidenceBadge");
const apiStatus = $("apiStatus");
const apiStatusDot = $("apiStatusDot");

// Result sections
const insightsSection = $("insightsSection");
const insightsList = $("insightsList");
const alternativesSection = $("alternativesSection");
const alternativesList = $("alternativesList");
const soilAnalysis = $("soilAnalysis");
const cropRequirements = $("cropRequirements");
const parametersDisplay = $("parametersDisplay");

// Crop database with requirements
let cropDatabase = {};

// Sample presets for quick testing
const presets = {
  rice: { N: 90, P: 42, K: 43, temperature: 25, humidity: 82, ph: 6.5, rainfall: 202 },
  wheat: { N: 50, P: 30, K: 30, temperature: 18, humidity: 65, ph: 7.0, rainfall: 80 },
  cotton: { N: 120, P: 60, K: 50, temperature: 25, humidity: 60, ph: 6.8, rainfall: 85 }
};

let currentPrediction = null;

/* Initialize */
window.addEventListener("DOMContentLoaded", init);

async function init() {
  await loadCropDatabase();
  checkAPI();
  setupEventListeners();
}

/* Check API status */
async function checkAPI() {
  try {
    const response = await fetch(API_URL.replace('/predict', '/health') || API_URL, {
      method: 'GET'
    });
    
    if (response.ok) {
      apiStatus.textContent = "API: Online";
      apiStatusDot.classList.add("online");
      apiStatusDot.classList.remove("offline");
    } else {
      throw new Error("API not responding");
    }
  } catch (e) {
    apiStatus.textContent = "API: Offline";
    apiStatusDot.classList.add("offline");
    apiStatusDot.classList.remove("online");
    toast("Backend not reachable. Please start your backend server.", true);
  }
}

/* Setup event listeners */
function setupEventListeners() {
  // Form submission
  predictForm.addEventListener("submit", handlePredict);
  
  // Clear button
  clearBtn.addEventListener("click", handleClear);
  
  // Menu toggle
  menuToggle.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    document.querySelector(".topbar").classList.toggle("sidebar-collapsed");
    document.querySelector(".main-grid").classList.toggle("sidebar-collapsed");
    document.querySelector(".footer").classList.toggle("sidebar-collapsed");
  });
  
  // Export button
  exportBtn.addEventListener("click", handleExport);
  
  // Quick preset buttons
  document.querySelectorAll(".quick-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const preset = btn.dataset.preset;
      loadPreset(preset);
    });
  });
}

/* Load preset values */
function loadPreset(preset) {
  const values = presets[preset];
  if (!values) return;
  
  Object.keys(values).forEach(key => {
    if (inputs[key]) {
      inputs[key].value = values[key];
    }
  });
  
  toast(`${preset.charAt(0).toUpperCase() + preset.slice(1)} sample data loaded! 🌾`);
}

/* Handle form submission */
async function handlePredict(e) {
  e.preventDefault();
  
  const payload = {
    N: parseFloat(inputs.N.value),
    P: parseFloat(inputs.P.value),
    K: parseFloat(inputs.K.value),
    temperature: parseFloat(inputs.temperature.value),
    humidity: parseFloat(inputs.humidity.value),
    ph: parseFloat(inputs.ph.value),
    rainfall: parseFloat(inputs.rainfall.value)
  };
  
  // Validate inputs
  if (Object.values(payload).some(v => isNaN(v))) {
    toast("Please fill in all fields with valid numbers.", true);
    return;
  }
  
  predictBtn.disabled = true;
  showLoading(true);
  
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    currentPrediction = { ...data, inputs: payload };
    
    displayResults(data, payload);
    toast("Recommendation generated successfully! 🎉");
    
  } catch (error) {
    toast(`Prediction failed: ${error.message}`, true);
    console.error("Prediction error:", error);
  } finally {
    predictBtn.disabled = false;
    showLoading(false);
  }
}

async function loadCropDatabase() {
  try {
    const response = await fetch("./crops.json");
    cropDatabase = await response.json();
    console.log("Crop database loaded:", Object.keys(cropDatabase).length, "crops");
  } catch (err) {
    console.error("Failed to load crop database", err);
    cropDatabase = {};
  }
}


/* Display prediction results */
function displayResults(data, inputs) {
  // Hide empty state, show results
  emptyState.classList.add("hide");
  resultContent.classList.remove("hide");
  
  // Get top recommendation from recommendations array
  let topCrop, confidence;
  if (data.recommendations && data.recommendations.length > 0) {
    topCrop = data.recommendations[0].crop;
    confidence = data.recommendations[0].confidence / 100; // Convert percentage to decimal
  } else {
    // Fallback for old format
    topCrop = data.prediction || data.crop || data.recommended_crop || "unknown";
    confidence = data.confidence || calculateConfidence(inputs);
  }
  
  const cropName = topCrop.toLowerCase();
  const cropInfo =
  cropDatabase[topCrop] || 
  cropDatabase[topCrop.charAt(0).toUpperCase() + topCrop.slice(1)] ||
  Object.values(cropDatabase).find(c => c.name.toLowerCase() === topCrop.toLowerCase()) ||
  { name: topCrop, icon: "🌱", desc: "Details unavailable" };
  
  // Update main crop display
  cropIcon.textContent = cropInfo.icon;
  recommendedCrop.textContent = cropInfo.name;
  cropDescription.textContent = cropInfo.desc;
  
  // Update confidence badge
  confidenceBadge.innerHTML = `
    <span class="badge-icon">🎯</span>
    <span>${Math.round(confidence * 100)}% Confidence</span>
  `;
  
  // Update metrics
  $("confidence").textContent = `${Math.round(confidence * 100)}%`;
  $("suitability").textContent = getSuitabilityLabel(confidence);
  $("growthScore").textContent = `${Math.round(confidence * 9.5 + 0.5)}/10`;
  
  // Update crop detail panel
  updateCropDetails(cropInfo);
  
  // Show soil analysis
  displaySoilAnalysis(inputs);
  
  // Generate alternatives from other recommendations
  if (data.recommendations && data.recommendations.length > 1) {
    displayTopRecommendations(data.recommendations);
  } else {
    generateAlternatives(cropName, inputs);
  }
  
  // Generate insights
  generateInsights(cropInfo, inputs, confidence);
  
  // Display input parameters
  displayParameters(inputs);
}

/* Display top 3 recommendations */
function displayTopRecommendations(recommendations) {
  // Skip first one as it's the main recommendation
  const alternatives = recommendations.slice(1, 3);
  
  if (alternatives.length > 0) {
    alternativesList.innerHTML = alternatives
      .map(rec => {
        const cropName = rec.crop.toLowerCase();
        const info = cropDatabase[cropName] || {
          name: rec.crop,
          icon: "🌱"
        };
        return `
          <div class="alternative-chip">
            <span class="chip-icon">${info.icon}</span>
            <span>${info.name}</span>
            <span style="margin-left: auto; font-size: 12px; opacity: 0.8;">${rec.confidence.toFixed(1)}%</span>
          </div>
        `;
      })
      .join("");
    
    // Update section title
    alternativesSection.querySelector("h3").textContent = "Top Alternative Crops";
    alternativesSection.classList.remove("hide");
  }
}

/* Update crop detail panel */
function updateCropDetails(cropInfo) {
  $("cropDetailName").textContent = cropInfo.name;
  $("cropDetailDesc").textContent = cropInfo.desc;
  
  if (cropInfo.image) {
    $("cropDetailImg").src = `${IMAGE_BASE}/${cropInfo.image}`;
  }
  
  // Show requirements if available
  if (cropInfo.requirements) {
    $("reqTemp").textContent = cropInfo.requirements.temp;
    $("reqHumidity").textContent = cropInfo.requirements.humidity;
    $("reqRainfall").textContent = cropInfo.requirements.rainfall;
    $("reqPH").textContent = cropInfo.requirements.ph;
    cropRequirements.classList.remove("hide");
  }
}

/* Display soil analysis */
function displaySoilAnalysis(inputs) {
  const npkRatio = `${inputs.N.toFixed(0)}:${inputs.P.toFixed(0)}:${inputs.K.toFixed(0)}`;
  $("npkRatio").textContent = npkRatio;
  
  // Analyze NPK balance
  const npkBalance = analyzeNPK(inputs.N, inputs.P, inputs.K);
  $("npkStatus").textContent = npkBalance.status;
  $("npkStatus").className = `analysis-status ${npkBalance.class}`;
  
  // Analyze pH
  $("phAnalysis").textContent = inputs.ph.toFixed(1);
  const phAnalysis = analyzePH(inputs.ph);
  $("phStatus").textContent = phAnalysis.status;
  $("phStatus").className = `analysis-status ${phAnalysis.class}`;
  
  // Analyze climate
  const climateScore = analyzeClimate(inputs.temperature, inputs.humidity, inputs.rainfall);
  $("climateAnalysis").textContent = climateScore.label;
  $("climateStatus").textContent = climateScore.status;
  $("climateStatus").className = `analysis-status ${climateScore.class}`;
  
  soilAnalysis.classList.remove("hide");
}

/* Analyze NPK ratio */
function analyzeNPK(n, p, k) {
  const total = n + p + k;
  const nRatio = n / total;
  
  if (nRatio > 0.5) {
    return { status: "High Nitrogen", class: "good" };
  } else if (nRatio > 0.3) {
    return { status: "Balanced", class: "good" };
  } else {
    return { status: "N Deficient", class: "moderate" };
  }
}

/* Analyze pH */
function analyzePH(ph) {
  if (ph >= 6.0 && ph <= 7.5) {
    return { status: "Optimal", class: "good" };
  } else if ((ph >= 5.5 && ph < 6.0) || (ph > 7.5 && ph <= 8.0)) {
    return { status: "Acceptable", class: "moderate" };
  } else {
    return { status: "Needs Adjustment", class: "poor" };
  }
}

/* Analyze climate */
function analyzeClimate(temp, humidity, rainfall) {
  let score = 0;
  
  // Temperature score
  if (temp >= 15 && temp <= 35) score += 33;
  else if (temp >= 10 && temp <= 40) score += 20;
  
  // Humidity score
  if (humidity >= 40 && humidity <= 80) score += 33;
  else if (humidity >= 30 && humidity <= 90) score += 20;
  
  // Rainfall score
  if (rainfall >= 50 && rainfall <= 250) score += 34;
  else if (rainfall >= 30 && rainfall <= 300) score += 20;
  
  if (score >= 80) {
    return { label: "Excellent", status: "Highly Suitable", class: "good" };
  } else if (score >= 60) {
    return { label: "Good", status: "Suitable", class: "good" };
  } else if (score >= 40) {
    return { label: "Fair", status: "Moderate", class: "moderate" };
  } else {
    return { label: "Challenging", status: "Difficult", class: "poor" };
  }
}

/* Generate alternative crops */
function generateAlternatives(mainCrop, inputs) {
  const alternatives = [];
  
  // Logic to suggest alternatives based on similar conditions
  Object.keys(cropDatabase).forEach(crop => {
    if (crop !== mainCrop && alternatives.length < 5) {
      alternatives.push(crop);
    }
  });
  
  if (alternatives.length > 0) {
    alternativesList.innerHTML = alternatives
      .map(crop => {
        const info = cropDatabase[crop];
        return `
          <div class="alternative-chip">
            <span class="chip-icon">${info.icon}</span>
            <span>${info.name}</span>
          </div>
        `;
      })
      .join("");
    alternativesSection.classList.remove("hide");
  }
}

/* Generate insights */
function generateInsights(cropInfo, inputs, confidence) {
  const insights = [];
  
  // Confidence-based insight
  if (confidence >= 0.8) {
    insights.push(`✅ High confidence prediction - ${cropInfo.name} is highly recommended for your conditions.`);
  } else if (confidence >= 0.6) {
    insights.push(`📊 Moderate confidence - ${cropInfo.name} should perform well with proper management.`);
  } else {
    insights.push(`⚠️ Lower confidence - Consider consulting local agricultural experts for best results.`);
  }
  
  // pH insights
  if (inputs.ph < 5.5) {
    insights.push("🧪 Soil is acidic - consider lime application to raise pH levels.");
  } else if (inputs.ph > 7.5) {
    insights.push("🧪 Soil is alkaline - sulfur amendments may help lower pH.");
  }
  
  // NPK insights
  const nRatio = inputs.N / (inputs.N + inputs.P + inputs.K);
  if (nRatio > 0.5) {
    insights.push("🌱 High nitrogen content detected - excellent for leafy growth.");
  }
  
  // Climate insights
  if (inputs.temperature > 30) {
    insights.push("🌡️ High temperature zone - ensure adequate irrigation during peak summer.");
  }
  
  if (inputs.rainfall > 200) {
    insights.push("🌧️ High rainfall area - good drainage is essential to prevent waterlogging.");
  }
  
  if (insights.length > 0) {
    insightsList.innerHTML = insights
      .map(text => `<div class="insight-item">${text}</div>`)
      .join("");
    insightsSection.classList.remove("hide");
  }
}

/* Display input parameters */
function displayParameters(inputs) {
  $("displayN").textContent = inputs.N.toFixed(1);
  $("displayP").textContent = inputs.P.toFixed(1);
  $("displayK").textContent = inputs.K.toFixed(1);
  $("displayTemp").textContent = inputs.temperature.toFixed(1) + "°C";
  $("displayHumidity").textContent = inputs.humidity.toFixed(1) + "%";
  $("displayPH").textContent = inputs.ph.toFixed(1);
  $("displayRainfall").textContent = inputs.rainfall.toFixed(1) + "mm";
  
  parametersDisplay.classList.remove("hide");
}

/* Calculate confidence score */
function calculateConfidence(inputs) {
  // Simple heuristic based on balanced conditions
  let score = 0.5;
  
  // Balanced NPK increases confidence
  const total = inputs.N + inputs.P + inputs.K;
  const balance = Math.min(inputs.N, inputs.P, inputs.K) / (total / 3);
  score += balance * 0.2;
  
  // Optimal pH
  if (inputs.ph >= 6.0 && inputs.ph <= 7.5) score += 0.15;
  
  // Moderate conditions
  if (inputs.temperature >= 15 && inputs.temperature <= 35) score += 0.1;
  if (inputs.humidity >= 40 && inputs.humidity <= 80) score += 0.05;
  
  return Math.min(score, 0.99);
}

/* Get suitability label */
function getSuitabilityLabel(confidence) {
  if (confidence >= 0.8) return "Excellent";
  if (confidence >= 0.6) return "Good";
  if (confidence >= 0.4) return "Fair";
  return "Moderate";
}

/* Handle clear */
function handleClear() {
  predictForm.reset();
  emptyState.classList.remove("hide");
  resultContent.classList.add("hide");
  cropRequirements.classList.add("hide");
  parametersDisplay.classList.add("hide");
  soilAnalysis.classList.add("hide");
  insightsSection.classList.add("hide");
  alternativesSection.classList.add("hide");
  
  confidenceBadge.innerHTML = `
    <span class="badge-icon">🎯</span>
    <span>— Confidence</span>
  `;
  
  $("cropDetailName").textContent = "No crop selected";
  $("cropDetailDesc").textContent = "Recommendation will appear here after analysis.";
  $("cropDetailImg").src = "";
  
  toast("Form cleared");
}

/* Handle export */
function handleExport() {
  if (!currentPrediction) {
    toast("No prediction to export. Run analysis first.", true);
    return;
  }
  
  const cropName = (currentPrediction.recommendations?.[0]?.crop || currentPrediction.prediction || currentPrediction.crop || "Unknown").toLowerCase();
  const cropInfo = cropDatabase[cropName] || { name: cropName };
  
  const exportData = {
    timestamp: new Date().toISOString(),
    recommended_crop: cropInfo.name,
    all_recommendations: currentPrediction.recommendations || [],
    inputs: currentPrediction.inputs,
    confidence: currentPrediction.recommendations?.[0]?.confidence || calculateConfidence(currentPrediction.inputs) * 100,
    analysis: {
      npk_ratio: `${currentPrediction.inputs.N}:${currentPrediction.inputs.P}:${currentPrediction.inputs.K}`,
      ph: currentPrediction.inputs.ph,
      temperature: currentPrediction.inputs.temperature,
      humidity: currentPrediction.inputs.humidity,
      rainfall: currentPrediction.inputs.rainfall
    }
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `crop_recommendation_${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  toast("Results exported successfully! 📥");
}

/* Show/hide loading */
function showLoading(show = true) {
  loadingOverlay.classList.toggle("hide", !show);
}

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