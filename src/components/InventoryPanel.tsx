import {
  ArrowRightLeft,
  Coins,
  FlaskConical,
  HeartPulse,
  KeyRound,
  Loader2,
  MapPin,
  PackageOpen,
  ScrollText,
  Sword,
  Swords,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type {
  CSSProperties,
  DragEvent as ReactDragEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { INVENTORY_ITEM_DRAG_MIME_TYPE } from '../lib/inventoryItemReferences';
import type { InventoryAction, InventoryItem, ItemTargetingAction, PlayerInventory } from '../types';
import { createWeaponAttackTargetingAction } from './inventoryTargeting';

type InventoryFilter = 'all' | 'weapon' | 'consumable' | 'quest' | 'clue' | 'tool' | 'nearby';

interface InventoryPanelProps {
  inventory: PlayerInventory | null;
  isLoading: boolean;
  isDisabled: boolean;
  visibleTargetIds: string[];
  onBeginTargeting: (action: ItemTargetingAction, item: InventoryItem) => void;
  onExecuteAction: (action: InventoryAction) => void | Promise<void>;
  onReferenceItem: (item: InventoryItem) => void;
}

interface FloatingItemState {
  itemId: string;
  position: CSSProperties;
}

const TOOLTIP_WIDTH = 320;
const TOOLTIP_MAX_HEIGHT = 320;
const ACTION_MENU_WIDTH = 300;
const ACTION_MENU_MAX_HEIGHT = 340;
const FILTERS: Array<{ id: InventoryFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'weapon', label: '武器' },
  { id: 'consumable', label: '消耗品' },
  { id: 'tool', label: '工具' },
  { id: 'quest', label: '任务' },
  { id: 'clue', label: '线索' },
  { id: 'nearby', label: '附近' },
];

export function InventoryPanel({
  inventory,
  isLoading,
  isDisabled,
  visibleTargetIds,
  onBeginTargeting,
  onExecuteAction,
  onReferenceItem,
}: InventoryPanelProps) {
  const tooltipId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [overlayRoot, setOverlayRoot] = useState<HTMLElement | null>(null);
  const [filter, setFilter] = useState<InventoryFilter>('all');
  const [hoveredItem, setHoveredItem] = useState<FloatingItemState | null>(null);
  const [actionMenu, setActionMenu] = useState<FloatingItemState | null>(null);
  const [targetIds, setTargetIds] = useState<Record<string, string>>({});
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const visibleItems = useMemo(() => {
    if (!inventory) return [];
    if (filter === 'nearby') return inventory.nearbyItems;
    if (filter === 'all') return inventory.items;
    return inventory.items.filter((item) => item.category === filter);
  }, [filter, inventory]);
  const allItems = useMemo(
    () => [...(inventory?.items || []), ...(inventory?.nearbyItems || [])],
    [inventory],
  );
  const ownedItemIds = useMemo(
    () => new Set((inventory?.items || []).map((item) => item.id)),
    [inventory],
  );
  const tooltipItem = hoveredItem
    ? allItems.find((item) => item.id === hoveredItem.itemId) || null
    : null;
  const menuItem = actionMenu
    ? allItems.find((item) => item.id === actionMenu.itemId) || null
    : null;

  useEffect(() => {
    setHoveredItem(null);
    setActionMenu(null);
  }, [filter]);

  useEffect(() => {
    setOverlayRoot(panelRef.current?.closest<HTMLElement>('.game-stage') || null);
  }, []);

  useEffect(() => {
    if (actionMenu && !allItems.some((item) => item.id === actionMenu.itemId)) {
      setActionMenu(null);
    }
    if (hoveredItem && !allItems.some((item) => item.id === hoveredItem.itemId)) {
      setHoveredItem(null);
    }
  }, [actionMenu, allItems, hoveredItem]);

  function showPointerTooltip(itemId: string, clientX: number, clientY: number) {
    if (actionMenu?.itemId === itemId || !overlayRoot) return;
    setHoveredItem({
      itemId,
      position: positionNearPointer(
        clientX,
        clientY,
        TOOLTIP_WIDTH,
        TOOLTIP_MAX_HEIGHT,
        overlayRoot,
      ),
    });
  }

  function showFocusTooltip(itemId: string, element: HTMLElement) {
    if (actionMenu?.itemId === itemId) return;
    const stage = overlayRoot || element.closest<HTMLElement>('.game-stage');
    if (!stage) return;
    const rect = element.getBoundingClientRect();
    setHoveredItem({
      itemId,
      position: positionNearPointer(
        rect.right,
        rect.top + rect.height / 2,
        TOOLTIP_WIDTH,
        TOOLTIP_MAX_HEIGHT,
        stage,
      ),
    });
  }

  function openActionMenu(itemId: string, element: HTMLButtonElement) {
    const stage = overlayRoot || element.closest<HTMLElement>('.game-stage');
    if (!stage) return;
    const rect = element.getBoundingClientRect();
    setHoveredItem(null);
    setActionMenu((current) => current?.itemId === itemId
      ? null
      : {
          itemId,
          position: positionNearAnchor(
            rect,
            ACTION_MENU_WIDTH,
            ACTION_MENU_MAX_HEIGHT,
            stage,
          ),
        });
  }

  function beginItemDrag(item: InventoryItem, event: ReactDragEvent<HTMLButtonElement>) {
    if (isDisabled || isLoading) {
      event.preventDefault();
      return;
    }
    setHoveredItem(null);
    setActionMenu(null);
    setDraggedItemId(item.id);
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(INVENTORY_ITEM_DRAG_MIME_TYPE, item.id);
  }

  return (
    <div className="inventory-panel" ref={panelRef}>
      <div className="inventory-panel-toolbar">
        <nav className="inventory-panel-filters" aria-label="背包分类">
          {FILTERS.map((option) => {
            const count = option.id === 'nearby'
              ? inventory?.nearbyItems.length || 0
              : option.id === 'all'
                ? inventory?.items.length || 0
                : inventory?.items.filter((item) => item.category === option.id).length || 0;
            return (
              <button
                className={filter === option.id ? 'active' : ''}
                key={option.id}
                type="button"
                aria-pressed={filter === option.id}
                onClick={() => setFilter(option.id)}
              >
                {option.label}<span>{count}</span>
              </button>
            );
          })}
        </nav>
        {inventory?.gold ? <span className="inventory-panel-gold"><Coins size={14} />{inventory.gold}</span> : null}
      </div>

      <div className="inventory-icon-grid" role="listbox" aria-label="道具列表">
        {isLoading && !inventory ? (
          <span className="inventory-panel-empty"><Loader2 className="spin" size={18} />正在读取背包...</span>
        ) : visibleItems.length ? (
          visibleItems.map((item) => (
            <InventoryIconButton
              item={item}
              isNearby={!ownedItemIds.has(item.id)}
              isSelected={actionMenu?.itemId === item.id}
              isDraggable={ownedItemIds.has(item.id) && !isDisabled && !isLoading}
              isDragging={draggedItemId === item.id}
              tooltipId={hoveredItem?.itemId === item.id ? tooltipId : undefined}
              key={item.id}
              onBlur={() => setHoveredItem((current) => current?.itemId === item.id ? null : current)}
              onClick={(event) => openActionMenu(item.id, event.currentTarget)}
              onFocus={(element) => showFocusTooltip(item.id, element)}
              onKeyboardActivate={(element) => openActionMenu(item.id, element)}
              onMouseLeave={() => setHoveredItem((current) => current?.itemId === item.id ? null : current)}
              onMouseMove={(clientX, clientY) => showPointerTooltip(item.id, clientX, clientY)}
              onDragEnd={() => setDraggedItemId(null)}
              onDragStart={(event) => beginItemDrag(item, event)}
            />
          ))
        ) : (
          <span className="inventory-panel-empty">
            <PackageOpen size={20} />
            {filter === 'nearby' ? '当前场景没有可拾取道具' : '这个分类还是空的'}
          </span>
        )}
      </div>

      {tooltipItem && hoveredItem && overlayRoot ? createPortal(
        <InventoryTooltip
          id={tooltipId}
          item={tooltipItem}
          canReference={ownedItemIds.has(tooltipItem.id)}
          style={hoveredItem.position}
        />,
        overlayRoot,
      ) : null}

      {menuItem && actionMenu && overlayRoot ? createPortal(
        <>
          <button
            className="inventory-action-scrim"
            type="button"
            aria-label="关闭道具操作菜单"
            onClick={() => setActionMenu(null)}
          />
          <InventoryActionMenu
            item={menuItem}
            inventory={inventory}
            canReference={ownedItemIds.has(menuItem.id)}
            isDisabled={isDisabled || isLoading}
            style={actionMenu.position}
            targetIds={targetIds}
            visibleTargetIds={visibleTargetIds}
            onClose={() => setActionMenu(null)}
            onReferenceItem={(item) => {
              setActionMenu(null);
              onReferenceItem(item);
            }}
            onBeginTargeting={(action, item) => {
              setActionMenu(null);
              onBeginTargeting(action, item);
            }}
            onTargetChange={(actionId, targetId) => setTargetIds((current) => ({ ...current, [actionId]: targetId }))}
            onExecuteAction={(action) => {
              setActionMenu(null);
              void onExecuteAction(action);
            }}
          />
        </>,
        overlayRoot,
      ) : null}
    </div>
  );
}

function InventoryIconButton({
  item,
  isNearby,
  isSelected,
  isDraggable,
  isDragging,
  tooltipId,
  onBlur,
  onClick,
  onFocus,
  onKeyboardActivate,
  onMouseLeave,
  onMouseMove,
  onDragEnd,
  onDragStart,
}: {
  item: InventoryItem;
  isNearby: boolean;
  isSelected: boolean;
  isDraggable: boolean;
  isDragging: boolean;
  tooltipId?: string;
  onBlur: () => void;
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onFocus: (element: HTMLButtonElement) => void;
  onKeyboardActivate: (element: HTMLButtonElement) => void;
  onMouseLeave: () => void;
  onMouseMove: (clientX: number, clientY: number) => void;
  onDragEnd: () => void;
  onDragStart: (event: ReactDragEvent<HTMLButtonElement>) => void;
}) {
  const Icon = categoryIcon(item.category);
  return (
    <button
      className={[
        'inventory-icon-button',
        `category-${item.category}`,
        isSelected ? 'selected' : '',
        isDraggable ? 'is-draggable' : '',
        isDragging ? 'is-dragging' : '',
      ].filter(Boolean).join(' ')}
      type="button"
      role="option"
      draggable={isDraggable}
      aria-describedby={tooltipId}
      aria-label={`${item.name}，${isNearby ? '当前场景可拾取' : categoryLabel(item.category)}${item.quantity > 1 ? `，共 ${item.quantity} 件` : ''}${isDraggable ? '，可拖到行动输入框引用，也可打开操作菜单引用' : ''}`}
      aria-roledescription={isDraggable ? '可拖动道具' : undefined}
      aria-selected={isSelected}
      onBlur={onBlur}
      onClick={onClick}
      onFocus={(event) => onFocus(event.currentTarget)}
      onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onKeyboardActivate(event.currentTarget);
      }}
      onMouseLeave={onMouseLeave}
      onMouseMove={(event) => onMouseMove(event.clientX, event.clientY)}
      onDragEnd={onDragEnd}
      onDragStart={onDragStart}
    >
      <span className="inventory-icon-glyph"><Icon size={27} /></span>
      <span className="inventory-icon-name">{item.name}</span>
      {item.quantity > 1 ? <span className="inventory-icon-quantity">×{item.quantity}</span> : null}
      {isNearby ? <span className="inventory-icon-nearby"><MapPin size={10} /></span> : null}
    </button>
  );
}

function InventoryTooltip({
  id,
  item,
  canReference,
  style,
}: {
  id: string;
  item: InventoryItem;
  canReference: boolean;
  style: CSSProperties;
}) {
  const Icon = categoryIcon(item.category);
  const disabledReasons = Array.from(new Set(item.actions.map((action) => action.disabledReason).filter(Boolean)));
  return (
    <aside className="inventory-hover-tooltip" id={id} role="tooltip" style={style}>
      <header>
        <span className={`inventory-tooltip-icon category-${item.category}`}><Icon size={25} /></span>
        <span>
          <strong>{item.name}</strong>
          <small>{categoryLabel(item.category)} · {item.quantity} 件</small>
        </span>
      </header>
      <p>{item.identity.description || '这件道具还没有详细描述。'}</p>
      {item.rules.use?.type === 'restore_hit_points' ? (
        <div className="inventory-tooltip-effect">
          <HeartPulse size={15} />
          恢复 {String(item.rules.use.amount || 1)} 点生命值，消耗 {String(item.rules.use.consumeQuantity || 1)} 件
        </div>
      ) : null}
      {disabledReasons.map((reason) => <small className="inventory-tooltip-warning" key={reason}>{reason}</small>)}
      <footer>
        {canReference
          ? '拖到下方输入框可引用 · 点击也可选择引用'
          : '需要先拾取此道具 · 点击查看可用操作'}
      </footer>
    </aside>
  );
}

function InventoryActionMenu({
  item,
  inventory,
  canReference,
  isDisabled,
  style,
  targetIds,
  visibleTargetIds,
  onClose,
  onReferenceItem,
  onBeginTargeting,
  onTargetChange,
  onExecuteAction,
}: {
  item: InventoryItem;
  inventory: PlayerInventory | null;
  canReference: boolean;
  isDisabled: boolean;
  style: CSSProperties;
  targetIds: Record<string, string>;
  visibleTargetIds: string[];
  onClose: () => void;
  onReferenceItem: (item: InventoryItem) => void;
  onBeginTargeting: (action: ItemTargetingAction, item: InventoryItem) => void;
  onTargetChange: (actionId: string, targetId: string) => void;
  onExecuteAction: (action: InventoryAction) => void;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const visibleTargetIdSet = useMemo(() => new Set(visibleTargetIds), [visibleTargetIds]);
  const weaponAttackAction = createWeaponAttackTargetingAction(inventory, item);
  const menuActions: ItemTargetingAction[] = weaponAttackAction
    ? [weaponAttackAction, ...item.actions]
    : item.actions;

  useEffect(() => {
    menuRef.current?.focus();
  }, []);

  return (
    <div
      className="inventory-action-popover"
      role="dialog"
      aria-label={`${item.name}操作`}
      ref={menuRef}
      style={style}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header>
        <span>
          <strong>{item.name}</strong>
          <small>{categoryLabel(item.category)} · {item.quantity} 件</small>
        </span>
        <button type="button" onClick={onClose}>关闭</button>
      </header>
      <p className="inventory-popover-description">
        {item.identity.description || '这件道具还没有详细描述。'}
      </p>
      <div className="inventory-popover-actions">
        {canReference ? (
          <div className="inventory-popover-action inventory-popover-reference-action">
            <button
              className="reference"
              type="button"
              disabled={isDisabled}
              onClick={() => onReferenceItem(item)}
            >
              <PackageOpen size={15} />
              引用到行动输入框
            </button>
            <small>只添加引用，不会立即使用、转交或消耗道具。</small>
          </div>
        ) : null}
        {menuActions.map((action) => {
          const validTargets = inventory?.targets.filter((target) => action.validTargetIds.includes(target.id)) || [];
          const visibleTargets = validTargets.filter((target) => visibleTargetIdSet.has(target.id));
          const cachedTargetId = targetIds[action.id];
          const selectedTargetId = cachedTargetId && validTargets.some((target) => target.id === cachedTargetId)
            ? cachedTargetId
            : action.requiresTarget
              ? validTargets[0]?.id || ''
              : '';
          const needsSelector = !action.requiresTarget && action.targetMode !== 'none' && validTargets.length > 0;
          const targetingUnavailableReason = action.requiresTarget && !visibleTargets.length
            ? action.kind === 'attack.weapon'
              ? '当前场景没有可攻击的目标。'
              : action.kind === 'item.transfer'
                ? '当前场景没有可以接收道具的 NPC。'
                : '当前场景没有可用目标。'
            : null;
          const disabledReason = targetingUnavailableReason || action.disabledReason;
          return (
            <div className="inventory-popover-action" key={action.id}>
              {needsSelector ? (
                <label>
                  <span>{action.requiresTarget ? '使用目标' : '展示给（可选）'}</span>
                  <select
                    value={selectedTargetId}
                    disabled={isDisabled || Boolean(disabledReason)}
                    onChange={(event) => onTargetChange(action.id, event.target.value)}
                  >
                    {!action.requiresTarget ? <option value="">不指定目标</option> : null}
                    {validTargets.map((target) => (
                      <option value={target.id} key={target.id}>
                        {target.name}{target.health ? ` · ${target.health.currentHitPoints}/${target.health.maxHitPoints} HP` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button
                className={action.danger ? 'danger' : 'primary'}
                type="button"
                disabled={isDisabled || Boolean(disabledReason)}
                title={disabledReason || undefined}
                onClick={() => {
                  if (action.kind === 'attack.weapon' || action.requiresTarget) {
                    onBeginTargeting(action, item);
                    return;
                  }
                  onExecuteAction({ ...action, ...(selectedTargetId ? { targetId: selectedTargetId } : {}) });
                }}
              >
                {isDisabled ? <Loader2 className="spin" size={15} /> : actionIcon(action.kind)}
                {action.label}
              </button>
              {disabledReason ? <small className="inventory-popover-reason">{disabledReason}</small> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function positionNearPointer(
  clientX: number,
  clientY: number,
  width: number,
  height: number,
  stage: HTMLElement,
): CSSProperties {
  const gap = 14;
  const edge = 8;
  const bounds = getStageBounds(stage);
  const pointerX = (clientX - bounds.rect.left) / bounds.scaleX;
  const pointerY = (clientY - bounds.rect.top) / bounds.scaleY;
  const left = pointerX + gap + width <= bounds.width - edge
    ? pointerX + gap
    : Math.max(edge, pointerX - width - gap);
  const opensAbove = pointerY + gap + height > bounds.height - edge;
  return {
    left,
    top: opensAbove ? pointerY - gap : pointerY + gap,
    ...(opensAbove ? { transform: 'translateY(-100%)' } : {}),
  };
}

function positionNearAnchor(
  rect: DOMRect,
  width: number,
  height: number,
  stage: HTMLElement,
): CSSProperties {
  const gap = 8;
  const edge = 8;
  const bounds = getStageBounds(stage);
  const anchorLeft = (rect.left - bounds.rect.left) / bounds.scaleX;
  const anchorTop = (rect.top - bounds.rect.top) / bounds.scaleY;
  const anchorBottom = (rect.bottom - bounds.rect.top) / bounds.scaleY;
  const left = Math.min(
    Math.max(edge, anchorLeft),
    Math.max(edge, bounds.width - width - edge),
  );
  const opensAbove = anchorBottom + gap + height > bounds.height - edge;
  return {
    left,
    top: opensAbove ? anchorTop - gap : anchorBottom + gap,
    ...(opensAbove ? { transform: 'translateY(-100%)' } : {}),
  };
}

function getStageBounds(stage: HTMLElement) {
  const rect = stage.getBoundingClientRect();
  return {
    rect,
    width: stage.clientWidth,
    height: stage.clientHeight,
    scaleX: rect.width / stage.offsetWidth || 1,
    scaleY: rect.height / stage.offsetHeight || 1,
  };
}

function categoryIcon(category: string): LucideIcon {
  if (category === 'weapon') return Sword;
  if (category === 'consumable') return FlaskConical;
  if (category === 'quest') return KeyRound;
  if (category === 'clue') return ScrollText;
  return Wrench;
}

function categoryLabel(category: string) {
  if (category === 'weapon') return '武器';
  if (category === 'consumable') return '消耗品';
  if (category === 'quest') return '任务物品';
  if (category === 'clue') return '线索';
  return '工具';
}

function actionIcon(kind: ItemTargetingAction['kind']) {
  if (kind === 'attack.weapon') return <Swords size={15} />;
  if (kind === 'item.transfer') return <ArrowRightLeft size={15} />;
  if (kind === 'item.pickup' || kind === 'item.drop') return <MapPin size={15} />;
  if (kind === 'item.use') return <HeartPulse size={15} />;
  return <ScrollText size={15} />;
}
