import { useState } from 'preact/hooks';
import { isBluetoothSupported } from '../state/prefs';
import { showPairingWizard } from '../state/store';
import { ErrorBanner } from './ErrorBanner';
import { LcdPanel } from './LcdPanel';
import { PairingWizard } from './PairingWizard';
import { TabBar } from './TabBar';
import type { TabId } from './TabBar';
import { UnsupportedNotice } from './UnsupportedNotice';
import { AdvancedTab } from './tabs/AdvancedTab';
import { AlarmsTab } from './tabs/AlarmsTab';
import { ClockTab } from './tabs/ClockTab';
import { RingtonesTab } from './tabs/RingtonesTab';
import { SettingsTab } from './tabs/SettingsTab';

function TabContent({ tab }: { tab: TabId }) {
  switch (tab) {
    case 'clock':
      return <ClockTab />;
    case 'alarms':
      return <AlarmsTab />;
    case 'settings':
      return <SettingsTab />;
    case 'ringtones':
      return <RingtonesTab />;
    case 'advanced':
      return <AdvancedTab />;
  }
}

export function App() {
  const [tab, setTab] = useState<TabId>('clock');

  if (!isBluetoothSupported()) {
    return (
      <div className="app-shell">
        <UnsupportedNotice />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <LcdPanel />
      <ErrorBanner />
      <TabBar active={tab} onSelect={setTab} />
      <TabContent tab={tab} />
      {showPairingWizard.value && <PairingWizard />}
    </div>
  );
}
