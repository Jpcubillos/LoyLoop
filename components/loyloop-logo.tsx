export function LoyLoopLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="relative grid h-9 w-9 place-items-center rounded-lg bg-brand-500 text-white shadow-soft">
        <div className="absolute h-4 w-6 rounded-full border-2 border-white" />
        <div className="absolute h-6 w-4 rounded-full border-2 border-white/80" />
      </div>
      <span className="text-xl font-bold tracking-normal text-ink">LoyLoop</span>
    </div>
  );
}
