export type ItemType = 'Nugget' | 'Coin' | 'Rock' | 'Mystery';

export interface Item {
  id: string;
  type: ItemType;
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
  weight: number;
  grabbed: boolean;
  color: string;
}

export interface GameState {
  score: number;
  level: number;
  targetScore: number;
  timeLeft: number;
  lives: number;
  bombs: number;
  hookAngle: number;       // In radians
  hookAngleDir: number;    // Direction of pendulum swing (1 or -1)
  hookLength: number;      // Current length of hook line
  hookState: 'SWINGING' | 'FIRING' | 'REELING';
  grabbedItem: Item | null;
  items: Item[];
  gameOver: boolean;
  levelComplete: boolean;
  playing: boolean;
  minerPos: { x: number, y: number };
}

const MIN_ANGLE = -Math.PI / 4;   // -45 degrees
const MAX_ANGLE = Math.PI + Math.PI / 4;    // 225 degrees (Wait, straight down is Math.PI / 2. Let's say 0 is right, Math.PI is left)
// Let's use standard canvas angles: 0 is Right, PI/2 is Down, PI is Left
// Miner is on the left wall, looking right. 
// So hook swings from straight down (PI/2) to straight right (0) or slightly up (-PI/8).
// Let's set swing from -10 degrees to 90 degrees (straight down)
const SWING_MIN = -Math.PI / 10;
const SWING_MAX = Math.PI / 2 + Math.PI / 10;
const HOOK_SPEED_FIRE = 400; // pixels per second
const HOOK_SPEED_REEL_EMPTY = 350;
const MAX_HOOK_LENGTH = 1500; // Needs to be long enough to reach bottom right of screen

export class GameEngine {
  public state: GameState;
  private canvasWidth: number = 0;
  private canvasHeight: number = 0;
  private lastTime: number = 0;
  private timerInterval: any = null;
  
  public onPlaySound?: (sound: 'fire' | 'grab' | 'coin' | 'complete' | 'over' | 'bomb') => void;

  constructor() {
    this.state = this.getInitialState();
  }

  private getInitialState(): GameState {
    return {
      score: 0,
      level: 1,
      targetScore: 300,
      timeLeft: 60,
      lives: 1, // Start with 1, wait, prompt says start with 1 star? "⭐ icon + stars/lives count (e.g. "1")"
      bombs: 0,
      hookAngle: Math.PI / 4,
      hookAngleDir: 1,
      hookLength: 30, // Start length
      hookState: 'SWINGING',
      grabbedItem: null,
      items: [],
      gameOver: false,
      levelComplete: false,
      playing: false,
      minerPos: { x: 50, y: 150 }, // Fixed position on left wall
    };
  }

  public initLevel(level: number, keepScore: boolean = true) {
    if (!keepScore) {
      this.state.score = 0;
      this.state.lives = 1;
      this.state.bombs = 0;
    }
    this.state.level = level;
    this.state.targetScore = 300 + (level - 1) * 150;
    this.state.timeLeft = 60;
    this.state.hookState = 'SWINGING';
    this.state.hookLength = 30;
    this.state.grabbedItem = null;
    this.state.levelComplete = false;
    this.state.gameOver = false;
    
    this.generateItems();
    
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.state.playing && !this.state.levelComplete && !this.state.gameOver) {
        this.state.timeLeft -= 1;
        if (this.state.timeLeft <= 0) {
          this.handleTimeout();
        }
      }
    }, 1000);
  }

  public setDimensions(w: number, h: number) {
    this.canvasWidth = w;
    this.canvasHeight = h;
    this.state.minerPos = { x: 50, y: h / 4 };
  }

  private generateItems() {
    this.state.items = [];
    const numNuggets = 2 + Math.floor(Math.random() * 2);
    const numRocks = 3 + Math.floor(Math.random() * 2);
    const numBags = 2;
    const numCoins = 4 + Math.floor(Math.random() * 3);

    // Spawn area: Avoid miner, avoid too high
    const minX = 150;
    const maxX = Math.max(minX + 100, this.canvasWidth - 50);
    const minY = this.state.minerPos.y + 50;
    const maxY = Math.max(minY + 100, this.canvasHeight - 50);

    const spawn = (type: ItemType, w: number, h: number, valMin: number, valMax: number, weight: number, color: string) => {
      this.state.items.push({
        id: Math.random().toString(),
        type,
        x: minX + Math.random() * (maxX - minX),
        y: minY + Math.random() * (maxY - minY),
        width: w,
        height: h,
        value: Math.floor(valMin + Math.random() * (valMax - valMin)),
        weight,
        grabbed: false,
        color
      });
    };

    for (let i=0; i<numNuggets; i++) spawn('Nugget', 60, 50, 200, 400, 1.5, '#ffcc00');
    for (let i=0; i<numRocks; i++) spawn('Rock', 50, 40, 5, 15, 3.5, '#888888');
    for (let i=0; i<numBags; i++) spawn('Mystery', 40, 45, 0, 0, 1.5, '#a0522d');
    for (let i=0; i<numCoins; i++) spawn('Coin', 20, 20, 10, 30, 0.5, '#ffee55');
  }

  public fire() {
    if (this.state.hookState === 'SWINGING') {
      this.state.hookState = 'FIRING';
      if (this.onPlaySound) this.onPlaySound('fire');
    }
  }

  public useBomb() {
    if (this.state.bombs > 0 && this.state.hookState === 'REELING' && this.state.grabbedItem) {
      this.state.bombs -= 1;
      this.state.grabbedItem = null;
      if (this.onPlaySound) this.onPlaySound('bomb');
    }
  }

  private handleTimeout() {
    if (this.state.score >= this.state.targetScore) {
      this.state.levelComplete = true;
      if (this.onPlaySound) this.onPlaySound('complete');
    } else {
      // Failed
      this.state.lives -= 1;
      if (this.state.lives < 0) {
        this.state.gameOver = true;
        if (this.onPlaySound) this.onPlaySound('over');
      } else {
        // Try again overlay handled by UI, pausing game
        this.state.playing = false;
      }
    }
  }

  public update(deltaTime: number) {
    if (!this.state.playing || this.state.levelComplete || this.state.gameOver) return;
    const dt = deltaTime / 1000;

    if (this.state.hookState === 'SWINGING') {
      const swingSpeed = 1.5;
      this.state.hookAngle += swingSpeed * this.state.hookAngleDir * dt;
      if (this.state.hookAngle > SWING_MAX) {
        this.state.hookAngle = SWING_MAX;
        this.state.hookAngleDir = -1;
      } else if (this.state.hookAngle < SWING_MIN) {
        this.state.hookAngle = SWING_MIN;
        this.state.hookAngleDir = 1;
      }
    } 
    else if (this.state.hookState === 'FIRING') {
      this.state.hookLength += HOOK_SPEED_FIRE * dt;
      
      // Check collision
      const hx = this.state.minerPos.x + Math.cos(this.state.hookAngle) * this.state.hookLength;
      const hy = this.state.minerPos.y + Math.sin(this.state.hookAngle) * this.state.hookLength;

      // Bound check
      if (hx < 0 || hx > this.canvasWidth || hy > this.canvasHeight || this.state.hookLength > MAX_HOOK_LENGTH) {
        this.state.hookState = 'REELING';
      }

      // Item collision
      for (const item of this.state.items) {
        if (!item.grabbed) {
          const dx = hx - item.x;
          const dy = hy - item.y;
          // Simple circle collision approx
          if (Math.sqrt(dx*dx + dy*dy) < item.width / 2 + 10) {
            item.grabbed = true;
            this.state.grabbedItem = item;
            this.state.hookState = 'REELING';
            if (this.onPlaySound) this.onPlaySound('grab');
            break;
          }
        }
      }
    }
    else if (this.state.hookState === 'REELING') {
      let speed = HOOK_SPEED_REEL_EMPTY;
      if (this.state.grabbedItem) {
        speed = HOOK_SPEED_REEL_EMPTY / this.state.grabbedItem.weight;
      }
      this.state.hookLength -= speed * dt;
      
      if (this.state.grabbedItem) {
        this.state.grabbedItem.x = this.state.minerPos.x + Math.cos(this.state.hookAngle) * this.state.hookLength;
        this.state.grabbedItem.y = this.state.minerPos.y + Math.sin(this.state.hookAngle) * this.state.hookLength;
      }

      if (this.state.hookLength <= 30) {
        this.state.hookLength = 30;
        this.state.hookState = 'SWINGING';
        
        if (this.state.grabbedItem) {
          this.processGrabbedItem();
        }
      }
    }
    
    if (this.state.score >= this.state.targetScore) {
       // Target met but wait for time to run out? The prompt: "If timer hits 0 before reaching target -> FAILED. If player reaches target score before timer hits 0 -> LEVEL COMPLETE"
       // Oh, wait, "before timer hits 0 -> LEVEL COMPLETE". Does it end immediately or let them play?
       // Usually it lets them play until timer is 0, or maybe it completes instantly?
       // Let's just let the timer count down to maximize score. The prompt says "If player reaches target score before timer hits 0 -> LEVEL COMPLETE screen with stars earned (based on how much OVER target)". This implies they play until timer 0, and AT timer 0 it checks if score >= target.
       // Let's adjust handleTimeout to do that.
    }
  }

  private processGrabbedItem() {
    const item = this.state.grabbedItem!;
    if (item.type === 'Mystery') {
      const r = Math.random();
      if (r < 0.25) {
        this.state.bombs += 1;
        // Float text "+1 Bomb"
      } else if (r < 0.5) {
        this.state.lives += 1;
      } else if (r < 0.75) {
        this.state.score += 150;
      } else {
        this.state.score = Math.max(0, this.state.score - 20);
      }
    } else {
      this.state.score += item.value;
    }
    
    this.state.items = this.state.items.filter(i => i.id !== item.id);
    this.state.grabbedItem = null;
    if (this.onPlaySound) this.onPlaySound('coin');
  }

  public dispose() {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }
}
