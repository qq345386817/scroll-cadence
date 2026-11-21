/* Shared by the isolated content script and deterministic/browser tests. */
(() => {
  const t = (...args) => globalThis.ScrollCadenceI18n?.t(...args) ?? args[0].replace(/\{(\d+)\}/g, (_, i) => args[Number(i) + 1]);
  if (globalThis.ScrollCadenceCore) return;
  const defaults = Object.freeze({ direction: "down", mode: "continuous", speed: 40,
    interval: 5, timing: "seconds", bpm: 96, beats: 16, pageFraction: 0.9, countdown: 3 });
  function beatSeconds(bpm, beats) {
    const tempo = Number(bpm), count = Number(beats);
    const seconds = 60 * count / tempo;
    return Number.isFinite(tempo) && tempo > 0 && Number.isSafeInteger(count) && count > 0 &&
      seconds >= 0.5 && seconds <= 3600 ? seconds : null;
  }
  function pageSeconds(settings) {
    return settings.timing === "beats" ? beatSeconds(settings.bpm, settings.beats) : settings.interval;
  }
  function config(input = {}) {
    const clamp = (v, lo, hi, fallback) => Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : fallback;
    const validBeats = beatSeconds(input.bpm, input.beats) !== null;
    return {
      guide: ["upper", "middle"].includes(input.guide) ? input.guide : "off",
      timing: input.timing === "beats" && validBeats ? "beats" : "seconds",
      bpm: validBeats ? Number(input.bpm) : defaults.bpm,
      beats: validBeats ? Number(input.beats) : defaults.beats,
      direction: ["up", "down", "left", "right"].includes(input.direction) ? input.direction : defaults.direction,
      mode: input.mode === "paged" ? "paged" : "continuous",
      speed: clamp(input.speed, 1, 600, defaults.speed),
      interval: clamp(input.interval, 0.5, 3600, defaults.interval),
      pageFraction: clamp(input.pageFraction, 0.1, 1, defaults.pageFraction),
      countdown: clamp(input.countdown, 0, 30, defaults.countdown)
    };
  }
  class Engine {
    constructor(clock, onChange = () => {}) {
      this.clock = clock;
      this.onChange = onChange;
      this.settings = config();
      this.state = "ready";
      this.reason = t("Ready");
      this.target = null;
      this.loop = null;
      this.token = null;
      this.generation = 0;
    }
    snapshot() { return { state: this.state, reason: this.reason, settings: this.settings }; }
    emit(state, reason) { this.state = state; this.reason = reason; this.onChange(this.snapshot()); }
    cancel() {
      this.generation++;
      if (this.token !== null) {
        if (this.tokenKind === "frame") this.clock.cancelFrame(this.token);
        else this.clock.clearTimer(this.token);
        this.token = null;
      }
    }
    setTarget(target) {
      this.cancel(); this.loop = null; this.target = target;
      this.emit("ready", target ? t("Scroll area selected") : t("Choose a scroll area"));
    }
    configure(settings) {
      this.settings = config(settings);
      if (["running", "countdown"].includes(this.state)) this.pause(t("Settings changed. Resume when ready."));
    }
    get mode() { return this.loop ? "continuous" : this.settings.mode; }
    get direction() { return this.loop ? "down" : this.settings.direction; }
    start(loop = null) {
      this.cancel();
      this.loop = null;
      if (loop) {
        if (!Number.isFinite(loop.a) || !Number.isFinite(loop.b) || loop.a < 0 || loop.b <= loop.a ||
            !this.target?.connected() || loop.b > this.target.range()) {
          return this.emit("error", t("Mark A, then mark B below A."));
        }
        this.loop = { a:loop.a, b:loop.b };
        this.target.move(false, loop.a - this.target.position(false));
      }
      if (!this.target?.connected()) return this.emit("error", t("Scroll area unavailable. Select it again."));
      if (!this.target.canScroll(this.direction)) return this.emit("error", t("No scroll range in this direction."));
      this.remainder = 0; this.stalledAt = null;
      if (this.settings.countdown > 0) {
        this.emit("countdown", t("Starting in {0} seconds", this.settings.countdown));
        const generation = this.generation;
        this.tokenKind = "timer";
        this.token = this.clock.setTimer(() => {
          if (generation === this.generation) this.run();
        }, this.settings.countdown * 1000);
      } else this.run();
    }
    run() {
      if (this.target?.validate?.() === false) return;
      this.cancel();
      this.last = this.clock.now(); this.remainder = 0; this.stalledAt = null;
      this.emit("running", this.mode === "paged" ? t("Paging on a timer") : t("Scrolling continuously"));
      this.schedule();
    }
    schedule() {
      const generation = this.generation;
      if (this.mode === "continuous") {
        this.tokenKind = "frame";
        this.token = this.clock.frame(() => { if (generation === this.generation) this.safeTick(); });
      } else {
        this.tokenKind = "timer";
        this.token = this.clock.setTimer(() => { if (generation === this.generation) this.safeTick(); }, pageSeconds(this.settings) * 1000);
      }
    }
    safeTick() {
      try { this.tick(); }
      catch (error) { this.stop(t("Scroll area cannot be controlled. Select it again."), "error"); }
    }
    tick() {
      if (this.state !== "running" || this.target?.validate?.() === false) return;
      if (!this.target?.connected()) return this.pause(t("Scroll area removed. Select it again."));
      const now = this.clock.now();
      const elapsed = (now - this.last) / 1000; this.last = now;
      if (this.mode === "continuous" && elapsed > 1) return this.pause(t("Execution interrupted. Resume when ready."));
      if (this.mode === "paged" && elapsed > pageSeconds(this.settings) + 2) return this.pause(t("Timer interrupted. Resume when ready."));
      const horizontal = ["left", "right"].includes(this.direction);
      const sign = ["up", "left"].includes(this.direction) ? -1 : 1;
      let amount;
      if (this.mode === "continuous") {
        this.remainder += this.settings.speed * Math.max(0, Math.min(elapsed, 0.1));
        amount = Math.floor(this.remainder); this.remainder -= amount;
      } else amount = Math.max(1, this.target.viewport(horizontal) * this.settings.pageFraction);
      if (amount > 0) {
        const before = this.target.position(horizontal);
        if (this.loop) {
          const {a, b} = this.loop;
          if (before < a || before + amount >= b) {
            if (before < b && before >= a) this.target.move(false, b - before);
            this.target.move(false, a - this.target.position(false));
            this.stalledAt = null;
            this.schedule();
            return;
          }
        }
        this.target.move(horizontal, sign * amount);
        const after = this.target.position(horizontal);
        if (Math.abs(after - before) < 0.01) {
          if (this.stalledAt === null) this.stalledAt = now;
          if (now - this.stalledAt >= 2500) return this.stop(t("Boundary reached, or the page did not accept scrolling."), "completed");
        } else this.stalledAt = null;
      }
      this.schedule();
    }
    pause(reason = t("Paused")) { this.cancel(); this.emit("paused", reason); }
    resume() {
      if (this.state !== "paused") return;
      if (!this.target?.connected()) return this.emit("error", t("Scroll area unavailable. Select it again."));
      this.run();
    }
    stop(reason = t("Stopped"), state = "stopped") { this.cancel(); this.loop = null; this.emit(state, reason); }
  }
  globalThis.ScrollCadenceCore = { defaults, config, beatSeconds, pageSeconds, Engine };
})();
