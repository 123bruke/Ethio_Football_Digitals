/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { GameControls } from './GameControls';
import { MainMenu } from './MainMenu';
import { MatchResult } from './MatchResult';
import { PauseMenu } from './PauseMenu';
import { Scoreboard } from './Scoreboard';
import { useGameLifecycle } from '../hooks/useGameLifecycle';

const API = import.meta.env.VITE_API_URL === '/same-origin' ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:8000');

export function GameExperience({ token }: { token: string }) {
  const threeContainerRef = useRef<HTMLDivElement | null>(null);
  const canvas2DRef = useRef<HTMLCanvasElement | null>(null);
  const savedMatchRef = useRef<string>('');
  const [saveNotice, setSaveNotice] = useState('');

  const {
    hud,
    settings,
    startMatch,
    togglePause,
    returnToMenu,
    cycleCamera,
    updateSettings,
    inputActions,
  } = useGameLifecycle(threeContainerRef, canvas2DRef);

  useEffect(() => {
    if (hud.phase !== 'FULL_TIME') {
      savedMatchRef.current = '';
      setSaveNotice('');
      return;
    }
    const signature = `${hud.homeScore}-${hud.awayScore}-${hud.totalDuration}-${hud.stats.homeShots}-${hud.stats.awayShots}-${hud.stats.homePasses}-${hud.stats.awayPasses}`;
    if (savedMatchRef.current === signature) return;
    savedMatchRef.current = signature;
    let cancelled = false;
    fetch(`${API}/api/v1/matches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        home_score: hud.homeScore,
        away_score: hud.awayScore,
        duration_seconds: Math.round(hud.totalDuration),
        result: {
          home_team: hud.homeTeam.name, away_team: hud.awayTeam.name,
          home_shots: hud.stats.homeShots, away_shots: hud.stats.awayShots,
          home_passes: hud.stats.homePasses, away_passes: hud.stats.awayPasses,
          home_possession_ticks: hud.stats.homePossessionTicks, away_possession_ticks: hud.stats.awayPossessionTicks,
        },
      }),
    }).then(async response => {
      if (!response.ok) throw new Error('Match could not be saved to your history.');
      if (!cancelled) setSaveNotice('Match result saved to your account.');
    }).catch(() => {
      if (!cancelled) setSaveNotice('Match finished, but the result could not be saved. Check your connection and sign-in.');
      savedMatchRef.current = '';
    });
    return () => { cancelled = true; };
  }, [hud, token]);

  const isInMatch =
    hud.phase === 'KICKOFF' ||
    hud.phase === 'PLAYING' ||
    hud.phase === 'GOAL_CELEBRATION' ||
    hud.phase === 'OUT_OF_BOUNDS' ||
    hud.phase === 'PAUSED';

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950 select-none">
      {saveNotice && <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 rounded-full bg-slate-900/90 border border-slate-700 px-4 py-2 text-xs text-white shadow-lg">{saveNotice}</div>}
      {/* 1. Background 3D Stadium Viewport (Three.js) */}
      <div
        ref={threeContainerRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* 2. Synchronized Foreground 2D Football Gameplay Canvas (2D Players, Ball, Shadows) */}
      <canvas
        ref={canvas2DRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* 3. Main Menu Overlay */}
      {hud.phase === 'MENU' && (
        <MainMenu
          homeTeam={hud.homeTeam}
          awayTeam={hud.awayTeam}
          settings={settings}
          onStartMatch={startMatch}
          onUpdateSettings={updateSettings}
        />
      )}

      {/* 4. Active Match HUD & Controller */}
      {isInMatch && (
        <>
          <Scoreboard
            hud={hud}
            onPause={togglePause}
            onToggleCamera={cycleCamera}
            cameraMode={settings.cameraMode}
          />
          <GameControls
            onJoystick={inputActions.setJoystick}
            onSprint={inputActions.setSprint}
            onShootStart={inputActions.shootStart}
            onShootEnd={inputActions.shootEnd}
            onPassStart={inputActions.passStart}
            onPassEnd={inputActions.passEnd}
            onSwitchOrTackle={inputActions.switchOrTackle}
          />
        </>
      )}

      {/* 5. Pause Overlay */}
      {hud.phase === 'PAUSED' && (
        <PauseMenu
          settings={settings}
          onResume={togglePause}
          onRestart={startMatch}
          onMainMenu={returnToMenu}
          onUpdateSettings={updateSettings}
        />
      )}

      {/* 6. Full-Time Match Result Screen */}
      {hud.phase === 'FULL_TIME' && (
        <MatchResult
          hud={hud}
          onRematch={startMatch}
          onMainMenu={returnToMenu}
        />
      )}
    </div>
  );
}
