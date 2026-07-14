import {
  Backpack,
  Check,
  Coins,
  FlaskConical,
  HeartPulse,
  KeyRound,
  Loader2,
  MapPin,
  PackageOpen,
  ScrollText,
  Sword,
  Wrench,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { InventoryAction, InventoryItem, PlayerInventory } from '../types';

type InventoryFilter = 'all' | 'weapon' | 'consumable' | 'quest' | 'clue' | 'tool' | 'nearby';

interface InventoryDrawerProps {
  inventory: PlayerInventory | null;
  isOpen: boolean;
  isLoading: boolean;
  isDisabled: boolean;
  onOpenChange: (open: boolean) => void;
  onExecuteAction: (action: InventoryAction) => void | Promise<void>;
}

const FILTERS: Array<{ id: InventoryFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'weapon', label: '装备' },
  { id: 'consumable', label: '消耗品' },
  { id: 'quest', label: '任务' },
  { id: 'clue', label: '线索' },
  { id: 'nearby', label: '附近' },
];

export function InventoryDrawer({
  inventory,
  isOpen,
  isLoading,
  isDisabled,
  onOpenChange,
  onExecuteAction,
}: InventoryDrawerProps) {
  const [filter, setFilter] = useState<InventoryFilter>('all');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [targetIds, setTargetIds] = useState<Record<string, string>>({});
  const visibleItems = useMemo(() => {
    if (!inventory) return [];
    if (filter === 'nearby') return inventory.nearbyItems;
    if (filter === 'all') return inventory.items;
    return inventory.items.filter((item) => item.category === filter);
  }, [filter, inventory]);
  const selectedItem = visibleItems.find((item) => item.id === selectedItemId) || visibleItems[0] || null;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
      if (event.key === 'Escape' && isOpen) onOpenChange(false);
      if (!isTyping && event.key.toLowerCase() === 'b') onOpenChange(!isOpen);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    if (selectedItemId && visibleItems.some((item) => item.id === selectedItemId)) return;
    setSelectedItemId(visibleItems[0]?.id || null);
  }, [selectedItemId, visibleItems]);

  return (
    <>
      <button
        className={`inventory-stage-trigger ${isOpen ? 'active' : ''}`}
        type="button"
        aria-label={`打开背包，共 ${inventory?.totalQuantity || 0} 件道具`}
        aria-expanded={isOpen}
        onClick={() => onOpenChange(!isOpen)}
      >
        <Backpack size={18} />
        <span>背包</span>
        <strong>{inventory?.totalQuantity || 0}</strong>
      </button>

      {isOpen ? (
        <div className="inventory-layer">
          <button className="inventory-backdrop" type="button" aria-label="关闭背包" onClick={() => onOpenChange(false)} />
          <section className="inventory-drawer" role="dialog" aria-modal="true" aria-label="玩家背包">
            <header className="inventory-header">
              <div>
                <span className="inventory-header-icon"><Backpack size={19} /></span>
                <span>
                  <strong>背包</strong>
                  <small>{inventory ? `${inventory.items.length} 类 · ${inventory.totalQuantity} 件` : '读取中'}</small>
                </span>
              </div>
              <div className="inventory-header-actions">
                {inventory?.gold ? <span className="inventory-gold"><Coins size={15} />{inventory.gold}</span> : null}
                <button type="button" aria-label="关闭背包" onClick={() => onOpenChange(false)}><X size={18} /></button>
              </div>
            </header>

            <nav className="inventory-filters" aria-label="背包分类">
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

            <div className="inventory-content">
              <div className="inventory-list" role="listbox" aria-label="道具列表">
                {isLoading && !inventory ? (
                  <span className="inventory-empty"><Loader2 className="spin" size={20} />正在读取背包...</span>
                ) : visibleItems.length ? (
                  visibleItems.map((item) => (
                    <InventoryListItem
                      item={item}
                      isNearby={filter === 'nearby'}
                      isSelected={selectedItem?.id === item.id}
                      key={item.id}
                      onSelect={() => setSelectedItemId(item.id)}
                    />
                  ))
                ) : (
                  <span className="inventory-empty">
                    <PackageOpen size={22} />
                    {filter === 'nearby' ? '当前场景没有可拾取道具' : '这个分类还是空的'}
                  </span>
                )}
              </div>

              <div className="inventory-detail">
                {selectedItem ? (
                  <InventoryItemDetail
                    item={selectedItem}
                    inventory={inventory}
                    isDisabled={isDisabled || isLoading}
                    targetIds={targetIds}
                    onTargetChange={(actionId, targetId) => setTargetIds((current) => ({ ...current, [actionId]: targetId }))}
                    onExecuteAction={onExecuteAction}
                  />
                ) : (
                  <span className="inventory-empty">选择一件道具查看详情</span>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function InventoryListItem({ item, isNearby, isSelected, onSelect }: {
  item: InventoryItem;
  isNearby: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const Icon = categoryIcon(item.category);
  return (
    <button
      className={`inventory-list-item ${isSelected ? 'selected' : ''}`}
      type="button"
      role="option"
      aria-selected={isSelected}
      onClick={onSelect}
    >
      <span className={`inventory-item-icon category-${item.category}`}><Icon size={20} /></span>
      <span className="inventory-list-copy">
        <strong>{item.name}</strong>
        <small>{isNearby ? '当前场景' : categoryLabel(item.category)}</small>
      </span>
      {item.equipped ? <span className="inventory-equipped"><Check size={12} />已装备</span> : null}
      {item.quantity > 1 ? <span className="inventory-quantity">×{item.quantity}</span> : null}
    </button>
  );
}

function InventoryItemDetail({
  item,
  inventory,
  isDisabled,
  targetIds,
  onTargetChange,
  onExecuteAction,
}: {
  item: InventoryItem;
  inventory: PlayerInventory | null;
  isDisabled: boolean;
  targetIds: Record<string, string>;
  onTargetChange: (actionId: string, targetId: string) => void;
  onExecuteAction: (action: InventoryAction) => void | Promise<void>;
}) {
  const Icon = categoryIcon(item.category);
  return (
    <>
      <div className="inventory-detail-heading">
        <span className={`inventory-detail-icon category-${item.category}`}><Icon size={28} /></span>
        <div>
          <span>{categoryLabel(item.category)}{item.equipped ? ' · 已装备' : ''}</span>
          <strong>{item.name}</strong>
        </div>
        <span className="inventory-detail-count">{item.quantity} 件</span>
      </div>

      <p className="inventory-description">{item.identity.description || '这件道具还没有详细描述。'}</p>

      {item.rules.use?.type === 'restore_hit_points' ? (
        <div className="inventory-effect-card">
          <HeartPulse size={17} />
          <span><strong>恢复生命</strong><small>恢复 {String(item.rules.use.amount || 1)} 点生命值，消耗 1 件</small></span>
        </div>
      ) : null}

      <div className="inventory-action-list">
        {item.actions.map((action) => {
          const validTargets = inventory?.targets.filter((target) => action.validTargetIds.includes(target.id)) || [];
          const cachedTargetId = targetIds[action.id];
          const selectedTargetId = cachedTargetId && validTargets.some((target) => target.id === cachedTargetId)
            ? cachedTargetId
            : action.requiresTarget
              ? validTargets[0]?.id || ''
              : '';
          const needsSelector = action.targetMode !== 'none' && validTargets.length > 0;
          const missingTarget = action.requiresTarget && !selectedTargetId;
          return (
            <div className="inventory-action-row" key={action.id}>
              {needsSelector ? (
                <label>
                  <span>{action.requiresTarget ? '使用目标' : '展示给（可选）'}</span>
                  <select
                    value={selectedTargetId}
                    disabled={isDisabled || Boolean(action.disabledReason)}
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
                disabled={isDisabled || Boolean(action.disabledReason) || missingTarget}
                title={action.disabledReason || undefined}
                onClick={() => void onExecuteAction({ ...action, ...(selectedTargetId ? { targetId: selectedTargetId } : {}) })}
              >
                {isDisabled ? <Loader2 className="spin" size={16} /> : actionIcon(action.kind)}
                {action.label}
              </button>
              {action.disabledReason ? <small className="inventory-action-reason">{action.disabledReason}</small> : null}
            </div>
          );
        })}
      </div>
    </>
  );
}

function categoryIcon(category: string): LucideIcon {
  if (category === 'weapon') return Sword;
  if (category === 'consumable') return FlaskConical;
  if (category === 'quest') return KeyRound;
  if (category === 'clue') return ScrollText;
  return Wrench;
}

function categoryLabel(category: string) {
  if (category === 'weapon') return '装备';
  if (category === 'consumable') return '消耗品';
  if (category === 'quest') return '任务物品';
  if (category === 'clue') return '线索';
  return '工具';
}

function actionIcon(kind: InventoryAction['kind']) {
  if (kind === 'item.pickup' || kind === 'item.drop') return <MapPin size={16} />;
  if (kind === 'item.use') return <HeartPulse size={16} />;
  if (kind === 'item.equip' || kind === 'item.unequip') return <Sword size={16} />;
  return <ScrollText size={16} />;
}
