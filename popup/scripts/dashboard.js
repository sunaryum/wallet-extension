import { getWalletData, logout } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Verifica autenticação
  const walletData = getWalletData();
  if (!walletData) {
    logout();
    return;
  }
  const walletAddress = walletData.address;

  // Verifica Supabase
  if (!window.supabaseClient) {
    console.error('Supabase client not initialized');
    const transactionListFallback = document.getElementById('transactionList');
    if (transactionListFallback) {
      transactionListFallback.innerHTML = `
        <div class="empty-state error">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Erro ao conectar ao banco de dados.</p>
        </div>`;
    }
  }
  const supabase = window.supabaseClient;

  // Elementos da UI
  const walletAddressEl = document.getElementById('walletAddress');
  const copyAddressBtn = document.getElementById('copyAddressBtn');
  const balanceAmountEl = document.getElementById('balanceAmount');
  const balanceFiatEl = document.getElementById('balanceFiat');
  const logoutBtn = document.getElementById('logoutBtn');
  const viewAllBtn = document.getElementById('viewAllBtn');
  const navItems = document.querySelectorAll('.nav-item');
  const transactionList = document.getElementById('transactionList');
  const transferBtn = document.getElementById('transferBtn');
  const transferModal = document.getElementById('transferModal');
  const closeModal = document.querySelector('.close');
  const submitTransfer = document.getElementById('submitTransfer');
  const recipientAddressInput = document.getElementById('recipientAddress');
  const transferAmountInput = document.getElementById('transferAmount');
  const transferStatus = document.getElementById('transferStatus');

  // Função para buscar saldo atualizado
  async function fetchUserBalance() {
    if (!supabase) return null;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('sun_balance')
        .eq('wallet_address', walletAddress)
        .single();

      if (error) throw error;
      return data.sun_balance;
    } catch (err) {
      console.error('Erro ao buscar saldo:', err);
      return null;
    }
  }

  // Atualiza o saldo na UI e no localStorage
  async function updateBalanceDisplay() {
    const newBalance = await fetchUserBalance();
    
    if (newBalance !== null) {
      // Atualiza localStorage
      const walletData = getWalletData();
      walletData.balance = newBalance;
      localStorage.setItem('walletData', JSON.stringify(walletData));
      
      // Atualiza UI
      if (balanceAmountEl) {
        balanceAmountEl.textContent = Number(newBalance).toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
      }
      
      if (balanceFiatEl) {
        const rate = Number(walletData.conversionRate || 10);
        const converted = newBalance * rate;
        balanceFiatEl.textContent = `≈ ${converted.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })} KWh`;
      }
    }
  }

 async function transferSUN(recipient, amount) {
  if (!supabase) throw new Error('Supabase client not initialized');
  
  try {
    // Busca saldo ATUAL do destinatário
    const { data: recipientData, error: recipientError } = await supabase
      .from('users')
      .select('sun_balance')
      .eq('wallet_address', recipient)
      .single();

    if (recipientError || !recipientData) throw new Error('Recipient not found');

    // Verifica saldo suficiente
    const walletData = getWalletData();
    if (amount > walletData.balance) throw new Error('Insufficient balance');

    // Atualiza saldo do REMETENTE
    const newSenderBalance = walletData.balance - amount;
    const { error: senderError } = await supabase
      .from('users')
      .update({ sun_balance: newSenderBalance })
      .eq('wallet_address', walletAddress);

    if (senderError) throw senderError;

    // Atualiza saldo do DESTINATÁRIO
    const currentRecipientBalance = recipientData.sun_balance || 0;
    const newRecipientBalance = currentRecipientBalance + amount;
    const { error: recipientUpdateError } = await supabase
      .from('users')
      .update({ sun_balance: newRecipientBalance })
      .eq('wallet_address', recipient);

    if (recipientUpdateError) throw recipientUpdateError;

    // CORREÇÃO: Usar valores em MAIÚSCULAS para 'type'
    const transactionDataSent = {
      wallet_address: walletAddress,
      type: 'SENT', 
      status: 'completed',
      amount: amount,
      currency: 'SUN',
      description: `Transfer to ${shortenAddress(recipient)}`
    };

    const transactionDataReceived = {
      wallet_address: recipient,
      type: 'RECEIVED',
      status: 'completed',
      amount: amount,
      currency: 'SUN',
      description: `Transfer from ${shortenAddress(walletAddress)}`
    };

    // Insere AMBAS as transações
    const { error: txError } = await supabase
      .from('transactions')
      .insert([transactionDataSent, transactionDataReceived]);

    if (txError) throw txError;

    // Atualiza localStorage do remetente
    walletData.balance = newSenderBalance;
    localStorage.setItem('walletData', JSON.stringify(walletData));

    return true;
  } catch (err) {
    console.error('Transfer error:', err);
    
    // Tenta reverter em caso de erro
    try {
      await supabase
        .from('users')
        .update({ sun_balance: walletData.balance })
        .eq('wallet_address', walletAddress);
    } catch (revertErr) {
      console.error('Balance revert failed:', revertErr);
    }

    throw err;
  }
}

  // Event Listeners
  if (transferBtn) {
    transferBtn.addEventListener('click', async () => {
      // Atualiza saldo antes de abrir o modal
      await updateBalanceDisplay();
      transferModal.style.display = 'block';
    });
  }

  if (closeModal) {
    closeModal.addEventListener('click', () => {
      transferModal.style.display = 'none';
      transferStatus.textContent = '';
    });
  }

  if (submitTransfer) {
    submitTransfer.addEventListener('click', async () => {
      const recipient = recipientAddressInput.value.trim();
      const amount = parseFloat(transferAmountInput.value);

      if (!recipient || recipient.length < 20) {
        transferStatus.textContent = 'Invalid address';
        transferStatus.style.color = 'var(--error)';
        return;
      }

      if (isNaN(amount) || amount <= 0) {
        transferStatus.textContent = 'Invalid quantity';
        transferStatus.style.color = 'var(--error)';
        return;
      }

      try {
        const success = await transferSUN(recipient, amount);
        
        if (success) {
          transferStatus.textContent = 'Transfer completed successfully!';
          transferStatus.style.color = 'var(--success)';
          
          // Atualiza UI
          await updateBalanceDisplay();
          await loadLastTransactions();
          
          // Limpa campos e fecha modal após 3 segundos
          setTimeout(() => {
            recipientAddressInput.value = '';
            transferAmountInput.value = '';
            transferStatus.textContent = '';
            transferModal.style.display = 'none';
          }, 3000);
        }
      } catch (err) {
        transferStatus.textContent = `Erro: ${err.message}`;
        transferStatus.style.color = 'var(--error)';
      }
    });
  }

  // Função utilitária para encurtar endereço
  function shortenAddress(addr, chars = 4) {
    if (!addr || typeof addr !== 'string') return '—';
    const clean = addr.startsWith('0x') ? addr.substring(2) : addr;
    if (clean.length <= chars * 2) return clean;
    return `${clean.slice(0, chars)}...${clean.slice(-chars)}`;
  }

  // Função para formatar data/hora em pt-BR
  function formatDateTime(dateString) {
    if (!dateString) return '—';
    const d = new Date(dateString);
    return d.toLocaleString('pt-BR');
  }

  // Mensagem caso não haja transações
  function showNoTransactionsMessage() {
    if (!transactionList) return;
    transactionList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exchange-alt"></i>
        <p>Não há transações</p>
      </div>`;
  }

  // Mensagem de erro ao carregar transações
  function showErrorMessage(msg) {
    if (!transactionList) return;
    transactionList.innerHTML = `
      <div class="empty-state error">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Erro ao carregar transações</p>
        <small>${msg}</small>
      </div>`;
  }

  // Renderiza até 3 últimas transações
  // Função para renderizar as últimas transações (CORRIGIDA)
function renderLastTransactions(transactions) {
  if (!transactionList) return;
  transactionList.innerHTML = '';
  
  transactions.forEach(tx => {
    // Normaliza o tipo para minúsculas e verifica se é envio
    const isSent = tx.type.toLowerCase() === 'sent';
    
    // Formatações
    const dateFmt = tx.created_at ? formatDateTime(tx.created_at) : '—';
    const amountNum = parseFloat(tx.amount) || 0;
    const amountFmt = (isSent ? '-' : '+') + amountNum.toFixed(4); // CORREÇÃO DO SINAL
    const iconDir = isSent ? 'up' : 'down';
    const label = isSent ? 'Sent' : 'Received'; // CORREÇÃO DO LABEL
    const statusText = tx.status === 'pending' ? 'Pending' : 'Confirmed';
    const statusClass = tx.status === 'pending' ? 'pending' : 'confirmed';

    const itemHTML = `
      <div class="transaction-item ${tx.type}">
        <div class="transaction-icon">
          <i class="fas fa-arrow-${iconDir}"></i>
        </div>
        <div class="transaction-details">
          <div class="transaction-meta">
            <span class="transaction-type">${label}</span>
            <span class="transaction-date">${dateFmt}</span>
          </div>
          <div class="transaction-info">
            <span class="transaction-amount">${amountFmt} ${tx.currency || 'SUN'}</span>
            <span class="transaction-status ${statusClass}">${statusText}</span>
          </div>
        </div>
      </div>`;
    transactionList.insertAdjacentHTML('beforeend', itemHTML);
  });
}

  // Busca as últimas 3 transações do endereço
  async function loadLastTransactions() {
    if (!supabase) return;
    
    try {
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;

      if (!transactions || transactions.length === 0) {
        showNoTransactionsMessage();
      } else {
        renderLastTransactions(transactions);
      }
    } catch (err) {
      console.error('Erro loadLastTransactions:', err);
      showErrorMessage(err.message || 'Erro desconhecido');
    }
  }

  // Atualiza UI com dados iniciais
  if (walletAddressEl) {
    walletAddressEl.textContent = shortenAddress(walletAddress);
  }

  // Atualiza o saldo ao carregar a página
  await updateBalanceDisplay();
  
  // Eventos de UI
  if (copyAddressBtn) {
    copyAddressBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(walletAddress)
        .then(() => {
          const originalHtml = copyAddressBtn.innerHTML;
          copyAddressBtn.innerHTML = '<i class="fas fa-check"></i>';
          setTimeout(() => {
            copyAddressBtn.innerHTML = originalHtml;
          }, 2000);
        })
        .catch(err => {
          console.error('Falha ao copiar endereço:', err);
          alert('Falha ao copiar endereço. Tente novamente.');
        });
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to exit?')) {
        logout();
      }
    });
  }

  if (viewAllBtn) {
    viewAllBtn.addEventListener('click', () => {
      window.location.href = 'transactions.html';
    });
  }

  navItems.forEach(item => {
    item.addEventListener('click', function () {
      const page = this.getAttribute('data-page');
      if (page && page !== 'dashboard') {
        window.location.href = `${page}.html`;
      }
    });
  });

  // Carrega últimas 3 transações ao iniciar
  await loadLastTransactions();

  // Atualiza saldo periodicamente (a cada 30 segundos)
  setInterval(async () => {
    await updateBalanceDisplay();
  }, 30000);
});