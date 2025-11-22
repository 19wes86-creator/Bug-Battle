import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { Button } from './components/Button';
import { BugCard } from './components/BugCard';
import { StatBar } from './components/StatBar';
import { AppView, Bug, User, BattleLog } from './types';
import { analyzeBugImage, simulateBattle } from './services/geminiService';
import { getBugs, saveBug, logoutUser, updateBug, registerUser, authenticateUser, updateUserSession, observeAuthState } from './services/storageService';
import { Camera, Upload, RefreshCw, ShieldCheck, Crown, Skull, Zap, HeartPulse, X, Swords, Trophy, Bug as BugIcon, AlertCircle } from 'lucide-react';

const App: React.FC = () => {
  // -- State --
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<AppView>(AppView.AUTH);
  const [allBugs, setAllBugs] = useState<Bug[]>([]);
  const [myBugs, setMyBugs] = useState<Bug[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  
  // Auth Form State
  const [authMode, setAuthMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [insult, setInsult] = useState<string | null>(null);

  // Battle State
  const [selectedFighter, setSelectedFighter] = useState<Bug | null>(null);
  const [opponent, setOpponent] = useState<Bug | null>(null);
  const [battleLog, setBattleLog] = useState<BattleLog | null>(null);
  const [isBattling, setIsBattling] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // -- Effects --

  // Auth Listener
  useEffect(() => {
    const unsubscribe = observeAuthState((currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        if (!currentUser.isVerified) {
          setView(AppView.VERIFY_EMAIL);
        } else {
          // Only switch to dashboard if we are currently on an auth screen
          if (view === AppView.AUTH || view === AppView.VERIFY_EMAIL) {
             setView(AppView.DASHBOARD);
          }
        }
        refreshData(currentUser.id);
      } else {
        setView(AppView.AUTH);
        setAllBugs([]);
        setMyBugs([]);
      }
    });
    return () => unsubscribe();
  }, [view]); // Added view as dep to handle redirects correctly

  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [battleLog]);

  const refreshData = async (userId?: string) => {
    setLoadingData(true);
    try {
      const bugs = await getBugs();
      setAllBugs(bugs);
      const currentUserId = userId || user?.id;
      if (currentUserId) {
        setMyBugs(bugs.filter(b => b.ownerId === currentUserId));
      }
    } catch (e) {
      console.error("Failed to load data", e);
    } finally {
      setLoadingData(false);
    }
  };

  // -- Handlers --

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    
    try {
      if (authMode === 'SIGNUP') {
        const newUserBase: User = {
          id: '', // ID assigned by service
          email,
          username,
          password, // Used for local fallback, ignored by Firebase logic if passed separately
          isVerified: false
        };
        await registerUser(newUserBase, password);
        // Listener will handle state update
      } else {
        await authenticateUser(email, password);
        // Listener will handle state update
      }
    } catch (err: any) {
      setAuthError(err.message || "Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerify = async () => {
    if (user) {
      const updated = { ...user, isVerified: true };
      await updateUserSession(updated);
      // Listener will handle state update
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    // Listener handles the rest
    setEmail('');
    setPassword('');
    setUsername('');
    setAuthError(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setAnalysisResult(null);
        setInsult(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedImage) return;
    setAnalyzing(true);
    setUploadError(null);

    try {
      const result = await analyzeBugImage(selectedImage);
      
      if (result.isBug && result.data) {
        setAnalysisResult(result.data);
      } else {
        setInsult(result.insult || "That's not a bug, that's a mistake.");
      }
    } catch (err) {
      setUploadError("Communication with the Hive Mind failed. Try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirmSubmission = async () => {
    if (!analysisResult || !user) return;
    
    const newBug: Bug = {
      id: Date.now().toString(), // In Firebase mode this might be overwritten or used as doc ID
      ownerId: user.id,
      ownerName: user.username,
      species: analysisResult.species,
      description: analysisResult.description,
      imageUrl: selectedImage!,
      stats: analysisResult.stats,
      // HP Calculation based on stats
      maxHp: 100 + (analysisResult.stats.size * 0.5) + (analysisResult.stats.stamina * 0.5),
      currentHp: 100 + (analysisResult.stats.size * 0.5) + (analysisResult.stats.stamina * 0.5),
      wins: 0,
      losses: 0,
      createdAt: Date.now()
    };

    await saveBug(newBug);
    await refreshData();
    setSelectedImage(null);
    setAnalysisResult(null);
    setView(AppView.MY_BUGS);
  };

  const initBattle = async () => {
    if (!selectedFighter) return;
    
    // Find random opponent that isn't mine and isn't dead
    // Ensure we have fresh data
    const freshBugs = await getBugs(); 
    setAllBugs(freshBugs);
    
    const pool = freshBugs.filter(b => b.ownerId !== user?.id && b.currentHp > 0);
    
    if (pool.length === 0) {
      alert("No worthy opponents found (or everyone is dead). Upload more bugs to populate the arena!");
      return;
    }
    
    const randomOpponent = pool[Math.floor(Math.random() * pool.length)];
    setOpponent(randomOpponent);
    setIsBattling(true);
    setBattleLog(null);

    // Simulate delay for suspense
    setTimeout(async () => {
      const result = await simulateBattle(selectedFighter, randomOpponent);
      setBattleLog(result);
      
      // Determine Winner and Loser objects
      // Note: currentHp in selectedFighter/randomOpponent might be stale if we didn't refresh, 
      // but for the logic we use the calc.
      
      const winnerRef = result.winnerId === selectedFighter.id ? selectedFighter : randomOpponent;
      const loserRef = result.winnerId === selectedFighter.id ? randomOpponent : selectedFighter;
      
      // Calculate new HPs
      const winnerNewHp = Math.max(0, Math.round(winnerRef.currentHp - result.damageDealtToWinner));
      const loserNewHp = Math.max(0, Math.round(loserRef.currentHp - result.damageDealtToLoser));

      const winnerUpdated = {
        ...winnerRef,
        currentHp: winnerNewHp,
        wins: winnerRef.wins + 1
      };
      
      const loserUpdated = {
        ...loserRef,
        currentHp: loserNewHp,
        losses: loserRef.losses + 1
      };

      // Save to DB
      await Promise.all([
        updateBug(winnerUpdated),
        updateBug(loserUpdated)
      ]);

      refreshData(); // Refresh background data
      
      // Update local selected state to reflect damage immediately in UI
      if (result.winnerId === selectedFighter.id) setSelectedFighter(winnerUpdated);
      else setSelectedFighter(loserUpdated);

    }, 2000);
  };

  // -- Renders --

  const renderAuth = () => (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
        {/* Cyber Background */}
        <div className="absolute inset-0 z-0">
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black opacity-80"></div>
             <div className="grid grid-cols-8 gap-1 opacity-10 h-full w-full transform -skew-x-12 scale-150">
                {[...Array(30)].map((_,i) => <div key={i} className="bg-green-500 h-full w-1 animate-pulse" style={{animationDelay: `${Math.random() * 2}s`}}></div>)}
             </div>
        </div>

      <div className="bg-slate-900/80 backdrop-blur-xl border border-green-500/30 p-8 rounded-2xl w-full max-w-md relative z-10 shadow-[0_0_50px_rgba(34,197,94,0.1)]">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 font-['Orbitron'] tracking-wider">BUG <span className="text-green-500">BATTLER</span></h1>
          <p className="text-slate-400 text-sm">Upload. Analyze. Dominate.</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {authError && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded text-sm flex items-center gap-2 animate-pulse">
              <AlertCircle size={16} /> {authError}
            </div>
          )}

          {authMode === 'SIGNUP' && (
            <div>
              <label className="block text-xs font-bold text-green-500 uppercase mb-1">Agent Name</label>
              <input
                type="text"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded px-4 py-3 text-white focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-all"
                placeholder="Ex: BeetleJuice"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-green-500 uppercase mb-1">Secure Frequency (Email)</label>
            <input
              type="email"
              required
              className="w-full bg-slate-800 border border-slate-700 rounded px-4 py-3 text-white focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-all"
              placeholder="name@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-green-500 uppercase mb-1">Access Code</label>
            <input
              type="password"
              required
              className="w-full bg-slate-800 border border-slate-700 rounded px-4 py-3 text-white focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-all"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          
          <Button type="submit" className="w-full mt-6" isLoading={authLoading}>
            {authMode === 'LOGIN' ? 'Enter System' : 'Initialize Agent'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => {
              setAuthMode(authMode === 'LOGIN' ? 'SIGNUP' : 'LOGIN');
              setAuthError(null);
            }}
            className="text-xs text-slate-400 hover:text-green-400 underline decoration-dotted underline-offset-4"
          >
            {authMode === 'LOGIN' ? "Need clearance? Register now." : "Already an agent? Login."}
          </button>
        </div>
      </div>
    </div>
  );

  const renderVerify = () => (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-slate-900">
      <div className="bg-slate-800 p-8 rounded-xl max-w-md text-center border border-yellow-500/50 shadow-lg">
        <ShieldCheck size={64} className="mx-auto text-yellow-500 mb-6" />
        <h2 className="text-2xl font-bold text-white mb-2">Verification Required</h2>
        <p className="text-slate-400 mb-6">
          A verification signal has been sent to <span className="text-green-400">{email}</span>. 
          Confirm your biological signature to proceed.
        </p>
        <Button onClick={handleVerify} className="w-full">Verify Identity</Button>
        <button onClick={handleLogout} className="mt-4 text-xs text-slate-500 hover:text-white">Abort</button>
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="p-4 max-w-4xl mx-auto space-y-8 pb-24 pt-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white font-['Orbitron']">WELCOME BACK, <span className="text-green-500">{user?.username}</span></h1>
        <p className="text-slate-400 mt-2">The arena is active. {allBugs.length} combatants detected globally.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 flex flex-col items-center text-center hover:border-green-500/50 transition-colors cursor-pointer group" onClick={() => setView(AppView.UPLOAD)}>
          <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center mb-4 group-hover:bg-green-500/20 group-hover:text-green-400 transition-all">
             <Camera size={32} />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Recruit Bug</h3>
          <p className="text-sm text-slate-400">Scan a new specimen to add to your army.</p>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 flex flex-col items-center text-center hover:border-red-500/50 transition-colors cursor-pointer group" onClick={() => setView(AppView.BATTLE_ARENA)}>
          <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center mb-4 group-hover:bg-red-500/20 group-hover:text-red-400 transition-all">
             <Swords size={32} />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Enter Arena</h3>
          <p className="text-sm text-slate-400">Pit your best fighters against the world.</p>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Trophy className="text-yellow-500" size={20} /> Top Fighters
          </h2>
          <span className="text-xs text-green-500 cursor-pointer hover:underline" onClick={() => setView(AppView.HALL_OF_FAME)}>View All</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
           {loadingData ? (
              <div className="col-span-full text-center py-4 text-slate-500">Syncing database...</div>
           ) : allBugs.length > 0 ? (
             allBugs.sort((a,b) => b.wins - a.wins).slice(0, 3).map(bug => (
               <BugCard key={bug.id} bug={bug} compact />
             ))
           ) : (
             <div className="col-span-full py-8 text-center text-slate-500 bg-slate-800/30 rounded-xl border border-dashed border-slate-700">
               No fighters recorded in the databanks yet. Recruit some bugs!
             </div>
           )}
        </div>
      </div>
    </div>
  );

  const renderUpload = () => (
    <div className="p-4 max-w-2xl mx-auto pb-24 pt-8 flex flex-col items-center">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Upload /> RECRUIT SPECIMEN</h2>
      
      {!selectedImage ? (
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-64 border-2 border-dashed border-slate-600 rounded-2xl flex flex-col items-center justify-center bg-slate-800/30 hover:bg-slate-800/50 hover:border-green-500 cursor-pointer transition-all group"
        >
          <Camera size={48} className="text-slate-500 group-hover:text-green-500 mb-4 transition-colors" />
          <p className="text-slate-400 font-medium">Tap to Capture or Upload Bug Photo</p>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            className="hidden" 
            accept="image/*" 
            capture="environment"
          />
        </div>
      ) : (
        <div className="w-full space-y-6">
          <div className="relative rounded-xl overflow-hidden border border-slate-600 shadow-2xl">
            <img src={selectedImage} alt="Preview" className="w-full max-h-96 object-cover" />
            {analyzing && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-sm">
                 <RefreshCw size={48} className="text-green-500 animate-spin mb-4" />
                 <p className="text-green-400 font-mono animate-pulse">ANALYZING DNA SEQUENCE...</p>
              </div>
            )}
            
            {insult && (
               <div className="absolute inset-0 bg-red-900/90 flex flex-col items-center justify-center p-8 text-center backdrop-blur-md">
                 <Skull size={64} className="text-white mb-4" />
                 <h3 className="text-3xl font-bold text-white mb-2 font-['Orbitron']">REJECTED</h3>
                 <p className="text-xl text-red-200 font-bold italic mb-6">"{insult}"</p>
                 <Button variant="secondary" onClick={() => setSelectedImage(null)}>Try Again, Bozo</Button>
               </div>
            )}
          </div>

          {!analyzing && !analysisResult && !insult && (
            <div className="flex gap-4">
               <Button onClick={() => setSelectedImage(null)} variant="secondary" className="flex-1">Retake</Button>
               <Button onClick={handleAnalyze} className="flex-1">Analyze Specimen</Button>
            </div>
          )}

          {analysisResult && (
            <div className="bg-slate-800 p-6 rounded-xl border border-green-500 animate-in slide-in-from-bottom-4 fade-in duration-500">
              <h3 className="text-2xl font-bold text-green-400 mb-1">{analysisResult.species}</h3>
              <p className="text-slate-300 text-sm mb-4 italic">{analysisResult.description}</p>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                {Object.entries(analysisResult.stats).map(([key, val]) => (
                  <StatBar key={key} label={key} value={val as number} />
                ))}
              </div>

              <Button onClick={handleConfirmSubmission} className="w-full">
                Confirm & Add to Swarm
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderMyBugs = () => (
    <div className="p-4 max-w-6xl mx-auto pb-24 pt-8">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><BugIcon /> MY SWARM</h2>
      
      {myBugs.length === 0 ? (
        <div className="text-center py-20 bg-slate-800/30 rounded-xl border border-dashed border-slate-700">
          <p className="text-slate-400 mb-4">You have no bugs. Are you a pacifist?</p>
          <Button onClick={() => setView(AppView.UPLOAD)}>Recruit Now</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {myBugs.map(bug => (
            <div key={bug.id} className="relative">
               <BugCard bug={bug} />
               {bug.currentHp === 0 && (
                 <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-xl pointer-events-none">
                   <span className="text-red-500 font-black text-4xl rotate-12 border-4 border-red-500 px-4 py-2 rounded opacity-80">KIA</span>
                 </div>
               )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderArena = () => (
    <div className="min-h-screen bg-black p-4 pb-24 pt-4 flex flex-col">
      {!isBattling ? (
        <>
          <h2 className="text-2xl font-bold mb-4 text-center text-red-500 font-['Orbitron'] flex items-center justify-center gap-2"><Swords /> BATTLE ARENA</h2>
          <p className="text-center text-slate-400 mb-8">Select your champion</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto w-full">
            {myBugs.filter(b => b.currentHp > 0).map(bug => (
              <BugCard 
                key={bug.id} 
                bug={bug} 
                selectable 
                selected={selectedFighter?.id === bug.id}
                onClick={() => setSelectedFighter(bug)} 
              />
            ))}
            {myBugs.filter(b => b.currentHp > 0).length === 0 && (
               <div className="col-span-full text-center py-10">
                 <p className="text-red-400 mb-4">All your bugs are dead or you have none.</p>
                 <Button onClick={() => setView(AppView.UPLOAD)}>Get More Bugs</Button>
               </div>
            )}
          </div>

          {selectedFighter && (
            <div className="fixed bottom-20 left-0 w-full p-4 flex justify-center bg-gradient-to-t from-black to-transparent">
              <Button onClick={initBattle} variant="danger" className="w-full max-w-md text-xl py-4 shadow-[0_0_30px_rgba(220,38,38,0.6)]">
                FIGHT!
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
           {/* Battle Header */}
           <div className="flex justify-between items-center mb-4 bg-slate-900/80 p-2 rounded-lg border border-slate-700">
              <div className="text-left w-1/3">
                <div className="font-bold text-green-500 truncate">{selectedFighter?.species}</div>
                <div className="h-2 bg-slate-700 rounded-full mt-1 overflow-hidden">
                  <div className="bg-green-500 h-full transition-all duration-500" style={{width: `${(selectedFighter!.currentHp / selectedFighter!.maxHp) * 100}%`}}></div>
                </div>
              </div>
              <div className="text-center w-1/3 font-['Orbitron'] text-red-500 font-bold text-xl animate-pulse">VS</div>
              <div className="text-right w-1/3">
                 <div className="font-bold text-red-400 truncate">{opponent?.species}</div>
                 <div className="h-2 bg-slate-700 rounded-full mt-1 overflow-hidden">
                   <div className="bg-red-500 h-full transition-all duration-500" style={{width: `${(opponent!.currentHp / opponent!.maxHp) * 100}%`}}></div>
                 </div>
              </div>
           </div>

           {/* Visuals */}
           <div className="flex-1 relative flex items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-[url('https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center">
             <div className="absolute inset-0 bg-black/70"></div>
             
             {/* Fighter 1 */}
             <div className={`absolute left-4 md:left-12 bottom-12 w-32 md:w-48 transition-all duration-500 ${battleLog ? 'translate-x-0' : '-translate-x-full'}`}>
               <img src={selectedFighter?.imageUrl} className="w-full h-32 md:h-48 object-cover rounded-full border-4 border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.6)]" />
             </div>

             {/* Fighter 2 */}
             <div className={`absolute right-4 md:right-12 top-12 w-32 md:w-48 transition-all duration-500 ${battleLog ? 'translate-x-0' : 'translate-x-full'}`}>
               <img src={opponent?.imageUrl} className="w-full h-32 md:h-48 object-cover rounded-full border-4 border-red-500 shadow-[0_0_30px_rgba(220,38,38,0.6)]" />
             </div>

             {/* Loading State */}
             {!battleLog && (
                <div className="relative z-10 text-center">
                   <div className="text-6xl mb-4 animate-bounce">⚔️</div>
                   <h3 className="text-2xl font-bold text-white animate-pulse">SIMULATING COMBAT...</h3>
                   <p className="text-slate-400">Calculating chitin density & venom potency...</p>
                </div>
             )}

             {/* Battle Log Overlay */}
             {battleLog && (
               <div className="absolute inset-x-4 bottom-4 top-4 overflow-y-auto bg-black/60 backdrop-blur-md rounded-xl border border-slate-700 p-4" ref={scrollRef}>
                 <div className="space-y-3">
                    {battleLog.log.map((line, i) => (
                      <p key={i} className="text-sm md:text-base text-white font-mono border-l-2 border-yellow-500 pl-2 py-1 animate-in fade-in slide-in-from-left-2 duration-300" style={{animationDelay: `${i * 200}ms`}}>
                        {line}
                      </p>
                    ))}
                    <div className="pt-4 text-center border-t border-slate-600 mt-4">
                      <h3 className="text-3xl font-black font-['Orbitron'] text-yellow-400 mb-2">
                        {battleLog.winnerId === selectedFighter?.id ? 'VICTORY' : 'DEFEAT'}
                      </h3>
                      <p className="text-slate-300">
                        Winner: <span className="font-bold text-white">{battleLog.winnerId === selectedFighter?.id ? selectedFighter?.species : opponent?.species}</span>
                      </p>
                    </div>
                 </div>
               </div>
             )}
           </div>

           {/* Actions */}
           {battleLog && (
             <div className="mt-4 flex gap-4">
               <Button onClick={() => { setIsBattling(false); setSelectedFighter(null); setBattleLog(null); }} variant="secondary" className="w-full">Return to Locker Room</Button>
               <Button onClick={() => { setBattleLog(null); initBattle(); }} className="w-full">Rematch (New Opponent)</Button>
             </div>
           )}
        </div>
      )}
    </div>
  );

  const renderHallOfFame = () => (
    <div className="p-4 max-w-4xl mx-auto pb-24 pt-8">
      <h2 className="text-3xl font-bold mb-8 text-center text-yellow-500 font-['Orbitron'] drop-shadow-lg">HALL OF FAME</h2>
      
      <div className="space-y-4">
        {loadingData ? (
           <div className="text-center text-slate-500">Accessing global leaderboards...</div>
        ) : allBugs.sort((a,b) => b.wins - a.wins).map((bug, index) => (
          <div key={bug.id} className="flex items-center bg-slate-800 p-4 rounded-xl border border-slate-700 hover:border-yellow-500/50 transition-colors">
             <div className={`font-bold text-2xl w-12 text-center ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-slate-300' : index === 2 ? 'text-amber-600' : 'text-slate-600'}`}>
               #{index + 1}
             </div>
             <img src={bug.imageUrl} className="w-12 h-12 rounded-full object-cover mx-4 border border-slate-600" />
             <div className="flex-1">
                <h4 className="font-bold text-white">{bug.nickname || bug.species}</h4>
                <p className="text-xs text-slate-400">Trainer: {bug.ownerName}</p>
             </div>
             <div className="text-right px-4">
                <div className="font-bold text-green-400 text-lg">{bug.wins} W</div>
                <div className="text-xs text-red-400">{bug.losses} L</div>
             </div>
          </div>
        ))}
      </div>
    </div>
  );

  // -- Main Render --

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-['Rajdhani']">
      {view === AppView.AUTH && renderAuth()}
      {view === AppView.VERIFY_EMAIL && renderVerify()}
      
      {view !== AppView.AUTH && view !== AppView.VERIFY_EMAIL && (
        <>
          <main className="min-h-screen">
            {view === AppView.DASHBOARD && renderDashboard()}
            {view === AppView.UPLOAD && renderUpload()}
            {view === AppView.MY_BUGS && renderMyBugs()}
            {view === AppView.BATTLE_ARENA && renderArena()}
            {view === AppView.HALL_OF_FAME && renderHallOfFame()}
          </main>
          <Navbar user={user} currentView={view} setView={setView} onLogout={handleLogout} />
        </>
      )}
    </div>
  );
};

export default App;