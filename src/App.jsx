import React, { useState, useEffect, useRef } from 'react';
import { Clock, Wallet, AlertCircle, CheckCircle2, Activity } from 'lucide-react';
import Web3 from 'web3';

const CHAINS = {
  ethereum: { name: 'Ethereum', id: '0x1', chainid: '1', rpc: 'https://eth.llamarpc.com', symbol: 'ETH', explorer: 'https://etherscan.io', api: 'https://api.etherscan.io/v2/api', seadrop: '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5' },
  polygon: { name: 'Polygon', id: '0x89', chainid: '137', rpc: 'https://polygon-rpc.com', symbol: 'MATIC', explorer: 'https://polygonscan.com', api: 'https://api.etherscan.io/v2/api', seadrop: '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5' },
  base: { name: 'Base', id: '0x2105', chainid: '8453', rpc: 'https://mainnet.base.org', symbol: 'ETH', explorer: 'https://basescan.org', api: 'https://api.etherscan.io/v2/api', seadrop: '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5' },
  arbitrum: { name: 'Arbitrum', id: '0xa4b1', chainid: '42161', rpc: 'https://arb1.arbitrum.io/rpc', symbol: 'ETH', explorer: 'https://arbiscan.io', api: 'https://api.etherscan.io/v2/api', seadrop: '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5' },
  bsc: { name: 'BNB Chain', id: '0x38', chainid: '56', rpc: 'https://bsc-dataseed.binance.org', symbol: 'BNB', explorer: 'https://bscscan.com', api: 'https://api.etherscan.io/v2/api', seadrop: null }
};

const API_KEY = import.meta.env?.REACT_APP_ETHERSCAN_API_KEY || '';

export default function NFTMintBot() {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState('');
  const [balance, setBalance] = useState('0.0');
  const [chain, setChain] = useState('ethereum');
  const [contract, setContract] = useState('');
  const [amount, setAmount] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('idle');
  const [tx, setTx] = useState('');
  const [logs, setLogs] = useState([]);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [availableWallets, setAvailableWallets] = useState([]);
  const [manualPrice, setManualPrice] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [autoMintMode, setAutoMintMode] = useState(false);
  const [targetTime, setTargetTime] = useState('');
  const [monitoring, setMonitoring] = useState(false);
  const [countdown, setCountdown] = useState('');
  const connectedProvider = useRef(null);
  const monitorInterval = useRef(null);
  const countdownInterval = useRef(null);

  useEffect(() => {
    const detected = [];
    window.addEventListener('eip6963:announceProvider', (e) => {
      if (!detected.some(w => w.uuid === e.detail.info.uuid)) {
        detected.push({name: e.detail.info.name, icon: e.detail.info.icon || '🔷', uuid: e.detail.info.uuid, provider: e.detail.provider});
        setAvailableWallets([...detected]);
      }
    });
    window.dispatchEvent(new Event('eip6963:requestProvider'));
  }, []);

  const log = (msg, type = 'info') => setLogs(p => [{time: new Date().toLocaleTimeString(), msg, type}, ...p].slice(0, 30));

  const connectWallet = async (w) => {
    setShowWalletModal(false);
    const provider = w.provider || window.ethereum;
    if (!provider) return log('No wallet', 'error');
    try {
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      setAddress(accounts[0]);
      const bal = await provider.request({ method: 'eth_getBalance', params: [accounts[0], 'latest'] });
      setBalance((parseInt(bal, 16) / 1e18).toFixed(4));
      setConnected(true);
      connectedProvider.current = provider;
      log(`${w.name} connected`, 'success');
    } catch (e) {
      log('Connection failed', 'error');
    }
  };

  const analyze = async () => {
    if (!contract || contract.length !== 42) return log('Invalid address', 'error');
    setLoading(true);
    log('📡 Reading blockchain...', 'info');
    
    try {
      const web3 = new Web3(CHAINS[chain].rpc);
      const d = { name: '', symbol: '', supply: '0', max: '0', price: '0' };
      
      // basic info
      const basicAbi = [{inputs:[],name:"name",outputs:[{type:"string"}],stateMutability:"view",type:"function"},{inputs:[],name:"symbol",outputs:[{type:"string"}],stateMutability:"view",type:"function"},{inputs:[],name:"totalSupply",outputs:[{type:"uint256"}],stateMutability:"view",type:"function"},{inputs:[],name:"maxSupply",outputs:[{type:"uint256"}],stateMutability:"view",type:"function"}];
      const c = new web3.eth.Contract(basicAbi, contract);
      try { d.name = await c.methods.name().call(); } catch {}
      try { d.symbol = await c.methods.symbol().call(); } catch {}
      try { d.supply = (await c.methods.totalSupply().call()).toString(); } catch {}
      try { d.max = (await c.methods.maxSupply().call()).toString(); } catch {}
      log(`✅ ${d.name} (${d.symbol})`, 'success');
      
      // get full ABI from etherscan
      log('🔍 Fetching ABI...', 'info');
      const res = await fetch(`${CHAINS[chain].api}?chainid=${CHAINS[chain].chainid}&module=contract&action=getabi&address=${contract}&apikey=${API_KEY}`);
      const abiData = await res.json();
      
      console.log('ABI response:', abiData); // DEBUG
      
      if (abiData.status === '1' && abiData.result) {
        const fullAbi = JSON.parse(abiData.result);
        log('✅ ABI loaded', 'success');
        
        // CHECK IF THIS IS A SEADROP CONTRACT
        const hasSeaDropFunc = fullAbi.some(f => 
          f.type === 'function' && 
          f.name === 'updateAllowedSeaDrop'
        );
        
        if (hasSeaDropFunc && CHAINS[chain].seadrop) {
          d.isSeaDrop = true;
          d.seaDropAddress = CHAINS[chain].seadrop;
          log(`🌊 SeaDrop: ${CHAINS[chain].seadrop.slice(0,10)}...`, 'success');
        }
        
        // find payable functions
        const payableFuncs = fullAbi.filter(f => f.type === 'function' && f.stateMutability === 'payable');
        log(`Found ${payableFuncs.length} payable functions`, 'info');
        
        // find mint-like functions
        const mintFuncs = payableFuncs.filter(f => {
          const n = f.name.toLowerCase();
          return n.includes('mint') || n.includes('buy') || n.includes('purchase');
        });
        
        if (mintFuncs.length > 0) {
          d.mintFunctions = mintFuncs;
          log(`🎯 ${mintFuncs.length} mint functions found`, 'success');
          mintFuncs.forEach(f => log(`  - ${f.name}(${f.inputs.map(i => i.type).join(',')})`, 'info'));
        }
      } else {
        log('⚠️ ABI not verified - using fallback', 'info');
      }
      
      // ALWAYS add fallback mint functions
      if (!d.mintFunctions) d.mintFunctions = [];
      
      const fallbackFuncs = [
        {name: 'mint', inputs: [{type: 'uint256'}], stateMutability: 'payable', type: 'function'},
        {name: 'publicMint', inputs: [{type: 'uint256'}], stateMutability: 'payable', type: 'function'},
        {name: 'mint', inputs: [], stateMutability: 'payable', type: 'function'},
      ];
      
      fallbackFuncs.forEach(fb => {
        if (!d.mintFunctions.some(f => f.name === fb.name && f.inputs.length === fb.inputs.length)) {
          d.mintFunctions.push(fb);
        }
      });
      
      // price
      if (manualPrice && parseFloat(manualPrice) > 0) {
        d.price = manualPrice;
        log(`💰 ${d.price} ETH (manual)`, 'success');
      }
      
      log(`📊 ${d.supply}/${d.max}`, 'info');
      log(`💡 ${d.isSeaDrop ? 'SeaDrop + ' : ''}${d.mintFunctions.length} methods to try`, 'info');
      setData(d);
    } catch (e) {
      log('❌ ' + e.message, 'error');
    }
    setLoading(false);
  };

  const mint = async () => {
    if (!connected || !data) return log('❌ Connect & analyze first', 'error');
    setStatus('minting');
    log('⚡ Minting...', 'info');
    
    try {
      const provider = connectedProvider.current;
      const web3 = new Web3(provider);
      
      const price = manualPrice || data.price || '0';
      const totalPrice = parseFloat(price) * amount;
      const value = web3.utils.toWei(totalPrice.toString(), 'ether');
      
      log(`💸 ${totalPrice} ETH`, 'info');
      
      let success = false;
      
      // TRY SEADROP IF DETECTED
      if (data.isSeaDrop && data.seaDropAddress) {
        try {
          log(`🌊 Using SeaDrop protocol`, 'info');
          
          const OPENSEA_FEE_RECIPIENT = '0x0000a26b00c1F0DF003000390027140000fAa719';
          
          const mintPublicAbi = [{
            inputs: [
              {name: "nftContract", type: "address"},
              {name: "feeRecipient", type: "address"},
              {name: "minterIfNotPayer", type: "address"},
              {name: "quantity", type: "uint256"}
            ],
            name: "mintPublic",
            outputs: [],
            stateMutability: "payable",
            type: "function"
          }];
          
          // CALL ON THE SEADROP CONTRACT
          const seaDropContract = new web3.eth.Contract(mintPublicAbi, data.seaDropAddress);
          const method = seaDropContract.methods.mintPublic(
            contract,              // NFT contract address
            OPENSEA_FEE_RECIPIENT,
            address,               // minter
            String(amount)         // convert to string to avoid BigInt issues
          );
          
          const gasEstimate = await method.estimateGas({ from: address, value: value.toString() });
          const gas = Math.floor(Number(gasEstimate) * 1.3);
          log(`✅ Gas: ${gas}`, 'info');
          
          const result = await method.send({ from: address, value: value.toString(), gas: gas.toString() });
          
          setTx(result.transactionHash);
          setStatus('success');
          log(`✅ MINTED!`, 'success');
          log(`📝 ${result.transactionHash}`, 'success');
          success = true;
          
          setTimeout(async () => {
            const bal = await provider.request({ method: 'eth_getBalance', params: [address, 'latest'] });
            setBalance((parseInt(bal, 16) / 1e18).toFixed(4));
          }, 3000);
        } catch (e) {
          if (e.code === 4001) {
            setStatus('idle');
            return log('❌ Cancelled', 'info');
          }
          log(`SeaDrop failed: ${e.message}`, 'error');
        }
      }
      
      // TRY STANDARD FUNCTIONS
      if (!success && data.mintFunctions) {
        for (const func of data.mintFunctions) {
          try {
            const c = new web3.eth.Contract([func], contract);
            let method;
            
            if (func.inputs.length === 0) {
              method = c.methods[func.name]();
            } else if (func.inputs.length === 1 && func.inputs[0].type.includes('uint')) {
              method = c.methods[func.name](amount);
            } else {
              continue;
            }
            
            log(`🔧 Trying ${func.name}`, 'info');
            const gas = await method.estimateGas({ from: address, value });
            const result = await method.send({ from: address, value, gas: Math.floor(gas * 1.3) });
            
            setTx(result.transactionHash);
            setStatus('success');
            log(`✅ MINTED!`, 'success');
            success = true;
            break;
          } catch (e) {
            if (e.code === 4001) {
              setStatus('idle');
              return log('❌ Cancelled', 'info');
            }
            log(`${func.name} failed`, 'error');
          }
        }
      }
      
      if (!success) {
        setStatus('error');
        log('❌ All methods failed', 'error');
      }
    } catch (e) {
      setStatus('error');
      log('❌ ' + e.message, 'error');
    }
  };

  const reset = () => {
    setStatus('idle');
    setTx('');
    setMonitoring(false);
    setAutoMintMode(false);
    setTargetTime('');
    setCountdown('');
    if (monitorInterval.current) clearInterval(monitorInterval.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    log('🔄 Reset complete', 'info');
  };

  const playAlarm = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGS57OihUBELTKXh8LJnHgU2jdXzzn0vBSl+y/DajDwKFF+16+mjVBILTKXj8bRnHgU2jtXy0n8vBSh+y/DajT0KFF6z6+mjVBILTKTk8bRmHgU1jtXyz4AvBSh+yvDbjDwKFF6z6+mjVBILTKTk8bRmHgU1jtXyz4AvBSh+yvDbjDwKFF6z6+mjVBILTKTk8bRmHgU1jtXyz4AvBSh+yvDbjDwKFF6z6+mjVBILTKTk8bRmHgU1jtXyz4AvBSh+yvDbjDwKFF6z6+mjVBILTKTk8bRmHgU1jtXyz4AvBSh+yvDbjDwKFF6z6+mjVBILTKTk8bRmHgU1jtXyz4AvBSh+yvDbjDwKFF6z6+mjVBILTKTk8bRmHgU1jtXyz4AvBSh+yvDbjDwKFF6z6+mjVBILTKTk8bRmHgU1jtXyz4AvBSh+yvDbjDwKFF6z6+mjVBILTKTk8bRmHgU1jtXyz4AvBSh+yvDbjDwKFF6z6+mjVBILTKTk8bRmHgU1jtXyz4AvBSh+yvDbjDwKFF6z6+mjVBILTKTk8bRmHgU1jtXyz4AvBSh+yvDbjDwKFF6z6+mjVBILTKTk8bRmHgU1jtXyz4AvBSh+yvDbjDwK');
    audio.play().catch(e => console.log('alarm play failed:', e));
  };

  const checkMintLive = async () => {
    try {
      const Web3 = (await import('web3')).default;
      const web3 = new Web3(CHAINS[chain].rpc);
      const price = manualPrice || data.price || '0';
      const totalPrice = parseFloat(price) * amount;
      const value = web3.utils.toWei(totalPrice.toString(), 'ether');

      // try to estimate gas - if it works, mint is live
      if (data.isSeaDrop && data.seaDropAddress) {
        const mintPublicAbi = [{
          inputs: [
            {name: "nftContract", type: "address"},
            {name: "feeRecipient", type: "address"},
            {name: "minterIfNotPayer", type: "address"},
            {name: "quantity", type: "uint256"}
          ],
          name: "mintPublic",
          outputs: [],
          stateMutability: "payable",
          type: "function"
        }];
        const OPENSEA_FEE_RECIPIENT = '0x0000a26b00c1F0DF003000390027140000fAa719';
        const seaDropContract = new web3.eth.Contract(mintPublicAbi, data.seaDropAddress);
        await seaDropContract.methods.mintPublic(contract, OPENSEA_FEE_RECIPIENT, address, String(amount)).estimateGas({ from: address, value: value.toString() });
        return true;
      } else if (data.mintFunctions && data.mintFunctions.length > 0) {
        const func = data.mintFunctions[0];
        const c = new web3.eth.Contract([func], contract);
        let method;
        if (func.inputs.length === 0) {
          method = c.methods[func.name]();
        } else if (func.inputs.length === 1 && func.inputs[0].type.includes('uint')) {
          method = c.methods[func.name](amount);
        }
        if (method) {
          await method.estimateGas({ from: address, value: value.toString() });
          return true;
        }
      }
    } catch (e) {
      return false;
    }
    return false;
  };

  const startAutoMint = () => {
    if (!targetTime) return log('❌ Set target time first', 'error');
    if (!connected || !data) return log('❌ Connect & analyze first', 'error');
    
    setAutoMintMode(true);
    setMonitoring(true);
    log('🎯 Auto mint started', 'success');
    log(`⏰ Target: ${new Date(targetTime).toLocaleString()}`, 'info');

    // countdown timer
    countdownInterval.current = setInterval(() => {
      const now = Date.now();
      const target = new Date(targetTime).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setCountdown('TIME!');
        clearInterval(countdownInterval.current);
        playAlarm();
        mint();
        setMonitoring(false);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setCountdown(`${hours}h ${minutes}m ${seconds}s`);
      }
    }, 1000);

    // monitor for live mint
    monitorInterval.current = setInterval(async () => {
      const isLive = await checkMintLive();
      if (isLive) {
        log('🔥 Mint is LIVE!', 'success');
        clearInterval(monitorInterval.current);
        clearInterval(countdownInterval.current);
        playAlarm();
        mint();
        setMonitoring(false);
      }
    }, 5000); // check every 5 seconds
  };

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <style>{`.glass{background:rgba(255,255,255,0.03);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.1)}.btn-glass{background:rgba(255,255,255,0.05);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.1);transition:all 0.3s}.btn-glass:hover:not(:disabled){background:rgba(255,255,255,0.1);transform:translateY(-2px)}.btn-primary{background:linear-gradient(135deg,rgba(255,255,255,0.15),rgba(255,255,255,0.05));backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.2);transition:all 0.3s}.btn-primary:hover:not(:disabled){background:linear-gradient(135deg,rgba(255,255,255,0.25),rgba(255,255,255,0.15));transform:translateY(-2px)}`}</style>
      <div className="max-w-7xl mx-auto">
        <div className="border-b border-gray-800 pb-6 mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-gradient-to-br from-white/20 to-white/5 rounded-xl flex items-center justify-center text-xl">⚡</div>
                <h1 className="text-3xl font-bold">NFT Mint Bot</h1>
              </div>
              <p className="text-gray-500">Universal NFT minting across all contracts</p>
            </div>
            <select value={chain} onChange={(e) => setChain(e.target.value)} className="glass rounded-xl px-4 py-2 text-sm">
              {Object.entries(CHAINS).map(([k, v]) => <option key={k} value={k} className="bg-black">{v.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="glass rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Wallet className="w-5 h-5"/>Wallet</h2>
              {!connected ? <button onClick={() => setShowWalletModal(true)} className="w-full btn-primary rounded-xl py-3 font-medium">Connect Wallet</button> : <div className="space-y-3"><div className="flex justify-between p-3 glass rounded-xl"><span className="text-gray-400">Address</span><span className="font-mono text-sm">{address.slice(0,6)}...{address.slice(-4)}</span></div><div className="flex justify-between p-3 glass rounded-xl"><span className="text-gray-400">Balance</span><span className="font-semibold">{balance} {CHAINS[chain].symbol}</span></div></div>}
            </div>
            <div className="glass rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4">Contract</h2>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input type="text" value={contract} onChange={(e) => setContract(e.target.value)} placeholder="0x..." className="flex-1 glass rounded-xl px-4 py-2 font-mono text-sm focus:outline-none"/>
                  <button onClick={analyze} disabled={loading} className="btn-primary rounded-xl px-6 py-2 font-medium disabled:opacity-30">{loading ? 'Analyzing...' : 'Analyze'}</button>
                </div>
                <button onClick={() => setShowManual(!showManual)} className="text-xs text-gray-400 hover:text-white">{showManual ? '▼' : '▶'} Manual Price</button>
                {showManual && <input type="text" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} placeholder="0.0012" className="w-full glass rounded-lg px-3 py-2 text-sm focus:outline-none"/>}
                {data && <div className="glass rounded-xl p-4 space-y-3"><div className="pb-3 border-b border-gray-800"><div className="text-lg font-semibold">{data.name}</div><div className="text-sm text-gray-500">{data.symbol}</div></div><div className="grid grid-cols-2 gap-4 text-sm"><div><div className="text-gray-400">Price</div><div className="font-semibold">{data.price} ETH</div></div><div><div className="text-gray-400">Supply</div><div className="font-semibold">{data.supply}/{data.max}</div></div></div></div>}
              </div>
            </div>
            <div className="glass rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4">Mint</h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div><label className="block text-sm text-gray-400 mb-2">Amount</label><input type="number" value={amount} onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 1))} min="1" className="w-full glass rounded-xl px-4 py-2 focus:outline-none"/></div>
                <div><label className="block text-sm text-gray-400 mb-2">Total</label><div className="h-10 flex items-center px-4 glass rounded-xl font-semibold">{data ? (parseFloat(data.price) * amount).toFixed(4) : '0.00'} ETH</div></div>
              </div>
              
              {!autoMintMode && !monitoring && status === 'idle' && (
                <div className="space-y-3">
                  <button onClick={mint} disabled={!data || !connected} className="w-full btn-primary rounded-xl py-3 font-medium disabled:opacity-30">Mint Now</button>
                  <div className="relative">
                    <input 
                      type="datetime-local" 
                      value={targetTime} 
                      onChange={(e) => setTargetTime(e.target.value)}
                      className="w-full glass rounded-xl px-4 py-2 text-sm focus:outline-none"
                      placeholder="Set target time"
                    />
                  </div>
                  <button onClick={startAutoMint} disabled={!data || !connected || !targetTime} className="w-full btn-glass rounded-xl py-3 font-medium disabled:opacity-30">
                    🎯 Start Auto Mint
                  </button>
                </div>
              )}
              
              {monitoring && (
                <div className="space-y-3">
                  <div className="p-4 glass rounded-xl text-center">
                    <div className="text-2xl font-bold text-yellow-400 mb-2">{countdown}</div>
                    <div className="text-sm text-gray-400 animate-pulse">Monitoring & counting down...</div>
                  </div>
                  <button onClick={reset} className="w-full bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-xl py-3 font-medium">
                    Stop Monitoring
                  </button>
                </div>
              )}
              
              {(status === 'success' || status === 'error') && <button onClick={reset} className="w-full btn-glass rounded-xl py-3 font-medium">Reset</button>}
            </div>
          </div>
          <div className="space-y-6">
            <div className="glass rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Clock className="w-5 h-5"/>Status</h2>
              <div className="text-center p-4 glass rounded-xl">
                <div className="flex items-center justify-center gap-2">
                  {status === 'idle' && <div className="w-2 h-2 bg-gray-600 rounded-full"></div>}
                  {status === 'minting' && <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>}
                  {status === 'success' && <CheckCircle2 className="w-5 h-5 text-green-500"/>}
                  {status === 'error' && <AlertCircle className="w-5 h-5 text-red-500"/>}
                  <span className="font-semibold uppercase text-sm">{status}</span>
                </div>
              </div>
              {tx && <div className="mt-4 p-3 glass rounded-xl"><div className="text-xs text-gray-400 mb-1">Transaction</div><a href={`${CHAINS[chain].explorer}/tx/${tx}`} target="_blank" rel="noopener" className="font-mono text-xs break-all hover:text-gray-300 underline">{tx.slice(0,10)}...{tx.slice(-8)}</a></div>}
            </div>
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">Activity</h2>{logs.length > 0 && <button onClick={() => setLogs([])} className="text-xs text-gray-500 hover:text-white">Clear</button>}</div>
              <div className="space-y-2 max-h-96 overflow-y-auto">{logs.length === 0 ? <div className="text-center text-gray-600 py-8 text-sm">No activity</div> : logs.map((l, i) => <div key={i} className="p-2 glass rounded-lg text-xs"><div className="flex gap-2"><span className="text-gray-600 flex-shrink-0">{l.time}</span><span className={`flex-1 ${l.type === 'error' ? 'text-red-500' : l.type === 'success' ? 'text-green-400' : 'text-gray-400'}`}>{l.msg}</span></div></div>)}</div>
            </div>
          </div>
        </div>
        {(monitoring || status !== 'idle' || data) && (
          <div className="mt-8 flex justify-center">
            <button onClick={reset} className="bg-red-500/20 hover:bg-red-500/30 border-2 border-red-500 rounded-xl px-8 py-3 font-bold text-red-500 hover:text-red-400 transition-all">
              🔄 RESET
            </button>
          </div>
        )}
      </div>
      {showWalletModal && <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowWalletModal(false)}><div className="glass rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}><h2 className="text-xl font-bold mb-6">Connect Wallet</h2><div className="space-y-3">{availableWallets.length > 0 ? availableWallets.map(w => <button key={w.uuid} onClick={() => connectWallet(w)} className="w-full btn-glass rounded-xl p-4 flex items-center gap-3 text-left">{w.icon.startsWith('data:') || w.icon.startsWith('http') ? <img src={w.icon} alt={w.name} className="w-8 h-8 rounded-lg"/> : <span className="text-2xl">{w.icon}</span>}<div><div className="font-semibold">{w.name}</div><div className="text-xs text-gray-400">Installed</div></div></button>) : <button onClick={() => connectWallet({name: 'MetaMask', icon: '🦊'})} className="w-full btn-glass rounded-xl p-4 flex items-center gap-3 text-left"><span className="text-2xl">🦊</span><div><div className="font-semibold">MetaMask</div></div></button>}</div></div></div>}
    </div>
  );
}
