// Corrigir o handler para a ação "walletConnected"
browser.runtime.onMessage.addListener((request, sender) => {
  if (request.action === "openConnectWindow") {
    const origin = sender.origin || sender.url;
    console.log("[Background] Abrindo janela de conexão para:", origin);
    
    browser.windows.create({
      url: browser.runtime.getURL(`popup/connect.html?origin=${encodeURIComponent(origin)}`),
      type: "popup",
      width: 400,
      height: 600
    }).then(window => {
      browser.storage.local.set({[`windowOrigin_${window.id}`]: origin});
    });
  }
  
  if (request.action === "walletConnected") {
    console.log("[Background] Recebidos dados da carteira:", request.data);
    
    browser.storage.local.get([`windowOrigin_${sender.tab.windowId}`]).then(result => {
      const origin = result[`windowOrigin_${sender.tab.windowId}`];
      
      if (!origin) {
        console.error("Origin not found for window:", sender.tab.windowId);
        return;
      }

      // CORREÇÃO: Enviar os dados corretos para o content script
      browser.tabs.query({}).then(tabs => {
        tabs.forEach(tab => {
          try {
            const tabOrigin = new URL(tab.url).origin;
            if (tabOrigin === origin) {
              browser.tabs.sendMessage(tab.id, {
                action: "walletDataUpdate",
                data: {
                  address: request.data.address,
                  publicKey: request.data.publicKey
                }
              }).catch(err => console.debug("Tab não ouvindo:", tab.url));
            }
          } catch(e) {
            console.debug("URL inválida:", tab.url);
          }
        });
      });
    });
  }
});