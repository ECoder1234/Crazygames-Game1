/* =========================
   CANVAS / SCALING / CAMERA
========================= */
const canvas=document.getElementById("c"),ctx=canvas.getContext("2d");
const GAME_W=1280,GAME_H=720;
let scale=1,offsetX=0,offsetY=0;

// Camera system
const camera={
  x:0,
  y:0,
  targetX:0,
  targetY:0,
  smoothing:0.1
};

function resize(){
  const windowRatio=window.innerWidth/window.innerHeight;
  const gameRatio=GAME_W/GAME_H;
  
  if(windowRatio>gameRatio){
    // Window is wider - fit to height
    canvas.height=window.innerHeight;
    canvas.width=window.innerHeight*gameRatio;
    scale=window.innerHeight/GAME_H;
  }else{
    // Window is taller - fit to width
    canvas.width=window.innerWidth;
    canvas.height=window.innerWidth/gameRatio;
    scale=window.innerWidth/GAME_W;
  }
  
  offsetX=(window.innerWidth-canvas.width)/2;
  offsetY=(window.innerHeight-canvas.height)/2;
  canvas.style.position='absolute';
  canvas.style.left=offsetX+'px';
  canvas.style.top=offsetY+'px';
}

addEventListener("resize",resize);
resize();

/* =========================
   CRAZYGAMES SDK
========================= */
function getCG(){return window.CrazyGames?.SDK||null;}
let sdkReady=false;

async function initSDK(){
  const CG=getCG();
  if(!CG?.init){
    console.warn("CrazyGames SDK not found. Progress will not persist.");
    return;
  }
  try{
    await CG.init();
    sdkReady=true;
    console.log("CrazyGames SDK initialized");
  }catch(e){
    console.warn("SDK init failed:",e);
  }
}

function gameplayStart(){
  const CG=getCG();
  if(sdkReady&&CG?.gameplayStart){
    CG.gameplayStart();
  }
}

function gameplayStop(){
  const CG=getCG();
  if(sdkReady&&CG?.gameplayStop){
    CG.gameplayStop();
  }
}

function happyTime(){
  const CG=getCG();
  if(sdkReady&&CG?.happytime){
    CG.happytime();
  }
}

/* =========================
   SAVE DATA
========================= */
const MAX_UPGRADE_LEVEL=5;
let saveData={
  coins:0,
  bestTimes:{},
  medals:{},
  upgrades:{jump:0,speed:0,coins:0,doubleJump:false},
  lastDaily:null,
  dailyStreak:0,
  tutorialDone:false,
  maxLevel:0,
  completedLevels:[],
  levelSeeds:{},
  gunUnlocked:false,
  gunType:"pulse",
  ownedGuns:[],
  lastLevel:1,
  jumpUse:null,
  speedUse:null,
  soundEnabled:true,
  masterVolume:0.8,
  doubleJumpEnabled:true
};
let allowCloudApply=true;

function sanitizeSave(d){
  if(!d||typeof d!=='object')return;
  if(!Number.isFinite(d.coins)||d.coins<0)d.coins=0;
  d.bestTimes=d.bestTimes||{};
  d.upgrades=d.upgrades||{};
  d.upgrades.jump=Math.min(MAX_UPGRADE_LEVEL,Math.max(0,Math.floor(d.upgrades.jump||0)));
  d.upgrades.speed=Math.min(MAX_UPGRADE_LEVEL,Math.max(0,Math.floor(d.upgrades.speed||0)));
  d.upgrades.coins=Math.min(MAX_UPGRADE_LEVEL,Math.max(0,Math.floor(d.upgrades.coins||0)));
  d.upgrades.doubleJump=!!d.upgrades.doubleJump;
  d.medals=d.medals||{};
  d.tutorialDone=!!d.tutorialDone;
  d.gunUnlocked=!!d.gunUnlocked;
  d.gunType=typeof d.gunType==="string"?d.gunType:"pulse";
  if(Array.isArray(d.ownedGuns)){
    d.ownedGuns=[...new Set(d.ownedGuns.filter(g=>typeof g==="string"))];
  }else{
    d.ownedGuns=[];
  }
  if(d.gunUnlocked&&!d.ownedGuns.includes("pulse")){
    d.ownedGuns.push("pulse");
  }
  d.dailyStreak=Math.max(0,Math.floor(d.dailyStreak||0));
  d.maxLevel=Math.max(0,Math.floor(d.maxLevel||0));
  d.lastLevel=Math.max(1,Math.floor(d.lastLevel||1));
  d.soundEnabled=d.soundEnabled!==false;
  d.masterVolume=Math.min(1,Math.max(0,Number.isFinite(d.masterVolume)?d.masterVolume:0.8));
  d.doubleJumpEnabled=d.doubleJumpEnabled!==false;

  const jumpUse=Number.isFinite(d.jumpUse)?Math.floor(d.jumpUse):d.upgrades.jump;
  d.jumpUse=Math.min(Math.max(jumpUse,0),d.upgrades.jump);
  const speedUse=Number.isFinite(d.speedUse)?Math.floor(d.speedUse):d.upgrades.speed;
  d.speedUse=Math.min(Math.max(speedUse,0),d.upgrades.speed);
  if(Array.isArray(d.completedLevels)){
    const cleaned=d.completedLevels.filter(n=>Number.isFinite(n)&&n>0).map(n=>Math.floor(n));
    d.completedLevels=[...new Set(cleaned)];
  }else{
    d.completedLevels=[];
  }
  if(d.completedLevels.length>0){
    const highest=Math.max(...d.completedLevels);
    if(highest>d.maxLevel)d.maxLevel=highest;
  }
  if(d.levelSeeds&&typeof d.levelSeeds==="object"){
    const cleanedSeeds={};
    Object.keys(d.levelSeeds).forEach(key=>{
      const lvl=parseInt(key,10);
      const val=d.levelSeeds[key];
      if(Number.isFinite(lvl)&&Number.isFinite(val)){
        cleanedSeeds[lvl]=Math.floor(val);
      }
    });
    d.levelSeeds=cleanedSeeds;
  }else{
    d.levelSeeds={};
  }
}

async function loadCloud(){
  const CG=getCG();
  if(!sdkReady||!CG?.data?.get){
    console.warn("CrazyGames data API unavailable. Progress will not persist.");
    return;
  }
  try{
    const d=await CG.data.get("save");
    if(!allowCloudApply)return;
    if(d){
      const obj=typeof d==="string"?JSON.parse(d):d;
      sanitizeSave(obj);
      Object.assign(saveData,obj);
    }
  }catch(e){
    console.warn("Cloud load failed:",e);
  }
}

async function saveCloud(){
  const CG=getCG();
  if(!sdkReady||!CG?.data?.set)return false;
  try{
    await CG.data.set("save",JSON.stringify(saveData));
    return true;
  }catch(e){
    console.warn("Cloud save failed:",e);
    return false;
  }
}

/* =========================
   GAME STATE
========================= */
const STATE={MENU:0,PLAY:1,SHOP:2,SETTINGS:3,RACE_SELECT:4,LEVEL_SELECT:5};
let state=STATE.MENU,mode="CLASSIC";
let raceRounds=10,currentRound=0;

/* =========================
   PHYSICS SYSTEM
========================= */
const PHYSICS={
  gravity:0.6,
  jumpPower:13,
  moveSpeed:6.5,
  dtScale:60
};

/* =========================
   PLAYER
========================= */
const player={x:0,y:0,w:30,h:40,vx:0,vy:0,ground:false,wasGrounded:false,canDoubleJump:false};

/* =========================
   WORLD DATA
========================= */
let platforms=[],portal=null,hazards=[];
let level=1,raceTime=0,totalRaceTime=0;
let ghost=[],ghostRun=[],recording=false;
let levelSeed=0;
let isPaused=false;
let bullets=[];
let gunCooldown=0;
let enemies=[];

/* =========================
   INPUT
========================= */
const keys={};
const preventKeys=new Set(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space"]);
addEventListener("keydown",e=>{
  keys[e.code]=true;
  if(state===STATE.PLAY&&preventKeys.has(e.code)){
    e.preventDefault();
  }
  if(state===STATE.PLAY&&e.code==="KeyP"&&!e.repeat){
    togglePause();
  }
});
addEventListener("keyup",e=>{keys[e.code]=false;});
addEventListener("mousedown",()=>{mouseDown=true;});
addEventListener("mouseup",()=>{mouseDown=false;});

// Touch controls
const touchBtns={left:false,right:false,jump:false,shoot:false};
let isTouch=false;
let mouseDown=false;

function setupTouchControls(){
  const isMobile='ontouchstart'in window||window.innerWidth<768;
  const controls=document.getElementById("controls");
  isTouch=isMobile;
  
  if(isMobile){
    controls.classList.add("active");
    
    const leftBtn=document.getElementById("leftBtn");
    const rightBtn=document.getElementById("rightBtn");
    const jumpBtn=document.getElementById("jumpBtn");
    const shootBtn=document.getElementById("shootBtn");
    
    leftBtn.addEventListener("touchstart",e=>{e.preventDefault();touchBtns.left=true});
    leftBtn.addEventListener("touchend",e=>{e.preventDefault();touchBtns.left=false});
    leftBtn.addEventListener("touchcancel",e=>{e.preventDefault();touchBtns.left=false});
    
    rightBtn.addEventListener("touchstart",e=>{e.preventDefault();touchBtns.right=true});
    rightBtn.addEventListener("touchend",e=>{e.preventDefault();touchBtns.right=false});
    rightBtn.addEventListener("touchcancel",e=>{e.preventDefault();touchBtns.right=false});
    
    jumpBtn.addEventListener("touchstart",e=>{e.preventDefault();touchBtns.jump=true});
    jumpBtn.addEventListener("touchend",e=>{e.preventDefault();touchBtns.jump=false});
    jumpBtn.addEventListener("touchcancel",e=>{e.preventDefault();touchBtns.jump=false});

    if(shootBtn){
      shootBtn.addEventListener("touchstart",e=>{e.preventDefault();touchBtns.shoot=true});
      shootBtn.addEventListener("touchend",e=>{e.preventDefault();touchBtns.shoot=false});
      shootBtn.addEventListener("touchcancel",e=>{e.preventDefault();touchBtns.shoot=false});
    }
  }
  updateTutorialHint();
  updateShootButtonVisibility();
}

/* =========================
   SEEDED RNG
========================= */
class RNG{
  constructor(seed){
    this.s=seed%2147483647;
    if(this.s<=0)this.s+=2147483646;
  }
  next(){
    this.s=(this.s*16807)%2147483647;
    return this.s/2147483647;
  }
}

/* =========================
   JUMP PHYSICS LIMITS
========================= */
function getJumpUse(){
  const max=Math.min(saveData.upgrades.jump||0,MAX_UPGRADE_LEVEL);
  const use=Number.isFinite(saveData.jumpUse)?saveData.jumpUse:max;
  return Math.min(Math.max(use,0),max);
}

function getSpeedUse(){
  const max=Math.min(saveData.upgrades.speed||0,MAX_UPGRADE_LEVEL);
  const use=Number.isFinite(saveData.speedUse)?saveData.speedUse:max;
  return Math.min(Math.max(use,0),max);
}

function getCoinMultiplier(){
  return 1+Math.min(saveData.upgrades.coins||0,MAX_UPGRADE_LEVEL);
}

function computeLimits(){
  const jump=PHYSICS.jumpPower+getJumpUse()*1.5;
  const speedScale=mode==="CLASSIC"?(1+Math.min(level-1,20)*0.015):1.25;
  const spd=(PHYSICS.moveSpeed+getSpeedUse()*0.6)*speedScale;
  const timeToApex=jump/PHYSICS.gravity;
  const maxHeight=(jump**2)/(2*PHYSICS.gravity);
  const airtime=timeToApex*2;
  const maxDistance=spd*airtime*PHYSICS.dtScale*0.85;
  
  return{
    maxUp:maxHeight,
    maxDown:maxHeight*1.4,
    maxDist:maxDistance
  };
}

/* =========================
   REACHABILITY CHECK
========================= */
function canReach(from,to,limits){
  const dx=to.x-(from.x+from.w);
  const dy=from.y-to.y;
  
  if(dx<60||dx>limits.maxDist)return false;
  if(dy>limits.maxUp)return false;
  if(dy<-limits.maxDown)return false;
  
  return true;
}

/* =========================
   LEVEL GENERATOR (GUARANTEED)
========================= */
function getLevelFeatures(levelIndex){
  const movingChance=levelIndex>=5?0.25:0;
  let spikeChance=0;
  if(levelIndex>=15&&levelIndex<30){
    spikeChance=Math.min(0.18+(levelIndex-15)*0.008,0.35);
  }else if(levelIndex>=50){
    spikeChance=Math.min(0.18+(levelIndex-50)*0.008,0.35);
  }
  const orbChance=levelIndex>=25?Math.min(0.16+(levelIndex-25)*0.01,0.32):0;
  const enemyChance=levelIndex>=30?Math.min(0.18+(levelIndex-30)*0.01,0.35):0;
  return{movingChance,spikeChance,orbChance,enemyChance};
}

function generateLevel({
  seed=Date.now(),
  platformCount=10,
  verticalBias=0.72,
  levelIndex=1,
  movingChance=null,
  spikeChance=null,
  orbChance=null,
  enemyChance=null,
  noHazardOnMoving=true,
  singleHazardPerPlatform=true
}={}){
  const rng=new RNG(seed);
  const limits=computeLimits();
  const features=getLevelFeatures(levelIndex);
  const moveChance=movingChance===null?features.movingChance:movingChance;
  const spikeRate=spikeChance===null?features.spikeChance:spikeChance;
  const orbRate=orbChance===null?features.orbChance:orbChance;
  const enemyRate=enemyChance===null?features.enemyChance:enemyChance;
  
  platforms=[];
  hazards=[];
  bullets=[];
  enemies=[];
  gunCooldown=0;
  
  // SPAWN PLATFORM (guaranteed)
  const spawn={
    x:100,
    y:520,
    w:220,
    h:22,
    type:"static"
  };
  platforms.push(spawn);
  
  let last=spawn;
  
  // PLATFORM CHAIN (guaranteed reachable)
  for(let i=0;i<platformCount;i++){
    let next;
    let attempts=0;
    
    do{
      const upBias=rng.next()<verticalBias;
      
      const isMoving=rng.next()<moveChance;
      next={
        x:last.x+90+rng.next()*120,
        y:last.y+(upBias?-1:1)*(35+rng.next()*110),
        w:90+rng.next()*80,
        h:20,
        type:isMoving?"moving":"static",
        startX:0,
        range:0,
        speed:0,
        offset:0,
        prevX:0
      };
      
      // Clamp Y to playable area
      next.y=Math.max(100,Math.min(600,next.y));
      
      if(next.type==="moving"){
        next.startX=next.x;
        next.range=40+rng.next()*70;
        next.speed=(rng.next()<0.5?-1:1)*(0.8+rng.next()*1.6);
        next.offset=rng.next()*Math.PI*2;
        next.prevX=next.x;
      }
      
      attempts++;
    }while(!canReach(last,next,limits)&&attempts<20);
    
    // Fallback if RNG fails (guaranteed reachable)
    if(attempts>=20){
      next={
        x:last.x+100,
        y:last.y-50,
        w:140,
        h:20,
        type:"static",
        startX:0,
        range:0,
        speed:0,
        offset:0,
        prevX:0
      };
    }
    
    platforms.push(next);
    last=next;
    
    // SAFE HAZARD PLACEMENT (never blocks only path)
    const allowHazards=!(noHazardOnMoving&&next.type==="moving");
    if(allowHazards){
      const canSpike=spikeRate>0&&next.w>80;
      const canOrb=orbRate>0&&next.w>110;
      if(singleHazardPerPlatform&&(canSpike||canOrb)){
        const total=spikeRate+orbRate;
        const hazardChance=Math.min(total,1);
        if(rng.next()<hazardChance){
          const pick=rng.next()*total;
          if(canSpike&&pick<spikeRate){
            hazards.push({
              x:next.x+next.w*0.5-14,
              y:next.y-18,
              w:28,
              h:18,
              type:"spike"
            });
          }else if(canOrb){
            const radius=12+rng.next()*8;
            const baseX=next.x+next.w*0.5;
            const baseY=next.y-34;
            hazards.push({
              type:"orb",
              r:radius,
              baseX,
              baseY,
              range:30+rng.next()*60,
              speed:1.2+rng.next()*1.4,
              phase:rng.next()*Math.PI*2,
              x:baseX-radius,
              y:baseY-radius,
              w:radius*2,
              h:radius*2
            });
          }
        }
      }else{
        if(canSpike&&rng.next()<spikeRate){
          hazards.push({
            x:next.x+next.w*0.5-14,
            y:next.y-18,
            w:28,
            h:18,
            type:"spike"
          });
        }
        if(canOrb&&rng.next()<orbRate){
          const radius=12+rng.next()*8;
          const baseX=next.x+next.w*0.5;
          const baseY=next.y-34;
          hazards.push({
            type:"orb",
            r:radius,
            baseX,
            baseY,
            range:30+rng.next()*60,
            speed:1.2+rng.next()*1.4,
            phase:rng.next()*Math.PI*2,
            x:baseX-radius,
            y:baseY-radius,
            w:radius*2,
            h:radius*2
          });
        }
      }
    }

    // ENEMIES (level 30+)
    if(enemyRate>0&&next.type==="static"&&next.w>90&&rng.next()<enemyRate){
      const types=["crawler"];
      if(levelIndex>=35)types.push("hopper");
      if(levelIndex>=40)types.push("floater");
      const enemyType=types[Math.floor(rng.next()*types.length)];
      const baseX=next.x+10+rng.next()*(next.w-40);
      if(enemyType==="floater"){
        const size=26;
        enemies.push({
          type:"floater",
          x:baseX,
          y:next.y-80,
          w:size,
          h:size,
          baseX,
          baseY:next.y-60,
          rangeX:20+rng.next()*40,
          rangeY:14+rng.next()*30,
          speed:0.9+rng.next()*1.1,
          phase:rng.next()*Math.PI*2,
          reward:8
        });
      }else if(enemyType==="hopper"){
        const enemyW=26;
        const enemyH=30;
        enemies.push({
          type:"hopper",
          x:baseX,
          y:next.y-enemyH-2,
          w:enemyW,
          h:enemyH,
          vx:(rng.next()<0.5?-1:1)*(0.9+rng.next()*1.1),
          vy:0,
          minX:next.x+6,
          maxX:next.x+next.w-enemyW-6,
          platformY:next.y,
          jumpTimer:0.6+rng.next()*1.2,
          reward:7
        });
      }else{
        const enemyW=28;
        const enemyH=28;
        enemies.push({
          type:"crawler",
          x:baseX,
          y:next.y-enemyH-2,
          w:enemyW,
          h:enemyH,
          baseX,
          range:20+rng.next()*50,
          speed:0.8+rng.next()*1.2,
          dir:rng.next()<0.5?-1:1,
          platformY:next.y,
          reward:6
        });
      }
    }
  }
  
  // PORTAL (guaranteed reachable)
  portal={
    x:last.x+90,
    y:last.y-50,
    w:40,
    h:60
  };
  
  if(!canReach(last,portal,limits)){
    portal.x=last.x+90;
    portal.y=last.y-40;
  }
  
  // Reset player position
  player.x=spawn.x+20;
  player.y=spawn.y-player.h-4;
  player.vx=player.vy=0;
  player.ground=false;
  
  // Reset camera
  camera.x=0;
  camera.y=0;
  camera.targetX=0;
  camera.targetY=0;
  
  return{seed,spawn,platforms,hazards,portal};
}

function getPlatformCount(levelIndex){
  return Math.min(8+Math.floor(levelIndex*0.4),14);
}

function getLevelSeed(levelIndex){
  const saved=saveData.levelSeeds?.[levelIndex];
  if(saved)return saved;
  return Date.now()+levelIndex*997;
}

function recordLevelCompletion(levelIndex,seed){
  if(!saveData.levelSeeds[levelIndex]){
    saveData.levelSeeds[levelIndex]=seed;
  }
  if(!saveData.completedLevels.includes(levelIndex)){
    saveData.completedLevels.push(levelIndex);
  }
  saveData.completedLevels.sort((a,b)=>a-b);
  if(levelIndex>saveData.maxLevel){
    saveData.maxLevel=levelIndex;
  }
  saveCloud();
}

function setLastLevel(levelIndex,persist=false){
  const safe=Math.max(1,Math.floor(levelIndex||1));
  saveData.lastLevel=safe;
  if(persist)saveCloud();
}

function isGunAvailable(){
  return level>=30||saveData.maxLevel>=30;
}

function getGunCatalog(){
  return{
    pulse:{name:"Pulse",cost:300,ammo:1,cooldown:0.22,speed:16,spread:0,reward:5},
    rapid:{name:"Rapid",cost:500,ammo:1,cooldown:0.12,speed:15,spread:0,reward:4},
    scatter:{name:"Scatter",cost:650,ammo:3,cooldown:0.3,speed:14,spread:0.12,reward:4}
  };
}

function getCurrentGun(){
  const catalog=getGunCatalog();
  const key=saveData.gunType||"pulse";
  return catalog[key]||catalog.pulse;
}

function spawnBullet(){
  const gun=getCurrentGun();
  const baseX=player.x+player.w+4;
  const baseY=player.y+player.h*0.5-2;
  const count=gun.ammo||1;
  const spread=gun.spread||0;
  for(let i=0;i<count;i++){
    const offset=(count===1)?0:(i-(count-1)/2)*spread;
    bullets.push({
      x:baseX,
      y:baseY,
      w:10,
      h:4,
      vx:gun.speed,
      vy:offset*gun.speed,
      reward:gun.reward||5
    });
  }
}

/* =========================
   DAILY REWARD
========================= */
function claimDaily(){
  const today=new Date().toDateString();
  if(saveData.lastDaily===today)return false;
  saveData.coins+=50;
  saveData.lastDaily=today;
  saveCloud();
  return true;
}

function checkDailyReward(){
  const rewards=[50,70,90,110,140,180,250];
  const today=new Date();
  const todayKey=today.toDateString();
  if(saveData.lastDaily===todayKey)return null;

  let streak=saveData.dailyStreak||0;
  if(saveData.lastDaily){
    const lastDate=new Date(saveData.lastDaily);
    const utcToday=Date.UTC(today.getFullYear(),today.getMonth(),today.getDate());
    const utcLast=Date.UTC(lastDate.getFullYear(),lastDate.getMonth(),lastDate.getDate());
    const diffDays=Math.floor((utcToday-utcLast)/86400000);
    if(diffDays===1){
      streak=Math.min(streak+1,rewards.length);
    }else{
      streak=1;
    }
  }else{
    streak=1;
  }

  const reward=rewards[streak-1]||rewards[rewards.length-1];
  saveData.coins+=reward;
  saveData.lastDaily=todayKey;
  saveData.dailyStreak=streak;
  saveCloud();
  return{streak,reward};
}

/* =========================
   TUTORIAL
========================= */
const tutorialEl=document.getElementById("tutorial");
const tutorialHintEl=document.getElementById("tutorialHint");
const tStepMove=document.getElementById("tStepMove");
const tStepJump=document.getElementById("tStepJump");
const tStepGoal=document.getElementById("tStepGoal");
let tutorialActive=false;
let tutorialProgress={moved:false,jumped:false,goal:false};
const modalRoot=document.getElementById("modal");
let modalOpen=false;
const loadingEl=document.getElementById("loading");
const loadingText=document.getElementById("loadingText");
const loadingBar=document.getElementById("loadingBar");
let forceSkipTutorial=false;
let forceTutorial=false;

function initTutorialSteps(){
  [tStepMove,tStepJump,tStepGoal].forEach((el,idx)=>{
    if(!el)return;
    el.dataset.step=String(idx+1);
  });
}

function setStepDone(el,done){
  if(!el)return;
  const badge=el.querySelector(".step-badge");
  if(done){
    el.classList.add("done");
    if(badge)badge.textContent="OK";
  }else{
    el.classList.remove("done");
    if(badge)badge.textContent=el.dataset.step||"";
  }
}

function updateTutorialUI(){
  if(!tutorialActive)return;
  setStepDone(tStepMove,tutorialProgress.moved);
  setStepDone(tStepJump,tutorialProgress.jumped);
  setStepDone(tStepGoal,tutorialProgress.goal);
}

function refreshTutorialVisibility(){
  if(!tutorialEl)return;
  const visible=tutorialActive&&state===STATE.PLAY&&!isPaused&&!modalOpen;
  tutorialEl.classList.toggle("active",visible);
}

function updateTutorialHint(){
  if(!tutorialHintEl)return;
  tutorialHintEl.textContent=isTouch?
    "Use the on-screen buttons to move and jump.":
    "Pause anytime with P. Q/Z also work on AZERTY.";
}

function startTutorial(){
  tutorialActive=true;
  tutorialProgress={moved:false,jumped:false,goal:false};
  updateTutorialUI();
  refreshTutorialVisibility();
}

function completeTutorial(){
  tutorialActive=false;
  saveData.tutorialDone=true;
  saveCloud();
  refreshTutorialVisibility();
}

function maybeStartTutorial(){
  if(mode!=="CLASSIC")return;
  if(forceSkipTutorial){
    forceSkipTutorial=false;
    return;
  }
  if(forceTutorial){
    forceTutorial=false;
    startTutorial();
    return;
  }
  if(saveData.tutorialDone)return;
  startTutorial();
}

const tutorialSkipBtn=document.getElementById("tutorialSkip");
if(tutorialSkipBtn){
  tutorialSkipBtn.onclick=()=>{
    playSound('click');
    completeTutorial();
  };
}

/* =========================
   PAUSE MENU
========================= */
const gameUI=document.getElementById("gameUI");

function showGameUI(){
  gameUI.classList.add("active");
  updatePauseButton();
  document.getElementById("pauseBtn").onclick=()=>{
    playSound('click');
    togglePause();
    updatePauseButton();
  };
  const shopBtn=document.getElementById("shopBtnInGame");
  if(shopBtn){
    shopBtn.onclick=()=>{
      playSound('click');
      isPaused=true;
      updatePauseButton();
      hideGameUI();
      shop(true,false);
    };
  }
  document.getElementById("quitBtn").onclick=()=>{
    playSound('click');
    showConfirm({
      title:"Exit to Main Menu?",
      message:"Progress will be saved.",
      confirmText:"Exit",
      cancelText:"Cancel",
      lockGameplay:true,
      onConfirm:()=>{
        setLastLevel(level,true);
        isPaused=false;
        hideGameUI();
        menu();
      }
    });
  };
}

function updatePauseButton(){
  const btn=document.getElementById("pauseBtn");
  if(btn){
    btn.textContent=isPaused?'Resume (P)':'Pause (P)';
  }
}

function hideGameUI(){
  gameUI.classList.remove("active");
}

function renderPauseMenu(){
  ui.innerHTML=`
    <div class="menu">
      <h1>PAUSED</h1>
      <div class="small">
        ${mode==="CLASSIC"?`Level ${level}`:`Round ${currentRound+1}/${raceRounds}`} | Coins ${saveData.coins}
        ${mode!=="CLASSIC"?`<br>Time: ${totalRaceTime.toFixed(2)}s`:``}
      </div>
      ${(saveData.upgrades.doubleJump&&saveData.doubleJumpEnabled)?'<div class="small" style="color:#4af">Double Jump Enabled (Press Jump in Air)</div>':''}
      <button class="btn" id="resumeBtn">Resume (P)</button>
      <button class="btn" id="restartBtn">Restart Level</button>
      <button class="btn" id="shopPauseBtn">Shop</button>
      <button class="btn alt" id="menuBtn">Main Menu</button>
    </div>`;
  
  document.getElementById("resumeBtn").onclick=()=>{playSound('click');togglePause();};
  document.getElementById("restartBtn").onclick=()=>{
    playSound('click');
    isPaused=false;
    updatePauseButton();
    ui.innerHTML="";
    player.x=platforms[0].x+20;
    player.y=platforms[0].y-player.h-4;
    player.vx=player.vy=0;
    player.ground=false;
    player.canDoubleJump=true;
  };
  document.getElementById("shopPauseBtn").onclick=()=>{
    playSound('click');
    hideGameUI();
    shop(true,true);
  };
  document.getElementById("menuBtn").onclick=()=>{
    playSound('click');
    isPaused=false;
    hideGameUI();
    menu();
  };
}

function togglePause(){
  if(state!==STATE.PLAY)return;
  isPaused=!isPaused;
  updatePauseButton();
  
  if(isPaused){
    renderPauseMenu();
  }else{
    ui.innerHTML="";
  }
  refreshTutorialVisibility();
}

/* =========================
   UI MANAGEMENT
========================= */
const ui=document.getElementById("ui");
const toastEl=document.getElementById("toast");

function setLoading(text,progress){
  if(!loadingEl)return;
  loadingEl.classList.add("active");
  if(loadingText)loadingText.textContent=text||"Loading...";
  if(loadingBar)loadingBar.style.width=`${Math.max(0,Math.min(100,progress||0))}%`;
}

function hideLoading(){
  if(!loadingEl)return;
  loadingEl.classList.remove("active");
}

function showToast(message,duration=2500){
  if(!toastEl)return;
  toastEl.textContent=message;
  toastEl.classList.add("active");
  setTimeout(()=>{toastEl.classList.remove("active");},duration);
}

window.addEventListener("unhandledrejection",e=>{
  console.warn("Unhandled promise:",e.reason);
  e.preventDefault();
});

window.addEventListener("pagehide",()=>{
  if(state===STATE.PLAY){
    setLastLevel(level,true);
  }
});

function updateShootButtonVisibility(){
  const shootBtn=document.getElementById("shootBtn");
  if(!shootBtn)return;
  const show=isTouch&&(saveData.gunUnlocked||saveData.ownedGuns.includes("pulse")||saveData.ownedGuns.includes("rapid")||saveData.ownedGuns.includes("scatter"));
  shootBtn.style.display=show?'flex':'none';
}

function escapeHtml(text){
  return String(text)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/\"/g,"&quot;")
    .replace(/'/g,"&#39;");
}

function formatModalText(text){
  return escapeHtml(text).replace(/\n/g,"<br>");
}

function showModal({title,message,buttons,lockGameplay=false}){
  if(!modalRoot)return;
  const prevPaused=isPaused;
  if(lockGameplay&&state===STATE.PLAY){
    isPaused=true;
    updatePauseButton();
  }

  modalOpen=true;
  modalRoot.classList.add("active");
  modalRoot.innerHTML=`
    <div class="modal-card">
      <h1>${formatModalText(title||"")}</h1>
      <div class="modal-message">${formatModalText(message||"")}</div>
      <div class="modal-actions">
        ${buttons.map((b,i)=>`<button class="btn ${b.variant||""}" id="modalBtn${i}">${escapeHtml(b.label||"OK")}</button>`).join("")}
      </div>
    </div>`;

  buttons.forEach((btn,i)=>{
    const el=document.getElementById(`modalBtn${i}`);
    if(!el)return;
    el.onclick=()=>{
      playSound('click');
      if(btn.onClick)btn.onClick();
      closeModal();
    };
  });

  refreshTutorialVisibility();

  function closeModal(){
    modalRoot.classList.remove("active");
    modalRoot.innerHTML="";
    modalOpen=false;
    if(lockGameplay&&state===STATE.PLAY){
      isPaused=prevPaused;
      updatePauseButton();
    }
    refreshTutorialVisibility();
  }
}

function showInfo({title,message,onClose}){
  showModal({
    title,
    message,
    buttons:[{label:"OK",onClick:onClose}]
  });
}

function showConfirm({title,message,confirmText="Confirm",cancelText="Cancel",onConfirm,onCancel,lockGameplay=false}){
  showModal({
    title,
    message,
    lockGameplay,
    buttons:[
      {label:confirmText,variant:"",onClick:onConfirm},
      {label:cancelText,variant:"alt",onClick:onCancel}
    ]
  });
}

function menu(){
  gameplayStop();
  hideGameUI();
  state=STATE.MENU;
  level=1;
  currentRound=0;
  isPaused=false;
  tutorialActive=false;
  refreshTutorialVisibility();
  
  const startLabel=saveData.lastLevel>1?`Continue Level ${saveData.lastLevel}`:'Start';
  ui.innerHTML=`
  <div class="menu">
    <h1>QUANTUM LEAP: INFINITY</h1>
    <div class="small">Made in HTML5 · Game developed by Ervin</div>
    <button class="btn primary" id="startBtn">${startLabel}</button>
    <button class="btn" id="levelSelectBtn">Level Select &gt;</button>
    <button class="btn" id="tutorialStartBtn">Tutorial</button>
    <button class="btn race" id="raceBtn">Race Mode</button>
    <button class="btn" id="shopBtn">Shop</button>
    <button class="btn alt" id="settingsBtn">Settings</button>
    <div class="small">Coins: ${saveData.coins}</div>
  </div>`;
  
  document.getElementById("startBtn").onclick=()=>{
    playSound('click');
    startClassic();
  };
  document.getElementById("tutorialStartBtn").onclick=()=>{
    playSound('click');
    startClassic({startLevel:1,forceTutorialFlag:true});
  };
  document.getElementById("levelSelectBtn").onclick=()=>{playSound('click');levelSelect();};
  document.getElementById("raceBtn").onclick=()=>{playSound('click');raceSelect();};
  document.getElementById("shopBtn").onclick=()=>{playSound('click');shop();};
  document.getElementById("settingsBtn").onclick=()=>{playSound('click');settings();};
  updateShootButtonVisibility();
}

function levelSelect(){
  state=STATE.LEVEL_SELECT;
  const levels=saveData.completedLevels||[];
  let levelsHtml='';
  if(levels.length>0){
    levels.forEach(lvl=>{
      levelsHtml+=`<button class="level-btn" data-level="${lvl}">${lvl}</button>`;
    });
  }
  ui.innerHTML=`
  <div class="menu">
    <h1>LEVEL SELECT</h1>
    <div class="small">${levels.length>0?'Choose a completed level to replay.':'Finish Level 1 to unlock Level Select.'}</div>
    ${levels.length>0?`<div class="level-grid">${levelsHtml}</div>`:''}
    <button class="btn alt" id="backBtn">Back</button>
  </div>`;
  
  if(levels.length>0){
    ui.querySelectorAll(".level-btn").forEach(btn=>{
      btn.onclick=()=>{
        const lvl=parseInt(btn.dataset.level,10);
        if(!Number.isFinite(lvl))return;
        playSound('click');
        startClassic({startLevel:lvl,skipTutorial:true});
      };
    });
  }
  document.getElementById("backBtn").onclick=()=>{playSound('click');menu();};
}

function raceSelect(){
  state=STATE.RACE_SELECT;
  
  const best5=saveData.bestTimes['race_5']||'--';
  const best10=saveData.bestTimes['race_10']||'--';
  const best25=saveData.bestTimes['race_25']||'--';
  const best50=saveData.bestTimes['race_50']||'--';
  const best100=saveData.bestTimes['race_100']||'--';
  const bestSpeed=saveData.bestTimes['speedrun_50']||'--';
  
  ui.innerHTML=`
  <div class="menu">
    <h1>RACE MODE</h1>
    <h2>Select Challenge</h2>
    <div class="race-option">
      <button class="btn race" id="race5">5 Rounds</button>
      <button class="btn race" id="race10">10 Rounds</button>
      <button class="btn race" id="race25">25 Rounds</button>
      <button class="btn race" id="race50">50 Rounds</button>
      <button class="btn race" id="race100">100 Rounds</button>
      <button class="btn speedrun" id="speedrun50">Speedrun 50</button>
    </div>
    <div class="small">
      <strong>Best Times:</strong><br>
      5R: ${typeof best5==='number'?best5.toFixed(2)+'s':best5} | 
      10R: ${typeof best10==='number'?best10.toFixed(2)+'s':best10} | 
      25R: ${typeof best25==='number'?best25.toFixed(2)+'s':best25}<br>
      50R: ${typeof best50==='number'?best50.toFixed(2)+'s':best50} | 
      100R: ${typeof best100==='number'?best100.toFixed(2)+'s':best100} | 
      Speed50: ${typeof bestSpeed==='number'?bestSpeed.toFixed(2)+'s':bestSpeed}
    </div>
    <button class="btn alt" id="backBtn">Back</button>
  </div>`;
  
  document.getElementById("race5").onclick=()=>{playSound('click');startRace(5);};
  document.getElementById("race10").onclick=()=>{playSound('click');startRace(10);};
  document.getElementById("race25").onclick=()=>{playSound('click');startRace(25);};
  document.getElementById("race50").onclick=()=>{playSound('click');startRace(50);};
  document.getElementById("race100").onclick=()=>{playSound('click');startRace(100);};
  document.getElementById("speedrun50").onclick=()=>{playSound('click');startRace(50,true);};
  document.getElementById("backBtn").onclick=()=>{playSound('click');menu();};
}

function shop(fromGame=false,returnToPause=false){
  const shopFromGame=fromGame||returnToPause;
  if(shopFromGame){
    state=STATE.PLAY;
    isPaused=true;
    updatePauseButton();
  }else{
    state=STATE.SHOP;
  }
  const rerender=()=>shop(fromGame,returnToPause);
  
  const canBuyJump=saveData.coins>=50&&saveData.upgrades.jump<MAX_UPGRADE_LEVEL;
  const canBuySpeed=saveData.coins>=50&&saveData.upgrades.speed<MAX_UPGRADE_LEVEL;
  const canBuyCoins=saveData.coins>=100&&saveData.upgrades.coins<MAX_UPGRADE_LEVEL;
  const canBuyDoubleJump=saveData.coins>=200&&!saveData.upgrades.doubleJump;
  const gunAvailable=isGunAvailable();
  const catalog=getGunCatalog();
  const owned=Array.isArray(saveData.ownedGuns)?saveData.ownedGuns:[];
  const hasPulse=owned.includes("pulse")||saveData.gunUnlocked;
  const hasRapid=owned.includes("rapid");
  const hasScatter=owned.includes("scatter");
  const canBuyGun=gunAvailable&&saveData.coins>=catalog.pulse.cost&&!hasPulse;
  const canBuyRapid=gunAvailable&&saveData.coins>=catalog.rapid.cost&&!hasRapid;
  const canBuyScatter=gunAvailable&&saveData.coins>=catalog.scatter.cost&&!hasScatter;
  
  ui.innerHTML=`
  <div class="menu">
    <h1>Shop</h1>
    <button class="btn" id="jumpBtn" ${canBuyJump?'':'disabled'}>
      Jump Boost (+1.5) - 50 coins<br>
      <small style="opacity:.7">Level ${saveData.upgrades.jump}/${MAX_UPGRADE_LEVEL}</small>
    </button>
    <button class="btn" id="speedBtn" ${canBuySpeed?'':'disabled'}>
      Speed Boost (+0.6) - 50 coins<br>
      <small style="opacity:.7">Level ${saveData.upgrades.speed}/${MAX_UPGRADE_LEVEL}</small>
    </button>
    <button class="btn" id="coinsBtn" ${canBuyCoins?'':'disabled'}>
      Coin Multiplier - 100 coins<br>
      <small style="opacity:.7">Level ${saveData.upgrades.coins}/${MAX_UPGRADE_LEVEL}</small>
    </button>
    <button class="btn ${saveData.upgrades.doubleJump?'race':''}" id="doubleJumpBtn" ${canBuyDoubleJump?'':'disabled'}>
      ${saveData.upgrades.doubleJump?'Double Jump (Owned)':'Double Jump - 200 coins'}
    </button>
    <div class="menu-panel" style="margin-top:10px">
      <h3>Guns</h3>
      <button class="btn ${hasPulse?'race':''}" id="gunBtn" ${canBuyGun?'':'disabled'}>
        ${hasPulse?`${catalog.pulse.name} (Owned)`:`${catalog.pulse.name} - ${catalog.pulse.cost} coins`}<br>
        <small style="opacity:.7">${gunAvailable?'Unlocks shooting at Level 30':'Unlocks at Level 30'}</small>
      </button>
      <button class="btn ${hasRapid?'race':''}" id="rapidBtn" ${canBuyRapid?'':'disabled'}>
        ${hasRapid?`${catalog.rapid.name} (Owned)`:`${catalog.rapid.name} - ${catalog.rapid.cost} coins`}<br>
        <small style="opacity:.7">${gunAvailable?'Faster shots':'Unlocks at Level 30'}</small>
      </button>
      <button class="btn ${hasScatter?'race':''}" id="scatterBtn" ${canBuyScatter?'':'disabled'}>
        ${hasScatter?`${catalog.scatter.name} (Owned)`:`${catalog.scatter.name} - ${catalog.scatter.cost} coins`}<br>
        <small style="opacity:.7">${gunAvailable?'3-shot spread':'Unlocks at Level 30'}</small>
      </button>
      <div class="small">Equipped: ${getCurrentGun().name}</div>
      ${gunAvailable?`<div class="menu-actions">
        <button class="btn alt" id="equipPulse" ${hasPulse?'':'disabled'}>Equip Pulse</button>
        <button class="btn alt" id="equipRapid" ${hasRapid?'':'disabled'}>Equip Rapid</button>
        <button class="btn alt" id="equipScatter" ${hasScatter?'':'disabled'}>Equip Scatter</button>
      </div>`:''}
    </div>
    <button class="btn alt" id="backBtn">Back</button>
    <div class="small">Coins: ${saveData.coins}</div>
  </div>`;
  
  if(canBuyJump){
    document.getElementById("jumpBtn").onclick=()=>{
      playSound('coin');
      saveData.coins-=50;
      const prev=saveData.upgrades.jump;
      saveData.upgrades.jump=Math.min(prev+1,MAX_UPGRADE_LEVEL);
      if(!Number.isFinite(saveData.jumpUse)||saveData.jumpUse>=prev){
        saveData.jumpUse=saveData.upgrades.jump;
      }
      saveCloud();
      rerender();
    };
  }
  
  if(canBuySpeed){
    document.getElementById("speedBtn").onclick=()=>{
      playSound('coin');
      saveData.coins-=50;
      const prev=saveData.upgrades.speed;
      saveData.upgrades.speed=Math.min(prev+1,MAX_UPGRADE_LEVEL);
      if(!Number.isFinite(saveData.speedUse)||saveData.speedUse>=prev){
        saveData.speedUse=saveData.upgrades.speed;
      }
      saveCloud();
      rerender();
    };
  }
  
  if(canBuyCoins){
    document.getElementById("coinsBtn").onclick=()=>{
      playSound('coin');
      saveData.coins-=100;
      saveData.upgrades.coins=Math.min(saveData.upgrades.coins+1,MAX_UPGRADE_LEVEL);
      saveCloud();
      rerender();
    };
  }
  
  if(canBuyDoubleJump){
    document.getElementById("doubleJumpBtn").onclick=()=>{
      playSound('coin');
      saveData.coins-=200;
      saveData.upgrades.doubleJump=true;
      saveData.doubleJumpEnabled=true;
      saveCloud();
      rerender();
    };
  }

  if(canBuyGun){
    document.getElementById("gunBtn").onclick=()=>{
      playSound('coin');
      saveData.coins-=catalog.pulse.cost;
      saveData.gunUnlocked=true;
      if(!saveData.ownedGuns.includes("pulse"))saveData.ownedGuns.push("pulse");
      saveData.gunType="pulse";
      saveCloud();
      updateShootButtonVisibility();
      rerender();
    };
  }
  if(canBuyRapid){
    document.getElementById("rapidBtn").onclick=()=>{
      playSound('coin');
      saveData.coins-=catalog.rapid.cost;
      saveData.ownedGuns.push("rapid");
      saveData.gunType="rapid";
      saveCloud();
      updateShootButtonVisibility();
      rerender();
    };
  }
  if(canBuyScatter){
    document.getElementById("scatterBtn").onclick=()=>{
      playSound('coin');
      saveData.coins-=catalog.scatter.cost;
      saveData.ownedGuns.push("scatter");
      saveData.gunType="scatter";
      saveCloud();
      updateShootButtonVisibility();
      rerender();
    };
  }
  const equipPulse=document.getElementById("equipPulse");
  if(equipPulse){
    equipPulse.onclick=()=>{
      playSound('click');
      saveData.gunType="pulse";
      saveCloud();
      rerender();
    };
  }
  const equipRapid=document.getElementById("equipRapid");
  if(equipRapid){
    equipRapid.onclick=()=>{
      playSound('click');
      saveData.gunType="rapid";
      saveCloud();
      rerender();
    };
  }
  const equipScatter=document.getElementById("equipScatter");
  if(equipScatter){
    equipScatter.onclick=()=>{
      playSound('click');
      saveData.gunType="scatter";
      saveCloud();
      rerender();
    };
  }
  
  document.getElementById("backBtn").onclick=()=>{
    playSound('click');
    if(returnToPause){
      state=STATE.PLAY;
      renderPauseMenu();
      showGameUI();
      return;
    }
    if(fromGame){
      state=STATE.PLAY;
      ui.innerHTML="";
      isPaused=false;
      showGameUI();
      return;
    }
    menu();
  };
}

function settings(){
  state=STATE.SETTINGS;
  const jumpMax=Math.min(saveData.upgrades.jump,MAX_UPGRADE_LEVEL);
  const speedMax=Math.min(saveData.upgrades.speed,MAX_UPGRADE_LEVEL);
  const jumpUse=getJumpUse();
  const speedUse=getSpeedUse();
  const volumePct=Math.round(masterVolume*100);
  const hasAnyGun=saveData.gunUnlocked||saveData.ownedGuns.includes("pulse")||saveData.ownedGuns.includes("rapid")||saveData.ownedGuns.includes("scatter");
  const doubleJumpLabel=saveData.upgrades.doubleJump
    ?`Double Jump: ${saveData.doubleJumpEnabled?'Enabled':'Disabled'}`
    :'Double Jump: Locked';
  
  ui.innerHTML=`
  <div class="menu">
    <h1>Settings</h1>
    <div class="small">
      Upgrades: Jump ${saveData.upgrades.jump}/${MAX_UPGRADE_LEVEL} | Speed ${saveData.upgrades.speed}/${MAX_UPGRADE_LEVEL} | Coins ${saveData.upgrades.coins}/${MAX_UPGRADE_LEVEL}<br>
      Double Jump: ${saveData.upgrades.doubleJump?'Unlocked':'Locked'} | Gun: ${hasAnyGun?'Unlocked':'Locked'}
    </div>
    <div class="settings-list">
      <button class="btn" id="sfxBtn">Sound FX: ${soundEnabled?'ON':'OFF'}</button>
      <div class="settings-row">
        <label for="volumeSlider">Loudness</label>
        <input type="range" min="0" max="100" value="${volumePct}" id="volumeSlider">
        <span class="settings-value" id="volumeValue">${volumePct}%</span>
      </div>
      <div class="settings-row">
        <label for="jumpSlider">Jump Strength</label>
        <input type="range" min="0" max="${jumpMax}" value="${jumpUse}" step="1" id="jumpSlider" ${jumpMax===0?'disabled':''}>
        <span class="settings-value" id="jumpValue">${jumpUse}/${jumpMax}</span>
      </div>
      <div class="settings-row">
        <label for="speedSlider">Speed Strength</label>
        <input type="range" min="0" max="${speedMax}" value="${speedUse}" step="1" id="speedSlider" ${speedMax===0?'disabled':''}>
        <span class="settings-value" id="speedValue">${speedUse}/${speedMax}</span>
      </div>
      <button class="btn" id="doubleJumpToggle" ${saveData.upgrades.doubleJump?'':'disabled'}>${doubleJumpLabel}</button>
      <button class="btn" id="tutorialBtn">${saveData.tutorialDone?'Replay Tutorial':'Continue Tutorial'}</button>
      <button class="btn alt" id="backBtn">Back</button>
    </div>
  </div>`;
  
  document.getElementById("sfxBtn").onclick=()=>{
    playSound('click');
    soundEnabled=!soundEnabled;
    saveData.soundEnabled=soundEnabled;
    if(soundEnabled){
      resumeAudio();
    }
    saveCloud();
    settings();
  };

  const volumeSlider=document.getElementById("volumeSlider");
  if(volumeSlider){
    volumeSlider.oninput=()=>{
      masterVolume=Math.min(Math.max(volumeSlider.value/100,0),1);
      saveData.masterVolume=masterVolume;
      const valueEl=document.getElementById("volumeValue");
      if(valueEl)valueEl.textContent=`${Math.round(masterVolume*100)}%`;
    };
    volumeSlider.onchange=()=>{saveCloud();};
  }

  const jumpSlider=document.getElementById("jumpSlider");
  if(jumpSlider){
    jumpSlider.oninput=()=>{
      saveData.jumpUse=parseInt(jumpSlider.value,10)||0;
      const valueEl=document.getElementById("jumpValue");
      if(valueEl)valueEl.textContent=`${saveData.jumpUse}/${jumpMax}`;
    };
    jumpSlider.onchange=()=>{saveCloud();};
  }

  const speedSlider=document.getElementById("speedSlider");
  if(speedSlider){
    speedSlider.oninput=()=>{
      saveData.speedUse=parseInt(speedSlider.value,10)||0;
      const valueEl=document.getElementById("speedValue");
      if(valueEl)valueEl.textContent=`${saveData.speedUse}/${speedMax}`;
    };
    speedSlider.onchange=()=>{saveCloud();};
  }

  document.getElementById("doubleJumpToggle").onclick=()=>{
    playSound('click');
    if(!saveData.upgrades.doubleJump)return;
    saveData.doubleJumpEnabled=!saveData.doubleJumpEnabled;
    saveCloud();
    settings();
  };
  
  document.getElementById("tutorialBtn").onclick=()=>{
    playSound('click');
    saveData.tutorialDone=false;
    saveCloud();
    showToast("Tutorial will show when Classic starts.");
    settings();
  };
  
  document.getElementById("backBtn").onclick=()=>{playSound('click');menu();};
}

function startClassic({startLevel=Math.max(1,saveData.lastLevel||1),skipTutorial=false,forceTutorialFlag=false}={}){
  mode="CLASSIC";
  state=STATE.PLAY;
  ui.innerHTML="";
  isPaused=false;
  level=startLevel;
  setLastLevel(level,true);
  raceTime=0;
  levelSeed=getLevelSeed(level);
  generateLevel({seed:levelSeed,platformCount:getPlatformCount(level),verticalBias:0.72,levelIndex:level,noHazardOnMoving:true,singleHazardPerPlatform:true});
  showGameUI();
  updateShootButtonVisibility();
  gameplayStart();
  setTimeout(happyTime,1000);
  if(skipTutorial)forceSkipTutorial=true;
  if(forceTutorialFlag)forceTutorial=true;
  maybeStartTutorial();
}

function startRace(rounds,speedrun=false){
  mode=speedrun?"SPEEDRUN":"RACE";
  raceRounds=rounds;
  currentRound=0;
  totalRaceTime=0;
  state=STATE.PLAY;
  ui.innerHTML="";
  isPaused=false;
  raceTime=0;
  ghostRun=[];
  recording=false;
  levelSeed=12345; // Fixed seed for race consistency
  generateLevel({
    seed:levelSeed+currentRound,
    platformCount:10,
    verticalBias:0.7,
    levelIndex:10,
    movingChance:0.3,
    spikeChance:0.25,
    orbChance:0.15,
    noHazardOnMoving:true,
    singleHazardPerPlatform:true
  });
  showGameUI();
  gameplayStart();
  setTimeout(happyTime,1000);
  tutorialActive=false;
  refreshTutorialVisibility();
}

/* =========================
   SOUND SYSTEM
========================= */
const audioCtx=new(window.AudioContext||window.webkitAudioContext)();
let soundEnabled=saveData.soundEnabled;
let masterVolume=saveData.masterVolume;

function syncAudioSettingsFromSave(){
  soundEnabled=saveData.soundEnabled;
  masterVolume=saveData.masterVolume;
}

function playSound(type){
  if(!soundEnabled||!audioCtx)return;
  
  const now=audioCtx.currentTime;
  const osc=audioCtx.createOscillator();
  const gain=audioCtx.createGain();
  const volume=Math.min(Math.max(masterVolume,0),1);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  switch(type){
    case'jump':
      osc.frequency.setValueAtTime(400,now);
      osc.frequency.exponentialRampToValueAtTime(600,now+0.1);
      gain.gain.setValueAtTime(0.3*volume,now);
      gain.gain.exponentialRampToValueAtTime(0.01,now+0.1);
      osc.start(now);
      osc.stop(now+0.1);
      break;
      
    case'land':
      osc.frequency.setValueAtTime(200,now);
      osc.frequency.exponentialRampToValueAtTime(100,now+0.08);
      gain.gain.setValueAtTime(0.2*volume,now);
      gain.gain.exponentialRampToValueAtTime(0.01,now+0.08);
      osc.start(now);
      osc.stop(now+0.08);
      break;
      
    case'portal':
      osc.frequency.setValueAtTime(300,now);
      osc.frequency.exponentialRampToValueAtTime(800,now+0.3);
      gain.gain.setValueAtTime(0.3*volume,now);
      gain.gain.exponentialRampToValueAtTime(0.01,now+0.3);
      osc.type='triangle';
      osc.start(now);
      osc.stop(now+0.3);
      break;
      
    case'death':
      osc.frequency.setValueAtTime(400,now);
      osc.frequency.exponentialRampToValueAtTime(100,now+0.3);
      gain.gain.setValueAtTime(0.25*volume,now);
      gain.gain.exponentialRampToValueAtTime(0.01,now+0.3);
      osc.type='sawtooth';
      osc.start(now);
      osc.stop(now+0.3);
      break;
      
    case'coin':
      osc.frequency.setValueAtTime(800,now);
      osc.frequency.exponentialRampToValueAtTime(1200,now+0.1);
      gain.gain.setValueAtTime(0.2*volume,now);
      gain.gain.exponentialRampToValueAtTime(0.01,now+0.1);
      osc.type='square';
      osc.start(now);
      osc.stop(now+0.1);
      break;
      
    case'click':
      osc.frequency.setValueAtTime(600,now);
      gain.gain.setValueAtTime(0.15*volume,now);
      gain.gain.exponentialRampToValueAtTime(0.01,now+0.05);
      osc.start(now);
      osc.stop(now+0.05);
      break;
      
    case'complete':
      // Victory fanfare
      const notes=[523,659,784,1047];
      notes.forEach((freq,i)=>{
        const o=audioCtx.createOscillator();
        const g=audioCtx.createGain();
        o.connect(g);
        g.connect(audioCtx.destination);
        o.frequency.setValueAtTime(freq,now+i*0.1);
        g.gain.setValueAtTime(0.2*volume,now+i*0.1);
        g.gain.exponentialRampToValueAtTime(0.01,now+i*0.1+0.2);
        o.start(now+i*0.1);
        o.stop(now+i*0.1+0.2);
      });
      return; // Skip normal cleanup
  }
}

// Resume audio context on user interaction (browser requirement)
document.addEventListener('click',()=>{
  resumeAudio();
},{once:true});

document.addEventListener('touchstart',()=>{
  resumeAudio();
},{once:true});

function resumeAudio(){
  if(audioCtx.state==='suspended'){
    audioCtx.resume();
  }
}

/* =========================
   UPDATE & DRAW
========================= */
let gameTime=0;

function updateCamera(){
  // Target camera position (follow player with some offset)
  camera.targetX=player.x+player.w/2-GAME_W/2;
  camera.targetY=player.y+player.h/2-GAME_H/2;
  
  // Smooth camera movement
  camera.x+=(camera.targetX-camera.x)*camera.smoothing;
  camera.y+=(camera.targetY-camera.y)*camera.smoothing;
  
  // Keep some bounds (optional - you can remove this for infinite scrolling)
  camera.x=Math.max(0,camera.x);
  camera.y=Math.max(-200,Math.min(200,camera.y));
}

function update(dt){
  if(state!==STATE.PLAY||isPaused)return;
  dt=Math.min(dt,.05);
  gameTime+=dt;
  
  if(mode==="RACE"||mode==="SPEEDRUN"){
    raceTime+=dt;
    totalRaceTime+=dt;
  }
  
  const jump=PHYSICS.jumpPower+getJumpUse()*1.5;
  const spd=PHYSICS.moveSpeed+getSpeedUse()*0.6;
  
  // Input
  const moveLeft=keys.KeyA||keys.KeyQ||keys.ArrowLeft||touchBtns.left;
  const moveRight=keys.KeyD||keys.ArrowRight||touchBtns.right;
  const jumpPressed=keys.KeyW||keys.KeyZ||keys.Space||keys.ArrowUp||touchBtns.jump;
  const hasAnyGun=saveData.gunUnlocked||saveData.ownedGuns.includes("pulse")||saveData.ownedGuns.includes("rapid")||saveData.ownedGuns.includes("scatter");
  const shootPressed=hasAnyGun&&(keys.KeyF||mouseDown||touchBtns.shoot);

  if(tutorialActive&&(moveLeft||moveRight)){
    tutorialProgress.moved=true;
  }
  
  // Regular jump
  if(jumpPressed&&player.ground){
    player.vy=-jump;
    player.ground=false;
    player.canDoubleJump=true;
    if(tutorialActive)tutorialProgress.jumped=true;
    playSound('jump');
  }
  // Double jump (only if upgrade unlocked and haven't used it yet)
  else if(jumpPressed&&!player.ground&&player.canDoubleJump&&saveData.upgrades.doubleJump&&saveData.doubleJumpEnabled&&!player.lastJumpPressed){
    player.vy=-jump*0.85; // Slightly weaker double jump
    player.canDoubleJump=false;
    if(tutorialActive)tutorialProgress.jumped=true;
    playSound('jump');
  }
  
  // Track jump button state for double jump detection
  player.lastJumpPressed=jumpPressed;

  // Gun shooting
  gunCooldown=Math.max(0,gunCooldown-dt);
  if(shootPressed&&gunCooldown<=0){
    spawnBullet();
    playSound('click');
    gunCooldown=getCurrentGun().cooldown||0.22;
  }
  
  player.vx=moveLeft?-spd:moveRight?spd:0;
  
  player.vy+=PHYSICS.gravity*PHYSICS.dtScale*dt;
  player.x+=player.vx*PHYSICS.dtScale*dt;
  player.y+=player.vy*PHYSICS.dtScale*dt;
  
  // Update moving platforms (track previous position)
  platforms.forEach(p=>{
    if(p.type==="moving"){
      p.prevX=p.x;
      p.x=p.startX+Math.sin(gameTime*p.speed+p.offset)*p.range;
    }
  });

  // Update moving hazards
  hazards.forEach(h=>{
    if(h.type==="orb"){
      const cx=h.baseX+Math.sin(gameTime*h.speed+h.phase)*h.range;
      const cy=h.baseY+Math.cos(gameTime*h.speed*0.7+h.phase)*4;
      h.x=cx-h.r;
      h.y=cy-h.r;
      h.w=h.r*2;
      h.h=h.r*2;
    }
  });

  // Update enemies
  enemies.forEach(e=>{
    if(e.type==="floater"){
      const cx=e.baseX+Math.sin(gameTime*e.speed+e.phase)*e.rangeX;
      const cy=e.baseY+Math.cos(gameTime*e.speed*0.8+e.phase)*e.rangeY;
      e.x=cx;
      e.y=cy;
      return;
    }
    if(e.type==="hopper"){
      e.x+=e.vx*PHYSICS.dtScale*dt;
      if(e.x<e.minX){
        e.x=e.minX;
        e.vx=Math.abs(e.vx);
      }else if(e.x>e.maxX){
        e.x=e.maxX;
        e.vx=-Math.abs(e.vx);
      }
      e.jumpTimer-=dt;
      e.vy+=PHYSICS.gravity*0.85*PHYSICS.dtScale*dt;
      e.y+=e.vy*PHYSICS.dtScale*dt;
      const floorY=e.platformY-e.h-2;
      if(e.y>=floorY){
        e.y=floorY;
        e.vy=0;
        if(e.jumpTimer<=0){
          e.vy=-9.5;
          e.jumpTimer=0.8+Math.random()*1.2;
        }
      }
      return;
    }
    // crawler
    e.x+=e.dir*e.speed*PHYSICS.dtScale*dt;
    if(e.x<e.baseX-e.range){
      e.x=e.baseX-e.range;
      e.dir=1;
    }else if(e.x>e.baseX+e.range){
      e.x=e.baseX+e.range;
      e.dir=-1;
    }
    e.y=e.platformY-e.h-2;
  });

  // Update bullets and handle orb/enemy hits
  if(bullets.length){
    const nextBullets=[];
    hazards.forEach(h=>{h.hit=false;});
    enemies.forEach(e=>{e.hit=false;});
    for(const b of bullets){
      b.x+=b.vx*PHYSICS.dtScale*dt;
      b.y+=b.vy*PHYSICS.dtScale*dt;
      if(b.x>camera.x+GAME_W+100)continue;
      let hit=false;
      for(const h of hazards){
        if(h.type!=="orb"||h.hit)continue;
        if(b.x+b.w>h.x&&b.x<h.x+h.w&&b.y+b.h>h.y&&b.y<h.y+h.h){
          h.hit=true;
          hit=true;
          saveData.coins+=(b.reward||5)*getCoinMultiplier();
          playSound('coin');
          break;
        }
      }
      if(!hit){
        for(const e of enemies){
          if(e.hit)continue;
          if(b.x+b.w>e.x&&b.x<e.x+e.w&&b.y+b.h>e.y&&b.y<e.y+e.h){
            e.hit=true;
            hit=true;
            const reward=e.reward||6;
            saveData.coins+=reward*getCoinMultiplier();
            playSound('coin');
            break;
          }
        }
      }
      if(!hit)nextBullets.push(b);
    }
    bullets=nextBullets;
    hazards=hazards.filter(h=>!h.hit);
    enemies=enemies.filter(e=>!e.hit);
  }
  
  // Collision detection
  player.ground=false;
  let standingPlatform=null;
  
  for(const p of platforms){
    if(player.x+player.w>p.x&&player.x<p.x+p.w&&
       player.y+player.h>p.y&&player.y+player.h<p.y+p.h+8&&player.vy>=0){
      player.y=p.y-player.h;
      player.vy=0;
      player.ground=true;
      player.canDoubleJump=true; // Reset double jump on landing
      standingPlatform=p;
      
      if(!player.wasGrounded){
        playSound('land');
      }
    }
  }
  
  // Move with platform (only horizontal delta)
  if(standingPlatform&&standingPlatform.type==="moving"&&standingPlatform.prevX!==undefined){
    const platformDelta=standingPlatform.x-standingPlatform.prevX;
    player.x+=platformDelta;
  }
  
  player.wasGrounded=player.ground;
  
  // Hazard collision
  for(const h of hazards){
    if(player.x+player.w>h.x&&player.x<h.x+h.w&&
       player.y+player.h>h.y&&player.y<h.y+h.h){
      // Reset to spawn (NO auto-jump)
      playSound('death');
      player.x=platforms[0].x+20;
      player.y=platforms[0].y-player.h-4;
      player.vx=0;
      player.vy=0;
      player.ground=false;
      player.canDoubleJump=true;
    }
  }

  // Enemy collision
  for(const e of enemies){
    if(player.x+player.w>e.x&&player.x<e.x+e.w&&
       player.y+player.h>e.y&&player.y<e.y+e.h){
      playSound('death');
      player.x=platforms[0].x+20;
      player.y=platforms[0].y-player.h-4;
      player.vx=0;
      player.vy=0;
      player.ground=false;
      player.canDoubleJump=true;
    }
  }
  
  // Fall death
  if(player.y>900){
    playSound('death');
    player.x=platforms[0].x+20;
    player.y=platforms[0].y-player.h-4;
    player.vx=0;
    player.vy=0;
    player.ground=false;
    player.canDoubleJump=true;
  }
  
  // Update camera
  updateCamera();
  
  // Portal collision
  if(portal&&
     player.x<portal.x+portal.w&&player.x+player.w>portal.x&&
     player.y<portal.y+portal.h&&player.y+player.h>portal.y){
    
    if(mode==="CLASSIC"){
      playSound('portal');
      if(tutorialActive){
        tutorialProgress.goal=true;
        updateTutorialUI();
        completeTutorial();
        saveData.coins+=10*getCoinMultiplier();
        recordLevelCompletion(level,levelSeed);
        level++;
        setLastLevel(level,true);
        showToast("Tutorial complete. Returning to menu.");
        menu();
        return;
      }
      saveData.coins+=10*getCoinMultiplier();
      recordLevelCompletion(level,levelSeed);
      level++;
      setLastLevel(level,true);
      levelSeed=getLevelSeed(level);
      generateLevel({seed:levelSeed,platformCount:getPlatformCount(level),verticalBias:0.72,levelIndex:level,noHazardOnMoving:true,singleHazardPerPlatform:true});
    }else{
      // Race/Speedrun mode
      currentRound++;
      
      if(currentRound>=raceRounds){
        // Race complete!
        playSound('complete');
        const raceKey=mode==="SPEEDRUN"?'speedrun_50':`race_${raceRounds}`;
        
        if(!saveData.bestTimes[raceKey]||totalRaceTime<saveData.bestTimes[raceKey]){
          saveData.bestTimes[raceKey]=totalRaceTime;
        }
        
        saveData.coins+=raceRounds*5*getCoinMultiplier();
        saveCloud();

        isPaused=true;
        const reward=raceRounds*5*getCoinMultiplier();
        setTimeout(()=>{
          showInfo({
            title:"Race Complete",
            message:`Time: ${totalRaceTime.toFixed(2)}s\nBest: ${saveData.bestTimes[raceKey].toFixed(2)}s\n+${reward} coins`,
            onClose:()=>{
              isPaused=false;
              menu();
            }
          });
        },300);
      }else{
        // Next round
        playSound('portal');
        generateLevel({
          seed:levelSeed+currentRound,
          platformCount:10,
          verticalBias:0.7,
          levelIndex:10,
          movingChance:0.3,
          spikeChance:0.25,
          orbChance:0.15,
          noHazardOnMoving:true,
          singleHazardPerPlatform:true
        });
      }
    }
  }

  if(tutorialActive){
    updateTutorialUI();
  }
}

function draw(){
  // Clear entire canvas
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle="#000";
  ctx.fillRect(0,0,canvas.width,canvas.height);
  
  // Scale to game resolution and apply camera transform
  ctx.save();
  ctx.scale(scale,scale);
  ctx.translate(-camera.x,-camera.y);
  
  if(state===STATE.PLAY){
    // Background (scrolling parallax)
    const bgGrad=ctx.createLinearGradient(camera.x,camera.y,camera.x,camera.y+GAME_H);
    bgGrad.addColorStop(0,"#050510");
    bgGrad.addColorStop(1,"#0a0a20");
    ctx.fillStyle=bgGrad;
    ctx.fillRect(camera.x,camera.y,GAME_W,GAME_H);
    
    // Draw stars (parallax background)
    ctx.fillStyle="rgba(255,255,255,0.3)";
    for(let i=0;i<50;i++){
      const starX=camera.x+(i*137%GAME_W);
      const starY=camera.y+(i*193%GAME_H);
      ctx.fillRect(starX,starY,2,2);
    }
    
    // Platforms
    platforms.forEach(p=>{
      ctx.fillStyle=p.type==="moving"?"#f39c12":"#2ecc71";
      ctx.fillRect(p.x,p.y,p.w,p.h);
      
      // Platform shine
      ctx.fillStyle="rgba(255,255,255,0.2)";
      ctx.fillRect(p.x,p.y,p.w,4);
    });
    
    // Hazards
    hazards.forEach(h=>{
      if(h.type==="orb"){
        const cx=h.x+h.r;
        const cy=h.y+h.r;
      const grad=ctx.createRadialGradient(cx,cy,2,cx,cy,h.r);
      grad.addColorStop(0,"#ffb3b3");
      grad.addColorStop(1,"#e53935");
      ctx.fillStyle=grad;
      ctx.beginPath();
      ctx.arc(cx,cy,h.r,0,Math.PI*2);
      ctx.fill();
      ctx.strokeStyle="rgba(255,255,255,0.6)";
      ctx.lineWidth=2;
      ctx.beginPath();
      ctx.arc(cx,cy,h.r-4,0,Math.PI*2);
      ctx.stroke();
      }else{
        ctx.fillStyle="#e74c3c";
        ctx.beginPath();
        ctx.moveTo(h.x+h.w/2,h.y);
        ctx.lineTo(h.x+h.w,h.y+h.h);
        ctx.lineTo(h.x,h.y+h.h);
        ctx.closePath();
        ctx.fill();
      }
    });

    // Enemies
    enemies.forEach(e=>{
      if(e.type==="floater"){
        ctx.fillStyle="#38bdf8";
        ctx.beginPath();
        ctx.arc(e.x+e.w/2,e.y+e.h/2,e.w/2,0,Math.PI*2);
        ctx.fill();
        ctx.strokeStyle="rgba(255,255,255,0.6)";
        ctx.lineWidth=2;
        ctx.stroke();
        return;
      }
      if(e.type==="hopper"){
        ctx.fillStyle="#a855f7";
      }else{
        ctx.fillStyle="#ff7a18";
      }
      ctx.fillRect(e.x,e.y,e.w,e.h);
      ctx.fillStyle="rgba(0,0,0,0.3)";
      ctx.fillRect(e.x+4,e.y+6,6,6);
      ctx.fillRect(e.x+e.w-10,e.y+6,6,6);
    });

    // Bullets
    if(bullets.length){
      ctx.fillStyle="#f5f5f5";
      bullets.forEach(b=>{
        ctx.fillRect(b.x,b.y,b.w,b.h);
      });
    }
    
    // Portal
    if(portal){
      const portalGrad=ctx.createLinearGradient(portal.x,portal.y,portal.x,portal.y+portal.h);
      portalGrad.addColorStop(0,"#9b59ff");
      portalGrad.addColorStop(1,"#6a1bb3");
      ctx.fillStyle=portalGrad;
      ctx.fillRect(portal.x,portal.y,portal.w,portal.h);
      
      // Portal glow
      ctx.strokeStyle="rgba(155,89,255,0.5)";
      ctx.lineWidth=3;
      ctx.strokeRect(portal.x-2,portal.y-2,portal.w+4,portal.h+4);
    }
    
    // Player
    ctx.fillStyle="#4af";
    ctx.fillRect(player.x,player.y,player.w,player.h);
    
    // Player eyes
    ctx.fillStyle="#fff";
    ctx.fillRect(player.x+8,player.y+10,6,6);
    ctx.fillRect(player.x+16,player.y+10,6,6);
    
    // Double jump indicator
    if(saveData.upgrades.doubleJump&&saveData.doubleJumpEnabled&&player.canDoubleJump&&!player.ground){
      ctx.fillStyle="rgba(155,89,255,0.6)";
      ctx.beginPath();
      ctx.arc(player.x+player.w/2,player.y+player.h+8,6,0,Math.PI*2);
      ctx.fill();
      ctx.strokeStyle="#9b59ff";
      ctx.lineWidth=2;
      ctx.stroke();
    }
  }else{
    // Menu background
    const bgGrad=ctx.createLinearGradient(0,0,0,GAME_H);
    bgGrad.addColorStop(0,"#050510");
    bgGrad.addColorStop(1,"#0a0a20");
    ctx.fillStyle=bgGrad;
    ctx.fillRect(0,0,GAME_W,GAME_H);
  }
  
  ctx.restore();
  
  // HUD
  if(state===STATE.PLAY){
    let hudText='';
    if(mode==="CLASSIC"){
      hudText=`Level ${level} | Coins ${saveData.coins}`;
      if(saveData.upgrades.doubleJump&&saveData.doubleJumpEnabled){
        hudText+=` | Double Jump`;
      }
      if(saveData.gunUnlocked||saveData.ownedGuns.includes("pulse")||saveData.ownedGuns.includes("rapid")||saveData.ownedGuns.includes("scatter")){
        hudText+=` | ${getCurrentGun().name} (F)`;
      }
    }else{
      hudText=`Round ${currentRound+1}/${raceRounds} | Time: ${totalRaceTime.toFixed(2)}s`;
      if(saveData.upgrades.doubleJump&&saveData.doubleJumpEnabled){
        hudText+=`\nDouble Jump`;
      }
    }
    document.getElementById("hud").textContent=hudText;
  }else{
    document.getElementById("hud").textContent='';
  }
}

/* =========================
   GAME LOOP
========================= */
let last=0;
function loop(t){
  const dt=(t-last)/1000;
  last=t;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

/* =========================
   INITIALIZATION
========================= */
async function init(){
  const hardLimit=setTimeout(()=>{
    setLoading("Ready",100);
    hideLoading();
  },4500);
  setLoading("Initializing...",10);
  try{
    await initSDK();
  }catch(e){
    console.warn("SDK init failed:",e);
  }

  setLoading("Loading save data...",55);
  allowCloudApply=true;
  const cloudTimeout=new Promise(resolve=>{
    setTimeout(()=>{
      allowCloudApply=false;
      resolve("timeout");
    },3000);
  });
  try{
    await Promise.race([loadCloud(),cloudTimeout]);
  }catch(e){
    console.warn("Cloud load failed:",e);
  }
  syncAudioSettingsFromSave();

  setLoading("Preparing world...",80);
  try{
    initTutorialSteps();
    setupTouchControls();
    startClassic();
    const daily=checkDailyReward();
    if(daily){
      showToast(`Daily Reward Day ${daily.streak}: +${daily.reward} coins`);
    }
  }catch(e){
    console.warn("Init UI failed:",e);
    startClassic({startLevel:1});
  }
  setLoading("Ready",100);

  clearTimeout(hardLimit);
  setTimeout(hideLoading,350);
  requestAnimationFrame(loop);
}

init();
