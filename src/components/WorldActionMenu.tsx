import { ChevronRight, LoaderCircle, Swords, Target } from 'lucide-react';
import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import type { WorldAction, WorldActionMenuTarget } from '../types';

const WORLD_ACTION_MENU_WIDTH = 264;
const WORLD_ACTION_MENU_VIEWPORT_GAP = 12;

export interface WorldActionMenuState extends WorldActionMenuTarget {
  actions: WorldAction[];
  isLoading: boolean;
  error?: string;
}

interface WorldActionMenuProps {
  menu: WorldActionMenuState | null;
  onClose: () => void;
  onExecuteWorldAction: (action: WorldAction) => void | Promise<void>;
}

export function WorldActionMenu({ menu, onClose, onExecuteWorldAction }: WorldActionMenuProps) {
  const isOpen = menu !== null;

  useEffect(() => {
    if (!isOpen) return undefined;
    const close = () => onClose();
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
    };
  }, [isOpen, onClose]);

  if (!menu) return null;

  return (
    <div
      className="world-action-menu"
      role="menu"
      aria-label={`${menu.entityName}的可用动作`}
      style={getMenuPosition(menu)}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <div className="world-action-menu-header">
        <span className="world-action-menu-target" aria-hidden="true">
          <Target size={16} />
        </span>
        <span className="world-action-menu-title">
          <strong>{menu.entityName}</strong>
          <small>可用动作</small>
        </span>
      </div>

      <div className="world-action-menu-content" aria-live="polite">
        {menu.isLoading ? (
          <span className="world-action-status">
            <LoaderCircle className="spin" size={15} />
            读取动作...
          </span>
        ) : null}
        {menu.error ? <span className="world-action-status world-action-error">{menu.error}</span> : null}
        {!menu.isLoading && !menu.error && !menu.actions.length ? (
          <span className="world-action-status">暂无可用动作</span>
        ) : null}
        {menu.actions.map((action) => (
          <button
            key={action.id}
            type="button"
            role="menuitem"
            onClick={() => {
              onClose();
              void onExecuteWorldAction(action);
            }}
          >
            <span className="world-action-icon" aria-hidden="true">
              <Swords size={16} />
            </span>
            <span className="world-action-label">{action.label}</span>
            <ChevronRight className="world-action-chevron" size={15} aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}

function getMenuPosition(menu: WorldActionMenuTarget): CSSProperties {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const renderedWidth = Math.min(WORLD_ACTION_MENU_WIDTH, viewportWidth - WORLD_ACTION_MENU_VIEWPORT_GAP * 2);
  const opensLeft = menu.clientX + renderedWidth + WORLD_ACTION_MENU_VIEWPORT_GAP > viewportWidth;
  const opensUp = menu.clientY > viewportHeight / 2;

  return {
    left: opensLeft ? undefined : Math.max(WORLD_ACTION_MENU_VIEWPORT_GAP, menu.clientX),
    right: opensLeft ? Math.max(WORLD_ACTION_MENU_VIEWPORT_GAP, viewportWidth - menu.clientX) : undefined,
    top: opensUp ? undefined : Math.max(WORLD_ACTION_MENU_VIEWPORT_GAP, menu.clientY),
    bottom: opensUp ? Math.max(WORLD_ACTION_MENU_VIEWPORT_GAP, viewportHeight - menu.clientY) : undefined,
  };
}
