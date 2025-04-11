export class IOSWalletProvider {
  constructor() {
    this.listeners = {};
    this.accounts = [];
    this.connected = false;

    // Initialize immediately
    this.initialize();
  }

  async initialize() {
    try {
      const address = await this.getCoinbaseWalletAddress();
      if (address && address !== "null") {
        this.accounts = [address];
        this.connected = true;
        this.emit("connect", { chainId: "0x1" });
        this.emit("accountsChanged", this.accounts);
      } else {
        this.accounts = [];
        this.connected = false;
      }
    } catch (error) {
      console.error("Failed to initialize iOS wallet provider", error);
    }
  }

  async getCoinbaseWalletAddress() {
    return new Promise((resolve) => {
      // Set up a global callback for iOS to call
      window.setWalletAddressFromApp = function (address) {
        resolve(address);
      };

      // Request the address from the iOS app
      window.webkit.messageHandlers.walletConnect.postMessage("getAddress");
    });
  }

  // EIP-1193 required method
  async request(args) {
    const { method, params = [] } = args;

    switch (method) {
      case "eth_requestAccounts":
        // This is an explicit request for accounts, so we should trigger wallet connect
        // if no account is already connected
        if (this.accounts.length === 0 || !this.connected) {
          console.log('iOS wallet: Requesting accounts triggered wallet connect');
          
          // Trigger the native wallet connect if available
          if (window.webkit?.messageHandlers?.nativeWalletConnect) {
            window.webkit.messageHandlers.nativeWalletConnect.postMessage("connect");
          }
          
          // Wait a bit and try to get the address again
          return new Promise((resolve, reject) => {
            // Set up a check that will run a few times
            let attempts = 0;
            const maxAttempts = 10;
            
            const checkForAccounts = async () => {
              attempts++;
              const address = await this.getCoinbaseWalletAddress();
              
              if (address && address !== 'null') {
                // Success! We got an account
                this.accounts = [address];
                this.connected = true;
                this.emit('connect', { chainId: '0xa' });
                this.emit('accountsChanged', this.accounts);
                resolve([...this.accounts]);
              } else if (attempts < maxAttempts) {
                // Try again in a moment
                setTimeout(checkForAccounts, 1000);
              } else {
                // Give up after max attempts
                reject(new Error('No accounts available - please connect your wallet'));
              }
            };
            
            // Start checking
            checkForAccounts();
          });
        }
        
        // If we already have accounts, just return them
        return [...this.accounts];
        
      case "eth_accounts":
        // For eth_accounts (as opposed to eth_requestAccounts),
        // just return what we have without triggering connection
        return [...this.accounts];

      case "eth_chainId":
        return "0xa"; // Return Optimism (10 in hex)

      case "wallet_switchEthereumChain":
        // Check if the requested chain is Optimism
        const requestedChainId = params[0]?.chainId;

        if (requestedChainId === "0xa") {
          // Already on Optimism, no need to switch
          return null;
        }

        // Only allow switching to Optimism
        throw new Error(
          "This wallet connection only supports Optimism (chainId: 10)",
        );

      // Add support for sending transactions
      case "eth_sendTransaction":
        console.log("iOS wallet: Transaction request received", params[0]);

        return new Promise((resolve, reject) => {
          // Set up a callback for iOS to call with the result
          window.resolveTransactionPromise = function (txHash, error) {
            if (error) {
              reject(new Error(error));
            } else {
              resolve(txHash);
            }
          };

          // Send the transaction request to iOS
          window.webkit.messageHandlers.walletTransaction.postMessage(
            JSON.stringify(params[0]),
          );
        });

      // Support basic signing methods
      case "personal_sign":
      case "eth_sign":
      case "eth_signTypedData":
      case "eth_signTypedData_v4":
        console.log(`iOS wallet provider received signing request: ${method}`);
        // In a real implementation, we would forward this to the native app
        // For now, throw an error indicating this would need native implementation
        throw new Error(
          `Signing methods like ${method} require native implementation`,
        );

      default:
        throw new Error(
          `Method ${method} not supported in iOS wallet provider`,
        );
    }
  }

  // Basic event handling for EIP-1193
  on(eventName, listener) {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName].push(listener);
    return this;
  }

  removeListener(eventName, listener) {
    if (this.listeners[eventName]) {
      this.listeners[eventName] = this.listeners[eventName].filter(
        (l) => l !== listener,
      );
    }
    return this;
  }

  emit(eventName, ...args) {
    if (this.listeners[eventName]) {
      this.listeners[eventName].forEach((listener) => listener(...args));
    }
    return true;
  }
}
