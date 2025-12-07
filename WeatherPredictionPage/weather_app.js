// API Configuration
const API_URL = "http://127.0.0.1:5000/predict";
const BACKEND_ORIGIN = new URL(API_URL).origin;

// DOM Elements
const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const bgVideo = document.getElementById("bgVideo");
const mainIcon = document.getElementById("mainIcon");
const weatherIconEmoji = document.getElementById("weatherIconEmoji");

const cityName = document.getElementById("cityName");
const countryName = document.getElementById("countryName");
const localTime = document.getElementById("localTime");
const mainTemp = document.getElementById("mainTemp");
const description = document.getElementById("description");

const humidity = document.getElementById("humidity");
const pressure = document.getElementById("pressure");
const wind = document.getElementById("wind");
const rainIntensity = document.getElementById("rainIntensity");
const rainTomorrow = document.getElementById("rainTomorrow");
const aqiValue = document.getElementById("aqiValue");

const sunriseEl = document.getElementById("sunrise");
const sunsetEl = document.getElementById("sunset");
const forecastCards = document.getElementById("forecastCards");

let tempChart;

// ==================== Animated Background Canvas ====================
const canvas = document.getElementById('bgCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const particles = [];
const particleCount = 80;

class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 0.5;
        this.speedX = Math.random() * 0.5 - 0.25;
        this.speedY = Math.random() * 0.5 - 0.25;
        this.opacity = Math.random() * 0.5 + 0.2;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.x > canvas.width) this.x = 0;
        if (this.x < 0) this.x = canvas.width;
        if (this.y > canvas.height) this.y = 0;
        if (this.y < 0) this.y = canvas.height;
    }

    draw() {
        ctx.fillStyle = `rgba(34, 177, 106, ${this.opacity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function initParticles() {
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }
}

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    particles.forEach(particle => {
        particle.update();
        particle.draw();
    });

    particles.forEach((p1, i) => {
        particles.slice(i + 1).forEach(p2 => {
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 150) {
                ctx.strokeStyle = `rgba(34, 177, 106, ${0.15 * (1 - distance / 150)})`;
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
        });
    });

    requestAnimationFrame(animateParticles);
}

initParticles();
animateParticles();

// ==================== Weather Icons Mapping ====================
const weatherIcons = {
    'clear sky': '☀️',
    'few clouds': '🌤️',
    'scattered clouds': '⛅',
    'broken clouds': '☁️',
    'overcast clouds': '☁️',
    'shower rain': '🌧️',
    'rain': '🌧️',
    'light rain': '🌦️',
    'moderate rain': '🌧️',
    'heavy rain': '⛈️',
    'thunderstorm': '⛈️',
    'snow': '❄️',
    'light snow': '🌨️',
    'mist': '🌫️',
    'fog': '🌫️',
    'haze': '🌫️',
    'smoke': '💨',
    'dust': '🌪️',
    'sand': '🌪️'
};

function getWeatherIcon(description) {
    if (!description) return '🌈';
    
    const desc = description.toLowerCase();
    for (let key in weatherIcons) {
        if (desc.includes(key)) {
            return weatherIcons[key];
        }
    }
    return '🌈';
}

// ==================== Helper Functions ====================
function makeAbsoluteURL(path) {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://")) {
        return path;
    }
    if (path.startsWith("/")) {
        return BACKEND_ORIGIN + path;
    }
    return BACKEND_ORIGIN + "/" + path;
}

// Helper to safely get nested values
function safeGet(obj, path, defaultValue = '—') {
    const keys = path.split('.');
    let result = obj;
    for (let key of keys) {
        if (result && result.hasOwnProperty(key)) {
            result = result[key];
        } else {
            return defaultValue;
        }
    }
    return result !== undefined && result !== null ? result : defaultValue;
}

// ==================== Fetch Weather Data ====================
async function fetchWeather(city) {
    try {
        console.log(`%c🌤️ Fetching weather for: ${city}`, 'color: #22b16a; font-weight: bold; font-size: 14px;');
        const res = await fetch(API_URL, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ city })
        });

        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }

        const data = await res.json();
        
        // DETAILED DEBUG OUTPUT
        console.log('%c📦 FULL API RESPONSE:', 'color: #f0b63a; font-weight: bold; font-size: 16px;');
        console.log(JSON.stringify(data, null, 2));
        
        console.log('%c🔍 DATA STRUCTURE ANALYSIS:', 'color: #22b16a; font-weight: bold; font-size: 14px;');
        console.log('Top level keys:', Object.keys(data));
        if (data.current) {
            console.log('Current weather keys:', Object.keys(data.current));
        }
        if (data.forecast_next_5_hours) {
            console.log('Forecast array length:', data.forecast_next_5_hours.length);
            if (data.forecast_next_5_hours.length > 0) {
                console.log('First forecast item keys:', Object.keys(data.forecast_next_5_hours[0]));
            }
        }
        
        return data;
    } catch (error) {
        console.error('❌ Error fetching weather:', error);
        alert(`Failed to fetch weather data for "${city}".\n\nError: ${error.message}\n\nPlease ensure:\n1. Your Flask backend is running on http://127.0.0.1:5000\n2. The /predict endpoint is accessible\n3. CORS is properly configured`);
        return null;
    }
}

// ==================== Update UI ====================
function updateUI(data) {
    if (!data) return;

    console.log('%c🎨 Starting UI Update', 'color: #22b16a; font-weight: bold;');

    // Simple fade-in animations (no hiding)
    gsap.fromTo('.location-block', 
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }
    );
    
    gsap.fromTo('.current-weather-block', 
        { opacity: 0, scale: 0.95 },
        { opacity: 1, scale: 1, duration: 0.6, delay: 0.1, ease: 'power2.out' }
    );
    
    gsap.fromTo('.detail-item', 
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, delay: 0.2, ease: 'power2.out' }
    );

    // Update basic info
    cityName.textContent = safeGet(data, 'city');
    countryName.innerHTML = `<span>📍</span><span>${safeGet(data, 'country')}</span>`;
    
    const time = safeGet(data, 'current_datetime.time');
    const day = safeGet(data, 'current_datetime.day');
    localTime.textContent = `${time} • ${day}`;

    // Update current weather
    const tempValue = safeGet(data, 'current.Temp');
    const temp = tempValue !== '—' ? Math.round(tempValue) : '—';
    mainTemp.textContent = `${temp}°C`;
    
    const desc = safeGet(data, 'current.description');
    description.textContent = desc;

    // Update weather icon
    const iconEmoji = getWeatherIcon(desc);
    
    if (data.animated_icon) {
        const iconURL = makeAbsoluteURL(data.animated_icon);
        console.log('🖼️ Loading animated icon:', iconURL);
        mainIcon.src = iconURL;
        mainIcon.style.display = 'block';
        weatherIconEmoji.style.display = 'none';
        
        mainIcon.onerror = () => {
            console.warn('⚠️ Failed to load animated icon, using emoji fallback');
            mainIcon.style.display = 'none';
            weatherIconEmoji.style.display = 'block';
            weatherIconEmoji.textContent = iconEmoji;
        };
    } else {
        mainIcon.style.display = 'none';
        weatherIconEmoji.style.display = 'block';
        weatherIconEmoji.textContent = iconEmoji;
    }

    // Update details with comprehensive logging
    console.log('%c📊 UPDATING DETAIL CARDS:', 'color: #f0b63a; font-weight: bold;');
    
    const humidityValue = safeGet(data, 'current.Humidity');
    humidity.textContent = humidityValue !== '—' ? `${Math.round(humidityValue)}%` : '—';
    console.log('💧 Humidity:', humidityValue);
    
    const pressureValue = safeGet(data, 'current.Pressure');
    pressure.textContent = pressureValue !== '—' ? `${Math.round(pressureValue)} hPa` : '—';
    console.log('🌡️ Pressure:', pressureValue);
    
    const windValue = safeGet(data, 'current.WindGustSpeed');
    wind.textContent = windValue !== '—' ? `${Math.round(windValue)} km/h` : '—';
    console.log('💨 Wind:', windValue);
    
    const rainIntValue = safeGet(data, 'current.rain_intensity');
    rainIntensity.textContent = rainIntValue;
    console.log('🌧️ Rain Intensity:', rainIntValue);
    
    const rainTomValue = safeGet(data, 'RainTomorrow');
    rainTomorrow.textContent = rainTomValue;
    console.log('☔ Rain Tomorrow:', rainTomValue);
    
    const aqiIndex = safeGet(data, 'aqi.index');
    const aqiStatus = safeGet(data, 'aqi.status');
    aqiValue.textContent = aqiIndex !== '—' ? `${aqiIndex} (${aqiStatus})` : '—';
    console.log('🏭 AQI:', aqiIndex, aqiStatus);

    const sunriseValue = safeGet(data, 'current.sunrise');
    sunriseEl.textContent = sunriseValue;
    console.log('🌅 Sunrise:', sunriseValue);
    
    const sunsetValue = safeGet(data, 'current.sunset');
    sunsetEl.textContent = sunsetValue;
    console.log('🌇 Sunset:', sunsetValue);

    // Update background video
    if (data.background_video) {
        const videoURL = makeAbsoluteURL(data.background_video);
        console.log('🎥 Loading background video:', videoURL);
        bgVideo.src = videoURL;
        
        bgVideo.onerror = () => {
            console.warn('⚠️ Failed to load background video');
            bgVideo.style.display = 'none';
        };
        
        bgVideo.onloadeddata = () => {
            console.log('✅ Background video loaded successfully');
            bgVideo.style.display = 'block';
        };
    }

    // Update forecast cards
    const forecastData = data.forecast_next_5_hours || [];
    console.log('%c🔮 FORECAST DATA:', 'color: #22b16a; font-weight: bold;');
    console.log('Forecast items:', forecastData.length);
    updateForecastCards(forecastData);
}

// ==================== Update Forecast Cards ====================
function updateForecastCards(forecastData) {
    forecastCards.innerHTML = '';
    
    if (!forecastData || forecastData.length === 0) {
        console.warn('⚠️ No forecast data available');
        forecastCards.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--muted); padding: 40px; font-size: 16px;">No forecast data available from backend</p>';
        drawChart(['—', '—', '—', '—', '—'], [0, 0, 0, 0, 0]);
        return;
    }

    let temps = [];
    let labels = [];

    console.log('%c📅 Creating Forecast Cards:', 'color: #22b16a; font-weight: bold;');
    forecastData.forEach((f, idx) => {
        console.log(`Card ${idx + 1}:`, {
            hour: f.hour,
            temperature: f.temperature,
            humidity: f.humidity
        });
        
        const card = document.createElement('div');
        card.className = 'forecast-card';
        
        const hourText = f.hour || '—';
        const tempText = f.temperature !== undefined && f.temperature !== null ? Math.round(f.temperature) : '—';
        const humText = f.humidity !== undefined && f.humidity !== null ? Math.round(f.humidity) : '—';
        
        card.innerHTML = `
            <div class="hour">${hourText}</div>
            <div class="temp">${tempText}°C</div>
            <div class="hum">${humText}% RH</div>
        `;
        forecastCards.appendChild(card);

        gsap.fromTo(card, 
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.4, delay: 0.3 + (idx * 0.08), ease: 'power2.out' }
        );

        temps.push(f.temperature !== undefined && f.temperature !== null ? Math.round(f.temperature) : 0);
        labels.push(hourText);
    });

    console.log('📈 Chart Data - Labels:', labels);
    console.log('📈 Chart Data - Temps:', temps);
    drawChart(labels, temps);
}

// ==================== Draw Temperature Chart ====================
function drawChart(labels, temps) {
    const ctx = document.getElementById('tempChart');

    if (tempChart) {
        tempChart.destroy();
    }

    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(34, 177, 106, 0.4)');
    gradient.addColorStop(1, 'rgba(34, 177, 106, 0.01)');

    tempChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Temperature',
                data: temps,
                borderColor: '#22b16a',
                backgroundColor: gradient,
                borderWidth: 3,
                pointRadius: 6,
                pointBackgroundColor: '#22b16a',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHoverRadius: 8,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(21, 23, 24, 0.95)',
                    padding: 12,
                    titleColor: '#22b16a',
                    bodyColor: '#e6efea',
                    borderColor: 'rgba(34, 177, 106, 0.3)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return `${Math.round(context.parsed.y)}°C`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { 
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: { 
                        color: '#95a0a0', 
                        font: { size: 12 }
                    }
                },
                y: {
                    grid: { 
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: { 
                        color: '#95a0a0',
                        font: { size: 12 },
                        callback: value => `${Math.round(value)}°C`,
                        stepSize: 1
                    }
                }
            },
            interaction: {
                mode: 'index',
                intersect: false
            }
        }
    });
    
    console.log('✅ Chart created successfully');
}

// ==================== Event Listeners ====================
searchBtn.addEventListener('click', async () => {
    const city = cityInput.value.trim();
    if (!city) {
        alert('Please enter a city name');
        return;
    }

    const data = await fetchWeather(city);
    if (data) {
        updateUI(data);
    }
});

cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchBtn.click();
    }
});

// ==================== Initial Load ====================
window.addEventListener('load', () => {
    console.log('%c🚀 FutureCrop Weather Dashboard Loaded', 'color: #22b16a; font-weight: bold; font-size: 18px; background: #0a0b0c; padding: 10px;');
    
    setTimeout(() => {
        document.getElementById('loading').classList.add('hidden');
    }, 500);
    
    // Show panels immediately, then animate
    document.querySelector('.left-panel').style.opacity = '1';
    document.querySelector('.right-panel').style.opacity = '1';
    
    gsap.fromTo('.left-panel', 
        { x: -30, opacity: 0.5 },
        { x: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }
    );

    gsap.fromTo('.right-panel', 
        { x: 30, opacity: 0.5 },
        { x: 0, opacity: 1, duration: 0.8, delay: 0.1, ease: 'power3.out' }
    );

    console.log('🌍 Loading default city: Delhi');
    fetchWeather("Delhi").then(data => {
        if (data) {
            updateUI(data);
        } else {
            console.error('❌ Failed to load default city data');
            cityName.textContent = "Backend Not Connected";
            description.textContent = "Please start your Flask server";
            weatherIconEmoji.textContent = "⚠️";
        }
    });
});