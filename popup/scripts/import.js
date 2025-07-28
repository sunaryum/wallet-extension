const seedInput = document.getElementById('seedInput');
const importBtn = document.getElementById('importBtn');
const importStatus = document.getElementById('importStatus');
const goToDashboardBtn = document.getElementById('goToDashboardBtn');
//Verifica Supabase
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
// Função para registrar/atualizar usuário no Supabase
async function registerOrUpdateUser(walletAddress) {
    try {
        const username = `user_${walletAddress.slice(2, 8)}`;
        const now = new Date().toISOString();
        
        const { data: existingUser, error: selectError } = await supabase
            .from('users')
            .select('id, wallet_address')
            .eq('wallet_address', walletAddress)
            .maybeSingle();
        
        if (selectError) throw selectError;
        
        if (existingUser) {
            // Atualiza último login
            const { error: updateError } = await supabase
                .from('users')
                .update({ last_login: now })
                .eq('id', existingUser.id);
                
            if (updateError) throw updateError;
            return existingUser.id;
        } else {
            // Cria novo usuário com valores padrão
            const { data: newUser, error: insertError } = await supabase
                .from('users')
                .insert([{
                    wallet_address: walletAddress,
                    username: username,
                    created_at: now,
                    last_login: now,
                    sun_balance: 0,
                    xp_points: 0,
                    referral_count: 0,
                    total_checkins: 0,
                    streak_days: 0
                }])
                .select('id')
                .single();
                
            if (insertError) throw insertError;
            
         
            
            return newUser.id;
        }
    } catch (error) {
        console.error('User registration error:', error);
        throw error;
    }
}


importBtn.addEventListener('click', async () => {
    const seed = seedInput.value.trim();

    if (!seed || seed.split(' ').length !== 12) {
        importStatus.textContent = 'Please enter a valid 12-word seed phrase.';
        importStatus.classList.add('text-red-400');
        return;
    }

    importStatus.textContent = 'Importing wallet and creating account...';
    importStatus.classList.remove('text-red-400');
    importBtn.disabled = true;

    try {
        // 1. Importar carteira
        const res = await fetch('https://airdrop-sunaryum.onrender.com/api/wallet/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mnemonic: seed })
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Server error');
        }

        const walletData = await res.json();

        // 2. Registrar usuário no Supabase
        const userId = await registerOrUpdateUser(walletData.address);
        
        // 3. Salvar dados localmente
        const localData = {
            address: walletData.address,
            public_key: walletData.public_key,
            private_key: walletData.private_key,
            userId: userId
        };

        localStorage.setItem('walletData', JSON.stringify(localData));

        // 4. Atualizar UI
        importStatus.innerHTML = `
            <span class="text-green-400">
                ✅ Wallet imported!<br>
                <span class="text-xs">Address: ${walletData.address.slice(0, 12)}...${walletData.address.slice(-6)}</span>
            </span>
        `;

        goToDashboardBtn.classList.remove('hidden');

    } catch (error) {
        console.error('Import error:', error);
        importStatus.textContent = `Error: ${error.message || 'Failed to import wallet'}`;
        importStatus.classList.add('text-red-400');
    } finally {
        importBtn.disabled = false;
    }
});

goToDashboardBtn.addEventListener('click', () => {
    window.location.href = 'dashboard.html';
});