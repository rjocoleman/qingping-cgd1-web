export type TabId = 'clock' | 'alarms' | 'settings' | 'ringtones' | 'advanced';

const TABS: { id: TabId; label: string }[] = [
  { id: 'clock', label: 'Clock' },
  { id: 'alarms', label: 'Alarms' },
  { id: 'settings', label: 'Settings' },
  { id: 'ringtones', label: 'Ringtones' },
  { id: 'advanced', label: 'Advanced' },
];

export function TabBar({
  active,
  onSelect,
}: {
  active: TabId;
  onSelect: (tab: TabId) => void;
}) {
  return (
    <div className="tab-bar" role="tablist" aria-label="Sections">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          className="tab-bar__button"
          aria-selected={tab.id === active}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
