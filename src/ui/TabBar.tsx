export type TabId = 'clock' | 'alarms' | 'settings' | 'ringtones' | 'advanced';

const TABS: { id: TabId; label: string }[] = [
  { id: 'clock', label: 'Clock' },
  { id: 'alarms', label: 'Alarms' },
  { id: 'settings', label: 'Settings' },
  { id: 'ringtones', label: 'Ringtones' },
  { id: 'advanced', label: 'Advanced' },
];

export function tabButtonId(tab: TabId): string {
  return `tab-${tab}`;
}

export function tabPanelId(tab: TabId): string {
  return `panel-${tab}`;
}

export function TabBar({
  active,
  onSelect,
}: {
  active: TabId;
  onSelect: (tab: TabId) => void;
}) {
  function onKeyDown(e: KeyboardEvent, index: number) {
    let next = index;
    if (e.key === 'ArrowRight') next = (index + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    else return;
    e.preventDefault();
    const target = TABS[next];
    if (!target) return;
    onSelect(target.id);
    document.getElementById(tabButtonId(target.id))?.focus();
  }

  return (
    <div className="tab-bar" role="tablist" aria-label="Sections">
      {TABS.map((tab, index) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            id={tabButtonId(tab.id)}
            type="button"
            role="tab"
            className="tab-bar__button"
            aria-selected={selected}
            aria-controls={tabPanelId(tab.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(e) => onKeyDown(e, index)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
