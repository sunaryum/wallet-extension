const urlParams = new URLSearchParams(window.location.search);
const origin = urlParams.get('origin');

document.getElementById('confirmConnect').addEventListener('click', async () => {
  try {
    // Recupera dados da carteira de forma robusta
    const walletData = await getWalletData();
    
    if (!walletData || !walletData.address) {
      throw new Error("Dados da carteira inválidos");
    }

    console.log("Dados da carteira recuperados:", walletData);
    
    // Envia dados para o background script
    browser.runtime.sendMessage({
      action: "walletConnected",
      data: {
        address: walletData.address,
        publicKey: walletData.publicKey || ""
      }
    });
    
    window.close();
  } catch (error) {
    console.error('Connection error:', error);
    alert('Erro ao conectar: ' + error.message);
    
    // Redireciona para a tela de importação
    window.location.href = browser.runtime.getURL('popup/import.html');
  }
});

async function getWalletData() {
  // Tenta várias fontes de dados sequencialmente
  const sources = [
    () => browser.storage.local.get('walletData'),
    () => browser.storage.local.get('wallet'),
    () => browser.storage.local.get('account'),
    () => {
      const data = localStorage.getItem('walletData');
      return data ? { walletData: JSON.parse(data) } : null;
    }
  ];

  for (const source of sources) {
    try {
      const result = await source();
      
      if (result.walletData && result.walletData.address) {
        return result.walletData;
      }
      if (result.wallet && result.wallet.address) {
        return result.wallet;
      }
      if (result.account && result.account.address) {
        return result.account;
      }
    } catch (e) {
      console.warn("Falha ao tentar fonte de dados:", e);
    }
  }

  throw new Error("Dados da carteira não encontrados em nenhuma fonte");
}