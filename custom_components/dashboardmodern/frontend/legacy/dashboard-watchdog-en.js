/* Extracted from dashboard-en.html; feature changes belong in src/sections. */
(() => {
    const message = "Errore durante il caricamento di DashboardModern. Controlla la console.";
    const fail = () => {
        if (window.__DASHBOARDMODERN_READY__) return;
        const overlay = document.getElementById('cd-boot-overlay');
        if (!overlay) return;
        overlay.dataset.state = 'error';
        overlay.innerHTML = '<div role="alert" style="max-width:34rem;padding:24px;text-align:center;font:700 16px/1.5 sans-serif;color:#dc2626">' + message + '</div>';
    };
    window.addEventListener('error', fail);
    window.__DASHBOARDMODERN_BOOT_TIMEOUT__ = window.setTimeout(fail, 10000);
})();
