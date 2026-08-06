/* Extracted from dashboard.html; feature changes belong in src/sections. */
function toggleDebug() {
    const panel = document.getElementById('debug-panel');
    if (!panel) return;
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        updateDebug();
    } else {
        panel.style.display = 'none';
    }
}

function updateDebug() {
    const panel = document.getElementById('debug-content');
    if (!panel) return;
    const sensors = [
        ['dm.server_uptime_minipc',                   'Uptime (Glances)'],
        ['dm.server_uptime_home_assistant',                          'Uptime (system_monitor)'],
        ['dm.server_cpu',                'CPU %'],
        ['dm.server_ram',               'RAM MB'],
        ['dm.server_disco',               'Disco %'],
        ['dm.server_temperatura_cpu', 'Temp CPU'],
        ['dm.server_potenza_raspberry_server',         'Potenza W'],
        ['dm.server_stato_internet',                 'Internet (nome)'],
        ['dm.server_raggiungibilita_google',               'Internet (google_com)'],
        ['dm.server_internet_lavanderia',      'Internet (lavanderia)'],
        ['dm.server_ping_internet',            'Internet (ping)'],
        ['dm.energy_stato_rete',  'Inverter'],
        ['dm.server_speedtest_download',               'Download'],
        ['dm.server_speedtest_upload',                'Upload'],
        ['dm.ev_batteria_auto',               'Batteria EV'],
        ['dm.ev_stato_ricarica',         'EVCC stato'],
        ['dm.ev_autonomia',                 'Autonomia'],
        ['dm.ev_potenza_wallbox',             'Potenza WB'],
    ];
    let html = '';
    sensors.forEach(([eid, label]) => {
        const s = STATES[eid];
        if (!s) {
            html += `<div style="color:#ef4444">❌ ${label}: <span style="color:#f87171">${eid}</span> — NON TROVATO</div>`;
        } else {
            const ago = Math.round((Date.now() - new Date(s.last_updated).getTime()) / 60000);
            const col = ago > 60 ? '#f59e0b' : '#34d399';
            html += `<div style="color:${col}">✅ ${label}: <strong>${s.state}</strong> <span style="color:#94a3b8;font-size:10px;">(${ago}min fa · ${eid})</span></div>`;
        }
    });
    panel.innerHTML = html;
}
