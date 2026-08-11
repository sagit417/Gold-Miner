import { useEffect, useRef, useState } from 'react';
import { useAccount, useConnect, useDisconnect, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain } from 'wagmi';
import { injected } from 'wagmi/connectors';
import GameCanvas from './components/GameCanvas';
import { GameEngine } from './game/GameEngine';
import { MINING_GAME_ABI, MINING_GAME_ADDRESS } from './contracts';

function App() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address });

  const [gameState, setGameState] = useState<any>(null);
  const [engine] = useState(() => new GameEngine());
  const [screen, setScreen] = useState<'HOME' | 'PLAYING' | 'COMPLETE' | 'OVER'>('HOME');
  const [showWallet, setShowWallet] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Contract Reads
  const { data: canCheckIn } = useReadContract({
    address: MINING_GAME_ADDRESS as `0x${string}`,
    abi: MINING_GAME_ABI,
    functionName: 'canCheckIn',
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address }
  });

  const { data: playerStats, refetch: refetchPlayerStats } = useReadContract({
    address: MINING_GAME_ADDRESS as `0x${string}`,
    abi: MINING_GAME_ABI,
    functionName: 'getPlayer',
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address }
  });

  const { data: leaderboard } = useReadContract({
    address: MINING_GAME_ADDRESS as `0x${string}`,
    abi: MINING_GAME_ABI,
    functionName: 'getLeaderboard',
  });

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  // Handle transaction success
  useEffect(() => {
    if (isConfirmed) {
      alert('Transaction Successful!');
      refetchPlayerStats();
    }
  }, [isConfirmed, refetchPlayerStats]);

  // Network check
  useEffect(() => {
    if (isConnected && chainId !== 8453 && switchChain) {
      try {
        switchChain({ chainId: 8453 });
      } catch (e) {
        console.error(e);
      }
    }
  }, [isConnected, chainId, switchChain]);

  // Game Loop updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (engine.state) {
        setGameState({
          score: engine.state.score,
          level: engine.state.level,
          targetScore: engine.state.targetScore,
          timeLeft: engine.state.timeLeft,
          lives: engine.state.lives,
          bombs: engine.state.bombs,
          levelComplete: engine.state.levelComplete,
          gameOver: engine.state.gameOver,
        });

        if (engine.state.levelComplete && screen === 'PLAYING') {
          setScreen('COMPLETE');
          engine.state.playing = false;
        } else if (engine.state.gameOver && screen === 'PLAYING') {
          setScreen('OVER');
          engine.state.playing = false;
        }
      }
    }, 100);
    return () => clearInterval(interval);
  }, [engine, screen]);

  // Audio Context Setup
  const audioCtxRef = useRef<AudioContext | null>(null);
  
  useEffect(() => {
    engine.onPlaySound = (type) => {
      if (!soundEnabled) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === 'fire') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'grab') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'coin') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'complete') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.setValueAtTime(500, now + 0.1);
        osc.frequency.setValueAtTime(600, now + 0.2);
        osc.frequency.setValueAtTime(800, now + 0.3);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      } else if (type === 'over') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      } else if (type === 'bomb') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.3);
        gain.gain.setValueAtTime(0.8, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    };
  }, [engine, soundEnabled]);

  const startGame = () => {
    if (!isConnected) return;
    if (chainId !== 8453 && switchChain) {
      try { switchChain({ chainId: 8453 }); } catch (e) { console.error(e) }
    }
    setScreen('PLAYING');
    engine.initLevel(1, false);
    
    // Apply bonuses if any
    if (playerStats) {
      // playerStats returns [personalBest, totalScore, lastCheckIn, currentStreak, bonusBombs, bonusStars]
      const [, , , , bonusBombs, bonusStars] = playerStats as any;
      engine.state.bombs += Number(bonusBombs);
      engine.state.lives += Number(bonusStars);
    }
    
    engine.state.playing = true;
  };

  const nextLevel = () => {
    setScreen('PLAYING');
    engine.initLevel(engine.state.level + 1, true);
    engine.state.playing = true;
  };

  const submitScoreOnChain = () => {
    if (!isConnected) return;
    writeContract({
      address: MINING_GAME_ADDRESS as `0x${string}`,
      abi: MINING_GAME_ABI,
      functionName: 'submitScore',
      args: [gameState.score, gameState.level]
    } as any);
  };

  const doDailyCheckIn = () => {
    if (!isConnected) return;
    writeContract({
      address: MINING_GAME_ADDRESS as `0x${string}`,
      abi: MINING_GAME_ABI,
      functionName: 'dailyCheckIn',
    } as any);
  };

  return (
    <div className="app-container">
      {/* TOP BAR */}
      <div className="top-bar">
        <div className="top-bar-left">
          {/* Logo or empty */}
        </div>
        <div className="top-bar-center">
          🏆 {playerStats ? Number((playerStats as any)[1]) : 0}
        </div>
        <div className="top-bar-right">
          <button className="icon-btn" onClick={() => setSoundEnabled(!soundEnabled)}>
            {soundEnabled ? '🔊' : '🔇'}
          </button>
          <button className="icon-btn" onClick={() => setShowWallet(!showWallet)}>
            👤
          </button>
        </div>
      </div>

      {showWallet && (
        <div className="wallet-popup">
          {isConnected ? (
            <>
              <div className="wallet-popup-addr">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </div>
              <div>Balance: {balance ? (Number(balance.value) / 10**balance.decimals).toFixed(4) : '0'} ETH</div>
              <button className="btn-secondary" onClick={() => disconnect()}>Disconnect</button>
            </>
          ) : (
            <>
              <div>Not Connected</div>
              <button className="btn-primary" onClick={() => connect({ connector: injected() })}>Connect Wallet</button>
            </>
          )}
        </div>
      )}

      {/* MAIN AREA */}
      <div className="main-area">
        {/* SIDEBAR */}
        <div className="sidebar">
          <div className="sidebar-stat" style={{ justifyContent: 'space-between' }}>
            <span>Level</span> <span>{gameState?.level || 1}</span>
          </div>
          <div className="sidebar-stat">
            <span className="icon">💵</span> {gameState?.score || 0}
          </div>
          <div className="sidebar-stat">
            <span className="icon">🎯</span> {gameState?.targetScore || 300}
          </div>
          
          <div className="miner-container">
            <div className="miner-cage">
              <div className="miner-character"></div>
              <div className="miner-arm"></div>
            </div>
          </div>

          <div className="sidebar-stat" style={{ cursor: 'pointer', background: gameState?.bombs > 0 ? 'rgba(255,100,100,0.2)' : '' }} onClick={() => engine.useBomb()}>
            <span className="icon">💣</span> ×{gameState?.bombs || 0}
          </div>
          <div className="sidebar-stat">
            <span className="icon">⭐</span> {gameState?.lives || 1}
          </div>
          <div className="sidebar-stat" style={{ color: gameState?.timeLeft <= 10 ? '#ff4b2b' : 'white' }}>
            <span className="icon">⏳</span> {gameState?.timeLeft || 60}s
          </div>
        </div>

        {/* PLAY FIELD */}
        <GameCanvas engine={engine} />
      </div>

      {/* OVERLAYS */}
      {screen === 'HOME' && (
        <div className="overlay">
          <div className="overlay-content">
            <h1>Base Gold Miner</h1>
            {isConnected ? (
              <>
                {canCheckIn && (
                  <div className="daily-banner" onClick={doDailyCheckIn}>
                    🎁 Daily Check-In Available!
                  </div>
                )}
                {playerStats && (
                  <p>Personal Best: {Number((playerStats as any)[0])} | Streak: {Number((playerStats as any)[3])}</p>
                )}
                <button className="btn-primary" onClick={startGame}>PLAY</button>
                <button className="btn-secondary">🏆 Leaderboard</button>
              </>
            ) : (
              <>
                <p>Please connect your wallet to play.</p>
                <button className="btn-primary" onClick={() => connect({ connector: injected() })}>Connect Wallet</button>
              </>
            )}
          </div>
        </div>
      )}

      {screen === 'COMPLETE' && (
        <div className="overlay">
          <div className="overlay-content">
            <h1>Level {gameState?.level} Complete!</h1>
            <p>Score: {gameState?.score} / {gameState?.targetScore}</p>
            <p>Stars Earned: {gameState?.score >= gameState?.targetScore + 300 ? 3 : gameState?.score >= gameState?.targetScore + 150 ? 2 : 1} ⭐</p>
            <button className="btn-primary" onClick={nextLevel}>Next Level</button>
          </div>
        </div>
      )}

      {screen === 'OVER' && (
        <div className="overlay">
          <div className="overlay-content">
            <h1>Game Over</h1>
            <p>Final Score: {gameState?.score}</p>
            <p>Level Reached: {gameState?.level}</p>
            
            {isPending || isConfirming ? (
              <button className="btn-primary" disabled>Transaction Pending...</button>
            ) : (
              <button className="btn-primary" onClick={submitScoreOnChain}>Submit Score On-Chain</button>
            )}
            
            <button className="btn-secondary" onClick={startGame}>Try Again</button>
            
            {leaderboard && (
              <div style={{ marginTop: '20px', textAlign: 'left', background: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '10px' }}>
                <h3 style={{ marginBottom: '10px' }}>Top Miners</h3>
                {(leaderboard as any[]).slice(0, 3).map((entry, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span>{i + 1}. {entry.playerAddr.slice(0,6)}...</span>
                    <span>{Number(entry.totalScore)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
