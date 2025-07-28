// auth.js
// Responsável por gerenciar autenticação via localStorage

export function isAuthenticated() {
    try {
        const data = localStorage.getItem('walletData');
        return !!data && !!JSON.parse(data)?.address;
    } catch {
        return false;
    }
}

export function getWalletData() {
    try {
        if (isAuthenticated()) {
            return JSON.parse(localStorage.getItem('walletData'));
        }
    } catch {
        return null;
    }
    return null;
}

export function setWalletData(data) {
    // Use ao conectar: data deve conter pelo menos { address, balance, conversionRate, username?, coins? }
    try {
        localStorage.setItem('walletData', JSON.stringify(data));
    } catch (e) {
        console.error('[auth] Falha ao setar walletData:', e);
    }
}

export function logout() {
    try {
        localStorage.removeItem('walletData');
    } catch {}
    // Redireciona para main.html
    window.location.href = 'main.html';
}
