// ==========================================
// Health & Lifestyle Tool - Main Application
// ==========================================

let tg = window.Telegram && window.Telegram.WebApp;
if (tg) { tg.ready(); tg.expand(); }

let currentUser = null;
let selectedTrack = 1;
let currentViewTrack = 1;
let currentMeal = [];
let waterGoal = 0;
let waterIntake = 0;
let lastResults = {};

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('healthApp_user');
    if (saved) {
        currentUser = JSON.parse(saved);
        showMainScreen();
    }
    setLanguage(currentLang);
});

// ==========================================
// AUTH
// ==========================================
function loginUser() {
    const name = document.getElementById('login-name').value.trim();
    if (!name) { showAlert(t('enterName')); return; }
    currentUser = { name, created: new Date().toISOString() };
    localStorage.setItem('healthApp_user', JSON.stringify(currentUser));
    showMainScreen();
}

function logoutUser() {
    if (confirm('Logout?')) {
        currentUser = null;
        localStorage.removeItem('healthApp_user');
        document.getElementById('login-screen').classList.add('active-screen');
        document.getElementById('login-screen').style.display = '';
        document.getElementById('main-screen').classList.remove('active-screen');
        document.getElementById('main-screen').style.display = 'none';
    }
}

function showMainScreen() {
    document.getElementById('login-screen').classList.remove('active-screen');
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-screen').classList.add('active-screen');
    document.getElementById('main-screen').style.display = 'flex';
    document.getElementById('user-name-display').textContent = currentUser.name;
    document.getElementById('user-avatar').textContent = currentUser.name.charAt(0).toUpperCase();
    setLanguage(currentLang);
}

// ==========================================
// TABS
// ==========================================
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');
    if (tabName === 'history') renderHistory();
}

// ==========================================
// TRACK SELECTOR
// ==========================================
function selectTrack(n) {
    selectedTrack = n;
    document.querySelectorAll('.track-btn[data-track]').forEach(b => b.classList.toggle('active', parseInt(b.dataset.track) === n));
}

function viewTrack(n) {
    currentViewTrack = n;
    document.querySelectorAll('.track-btn[data-view-track]').forEach(b => b.classList.toggle('active', parseInt(b.dataset.viewTrack) === n));
    renderHistory();
}

// ==========================================
// SAVE & HISTORY
// ==========================================
function getRecords() {
    return JSON.parse(localStorage.getItem('healthApp_records') || '[]');
}

function saveRecords(records) {
    localStorage.setItem('healthApp_records', JSON.stringify(records));
}

function saveResult(category) {
    if (!lastResults[category]) return;
    const records = getRecords();
    records.push({
        id: Date.now(),
        track: selectedTrack,
        category,
        date: new Date().toISOString(),
        data: lastResults[category],
        summary: lastResults[category].summary || ''
    });
    saveRecords(records);
    showAlert(t('resultSaved') + ' ' + selectedTrack + '!');
}

function deleteRecord(id) {
    if (!confirm(t('deleteConfirm'))) return;
    const records = getRecords().filter(r => r.id !== id);
    saveRecords(records);
    renderHistory();
}

function renderHistory() {
    const filter = document.getElementById('history-filter')?.value || 'all';
    let records = getRecords().filter(r => r.track === currentViewTrack);
    if (filter !== 'all') records = records.filter(r => r.category === filter);
    records.sort((a, b) => new Date(b.date) - new Date(a.date));

    const listEl = document.getElementById('history-list');
    if (!listEl) return;

    if (records.length === 0) {
        listEl.innerHTML = `<p style="text-align:center;color:var(--gray-500);font-size:0.82rem;padding:20px;">${t('noRecords')}</p>`;
        return;
    }

    listEl.innerHTML = records.map(r => `
        <div class="history-card">
            <div class="history-card-header">
                <span class="history-card-type ${r.category}">${r.category.toUpperCase()}</span>
                <span class="history-card-date">${new Date(r.date).toLocaleDateString()} ${new Date(r.date).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
            </div>
            <div class="history-card-body">${r.summary || JSON.stringify(r.data).substring(0, 100) + '...'}</div>
            <div class="history-card-actions">
                <button class="view-btn" onclick="viewRecord(${r.id})">👁️ ${t('view')}</button>
                <label><input type="checkbox" class="compare-check" data-id="${r.id}"> ${t('compare')}</label>
                <button class="delete-btn" onclick="deleteRecord(${r.id})">${t('delete')}</button>
            </div>
        </div>
    `).join('');
}

function viewRecord(id) {
    const record = getRecords().find(r => r.id === id);
    if (!record) return;
    const d = record.data;
    const dateStr = new Date(record.date).toLocaleDateString() + ' ' + new Date(record.date).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    let html = `<div class="detail-view-overlay" onclick="if(event.target===this)closeDetailView()">
        <div class="detail-view-panel">
        <div class="detail-view-header">
            <span class="history-card-type ${record.category}">${record.category.toUpperCase()}</span>
            <span>${dateStr}</span>
            <button class="detail-close-btn" onclick="closeDetailView()">✕</button>
        </div>`;

    if (record.category === 'lab' && d.results) {
        const scoreClass = d.score >= 80 ? 'good' : d.score >= 60 ? 'warning' : 'danger';
        const normalCount = d.results.filter(r => r.status === 'normal').length;
        html += `<div class="score-container"><div class="score-circle ${scoreClass}">${d.score}</div><div class="score-label">${t('healthScore')} (${normalCount}/${d.results.length} ${t('normal')})</div></div>`;
        const cats = { blood_sugar: { label: t('bloodSugar'), results: [] }, liver: { label: t('liverFunction'), results: [] }, cholesterol: { label: t('cholesterol'), results: [] }, kidney: { label: t('kidneyFunction'), results: [] }, blood: { label: t('redBlood'), results: [] }, other: { label: t('otherTests'), results: [] } };
        d.results.forEach(r => { if (cats[r.category]) cats[r.category].results.push(r); else { const cat = Object.keys(cats).find(k => r.id && k); if (!cat) { if (!cats.other) cats.other = {label:t('otherTests'),results:[]}; cats.other.results.push(r); } } });
        Object.values(cats).forEach(cat => {
            if (cat.results.length === 0) return;
            html += `<h4>${cat.label}</h4>`;
            cat.results.forEach(r => {
                const statusIcon = r.status === 'normal' ? '✅' : r.status === 'warning' ? '🟡' : '🔴';
                const normalRange = `${r.normalMin} - ${r.normalMax === 999 ? '∞' : r.normalMax}`;
                html += `<div class="lab-result-card ${r.status}"><div class="lab-test-name">${r.label}</div><div class="lab-test-value">Your: <strong>${r.value} ${r.unit}</strong> | Normal: ${normalRange} ${r.unit}</div><div class="lab-test-status">${statusIcon} ${r.status.charAt(0).toUpperCase() + r.status.slice(1)}</div></div>`;
            });
        });
    } else if (record.category === 'exercise') {
        html += `<div class="result-item"><span class="result-label">${t('exerciseType')}</span><span class="result-value">${d.exercise || '-'}</span></div>`;
        html += `<div class="result-item"><span class="result-label">${t('duration')}</span><span class="result-value">${d.duration || '-'} min</span></div>`;
        html += `<div class="result-item"><span class="result-label">${t('caloriesBurned')}</span><span class="result-value">${d.calories || '-'} kcal</span></div>`;
        if (d.pace) html += `<div class="result-item"><span class="result-label">${t('avgPace')}</span><span class="result-value">${d.pace}</span></div>`;
        if (d.speed) html += `<div class="result-item"><span class="result-label">${t('avgSpeed')}</span><span class="result-value">${d.speed}</span></div>`;
        if (d.fatBurned) html += `<div class="result-item"><span class="result-label">${t('fatBurned')}</span><span class="result-value">${d.fatBurned}</span></div>`;
    } else if (record.category === 'food') {
        if (d.totals) {
            html += `<table class="summary-table"><thead><tr><th>${t('nutrient')}</th><th>${t('amount')}</th></tr></thead><tbody>`;
            html += `<tr><td>${t('calories')}</td><td>${d.totals.cal} kcal</td></tr>`;
            html += `<tr><td>${t('protein')}</td><td>${d.totals.protein} g</td></tr>`;
            html += `<tr><td>${t('carbs')}</td><td>${d.totals.carbs} g</td></tr>`;
            html += `<tr><td>${t('fat')}</td><td>${d.totals.fat} g</td></tr>`;
            html += `<tr><td>${t('fiber')}</td><td>${d.totals.fiber} g</td></tr>`;
            html += `<tr><td>${t('sugar')}</td><td>${d.totals.sugar} g</td></tr>`;
            html += `</tbody></table>`;
            if (d.rating) html += `<div class="result-item"><span class="result-label">${t('healthRating')}</span><span class="result-value">${d.rating}</span></div>`;
        }
    } else if (record.category === 'bmi') {
        const catClass = d.bmi < 18.5 ? 'info' : d.bmi < 25 ? 'good' : d.bmi < 30 ? 'warning' : 'danger';
        html += `<div class="score-container"><div class="score-circle ${catClass}">${d.bmi}</div><div class="score-label">${d.category || ''}</div></div>`;
        if (d.bmr) html += `<div class="result-item"><span class="result-label">${t('bmr')}</span><span class="result-value">${d.bmr} kcal</span></div>`;
        if (d.tdee) html += `<div class="result-item"><span class="result-label">${t('tdee')}</span><span class="result-value">${d.tdee} kcal</span></div>`;
    } else if (record.category === 'sleep') {
        const ratingClass = d.score >= 80 ? 'good' : d.score >= 60 ? 'info' : d.score >= 40 ? 'warning' : 'danger';
        html += `<div class="score-container"><div class="score-circle ${ratingClass}">${d.score}</div><div class="score-label">${d.rating || ''}</div></div>`;
        if (d.hours) html += `<div class="result-item"><span class="result-label">${t('sleepDuration')}</span><span class="result-value">${d.hours}</span></div>`;
        if (d.cycles) html += `<div class="result-item"><span class="result-label">${t('sleepCycles')}</span><span class="result-value">${d.cycles} cycles</span></div>`;
    } else {
        html += `<div class="history-card-body" style="padding:10px">${record.summary || JSON.stringify(d)}</div>`;
    }

    html += `<button class="btn-outline" onclick="closeDetailView()" style="margin-top:12px;width:100%">${t('close')}</button></div></div>`;

    let container = document.getElementById('detail-view');
    if (!container) {
        container = document.createElement('div');
        container.id = 'detail-view';
        document.body.appendChild(container);
    }
    container.innerHTML = html;
    container.classList.remove('hidden');
}

function closeDetailView() {
    const el = document.getElementById('detail-view');
    if (el) el.classList.add('hidden');
}

function toggleCompare() {
    const checked = document.querySelectorAll('.compare-check:checked');
    if (checked.length < 2) { showAlert(t('selectTwo')); return; }
    const ids = Array.from(checked).map(c => parseInt(c.dataset.id));
    const records = getRecords().filter(r => ids.includes(r.id));

    const compareEl = document.getElementById('compare-view');
    compareEl.classList.remove('hidden');

    if (records.every(r => r.category === 'lab') && records[0].data.results) {
        compareEl.innerHTML = renderLabComparison(records);
    } else if (records.every(r => r.category === 'exercise')) {
        compareEl.innerHTML = renderExerciseComparison(records);
    } else if (records.every(r => r.category === 'bmi')) {
        compareEl.innerHTML = renderBmiComparison(records);
    } else {
        compareEl.innerHTML = renderGenericComparison(records);
    }
}

function renderLabComparison(records) {
    const r1 = records[0], r2 = records[1];
    const d1 = new Date(r1.date).toLocaleDateString(), d2 = new Date(r2.date).toLocaleDateString();
    let rows = '';
    if (r1.data.results && r2.data.results) {
        const map2 = {};
        r2.data.results.forEach(t => map2[t.id] = t);
        r1.data.results.forEach(test => {
            const t2 = map2[test.id];
            if (t2) {
                const diff = t2.value - test.value;
                const cls = diff > 0 && test.value <= test.normalMax ? '' : diff < 0 ? 'improved' : diff > 0 ? 'worsened' : '';
                rows += `<tr><td>${test.label}</td><td>${test.value} ${test.unit}</td><td>${t2.value} ${t2.unit}</td><td class="${cls}">${diff > 0 ? '+' : ''}${diff.toFixed(1)}</td></tr>`;
            }
        });
    }
    return `<h4>${t('compareTitle')}</h4>
        <table class="compare-table"><thead><tr><th>Test</th><th>${d1}</th><th>${d2}</th><th>Change</th></tr></thead><tbody>${rows}</tbody></table>
        <button class="btn-outline" onclick="document.getElementById('compare-view').classList.add('hidden')" style="margin-top:10px;width:100%">${t('close')}</button>`;
}

function renderExerciseComparison(records) {
    const headers = records.map(r => new Date(r.date).toLocaleDateString());
    let rows = '';
    const fields = [['calories', t('caloriesBurned')], ['pace', t('avgPace')], ['speed', t('avgSpeed')], ['fatBurned', t('fatBurned')]];
    fields.forEach(([key, label]) => {
        rows += `<tr><td>${label}</td>` + records.map(r => `<td>${r.data[key] || '-'}</td>`).join('') + '</tr>';
    });
    return `<h4>${t('compareTitle')}</h4>
        <table class="compare-table"><thead><tr><th>Metric</th>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
        <button class="btn-outline" onclick="document.getElementById('compare-view').classList.add('hidden')" style="margin-top:10px;width:100%">${t('close')}</button>`;
}

function renderBmiComparison(records) {
    const headers = records.map(r => new Date(r.date).toLocaleDateString());
    let rows = '';
    const fields = [['bmi', 'BMI'], ['bmr', t('bmr')], ['tdee', t('tdee')]];
    fields.forEach(([key, label]) => {
        rows += `<tr><td>${label}</td>` + records.map(r => `<td>${r.data[key] || '-'}</td>`).join('') + '</tr>';
    });
    return `<h4>${t('compareTitle')}</h4>
        <table class="compare-table"><thead><tr><th>Metric</th>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
        <button class="btn-outline" onclick="document.getElementById('compare-view').classList.add('hidden')" style="margin-top:10px;width:100%">${t('close')}</button>`;
}

function renderGenericComparison(records) {
    let html = `<h4>${t('compareTitle')}</h4>`;
    records.forEach(r => {
        html += `<div class="history-card" style="margin-bottom:8px"><div class="history-card-header"><span class="history-card-type ${r.category}">${r.category}</span><span class="history-card-date">${new Date(r.date).toLocaleDateString()}</span></div><div class="history-card-body">${r.summary}</div></div>`;
    });
    html += `<button class="btn-outline" onclick="document.getElementById('compare-view').classList.add('hidden')" style="margin-top:10px;width:100%">${t('close')}</button>`;
    return html;
}

// ==========================================
// EXERCISE CALCULATOR
// ==========================================
const MET_VALUES = {
    walking_slow: 2.5, walking: 3.5, walking_fast: 5.0,
    jogging: 7.0, running: 9.8, fast: 12.8, sprint: 16.0,
    hiking: 6.0, cycling: 8.0, swimming: 8.0
};

function calculateExercise() {
    const weight = parseFloat(document.getElementById('ex-weight').value);
    const distance = parseFloat(document.getElementById('ex-distance').value);
    const duration = parseFloat(document.getElementById('ex-duration').value);
    const exType = document.getElementById('ex-type').value;
    if (!weight || !distance || !duration) { showAlert('Please fill in all fields.'); return; }

    const met = MET_VALUES[exType];
    const hours = duration / 60;
    const calories = Math.round(met * weight * hours);
    const pace = duration / distance;
    const paceMin = Math.floor(pace);
    const paceSec = Math.round((pace - paceMin) * 60);
    const speed = (distance / hours).toFixed(1);
    const fatBurned = (calories / 7700).toFixed(2);
    const paceStr = `${paceMin}:${paceSec.toString().padStart(2,'0')} /km`;

    let level = '', levelClass = '';
    if (exType.includes('walk')) {
        if (pace < 8) { level = 'Fast Walker'; levelClass = 'good'; }
        else if (pace < 12) { level = 'Average Walker'; levelClass = 'info'; }
        else { level = 'Casual Walker'; levelClass = 'warning'; }
    } else {
        if (pace < 4.5) { level = 'Elite'; levelClass = 'good'; }
        else if (pace < 5.5) { level = 'Advanced'; levelClass = 'good'; }
        else if (pace < 6.5) { level = 'Intermediate'; levelClass = 'info'; }
        else if (pace < 8) { level = 'Beginner'; levelClass = 'warning'; }
        else { level = 'Starting Out'; levelClass = 'warning'; }
    }

    let tips = [];
    if (exType.includes('walk')) {
        tips.push('Walking 10,000 steps daily (~8 km) reduces heart disease risk by 50%.');
        tips.push('Swing your arms to burn 5-10% more calories while walking.');
        tips.push('Walk after meals to lower blood sugar spikes.');
    } else {
        if (pace > 7) tips.push('Try interval training: alternate 1 min fast / 2 min slow.');
        if (calories < 200) tips.push('Increase distance or intensity to burn more calories.');
    }
    tips.push('Hydrate with 150-250 mL water every 20 minutes.');
    tips.push('Cool down with 5-10 minutes of stretching after exercise.');

    lastResults.exercise = { calories, pace: paceStr, speed: speed + ' km/h', fatBurned: fatBurned + ' kg', level, summary: `${calories} kcal | ${distance} km | ${paceStr} | ${level}` };

    const el = document.getElementById('exercise-result');
    el.classList.remove('hidden');
    document.getElementById('exercise-save').classList.remove('hidden');
    el.innerHTML = `
        <h3>${t('exerciseSummary')}</h3>
        <div class="result-item"><span class="result-label">${t('caloriesBurned')}</span><span class="result-value good">${calories} kcal</span></div>
        <div class="result-item"><span class="result-label">${t('avgPace')}</span><span class="result-value info">${paceStr}</span></div>
        <div class="result-item"><span class="result-label">${t('avgSpeed')}</span><span class="result-value">${speed} km/h</span></div>
        <div class="result-item"><span class="result-label">${t('fatBurned')}</span><span class="result-value">${fatBurned} kg</span></div>
        <div class="result-item"><span class="result-label">${t('fitnessLevel')}</span><span class="result-value ${levelClass}">${level}</span></div>
        <div class="suggestion-box"><h4>💡 ${t('tips')}</h4><ul>${tips.map(tp => `<li>${tp}</li>`).join('')}</ul></div>
    `;
}

// ==========================================
// FOOD SIMULATOR
// ==========================================
const FOOD_DATABASE = {
    fruits: [
        { name: 'Apple', nameKh: 'ប៉ោម', cal: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, sugar: 10.4 },
        { name: 'Banana', nameKh: 'ចេក', cal: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6, sugar: 12.2 },
        { name: 'Orange', nameKh: 'ក្រូច', cal: 47, protein: 0.9, carbs: 12, fat: 0.1, fiber: 2.4, sugar: 9.4 },
        { name: 'Mango', nameKh: 'ស្វាយ', cal: 60, protein: 0.8, carbs: 15, fat: 0.4, fiber: 1.6, sugar: 13.7 },
        { name: 'Watermelon', nameKh: 'ឪឡឹក', cal: 30, protein: 0.6, carbs: 8, fat: 0.2, fiber: 0.4, sugar: 6.2 },
        { name: 'Papaya', nameKh: 'ល្ហុង', cal: 43, protein: 0.5, carbs: 11, fat: 0.3, fiber: 1.7, sugar: 7.8 },
        { name: 'Pineapple', nameKh: 'មនាស', cal: 50, protein: 0.5, carbs: 13, fat: 0.1, fiber: 1.4, sugar: 9.9 },
        { name: 'Grapes', nameKh: 'ទំពាំងបាយជូរ', cal: 69, protein: 0.7, carbs: 18, fat: 0.2, fiber: 0.9, sugar: 15.5 },
        { name: 'Avocado', nameKh: 'អាវ៉ូកាដូ', cal: 160, protein: 2, carbs: 8.5, fat: 14.7, fiber: 6.7, sugar: 0.7 },
        { name: 'Strawberries', nameKh: 'ផ្លែស្ត្របឺរី', cal: 32, protein: 0.7, carbs: 7.7, fat: 0.3, fiber: 2.0, sugar: 4.9 }
    ],
    vegetables: [
        { name: 'Broccoli', nameKh: 'ប្រូកូលី', cal: 34, protein: 2.8, carbs: 7, fat: 0.4, fiber: 2.6, sugar: 1.7 },
        { name: 'Spinach', nameKh: 'ស្ពឹនាច', cal: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2, sugar: 0.4 },
        { name: 'Carrot', nameKh: 'ការ៉ុត', cal: 41, protein: 0.9, carbs: 10, fat: 0.2, fiber: 2.8, sugar: 4.7 },
        { name: 'Tomato', nameKh: 'ប៉េងប៉ោះ', cal: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2, sugar: 2.6 },
        { name: 'Cucumber', nameKh: 'ត្រសក់', cal: 15, protein: 0.7, carbs: 3.6, fat: 0.1, fiber: 0.5, sugar: 1.7 },
        { name: 'Sweet Potato', nameKh: 'ដំឡូងជ្វា', cal: 86, protein: 1.6, carbs: 20, fat: 0.1, fiber: 3.0, sugar: 4.2 },
        { name: 'Cabbage', nameKh: 'ស្ពៃក្តោប', cal: 25, protein: 1.3, carbs: 5.8, fat: 0.1, fiber: 2.5, sugar: 3.2 },
        { name: 'Mushrooms', nameKh: 'ផ្សិត', cal: 22, protein: 3.1, carbs: 3.3, fat: 0.3, fiber: 1.0, sugar: 2.0 },
        { name: 'Morning Glory', nameKh: 'ត្រកួន', cal: 19, protein: 2.6, carbs: 3.1, fat: 0.2, fiber: 2.1, sugar: 0.4 },
        { name: 'Bean Sprouts', nameKh: 'សណ្តែកបណ្តុះ', cal: 31, protein: 3.0, carbs: 6.0, fat: 0.2, fiber: 1.8, sugar: 4.0 }
    ],
    proteins: [
        { name: 'Chicken Breast', nameKh: 'សាច់ដើមទ្រូងមាន់', cal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, sugar: 0 },
        { name: 'Salmon', nameKh: 'ត្រីសាល់ម៉ុន', cal: 208, protein: 20, carbs: 0, fat: 13, fiber: 0, sugar: 0 },
        { name: 'Egg', nameKh: 'ស៊ុត', cal: 155, protein: 13, carbs: 1.1, fat: 11, fiber: 0, sugar: 1.1 },
        { name: 'Tuna', nameKh: 'ត្រីទូណា', cal: 130, protein: 29, carbs: 0, fat: 1.3, fiber: 0, sugar: 0 },
        { name: 'Beef (lean)', nameKh: 'សាច់គោ', cal: 250, protein: 26, carbs: 0, fat: 15, fiber: 0, sugar: 0 },
        { name: 'Pork (lean)', nameKh: 'សាច់ជ្រូក', cal: 242, protein: 27, carbs: 0, fat: 14, fiber: 0, sugar: 0 },
        { name: 'Shrimp', nameKh: 'បង្គា', cal: 85, protein: 20, carbs: 0.2, fat: 0.5, fiber: 0, sugar: 0 },
        { name: 'Tofu', nameKh: 'តៅហ៊ូ', cal: 76, protein: 8, carbs: 1.9, fat: 4.8, fiber: 0.3, sugar: 0.6 },
        { name: 'Lentils', nameKh: 'សណ្តែកបន្សុក', cal: 116, protein: 9, carbs: 20, fat: 0.4, fiber: 7.9, sugar: 1.8 },
        { name: 'Fish (river)', nameKh: 'ត្រីទន្លេ', cal: 105, protein: 22, carbs: 0, fat: 1.5, fiber: 0, sugar: 0 }
    ],
    grains: [
        { name: 'White Rice', nameKh: 'បាយស', cal: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, sugar: 0 },
        { name: 'Brown Rice', nameKh: 'បាយស្រូវត្នោត', cal: 123, protein: 2.6, carbs: 26, fat: 1, fiber: 1.8, sugar: 0.4 },
        { name: 'Sticky Rice', nameKh: 'បាយដំណើប', cal: 169, protein: 3.5, carbs: 37, fat: 0.3, fiber: 1.7, sugar: 0 },
        { name: 'Noodles', nameKh: 'មី', cal: 138, protein: 4.5, carbs: 25, fat: 2.1, fiber: 1.2, sugar: 0.6 },
        { name: 'Bread', nameKh: 'នំបុ័ង', cal: 265, protein: 9, carbs: 49, fat: 3.2, fiber: 2.7, sugar: 5 },
        { name: 'Oats', nameKh: 'ស្រូវអូត', cal: 389, protein: 17, carbs: 66, fat: 7, fiber: 11, sugar: 1 },
        { name: 'Rice Porridge', nameKh: 'បបរ', cal: 46, protein: 1.1, carbs: 10, fat: 0.1, fiber: 0.1, sugar: 0 },
        { name: 'Baguette', nameKh: 'នំបុ័ងបារាំង', cal: 274, protein: 10.6, carbs: 51, fat: 3.0, fiber: 2.4, sugar: 4.0 }
    ],
    dairy: [
        { name: 'Milk (whole)', nameKh: 'ទឹកដោះគោ', cal: 61, protein: 3.2, carbs: 4.8, fat: 3.3, fiber: 0, sugar: 5 },
        { name: 'Yogurt', nameKh: 'ទឹកដោះគោជូរ', cal: 59, protein: 10, carbs: 3.6, fat: 0.4, fiber: 0, sugar: 3.2 },
        { name: 'Cheese', nameKh: 'ឈីស', cal: 403, protein: 25, carbs: 1.3, fat: 33, fiber: 0, sugar: 0.5 },
        { name: 'Butter', nameKh: 'ប៊ឺ', cal: 717, protein: 0.9, carbs: 0.1, fat: 81, fiber: 0, sugar: 0.1 },
        { name: 'Greek Yogurt', nameKh: 'ទឹកដោះគោជូរក្រិក', cal: 73, protein: 10, carbs: 6, fat: 0.7, fiber: 0, sugar: 4 },
        { name: 'Coconut Milk', nameKh: 'ទឹកដូង', cal: 230, protein: 2.3, carbs: 6.0, fat: 24, fiber: 0, sugar: 3.3 }
    ],
    beverages: [
        { name: 'Green Tea', nameKh: 'តែបៃតង', cal: 1, protein: 0.2, carbs: 0, fat: 0, fiber: 0, sugar: 0 },
        { name: 'Black Coffee', nameKh: 'កាហ្វេខ្មៅ', cal: 2, protein: 0.3, carbs: 0, fat: 0, fiber: 0, sugar: 0 },
        { name: 'Orange Juice', nameKh: 'ទឹកក្រូច', cal: 45, protein: 0.7, carbs: 10, fat: 0.2, fiber: 0.2, sugar: 8.4 },
        { name: 'Coconut Water', nameKh: 'ទឹកដូងក្អែក', cal: 19, protein: 0.7, carbs: 3.7, fat: 0.2, fiber: 1.1, sugar: 2.6 },
        { name: 'Cola', nameKh: 'កូកា', cal: 42, protein: 0, carbs: 11, fat: 0, fiber: 0, sugar: 11 },
        { name: 'Smoothie', nameKh: 'ទឹកផ្លែឈើលាយ', cal: 68, protein: 1.2, carbs: 15, fat: 0.5, fiber: 1.5, sugar: 12 },
        { name: 'Sugar Cane Juice', nameKh: 'ទឹកអំពៅ', cal: 73, protein: 0.2, carbs: 18, fat: 0, fiber: 0, sugar: 17 },
        { name: 'Iced Coffee (sweet)', nameKh: 'កាហ្វេទឹកកក', cal: 120, protein: 1.5, carbs: 22, fat: 3.5, fiber: 0, sugar: 20 }
    ],
    snacks: [
        { name: 'Dark Chocolate', nameKh: 'សូកូឡាខ្មៅ', cal: 546, protein: 5, carbs: 60, fat: 31, fiber: 7, sugar: 48 },
        { name: 'Almonds', nameKh: 'គ្រាប់អាល់ម៉ុង', cal: 579, protein: 21, carbs: 22, fat: 50, fiber: 12, sugar: 4.4 },
        { name: 'Peanuts', nameKh: 'សណ្តែកដី', cal: 567, protein: 26, carbs: 16, fat: 49, fiber: 8.5, sugar: 4 },
        { name: 'Potato Chips', nameKh: 'ដំឡូងបំពង', cal: 536, protein: 7, carbs: 53, fat: 35, fiber: 4.4, sugar: 0.3 },
        { name: 'Dried Mango', nameKh: 'ស្វាយសម្ងួត', cal: 319, protein: 2.5, carbs: 78, fat: 0.9, fiber: 2.4, sugar: 66 },
        { name: 'Rice Cake', nameKh: 'នំកៅកា', cal: 387, protein: 8.2, carbs: 82, fat: 2.8, fiber: 1.8, sugar: 0.3 },
        { name: 'Palm Sugar Cake', nameKh: 'នំត្នោត', cal: 350, protein: 4.0, carbs: 70, fat: 6.0, fiber: 1.0, sugar: 45 },
        { name: 'Num Krok', nameKh: 'នំគ្រក', cal: 210, protein: 3.5, carbs: 28, fat: 10, fiber: 0.5, sugar: 12 }
    ]
};

function updateFoodItems() {
    const cat = document.getElementById('food-category').value;
    const sel = document.getElementById('food-item');
    sel.innerHTML = '<option value="">-- Choose Food --</option>';
    if (cat && FOOD_DATABASE[cat]) {
        FOOD_DATABASE[cat].forEach((f, i) => {
            const name = currentLang === 'kh' && f.nameKh ? f.nameKh : f.name;
            sel.innerHTML += `<option value="${i}">${name} (${f.cal} kcal/100g)</option>`;
        });
    }
}

function addFoodItem() {
    const cat = document.getElementById('food-category').value;
    const idx = document.getElementById('food-item').value;
    const qty = parseFloat(document.getElementById('food-qty').value);
    if (!cat || idx === '' || !qty) { showAlert('Please select food and quantity.'); return; }
    const food = FOOD_DATABASE[cat][parseInt(idx)];
    currentMeal.push({ ...food, qty });
    renderMealList();
    document.getElementById('food-qty').value = '';
}

function removeFoodItem(idx) { currentMeal.splice(idx, 1); renderMealList(); }

function renderMealList() {
    const el = document.getElementById('meal-list');
    const btn = document.getElementById('calc-meal-btn');
    if (currentMeal.length === 0) { el.innerHTML = ''; btn.style.display = 'none'; return; }
    btn.style.display = 'block';
    el.innerHTML = currentMeal.map((item, i) => {
        const name = currentLang === 'kh' && item.nameKh ? item.nameKh : item.name;
        return `<div class="meal-item"><div><span class="meal-item-name">${name}</span><span class="meal-item-qty"> — ${item.qty}g</span></div><button class="meal-item-remove" onclick="removeFoodItem(${i})">✕</button></div>`;
    }).join('');
}

function calculateMeal() {
    if (currentMeal.length === 0) return;
    let totals = { cal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 };
    currentMeal.forEach(item => {
        const m = item.qty / 100;
        totals.cal += item.cal * m; totals.protein += item.protein * m;
        totals.carbs += item.carbs * m; totals.fat += item.fat * m;
        totals.fiber += item.fiber * m; totals.sugar += item.sugar * m;
    });
    Object.keys(totals).forEach(k => totals[k] = Math.round(totals[k] * 10) / 10);

    const proteinPct = totals.cal > 0 ? (totals.protein * 4 / totals.cal * 100) : 0, fatPct = totals.cal > 0 ? (totals.fat * 9 / totals.cal * 100) : 0, carbsPct = totals.cal > 0 ? (totals.carbs * 4 / totals.cal * 100) : 0;
    let rating = '', rClass = '', tips = [];
    if (proteinPct >= 20 && fatPct <= 35 && totals.fiber >= 3) { rating = 'Excellent'; rClass = 'good'; }
    else if (proteinPct >= 15 && fatPct <= 40) { rating = 'Good'; rClass = 'good'; }
    else if (fatPct > 50 || totals.sugar > 30) { rating = 'Needs Improvement'; rClass = 'danger'; }
    else { rating = 'Fair'; rClass = 'warning'; }

    if (totals.protein < 15) tips.push('Add more protein (chicken, fish, eggs, tofu).');
    if (totals.fiber < 5) tips.push('Increase fiber with vegetables and whole grains.');
    if (totals.sugar > 25) tips.push('High sugar — reduce sweet foods.');
    if (fatPct > 40) tips.push('Reduce fat — choose grilled over fried.');
    tips.push('Aim for 50% vegetables, 25% protein, 25% carbs.');

    lastResults.food = { totals, rating, summary: `${totals.cal} kcal | P:${totals.protein}g C:${totals.carbs}g F:${totals.fat}g | ${rating}` };

    const el = document.getElementById('food-result');
    el.classList.remove('hidden');
    document.getElementById('food-save').classList.remove('hidden');
    el.innerHTML = `
        <h3>🍽️ ${t('mealAnalysis')}</h3>
        <table class="summary-table"><thead><tr><th>${t('nutrient')}</th><th>${t('amount')}</th></tr></thead>
        <tbody>
            <tr><td>${t('calories')}</td><td>${totals.cal} kcal</td></tr>
            <tr><td>${t('protein')}</td><td>${totals.protein} g (${proteinPct.toFixed(0)}%)</td></tr>
            <tr><td>${t('carbs')}</td><td>${totals.carbs} g (${carbsPct.toFixed(0)}%)</td></tr>
            <tr><td>${t('fat')}</td><td>${totals.fat} g (${fatPct.toFixed(0)}%)</td></tr>
            <tr><td>${t('fiber')}</td><td>${totals.fiber} g</td></tr>
            <tr><td>${t('sugar')}</td><td>${totals.sugar} g</td></tr>
        </tbody></table>
        <div class="result-item" style="margin-top:10px"><span class="result-label">${t('healthRating')}</span><span class="result-value ${rClass}">${rating}</span></div>
        <div class="suggestion-box"><h4>💡 ${t('nutritionTips')}</h4><ul>${tips.map(tp => `<li>${tp}</li>`).join('')}</ul></div>
    `;
}

// ==========================================
// LAB RESULTS
// ==========================================
function analyzeLabResults() {
    const age = parseInt(document.getElementById('lab-age').value) || 30;
    const gender = document.getElementById('lab-gender').value;

    const tests = [
        { id:'fbs', label:'FBS', unit:'mg/dL', normalMin:75, normalMax:110, warnMax:125, category:'blood_sugar' },
        { id:'hba1c', label:'HbA1C', unit:'%', normalMin:4.5, normalMax:6.4, warnMax:8.0, category:'blood_sugar' },
        { id:'sgpt', label:'SGPT/ALT', unit:'UI/L', normalMin:0, normalMax:40, warnMax:80, category:'liver' },
        { id:'sgot', label:'SGOT/AST', unit:'UI/L', normalMin:0, normalMax:37, warnMax:60, category:'liver' },
        { id:'hdl', label:'HDL', unit:'mg/dL', normalMin:40, normalMax:999, warnMax:999, invertWarning:true, category:'cholesterol' },
        { id:'cholesterol', label:'Total Cholesterol', unit:'mg/dL', normalMin:0, normalMax:200, warnMax:240, category:'cholesterol' },
        { id:'ldl', label:'LDL', unit:'mg/dL', normalMin:0, normalMax:150, warnMax:190, category:'cholesterol' },
        { id:'triglycerides', label:'Triglycerides', unit:'mg/dL', normalMin:0, normalMax:200, warnMax:250, category:'cholesterol' },
        { id:'creatinine', label:'Creatinine', unit:'mg/dL', normalMin:0.7, normalMax:1.3, warnMax:1.8, category:'kidney' },
        { id:'urea', label:'Urea/BUN', unit:'mg/dL', normalMin:13, normalMax:45, warnMax:60, category:'kidney' },
        { id:'na', label:'Na', unit:'mmol/L', normalMin:135, normalMax:145, warnMax:155, category:'kidney' },
        { id:'k', label:'K', unit:'mmol/L', normalMin:3.5, normalMax:5.0, warnMax:5.5, category:'kidney' },
        { id:'cl', label:'Cl', unit:'mmol/L', normalMin:98, normalMax:107, warnMax:115, category:'kidney' },
        { id:'rbc', label:'RBC', unit:'M/µL', normalMin:gender==='male'?4.50:4.0, normalMax:gender==='male'?5.50:5.0, warnMax:gender==='male'?6.0:5.5, category:'blood' },
        { id:'mcv', label:'MCV', unit:'fL', normalMin:85, normalMax:95, warnMax:110, category:'blood' },
        { id:'hemoglobin', label:'Hemoglobin', unit:'g/dL', normalMin:gender==='male'?13.0:12.0, normalMax:gender==='male'?18.0:16.0, warnMax:gender==='male'?20:17.5, category:'blood' },
        { id:'eosinophils', label:'Eosinophils', unit:'%', normalMin:0, normalMax:3, warnMax:7, category:'other' },
        { id:'pct', label:'PCT', unit:'%', normalMin:0.108, normalMax:0.282, warnMax:0.40, category:'other' },
        { id:'wbc', label:'WBC', unit:'K/µL', normalMin:4.0, normalMax:10.0, warnMax:15.0, category:'other' }
    ];

    let results = []; let filled = 0;
    tests.forEach(test => {
        const el = document.getElementById(`lab-${test.id}`);
        if (!el) return;
        const val = parseFloat(el.value);
        if (isNaN(val)) return;
        filled++;
        let status = 'normal', statusText = '✅ ' + t('normal');
        if (test.invertWarning) {
            if (val < test.normalMin * 0.7) { status = 'danger'; statusText = '🔴 Very Low'; }
            else if (val < test.normalMin) { status = 'warning'; statusText = '🟡 Low'; }
        } else {
            if (val < test.normalMin) { status = val < test.normalMin * 0.7 ? 'danger' : 'warning'; statusText = val < test.normalMin * 0.7 ? '🔴 Very Low' : '🟡 Low'; }
            else if (val > test.warnMax) { status = 'danger'; statusText = '🔴 High'; }
            else if (val > test.normalMax) { status = 'warning'; statusText = '🟡 Slightly Elevated'; }
        }
        results.push({ ...test, value: val, status, statusText, normalRange: `${test.normalMin} - ${test.normalMax === 999 ? '∞' : test.normalMax}` });
    });

    if (filled === 0) { showAlert('Please fill in at least one value.'); return; }

    const normalCount = results.filter(r => r.status === 'normal').length;
    const score = Math.round((normalCount / results.length) * 100);
    const scoreClass = score >= 80 ? 'good' : score >= 60 ? 'warning' : 'danger';

    let html = `<h3>🔬 Lab Results</h3>
        <div class="score-container"><div class="score-circle ${scoreClass}">${score}</div><div class="score-label">${t('healthScore')} (${normalCount}/${results.length} ${t('normal')})</div></div>`;

    const cats = { blood_sugar: { label: t('bloodSugar'), results: [] }, liver: { label: t('liverFunction'), results: [] }, cholesterol: { label: t('cholesterol'), results: [] }, kidney: { label: t('kidneyFunction'), results: [] }, blood: { label: t('redBlood'), results: [] }, other: { label: t('otherTests'), results: [] } };
    results.forEach(r => cats[r.category]?.results.push(r));
    Object.values(cats).forEach(cat => {
        if (cat.results.length === 0) return;
        html += `<h4>${cat.label}</h4>`;
        cat.results.forEach(r => {
            html += `<div class="lab-result-card ${r.status}"><div class="lab-test-name">${r.label}</div><div class="lab-test-value">Your: <strong>${r.value} ${r.unit}</strong> | Normal: ${r.normalRange} ${r.unit}</div><div class="lab-test-status">${r.statusText}</div></div>`;
        });
    });

    html += generateSuggestions(results, age, gender);
    html += `<div class="suggestion-disclaimer">⚠️ <strong>${t('importantDisclaimer')}:</strong> ${t('disclaimerFull')}</div>`;

    lastResults.lab = { results: results.map(r => ({ id: r.id, label: r.label, value: r.value, unit: r.unit, status: r.status, normalMin: r.normalMin, normalMax: r.normalMax, category: r.category })), score, summary: `Score: ${score}/100 | ${normalCount}/${results.length} normal` };

    const el = document.getElementById('lab-result');
    el.classList.remove('hidden');
    el.innerHTML = html;

    // Show save section
    const saveSection = document.createElement('div');
    saveSection.className = 'save-section';
    saveSection.innerHTML = `<button class="btn-save" onclick="saveResult('lab')">💾 ${t('saveResult')} (Track ${selectedTrack})</button>`;
    el.appendChild(saveSection);
}

function generateSuggestions(results, age) {
    let suggestions = [], foodSugg = [], exerciseSugg = [], lifeSugg = [];
    results.forEach(r => {
        if (r.status === 'normal') return;
        switch (r.id) {
            case 'fbs': case 'hba1c':
                if (r.value > r.normalMax) {
                    suggestions.push('Elevated blood sugar — possible pre-diabetes risk.');
                    foodSugg.push('Reduce refined carbs and sugar.', 'Eat fiber-rich foods: oats, legumes, greens.', 'Add cinnamon and bitter melon to diet.');
                    exerciseSugg.push('Walk 30 min after meals.', '150 min moderate exercise per week.');
                    lifeSugg.push('Monitor blood sugar regularly.', 'Keep consistent meal schedule.');
                } break;
            case 'sgpt': case 'sgot':
                if (r.value > r.normalMax) {
                    suggestions.push('Elevated liver enzymes — liver may be stressed.');
                    foodSugg.push('Avoid/reduce alcohol.', 'Limit fried and fatty foods.', 'Eat garlic, green tea, leafy greens.');
                    lifeSugg.push('Stay well hydrated.', 'Avoid unnecessary medications.');
                } break;
            case 'hdl':
                if (r.value < r.normalMin) {
                    suggestions.push('Low HDL (good cholesterol).');
                    foodSugg.push('Eat healthy fats: olive oil, avocado, nuts, fish.');
                    exerciseSugg.push('Aerobic exercise raises HDL (running, cycling, swimming).');
                    lifeSugg.push('Quit smoking if applicable.', 'Maintain healthy weight.');
                } break;
            case 'cholesterol': case 'ldl':
                if (r.value > r.normalMax) {
                    suggestions.push('High cholesterol — increased heart disease risk.');
                    foodSugg.push('Reduce saturated fats.', 'Eat soluble fiber: oats, beans, fruits.', 'Include nuts, seeds.');
                    exerciseSugg.push('30 min daily brisk walking/jogging.');
                } break;
            case 'triglycerides':
                if (r.value > r.normalMax) {
                    suggestions.push('Elevated triglycerides.');
                    foodSugg.push('Cut sugar, refined carbs, alcohol.', 'Eat fatty fish 2-3x/week.');
                } break;
            case 'creatinine': case 'urea':
                if (r.value > r.normalMax) {
                    suggestions.push('Elevated kidney markers.');
                    foodSugg.push('Limit salt to <2300mg/day.', 'Stay hydrated — 8+ glasses water.', 'Eat berries, cabbage, garlic.');
                    lifeSugg.push('Avoid NSAIDs.', 'Control blood pressure.');
                } break;
            case 'na':
                if (r.value > r.normalMax) { suggestions.push('High sodium — possible dehydration.'); foodSugg.push('Reduce salt intake.'); lifeSugg.push('Drink more water.'); }
                else if (r.value < r.normalMin) { suggestions.push('Low sodium.'); foodSugg.push('Ensure electrolyte intake.'); }
                break;
            case 'k':
                if (r.value > r.normalMax) { suggestions.push('High potassium — needs attention.'); foodSugg.push('Limit bananas, oranges, potatoes.'); lifeSugg.push('Seek medical advice.'); }
                else if (r.value < r.normalMin) { suggestions.push('Low potassium.'); foodSugg.push('Eat bananas, sweet potatoes, spinach.'); }
                break;
            case 'rbc': case 'hemoglobin':
                if (r.value < r.normalMin) {
                    suggestions.push('Low RBC/hemoglobin — possible anemia.');
                    foodSugg.push('Eat iron-rich foods: spinach, red meat, lentils.', 'Pair with vitamin C for absorption.');
                    lifeSugg.push('Avoid tea/coffee with meals.');
                } break;
            case 'mcv':
                if (r.value < r.normalMin) { suggestions.push('Low MCV — possible iron deficiency.'); foodSugg.push('Increase iron intake.'); }
                else if (r.value > r.normalMax) { suggestions.push('High MCV — possible B12/folate deficiency.'); foodSugg.push('Eat B12 foods: fish, meat, eggs.', 'Eat folate: leafy greens, beans.'); }
                break;
            case 'eosinophils':
                if (r.value > r.normalMax) { suggestions.push('Elevated eosinophils — allergies or inflammation.'); foodSugg.push('Anti-inflammatory: turmeric, ginger, omega-3.'); lifeSugg.push('Check for allergies with doctor.'); }
                break;
            case 'pct':
                if (r.value < r.normalMin) { suggestions.push('Low plateletcrit.'); foodSugg.push('Eat papaya, leafy greens, vitamin K foods.'); }
                break;
            case 'wbc':
                if (r.value > r.normalMax) { suggestions.push('Elevated WBC — possible infection.'); foodSugg.push('Boost immunity: vitamin C, garlic, zinc.'); lifeSugg.push('Get rest, manage stress.'); }
                else if (r.value < r.normalMin) { suggestions.push('Low WBC — weakened immunity.'); foodSugg.push('Eat nutrient-dense foods.'); }
                break;
        }
    });

    suggestions = [...new Set(suggestions)]; foodSugg = [...new Set(foodSugg)]; exerciseSugg = [...new Set(exerciseSugg)]; lifeSugg = [...new Set(lifeSugg)];

    if (suggestions.length === 0) {
        return `<div class="suggestion-box" style="border-left-color:var(--success);background:var(--success-light);"><h4 style="color:var(--success)">🎉 Great Results!</h4><p style="font-size:0.8rem">All values normal. Keep it up!</p><ul><li>Continue balanced nutrition.</li><li>150 min exercise/week.</li><li>Stay hydrated, sleep 7-8 hours.</li></ul></div>`;
    }

    let html = `<div class="suggestion-box"><h4>⚠️ ${t('keyFindings')}</h4><ul>${suggestions.map(s=>`<li>${s}</li>`).join('')}</ul></div>`;
    if (foodSugg.length) html += `<div class="suggestion-box" style="border-left-color:var(--success);background:var(--success-light);"><h4 style="color:var(--success)">🥗 ${t('foodDietRec')}</h4><ul>${foodSugg.map(s=>`<li>${s}</li>`).join('')}</ul></div>`;
    if (exerciseSugg.length) html += `<div class="suggestion-box" style="border-left-color:#8B5CF6;background:#EDE9FE;"><h4 style="color:#7C3AED">🏃 ${t('exerciseRec')}</h4><ul>${exerciseSugg.map(s=>`<li>${s}</li>`).join('')}</ul></div>`;
    if (lifeSugg.length) html += `<div class="suggestion-box" style="border-left-color:#EC4899;background:#FCE7F3;"><h4 style="color:#DB2777">🌟 ${t('lifestyleRec')}</h4><ul>${lifeSugg.map(s=>`<li>${s}</li>`).join('')}</ul></div>`;
    html += `<div class="suggestion-box" style="border-left-color:var(--gray-400);background:var(--gray-100);"><h4 style="color:var(--gray-600)">📋 ${t('generalTips')}</h4><ul><li>Drink 2-3L water daily.</li><li>Sleep 7-8 hours.</li><li>Practice stress management.</li><li>Limit alcohol, avoid smoking.</li>${age > 40 ? '<li>Annual health check-ups.</li>' : ''}</ul></div>`;
    return html;
}

// ==========================================
// BMI CALCULATOR
// ==========================================
function calculateBMI() {
    const weight = parseFloat(document.getElementById('bmi-weight').value);
    const height = parseFloat(document.getElementById('bmi-height').value);
    const age = parseInt(document.getElementById('bmi-age').value);
    const gender = document.getElementById('bmi-gender').value;
    const activity = document.getElementById('bmi-activity').value;
    if (!weight || !height || !age) { showAlert('Please fill in all fields.'); return; }

    const hm = height / 100;
    const bmi = Math.round((weight / (hm * hm)) * 10) / 10;
    let cat = '', catClass = '';
    if (bmi < 18.5) { cat = t('underweight'); catClass = 'info'; }
    else if (bmi < 25) { cat = t('normalWeight'); catClass = 'good'; }
    else if (bmi < 30) { cat = t('overweight'); catClass = 'warning'; }
    else { cat = t('obese'); catClass = 'danger'; }

    let bmr = gender === 'male' ? 10 * weight + 6.25 * height - 5 * age + 5 : 10 * weight + 6.25 * height - 5 * age - 161;
    const mults = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, extra: 1.9 };
    const tdee = Math.round(bmr * mults[activity]);
    const idealLow = Math.round(18.5 * hm * hm), idealHigh = Math.round(24.9 * hm * hm);
    const gaugePos = Math.min(Math.max((bmi - 15) / 30 * 100, 2), 98);

    let tips = [];
    if (bmi < 18.5) { tips.push('Eat calorie-dense, nutrient-rich foods.', 'Include healthy fats and proteins.', 'Strength training builds muscle.'); }
    else if (bmi >= 25) { tips.push(`Eat ~${tdee - 500} kcal/day for 0.5 kg/week loss.`, 'Focus on whole foods and vegetables.', 'Combine cardio and strength training.'); }
    else { tips.push('Great job maintaining healthy weight!', 'Continue balanced eating and exercise.'); }

    lastResults.bmi = { bmi, bmr: Math.round(bmr), tdee, category: cat, summary: `BMI: ${bmi} (${cat}) | TDEE: ${tdee} kcal` };

    const el = document.getElementById('bmi-result');
    el.classList.remove('hidden');
    document.getElementById('bmi-save').classList.remove('hidden');
    el.innerHTML = `
        <h3>⚖️ ${t('bmiAnalysis')}</h3>
        <div class="score-container"><div class="score-circle ${catClass}">${bmi}</div><div class="score-label">${cat}</div></div>
        <div class="bmi-gauge"><div class="bmi-marker" style="left:${gaugePos}%"></div></div>
        <div class="bmi-labels"><span>${t('underweight')}</span><span>${t('normalWeight')}</span><span>${t('overweight')}</span><span>${t('obese')}</span></div>
        <div class="result-item"><span class="result-label">${t('bmr')}</span><span class="result-value">${Math.round(bmr)} kcal</span></div>
        <div class="result-item"><span class="result-label">${t('tdee')}</span><span class="result-value info">${tdee} kcal</span></div>
        <div class="result-item"><span class="result-label">${t('idealWeight')}</span><span class="result-value good">${idealLow} - ${idealHigh} kg</span></div>
        <h4>📊 ${t('macroRec')}</h4>
        <div class="result-item"><span class="result-label">${t('protein')} (30%)</span><span class="result-value">${Math.round(tdee * 0.3 / 4)} g</span></div>
        <div class="result-item"><span class="result-label">${t('carbs')} (40%)</span><span class="result-value">${Math.round(tdee * 0.4 / 4)} g</span></div>
        <div class="result-item"><span class="result-label">${t('fat')} (30%)</span><span class="result-value">${Math.round(tdee * 0.3 / 9)} g</span></div>
        <div class="suggestion-box"><h4>💡 ${t('recommendations')}</h4><ul>${tips.map(tp=>`<li>${tp}</li>`).join('')}</ul></div>
    `;
}

// ==========================================
// WATER TRACKER
// ==========================================
function calculateWater() {
    const weight = parseFloat(document.getElementById('water-weight').value);
    const activity = document.getElementById('water-activity').value;
    const climate = document.getElementById('water-climate').value;
    if (!weight) { showAlert('Please enter weight.'); return; }

    let base = weight * 35;
    if (activity === 'moderate') base *= 1.15;
    if (activity === 'active') base *= 1.3;
    if (climate === 'hot') base *= 1.2;
    if (climate === 'cold') base *= 0.95;
    waterGoal = Math.round(base); waterIntake = 0;

    const el = document.getElementById('water-goal');
    el.classList.remove('hidden');
    el.innerHTML = `<h3>💧 ${t('waterGoal')}</h3>
        <div class="result-item"><span class="result-label">${t('recIntake')}</span><span class="result-value info">${waterGoal} mL (${(waterGoal/1000).toFixed(1)}L)</span></div>
        <div class="result-item"><span class="result-label">${t('glasses')}</span><span class="result-value">${Math.round(waterGoal/250)}</span></div>`;
    document.getElementById('water-tracker').classList.remove('hidden');
    updateWaterDisplay();
}

function addWater(amt) { waterIntake = Math.min(waterIntake + amt, waterGoal * 2); updateWaterDisplay(); }
function resetWater() { waterIntake = 0; updateWaterDisplay(); }
function updateWaterDisplay() {
    const pct = Math.min((waterIntake / waterGoal) * 100, 100);
    document.getElementById('water-bar').style.height = pct + '%';
    document.getElementById('water-progress-text').textContent = pct >= 100 ? '🎉' : Math.round(pct) + '%';
    document.getElementById('water-intake-display').textContent = `${waterIntake} mL / ${waterGoal} mL`;
}

// ==========================================
// SLEEP CALCULATOR
// ==========================================
function analyzeSleep() {
    const bedtime = document.getElementById('sleep-bedtime').value;
    const wake = document.getElementById('sleep-wake').value;
    const quality = document.getElementById('sleep-quality').value;
    const age = parseInt(document.getElementById('sleep-age').value) || 30;
    if (!bedtime || !wake) { showAlert('Please fill in times.'); return; }

    const [bH, bM] = bedtime.split(':').map(Number);
    const [wH, wM] = wake.split(':').map(Number);
    let bedMin = bH * 60 + bM, wakeMin = wH * 60 + wM;
    if (wakeMin <= bedMin) wakeMin += 1440;
    const totalMin = wakeMin - bedMin;
    const hours = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    const cycles = Math.floor(totalMin / 90);

    let recMin, recMax;
    if (age < 6) { recMin = 9; recMax = 12; }
    else if (age < 13) { recMin = 9; recMax = 11; }
    else if (age < 18) { recMin = 8; recMax = 10; }
    else if (age < 65) { recMin = 7; recMax = 9; }
    else { recMin = 7; recMax = 8; }

    let rating = '', ratingClass = '';
    const sleepH = totalMin / 60;
    const qualityMod = { great: 1, ok: 0.85, tired: 0.65, bad: 0.45 };
    const scoreRaw = Math.min(100, Math.round(
        (sleepH >= recMin && sleepH <= recMax ? 70 : sleepH >= recMin - 1 ? 50 : 30)
        + (cycles >= 4 && cycles <= 6 ? 20 : 10)
        + 10
    ) * (qualityMod[quality] || 0.7));
    const score = Math.round(scoreRaw);

    if (score >= 80) { rating = 'Excellent'; ratingClass = 'good'; }
    else if (score >= 60) { rating = 'Good'; ratingClass = 'info'; }
    else if (score >= 40) { rating = 'Fair'; ratingClass = 'warning'; }
    else { rating = 'Poor'; ratingClass = 'danger'; }

    let tips = [];
    if (sleepH < recMin) tips.push(`You need ${recMin}-${recMax} hours. Try going to bed earlier.`);
    if (sleepH > recMax) tips.push('Oversleeping can cause grogginess. Aim for consistent hours.');
    if (quality === 'tired' || quality === 'bad') {
        tips.push('Avoid screens 1 hour before bed.');
        tips.push('Keep bedroom cool (18-22°C) and dark.');
        tips.push('Avoid caffeine after 2 PM.');
    }
    tips.push('Maintain a consistent sleep schedule, even on weekends.');
    tips.push('Practice relaxation: deep breathing, meditation, or reading.');
    if (cycles < 4) tips.push('Aim for 4-6 complete sleep cycles (6-9 hours).');

    // Optimal wake times
    const optimalTimes = [];
    for (let c = 4; c <= 6; c++) {
        const optMin = bedMin + c * 90 + 15;
        const h = Math.floor((optMin % 1440) / 60);
        const m = optMin % 60;
        optimalTimes.push(`${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`);
    }

    lastResults.sleep = { hours: `${hours}h ${mins}m`, cycles, score, rating, summary: `${hours}h ${mins}m | ${cycles} cycles | ${rating} (${score}/100)` };

    const el = document.getElementById('sleep-result');
    el.classList.remove('hidden');
    document.getElementById('sleep-save').classList.remove('hidden');
    el.innerHTML = `
        <h3>😴 ${t('sleepAnalysis')}</h3>
        <div class="score-container"><div class="score-circle ${ratingClass}">${score}</div><div class="score-label">${rating}</div></div>
        <div class="result-item"><span class="result-label">${t('sleepDuration')}</span><span class="result-value">${hours}h ${mins}m</span></div>
        <div class="result-item"><span class="result-label">${t('sleepCycles')}</span><span class="result-value info">${cycles} cycles</span></div>
        <div class="result-item"><span class="result-label">Recommended</span><span class="result-value good">${recMin}-${recMax} hours</span></div>
        <h4>⏰ Optimal Wake Times</h4>
        <p style="font-size:0.8rem;color:var(--gray-600);">${optimalTimes.join(' | ')}</p>
        <div class="suggestion-box"><h4>💡 ${t('sleepTips')}</h4><ul>${tips.map(tp=>`<li>${tp}</li>`).join('')}</ul></div>
    `;
}

// ==========================================
// UTILITY
// ==========================================
function showAlert(msg) {
    if (tg && tg.showAlert) tg.showAlert(msg);
    else alert(msg);
}
