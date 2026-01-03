/**
 * VorteX Interface Logic
 * Connects your existing HTML interface to Convex blockchain
 */
class VorteXInterface {
    constructor() {
        this.convexClient = null;
        this.isConnected = false;
        this.isSwapping = false;
        
        // Token configuration - using only CVX for now until we get real token addresses
        this.tokens = {
            'CVX': null,           // Native CVX (no address needed)
            'CVM': null,           // Maps to CVX
            'PAI': null,           // Will use CVX balance until real address provided
            'USDC': null,          // Will use CVX balance until real address provided
            'TOKEN': null          // Will use CVX balance until real address provided
        };        
        
        // Current swap state
        this.fromToken = 'CVX';    // Default: swapping from CVX
        this.toToken = 'PAI';      // Default: swapping to PAI
        this.fromAmount = 0;
        this.toAmount = 0;
    }

    /**
     * Format large numbers with commas
     */
    formatBalance(balance) {
        if (!balance || balance === 0) return '0';
        
        // Convert to number if it's a string
        const num = typeof balance === 'string' ? parseFloat(balance) : balance;
        
        // Format with commas
        return num.toLocaleString('en-US');
    }

    /**
     * Initialize the interface when page loads
     */
    async init() {
        try {
            console.log('🚀 Initializing VorteX Interface...');
            
            // Set up event listeners for your existing HTML elements
            this.setupEventListeners();
            
            // Update UI to show disconnected state
            this.updateConnectionStatus(false);
            
            console.log('✅ VorteX Interface ready');
        } catch (error) {
            console.error('❌ Failed to initialize VorteX Interface:', error);
            this.showNotification('Failed to initialize interface', 'error');
        }
    }

    /**
     * Set up event listeners for your HTML buttons and inputs
     */
    setupEventListeners() {
        // Connect wallet button in navigation bar
        const navConnectButton = document.querySelector('nav button');
        if (navConnectButton) {
            navConnectButton.addEventListener('click', () => this.toggleConnection());
        }

        // Main swap button - should also connect if not connected
        const swapButton = document.querySelector('main button.w-full');
        if (swapButton) {
            swapButton.addEventListener('click', () => {
                if (!this.isConnected) {
                    this.toggleConnection(); // Connect first if not connected
                } else {
                    this.executeSwap(); // Execute swap if already connected
                }
            });
        }

        // Swap arrow button (switches token positions)
        const swapArrowButton = document.querySelector('.bg-purple-600.p-3.rounded-full');
        if (swapArrowButton) {
            swapArrowButton.addEventListener('click', () => this.swapTokenPositions());
        }

        // Input field for "You pay" amount
        const fromInput = document.querySelector('.token-input input[type="number"]');
        if (fromInput) {
            fromInput.addEventListener('input', (e) => this.onFromAmountChange(e.target.value));
        }

        // Token selector buttons (make them clickable)
        const tokenSelectors = document.querySelectorAll('.bg-white\\/10.px-3.py-2.rounded-lg');
        tokenSelectors.forEach((selector, index) => {
            selector.style.cursor = 'pointer';
            selector.addEventListener('click', () => {
                this.showTokenSelector(index === 0 ? 'from' : 'to');
            });
        });

        // Update balances every 15 seconds when connected
        setInterval(() => {
            if (this.isConnected) {
                this.updateBalances();
            }
        }, 15000);
    }

    /**
     * Connect or disconnect wallet
     */
    async toggleConnection() {
        if (this.isConnected) {
            // Disconnect
            this.convexClient.close();
            this.convexClient = null;
            this.isConnected = false;
            this.updateConnectionStatus(false);
            
            // Hide balance box when disconnected
            const navBalanceContainer = document.getElementById('nav-balance-container');
            if (navBalanceContainer) {
                navBalanceContainer.style.display = 'none';
            }
            
            this.showNotification('Disconnected from Convex', 'info');
        } else {
            // Connect
            await this.connectWallet();
        }
    }

    /**
     * Connect to Convex wallet
     */
    async connectWallet() {
        try {
            this.showLoading('Connecting to Convex...');
            
            // Create and connect to Convex client
            this.convexClient = await ConvexClient.connect('http://peer.convex.live:8080');
            this.isConnected = true;
            
            this.updateConnectionStatus(true);
            this.updateBalances();
            
            this.hideLoading();
            this.showNotification('Connected to Convex network!', 'success');
            
        } catch (error) {
            console.error('Failed to connect wallet:', error);
            this.hideLoading();
            this.showNotification('Failed to connect to Convex network. Please try again.', 'error');
        }
    }

    /**
     * Update connection status in your HTML interface
     */
    updateConnectionStatus(connected) {
        const navConnectButton = document.querySelector('nav button');
        const mainSwapButton = document.querySelector('main button.w-full');
        
        // Update navigation button
        if (navConnectButton) {
            if (connected) {
                navConnectButton.innerHTML = `
                    <i data-feather="check-circle" class="mr-2"></i>
                    Connected
                `;
                navConnectButton.className = navConnectButton.className.replace('bg-purple-600 hover:bg-purple-700', 'bg-green-600 hover:bg-green-700');
            } else {
                navConnectButton.innerHTML = `
                    <i data-feather="credit-card" class="mr-2"></i>
                    Connect Wallet
                `;
                navConnectButton.className = navConnectButton.className.replace('bg-green-600 hover:bg-green-700', 'bg-purple-600 hover:bg-purple-700');
            }
            feather.replace();
        }

        // Update main swap button - KEEP IT ENABLED AND PURPLE
        if (mainSwapButton) {
            if (connected) {
                mainSwapButton.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" class="mr-2">
                        <path d="m7.75 5.75-3-3-3 3m3 7.5v-10.5m9.5 7.5-3 3-3-3m3-7.5v10.5"/>
                    </svg>
                    Swap
                `;
            } else {
                mainSwapButton.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" class="mr-2">
                        <path d="m7.75 5.75-3-3-3 3m3 7.5v-10.5m9.5 7.5-3 3-3-3m3-7.5v10.5"/>
                    </svg>
                    Connect Wallet to Swap
                `;
            }
            // Keep button enabled and purple in both states
            mainSwapButton.className = 'w-full bg-purple-600 hover:bg-purple-700 py-4 rounded-xl font-medium flex items-center justify-center transition-all hover:shadow-lg';
            mainSwapButton.disabled = false;
        }
    }

    /**
     * Update balance displays in your HTML
     */
    async updateBalances() {
        if (!this.isConnected || !this.convexClient) return;

        try {
            // Get balances for current tokens
            const fromBalance = await this.getTokenBalance(this.fromToken);
            const toBalance = await this.getTokenBalance(this.toToken);

            // Update specific balance elements by ID (without "Balance:" prefix)
            const fromBalanceElement = document.getElementById('from-balance');
            if (fromBalanceElement) {
                fromBalanceElement.textContent = this.formatBalance(fromBalance);
            }

            const toBalanceElement = document.getElementById('to-balance');
            if (toBalanceElement) {
                toBalanceElement.textContent = this.formatBalance(toBalance);
            }

            // Update the navigation balance box
            const navBalanceContainer = document.getElementById('nav-balance-container');
            const navBalanceDisplay = document.getElementById('nav-balance-display');
            
            if (navBalanceContainer && navBalanceDisplay) {
                navBalanceDisplay.textContent = this.formatBalance(fromBalance);
                navBalanceContainer.style.display = 'block';
            }

            // Protect VorteX title from corruption
            const vortexTitle = document.querySelector("body > nav > div.flex.items-center.space-x-2 > span");
            if (vortexTitle && vortexTitle.textContent.includes('Balance:')) {
                vortexTitle.textContent = 'VorteX';
            }

        } catch (error) {
            console.error('Failed to update balances:', error);
        }
    }

    /**
     * Get balance for a specific token
     */
    async getTokenBalance(tokenSymbol) {
        if (!this.convexClient) return 0;
        
        try {
            const tokenAddress = this.tokens[tokenSymbol];
            if (!tokenAddress || tokenSymbol === 'CVX' || tokenSymbol === 'CVM') {
                // Get CVX balance
                return await this.convexClient.getBalance();
            } else {
                // Get token balance
                const result = await this.convexClient.query(`(call ${tokenAddress} (balance ${this.convexClient.address}))`);
                return result.value || 0;
            }
        } catch (error) {
            console.error(`Failed to get ${tokenSymbol} balance:`, error);
            return 0;
        }
    }

    /**
     * Handle amount input changes and calculate output
     */
    async onFromAmountChange(amount) {
        if (!this.isConnected || !amount || isNaN(amount) || amount <= 0) {
            // Clear output if invalid input
            const toInput = document.querySelectorAll('.token-input input[type="number"]')[1];
            if (toInput) toInput.value = '';
            return;
        }

        try {
            this.fromAmount = parseFloat(amount);
            
            // Get estimated output amount (simplified calculation for now)
            const estimatedOutput = this.fromAmount * 0.97; // Simulate 3% slippage
            
            // Update the "You receive" input
            const toInput = document.querySelectorAll('.token-input input[type="number"]')[1];
            if (toInput) {
                toInput.value = estimatedOutput.toFixed(4);
                this.toAmount = estimatedOutput;
            }
        } catch (error) {
            console.error('Failed to calculate output amount:', error);
        }
    }

    /**
     * Swap the from/to token positions (when arrow button clicked)
     */
    swapTokenPositions() {
        // Swap the token types
        [this.fromToken, this.toToken] = [this.toToken, this.fromToken];
        
        // Update token displays in UI
        this.updateTokenDisplays();
        
        // Clear input amounts
        const inputs = document.querySelectorAll('.token-input input[type="number"]');
        inputs.forEach(input => input.value = '');
        this.fromAmount = 0;
        this.toAmount = 0;
        
        // Update balances
        if (this.isConnected) {
            this.updateBalances();
        }
    }

    /**
/**
/**
 * Update token symbols displayed in the interface
 */
updateTokenDisplays() {
    // Update token text labels
    const tokenDisplays = document.querySelectorAll('.bg-white\\/10.px-3.py-2.rounded-lg span');
    if (tokenDisplays.length >= 2) {
        tokenDisplays[0].textContent = this.fromToken;
        tokenDisplays[1].textContent = this.toToken;
    }
    
    // Update token circles
    const tokenCircles = document.querySelectorAll('.w-8.h-8.rounded-full');
    if (tokenCircles.length >= 2) {
        // Update "You pay" token circle
        tokenCircles[0].textContent = this.fromToken;
        
        // Update "You receive" token circle  
        tokenCircles[1].textContent = this.toToken;
        
        // Update colors based on token
        this.updateTokenCircleColors(tokenCircles[0], this.fromToken);
        this.updateTokenCircleColors(tokenCircles[1], this.toToken);
    }
}

/**
 * Update token circle colors based on token type
 */
updateTokenCircleColors(circleElement, tokenSymbol) {
    // Remove existing background color classes
    circleElement.className = circleElement.className.replace(/bg-(purple|blue|green|gray)-\d+/g, '');
    
    // Ensure consistent sizing and styling
    circleElement.className = 'w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs';
    
    // Apply color based on token
    switch(tokenSymbol) {
        case 'CVX':
        case 'CVM':
            circleElement.classList.add('bg-purple-600');
            break;
        case 'PAI':
            circleElement.classList.add('bg-purple-500');
            break;
        case 'USDC':
            circleElement.classList.add('bg-blue-600');
            break;
        case 'TOKEN':
            circleElement.classList.add('bg-green-600');
            break;
        default:
            circleElement.classList.add('bg-gray-600');
            break;
    }
}    /**
     * Execute the swap transaction
     */
    async executeSwap() {
        if (!this.isConnected) {
            this.showNotification('Please connect your wallet first', 'error');
            return;
        }

        if (this.isSwapping) return;

        try {
            this.isSwapping = true;
            this.showLoading('Executing swap...');

            const fromInput = document.querySelector('.token-input input[type="number"]');
            const amount = parseFloat(fromInput.value);

            if (!amount || amount <= 0) {
                throw new Error('Please enter a valid amount');
            }

            // Execute the appropriate Torus function
            let result;
            if ((this.fromToken === 'CVX' || this.fromToken === 'CVM') && this.toToken !== 'CVX' && this.toToken !== 'CVM') {
                // Buying tokens with CVX
                const tokenAddress = this.tokens[this.toToken];
                result = await this.convexClient.buyTokens(tokenAddress, amount);
            } else if (this.fromToken !== 'CVX' && this.fromToken !== 'CVM' && (this.toToken === 'CVX' || this.toToken === 'CVM')) {
                // Selling tokens for CVX
                const tokenAddress = this.tokens[this.fromToken];
                result = await this.convexClient.sellTokens(tokenAddress, amount);
            } else {
                throw new Error('Token-to-token swaps not implemented yet. Please swap through CVX.');
            }

            this.hideLoading();
            this.showNotification('Swap completed successfully!', 'success');
            
            // Clear inputs and update balances
            const inputs = document.querySelectorAll('.token-input input[type="number"]');
            inputs.forEach(input => input.value = '');
            this.fromAmount = 0;
            this.toAmount = 0;
            this.updateBalances();

        } catch (error) {
            console.error('Swap failed:', error);
            this.hideLoading();
            this.showNotification(`Swap failed: ${error.message}`, 'error');
        } finally {
            this.isSwapping = false;
        }
    }

    /**
     * Show token selector (simplified for now)
     */
    showTokenSelector(position) {
        const availableTokens = Object.keys(this.tokens);
        const currentToken = position === 'from' ? this.fromToken : this.toToken;
        
        // Simple prompt for now - you can build a fancy modal later
        const tokenList = availableTokens.filter(token => token !== currentToken).join(', ');
        const selectedToken = prompt(`Select ${position} token (${tokenList}):`);
        
        if (selectedToken && availableTokens.includes(selectedToken.toUpperCase())) {
            if (position === 'from') {
                this.fromToken = selectedToken.toUpperCase();
            } else {
                this.toToken = selectedToken.toUpperCase();
            }
            this.updateTokenDisplays();
            if (this.isConnected) {
                this.updateBalances();
            }
        }
    }

    /**
     * Show loading state
     */
    showLoading(message) {
        const navConnectButton = document.querySelector('nav button');
        if (navConnectButton) {
            navConnectButton.innerHTML = `
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ${message}
            `;
            navConnectButton.disabled = true;
        }
    }

    /**
     * Hide loading state
     */
    hideLoading() {
        this.updateConnectionStatus(this.isConnected);
        // Re-enable navigation button
        const navConnectButton = document.querySelector('nav button');
        if (navConnectButton) {
            navConnectButton.disabled = false;
        }
    }

    /**
     * Show notification to user
     */
    showNotification(message, type = 'info') {
        // Simple alert for now - you can build a fancy toast notification later
        const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
        alert(`${icon} ${message}`);
        console.log(`${icon} ${message}`);
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.vortexInterface = new VorteXInterface();
    window.vortexInterface.init();
});

// Export for debugging
window.VorteXInterface = VorteXInterface;