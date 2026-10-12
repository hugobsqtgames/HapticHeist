import { useEffect, useRef } from 'react';

import { EngineCallbacks, EngineConfig, LockEngine } from '@/engine/lock/LockEngine';

export function useLockEngine(cfg: EngineConfig, cb: EngineCallbacks, active: boolean, size: number) {
  const ref = useRef<LockEngine | null>(null);
  if (!ref.current) ref.current = new LockEngine(cfg);
  const engine = ref.current;
  engine.cfg = cfg;
  engine.cb = cb;
  engine.active = active;
  engine.size = size;
  useEffect(() => {
    engine.start();
    return () => engine.stop();
  }, [engine]);
  return engine;
}
