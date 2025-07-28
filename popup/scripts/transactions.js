document.addEventListener('DOMContentLoaded', async () => {
  // Verificação inicial do Supabase
  if (!window.supabaseClient) {
    console.error('Supabase client not initialized');
    document.getElementById('error-message').textContent = 'Failed to initialize database connection';
    return;
  }
  const supabase = window.supabaseClient;
  
  console.log('[DEBUG] Transactions page loaded');
  
  // Elementos da UI
  const navItems = document.querySelectorAll('.nav-item');
  const walletAddressEl = document.getElementById('walletAddress');
  const copyAddressBtn = document.getElementById('copyAddressBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const fullTransactionList = document.getElementById('fullTransactionList');
  const filterButtons = document.querySelectorAll('.filter-btn');

  // Funções de formatação
  function formatDateTime(dateString) {
    if (!dateString) return '—';
    const d = new Date(dateString);
    return d.toLocaleString('pt-BR');
  }
  
  function shortenAddress(addr, chars = 4) {
    if (!addr || typeof addr !== 'string') return '—';
    const clean = addr.replace(/^0x/, '');
    return clean.length <= chars * 2
      ? clean
      : `${clean.slice(0, chars)}...${clean.slice(-chars)}`;
  }
  
  // Toast notification (copiado do settings)
  function showToast(message) {
    let toast = document.createElement('div');
    toast.className = 'copy-toast show';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) document.body.removeChild(toast);
      }, 300);
    }, 2000);
  }

  // Recupera walletData do localStorage (igual ao settings)
  let walletAddress;
  try {
    const raw = localStorage.getItem('walletData');
    if (!raw) throw new Error('Nenhum walletData em localStorage');
    
    const walletData = JSON.parse(raw);
    if (!walletData.address) throw new Error('walletData.address ausente');
    
    walletAddress = walletData.address;
  } catch (e) {
    console.warn('[DEBUG] Não encontrou walletData válido:', e);
    alert('Please connect your wallet first');
    window.location.href = 'main.html';
    return;
  }

  // Funções relacionadas a transações
  async function loadTransactions(filter = 'all') {
  try {
    console.log(`[DEBUG] Loading transactions for ${walletAddress}, filter=${filter}`);
    
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('wallet_address', walletAddress)
      .order('created_at', { ascending: false });
      
    if (filter !== 'all') {
      // Mapeia filtros para tipos do banco de dados
      const filterMap = {
        'sent': 'SENT',
        'received': ['RECEIVED', 'checkin', 'referral', 'mission'],
        'checkin': 'checkin',
        'referral': 'referral',
        'mission': 'mission'
      };
      
      if (filterMap[filter]) {
        if (Array.isArray(filterMap[filter])) {
          // Filtro múltiplo (OR)
          query = query.or(filterMap[filter].map(type => `type.eq.${type}`).join(','));
        } else {
          // Filtro único
          query = query.eq('type', filterMap[filter]);
        }
      }
    }
    
    const { data: transactions, error } = await query;
    if (error) throw error;
    
    if (!transactions || transactions.length === 0) {
      showNoTransactionsMessage(filter);
      return;
    }
    
    renderTransactions(transactions);
  } catch (err) {
    console.error('[ERROR] loadTransactions:', err);
    showErrorMessage(err);
  }
}


  // Mensagem para nenhuma transação (ATUALIZADA)
function showNoTransactionsMessage(filter) {
  const filterLabels = {
    all: '',
    sent: 'sent ',
    received: 'received ',
    checkin: 'check-in ',
    referral: 'referral ',
    mission: 'mission '
  };
  
  const label = filterLabels[filter] || '';
  fullTransactionList.innerHTML = `
    <div class="empty-state">
      <i class="fas fa-exchange-alt"></i>
      <p>No ${label}transactions found</p>
      <small>Wallet: ${shortenAddress(walletAddress)}</small>
    </div>`;
}
  
  function showErrorMessage(err) {
    fullTransactionList.innerHTML = `
      <div class="empty-state error">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Error loading transactions</p>
        <small>${err.message}</small>
      </div>`;
  }
  
  function renderTransactions(transactions) {
  fullTransactionList.innerHTML = '';
  
  transactions.forEach(tx => {
    // Normaliza o tipo e verifica se é envio
    const isSent = tx.type.toLowerCase() === 'sent';
    
    // Formatações
    const dateFmt = tx.created_at ? formatDateTime(tx.created_at) : '—';
    const amountFmt = (isSent ? '-' : '+') + parseFloat(tx.amount).toFixed(4);
    const iconDir = isSent ? 'up' : 'down';
    const label = isSent ? 'Sent' : 'Received';
    const statusText = tx.status === 'pending' ? 'Pending' : 'Confirmed';
    const statusClass = tx.status === 'pending' ? 'pending' : 'confirmed';
    
    fullTransactionList.insertAdjacentHTML('beforeend', `
      <div class="full-transaction-item ${tx.type}">
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
      </div>`);
  });
}

  // Event Listeners
  copyAddressBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(walletAddress).then(() => {
      showToast('Wallet address copied!');
    });
  });
  
  logoutBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to exit?')) {
      localStorage.removeItem('walletData');
      window.location.href = 'main.html';
    }
  });
  
  // Navegação entre páginas (modelo do settings com melhoria)
  navItems.forEach(item => {
    item.addEventListener('click', function() {
      // Remove active class de todos os itens
      navItems.forEach(navItem => navItem.classList.remove('active'));
      
      // Adiciona active class ao item clicado
      this.classList.add('active');
      
      const page = this.dataset.page;
      if (page && page !== 'transactions') {
        window.location.href = `${page}.html`;
      }
    });
  });
  
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadTransactions(btn.dataset.filter);
    });
  });

  // Inicialização
  walletAddressEl.textContent = shortenAddress(walletAddress);
  loadTransactions();
  
  console.log('[DEBUG] Transactions page initialized');
});