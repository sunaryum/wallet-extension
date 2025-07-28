// init.js
// Checagem centralizada de autenticação em páginas públicas/privadas

import { isAuthenticated } from './auth.js';

// Redireciona para login se não autenticado
export function redirectToLogin() {
    try {
        localStorage.removeItem('walletData');
    } catch {}
    if (
        !window.location.pathname.endsWith('import.html') &&
        !window.location.pathname.endsWith('main.html')
    ) {
        window.location.href = 'main.html';
    }
}

// Redireciona para dashboard se já autenticado e estiver em página pública
export function redirectToDashboardIfLogged() {
    if (isAuthenticated()) {
        if (
            window.location.pathname.endsWith('main.html') ||
            window.location.pathname.endsWith('import.html')
        ) {
            window.location.href = 'dashboard.html';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    const isAuth = isAuthenticated();
    // Páginas públicas: main.html ou import.html
    if (path.endsWith('main.html') || path.endsWith('import.html')) {
        redirectToDashboardIfLogged();
    } else {
        // Páginas protegidas: dashboard.html e demais internas
        if (!isAuth) {
            redirectToLogin();
        }
    }
});
