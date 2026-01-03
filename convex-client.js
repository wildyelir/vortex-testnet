/**
 * VorteX Convex Client - CORRECTED VERSION
 * Uses the correct torus.exchange import path
 */
class ConvexClient {
    constructor(peerUrl = 'http://peer.convex.live:8080') {
        this.peerUrl = peerUrl;
        this.address = null;
        this.keyPair = null;
        this.sequence = 0;
        this.isConnected = false;
        
        // Connection timeout
        this.timeout = 30000; // 30 seconds
    }

    /**
     * Connect to Convex network
     */
    static async connect(peerServerURL, address = null, keyPair = null) {
        const client = new ConvexClient(peerServerURL);
        await client.initialize();
        
        if (address && keyPair) {
            client.setAddress(address);
            client.setKeyPair(keyPair);
        } else {
            await client.createDemoAccount();
        }
        
        return client;
    }

    /**
     * Initialize connection
     */
    async initialize() {
        try {
            console.log('🔄 Initializing Convex connection...');
            
            // Test connection with simple query
            const testResult = await this.query('(+ 2 2 2 1)', '#12');
            if (testResult.value !== 7) {
                throw new Error('Peer connection test failed');
            }
            
            this.isConnected = true;
            console.log('✅ Convex peer connection established');
            
            // Test if torus.exchange is available
            await this.testTorusAvailability();
            
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Convex connection:', error);
            throw error;
        }
    }

    /**
     * Test if torus.exchange is available
     */
    async testTorusAvailability() {
        try {
            console.log('🔍 Checking torus.exchange availability...');
            const result = await this.query('(import torus.exchange :as torus) "Torus available"');
            if (result.value === "Torus available") {
                console.log('✅ torus.exchange is available!');
                return true;
            }
        } catch (error) {
            console.warn('⚠️ torus.exchange may not be deployed:', error.message);
            console.log('💡 You may need to deploy torus.exchange first or use a different peer');
            return false;
        }
    }

    /**
     * Set address for this connection
     */
    setAddress(address) {
        this.address = address;
        this.sequence = 0;
    }

    /**
     * Set key pair for this connection
     */
    setKeyPair(keyPair) {
        this.keyPair = keyPair;
    }

    /**
     * Create demo account for testing
     */
    async createDemoAccount() {
        try {
            // Try official account creation endpoint
            const response = await fetch(`${this.peerUrl}/api/v1/createAccount`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accountKey: "d82e78594610f708ad47f666bbacbab1711760652cb88bf7515ed6c3ae84a08d"
                })
            });
            
            if (response.ok) {
                const accountData = await response.json();
                this.setAddress(accountData.address);
                this.setKeyPair("d82e78594610f708ad47f666bbacbab1711760652cb88bf7515ed6c3ae84a08d");
                
                console.log('✅ Created new account:', accountData);
                await this.requestFaucetCoins();
                return accountData;
            }
        } catch (error) {
            console.log('Account creation not available, using demo fallback');
        }
        
        // Fallback to demo address
        this.setAddress("#12");
        this.setKeyPair("demo");
        console.log('📱 Using demo account:', this.address);
    }

    /**
     * Request faucet coins
     */
    async requestFaucetCoins() {
        try {
            const response = await fetch(`${this.peerUrl}/api/v1/faucet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: this.address,
                    amount: "10000000"
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Received faucet coins:', data);
            }
        } catch (error) {
            console.log('Faucet not available');
        }
    }

    /**
     * Query Convex network (read-only)
     */
    async query(source, address = this.address) {
        try {
            const response = await fetch(`${this.peerUrl}/api/v1/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: address,
                    source: source
                }),
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!response.ok) {
                throw new Error(`Query failed: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            
            if (result.errorCode) {
                throw new Error(`Convex error: ${result.value || result.errorCode}`);
            }

            return result;
        } catch (error) {
            console.error('❌ Query failed:', error.message);
            throw error;
        }
    }

    /**
     * Execute transaction
     */
    async transact(source) {
        if (!this.isConnected) {
            throw new Error('Not connected to Convex network');
        }

        if (!this.address) {
            throw new Error('No address set for transaction');
        }

        try {
            console.log('📤 Executing transaction:', source);
            
            const response = await fetch(`${this.peerUrl}/api/v1/transact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: this.address,
                    source: source,
                    seed: this.keyPair
                }),
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!response.ok) {
                throw new Error(`Transaction failed: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            
            if (result.errorCode) {
                throw new Error(`Transaction error: ${result.value || result.errorCode}`);
            }

            this.sequence++;
            console.log('✅ Transaction completed:', result);
            console.log('⛽ Gas used:', result.info?.juice);
            
            return result;
        } catch (error) {
            console.error('❌ Transaction failed:', error.message);
            throw error;
        }
    }

    /**
     * Get account balance
     */
    async getBalance(address = this.address) {
        try {
            const result = await this.query(`(balance ${address})`);
            return result.value || 0;
        } catch (error) {
            console.error('Failed to get balance:', error.message);
            return 0;
        }
    }

    /**
     * Get account information
     */
    async getAccountInfo(address = this.address) {
        try {
            const response = await fetch(`${this.peerUrl}/api/v1/accounts/${address.replace('#', '')}`);
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('Failed to get account info:', error.message);
        }
        return null;
    }

    /**
     * Transfer CVX to another address
     */
    async transfer(toAddress, amount) {
        const source = `(transfer ${toAddress} ${amount})`;
        return await this.transact(source);
    }

    /**
     * ==========================================
     * TORUS.EXCHANGE DEX FUNCTIONS (CORRECTED)
     * ==========================================
     */

    /**
     * Buy tokens using CVX through torus.exchange
     * @param {string} tokenAddress - The token address to buy
     * @param {number} cvxAmount - Amount of CVX to spend
     */
    async buyTokens(tokenAddress, cvxAmount) {
        // Convert to smallest unit (1 CVX = 1,000,000,000 units)
        const amountInUnits = Math.floor(cvxAmount * 1000000000);
        
        const source = `(do 
            (import torus.exchange :as torus)
            (torus/buy-tokens ${tokenAddress} ${amountInUnits})
        )`;
        
        console.log(`📈 Buying tokens at ${tokenAddress} for ${cvxAmount} CVX`);
        return await this.transact(source);
    }

    /**
     * Sell tokens for CVX through torus.exchange
     * @param {string} tokenAddress - The token address to sell
     * @param {number} tokenAmount - Amount of tokens to sell
     */
    async sellTokens(tokenAddress, tokenAmount) {
        // Convert to token's smallest unit (depends on token decimals)
        const amountInUnits = Math.floor(tokenAmount * 1000000);
        
        const source = `(do 
            (import torus.exchange :as torus)
            (torus/sell-tokens ${tokenAddress} ${amountInUnits})
        )`;
        
        console.log(`📉 Selling ${tokenAmount} tokens at ${tokenAddress} for CVX`);
        return await this.transact(source);
    }

    /**
     * Buy CVX with tokens through torus.exchange
     * @param {string} tokenAddress - The token to use for buying CVX
     * @param {number} tokenAmount - Amount of tokens to spend
     */
    async buyCVX(tokenAddress, tokenAmount) {
        const amountInUnits = Math.floor(tokenAmount * 1000000);
        
        const source = `(do 
            (import torus.exchange :as torus)
            (torus/buy-cvx ${tokenAddress} ${amountInUnits})
        )`;
        
        console.log(`💰 Buying CVX with ${tokenAmount} tokens from ${tokenAddress}`);
        return await this.transact(source);
    }

    /**
     * Sell CVX for tokens through torus.exchange
     * @param {string} tokenAddress - The token to receive
     * @param {number} cvxAmount - Amount of CVX to sell
     */
    async sellCVX(tokenAddress, cvxAmount) {
        const amountInUnits = Math.floor(cvxAmount * 1000000000);
        
        const source = `(do 
            (import torus.exchange :as torus)
            (torus/sell-cvx ${tokenAddress} ${amountInUnits})
        )`;
        
        console.log(`💸 Selling ${cvxAmount} CVX for tokens at ${tokenAddress}`);
        return await this.transact(source);
    }

    /**
     * Get market information for a token
     * @param {string} tokenAddress - The token address
     */
    async getMarket(tokenAddress) {
        const source = `(do 
            (import torus.exchange :as torus)
            (torus/get-market ${tokenAddress})
        )`;
        
        try {
            const result = await this.query(source);
            console.log(`📊 Market info for ${tokenAddress}:`, result.value);
            return result.value;
        } catch (error) {
            console.error('Failed to get market info:', error.message);
            return null;
        }
    }

    /**
     * Get price for buying tokens
     * @param {string} tokenAddress - The token address
     * @param {number} cvxAmount - Amount of CVX to spend
     */
    async getBuyPrice(tokenAddress, cvxAmount) {
        const amountInUnits = Math.floor(cvxAmount * 1000000000);
        
        const source = `(do 
            (import torus.exchange :as torus)
            (torus/price ${tokenAddress} ${amountInUnits})
        )`;
        
        try {
            const result = await this.query(source);
            return result.value / 1000000; // Convert back to token units
        } catch (error) {
            console.error('Failed to get buy price:', error.message);
            return 0;
        }
    }

    /**
     * Add liquidity to a market
     * @param {string} tokenAddress - The token address
     * @param {number} cvxAmount - Amount of CVX to add
     * @param {number} tokenAmount - Amount of tokens to add
     */
    async addLiquidity(tokenAddress, cvxAmount, tokenAmount) {
        const cvxUnits = Math.floor(cvxAmount * 1000000000);
        const tokenUnits = Math.floor(tokenAmount * 1000000);
        
        const source = `(do 
            (import torus.exchange :as torus)
            (torus/add-liquidity ${tokenAddress} ${cvxUnits} ${tokenUnits})
        )`;
        
        console.log(`💧 Adding liquidity: ${cvxAmount} CVX + ${tokenAmount} tokens`);
        return await this.transact(source);
    }

    /**
     * Remove liquidity from a market
     * @param {string} tokenAddress - The token address
     * @param {number} shares - Amount of liquidity shares to remove
     */
    async removeLiquidity(tokenAddress, shares) {
        const source = `(do 
            (import torus.exchange :as torus)
            (torus/remove-liquidity ${tokenAddress} ${shares})
        )`;
        
        console.log(`🔥 Removing ${shares} liquidity shares from ${tokenAddress}`);
        return await this.transact(source);
    }

    /**
     * Create a new market for a token
     * @param {string} tokenAddress - The token address
     * @param {number} initialCVX - Initial CVX liquidity
     * @param {number} initialTokens - Initial token liquidity
     */
    async createMarket(tokenAddress, initialCVX, initialTokens) {
        const cvxUnits = Math.floor(initialCVX * 1000000000);
        const tokenUnits = Math.floor(initialTokens * 1000000);
        
        const source = `(do 
            (import torus.exchange :as torus)
            (torus/create-market ${tokenAddress} ${cvxUnits} ${tokenUnits})
        )`;
        
        console.log(`🏪 Creating market for ${tokenAddress}`);
        return await this.transact(source);
    }

    /**
     * ==========================================
     * CONVEX.FUNGIBLE TOKEN FUNCTIONS
     * ==========================================
     */

    /**
     * Transfer fungible tokens
     */
    async transferToken(tokenAddress, toAddress, amount) {
        const source = `(do 
            (import convex.fungible :as fungible)
            (fungible/transfer ${tokenAddress} ${toAddress} ${amount})
        )`;
        return await this.transact(source);
    }

    /**
     * Get token balance
     */
    async getTokenBalance(tokenAddress, holderAddress = this.address) {
        const source = `(do 
            (import convex.fungible :as fungible)
            (fungible/balance ${tokenAddress} ${holderAddress})
        )`;
        const result = await this.query(source);
        return result.value || 0;
    }

    /**
     * Close connection
     */
    close() {
        this.isConnected = false;
        this.address = null;
        this.keyPair = null;
        this.sequence = 0;
        console.log('🔴 Convex connection closed');
    }
}

// Export for use
window.ConvexClient = ConvexClient;