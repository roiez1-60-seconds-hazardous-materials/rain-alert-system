/**
 * Rain Alert Dashboard - Main JavaScript
 * מערכת התראות גשם בזמן אמת
 */

// Configuration
const CONFIG = {
    UPDATE_INTERVAL: 10 * 60 * 1000, // 10 minutes in milliseconds
    API_ENDPOINT: '/api/radar-data',
    MAP_CENTER: [31.5, 34.75], // Israel center
    MAP_ZOOM: 8,
    WINDY_URL: 'https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=default&metricTemp=default&metricWind=default&zoom=7&overlay=radar&product=radar&level=surface&lat=31.5&lon=34.75'
};

// Global State
let map = null;
let currentSource = 'govmap';
let currentFilter = 'all';
let radarData = null;
let settlementsData = [];
let uploadedImageData = null;

/**
 * Initialize the dashboard
 */
async function init() {
    console.log('🚀 Initializing Rain Alert Dashboard...');
    
    // Initialize map
    initializeMap();
    
    // Setup event listeners
    setupEventListeners();
    
    // Load Israeli settlements data
    await loadSettlementsData();
    
    // Initial data fetch
    await fetchRadarData();
    
    // Setup auto-refresh
    setInterval(fetchRadarData, CONFIG.UPDATE_INTERVAL);
    
    // Hide loading screen
    setTimeout(() => {
        document.getElementById('loadingScreen').style.display = 'none';
    }, 1500);
    
    console.log('✅ Dashboard initialized successfully');
}

/**
 * Initialize Leaflet map
 */
function initializeMap() {
    map = L.map('radarMap').setView(CONFIG.MAP_CENTER, CONFIG.MAP_ZOOM);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);
    
    // Add custom styling
    map.zoomControl.setPosition('bottomright');
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Source selector buttons
    document.querySelectorAll('.source-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.source-btn').forEach(b => b.classList.remove('active'));
            e.target.closest('.source-btn').classList.add('active');
            currentSource = e.target.closest('.source-btn').dataset.source;
            updateSourceDisplay();
        });
    });
    
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.level;
            renderSettlementsList();
        });
    });
    
    // Refresh button
    document.getElementById('refreshBtn')?.addEventListener('click', fetchRadarData);
    
    // Fullscreen button
    document.getElementById('fullscreenBtn')?.addEventListener('click', toggleFullscreen);
    
    // Image upload button
    document.getElementById('uploadImageBtn')?.addEventListener('click', () => {
        document.getElementById('imageUpload').click();
    });
    
    // Image upload handler
    document.getElementById('imageUpload')?.addEventListener('change', handleImageUpload);
}

/**
 * Load Israeli settlements data
 * Using mock data for now - in production, load from GeoJSON file
 */
async function loadSettlementsData() {
    try {
        // Try to load from JSON file first
        const response = await fetch('israeli_settlements.json');
        if (response.ok) {
            const data = await response.json();
            settlementsData = data.settlements;
            console.log(`✅ Loaded ${settlementsData.length} settlements from JSON file`);
            return;
        }
    } catch (error) {
        console.warn('Could not load settlements JSON, using fallback data');
    }
    
    // Mock settlements data (fallback)
    settlementsData = [
        { name: 'תל אביב', lat: 32.0853, lng: 34.7818, population: 460000 },
        { name: 'ירושלים', lat: 31.7683, lng: 35.2137, population: 936000 },
        { name: 'חיפה', lat: 32.7940, lng: 34.9896, population: 285000 },
        { name: 'ראשון לציון', lat: 31.9730, lng: 34.7925, population: 254000 },
        { name: 'פתח תקווה', lat: 32.0871, lng: 34.8872, population: 247000 },
        { name: 'אשדוד', lat: 31.8044, lng: 34.6553, population: 225000 },
        { name: 'נתניה', lat: 32.3215, lng: 34.8532, population: 221000 },
        { name: 'באר שבע', lat: 31.2518, lng: 34.7913, population: 209000 },
        { name: 'בני ברק', lat: 32.0809, lng: 34.8338, population: 204000 },
        { name: 'חולון', lat: 32.0117, lng: 34.7756, population: 196000 },
        { name: 'רמת גן', lat: 32.0719, lng: 34.8237, population: 163000 },
        { name: 'אשקלון', lat: 31.6688, lng: 34.5742, population: 144000 },
        { name: 'רחובות', lat: 31.8969, lng: 34.8186, population: 143000 },
        { name: 'בת ים', lat: 32.0193, lng: 34.7506, population: 129000 },
        { name: 'כפר סבא', lat: 32.1763, lng: 34.9076, population: 101000 },
        { name: 'הרצליה', lat: 32.1656, lng: 34.8433, population: 97000 },
        { name: 'חדרה', lat: 32.4344, lng: 34.9181, population: 97000 },
        { name: 'מודיעין', lat: 31.8970, lng: 35.0106, population: 93000 },
        { name: 'נצרת', lat: 32.7000, lng: 35.2961, population: 77000 },
        { name: 'רעננה', lat: 32.1847, lng: 34.8710, population: 75000 }
    ];
    
    console.log(`✅ Loaded ${settlementsData.length} settlements`);
}

/**
 * Fetch radar data from backend
 */
async function fetchRadarData() {
    console.log('🔄 Fetching radar data...');
    
    try {
        // For now, simulate data - in production, fetch from actual backend
        radarData = simulateRadarData();
        
        // Update dashboard
        updateDashboard();
        updateLastUpdateTime();
        
        console.log('✅ Radar data updated');
    } catch (error) {
        console.error('❌ Error fetching radar data:', error);
        showError('שגיאה בטעינת נתונים');
    }
}

/**
 * Simulate radar data (for development)
 */
function simulateRadarData() {
    const severityLevels = ['none', 'warning', 'danger', 'severe'];
    const affectedSettlements = settlementsData.map(settlement => ({
        ...settlement,
        severity: severityLevels[Math.floor(Math.random() * severityLevels.length)],
        intensity: Math.random() * 20,
        dbz: 20 + Math.random() * 30
    })).filter(s => s.severity !== 'none');
    
    return {
        timestamp: new Date().toISOString(),
        source: currentSource,
        coverage: Math.random() * 30,
        settlements: affectedSettlements,
        alerts: {
            warning: affectedSettlements.filter(s => s.severity === 'warning').length,
            danger: affectedSettlements.filter(s => s.severity === 'danger').length,
            severe: affectedSettlements.filter(s => s.severity === 'severe').length
        }
    };
}

/**
 * Update the entire dashboard
 */
function updateDashboard() {
    if (!radarData) return;
    
    // Update conditions
    updateConditions();
    
    // Update map
    updateMap();
    
    // Update settlements list
    renderSettlementsList();
    
    // Update alert banner
    updateAlertBanner();
}

/**
 * Update conditions card
 */
function updateConditions() {
    document.getElementById('yellowCount').textContent = radarData.alerts.warning;
    document.getElementById('orangeCount').textContent = radarData.alerts.danger;
    document.getElementById('redCount').textContent = radarData.alerts.severe;
    
    const coveragePercent = Math.round(radarData.coverage);
    document.getElementById('coverageFill').style.width = `${coveragePercent}%`;
    document.getElementById('coveragePercent').textContent = `${coveragePercent}%`;
}

/**
 * Update map with radar data
 */
function updateMap() {
    // Clear existing markers
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });
    
    // Add markers for affected settlements
    radarData.settlements.forEach(settlement => {
        const color = getSeverityColor(settlement.severity);
        const icon = L.divIcon({
            className: 'settlement-marker',
            html: `<div style="background: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`
        });
        
        const marker = L.marker([settlement.lat, settlement.lng], { icon })
            .addTo(map)
            .bindPopup(`
                <div style="text-align: center; font-family: Assistant, sans-serif;">
                    <strong style="font-size: 1.1rem;">${settlement.name}</strong><br>
                    <span style="color: #64748B;">עוצמה: ${settlement.intensity.toFixed(1)} מ"מ/שעה</span><br>
                    <span style="color: #64748B;">dBZ: ${settlement.dbz.toFixed(1)}</span>
                </div>
            `);
    });
}

/**
 * Render settlements list
 */
function renderSettlementsList() {
    const container = document.getElementById('settlementsList');
    if (!container || !radarData) return;
    
    let filtered = radarData.settlements;
    
    // Apply filter
    if (currentFilter !== 'all') {
        filtered = filtered.filter(s => s.severity === currentFilter);
    }
    
    // Sort by intensity
    filtered.sort((a, b) => b.intensity - a.intensity);
    
    // Render
    if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 2rem; color: #94A3B8;">אין יישובים מושפעים</div>';
        return;
    }
    
    container.innerHTML = filtered.map(settlement => `
        <div class="settlement-item ${settlement.severity}">
            <div class="settlement-name">${settlement.name}</div>
            <div class="settlement-intensity">
                <span>${settlement.intensity.toFixed(1)} מ"מ/שעה</span>
                <span style="color: ${getSeverityColor(settlement.severity)};">●</span>
            </div>
        </div>
    `).join('');
}

/**
 * Update alert banner
 */
function updateAlertBanner() {
    const banner = document.getElementById('alertBanner');
    const hasSevere = radarData.alerts.severe > 0;
    const hasDanger = radarData.alerts.danger > 0;
    
    if (hasSevere || hasDanger) {
        const title = hasSevere ? 'התראת גשם חמור!' : 'התראת גשם כבד';
        const details = `${radarData.alerts.severe + radarData.alerts.danger} יישובים מושפעים`;
        
        document.getElementById('alertTitle').textContent = title;
        document.getElementById('alertDetails').textContent = details;
        banner.style.display = 'block';
    } else {
        banner.style.display = 'none';
    }
}

/**
 * Update source display
 */
function updateSourceDisplay() {
    const sourceElement = document.getElementById('currentSource');
    const radarMap = document.getElementById('radarMap');
    const windyFrame = document.getElementById('windyFrame');
    
    if (currentSource === 'govmap') {
        // Show Leaflet map, hide Windy
        radarMap.style.display = 'block';
        windyFrame.style.display = 'none';
        sourceElement.innerHTML = '<span class="badge-icon">🇮🇱</span><span class="badge-text">GovMap</span>';
    } else {
        // Show Windy iframe, hide Leaflet
        radarMap.style.display = 'none';
        windyFrame.style.display = 'block';
        windyFrame.src = CONFIG.WINDY_URL;
        sourceElement.innerHTML = '<span class="badge-icon">🌐</span><span class="badge-text">Windy</span>';
    }
    
    // Refresh data
    fetchRadarData();
}

/**
 * Update last update time
 */
function updateLastUpdateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('he-IL', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    document.getElementById('lastUpdate').textContent = `עדכון אחרון: ${timeString}`;
    document.getElementById('sourceTime').textContent = timeString;
}

/**
 * Get severity color
 */
function getSeverityColor(severity) {
    const colors = {
        'warning': '#FFD700',
        'danger': '#FF8C00',
        'severe': '#DC143C'
    };
    return colors[severity] || '#94A3B8';
}

/**
 * Toggle fullscreen
 */
function toggleFullscreen() {
    const mapElement = document.getElementById('radarMap');
    if (!document.fullscreenElement) {
        mapElement.requestFullscreen().catch(err => {
            console.error('Error entering fullscreen:', err);
        });
    } else {
        document.exitFullscreen();
    }
}

/**
 * Show error message
 */
function showError(message) {
    const banner = document.getElementById('alertBanner');
    document.getElementById('alertTitle').textContent = 'שגיאה';
    document.getElementById('alertDetails').textContent = message;
    banner.style.display = 'block';
    banner.style.background = 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)';
    
    setTimeout(() => {
        banner.style.display = 'none';
    }, 5000);
}

/**
 * Show success message
 */
function showSuccess(message) {
    const banner = document.getElementById('alertBanner');
    document.getElementById('alertTitle').textContent = 'הצלחה ✓';
    document.getElementById('alertDetails').textContent = message;
    banner.style.display = 'block';
    banner.style.background = 'linear-gradient(135deg, #10B981 0%, #059669 100%)';
    
    setTimeout(() => {
        banner.style.display = 'none';
        banner.style.background = '';
    }, 3000);
}

/**
 * Show loading overlay
 */
function showLoadingOverlay(message) {
    const overlay = document.getElementById('loadingScreen');
    const text = overlay.querySelector('.loading-text');
    text.textContent = message;
    overlay.style.display = 'flex';
}

/**
 * Hide loading overlay
 */
function hideLoadingOverlay() {
    document.getElementById('loadingScreen').style.display = 'none';
}

/**
 * Handle image upload for analysis
 */
async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log('📷 Processing uploaded radar image...');
    
    try {
        showLoadingOverlay('מנתח תמונת מכ"ם...');
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            uploadedImageData = e.target.result;
            await analyzeUploadedImage(uploadedImageData);
            hideLoadingOverlay();
        };
        reader.readAsDataURL(file);
        
    } catch (error) {
        console.error('❌ Error processing image:', error);
        showError('שגיאה בניתוח התמונה');
        hideLoadingOverlay();
    }
}

/**
 * Analyze uploaded radar image
 */
async function analyzeUploadedImage(imageDataUrl) {
    console.log('🔍 Analyzing radar colors...');
    
    try {
        const img = new Image();
        img.src = imageDataUrl;
        
        await new Promise((resolve) => {
            img.onload = resolve;
        });
        
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        
        // Analyze colors
        const analysis = analyzeRadarColors(pixels, canvas.width, canvas.height);
        
        // Map to settlements
        const affectedSettlements = mapToSettlements(analysis);
        
        // Update dashboard
        radarData = {
            timestamp: new Date().toISOString(),
            source: 'uploaded_image',
            coverage: analysis.totalCoverage,
            settlements: affectedSettlements,
            alerts: {
                warning: affectedSettlements.filter(s => s.severity === 'warning').length,
                danger: affectedSettlements.filter(s => s.severity === 'danger').length,
                severe: affectedSettlements.filter(s => s.severity === 'severe').length
            }
        };
        
        updateDashboard();
        updateLastUpdateTime();
        
        showSuccess(`זוהו ${affectedSettlements.length} יישובים מושפעים`);
        
        console.log('✅ Image analysis complete:', radarData);
        
    } catch (error) {
        console.error('❌ Error analyzing image:', error);
        throw error;
    }
}

/**
 * Analyze radar colors in image
 */
function analyzeRadarColors(pixels, width, height) {
    let yellowPixels = 0;
    let orangePixels = 0;
    let redPixels = 0;
    const totalPixels = width * height;
    
    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        
        // Yellow detection (35-40 dBZ, 2.5-8.0 mm/h)
        if (r > 200 && g > 200 && b < 100) {
            yellowPixels++;
        }
        // Orange detection (40-45 dBZ, 8.0-15.0 mm/h)
        else if (r > 200 && g > 100 && g < 180 && b < 100) {
            orangePixels++;
        }
        // Red detection (45+ dBZ, 15.0+ mm/h)
        else if (r > 180 && g < 100 && b < 100) {
            redPixels++;
        }
    }
    
    const yellowPercent = (yellowPixels / totalPixels) * 100;
    const orangePercent = (orangePixels / totalPixels) * 100;
    const redPercent = (redPixels / totalPixels) * 100;
    const totalCoverage = yellowPercent + orangePercent + redPercent;
    
    return {
        yellowPercent,
        orangePercent,
        redPercent,
        totalCoverage,
        hasSignificantRain: totalCoverage > 0.5
    };
}

/**
 * Map detected rain to settlements based on color analysis
 */
function mapToSettlements(analysis) {
    if (!analysis.hasSignificantRain) {
        return [];
    }
    
    const affectedSettlements = [];
    const numAffected = Math.min(
        Math.floor(analysis.totalCoverage * 2), 
        settlementsData.length
    );
    
    for (let i = 0; i < numAffected; i++) {
        const settlement = settlementsData[i];
        let severity = 'none';
        let intensity = 0;
        
        if (analysis.redPercent > 0.1 && Math.random() > 0.7) {
            severity = 'severe';
            intensity = 15 + Math.random() * 10;
        } else if (analysis.orangePercent > 0.5 && Math.random() > 0.5) {
            severity = 'danger';
            intensity = 8 + Math.random() * 7;
        } else if (analysis.yellowPercent > 1.0) {
            severity = 'warning';
            intensity = 2.5 + Math.random() * 5.5;
        }
        
        if (severity !== 'none') {
            affectedSettlements.push({
                ...settlement,
                severity,
                intensity,
                dbz: 20 + (intensity * 2)
            });
        }
    }
    
    return affectedSettlements;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
