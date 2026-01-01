const COUNTRY_API = 'https://restcountries.com/v3.1/all?fields=name,flag,flags,timezones';
const WINDOW_MINUTES = 60; // 1 hour

let countryCache = null;

function parseTimezoneOffset(tz) {
    if (tz === 'UTC') return 0;
    const match = tz.match(/^UTC([+-])(\d{2}):?(\d{2})?$/);
    if (!match) return null;
    const sign = match[1] === '-' ? -1 : 1;
    const hours = Number(match[2]);
    const minutes = Number(match[3] || '0');
    return sign * (hours * 60 + minutes);
}

function toLocalTime(utcNow, offsetMinutes) {
    return new Date(utcNow.getTime() + offsetMinutes * 60000);
}

function formatTime(date) {
    const h = date.getUTCHours().toString().padStart(2, '0');
    const m = date.getUTCMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
}

function categorizeCountries(utcNow) {
    if (!countryCache) return { pastHour: [], nextHour: [] };

    const pastHour = [];
    const nextHour = [];

    countryCache.forEach(country => {
        const timezone = country.timezones.find(tz => parseTimezoneOffset(tz) !== null);
        if (!timezone) return;

        const offsetMinutes = parseTimezoneOffset(timezone);
        const localTime = toLocalTime(utcNow, offsetMinutes);
        const minutes = localTime.getUTCHours() * 60 + localTime.getUTCMinutes();

        if (minutes < WINDOW_MINUTES) {
            pastHour.push({ country: country.name.common, flag: country.flag || '🏳️', time: formatTime(localTime) });
        } else if (minutes >= (24 * 60 - WINDOW_MINUTES)) {
            nextHour.push({ country: country.name.common, flag: country.flag || '🏳️', time: formatTime(localTime) });
        }
    });

    const sortByName = (a, b) => a.country.localeCompare(b.country);
    return {
        pastHour: pastHour.sort(sortByName),
        nextHour: nextHour.sort(sortByName)
    };
}

function renderGroup(title, items) {
    if (items.length === 0) {
        return `
            <div class="group">
                <div class="group-title">${title}</div>
                <div class="no-results">Aucun pays dans cette fenêtre</div>
            </div>
        `;
    }

    const featured = items[0];
    const others = items.slice(1);

    return `
        <div class="group">
            <div class="group-title">${title}</div>
            <div class="featured-country">
                <div class="flag">${featured.flag}</div>
                <div class="country-name">${featured.country}</div>
                <div class="time">${featured.time}</div>
            </div>
            ${others.length ? `<div class="other-list">${others.map(c => `${c.flag} ${c.country} (${c.time})`).join(' · ')}</div>` : ''}
        </div>
    `;
}

async function loadCountries() {
    const contentDiv = document.getElementById('content');
    contentDiv.textContent = 'Loading countries...';
    try {
        const response = await fetch(COUNTRY_API);
        if (!response.ok) throw new Error('Failed to fetch countries');
        const data = await response.json();
        countryCache = data.filter(item => Array.isArray(item.timezones));
        updateView();
    } catch (error) {
        contentDiv.innerHTML = `<div class="no-results">Could not load country data (${error.message}).</div>`;
    }
}

function updateView() {
    const utcNow = new Date();
    const { pastHour, nextHour } = categorizeCountries(utcNow);

    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = `
        ${renderGroup('Passé depuis moins d\'une heure', pastHour)}
        ${renderGroup('Dans moins d\'une heure', nextHour)}
    `;
}

loadCountries();
setInterval(updateView, 1000);
