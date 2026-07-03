import { useEffect, useState } from 'preact/hooks';
import { hasSeenAbout, isBluetoothSupported } from '../state/prefs';
import { showAbout, showPairingWizard } from '../state/store';
import { AboutModal } from './AboutModal';
import { ErrorBanner } from './ErrorBanner';
import { Footer } from './Footer';
import { LcdPanel } from './LcdPanel';
import { PairingWizard } from './PairingWizard';
import type { TabId } from './TabBar';
import { TabBar, tabButtonId, tabPanelId } from './TabBar';
import { AdvancedTab } from './tabs/AdvancedTab';
import { AlarmsTab } from './tabs/AlarmsTab';
import { ClockTab } from './tabs/ClockTab';
import { RingtonesTab } from './tabs/RingtonesTab';
import { SettingsTab } from './tabs/SettingsTab';
import { UnsupportedNotice } from './UnsupportedNotice';

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
  const supported = isBluetoothSupported();

  useEffect(() => {
    if (supported && !hasSeenAbout()) showAbout.value = true;
  }, [supported]);

  if (!supported) {
    return (
      <div className="app-shell">
        <UnsupportedNotice />
        <Footer />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <LcdPanel />
      <ErrorBanner />
      <TabBar active={tab} onSelect={setTab} />
      <div id={tabPanelId(tab)} role="tabpanel" aria-labelledby={tabButtonId(tab)}>
        <TabContent tab={tab} />
      </div>
      <Footer />
      {showPairingWizard.value && <PairingWizard />}
      {showAbout.value && <AboutModal />}
    </div>
  );
}
