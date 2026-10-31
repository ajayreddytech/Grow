/** Layered gradient mesh with slowly drifting glowing orbs. */
export function Background() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,#e3f4e6_0%,transparent_55%),radial-gradient(ellipse_at_bottom_right,#f7ead0_0%,transparent_55%),linear-gradient(180deg,#f8f6ee,#efeadb)] dark:bg-[radial-gradient(ellipse_at_top_left,#0f3322_0%,transparent_55%),radial-gradient(ellipse_at_bottom_right,#1d1a0c_0%,transparent_60%),linear-gradient(180deg,#06110c,#081510)]" />
      <div className="absolute -left-[10%] top-[8%] h-[38rem] w-[38rem] animate-drift rounded-full bg-leaf-300/40 blur-[110px] dark:bg-leaf-600/25" />
      <div className="absolute -right-[12%] top-[35%] h-[32rem] w-[32rem] animate-drift-slow rounded-full bg-amber-200/50 blur-[120px] dark:bg-amber-500/10" />
      <div className="absolute bottom-[-15%] left-[30%] h-[28rem] w-[28rem] animate-drift rounded-full bg-teal-200/40 blur-[110px] [animation-delay:-9s] dark:bg-teal-500/10" />
      {/* fine grain so the gradients don't band */}
      <div className="grain absolute inset-0 opacity-[0.035] mix-blend-overlay dark:opacity-[0.06]" />
    </div>
  );
}
