(() => {
  window.sunaryumWallet = {
    isInstalled: () => true,
    connect: () => {
      return new Promise((resolve, reject) => {
        function handleResponse(event) {
          if (event.source !== window) return;
          if (event.data.type === 'SUNARYUM_CONNECT_RESPONSE') {
            window.removeEventListener('message', handleResponse);
            if (event.data.error) {
              reject(new Error(event.data.error));
            } else {
              resolve({
                publicKey: event.data.publicKey,
                address: event.data.address
              });
            }
          }
        }

        window.addEventListener('message', handleResponse);
        console.log('[inpage.js] Enviando SUNARYUM_CONNECT_REQUEST');
        window.postMessage({ type: 'SUNARYUM_CONNECT_REQUEST' }, '*');
      });
    }
  };
})();

console.log("[Sunaryum] Script injetado com sucesso!");

// Handler para pedidos de detecção
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  
  if (event.data.type === 'EXTENSION_DETECTION_REQUEST') {
    console.log("[Sunaryum] Recebido pedido de detecção, respondendo...");
    window.postMessage({
      type: 'EXTENSION_DETECTION_RESPONSE',
      installed: true
    }, event.origin);
  }
  
  // Novo handler para pedidos de conexão
  if (event.data.type === 'OPEN_WALLET_CONNECT') {
    console.log("[Sunaryum] Recebido pedido de conexão da página");
    browser.runtime.sendMessage({ 
      action: "openConnectWindow",
      origin: event.origin
    });
  }
});

// Handler para dados da carteira do background script
browser.runtime.onMessage.addListener((msg) => {
  if (msg.action === "walletDataUpdate") {
    console.log("[Sunaryum] Enviando dados para a página:", msg.data);
    
    // CORREÇÃO CRÍTICA: Enviar os dados corretamente
    window.postMessage({
      type: 'WALLET_CONNECTED',
      data: {
        address: msg.data.address,
        publicKey: msg.data.publicKey
      }
    }, window.location.origin);
  }
});