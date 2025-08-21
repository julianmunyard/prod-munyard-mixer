"use client";
import { useEffect } from "react";
import { initMixerEngine } from "../engine/mixerEngine";

export function useMixer() {
  useEffect(() => {
    const setup = async () => {
      const { ctx } = await initMixerEngine();
      console.log("🎧 AudioContext ready", ctx);
    };
    setup();
  }, []);
}