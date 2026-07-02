import { useEffect, useRef, useState } from 'react';
import { GameStageCanvas } from './components/GameStageCanvas';
import {
  isStageSourceHeartbeatFresh,
  readStageSnapshot,
  subscribeStageSnapshot,
  type StageSnapshot,
} from './lib/stageSync';
import type { PresentationStage, WorldMapState } from './types';

const EMPTY_STAGE_SNAPSHOT: StageSnapshot = {
  stage: null,
  worldMap: null,
  activeStageSpeech: null,
  activeStageNarration: null,
  isLoading: true,
  isWorldMapLoading: true,
  updatedAt: 0,
};

export function StageOnlyApp() {
  const [snapshot, setSnapshot] = useState<StageSnapshot>(() => readStageSnapshot() || EMPTY_STAGE_SNAPSHOT);
  const hasLiveSnapshotRef = useRef(false);

  useEffect(() => subscribeStageSnapshot((nextSnapshot) => {
    hasLiveSnapshotRef.current = true;
    setSnapshot(nextSnapshot);
  }), []);

  useEffect(() => {
    let isCancelled = false;

    async function loadFallbackStage() {
      try {
        const [stageResponse, worldMapResponse] = await Promise.all([
          fetch('/api/presentation/current-stage'),
          fetch('/api/world/map'),
        ]);
        const [stage, worldMap] = await Promise.all([
          stageResponse.ok ? stageResponse.json() as Promise<PresentationStage> : Promise.resolve(null),
          worldMapResponse.ok ? worldMapResponse.json() as Promise<WorldMapState> : Promise.resolve(null),
        ]);

        if (isCancelled) return;
        setSnapshot((current) => {
          const keepTransientState = hasLiveSnapshotRef.current || isStageSourceHeartbeatFresh();
          return {
            ...current,
            stage,
            worldMap,
            activeStageSpeech: keepTransientState ? current.activeStageSpeech : null,
            activeStageNarration: keepTransientState ? current.activeStageNarration : null,
            isLoading: false,
            isWorldMapLoading: false,
            updatedAt: Date.now(),
          };
        });
      } catch {
        if (!isCancelled) {
          setSnapshot((current) => ({
            ...current,
            isLoading: false,
            isWorldMapLoading: false,
          }));
        }
      }
    }

    void loadFallbackStage();
    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <main className="stage-only-root" aria-label="纯游戏舞台">
      <GameStageCanvas
        stage={snapshot.stage}
        worldMap={snapshot.worldMap}
        activeStageSpeech={snapshot.activeStageSpeech}
        activeStageNarration={snapshot.activeStageNarration}
        isLoading={snapshot.isLoading}
        isWorldMapLoading={snapshot.isWorldMapLoading}
        isNavigationDisabled
        isMapInteractive={false}
        onEnterScene={() => {}}
      />
    </main>
  );
}
