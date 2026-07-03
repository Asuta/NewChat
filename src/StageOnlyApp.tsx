import { useEffect, useRef, useState } from 'react';
import { GameStageCanvas } from './components/GameStageCanvas';
import {
  STAGE_COMMAND_ACK_TIMEOUT_MS,
  isStageSourceHeartbeatFresh,
  publishStageCommand,
  readStageSnapshot,
  subscribeStageCommandAck,
  subscribeStageSnapshot,
  type StageCommandAck,
  type StageLogEntry,
  type StageSnapshot,
} from './lib/stageSync';
import type {
  AgentStep,
  HealthState,
  ModelRequestLog,
  PresentationStage,
  StageSpeech,
  ThinkingMode,
  WorldAgentStreamEvent,
  WorldMapState,
  WorldOverview,
} from './types';

const EMPTY_STAGE_SNAPSHOT: StageSnapshot = {
  stage: null,
  world: null,
  worldMap: null,
  activeStageSpeech: null,
  activeStageNarration: null,
  recentLogEntries: [],
  isActionPending: false,
  isLoading: true,
  isWorldMapLoading: true,
  updatedAt: 0,
};

const MAIN_PENDING_MIRROR_TIMEOUT_MS = 2_000;

export function StageOnlyApp() {
  const [snapshot, setSnapshot] = useState<StageSnapshot>(() => readStageSnapshot() || EMPTY_STAGE_SNAPSHOT);
  const [isMainAppConnected, setIsMainAppConnected] = useState(() => isStageSourceHeartbeatFresh());
  const [isStandalonePending, setIsStandalonePending] = useState(false);
  const [isStageSubmitPending, setIsStageSubmitPending] = useState(false);
  const hasLiveSnapshotRef = useRef(false);
  const snapshotRef = useRef(snapshot);
  const pendingAckResolversRef = useRef(new Map<string, (ack: StageCommandAck) => void>());
  const stageSubmitLockRef = useRef(false);
  const isAwaitingMainPendingMirrorRef = useRef(false);
  const mainPendingMirrorTimerRef = useRef<number | null>(null);

  snapshotRef.current = snapshot;

  useEffect(() => subscribeStageSnapshot((nextSnapshot) => {
    hasLiveSnapshotRef.current = true;
    setSnapshot(nextSnapshot);
  }), []);

  useEffect(() => subscribeStageCommandAck((ack) => {
    const resolve = pendingAckResolversRef.current.get(ack.commandId);
    if (!resolve) return;
    pendingAckResolversRef.current.delete(ack.commandId);
    resolve(ack);
  }), []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIsMainAppConnected(isStageSourceHeartbeatFresh());
    }, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isAwaitingMainPendingMirrorRef.current || !snapshot.isActionPending) return;
    isAwaitingMainPendingMirrorRef.current = false;
    clearMainPendingMirrorTimer();
    releaseStageSubmitLock();
  }, [snapshot.isActionPending]);

  useEffect(() => () => {
    clearMainPendingMirrorTimer();
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadFallbackStage() {
      try {
        const [stageResponse, worldMapResponse, worldResponse] = await Promise.all([
          fetch('/api/presentation/current-stage'),
          fetch('/api/world/map'),
          fetch('/api/world'),
        ]);
        const [stage, worldMap, world] = await Promise.all([
          stageResponse.ok ? stageResponse.json() as Promise<PresentationStage> : Promise.resolve(null),
          worldMapResponse.ok ? worldMapResponse.json() as Promise<WorldMapState> : Promise.resolve(null),
          worldResponse.ok ? worldResponse.json() as Promise<WorldOverview> : Promise.resolve(null),
        ]);

        if (isCancelled) return;
        setSnapshot((current) => {
          const keepTransientState = hasLiveSnapshotRef.current || isStageSourceHeartbeatFresh();
          return {
            ...current,
            stage,
            world,
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

  function submitStageAction(content: string) {
    const trimmed = content.trim();
    if (!trimmed || !beginStageSubmitLock()) return;

    if (isMainAppConnected) {
      const command = publishStageCommand(trimmed);
      void waitForStageCommandAck(command.id).then((ack) => {
        if (ack?.status === 'rejected') {
          appendStandaloneLog({
            id: `${Date.now()}-busy`,
            role: 'system',
            text: '主页面正在处理上一轮行动，请稍后再试。',
          });
          releaseStageSubmitLock();
          return;
        }
        if (ack) {
          releaseStageSubmitLockWhenMainMirrorsPending();
          return;
        }
        if (snapshotRef.current.isActionPending) {
          appendStandaloneLog({
            id: `${Date.now()}-timeout`,
            role: 'system',
            text: '主页面正在处理上一轮行动，请稍后再试。',
          });
          releaseStageSubmitLock();
          return;
        }
        void runStandaloneStageAction(trimmed, { lockAlreadyHeld: true });
      });
      return;
    }
    void runStandaloneStageAction(trimmed, { lockAlreadyHeld: true });
  }

  async function runStandaloneStageAction(content: string, options: { lockAlreadyHeld?: boolean } = {}) {
    const trimmed = content.trim();
    if (!trimmed || isStandalonePending) {
      if (options.lockAlreadyHeld) releaseStageSubmitLock();
      return;
    }
    if (!options.lockAlreadyHeld && !beginStageSubmitLock()) return;

    setIsStandalonePending(true);
    appendStandaloneLog({ id: `${Date.now()}-player`, role: 'player', text: trimmed });
    setSnapshot((current) => ({
      ...current,
      activeStageNarration: {
        content: '',
        createdAt: Date.now(),
      },
      activeStageSpeech: null,
      isActionPending: true,
    }));

    let activeNarration = '';
    let activeSpeech: StageSpeech | null = null;
    try {
      const health = await fetchJson<HealthState>('/api/health').catch(() => null);
      const response = await fetch('/api/world/agent/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: health?.model || 'deepseek-v4-flash',
          thinking: normalizeThinkingMode(health?.thinking),
          prompt: trimmed,
          taskRole: 'user',
          contextEvents: [],
          maxSteps: 30,
        }),
      });

      if (!response.ok) throw new Error(await readErrorMessage(response));
      if (!response.body) throw new Error('世界 Agent 没有返回流式响应。');

      await readStandaloneWorldAgentStream(response.body, (event) => {
        if (event.type === 'assistant_text_start') {
          activeNarration = '';
          setSnapshot((current) => ({
            ...current,
            activeStageNarration: { content: '', createdAt: Date.now(), runId: event.runId },
          }));
          return;
        }
        if (event.type === 'assistant_text_delta') {
          activeNarration += event.delta;
          setSnapshot((current) => ({
            ...current,
            activeStageNarration: { content: activeNarration, createdAt: Date.now() },
          }));
          return;
        }
        if (event.type === 'npc_speech_start') {
          activeSpeech = {
            entityId: event.npcEntityId,
            name: event.npcName,
            content: '',
            createdAt: Date.now(),
          };
          setSnapshot((current) => ({ ...current, activeStageSpeech: activeSpeech }));
          return;
        }
        if (event.type === 'npc_speech_delta') {
          activeSpeech = {
            entityId: event.npcEntityId,
            name: event.npcName,
            content: `${activeSpeech?.content || ''}${event.delta}`,
            createdAt: activeSpeech?.createdAt || Date.now(),
          };
          setSnapshot((current) => ({ ...current, activeStageSpeech: activeSpeech }));
          return;
        }
        if (event.type === 'npc_speech') {
          activeSpeech = {
            entityId: event.npcEntityId,
            name: event.npcName,
            content: event.content,
            createdAt: Date.now(),
          };
          setSnapshot((current) => ({ ...current, activeStageSpeech: activeSpeech }));
          return;
        }
        if (event.type === 'done') {
          appendStandaloneLog({
            id: `${Date.now()}-dm`,
            role: 'dm',
            text: event.answer || activeNarration || activeSpeech?.content || '行动已处理。',
          });
          setSnapshot((current) => ({
            ...current,
            world: event.world,
          }));
        }
        if (event.type === 'error') {
          throw new Error(event.error || '世界 Agent 执行失败。');
        }
      });

      await refreshStandaloneStage();
    } catch (error) {
      appendStandaloneLog({
        id: `${Date.now()}-error`,
        role: 'system',
        text: error instanceof Error ? error.message : '行动执行失败。',
      });
    } finally {
      setIsStandalonePending(false);
      releaseStageSubmitLock();
      setSnapshot((current) => ({
        ...current,
        isActionPending: false,
      }));
    }
  }

  return (
    <main className="stage-only-root" aria-label="可玩游戏舞台">
      <GameStageCanvas
        variant="playable"
        stage={snapshot.stage}
        world={snapshot.world}
        worldMap={snapshot.worldMap}
        activeStageSpeech={snapshot.activeStageSpeech}
        activeStageNarration={snapshot.activeStageNarration}
        recentLogEntries={snapshot.recentLogEntries}
        isActionPending={snapshot.isActionPending || isStandalonePending || isStageSubmitPending}
        isMainAppConnected={isMainAppConnected}
        canSubmitActions
        actionStatusLabel={isMainAppConnected ? '已连接' : '独立模式'}
        isLoading={snapshot.isLoading}
        isWorldMapLoading={snapshot.isWorldMapLoading}
        isNavigationDisabled
        isMapInteractive={false}
        onSubmitAction={submitStageAction}
        onEnterScene={() => {}}
      />
    </main>
  );

  function appendStandaloneLog(entry: StageLogEntry) {
    setSnapshot((current) => ({
      ...current,
      recentLogEntries: [...(current.recentLogEntries || []), {
        ...entry,
        text: entry.text.trim().replace(/\s+/g, ' ').slice(0, 96),
      }].slice(-8),
    }));
  }

  function beginStageSubmitLock() {
    if (stageSubmitLockRef.current || snapshotRef.current.isActionPending || isStandalonePending) return false;
    stageSubmitLockRef.current = true;
    setIsStageSubmitPending(true);
    return true;
  }

  function releaseStageSubmitLock() {
    stageSubmitLockRef.current = false;
    setIsStageSubmitPending(false);
  }

  function releaseStageSubmitLockWhenMainMirrorsPending() {
    if (snapshotRef.current.isActionPending) {
      releaseStageSubmitLock();
      return;
    }
    isAwaitingMainPendingMirrorRef.current = true;
    clearMainPendingMirrorTimer();
    mainPendingMirrorTimerRef.current = window.setTimeout(() => {
      isAwaitingMainPendingMirrorRef.current = false;
      releaseStageSubmitLock();
    }, MAIN_PENDING_MIRROR_TIMEOUT_MS);
  }

  function clearMainPendingMirrorTimer() {
    if (mainPendingMirrorTimerRef.current === null) return;
    window.clearTimeout(mainPendingMirrorTimerRef.current);
    mainPendingMirrorTimerRef.current = null;
  }

  function waitForStageCommandAck(commandId: string) {
    return new Promise<StageCommandAck | null>((resolve) => {
      const timeout = window.setTimeout(() => {
        pendingAckResolversRef.current.delete(commandId);
        resolve(null);
      }, STAGE_COMMAND_ACK_TIMEOUT_MS);

      pendingAckResolversRef.current.set(commandId, (ack) => {
        window.clearTimeout(timeout);
        resolve(ack);
      });
    });
  }

  async function refreshStandaloneStage() {
    const [stageResponse, worldMapResponse, worldResponse] = await Promise.all([
      fetch('/api/presentation/current-stage'),
      fetch('/api/world/map'),
      fetch('/api/world'),
    ]);
    const [stage, worldMap, world] = await Promise.all([
      stageResponse.ok ? stageResponse.json() as Promise<PresentationStage> : Promise.resolve(null),
      worldMapResponse.ok ? worldMapResponse.json() as Promise<WorldMapState> : Promise.resolve(null),
      worldResponse.ok ? worldResponse.json() as Promise<WorldOverview> : Promise.resolve(null),
    ]);
    setSnapshot((current) => ({
      ...current,
      stage,
      world,
      worldMap,
      isLoading: false,
      isWorldMapLoading: false,
      updatedAt: Date.now(),
    }));
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return response.json() as Promise<T>;
}

function normalizeThinkingMode(value: ThinkingMode | null | undefined) {
  return value === 'disabled' ? 'disabled' : 'enabled';
}

async function readErrorMessage(response: Response) {
  try {
    const data = await response.json() as { error?: string };
    return data.error || response.statusText;
  } catch {
    return response.statusText;
  }
}

async function readStandaloneWorldAgentStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: WorldAgentStreamEvent) => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split(/\n\n/);
    buffer = blocks.pop() || '';

    for (const block of blocks) {
      const event = parseStandaloneWorldAgentStreamEvent(block);
      if (event) onEvent(event);
    }
  }

  const finalBlock = buffer.trim();
  if (finalBlock) {
    const event = parseStandaloneWorldAgentStreamEvent(finalBlock);
    if (event) onEvent(event);
  }
}

function parseStandaloneWorldAgentStreamEvent(block: string): WorldAgentStreamEvent | null {
  const lines = block.split(/\r?\n/);
  const eventType = lines.find((line) => line.startsWith('event:'))?.slice(6).trim();
  const data = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .join('\n');

  if (!eventType || !data) return null;
  const payload = JSON.parse(data) as Record<string, unknown>;

  if (eventType === 'start') {
    return { type: 'start', runId: Number(payload.runId) };
  }
  if (eventType === 'step') {
    return { type: 'step', step: payload.step as AgentStep };
  }
  if (eventType === 'assistant_text_start') {
    return {
      type: 'assistant_text_start',
      runId: typeof payload.runId === 'number' ? payload.runId : undefined,
      stepIndex: typeof payload.stepIndex === 'number' ? payload.stepIndex : undefined,
    };
  }
  if (eventType === 'assistant_text_delta') {
    return { type: 'assistant_text_delta', delta: String(payload.delta || '') };
  }
  if (eventType === 'npc_speech_start') {
    return {
      type: 'npc_speech_start',
      npcEntityId: String(payload.npcEntityId || ''),
      npcName: String(payload.npcName || ''),
      runId: typeof payload.runId === 'number' ? payload.runId : undefined,
      stepIndex: typeof payload.stepIndex === 'number' ? payload.stepIndex : undefined,
    };
  }
  if (eventType === 'npc_speech_delta') {
    return {
      type: 'npc_speech_delta',
      npcEntityId: String(payload.npcEntityId || ''),
      npcName: String(payload.npcName || ''),
      delta: String(payload.delta || ''),
      runId: typeof payload.runId === 'number' ? payload.runId : undefined,
      stepIndex: typeof payload.stepIndex === 'number' ? payload.stepIndex : undefined,
    };
  }
  if (eventType === 'npc_speech') {
    return {
      type: 'npc_speech',
      npcEntityId: String(payload.npcEntityId || ''),
      npcName: String(payload.npcName || ''),
      content: String(payload.content || ''),
      runId: typeof payload.runId === 'number' ? payload.runId : undefined,
      stepIndex: typeof payload.stepIndex === 'number' ? payload.stepIndex : undefined,
    };
  }
  if (eventType === 'done') {
    return {
      type: 'done',
      answer: String(payload.answer || ''),
      runId: Number(payload.runId),
      steps: Array.isArray(payload.steps) ? payload.steps as AgentStep[] : [],
      modelTranscript: Array.isArray(payload.modelTranscript) ? payload.modelTranscript : [],
      world: payload.world as WorldOverview,
      requestLog: payload.requestLog as ModelRequestLog | undefined,
    };
  }
  if (eventType === 'error') {
    return { type: 'error', error: String(payload.error || '世界 Agent 执行失败。') };
  }

  return null;
}
