(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const hint = document.querySelector("#startHint");
  hint.classList.add("hidden");
  const backgroundMusic = new Audio("assets/audio/moss-and-memory.mp3?v=20260828-1");
  const caveMusic = new Audio("assets/audio/the-hollows-watch-remastered.mp3?v=20260829-1");
  const playerHurtSound = new Audio("assets/audio/player-hurt.mp3?v=20260828-1");
  const footstepSoundSource = "assets/audio/player-footstep.m4a?v=20260829-1";
  const cabinFireSound = new Audio("assets/audio/cabin-fire-ambience.mp3?v=20260829-2");
  const bearApproachSound = new Audio("assets/audio/bear-approach-cave.mp3?v=20260829-1");
  const cabinDoorSound = new Audio("assets/audio/cabin-door-transition.mp3?v=20260829-1");
  const playerJumpSound = new Audio("assets/audio/player-jump-trimmed.mp3?v=20260829-1");
  const gameOverMenuSound = new Audio("assets/audio/game-over-menu.mp3?v=20260829-1");
  const healingFoodSound = new Audio("assets/audio/healing-fruit-bite.mp3?v=20260829-1");
  const mushroomPickupSound = new Audio("assets/audio/mushroom-pickup.mp3?v=20260829-1");
  const portalApproachSound = new Audio("assets/audio/portal-approach-ambience.mp3?v=20260829-2");
  const introLogo = new Image();
  introLogo.src = "assets/custom/myko-title-logo.png?v=20260829-1";
  backgroundMusic.loop = true;
  backgroundMusic.preload = "auto";
  caveMusic.loop = true;
  caveMusic.preload = "auto";
  caveMusic.volume = 0;
  playerHurtSound.preload = "auto";
  cabinFireSound.loop = true;
  cabinFireSound.preload = "auto";
  cabinFireSound.volume = 0;
  bearApproachSound.loop = true;
  bearApproachSound.preload = "auto";
  bearApproachSound.volume = 0;
  cabinDoorSound.preload = "auto";
  playerJumpSound.preload = "auto";
  gameOverMenuSound.preload = "auto";
  healingFoodSound.preload = "auto";
  mushroomPickupSound.preload = "auto";
  if ("preservesPitch" in mushroomPickupSound) mushroomPickupSound.preservesPitch = false;
  portalApproachSound.loop = true;
  portalApproachSound.preload = "auto";
  portalApproachSound.volume = 0;
  portalApproachSound.playbackRate = .84;
  if ("preservesPitch" in portalApproachSound) portalApproachSound.preservesPitch = false;
  const savedAudio = JSON.parse(localStorage.getItem("mykoAudioSettings") || "null") || {};
  let musicVolume = Number.isFinite(savedAudio.musicVolume) ? savedAudio.musicVolume : .32;
  let soundVolume = Number.isFinite(savedAudio.soundVolume) ? savedAudio.soundVolume : .7;
  let musicMuted = Boolean(savedAudio.musicMuted);
  let soundMuted = Boolean(savedAudio.soundMuted);
  let menuOpen = false;
  let menuSelection = 0;
  let musicStarted = false;
  let footstepTimer = 0;
  let cabinFireVolume = 0;
  let bearApproachVolume = 0;
  let portalApproachVolume = 0;
  let healingFoodStopTimer = 0;
  let completionAudioContext = null;
  let birdFlightTime = 0;
  let surfaceMusicMix = 1;
  let caveMusicMix = 0;
  let caveMusicActive = false;
  let gameOverSoundFadeToken = 0;
  let introStarting = false;
  let introStartTimer = 0;
  let deathTransitionTimer = 0;
  const DEATH_TRANSITION_DURATION = 1.62;
  let deathGroundY = 455;
  let deathStartY = 0;
  let gameOverRevealTimer = 0;
  const doorTransition = { active: false, timer: 0, duration: 1.05, switched: false, target: "playing" };

  function saveAudioSettings() {
    backgroundMusic.volume = musicMuted ? 0 : musicVolume * surfaceMusicMix;
    caveMusic.volume = musicMuted ? 0 : musicVolume * caveMusicMix * .58;
    localStorage.setItem("mykoAudioSettings", JSON.stringify({ musicVolume, soundVolume, musicMuted, soundMuted }));
  }

  function playPlayerHurtSound() {
    if (soundMuted || soundVolume <= 0) return;
    playerHurtSound.pause();
    playerHurtSound.currentTime = 0;
    playerHurtSound.volume = soundVolume;
    playerHurtSound.play().catch(() => {});
  }

  function playFootstepSound() {
    if (soundMuted || soundVolume <= 0) return;
    const footstep = new Audio(footstepSoundSource);
    footstep.preload = "auto";
    footstep.volume = Math.min(1, soundVolume * .56);
    footstep.currentTime = 0;
    footstep.playbackRate = 1;
    footstep.play().catch(() => {});
  }

  function updateFootsteps(dt, walkingOnGround) {
    if (!walkingOnGround) {
      footstepTimer = 0;
      return;
    }
    footstepTimer -= dt;
    if (footstepTimer > 0) return;
    playFootstepSound();
    footstepTimer = .35 + Math.random() * .045;
  }

  function updateCabinFireSound(dt) {
    const targetVolume = gameState === "cabin" && !soundMuted ? soundVolume * .22 : 0;
    const fadeSpeed = targetVolume > cabinFireVolume ? .24 : .38;
    const change = Math.min(Math.abs(targetVolume - cabinFireVolume), fadeSpeed * dt);
    cabinFireVolume += Math.sign(targetVolume - cabinFireVolume) * change;
    cabinFireSound.volume = Math.max(0, Math.min(1, cabinFireVolume));
    if (targetVolume > 0 && cabinFireSound.paused) cabinFireSound.play().catch(() => {});
    if (targetVolume === 0 && cabinFireVolume <= .001 && !cabinFireSound.paused) {
      cabinFireSound.pause();
      cabinFireSound.currentTime = 0;
    }
  }

  function updateBearApproachSound(dt) {
    const distance = Math.abs((player.x + player.w / 2) - (bear.x + bear.w / 2));
    const proximity = Math.max(0, Math.min(1, 1 - distance / 900));
    const targetVolume = gameState === "playing" && bear.awake && !soundMuted
      ? soundVolume * (.5 + proximity * 1.25)
      : 0;
    const fadeSpeed = targetVolume > bearApproachVolume ? .38 : .42;
    const change = Math.min(Math.abs(targetVolume - bearApproachVolume), fadeSpeed * dt);
    bearApproachVolume += Math.sign(targetVolume - bearApproachVolume) * change;
    bearApproachSound.volume = Math.max(0, Math.min(1, bearApproachVolume));
    if (targetVolume > 0 && bearApproachSound.paused) bearApproachSound.play().catch(() => {});
    if (targetVolume === 0 && bearApproachVolume <= .001 && !bearApproachSound.paused) {
      bearApproachSound.pause();
      bearApproachSound.currentTime = 0;
    }
  }

  function updatePortalApproachSound(dt) {
    const portal = levelData().portal;
    const distance = Math.abs((player.x + player.w / 2) - (portal.x + portal.w / 2));
    const proximity = Math.max(0, Math.min(1, 1 - distance / 680));
    const targetVolume = gameState === "playing" && !soundMuted && proximity > 0
      ? soundVolume * (.04 + proximity * .34)
      : 0;
    const fadeSpeed = targetVolume > portalApproachVolume ? .2 : .3;
    const change = Math.min(Math.abs(targetVolume - portalApproachVolume), fadeSpeed * dt);
    portalApproachVolume += Math.sign(targetVolume - portalApproachVolume) * change;
    portalApproachSound.volume = Math.max(0, Math.min(1, portalApproachVolume));
    if (targetVolume > 0 && portalApproachSound.paused) portalApproachSound.play().catch(() => {});
    if (targetVolume === 0 && portalApproachVolume <= .001 && !portalApproachSound.paused) {
      portalApproachSound.pause();
    }
  }

  function playCabinDoorSound() {
    if (soundMuted || soundVolume <= 0) return;
    cabinDoorSound.pause();
    cabinDoorSound.currentTime = 0;
    cabinDoorSound.volume = Math.min(1, soundVolume * .72);
    cabinDoorSound.play().catch(() => {});
  }

  function playPlayerJumpSound() {
    if (soundMuted || soundVolume <= 0) return;
    playerJumpSound.pause();
    // Skip the short unwanted lead-in and start directly on the jump sound.
    playerJumpSound.currentTime = .22;
    playerJumpSound.volume = Math.min(1, soundVolume * .48);
    playerJumpSound.playbackRate = .96;
    playerJumpSound.play().catch(() => {});
  }

  function playGameOverSound() {
    if (soundMuted || soundVolume <= 0) return;
    const fadeToken = ++gameOverSoundFadeToken;
    gameOverMenuSound.pause();
    gameOverMenuSound.volume = 0;
    const playFromGameOverCue = () => {
      gameOverMenuSound.currentTime = Math.min(32, Math.max(0, gameOverMenuSound.duration - .1));
      const targetVolume = Math.min(1, soundVolume * .72);
      gameOverMenuSound.play().then(() => {
        const fadeStartedAt = performance.now();
        const fadeIn = (now) => {
          if (fadeToken !== gameOverSoundFadeToken || gameOverMenuSound.paused) return;
          const progress = Math.max(0, Math.min(1, (now - fadeStartedAt) / 950));
          const eased = progress * progress * (3 - 2 * progress);
          gameOverMenuSound.volume = targetVolume * eased;
          if (progress < 1) requestAnimationFrame(fadeIn);
        };
        requestAnimationFrame(fadeIn);
      }).catch(() => {});
    };
    if (gameOverMenuSound.readyState >= 1) playFromGameOverCue();
    else gameOverMenuSound.addEventListener("loadedmetadata", playFromGameOverCue, { once: true });
  }

  function playHealingFoodSound() {
    if (soundMuted || soundVolume <= 0) return;
    clearTimeout(healingFoodStopTimer);
    healingFoodSound.pause();
    healingFoodSound.currentTime = 0;
    healingFoodSound.volume = Math.min(1, soundVolume * .62);
    healingFoodSound.playbackRate = .96 + Math.random() * .07;
    healingFoodSound.play().catch(() => {});
    // Keep only the first, crisp bite. The tail of the source contains a
    // longer second part that feels delayed compared with the pickup.
    healingFoodStopTimer = setTimeout(() => {
      healingFoodSound.pause();
      healingFoodSound.currentTime = 0;
    }, 520);
  }

  function playMushroomPickupSound() {
    if (soundMuted || soundVolume <= 0) return;
    mushroomPickupSound.pause();
    mushroomPickupSound.currentTime = 0;
    mushroomPickupSound.volume = Math.min(1, soundVolume * .16);
    mushroomPickupSound.playbackRate = .84 + Math.random() * .045;
    mushroomPickupSound.play().catch(() => {});
  }

  function playMushroomCompletionSound() {
    if (soundMuted || soundVolume <= 0) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    completionAudioContext ||= new AudioContextClass();
    const audioContext = completionAudioContext;
    if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
    const master = audioContext.createGain();
    const warmth = audioContext.createBiquadFilter();
    warmth.type = "lowpass";
    warmth.frequency.value = 1750;
    warmth.Q.value = .55;
    master.gain.setValueAtTime(0, audioContext.currentTime);
    master.gain.linearRampToValueAtTime(Math.min(.22, soundVolume * .22), audioContext.currentTime + .045);
    master.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + 1.25);
    master.connect(warmth).connect(audioContext.destination);
    [392, 523.25, 659.25].forEach((frequency, index) => {
      const note = audioContext.createOscillator();
      const noteGain = audioContext.createGain();
      const start = audioContext.currentTime + index * .13;
      note.type = index === 0 ? "triangle" : "sine";
      note.frequency.setValueAtTime(frequency, start);
      note.detune.setValueAtTime(index === 1 ? -5 : 4, start);
      noteGain.gain.setValueAtTime(.001, start);
      noteGain.gain.linearRampToValueAtTime(1 - index * .16, start + .035);
      noteGain.gain.exponentialRampToValueAtTime(.001, start + .72);
      note.connect(noteGain).connect(master);
      note.start(start);
      note.stop(start + .76);
    });
  }

  function beginDoorTransition(target) {
    if (doorTransition.active) return;
    keys.clear();
    doorTransition.active = true;
    doorTransition.timer = 0;
    doorTransition.switched = false;
    doorTransition.target = target;
    playCabinDoorSound();
  }

  saveAudioSettings();

  function startBackgroundMusic() {
    if (caveMusicActive) {
      if (caveMusic.paused) caveMusic.play().catch(() => {});
      return;
    }
    if (musicStarted && !backgroundMusic.paused) return;
    backgroundMusic.play()
      .then(() => { musicStarted = true; })
      .catch(() => { /* A later click or key press retries playback. */ });
  }

  function updateMusicCrossfade(dt) {
    if (gameState === "dying" || gameState === "gameover") {
      backgroundMusic.volume = 0;
      caveMusic.volume = 0;
      return;
    }
    if (gameState !== "playing") caveMusicActive = false;
    else if (player.y > 545) caveMusicActive = true;
    else if (player.y < 475) caveMusicActive = false;

    const targetSurface = caveMusicActive ? 0 : 1;
    const targetCave = caveMusicActive ? 1 : 0;
    const fadeStep = dt / 1.55;
    surfaceMusicMix += Math.sign(targetSurface - surfaceMusicMix)
      * Math.min(Math.abs(targetSurface - surfaceMusicMix), fadeStep);
    caveMusicMix += Math.sign(targetCave - caveMusicMix)
      * Math.min(Math.abs(targetCave - caveMusicMix), fadeStep);

    backgroundMusic.volume = musicMuted ? 0 : musicVolume * surfaceMusicMix;
    caveMusic.volume = musicMuted ? 0 : musicVolume * caveMusicMix * .58;

    if (targetSurface > 0 && backgroundMusic.paused) {
      backgroundMusic.play().then(() => { musicStarted = true; }).catch(() => {});
    }
    if (targetCave > 0 && caveMusic.paused) caveMusic.play().catch(() => {});

    // Pause at the end of each fade. Pausing preserves the surface track's
    // currentTime so it resumes exactly where the player left it.
    if (targetSurface === 0 && surfaceMusicMix <= .001 && !backgroundMusic.paused) backgroundMusic.pause();
    if (targetCave === 0 && caveMusicMix <= .001 && !caveMusic.paused) {
      caveMusic.pause();
      caveMusic.currentTime = 0;
    }
  }
  const lightingCanvas = document.createElement("canvas");
  const lightingCtx = lightingCanvas.getContext("2d");

  const VIEW_W = canvas.width;
  const VIEW_H = canvas.height;
  lightingCanvas.width = VIEW_W;
  lightingCanvas.height = VIEW_H;
  const WORLD_W = 3600;
  const WORLD_H = 980;
  const GRAVITY = 1850;
  const MOVE_SPEED = 285;
  const JUMP_SPEED = 680;
  // Generated platform art has a raised grass/rock lip above its physics Y.
  // Sink ground-bound visuals into that lip while keeping collisions intact.
  const GROUND_VISUAL_SINK = 13;
  const MAIN_GROUND_VISUAL_SINK = -1;
  const CAVE_BEAR_VISUAL_SINK = 15;
  const CABIN_VISUAL_RISE = -6;

  const player = { x: 480, y: 407, w: 34, h: 48, vx: 0, vy: 0, grounded: true, facing: 1, hp: 5, maxHp: 5, hurtTimer: 0, jumpsUsed: 0, idleTimer: 0 };
  const spawn = { x: 174, y: 350 };
  const LEVEL_TWO_TEST_MODE = true;
  const camera = { x: 0, y: 0 };
  const keys = new Set();
  const MUSHROOM_GOAL = 30;
  const basket = { brown: 0, yellow: 0, beige: 0 };
  const floatingFeedback = [];
  const level1Portal = { x: 3480, y: 365, w: 58, h: 90 };
  const cabin = { x: 0, y: 175, w: 316, h: 280, doorX: 164, doorY: 339, doorW: 55, doorH: 88 };
  let gameState = "intro";
  let currentLevel = LEVEL_TWO_TEST_MODE ? 2 : 1;
  let flashlightEquipped = false;
  let animationTime = 0;

  const loadOriginal = (path) => {
    const image = new Image();
    image.src = `Myko_spites/${path}`;
    return image;
  };

  const loadSprite = (path) => {
    return loadOriginal(`Myko/${path}`);
  };
  const spriteSet = {
    idle: {
      left: [loadSprite("Idle/idle_left.png")],
      right: [loadSprite("Idle/idle_right.png")]
    },
    afk: {
      left: [loadSprite("Afk/afk_left.png")],
      right: [loadSprite("Afk/afk_right.png")]
    },
    run: {
      left: Array.from({ length: 5 }, (_, i) => loadSprite(`Running/left/run ${i + 1}.png`)),
      right: Array.from({ length: 5 }, (_, i) => loadSprite(`Running/right/run ${i + 1}.png`))
    },
    jump: {
      left: Array.from({ length: 4 }, (_, i) => loadSprite(`Jumping/left/jump ${i + 1}.png`)),
      right: Array.from({ length: 4 }, (_, i) => loadSprite(`Jumping/right/jump ${i + 1}.png`))
    },
    climb: Array.from({ length: 2 }, (_, i) => loadSprite(`climbing/climbing ${i + 1}.png`)),
    hurt: {
      left: [loadSprite("Hurt/hurt_left.png")],
      right: [loadSprite("Hurt/hurt_right.png")]
    },
    flashlightIdle: [loadSprite("flashlight/idle/idle.png")],
    flashlightRun: {
      left: Array.from({ length: 3 }, (_, i) => loadSprite(`flashlight/running/left/run fl ${i + 1}.png`)),
      right: Array.from({ length: 3 }, (_, i) => loadSprite(`flashlight/running/right/run fl ${i + 1}.png`))
    }
  };
  const loadBearSprite = (path) => {
    return loadOriginal(`Bear/${path}`);
  };
  const bearSpriteSet = {
    neutral: {
      left: Array.from({ length: 4 }, (_, i) => loadBearSprite(`Neutral/Left/left ${i + 1}.png`)),
      right: Array.from({ length: 4 }, (_, i) => loadBearSprite(`Neutral/Right/right ${i + 1}.png`))
    },
    angry: {
      left: Array.from({ length: 4 }, (_, i) => loadBearSprite(`Angry/Left/left ${i + 1}.png`)),
      right: Array.from({ length: 4 }, (_, i) => loadBearSprite(`Angry/Right/right ${i + 1}.png`))
    }
  };
  const loadInteractiveSprite = (path) => {
    return loadOriginal(`Interactive items/${path}`);
  };
  const interactiveSprites = {
    mushrooms: Array.from({ length: 4 }, (_, i) => loadInteractiveSprite(`fungi/mushrooms/mushroom ${i + 1}.png`)),
    fly: loadInteractiveSprite("fungi/dangerous mushrooms/red mushroom.png"),
    apples: Array.from({ length: 2 }, (_, i) => loadInteractiveSprite(`hp items/apple ${i + 1}.png`)),
    berries: Array.from({ length: 2 }, (_, i) => loadInteractiveSprite(`hp items/berry ${i + 1}.png`)),
    bush: loadInteractiveSprite("hp items/hp item placements/bush.png"),
    tree: loadInteractiveSprite("hp items/hp item placements/tree.png"),
    cabin: loadInteractiveSprite("other/cabin.png"),
    portal: loadInteractiveSprite("other/end_portal.png")
  };
  const vegetationSprites = {
    bushes: Array.from({ length: 3 }, (_, index) => {
      const sprite = new Image();
      sprite.src = `assets/custom/bush_variant_${index + 1}.png?v=20260828-1`;
      return sprite;
    }),
    trees: Array.from({ length: 3 }, (_, index) => {
      const sprite = new Image();
      sprite.src = `assets/custom/tree_variant_${index + 1}.png?v=20260828-1`;
      return sprite;
    })
  };
  const cabinInteriorSprite = new Image();
  cabinInteriorSprite.src = "assets/custom/cabin_interior_v2.png?v=20260828-1";
  const generatedCabinSprite = new Image();
  const generatedCabinCanvas = document.createElement("canvas");
  let generatedCabinReady = false;
  generatedCabinSprite.addEventListener("load", () => {
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = generatedCabinSprite.naturalWidth;
    sourceCanvas.height = generatedCabinSprite.naturalHeight;
    const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
    sourceCtx.drawImage(generatedCabinSprite, 0, 0);
    const pixels = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height).data;
    let minX = sourceCanvas.width;
    let minY = sourceCanvas.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < sourceCanvas.height; y += 1) {
      for (let x = 0; x < sourceCanvas.width; x += 1) {
        if (pixels[(y * sourceCanvas.width + x) * 4 + 3] < 8) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    if (maxX < minX || maxY < minY) return;
    const padding = 2;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(sourceCanvas.width - 1, maxX + padding);
    maxY = Math.min(sourceCanvas.height - 1, maxY + padding);
    generatedCabinCanvas.width = maxX - minX + 1;
    generatedCabinCanvas.height = maxY - minY + 1;
    generatedCabinCanvas.getContext("2d").drawImage(
      sourceCanvas,
      minX, minY, generatedCabinCanvas.width, generatedCabinCanvas.height,
      0, 0, generatedCabinCanvas.width, generatedCabinCanvas.height
    );
    generatedCabinReady = true;
  });
  generatedCabinSprite.src = "assets/custom/cabin_generated_ground_v1.png?v=20260829-1";
  const parallaxForegroundSprite = new Image();
  const parallaxForegroundCanvas = document.createElement("canvas");
  let parallaxForegroundReady = false;
  parallaxForegroundSprite.addEventListener("load", () => {
    parallaxForegroundCanvas.width = parallaxForegroundSprite.naturalWidth;
    parallaxForegroundCanvas.height = parallaxForegroundSprite.naturalHeight;
    const foregroundCtx = parallaxForegroundCanvas.getContext("2d", { willReadFrequently: true });
    foregroundCtx.drawImage(parallaxForegroundSprite, 0, 0);
    const pixels = foregroundCtx.getImageData(0, 0, parallaxForegroundCanvas.width, parallaxForegroundCanvas.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const magentaBackdrop = pixels.data[i] > 170 && pixels.data[i + 1] < 100 && pixels.data[i + 2] > 140;
      if (magentaBackdrop) pixels.data[i + 3] = 0;
    }
    foregroundCtx.putImageData(pixels, 0, 0);
    foregroundCtx.globalCompositeOperation = "source-atop";
    const grassDepth = foregroundCtx.createLinearGradient(0, 0, 0, parallaxForegroundCanvas.height);
    grassDepth.addColorStop(0, "rgba(1, 12, 10, .68)");
    grassDepth.addColorStop(.55, "rgba(4, 18, 12, .38)");
    grassDepth.addColorStop(1, "rgba(8, 22, 12, .14)");
    foregroundCtx.fillStyle = grassDepth;
    foregroundCtx.fillRect(0, 0, parallaxForegroundCanvas.width, parallaxForegroundCanvas.height);
    foregroundCtx.globalCompositeOperation = "source-over";
    parallaxForegroundReady = true;
  });
  parallaxForegroundSprite.src = "assets/custom/grass_edge_reference.png?v=20260827-1";

  const background2 = loadOriginal("backgrounds/-2.png");
  const background3 = loadOriginal("backgrounds/-3.png");
  const background4 = loadOriginal("backgrounds/-4.png");
  const backgroundSprites = [
    { image: parallaxForegroundCanvas, fixedWidth: 228, fixedHeight: 42, ready: () => parallaxForegroundReady },
    { image: background2, scale: .52, yOffset: -12, ready: () => background2.complete && background2.naturalWidth },
    { image: background3, scale: .72, ready: () => background3.complete && background3.naturalWidth },
    { image: background4, scale: .72, ready: () => background4.complete && background4.naturalWidth }
  ];
  const uiSprites = {
    heart: loadOriginal("UI/heart.png"),
    basket: loadOriginal("UI/Basket.png"),
    font: loadOriginal("UI/Myko_font.png")
  };
  const ladderSprite = new Image();
  const ladderRenderCanvas = document.createElement("canvas");
  let ladderRenderReady = false;
  ladderSprite.addEventListener("load", () => {
    ladderRenderCanvas.width = ladderSprite.naturalWidth;
    ladderRenderCanvas.height = ladderSprite.naturalHeight;
    const ladderCtx = ladderRenderCanvas.getContext("2d", { willReadFrequently: true });
    ladderCtx.drawImage(ladderSprite, 0, 0);
    const pixels = ladderCtx.getImageData(0, 0, ladderRenderCanvas.width, ladderRenderCanvas.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const nearBlack = pixels.data[i] < 18 && pixels.data[i + 1] < 18 && pixels.data[i + 2] < 18;
      if (nearBlack) pixels.data[i + 3] = 0;
    }
    ladderCtx.putImageData(pixels, 0, 0);
    ladderRenderReady = true;
  });
  ladderSprite.src = "assets/custom/ladder_tile_v1.png?v=20260828-1";
  const ladderShaftSprite = new Image();
  ladderShaftSprite.src = "assets/custom/ladder_shaft_earth_v1.png?v=20260828-1";
  const caveBackgroundSprite = new Image();
  const caveBackgroundCanvas = document.createElement("canvas");
  let caveBackgroundReady = false;
  caveBackgroundSprite.addEventListener("load", () => {
    caveBackgroundCanvas.width = caveBackgroundSprite.naturalWidth;
    caveBackgroundCanvas.height = caveBackgroundSprite.naturalHeight;
    const caveCtx = caveBackgroundCanvas.getContext("2d");
    caveCtx.drawImage(caveBackgroundSprite, 0, 0);
    caveCtx.globalCompositeOperation = "destination-in";
    const edgeFeather = caveCtx.createLinearGradient(0, 0, 0, caveBackgroundCanvas.height);
    edgeFeather.addColorStop(0, "rgba(0,0,0,0)");
    edgeFeather.addColorStop(.08, "rgba(0,0,0,.16)");
    edgeFeather.addColorStop(.24, "rgba(0,0,0,1)");
    edgeFeather.addColorStop(.78, "rgba(0,0,0,1)");
    edgeFeather.addColorStop(.92, "rgba(0,0,0,.3)");
    edgeFeather.addColorStop(1, "rgba(0,0,0,0)");
    caveCtx.fillStyle = edgeFeather;
    caveCtx.fillRect(0, 0, caveBackgroundCanvas.width, caveBackgroundCanvas.height);
    caveCtx.globalCompositeOperation = "source-over";
    caveBackgroundReady = true;
  });
  caveBackgroundSprite.src = "assets/custom/cave_background_continuous.png?v=20260828-1";
  const caveWallSprite = new Image();
  caveWallSprite.src = "assets/custom/cave_wall_generated.png?v=20260827-1";
  const groundTransitionSprite = new Image();
  const groundTransitionCanvas = document.createElement("canvas");
  const rearGroundTransitionCanvas = document.createElement("canvas");
  let groundTransitionReady = false;
  groundTransitionSprite.addEventListener("load", () => {
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = groundTransitionSprite.naturalWidth;
    sourceCanvas.height = groundTransitionSprite.naturalHeight;
    const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
    sourceCtx.drawImage(groundTransitionSprite, 0, 0);
    const pixels = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const clearHeight = Math.round(sourceCanvas.height * .16);
    for (let py = 0; py < clearHeight; py++) {
      for (let px = 0; px < sourceCanvas.width; px++) {
        const i = (py * sourceCanvas.width + px) * 4;
        const nearBlack = pixels.data[i] < 14 && pixels.data[i + 1] < 14 && pixels.data[i + 2] < 14;
        if (nearBlack) pixels.data[i + 3] = 0;
      }
    }
    sourceCtx.putImageData(pixels, 0, 0);

    const pixelScale = .25;
    groundTransitionCanvas.width = Math.round(sourceCanvas.width * pixelScale);
    groundTransitionCanvas.height = Math.round(sourceCanvas.height * pixelScale);
    const groundCtx = groundTransitionCanvas.getContext("2d");
    groundCtx.imageSmoothingEnabled = false;
    groundCtx.drawImage(sourceCanvas, 0, 0, groundTransitionCanvas.width, groundTransitionCanvas.height);
    groundCtx.globalCompositeOperation = "destination-in";
    const groundBottomFeather = groundCtx.createLinearGradient(0, 0, 0, groundTransitionCanvas.height);
    // destination-in clears every pixel outside the mask, so the opaque
    // section must cover the full grass and upper-soil area.
    groundBottomFeather.addColorStop(0, "rgba(0,0,0,1)");
    groundBottomFeather.addColorStop(.62, "rgba(0,0,0,1)");
    groundBottomFeather.addColorStop(.79, "rgba(0,0,0,.78)");
    groundBottomFeather.addColorStop(.92, "rgba(0,0,0,.3)");
    groundBottomFeather.addColorStop(1, "rgba(0,0,0,0)");
    groundCtx.fillStyle = groundBottomFeather;
    groundCtx.fillRect(0, 0, groundTransitionCanvas.width, groundTransitionCanvas.height);
    groundCtx.globalCompositeOperation = "source-over";

    // A separate, darker copy is reserved for the continuous rear grass
    // layer. The brighter source remains available for foreground platforms.
    rearGroundTransitionCanvas.width = groundTransitionCanvas.width;
    rearGroundTransitionCanvas.height = groundTransitionCanvas.height;
    const rearGroundCtx = rearGroundTransitionCanvas.getContext("2d");
    rearGroundCtx.imageSmoothingEnabled = false;
    rearGroundCtx.drawImage(groundTransitionCanvas, 0, 0);
    rearGroundCtx.globalCompositeOperation = "source-atop";
    rearGroundCtx.fillStyle = "rgba(2, 12, 7, .28)";
    rearGroundCtx.fillRect(0, 0, rearGroundTransitionCanvas.width, rearGroundTransitionCanvas.height);
    rearGroundCtx.globalCompositeOperation = "source-over";
    groundTransitionReady = true;
  });
  groundTransitionSprite.src = "assets/custom/forest_subsoil_grass_matched_v1.png?v=20260828-1";
  const cavePlatformSprite = new Image();
  cavePlatformSprite.src = "assets/custom/cave_platform_rock.png?v=20260828-1";
  const earthPlatformSprites = Array.from({ length: 6 }, (_, index) => {
    const sprite = new Image();
    sprite.src = `assets/custom/earth_platform_v3_${index + 1}.png?v=20260828-1`;
    return sprite;
  });
  const platformGrassOverlay = new Image();
  platformGrassOverlay.src = "assets/custom/platform_grass_overlay.png?v=20260828-1";
  const grassEdgeSprite = new Image();
  grassEdgeSprite.src = "assets/custom/grass_edge_reference.png?v=20260827-1";
  const waterfallFrames = [1, 2].map((frameNumber) => {
    const frame = new Image();
    frame.src = `assets/custom/waterfall_stream_frame_${frameNumber}.png?v=20260828-1`;
    return frame;
  });
  const forestRootLayerSprite = new Image();
  forestRootLayerSprite.src = "assets/custom/forest_root_layer_v1.png?v=20260828-1";
  const rootSupportSprites = [
    "root_support_v1.png",
    "root_support_v3_double.png",
    "root_support_v2_large.png"
  ].map((filename) => {
    const sprite = new Image();
    sprite.src = `assets/custom/${filename}?v=20260828-1`;
    return sprite;
  });
  const cohesiveRootPlatformSprite = new Image();
  cohesiveRootPlatformSprite.src = "assets/custom/cohesive_root_platform_v1.png?v=20260828-1";
  const woodPlatformSprite = new Image();
  const woodPlatformCanvas = document.createElement("canvas");
  let woodPlatformReady = false;
  woodPlatformSprite.addEventListener("load", () => {
    woodPlatformCanvas.width = woodPlatformSprite.naturalWidth;
    woodPlatformCanvas.height = woodPlatformSprite.naturalHeight;
    const woodCtx = woodPlatformCanvas.getContext("2d", { willReadFrequently: true });
    woodCtx.drawImage(woodPlatformSprite, 0, 0);
    const pixels = woodCtx.getImageData(0, 0, woodPlatformCanvas.width, woodPlatformCanvas.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const paleBackdrop = pixels.data[i] > 225 && pixels.data[i + 1] > 225 && pixels.data[i + 2] > 225;
      if (paleBackdrop) pixels.data[i + 3] = 0;
    }
    woodCtx.putImageData(pixels, 0, 0);
    woodPlatformReady = true;
  });
  woodPlatformSprite.src = "assets/custom/wood_platform_x.png?v=20260827-1";

  const level1Platforms = [
    { x: 0, y: 455, w: 570, h: 85 },
    { x: 650, y: 455, w: 480, h: 85 },
    { x: 1210, y: 455, w: 420, h: 85 },
    { x: 1685, y: 455, w: 300, h: 85 },
    { x: 1985, y: 455, w: 837, h: 85 },
    { x: 2865, y: 455, w: 735, h: 85 },
    { x: 760, y: 335, w: 190, h: 28, rockAsset: 0 },
    { x: 1410, y: 345, w: 210, h: 28, rockAsset: 1 },
    { x: 2040, y: 355, w: 170, h: 28, rockAsset: 2 },
    { x: 2250, y: 280, w: 180, h: 28, rockAsset: 3 },
    { x: 2490, y: 335, w: 170, h: 28, rockAsset: 4 },
    { x: 2690, y: 250, w: 130, h: 28, rockAsset: 5 },
    { x: 1350, y: 820, w: 930, h: 90, underground: true },
    { x: 2280, y: 820, w: 320, h: 90, underground: true },
    { x: 2600, y: 820, w: 440, h: 90, underground: true },
    { x: 2050, y: 720, w: 150, h: 24, underground: true },
    { x: 2670, y: 710, w: 130, h: 24, underground: true }
  ];

  const level1Ladders = [
    { x: 1637, y: 420, w: 48, h: 400 },
    { x: 2822, y: 430, w: 48, h: 390 }
  ];

  const bear = { x: 2360, y: 770, w: 76, h: 50, vx: 0, awake: false, patrolDirection: 1 };

  const level1Trees = [
    { x: 430, y: 455, scale: .78, variant: 2 },
    { x: 1000, y: 455, scale: 1, variant: 0 },
    { x: 1320, y: 455, scale: .82, variant: 2 },
    { x: 1885, y: 455, scale: 1.02, variant: 1 },
    { x: 2870, y: 455, scale: .8, variant: 0 },
    { x: 3160, y: 455, scale: 1.04, variant: 2 },
    { x: 3460, y: 455, scale: .76, variant: 1 }
  ];

  const level1Bushes = [
    { x: 470, y: 455, scale: .78, variant: 1 },
    { x: 1220, y: 455, scale: .82, variant: 2 },
    { x: 1740, y: 455, scale: .76, variant: 0 },
    { x: 2385, y: 455, scale: .86, variant: 1 },
    { x: 2925, y: 455, scale: .88, variant: 2 },
    { x: 3210, y: 455, scale: 1, variant: 0 },
    { x: 3420, y: 455, scale: .74, variant: 2 }
  ];

  const surfaceMushroomSpots = [
    [270, 429], [680, 429], [900, 309], [1020, 429],
    [1080, 429], [1445, 319], [1710, 429], [1900, 429], [2080, 329], [2160, 329],
    [2325, 254], [2550, 309], [2745, 224], [3040, 429], [3400, 429]
  ];

  const tunnelMushroomSpots = [
    [1370, 794], [1510, 794], [1650, 794], [1790, 794], [1930, 794],
    [2190, 794], [2060, 694], [2120, 694], [2300, 794], [2440, 794],
    [2620, 794], [2690, 794], [2760, 794], [2920, 794], [3000, 794]
  ];

  const mushroomTypes = ["brown", "yellow", "beige"];
  const makeMushrooms = (spots, region) => spots.map(([x, y], index) => ({
    type: mushroomTypes[index % mushroomTypes.length], x, y, w: 22, h: 26, region, variant: index % 4
  }));

  const level1Items = [
    ...makeMushrooms(surfaceMushroomSpots, "surface"),
    ...makeMushrooms(tunnelMushroomSpots, "tunnel"),
    { type: "fly", x: 535, y: 429, w: 24, h: 26 },
    { type: "fly", x: 1555, y: 319, w: 24, h: 26 },
    { type: "fly", x: 2210, y: 794, w: 24, h: 26 },
    { type: "fly", x: 2480, y: 794, w: 24, h: 26 },
    { type: "berry", x: 2959, y: 400, w: 18, h: 20 },
    { type: "berry", x: 2980, y: 396, w: 18, h: 20 },
    { type: "berry", x: 3250, y: 400, w: 18, h: 20 },
    // Apples only grow on the gnarled broadleaf tree (tree variant 1).
    { type: "apple", x: 1900, y: 245, w: 20, h: 24 }
  ];

  const level2Portal = { x: 3480, y: 365, w: 58, h: 90 };
  const level2Platforms = [
    // Level two deliberately uses the same calm visual rhythm as level one:
    // one readable ground line, a few airy root ledges and clear cave routes.
    { x: 0, y: 455, w: 620, h: 85 },
    { x: 700, y: 455, w: 520, h: 85 },
    { x: 1290, y: 455, w: 470, h: 85 },
    { x: 1840, y: 455, w: 450, h: 85 },
    { x: 2660, y: 455, w: 940, h: 85 },
    { x: 760, y: 335, w: 190, h: 28, rockAsset: 1 },
    { x: 1050, y: 275, w: 165, h: 28, rockAsset: 3 },
    { x: 1390, y: 345, w: 210, h: 28, rockAsset: 0 },
    { x: 1900, y: 335, w: 185, h: 28, rockAsset: 4 },
    { x: 2120, y: 265, w: 170, h: 28, rockAsset: 5 },
    { x: 2840, y: 340, w: 190, h: 28, rockAsset: 2 },
    { x: 3140, y: 285, w: 175, h: 28, rockAsset: 3 },
    { x: 300, y: 820, w: 750, h: 90, underground: true },
    { x: 1050, y: 820, w: 750, h: 90, underground: true },
    { x: 1800, y: 820, w: 500, h: 90, underground: true },
    { x: 2300, y: 600, w: 360, h: 70, underground: true },
    { x: 2660, y: 820, w: 380, h: 90, underground: true },
    { x: 720, y: 700, w: 155, h: 24, underground: true },
    { x: 1110, y: 710, w: 155, h: 24, underground: true },
    { x: 1510, y: 690, w: 155, h: 24, underground: true },
    { x: 1970, y: 710, w: 155, h: 24, underground: true }
  ];
  const level2Ladders = [
    { x: 626, y: 430, w: 48, h: 390 },
    { x: 2296, y: 430, w: 48, h: 170 },
    { x: 2612, y: 455, w: 48, h: 365 }
  ];
  const level2Trees = [
    { x: 190, y: 455, scale: .78, variant: 2 },
    { x: 520, y: 455, scale: .88, variant: 0 },
    { x: 1010, y: 455, scale: .8, variant: 1 },
    { x: 1330, y: 455, scale: .82, variant: 2 },
    { x: 1730, y: 455, scale: .9, variant: 0 },
    { x: 2050, y: 455, scale: 1.02, variant: 1 },
    { x: 2780, y: 455, scale: .8, variant: 0 },
    { x: 3070, y: 455, scale: .94, variant: 2 },
    { x: 3370, y: 455, scale: .76, variant: 1 }
  ];
  const level2Bushes = [
    { x: 270, y: 455, scale: .78, variant: 2 },
    { x: 760, y: 455, scale: .74, variant: 0 },
    { x: 1160, y: 455, scale: .78, variant: 1 },
    { x: 1460, y: 455, scale: .82, variant: 2 },
    { x: 1880, y: 455, scale: .8, variant: 0 },
    { x: 2180, y: 455, scale: .86, variant: 1 },
    { x: 2740, y: 455, scale: .78, variant: 2 },
    { x: 2970, y: 455, scale: .82, variant: 0 },
    { x: 3260, y: 455, scale: .8, variant: 1 }
  ];
  const level2SurfaceSpots = [
    [300,429],[730,429],[825,309],[1110,249],[1180,429],
    [1435,319],[1660,429],[1940,309],[2160,239],[2240,429],
    [2700,429],[2890,314],[3080,429],[3195,259],[3400,429]
  ];
  const level2TunnelSpots = [
    [340,794],[480,794],[620,794],[745,674],[900,794],
    [1080,794],[1140,684],[1280,794],[1535,664],[1700,794],
    [1840,794],[1995,684],[2180,794],[2380,574],[2740,794]
  ];
  const level2Items = [
    ...makeMushrooms(level2SurfaceSpots, "surface"),
    ...makeMushrooms(level2TunnelSpots, "tunnel"),
    { type: "fly", x: 880, y: 309, w: 24, h: 26 },
    { type: "fly", x: 2010, y: 309, w: 24, h: 26 },
    { type: "fly", x: 1430, y: 794, w: 24, h: 26 },
    { type: "berry", x: 285, y: 400, w: 18, h: 20 },
    { type: "berry", x: 1475, y: 400, w: 18, h: 20 },
    { type: "berry", x: 2195, y: 400, w: 18, h: 20 },
    { type: "berry", x: 2985, y: 400, w: 18, h: 20 },
    // Apples only grow on the gnarled broadleaf tree (tree variant 1).
    { type: "apple", x: 2055, y: 245, w: 20, h: 24 }
  ];

  function levelData() {
    return currentLevel === 1
      ? { platforms: level1Platforms, ladders: level1Ladders, trees: level1Trees, bushes: level1Bushes, items: level1Items, portal: level1Portal }
      : { platforms: level2Platforms, ladders: level2Ladders, trees: level2Trees, bushes: level2Bushes, items: level2Items, portal: level2Portal };
  }

  const blockKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"]);
  addEventListener("keydown", (event) => {
    if (gameState === "intro") {
      event.preventDefault();
      if (event.code === "Enter" || event.code === "Space") beginJourney();
      return;
    }
    if (gameState === "dying") {
      event.preventDefault();
      return;
    }
    if (gameState === "gameover") {
      event.preventDefault();
      if (event.code === "Enter" || event.code === "Space" || event.code === "KeyR") restartGame();
      return;
    }
    if (event.code === "Escape") {
      event.preventDefault();
      menuOpen = !menuOpen;
      keys.clear();
      return;
    }
    if (menuOpen) {
      event.preventDefault();
      if (event.code === "ArrowUp" || event.code === "KeyW") menuSelection = (menuSelection + 2) % 3;
      if (event.code === "ArrowDown" || event.code === "KeyS") menuSelection = (menuSelection + 1) % 3;
      if (menuSelection < 2 && (event.code === "ArrowLeft" || event.code === "KeyA")) {
        if (menuSelection === 0) musicVolume = Math.max(0, musicVolume - .1);
        else soundVolume = Math.max(0, soundVolume - .1);
        saveAudioSettings();
      }
      if (menuSelection < 2 && (event.code === "ArrowRight" || event.code === "KeyD")) {
        if (menuSelection === 0) musicVolume = Math.min(1, musicVolume + .1);
        else soundVolume = Math.min(1, soundVolume + .1);
        saveAudioSettings();
      }
      if (event.code === "Enter" || event.code === "Space") {
        if (menuSelection === 0) musicMuted = !musicMuted;
        else if (menuSelection === 1) soundMuted = !soundMuted;
        else menuOpen = false;
        saveAudioSettings();
      }
      return;
    }
    startBackgroundMusic();
    if (blockKeys.has(event.code)) event.preventDefault();
    if (event.code === "KeyE") {
      if (gameState === "cabin") beginDoorTransition("playing");
      else if (gameState === "playing" && nearCabinDoor()) beginDoorTransition("cabin");
      return;
    }
    if (event.code === "KeyF" && gameState === "playing") {
      flashlightEquipped = !flashlightEquipped;
      return;
    }
    if (gameState === "cabin") {
      keys.add(event.code);
      return;
    }
    if (event.code === "Space" && !keys.has("Space") && (player.grounded || player.climbing || player.jumpsUsed < 2)) {
      player.vy = -JUMP_SPEED;
      player.grounded = false;
      player.climbing = false;
      player.jumpsUsed += 1;
      playPlayerJumpSound();
    }
    keys.add(event.code);
    hint.classList.add("hidden");
  });
  addEventListener("keyup", (event) => keys.delete(event.code));
  addEventListener("blur", () => keys.clear());
  canvas.addEventListener("pointerdown", (event) => {
    startBackgroundMusic();
    canvas.focus();
    hint.classList.add("hidden");
    if (gameState === "intro") {
      const bounds = canvas.getBoundingClientRect();
      const x = (event.clientX - bounds.left) * VIEW_W / bounds.width;
      const y = (event.clientY - bounds.top) * VIEW_H / bounds.height;
      if (x >= 338 && x <= 622 && y >= 376 && y <= 448) beginJourney();
      return;
    }
    if (gameState === "gameover") {
      const bounds = canvas.getBoundingClientRect();
      const x = (event.clientX - bounds.left) * VIEW_W / bounds.width;
      const y = (event.clientY - bounds.top) * VIEW_H / bounds.height;
      if (x >= 350 && x <= 610 && y >= 354 && y <= 414) restartGame();
      return;
    }
    if (!menuOpen) return;
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) * VIEW_W / bounds.width;
    const y = (event.clientY - bounds.top) * VIEW_H / bounds.height;
    if (y >= 190 && y <= 245) {
      menuSelection = 0;
      if (x >= 390 && x <= 620) musicVolume = Math.max(0, Math.min(1, (x - 390) / 230));
      if (x >= 640 && x <= 700) musicMuted = !musicMuted;
      saveAudioSettings();
    } else if (y >= 270 && y <= 325) {
      menuSelection = 1;
      if (x >= 390 && x <= 620) soundVolume = Math.max(0, Math.min(1, (x - 390) / 230));
      if (x >= 640 && x <= 700) soundMuted = !soundMuted;
      saveAudioSettings();
    } else if (x >= 390 && x <= 570 && y >= 375 && y <= 420) {
      menuOpen = false;
    }
  });

  function update(dt) {
    updateMusicCrossfade(dt);
    updateCabinFireSound(dt);
    updateBearApproachSound(dt);
    updatePortalApproachSound(dt);
    updateFloatingFeedback(dt);
    if (gameState === "intro") {
      animationTime += dt;
      if (introStarting) {
        introStartTimer += dt;
        if (introStartTimer >= .78) {
          gameState = LEVEL_TWO_TEST_MODE ? "playing" : "cabin";
          if (LEVEL_TWO_TEST_MODE) {
            Object.assign(player, spawn, { vx: 0, vy: 0, grounded: false, climbing: false, facing: 1 });
            camera.x = 0;
            camera.y = 0;
            resetBear();
          }
          introStarting = false;
          introStartTimer = 0;
        }
      }
      return;
    }
    if (gameState === "dying") {
      keys.clear();
      deathTransitionTimer += dt;
      const deathProgress = Math.max(0, Math.min(1, deathTransitionTimer / DEATH_TRANSITION_DURATION));
      const sinkProgress = Math.max(0, Math.min(1, deathProgress / .72));
      const easedSink = sinkProgress * sinkProgress * (3 - 2 * sinkProgress);
      player.y = deathStartY + easedSink * 96;
      animationTime += dt;
      if (deathTransitionTimer >= DEATH_TRANSITION_DURATION) {
        gameState = "gameover";
        gameOverRevealTimer = 0;
      }
      return;
    }
    if (gameState === "gameover") {
      gameOverRevealTimer += dt;
      animationTime += dt;
      return;
    }
    if (menuOpen) return;
    if (doorTransition.active) {
      keys.clear();
      doorTransition.timer += dt;
      const midpoint = doorTransition.duration / 2;
      if (!doorTransition.switched && doorTransition.timer >= midpoint) {
        doorTransition.switched = true;
        if (doorTransition.target === "cabin") enterCabin();
        else exitCabin();
      }
      if (doorTransition.timer >= doorTransition.duration) doorTransition.active = false;
      animationTime += dt;
      return;
    }
    if (gameState === "playing") {
      const movingBirdDirection = keys.has("KeyD") || keys.has("ArrowRight");
      const movingAgainstBirds = keys.has("KeyA") || keys.has("ArrowLeft");
      const birdSpeedFactor = movingBirdDirection && !movingAgainstBirds
        ? .38
        : movingAgainstBirds && !movingBirdDirection ? 2.05 : 1;
      birdFlightTime += dt * birdSpeedFactor;
    }
    if (gameState === "cabin") {
      const left = keys.has("KeyA") || keys.has("ArrowLeft");
      const right = keys.has("KeyD") || keys.has("ArrowRight");
      player.vx = (Number(right) - Number(left)) * 190;
      player.x = Math.max(250, Math.min(690, player.x + player.vx * dt));
      if (player.vx) player.facing = Math.sign(player.vx);
      player.idleTimer = player.vx ? 0 : player.idleTimer + dt;
      updateFootsteps(dt, Math.abs(player.vx) > 1);
      animationTime += dt;
      return;
    }
    animationTime += dt;
    const level = levelData();
    player.hurtTimer = Math.max(0, player.hurtTimer - dt);
    const left = keys.has("KeyA") || keys.has("ArrowLeft");
    const right = keys.has("KeyD") || keys.has("ArrowRight");
    const up = keys.has("KeyW") || keys.has("ArrowUp");
    const down = keys.has("KeyS") || keys.has("ArrowDown");
    player.vx = (Number(right) - Number(left)) * MOVE_SPEED;
    if (player.vx) player.facing = Math.sign(player.vx);
    player.idleTimer = player.vx || player.climbing || !player.grounded ? 0 : player.idleTimer + dt;

    player.x += player.vx * dt;
    player.x = Math.max(0, Math.min(WORLD_W - player.w, player.x));

    const nearbyLadder = level.ladders.find((ladder) => overlaps(player, { x: ladder.x - 12, y: ladder.y, w: ladder.w + 24, h: ladder.h }));
    if (nearbyLadder && (up || down || player.climbing)) {
      player.climbing = true;
      player.jumpsUsed = 0;
      player.vy = (Number(down) - Number(up)) * 190;
      if (up || down) player.x += (nearbyLadder.x + nearbyLadder.w / 2 - player.x - player.w / 2) * Math.min(1, dt * 9);
    } else {
      player.climbing = false;
      player.vy += GRAVITY * dt;
    }

    const previousBottom = player.y + player.h;
    player.y += player.vy * dt;
    if (player.climbing && nearbyLadder && down) {
      player.y = Math.min(player.y, nearbyLadder.y + nearbyLadder.h - player.h);
    }
    player.grounded = false;

    for (const platform of level.platforms) {
      const overlapsX = player.x + player.w > platform.x && player.x < platform.x + platform.w;
      const crossedTop = previousBottom <= platform.y && player.y + player.h >= platform.y;
      if (!player.climbing && overlapsX && crossedTop && player.vy >= 0) {
        player.y = platform.y - player.h;
        player.vy = 0;
        player.grounded = true;
        player.jumpsUsed = 0;
      }
    }

    updateFootsteps(dt, player.grounded && !player.climbing && Math.abs(player.vx) > 1);

    for (const item of level.items) {
      if (item.collected || !overlaps(player, item)) continue;
      if (item.type === "fly") {
        if (player.hurtTimer === 0) {
          player.hp -= 1;
          addFloatingFeedback("damage", 1);
          player.hurtTimer = .55;
          playPlayerHurtSound();
          player.vy = -330;
          player.vx = -player.facing * 210;
          if (player.hp <= 0) {
            triggerGameOver();
            return;
          }
        }
      } else if (item.type === "berry" || item.type === "apple") {
        // Healing food remains in the world at full health. It is consumed
        // only when it can restore an actually missing heart.
        if (player.hp < player.maxHp) {
          player.hp += 1;
          item.collected = true;
          playHealingFoodSound();
        }
      } else {
        basket[item.type] += 1;
        item.collected = true;
        addFloatingFeedback("mushroom", 1);
        playMushroomPickupSound();
        if (basket.brown + basket.yellow + basket.beige === MUSHROOM_GOAL) {
          playMushroomCompletionSound();
        }
      }
    }

    const bearBounds = currentLevel === 1
      ? { min: 1370, max: 2960, pitMin: 1350, pitMax: 3040, pitTop: 700 }
      : { min: 2310, max: 2575, pitMin: 2300, pitMax: 2660, pitTop: 470 };
    const playerCenter = player.x + player.w / 2;
    const playerInBearPit = playerCenter >= bearBounds.pitMin && playerCenter <= bearBounds.pitMax && player.y > bearBounds.pitTop;
    bear.awake = playerInBearPit;
    if (bear.awake) {
      const direction = Math.sign(player.x - bear.x) || 1;
      bear.patrolDirection = direction;
      bear.vx = direction * 96;
    } else {
      if (bear.x <= bearBounds.min) bear.patrolDirection = 1;
      if (bear.x >= bearBounds.max) bear.patrolDirection = -1;
      bear.vx = bear.patrolDirection * 34;
    }
    bear.x += bear.vx * dt;
    bear.x = Math.max(bearBounds.min, Math.min(bearBounds.max, bear.x));
    if (overlaps(player, bear) && player.hurtTimer === 0) {
      player.hp -= 2;
      addFloatingFeedback("damage", 2);
      player.hurtTimer = .55;
      playPlayerHurtSound();
      player.vy = -390;
      player.x += player.x < bear.x ? -34 : 34;
      if (player.hp <= 0) {
        triggerGameOver();
        return;
      }
    }

    const mushroomTotal = basket.brown + basket.yellow + basket.beige;
    if (mushroomTotal >= MUSHROOM_GOAL && overlaps(player, level.portal)) switchLevel();

    if (player.y > WORLD_H + 120) {
      triggerGameOver();
      return;
    }

    const targetX = player.x + player.w / 2 - VIEW_W * 0.42;
    camera.x += (targetX - camera.x) * Math.min(1, dt * 6);
    camera.x = Math.max(0, Math.min(WORLD_W - VIEW_W, camera.x));
    // Keep Myko lower in the frame so more of the level above is visible.
    const targetY = player.y + player.h / 2 - VIEW_H * .84;
    camera.y += (targetY - camera.y) * Math.min(1, dt * 5);
    camera.y = Math.max(0, Math.min(WORLD_H - VIEW_H, camera.y));
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function respawn() {
    Object.assign(player, spawn, { vx: 0, vy: 0, grounded: false, hp: player.maxHp, hurtTimer: .55, jumpsUsed: 0, idleTimer: 0 });
  }

  function addFloatingFeedback(kind, amount) {
    floatingFeedback.push({
      kind,
      amount,
      x: player.x + player.w / 2,
      y: player.y - 8,
      age: 0,
      duration: .9
    });
  }

  function updateFloatingFeedback(dt) {
    for (let index = floatingFeedback.length - 1; index >= 0; index--) {
      const feedback = floatingFeedback[index];
      feedback.age += dt;
      if (feedback.age >= feedback.duration) floatingFeedback.splice(index, 1);
    }
  }

  function triggerGameOver() {
    if (gameState === "dying" || gameState === "gameover") return;
    gameState = "dying";
    deathTransitionTimer = 0;
    deathStartY = player.y;
    gameOverRevealTimer = 0;
    const playerBottom = player.y + player.h;
    const supportingPlatforms = levelData().platforms.filter((platform) => (
      player.x + player.w > platform.x && player.x < platform.x + platform.w
    ));
    const closestPlatform = supportingPlatforms.sort((a, b) => (
      Math.abs(a.y - playerBottom) - Math.abs(b.y - playerBottom)
    ))[0];
    deathGroundY = closestPlatform?.y ?? playerBottom;
    keys.clear();
    player.hp = 0;
    player.vx = 0;
    player.vy = 0;
    bear.awake = false;
    bear.vx = 0;
    playGameOverSound();
  }

  function resetBear() {
    Object.assign(bear, currentLevel === 1
      ? { x: 2360, y: 770, vx: 0, awake: false, patrolDirection: 1 }
      : { x: 2415, y: 550, vx: 0, awake: false, patrolDirection: 1 });
  }

  function switchLevel() {
    currentLevel = currentLevel === 1 ? 2 : 1;
    keys.clear();
    basket.brown = 0;
    basket.yellow = 0;
    basket.beige = 0;
    floatingFeedback.length = 0;
    for (const item of levelData().items) item.collected = false;
    Object.assign(player, spawn, { vx: 0, vy: 0, grounded: false, climbing: false, hp: player.maxHp, hurtTimer: 0, facing: 1, jumpsUsed: 0, idleTimer: 0 });
    camera.x = 0;
    camera.y = 0;
    resetBear();
  }

  function nearCabinDoor() {
    const centerX = player.x + player.w / 2;
    return Math.abs(centerX - (cabin.doorX + cabin.doorW / 2)) < 58 && player.y > 350;
  }

  function enterCabin() {
    gameState = "cabin";
    keys.clear();
    Object.assign(player, { x: 480, y: 407, vx: 0, vy: 0, grounded: true, climbing: false, jumpsUsed: 0, idleTimer: 0 });
    camera.x = 0;
    camera.y = 0;
  }

  function exitCabin() {
    gameState = "playing";
    keys.clear();
    Object.assign(player, { x: 178, y: 407, vx: 0, vy: 0, grounded: true, climbing: false, jumpsUsed: 0, facing: 1, idleTimer: 0 });
    camera.x = 0;
    camera.y = 0;
  }

  function restartGame() {
    gameOverSoundFadeToken += 1;
    gameOverMenuSound.pause();
    gameOverMenuSound.currentTime = 0;
    deathTransitionTimer = 0;
    gameOverRevealTimer = 0;
    gameState = "playing";
    flashlightEquipped = false;
    animationTime = 0;
    keys.clear();
    Object.assign(player, spawn, { vx: 0, vy: 0, grounded: false, climbing: false, hp: player.maxHp, hurtTimer: 0, facing: 1, jumpsUsed: 0, idleTimer: 0 });
    camera.x = 0;
    camera.y = 0;
    basket.brown = 0;
    basket.yellow = 0;
    basket.beige = 0;
    floatingFeedback.length = 0;
    for (const item of levelData().items) item.collected = false;
    resetBear();
  }

  function drawForestLayer(offset, color, baseline, spacing, height) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, VIEW_H);
    for (let x = -spacing; x < VIEW_W + spacing; x += spacing) {
      const sx = x - ((camera.x * offset) % spacing);
      ctx.lineTo(sx, baseline);
      ctx.lineTo(sx + spacing * .28, baseline - height);
      ctx.lineTo(sx + spacing * .56, baseline);
    }
    ctx.lineTo(VIEW_W, VIEW_H);
    ctx.closePath();
    ctx.fill();
  }

  function drawAnimatedGrassSunlight() {
    const grassY = VIEW_H - 107;
    const drift = Math.sin(animationTime * .22) * 34;
    const parallaxOffset = camera.x * .82;
    const sunlightSpan = VIEW_W + 320;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.filter = "blur(13px)";

    for (let i = 0; i < 4; i++) {
      const pulse = .65 + Math.sin(animationTime * .75 + i * 1.7) * .18;
      const worldRayX = 115 + i * 330;
      const topX = ((worldRayX - parallaxOffset + drift * (i % 2 ? -1 : 1)) % sunlightSpan + sunlightSpan) % sunlightSpan - 120;
      const bottomX = topX - 95 + Math.sin(animationTime * .32 + i) * 24;
      const ray = ctx.createLinearGradient(topX, -20, bottomX, grassY);
      ray.addColorStop(0, `rgba(255, 239, 177, ${.28 * pulse})`);
      ray.addColorStop(.58, `rgba(255, 220, 126, ${.22 * pulse})`);
      ray.addColorStop(1, `rgba(255, 205, 94, ${.15 * pulse})`);
      ctx.fillStyle = ray;
      ctx.beginPath();
      ctx.moveTo(topX - 30, -25);
      ctx.lineTo(topX + 48, -25);
      ctx.lineTo(bottomX + 92, grassY + 8);
      ctx.lineTo(bottomX - 62, grassY + 8);
      ctx.closePath();
      ctx.fill();
    }

    ctx.filter = "blur(8px)";
    const grassGlow = ctx.createLinearGradient(0, grassY - 48, 0, grassY + 4);
    const glowPulse = .18 + Math.sin(animationTime * .9) * .035;
    grassGlow.addColorStop(0, "rgba(255, 218, 120, 0)");
    grassGlow.addColorStop(1, `rgba(255, 221, 126, ${glowPulse})`);
    ctx.fillStyle = grassGlow;
    ctx.fillRect(0, grassY - 48, VIEW_W, 56);
    ctx.restore();
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    sky.addColorStop(0, "#233f40");
    sky.addColorStop(1, "#dfa765");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const originalsReady = backgroundSprites.every(({ ready }) => ready());
    if (originalsReady) {
      for (let index = backgroundSprites.length - 1; index >= 0; index--) {
        const { image, scale, fixedWidth, fixedHeight, yOffset = 0 } = backgroundSprites[index];
        const parallax = .28 + (backgroundSprites.length - 1 - index) * .18;
        const width = fixedWidth ?? Math.round(WORLD_W * scale);
        const sourceWidth = image.naturalWidth || image.width;
        const sourceHeight = image.naturalHeight || image.height;
        const height = fixedHeight ?? sourceHeight * (width / sourceWidth);
        const offset = ((camera.x * parallax) % width + width) % width;
        const layerY = VIEW_H - height - 95 + yOffset;
        for (let x = -offset - width; x < VIEW_W + width; x += width) {
          if (index === 0) {
            const bandHeight = 4;
            const sourceBandHeight = sourceHeight * bandHeight / height;
            for (let bandY = 0; bandY < height; bandY += bandHeight) {
              const bandBottom = Math.min(height, bandY + bandHeight);
              const swayStrength = Math.pow(1 - bandY / height, 1.7);
              const breeze = Math.sin(animationTime * 1.35 + x * .012 + bandY * .085);
              const swayX = Math.round(breeze * 3 * swayStrength);
              const sourceY = sourceHeight * bandY / height;
              const sourceH = Math.min(sourceBandHeight + .5, sourceHeight - sourceY);
              ctx.drawImage(
                image,
                0, sourceY, sourceWidth, sourceH,
                Math.round(x) + swayX, Math.round(layerY + bandY), width, bandBottom - bandY + 1
              );
            }
          } else {
            ctx.drawImage(image, Math.round(x), Math.round(layerY), width, height);
          }
        }
        if (index === 1) {
          const distanceShade = ctx.createLinearGradient(0, layerY, 0, VIEW_H - 95);
          distanceShade.addColorStop(0, "rgba(3, 14, 18, 0)");
          distanceShade.addColorStop(.16, "rgba(3, 14, 18, .2)");
          distanceShade.addColorStop(.82, "rgba(2, 12, 15, .36)");
          distanceShade.addColorStop(1, "rgba(2, 12, 15, 0)");
          ctx.fillStyle = distanceShade;
          ctx.fillRect(0, Math.max(0, layerY), VIEW_W, VIEW_H - 95 - Math.max(0, layerY));
        }
      }
      drawAnimatedGrassSunlight();
      return;
    }

    const celestialX = 712 - camera.x * .05;
    ctx.fillStyle = "#f3c777";
    ctx.fillRect(celestialX, 76, 68, 68);
    drawForestLayer(.08, "#35534a", 360, 130, 210);
    drawForestLayer(.18, "#29443a", 410, 105, 180);
    drawForestLayer(.32, "#21362d", 450, 88, 145);

    ctx.fillStyle = "#f7d99b88";
    for (let i = 0; i < 16; i++) {
      const x = ((i * 173 - camera.x * .12) % (VIEW_W + 40) + VIEW_W + 40) % (VIEW_W + 40);
      const y = 80 + (i * 67) % 250;
      ctx.fillRect(Math.round(x), y, 4, 4);
    }

  }

  function beginJourney() {
    if (introStarting) return;
    introStarting = true;
    introStartTimer = 0;
    hint.classList.add("hidden");
    startBackgroundMusic();
  }

  function drawDistantBirds() {
    // A flock crosses the far sky, followed by a long quiet interval before
    // the next pass. Keeping it here places it behind every world object.
    const cycleLength = 29;
    const flightDuration = 14.5;
    const cycle = birdFlightTime % cycleLength;
    if (cycle > flightDuration) return;

    const progress = cycle / flightDuration;
    const flockX = -95 + progress * (VIEW_W + 210);
    const flockY = 122 + Math.sin(progress * Math.PI * 2) * 13;
    const birds = [
      { x: 0, y: 0, size: 1.2 },
      { x: -21, y: 11, size: 1.1 },
      { x: -41, y: 22, size: 1 },
      { x: 25, y: 14, size: 1.1 },
      { x: 47, y: 25, size: 1 },
      { x: 69, y: 35, size: 1 }
    ];

    ctx.save();
    ctx.fillStyle = "rgba(25, 40, 38, .72)";
    for (let index = 0; index < birds.length; index++) {
      const bird = birds[index];
      const x = Math.round(flockX + bird.x);
      const y = Math.round(flockY + bird.y + Math.sin(animationTime * 1.4 + index) * 2);
      const wingFrame = Math.sin(animationTime * 6.5 + index * 1.7);
      const wingLift = wingFrame > .25 ? -2 : wingFrame < -.25 ? 2 : 0;
      const pixel = Math.max(1, Math.round(bird.size));
      ctx.fillRect(x - pixel, y, pixel * 2 + 1, pixel);
      ctx.fillRect(x - pixel * 3, y + wingLift, pixel * 2, pixel);
      ctx.fillRect(x + pixel + 1, y + wingLift, pixel * 2, pixel);
      ctx.fillRect(x - pixel * 2, y + Math.sign(wingLift || 1) * pixel, pixel, pixel);
      ctx.fillRect(x + pixel * 2, y + Math.sign(wingLift || 1) * pixel, pixel, pixel);
    }
    ctx.restore();
  }

  function roundedPlatformPath(targetCtx, x, y, width, height, radius = 9) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    targetCtx.beginPath();
    targetCtx.moveTo(x + r, y);
    targetCtx.lineTo(x + width - r, y);
    targetCtx.quadraticCurveTo(x + width, y, x + width, y + r);
    targetCtx.lineTo(x + width, y + height - r);
    targetCtx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    targetCtx.lineTo(x + r, y + height);
    targetCtx.quadraticCurveTo(x, y + height, x, y + height - r);
    targetCtx.lineTo(x, y + r);
    targetCtx.quadraticCurveTo(x, y, x + r, y);
    targetCtx.closePath();
  }

  function drawSurfaceEarthPlatform(platform, x, y) {
    const seed = Math.abs(Math.floor(platform.x / 10));
    const baseY = Math.round(455 - camera.y);
    const hillHeight = Math.max(62, baseY - y);
    const spread = 18 + (seed % 4) * 7;
    const left = x - spread;
    const right = x + platform.w + spread;

    if (hillHeight >= 58 && cohesiveRootPlatformSprite.complete && cohesiveRootPlatformSprite.naturalWidth) {
      const sourceY = Math.round(cohesiveRootPlatformSprite.naturalHeight * .115);
      const sourceHeight = Math.round(cohesiveRootPlatformSprite.naturalHeight * .805);
      const visualX = x - 10;
      const visualWidth = platform.w + 20;
      const visualHeight = hillHeight + 18;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      // Elevated roots must stop at the surface grass line instead of
      // continuing through the walkable ground below it.
      ctx.beginPath();
      ctx.rect(visualX - 2, y - 8, visualWidth + 4, Math.max(1, baseY - y + 8));
      ctx.clip();
      if (seed % 2) {
        ctx.translate(visualX + visualWidth, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(
          cohesiveRootPlatformSprite,
          0, sourceY, cohesiveRootPlatformSprite.naturalWidth, sourceHeight,
          0, y - 5, visualWidth, visualHeight
        );
      } else {
        ctx.drawImage(
          cohesiveRootPlatformSprite,
          0, sourceY, cohesiveRootPlatformSprite.naturalWidth, sourceHeight,
          visualX, y - 5, visualWidth, visualHeight
        );
      }
      ctx.restore();
      return;
    }

    drawRootSupports(platform, x, y, baseY, seed);

    const earthSprite = earthPlatformSprites[platform.rockAsset ?? (seed % earthPlatformSprites.length)];
    if (earthSprite?.complete && earthSprite.naturalWidth) {
      // Each exported sprite already has the platform's exact collision width.
      // Draw it 1:1 with its first grass row on the physics surface.
      ctx.drawImage(earthSprite, x, y);
      drawForestRoots(x, y + 1, platform.w, 72 + (seed % 3) * 8, seed);
      if (platformGrassOverlay.complete && platformGrassOverlay.naturalWidth) {
        const grassHeight = 14;
        const grassWidth = Math.round(grassHeight * platformGrassOverlay.naturalWidth / platformGrassOverlay.naturalHeight);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y - 7, platform.w, grassHeight + 3);
        ctx.clip();
        for (let grassX = x; grassX < x + platform.w; grassX += grassWidth) {
          ctx.drawImage(platformGrassOverlay, grassX, y - 7, grassWidth, grassHeight);
        }
        ctx.restore();
      }
      return;
    }

    const shoulderA = y + Math.round(hillHeight * (.28 + (seed % 3) * .035));
    const shoulderB = y + Math.round(hillHeight * (.57 + (seed % 2) * .06));

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.beginPath();
    ctx.moveTo(x + 5, y);
    ctx.lineTo(x + platform.w - 5, y);
    ctx.lineTo(x + platform.w + 3, y + 7);
    ctx.lineTo(x + platform.w + 9, shoulderA);
    ctx.lineTo(right - 7, shoulderB);
    ctx.lineTo(right, baseY);
    ctx.lineTo(left, baseY);
    ctx.lineTo(left + 6, shoulderB + 8);
    ctx.lineTo(x - 8, shoulderA);
    ctx.lineTo(x - 3, y + 8);
    ctx.closePath();
    ctx.clip();

    const rockShade = ctx.createLinearGradient(0, y, 0, baseY);
    rockShade.addColorStop(0, "#66704c");
    rockShade.addColorStop(.2, "#4d553d");
    rockShade.addColorStop(.65, "#34382f");
    rockShade.addColorStop(1, "#232923");
    ctx.fillStyle = rockShade;
    ctx.fillRect(left, y, right - left, hillHeight + 2);

    const stoneColors = ["#78805a", "#596047", "#454b3b", "#30362f"];
    for (let rowY = y + 13, row = 0; rowY < baseY; rowY += 15, row++) {
      const inset = Math.max(0, Math.round((1 - (rowY - y) / hillHeight) * 9));
      const offset = ((row + seed) % 2) * 13;
      for (let rockX = left - 8 + offset; rockX < right; rockX += 28) {
        const tone = stoneColors[(row + Math.floor(rockX / 28) + seed) & 3];
        ctx.fillStyle = tone;
        ctx.fillRect(rockX + inset, rowY, 21, 9);
        ctx.fillStyle = "rgba(17,22,18,.62)";
        ctx.fillRect(rockX + inset + 3, rowY + 9, 18, 3);
        ctx.fillStyle = "rgba(151,157,104,.18)";
        ctx.fillRect(rockX + inset + 3, rowY + 1, 13, 2);
      }
    }
    ctx.restore();

    // The grass strip sits exactly on the collision surface.
    ctx.fillStyle = "#263819";
    ctx.fillRect(x + 3, y - 2, platform.w - 6, 6);
    ctx.fillStyle = "#718b2e";
    for (let grassX = x + 5; grassX < x + platform.w - 4; grassX += 7) {
      const blade = 5 + ((grassX + seed) % 4);
      ctx.fillRect(grassX, y - blade, 2, blade);
      if (((grassX + seed) & 1) === 0) ctx.fillRect(grassX + 2, y - blade + 3, 2, 2);
    }
    ctx.fillStyle = "#9eaa42";
    ctx.fillRect(x + 5, y - 3, platform.w - 10, 2);
  }

  function drawRootSupports(platform, x, y, baseY, seed) {
    const gapHeight = baseY - y;
    if (gapHeight < 58) return;
    const sizeClass = platform.w >= 270 ? 2 : platform.w >= 175 ? 1 : 0;
    const rootSupportSprite = rootSupportSprites[sizeClass];
    if (!rootSupportSprite.complete || !rootSupportSprite.naturalWidth) return;
    const supportHeight = gapHeight + 14;
    const widthScale = sizeClass === 2 ? .96 : sizeClass === 1 ? .9 : .72;
    const minimumWidth = sizeClass === 2 ? 190 : sizeClass === 1 ? 145 : 105;
    const supportWidth = Math.max(minimumWidth, Math.min(platform.w * widthScale, supportHeight * (sizeClass === 0 ? .78 : 1.18)));
    ctx.save();
    ctx.globalAlpha = .96;
    const sway = (seed % 11) - 5;
    const supportX = Math.round(x + platform.w / 2 - supportWidth / 2 + sway);
    ctx.beginPath();
    ctx.rect(supportX - 2, y, supportWidth + 4, Math.max(1, baseY - y));
    ctx.clip();
    ctx.drawImage(rootSupportSprite, supportX, y + 5, supportWidth, supportHeight);
    ctx.restore();
  }

  function drawForestRoots(x, y, width, rootHeight, seed) {
    if (!forestRootLayerSprite.complete || !forestRootLayerSprite.naturalWidth || width <= 0) return;
    const sourceY = Math.round(forestRootLayerSprite.naturalHeight * .14);
    const sourceHeight = Math.round(forestRootLayerSprite.naturalHeight * .67);
    const tileWidth = Math.max(250, Math.round(rootHeight * forestRootLayerSprite.naturalWidth / sourceHeight));
    const offset = -((seed * 37) % tileWidth);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, rootHeight + 2);
    ctx.clip();
    ctx.globalAlpha = .92;
    for (let rootX = x + offset; rootX < x + width; rootX += tileWidth) {
      ctx.drawImage(
        forestRootLayerSprite,
        0, sourceY, forestRootLayerSprite.naturalWidth, sourceHeight,
        rootX, y, tileWidth + 1, rootHeight
      );
    }
    ctx.restore();
  }

  function drawPlatforms() {
    for (const p of levelData().platforms) {
      const x = Math.round(p.x - camera.x);
      const y = Math.round(p.y - camera.y);
      if (x + p.w < 0 || x > VIEW_W) continue;
      if (!p.underground && p.h >= 60 && groundTransitionReady) {
        const textureHeight = 240;
        const textureY = y - 36;
        const tileWidth = Math.round(textureHeight * groundTransitionCanvas.width / groundTransitionCanvas.height);
        ctx.save();
        roundedPlatformPath(ctx, x, textureY, p.w, VIEW_H - textureY, 10);
        ctx.clip();
        // Anchor the soil to world coordinates. It follows the map at the
        // exact camera rate, with no independent parallax or player lock.
        const worldTileOffset = -(((Math.round(camera.x) % tileWidth) + tileWidth) % tileWidth);
        for (let tileX = worldTileOffset; tileX < VIEW_W; tileX += tileWidth) {
          ctx.drawImage(groundTransitionCanvas, tileX, textureY, tileWidth, textureHeight);
        }
        const fadeTop = textureY + textureHeight - 86;
        const fadeBottom = textureY + textureHeight + 90;
        const deepFade = ctx.createLinearGradient(0, fadeTop, 0, fadeBottom);
        deepFade.addColorStop(0, "rgba(0, 3, 7, 0)");
        deepFade.addColorStop(.42, "rgba(0, 3, 7, .46)");
        deepFade.addColorStop(.68, "rgba(0, 3, 7, .34)");
        deepFade.addColorStop(1, "rgba(0, 3, 7, 0)");
        ctx.fillStyle = deepFade;
        ctx.fillRect(x, fadeTop, p.w, fadeBottom - fadeTop);

        ctx.restore();
        continue;
      }
      if (p.bridge) {
        ctx.save();
        roundedPlatformPath(ctx, x, y - 3, p.w, p.h + 3, 7);
        ctx.clip();
        ctx.fillStyle = "#493124";
        ctx.fillRect(x, y, p.w, p.h);
        ctx.fillStyle = "#b27a45";
        for (let plank = x + 5; plank < x + p.w; plank += 18) ctx.fillRect(plank, y + 2, 12, p.h - 4);
        ctx.fillStyle = "#d0a162";
        ctx.fillRect(x, y - 3, p.w, 3);
        ctx.restore();
        continue;
      }
      if (!p.underground && p.h < 60) {
        drawSurfaceEarthPlatform(p, x, y);
        continue;
      }
      if (p.underground && cavePlatformSprite.complete && cavePlatformSprite.naturalWidth) {
        // Crop away the transparent padding above the generated rock edge so
        // the visible ledge and the physics surface share the exact same Y.
        const sourceY = Math.round(cavePlatformSprite.naturalHeight * .205);
        const sourceHeight = Math.round(cavePlatformSprite.naturalHeight * .625);
        const visualHeight = p.h >= 60 ? Math.max(96, p.h + 28) : 68;
        const tileWidth = Math.round(visualHeight * cavePlatformSprite.naturalWidth / sourceHeight);
        ctx.save();
        roundedPlatformPath(ctx, x, y, p.w, visualHeight, p.h >= 60 ? 10 : 8);
        ctx.clip();
        for (let tileX = x; tileX < x + p.w; tileX += tileWidth) {
          ctx.drawImage(
            cavePlatformSprite,
            0, sourceY, cavePlatformSprite.naturalWidth, sourceHeight,
            tileX, y, tileWidth + 1, visualHeight
          );
        }
        ctx.restore();
        continue;
      }
      ctx.save();
      roundedPlatformPath(ctx, x, y - 9, p.w, p.h + 9, 8);
      ctx.clip();
      ctx.fillStyle = p.underground ? "#41352d" : "#6d4931";
      ctx.fillRect(x, y, p.w, p.h);
      ctx.fillStyle = p.underground ? "#79634d" : "#9b7144";
      ctx.fillRect(x, y, p.w, 8);
      ctx.fillStyle = p.underground ? "#667052" : "#567044";
      ctx.fillRect(x, y - 5, p.w, 7);
      ctx.fillStyle = p.underground ? "#82906a" : "#78924e";
      for (let tx = x + 8; tx < x + p.w; tx += 24) ctx.fillRect(tx, y - 9, 12, 5);
      ctx.fillStyle = "#302921";
      for (let tx = x + 18; tx < x + p.w; tx += 46) ctx.fillRect(tx, y + 19, 5, 15);
      ctx.restore();
    }
  }

  function drawCave() {
    const cave = currentLevel === 1
      ? { worldX: 1270, worldY: 540, width: 1830, inner: 1690 }
      : { worldX: 240, worldY: 540, width: 2800, inner: 2660 };
    const x = Math.round(cave.worldX - camera.x);
    const y = Math.round(cave.worldY - camera.y);
    if (caveBackgroundReady) {
      // The asset already contains its own black ceiling fade. Position that
      // fade above the entrance so the detailed cavern fills the playable depth.
      const caveImage = caveBackgroundSprite;
      const caveImageWidth = caveImage.naturalWidth;
      const caveImageHeight = caveImage.naturalHeight;
      const caveDrawHeight = 760;
      const caveDrawY = y - 90;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, cave.width, 760);
      ctx.clip();
      ctx.fillStyle = "#061015";
      ctx.fillRect(x, y, cave.width, 760);
      ctx.globalAlpha = .72;
      ctx.drawImage(caveImage, x, caveDrawY, cave.width, caveDrawHeight);
      ctx.globalAlpha = 1;
      ctx.restore();

      const drawRockWall = (wallWorldX, wallWidth) => {
        if (wallWidth <= 0) return;
        const wallX = Math.round(wallWorldX - camera.x);
        if (wallX + wallWidth < 0 || wallX > VIEW_W) return;
        ctx.save();
        ctx.beginPath();
        ctx.rect(wallX, y, wallWidth, 440);
        ctx.clip();
        ctx.fillStyle = "#111a1e";
        ctx.fillRect(wallX, y, wallWidth, 440);
        if (caveWallSprite.complete && caveWallSprite.naturalWidth) {
          const tileHeight = 440;
          const tileWidth = Math.round(tileHeight * caveWallSprite.naturalWidth / caveWallSprite.naturalHeight);
          // Anchor the texture to the wall's world position, not the screen.
          ctx.globalAlpha = .18;
          for (let tileX = wallX; tileX < wallX + wallWidth; tileX += tileWidth) {
            ctx.drawImage(caveWallSprite, tileX, y, tileWidth, tileHeight);
          }
          ctx.globalAlpha = 1;
          ctx.fillStyle = "rgba(1, 6, 9, .42)";
          ctx.fillRect(wallX, y, wallWidth, 440);
          ctx.restore();
          return;
        }
        for (let row = 0; row < 9; row++) {
          for (let wx = wallWorldX - 70; wx < wallWorldX + wallWidth + 70; wx += 70) {
            const rockX = Math.round(wx - camera.x + (row % 2) * 34);
            const rockY = Math.round(y + row * 52);
            const shade = ((Math.floor(wx / 70) + row) % 3 + 3) % 3;
            ctx.fillStyle = ["#253238", "#2d3a3d", "#354144"][shade];
            ctx.strokeStyle = "#11191c";
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.ellipse(rockX, rockY, 43, 31, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "#53605b55";
            ctx.fillRect(rockX - 20, rockY - 13, 25, 5);
          }
        }
        ctx.restore();
      };

      drawRockWall(0, cave.worldX);
      drawRockWall(cave.worldX + cave.width, WORLD_W - cave.worldX - cave.width);

      // Feather the panorama into both rock walls instead of leaving a hard seam.
      const blendWidth = 150;
      const blendSteps = 50;
      const sourceBlendWidth = Math.round(caveImageWidth * .08);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - blendWidth, y, cave.width + blendWidth * 2, 760);
      ctx.clip();
      for (let step = 0; step < blendSteps; step++) {
        const progress = step / blendSteps;
        const stripWidth = blendWidth / blendSteps + 1;
        const sourceStrip = sourceBlendWidth / blendSteps + 1;
        ctx.globalAlpha = Math.pow(1 - progress, 1.7);

        const rightSourceX = caveImageWidth - sourceBlendWidth + progress * sourceBlendWidth;
        ctx.drawImage(
          caveImage,
          rightSourceX, 0, sourceStrip, caveImageHeight,
          x + cave.width + step * blendWidth / blendSteps, caveDrawY, stripWidth, caveDrawHeight
        );

        const leftSourceX = sourceBlendWidth - (step + 1) * sourceBlendWidth / blendSteps;
        ctx.drawImage(
          caveImage,
          leftSourceX, 0, sourceStrip, caveImageHeight,
          x - (step + 1) * blendWidth / blendSteps, caveDrawY, stripWidth, caveDrawHeight
        );
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }
    ctx.fillStyle = "#322a26";
    ctx.fillRect(x, y, cave.width, 440);
    ctx.fillStyle = "#14211e";
    ctx.fillRect(x + 70, y + 85, cave.inner, 315);
    ctx.fillStyle = "#59483a";
    for (let rx = x + 80; rx < x + cave.width - 80; rx += 76) {
      const ry = y + 70 + ((rx - x) % 4) * 8;
      ctx.fillRect(rx, ry, 42, 18);
    }
    ctx.fillStyle = "#8a744e";
    if (currentLevel === 1) ctx.fillRect(Math.round(2280 - camera.x), Math.round(872 - camera.y), 320, 28);
  }

  function drawLockedSubsoilBackdrop() {
    // The complete grass-to-soil transition is anchored to the world: tall
    // blades rise above the path while darker growth hangs into the earth.
    const surfaceY = Math.round(455 - camera.y);
    const topY = surfaceY - 40;
    const bottomY = Math.round(610 - camera.y);
    if (groundTransitionReady && rearGroundTransitionCanvas.width) {
      const drawHeight = bottomY - topY;
      const tileWidth = Math.round(drawHeight * rearGroundTransitionCanvas.width / rearGroundTransitionCanvas.height);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.beginPath();
      ctx.rect(0, topY, VIEW_W, drawHeight);
      ctx.clip();
      const worldTileOffset = -(((Math.round(camera.x) % tileWidth) + tileWidth) % tileWidth);
      for (let tileX = worldTileOffset; tileX < VIEW_W; tileX += tileWidth) {
        ctx.drawImage(rearGroundTransitionCanvas, tileX, topY, tileWidth + 1, drawHeight);
      }

      // Merge the lower half into the cave's darkness without a hard seam.
      const caveBlend = ctx.createLinearGradient(0, surfaceY + (bottomY - surfaceY) * .48, 0, bottomY);
      caveBlend.addColorStop(0, "rgba(0, 2, 4, 0)");
      caveBlend.addColorStop(.48, "rgba(0, 2, 4, .42)");
      caveBlend.addColorStop(.78, "rgba(0, 2, 4, .78)");
      caveBlend.addColorStop(1, "rgba(0, 2, 4, 1)");
      ctx.fillStyle = caveBlend;
      ctx.fillRect(0, surfaceY, VIEW_W, bottomY - surfaceY);
      ctx.restore();
      return;
    }
    const soilFade = ctx.createLinearGradient(0, topY, 0, bottomY);
    soilFade.addColorStop(0, "#896747");
    soilFade.addColorStop(.46, "#725239");
    soilFade.addColorStop(.82, "#553c30");
    soilFade.addColorStop(1, "#263039");
    ctx.fillStyle = soilFade;
    ctx.fillRect(0, topY, VIEW_W, bottomY - topY);
  }

  function drawWaterfalls() {
    const data = levelData();
    const surfaceBlocks = data.platforms
      .filter((platform) => !platform.underground && platform.h >= 60)
      .slice()
      .sort((a, b) => a.x - b.x);

    for (let i = 0; i < surfaceBlocks.length - 1; i++) {
      const left = surfaceBlocks[i];
      const right = surfaceBlocks[i + 1];
      const gapStart = left.x + left.w;
      const gapEnd = right.x;
      const gapWidth = gapEnd - gapStart;
      if (gapWidth < 28 || gapWidth > 150) continue;
      const containsLadder = data.ladders.some((ladder) => {
        const center = ladder.x + ladder.w / 2;
        return center > gapStart - 8 && center < gapEnd + 8;
      });
      if (containsLadder) continue;

      const x = Math.round(gapStart - camera.x);
      const y = Math.round(Math.min(left.y, right.y) - camera.y);
      const width = Math.round(gapWidth);
      const height = Math.max(0, VIEW_H - y + 28);
      if (x + width < 0 || x > VIEW_W || height <= 0) continue;

      // Cover the warm fallback sky beneath the gap before adding the shaped
      // water layer, otherwise beige pixels show around its rounded sides.
      ctx.fillStyle = "#071c25";
      ctx.fillRect(x, y - 12, width, height + 25);

      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y - 13, width, height + 23);
      ctx.clip();
      const waterDepth = ctx.createLinearGradient(x, y, x + width, y);
      waterDepth.addColorStop(0, "rgba(5, 25, 33, .98)");
      waterDepth.addColorStop(.35, "rgba(10, 42, 50, .98)");
      waterDepth.addColorStop(.68, "rgba(13, 51, 59, .98)");
      waterDepth.addColorStop(1, "rgba(4, 23, 31, .98)");
      ctx.fillStyle = waterDepth;
      ctx.fillRect(x + 2, y - 13, width - 4, height + 13);

      // Use one color-stable source image. Motion comes from a continuously
      // shifting crop and subtle highlights, so there is no visible frame swap.
      const waterfallFrame = waterfallFrames[0];
      const hasWaterfallFrame = waterfallFrame.complete && waterfallFrame.naturalWidth;
      if (hasWaterfallFrame) {
        const sourceX = Math.round(waterfallFrame.naturalWidth * .33);
        const sourceWidth = Math.round(waterfallFrame.naturalWidth * .34);
        const lipSourceY = Math.round(waterfallFrame.naturalHeight * .355);
        const lipSourceHeight = Math.round(waterfallFrame.naturalHeight * .105);
        const flowSourceY = Math.round(waterfallFrame.naturalHeight * .455);
        const flowSourceHeight = Math.round(waterfallFrame.naturalHeight * .205);
        const lipHeight = 25;
        const flowTop = y - 13 + lipHeight;
        const flowHeight = height + 18 - lipHeight;
        ctx.globalAlpha = .9;
        ctx.drawImage(
          waterfallFrame,
          sourceX, lipSourceY, sourceWidth, lipSourceHeight,
          x, y - 13, width, lipHeight
        );
        // One continuous texture covers the entire fall. Repeating short
        // strips created a visible horizontal seam travelling downward.
        ctx.drawImage(
          waterfallFrame,
          sourceX, flowSourceY, sourceWidth, flowSourceHeight,
          x, flowTop, width, flowHeight
        );
        ctx.globalAlpha = 1;

        // Clearly visible but soft ribbons move downward at varied speeds.
        // Each ribbon bends by a few pixels so none reads as a rigid line.
        for (let lane = 0; lane < 5; lane++) {
          const baseLaneX = x + Math.round(width * (.12 + lane * .19));
          const speed = 31 + lane * 4;
          const spacing = 52 + (lane % 2) * 9;
          const streakOffset = (animationTime * speed + lane * 13) % spacing;
          ctx.fillStyle = lane === 2 ? "rgba(207, 240, 232, .38)" : "rgba(131, 214, 209, .3)";
          for (let streakY = flowTop - spacing + streakOffset; streakY < flowTop + flowHeight; streakY += spacing) {
            const bend = Math.round(Math.sin(streakY * .055 + lane * 1.4 + animationTime * .55) * 2);
            const streakX = baseLaneX + bend;
            const streakLength = 13 + (lane % 3) * 4;
            ctx.fillRect(streakX, Math.round(streakY), 2, streakLength);
            ctx.fillRect(streakX + (bend >= 0 ? 2 : -2), Math.round(streakY + streakLength - 3), 3, 2);
          }
        }

        // Darker undertows moving at a second speed add depth to the flow.
        for (let lane = 0; lane < 3; lane++) {
          const undertowOffset = (animationTime * (22 + lane * 3) + lane * 21) % 73;
          ctx.fillStyle = "rgba(5, 73, 91, .22)";
          for (let streakY = flowTop - 73 + undertowOffset; streakY < flowTop + flowHeight; streakY += 73) {
            const streakX = x + Math.round(width * (.25 + lane * .25)) + Math.round(Math.sin(streakY * .04 + lane) * 2);
            ctx.fillRect(streakX, Math.round(streakY), 3, 18);
          }
        }
      } else {
      // Deep channels make the fall read as a thick, folded sheet of water.
      ctx.fillStyle = "rgba(2, 24, 36, .62)";
      for (let channel = 4; channel < width - 4; channel += 15) {
        const channelX = x + channel + Math.round(Math.sin(channel * .31) * 3);
        ctx.fillRect(channelX, y - 8, 6 + (channel % 3), height + 5);
      }

      // Several stepped ribbons travel downward at different rates. Their
      // horizontal bends change by segment, creating the reference's braided
      // pixel-water look instead of straight repeating bars.
      const ribbonColors = [
        "rgba(40, 126, 143, .9)",
        "rgba(67, 157, 166, .88)",
        "rgba(103, 190, 190, .82)"
      ];
      for (let lane = 0; lane < Math.max(5, Math.floor(width / 10)); lane++) {
        const baseX = 4 + (lane * 11) % Math.max(12, width - 10);
        const speed = 45 + (lane % 4) * 11;
        const flowOffset = Math.floor(animationTime * speed + lane * 17) % 32;
        for (let segmentY = y - 34 + flowOffset; segmentY < y + height; segmentY += 30) {
          const bend = Math.round(Math.sin(segmentY * .055 + lane * 1.7 + animationTime * .7) * 4);
          const ribbonX = x + baseX + bend;
          const ribbonW = 3 + (lane % 3);
          const ribbonH = 13 + ((lane * 7 + segmentY) & 7);
          ctx.fillStyle = ribbonColors[lane % ribbonColors.length];
          ctx.fillRect(ribbonX, segmentY, ribbonW, ribbonH);
          ctx.fillRect(ribbonX + (bend >= 0 ? ribbonW : -2), segmentY + ribbonH - 3, 3, 3);
          if ((lane + segmentY) % 3 === 0) {
            ctx.fillStyle = "rgba(181, 226, 220, .78)";
            ctx.fillRect(ribbonX + 1, segmentY + 2, 2, Math.max(4, ribbonH - 7));
          }
        }
      }

      // Small looping eddies descend between the ribbons.
      const eddyOffset = Math.floor(animationTime * 36) % 54;
      for (let eddy = 0; eddy < 3; eddy++) {
        const eddyX = x + 9 + ((eddy * 23 + width) % Math.max(16, width - 20));
        for (let eddyY = y - 54 + eddyOffset + eddy * 19; eddyY < y + height; eddyY += 92) {
          ctx.fillStyle = "rgba(13, 66, 82, .84)";
          ctx.fillRect(eddyX, eddyY, 9, 3);
          ctx.fillRect(eddyX - 3, eddyY + 3, 3, 8);
          ctx.fillRect(eddyX + 9, eddyY + 3, 3, 8);
          ctx.fillRect(eddyX, eddyY + 11, 9, 3);
          ctx.fillStyle = "rgba(117, 203, 199, .78)";
          ctx.fillRect(eddyX + 2, eddyY - 2, 7, 2);
          ctx.fillRect(eddyX + 9, eddyY + 1, 2, 5);
        }
      }
      }
      ctx.restore();

      // A shallow stream gathers on both sides before spilling over the ledge.
      ctx.fillStyle = "rgba(29, 91, 99, .72)";
      ctx.fillRect(x - 34, y - 7, 38, 5);
      ctx.fillRect(x + width - 4, y - 7, 38, 5);
      ctx.fillStyle = "rgba(137, 190, 184, .7)";
      ctx.fillRect(x - 29, y - 8, 25, 2);
      ctx.fillRect(x + width + 4, y - 8, 24, 2);

      // Irregular wet stones form a visible natural rim around the drop.
      ctx.fillStyle = "#202b28";
      ctx.fillRect(x - 18, y - 10, 18, 12);
      ctx.fillRect(x - 11, y - 16, 13, 9);
      ctx.fillRect(x + width, y - 10, 18, 12);
      ctx.fillRect(x + width - 2, y - 16, 13, 9);
      ctx.fillStyle = "#485449";
      ctx.fillRect(x - 15, y - 12, 11, 4);
      ctx.fillRect(x + width + 4, y - 12, 11, 4);
      ctx.fillStyle = "#63733b";
      ctx.fillRect(x - 12, y - 17, 10, 3);
      ctx.fillRect(x + width + 1, y - 17, 9, 3);

      // A dark wet lip and pale water foam join the fall to the ground edge.
      ctx.fillStyle = "#102d35";
      ctx.fillRect(x + 1, y - 14, width - 2, 5);
      ctx.fillStyle = "#2b6f79";
      ctx.fillRect(x + 5, y - 12, width - 10, 3);
      ctx.fillStyle = "rgba(113, 184, 188, .72)";
      ctx.fillRect(x + 3, y - 9, width - 6, 5);
      for (let foamX = x + 4; foamX < x + width - 4; foamX += 14) {
        const foamY = y - 9 + Math.round(Math.sin(animationTime * 1.8 + foamX * .16));
        ctx.fillStyle = "rgba(110, 179, 187, .78)";
        ctx.fillRect(foamX, foamY, 8, 2);
        ctx.fillStyle = "rgba(197, 226, 222, .82)";
        ctx.fillRect(foamX + 2, foamY - 2, 4, 2);
      }
    }
  }

  function drawCabinExterior() {
    const x = Math.round(cabin.x - camera.x);
    const y = Math.round(cabin.y - camera.y - CABIN_VISUAL_RISE);
    const doorX = Math.round(cabin.doorX - camera.x);
    const doorY = Math.round(cabin.doorY - camera.y - CABIN_VISUAL_RISE);
    const originalCabinReady = interactiveSprites.cabin.complete && interactiveSprites.cabin.naturalWidth;
    if (generatedCabinReady || originalCabinReady) {
      ctx.save();
      // Bring the richly coloured cabin into the same subdued forest palette
      // without reducing opacity or softening its pixel-art details.
      ctx.filter = "saturate(78%) brightness(92%) contrast(96%) hue-rotate(3deg)";
      if (generatedCabinReady) {
        const generatedHeight = Math.round(cabin.w * generatedCabinCanvas.height / generatedCabinCanvas.width);
        const generatedY = Math.round(cabin.y + cabin.h - camera.y + 3 - generatedHeight);
        ctx.drawImage(generatedCabinCanvas, x, generatedY, cabin.w, generatedHeight);
      } else {
        ctx.drawImage(interactiveSprites.cabin, x, y, cabin.w, cabin.h);
      }
      ctx.restore();
      if (nearCabinDoor() && gameState === "playing") {
        ctx.fillStyle = "#182019e6";
        ctx.fillRect(doorX - 21, doorY - 36, 90, 26);
        ctx.strokeStyle = "#d1a866";
        ctx.strokeRect(doorX - 21, doorY - 36, 90, 26);
        ctx.fillStyle = "#fff0c9";
        ctx.font = "bold 12px 'Courier New', monospace";
        ctx.fillText("E  ENTER", doorX - 10, doorY - 18);
      }
      return;
    }
    ctx.fillStyle = "#3f2d25";
    ctx.fillRect(x + 20, y + 45, cabin.w - 40, cabin.h - 45);
    ctx.fillStyle = "#745039";
    for (let row = y + 53; row < y + cabin.h; row += 18) ctx.fillRect(x + 25, row, cabin.w - 50, 7);
    ctx.fillStyle = "#49342a";
    ctx.fillRect(x + 150, y - 18, 26, 55);
    ctx.fillStyle = "#2c2925";
    ctx.fillRect(x + 146, y - 22, 34, 10);
    ctx.fillStyle = "#6a4030";
    ctx.beginPath();
    ctx.moveTo(x, y + 58);
    ctx.lineTo(x + cabin.w / 2, y - 25);
    ctx.lineTo(x + cabin.w, y + 58);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#a36b45";
    ctx.fillRect(x + 7, y + 52, cabin.w - 14, 12);

    ctx.fillStyle = "#291f1b";
    ctx.fillRect(doorX, doorY, cabin.doorW, cabin.doorH);
    ctx.fillStyle = "#936743";
    ctx.fillRect(doorX + 7, doorY + 8, cabin.doorW - 14, cabin.doorH - 8);
    ctx.fillStyle = "#e4bf68";
    ctx.fillRect(doorX + 31, doorY + 37, 5, 5);

    ctx.fillStyle = "#d9b967";
    ctx.fillRect(x + 47, y + 91, 42, 36);
    ctx.fillStyle = "#315052";
    ctx.fillRect(x + 52, y + 96, 32, 26);
    ctx.fillStyle = "#d9b967";
    ctx.fillRect(x + 66, y + 96, 4, 26);
    ctx.fillRect(x + 52, y + 107, 32, 4);

    if (nearCabinDoor() && gameState === "playing") {
      ctx.fillStyle = "#182019e6";
      ctx.fillRect(doorX - 21, doorY - 36, 90, 26);
      ctx.strokeStyle = "#d1a866";
      ctx.strokeRect(doorX - 21, doorY - 36, 90, 26);
      ctx.fillStyle = "#fff0c9";
      ctx.font = "bold 12px 'Courier New', monospace";
      ctx.fillText("E  ENTER", doorX - 10, doorY - 18);
    }
  }

  function drawCabinInterior() {
    if (cabinInteriorSprite.complete && cabinInteriorSprite.naturalWidth) {
      ctx.drawImage(cabinInteriorSprite, 0, 0, VIEW_W, VIEW_H);
    } else {
      ctx.fillStyle = "#29150f";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    const cabinTime = performance.now() / 1000;
    const flicker = Math.sin(cabinTime * 9.3) * .018 + Math.sin(cabinTime * 15.7) * .012;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    // Eldens mjuka rumsglöd.
    const fireGlow = ctx.createRadialGradient(620, 374, 6, 620, 374, 126);
    fireGlow.addColorStop(0, `rgba(255, 151, 47, ${.25 + flicker})`);
    fireGlow.addColorStop(.38, `rgba(223, 91, 28, ${.11 + flicker})`);
    fireGlow.addColorStop(1, "rgba(172, 55, 18, 0)");
    ctx.fillStyle = fireGlow;
    ctx.fillRect(490, 245, 265, 245);
    ctx.restore();

    // A layered pixel fire, raised into the hearth opening. Each tongue has
    // its own rhythm so the whole flame no longer moves as one rigid block.
    const frame = Math.floor(cabinTime * 11) % 6;
    const leftLift = [0, -3, -6, -2, 1, -2][frame];
    const centerLift = [-2, -7, -3, 0, -5, -8][frame];
    const rightLift = [-4, -1, 1, -5, -7, -2][frame];

    // Glowing coals and crossed logs.
    ctx.fillStyle = "#341611";
    ctx.fillRect(598, 398, 44, 7);
    ctx.fillStyle = "#6e301a";
    ctx.fillRect(601, 395, 19, 6);
    ctx.fillRect(622, 396, 17, 5);
    ctx.fillStyle = "#d54b1d";
    ctx.fillRect(607, 398, 7, 3);
    ctx.fillRect(628, 398, 6, 3);

    // Deep red outer silhouette.
    ctx.fillStyle = "#7f2919";
    ctx.fillRect(603, 379 + leftLift, 11, 20 - leftLift);
    ctx.fillRect(610, 367 + centerLift, 19, 33 - centerLift);
    ctx.fillRect(628, 376 + rightLift, 10, 23 - rightLift);
    ctx.fillRect(606, 389, 31, 12);

    // Orange body with three independently moving flame tongues.
    ctx.fillStyle = "#dd511b";
    ctx.fillRect(607, 383 + leftLift, 10, 17 - leftLift);
    ctx.fillRect(614, 373 + centerLift, 12, 28 - centerLift);
    ctx.fillRect(626, 384 + rightLift, 8, 16 - rightLift);
    ctx.fillStyle = "#f39a27";
    ctx.fillRect(611, 390 + leftLift, 8, 10 - leftLift);
    ctx.fillRect(617, 382 + centerLift, 8, 19 - centerLift);
    ctx.fillRect(626, 390 + rightLift, 6, 10 - rightLift);
    ctx.fillStyle = "#ffe07a";
    ctx.fillRect(617, 391, 7, 10);
    ctx.fillRect(620, 384 + centerLift, 4, 10 - centerLift);

    // Tiny rising embers add movement above the main flame without blur.
    ctx.fillStyle = "#f5a43a";
    for (let ember = 0; ember < 3; ember++) {
      const emberCycle = (cabinTime * (17 + ember * 3) + ember * 13) % 28;
      const emberX = 610 + ember * 10 + Math.round(Math.sin(cabinTime * 4 + ember) * 3);
      const emberY = 374 - Math.round(emberCycle);
      ctx.globalAlpha = Math.max(0, 1 - emberCycle / 28) * .8;
      ctx.fillRect(emberX, emberY, 3, 3);
    }
    ctx.globalAlpha = 1;

    // Diskret utgångshjälp vid dörren.
    ctx.fillStyle = "rgba(20, 13, 10, .78)";
    ctx.fillRect(744, 254, 94, 25);
    ctx.strokeStyle = "#b8874c";
    ctx.strokeRect(744.5, 254.5, 93, 24);
    ctx.fillStyle = "#f0d9a2";
    ctx.font = "bold 11px 'Courier New', monospace";
    ctx.fillText("E  GO OUTSIDE", 751, 271);
    drawPlayer();
  }

  function drawTrees() {
    const data = levelData();
    ctx.save();
    ctx.filter = "saturate(80%) brightness(94%) contrast(88%) hue-rotate(-6deg)";
    for (const tree of levelData().trees) {
      const x = Math.round(tree.x - camera.x);
      const baseY = tree.y - camera.y;
      const s = tree.scale;
      if (x < -130 || x > VIEW_W + 130) continue;
      const nearLadder = data.ladders.some((ladder) => Math.abs(tree.x - (ladder.x + ladder.w / 2)) < 145);
      const behindRaisedPlatform = data.platforms.some((platform) => (
        !platform.underground && platform.y < 455
        && tree.x > platform.x - 45 && tree.x < platform.x + platform.w + 45
      ));
      ctx.globalAlpha = nearLadder ? .86 : behindRaisedPlatform ? .91 : .98;
      const sprite = vegetationSprites.trees[tree.variant ?? 0];
      if (sprite?.complete && sprite.naturalWidth) {
        const targetHeights = [300, 245, 275];
        const height = targetHeights[tree.variant ?? 0] * s;
        const width = height * sprite.naturalWidth / sprite.naturalHeight;
        ctx.drawImage(sprite, Math.round(x - width / 2), Math.round(baseY - height), Math.round(width), Math.round(height));
        continue;
      }
      ctx.fillStyle = "#4a3024";
      ctx.fillRect(x - 14 * s, baseY - 142 * s, 28 * s, 142 * s);
      ctx.fillStyle = "#68442d";
      ctx.fillRect(x - 5 * s, baseY - 138 * s, 9 * s, 132 * s);
      ctx.fillStyle = "#29452f";
      ctx.fillRect(x - 70 * s, baseY - 190 * s, 140 * s, 68 * s);
      ctx.fillStyle = "#3e6038";
      ctx.fillRect(x - 48 * s, baseY - 218 * s, 96 * s, 90 * s);
      ctx.fillStyle = "#587544";
      ctx.fillRect(x - 24 * s, baseY - 226 * s, 52 * s, 24 * s);
    }
    ctx.restore();
  }

  function drawBushes() {
    const data = levelData();
    ctx.save();
    ctx.filter = "saturate(82%) brightness(95%) contrast(89%) hue-rotate(-5deg)";
    for (const bush of levelData().bushes) {
      const x = Math.round(bush.x - camera.x);
      const elevatedPlatformSink = bush.y < 455 ? GROUND_VISUAL_SINK : 0;
      const y = Math.round(bush.y - camera.y + elevatedPlatformSink);
      const s = bush.scale;
      if (x < -90 || x > VIEW_W + 90) continue;
      const bushCenter = bush.x + 45 * s;
      const nearLadder = data.ladders.some((ladder) => Math.abs(bushCenter - (ladder.x + ladder.w / 2)) < 100);
      const behindRaisedPlatform = data.platforms.some((platform) => (
        !platform.underground && platform.y < 455
        && bushCenter > platform.x - 25 && bushCenter < platform.x + platform.w + 25
      ));
      ctx.globalAlpha = nearLadder ? .88 : behindRaisedPlatform ? .93 : .98;
      const sprite = vegetationSprites.bushes[bush.variant ?? 0];
      if (sprite?.complete && sprite.naturalWidth) {
        const targetHeights = [62, 75, 72];
        const height = targetHeights[bush.variant ?? 0] * s;
        const width = height * sprite.naturalWidth / sprite.naturalHeight;
        const centerX = x + 49 * s;
        ctx.drawImage(sprite, Math.round(centerX - width / 2), Math.round(y - height), Math.round(width), Math.round(height));
        continue;
      }
      ctx.fillStyle = "#28472f";
      ctx.fillRect(x, y - 32 * s, 68 * s, 32 * s);
      ctx.fillRect(x + 12 * s, y - 47 * s, 42 * s, 24 * s);
      ctx.fillStyle = "#41643b";
      ctx.fillRect(x + 7 * s, y - 37 * s, 22 * s, 14 * s);
      ctx.fillRect(x + 38 * s, y - 44 * s, 20 * s, 15 * s);
    }
    ctx.restore();
  }

  function drawMushroom(item, x, y) {
    const sprite = item.type === "fly" ? interactiveSprites.fly : interactiveSprites.mushrooms[item.variant ?? 0];
    if (sprite?.complete && sprite.naturalWidth) {
      const width = item.type === "fly" ? 26 : 27;
      const height = 29;
      ctx.drawImage(sprite, Math.round(x + item.w / 2 - width / 2), Math.round(y + item.h - height), width, height);
      return;
    }
    const colors = {
      brown: ["#7b4d2d", "#f0d2a0"],
      yellow: ["#d8a83f", "#f2d799"],
      beige: ["#d4b98c", "#f1dfbd"],
      fly: ["#c94a3c", "#f2dfbd"]
    };
    const [cap, stem] = colors[item.type];
    ctx.fillStyle = stem;
    ctx.fillRect(x + 8, y + 11, 8, 15);
    ctx.fillStyle = cap;
    ctx.fillRect(x + 3, y + 5, 18, 9);
    ctx.fillRect(x + 7, y + 1, 10, 4);
    if (item.type === "fly") {
      ctx.fillStyle = "#fff0d2";
      ctx.fillRect(x + 7, y + 5, 3, 3);
      ctx.fillRect(x + 15, y + 8, 3, 3);
    }
  }

  function drawItems() {
    for (const item of levelData().items) {
      if (item.collected) continue;
      const x = Math.round(item.x - camera.x);
      // Apples belong in tree canopies; collectible ground items sit partially
      // inside the grass/stone edge instead of floating above it.
      const mushroomLike = ["brown", "yellow", "beige", "fly"].includes(item.type);
      const onMainGround = mushroomLike && item.y === 429;
      const groundSink = item.type === "apple"
        ? 0
        : onMainGround ? MAIN_GROUND_VISUAL_SINK : GROUND_VISUAL_SINK;
      const y = Math.round(item.y - camera.y + groundSink);
      if (x + item.w < 0 || x > VIEW_W) continue;
      if (["brown", "yellow", "beige", "fly"].includes(item.type)) {
        drawMushroom(item, x, y);
      } else if (item.type === "apple") {
        const apple = interactiveSprites.apples[Math.floor(item.x / 100) % interactiveSprites.apples.length];
        if (apple.complete && apple.naturalWidth) {
          ctx.drawImage(apple, Math.round(x + item.w / 2 - 13.5), Math.round(y + item.h - 27), 27, 27);
          continue;
        }
        ctx.fillStyle = "#6b3a24"; ctx.fillRect(x + 9, y, 3, 6);
        ctx.fillStyle = "#6e8a43"; ctx.fillRect(x + 11, y + 1, 6, 4);
        ctx.fillStyle = "#c9513e"; ctx.fillRect(x + 3, y + 6, 16, 15);
        ctx.fillStyle = "#e77b55"; ctx.fillRect(x + 5, y + 7, 5, 4);
      } else {
        const berry = interactiveSprites.berries[Math.floor(item.x / 100) % interactiveSprites.berries.length];
        if (berry.complete && berry.naturalWidth) {
          ctx.drawImage(berry, Math.round(x + item.w / 2 - 12), Math.round(y + item.h - 24), 24, 24);
          continue;
        }
        ctx.fillStyle = "#47703e"; ctx.fillRect(x + 8, y, 3, 9);
        ctx.fillStyle = "#7d3f74"; ctx.fillRect(x + 2, y + 7, 8, 8); ctx.fillRect(x + 10, y + 8, 8, 8);
        ctx.fillStyle = "#c06aa1"; ctx.fillRect(x + 4, y + 8, 3, 3); ctx.fillRect(x + 12, y + 9, 3, 3);
      }
    }
  }

  function drawPlayer() {
    const x = Math.round(player.x - camera.x);
    const playerBottom = player.y + player.h;
    const onMainGround = player.grounded && levelData().platforms.some((platform) => (
      !platform.underground && platform.y === 455 &&
      player.x + player.w > platform.x && player.x < platform.x + platform.w &&
      Math.abs(playerBottom - platform.y) < 2
    ));
    const playerSink = gameState !== "playing"
      ? 0
      : onMainGround ? MAIN_GROUND_VISUAL_SINK : GROUND_VISUAL_SINK;
    const y = Math.round(player.y - camera.y + playerSink);
    const direction = player.facing < 0 ? "left" : "right";
    let frames;
    let frameIndex = 0;
    let mirrorSprite = false;

    if (player.hurtTimer > 0) {
      frames = spriteSet.hurt[direction];
    } else if (player.climbing) {
      frames = spriteSet.climb;
      frameIndex = Math.floor(animationTime * 7) % frames.length;
    } else if (gameState === "playing" && !player.grounded) {
      frames = spriteSet.jump[direction];
      if (player.vy < -260) frameIndex = 0;
      else if (player.vy < 80) frameIndex = 1;
      else if (player.vy < 360) frameIndex = 2;
      else frameIndex = 3;
    } else if (Math.abs(player.vx) > 1) {
      frames = flashlightEquipped && gameState === "playing" ? spriteSet.flashlightRun[direction] : spriteSet.run[direction];
      frameIndex = Math.floor(animationTime * 10) % frames.length;
    } else if (flashlightEquipped && gameState === "playing") {
      frames = spriteSet.flashlightIdle;
      mirrorSprite = player.facing < 0;
    } else if (player.idleTimer > 4) {
      frames = spriteSet.afk[direction];
    } else {
      frames = spriteSet.idle[direction];
    }

    const sprite = frames[frameIndex % frames.length];
    if (sprite.complete && sprite.naturalWidth) {
      const spriteSize = gameState === "cabin" ? 112 : 76;
      const spriteX = x + player.w / 2 - spriteSize / 2;
      const spriteY = y + player.h - spriteSize;
      ctx.save();
      if (player.hurtTimer > 0 && Math.floor(player.hurtTimer * 12) % 2 === 0) {
        ctx.filter = "sepia(1) saturate(12) hue-rotate(315deg) brightness(1.25)";
      }
      if (mirrorSprite) {
        ctx.translate(spriteX + spriteSize, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(sprite, 0, spriteY, spriteSize, spriteSize);
      } else {
        ctx.drawImage(sprite, spriteX, spriteY, spriteSize, spriteSize);
      }
      ctx.restore();
      return;
    }

    ctx.save();
    if (player.facing < 0) { ctx.translate(x + player.w, 0); ctx.scale(-1, 1); } else ctx.translate(x, 0);
    const hurtBlink = player.hurtTimer > 0 && Math.floor(player.hurtTimer * 12) % 2 === 0;
    ctx.fillStyle = hurtBlink ? "#ff554d" : "#efe0b3"; ctx.fillRect(8, y + 14, 20, 28);
    ctx.fillStyle = hurtBlink ? "#e3232d" : "#c7674b"; ctx.fillRect(2, y + 5, 30, 11); ctx.fillRect(8, y, 18, 8);
    ctx.fillStyle = "#f28b62"; ctx.fillRect(5, y + 5, 7, 5); ctx.fillRect(22, y + 2, 5, 5);
    ctx.fillStyle = "#3a342b"; ctx.fillRect(21, y + 21, 4, 5);
    ctx.fillStyle = "#765139"; ctx.fillRect(7, y + 40, 9, 8); ctx.fillRect(22, y + 40, 9, 8);
    if (flashlightEquipped && gameState === "playing") {
      ctx.fillStyle = "#d7ad57"; ctx.fillRect(27, y + 27, 11, 6);
      ctx.fillStyle = "#fff1a8"; ctx.fillRect(37, y + 28, 4, 4);
    }
    ctx.restore();
  }

  function drawLadders() {
    for (const ladder of levelData().ladders) {
      const x = Math.round(ladder.x - camera.x);
      const y = Math.round(ladder.y - camera.y);
      if (ladderRenderReady) {
        const visualWidth = 40;
        const visualX = Math.round(x + ladder.w / 2 - visualWidth / 2);
        const surfaceY = Math.round(455 - camera.y);
        const caveCeilingY = Math.round(540 - camera.y);
        const shaftCenterX = Math.round(x + ladder.w / 2);
        const shaftTop = surfaceY;
        const shaftWidth = 104;
        const shaftX = Math.round(shaftCenterX - shaftWidth / 2);
        // Keep the original earth shaft above ground, but remove its backdrop
        // exactly when the ladder enters the cave.
        const shaftBottom = caveCeilingY;
        const shaftHeight = Math.max(1, shaftBottom - shaftTop);

        if (ladderShaftSprite.complete && ladderShaftSprite.naturalWidth) {
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(ladderShaftSprite, shaftX, shaftTop, shaftWidth, shaftHeight);
          // Darken only the recessed core behind the ladder. Transparent
          // gradient edges preserve the soil walls without a rectangular veil.
          const coreX = shaftCenterX - 27;
          const coreShade = ctx.createLinearGradient(coreX, 0, coreX + 54, 0);
          coreShade.addColorStop(0, "rgba(0, 2, 3, 0)");
          coreShade.addColorStop(.2, "rgba(0, 2, 3, .34)");
          coreShade.addColorStop(.5, "rgba(0, 1, 2, .56)");
          coreShade.addColorStop(.8, "rgba(0, 2, 3, .34)");
          coreShade.addColorStop(1, "rgba(0, 2, 3, 0)");
          ctx.fillStyle = coreShade;
          ctx.fillRect(coreX, shaftTop, 54, shaftHeight);
          ctx.restore();
        } else {
          const shaftFallback = ctx.createLinearGradient(shaftX, 0, shaftX + shaftWidth, 0);
          shaftFallback.addColorStop(0, "#65452f");
          shaftFallback.addColorStop(.25, "#30231c");
          shaftFallback.addColorStop(.5, "#211a16");
          shaftFallback.addColorStop(.75, "#30231c");
          shaftFallback.addColorStop(1, "#65452f");
          ctx.fillStyle = shaftFallback;
          ctx.fillRect(shaftX, shaftTop, shaftWidth, shaftHeight);
        }

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.beginPath();
        const visibleLadderTop = Math.max(y - 3, surfaceY);
        const visibleLadderBottom = y + ladder.h + 3;
        ctx.rect(visualX, visibleLadderTop, visualWidth, visibleLadderBottom - visibleLadderTop);
        ctx.clip();
        const tileHeight = 20;
        for (let tileY = visibleLadderTop; tileY < visibleLadderBottom; tileY += tileHeight) {
          ctx.drawImage(ladderRenderCanvas, visualX, tileY, visualWidth, tileHeight + 1);
        }
        ctx.restore();
        continue;
      }
      ctx.fillStyle = "#8b633c";
      ctx.fillRect(x + 5, y, 6, ladder.h);
      ctx.fillRect(x + ladder.w - 11, y, 6, ladder.h);
      ctx.fillStyle = "#c09152";
      for (let rung = y + 12; rung < y + ladder.h; rung += 24) ctx.fillRect(x + 5, rung, ladder.w - 10, 5);
    }
  }

  function drawBear() {
    const x = Math.round(bear.x - camera.x);
    const y = Math.round(bear.y - camera.y + CAVE_BEAR_VISUAL_SINK);
    const direction = bear.vx < 0 ? "left" : "right";
    const frames = bear.awake ? bearSpriteSet.angry[direction] : bearSpriteSet.neutral[direction];
    const frameRate = bear.awake ? 8 : 2.5;
    const sprite = frames[Math.floor(animationTime * frameRate) % frames.length];
    if (sprite?.complete && sprite.naturalWidth) {
      ctx.drawImage(sprite, x + bear.w / 2 - 48, y + bear.h - 68, 96, 68);
      return;
    }
    ctx.fillStyle = "#4d3428";
    ctx.fillRect(x + 9, y + 14, 58, 32);
    ctx.fillRect(x + 50, y + 7, 25, 28);
    ctx.fillStyle = "#654536";
    ctx.fillRect(x + 52, y + 2, 9, 10); ctx.fillRect(x + 67, y + 3, 8, 10);
    ctx.fillStyle = "#211b18";
    ctx.fillRect(x + 68, y + 17, 5, 5);
    ctx.fillRect(x + 14, y + 42, 15, 8); ctx.fillRect(x + 49, y + 42, 15, 8);
    if (bear.awake) {
      ctx.fillStyle = "#f2c56f"; ctx.fillRect(x + 56, y + 13, 5, 4);
      ctx.fillStyle = "#d95443"; ctx.fillRect(x + 57, y + 14, 3, 3);
    }
  }

  function drawPortal() {
    const portal = levelData().portal;
    const portalUnlocked = basket.brown + basket.yellow + basket.beige >= MUSHROOM_GOAL;
    const x = Math.round(portal.x - camera.x);
    const y = Math.round(portal.y - camera.y);
    if (interactiveSprites.portal.complete && interactiveSprites.portal.naturalWidth) {
      const width = 125;
      const height = 140;
      const spriteX = Math.round(x + portal.w / 2 - width / 2);
      const spriteY = Math.round(y + portal.h - height);
      const centerX = x + portal.w / 2;
      const centerY = y + portal.h - 64;
      const magicPulse = .72 + Math.sin(animationTime * 4.2) * .18;

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const aura = ctx.createRadialGradient(centerX, centerY, 12, centerX, centerY, 92);
      aura.addColorStop(0, `rgba(219, 111, 255, ${.34 * magicPulse})`);
      aura.addColorStop(.38, `rgba(145, 49, 235, ${.22 * magicPulse})`);
      aura.addColorStop(.72, `rgba(88, 32, 172, ${.1 * magicPulse})`);
      aura.addColorStop(1, "rgba(67, 20, 130, 0)");
      ctx.fillStyle = aura;
      ctx.fillRect(centerX - 96, centerY - 96, 192, 192);

      const groundGlow = ctx.createRadialGradient(centerX, y + portal.h - 2, 3, centerX, y + portal.h - 2, 78);
      groundGlow.addColorStop(0, `rgba(198, 86, 255, ${.3 * magicPulse})`);
      groundGlow.addColorStop(1, "rgba(98, 32, 178, 0)");
      ctx.save();
      ctx.translate(centerX, y + portal.h - 2);
      ctx.scale(1, .24);
      ctx.translate(-centerX, -(y + portal.h - 2));
      ctx.fillStyle = groundGlow;
      ctx.fillRect(centerX - 82, y + portal.h - 84, 164, 168);
      ctx.restore();
      ctx.restore();

      ctx.save();
      if (!portalUnlocked) ctx.filter = "saturate(38%) brightness(62%)";
      ctx.drawImage(interactiveSprites.portal, spriteX, spriteY, width, height);
      ctx.restore();

      // Paint the animated wormhole over the static centre in the source art.
      // The tight elliptical clip preserves the surrounding mushroom frame.
      ctx.save();
      ctx.globalAlpha = portalUnlocked ? 1 : .48;
      ctx.translate(centerX, centerY + 8);
      ctx.scale(1, 1.42);
      ctx.beginPath();
      ctx.ellipse(0, 0, 22, 25, 0, 0, Math.PI * 2);
      ctx.clip();
      const vortexDepth = ctx.createRadialGradient(0, 0, 1, 0, 0, 25);
      vortexDepth.addColorStop(0, "#05020d");
      vortexDepth.addColorStop(.32, "#16053b");
      vortexDepth.addColorStop(.68, "#5520a0");
      vortexDepth.addColorStop(1, "#c86bff");
      ctx.fillStyle = vortexDepth;
      ctx.fillRect(-24, -27, 48, 54);
      ctx.globalCompositeOperation = "screen";
      ctx.lineCap = "round";
      for (let arm = 0; arm < 4; arm++) {
        ctx.beginPath();
        for (let step = 0; step < 26; step++) {
          const progress = step / 25;
          const angle = animationTime * (1.35 + arm * .035) + arm * Math.PI / 2 + progress * Math.PI * 2.7;
          const radius = 2 + progress * 21;
          const px = Math.cos(angle) * radius;
          const py = Math.sin(angle) * radius;
          if (step === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = arm % 2 ? "rgba(231, 167, 255, .72)" : "rgba(119, 91, 255, .68)";
        ctx.lineWidth = arm % 2 ? 1.4 : 2;
        ctx.stroke();
      }
      for (let mote = 0; mote < 9; mote++) {
        const cycle = (animationTime * (.34 + mote * .012) + mote * .117) % 1;
        const radius = (1 - cycle) * 21;
        const angle = animationTime * 1.7 + mote * 2.31 + cycle * 5.8;
        const size = cycle > .76 ? 1 : 2;
        ctx.fillStyle = mote % 3 ? "rgba(240, 205, 255, .9)" : "rgba(137, 214, 255, .85)";
        ctx.fillRect(Math.round(Math.cos(angle) * radius), Math.round(Math.sin(angle) * radius), size, size);
      }
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (let particle = 0; particle < 11; particle++) {
        const phase = animationTime * (.48 + (particle % 3) * .12) + particle * 1.83;
        const orbit = 43 + (particle % 4) * 8;
        const particleX = Math.round(centerX + Math.sin(phase * 2.1) * orbit);
        const rise = (animationTime * (19 + particle % 3 * 4) + particle * 29) % 128;
        const particleY = Math.round(y + portal.h - 5 - rise);
        const twinkle = .38 + Math.sin(animationTime * 7 + particle * 2.4) * .28;
        const size = particle % 4 === 0 ? 4 : 2;
        ctx.fillStyle = `rgba(${particle % 2 ? "224, 139, 255" : "151, 91, 255"}, ${Math.max(.12, twinkle)})`;
        ctx.fillRect(particleX, particleY, size, size);
        if (size === 4) {
          ctx.fillRect(particleX - 3, particleY + 1, 10, 2);
          ctx.fillRect(particleX + 1, particleY - 3, 2, 10);
        }
      }
      ctx.restore();
      if (!portalUnlocked && Math.abs(player.x + player.w / 2 - (portal.x + portal.w / 2)) < 180) {
        ctx.fillStyle = "rgba(20, 24, 19, .9)";
        ctx.fillRect(centerX - 86, y - 45, 172, 28);
        ctx.strokeStyle = "#b98b51";
        ctx.strokeRect(centerX - 86, y - 45, 172, 28);
        ctx.fillStyle = "#f3dfb0";
        ctx.font = "bold 11px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.fillText(`MUSHROOMS ${basket.brown + basket.yellow + basket.beige}/${MUSHROOM_GOAL}`, centerX, y - 27);
        ctx.textAlign = "left";
      }
      return;
    }
    const pulse = .65 + Math.sin(animationTime * 5) * .2;
    ctx.fillStyle = "#3a2d55";
    ctx.fillRect(x - 8, y + 12, portal.w + 16, portal.h - 12);
    ctx.fillStyle = "#8265a7";
    ctx.fillRect(x, y + 5, portal.w, portal.h - 5);
    ctx.fillStyle = `rgba(116, 224, 197, ${pulse})`;
    ctx.fillRect(x + 10, y + 15, portal.w - 20, portal.h - 22);
    ctx.fillStyle = "#d7f4c7";
    ctx.fillRect(x + 18, y + 24, portal.w - 36, portal.h - 40);
    ctx.fillStyle = "#b9a070";
    ctx.fillRect(x - 12, y + portal.h - 8, portal.w + 24, 12);
  }

  function drawCaveLighting(caveDepth) {
    if (caveDepth < .02) {
      const caveTop = Math.round(540 - camera.y);
      if (caveTop < VIEW_H) {
        lightingCtx.clearRect(0, 0, VIEW_W, VIEW_H);
        lightingCtx.globalCompositeOperation = "source-over";
        lightingCtx.fillStyle = "rgba(0, 1, 4, .985)";
        lightingCtx.fillRect(0, Math.max(0, caveTop), VIEW_W, VIEW_H - Math.max(0, caveTop));
        ctx.drawImage(lightingCanvas, 0, 0);
      }
      return;
    }
    const maximumDarkness = flashlightEquipped ? .9 : .985;
    const darkness = Math.min(maximumDarkness, Math.pow(caveDepth, .48) * 1.04);
    const caveTop = Math.max(0, Math.round(540 - camera.y));
    lightingCtx.clearRect(0, 0, VIEW_W, VIEW_H);
    lightingCtx.globalCompositeOperation = "source-over";
    lightingCtx.fillStyle = `rgba(0, 1, 4, ${darkness})`;
    lightingCtx.fillRect(0, caveTop, VIEW_W, VIEW_H - caveTop);

    // Daylight entering through surface ladder openings widens as it falls.
    lightingCtx.globalCompositeOperation = "destination-out";
    for (const ladder of levelData().ladders) {
      if (ladder.y > 560) continue;
      const openingX = ladder.x - camera.x + ladder.w / 2;
      const nearbySurfaceY = levelData().platforms
        .filter((platform) => !platform.underground && platform.y >= ladder.y && platform.y <= ladder.y + 90)
        .reduce((closest, platform) => Math.min(closest, platform.y), ladder.y + 35);
      const openingY = nearbySurfaceY - camera.y;
      if (openingX < -220 || openingX > VIEW_W + 220 || openingY > VIEW_H) continue;
      const bottomY = Math.min(VIEW_H + 80, openingY + 360);
      const topHalfWidth = Math.max(14, ladder.w * .4);
      const bottomHalfWidth = 138;
      lightingCtx.save();
      lightingCtx.beginPath();
      lightingCtx.rect(0, openingY - 3, VIEW_W, VIEW_H - openingY + 83);
      lightingCtx.clip();
      lightingCtx.filter = "blur(20px)";
      lightingCtx.beginPath();
      lightingCtx.moveTo(openingX - topHalfWidth, openingY);
      lightingCtx.lineTo(openingX + topHalfWidth, openingY);
      lightingCtx.lineTo(openingX + bottomHalfWidth, bottomY);
      lightingCtx.lineTo(openingX - bottomHalfWidth, bottomY);
      lightingCtx.closePath();
      const daylight = lightingCtx.createLinearGradient(0, openingY, 0, bottomY);
      daylight.addColorStop(0, "rgba(0,0,0,.82)");
      daylight.addColorStop(.18, "rgba(0,0,0,.64)");
      daylight.addColorStop(.62, "rgba(0,0,0,.2)");
      daylight.addColorStop(1, "rgba(0,0,0,0)");
      lightingCtx.fillStyle = daylight;
      lightingCtx.fill();
      lightingCtx.filter = "none";
      lightingCtx.restore();
    }
    lightingCtx.globalCompositeOperation = "source-over";

    if (flashlightEquipped) {
      const px = player.x - camera.x + player.w / 2;
      const py = player.y - camera.y + player.h * .58;
      const direction = player.facing || 1;

      lightingCtx.globalCompositeOperation = "destination-out";
      lightingCtx.save();
      lightingCtx.filter = "blur(28px)";
      const beamFade = lightingCtx.createLinearGradient(
        px, py, px + direction * 455, py
      );
      beamFade.addColorStop(0, "rgba(0,0,0,1)");
      beamFade.addColorStop(.58, "rgba(0,0,0,.88)");
      beamFade.addColorStop(1, "rgba(0,0,0,0)");
      lightingCtx.beginPath();
      lightingCtx.moveTo(px + direction * 4, py - 18);
      lightingCtx.lineTo(px + direction * 455, py - 180);
      lightingCtx.lineTo(px + direction * 455, py + 180);
      lightingCtx.lineTo(px + direction * 4, py + 18);
      lightingCtx.closePath();
      lightingCtx.fillStyle = beamFade;
      lightingCtx.fill();
      lightingCtx.restore();

      // A second blurred core reveals dark cave art without a hard triangle.
      lightingCtx.save();
      lightingCtx.filter = "blur(16px)";
      const coreFade = lightingCtx.createLinearGradient(
        px, py, px + direction * 350, py
      );
      coreFade.addColorStop(0, "rgba(0,0,0,1)");
      coreFade.addColorStop(.72, "rgba(0,0,0,.98)");
      coreFade.addColorStop(1, "rgba(0,0,0,0)");
      lightingCtx.beginPath();
      lightingCtx.moveTo(px + direction * 4, py - 9);
      lightingCtx.lineTo(px + direction * 350, py - 102);
      lightingCtx.lineTo(px + direction * 350, py + 102);
      lightingCtx.lineTo(px + direction * 4, py + 9);
      lightingCtx.closePath();
      lightingCtx.fillStyle = coreFade;
      lightingCtx.fill();
      lightingCtx.restore();
      lightingCtx.globalCompositeOperation = "source-over";
    }

    ctx.drawImage(lightingCanvas, 0, 0);
  }

  function drawLevelTwoDarkness() {
    if (currentLevel !== 2 || gameState === "intro" || gameState === "cabin") return;

    lightingCtx.clearRect(0, 0, VIEW_W, VIEW_H);
    lightingCtx.globalCompositeOperation = "source-over";
    lightingCtx.fillStyle = flashlightEquipped ? "rgba(1, 5, 9, .93)" : "rgba(0, 2, 5, .965)";
    lightingCtx.fillRect(0, 0, VIEW_W, VIEW_H);

    if (flashlightEquipped) {
      const px = player.x - camera.x + player.w / 2;
      const py = player.y - camera.y + player.h * .56;
      const direction = player.facing || 1;
      lightingCtx.globalCompositeOperation = "destination-out";

      lightingCtx.save();
      lightingCtx.filter = "blur(14px)";
      const beamStartX = px + direction * 24;
      const beam = lightingCtx.createLinearGradient(beamStartX, py, px + direction * 345, py);
      beam.addColorStop(0, "rgba(0,0,0,.7)");
      beam.addColorStop(.58, "rgba(0,0,0,.56)");
      beam.addColorStop(1, "rgba(0,0,0,0)");
      lightingCtx.fillStyle = beam;
      lightingCtx.beginPath();
      lightingCtx.moveTo(beamStartX, py - 9);
      lightingCtx.lineTo(px + direction * 345, py - 105);
      lightingCtx.lineTo(px + direction * 345, py + 105);
      lightingCtx.lineTo(beamStartX, py + 9);
      lightingCtx.closePath();
      lightingCtx.fill();
      lightingCtx.restore();
      lightingCtx.globalCompositeOperation = "source-over";
    }

    ctx.drawImage(lightingCanvas, 0, 0);
  }

  function drawFloatingFeedback() {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "bold 16px 'Courier New', monospace";
    for (const feedback of floatingFeedback) {
      const progress = Math.max(0, Math.min(1, feedback.age / feedback.duration));
      const rise = progress * 34;
      const alpha = progress < .72 ? 1 : 1 - (progress - .72) / .28;
      const x = Math.round(feedback.x - camera.x);
      const y = Math.round(feedback.y - camera.y - rise);
      ctx.globalAlpha = Math.max(0, alpha);
      const label = feedback.kind === "mushroom" ? `+${feedback.amount}` : `−${feedback.amount}`;
      ctx.fillStyle = "rgba(17, 18, 12, .9)";
      ctx.fillText(label, x + 2, y + 2);
      ctx.fillStyle = feedback.kind === "mushroom" ? "#f4d36f" : "#ff6657";
      ctx.fillText(label, x, y);
      if (feedback.kind === "damage") {
        if (uiSprites.heart.complete && uiSprites.heart.naturalWidth) {
          ctx.drawImage(uiSprites.heart, x + 15, y - 14, 16, 16);
        } else {
          ctx.fillStyle = "#e94a42";
          ctx.fillRect(x + 16, y - 10, 12, 9);
        }
      }
    }
    ctx.restore();
  }

  function drawHud() {
    ctx.fillStyle = "#172119d9";
    ctx.fillRect(18, 18, 330, 74);
    ctx.strokeStyle = "#b98b51";
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, 330, 74);

    for (let i = 0; i < player.maxHp; i++) {
      const x = 32 + i * 27;
      if (uiSprites.heart.complete && uiSprites.heart.naturalWidth) {
        ctx.save();
        if (i >= player.hp) ctx.globalAlpha = .22;
        ctx.drawImage(uiSprites.heart, x - 2, 28, 24, 23);
        ctx.restore();
      } else {
        ctx.fillStyle = i < player.hp ? "#d95748" : "#4a4037";
        ctx.fillRect(x, 31, 9, 9); ctx.fillRect(x + 10, 31, 9, 9); ctx.fillRect(x + 4, 40, 11, 9); ctx.fillRect(x + 7, 49, 5, 5);
      }
    }

    if (uiSprites.basket.complete && uiSprites.basket.naturalWidth) {
      ctx.drawImage(uiSprites.basket, 205, 25, 38, 45);
    } else {
      ctx.fillStyle = "#b7834d";
      ctx.fillRect(208, 37, 32, 25);
      ctx.strokeStyle = "#e1b875";
      ctx.lineWidth = 3;
      ctx.strokeRect(214, 29, 20, 12);
    }
    const mushroomTotal = basket.brown + basket.yellow + basket.beige;
    ctx.font = "bold 16px 'Courier New', monospace";
    ctx.fillStyle = "#f4e2b8";
    ctx.fillText(`${mushroomTotal}/${MUSHROOM_GOAL}`, 262, 55);
    ctx.font = "bold 11px 'Courier New', monospace";
    ctx.fillStyle = "#cdbd99";
    ctx.fillText("MUSHROOMS", 249, 76);

    ctx.fillStyle = "#f4e2b8";
    ctx.font = "bold 12px 'Courier New', monospace";
    ctx.fillText(`LEVEL ${currentLevel}`, 22, 112);

    ctx.fillStyle = "#172119d9";
    ctx.fillRect(VIEW_W - 190, 18, 172, 48);
    ctx.strokeStyle = flashlightEquipped ? "#f1ce72" : "#80694a";
    ctx.lineWidth = 3;
    ctx.strokeRect(VIEW_W - 190, 18, 172, 48);
    ctx.fillStyle = flashlightEquipped ? "#ffe59a" : "#9b927d";
    ctx.font = "bold 12px 'Courier New', monospace";
    ctx.fillText(`F  FLASHLIGHT ${flashlightEquipped ? "ON" : "OFF"}`, VIEW_W - 175, 47);
  }

  function drawPauseMenu() {
    ctx.save();
    ctx.fillStyle = "rgba(5, 9, 7, .76)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = "#172119f2";
    ctx.fillRect(240, 82, 480, 376);
    ctx.strokeStyle = "#b98b51";
    ctx.lineWidth = 4;
    ctx.strokeRect(242, 84, 476, 372);
    ctx.strokeStyle = "#4d6b4d";
    ctx.lineWidth = 2;
    ctx.strokeRect(250, 92, 460, 356);

    ctx.textAlign = "center";
    ctx.fillStyle = "#f4e2b8";
    ctx.font = "bold 30px 'Courier New', monospace";
    ctx.fillText("PAUSED", VIEW_W / 2, 140);
    ctx.font = "12px 'Courier New', monospace";
    ctx.fillStyle = "#b9ad8e";
    ctx.fillText("ESC closes  •  arrows adjust", VIEW_W / 2, 165);

    const drawVolumeRow = (label, y, volume, muted, selected) => {
      if (selected) {
        ctx.fillStyle = "rgba(185, 139, 81, .13)";
        ctx.fillRect(270, y - 30, 420, 58);
      }
      ctx.textAlign = "left";
      ctx.fillStyle = selected ? "#ffe5aa" : "#dfcfaa";
      ctx.font = "bold 15px 'Courier New', monospace";
      ctx.fillText(label, 282, y + 5);
      ctx.fillStyle = "#0b110d";
      ctx.fillRect(390, y - 9, 230, 18);
      ctx.fillStyle = muted ? "#51483a" : "#78964e";
      ctx.fillRect(394, y - 5, Math.round(222 * volume), 10);
      ctx.strokeStyle = "#b98b51";
      ctx.lineWidth = 2;
      ctx.strokeRect(390, y - 9, 230, 18);
      ctx.fillStyle = muted ? "#5a4036" : "#31593d";
      ctx.fillRect(640, y - 18, 60, 36);
      ctx.strokeStyle = muted ? "#8b6652" : "#87a85b";
      ctx.strokeRect(640, y - 18, 60, 36);
      ctx.textAlign = "center";
      ctx.fillStyle = "#f4e2b8";
      ctx.font = "bold 11px 'Courier New', monospace";
      ctx.fillText(muted ? "OFF" : "ON", 670, y + 4);
    };

    drawVolumeRow("MUSIC", 217, musicVolume, musicMuted, menuSelection === 0);
    drawVolumeRow("SOUNDS", 297, soundVolume, soundMuted, menuSelection === 1);

    ctx.fillStyle = menuSelection === 2 ? "#6f5535" : "#30291f";
    ctx.fillRect(390, 375, 180, 45);
    ctx.strokeStyle = "#b98b51";
    ctx.strokeRect(390, 375, 180, 45);
    ctx.fillStyle = "#f4e2b8";
    ctx.font = "bold 14px 'Courier New', monospace";
    ctx.fillText("CONTINUE", 480, 403);
    ctx.textAlign = "left";
    ctx.restore();
  }

  function drawDoorTransition() {
    if (!doorTransition.active) return;
    const halfDuration = doorTransition.duration / 2;
    const linearClosing = doorTransition.timer <= halfDuration
      ? doorTransition.timer / halfDuration
      : 1 - (doorTransition.timer - halfDuration) / halfDuration;
    const clamped = Math.max(0, Math.min(1, linearClosing));
    const eased = clamped * clamped * (3 - 2 * clamped);
    const playerCenterX = gameState === "cabin"
      ? player.x + player.w / 2
      : player.x + player.w / 2 - camera.x;
    const playerCenterY = gameState === "cabin"
      ? player.y + player.h / 2
      : player.y + player.h / 2 - camera.y;
    const maxRadius = Math.hypot(VIEW_W, VIEW_H);
    const radius = Math.max(0, maxRadius * (1 - eased));

    ctx.save();
    // Close a soft cinematic iris around Myko instead of sliding flat panels.
    ctx.beginPath();
    ctx.rect(0, 0, VIEW_W, VIEW_H);
    if (radius > .5) {
      ctx.moveTo(playerCenterX + radius, playerCenterY);
      ctx.arc(playerCenterX, playerCenterY, radius, 0, Math.PI * 2, true);
    }
    ctx.fillStyle = `rgba(8, 7, 6, ${.9 + eased * .1})`;
    ctx.fill("evenodd");

    // A restrained amber halo suggests warm light escaping around the door.
    if (radius > 5 && eased > .08) {
      const halo = ctx.createRadialGradient(
        playerCenterX, playerCenterY, Math.max(0, radius - 18),
        playerCenterX, playerCenterY, radius + 7
      );
      halo.addColorStop(0, "rgba(224, 154, 74, 0)");
      halo.addColorStop(.72, `rgba(224, 154, 74, ${Math.min(.24, eased * .28)})`);
      halo.addColorStop(1, "rgba(65, 35, 20, 0)");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    ctx.fillStyle = `rgba(12, 9, 7, ${eased * .22})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.restore();
  }

  function drawGameOver() {
    const pulse = .5 + Math.sin(animationTime * 3.2) * .5;
    const revealLinear = Math.max(0, Math.min(1, gameOverRevealTimer / .62));
    const reveal = revealLinear * revealLinear * (3 - 2 * revealLinear);
    ctx.save();
    ctx.fillStyle = "#020403";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = reveal;
    const panelScale = .955 + reveal * .045;
    ctx.translate(VIEW_W / 2, VIEW_H * .5);
    ctx.scale(panelScale, panelScale);
    ctx.translate(-VIEW_W / 2, -VIEW_H * .5);

    ctx.fillStyle = "#141a15f5";
    ctx.fillRect(245, 105, 470, 340);
    ctx.strokeStyle = "#5f372c";
    ctx.lineWidth = 6;
    ctx.strokeRect(248, 108, 464, 334);
    ctx.strokeStyle = "#b98b51";
    ctx.lineWidth = 2;
    ctx.strokeRect(258, 118, 444, 314);

    ctx.textAlign = "center";
    ctx.fillStyle = "#d8755e";
    ctx.font = "bold 44px 'Courier New', monospace";
    ctx.fillText("GAME OVER", VIEW_W / 2, 190);
    ctx.fillStyle = "#e8d4a9";
    ctx.font = "bold 14px 'Courier New', monospace";
    ctx.fillText("THE FOREST CLAIMED ANOTHER STEP", VIEW_W / 2, 226);

    const collected = basket.brown + basket.yellow + basket.beige;
    ctx.fillStyle = "#9e987d";
    ctx.font = "13px 'Courier New', monospace";
    ctx.fillText(`LEVEL ${currentLevel}   •   MUSHROOMS ${collected}/30`, VIEW_W / 2, 278);

    ctx.fillStyle = pulse > .45 ? "#715036" : "#62452f";
    ctx.fillRect(350, 354, 260, 60);
    ctx.strokeStyle = pulse > .45 ? "#e2b66d" : "#b98b51";
    ctx.lineWidth = 3;
    ctx.strokeRect(350, 354, 260, 60);
    ctx.fillStyle = "#fff0c9";
    ctx.font = "bold 20px 'Courier New', monospace";
    ctx.fillText("TRY AGAIN", VIEW_W / 2, 391);
    ctx.fillStyle = "#948b73";
    ctx.font = "11px 'Courier New', monospace";
    ctx.fillText("ENTER  •  SPACE  •  R", VIEW_W / 2, 425);
    ctx.restore();
  }

  function drawDeathTransitionOverlay(progress) {
    const fadeProgress = Math.max(0, Math.min(1, (progress - .12) / .88));
    const eased = fadeProgress * fadeProgress * (3 - 2 * fadeProgress);
    const vignette = ctx.createRadialGradient(
      VIEW_W / 2, VIEW_H / 2, 65,
      VIEW_W / 2, VIEW_H / 2, 570
    );
    vignette.addColorStop(0, `rgba(1, 3, 2, ${eased * .35})`);
    vignette.addColorStop(.62, `rgba(1, 3, 2, ${eased * .72})`);
    vignette.addColorStop(1, `rgba(0, 0, 0, ${Math.min(1, eased * 1.25)})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const finalBlack = Math.max(0, Math.min(1, (progress - .62) / .38));
    ctx.fillStyle = `rgba(0, 0, 0, ${finalBlack * finalBlack * (3 - 2 * finalBlack)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  function drawDyingPlayer() {
    const progress = Math.max(0, Math.min(1, deathTransitionTimer / DEATH_TRANSITION_DURATION));
    ctx.save();
    ctx.globalAlpha = 1 - Math.max(0, (progress - .38) / .48) * .28;
    ctx.beginPath();
    ctx.rect(0, 0, VIEW_W, Math.round(deathGroundY - camera.y + 2));
    ctx.clip();
    drawPlayer();
    ctx.restore();
  }

  function drawIntro() {
    // Use the exact same authored parallax images, layer order and color
    // treatment as the playable forest instead of procedural silhouettes.
    drawBackground();
    drawLockedSubsoilBackdrop();
    const titleShade = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    titleShade.addColorStop(0, "rgba(5, 13, 10, .2)");
    titleShade.addColorStop(.58, "rgba(5, 13, 10, .08)");
    titleShade.addColorStop(1, "rgba(4, 9, 7, .4)");
    ctx.fillStyle = titleShade;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    for (let index = 0; index < 24; index++) {
      const driftX = Math.sin(animationTime * .32 + index * 1.9) * 9;
      const x = (index * 83 + 31 + driftX) % VIEW_W;
      const y = 60 + (index * 47) % 365 + Math.sin(animationTime * .7 + index) * 5;
      const glow = .28 + Math.sin(animationTime * 1.4 + index * 2.2) * .16;
      ctx.fillStyle = `rgba(226, 185, 101, ${glow})`;
      ctx.fillRect(Math.round(x), Math.round(y), index % 5 === 0 ? 3 : 2, 2);
    }

    const logoFloat = Math.round(Math.sin(animationTime * .9) * 3);
    if (introLogo.complete && introLogo.naturalWidth) {
      ctx.drawImage(introLogo, 185, 72 + logoFloat, 590, 242);
    } else {
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff0c9";
      ctx.font = "bold 92px Georgia, serif";
      ctx.fillText("MYKO", VIEW_W / 2, 230 + logoFloat);
    }

    ctx.textAlign = "center";
    ctx.fillStyle = "#d1a866";
    ctx.font = "bold 12px 'Courier New', monospace";
    ctx.fillText("A LITTLE WOODLAND ADVENTURE", VIEW_W / 2, 338);

    const buttonPulse = .5 + Math.sin(animationTime * 2.5) * .5;
    ctx.save();
    ctx.shadowColor = `rgba(230, 177, 88, ${.18 + buttonPulse * .22})`;
    ctx.shadowBlur = 13 + buttonPulse * 5;
    ctx.shadowOffsetY = 6;
    roundedPlatformPath(ctx, 338, 376, 284, 72, 8);
    const buttonWood = ctx.createLinearGradient(0, 376, 0, 448);
    buttonWood.addColorStop(0, buttonPulse > .45 ? "#80613c" : "#705436");
    buttonWood.addColorStop(.48, "#4d3928");
    buttonWood.addColorStop(1, "#2d251c");
    ctx.fillStyle = buttonWood;
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = buttonPulse > .45 ? "#f0c978" : "#c69a58";
    ctx.lineWidth = 4;
    ctx.stroke();
    roundedPlatformPath(ctx, 347, 385, 266, 54, 5);
    ctx.strokeStyle = "#253729";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#d8ad62";
    ctx.fillRect(353, 397, 4, 29);
    ctx.fillRect(603, 397, 4, 29);
    ctx.restore();

    ctx.fillStyle = "#fff0c9";
    ctx.font = "bold 20px 'Courier New', monospace";
    ctx.shadowColor = "#1b120b";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillText("BEGIN JOURNEY", VIEW_W / 2, 419);
    ctx.shadowColor = "transparent";
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    roundedPlatformPath(ctx, 350, 458, 260, 32, 5);
    ctx.fillStyle = "rgba(10, 18, 14, .88)";
    ctx.fill();
    ctx.strokeStyle = "#80694a";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#eee0bd";
    ctx.font = "bold 12px 'Courier New', monospace";
    ctx.fillText("ENTER  •  SPACE  •  CLICK", VIEW_W / 2, 479);

    if (introStarting) {
      const fade = Math.max(0, Math.min(1, introStartTimer / .78));
      ctx.fillStyle = `rgba(7, 10, 8, ${fade * fade})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    ctx.textAlign = "left";
  }

  function render() {
    ctx.imageSmoothingEnabled = false;
    if (gameState === "intro") {
      drawIntro();
      return;
    }
    if (gameState === "cabin") {
      drawCabinInterior();
      if (menuOpen) drawPauseMenu();
      drawDoorTransition();
      return;
    }
    const deathProgress = gameState === "dying"
      ? Math.max(0, Math.min(1, deathTransitionTimer / DEATH_TRANSITION_DURATION))
      : 0;
    if (gameState === "dying") {
      const easedZoom = deathProgress * deathProgress * (3 - 2 * deathProgress);
      const scale = 1 - easedZoom * .18;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.save();
      ctx.translate(VIEW_W / 2, VIEW_H / 2);
      ctx.scale(scale, scale);
      ctx.translate(-VIEW_W / 2, -VIEW_H / 2);
    }
    drawBackground();
    drawDistantBirds();
    drawCave();
    drawLockedSubsoilBackdrop();
    drawTrees();
    drawBushes();
    drawPlatforms();
    drawCabinExterior();
    drawWaterfalls();
    drawLadders();
    drawItems();
    drawBear();
    drawPortal();
    if (gameState === "dying") drawDyingPlayer();
    else drawPlayer();
    drawFloatingFeedback();
    const caveDepth = Math.max(0, Math.min(1, (player.y - 500) / 220));
    if (currentLevel === 1) drawCaveLighting(caveDepth);
    drawLevelTwoDarkness();
    ctx.fillStyle = "#13241c66";
    ctx.fillRect(0, VIEW_H - 8, VIEW_W, 8);
    drawHud();
    if (menuOpen) drawPauseMenu();
    drawDoorTransition();
    if (gameState === "dying") {
      ctx.restore();
      drawDeathTransitionOverlay(deathProgress);
    }
    if (gameState === "gameover") drawGameOver();
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
