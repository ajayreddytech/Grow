import { AnimatePresence, motion } from 'framer-motion';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Background } from './components/Background';
import { NAV, Sidebar, type SectionId } from './components/Sidebar';
import { Toasts } from './components/Toasts';
import { useApp } from './context/AppContext';
import { LearningSection } from './sections/LearningSection';
import { GrowSection } from './sections/GrowSection';
import { MentorsSection } from './sections/MentorsSection';
import { SettingsSection } from './sections/SettingsSection';

// Recharts is the heaviest dependency — only load it when the analytics view is opened.
const LearningCurveSection = lazy(() =>
  import('./sections/LearningCurveSection').then((m) => ({ default: m.LearningCurveSection })),
);

const isSection = (s: string): s is SectionId => NAV.some((n) => n.id === s);
const fromHash = (): SectionId => {
  const h = window.location.hash.slice(1);
  if (h === 'knowledge') return 'learning'; // links saved before the Knowledge → Learning rename
  if (h === 'log') return 'grow'; // links saved before the Log → Grow rename
  return isSection(h) ? h : 'grow';
};

export default function App() {
  const [section, setSection] = useState<SectionId>(fromHash);
  const { loading } = useApp();

  useEffect(() => {
    const onHash = () => setSection(fromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (id: SectionId) => {
    if (id === section) return;
    window.history.pushState(null, '', `#${id}`);
    setSection(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <Background />
      <Sidebar active={section} onChange={go} />
      <Toasts />
      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 sm:pt-10 md:pb-16 md:pl-24 lg:pl-28">
        <AnimatePresence mode="wait">
          <motion.div
            key={section}
            initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          >
            {loading ? (
              <Loader />
            ) : (
              <Suspense fallback={<Loader />}>
                {section === 'grow' && <GrowSection />}
                {section === 'learning' && <LearningSection />}
                {section === 'mentors' && <MentorsSection />}
                {section === 'curve' && <LearningCurveSection />}
                {section === 'settings' && <SettingsSection />}
              </Suspense>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </>
  );
}

function Loader() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <span className="animate-bounce text-4xl" aria-label="Loading">
        🌱
      </span>
    </div>
  );
}
